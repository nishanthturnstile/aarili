import { sql, type Transaction } from "./index.js";
import type {
  ScheduleRepository,
  ScheduleRun,
} from "./repositories/schedules.js";
import { restoreRepository } from "./restore-repository.js";

export function scheduleRepository(
  tx: Transaction,
  shopId: string,
): ScheduleRepository {
  return {
    async lock(task) {
      await tx.execute(sql`select lock_job_schedule(${task})`);
    },
    async run(id) {
      return (
        await tx.execute<ScheduleRun>(sql`select id,shop_id as "shopId",task,authorizer_id as "authorizerId",grant_version as "grantVersion",business_date::text as "businessDate",restore_epoch as epoch
        from job_schedule_run where shop_id=${shopId}::uuid and id=${id}::uuid`)
      ).rows[0];
    },
    async enabled(run) {
      return !!(
        await tx.execute(sql`select 1 from job_schedule g join owner_bootstrap b on b.shop_id=g.shop_id and b.user_id=g.authorizer_id and b.completed_at is not null
        where g.shop_id=${shopId}::uuid and g.task=${run.task} and g.enabled and g.version=${run.grantVersion} and g.authorizer_id=${run.authorizerId}::uuid`)
      ).rowCount;
    },
    async epoch() {
      return (await restoreRepository(tx, shopId).lockState())?.epoch;
    },
    async quarantined(id) {
      return !!(
        await tx.execute(
          sql`select 1 from job_schedule_quarantine where shop_id=${shopId}::uuid and run_id=${id}::uuid`,
        )
      ).rowCount;
    },
    async quarantine(run, epoch) {
      await tx.execute(
        sql`insert into job_schedule_quarantine values(${shopId}::uuid,${run.id}::uuid,${epoch}::uuid) on conflict do nothing`,
      );
    },
    async effected(id) {
      return !!(
        await tx.execute(
          sql`select 1 from job_schedule_effect where shop_id=${shopId}::uuid and run_id=${id}::uuid`,
        )
      ).rowCount;
    },
    async apply(run) {
      const auditId = (
        await tx.execute<{ id: string }>(sql`select uuidv7() as id`)
      ).rows[0]?.id;
      if (!auditId) throw Error("SCHEDULE_IDS_UNAVAILABLE");
      await tx.execute(
        sql`insert into job_schedule_effect values(${shopId}::uuid,${run.id}::uuid,${auditId}::uuid)`,
      );
      const actor =
        run.task === "foundation.daily"
          ? "00000000-0037-4000-8000-000000000001"
          : "00000000-0037-4000-8000-000000000002";
      await tx.execute(sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes)
        values(${shopId}::uuid,${auditId}::uuid,'system',${actor}::uuid,'foundation.schedule.consume','job_schedule_run',${run.id}::uuid,${run.id}::uuid,${run.id}::uuid,
        jsonb_build_object('task',${run.task}::text,'businessDate',${run.businessDate}::text,'authorizerId',${run.authorizerId}::uuid,'grantVersion',${run.grantVersion}::integer))`);
    },
  };
}
