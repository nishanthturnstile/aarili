import { randomUUID } from "node:crypto";
import {
  designAnnotationSchema,
  designMediaSubjectCommandSchema,
  designReferenceDraftSchema,
} from "@aarili/contracts/design-references";
import {
  designSpecificationCommandSchema,
  designSpecificationMediaCommandSchema,
} from "@aarili/contracts/design-specifications";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const base = () => ({
  orderId: randomUUID(),
  pieceId: null,
  baseVersion: 0,
  baseSavedId: null,
  operation: "save",
  selectedId: null,
  profile: { entryId: randomUUID(), revisionId: randomUUID() },
  answers: [],
  reason: "SYNTHETIC source",
  use: false,
  reuse: null,
});
const reference = () => ({
  id: randomUUID(),
  assetId: randomUUID(),
  questionId: null,
  intent: "inspiration",
  caption: "SYNTHETIC source",
  annotations: [{ note: "SYNTHETIC plain note", anchor: { kind: "note" } }],
  replacesId: null,
  geometryReviewed: false,
});
describe("DS-B-01/02/03/04 bounded explicit reference contracts", () => {
  it("keeps A2 v1 strict and v2 a complete bounded exact child set", () => {
    const v = base();
    expect(designSpecificationCommandSchema.safeParse(v).success).toBe(true);
    expect(
      designSpecificationCommandSchema.safeParse({ ...v, referenceItems: [] })
        .success,
    ).toBe(false);
    expect(
      designSpecificationMediaCommandSchema.safeParse({
        ...v,
        referenceItems: [reference()],
      }).success,
    ).toBe(true);
    const r = reference();
    expect(
      designSpecificationMediaCommandSchema.safeParse({
        ...v,
        referenceItems: [r, r],
      }).success,
    ).toBe(false);
    expect(
      designSpecificationMediaCommandSchema.safeParse({
        ...v,
        referenceItems: Array.from({ length: 21 }, reference),
      }).success,
    ).toBe(false);
  });
  it("cannot submit signed URLs, object keys, uploader facts or customer approval", () => {
    for (const extra of [
      { url: "https://invalid.test/reference" },
      { key: "shops/private" },
      { uploaderId: randomUUID() },
      { uploadedAt: new Date().toISOString() },
      { approval: "approved" },
    ])
      expect(
        designReferenceDraftSchema.safeParse({ ...reference(), ...extra })
          .success,
      ).toBe(false);
  });
  it("keeps PDF/audio notes honest without trusted page or duration anchors", () => {
    for (const anchor of [
      { kind: "page", page: 1 },
      { kind: "audio", startMs: 0, endMs: 1000 },
    ])
      expect(
        designAnnotationSchema.safeParse({ note: "SYNTHETIC note", anchor })
          .success,
      ).toBe(false);
    expect(
      designAnnotationSchema.safeParse({
        note: "SYNTHETIC note",
        anchor: { kind: "note" },
      }).success,
    ).toBe(true);
  });
  it("requires evidence for a reusable library while private inspiration may retain unknown rights/date", () => {
    const v = {
      kind: "private",
      orderId: randomUUID(),
      pieceId: null,
      category: null,
      previousId: null,
      sourceKind: "customer-provided",
      sourceText: "SYNTHETIC",
      sourceDate: null,
      rightsBasis: "unknown",
      rightsEvidence: "",
      reason: "SYNTHETIC reason",
    };
    expect(designMediaSubjectCommandSchema.safeParse(v).success).toBe(true);
    const library = {
      ...v,
      kind: "library",
      orderId: null,
      category: { entryId: randomUUID(), revisionId: randomUUID() },
    };
    expect(designMediaSubjectCommandSchema.safeParse(library).success).toBe(
      false,
    );
    expect(
      designMediaSubjectCommandSchema.safeParse({
        ...library,
        sourceKind: "shop-created",
        rightsBasis: "shop-owned",
        rightsEvidence: "SYNTHETIC created by shop",
      }).success,
    ).toBe(true);
  });
  it("property: normalized rectangles stay entirely within the accepted display", () =>
    fc.assert(
      fc.property(
        fc.integer({ min: -1, max: 10001 }),
        fc.integer({ min: -1, max: 10001 }),
        fc.integer({ min: 0, max: 10001 }),
        fc.integer({ min: 0, max: 10001 }),
        (x, y, width, height) => {
          const accepted = designAnnotationSchema.safeParse({
            note: "SYNTHETIC note",
            anchor: { kind: "rectangle", x, y, width, height },
          }).success;
          expect(accepted).toBe(
            x >= 0 &&
              y >= 0 &&
              width > 0 &&
              height > 0 &&
              x + width <= 10000 &&
              y + height <= 10000,
          );
        },
      ),
    ));
});
