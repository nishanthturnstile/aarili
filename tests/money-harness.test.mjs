import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";
import { validateMoneyHarness } from "../scripts/foundation-money.mjs";

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
