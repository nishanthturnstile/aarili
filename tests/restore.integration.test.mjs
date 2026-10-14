import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { prospectiveAuthDelivery } from "@aarili/auth/delivery-guard";
import { requireRuntimeRole, sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { restoreRepository } from "@aarili/db/restore-repository";
import { handleSyntheticJob, startSyntheticQueue } from "@aarili/jobs";
import { test } from "vitest";
import { restoreControl } from "../scripts/restore-control.mjs";
import {
  barrier,
  consumeOne,
  jobCommand,
  jobCounts,
  jobPayload,
} from "../scripts/test-support/jobs.mjs";
import {
  fakeAuthDelivery,
  fakeOutbound,
  quarantineJob,
  syntheticFinancial,
  withRestoreFixture,
} from "../scripts/test-support/restore.mjs";
import { createRestoreInspection } from "../scripts/test-support/restore-inspection.mjs";

async function waiting(f, pid) {
  for (let i = 0; i < 100; i++) {
    if (
      (
        await f.admin.query(
          "select cardinality(pg_blocking_pids($1))>0 as blocked",
          [pid],
        )
      ).rows[0].blocked
    )
      return;
    await delay(20);
  }
  assert.fail("Explicit transition barrier did not block");
}

test("0.3.2b E1/E2/E6 AC-56 combined epoch/authority revocation never silently completes old work or fabricates tenant admission", async () => {
  await withRestoreFixture(async (f) => {
    const a = await jobCommand(f),
      b = await jobCommand(f, { who: f.b });
    await f.admin.query(
      "update auth_user set email_verified=false where id=$1",
      [f.a.user],
    );
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.b.shop, f.b.user],
    );
    await f.control("restore");
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, a)),
      "quarantined",
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, b)),
      "quarantined",
    );
    for (let attempt = 0; attempt < 6; attempt++)
      assert.equal(await consumeOne(f), "quarantined");
    const rows = (await f.admin.query("select state,output from pgboss.job"))
      .rows;
    assert.equal(rows.length, 2);
    assert(
      rows.every(
        (row) =>
          row.state === "failed" && row.output.error === "RESTORE_QUARANTINED",
      ),
    );
    const quarantine = (
      await f.admin.query("select shop_id from synthetic_job_quarantine")
    ).rows;
    assert.deepEqual(quarantine, [{ shop_id: f.a.shop }]);
    // B's immutable original request and queue ID/epoch/reason remain durable,
    // but no tenant context or row is fabricated after membership is removed.
    assert.equal((await jobCounts(f)).effects, 0);
    assert.equal(f.fake.calls, 0);
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.b.shop, f.b.user],
    );
    assert.equal(
      await handleSyntheticJob(f.parallel.db, await jobPayload(f, b)),
      "quarantined",
    );
    assert.equal(
      (await f.admin.query("select 1 from synthetic_job_quarantine")).rowCount,
      2,
    );
  });
}, 120000);

