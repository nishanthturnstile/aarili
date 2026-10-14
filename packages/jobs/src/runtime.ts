import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { syntheticJobSchema } from "@aarili/contracts/jobs";
import { inspectSyntheticJob } from "@aarili/core/jobs";
import { consumeSchedule, inspectSchedule } from "@aarili/core/schedules";
import {
  createDatabase,
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
import {
  handleSyntheticJob,
  startSyntheticQueue,
  syntheticQueue,
} from "./index.js";

export const scheduleQueue = "foundation.schedule";
export const deadQueue = "foundation.dead";
type Mode = "inprocess" | "worker";
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

export function jobRuntimeConfiguration(
  env: Record<string, string | undefined>,
  mode: Mode,
) {
  const flag = env.RUN_JOBS_INPROCESS ?? "false";
  if (
    !["true", "false"].includes(flag) ||
    (env.NODE_ENV === "production" && flag === "true") ||
    (env.OUTBOUND_EFFECTS && env.OUTBOUND_EFFECTS !== "disabled")
  )
    throw Error("Job runtime configuration denied");
  if (
    mode === "inprocess" &&
    (env.NODE_ENV !== "development" || flag !== "true")
  )
    return undefined;
  if (
    !env.DATABASE_URL ||
    Object.keys(env).some((k) => k.startsWith("NEXT_PUBLIC_"))
  )
    throw Error("Job runtime configuration denied");
  return env.DATABASE_URL;
}

type Hooks = {
  beforeCommit?: () => Promise<void>;
  afterCommit?: () => Promise<void>;
};
export async function startJobRuntime(
  connectionString: string,
  {
    mode,
    pollMilliseconds = 1000,
    hooks = {},
  }: { mode: Mode; pollMilliseconds?: number; hooks?: Hooks },
) {
  const database = createDatabase(connectionString);
  let boss: PgBoss;
  try {
    boss = await startSyntheticQueue(database.db, scheduleQueue);
    const state = await database.db.transaction((tx) =>
      restoreRepository(tx).lockState(),
    );
    if (!state) throw Error("CONTROL_UNKNOWN");
  } catch (error) {
    await database.pool.end();
    throw error;
  }
  const registry = new Map([
    [syntheticQueue, handleSyntheticJob],
    [scheduleQueue, handleScheduledJob],
  ]);
  const available = (await boss.getQueues([...registry.keys()])).map(
    (q) => q.name,
  );
  let stopping = false,
    aborted = false,
    closed = false;
  let stopPromise: Promise<"stopped" | "timed-out"> | undefined;
  const veto = async () => {
    await hooks.beforeCommit?.();
    if (aborted) throw Error("RUNNER_STOPPED");
  };
  async function cycle() {
    if (stopping) return;
    await enqueueDueSchedules(database.db, boss);
    for (const name of available) {
      if (stopping) return;
      // Attempt-fenced expiry uses pg-boss's own retry/dead-letter operation.
      // No scheduler/supervisor DDL or statistics ownership is needed.
      const expired = await database.db.execute<{
        id: string;
        retryCount: number;
      }>(
        sql`select id,retry_count as "retryCount" from pgboss.job where name=${name} and state='active' and started_on+expire_seconds*interval '1 second'<clock_timestamp() limit 100`,
      );
      for (const job of expired.rows)
        await boss.fail(name, job, { error: "RUNNER_EXPIRED" });
      const [job] = await boss.fetch(name, { includeMetadata: true });
      if (!job) continue;
      try {
        const handler = registry.get(name);
        if (!handler) throw Error("HANDLER_MISSING");
        const outcome = await handler(database.db, job.data, veto);
        await hooks.afterCommit?.();
        if (aborted) return; // active lease expires; successor retries safely
        if (outcome === "ignored" || outcome === "quarantined")
          await boss.fail(name, job, {
            error:
              outcome === "quarantined"
                ? "RESTORE_QUARANTINED"
                : "JOB_AUTHORITY_OR_STATE_DENIED",
          });
        else await boss.complete(name, job, { outcome });
      } catch {
        if (!aborted)
          await boss.fail(name, job, { error: "HANDLER_RETRYABLE_FAILURE" });
      }
    }
  }
  let active: Promise<void> | undefined;
  const tick = () => {
    if (stopping || active) return;
    active = cycle()
      .catch(() =>
        console.error("Job runtime unavailable; inspect database readiness"),
      )
      .finally(() => {
        active = undefined;
      });
  };
  // Readiness requires the real queue/schema/runtime role before intake starts.
  const timer = setInterval(tick, pollMilliseconds);
  tick();
  async function drain(timeoutMilliseconds = 10000) {
    if (closed) return "stopped" as const;
    stopping = true;
    clearInterval(timer);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const drained = await Promise.race([
      Promise.resolve(active).then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), timeoutMilliseconds);
      }),
    ]);
    if (timeout) clearTimeout(timeout);
    aborted = !drained;
    await boss.stop({ graceful: false });
    const close = database.pool.end();
    if (drained) await close;
    else void close.catch(() => {}); // in-process transaction vetoes on resumption
    closed = true;
    return drained ? ("stopped" as const) : ("timed-out" as const);
  }
  function stop(timeoutMilliseconds = 10000) {
    stopPromise ??= drain(timeoutMilliseconds);
    return stopPromise;
  }
  return {
    mode,
    handlers: [...registry.keys()],
    status: () => inspectJobStatus(database.db),
    stop,
  };
}

type JobRuntime = Awaited<ReturnType<typeof startJobRuntime>>;
const inprocessKey = Symbol.for("aarili.job-runtime.inprocess");
export async function startInprocessJobs(
  env: Record<string, string | undefined>,
) {
  const connectionString = jobRuntimeConfiguration(env, "inprocess");
  if (!connectionString) return;
  const host = globalThis as typeof globalThis & {
    [inprocessKey]?: Promise<JobRuntime>;
  };
  // Store the promise before awaiting initialization; duplicate register calls
  // and development module reloads reuse it, including simultaneous calls.
  if (!host[inprocessKey])
    host[inprocessKey] = startJobRuntime(connectionString, {
      mode: "inprocess",
    })
      .then((runtime) => {
        const stop = runtime.stop;
        runtime.stop = async (timeout) => {
          try {
            return await stop(timeout);
          } finally {
            delete host[inprocessKey];
          }
        };
        return runtime;
      })
      .catch((error) => {
        delete host[inprocessKey];
        throw error;
      });
  return host[inprocessKey];
}

const shutdownKey = Symbol.for("aarili.job-runtime.shutdown");
const shutdownHost = globalThis as typeof globalThis & {
  [shutdownKey]?: WeakSet<JobRuntime>;
};
shutdownHost[shutdownKey] ??= new WeakSet<JobRuntime>();
const shutdownWired = shutdownHost[shutdownKey];
export function wireJobShutdown(
  runtime: JobRuntime,
  finished: (outcome: "stopped" | "timed-out") => void,
  timeoutMilliseconds = 10000,
) {
  if (shutdownWired.has(runtime)) return;
  shutdownWired.add(runtime);
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    process.off("message", onMessage);
    void runtime
      .stop(timeoutMilliseconds)
      .then(finished)
      .catch(() => finished("timed-out"));
  };
  const onMessage = (message: unknown) => {
    if (message === "shutdown") shutdown();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("message", onMessage);
}
