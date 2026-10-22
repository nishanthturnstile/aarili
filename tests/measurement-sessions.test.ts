import type { MeasurementFormRevision } from "@aarili/contracts/measurement-forms";
import {
  type MeasurementSessionDraft,
  type MeasurementUseDraft,
  measurementSessionCommandSchema,
  measurementSessionDraftSchema,
  measurementUseCommandSchema,
} from "@aarili/contracts/measurement-sessions";
import { validateMeasurementValues } from "@aarili/core/measurement-sessions";
import { describe, expect, it } from "vitest";

const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const field = {
  id,
  key: "synthetic-length",
  meaning: "SYNTHETIC length",
  kind: "base-length" as const,
  labelEn: "SYNTHETIC length",
  labelTa: "செயற்கை நீளம்",
  illustration: null,
  hintEn: "",
  hintTa: "",
  units: ["in", "cm"] as ("in" | "cm")[],
  defaultUnit: null,
  required: true,
  precision: {
    unit: "in" as const,
    increment: "1/4",
    review: "SYNTHETIC precision, no production threshold",
  },
};
const definition: MeasurementFormRevision["definition"] = {
  id,
  entryId: id,
  authority: "synthetic-fixture",
  contentHash: "a".repeat(64),
  content: {
    kind: "measurement-form",
    code: "synthetic",
    labelEn: "SYNTHETIC",
    labelTa: "செயற்கை",
    description: "",
    aliases: [],
    service: { entryId: id, revisionId: id },
    piece: null,
    decision: "required",
    decisionReason: "",
    groups: [
      { id: other, labelEn: "SYNTHETIC", labelTa: "செயற்கை", fields: [field] },
    ],
  },
};
const policy: MeasurementUseDraft["policy"] = {
  grammar: "ascii-exact-v1",
  display: "exact",
  fields: [{ fieldId: id, allowZero: false }],
  validation: {
    mode: "not-configured",
    review: "SYNTHETIC explicit no plausibility rules",
  },
};
const draft: MeasurementSessionDraft = {
  operation: "save",
  customerId: id,
  wearerId: other,
  form: { entryId: id, revisionId: id },
  approvalId: id,
  source: {
    kind: "body",
    date: "2026-10-22",
    measurer: "SYNTHETIC provided by",
    method: "SYNTHETIC method",
  },
  values: [
    {
      fieldId: id,
      rawText: "12 1/4",
      unit: "in",
      source: null,
      warningReason: "",
    },
  ],
  fitNotes: "",
  reason: "SYNTHETIC reviewed",
  selectedId: null,
  target: null,
  baseVersion: 0,
  reviewed: true,
  erased: false,
};
describe("MV-A02/03/04/06 approved exact-value rules", () => {
  it("keeps partial or unsupported raw text in a draft without fabricating context", () => {
    const partial = {
      ...draft,
      source: { kind: "unknown", date: "", measurer: "", method: "" },
      values: [
        { ...draft.values[0], rawText: "unknown / ask wearer", unit: null },
      ],
    };
    expect(measurementSessionDraftSchema.safeParse(partial).success).toBe(true);
    expect(measurementSessionCommandSchema.safeParse(partial).success).toBe(
      false,
    );
    expect(
      measurementUseCommandSchema.safeParse({
        form: draft.form,
        baseId: null,
        operation: "approve",
        policy: { ...policy, fields: [{ fieldId: id, allowZero: null }] },
        reason: "review",
        reviewed: true,
      }).success,
    ).toBe(false);
  });
  it.each(["body", "sample-garment", "customer-provided", "other"] as const)(
    "preserves explicit %s source independently of actor",
    (kind) => {
      const result = validateMeasurementValues(
        { ...draft, source: { ...draft.source, kind } },
        definition,
        policy,
      );
      expect(result[0]).toMatchObject({
        rawText: "12 1/4",
        numeric: "12.25",
        exact: { numerator: "49", denominator: "4" },
      });
    },
  );
  it("uses each field's explicit source in a mixed session", () => {
    expect(() =>
      validateMeasurementValues(
        { ...draft, source: { ...draft.source, kind: "mixed" } },
        definition,
        policy,
      ),
    ).toThrow();
    const v = {
      ...draft,
      source: { ...draft.source, kind: "mixed" as const },
      values: [
        {
          ...draft.values[0],
          fieldId: id,
          rawText: "31.115",
          unit: "cm" as const,
          source: { ...draft.source, kind: "sample-garment" as const },
          warningReason: "",
        },
      ],
    };
    expect(validateMeasurementValues(v, definition, policy)[0]?.numeric).toBe(
      "31.115",
    );
  });
  it("distinguishes required blank, optional blank, zero and precision mismatch", () => {
    const blank = {
      ...draft,
      values: [
        {
          fieldId: id,
          rawText: "",
          unit: null,
          source: null,
          warningReason: "",
        },
      ],
    };
    expect(() =>
      validateMeasurementValues(blank, definition, policy),
    ).toThrow();
    const optional = {
      ...definition,
      content: {
        ...definition.content,
        groups: [
          {
            ...definition.content.groups[0],
            id: other,
            labelEn: "SYNTHETIC",
            labelTa: "செயற்கை",
            fields: [{ ...field, required: false }],
          },
        ],
      },
    };
    expect(
      validateMeasurementValues(blank, optional, policy)[0]?.numeric,
    ).toBeNull();
    for (const text of ["0", "12.26", "1/3", "-2", "1/0"])
      expect(() =>
        validateMeasurementValues(
          {
            ...draft,
            values: [
              {
                ...draft.values[0],
                fieldId: id,
                rawText: text,
                unit: "in",
                source: null,
                warningReason: "",
              },
            ],
          },
          definition,
          policy,
        ),
      ).toThrow();
    expect(
      validateMeasurementValues(
        {
          ...draft,
          values: [
            {
              fieldId: id,
              rawText: "0",
              unit: "in",
              source: null,
              warningReason: "",
            },
          ],
        },
        definition,
        { ...policy, fields: [{ fieldId: id, allowZero: true }] },
      )[0]?.numeric,
    ).toBe("0");
  });
  it("enforces only supplied finite synthetic thresholds and reasoned warning policy", () => {
    const rules: MeasurementUseDraft["policy"] = {
      ...policy,
      validation: {
        mode: "rules",
        review: "SYNTHETIC rule fixture",
        allowWarningReason: true,
        rules: [
          {
            kind: "maximum",
            fieldId: id,
            value: "12",
            unit: "in",
            severity: "warning",
            review: "SYNTHETIC rule only",
          },
        ],
      },
    };
    expect(() => validateMeasurementValues(draft, definition, rules)).toThrow();
    const reasoned = {
      ...draft,
      values: [
        {
          fieldId: id,
          rawText: "12 1/4",
          unit: "in" as const,
          source: null,
          warningReason: "SYNTHETIC checked original",
        },
      ],
    };
    expect(
      validateMeasurementValues(reasoned, definition, rules)[0]?.warningReason,
    ).toBe(reasoned.values[0]?.warningReason);
    expect(() =>
      validateMeasurementValues(reasoned, definition, {
        ...rules,
        validation: {
          ...rules.validation,
          mode: "rules",
          review: "SYNTHETIC",
          allowWarningReason: false,
          rules:
            rules.validation.mode === "rules" ? rules.validation.rules : [],
        },
      }),
    ).toThrow();
  });
});