test("0.3.2b E1/E3/E8 BIZ-01 AC-36 independent guards, immediate recheck, database loss and fake-only positive", async () => {
  await withRestoreFixture(async (f) => {
    const response = await jobCommand(f),
      p = await jobPayload(f, response);
    assert.equal(p.epoch, (await f.control()).state.epoch);
    assert.equal(await fakeOutbound(f, p), "operator_disabled");
    await f.control("enable");
    assert.equal((await f.control()).state.outbound, true);
    for (const operator of ["disabled", undefined, "invalid"]) {
      f.fake.operator = operator;
      assert.equal(await fakeOutbound(f, p), "operator_disabled");
    }
    f.fake.operator = "enabled";
    await f.control("disable");
    assert.equal(await fakeOutbound(f, p), "database_disabled");
    await f.control("enable");
    await f.admin.query("update shop set is_practice=true where shop_id=$1", [
      f.a.shop,
    ]);
    assert.equal(await fakeOutbound(f, p), "practice");
    await f.admin.query("update shop set is_practice=false where shop_id=$1", [
      f.a.shop,
    ]);
    await f.admin.query(
      "update auth_user set email_verified=false where id=$1",
      [f.a.user],
    );
    assert.equal(await fakeOutbound(f, p), "authority_revoked");
    await f.admin.query(
      "update auth_user set email_verified=true where id=$1",
      [f.a.user],
    );
    assert.equal(
      await fakeOutbound(f, p, {
        checkpoint: async () => {
          f.fake.operator = "disabled";
        },
      }),
      "operator_disabled",
    );
    f.fake.operator = "enabled";
    assert.equal(
      await fakeOutbound(f, p, { breakDatabase: true }),
      "control_unknown",
    );
    assert.equal(f.fake.calls, 0);
    const original = (await f.admin.query("select * from system_state"))
      .rows[0];
    await f.admin.query("delete from system_state");
    assert.equal(await fakeOutbound(f, p), "control_unknown");
    await assert.rejects(() => jobCommand(f));
    await f.admin.query(
      "insert into system_state(singleton,restore_epoch,side_effects_enabled,money_frozen) values(true,$1,$2,$3)",
      [
        original.restore_epoch,
        original.side_effects_enabled,
        original.money_frozen,
      ],
    );
    const changed = await jobCommand(f, {
      target: response.record.id,
      version: 1,
      input: { action: "edit", value: "beta" },
    });
    assert.equal(await fakeOutbound(f, p), "obsolete_state");
    const fresh = await jobPayload(f, changed);
    assert.equal(await fakeOutbound(f, fresh), "applied");
    assert.equal(f.fake.calls, 1);
    assert.equal(await fakeOutbound(f, fresh), "obsolete_state");
    assert.equal(f.fake.calls, 1);
    const revokePayload = await jobPayload(f, await jobCommand(f));
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.a.user],
    );
    assert.equal(await fakeOutbound(f, revokePayload), "authority_revoked");
    assert.equal(f.fake.calls, 1);
    await assertIsolationCatalog(f.runtime.db);
  });
}, 120000);

test("0.3.2b E8 operational recovery commands and manual pause/resume interface use the same real guards", async () => {
  await withRestoreFixture(async (f) => {
    const inspection = createRestoreInspection(f);
    try {
      for (const command of [
        "guard-queue",
        "database-enable",
        "operator-disable",
        "restore",
        "restart",
        "quarantine",
        "redrive",
        "attempt-release",
        "finance-confirmation",
        "finance-allocation",
        "finance-reversal",
        "finance-refund",
        "auth-probe",
        "reconcile",
        "pause-finance",
        "freeze-queued",
        "guard-status",
        "resume",
        "finance-refund",
        "reconcile",
        "database-enable",
        "guard-queue",
        "fake-enable",
        "pause-effect",
        "restore-queued",
        "guard-status",
        "resume",
        "redrive",
        "operator-disable",
      ])
        await inspection.action(command);
      const state = await inspection.action("guard-status");
      assert.equal(state.operator, "disabled");
      assert.equal(state.state.frozen, true);
      assert.equal(state.state.outbound, false);
      assert.equal(state.fakeCalls, 1);
      assert.equal(state.quarantine.length, 2);
    } finally {
      await inspection.cleanup();
    }
  });
}, 120000);

