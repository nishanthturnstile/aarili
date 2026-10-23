import {
  measurementFitReferenceDraftSchema,
  measurementFitReferenceSchema,
  measurementFitSubjectDraftSchema,
  measurementFitSubjectSchema,
} from "@aarili/contracts/measurement-fit";
import { mediaRecordSchema } from "@aarili/contracts/media";
import { sql, type Transaction } from "./index.js";
import { mediaRepository } from "./media-repository.js";
import type {
  MeasurementFitPurgeRepository,
  MeasurementFitRepository,
} from "./repositories/measurement-fit.js";

export function measurementFitRepository(
  tx: Transaction,
  shopId: string,
): MeasurementFitRepository {
  shopId = shopId.toLowerCase();
  let installed: Promise<boolean> | undefined;
  const available = () =>
    (installed ??= (async () =>
      !!(
        await tx.execute(
          sql`select to_regclass('public.measurement_fit_subject') as present`,
        )
      ).rows[0]?.present)());
  const subjectFields = sql`id,session_id as "sessionId",customer_id as "customerId",wearer_id as "wearerId",origin_draft_id as "originDraftId",actor_id as "actorId",recorded_at as "recordedAt"`;
  const subjectRow = (r: Record<string, unknown>) =>
    measurementFitSubjectSchema.parse({
      ...r,
      recordedAt: new Date(r.recordedAt as string).toISOString(),
    });
  const referenceFields = sql`select r.id,r.measurement_version_id as "measurementVersionId",r.session_id as "sessionId",r.subject_id as "subjectId",r.asset_id as "assetId",r.root_id as "rootId",r.previous_id as "previousId",r.version,r.actor_id as "actorId",r.recorded_at as "recordedAt",r.origin_draft_id as "originDraftId",r.original_sha256 as "originalSha256",r.display,r.thumbnail_sha256 as "thumbnailSha256",coalesce(v.caption,'') as caption,coalesce(v.reason,'') as reason,(v.redacted_at is not null) as redacted,(select h.id from measurement_fit_reference h where h.shop_id=r.shop_id and h.root_id=r.root_id order by h.version desc limit 1) as "headId" from measurement_fit_reference r join measurement_fit_value v on (v.shop_id,v.reference_id)=(r.shop_id,r.id)`;
  const referenceRow = (r: Record<string, unknown>) =>
    measurementFitReferenceSchema.parse({
      ...r,
      recordedAt: new Date(r.recordedAt as string).toISOString(),
    });
  const repo: MeasurementFitRepository = {
    async subject(id) {
      if (!(await available())) return undefined;
      const r = (
        await tx.execute(
          sql`select ${subjectFields} from measurement_fit_subject where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? subjectRow(r) : undefined;
    },
    async subjectForAsset(id) {
      if (!(await available())) return undefined;
      const r = (
        await tx.execute<{ subject_id: string }>(
          sql`select subject_id from measurement_fit_asset where shop_id=${shopId}::uuid and asset_id=${id}::uuid`,
        )
      ).rows[0];
      return r ? repo.subject(r.subject_id) : undefined;
    },
    async forSession(id) {
      return repo.subject(id);
    },
    async lockSession(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`measurementSession:${shopId}:${id}`},0))`,
      );
    },
    async writeSubject(v, sessionId) {
      const audit = (
        await tx.execute<{ id: string }>(sql`select uuidv7() as id`)
      ).rows[0]?.id;
      if (!audit) throw Error("Fit identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${audit}::uuid,'user',${v.actorId}::uuid,'measurement.fit-subject','measurement-fit-subject',${sessionId}::uuid,${v.requestId}::uuid,${v.key}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into measurement_fit_subject(shop_id,id,session_id,customer_id,wearer_id,anchor_version_id,origin_draft_id,actor_id,audit_id,command_key) values(${shopId}::uuid,${sessionId}::uuid,${sessionId}::uuid,${v.customerId}::uuid,${v.wearerId}::uuid,${v.measurementVersionId}::uuid,${v.draftId}::uuid,${v.actorId}::uuid,${audit}::uuid,${v.key}::uuid)`,
      );
      return sessionId;
    },
    async reference(id, versionId) {
      const r = (
        await tx.execute(
          sql`${referenceFields} where r.shop_id=${shopId}::uuid and r.id=${id}::uuid and r.measurement_version_id=${versionId}::uuid`,
        )
      ).rows[0];
      return r ? referenceRow(r) : undefined;
    },
    async references(versionId, before) {
      const rows = (
        await tx.execute(
          sql`${referenceFields} where r.shop_id=${shopId}::uuid and r.measurement_version_id=${versionId}::uuid and (${before ?? null}::uuid is null or r.id<${before ?? null}::uuid) order by r.id desc limit 26`,
        )
      ).rows;
      return {
        references: rows.slice(0, 25).map(referenceRow),
        next: rows.length > 25 ? String(rows[24]?.id) : null,
      };
    },
    async assets(subjectId, before) {
      const rows = (
        await tx.execute(
          sql`select a.id,a.subject_id as "subjectId",a.purpose,a.content_type as "contentType",a.declared_bytes as size,a.status,a.version,a.created_at as "createdAt" from media_asset a join measurement_fit_asset f on (f.shop_id,f.asset_id)=(a.shop_id,a.id) where a.shop_id=${shopId}::uuid and f.subject_id=${subjectId}::uuid and (${before ?? null}::uuid is null or a.id<${before ?? null}::uuid) order by a.id desc limit 26`,
        )
      ).rows;
      return {
        assets: rows.slice(0, 25).map((r) =>
          mediaRecordSchema.parse({
            ...r,
            size: Number(r.size),
            createdAt: new Date(r.createdAt as string).toISOString(),
          }),
        ),
        next: rows.length > 25 ? String(rows[24]?.id) : null,
      };
    },
    async writeReference(v, subject) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Fit identity unavailable");
      const prior = v.previousId
        ? await repo.reference(v.previousId, v.measurementVersionId)
        : undefined;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,'measurement.fit-reference','measurement-fit-reference',${ids.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into measurement_fit_reference(shop_id,id,measurement_version_id,session_id,subject_id,asset_id,root_id,previous_id,version,actor_id,origin_draft_id,audit_id,command_key,original_sha256,display,thumbnail_sha256) select ${shopId}::uuid,${ids.id}::uuid,${v.measurementVersionId}::uuid,${subject.sessionId}::uuid,${subject.id}::uuid,a.id,${prior?.rootId ?? ids.id}::uuid,${v.previousId}::uuid,${v.baseVersion + 1},${v.actorId}::uuid,${v.draftId}::uuid,${ids.audit}::uuid,${v.key}::uuid,a.sha256,jsonb_build_object('sha256',d.sha256,'width',d.width,'height',d.height),t.sha256 from media_asset a join media_derivative d on d.shop_id=a.shop_id and d.asset_id=a.id and d.variant='display' join media_derivative t on t.shop_id=a.shop_id and t.asset_id=a.id and t.variant='thumbnail' where a.shop_id=${shopId}::uuid and a.id=${v.assetId}::uuid`,
      );
      await tx.execute(
        sql`insert into measurement_fit_value(shop_id,reference_id,caption,reason) values(${shopId}::uuid,${ids.id}::uuid,${v.caption},${v.reason})`,
      );
      await tx.execute(
        sql`insert into media_reference(shop_id,asset_id,reference_id) values(${shopId}::uuid,${v.assetId}::uuid,${ids.id}::uuid)`,
      );
      return ids.id;
    },
    async origin(id, draftId, kind) {
      const table =
        kind === "subject"
          ? sql`measurement_fit_subject`
          : sql`measurement_fit_reference`;
      return !!(
        await tx.execute(
          sql`select id from ${table} where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async retainDraft(record, auditId, key) {
      const p =
        record.workflow === "measurement.fit-subject"
          ? measurementFitSubjectDraftSchema.parse(record.payload)
          : measurementFitReferenceDraftSchema.parse(record.payload);
      await tx.execute(
        sql`insert into measurement_fit_draft_value(shop_id,draft_id,version,customer_id,wearer_id,payload,audit_id,command_key) values(${shopId}::uuid,${record.id}::uuid,${record.version},${p.customerId}::uuid,${p.wearerId}::uuid,${JSON.stringify(p)}::jsonb,${auditId}::uuid,${key}::uuid)`,
      );
    },
    async replayDraft(id, version) {
      const r = (
        await tx.execute(
          sql`select payload from measurement_fit_draft_value where shop_id=${shopId}::uuid and draft_id=${id}::uuid and version=${version}`,
        )
      ).rows[0];
      if (!r) throw Error("Private fit response unavailable");
      return r.payload as Record<string, unknown>;
    },
  };
  return repo;
}
export function measurementFitPurgeRepository(
  tx: Transaction,
  shopId: string,
): MeasurementFitPurgeRepository {
  const media = mediaRepository(tx, shopId);
  return {
    lock: (id) => media.lock(id),
    control: () => media.control(),
    now: () => media.now(),
    async read(id) {
      const r = (
        await tx.execute<{
          id: string;
          assetId: string;
          wearerId: string;
          initiatorId: string;
          epoch: string;
          manifest: { keys: string[]; prefixes: string[] };
          notBefore: string;
          received: string[];
        }>(
          sql`select p.id,p.asset_id as "assetId",p.wearer_id as "wearerId",p.initiator_id as "initiatorId",p.restore_epoch as epoch,p.manifest,p.not_before as "notBefore",coalesce((select jsonb_agg(object_key) from measurement_fit_purge_receipt r where r.shop_id=p.shop_id and r.purge_id=p.id),'[]'::jsonb) as received from measurement_fit_purge p join measurement_erasure e on (e.shop_id,e.wearer_id,e.audit_id)=(p.shop_id,p.wearer_id,p.audit_id) where p.shop_id=${shopId}::uuid and p.id=${id}::uuid`,
        )
      ).rows[0];
      return r
        ? { ...r, notBefore: new Date(r.notBefore).toISOString() }
        : undefined;
    },
    async receipt(id, key, actorId) {
      const audit = await media.id();
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${audit}::uuid,'user',${actorId}::uuid,'measurement.fit-purge','measurement-fit-purge',${id}::uuid,${id}::uuid,${audit}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into measurement_fit_purge_receipt(shop_id,purge_id,object_key,audit_id) values(${shopId}::uuid,${id}::uuid,${key},${audit}::uuid)`,
      );
    },
  };
}
