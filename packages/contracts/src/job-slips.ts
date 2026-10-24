import { z } from "zod";
import { designAnnotationSchema } from "./design-references.js";
import { documentStatusSchema } from "./documents.js";

const id = z.uuid().transform((v) => v.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const label = z.strictObject({
  en: z.string().max(4000),
  ta: z.string().max(4000),
});
export const jobSlipScopeSchema = z.strictObject({
  orderId: id,
  pieceId: id.nullable(),
});
export type JobSlipScope = z.infer<typeof jobSlipScopeSchema>;
export const jobSlipAssetSchema = z.strictObject({
  referenceId: id,
  assetId: id,
  subjectId: id,
  kind: z.enum(["design", "pattern"]),
  purpose: z.enum([
    "wearer-photo",
    "manual-pattern",
    "order-document",
    "shop-branding",
  ]),
  originalSha256: hash,
  displaySha256: hash,
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  caption: z.string().max(1000),
  annotations: z.array(designAnnotationSchema).max(20),
});
export type JobSlipAsset = z.infer<typeof jobSlipAssetSchema>;
export const jobSlipModelSchema = jobSlipScopeSchema.extend({
  kind: z.literal("job-slip.v1"),
  audience: z.literal("private-production"),
  language: z.enum(["en", "ta"]),
  issued: z
    .strictObject({
      docId: id,
      revision: z.number().int().positive(),
      at: z.iso.datetime(),
      reason: z.string().max(1000),
    })
    .nullable(),
  orderCode: z.string().min(1).max(120),
  pieceLabel: label.nullable(),
  garment: label,
  instructions: z.array(z.string().max(4000)).max(80),
  sources: z
    .array(
      z.strictObject({
        kind: z.enum(["design", "measurement", "pattern", "form"]),
        id,
        version: z.number().int().positive().nullable(),
        description: z.string().max(2000),
      }),
    )
    .max(10),
  measurements: z
    .array(
      z.strictObject({
        fieldId: id,
        label,
        value: z.string().max(200),
        unit: z.enum(["in", "cm"]).nullable(),
        source: z.string().max(1000),
      }),
    )
    .max(100),
  warnings: z.array(label).max(60),
  assets: z.array(jobSlipAssetSchema).max(20),
  omittedAssetIds: z.array(id).max(20),
});
export type JobSlipModel = z.infer<typeof jobSlipModelSchema>;
export const jobSlipReviewCommandSchema = jobSlipScopeSchema.extend({
  omittedAssetIds: z.array(id).max(20),
});
export const jobSlipHistoryEntrySchema = z.strictObject({
  docId: id,
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  language: z.enum(["en", "ta"]),
  sourceDigest: hash,
  revoked: z.boolean(),
});
export type JobSlipHistoryEntry = z.infer<typeof jobSlipHistoryEntrySchema>;
export const jobSlipReviewSchema = z.strictObject({
  model: jobSlipModelSchema,
  sourceDigest: hash,
  version: z.number().int().positive(),
  blockers: z
    .array(
      z.enum([
        "design-missing",
        "measurement-missing",
        "pattern-missing",
        "scope-unsupported",
        "critical-asset-unavailable",
        "reference-unavailable",
        "optional-omission-unreviewed",
      ]),
    )
    .max(20),
  history: z.array(jobSlipHistoryEntrySchema).max(25),
  optionalAssets: z
    .array(
      z.strictObject({
        assetId: id,
        referenceId: id,
        unavailable: z.boolean(),
      }),
    )
    .max(20),
});
export type JobSlipReview = z.infer<typeof jobSlipReviewSchema>;
export const jobSlipIssueSchema = jobSlipReviewCommandSchema.extend({
  docId: id,
  revision: z.number().int().positive().max(2147483647),
  sourceDigest: hash,
  language: z.enum(["en", "ta"]),
  acknowledged: z.literal(true),
  reason: z.string().trim().min(1).max(1000),
});
export type JobSlipIssue = z.infer<typeof jobSlipIssueSchema>;
export const jobSlipIssueResultSchema = z.strictObject({
  status: documentStatusSchema,
  sourceDigest: hash,
});
export const jobSlipPurgeLocatorSchema = z.strictObject({
  kind: z.literal("job-slip-purge"),
  shopId: id,
  purgeId: id,
  initiatorId: id,
  epoch: id,
});