test("0.3.2b E2/E6 TRU-01/06/10 AC-56 durable epoch quarantine survives restart, redrive, tampering and unauthorized release", async () => {
  await withRestoreFixture(async (f) => {
    await f.control("enable");
    const key = randomUUID();
    const response = await jobCommand(f, { key }),
      p = await jobPayload(f, response);
    const before = (await f.control()).state.epoch;
    const after = await f.control("restore");
    assert.deepEqual(await jobCommand(f, { key }), response);
    assert.equal((await jobCounts(f)).requests, 1);
    assert.notEqual(after.state.epoch, before);
    assert.deepEqual(
      { outbound: after.state.outbound, frozen: after.state.frozen },
      { outbound: false, frozen: true },
    );
    assert.equal(await consumeOne(f), "quarantined");
    const q = await quarantineJob(f, p);
    assert.equal(q.request_epoch, before);
    assert.equal(q.observed_epoch, after.state.epoch);
    assert.equal(q.reason, "old_epoch");
    assert.equal(
      (
        await f.admin.query("select state,output from pgboss.job where id=$1", [
          p.requestId,
        ])
      ).rows[0].state,
      "retry",
    );
    await f.boss.stop();
    const restarted = await startSyntheticQueue(f.parallel.db);
    try {
      await f.control("enable"); // Restored old enabled value cannot defeat operator.
      assert.equal(await handleSyntheticJob(f.parallel.db, p), "quarantined");
      assert.equal(await fakeOutbound(f, p), "quarantined");
      assert.equal(
        await fakeOutbound(f, { ...p, epoch: after.state.epoch }),
        "obsolete_state",
      );
      assert.equal(f.fake.calls, 0);
      await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) => {
        assert.equal(await restoreRepository(tx, f.b.shop).practice(), false);
        assert.equal(
          await restoreRepository(tx, f.a.shop).practice(),
          undefined,
        );
      });
      const next = await jobCommand(f),
        missing = { ...(await jobPayload(f, next)) };
      delete missing.epoch;
      assert.equal((await quarantineJob(f, missing)).reason, "missing_epoch");
      const repaired = await jobPayload(f, next);
      assert.equal(
        await handleSyntheticJob(f.parallel.db, repaired),
        "quarantined",
      );
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) => {
            assert.equal(
              (await tx.execute(sql`select * from synthetic_job_quarantine`))
                .rowCount,
              0,
            );
            await tx.execute(
              sql`insert into synthetic_job_quarantine(shop_id,request_id,request_epoch,observed_epoch,reason) values(${f.b.shop}::uuid,${p.requestId}::uuid,${before}::uuid,${after.state.epoch}::uuid,'old_epoch')`,
            );
          }),
        (error) => error.cause?.code === "42501",
      );
      await assert.rejects(() =>
        f.runtime.db.execute(sql`update system_state set money_frozen=false`),
      );
      await assert.rejects(() =>
        f.runtime.db.execute(
          sql`select transition_restore_control(${after.state.epoch}::uuid,'reconcile')`,
        ),
      );
      const untrusted = await f.jobsApi.fetch(
        new Request(`http://127.0.0.1:3103/operator/restore`, {
          method: "POST",
          body: "{}",
        }),
      );
      assert.equal(untrusted.status, 404);
      const client = await f.runtime.pool.connect();
      try {
        await assert.rejects(
          () => restoreControl(client, "reconcile", after.state.epoch),
          /OPERATOR_AUTHORITY_DENIED/,
        );
      } finally {
        client.release();
      }
      await assert.rejects(() => f.control("restore", before));
      await assert.rejects(() => f.control("release"));
      await assert.rejects(() =>
        f.runtime.db.execute(sql`delete from synthetic_job_quarantine`),
      );
      await assert.rejects(() =>
        f.operator.query("update system_control_event set action='reconcile'"),
      );
      await assert.rejects(() =>
        f.operator.query("delete from synthetic_job_quarantine"),
      );
      await assert.rejects(() =>
        f.runtime.db.execute(sql`set role app_restore_operator`),
      );
      await assertIsolationCatalog(f.runtime.db);
      for (const [drift, repair] of [
        [
          "grant update(money_frozen) on system_state to app_user",
          "revoke update(money_frozen) on system_state from app_user",
        ],
        [
          "grant select(operator_login) on system_control_event to app_user",
          "revoke select(operator_login) on system_control_event from app_user",
        ],
        [
          "grant execute on function transition_restore_control(uuid,text) to public",
          "revoke execute on function transition_restore_control(uuid,text) from public",
        ],
      ]) {
        await f.admin.query(drift);
        try {
          await assert.rejects(
            () => assertIsolationCatalog(f.runtime.db),
            /Restore control authority drift/,
          );
        } finally {
          await f.admin.query(repair);
        }
      }
      await f.admin.query("grant app_restore_operator to app_user");
      try {
        await assert.rejects(
          () => requireRuntimeRole(f.runtime.db),
          /Runtime database role denied/,
        );
      } finally {
        await f.admin.query("revoke app_restore_operator from app_user");
      }
      const history = (await f.control()).history;
      assert(
        history.some(
          (e) =>
            e.action === "restore" &&
            e.operator_login === "synthetic_restore_operator",
        ),
      );
      assert.equal((await jobCounts(f)).effects, 0);
    } finally {
      await restarted.stop();
    }
  });
}, 120000);

