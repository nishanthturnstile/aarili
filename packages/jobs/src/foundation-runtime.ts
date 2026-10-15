import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { syntheticJobSchema } from "@aarili/contracts/jobs";
import { inspectSyntheticJob } from "@aarili/core/jobs";
import { consumeSchedule, inspectSchedule } from "@aarili/core/schedules";
import {
  type Database,
  requireRuntimeRole,
  ShopAccessError,
  sql,
  withShop,
} from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { syntheticJobRepository } from "@aarili/db/jobs-repository";
import { restoreRepository } from "@aarili/db/restore-repository";
import { scheduleRepository } from "@aarili/db/schedule-repository";
import { fromDrizzle, type PgBoss } from "pg-boss";
import { handleSyntheticJob, syntheticQueue } from "./index.js";

export const scheduleQueue = "foundation.schedule";
export const deadQueue = "foundation.dead";
type Locator = { shopId: string; runId: string; version: 1 };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function locator(input: unknown): Locator | undefined {
  if (!input || typeof input !== "object") return;
  const p = input as Partial<Locator>;
  if (
    Object.keys(p).sort().join(",") !== "runId,shopId,version" ||
    typeof p.shopId !== "string" ||
    typeof p.runId !== "string" ||
    !uuid.test(p.shopId) ||
    !uuid.test(p.runId) ||
    p.version !== 1
  )
    return;
  return p as Locator;
}

export async function handleScheduledJob(
  db: Database,
  input: unknown,
  beforeCommit: () => Promise<void> = async () => {},
) {
  const p = locator(input);
  if (!p) return "ignored" as const;
  const located = (
    await db.execute<{ authorizer_id: string; restore_epoch: string }>(
      sql`select * from locate_job_run(${p.shopId}::uuid,${p.runId}::uuid)`,
    )
  ).rows[0];
  const user = located?.authorizer_id;
  if (!user) return "ignored" as const;
  try {
    return await withShop(db, user, p.shopId, async (tx) => {
      const repo = scheduleRepository(tx, p.shopId);
      const inspected = await inspectSchedule(repo, p.runId);
      if (typeof inspected === "string") return inspected;
      if (!(await authorizeJobPrincipal(tx, user, p.shopId)))
        return "ignored" as const;
      const result = await consumeSchedule(repo, p.runId);
      await beforeCommit();
      return result;
    });
  } catch (error) {
    if (!(error instanceof ShopAccessError)) throw error;
    // Removed membership never admits a system transaction. Only deny based
    // on queue epoch metadata via the immutable run (no tenant writes).
    return db.transaction(async (tx) => {
      const state = await restoreRepository(tx).lockState();
      if (!state) throw Error("CONTROL_UNKNOWN");
      return located?.restore_epoch !== state.epoch
        ? ("quarantined" as const)
        : ("ignored" as const);
    });
  }
}

// Trusted SQL cursor -> immutable run -> queue insert is one transaction.
// No schedule table DDL, pg-boss cron ownership, or unrestricted shop queries.
export async function enqueueDueSchedules(db: Database, boss: PgBoss) {
  const due = await db.execute<{
    shop_id: string;
    authorizer_id: string;
    task: string;
  }>(sql`select * from due_job_schedules()`);
  let count = 0;
  for (const grant of due.rows) {
    try {
      count += await withShop(
        db,
        grant.authorizer_id,
        grant.shop_id,
        async (tx) => {
          await restoreRepository(tx, grant.shop_id).lockState();
          if (
            !(await authorizeJobPrincipal(
              tx,
              grant.authorizer_id,
              grant.shop_id,
            ))
          )
            return 0;
          const occurrence = (
            await tx.execute<{ id: string; business_date: string }>(
              sql`select id,business_date::text from claim_job_occurrence(${grant.task})`,
            )
          ).rows[0];
          if (!occurrence) return 0;
          const id = await boss.send(
            scheduleQueue,
            { shopId: grant.shop_id, runId: occurrence.id, version: 1 },
            {
              id: occurrence.id,
              singletonKey: `${grant.shop_id}:${grant.task}:${occurrence.business_date}`,
              singletonSeconds: 60,
              db: fromDrizzle(tx, sql),
            },
          );
          if (id !== occurrence.id) throw Error("SCHEDULE_ENQUEUE_REJECTED");
          return 1;
        },
      );
    } catch (error) {
      if (!(error instanceof ShopAccessError)) throw error;
    }
  }
  return count;
}

