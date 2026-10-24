import { randomUUID } from "node:crypto";
import {
  customerQuotationSchema,
  emptyQuotation,
  type QuotationFact,
  type QuotationPrivate,
  type QuotationSource,
  quotationDraftSchema,
} from "@aarili/contracts/booking-quotations";
import { calculateQuotation } from "@aarili/core/booking-quotations";
import fc from "fast-check";
import { expect, test } from "vitest";

const oid = randomUUID(),
  pid = randomUUID();
const fact = (
  key: string,
  amount: number | null,
  sequence = 0,
): QuotationFact => ({
  key,
  sequence,
  orderId: oid,
  pieceId: null,
  labelEn: "Same label",
  labelTa: "ஒரே பெயர்",
  role: "charge",
  parentKey: null,
  grossPaise: amount,
  acceptedPaise: amount,
  estimateRevisionId: null,
  serviceLineId: null,
  additionLineId: null,
  sourceId: null,
  reason: "",
});
const privateCosts = (): QuotationPrivate => ({
  estimates: [],
  shared: { amountPaise: null, reason: "" },
  allocations: [],
  unattributedPaise: 0,
  unknownCount: 0,
  actualCost: "unavailable",
});
function setup(lines: QuotationFact[]) {
  const v = emptyQuotation(randomUUID());
  v.orderIds = [oid];
  v.reason = "SYNTHETIC owner review";
  const s: QuotationSource = {
    bookingId: null,
    bookingRevisionId: null,
    bookingVersion: null,
    commercialId: null,
    packagePaise: null,
    packageOrderIds: [],
    orders: [],
    estimates: [],
    estimateStale: false,
    current: [],
    facts: lines,
    fingerprint: "test",
    policy: {
      id: pid,
      kind: "discount",
      version: 1,
      previousId: null,
      originDraftId: randomUUID(),
      actorId: randomUUID(),
      recordedAt: new Date().toISOString(),
      sourceDraftId: randomUUID(),
      sourceDraftVersion: 1,
      sourceHash: "a".repeat(64),
      reason: "SYNTHETIC policy",
      authority: "synthetic-only",
      actionScope: "quotation-only",
      sourceCurrent: true,
      policy: {
        kind: "discount",
        state: "reviewed",
        terms: { en: "SYNTHETIC discount decisions", ta: "செயற்கை தள்ளுபடி" },
        reason: "SYNTHETIC",
        authority: { kind: "synthetic-fixture", label: "TEST" },
        maximumBps: 10000,
        approval: "owner",
      },
    },
  };
  v.discountDecision = {
    policyId: pid,
    eligibleKeys: lines
      .filter((l) => l.role === "charge" && (l.grossPaise ?? 0) > 0)
      .map((l) => l.key),
    stacking: true,
    manual: true,
    reason: "SYNTHETIC exact eligibility and stacking decision",
  };
  return { v, s };
}
test("B-01/02 one package replaces garment references; distinct same labels and extras remain distinct", () => {
  const p = fact("package:test", 180000, 0);
  p.orderId = null;
  const ref1 = {
    ...fact("garment-1", 100000, 1),
    role: "reference" as const,
    parentKey: p.key,
  };
  const ref2 = {
    ...fact("garment-2", 100000, 2),
    role: "reference" as const,
    parentKey: p.key,
  };
  const { v, s } = setup([p, ref1, ref2, fact("addition-1", 15000, 3)]),
    r = calculateQuotation(v, s, privateCosts());
  expect(r.blockers).toEqual([]);
  expect(r.customer.totalPaise).toBe(195000);
  expect(r.customer.lines).toHaveLength(4);
});
test("B-03 exact line then booking discounts, current authority and no silent fractional rounding", () => {
  const { v, s } = setup([fact("a", 100000), fact("b", 50000, 1)]);
  v.discounts = [
    {
      id: randomUUID(),
      target: "a",
      mode: "bps",
      valueText: "1000",
      reason: "SYNTHETIC",
    },
    {
      id: randomUUID(),
      target: null,
      mode: "fixed",
      valueText: "100",
      reason: "SYNTHETIC",
    },
  ];
  const r = calculateQuotation(v, s, privateCosts());
  expect(r.blockers).toEqual([]);
  expect(r.customer.grossPaise).toBe(150000);
  expect(r.customer.discountPaise).toBe(20000);
  expect(r.customer.totalPaise).toBe(130000);
  v.discountDecision.stacking = false;
  expect(calculateQuotation(v, s, privateCosts()).customer.complete).toBe(
    false,
  );
  v.discountDecision.stacking = true;
  if (s.policy) s.policy.sourceCurrent = false;
  expect(calculateQuotation(v, s, privateCosts()).customer.complete).toBe(
    false,
  );
  const tiny = setup([fact("a", 10001)]);
  tiny.v.discounts = [
    {
      id: randomUUID(),
      target: "a",
      mode: "bps",
      valueText: "125",
      reason: "SYNTHETIC",
    },
  ];
  expect(calculateQuotation(tiny.v, tiny.s, privateCosts()).blockers).toContain(
    "discount-arithmetic-authority-or-cap",
  );
});
test("B-04 FIN-05 retains rupees AND paise; tiny over-cap needs an explicit authorized exact manual set", () => {
  const { v, s } = setup([fact("a", 1), fact("b", 1, 1), fact("c", 1, 2)]);
  v.discounts = [
    {
      id: randomUUID(),
      target: null,
      mode: "fixed",
      valueText: "0.02",
      reason: "SYNTHETIC",
    },
  ];
  expect(calculateQuotation(v, s, privateCosts()).customer.complete).toBe(
    false,
  );
  v.manual = [
    { key: "a", amountText: "0.01" },
    { key: "b", amountText: "0.01" },
    { key: "c", amountText: "0" },
  ];
  v.manualReason = "SYNTHETIC explicit manual remainder";
  expect(calculateQuotation(v, s, privateCosts()).customer.totalPaise).toBe(1);
  if (v.manual[0]) v.manual[0].amountText = "0.02";
  expect(calculateQuotation(v, s, privateCosts()).customer.complete).toBe(
    false,
  );
  const normal = setup([
    fact("a", 100000),
    fact("b", 100000, 1),
    fact("c", 100000, 2),
  ]);
  normal.v.sharedCost = { amountText: "1000.01", reason: "SYNTHETIC private" };
  expect(
    calculateQuotation(
      normal.v,
      normal.s,
      privateCosts(),
    ).privateCosts.allocations.map((a) => a.amountPaise),
  ).toEqual([33401, 33300, 33300]);
});
test("B-02/04/05 unknowns, cycles, duplicate identities, zero bases and private provenance fail visibly", () => {
  const u = setup([fact("a", null), fact("b", 100, 1)]);
  expect(
    calculateQuotation(u.v, u.s, privateCosts()).customer.totalPaise,
  ).toBeNull();
  const zero = setup([fact("a", 0)]);
  zero.v.discounts = [
    {
      id: randomUUID(),
      target: null,
      mode: "fixed",
      valueText: "0.01",
      reason: "SYNTHETIC",
    },
  ];
  expect(
    calculateQuotation(zero.v, zero.s, privateCosts()).customer.complete,
  ).toBe(false);
  if (zero.v.discounts[0]) zero.v.discounts[0].valueText = "0";
  zero.v.sharedCost = {
    amountText: "25.01",
    reason: "SYNTHETIC real private labour",
  };
  const r = calculateQuotation(zero.v, zero.s, privateCosts());
  expect(r.customer.totalPaise).toBe(0);
  expect(r.privateCosts.unattributedPaise).toBe(2501);
  expect(r.privateCosts.allocations).toEqual([]);
  const dup = setup([fact("a", 100), fact("a", 100, 1)]);
  const aliases = quotationDraftSchema.parse({
    ...dup.v,
    orderIds: [oid, oid.toUpperCase()],
  });
  const incompleteSplit = quotationDraftSchema.parse({
    ...aliases,
    pieceSplits: [{ orderId: oid, pieceId: randomUUID(), amountText: "1." }],
  });
  expect(incompleteSplit.pieceSplits[0]?.amountText).toBe("1.");
  expect(aliases.orderIds).toEqual([oid, oid]);
  expect(calculateQuotation(aliases, dup.s, privateCosts()).blockers).toContain(
    "duplicate-scope",
  );
  expect(
    calculateQuotation(dup.v, dup.s, privateCosts()).customer.complete,
  ).toBe(false);
  const cycle = setup([
    { ...fact("a", 100), role: "reference", parentKey: "b" },
    { ...fact("b", 100, 1), role: "reference", parentKey: "a" },
  ]);
  expect(
    calculateQuotation(cycle.v, cycle.s, privateCosts()).blockers,
  ).toContain("inclusion-cycle");
  expect(
    customerQuotationSchema.safeParse({
      ...r.customer,
      privateCosts: r.privateCosts,
    }).success,
  ).toBe(false);
  expect(
    customerQuotationSchema.safeParse({
      ...r.customer,
      lines: [{ ...r.customer.lines[0], costPaise: 2501 }],
    }).success,
  ).toBe(false);
});
test("B-01/03/04/08 generated commercial graphs preserve stable FIN-05 sequence and exact reconciled customer totals", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 1, max: 1000000 }), {
        minLength: 1,
        maxLength: 12,
      }),
      fc.integer({ min: 0, max: 1000000 }),
      (prices, wanted) => {
        const { v, s } = setup(prices.map((p, i) => fact(`line-${i}`, p, i))),
          gross = prices.reduce((a, b) => a + b, 0),
          amount = Math.min(gross, wanted);
        v.discounts = [
          {
            id: randomUUID(),
            target: null,
            mode: "fixed",
            valueText: `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`,
            reason: "SYNTHETIC",
          },
        ];
        const before = JSON.stringify({ v, s }),
          r = calculateQuotation(v, s, privateCosts());
        expect(JSON.stringify({ v, s })).toBe(before);
        if (r.customer.complete) {
          expect(r.customer.totalPaise).toBe(gross - amount);
          expect(
            r.customer.lines.reduce((n, l) => n + l.bookingDiscountPaise, 0),
          ).toBe(amount);
          for (const l of r.customer.lines)
            expect(l.bookingDiscountPaise).toBeLessThanOrEqual(
              l.grossPaise ?? 0,
            );
        } else
          expect(r.blockers).toContain("discount-arithmetic-authority-or-cap");
      },
    ),
    { numRuns: 250, seed: 175001 },
  );
});
