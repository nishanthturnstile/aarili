import { randomUUID } from "node:crypto";
import {
  emptyMeasurementFormContent,
  measurementFormsCommandSchema,
  measurementFormsDraftSchema,
} from "@aarili/contracts/measurement-forms";
import fc from "fast-check";
import { expect, test } from "vitest";

const draft = () => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition" as const,
  available: true,
  reason: "Synthetic reviewed fixture",
  content: {
    ...emptyMeasurementFormContent(),
    code: "blouse",
    labelEn: "Blouse",
    labelTa: "ரவிக்கை",
    service: { entryId: randomUUID(), revisionId: randomUUID() },
    decision: "required" as const,
    groups: [
      {
        id: randomUUID(),
        labelEn: "Body",
        labelTa: "உடல்",
        fields: [
          {
            id: randomUUID(),
            key: "length",
            meaning: "Shoulder to hem length",
            kind: "base-length" as const,
            illustration: null,
            labelEn: "Length",
            labelTa: "நீளம்",
            hintEn: "",
            hintTa: "",
            units: ["in" as const, "cm" as const],
            defaultUnit: "in" as const,
            required: true,
            precision: {
              unit: "in" as const,
              increment: "0.25",
              review: "Synthetic precision review",
            },
          },
        ],
      },
    ],
  },
});
test("ST-02 incomplete drafts preserve unknown choices; no default zero or required flag", () => {
  const d = { ...draft(), content: emptyMeasurementFormContent() };
  expect(measurementFormsDraftSchema.parse(d)).toEqual(d);
  expect(measurementFormsCommandSchema.safeParse(d).success).toBe(false);
  expect(d.content.groups).toEqual([]);
  expect(d.content.decision).toBe("unresolved");
});
test("ST-02 strict body-length definitions reject construction questions, values and formulas", () => {
  for (const extra of [
    { value: 0 },
    { formula: "waist / 4" },
    { kind: "construction" },
    { range: { min: 0, max: 100 } },
  ]) {
    const d = draft();
    Object.assign(d.content.groups[0]?.fields[0] ?? {}, extra);
    expect(measurementFormsDraftSchema.safeParse(d).success).toBe(false);
  }
});
test("ST-02 explicit precision has no inferred unit, invalid decimal or scientific notation", () => {
  for (const increment of [
    "",
    "0",
    "0.000000",
    "-0.25",
    "1e-2",
    "1/4",
    "0,25",
    "NaN",
  ]) {
    const d = draft();
    const f = d.content.groups[0]?.fields[0];
    if (!f) throw Error();
    f.precision.increment = increment;
    expect(measurementFormsCommandSchema.safeParse(d).success).toBe(false);
  }
  const d = draft();
  Object.assign(d.content.groups[0]?.fields[0] ?? {}, {
    precision: { unit: null, increment: "0.25", review: "review" },
  });
  expect(measurementFormsCommandSchema.safeParse(d).success).toBe(false);
});
test("ST-02/07 arbitrary bilingual label changes and order round-trip without losing stable field identity", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => s.trim().length > 0),
        { minLength: 1, maxLength: 12 },
      ),
      (labels) => {
        const d = draft(),
          g = d.content.groups[0];
        if (!g) throw Error();
        const first = g.fields[0];
        if (!first) throw Error();
        g.fields = labels.map((label, i) => ({
          ...first,
          id: randomUUID(),
          key: `length-${i}`,
          labelEn: label,
          labelTa: `நீளம் ${label}`,
        }));
        g.fields.reverse();
        const before = structuredClone(d);
        const parsed = measurementFormsCommandSchema.parse(d);
        expect(parsed).toEqual(before);
        expect(parsed.content.groups[0]?.fields.map((f) => f.id)).toEqual(
          g.fields.map((f) => f.id),
        );
      },
    ),
    { numRuns: 100 },
  );
});
test("ST-02 duplicate keys and identities, missing bilingual labels and conflicting unit choices are invalid", () => {
  for (const mutate of [
    (d: ReturnType<typeof draft>) => {
      const g = d.content.groups[0],
        f = g?.fields[0];
      if (!g || !f) throw Error();
      g.fields.push({ ...f, id: randomUUID() });
    },
    (d: ReturnType<typeof draft>) => {
      const g = d.content.groups[0];
      if (!g) throw Error();
      g.labelTa = "";
    },
    (d: ReturnType<typeof draft>) => {
      const f = d.content.groups[0]?.fields[0];
      if (!f) throw Error();
      Object.assign(f, { defaultUnit: "cm", units: ["in"] });
    },
  ]) {
    const d = draft();
    mutate(d);
    expect(measurementFormsCommandSchema.safeParse(d).success).toBe(false);
  }
});
