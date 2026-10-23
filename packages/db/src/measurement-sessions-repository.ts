import {
  measurementSessionDraftSchema,
  measurementUseSchema,
  measurementVersionSchema,
} from "@aarili/contracts/measurement-sessions";
import { sql, type Transaction } from "./index.js";
import type { MeasurementSessionsRepository } from "./repositories/measurement-sessions.js";

export function measurementSessionsRepository(
  tx: Transaction,
  shopId: string,
): MeasurementSessionsRepository {
  shopId = shopId.toLowerCase();
  let compatible = false;
  async function reader() {
    if (!compatible) {
      await tx.execute(
        sql`select set_config('app.measurement_history_reader','1.3.2b',true)`,
      );
      compatible = true;
    }
  }
  const useFields = sql`id,payload,actor_id as "actorId",recorded_at as "recordedAt",origin_draft_id as "originDraftId"`;
  const useRow = (r: Record<string, unknown>) =>
    measurementUseSchema.parse({
      ...(r.payload as object),
      id: r.id,
      actorId: r.actorId,
      recordedAt: new Date(r.recordedAt as string).toISOString(),
      originDraftId: r.originDraftId,
      authority: "synthetic-review",
    });
  const repo: MeasurementSessionsRepository = {
    async identity(id) {
      return (
        await tx.execute<{ customerId: string; wearerId: string }>(
          sql`select customer_id as "customerId",wearer_id as "wearerId" from measurement_event where shop_id=${shopId}::uuid and id=${id}::uuid and operation='save'`,
        )
      ).rows[0];
    },
    async latestApproval(formId) {
      const r = (
        await tx.execute(
          sql`select ${useFields} from measurement_use_event e where e.shop_id=${shopId}::uuid and e.form_id=${formId}::uuid and not exists(select 1 from measurement_use_event successor where successor.shop_id=e.shop_id and successor.form_id=e.form_id and successor.previous_id=e.id)`,
        )
      ).rows[0];
      return r ? useRow(r) : undefined;
    },
    async writeApproval(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Measurement identity unavailable");
      const { actorId, draftId, key, requestId, ...payload } = v;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${actorId}::uuid,'measurement.use','measurement-use',${ids.id}::uuid,${requestId}::uuid,${key}::uuid,'{}')`,
      );
      await tx.execute(
        sql`insert into measurement_use_event(shop_id,id,form_entry_id,form_id,previous_id,payload,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.form.entryId}::uuid,${v.form.revisionId}::uuid,${v.baseId}::uuid,${JSON.stringify(payload)}::jsonb,${actorId}::uuid,${draftId}::uuid,${ids.audit}::uuid,${key}::uuid)`,
      );
      return ids.id;
    },
    async read(id) {
      await reader();
      const r = (
        await tx.execute(
          sql`select e.id,e.customer_id as "customerId",e.wearer_id as "wearerId",e.actor_id as "actorId",e.origin_draft_id as "originDraftId",e.recorded_at as "recordedAt",v.frozen as form,v.approval_id as "approvalId",v.session_id as "sessionId",v.previous_id as "previousId",v.version,(select head.id from measurement_version head where head.shop_id=v.shop_id and head.session_id=v.session_id order by head.version desc limit 1) as "headId",p.source,p.fit_notes as "fitNotes",p.reason,(p.redacted_at is not null) as redacted from measurement_event e join measurement_version v on (v.shop_id,v.id)=(e.shop_id,e.id) join measurement_private p on (p.shop_id,p.event_id)=(e.shop_id,e.id) where e.shop_id=${shopId}::uuid and e.id=${id}::uuid`,
        )
      ).rows[0];
      if (!r) return undefined;
      const a = (
        await tx.execute(
          sql`select ${useFields} from measurement_use_event where shop_id=${shopId}::uuid and id=${String(r.approvalId)}::uuid`,
        )
      ).rows[0];
      if (!a) throw Error("Measurement approval unavailable");
      const values = (
        await tx.execute(
          sql`select field_id as "fieldId",raw_text as "rawText",unit,source,warning_reason as "warningReason",numeric_value::text as numeric,case when numerator is null then null else jsonb_build_object('numerator',numerator::text,'denominator',denominator::text) end as exact from measurement_value where shop_id=${shopId}::uuid and version_id=${id}::uuid order by position`,
        )
      ).rows;
      return measurementVersionSchema.parse({
        id: r.id,
        customerId: r.customerId,
        wearerId: r.wearerId,
        actorId: r.actorId,
        originDraftId: r.originDraftId,
        recordedAt: new Date(r.recordedAt as string).toISOString(),
        version: r.version,
        sessionId: r.sessionId,
        previousId: r.previousId,
        headId: r.headId,
        form: r.form,
        approval: useRow(a),
        source: r.source ?? {
          kind: "unknown",
          date: "",
          measurer: "",
          method: "",
        },
        fitNotes: r.fitNotes ?? "",
        reason: r.reason ?? "",
        redacted: r.redacted,
        values: r.redacted ? [] : values,
      });
    },
    async list(customerId, wearerId, before) {
      const rows = (
        await tx.execute<{ id: string }>(
          sql`select id from measurement_event where shop_id=${shopId}::uuid and customer_id=${customerId}::uuid and wearer_id=${wearerId}::uuid and operation='save' and (${before ?? null}::uuid is null or id<${before ?? null}::uuid) order by id desc limit 26`,
        )
      ).rows;
      const versions = [];
      for (const row of rows) {
        const v = await repo.read(row.id);
        if (v) versions.push(v);
      }
      return versions;
    },
    async selection(orderId, pieceId, beforeVersion) {
      await reader();
      const head = (
        await tx.execute<{ version: number; selectedId: string }>(
          sql`select version,selected_id as "selectedId" from measurement_selection where shop_id=${shopId}::uuid and order_id=${orderId}::uuid and scope_key=${pieceId ?? orderId}::uuid order by version desc limit 1`,
        )
      ).rows[0];
      const rows = (
        await tx.execute<{
          id: string;
          selectedId: string;
          version: number;
          actorId: string;
          recordedAt: string;
          reason: string | null;
        }>(
          sql`select s.event_id as id,s.selected_id as "selectedId",s.version,e.actor_id as "actorId",e.recorded_at as "recordedAt",p.reason from measurement_selection s join measurement_event e on (e.shop_id,e.id)=(s.shop_id,s.event_id) join measurement_private p on (p.shop_id,p.event_id)=(e.shop_id,e.id) where s.shop_id=${shopId}::uuid and s.order_id=${orderId}::uuid and s.scope_key=${pieceId ?? orderId}::uuid and (${beforeVersion ?? null}::integer is null or s.version<${beforeVersion ?? null}::integer) order by s.version desc limit 26`,
        )
      ).rows;
      return {
        version: head?.version ?? 0,
        selectedId: head?.selectedId ?? null,
        nextHistory: rows.length > 25 ? (rows[24]?.version ?? null) : null,
        history: rows.slice(0, 25).map((r) => ({
          ...r,
          recordedAt: new Date(r.recordedAt).toISOString(),
        })),
      };
    },
    async lockSession(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`measurementSession:${shopId}:${id}`},0))`,
      );
    },
    async usages(id) {
      await reader();
      return (
        await tx.execute<{
          orderId: string;
          pieceId: string | null;
          code: string;
          customerId: string;
          wearerId: string;
        }>(
          sql`select distinct s.order_id as "orderId",s.piece_id as "pieceId",o.code,o.customer_id as "customerId",o.wearer_id as "wearerId" from measurement_selection s join garment_order o on (o.shop_id,o.id)=(s.shop_id,s.order_id) where s.shop_id=${shopId}::uuid and s.selected_id=${id}::uuid order by s.order_id,s.piece_id`,
        )
      ).rows;
    },
    async used(ids) {
      await reader();
      return (
        await tx.execute<{ id: string }>(
          sql`select distinct selected_id as id from measurement_selection where shop_id=${shopId}::uuid and selected_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid[])`,
        )
      ).rows.map((r) => r.id);
    },
    async write(v, saved) {
      await reader();
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Measurement identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,${`measurement.${v.operation}`},'measurement',${ids.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ operation: v.operation })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into measurement_event(shop_id,id,operation,customer_id,wearer_id,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.operation},${v.customerId}::uuid,${v.wearerId}::uuid,${v.actorId}::uuid,${v.draftId}::uuid,${ids.audit}::uuid,${v.key}::uuid)`,
      );
      await tx.execute(
        sql`insert into measurement_private(shop_id,event_id,source,fit_notes,reason) values(${shopId}::uuid,${ids.id}::uuid,${JSON.stringify(v.source)}::jsonb,${v.fitNotes},${v.reason})`,
      );
      if (saved) {
        const prior = v.correctionId
          ? await repo.read(v.correctionId)
          : undefined;
        await tx.execute(
          sql`insert into measurement_version(shop_id,id,form_entry_id,form_id,approval_id,frozen,session_id,previous_id,version) values(${shopId}::uuid,${ids.id}::uuid,${saved.form.entryId}::uuid,${saved.form.id}::uuid,${saved.approval.id}::uuid,${JSON.stringify(saved.form)}::jsonb,${prior?.sessionId ?? ids.id}::uuid,${prior?.id ?? null}::uuid,${prior ? prior.version + 1 : 1})`,
        );
        for (const [position, a] of saved.values.entries())
          await tx.execute(
            sql`insert into measurement_value(shop_id,version_id,field_id,position,raw_text,unit,numeric_value,numerator,denominator,source,warning_reason) values(${shopId}::uuid,${ids.id}::uuid,${a.fieldId}::uuid,${position},${a.rawText},${a.unit},${a.numeric}::numeric,${a.exact?.numerator ?? null}::numeric,${a.exact?.denominator ?? null}::numeric,${a.source ? JSON.stringify(a.source) : null}::jsonb,${a.warningReason})`,
          );
      } else {
        if (!v.target || !v.selectedId) throw Error("Selection unavailable");
        await tx.execute(
          sql`insert into measurement_selection(shop_id,event_id,order_id,scope_key,piece_id,selected_id,version) values(${shopId}::uuid,${ids.id}::uuid,${v.target.orderId}::uuid,${v.target.pieceId ?? v.target.orderId}::uuid,${v.target.pieceId}::uuid,${v.selectedId}::uuid,${v.baseVersion + 1})`,
        );
      }
      return ids.id;
    },
    async origin(id, draftId, kind) {
      const relation =
        kind === "use" ? sql`measurement_use_event` : sql`measurement_event`;
      return !!(
        await tx.execute(
          sql`select id from ${relation} where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async replayPayload(draftId, version) {
      const r = (
        await tx.execute(
          sql`select payload from measurement_draft_value where shop_id=${shopId}::uuid and draft_id=${draftId}::uuid and version=${version}`,
        )
      ).rows[0];
      if (!r) throw Error("Private measurement response unavailable");
      return r.payload as Record<string, unknown>;
    },
    async retainPrivateResponse(record, auditId, key) {
      const p = measurementSessionDraftSchema.parse(record.payload);
      await tx.execute(
        sql`insert into measurement_draft_value(shop_id,draft_id,version,customer_id,wearer_id,order_id,piece_id,payload,audit_id,command_key) values(${shopId}::uuid,${record.id}::uuid,${record.version},${p.customerId}::uuid,${p.wearerId}::uuid,${p.target?.orderId ?? null}::uuid,${p.target?.pieceId ?? null}::uuid,${JSON.stringify(p)}::jsonb,${auditId}::uuid,${key}::uuid)`,
      );
    },
    async erased(wearerId) {
      return !!(
        await tx.execute(
          sql`select wearer_id from measurement_erasure where shop_id=${shopId}::uuid and wearer_id=${wearerId}::uuid`,
        )
      ).rowCount;
    },
  };
  return repo;
}
