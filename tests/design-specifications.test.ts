import {
  designSpecificationCommandSchema,
  designSpecificationDraftSchema,
} from "@aarili/contracts/design-specifications";
import { validGarmentLength } from "@aarili/core/design-specifications";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const id = "00000000-0000-4000-8000-000000000001";
const draft = {
  orderId: id,
  pieceId: null,
  baseVersion: 0,
  baseSavedId: null,
  operation: "save",
  selectedId: null,
  profile: { entryId: id, revisionId: id },
  answers: [],
  reason: "SYNTHETIC review",
  use: false,
  reuse: null,
};
describe("DS-A2-01/04/05 exact design command contracts", () => {
  it("allows honest partial drafts but requires source/revision reason at publication", () => {
    expect(
      designSpecificationDraftSchema.safeParse({
        ...draft,
        profile: null,
        reason: "",
      }).success,
    ).toBe(true);
    expect(
      designSpecificationCommandSchema.safeParse({ ...draft, reason: "" })
        .success,
    ).toBe(false);
    expect(designSpecificationCommandSchema.safeParse(draft).success).toBe(
      true,
    );
  });
  it("rejects customer approval, media, body values and duplicate question identities", () => {
    for (const key of ["approval", "signature", "measurement", "references"])
      expect(
        designSpecificationCommandSchema.safeParse({ ...draft, [key]: id })
          .success,
      ).toBe(false);
    const a = {
      questionId: id,
      state: "unknown",
      choice: null,
      text: "",
      unit: null,
      intent: "unresolved",
      retainedReason: "",
    };
    expect(
      designSpecificationCommandSchema.safeParse({ ...draft, answers: [a, a] })
        .success,
    ).toBe(false);
    expect(
      designSpecificationCommandSchema.safeParse({
        ...draft,
        answers: [{ ...a, text: "Hidden instruction" }],
      }).success,
    ).toBe(false);
  });
  it("separates exact selection from version creation", () => {
    expect(
      designSpecificationCommandSchema.safeParse({
        ...draft,
        operation: "select",
        selectedId: id,
        use: true,
      }).success,
    ).toBe(true);
    expect(
      designSpecificationCommandSchema.safeParse({
        ...draft,
        operation: "select",
        selectedId: id,
        use: false,
      }).success,
    ).toBe(false);
    expect(
      designSpecificationCommandSchema.safeParse({ ...draft, selectedId: id })
        .success,
    ).toBe(false);
  });
  it("retains exact fractional intended garment dimensions without rounding", () => {
    expect(validGarmentLength("12 1/4", "0.25")).toBe(true);
    expect(validGarmentLength("12.2500", "0.25")).toBe(true);
    expect(validGarmentLength("12 3/8", "0.25")).toBe(false);
    for (const s of ["", "NaN", "-1", "1/0", "1e2", "12 inches", "<svg>"])
      expect(validGarmentLength(s, "0.25")).toBe(false);
  });
  it("DS-A2-01 property: only exact quarter increments are accepted", () =>
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), (n) => {
        expect(
          validGarmentLength(
            `${Math.floor(n / 4)}.${["00", "25", "50", "75"][n % 4]}`,
            "0.25",
          ),
        ).toBe(true);
        expect(validGarmentLength(`${n}.001`, "0.25")).toBe(false);
      }),
    ));
});
