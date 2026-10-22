import type { DesignReferenceSnapshot } from "@aarili/contracts/design-references";
import {
  designSpecificationStateSchema,
  designSpecificationVersionSchema,
} from "@aarili/contracts/design-specifications";
import { sql, type Transaction } from "./index.js";
import type { DesignSpecificationsRepository } from "./repositories/design-specifications.js";

export function designSpecificationsRepository(
  tx: Transaction,
  shopId: string,
  referenceReader?: (id: string) => Promise<DesignReferenceSnapshot[]>,
): DesignSpecificationsRepository {
  shopId = shopId.toLowerCase();
  const fields = sql`v.id,v.order_id as "orderId",s.piece_id as "pieceId",s.customer_id as "customerId",s.wearer_id as "wearerId",v.version,v.previous_id as "previousId",v.snapshot_digest as "snapshotDigest",v.frozen->'profile' as profile,v.frozen->'choices' as choices,coalesce(x.answers,'[]'::jsonb) as answers,e.actor_id as "actorId",e.recorded_at as "recordedAt",coalesce(x.reason,'') as reason,e.origin_draft_id as "originDraftId",v.digest,v.reuse,(x.redacted_at is not null) as redacted`;
  const from = sql`design_spec_version v join design_spec_scope s on (s.shop_id,s.order_id,s.scope_key)=(v.shop_id,v.order_id,v.scope_key) join design_spec_event e on (e.shop_id,e.id)=(v.shop_id,v.event_id) join design_spec_value x on (x.shop_id,x.event_id)=(e.shop_id,e.id)`;
  const row = async (r: Record<string, unknown>) =>
    designSpecificationVersionSchema.parse({
      ...r,
      ...(r.redacted === true ? { choices: [], reuse: null } : {}),
      recordedAt: new Date(r.recordedAt as string).toISOString(),
      approval: "not-recorded",
      references: referenceReader ? "available" : "unavailable",
      referenceItems:
        referenceReader && r.redacted !== true
          ? await referenceReader(String(r.id))
          : [],
    });
  const repo: DesignSpecificationsRepository = {
    async orderKind(orderId) {
      return (
        await tx.execute<{ kind: "custom" | "service" }>(
          sql`select intake_kind as kind from garment_order where shop_id=${shopId}::uuid and id=${orderId}::uuid`,
        )
      ).rows[0]?.kind;
    },
    async replayPayload(draftId, version) {
      const r = (
        await tx.execute(
          sql`select payload from design_spec_draft_value where shop_id=${shopId}::uuid and draft_id=${draftId}::uuid and version=${version}`,
        )
      ).rows[0];
      if (!r) throw Error("Private draft response unavailable");
      return r.payload as Record<string, unknown>;
    },
    async retainPrivateResponse(record, auditId, key) {
      await tx.execute(
        sql`insert into design_spec_draft_value(shop_id,draft_id,version,order_id,scope_key,piece_id,payload,audit_id,command_key) values(${shopId}::uuid,${record.id}::uuid,${record.version},${String(record.payload.orderId)}::uuid,${String(record.payload.pieceId ?? record.payload.orderId)}::uuid,${record.payload.pieceId ? String(record.payload.pieceId) : null}::uuid,${JSON.stringify(record.payload)}::jsonb,${auditId}::uuid,${key}::uuid)`,
      );
    },
    async lock(orderId, pieceId) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`designScope:${shopId}:${orderId}:${pieceId ?? "order"}`},0))`,
      );
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${fields} from ${from} where v.shop_id=${shopId}::uuid and v.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async state(orderId, pieceId, before, beforeSelection) {
      const key = pieceId ?? orderId;
      const s = (
        await tx.execute(
          sql`select version,latest_saved_id as "latestSavedId",current_id as "currentId" from design_spec_scope where shop_id=${shopId}::uuid and order_id=${orderId}::uuid and scope_key=${key}::uuid`,
        )
      ).rows[0];
      const versions = await Promise.all(
        (
          await tx.execute(
            sql`select ${fields} from ${from} where v.shop_id=${shopId}::uuid and v.order_id=${orderId}::uuid and v.scope_key=${key}::uuid and (${before ?? null}::integer is null or v.version<${before ?? null}::integer) order by v.version desc limit 25`,
          )
        ).rows.map(row),
      );
      const selections = (
        await tx.execute(
          sql`select e.id,e.current_id as "versionId",e.scope_version as "scopeVersion",e.actor_id as "actorId",e.recorded_at as "recordedAt",coalesce(x.reason,'') as reason,(x.redacted_at is not null) as redacted from design_spec_event e join design_spec_value x on (x.shop_id,x.event_id)=(e.shop_id,e.id) where e.shop_id=${shopId}::uuid and e.order_id=${orderId}::uuid and e.scope_key=${key}::uuid and (e.operation='select' or e.current_id is distinct from e.previous_current_id) and (${beforeSelection ?? null}::integer is null or e.scope_version<${beforeSelection ?? null}::integer) order by e.scope_version desc limit 25`,
        )
      ).rows.map((r) => ({
        ...r,
        recordedAt: new Date(r.recordedAt as string).toISOString(),
      }));
      return designSpecificationStateSchema.parse({
        orderId,
        pieceId,
        ...(s ?? { version: 0, latestSavedId: null, currentId: null }),
        versions,
        selections,
      });
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from design_spec_event where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async governed(orderId) {
      const r = (
        await tx.execute(
          sql`select o.intake_kind,s.content from garment_order o join order_acceptance_snapshot s on (s.shop_id,s.order_id)=(o.shop_id,o.id) where o.shop_id=${shopId}::uuid and o.id=${orderId}::uuid`,
        )
      ).rows[0];
      if (r?.intake_kind !== "custom") return true;
      const content = r.content as Record<string, unknown>,
        snapshot = content.snapshot as Record<string, unknown> | undefined;
      // No agreement or irreversible-work writer exists in this release. Unknown imported
      // facts cannot be treated as permission. Revisit this seam with governed 1.4.3.
      return [content, snapshot ?? {}].some((c) =>
        [
          "approval",
          "agreement",
          "approvedVersion",
          "workStarted",
          "irreversible",
          "execution",
          "progress",
        ].some((k) => k in c),
      );
    },
    async write(v) {
      const scopeKey = v.pieceId ?? v.orderId,
        prior = await repo.state(v.orderId, v.pieceId);
      if (
        prior.version !== v.baseVersion ||
        prior.latestSavedId !== v.baseSavedId
      )
        throw Error("Design scope CAS stale");
      const ids = (
        await tx.execute<{ id: string; version: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as version,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Design identity unavailable");
      const savedId =
        v.operation === "save" ? ids.version : prior.latestSavedId;
      const currentId =
        v.operation === "select"
          ? v.selectedId
          : v.use
            ? savedId
            : prior.currentId;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,${`design.specification.${v.operation}`},'garment_order',${v.orderId}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ version: v.baseVersion + 1, specificationId: savedId, currentId, pieceId: v.pieceId })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into design_spec_event(shop_id,id,order_id,scope_key,scope_version,operation,saved_id,current_id,previous_saved_id,previous_current_id,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.orderId}::uuid,${scopeKey}::uuid,${v.baseVersion + 1},${v.operation},${savedId}::uuid,${currentId}::uuid,${prior.latestSavedId}::uuid,${prior.currentId}::uuid,${v.actorId}::uuid,${v.draftId}::uuid,${ids.audit}::uuid,${v.key}::uuid)`,
      );
      if (v.operation === "save") {
        const previous = prior.latestSavedId
          ? await repo.read(prior.latestSavedId)
          : undefined;
        await tx.execute(
          sql`insert into design_spec_version(shop_id,id,order_id,scope_key,version,previous_id,event_id,snapshot_digest,profile_entry_id,profile_id,frozen,digest,reuse,reuse_version_id) values(${shopId}::uuid,${savedId}::uuid,${v.orderId}::uuid,${scopeKey}::uuid,${(previous?.version ?? 0) + 1},${prior.latestSavedId}::uuid,${ids.id}::uuid,${v.snapshotDigest},${v.frozen.profile.entryId}::uuid,${v.frozen.profile.id}::uuid,${JSON.stringify(v.frozen)}::jsonb,${v.digest},${v.reuse ? JSON.stringify(v.reuse) : null}::jsonb,${v.reuse?.versionId ?? null}::uuid)`,
        );
        for (const [position, a] of v.answers.entries())
          await tx.execute(
            sql`insert into design_spec_answer(shop_id,version_id,profile_id,question_id,position,state,choice_entry_id,choice_id) values(${shopId}::uuid,${savedId}::uuid,${v.frozen.profile.id}::uuid,${a.questionId}::uuid,${position},${a.state},${a.choice?.entryId ?? null}::uuid,${a.choice?.revisionId ?? null}::uuid)`,
          );
      }
      await tx.execute(
        sql`insert into design_spec_value(shop_id,event_id,answers,reason) values(${shopId}::uuid,${ids.id}::uuid,${JSON.stringify(v.answers)}::jsonb,${v.reason})`,
      );
      const updated =
        v.baseVersion === 0
          ? await tx.execute(
              sql`insert into design_spec_scope(shop_id,order_id,scope_key,piece_id,kind,customer_id,wearer_id,version,latest_saved_id,current_id,event_id) values(${shopId}::uuid,${v.orderId}::uuid,${scopeKey}::uuid,${v.pieceId}::uuid,${v.pieceId ? "piece" : "order"},${v.customerId}::uuid,${v.wearerId}::uuid,1,${savedId}::uuid,${currentId}::uuid,${ids.id}::uuid) on conflict do nothing returning version`,
            )
          : await tx.execute(
              sql`update design_spec_scope set version=${v.baseVersion + 1},latest_saved_id=${savedId}::uuid,current_id=${currentId}::uuid,event_id=${ids.id}::uuid where shop_id=${shopId}::uuid and order_id=${v.orderId}::uuid and scope_key=${scopeKey}::uuid and version=${v.baseVersion} returning version`,
            );
      if (!updated.rowCount) throw Error("Design pointer CAS failed");
      return { id: ids.id, scopeVersion: v.baseVersion + 1 };
    },
  };
  return repo;
}
