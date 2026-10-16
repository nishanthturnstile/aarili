import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { consumeSyntheticJob } from "@aarili/core/jobs";
import { createDatabase, sql, withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { syntheticJobRepository } from "@aarili/db/jobs-repository";
import {
  handleSyntheticJob,
  startSyntheticQueue,
  syntheticQueue,
} from "@aarili/jobs";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  barrier,
  consumeOne,
  jobCommand,
  jobCounts,
  jobPayload,
  jobsApiRequest,
  withJobsFixture,
} from "../scripts/test-support/jobs.mjs";
import { withPostgres } from "../scripts/test-support/postgres.mjs";

test("0.3.2a D1/D7 pg-boss missing schema/queue fails closed; migration authority alone provisions", async () => {
  await withPostgres(async (c) => {
    const runtime = createDatabase(c.connectionString);
    try {
      await assert.rejects(
        () => startSyntheticQueue(runtime.db),
        /setup missing or incompatible/,
      );
      assert.equal(
        (await runtime.db.execute(sql`select to_regnamespace('pgboss') as n`))
          .rows[0].n,
        null,
      );
      await Promise.all([
        migrateDatabase(c.migrationConnectionString),
        migrateDatabase(c.migrationConnectionString),
      ]);
      await assert.rejects(
        () => startSyntheticQueue(runtime.db),
        /setup missing or incompatible/,
      );
      await assertIsolationCatalog(runtime.db);
      assert.equal(
        (
          await runtime.db.execute(
            sql`select count(*)::int as n from pgboss.queue`,
          )
        ).rows[0].n,
        3,
      );
      await assert.rejects(() =>
        runtime.db.execute(sql`create schema runtime_ddl`),
      );
      await assert.rejects(() =>
        runtime.db.execute(
          sql`select pgboss.create_queue('unauthorized','{}'::jsonb)`,
        ),
      );
    } finally {
      await runtime.pool.end();
    }
  });
}, 120000);

test("0.3.2a D2/D8 TRU-06 independent app_user consumer sees zero before commit; exact transaction identities", async () => {
  await withJobsFixture(async (f) => {
    const entered = barrier(),
      release = barrier();
    let writer;
    const pending = jobCommand(f, {
      pool: f.runtime,
      checkpoint: async (tx) => {
        writer = (
          await tx.execute(
            sql`select pg_backend_pid() as pid,txid_current()::text as xid`,
          )
        ).rows[0];
        const rows = (
          await tx.execute(
            sql`select xmin::text as xid from synthetic_record union all select xmin::text from audit_event where action='synthetic.create' union all select xmin::text from idempotency_key union all select xmin::text from synthetic_job_request union all select xmin::text from pgboss.job`,
          )
        ).rows;
        assert.equal(rows.length, 5);
        assert(rows.every((r) => r.xid === writer.xid));
        entered.resolve();
        await release.promise;
      },
    });
    await Promise.race([
      entered.promise,
      pending.then(() => {
        throw Error("Pause not reached");
      }),
    ]);
    try {
      assert.notEqual(
        (await f.parallel.db.execute(sql`select pg_backend_pid() as pid`))
          .rows[0].pid,
        writer.pid,
      );
      assert.deepEqual(await f.boss.fetch(syntheticQueue), []);
      assert.equal((await jobCounts(f)).jobs, 0);
    } finally {
      release.resolve();
    }
    await pending;
    assert.deepEqual(await jobCounts(f), {
      records: 1,
      command_audit: 1,
      handler_audit: 0,
      keys: 1,
      requests: 1,
      jobs: 1,
      effects: 0,
    });
    assert.equal(await consumeOne(f), "applied");
    assert.deepEqual(await jobCounts(f), {
      records: 1,
      command_audit: 1,
      handler_audit: 1,
      keys: 1,
      requests: 1,
      jobs: 1,
      effects: 1,
    });
  });
}, 120000);

