import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { scheduleRepository } from "@aarili/db/schedule-repository";
import { syntheticQueue } from "@aarili/jobs";
import {
  deadQueue,
  enqueueDueSchedules,
  handleScheduledJob,
  inspectJobStatus,
  redriveSyntheticJob,
  startInprocessJobs,
  startJobRuntime,
} from "@aarili/jobs/foundation-runtime";
import {
  startInprocessJobs as startNormalInprocess,
  startJobRuntime as startNormalRuntime,
} from "@aarili/jobs/runtime";
import { test } from "vitest";
import {
  configureSchedule,
  dueSchedule,
  eventually,
  fakeJobDigest,
  runnerChild,
  scheduledRuns,
} from "../scripts/test-support/job-runtime.mjs";
import {
  barrier,
  jobCommand,
  jobCounts,
  jobPayload,
} from "../scripts/test-support/jobs.mjs";
import { withRestoreFixture } from "../scripts/test-support/restore.mjs";

test("#48 TRU-01/06/12 normal worker and opted-in web leave queued examples and due schedules untouched; explicit composition still consumes", async () => {
  await withRestoreFixture(async (f) => {
    await jobCommand(f);
    await configureSchedule(f);
    await dueSchedule(f);
    const before = await jobCounts(f);
    const due = (
      await f.admin.query(
        "select next_due::text from job_schedule order by task",
      )
    ).rows;
    const connectionString = f.parallel.pool.options.connectionString;
    const worker = await startNormalRuntime(connectionString, {
      mode: "worker",
      pollMilliseconds: 25,
    });
    const web = await startNormalInprocess({
      NODE_ENV: "development",
      RUN_JOBS_INPROCESS: "true",
      DATABASE_URL: connectionString,
    });
    try {
      assert.deepEqual(worker.handlers, []);
      assert.deepEqual(web.handlers, []);
      await delay(200);
      assert.deepEqual(await jobCounts(f), before);
      assert.deepEqual(
        (
          await f.admin.query(
            "select next_due::text from job_schedule order by task",
          )
        ).rows,
        due,
      );
      assert.equal((await scheduledRuns(f)).length, 0);
      assert.equal(
        (
          await f.admin.query(
            "select state from pgboss.job where name='foundation.synthetic'",
          )
        ).rows[0].state,
        "created",
      );
    } finally {
      await Promise.all([worker.stop(), web.stop()]);
    }
    const verification = await startJobRuntime(connectionString, {
      mode: "worker",
      pollMilliseconds: 25,
    });
    try {
      assert.deepEqual(verification.handlers, [
        "foundation.synthetic",
        "foundation.schedule",
      ]);
      await eventually(async () => (await jobCounts(f)).effects === 1);
    } finally {
      await verification.stop();
    }
  });
}, 120000);

