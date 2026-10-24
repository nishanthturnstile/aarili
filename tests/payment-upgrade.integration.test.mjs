import assert from "node:assert/strict";
import { sql, withShop } from "@aarili/db";
import { journalRepository } from "@aarili/db/journal-repository";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  journalCommand,
  linkedReversal,
  pair,
  positions,
  posting,
} from "../scripts/test-support/journal.mjs";
import {
  paymentOk as ok,
  paymentPublish as publish,
  paymentRequest as request,
  withPayments,
} from "../scripts/test-support/payment-fixtures.mjs";

test("1.4.2a A5 populated 0056 upgrade preserves old journal and never fabricates receipts; payment reversal remains gated", {
  timeout: 180000,
}, async () => {
  await withPayments(
    async (f) => {
      const old = await journalCommand(
        f,
        posting(f.customer.customerId, pair("cash", "deposit", 12345)),
      );
      const before = await positions(f, f.customer.customerId);
      assert.equal(
        (await f.admin.query("select to_regclass('payment_receipt') t")).rows[0]
          .t,
        null,
      );
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await positions(f, f.customer.customerId), {
        ...before,
        electronic: 0,
      });
      assert.deepEqual(
        (await ok(await request(f, "payments/list"))).receipts,
        [],
      );
      // Existing generic journal corrections still work for their original sources.
      await journalCommand(f, linkedReversal(old));
      const receipt = await publish(f, {
        ...f.value,
        action: "cash-received",
        attested: true,
      });
      const batch = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        journalRepository(tx, f.a.shop).read(receipt.current.journalId),
      );
      await assert.rejects(
        journalCommand(f, linkedReversal(batch)),
        (e) => e.code === "42501" || e.cause?.code === "42501",
      );
      const unchanged = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`select status from payment_event where receipt_id=${receipt.id}::uuid`,
        ),
      );
      assert.equal(unchanged.rows[0].status, "confirmed");
    },
    { migrationThrough: "0056_quotation_issues.sql" },
  );
});
