import assert from "node:assert/strict";
import { syntheticQueue } from "@aarili/jobs";
import {
  deadQueue,
  inspectJobStatus,
  redriveSyntheticJob,
  startInprocessJobs,
} from "@aarili/jobs/runtime";
import {
  configureSchedule,
  dueSchedule,
  eventually,
  fakeJobDigest,
  runnerChild,
  scheduledRuns,
} from "./job-runtime.mjs";
import { jobCommand, jobCounts, jobPayload } from "./jobs.mjs";

export const runtimeCommands = [
  "runtime-inprocess",
  "runtime-worker",
  "runtime-two",
  "runtime-stop",
  "runtime-queue",
  "runtime-status",
  "runtime-fail",
  "runtime-clear-failure",
  "runtime-redrive",
  "runtime-schedule",
  "runtime-repeat-date",
  "runtime-revoke-schedule",
  "runtime-digest",
  "runtime-crash-before",
  "runtime-crash-after",
  "runtime-timeout",
];
export function createRuntimeInspection(f) {
  let inprocess;
  const children = [];
  let last;
  const stop = async () => {
    if (inprocess) {
      console.info(`In-process ${await inprocess.stop()}`);
      inprocess = undefined;
    }
    for (const child of children.splice(0)) {
      if (child.child.connected) child.child.send("shutdown");
      await child.exited;
      console.info("Disposable standalone runner stopped");
    }
  };
  const status = async () => {
    const s = await inspectJobStatus(f.runtime.db);
    console.info(
      JSON.stringify({
        ...s,
        counts: await jobCounts(f),
        modes: { inprocess: !!inprocess, workers: children.length },
        fakeDigestCalls: f.fake.calls,
      }),
    );
    const grants = (
      await f.admin.query(
        "select task,version,enabled,next_due,(next_due at time zone 'Asia/Kolkata')::text as next_local from job_schedule order by task",
      )
    ).rows;
    console.info(
      JSON.stringify({
        timeZone: "Asia/Kolkata",
        grants,
        runs: (await scheduledRuns(f)).map((r) => ({
          task: r.task,
          date: r.business_date,
        })),
      }),
    );
    return s;
  };
  const start = async (mode) => {
    if (mode === "inprocess") {
      assert(!inprocess, "Stop existing in-process runner first");
      inprocess = await startInprocessJobs({
        NODE_ENV: "development",
        RUN_JOBS_INPROCESS: "true",
        OUTBOUND_EFFECTS: "disabled",
        DATABASE_URL: f.parallel.pool.options.connectionString,
      });
      console.info(
        `Development in-process registry: ${inprocess.handlers.join(", ")}`,
      );
    } else {
      const child = runnerChild(f);
      children.push(child);
      const ready = await child.wait("ready");
      console.info(`Standalone registry: ${ready.handlers.join(", ")}`);
    }
  };
  const action = async (name) => {
    if (name === "runtime-inprocess") await start("inprocess");
    else if (name === "runtime-worker") await start("worker");
    else if (name === "runtime-two") {
      await stop();
      await start("inprocess");
      await start("worker");
    } else if (name === "runtime-stop") await stop();
    else if (name === "runtime-status") return status();
    else if (name === "runtime-queue") {
      const response = await jobCommand(f);
      last = await jobPayload(f, response);
      // A second actual queue delivery intentionally bypasses the 60-second
      // admission singleton to prove the durable database invariant.
      await f.boss.send(syntheticQueue, last);
      console.info(
        "Two queue deliveries, one authoritative request. Inspect exactly one new effect/handler audit after consumers settle.",
      );
    } else if (name === "runtime-fail") {
      await f.migration.query(
        "create or replace function runtime_fail() returns trigger language plpgsql as $$ begin raise exception 'private synthetic failure';end $$;create trigger runtime_fail before insert on synthetic_job_effect for each row execute function runtime_fail()",
      );
      await f.migration.query(
        "update pgboss.queue set retry_delay=1,retry_backoff=true,retry_delay_max=4 where name='foundation.synthetic'",
      );
      const response = await jobCommand(f);
      last = await jobPayload(f, response);
      console.info(
        "Disposable handler failure installed: observe retry/backoff then exhausted dead letter; clear failure before redrive.",
      );
    } else if (name === "runtime-clear-failure") {
      await f.migration.query(
        "drop trigger if exists runtime_fail on synthetic_job_effect;drop function if exists runtime_fail()",
      );
      console.info(
        "Disposable transient/permanent failure removed; history retained.",
      );
    } else if (name === "runtime-redrive") {
      assert(last, "Queue a fixture first");
      const dead = (
        await f.admin.query(
          "select id from pgboss.job where name=$1 and data->>'requestId'=$2 and state='created' order by created_on desc limit 1",
          [deadQueue, last.requestId],
        )
      ).rows[0];
      assert(dead, "Wait for exhausted dead letter first");
      console.info(
        `Guarded redrive: ${await redriveSyntheticJob(f.parallel.db, f.boss, f.a.user, f.a.shop, dead.id)}`,
      );
    } else if (name === "runtime-schedule") {
      for (const task of ["foundation.daily", "foundation.nightly"]) {
        const version =
          (
            await f.admin.query(
              "select version from job_schedule where shop_id=$1 and task=$2",
              [f.a.shop, task],
            )
          ).rows[0]?.version ?? 0;
        await configureSchedule(f, task, true, version);
        const date = (
          await f.admin.query(
            "select (clock_timestamp() at time zone 'Asia/Kolkata')::date::text as date",
          )
        ).rows[0].date;
        await dueSchedule(f, task, date);
      }
      console.info(
        "Two trusted fixture occurrences due: 06:00 daily / 01:00 nightly Asia/Kolkata. Nightly outcome only records rehearsal; it deletes nothing.",
      );
    } else if (name === "runtime-repeat-date") {
      const runs = await scheduledRuns(f);
      assert(runs.length, "Run runtime-schedule first");
      for (const r of runs) await dueSchedule(f, r.task, r.business_date);
      console.info(
        "Repeated fixture date cursor; run/effect/audit counts must stay unchanged.",
      );
    } else if (name === "runtime-revoke-schedule") {
      const grants = (
        await f.admin.query(
          "select task,version from job_schedule where shop_id=$1",
          [f.a.shop],
        )
      ).rows;
      assert(grants.length, "Configure a schedule first");
      for (const g of grants)
        await configureSchedule(f, g.task, false, g.version);
      console.info(
        "Current grants revoked with versioned operator provenance; queued prior grants cannot effect.",
      );
    } else if (name === "runtime-digest") {
      const [run] = await scheduledRuns(f);
      assert(run, "Run schedule first");
      console.info(
        `Fake digest only: ${await fakeJobDigest(f, run)}; calls=${f.fake.calls}; real providers disabled`,
      );
    } else if (
      [
        "runtime-crash-before",
        "runtime-crash-after",
        "runtime-timeout",
      ].includes(name)
    ) {
      await stop();
      // Settle older fixture attempts before injecting a barrier into the next
      // request; otherwise the child could pause on unrelated queued work.
      await start("worker");
      await eventually(
        async () =>
          !(
            await f.admin.query(
              "select 1 from pgboss.job where name in ('foundation.synthetic','foundation.schedule') and state in ('created','retry','active') limit 1",
            )
          ).rowCount,
      );
      await stop();
      const before = await jobCounts(f);
      const response = await jobCommand(f);
      last = await jobPayload(f, response);
      const phase =
        name === "runtime-crash-after" ? "after-commit" : "before-commit";
      const child = runnerChild(
        f,
        "worker",
        phase,
        name === "runtime-timeout" ? 100 : 10000,
      );
      try {
        await child.wait("barrier");
        if (name === "runtime-timeout") child.child.send("shutdown");
        else child.child.kill("SIGKILL");
        const exit = await child.exited;
        if (name === "runtime-timeout") assert.equal(exit.code, 1);
      } finally {
        await child.cleanup();
      }
      const killed = await jobCounts(f);
      assert.equal(
        killed.effects,
        before.effects + (phase === "after-commit" ? 1 : 0),
      );
      await f.admin.query(
        "update pgboss.job set started_on=clock_timestamp()-interval '2 minutes' where id=$1 and state='active'",
        [last.requestId],
      );
      await start("worker");
      await eventually(
        async () => (await jobCounts(f)).effects === before.effects + 1,
      );
      console.info(
        `${name}: disposable child only; lease expiry/restart retained exactly one effect/audit. Runtime uses the real expiry; only fixture lease time was advanced.`,
      );
    } else throw Error("Unknown runtime command");
    return status();
  };
  return { action, cleanup: stop };
}
