import { randomUUID } from "node:crypto";
import {
  customerEstimateSchema,
  emptyEstimate,
  emptyEstimateLine,
  estimateDraftSchema,
} from "@aarili/contracts/garment-estimates";
import { calculateEstimate } from "@aarili/core/garment-estimates";
import { formatEstimatePaise } from "@aarili/i18n";
import fc from "fast-check";
import { expect, test } from "vitest";

const value = () => {
  const v = emptyEstimate(randomUUID());
  v.pricingDate = "2026-10-24";
  v.lines = [
    {
      ...emptyEstimateLine(randomUUID()),
      labelEn: "SYNTHETIC blouse",
      labelTa: "செயற்கை ரவிக்கை",
      quantityText: "1",
      reason: "Synthetic reviewed fixed override",
      state: "charge",
    },
  ];
  return v;
};
test("A2-04 private estimated margin formatting retains negative sub-rupee paise", () => {
  expect(formatEstimatePaise(-1, "en")).toBe("−₹0.01");
  expect(formatEstimatePaise(-2501, "en")).toBe("−₹25.01");
});
function line(v: ReturnType<typeof value>) {
  const l = v.lines[0];
  if (!l) throw Error("Missing fixture");
  return l;
}
test("A2-01/02/05 Q-02/03 unknown/raw drafts remain recoverable; partial subtotal never becomes total", () => {
  const v = value();
  line(v).fixedText = "100.01";
  v.lines.push(emptyEstimateLine(randomUUID()));
  const r = calculateEstimate(v);
  expect(r.customer.knownSubtotalPaise).toBe(10001);
  expect(r.customer.totalPaise).toBe(null);
  expect(r.customer.unknownCount).toBe(1);
  line(v).fixedText = "not yet known";
  expect(estimateDraftSchema.safeParse(v).success).toBe(true);
  expect(calculateEstimate(v).invalid).not.toHaveLength(0);
});
test("A2-03/04 Q-04 customer material cannot be stock charged; complimentary retains independent known cost", () => {
  const v = value();
  line(v).state = "complimentary";
  v.privateCosts = [
    {
      lineId: line(v).id,
      amountText: "25.01",
      reason: "Synthetic worker estimate",
    },
  ];
  const r = calculateEstimate(v);
  expect(r.customer.totalPaise).toBe(0);
  expect(r.costs[0]?.amountPaise).toBe(2501);
  expect(r.estimatedMarginPaise).toBe(-2501);
  expect(r.actualCost).toBe("unavailable");
  for (const key of [
    "costs",
    "privateCosts",
    "estimatedMarginPaise",
    "actualCost",
    "productionNotes",
  ])
    expect(
      customerEstimateSchema.safeParse({ ...r.customer, [key]: 1 }).success,
    ).toBe(false);
  expect(
    customerEstimateSchema.safeParse({
      ...r.customer,
      lines: [{ ...r.customer.lines[0], costPaise: 1 }],
    }).success,
  ).toBe(false);
  Object.assign(line(v), {
    material: "customer",
    component: "fabric",
    state: "charge",
    fixedText: "1",
  });
  expect(calculateEstimate(v).invalid).not.toHaveLength(0);
  line(v).state = "excluded";
  expect(calculateEstimate(v).invalid).toHaveLength(0);
  expect(calculateEstimate(v).costs[0]?.amountPaise).toBe(2501);
});
test("A2-02/05 Q-03 exact integer mm/count products block fractional paise, overflow, invalid basis and precision", () => {
  const v = value();
  Object.assign(line(v), {
    mode: "rate",
    unit: "mm",
    quantityText: "2200",
    basisText: "1000",
    rateText: "100.00",
  });
  expect(calculateEstimate(v).customer.totalPaise).toBe(22000);
  for (const change of [
    { quantityText: "1", rateText: "0.01" },
    { quantityText: "2.2" },
    { basisText: "0" },
    { rateText: "1.001" },
    { rateText: "90071992547409.91", quantityText: "2000" },
  ])
    expect(
      calculateEstimate({ ...v, lines: [{ ...line(v), ...change }] }).invalid
        .length,
    ).toBeGreaterThan(0);
});
test("A2-02/05 Q-02 included charge refers to a real charge without double counting; duplicate native work is invalid", () => {
  const v = value();
  line(v).fixedText = "100";
  v.lines.push({
    ...emptyEstimateLine(randomUUID()),
    labelEn: "Included hooks",
    labelTa: "அடங்கிய கொக்கிகள்",
    state: "included",
    quantityText: "1",
    coveringLineId: line(v).id,
  });
  expect(calculateEstimate(v).customer.totalPaise).toBe(10000);
  const l = v.lines[1];
  if (!l) throw Error("Missing fixture");
  l.coveringLineId = l.id;
  expect(calculateEstimate(v).invalid.length).toBeGreaterThan(0);
  line(v).sourceKey = "garment";
  v.lines = [line(v), { ...line(v), id: randomUUID() }];
  expect(calculateEstimate(v).invalid).toContain("duplicate-source");
});
test("A2-05 Q-03 property: fixed exact selling prices and independent costs survive all safe generated paise values", () => {
  const decimal = (n: number) =>
    `${BigInt(n) / 100n}.${(BigInt(n) % 100n).toString().padStart(2, "0")}`;
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      (selling, cost) => {
        const v = value();
        line(v).fixedText = decimal(selling);
        v.privateCosts = [
          {
            lineId: line(v).id,
            amountText: decimal(cost),
            reason: "Synthetic cost",
          },
        ];
        const r = calculateEstimate(v);
        expect(r.customer.totalPaise).toBe(selling);
        expect(r.costSubtotalPaise).toBe(cost);
        expect(r.estimatedMarginPaise).toBe(selling - cost);
      },
    ),
    { seed: 174001, numRuns: 200 },
  );
});
