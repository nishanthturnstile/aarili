import { createDatabase, type Database, sql } from "@aarili/db";
import { restoreRepository } from "@aarili/db/restore-repository";
import type { PgBoss } from "pg-boss";
import { startQueue } from "./queue.js";

type Mode = "inprocess" | "worker";
export type RuntimeComposition = {
  handlers: ReadonlyMap<
    string,
    (
      db: Database,
      input: unknown,
      beforeCommit: () => Promise<void>,
    ) => Promise<string>
  >;
  enqueue: (db: Database, boss: PgBoss) => Promise<unknown>;
  status: (db: Database) => Promise<unknown>;
};
const emptyComposition: RuntimeComposition = {
  handlers: new Map(),
  enqueue: async () => {},
  status: async () => ({ queues: [], realProviders: "disabled" }),
};

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
    reportFailure,
  }: {
    mode: Mode;
    pollMilliseconds?: number;
    hooks?: Hooks;
    reportFailure?: () => void;
  },
  composition: RuntimeComposition = emptyComposition,
) {
  const report = () => {
    try {
      reportFailure?.();
    } catch {
      /* Diagnostics do not decide job outcomes. */
    }
  };
  const database = createDatabase(connectionString);
  let boss: PgBoss;
  try {
    boss = await startQueue(database.db, [...composition.handlers.keys()]);
    const state = await database.db.transaction((tx) =>
      restoreRepository(tx).lockState(),
    );
    if (!state) throw Error("CONTROL_UNKNOWN");
  } catch (error) {
    await database.pool.end();
    throw error;
  }
  const registry = composition.handlers;
  const available = registry.size
    ? (await boss.getQueues([...registry.keys()])).map((q) => q.name)
    : [];
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
    await composition.enqueue(database.db, boss);
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
        report();
        if (!aborted)
          await boss.fail(name, job, { error: "HANDLER_RETRYABLE_FAILURE" });
      }
    }
  }
  let active: Promise<void> | undefined;
  const tick = () => {
    if (stopping || active) return;
    active = cycle()
      .catch(() => {
        report();
        console.error("Job runtime unavailable; inspect database readiness");
      })
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
    status: () => composition.status(database.db),
    stop,
  };
}

type JobRuntime = Awaited<ReturnType<typeof startJobRuntime>>;
const inprocessKey = Symbol.for("aarili.job-runtime.inprocess");
export async function startInprocessJobs(
  env: Record<string, string | undefined>,
  composition: RuntimeComposition = emptyComposition,
  reportFailure?: () => void,
) {
  const connectionString = jobRuntimeConfiguration(env, "inprocess");
  if (!connectionString) return;
  const host = globalThis as typeof globalThis & {
    [inprocessKey]?: Promise<JobRuntime>;
  };
  // Store the promise before awaiting initialization; duplicate register calls
  // and development module reloads reuse it, including simultaneous calls.
  if (!host[inprocessKey])
    host[inprocessKey] = startJobRuntime(
      connectionString,
      {
        mode: "inprocess",
        ...(reportFailure ? { reportFailure } : {}),
      },
      composition,
    )
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
