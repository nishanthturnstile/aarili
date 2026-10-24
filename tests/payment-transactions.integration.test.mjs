import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mutateDraft } from "@aarili/core/drafts";
import { paymentReceiptWorkflow } from "@aarili/core/payments";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { journalRepository } from "@aarili/db/journal-repository";
import { paymentsRepository } from "@aarili/db/payments-repository";
import { restoreRepository } from "@aarili/db/restore-repository";
import { shopDirectoryRepository } from "@aarili/db/shop-directory-repository";
import { shopProfileRepository } from "@aarili/db/shop-profile-repository";
import { test } from "vitest";
import {
  paymentOk as ok,
  paymentPromote as promote,
  paymentPublish as publish,
  paymentRequest as request,
  paymentSave as save,
  paymentTransition as transition,
  withPayments,
} from "../scripts/test-support/payment-fixtures.mjs";

const counts = async (f) =>
  (
    await f.admin.query(
      `select (select count(*) from payment_receipt)::text receipts,(select count(*) from payment_event)::text events,(select count(*) from payment_result)::text results,(select count(*) from journal_batch)::text batches,(select count(*) from journal_entry)::text entries,(select count(*) from idempotency_key)::text keys,(select count(*) from audit_event)::text audits`,
    )
  ).rows[0];
test("1.4.2a A4/P-10 rollback at every journal/payment/audit/key boundary and original-key recovery", {
  timeout: 240000,
}, async () => {
  await withPayments(async (f) => {
    for (const [table, predicate] of [
      ["audit_event", "NEW.action='journal.posting'"],
      ["journal_batch", "true"],
      ["journal_entry", "NEW.account='cash'"],
      ["journal_entry", "NEW.account='deposit'"],
      ["idempotency_key", "NEW.action='journal.posting'"],
      ["payment_receipt", "true"],
      ["payment_event", "true"],
      ["payment_result", "true"],
      ["idempotency_key", "NEW.action='draft.promote'"],
    ]) {
      const d = await save(f, {
          ...f.value,
          action: "cash-received",
          attested: true,
        }),
        key = randomUUID(),
        before = await counts(f);
      await f.admin.query(
        `create function payment_injected_failure() returns trigger language plpgsql as $$begin if ${predicate} then raise exception 'synthetic injected failure';end if;return NEW;end$$;create trigger payment_injected_failure before insert on ${table} for each row execute function payment_injected_failure()`,
      );
      try {
        assert.equal((await promote(f, d, { key })).status, 503, table);
        assert.deepEqual(await counts(f), before, table);
      } finally {
        await f.admin.query(
          `drop trigger payment_injected_failure on ${table};drop function payment_injected_failure()`,
        );
      }
      await ok(await promote(f, d, { key }));
      const after = await counts(f);
      assert.equal(BigInt(after.batches), BigInt(before.batches) + 1n);
    }
  });
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function context(f, tx) {
  return {
    shopId: f.a.shop,
    actorId: f.a.user,
    synthetic: true,
    repository: paymentsRepository(tx, f.a.shop),
    drafts: draftRepository(tx, f.a.shop),
    journal: journalRepository(tx, f.a.shop),
    restore: restoreRepository(tx, f.a.shop),
    directory: shopDirectoryRepository(tx, f.a.shop),
    profile: shopProfileRepository(tx, f.a.shop),
  };
}
async function blockedBy(f, pid, blocker) {
  for (let n = 0; n < 150; n++) {
    const row = (
      await f.admin.query("select pg_blocking_pids($1) as blockers", [pid])
    ).rows[0];
    if (row.blockers.includes(blocker)) return;
    await delay(10);
  }
  assert.fail("Expected real PostgreSQL lock barrier did not occur");
}
test("1.4.2a A5 AC-56 payment commit/freeze ordering and operator-first waiter rechecks newly committed freeze", {
  timeout: 180000,
}, async () => {
  await withPayments(async (f) => {
    const pending = await publish(f, f.value),
      draft = await transition(f, pending, "cash-received"),
      reached = deferred(),
      release = deferred();
    let writerPid;
    const writer = withShop(f.parallel.db, f.a.user, f.a.shop, async (tx) => {
      writerPid = Number(
        (await tx.execute(sql`select pg_backend_pid() as id`)).rows[0].id,
      );
      const ctx = context(f, tx),
        base = paymentReceiptWorkflow(ctx),
        flow = {
          ...base,
          async promote(...args) {
            const result = await base.promote(...args);
            reached.resolve();
            await release.promise;
            return result;
          },
        };
      return mutateDraft(
        {
          shopId: f.a.shop,
          actor: { type: "user", id: f.a.user },
          repository: ctx.drafts,
          workflows: new Map([["payment.receipt", flow]]),
        },
        draft.id,
        "promote",
        {},
        { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
      );
    });
    const operator = await f.admin.connect();
    try {
      await reached.promise;
      const pid = (await operator.query("select pg_backend_pid() as id"))
        .rows[0].id;
      await operator.query("begin");
      const freezing = operator
        .query("select pg_advisory_xact_lock(120036)")
        .then(async () => {
          await operator.query("update system_state set money_frozen=true");
          await operator.query("commit");
        });
      await blockedBy(f, pid, writerPid);
      release.resolve();
      await Promise.all([writer, freezing]);
      assert.equal(
        (
          await ok(
            await request(f, "payments/read", { body: { id: pending.id } }),
          )
        ).current.status,
        "confirmed",
      );
      assert.equal(
        (await f.admin.query("select money_frozen from system_state")).rows[0]
          .money_frozen,
        true,
      );
      await f.admin.query("update system_state set money_frozen=false");
      const second = await publish(f, f.value),
        d = await transition(f, second, "cash-received"),
        entered = deferred();
      let waitingPid;
      await operator.query("begin");
      await operator.query("select pg_advisory_xact_lock(120036)");
      await operator.query("update system_state set money_frozen=true");
      const waiting = withShop(
        f.parallel.db,
        f.a.user,
        f.a.shop,
        async (tx) => {
          waitingPid = Number(
            (await tx.execute(sql`select pg_backend_pid() as id`)).rows[0].id,
          );
          entered.resolve();
          const ctx = context(f, tx);
          return mutateDraft(
            {
              shopId: f.a.shop,
              actor: { type: "user", id: f.a.user },
              repository: ctx.drafts,
              workflows: new Map([
                ["payment.receipt", paymentReceiptWorkflow(ctx)],
              ]),
            },
            d.id,
            "promote",
            {},
            { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
          );
        },
      );
      const denial = assert.rejects(waiting, (e) => e.status === 409);
      await entered.promise;
      await blockedBy(f, waitingPid, pid);
      await operator.query("commit");
      await denial;
      assert.equal(
        (
          await ok(
            await request(f, "payments/read", { body: { id: second.id } }),
          )
        ).current.status,
        "pending",
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from journal_batch"))
          .rows[0].n,
        1,
      );
    } finally {
      release.resolve();
      await operator.query("rollback");
      operator.release();
      await writer;
    }
  });
});
