import { syntheticJobSchema } from "@aarili/contracts/jobs";
import { sql, type Transaction } from "./index.js";
import type {
  JobRequest,
  SyntheticJobRepository,
} from "./repositories/jobs.js";
import { restoreRepository } from "./restore-repository.js";

export function syntheticJobRepository(
  tx: Transaction,
  shopId: string,
): SyntheticJobRepository {
  return {
    async request(id) {
      const result =
        await tx.execute<JobRequest>(sql`select id as "requestId", shop_id as "shopId", initiator_id as "initiatorId", entity_id as "entityId", version, restore_epoch as epoch, command_key as key, command_request_id as "commandRequestId"
        from synthetic_job_request where shop_id=${shopId}::uuid and id=${id}::uuid`);
      const row = result.rows[0];
      return (
        row && {
          ...syntheticJobSchema.parse({
            requestId: row.requestId,
            shopId: row.shopId,
            initiatorId: row.initiatorId,
            entityId: row.entityId,
            version: row.version,
          }),
          key: row.key,
          epoch: row.epoch,
          commandRequestId: row.commandRequestId,
        }
      );
    },
    restoreState: () => restoreRepository(tx, shopId).lockState(),
    async quarantined(id) {
      return !!(
        await tx.execute(
          sql`select 1 from synthetic_job_quarantine where shop_id=${shopId}::uuid and request_id=${id}::uuid`,
        )
      ).rowCount;
    },
    async quarantine(request, observedEpoch, reason) {
      await tx.execute(sql`insert into synthetic_job_quarantine(shop_id,request_id,request_epoch,observed_epoch,reason)
        values(${shopId}::uuid,${request.requestId}::uuid,${request.epoch}::uuid,${observedEpoch}::uuid,${reason}) on conflict do nothing`);
    },
    async lock(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:job:' || ${shopId}::text || ':' || ${id}::text, 0))`,
      );
    },
    async effected(id) {
      return !!(
        await tx.execute(
          sql`select 1 from synthetic_job_effect where shop_id=${shopId}::uuid and request_id=${id}::uuid`,
        )
      ).rowCount;
    },
    async effect(request, auditId) {
      await tx.execute(
        sql`insert into synthetic_job_effect(shop_id,request_id,audit_id) values(${shopId}::uuid,${request.requestId}::uuid,${auditId}::uuid)`,
      );
    },
  };
}