export async function inspectJobStatus(db: Database) {
  await requireRuntimeRole(db);
  // Aggregate IDs/state only. Never return payload/output/error strings.
  const result = await db.execute(sql`select name,state,count(*)::int as count,
    coalesce(max(retry_count),0)::int as "maxRetryCount",
    case when state in ('created','retry') then greatest(0,extract(epoch from clock_timestamp()-min(created_on)))::integer else null end as "oldestWaitingSeconds",
    count(*) filter(where output->>'error'='RESTORE_QUARANTINED' or source_output->>'error'='RESTORE_QUARANTINED')::int as quarantined
    from pgboss.job where name in (${syntheticQueue},${scheduleQueue},${deadQueue}) group by name,state order by name,state`);
  return {
    queues: result.rows,
    realProviders: "disabled" as const,
    actions: {
      retry: "Inspect runtime/database availability; wait for bounded backoff",
      dead: "Inspect authoritative state, then request scoped redrive",
      quarantine:
        "Preserve original epoch; reconcile through the restore runbook",
    },
  };
}

// Explicit, scoped operator exercise using current owner authority. Redrive
// requeues the original locator; it never mutates history, epoch or grants.
export async function redriveSyntheticJob(
  db: Database,
  boss: PgBoss,
  userId: string,
  shopId: string,
  deadId: string,
) {
  if (!uuid.test(deadId)) throw Error("REDRIVE_DENIED");
  return withShop(db, userId, shopId, async (tx) => {
    await restoreRepository(tx, shopId).lockState();
    if (!(await authorizeJobPrincipal(tx, userId, shopId)))
      throw Error("REDRIVE_DENIED");
    const job = (
      await tx.execute<{ data: unknown; source_name: string }>(
        sql`select data,source_name from pgboss.job where name=${deadQueue} and id=${deadId}::uuid and state='created' for update`,
      )
    ).rows[0];
    if (!job) return "denied";
    let requestId: string;
    if (job.source_name === syntheticQueue) {
      const p = syntheticJobSchema.safeParse(job.data);
      if (
        !p.success ||
        p.data.shopId !== shopId ||
        p.data.initiatorId !== userId
      )
        return "denied";
      const inspected = await inspectSyntheticJob(
        { shopId, userId, jobs: syntheticJobRepository(tx, shopId) },
        p.data,
      );
      if (typeof inspected === "string") return inspected;
      const record = await commandRepository(tx, shopId).read(
        inspected.entityId,
        true,
      );
      if (
        !record ||
        record.version !== inspected.version ||
        record.eventId !== inspected.requestId
      )
        return "ignored";
      requestId = inspected.requestId;
    } else if (job.source_name === scheduleQueue) {
      const p = locator(job.data);
      if (!p || p.shopId !== shopId) return "denied";
      const run = await inspectSchedule(
        scheduleRepository(tx, shopId),
        p.runId,
      );
      if (typeof run === "string") return run;
      if (run.authorizerId !== userId) return "denied";
      requestId = run.id;
    } else return "denied";
    const moved = await boss.redrive(deadQueue, {
      ids: [deadId],
      sourceName: job.source_name,
      limit: 1,
      db: fromDrizzle(tx, sql),
    });
    if (moved !== 1) throw Error("REDRIVE_REJECTED");
    await tx.execute(sql`insert into audit_event(shop_id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes)
      values(${shopId}::uuid,'user',${userId}::uuid,'foundation.job.redrive','job_request',${requestId}::uuid,${requestId}::uuid,${deadId}::uuid,'{"redriven":true}'::jsonb)`);
    return "redriven";
  });
}

import {
  type RuntimeComposition,
  startInprocessJobs as startInprocess,
  startJobRuntime as startRuntime,
} from "./runtime.js";

export { wireJobShutdown } from "./runtime.js";

// Explicit fixture/operator composition; normal application entry points never import it.
const foundationComposition: RuntimeComposition = {
  handlers: new Map([
    [syntheticQueue, handleSyntheticJob],
    [scheduleQueue, handleScheduledJob],
  ]),
  enqueue: enqueueDueSchedules,
  status: inspectJobStatus,
};
export function startJobRuntime(
  connectionString: string,
  options: Parameters<typeof startRuntime>[1],
) {
  return startRuntime(connectionString, options, foundationComposition);
}
export function startInprocessJobs(env: Record<string, string | undefined>) {
  return startInprocess(env, foundationComposition);
}
