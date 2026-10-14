import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";
import { validateMoneyHarness } from "../scripts/foundation-money.mjs";
import {
  allocationDemonstrations,
  inspectAllocation,
} from "../scripts/test-support/allocation.mjs";

test("0.3.1b B2–B6 FIN-05 AC-17/AC-49 operational fixtures reuse allocation for deposits, discounts and direct costs", () => {
  const cases = allocationDemonstrations();
  expect(cases).toHaveLength(21);
  expect([...new Set(cases.map((item) => item.purpose))]).toEqual([
    "deposit",
    "discount",
    "direct-cost",
  ]);
  expect(
    inspectAllocation("1000.01", ["c=700", "a=700", "b=700"]).formatted,
  ).toEqual([
    { lineId: "c", amount: "₹334.01" },
    { lineId: "a", amount: "₹333.00" },
    { lineId: "b", amount: "₹333.00" },
  ]);
  expect(inspectAllocation("1000.01", ["a=0", "b=0"]).unallocated).toBe(
    "₹1,000.01",
  );
  for (const [source, entries] of [
    ["", ["a=1"]],
    ["1", ["a="]],
    ["1", []],
    ["0.001", ["a=1"]],
    ["1", ["a=1=2"]],
    ["1", ["a=1", "a=2"]],
    ["90071992547409.92", ["a=1"]],
  ])
    expect(() => inspectAllocation(source, entries)).toThrow();
  // Failure does not poison later inspection (no retained allocation state).
  expect(inspectAllocation("1", ["a=1"]).allocations).toEqual([
    { lineId: "a", amountPaise: 100 },
  ]);
});

test("0.3.1a A5 synthetic harness refuses supplied/retained targets and production/outbound activation before Docker", () => {
  expect(validateMoneyHarness(["--demo"], {})).toBe("--demo");
  expect(
    validateMoneyHarness(["--interactive"], {
      NODE_ENV: "test",
      OUTBOUND_EFFECTS: "disabled",
    }),
  ).toBe("--interactive");
  for (const args of [
    [],
    ["--url", "postgres://synthetic"],
    ["--demo", "--url=postgres://synthetic"],
    ["--help"],
    ["--interactive", "--demo"],
  ])
    expect(() => validateMoneyHarness(args, {})).toThrow();
  for (const env of [
    { NODE_ENV: "production" },
    { DATABASE_URL: "postgres://synthetic" },
    { MIGRATION_DATABASE_URL: "postgres://synthetic" },
    { OUTBOUND_EFFECTS: "enabled" },
  ])
    expect(() => validateMoneyHarness(["--demo"], env)).toThrow();
});
test("0.3.1a A6 money remains framework/vendor-free and unavailable through browser imports", () => {
  for (const code of [
    'import "@aarili/db";',
    'import "hono";',
    'import "react";',
    'import "node:process";',
  ])
    expect(
      checkBoundaries(new Map([["packages/money/src/index.ts", code]])).length,
    ).toBeGreaterThan(0);
  expect(
    checkBoundaries(
      new Map([["apps/web/src/component.ts", 'import "@aarili/money";']]),
    ).length,
  ).toBeGreaterThan(0);
});
