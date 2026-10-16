import {
  type DraftRecord,
  type DraftSuccess,
  draftRecordSchema,
} from "@aarili/contracts/drafts";
import { sql, type Transaction } from "./index.js";
import type { DraftRepository } from "./repositories/drafts.js";
import { requestRepository } from "./request-repository.js";

function record(row: Record<string, unknown>) {
  return draftRecordSchema.parse({
    ...row,
    createdAt: new Date(row.createdAt as string).toISOString(),
    updatedAt: new Date(row.updatedAt as string).toISOString(),
  });
}
const columns = sql`id,workflow,schema_version as "schemaVersion",creator_id as "creatorId",lifecycle,version,payload,created_at as "createdAt",updated_at as "updatedAt",updated_at<=statement_timestamp()-interval '30 days' as stale,
 CASE WHEN result_id IS NULL THEN NULL ELSE jsonb_build_object('type',result_type,'id',result_id) END as result`;
export function draftRepository(
  tx: Transaction,
  shopId: string,
): DraftRepository {
  shopId = shopId.toLowerCase();
  return {
    ...requestRepository<DraftSuccess>(tx, shopId),
    async now() {
      const r = await tx.execute<{ now: Date }>(
        sql`select date_trunc('milliseconds',statement_timestamp()) as now`,
      );
      return new Date(r.rows[0]?.now ?? NaN);
    },
    async actionId() {
      const r = await tx.execute<{ id: string }>(sql`select uuidv7() as id`);
      if (!r.rows[0]) throw Error("Draft identifier unavailable");
      return r.rows[0].id;
    },
    async lockDraft(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:draft:' || ${shopId}::text || ':' || ${id}::text,0))`,
      );
    },
    async read(id) {
      const r = await tx.execute(
        sql`select ${columns} from durable_draft where shop_id=${shopId}::uuid and id=${id}::uuid`,
      );
      return r.rows[0] ? record(r.rows[0]) : undefined;
    },
    async list(limit, cursor) {
      const time = await tx.execute<{ now: Date }>(
        sql`select date_trunc('milliseconds',statement_timestamp()) as now`,
      );
      const before =
        cursor?.before ??
        (time.rows[0] ? new Date(time.rows[0].now).toISOString() : undefined);
      if (!before) throw Error("Draft clock unavailable");
      const r =
        await tx.execute(sql`select ${columns} from durable_draft where shop_id=${shopId}::uuid and lifecycle='active' and created_at<=${before}::timestamptz
    ${cursor ? sql`and (created_at,id)>(${cursor.createdAt}::timestamptz,${cursor.id}::uuid)` : sql``} order by created_at,id limit ${limit}`);
      return { rows: r.rows.map(record), before };
    },
    async insert(r) {
      await tx.execute(sql`insert into durable_draft(shop_id,id,workflow,schema_version,creator_id,lifecycle,version,payload)
   values(${shopId}::uuid,${r.id}::uuid,${r.workflow},${r.schemaVersion},${r.creatorId}::uuid,${r.lifecycle},${r.version},${JSON.stringify(r.payload)}::jsonb)`);
    },
    async update(r: DraftRecord, expected) {
      const result =
        await tx.execute(sql`update durable_draft set lifecycle=${r.lifecycle},version=${r.version},payload=${JSON.stringify(r.payload)}::jsonb,result_type=${r.result?.type ?? null},result_id=${r.result?.id ?? null}::uuid
   where shop_id=${shopId}::uuid and id=${r.id}::uuid and version=${expected} returning id`);
      return !!result.rowCount;
    },
    async audit(e) {
      await tx.execute(sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes)
   values(${shopId}::uuid,${e.id}::uuid,${e.actor.type},${e.actor.id}::uuid,${e.action},'durable_draft',${e.draftId}::uuid,${e.requestId}::uuid,${e.key}::uuid,${JSON.stringify({ version: e.version, lifecycle: e.lifecycle, schemaVersion: e.schemaVersion })}::jsonb)`);
    },
  };
}
