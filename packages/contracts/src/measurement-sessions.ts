import { z } from "zod";
import { measurementFormsRevisionSchema } from "./measurement-forms.js";
import { catalogueRefSchema } from "./service-catalogue.js";

const id = z.uuid().transform((s) => s.toLowerCase());
const text = (n: number) => z.string().max(n);
export const measurementSourceSchema = z.strictObject({
  kind: z.enum([
    "unknown",
    "body",
    "sample-garment",
    "customer-provided",
    "other",
    "mixed",
  ]),
  date: z.union([z.literal(""), z.iso.date()]),
  measurer: text(160),
  method: text(1000),
});
export const measurementValueSchema = z.strictObject({
  fieldId: id,
  rawText: text(80),
  unit: z.enum(["in", "cm"]).nullable(),
  source: measurementSourceSchema.nullable(),
  warningReason: text(1000),
});
const ruleSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("minimum"),
    fieldId: id,
    value: text(80),
    unit: z.enum(["in", "cm"]),
    severity: z.enum(["error", "warning"]),
    review: text(1000),
  }),
  z.strictObject({
    kind: z.literal("maximum"),
    fieldId: id,
    value: text(80),
    unit: z.enum(["in", "cm"]),
    severity: z.enum(["error", "warning"]),
    review: text(1000),
  }),
  z.strictObject({
    kind: z.literal("field-lte"),
    fieldId: id,
    otherFieldId: id,
    severity: z.enum(["error", "warning"]),
    review: text(1000),
  }),
]);
export const measurementUsePolicySchema = z.strictObject({
  grammar: z.literal("ascii-exact-v1"),
  display: z.literal("exact"),
  fields: z
    .array(z.strictObject({ fieldId: id, allowZero: z.boolean().nullable() }))
    .max(1000),
  validation: z.discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("not-configured"), review: text(1000) }),
    z.strictObject({
      mode: z.literal("rules"),
      rules: z.array(ruleSchema).min(1).max(100),
      allowWarningReason: z.boolean(),
      review: text(1000),
    }),
  ]),
});
export const measurementUseDraftSchema = z.strictObject({
  form: catalogueRefSchema,
  baseId: id.nullable(),
  operation: z.enum(["approve", "withdraw"]),
  policy: measurementUsePolicySchema,
  reason: text(1000),
  reviewed: z.boolean(),
});
export const measurementUseCommandSchema =
  measurementUseDraftSchema.superRefine((v, c) => {
    if (
      !v.reviewed ||
      !v.reason.trim() ||
      !v.policy.validation.review.trim() ||
      v.policy.fields.some((f) => f.allowZero === null)
    )
      c.addIssue({
        code: "custom",
        message:
          "Review the exact form, precision, zero handling and validation policy",
      });
  });
export const measurementUseSchema = measurementUseDraftSchema.extend({
  id,
  actorId: id,
  recordedAt: z.iso.datetime(),
  authority: z.literal("synthetic-review"),
  originDraftId: id,
});
const measurementTargetSchema = z.strictObject({
  orderId: id,
  pieceId: id.nullable(),
});
export const measurementImpactSchema = z.strictObject({
  physical: z.enum(["unknown", "not-started"]),
  commercial: z.enum(["unknown", "none"]),
});
export const measurementReuseReviewSchema = z.strictObject({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  impact: measurementImpactSchema,
});
export const measurementSessionDraftSchema = z.strictObject({
  operation: z.enum(["save", "select"]),
  customerId: id,
  wearerId: id,
  form: catalogueRefSchema.nullable(),
  approvalId: id.nullable(),
  source: measurementSourceSchema,
  values: z.array(measurementValueSchema).max(1000),
  fitNotes: text(2000),
  selectedId: id.nullable(),
  target: measurementTargetSchema.nullable(),
  baseVersion: z.number().int().min(0).max(2147483646),
  reviewed: z.boolean(),
  reason: text(1000),
  erased: z.boolean(),
  correctionId: id.nullable().optional(),
  reuseReview: measurementReuseReviewSchema.nullable().optional(),
});
export type MeasurementSessionDraft = z.infer<
  typeof measurementSessionDraftSchema
