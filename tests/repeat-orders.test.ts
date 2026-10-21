import {
  emptyQuickOrder,
  quickOrderDraftSchema,
  repeatIntake,
  repeatOrderDraftSchema,
} from "@aarili/contracts/orders";
import { initialRepeatOrder } from "@aarili/core/orders";
import fc from "fast-check";
import { expect, test } from "vitest";

const id = "019a02e0-0000-7000-8000-000000000001";
const ref = {
  sourceId: id,
  sourceVersion: 1,
  snapshotDigest: "a".repeat(64),
  scopeDigest: "b".repeat(64),
  reuseInstructions: false,
};
test("RH-02/03/04 every source price, promise, priority and review resets independently of instruction selection", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 2000 }),
      fc.boolean(),
      fc.integer({ min: 0, max: 10000000 }),
      (instructions, reuseInstructions, paise) => {
        const intake = {
          ...emptyQuickOrder(),
          customerId: id,
          wearerId: id,
          manifest: { entryId: id, revisionId: id, definitionId: id },
          instructions,
          deliveryDate: "2026-12-01",
          deliveryTime: "12:00",
          priority: "rush" as const,
          priceState: "quoted" as const,
          priceText: String(paise),
          occasion: "SYNTHETIC",
          eventDate: "2026-12-02",
        };
        const before = structuredClone(intake),
          selection = { ...ref, reuseInstructions },
          next = initialRepeatOrder({ intake }, selection);
        expect(next).toEqual({
          ...emptyQuickOrder(),
          customerId: id,
          wearerId: id,
          manifest: intake.manifest,
          instructions: reuseInstructions ? instructions : "",
          repeat: selection,
        });
        expect(intake).toEqual(before);
        expect(next.manifest).not.toBe(intake.manifest);
        expect(next.repeat).not.toBe(selection);
        expect(repeatOrderDraftSchema.safeParse(next).success).toBe(true);
        expect(quickOrderDraftSchema.safeParse(next).success).toBe(false);
        expect(repeatIntake(next)).toEqual({ ...next, repeat: undefined });
      },
    ),
  );
});
test("RH-06/14 repeat DTO rejects unknown scope, missing provenance, unsafe versions and forged legacy payloads", () => {
  const payload = initialRepeatOrder(
    { intake: { ...emptyQuickOrder(), customerId: id, wearerId: id } },
    ref,
  );
  for (const value of [
    { ...payload, repeat: undefined },
    { ...payload, repeat: { ...ref, sourceVersion: 0 } },
    { ...payload, repeat: { ...ref, snapshotDigest: "" } },
    { ...payload, repeat: { ...ref, sourceId: "other" } },
    { ...payload, repeat: { ...ref, selectedLines: [id] } },
    { ...payload, paymentPaise: 1 },
  ])
    expect(repeatOrderDraftSchema.safeParse(value).success).toBe(false);
});
