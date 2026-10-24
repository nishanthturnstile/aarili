import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { paymentsRepository } from "@aarili/db/payments-repository";
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

const read = (f, id) => request(f, "payments/read", { body: { id } }).then(ok);
const position = (f) =>
  request(f, "payments/position", {
    body: { customerId: f.customer.customerId },
  }).then(ok);
test("1.4.2a A4/A5 payment actor/action/payload key binding, practice denial and current membership on replay", {
  timeout: 180000,
}, async () => {
  await withPayments(async (f) => {
    const key = randomUUID(),
      d = await save(f, f.value, { key });
    const changed = await request(f, `drafts/${d.id}`, {
      method: "PUT",
      key,
      body: {
        workflow: "payment.receipt",
        schemaVersion: 1,
        payload: { ...f.value, amountText: "1.00" },
      },
    });
    assert.equal(changed.status, 422);
    assert.equal((await promote(f, d, { key })).status, 422);
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    assert.equal(
      (
        await request(f, `drafts/${d.id}`, {
          method: "PUT",
          who: f.b,
          shop: f.a.shop,
          key,
          body: {
            workflow: "payment.receipt",
            schemaVersion: 1,
            payload: f.value,
          },
        })
      ).status,
      422,
    );
    const pending = await publish(f, f.value),
      confirm = await transition(f, pending, "cash-received"),
      confirmKey = randomUUID();
    await f.admin.query("update shop set is_practice=true where shop_id=$1", [
      f.a.shop,
    ]);
    assert.equal((await promote(f, confirm, { key: confirmKey })).status, 409);
    await f.admin.query("update shop set is_practice=false where shop_id=$1", [
      f.a.shop,
    ]);
    await ok(await promote(f, confirm, { key: confirmKey }));
    assert.equal(
      (
        await request(f, `drafts/${confirm.id}/promote`, {
          who: f.b,
          shop: f.a.shop,
          key: confirmKey,
          etag: `"v${confirm.version}"`,
        })
      ).status,
      422,
    );
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.b.user],
    );
    assert.equal(
      (
        await request(f, `drafts/${confirm.id}/promote`, {
          who: f.b,
          shop: f.a.shop,
          key: confirmKey,
          etag: `"v${confirm.version}"`,
        })
      ).status,
      403,
    );
    await ok(await promote(f, confirm, { key: confirmKey }));
    assert.equal(
      (await f.admin.query("select count(*)::int n from journal_batch")).rows[0]
        .n,
      1,
    );
  });
});
test("1.4.2a A1/A2/A4/A5 FIN-10/11/13 AC-18 pending/cash, explicit receipt, correction, exact replay and immutable credit", {
  timeout: 180000,
}, async () => {
  await withPayments(async (f) => {
    const catalog = await assertIsolationCatalog(f.runtime.db);
    assert(catalog.includes("public.payment_event"));
    const r = await publish(f, f.value);
    assert.equal(r.current.status, "pending");
    assert.equal((await position(f)).confirmedPaise, "0");
    assert.equal((await position(f)).pendingPaise, "50001");
    const draft = await transition(f, r, "cash-received"),
      key = randomUUID();
    const response = await promote(f, draft, { key });
    const first = await ok(response); // discard a committed response, then replay original request
    assert.deepEqual(await ok(await promote(f, draft, { key })), first);
    const confirmed = await read(f, r.id);
    assert.equal(confirmed.current.status, "confirmed");
    assert.equal(confirmed.current.attestation, "cash-received");
    assert.equal((await position(f)).unallocatedPaise, "50001");
    assert.equal((await position(f)).pendingPaise, "0");
    const duplicate = await transition(f, r, "cash-received");
    await ok(await promote(f, duplicate));
    assert.equal((await read(f, duplicate.id)).id, r.id);
    assert.equal((await position(f)).unallocatedPaise, "50001");
    const history = await ok(
      await request(f, "payments/history", { body: { id: r.id } }),
    );
    assert.equal(history.events.length, 2);
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from journal_batch where source_id=$1",
          [r.id],
        )
      ).rows[0].n,
      1,
    );
    const j = (
      await f.admin.query(
        "select account,amount_paise::text from journal_entry where batch_id=$1 order by account",
        [confirmed.current.journalId],
      )
    ).rows;
    assert.deepEqual(j, [
      { account: "cash", amount_paise: "50001" },
      { account: "deposit", amount_paise: "-50001" },
    ]);
    const invalid = await transition(f, confirmed, "correct", {
      amountText: "9.00",
    });
    assert.equal((await promote(f, invalid)).status, 409);
    const pending = await publish(f, { ...f.value, amountText: "2.00" });
    const c = await transition(f, pending, "correct", { amountText: "3.01" });
    await ok(await promote(f, c));
    const corrected = await read(f, pending.id);
    assert.equal(corrected.current.amountPaise, 301);
    const failed = await transition(f, corrected, "fail");
    await ok(await promote(f, failed));
    assert.equal((await read(f, pending.id)).current.status, "failed");
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`update payment_event set amount_paise=1 where receipt_id=${r.id}::uuid`,
        ),
      ),
    );
    const noAttestation = await save(f, {
      ...f.value,
      action: "cash-received",
      attested: false,
    });
    assert.equal((await promote(f, noAttestation)).status, 422);
  });
});
test("1.4.2a A3/A4 FIN-12 AC-61 concurrent UTR claims across accounts/customers and different-key confirmations post once", {
  timeout: 180000,
}, async () => {
  await withPayments(async (f) => {
    const upi = {
      ...f.value,
      method: "upi",
      accountId: f.account.entryId,
      accountRevisionId: f.account.revisionId,
      reference: " UTR-SYNTHETIC ",
    };
    const a = await save(f, upi),
      b = await save(f, {
        ...upi,
        customerId: f.other.customerId,
        payerId: f.other.customerId,
        accountId: f.secondAccount.entryId,
        accountRevisionId: f.secondAccount.revisionId,
      });
    const raced = await Promise.all([promote(f, a), promote(f, b)]);
    assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
    const winner = raced[0].status === 200 ? a : b;
    const r = await read(f, winner.id);
    assert.equal(
      (
        await ok(
          await request(f, "payments/duplicate", {
            body: { customerId: r.customerId, reference: "UTR-SYNTHETIC" },
          }),
        )
      ).id,
      r.id,
    );
    assert.equal(
      (
        await request(f, "payments/duplicate", {
          body: {
            customerId:
              r.customerId === f.customer.customerId
                ? f.other.customerId
                : f.customer.customerId,
            reference: "UTR-SYNTHETIC",
          },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(f, "payments/duplicate", {
          who: f.b,
          body: { customerId: r.customerId, reference: "UTR-SYNTHETIC" },
        })
      ).status,
      404,
    );
    const c1 = await transition(f, r, "upi-seen"),
      c2 = await transition(f, r, "upi-seen");
    assert.deepEqual(
      (await Promise.all([promote(f, c1), promote(f, c2)])).map(
        (r) => r.status,
      ),
      [200, 200],
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from journal_batch where source_id=$1",
          [r.id],
        )
      ).rows[0].n,
      1,
    );
    const paid = await read(f, r.id);
    assert.equal(paid.current.method, "upi");
    assert.equal(paid.current.maskedIdentifier, "••••@invalid");
    assert.equal(
      (
        await f.admin.query(
          "select amount_paise::text a from journal_entry where batch_id=$1 and account='electronic'",
          [paid.current.journalId],
        )
      ).rows[0].a,
      "50001",
    );
    const f1 = await publish(f, {
      ...f.value,
      method: "upi",
      accountId: f.account.entryId,
      accountRevisionId: f.account.revisionId,
      reference: "RETAIN-FAILED",
    });
    const d = await transition(f, f1, "fail");
    await ok(await promote(f, d));
    const reuse = await save(f, { ...upi, reference: "RETAIN-FAILED" });
    assert.equal((await promote(f, reuse)).status, 409);
    await publish(f, { ...upi, reference: "" });
    await publish(f, { ...upi, reference: "" }); // same values without external identity remain legitimate
  });
});
test("1.4.2a A2/A4/A5/P-10 account deactivation, freeze/epoch, stale versions, app_user RLS, rollback and identity merge guard", {
  timeout: 240000,
}, async () => {
  await withPayments(async (f) => {
    const r = await publish(f, f.value),
      d = await transition(f, r, "cash-received");
    assert.equal((await promote(f, d, { etag: undefined })).status, 428);
    assert.equal((await promote(f, d, { etag: '"v8"' })).status, 412);
    await f.admin.query("update system_state set money_frozen=true");
    assert.equal((await promote(f, d)).status, 409);
    await f.admin.query(
      "update system_state set money_frozen=false,restore_epoch=uuidv7()",
    );
    assert.equal((await promote(f, d)).status, 409);
    const opts = await ok(await request(f, "payments/options"));
    const revised = await save(
      f,
      { ...d.payload, restoreEpoch: opts.restoreEpoch },
      { id: d.id, etag: '"v1"' },
    );
    const key = randomUUID();
    await ok(await promote(f, revised, { key }));
    await f.admin.query("update system_state set money_frozen=true");
    await ok(await promote(f, revised, { key })); // committed exact replay is read-only even frozen
    assert.equal(
      (await request(f, "payments/read", { who: f.b, body: { id: r.id } }))
        .status,
      404,
    );
    assert.equal(
      (await request(f, "payments/list", { who: f.b, shop: f.a.shop })).status,
      403,
    );
    assert.equal(
      (
        await request(f, "payments/position", {
          body: { customerId: f.foreignCustomer.customerId },
        })
      ).status,
      404,
    );
    assert.equal(
      (await request(f, "payments/read?reference=bad", { body: { id: r.id } }))
        .status,
      422,
    );
    assert.equal(
      (await request(f, "payments/list", { origin: "https://invalid.test" }))
        .status,
      403,
    );
    assert.equal(
      (
        await f.runtime.pool.query(
          "select count(*)::int n from payment_receipt",
        )
      ).rows[0].n,
      0,
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) =>
      assert.equal(
        (await paymentsRepository(tx, f.a.shop).read(r.id)).id,
        r.id,
      ),
    );
    assert.equal(
      (
        await f.runtime.pool.query(
          "select count(*)::int n from payment_receipt",
        )
      ).rows[0].n,
      0,
    );
    const upi = await publish(f, {
      ...f.value,
      method: "upi",
      accountId: f.account.entryId,
      accountRevisionId: f.account.revisionId,
    });
    const account = await ok(
      await request(f, `settings/directory/entries/${f.account.entryId}`, {
        method: "GET",
      }),
    );
    await f.publish("shop.directory", {
      entryId: f.account.entryId,
      baseVersion: account.revision.version,
      baseRevisionId: account.revision.id,
      content: { ...account.revision.content, active: false },
    });
    await f.admin.query("update system_state set money_frozen=false");
    const pendingConfirm = await transition(f, upi, "upi-seen", {
      restoreEpoch: opts.restoreEpoch,
    });
    assert.equal((await promote(f, pendingConfirm)).status, 409);
    const unchanged = (
      await f.admin.query("select count(*)::int n from journal_batch")
    ).rows[0].n;
    const cash = await save(f, {
      ...f.value,
      action: "cash-received",
      attested: true,
      restoreEpoch: opts.restoreEpoch,
    });
    await f.admin.query(
      "create function synthetic_payment_failure() returns trigger language plpgsql as $$begin raise exception 'injected';end$$; create trigger synthetic_payment_failure before insert on payment_result for each row execute function synthetic_payment_failure()",
    );
    assert.equal((await promote(f, cash)).status, 503);
    assert.equal(
      (await f.admin.query("select count(*)::int n from journal_batch")).rows[0]
        .n,
      unchanged,
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from payment_receipt where id=$1",
          [cash.id],
        )
      ).rows[0].n,
      0,
    );
    await f.admin.query(
      "drop trigger synthetic_payment_failure on payment_result; drop function synthetic_payment_failure()",
    );
    await ok(await promote(f, cash));
    const p = await request(f, "customer-history/merge-preview", {
      body: {
        sourceId: f.customer.customerId,
        survivorId: f.other.customerId,
        mode: "merge",
      },
    });
    const mergePreview = await ok(p);
    assert(mergePreview.blocked.includes("payment-association"));
  });
});