>;
export type MeasurementUse = z.infer<typeof measurementUseSchema>;
export type MeasurementUseDraft = z.infer<typeof measurementUseDraftSchema>;
export const measurementSessionCommandSchema =
  measurementSessionDraftSchema.superRefine((v, c) => {
    const bad = () =>
      c.addIssue({
        code: "custom",
        message: "Review source, exact values and intended operation",
      });
    if (v.erased || !v.reviewed || !v.reason.trim()) bad();
    if (v.operation === "save") {
      if (
        !v.form ||
        !v.approvalId ||
        v.selectedId ||
        v.target ||
        v.baseVersion !== 0 ||
        v.source.kind === "unknown" ||
        !v.source.date ||
        !v.source.measurer.trim() ||
        !v.source.method.trim() ||
        v.reuseReview
      )
        bad();
    } else if (
      !v.selectedId ||
      !v.target ||
      v.form ||
      v.approvalId ||
      v.values.length ||
      v.fitNotes ||
      v.source.kind !== "unknown" ||
      v.source.date ||
      v.source.measurer ||
      v.source.method ||
      v.correctionId
    )
      bad();
    if (new Set(v.values.map((x) => x.fieldId)).size !== v.values.length) bad();
  });
const exactValueSchema = measurementValueSchema.extend({
  numeric: text(160).nullable(),
  exact: z
    .strictObject({
      numerator: z.string().regex(/^\d+$/),
      denominator: z.string().regex(/^[1-9]\d*$/),
    })
    .nullable(),
});
export const measurementVersionSchema = z.strictObject({
  id,
  customerId: id,
  wearerId: id,
  version: z.number().int().positive(),
  sessionId: id,
  previousId: id.nullable(),
  headId: id,
  actorId: id,
  recordedAt: z.iso.datetime(),
  originDraftId: id,
  form: measurementFormsRevisionSchema.shape.definition,
  approval: measurementUseSchema,
  source: measurementSourceSchema,
  values: z.array(exactValueSchema),
  fitNotes: text(2000),
  reason: text(1000),
  redacted: z.boolean(),
});
export type MeasurementVersion = z.infer<typeof measurementVersionSchema>;
export const measurementQuerySchema = z.strictObject({
  customerId: id,
  wearerId: id,
  before: id.optional(),
});
export const measurementStateSchema = z.strictObject({
  versions: z.array(measurementVersionSchema),
  next: id.nullable(),
  usedIds: z.array(id),
});
export const measurementTargetQuerySchema = measurementTargetSchema.extend({
  beforeVersion: z.number().int().positive().optional(),
});
export const measurementSelectionSchema = z.strictObject({
  ...measurementTargetSchema.shape,
  version: z.number().int().min(0),
  selectedId: id.nullable(),
  form: catalogueRefSchema.nullable(),
  nextHistory: z.number().int().positive().nullable(),
  history: z.array(
    z.strictObject({
      id,
      selectedId: id,
      version: z.number().int().positive(),
      actorId: id,
      recordedAt: z.iso.datetime(),
      reason: text(1000).nullable(),
    }),
  ),
});
export const measurementReviewQuerySchema = z.strictObject({
  selectedId: id,
  target: measurementTargetSchema,
  impact: measurementImpactSchema,
});
export type MeasurementSelection = z.infer<typeof measurementSelectionSchema>;
export const measurementUsageSchema = z.strictObject({
  orderId: id,
  pieceId: id.nullable(),
  code: text(120),
});
export const measurementReviewSchema = z.strictObject({
  version: measurementVersionSchema,
  target: measurementSelectionSchema,
  sources: z.array(measurementUsageSchema),
  sourceContextUnavailable: z.boolean(),
  asOfDate: z.iso.date().nullable(),
  ageDays: z.number().int().nullable(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  blocked: z.array(
    z.enum([
      "incompatible",
      "unavailable",
      "unsupported-impact",
      "already-selected",
    ]),
  ),
});
export const measurementUseQuerySchema = z.strictObject({
  form: catalogueRefSchema,
});
export const measurementUseStateSchema = z.strictObject({
  approval: measurementUseSchema.nullable(),
});