test("0.3.2c F2/F4 TRU-01/06 DAY-06 AC-38 registered authority, local dates, transactional schedule, revoked/forged identity and immutable history", async () => {
  await withRestoreFixture(async (f) => {
    await assert.rejects(() =>
      f.runtime.db.execute(
        sql`select configure_job_schedule(${f.a.shop}::uuid,${f.a.user}::uuid,'foundation.daily',0,true)`,
      ),
    );
    await assert.rejects(() =>
      f.operator.query(
        "select configure_job_schedule($1,$2,'foundation.daily',0,true)",
        [f.b.shop, f.b.user],
      ),
    );
    await configureSchedule(f);
    await assert.rejects(() =>
      configureSchedule(f, "foundation.daily", true, 0),
    );
    await configureSchedule(f, "foundation.nightly");
    const grants = (
      await f.admin.query(
        "select task,extract(hour from next_due AT TIME ZONE 'Asia/Kolkata')::integer as hour from job_schedule order by task",
      )
    ).rows;
    assert.equal(grants[0].hour, 6);
    assert.equal(grants[1].hour, 1);
    await dueSchedule(f);
    await dueSchedule(f, "foundation.nightly");
    await f.migration.query("revoke insert on pgboss.job_common from app_user");
    try {
      await assert.rejects(() => enqueueDueSchedules(f.parallel.db, f.boss));
      assert.equal((await scheduledRuns(f)).length, 0);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from job_schedule where (next_due at time zone 'Asia/Kolkata')::date='2026-10-13'",
          )
        ).rows[0].n,
        2,
      );
    } finally {
      await f.migration.query("grant insert on pgboss.job_common to app_user");
    }
    assert.equal(await enqueueDueSchedules(f.parallel.db, f.boss), 2);
    const runs = await scheduledRuns(f);
    assert(runs.every((r) => r.business_date === "2026-10-13"));
    const daily = runs.find((r) => r.task === "foundation.daily");
    const payload = { shopId: f.a.shop, runId: daily.id, version: 1 };
    assert.equal(
      await handleScheduledJob(f.parallel.db, {
        ...payload,
        authorizerId: f.b.user,
      }),
      "ignored",
    );
    assert.equal(
      await handleScheduledJob(f.parallel.db, {
        ...payload,
        businessDate: "2026-10-14",
      }),
      "ignored",
    );
    assert.equal(
      await handleScheduledJob(f.parallel.db, { ...payload, shopId: f.b.shop }),
      "ignored",
    );
    assert.equal(await handleScheduledJob(f.parallel.db, payload), "applied");
    assert.equal(await handleScheduledJob(f.parallel.db, payload), "duplicate");
    const audit = (
      await f.admin.query(
        "select actor_type,actor_id,changes from audit_event where action='foundation.schedule.consume'",
      )
    ).rows[0];
    assert.equal(audit.actor_type, "system");
    assert.equal(audit.actor_id, "00000000-0037-4000-8000-000000000001");
    assert.deepEqual(audit.changes, {
      task: "foundation.daily",
      businessDate: "2026-10-13",
      authorizerId: f.a.user,
      grantVersion: 1,
    });
    await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) =>
      assert.equal(
        await scheduleRepository(tx, f.b.shop).run(daily.id),
        undefined,
      ),
    );
    for (const table of [
      "job_schedule_run",
      "job_schedule_effect",
      "job_schedule_quarantine",
      "job_schedule_event",
    ])
      await assert.rejects(() =>
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql.raw(`delete from ${table}`)),
        ),
      );
    await assert.rejects(() =>
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into audit_event(shop_id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${f.a.shop}::uuid,'system',${randomUUID()}::uuid,'forged','job_schedule_run',${daily.id}::uuid,${daily.id}::uuid,${daily.id}::uuid,'{}')`,
        ),
      ),
    );
    await assertIsolationCatalog(f.runtime.db);
    const nightly = runs.find((r) => r.task === "foundation.nightly");
    await configureSchedule(f, "foundation.nightly", false, 1);
    assert.equal(
      await handleScheduledJob(f.parallel.db, {
        shopId: f.a.shop,
        runId: nightly.id,
        version: 1,
      }),
      "ignored",
    );
    // Midnight boundaries are computed by real PostgreSQL from trusted instants.
    const dates = (
      await f.admin.query(
        "select ('2026-10-13T18:29:59Z'::timestamptz at time zone 'Asia/Kolkata')::date::text as before,('2026-10-13T18:30:00Z'::timestamptz at time zone 'Asia/Kolkata')::date::text as after",
      )
    ).rows[0];
    assert.deepEqual(dates, { before: "2026-10-13", after: "2026-10-14" });
    assert.equal(
      await scheduleRepository(f.runtime.db, f.a.shop).run(daily.id),
      undefined,
    );
    // Current grant revocation and an active scheduled transaction serialize
    // on the grant lock. Observe the real waiter before releasing the commit.
    await dueSchedule(f, "foundation.daily", "2026-10-14");
    await enqueueDueSchedules(f.parallel.db, f.boss);
    const current = (await scheduledRuns(f)).find(
      (r) => r.task === "foundation.daily" && r.business_date === "2026-10-14",
    );
    const entered = barrier(),
      release = barrier();
    const active = handleScheduledJob(
      f.parallel.db,
      { shopId: f.a.shop, runId: current.id, version: 1 },
      async () => {
        entered.resolve();
        await release.promise;
      },
    );
    await entered.promise;
    const op = await f.operator.connect();
    try {
      const pid = (await op.query("select pg_backend_pid() as pid")).rows[0]
        .pid;
      const revoke = op.query(
        "select configure_job_schedule($1,$2,'foundation.daily',1,false)",
        [f.a.shop, f.a.user],
      );
      await eventually(
        async () =>
          (
            await f.admin.query(
              "select cardinality(pg_blocking_pids($1))>0 as blocked",
              [pid],
            )
          ).rows[0].blocked,
      );
      release.resolve();
      assert.equal(await active, "applied");
      await revoke;
      assert.equal(
        await handleScheduledJob(f.parallel.db, {
          shopId: f.a.shop,
          runId: current.id,
          version: 1,
        }),
        "ignored",
      );
    } finally {
      release.resolve();
      op.release();
    }
    await f.control("restore");
    assert.equal(
      await handleScheduledJob(f.parallel.db, payload),
      "quarantined",
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int as n from job_schedule_quarantine",
        )
      ).rows[0].n,
      1,
    );
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.a.user],
    );
    assert.equal(
      await handleScheduledJob(f.parallel.db, payload),
      "quarantined",
    );
  });
}, 120000);

test("0.3.2c F1/F3/F4/F6/F9 shared registry, duplicate reload/start, actual scheduler, singleton expiry, fake-only digest guards", async () => {
  await withRestoreFixture(async (f) => {
    await configureSchedule(f);
    // Use the latest due 06:00 occurrence on the database clock. A fixed past
    // date lets the real polling scheduler catch up additional days, violating
    // this fixture's one-occurrence premise as soon as the calendar advances.
    const { date } = (
      await f.admin.query(
        "select ((clock_timestamp() at time zone 'Asia/Kolkata') - interval '6 hours')::date::text as date",
      )
    ).rows[0];
    await dueSchedule(f, "foundation.daily", date);
    const env = {
      NODE_ENV: "development",
      RUN_JOBS_INPROCESS: "true",
      OUTBOUND_EFFECTS: "disabled",
      DATABASE_URL: f.parallel.pool.options.connectionString,
    };
    const [a, reload] = await Promise.all([
      startInprocessJobs(env),
      startInprocessJobs(env),
    ]);
    assert.equal(a, reload);
    const b = await startJobRuntime(env.DATABASE_URL, {
      mode: "worker",
      pollMilliseconds: 50,
    });
    try {
      assert.deepEqual(a.handlers, b.handlers);
      await eventually(
        async () =>
          (
            await f.admin.query(
              "select count(*)::int as n from job_schedule_effect",
            )
          ).rows[0].n === 1,
      );
      const [run] = await scheduledRuns(f);
      assert.equal(run.business_date, date);
      // Repeat the exact fixture occurrence; durable date uniqueness wins even
      // after the queue's transient singleton protection has expired.
      await dueSchedule(f, "foundation.daily", date);
      await enqueueDueSchedules(f.parallel.db, f.boss);
      await f.admin.query(
        "update pgboss.job set singleton_on=singleton_on-interval '1 day' where name='foundation.schedule'",
      );
      assert(
        await f.boss.send("foundation.schedule", {
          shopId: run.shop_id,
          runId: run.id,
          version: 1,
        }),
      );
      const response = await jobCommand(f);
      const p = await jobPayload(f, response);
      assert(await f.boss.send(syntheticQueue, p));
      await eventually(async () => (await jobCounts(f)).effects === 1);
      assert.equal((await jobCounts(f)).handler_audit, 1);
      assert.equal((await scheduledRuns(f)).length, 1);
      assert.equal(await fakeJobDigest(f, run), "operator_disabled");
      await f.control("enable");
      f.fake.operator = "enabled";
      assert.equal(await fakeJobDigest(f, run), "applied");
      assert.equal(f.fake.calls, 1);
      await f.admin.query("update shop set is_practice=true where shop_id=$1", [
        f.a.shop,
      ]);
      assert.equal(await fakeJobDigest(f, run), "practice");
      assert.equal(f.fake.calls, 1);
      await f.admin.query(
        "update shop set is_practice=false where shop_id=$1",
        [f.a.shop],
      );
      await configureSchedule(f, "foundation.daily", false, 1);
      assert.equal(await fakeJobDigest(f, run), "obsolete_state");
      assert.equal(f.fake.calls, 1);
      const status = await b.status();
      assert.equal(status.realProviders, "disabled");
      assert(!JSON.stringify(status).includes("alpha"));
    } finally {
      assert.equal(await a.stop(), "stopped");
      assert.equal(await b.stop(), "stopped");
    }
  });
}, 120000);

test("0.3.2c F5/F6/F9 bounded retry/backoff, exhausted dead letters, scrubbed status and guarded durable redrive", async () => {
  await withRestoreFixture(async (f) => {
    // Migration-only queue configuration. Runtime cannot create/change queues.
    await f.migration.query(
      "update pgboss.queue set retry_delay=1,retry_backoff=true,retry_delay_max=4 where name='foundation.synthetic'",
    );
    const response = await jobCommand(f),
      p = await jobPayload(f, response);
    await f.admin.query(
      "update pgboss.job set created_on=clock_timestamp()-interval '5 minutes' where id=$1",
      [p.requestId],
    );
    assert(
      (await inspectJobStatus(f.runtime.db)).queues.some(
        (q) => q.oldestWaitingSeconds >= 300,
      ),
    );
    await f.migration.query(
      "create function runtime_fail() returns trigger language plpgsql as $$ begin raise exception 'private synthetic error text';end $$;create trigger runtime_fail before insert on synthetic_job_effect for each row execute function runtime_fail()",
    );
    let runtime = await startJobRuntime(
      f.parallel.pool.options.connectionString,
      { mode: "worker", pollMilliseconds: 50 },
    );
    let dead;
    try {
      await eventually(async () => {
        const row = (
          await f.admin.query(
            "select state,retry_count,start_after>clock_timestamp() as backoff from pgboss.job where id=$1",
            [p.requestId],
          )
        ).rows[0];
        return row?.state === "retry" && row.backoff;
      });
      await eventually(async () => {
        dead = (
          await f.admin.query(
            "select id,source_retry_count,source_output from pgboss.job where name=$1",
            [deadQueue],
          )
        ).rows[0];
        return !!dead;
      });
      assert.equal(dead.source_retry_count, 2);
      assert.equal((await jobCounts(f)).effects, 0);
      const status = await inspectJobStatus(f.runtime.db);
      assert(status.queues.some((q) => q.name === deadQueue));
      assert(!JSON.stringify(status).includes("private synthetic"));
      assert(!JSON.stringify(dead.source_output).includes("private synthetic"));
      await assert.rejects(() =>
        f.runtime.db.execute(
          sql`select pgboss.create_queue('unsafe','{}'::jsonb)`,
        ),
      );
      await assert.rejects(() =>
        redriveSyntheticJob(f.parallel.db, f.boss, f.b.user, f.a.shop, dead.id),
      );
      assert.equal(
        await redriveSyntheticJob(
          f.parallel.db,
          f.boss,
          f.b.user,
          f.b.shop,
          dead.id,
        ),
        "denied",
      );
      await f.migration.query(
        "drop trigger runtime_fail on synthetic_job_effect;drop function runtime_fail()",
      );
      assert.equal(
        await redriveSyntheticJob(
          f.parallel.db,
          f.boss,
          f.a.user,
          f.a.shop,
          dead.id,
        ),
        "redriven",
      );
      await eventually(async () => (await jobCounts(f)).effects === 1);
      assert.equal((await jobCounts(f)).handler_audit, 1);
      await runtime.stop();
      const next = await jobCommand(f),
        old = await jobPayload(f, next);
      await f.control("restore");
      runtime = await startJobRuntime(
        f.parallel.pool.options.connectionString,
        { mode: "worker", pollMilliseconds: 50 },
      );
      await eventually(
        async () =>
          !!(
            await f.admin.query(
              "select id from pgboss.job where name=$1 and data->>'requestId'=$2",
              [deadQueue, old.requestId],
            )
          ).rowCount,
      );
      const quarantined = (
        await f.admin.query(
          "select id from pgboss.job where name=$1 and data->>'requestId'=$2",
          [deadQueue, old.requestId],
        )
      ).rows[0];
      assert.equal(
        await redriveSyntheticJob(
          f.parallel.db,
          f.boss,
          f.a.user,
          f.a.shop,
          quarantined.id,
        ),
        "quarantined",
      );
      assert.equal((await jobCounts(f)).effects, 1);
      assert((await runtime.status()).queues.some((q) => q.quarantined > 0));
    } finally {
      await runtime.stop();
    }
  });
}, 120000);

test("0.3.2c F7/F8 TRU-06/10 USE-08 AC-56 disposable child crashes before commit/after commit-before-ack recover one effect", async () => {
  await withRestoreFixture(async (f) => {
    for (const phase of ["before-commit", "after-commit"]) {
      const before = await jobCounts(f);
      const response = await jobCommand(f),
        p = await jobPayload(f, response);
      const child = runnerChild(f, "worker", phase);
      try {
        await child.wait("barrier");
        assert.equal(
          (await jobCounts(f)).effects,
          before.effects + (phase === "after-commit" ? 1 : 0),
        );
        child.child.kill("SIGKILL");
        await child.exited;
      } finally {
        await child.cleanup();
      }
      // Shift only this disposable lease timestamp to exercise actual expiry,
      // not a long wall-clock sleep or a fabricated completed queue result.
      await f.admin.query(
        "update pgboss.job set started_on=clock_timestamp()-interval '2 minutes' where id=$1 and state='active'",
        [p.requestId],
      );
      const restart = runnerChild(f, "inprocess");
      try {
        await restart.wait("ready");
        await eventually(async () =>
          (
            await f.admin.query(
              "select state from pgboss.job where name=$1 and data->>'requestId'=$2",
              [syntheticQueue, p.requestId],
            )
          ).rows.some((r) => r.state === "completed"),
        );
        assert.equal((await jobCounts(f)).effects, before.effects + 1);
        assert.equal(
          (await jobCounts(f)).handler_audit,
          before.handler_audit + 1,
        );
        restart.child.send("shutdown");
        assert.equal((await restart.exited).code, 0);
        assert.equal((await restart.wait("stopped")).outcome, "stopped");
      } finally {
        await restart.cleanup();
      }
    }
  });
}, 120000);

test("0.3.2c F7/F9 Windows IPC / Linux SIGINT SIGTERM graceful drain and separately bounded timeout rollback", async () => {
  await withRestoreFixture(async (f) => {
    for (const signal of process.platform === "win32"
      ? ["ipc"]
      : ["ipc", "SIGINT", "SIGTERM"]) {
      const child = runnerChild(f, "reload");
      try {
        await child.wait("ready");
        if (signal === "ipc") child.child.send("shutdown");
        else child.child.kill(signal);
        assert.equal((await child.exited).code, 0);
        assert.equal((await child.wait("stopped")).outcome, "stopped");
      } finally {
        await child.cleanup();
      }
    }
    const before = await jobCounts(f);
    await jobCommand(f);
    const active = runnerChild(f, "worker", "before-commit");
    try {
      await active.wait("barrier");
      active.child.send("shutdown");
      active.child.send("resume");
      assert.equal((await active.exited).code, 0);
      assert.equal((await jobCounts(f)).effects, before.effects + 1);
    } finally {
      await active.cleanup();
    }
    const next = await jobCommand(f),
      p = await jobPayload(f, next);
    const stuck = runnerChild(f, "worker", "before-commit", 100);
    try {
      await stuck.wait("barrier");
      stuck.child.send("shutdown");
      assert.equal((await stuck.exited).code, 1);
      assert.equal((await stuck.wait("stopped")).outcome, "timed-out");
      assert.equal((await jobCounts(f)).effects, before.effects + 1);
    } finally {
      await stuck.cleanup();
    }
    await f.admin.query(
      "update pgboss.job set started_on=clock_timestamp()-interval '2 minutes' where id=$1",
      [p.requestId],
    );
    const restart = runnerChild(f);
    try {
      await restart.wait("ready");
      await eventually(
        async () => (await jobCounts(f)).effects === before.effects + 2,
      );
      restart.child.send("shutdown");
      assert.equal((await restart.exited).code, 0);
    } finally {
      await restart.cleanup();
    }
    // In-process timeout cannot kill its web host. Once the held callback
    // relinquishes work, the shared veto rolls back before pool closure.
    await jobCommand(f);
    const entered = barrier(),
      release = barrier();
    const inprocess = await startJobRuntime(
      f.parallel.pool.options.connectionString,
      {
        mode: "inprocess",
        pollMilliseconds: 50,
        hooks: {
          beforeCommit: async () => {
            entered.resolve();
            await release.promise;
          },
        },
      },
    );
    try {
      await entered.promise;
      const pid = (
        await f.admin.query(
          "select pid from pg_stat_activity where usename='app_user' and state='idle in transaction' and query like '%insert into audit_event%' limit 1",
        )
      ).rows[0]?.pid;
      assert(pid);
      assert.equal(await inprocess.stop(100), "timed-out");
      release.resolve();
      await eventually(
        async () =>
          !(
            await f.admin.query("select 1 from pg_stat_activity where pid=$1", [
              pid,
            ])
          ).rowCount,
      );
      assert.equal((await jobCounts(f)).effects, before.effects + 2);
    } finally {
      release.resolve();
      await inprocess.stop();
    }
  });
}, 120000);