test("0.3.2a D3/D4/D6/D7 TRU-01 AC-38 AC-55 real authenticated API → command → actual queue; replay and contract negatives", async () => {
  await withJobsFixture(async (f) => {
    const key = randomUUID();
    const response = await jobsApiRequest(f, {
      key,
      headers: { "X-Actor-Id": f.b.user, "X-Shop-Id": f.b.shop },
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    const payload = await jobPayload(f, result);
    assert.deepEqual(payload, {
      requestId: result.record.eventId,
      shopId: f.a.shop,
      initiatorId: f.a.user,
      entityId: result.record.id,
      version: 1,
      epoch: (await f.admin.query("select restore_epoch from system_state"))
        .rows[0].restore_epoch,
    });
    assert.deepEqual(await (await jobsApiRequest(f, { key })).json(), result);
    assert.equal((await jobsApiRequest(f, { key, value: "beta" })).status, 422);
    for (const args of [
      { headers: { Cookie: "" } },
      { headers: { Origin: "https://foreign.example.test" } },
      { headers: { "Idempotency-Key": "" } },
      { value: "private content" },
      { path: `/dev/shops/${f.b.shop}/records` },
    ])
      assert.notEqual((await jobsApiRequest(f, args)).status, 200);
    assert.equal((await jobCounts(f)).jobs, 1);
    await assertIsolationCatalog(f.runtime.db);
    assert.equal(
      await handleSyntheticJob(f.parallel.db, {
        ...payload,
        token: "synthetic-token",
      }),
      "ignored",
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, {
        ...payload,
        initiatorId: f.b.user,
      }),
      "ignored",
    );
    // Even a currently verified member of the same shop cannot replace the
    // authoritative initiator that originally authorized this request.
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, {
        ...payload,
        initiatorId: f.b.user,
      }),
      "ignored",
    );
    assert.equal(await consumeOne(f), "applied");
    const audit = (
      await f.admin.query(
        "select actor_id,source_event_id,request_id,idempotency_key,changes from audit_event where action='synthetic.job.consume'",
      )
    ).rows[0];
    assert.equal(audit.actor_id, f.a.user);
    assert.equal(audit.source_event_id, result.record.eventId);
    assert.equal(audit.idempotency_key, key);
    assert(!JSON.stringify(audit.changes).includes("alpha"));
  });
}, 120000);

