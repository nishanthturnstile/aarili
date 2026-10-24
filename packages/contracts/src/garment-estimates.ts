import { z } from "zod";
import { rateComponents } from "./quotation-rates.js";
import { localDateValid } from "./shop-calendar.js";

const id = z.uuid();
const text = z.string().max(2000);
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const estimateTargetSchema = z.strictObject({
  orderId: id.nullable(),
  pieceId: id.nullable(),
  customerId: id.nullable(),
  wearerId: id.nullable(),
});
export const estimateRateRefSchema = z.strictObject({
  rateId: id,
  revisionId: id,
  entryId: id,
});
export const estimateLineSchema = z.strictObject({
  id,
  subjectId: id,
  sourceKey: z.string().max(300).nullable(),
  labelEn: z.string().max(240),
  labelTa: z.string().max(240),
  component: z.enum([...rateComponents, "handling"]),
  material: z.enum(["none", "unknown", "shop", "customer"]),
  state: z.enum(["unknown", "charge", "included", "complimentary", "excluded"]),
  mode: z.enum(["fixed", "rate"]),
  quantityText: z.string().max(40),
  unit: z.enum(["item", "mm"]),
  basisText: z.string().max(40),
  rateText: z.string().max(40),
  fixedText: z.string().max(40),
  rate: estimateRateRefSchema.nullable(),
  rateId: id.nullable(),
  coveringLineId: id.nullable(),
  reason: text,
  assumptions: text,
});
export type EstimateLine = z.infer<typeof estimateLineSchema>;
export const estimatedCostDraftSchema = z.strictObject({
  lineId: id,
  amountText: z.string().max(40),
  reason: text,
});
export const estimateDraftSchema = z.strictObject({
  estimateId: id,
  baseVersion: z.number().int().min(0),
  baseRevisionId: id.nullable(),
  target: estimateTargetSchema,
  pricingDate: z.string().max(40),
  sourceFingerprint: z.string().max(64).nullable(),
  lines: z.array(estimateLineSchema).max(64),
  privateCosts: z.array(estimatedCostDraftSchema).max(64),
  reason: text,
  assumptions: text,
  review: z.string().max(64).nullable(),
});
export type EstimateDraft = z.infer<typeof estimateDraftSchema>;
export const estimateCommandSchema = estimateDraftSchema.superRefine((v, c) => {
  if (
    !localDateValid(v.pricingDate) ||
    !v.reason.trim() ||
    !v.lines.length ||
    !v.review ||
    (v.baseVersion === 0) !== (v.baseRevisionId === null) ||
    v.lines.some((l) => !l.labelEn.trim() || !l.labelTa.trim()) ||
    new Set(v.lines.map((l) => l.id)).size !== v.lines.length ||
    new Set(v.privateCosts.map((l) => l.lineId)).size !==
      v.privateCosts.length ||
    v.privateCosts.some((l) => !v.lines.some((x) => x.id === l.lineId))
  )
    c.addIssue({
      code: "custom",
      message: "Review the estimate identities, pricing date and reason",
    });
});
export const customerEstimateLineSchema = z.strictObject({
  id,
  sequence: z.number().int().positive(),
  subjectId: id,
  sourceKey: z.string().nullable(),
  labelEn: z.string(),
  labelTa: z.string(),
  component: estimateLineSchema.shape.component,
  material: estimateLineSchema.shape.material,
  state: estimateLineSchema.shape.state,
  quantity: amount.nullable(),
  unit: estimateLineSchema.shape.unit,
  basisQuantity: amount.nullable(),
  ratePaise: amount.nullable(),
  amountPaise: amount.nullable(),
  coveringLineId: id.nullable(),
  assumptions: z.string(),
  reason: z.string(),
  issues: z.array(z.string()),
});
export const customerEstimateSchema = z.strictObject({
  kind: z.literal("estimate-not-issued"),
  estimateId: id,
  pricingDate: z.string(),
  lines: z.array(customerEstimateLineSchema),
  knownSubtotalPaise: amount,
  unknownCount: z.number().int().min(0),
  complete: z.boolean(),
  totalPaise: amount.nullable(),
  assumptions: z.string(),
});
export type CustomerEstimate = z.infer<typeof customerEstimateSchema>;
export const estimateCostSchema = z.strictObject({
  lineId: id,
  amountPaise: amount.nullable(),
  reason: z.string(),
});
export const estimateSourceSchema = z.strictObject({
  fingerprint: z.string(),
  orderId: id.nullable(),
  pieceId: id.nullable(),
  customerId: id.nullable(),
  wearerId: id.nullable(),
  kind: z.enum(["draft", "custom", "service"]),
  code: z.string().nullable(),
  acceptedDigest: z.string().nullable(),
  aggregateVersion: z.number().int().nullable(),
  scopeDigest: z.string().nullable(),
  specificationId: id.nullable(),
  specificationVersion: z.number().int().nullable(),
  bookingId: id.nullable(),
  bookingVersion: z.number().int().nullable(),
  commercialId: id.nullable(),
  serviceSubjectId: id.nullable(),
  acceptedPaise: amount.nullable(),
  packageIncluded: z.boolean(),
  candidates: z.array(
    z.strictObject({
      key: z.string(),
      labelEn: z.string(),
      labelTa: z.string(),
      pieceId: id.nullable(),
      lineId: id.nullable(),
    }),
  ),
});
export type EstimateSource = z.infer<typeof estimateSourceSchema>;
export const estimateReviewSchema = z.strictObject({
  customer: customerEstimateSchema,
  source: estimateSourceSchema,
  costs: z.array(estimateCostSchema),
  costSubtotalPaise: amount,
  unknownCostCount: z.number().int(),
  estimatedMarginPaise: z
    .number()
    .int()
    .min(-Number.MAX_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  actualCost: z.literal("unavailable"),
  invalid: z.array(z.string()),
  blockers: z.array(z.string()),
  stale: z.boolean(),
  fingerprint: z.string(),
  suggested: estimateDraftSchema,
});
export type EstimateReview = z.infer<typeof estimateReviewSchema>;
export const estimateVersionSchema = z.strictObject({
  id,
  estimateId: id,
  version: z.number().int().positive(),
  previousId: id.nullable(),
  originDraftId: id,
  actorId: id,
  recordedAt: z.iso.datetime(),
  contentHash: z.string(),
  input: estimateDraftSchema,
  customer: customerEstimateSchema,
  source: estimateSourceSchema,
  costs: z.array(estimateCostSchema),
  costSubtotalPaise: amount,
  unknownCostCount: z.number().int(),
  estimatedMarginPaise: z
    .number()
    .int()
    .min(-Number.MAX_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  actualCost: z.literal("unavailable"),
  blockers: z.array(z.string()),
});
export type EstimateVersion = z.infer<typeof estimateVersionSchema>;
export const estimateQuerySchema = z.strictObject({
  estimateId: id,
  beforeVersion: z.number().int().positive().optional(),
});
export const estimateHistorySchema = z.strictObject({
  versions: z.array(estimateVersionSchema),
  next: z.number().int().nullable(),
});
export const estimateReadSchema = z.strictObject({
  version: estimateVersionSchema,
  sourceChanged: z.boolean(),
});
export function emptyEstimate(estimateId: string): EstimateDraft {
  return {
    estimateId,
    baseVersion: 0,
    baseRevisionId: null,
    target: { orderId: null, pieceId: null, customerId: null, wearerId: null },
    pricingDate: "",
    sourceFingerprint: null,
    lines: [],
    privateCosts: [],
    reason: "",
    assumptions: "",
    review: null,
  };
}
export function emptyEstimateLine(id: string, subjectId = id): EstimateLine {
  return {
    id,
    subjectId,
    sourceKey: null,
    labelEn: "",
    labelTa: "",
    component: "labour",
    material: "none",
    state: "unknown",
    mode: "fixed",
    quantityText: "",
    unit: "item",
    basisText: "1",
    rateText: "",
    fixedText: "",
    rateId: null,
    rate: null,
    coveringLineId: null,
    reason: "",
    assumptions: "",
  };
}
