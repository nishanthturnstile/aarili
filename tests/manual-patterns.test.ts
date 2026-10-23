import {
  emptyPatternDraft,
  patternCapabilityCommandSchema,
  patternCommandSchema,
  patternDraftSchema,
} from "@aarili/contracts/manual-patterns";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const id = "019dd000-0000-7000-8000-000000000001";
const draft = () => {
  const d = emptyPatternDraft({ orderId: id, pieceId: null }, id, id);
  d.reason = "Imported physical reference";
  d.content.locator = "Cabinet B / folder 12";
  d.content.design = { state: "unknown", reason: "Not supplied" };
  d.content.measurement = { state: "unknown", reason: "Not supplied" };
  return d;
};
describe("PAT-01/03 MP-A01/02/03/04/06/07 separate incomplete drafts, exact references and non-release review", () => {
  it("keeps an incomplete fileless draft without manufacturing source or input provenance", () => {
    const d = emptyPatternDraft({ orderId: id, pieceId: null }, id, id);
    expect(patternDraftSchema.safeParse(d).success).toBe(true);
    expect(patternCommandSchema.safeParse(d).success).toBe(false);
    expect(patternCommandSchema.safeParse(draft()).success).toBe(true);
  });
  it("requires an exact ID for known provenance and a reason for unknown provenance", () => {
    const d = draft();
    d.content.design = { state: "known", versionId: null };
    expect(patternDraftSchema.safeParse(d).success).toBe(true);
    expect(patternCommandSchema.safeParse(d).success).toBe(false);
    d.content.design = { state: "unknown", reason: "" };
    expect(patternCommandSchema.safeParse(d).success).toBe(false);
  });
  it("does not accept an automation, file, scale-approval or cutting-release flag", () => {
    for (const extra of [
      { method: "automated" },
      { readyToCut: true },
      { scaleVerified: true },
      { assetId: id },
      { formula: "bust/4" },
    ])
      expect(
        patternCommandSchema.safeParse({ ...draft(), ...extra }).success,
      ).toBe(false);
  });
  it("requires explicit review acknowledgement/evidence on an exact reference", () => {
    const d = {
      ...draft(),
      operation: "review",
      referenceId: id,
      digest: "a".repeat(64),
      acknowledged: true,
      evidence: "Reference checked; scale remains unverified",
    };
    expect(patternCommandSchema.safeParse(d).success).toBe(true);
    expect(
      patternCommandSchema.safeParse({ ...d, acknowledged: false }).success,
    ).toBe(false);
    expect(patternCommandSchema.safeParse({ ...d, evidence: "" }).success).toBe(
      false,
    );
  });
  it("never treats an arbitrary physical locator as a numeric formula or normalized path", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }).filter((s) => !!s.trim()),
        (locator) => {
          const d = draft();
          d.content.locator = locator;
          const r = patternCommandSchema.parse(d);
          expect(r.content.locator).toBe(locator);
        },
      ),
    );
  });
  it("does not configure a supported path from orderability alone", () => {
    const c = {
      binding: { manifest: { entryId: id, revisionId: id }, pieceKey: null },
      baseVersion: 0,
      manual: "available",
      external: "not-recorded",
      reason: "Owner's supported manual method",
      reviewed: false,
    };
    expect(patternCapabilityCommandSchema.safeParse(c).success).toBe(false);
    expect(
      patternCapabilityCommandSchema.safeParse({ ...c, reviewed: true })
        .success,
    ).toBe(true);
  });
});
