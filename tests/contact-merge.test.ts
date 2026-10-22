import { randomUUID } from "node:crypto";
import { contactMergeCommandSchema } from "@aarili/contracts/customer-history";
import { expect, test } from "vitest";

const input = () => ({
  sourceId: randomUUID(),
  survivorId: randomUUID(),
  mode: "merge",
  fingerprint: "a".repeat(64),
  fields: {
    displayName: "survivor",
    phone: "source",
    email: "survivor",
    aliases: "survivor",
    notes: "survivor",
  },
  orderIds: [],
  reason: "SYNTHETIC reviewed correction",
  confirmed: true,
});
test("RH-13 explicit merge requires every field source, reason and confirmation and forbids broad or wearer moves", () => {
  const v = input();
  expect(contactMergeCommandSchema.safeParse(v).success).toBe(true);
  for (const change of [
    { confirmed: false },
    { reason: " " },
    { moveEverything: true },
    { wearerId: randomUUID() },
    { fields: { displayName: "source" } },
    { fields: { ...v.fields, phone: "combine" } },
    { orderIds: Array.from({ length: 101 }, () => randomUUID()) },
  ])
    expect(
      contactMergeCommandSchema.safeParse({ ...v, ...change }).success,
    ).toBe(false);
});
