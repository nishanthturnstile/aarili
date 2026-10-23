import {
  patternCapabilitySchema,
  patternEventSchema,
  patternStateSchema,
  patternSubjectSchema,
  patternVersionSchema,
} from "@aarili/contracts/manual-patterns";
import { mediaRecordSchema } from "@aarili/contracts/media";
import { sql, type Transaction } from "./index.js";
import { mediaRepository } from "./media-repository.js";
import type { ManualPatternsRepository } from "./repositories/manual-patterns.js";
import type { MeasurementFitPurgeRepository } from "./repositories/measurement-fit.js";

export function manualPatternsRepository(
  tx: Transaction,
  shopId: string,
): ManualPatternsRepository {
  shopId = shopId.toLowerCase();
  const stamp = (r: Record<string, unknown>) => ({
    ...r,
    recordedAt: new Date(r.recordedAt as string).toISOString(),
  });
  const capFields = sql`id,payload,version,actor_id as "actorId",recorded_at as "recordedAt",origin_draft_id as "originDraftId"`;
  const capRow = (r: Record<string, unknown>) => {
    const { payload, ...fields } = r;
    return patternCapabilitySchema.parse({
      ...(payload as object),
      ...stamp(fields),
    });
  };
  const versionFields = async () => {
    const installed = (
      await tx.execute(
        sql`select to_regclass('pattern_output') is not null as installed`,
      )
    ).rows[0]?.installed;
    return sql`v.id,v.order_id as "orderId",s.piece_id as "pieceId",s.customer_id as "customerId",s.wearer_id as "wearerId",v.version,v.previous_id as "previousId",e.method,e.capability_id as "capabilityId",e.actor_id as "actorId",e.recorded_at as "recordedAt",e.origin_draft_id as "originDraftId",x.payload->'content' as content,coalesce(x.payload->>'reason','') as reason,(x.redacted_at is not null) as redacted,
      ${
        installed
          ? sql`
  (select evidence from pattern_output where shop_id=v.shop_id and version_id=v.id) as output,
  (select jsonb_build_object('referenceId',r.source_id,'orderId',src.order_id,'pieceId',ss.piece_id,'designId',src.design_id,'measurementId',src.measurement_id) from pattern_reuse r join pattern_version src on(src.shop_id,src.id)=(r.shop_id,r.source_id) join pattern_scope ss on(ss.shop_id,ss.order_id,ss.scope_key)=(src.shop_id,src.order_id,src.scope_key) where r.shop_id=v.shop_id and r.version_id=v.id) as source`
          : sql`null as output,null as source`
      }`;
  };
  const versionFrom = sql`pattern_version v join pattern_event e on(e.shop_id,e.id)=(v.shop_id,v.id) join pattern_scope s on(s.shop_id,s.order_id,s.scope_key)=(v.shop_id,v.order_id,v.scope_key) join pattern_value x on(x.shop_id,x.event_id)=(e.shop_id,e.id)`;
  const eventFields = sql`e.id,e.version,e.operation,e.reference_id as "referenceId",e.review_state as "reviewState",e.use_mode as use,e.actor_id as "actorId",e.recorded_at as "recordedAt",e.origin_draft_id as "originDraftId",e.digest,e.context_digest as "contextDigest",coalesce(x.payload->>'reason','') as reason,coalesce(x.payload->>'evidence','') as evidence,(x.redacted_at is not null) as redacted`;
  const eventFrom = sql`pattern_event e join pattern_value x on(x.shop_id,x.event_id)=(e.shop_id,e.id)`;
  const repo: ManualPatternsRepository = {
    async subject(id) {
      const r = (
        await tx.execute(
          sql`select id,order_id as "orderId",piece_id as "pieceId",customer_id as "customerId",wearer_id as "wearerId",false as erased from pattern_media_subject where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? patternSubjectSchema.parse(r) : undefined;
    },
    async subjectForScope(q) {
      const r = (
        await tx.execute<{ id: string }>(
          sql`select id from pattern_media_subject where shop_id=${shopId}::uuid and order_id=${q.orderId}::uuid and scope_key=${q.pieceId ?? q.orderId}::uuid`,
        )
      ).rows[0];
      return r ? repo.subject(r.id) : undefined;
    },
    async subjectForAsset(id) {
      const r = (
        await tx.execute<{ id: string }>(
          sql`select subject_id as id from pattern_media_asset where shop_id=${shopId}::uuid and asset_id=${id}::uuid`,
        )
      ).rows[0];
      return r ? repo.subject(r.id) : undefined;
    },
    async assets(subjectId, before) {
      const rows = (
        await tx.execute(
          sql`select m.id,m.subject_id as "subjectId",m.purpose,m.content_type as "contentType",m.declared_bytes as size,m.status,m.version,m.created_at as "createdAt" from pattern_media_asset own join media_asset m on(m.shop_id,m.id)=(own.shop_id,own.asset_id) where own.shop_id=${shopId}::uuid and own.subject_id=${subjectId}::uuid and (${before ?? null}::uuid is null or m.id<${before ?? null}::uuid) order by m.id desc limit 26`,
        )
      ).rows.map((r) =>
        mediaRecordSchema.parse({
          ...r,
          size: Number(r.size),
          createdAt: new Date(r.createdAt as string).toISOString(),
        }),
      );
      return {
        assets: rows.slice(0, 25),
        next: rows.length > 25 ? (rows[24]?.id ?? null) : null,
      };
    },
    async writeSubject(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Pattern subject identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,'pattern.subject','pattern-subject',${ids.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into pattern_media_subject(shop_id,id,order_id,scope_key,piece_id,customer_id,wearer_id,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.orderId}::uuid,${v.pieceId ?? v.orderId}::uuid,${v.pieceId}::uuid,${v.customerId}::uuid,${v.wearerId}::uuid,${v.actorId}::uuid,${v.draftId}::uuid,${ids.audit}::uuid,${v.key}::uuid)`,
      );
      return ids.id;
    },
    async lock(b) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`patternCapability:${shopId}:${b.manifest.revisionId}:${b.pieceKey ?? "order"}`},0))`,
      );
    },
    async lockScope(orderId, pieceId) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`patternScope:${shopId}:${orderId}:${pieceId ?? "order"}`},0))`,
      );
    },
    async capabilities(b, before) {
      return (
        await tx.execute(
          sql`select ${capFields} from pattern_capability where shop_id=${shopId}::uuid and manifest_id=${b.manifest.revisionId}::uuid and scope_key=${b.pieceKey ?? ""} and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(capRow);
    },
    async capability(b) {
      return (await repo.capabilities(b))[0];
    },
    async writeCapability(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Pattern identity unavailable");
      const prior = await repo.capability(v.binding);
      const { actorId, draftId, key, requestId, ...payload } = v;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${actorId}::uuid,'pattern.capability','pattern-capability',${ids.id}::uuid,${requestId}::uuid,${key}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into pattern_capability(shop_id,id,manifest_entry_id,manifest_id,scope_key,version,previous_id,payload,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.binding.manifest.entryId}::uuid,${v.binding.manifest.revisionId}::uuid,${v.binding.pieceKey ?? ""},${v.baseVersion + 1},${prior?.id ?? null}::uuid,${JSON.stringify(payload)}::jsonb,${actorId}::uuid,${draftId}::uuid,${ids.audit}::uuid,${key}::uuid)`,
      );
      return ids.id;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${await versionFields()} from ${versionFrom} where v.shop_id=${shopId}::uuid and v.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? patternVersionSchema.parse(stamp(r)) : undefined;
    },
    async selected(orderId) {
      if (
        !(
          await tx.execute(
            sql`select to_regclass('pattern_scope') is not null as installed`,
          )
        ).rows[0]?.installed
      )
        return [];
      const ids = (
        await tx.execute<{ id: string }>(
          sql`select current_id as id from pattern_scope where shop_id=${shopId}::uuid and order_id=${orderId}::uuid and current_id is not null order by scope_key limit 50`,
        )
      ).rows;
      const rows = [];
      for (const r of ids) {
        const v = await repo.read(r.id);
        if (v) rows.push(v);
      }
      return rows;
    },
    async review(id) {
      const r = (
        await tx.execute(
          sql`select ${eventFields} from ${eventFrom} where e.shop_id=${shopId}::uuid and e.reference_id=${id}::uuid and e.operation='review' order by e.version desc limit 1`,
        )
      ).rows[0];
      return r ? patternEventSchema.parse(stamp(r)) : undefined;
    },
    async state(q) {
      const s = (
        await tx.execute(
          sql`select version,latest_saved_id as "latestSavedId",current_id as "currentId",method from pattern_scope where shop_id=${shopId}::uuid and order_id=${q.orderId}::uuid and scope_key=${q.pieceId ?? q.orderId}::uuid`,
        )
      ).rows[0];
      const versions = (
        await tx.execute(
          sql`select ${await versionFields()} from ${versionFrom} where v.shop_id=${shopId}::uuid and v.order_id=${q.orderId}::uuid and v.scope_key=${q.pieceId ?? q.orderId}::uuid and (${q.beforeVersion ?? null}::integer is null or v.version<${q.beforeVersion ?? null}::integer) order by v.version desc limit 26`,
        )
      ).rows.map((r) => patternVersionSchema.parse(stamp(r)));
      const events = (
        await tx.execute(
          sql`select ${eventFields} from ${eventFrom} where e.shop_id=${shopId}::uuid and e.order_id=${q.orderId}::uuid and e.scope_key=${q.pieceId ?? q.orderId}::uuid and (${q.beforeEvent ?? null}::integer is null or e.version<${q.beforeEvent ?? null}::integer) order by e.version desc limit 26`,
        )
      ).rows.map((r) => patternEventSchema.parse(stamp(r)));
      return patternStateSchema.parse({
        orderId: q.orderId,
        pieceId: q.pieceId,
        ...s,
        version: s?.version ?? 0,
        latestSavedId: s?.latestSavedId ?? null,
        currentId: s?.currentId ?? null,
        method: s?.method ?? null,
        versions: versions.slice(0, 25),
        events: events.slice(0, 25),
        nextVersion:
          versions.length > 25 ? (versions[24]?.version ?? null) : null,
        nextEvent: events.length > 25 ? (events[24]?.version ?? null) : null,
      });
    },
    async write(v, capabilityId, contextDigest) {
      const prior = await repo.state({
        orderId: v.orderId,
        pieceId: v.pieceId,
      });
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Pattern identity unavailable");
      const saved = v.operation === "save" ? ids.id : prior.latestSavedId,
        current = v.operation === "select" ? v.referenceId : prior.currentId;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,${`pattern.${v.operation}`},'pattern-reference',${ids.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ orderId: v.orderId, pieceId: v.pieceId, version: v.baseVersion + 1, referenceId: v.referenceId })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into pattern_event(shop_id,id,order_id,scope_key,version,operation,method,capability_id,reference_id,saved_id,current_id,previous_saved_id,previous_current_id,review_state,use_mode,digest,context_digest,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.orderId}::uuid,${v.pieceId ?? v.orderId}::uuid,${v.baseVersion + 1},${v.operation},${v.method},${capabilityId}::uuid,${v.operation === "save" ? ids.id : v.referenceId}::uuid,${saved}::uuid,${current}::uuid,${prior.latestSavedId}::uuid,${prior.currentId}::uuid,${v.operation === "review" ? v.reviewState : null},${v.use},${v.digest},${contextDigest},${v.actorId}::uuid,${v.draftId}::uuid,${ids.audit}::uuid,${v.key}::uuid)`,
      );
      if (v.operation === "save") {
        const previous = prior.latestSavedId
          ? await repo.read(prior.latestSavedId)
          : null;
        await tx.execute(
          sql`insert into pattern_version(shop_id,id,order_id,scope_key,version,previous_id,design_id,measurement_id) values(${shopId}::uuid,${ids.id}::uuid,${v.orderId}::uuid,${v.pieceId ?? v.orderId}::uuid,${(previous?.version ?? 0) + 1},${prior.latestSavedId}::uuid,${v.content.design.state === "known" ? v.content.design.versionId : null}::uuid,${v.content.measurement.state === "known" ? v.content.measurement.versionId : null}::uuid)`,
        );
      }
      const {
        actorId: _actor,
        draftId: _draft,
        key: _key,
        requestId: _request,
        ...payload
      } = v;
      await tx.execute(
        sql`insert into pattern_value(shop_id,event_id,payload) values(${shopId}::uuid,${ids.id}::uuid,${JSON.stringify(payload)}::jsonb)`,
      );
      if (v.operation === "save" && "assetId" in v) {
        const source = v.reuse
          ? await repo.read(v.reuse.referenceId)
          : undefined;
        const assetId = v.assetId ?? source?.output?.assetId;
        if (v.reuse)
          await tx.execute(
            sql`insert into pattern_reuse(shop_id,version_id,source_id,source_digest) values(${shopId}::uuid,${ids.id}::uuid,${v.reuse.referenceId}::uuid,${v.reuse.digest})`,
          );
        if (assetId) {
          await tx.execute(sql`insert into pattern_output(shop_id,version_id,subject_id,asset_id,evidence)
          select ${shopId}::uuid,${ids.id}::uuid,own.subject_id,m.id,jsonb_build_object('assetId',m.id,'subjectId',own.subject_id,'contentType',m.content_type,'originalSha256',m.sha256,'display',(select jsonb_build_object('sha256',d.sha256,'width',d.width,'height',d.height) from media_derivative d where d.shop_id=m.shop_id and d.asset_id=m.id and d.variant='display'),'thumbnailSha256',(select sha256 from media_derivative d where d.shop_id=m.shop_id and d.asset_id=m.id and d.variant='thumbnail'))
          from pattern_media_asset own join media_asset m on(m.shop_id,m.id)=(own.shop_id,own.asset_id) where own.shop_id=${shopId}::uuid and own.asset_id=${assetId}::uuid`);
          await tx.execute(
            sql`insert into media_reference(shop_id,asset_id,reference_id) values(${shopId}::uuid,${assetId}::uuid,${ids.id}::uuid)`,
          );
        }
      }
      const updated =
        v.baseVersion === 0
          ? await tx.execute(
              sql`insert into pattern_scope(shop_id,order_id,scope_key,piece_id,customer_id,wearer_id,version,latest_saved_id,current_id,method,event_id) values(${shopId}::uuid,${v.orderId}::uuid,${v.pieceId ?? v.orderId}::uuid,${v.pieceId}::uuid,${v.customerId}::uuid,${v.wearerId}::uuid,1,${saved}::uuid,${current}::uuid,${v.method},${ids.id}::uuid) on conflict do nothing returning version`,
            )
          : await tx.execute(
              sql`update pattern_scope set version=${v.baseVersion + 1},latest_saved_id=${saved}::uuid,current_id=${current}::uuid,method=${v.method},event_id=${ids.id}::uuid where shop_id=${shopId}::uuid and order_id=${v.orderId}::uuid and scope_key=${v.pieceId ?? v.orderId}::uuid and version=${v.baseVersion} returning version`,
            );
      if (!updated.rowCount) throw Error("Pattern scope CAS failed");
      return ids.id;
    },
    async origin(id, draftId, kind) {
      return !!(
        await tx.execute(
          kind === "subject"
            ? sql`select id from pattern_media_subject where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`
            : kind === "capability"
              ? sql`select id from pattern_capability where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`
              : sql`select id from pattern_event where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async replayPayload(id, version) {
      const r = (
        await tx.execute(
          sql`select payload from pattern_draft_value where shop_id=${shopId}::uuid and draft_id=${id}::uuid and version=${version}`,
        )
      ).rows[0];
      if (!r) throw Error("Private pattern draft unavailable");
      return r.payload as Record<string, unknown>;
    },
    async retainPrivateResponse(r, a, k) {
      await tx.execute(
        sql`insert into pattern_draft_value(shop_id,draft_id,version,order_id,customer_id,wearer_id,payload,audit_id,command_key) values(${shopId}::uuid,${r.id}::uuid,${r.version},${String(r.payload.orderId)}::uuid,${String(r.payload.customerId)}::uuid,${String(r.payload.wearerId)}::uuid,${JSON.stringify(r.payload)}::jsonb,${a}::uuid,${k}::uuid)`,
      );
    },
  };
  return repo;
}

export function patternOutputPurgeRepository(
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
          sql`select p.id,p.asset_id as "assetId",p.wearer_id as "wearerId",p.initiator_id as "initiatorId",p.restore_epoch as epoch,p.manifest,p.not_before as "notBefore",coalesce((select jsonb_agg(object_key) from pattern_output_purge_receipt r where r.shop_id=p.shop_id and r.purge_id=p.id),'[]'::jsonb) as received from pattern_output_purge p join measurement_erasure e on (e.shop_id,e.wearer_id,e.audit_id)=(p.shop_id,p.wearer_id,p.audit_id) where p.shop_id=${shopId}::uuid and p.id=${id}::uuid`,
        )
      ).rows[0];
      return r
        ? { ...r, notBefore: new Date(r.notBefore).toISOString() }
        : undefined;
    },
    async receipt(id, key, actorId) {
      const audit = await media.id();
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${audit}::uuid,'user',${actorId}::uuid,'pattern.output-purge','pattern-output-purge',${id}::uuid,${id}::uuid,${audit}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into pattern_output_purge_receipt(shop_id,purge_id,object_key,audit_id) values(${shopId}::uuid,${id}::uuid,${key},${audit}::uuid)`,
      );
    },
  };
}
