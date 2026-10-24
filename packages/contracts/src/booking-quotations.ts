import { z } from "zod";
import { estimateSourceSchema } from "./garment-estimates.js";
import { quotePolicyBindingSchema } from "./quotation-rates.js";

const id = z.uuid().transform((v) => v.toLowerCase());
const text = z.string().max(2000);
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const key = z.string().min(1).max(160);
const discount = z.strictObject({
  id,
  target: key.nullable(),
  mode: z.enum(["fixed", "bps"]),
  valueText: z.string().max(40),
  reason: text,
});
export const quotationDraftSchema = z.strictObject({
  familyId: id,
  baseVersion: z.number().int().min(0),
  baseRevisionId: id.nullable(),
  bookingId: id.nullable(),
  orderIds: z.array(id).max(20),
  estimates: z.array(z.strictObject({ orderId: id, revisionId: id })).max(20),
  sourceFingerprint: z.string().max(64).nullable(),
  selection: z.enum(["alternative", "current"]),
  predecessors: z.array(id).max(20),
  discounts: z.array(discount).max(65),
  discountDecision: z.strictObject({
    policyId: id.nullable(),
    eligibleKeys: z.array(key).max(256),
    stacking: z.boolean().nullable(),
    manual: z.boolean().nullable(),
    reason: text,
  }),
  manual: z
    .array(z.strictObject({ key, amountText: z.string().max(40) }))
    .max(256),
  manualReason: text,
  packageSplits: z
    .array(z.strictObject({ orderId: id, amountText: z.string().max(40) }))
    .max(20),
  pieceSplits: z
    .array(
      z.strictObject({
        orderId: id,
        pieceId: id,
        amountText: z.string().max(40),
      }),
    )
    .max(64),
  sharedCost: z.strictObject({ amountText: z.string().max(40), reason: text }),
  assumptions: text,
  reason: text,
  review: z.string().max(64).nullable(),
});
export type QuotationDraft = z.infer<typeof quotationDraftSchema>;
export const quotationCommandSchema = quotationDraftSchema.superRefine(
  (v, c) => {
    if (
      !v.orderIds.length ||
      !v.reason.trim() ||
      !v.review ||
      (v.baseVersion === 0) !== (v.baseRevisionId === null)
    )
      c.addIssue({
        code: "custom",
        message: "Review scope, predecessor and reason",
      });
  },
);
export const quotationFactSchema = z.strictObject({
  key,
  sequence: z.number().int().nonnegative(),
  orderId: id.nullable(),
  pieceId: id.nullable(),
  labelEn: z.string(),
  labelTa: z.string(),
  role: z.enum(["charge", "reference", "excluded", "complimentary", "unknown"]),
  parentKey: key.nullable(),
  grossPaise: money.nullable(),
  acceptedPaise: money.nullable(),
  estimateRevisionId: id.nullable(),
  serviceLineId: id.nullable(),
  additionLineId: id.nullable(),
  sourceId: id.nullable(),
  reason: text,
});
export type QuotationFact = z.infer<typeof quotationFactSchema>;
export const quotationLineSchema = quotationFactSchema.extend({
  lineDiscountPaise: money,
  bookingDiscountPaise: money,
  netPaise: money.nullable(),
});
export const customerQuotationSchema = z.strictObject({
  kind: z.literal("quotation-proposal-not-issued"),
  familyId: id,
  lines: z.array(quotationLineSchema).max(512),
  grossPaise: money,
  discountPaise: money,
  knownSubtotalPaise: money,
  unknownCount: z.number().int().nonnegative(),
  complete: z.boolean(),
  totalPaise: money.nullable(),
  assumptions: text,
  agreementApplication: z.literal("unavailable"),
  attribution: z
    .array(z.strictObject({ orderId: id, amountPaise: money }))
    .max(20),
  unattributedSellingPaise: money,
});
export type CustomerQuotation = z.infer<typeof customerQuotationSchema>;
export const quotationSourceSchema = z.strictObject({
  bookingId: id.nullable(),
  bookingRevisionId: id.nullable(),
  bookingVersion: z.number().int().nullable(),
  commercialId: id.nullable(),
  packagePaise: money.nullable(),
  packageOrderIds: z.array(id),
  orders: z.array(estimateSourceSchema),
  estimates: z.array(id),
  estimateStale: z.boolean(),
  policy: quotePolicyBindingSchema.nullable(),
  facts: z.array(quotationFactSchema).max(512),
  current: z.array(z.strictObject({ orderId: id, revisionId: id })),
  fingerprint: z.string(),
});
export type QuotationSource = z.infer<typeof quotationSourceSchema>;
export const quotationPrivateSchema = z.strictObject({
  estimates: z.array(
    z.strictObject({
      revisionId: id,
      lineId: id,
      amountPaise: money.nullable(),
      reason: text,
    }),
  ),
  shared: z.strictObject({ amountPaise: money.nullable(), reason: text }),
  allocations: z.array(z.strictObject({ key, amountPaise: money })),
  unattributedPaise: money,
  unknownCount: z.number().int().nonnegative(),
  actualCost: z.literal("unavailable"),
});
export type QuotationPrivate = z.infer<typeof quotationPrivateSchema>;
export const quotationReviewSchema = z.strictObject({
  customer: customerQuotationSchema,
  privateCosts: quotationPrivateSchema,
  source: quotationSourceSchema,
  stale: z.boolean(),
  blockers: z.array(z.string()),
  fingerprint: z.string(),
  suggested: quotationDraftSchema,
});
export type QuotationReview = z.infer<typeof quotationReviewSchema>;
export const quotationVersionSchema = z.strictObject({
  id,
  familyId: id,
  version: z.number().int().positive(),
  previousId: id.nullable(),
  originDraftId: id,
  actorId: id,
  recordedAt: z.iso.datetime(),
  contentHash: z.string(),
  input: quotationDraftSchema,
  source: quotationSourceSchema,
  customer: customerQuotationSchema,
  privateCosts: quotationPrivateSchema,
});
export type QuotationVersion = z.infer<typeof quotationVersionSchema>;
export const quotationListSchema = z.strictObject({
  versions: z.array(quotationVersionSchema),
  next: id.nullable(),
});
export const quotationEstimateOptionsSchema = z.strictObject({
  pieces: z.array(
    z.strictObject({ id, labelEn: z.string(), labelTa: z.string() }),
  ),
  estimates: z.array(
    z.strictObject({ id, version: z.number().int(), reason: z.string() }),
  ),
});
export const quotationReadSchema = z.strictObject({
  version: quotationVersionSchema,
  sourceChanged: z.boolean(),
  selected: z.boolean(),
});
export const quotationQuerySchema = z.strictObject({
  familyId: id,
  beforeVersion: z.number().int().positive().optional(),
});
export const quotationHistorySchema = z.strictObject({
  versions: z.array(quotationVersionSchema),
  next: z.number().int().nullable(),
});
export function emptyQuotation(familyId: string): QuotationDraft {
  return {
    familyId,
    baseVersion: 0,
    baseRevisionId: null,
    bookingId: null,
    orderIds: [],
    estimates: [],
    sourceFingerprint: null,
    selection: "alternative",
    predecessors: [],
    discounts: [],
    discountDecision: {
      policyId: null,
      eligibleKeys: [],
      stacking: null,
      manual: null,
      reason: "",
    },
    manual: [],
    manualReason: "",
    packageSplits: [],
    pieceSplits: [],
    sharedCost: { amountText: "", reason: "" },
    assumptions: "",
    reason: "",
    review: null,
  };
}
