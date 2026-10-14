import {
  syntheticRecordSchema,
  syntheticSuccessSchema,
} from "@aarili/contracts/command";
import { sql, type Transaction } from "./index.js";
import type {
  CommandRepository,
  StoredResponse,
} from "./repositories/command.js";

// No global database handle. Synthetic methods require the dev/test fixture;
// infrastructure methods use the production audit/idempotency tables.
export function commandRepository(
  tx: Transaction,
  shopId: string,
): CommandRepository {
  shopId = shopId.toLowerCase();
  return {
    async lockKey(key) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:command:' || ${shopId}::text || ':' || ${key}::text,0))`,
      );
    },
    async replay(key) {
      const result = await tx.execute<{
        actor_type: "user";
        actor_id: string;
        action: string;
        request_hash: string;
        response: unknown;
        status: 200;
      }>(
        sql`select actor_type,actor_id,action,request_hash,response,status from idempotency_key where shop_id=${shopId}::uuid and key=${key}::uuid`,
      );
      const row = result.rows[0];
      return (
        row &&
        ({
          actor: { type: row.actor_type, id: row.actor_id },
          action: row.action,
          hash: row.request_hash,
          response: syntheticSuccessSchema.parse(row.response),
          status: row.status,
        } satisfies StoredResponse)
      );
    },
    async persist(key, binding, response) {
      await tx.execute(sql`insert into idempotency_key(shop_id,key,actor_type,actor_id,action,request_hash,status,response)
        values(${shopId}::uuid,${key}::uuid,${binding.actor.type},${binding.actor.id}::uuid,${binding.action},${binding.hash},200,${JSON.stringify(response)}::jsonb)`);
    },
    async expiredKeys(cutoff) {
      const result = await tx.execute<{ key: string }>(
        sql`select key from idempotency_key where shop_id=${shopId}::uuid and created_at<=${cutoff} order by created_at,key`,
      );
      return result.rows.map((row) => row.key);
    },
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
