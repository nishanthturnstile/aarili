import { sql, type Transaction } from "./index.js";
import type {
  RequestRepository,
  StoredResponse,
} from "./repositories/request.js";
export function requestRepository<T>(
  tx: Transaction,
  shopId: string,
): RequestRepository<T> {
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
          response: row.response,
          status: row.status,
        } satisfies StoredResponse<unknown>)
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
  };
}
