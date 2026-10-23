import {
  patternCapabilitySchema,
  patternEventSchema,
  patternStateSchema,
  patternVersionSchema,
} from "@aarili/contracts/manual-patterns";
import { sql, type Transaction } from "./index.js";
import type { ManualPatternsRepository } from "./repositories/manual-patterns.js";

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
  const versionFields = sql`v.id,v.order_id as "orderId",s.piece_id as "pieceId",s.customer_id as "customerId",s.wearer_id as "wearerId",v.version,v.previous_id as "previousId",e.method,e.capability_id as "capabilityId",e.actor_id as "actorId",e.recorded_at as "recordedAt",e.origin_draft_id as "originDraftId",x.payload->'content' as content,coalesce(x.payload->>'reason','') as reason,(x.redacted_at is not null) as redacted`;
  const versionFrom = sql`pattern_version v join pattern_event e on(e.shop_id,e.id)=(v.shop_id,v.id) join pattern_scope s on(s.shop_id,s.order_id,s.scope_key)=(v.shop_id,v.order_id,v.scope_key) join pattern_value x on(x.shop_id,x.event_id)=(e.shop_id,e.id)`;
  const eventFields = sql`e.id,e.version,e.operation,e.reference_id as "referenceId",e.review_state as "reviewState",e.use_mode as use,e.actor_id as "actorId",e.recorded_at as "recordedAt",e.origin_draft_id as "originDraftId",e.digest,e.context_digest as "contextDigest",coalesce(x.payload->>'reason','') as reason,coalesce(x.payload->>'evidence','') as evidence,(x.redacted_at is not null) as redacted`;
  const eventFrom = sql`pattern_event e join pattern_value x on(x.shop_id,x.event_id)=(e.shop_id,e.id)`;
  const repo: ManualPatternsRepository = {
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
          sql`select ${versionFields} from ${versionFrom} where v.shop_id=${shopId}::uuid and v.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? patternVersionSchema.parse(stamp(r)) : undefined;
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
          sql`select ${versionFields} from ${versionFrom} where v.shop_id=${shopId}::uuid and v.order_id=${q.orderId}::uuid and v.scope_key=${q.pieceId ?? q.orderId}::uuid and (${q.beforeVersion ?? null}::integer is null or v.version<${q.beforeVersion ?? null}::integer) order by v.version desc limit 26`,
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
          kind === "capability"
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
