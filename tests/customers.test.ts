import { randomUUID } from "node:crypto";
import { clearOwnerState, onOwnerInvalidation } from "@aarili/api/client";
import { searchCustomers } from "@aarili/api/customer-client";
import {
  customerContactSchema,
  customerCreateSchema,
  customerSearchSchema,
} from "@aarili/contracts/customers";
import {
  blockedCustomerPolicy,
  syntheticCustomerPolicy,
} from "@aarili/core/customer-policy";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  clearOwnerState();
  vi.unstubAllGlobals();
});
test("CW-01/08 strict minimal customer contract preserves optional contacts and explicit self grant", () => {
  expect(customerContactSchema.parse({ displayName: "  Synthetic  " })).toEqual(
    { displayName: "Synthetic", aliases: [] },
  );
  for (const displayName of ["", " ", "\t\n"])
    expect(customerContactSchema.safeParse({ displayName }).success).toBe(
      false,
    );
  const valid = {
    displayName: "Synthetic",
    serviceEvidence: {
      noticeId: syntheticCustomerPolicy.notice?.id,
      language: "ta",
      decision: "grant",
      giver: "self",
      noticeExplained: true,
      source: "in-person",
      occurredAt: new Date().toISOString(),
    },
  };
  expect(customerCreateSchema.safeParse(valid).success).toBe(true);
  for (const changed of [
    { giver: "owner" },
    { decision: "marketing" },
    { noticeExplained: false },
  ])
    expect(
      customerCreateSchema.safeParse({
        ...valid,
        serviceEvidence: { ...valid.serviceEvidence, ...changed },
      }).success,
    ).toBe(false);
  expect(
    customerCreateSchema.safeParse({ ...valid, approved: true }).success,
  ).toBe(false);
  expect(blockedCustomerPolicy).toEqual({
    enabled: false,
    synthetic: false,
    notice: null,
  });
});
test("CW-02 bounded search and name-only schemas accept varied original names without identity folding", () => {
  fc.assert(
    fc.property(
      fc
        .string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length > 0),
      (displayName) => {
        expect(customerContactSchema.parse({ displayName }).displayName).toBe(
          displayName.trim(),
        );
      },
    ),
  );
  expect(
    customerSearchSchema.safeParse({ query: "1234", limit: 51 }).success,
  ).toBe(false);
  expect(
    customerSearchSchema.safeParse({
      query: "",
      cursor: { rank: 1, id: randomUUID() },
    }).success,
  ).toBe(true);
});
test("CW-07/13 delayed denied customer body cannot clear a newer identity", async () => {
  let finish!: (value: unknown) => void;
  const body = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal("fetch", async () => ({
    ok: false,
    status: 403,
    json: () => body,
  }));
  const pending = searchCustomers(randomUUID(), { query: "" });
  const reject = expect(pending).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await Promise.resolve();
  clearOwnerState();
  const invalidated = vi.fn();
  const unsubscribe = onOwnerInvalidation(invalidated);
  finish({ error: { code: "SHOP_ACCESS_DENIED", message: "Denied" } });
  await reject;
  expect(invalidated).not.toHaveBeenCalled();
  unsubscribe();
});
