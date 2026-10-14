import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { guardedEffect } from "@aarili/core/restore";
import { withShop } from "@aarili/db";
import { restoreRepository } from "@aarili/db/restore-repository";
import { scheduleRepository } from "@aarili/db/schedule-repository";

export async function eventually(predicate) {
  for (let i = 0; i < 200; i++) {
    if (await predicate()) return;
    await delay(50);
  }
  assert.fail("Disposable runtime condition did not settle");
}
export function runnerChild(
  f,
  mode = "worker",
  phase = "none",
  timeout = 10000,
) {
  const child = fork(
    "scripts/test-support/runtime-child.mjs",
    [mode, phase, String(timeout)],
    {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: f.parallel.pool.options.connectionString,
        OUTBOUND_EFFECTS: "disabled",
        RUN_JOBS_INPROCESS: "false",
      },
    },
  );
  const messages = [];
  let output = "";
  child.on("message", (m) => messages.push(m));
  child.stdout.on("data", (b) => {
    output += b;
  });
  child.stderr.on("data", (b) => {
    output += b;
  });
  const exited = new Promise((resolve) =>
    child.on("exit", (code, signal) => resolve({ code, signal })),
  );
  return {
    child,
    messages,
    exited,
    output: () => output,
    async wait(type) {
      await eventually(() => messages.some((m) => m.type === type));
      return messages.find((m) => m.type === type);
    },
    async cleanup() {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await exited;
    },
  };
}
export async function configureSchedule(
  f,
  task = "foundation.daily",
  enable = true,
  version = 0,
) {
  return (
    await f.operator.query(
      "select configure_job_schedule($1,$2,$3,$4,$5) as version",
      [f.a.shop, f.a.user, task, version, enable],
    )
  ).rows[0].version;
}
// Only disposable fixture migration authority can shift a trusted cursor.
export async function dueSchedule(
  f,
  task = "foundation.daily",
  date = "2026-10-13",
) {
  const hour = task === "foundation.daily" ? "06:00" : "01:00";
  await f.admin.query(
    "update job_schedule set next_due=($3::date+$4::time) AT TIME ZONE 'Asia/Kolkata' where shop_id=$1 and task=$2",
    [f.a.shop, task, date, hour],
  );
}
export async function scheduledRuns(f) {
  return (
    await f.admin.query(
      "select id,shop_id,task,business_date::text,restore_epoch,authorizer_id from job_schedule_run order by due_at",
    )
  ).rows;
}

// A fake digest is a counter with no transport/credentials. The same guarded
// effect policy rechecks epoch, current grant/owner and practice at the boundary.
export async function fakeJobDigest(f, run) {
  return withShop(f.parallel.db, run.authorizer_id, run.shop_id, async (tx) => {
    const controls = restoreRepository(tx, run.shop_id),
      repo = scheduleRepository(tx, run.shop_id);
    await controls.lockState();
    await repo.lock(run.task);
    return guardedEffect(
      controls,
      () => f.fake.operator,
      async () => ({
        epoch: run.restore_epoch,
        practice: await controls.practice(),
        authorized: await authorizeJobPrincipal(
          tx,
          run.authorizer_id,
          run.shop_id,
        ),
        current: await repo.enabled(await repo.run(run.id)),
      }),
      async () => {
        f.fake.calls++;
      },
    );
  });
}
