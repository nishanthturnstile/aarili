import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyPayment,
  normalizeUpiReference,
  paymentCommandSchema,
  paymentDraftSchema,
} from "@aarili/contracts/payments";
import { validateJournal } from "@aarili/core/journal";
import { paymentJournalKey } from "@aarili/core/payments";
import { parseRupees } from "@aarili/money";
import fc from "fast-check";
import { test } from "vitest";

test("1.4.2a A1/A2 FIN-10/11 draft unknowns, real dates and deliberate cash/UPI attestations", () => {
  const blank = emptyPayment("2026-10-24");
  assert(paymentDraftSchema.safeParse(blank).success);
  assert(!paymentCommandSchema.safeParse(blank).success);
  const value = {
    ...blank,
    customerId: randomUUID(),
    payerId: randomUUID(),
    profileId: randomUUID(),
    amountText: "10.01",
  };
  assert(paymentCommandSchema.safeParse(value).success);
  assert(
    !paymentCommandSchema.safeParse({ ...value, paymentDate: "2026-02-30" })
      .success,
  );
  assert(
    paymentCommandSchema.safeParse({ ...value, paymentDate: "2028-02-29" })
      .success,
  );
  assert(
    !paymentCommandSchema.safeParse({ ...value, action: "cash-received" })
      .success,
  );
  assert(
    paymentCommandSchema.safeParse({
      ...value,
      action: "cash-received",
      attested: true,
      restoreEpoch: randomUUID(),
    }).success,
  );
  assert(
    !paymentCommandSchema.safeParse({
      ...value,
      method: "upi",
      action: "upi-seen",
      attested: true,
      restoreEpoch: randomUUID(),
    }).success,
  );
  assert(
    !paymentCommandSchema.safeParse({
      ...value,
      receiptId: randomUUID(),
      expectedVersion: 1,
      action: "correct",
    }).success,
  );
  for (const text of ["0", "-1", "1.001", "NaN", "90071992547409.92"]) {
    let value: number | null;
    try {
      value = parseRupees(text);
    } catch {
      continue;
    }
    assert.equal((value ?? 0) > 0, false);
  }
  assert.equal(parseRupees("0.01"), 1);
});
test("1.4.2a A3 FIN-12 AC-61 conservative UTR normalization retains case/interior characters and is idempotent", () => {
  assert.equal(normalizeUpiReference(" \tAb-c 12\r\n"), "Ab-c 12");
  assert.notEqual(normalizeUpiReference("Abc"), normalizeUpiReference("abc"));
  assert.equal(normalizeUpiReference(" \r\n"), null);
  fc.assert(
    fc.property(fc.string({ maxLength: 100 }), (s) => {
      const n = normalizeUpiReference(s);
      assert.equal(normalizeUpiReference(` \t${s}\r\n`), n);
      assert.equal(normalizeUpiReference(n ?? ""), n);
    }),
    { numRuns: 200 },
  );
});
test("1.4.2a A4/A5 FIN-13 electronic asset/deposit remains balanced with no revenue; nested key is stable and scoped", async () => {
  const subjectId = randomUUID(),
    sourceId = randomUUID();
  assert.deepEqual(
    validateJournal({
      subjectId,
      sourceId,
      kind: "posting",
      relatedId: null,
      reason: "Owner received UPI",
      entries: [
        { account: "electronic", amountPaise: 101 },
        { account: "deposit", amountPaise: -101 },
      ],
    }).entries,
    [
      { account: "deposit", amountPaise: -101 },
      { account: "electronic", amountPaise: 101 },
    ],
  );
  const shop = randomUUID(),
    receipt = randomUUID(),
    key = await paymentJournalKey(shop, receipt);
  assert.equal(key, await paymentJournalKey(shop, receipt));
  assert.notEqual(key, await paymentJournalKey(randomUUID(), receipt));
  assert.notEqual(key, receipt);
  assert.match(key, /^[a-f0-9-]{14}5[a-f0-9-]+$/);
});