test("0.3.2a D5/D6 USE-08 identical and changed binding concurrency; lost response; durable delivery dedupe outlives keys/singletons", async () => {
  await withJobsFixture(async (f) => {
    const key = randomUUID();
    const [a, b] = await Promise.all([
      jobCommand(f, { key }),
      jobCommand(f, { key }),
    ]);
    assert.deepEqual(a, b);
    // The caller loses this committed response; retry cannot enqueue again.
    assert.deepEqual(await jobCommand(f, { key }), a);
    const other = randomUUID();
    const results = await Promise.allSettled([
      jobCommand(f, { key: other }),
      jobCommand(f, { key: other, input: { action: "create", value: "beta" } }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.status,
      422,
    );
    const payload = await jobPayload(f, a);
    assert.deepEqual(
      (
        await Promise.all([
          handleSyntheticJob(f.parallel.db, payload),
          handleSyntheticJob(f.parallel.db, payload),
        ])
      ).sort(),
      ["applied", "duplicate"],
    );
    await f.admin.query("delete from idempotency_key where key=$1", [key]);
    await f.admin.query(
      "update pgboss.job set singleton_on=singleton_on-interval '1 day' where id=$1",
      [payload.requestId],
    );
    // Actual new queue delivery after singleton window/key removal, same authoritative request.
    const delivery = await f.boss.send(syntheticQueue, payload);
    assert(delivery);
    assert.equal(await handleSyntheticJob(f.parallel.db, payload), "duplicate");
    assert.equal((await jobCounts(f)).effects, 1);
    assert.equal((await jobCounts(f)).handler_audit, 1);
  });
}, 120000);

test("0.3.2a D2/D6 atomic failures after change/audit/key/enqueue and backend loss leave no partial write; same key safely retries", async () => {
  await withJobsFixture(async (f) => {
    for (const step of [
      "insert",
      "audit",
      "persist",
      "enqueue",
      "commit-boundary",
    ]) {
      const before = await jobCounts(f),
        key = randomUUID();
      await assert.rejects(() =>
        jobCommand(f, {
          key,
          decorate: (repo) =>
            step === "enqueue" || step === "commit-boundary"
              ? repo
              : {
                  ...repo,
                  [step]: async (...args) => {
                    await repo[step](...args);
                    throw new Error("Synthetic write failure");
                  },
                },
          decorateJobs: (repo) =>
            step !== "enqueue"
              ? repo
              : {
                  enqueue: async (...args) => {
                    await repo.enqueue(...args);
                    throw new Error("Synthetic enqueue failure");
                  },
                },
          checkpoint: async () => {
            if (step === "commit-boundary")
              throw new Error("Synthetic commit-boundary failure");
          },
        }),
      );
      assert.deepEqual(await jobCounts(f), before);
      await jobCommand(f, { key });
    }
    // A real denied INSERT at send() occurs after the authoritative request,
    // key, audit and entity writes. It must roll back all of them as well.
    const enqueueBefore = await jobCounts(f),
      enqueueKey = randomUUID();
    await f.migration.query("revoke insert on pgboss.job_common from app_user");
    try {
      await assert.rejects(() => jobCommand(f, { key: enqueueKey }));
      assert.deepEqual(await jobCounts(f), enqueueBefore);
    } finally {
      await f.migration.query("grant insert on pgboss.job_common to app_user");
    }
    await jobCommand(f, { key: enqueueKey });
    const before = await jobCounts(f),
      entered = barrier(),
      release = barrier(),
      key = randomUUID();
    let pid;
    const pending = jobCommand(f, {
      key,
      pool: f.runtime,
      checkpoint: async (tx) => {
        pid = (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0]
          .pid;
        entered.resolve();
        await release.promise;
      },
    });
    const denied = assert.rejects(pending);
    await entered.promise;
    await f.admin.query("select pg_terminate_backend($1)", [pid]);
    release.resolve();
    await denied;
    assert.deepEqual(await jobCounts(f), before);
    await jobCommand(f, { key, pool: f.runtime });
  });
}, 120000);

test("0.3.2a D4/D7 TRU-01 AC-38 both-direction foreign IDs, obsolete version, revoked and unverified authority and pool reuse", async () => {
  await withJobsFixture(async (f) => {
    for (const [who, foreign] of [
      [f.a, f.b],
      [f.b, f.a],
    ]) {
      const response = await jobCommand(f, { who }),
        payload = await jobPayload(f, response);
      assert.equal(
        await handleSyntheticJob(f.parallel.db, {
          ...payload,
          shopId: foreign.shop,
          initiatorId: foreign.user,
        }),
        "ignored",
      );
      assert.equal(
        await handleSyntheticJob(f.parallel.db, {
          ...payload,
          entityId: randomUUID(),
        }),
        "ignored",
      );
      assert.equal(
        await handleSyntheticJob(f.parallel.db, {
          ...payload,
          requestId: randomUUID(),
        }),
        "ignored",
      );
      await withShop(f.runtime.db, foreign.user, foreign.shop, async (tx) => {
        assert.equal(
          await syntheticJobRepository(tx, foreign.shop).request(
            payload.requestId,
          ),
          undefined,
        );
        assert.equal(
          await commandRepository(tx, foreign.shop).read(payload.entityId),
          undefined,
        );
      });
      await jobCommand(f, {
        who,
        input: { action: "edit", value: "beta" },
        target: payload.entityId,
        version: 1,
      });
      assert.equal(await handleSyntheticJob(f.parallel.db, payload), "ignored");
    }
    const response = await jobCommand(f),
      payload = await jobPayload(f, response);
    await f.admin.query(
      "update auth_user set email_verified=false where id=$1",
      [f.a.user],
    );
    assert.equal(await handleSyntheticJob(f.parallel.db, payload), "ignored");
    await f.admin.query(
      "update auth_user set email_verified=true where id=$1",
      [f.a.user],
    );
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.a.user],
    );
    assert.equal(await handleSyntheticJob(f.parallel.db, payload), "ignored");
    assert.equal((await jobCounts(f)).effects, 0);
    assert.equal(
      (
        await f.runtime.db.execute(
          sql`select count(*)::int as n from synthetic_job_request`,
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await f.runtime.db.execute(
          sql`select count(*)::int as n from synthetic_job_effect`,
        )
      ).rows[0].n,
      0,
    );
    const context = (
      await f.runtime.db.execute(
        sql`select current_setting('app.shop_id',true) as shop,current_setting('app.actor_id',true) as actor`,
      )
    ).rows[0];
    assert(!context.shop && !context.actor);
  });
}, 120000);

test("0.3.2a D6/D7 TRU-06 handler rollback/retry and immutable finalized source/request/effect; runtime DDL/maintenance and catalog drift denied", async () => {
  await withJobsFixture(async (f) => {
    const response = await jobCommand(f),
      payload = await jobPayload(f, response);
    const before = await jobCounts(f);
    await assert.rejects(() =>
      withShop(f.parallel.db, f.a.user, f.a.shop, async (tx) => {
        assert(await authorizeJobPrincipal(tx, f.a.user, f.a.shop));
        const records = commandRepository(tx, f.a.shop);
        await consumeSyntheticJob(
          {
            shopId: f.a.shop,
            userId: f.a.user,
            jobs: syntheticJobRepository(tx, f.a.shop),
            records: {
              ...records,
              audit: async (...args) => {
                await records.audit(...args);
                throw Error("Synthetic handler failure");
              },
            },
          },
          payload,
        );
      }),
    );
    assert.deepEqual(await jobCounts(f), before);
    await assert.rejects(() =>
      withShop(f.parallel.db, f.a.user, f.a.shop, async (tx) => {
        assert(await authorizeJobPrincipal(tx, f.a.user, f.a.shop));
        const records = commandRepository(tx, f.a.shop);
        await consumeSyntheticJob(
          {
            shopId: f.a.shop,
            userId: f.a.user,
            jobs: syntheticJobRepository(tx, f.a.shop),
            records: { ...records, audit: async () => {} },
          },
          payload,
        );
      }),
    );
    assert.deepEqual(await jobCounts(f), before);
    assert.equal(await handleSyntheticJob(f.parallel.db, payload), "applied");
    const finalized = await jobCommand(f, {
      input: { action: "finalize" },
      target: response.record.id,
      version: 1,
    });
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, finalized)),
      "applied",
    );
    for (const statement of [
      sql`update synthetic_record set value='gamma',version=3 where shop_id=${f.a.shop}::uuid and id=${response.record.id}::uuid`,
      sql`delete from synthetic_job_request`,
      sql`update synthetic_job_effect set occurred_at=now()`,
      sql`delete from audit_event`,
      sql`set role app_privacy`,
      sql`truncate pgboss.job`,
      sql`delete from pgboss.job_dependency`,
      sql`select pgboss.job_table_run('CREATE TABLE pgboss.unsafe (id int)')`,
    ])
      await assert.rejects(() =>
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(statement),
        ),
      );
    await assertIsolationCatalog(f.runtime.db);
    for (const [change, repair] of [
      [
        "create table pgboss.unexpected (id int)",
        "drop table pgboss.unexpected",
      ],
      [
        "grant truncate on pgboss.job_common to app_user",
        "revoke truncate on pgboss.job_common from app_user",
      ],
      [
        "grant execute on function pgboss.create_queue(text,jsonb) to app_user",
        "revoke execute on function pgboss.create_queue(text,jsonb) from app_user",
      ],
      [
        "alter table synthetic_job_effect no force row level security",
        "alter table synthetic_job_effect force row level security",
      ],
    ]) {
      await f.migration.query(change);
      try {
        await assert.rejects(() => assertIsolationCatalog(f.runtime.db));
      } finally {
        await f.migration.query(repair);
      }
      await assertIsolationCatalog(f.runtime.db);
    }
  });
}, 120000);

