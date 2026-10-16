import { syntheticRecordSchema } from "@aarili/contracts/command";
import { sql, type Transaction } from "./index.js";
import type { CommandRepository } from "./repositories/command.js";
import { requestRepository } from "./request-repository.js";

// No global database handle. Synthetic methods require the dev/test fixture;
// infrastructure methods use the production audit/idempotency tables.
export function commandRepository(
  tx: Transaction,
  shopId: string,
): CommandRepository {
  shopId = shopId.toLowerCase();
  return {
    ...requestRepository(tx, shopId),
    async ids() {
      const result = await tx.execute<{ id: string; eventId: string }>(
        sql`select uuidv7() as id, uuidv7() as "eventId"`,
      );
      const ids = result.rows[0];
      if (!ids) throw new Error("Command identifiers unavailable");
      return ids;
    },
    async read(id, lock = false) {
      const result =
        await tx.execute(sql`select id,version,value,finalized,correction_of as "correctionOf",event_id as "eventId"
        from synthetic_record where shop_id=${shopId}::uuid and id=${id}::uuid ${lock ? sql`for update` : sql``}`);
      return result.rows[0] && syntheticRecordSchema.parse(result.rows[0]);
    },
    async insert(r) {
      await tx.execute(sql`insert into synthetic_record(shop_id,id,version,value,finalized,correction_of,event_id)
        values(${shopId}::uuid,${r.id}::uuid,${r.version},${r.value},${r.finalized},${r.correctionOf}::uuid,${r.eventId}::uuid)`);
    },
    async update(r, expected) {
      const result =
        await tx.execute(sql`update synthetic_record set version=${r.version},value=${r.value},finalized=${r.finalized},event_id=${r.eventId}::uuid
        where shop_id=${shopId}::uuid and id=${r.id}::uuid and version=${expected} returning id`);
      return !!result.rowCount;
    },
    async correctionExists(id) {
      return !!(
        await tx.execute(
          sql`select 1 from synthetic_record where shop_id=${shopId}::uuid and correction_of=${id}::uuid`,
        )
      ).rowCount;
    },
    async audit(e) {
      await tx.execute(sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes,source_event_id)
        values(${shopId}::uuid,${e.id}::uuid,${e.actor.type},${e.actor.id}::uuid,${e.action},'synthetic_record',${e.entityId}::uuid,${e.requestId}::uuid,${e.key}::uuid,${e.reason},${JSON.stringify(e.changes)}::jsonb,${e.sourceEventId}::uuid)`);
    },
  };
}
