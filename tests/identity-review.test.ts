import { randomUUID } from "node:crypto";
import { clearOwnerState } from "@aarili/api/client";
import { recordCustomerPair } from "@aarili/api/customer-history-client";
import { customerPairDecisionSchema } from "@aarili/contracts/customer-history";
import { customerCorrectionSchema } from "@aarili/contracts/customers";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  clearOwnerState();
  vi.unstubAllGlobals();
});
test.each([
  "PAIR_CHANGED",
  "CUSTOMER_POLICY_PENDING",
  "VERSION_EXHAUSTED",
  "DATABASE_UNAVAILABLE",
])("RH-13 pair response retains %s for explicit recovery", async (code) => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          error: { code, message: "Refresh review" },
        }),
        {
          status:
            code === "PAIR_CHANGED"
              ? 412
              : code === "DATABASE_UNAVAILABLE"
                ? 503
                : 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
  );
  await expect(
    recordCustomerPair(
      randomUUID(),
      {
        firstId: randomUUID(),
        secondId: randomUUID(),
        fingerprint: "a".repeat(64),
        decision: "keep-separate",
        reason: "SYNTHETIC distinct contacts",
      },
      randomUUID(),
      '"v1"',
    ),
  ).rejects.toMatchObject({ code });
});
test("RH-13 correction and pair decisions require reasons and exclude merge actions", () => {
  expect(
    customerCorrectionSchema.safeParse({
      displayName: "Synthetic",
      reason: "  ",
    }).success,
  ).toBe(false);
  expect(
    customerCorrectionSchema.safeParse({
      displayName: "Synthetic",
      reason: "SYNTHETIC correction",
    }).success,
  ).toBe(true);
  expect(
    customerPairDecisionSchema.safeParse({
      firstId: randomUUID(),
      secondId: randomUUID(),
      fingerprint: "a".repeat(64),
      decision: "merge",
      reason: "SYNTHETIC",
    }).success,
  ).toBe(false);
});