test("0.3.2a D4/D6 TRU-01 actual queue retry after handler failure; current membership revocation serializes with committed effects", async () => {
  await withJobsFixture(async (f) => {
    const response = await jobCommand(f),
      payload = await jobPayload(f, response);
    await f.migration.query(
      "create function synthetic_fail_handler() returns trigger language plpgsql as $$ begin raise exception 'Synthetic handler failure'; end $$; create trigger fail_handler before insert on synthetic_job_effect for each row execute function synthetic_fail_handler()",
    );
    assert.equal(await consumeOne(f), "retry");
    assert.equal((await jobCounts(f)).effects, 0);
    assert.equal((await jobCounts(f)).handler_audit, 0);
    assert.equal(
      (
        await f.admin.query("select state from pgboss.job where id=$1", [
          payload.requestId,
        ])
      ).rows[0].state,
      "retry",
    );
    await f.migration.query(
      "drop trigger fail_handler on synthetic_job_effect; drop function synthetic_fail_handler()",
    );
    assert.equal(await consumeOne(f), "applied");
    assert.equal((await jobCounts(f)).effects, 1);

    const next = await jobCommand(f),
      nextPayload = await jobPayload(f, next);
    const entered = barrier(),
      release = barrier();
    const processing = withShop(
      f.parallel.db,
      f.a.user,
      f.a.shop,
      async (tx) => {
        assert(await authorizeJobPrincipal(tx, f.a.user, f.a.shop));
        entered.resolve();
        await release.promise;
        return consumeSyntheticJob(
          {
            shopId: f.a.shop,
            userId: f.a.user,
            jobs: syntheticJobRepository(tx, f.a.shop),
            records: commandRepository(tx, f.a.shop),
          },
          nextPayload,
        );
      },
    );
    await Promise.race([entered.promise, processing]);
    const revoker = await f.admin.connect();
    try {
      const pid = (await revoker.query("select pg_backend_pid() as pid"))
        .rows[0].pid;
      const revoked = revoker.query(
        "delete from shop_membership where shop_id=$1 and user_id=$2",
        [f.a.shop, f.a.user],
      );
      try {
        let blocked = false;
        for (let i = 0; i < 40; i++) {
          blocked = (
            await f.admin.query(
              "select cardinality(pg_blocking_pids($1))>0 as blocked",
              [pid],
            )
          ).rows[0].blocked;
          if (blocked) break;
          await delay(25);
        }
        assert(
          blocked,
          "Revocation must wait on the authorized membership row lock",
        );
      } finally {
        release.resolve();
      }
      assert.equal(await processing, "applied");
      await revoked;
    } finally {
      release.resolve();
      revoker.release();
    }
    assert.equal(
      await handleSyntheticJob(f.parallel.db, nextPayload),
      "ignored",
    );
    assert.equal((await jobCounts(f)).effects, 2);
  });
}, 120000);

