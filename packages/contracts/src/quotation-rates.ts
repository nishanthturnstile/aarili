import { z } from "zod";
import { catalogueRefSchema } from "./service-catalogue.js";
import { localDateValid } from "./shop-calendar.js";
import { policyDraftValueSchema } from "./shop-policies.js";

export const rateComponents = [
  "labour",
  "lining",
  "fabric",
  "trims",
  "alteration",
  "craft",
  "rush",
] as const;
const text = z.string().max(1000);
const version = z.number().int().min(0).max(2147483646);
export const rateDraftSchema = z.strictObject({
  rateId: z.uuid(),
  baseVersion: version,
  baseRevisionId: z.uuid().nullable(),
  source: catalogueRefSchema.nullable(),
  component: z.enum(rateComponents).nullable(),
  unit: z.enum(["item", "mm"]).nullable(),
  basisText: z.string().max(16),
  available: z.boolean(),
  reason: text,
  entries: z
    .array(
      z.strictObject({
        entryId: z.uuid(),
        from: z.string().max(10),
        until: z.string().max(10),
        rateText: z.string().max(40),
      }),
    )
    .max(64),
});
export type RateDraft = z.infer<typeof rateDraftSchema>;
export const rateCommandSchema = rateDraftSchema.superRefine((v, c) => {
  const issue = (field: string) =>
    c.addIssue({
      code: "custom",
      path: [field],
      message: "Review the rate schedule",
    });
  if ((v.baseVersion === 0) !== (v.baseRevisionId === null))
    issue("baseVersion");
  if (
    !v.source ||
    !v.component ||
    !v.unit ||
    !v.reason.trim() ||
    !v.entries.length
  )
    issue("source");
  if (
    !/^[1-9]\d{0,15}$/.test(v.basisText) ||
    BigInt(v.basisText || "0") > BigInt(Number.MAX_SAFE_INTEGER) ||
    (v.unit === "item" && v.basisText !== "1")
  )
    issue("basisText");
  if (
    new Set(v.entries.map((e) => e.entryId.toLowerCase())).size !==
    v.entries.length
  )
    issue("entries");
  for (const e of v.entries)
    if (
      !localDateValid(e.from) ||
      (e.until && !localDateValid(e.until)) ||
      (e.until && e.until <= e.from) ||
      !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(e.rateText.trim())
    )
      issue("entries");
});
const entry = z.strictObject({
  entryId: z.uuid(),
  from: z.string(),
  until: z.string().nullable(),
  ratePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export const rateRevisionSchema = z.strictObject({
  id: z.uuid(),
  rateId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  originDraftId: z.uuid(),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  source: catalogueRefSchema,
  definitionId: z.uuid(),
  profileRevisionId: z.uuid(),
  labelEn: z.string(),
  labelTa: z.string(),
  component: z.enum(rateComponents),
  unit: z.enum(["item", "mm"]),
  basisQuantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  available: z.boolean(),
  reason: text,
  authority: z.enum(["owner-reviewed", "synthetic-only"]),
  entries: z.array(entry).min(1).max(64),
});
export type RateRevision = z.infer<typeof rateRevisionSchema>;
export const quotePolicyKinds = [
  "advance",
  "quoteValidity",
  "discount",
  "cancellation",
  "changeCharges",
] as const;
export const quotePolicyReviewDraftSchema = z.strictObject({
  kind: z.enum(quotePolicyKinds),
  baseVersion: version,
  baseRevisionId: z.uuid().nullable(),
  sourceDraftId: z.uuid().nullable(),
  sourceDraftVersion: version,
  reason: text,
  acknowledged: z.boolean(),
});
export const quotePolicyReviewCommandSchema =
  quotePolicyReviewDraftSchema.superRefine((v, c) => {
    if (
      !v.sourceDraftId ||
      !v.sourceDraftVersion ||
      !v.reason.trim() ||
      !v.acknowledged ||
      (v.baseVersion === 0) !== (v.baseRevisionId === null)
    )
      c.addIssue({
        code: "custom",
        path: ["acknowledged"],
        message: "Review the exact policy proposal",
      });
  });
export type QuotePolicyReviewDraft = z.infer<
  typeof quotePolicyReviewDraftSchema
>;
export const quotePolicyBindingSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(quotePolicyKinds),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  originDraftId: z.uuid(),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
  sourceDraftId: z.uuid(),
  sourceDraftVersion: version,
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  policy: policyDraftValueSchema,
  reason: text,
  authority: z.enum(["owner-reviewed", "synthetic-only"]),
  actionScope: z.literal("quotation-only"),
  sourceCurrent: z.boolean(),
});
export type QuotePolicyBinding = z.infer<typeof quotePolicyBindingSchema>;
export const ratesListQuerySchema = z.strictObject({
  before: z.uuid().optional(),
});
export const ratesListSchema = z.strictObject({
  revisions: z.array(rateRevisionSchema).max(25),
  next: z.uuid().nullable(),
  today: z.string(),
  effects: z.literal("none"),
});
export const rateHistoryQuerySchema = z.strictObject({
  rateId: z.uuid(),
  beforeVersion: z.number().int().positive().optional(),
});
export const rateHistorySchema = z.strictObject({
  revisions: z.array(rateRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const policyBindingQuerySchema = z.strictObject({
  kind: z.enum(quotePolicyKinds),
  beforeVersion: z.number().int().positive().optional(),
});
export const policyBindingsSchema = z.strictObject({
  bindings: z.array(quotePolicyBindingSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const rateResolveQuerySchema = z.strictObject({
  rateId: z.uuid(),
  date: z.string().refine(localDateValid),
});
export const rateResolutionSchema = z.strictObject({
  state: z.enum(["known", "missing", "unavailable", "ambiguous"]),
  revision: rateRevisionSchema.nullable(),
  entry: entry.nullable(),
  effects: z.literal("none"),
});
export function emptyRate(rateId: string): RateDraft {
  return {
    rateId,
    baseVersion: 0,
    baseRevisionId: null,
    source: null,
    component: null,
    unit: null,
    basisText: "",
    available: true,
    reason: "",
    entries: [],
  };
}