test("0.3.2b E4/E5 TRU-12 AC-56 four frozen mutation kinds, reads, replay, rollback and deterministic commit/freeze ordering", async () => {
  await withRestoreFixture(async (f) => {
    const actions = ["confirmation", "allocation", "reversal", "refund"];
    for (const action of actions)
      await assert.rejects(
        () => syntheticFinancial(f, action),
        /FINANCIAL_MUTATION_FROZEN/,
      );
    assert.equal((await jobCounts(f)).records, 0);
    await f.control("reconcile");
    const key = randomUUID(),
      first = await syntheticFinancial(f, "confirmation", { key });
    assert.deepEqual(
      await syntheticFinancial(f, "confirmation", { key }),
      first,
    );
    await assert.rejects(
      () => syntheticFinancial(f, "refund", { key }),
      (e) => e.status === 422,
    );
    const entered = barrier(),
      release = barrier();
    const pending = syntheticFinancial(f, "allocation", {
      checkpoint: async () => {
        entered.resolve();
        await release.promise;
      },
    });
    await Promise.race([entered.promise, pending]);
    const operator = await f.operator.connect();
    try {
      const pid = (await operator.query("select pg_backend_pid() as pid"))
        .rows[0].pid;
      const frozen = restoreControl(
        operator,
        "freeze",
        (await f.control()).state.epoch,
      );
      try {
        await waiting(f, pid);
      } finally {
        release.resolve();
      }
      await pending;
      assert.equal((await frozen).state.frozen, true);
    } finally {
      operator.release();
      release.resolve();
    }
    for (const action of actions)
      await assert.rejects(
        () => syntheticFinancial(f, action),
        /FINANCIAL_MUTATION_FROZEN/,
      );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) =>
      assert.equal(
        (await tx.execute(sql`select * from synthetic_record`)).rowCount,
        2,
      ),
    );
    await f.control("reconcile");
    const before = await jobCounts(f);
    await assert.rejects(() =>
      syntheticFinancial(f, "reversal", {
        checkpoint: async () => {
          throw Error("synthetic rollback");
        },
      }),
    );
    assert.deepEqual(await jobCounts(f), before);
    for (const action of ["reversal", "refund"])
      await syntheticFinancial(f, action);
    await f.admin.query("update shop set is_practice=true where shop_id=$1", [
      f.a.shop,
    ]);
    await assert.rejects(
      () => syntheticFinancial(f, "refund"),
      /FINANCIAL_MUTATION_FROZEN/,
    );
  });
}, 120000);

