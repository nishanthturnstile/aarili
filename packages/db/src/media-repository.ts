import { sql, type Transaction } from "./index.js";
import type {
  MediaAsset,
  MediaAttempt,
  MediaRepository,
} from "./repositories/media.js";
import { requestRepository } from "./request-repository.js";
import { restoreRepository } from "./restore-repository.js";

const columns = sql`id,shop_id as "shopId",creator_id as "creatorId",subject_id as "subjectId",purpose,minor,content_type as "contentType",declared_bytes as size,status,version,created_at as "createdAt",staging_expires_at as "expiresAt",staging_key as "stagingKey",accepted_key as "acceptedKey",sha256,accepted_bytes as "acceptedBytes",attempt_id as "attemptId"`;
function asset(r: Record<string, unknown>): MediaAsset {
  return {
    ...r,
    createdAt: new Date(r.createdAt as string).toISOString(),
    expiresAt: new Date(r.expiresAt as string).toISOString(),
  } as MediaAsset;
}
export function mediaRepository(
  tx: Transaction,
  shopId: string,
): MediaRepository {
  shopId = shopId.toLowerCase();
  const repo: MediaRepository = {
    ...requestRepository(tx, shopId),
    async now() {
      const r = await tx.execute<{ now: Date }>(
        sql`select clock_timestamp() as now`,
      );
      return new Date(r.rows[0]?.now ?? NaN);
    },
    async id() {
      const r = await tx.execute<{ id: string }>(sql`select uuidv7() as id`);
      if (!r.rows[0]) throw Error("Media identity unavailable");
      return r.rows[0].id;
    },
    async lock(id) {
      id = id.toLowerCase();
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:media:'||${shopId}::text||':'||${id}::text,0))`,
      );
    },
    async read(id) {
      const r = await tx.execute(
        sql`select ${columns} from media_asset where shop_id=${shopId}::uuid and id=${id}::uuid`,
      );
      return r.rows[0] ? asset(r.rows[0]) : undefined;
    },
    async insert(a) {
      const r = await tx.execute(
        sql`insert into media_asset(shop_id,id,creator_id,subject_id,purpose,minor,content_type,declared_bytes,staging_key,staging_expires_at) values(${shopId}::uuid,${a.id}::uuid,${a.creatorId}::uuid,${a.subjectId}::uuid,${a.purpose},${a.minor},${a.contentType},${a.size},${a.stagingKey},${a.expiresAt}::timestamptz) returning ${columns}`,
      );
      return asset(r.rows[0] as Record<string, unknown>);
    },
    async start(a, p) {
      await tx.execute(
        sql`insert into media_attempt(shop_id,id,asset_id,initiator_id,restore_epoch,state) values(${shopId}::uuid,${p.id}::uuid,${a.id}::uuid,${p.initiatorId}::uuid,${p.epoch}::uuid,'queued')`,
      );
      const r = await tx.execute(
        sql`update media_asset set status='processing',version=version+1,attempt_id=${p.id}::uuid where shop_id=${shopId}::uuid and id=${a.id}::uuid returning ${columns}`,
      );
      return asset(r.rows[0] as Record<string, unknown>);
    },
    async attempt(id) {
      const r = await tx.execute(
        sql`select id,asset_id as "assetId",initiator_id as "initiatorId",restore_epoch as epoch,state,fence,lease_until as "leaseUntil" from media_attempt where shop_id=${shopId}::uuid and asset_id=${id}::uuid`,
      );
      const a = r.rows[0];
      return a
        ? ({
            ...a,
            leaseUntil: a.leaseUntil
              ? new Date(a.leaseUntil as string).toISOString()
              : null,
          } as MediaAttempt)
        : undefined;
    },
    async claim(id, fence, until) {
      await tx.execute(
        sql`update media_attempt set state='processing',fence=${fence}::uuid,lease_until=${until}::timestamptz where shop_id=${shopId}::uuid and id=${id}::uuid`,
      );
    },
    async accept(id, attempt, fence, key, hash, bytes, derivatives = []) {
      const r = await tx.execute(
        sql`update media_attempt set state='accepted' where shop_id=${shopId}::uuid and id=${attempt}::uuid and fence=${fence}::uuid returning id`,
      );
      if (!r.rowCount) throw Error("Media fence lost");
      const a = await tx.execute(
        sql`update media_asset set status='ready',version=version+1,accepted_key=${key},sha256=${hash},accepted_bytes=${bytes} where shop_id=${shopId}::uuid and id=${id}::uuid and attempt_id=${attempt}::uuid returning ${columns}`,
      );
      for (const d of derivatives)
        await tx.execute(
          sql`insert into media_derivative(shop_id,asset_id,variant,object_key,sha256,accepted_bytes,width,height,content_type) values(${shopId}::uuid,${id}::uuid,${d.variant},${d.key},${d.sha256},${d.bytes},${d.width},${d.height},${d.contentType})`,
        );
      return asset(a.rows[0] as Record<string, unknown>);
    },
    async derivatives(id) {
      const r = await tx.execute(
        sql`select variant,object_key as key,sha256,accepted_bytes as bytes,width,height,content_type as "contentType" from media_derivative where shop_id=${shopId}::uuid and asset_id=${id}::uuid order by variant`,
      );
      return r.rows as Awaited<ReturnType<MediaRepository["derivatives"]>>;
    },
    async release(id, fence) {
      await tx.execute(
        sql`update media_attempt set lease_until=clock_timestamp() where shop_id=${shopId}::uuid and id=${id}::uuid and fence=${fence}::uuid and state='processing'`,
      );
    },
    async claims(id, before) {
      const r = await tx.execute<{ fence: string }>(
        sql`select id as fence from audit_event where shop_id=${shopId}::uuid and entity_type='media_asset' and entity_id=${id}::uuid and action='media.claim' and occurred_at<=${before}::timestamptz order by occurred_at,id limit 10`,
      );
      return r.rows;
    },
    async cleanupIntents(id, epoch) {
      const r = await tx.execute(
        sql`select id,object_key as key,claim_fence as fence,restore_epoch as epoch from media_cleanup_intent where shop_id=${shopId}::uuid and asset_id=${id}::uuid and restore_epoch=${epoch}::uuid and completed_at is null order by created_at,id limit 20`,
      );
      return r.rows as Awaited<ReturnType<MediaRepository["cleanupIntents"]>>;
    },
    async intent(id, p, actorId) {
      const r = await tx.execute(
        sql`insert into media_cleanup_intent(shop_id,id,asset_id,object_key,claim_fence,restore_epoch,actor_id) values(${shopId}::uuid,${p.id}::uuid,${id}::uuid,${p.key},${p.fence}::uuid,${p.epoch}::uuid,${actorId}::uuid) on conflict(shop_id,asset_id,object_key,restore_epoch) do nothing returning id`,
      );
      return !!r.rowCount;
    },
    async cleaned(id, intent, action) {
      await tx.execute(
        sql`update media_cleanup_intent set completed_at=clock_timestamp(),completion_action_id=${action}::uuid where shop_id=${shopId}::uuid and asset_id=${id}::uuid and id=${intent}::uuid and completed_at is null`,
      );
    },
    async quarantine(id, attempt, fence) {
      const updated = await tx.execute(
        sql`update media_attempt set state='quarantined' where shop_id=${shopId}::uuid and id=${attempt}::uuid and fence=${fence}::uuid returning id`,
      );
      if (!updated.rowCount) throw Error("Media fence lost");
      await tx.execute(
        sql`update media_asset set status='quarantined',version=version+1 where shop_id=${shopId}::uuid and id=${id}::uuid`,
      );
    },
    async referenced(id) {
      const r = await tx.execute(
        sql`select 1 from media_reference where shop_id=${shopId}::uuid and asset_id=${id}::uuid limit 1`,
      );
      return !!r.rowCount;
    },
    async expire(id) {
      const r = await tx.execute(
        sql`update media_asset set status='expired',version=version+1 where shop_id=${shopId}::uuid and id=${id}::uuid and status='pending_upload' returning id`,
      );
      return !!r.rowCount;
    },
    async audit(e) {
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${e.id}::uuid,${e.actor.type},${e.actor.id}::uuid,${e.action},'media_asset',${e.assetId}::uuid,${e.requestId}::uuid,${e.key}::uuid,'{}'::jsonb)`,
      );
    },
    async control() {
      return restoreRepository(tx, shopId).lockState();
    },
  };
  return repo;
}
