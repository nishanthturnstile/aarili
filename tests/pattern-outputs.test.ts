import {
  emptyPatternDraft,
  patternCommandSchema,
  patternReferenceV2CommandSchema,
  patternReferenceV2DraftSchema,
} from "@aarili/contracts/manual-patterns";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const id = "019dd000-0000-7000-8000-000000000001";
const value = () => {
  const v = {
    ...emptyPatternDraft({ orderId: id, pieceId: null }, id, id),
    assetId: id,
    reuse: null,
  };
  v.reason = "SYNTHETIC own output";
  v.content.design = { state: "unknown", reason: "Not supplied" };
  v.content.measurement = { state: "unknown", reason: "Not supplied" };
  return v;
};
describe("MP-B01/02/04/07 strict versioned physical/upload/reuse commands", () => {
  it("retains A's strict fileless contract and permits an incomplete V2 draft without accepting it", () => {
    expect(patternCommandSchema.safeParse(value()).success).toBe(false);
    expect(patternReferenceV2CommandSchema.safeParse(value()).success).toBe(
      true,
    );
    const v = { ...value(), assetId: null };
    expect(patternReferenceV2DraftSchema.safeParse(v).success).toBe(true);
    expect(patternReferenceV2CommandSchema.safeParse(v).success).toBe(false);
    v.content.locator = "Cabinet B / folder 12";
    expect(patternReferenceV2CommandSchema.safeParse(v).success).toBe(true);
  });
  it("requires distinct upload/source choice and explicit reuse evidence without scale or cutting flags", () => {
    const v = {
      ...value(),
      assetId: null,
      reuse: { referenceId: id, digest: "a".repeat(64) },
    };
    expect(patternReferenceV2CommandSchema.safeParse(v).success).toBe(false);
    const reviewed = {
      ...v,
      evidence: "Rights and fresh target inputs reviewed",
      acknowledged: true,
    };
    expect(patternReferenceV2CommandSchema.safeParse(reviewed).success).toBe(
      true,
    );
    for (const extra of [
      { assetId: id },
      { scaleVerified: true },
      { readyToCut: true },
      { formula: "bust/4" },
      { method: "automated" },
    ])
      expect(
        patternReferenceV2CommandSchema.safeParse({ ...reviewed, ...extra })
          .success,
      ).toBe(false);
  });
  it("preserves supplied assumptions as uninterpreted text and never calibrates a 1:1 claim", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 1000 }), (assumptions) => {
        const v = value();
        v.content.assumptions = assumptions;
        v.content.declaredScale = "Supplier says 1:1";
        const saved = patternReferenceV2CommandSchema.parse(v);
        expect(saved.content.assumptions).toBe(assumptions);
        expect(saved.content.declaredScale).toBe("Supplier says 1:1");
        expect(saved).not.toHaveProperty("scaleVerified");
      }),
    );
  });
});
