import { randomUUID } from "node:crypto";
import {
  emptyRate,
  type RateDraft,
  type RateRevision,
  rateCommandSchema,
  rateDraftSchema,
} from "@aarili/contracts/quotation-rates";
import { emptyPolicy, policyErrors } from "@aarili/contracts/shop-policies";
import { scheduleEntries, shopDate } from "@aarili/core/quotation-rates";
import fc from "fast-check";
import { expect, test } from "vitest";

function at<T>(values: readonly T[], index = 0): T {
  const v = values[index];
  if (v === undefined) throw Error("Fixture value missing");
  return v;
}
const date = "2026-10-24",
  next = "2026-10-25";
const valid = (): RateDraft => ({
  ...emptyRate(randomUUID()),
  source: { entryId: randomUUID(), revisionId: randomUUID() },
  component: "labour" as const,
  unit: "item" as const,
  basisText: "1",
  reason: "Synthetic exact review",
  entries: [
    { entryId: randomUUID(), from: date, until: "", rateText: "100.01" },
  ],
});
test("A1-01/02 Q-01 recoverable unknowns; strict exact units, precision and range boundaries", () => {
  expect(rateDraftSchema.safeParse(emptyRate(randomUUID())).success).toBe(true);
  expect(rateCommandSchema.safeParse(emptyRate(randomUUID())).success).toBe(
    false,
  );
  for (const raw of ["", "-1", "1e3", "1.001", "1,00", "NaN"]) {
    const v = valid();
    at(v.entries).rateText = raw;
    expect(rateCommandSchema.safeParse(v).success).toBe(false);
  }
  for (const basisText of ["0", "1.1", "2", "9007199254740992"])
    expect(rateCommandSchema.safeParse({ ...valid(), basisText }).success).toBe(
      false,
    );
  const v = valid();
  expect(scheduleEntries(v, undefined, date)[0]?.ratePaise).toBe(10001);
  expect(() => scheduleEntries(v, undefined, next)).toThrow();
  expect(shopDate(new Date("2026-10-23T18:30:00Z"))).toBe(date);
  v.entries.push({ ...at(v.entries), entryId: randomUUID(), from: next });
  expect(() => scheduleEntries(v, undefined, date)).toThrow();
  at(v.entries).until = next;
  expect(scheduleEntries(v, undefined, date)).toHaveLength(2);
  at(v.entries, 1).rateText = "90071992547410.00";
  expect(() => scheduleEntries(v, undefined, date)).toThrow();
});
test("A1-02/03 Q-01 preserve past rate periods while closing prospectively; reject moving/deleting/backdating history", () => {
  const v = valid(),
    prior = {
      entries: [
        {
          entryId: at(v.entries).entryId,
          from: date,
          until: null,
          ratePaise: 10001,
        },
      ],
    } as RateRevision;
  expect(scheduleEntries(v, prior, next)[0]?.from).toBe(date);
  for (const mutate of [
    (x: ReturnType<typeof valid>) => x.entries.splice(0, 1),
    (x: ReturnType<typeof valid>) => {
      at(x.entries).from = next;
    },
    (x: ReturnType<typeof valid>) => {
      at(x.entries).rateText = "0";
    },
  ]) {
    const d = valid();
    at(d.entries).entryId = at(prior.entries).entryId;
    mutate(d);
    expect(() => scheduleEntries(d, prior, next)).toThrow();
  }
  at(v.entries).until = next;
  v.entries.push({
    entryId: randomUUID(),
    from: next,
    until: "",
    rateText: "200",
  });
  expect(scheduleEntries(v, prior, next).map((e) => e.ratePaise)).toEqual([
    10001, 20000,
  ]);
});
test("A1-01/03 Q-01 property: exact paise rate round-trip retains every generated price, including zero", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      (amount) => {
        const v = valid(),
          n = BigInt(amount);
        at(v.entries).rateText =
          `${n / 100n}.${(n % 100n).toString().padStart(2, "0")}`;
        expect(scheduleEntries(v, undefined, date)[0]?.ratePaise).toBe(amount);
      },
    ),
    { seed: 173001, numRuns: 200 },
  );
});
test("A1-04 Q-07 existing owner-proposal publisher remains fixture-only", () => {
  const p = {
    ...emptyPolicy("quoteValidity"),
    state: "reviewed" as const,
    calendarDays: 1,
    terms: { en: "Proposal", ta: "வரைவு" },
    authority: { kind: "owner-proposal" as const, label: "Owner" },
  };
  expect(policyErrors(p)).toContain("authorityGate");
});

test("A1-02 Q-01 leap/year dates and future gaps preserve exact end-exclusive periods", () => {
  const v = valid();
  v.entries = [
    {
      entryId: randomUUID(),
      from: "2028-02-29",
      until: "2028-03-01",
      rateText: "0",
    },
    {
      entryId: randomUUID(),
      from: "2028-12-31",
      until: "2029-01-01",
      rateText: "99.99",
    },
  ];
  expect(rateCommandSchema.safeParse(v).success).toBe(true);
  expect(scheduleEntries(v, undefined, date).map((e) => e.ratePaise)).toEqual([
    0, 9999,
  ]);
  at(v.entries).from = "2027-02-29";
  expect(rateCommandSchema.safeParse(v).success).toBe(false);
});