test("0.3.2a D4/D5/D6 USE-08 AC-55 distinct-key version conflict queues only its winner; same key in another shop is independent", async () => {
  await withJobsFixture(async (f) => {
    const key = randomUUID();
    const [a, b] = await Promise.all([
      jobCommand(f, { key }),
      jobCommand(f, { key, who: f.b }),
    ]);
    assert.notEqual(a.record.id, b.record.id);
    const edits = await Promise.allSettled(
      ["beta", "gamma"].map((value) =>
        jobCommand(f, {
          input: { action: "edit", value },
          target: a.record.id,
          version: 1,
        }),
      ),
    );
    assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(edits.find((r) => r.status === "rejected").reason.status, 412);
    assert.deepEqual(await jobCounts(f), {
      records: 2,
      command_audit: 3,
      handler_audit: 0,
      keys: 3,
      requests: 3,
      jobs: 3,
      effects: 0,
    });
    const current = edits.find((r) => r.status === "fulfilled").value;
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, a)),
      "ignored",
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, current)),
      "applied",
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, b)),
      "applied",
    );
    const finalize = await jobCommand(f, {
      input: { action: "finalize" },
      target: a.record.id,
      version: 2,
    });
    const corrections = await Promise.allSettled(
      ["alpha", "beta"].map((value) =>
        jobCommand(f, {
          input: {
            action: "correct",
            value,
            reason: "Synthetic linked correction",
          },
          target: a.record.id,
          version: 3,
        }),
      ),
    );
    assert.equal(corrections.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      corrections.find((r) => r.status === "rejected").reason.status,
      409,
    );
    const correction = corrections.find((r) => r.status === "fulfilled").value;
    assert.equal(correction.record.correctionOf, a.record.id);
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, finalize)),
      "applied",
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, correction)),
      "applied",
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      const original = await commandRepository(tx, f.a.shop).read(a.record.id);
      assert.equal(original.finalized, true);
      assert.equal(original.version, 3);
      assert.equal(original.eventId, finalize.record.eventId);
    });
  });
}, 120000);