test("0.3.2b E5/E3 AC-56 active fake effect commits before epoch transition; queued waiter sees completed freeze/epoch", async () => {
  await withRestoreFixture(async (f) => {
    await f.control("enable");
    f.fake.operator = "enabled";
    const response = await jobCommand(f),
      p = await jobPayload(f, response),
      entered = barrier(),
      release = barrier();
    const pending = fakeOutbound(f, p, {
      checkpoint: async () => {
        entered.resolve();
        await release.promise;
      },
    });
    await Promise.race([entered.promise, pending]);
    const op = await f.operator.connect();
    try {
      const pid = (await op.query("select pg_backend_pid() as pid")).rows[0]
        .pid;
      const transition = restoreControl(
        op,
        "restore",
        (await f.control()).state.epoch,
      );
      try {
        await waiting(f, pid);
      } finally {
        release.resolve();
      }
      assert.equal(await pending, "applied");
      await transition;
      assert.equal(f.fake.calls, 1);
      assert.equal(await fakeOutbound(f, p), "quarantined");
      assert.equal(f.fake.calls, 1);
      // Reverse ordering: exclusive operator barrier first; new money waits,
      // then reads a fresh snapshot and denies after the freeze commits.
      await f.control("reconcile");
      await op.query("begin;select pg_advisory_xact_lock(120036)");
      const transitionEpoch = (
        await op.query("select restore_epoch from system_state")
      ).rows[0].restore_epoch;
      const money = syntheticFinancial(f, "refund");
      // Observe the real shared-lock waiter, not a timing-only assumption.
      let blocked = false;
      for (let i = 0; i < 100; i++) {
        const rows = await f.admin.query(
          "select pid from pg_stat_activity where usename='app_user' and wait_event='advisory'",
        );
        if (rows.rowCount) {
          blocked = true;
          break;
        }
        await delay(20);
      }
      assert(blocked);
      await op.query("select transition_restore_control($1,'freeze')", [
        transitionEpoch,
      ]);
      await op.query("commit");
      await assert.rejects(() => money, /FINANCIAL_MUTATION_FROZEN/);
    } finally {
      release.resolve();
      await op.query("rollback");
      op.release();
    }
  });
}, 120000);

test("0.3.2b E7/E8 TRU-10 AC-56 installation verification/reset delivery guards preserve private capture and queue contains no auth secrets", async () => {
  await withRestoreFixture(async (f) => {
    assert.equal(
      await prospectiveAuthDelivery(f.runtime.db, f.a.user, "reset"),
      "operator_disabled",
    );
    assert.equal(await fakeAuthDelivery(f, f.a.user), "operator_disabled");
    await f.control("enable");
    f.fake.operator = "enabled";
    assert.equal(await fakeAuthDelivery(f, f.a.user), "applied");
    assert.equal(f.fake.authCalls, 1);
    assert.equal(await fakeAuthDelivery(f, f.b.user), "authority_revoked");
    await f.admin.query("update shop set is_practice=true where shop_id=$1", [
      f.a.shop,
    ]);
    assert.equal(await fakeAuthDelivery(f, f.a.user), "practice");
    await f.admin.query("update shop set is_practice=false where shop_id=$1", [
      f.a.shop,
    ]);
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.a.user],
    );
    assert.equal(await fakeAuthDelivery(f, f.a.user), "authority_revoked");
    const pending = randomUUID();
    await f.admin.query(
      "insert into auth_user(id,name,email,email_verified,created_at,updated_at) values($1,'Synthetic Pending','pending@example.test',false,now(),now())",
      [pending],
    );
    // Drift/bootstrap fixture, deliberately before any shop membership.
    await f.admin.query("alter table owner_bootstrap disable trigger user");
    await f.admin.query(
      "update owner_bootstrap set user_id=$1,completed_at=null,shop_id=null",
      [pending],
    );
    await f.admin.query("alter table owner_bootstrap enable trigger user");
    assert.equal(
      (
        await f.admin.query("select 1 from shop_membership where user_id=$1", [
          pending,
        ])
      ).rowCount,
      0,
    );
    f.fake.operator = "disabled";
    assert.equal(
      await fakeAuthDelivery(f, pending, "verification"),
      "operator_disabled",
    );
    f.fake.operator = "enabled";
    assert.equal(await fakeAuthDelivery(f, pending, "verification"), "applied");
    assert.equal(
      await fakeAuthDelivery(f, pending, "reset"),
      "authority_revoked",
    );
    assert.equal(
      await fakeAuthDelivery(f, randomUUID(), "verification"),
      "authority_revoked",
    );
    await f.control("restore");
    assert.equal(
      await fakeAuthDelivery(f, pending, "verification"),
      "database_disabled",
    );
    const queued = await f.admin.query("select data,output from pgboss.job");
    assert.equal(queued.rowCount, 0);
    const history = JSON.stringify((await f.control()).history);
    assert(!history.includes("pending@example.test"));
    assert(!history.includes("token"));
    assert(!history.includes("code"));
  });
}, 120000);
