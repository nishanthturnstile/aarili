import { z } from "zod";
import { catalogueRefSchema } from "./service-catalogue.js";

const id = z.uuid().transform((v) => v.toLowerCase());
const text = (n: number) => z.string().max(n);
const counter = z.number().int().min(0).max(2147483646);
export const patternBindingSchema = z.strictObject({
  manifest: catalogueRefSchema,
  pieceKey: text(80).nullable(),
});
export const patternScopeSchema = z.strictObject({
  orderId: id,
  pieceId: id.nullable(),
});
export const patternCapabilityDraftSchema = z.strictObject({
  binding: patternBindingSchema,
  baseVersion: counter,
  manual: z.enum(["not-recorded", "available", "unavailable"]),
  external: z.enum(["not-recorded", "available", "unavailable"]),
  reason: text(1000),
  reviewed: z.boolean(),
});
export const patternCapabilityCommandSchema =
  patternCapabilityDraftSchema.superRefine((v, c) => {
    if (!v.reviewed || !v.reason.trim())
      c.addIssue({
        code: "custom",
        message: "Review path availability and reason",
      });
  });
export const patternInputSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("unknown"), reason: text(1000) }),
  z.strictObject({ state: z.literal("known"), versionId: id.nullable() }),
  z.strictObject({
    state: z.literal("not-applicable"),
    reason: text(1000),
    policy: catalogueRefSchema,
  }),
]);
export const patternContentSchema = z.strictObject({
  locator: text(1000),
  sourceKind: z.enum([
    "unknown",
    "shop-created",
    "customer-provided",
    "external-supplier",
    "other",
  ]),
  source: text(1000),
  sourceDate: z.iso.date().nullable(),
  sourceVersion: text(160),
  notes: text(2000),
  rights: z.enum([
    "unknown",
    "private-fulfilment",
    "shop-owned",
    "licensed-reuse",
  ]),
  rightsEvidence: text(1000),
  design: patternInputSchema,
  measurement: patternInputSchema,
  declaredUnits: z.enum(["unknown", "in", "cm", "mm", "mixed", "other"]),
  declaredScale: text(160),
  assumptions: text(2000),
  checks: text(2000),
});
export const patternDraftSchema = patternScopeSchema.extend({
  customerId: id,
  wearerId: id,
  baseVersion: counter,
  baseSavedId: id.nullable(),
  operation: z.enum(["prepare", "save", "review", "select"]),
  method: z.enum(["manual", "external"]),
  referenceId: id.nullable(),
  content: patternContentSchema,
  reviewState: z.enum(["reviewed", "changes-required", "withdrawn"]),
  evidence: text(2000),
  reason: text(1000),
  use: z.enum(["reference-only", "inputs-reviewed"]),
  digest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  acknowledged: z.boolean(),
  erased: z.boolean(),
});
export const patternCommandSchema = patternDraftSchema.superRefine((v, c) => {
  const issue = (message: string) => c.addIssue({ code: "custom", message });
  if (v.erased || !v.reason.trim())
    issue("Record a reason under current authority");
  if (v.operation === "save") {
    if (!v.content.locator.trim() || v.referenceId !== null)
      issue("Record a physical locator");
    for (const input of [v.content.design, v.content.measurement])
      if (input.state === "known" ? !input.versionId : !input.reason.trim())
        issue("Explain unknown or not-applicable inputs");
    if (v.content.sourceKind !== "unknown" && !v.content.source.trim())
      issue("Record the stated source");
    if (
      ["shop-owned", "licensed-reuse"].includes(v.content.rights) &&
      !v.content.rightsEvidence.trim()
    )
      issue("Record reuse rights evidence");
  }
  if (v.operation === "review" || v.operation === "select") {
    if (!v.referenceId || !v.digest || !v.acknowledged)
      issue("Compare the exact reference and acknowledge its limitations");
    if (v.operation === "review" && !v.evidence.trim())
      issue("Record review findings");
  }
});
const provenance = {
  id,
  actorId: id,
  recordedAt: z.iso.datetime(),
  originDraftId: id,
};
export const patternCapabilitySchema = patternCapabilityDraftSchema
  .extend(provenance)
  .extend({ version: counter });
export const patternVersionSchema = patternScopeSchema
  .extend(provenance)
  .extend({
    customerId: id,
    wearerId: id,
    version: z.number().int().positive(),
    previousId: id.nullable(),
    method: z.enum(["manual", "external"]),
    capabilityId: id,
    content: patternContentSchema.nullable(),
    reason: text(1000),
    redacted: z.boolean(),
  });
export const patternEventSchema = z.strictObject({
  ...provenance,
  version: z.number().int().positive(),
  operation: z.enum(["prepare", "save", "review", "select"]),
  referenceId: id.nullable(),
  reviewState: z.enum(["reviewed", "changes-required", "withdrawn"]).nullable(),
  use: z.enum(["reference-only", "inputs-reviewed"]),
  reason: text(1000),
  evidence: text(2000),
  digest: z.string().nullable(),
  contextDigest: z.string(),
  redacted: z.boolean(),
});
export const patternStateSchema = patternScopeSchema.extend({
  version: counter,
  latestSavedId: id.nullable(),
  currentId: id.nullable(),
  method: z.enum(["manual", "external"]).nullable(),
  versions: z.array(patternVersionSchema).max(25),
  events: z.array(patternEventSchema).max(25),
  nextVersion: counter.nullable(),
  nextEvent: counter.nullable(),
});
export const patternQuerySchema = patternScopeSchema.extend({
  beforeVersion: counter.optional(),
  beforeEvent: counter.optional(),
  beforeCapability: counter.optional(),
});
export const patternComparisonSchema = z.strictObject({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  referenceId: id,
  designId: id.nullable(),
  measurementId: id.nullable(),
  inputState: z.enum(["matched", "unknown", "mismatch"]),
  reviewState: z.enum([
    "unreviewed",
    "reviewed",
    "changes-required",
    "withdrawn",
  ]),
  blocked: z.array(
    z.enum([
      "path-unavailable",
      "input-review-needed",
      "reference-not-reviewed",
      "governed-work",
    ]),
  ),
});
export const patternPageSchema = z.strictObject({
  state: patternStateSchema,
  selected: patternVersionSchema.nullable(),
  binding: patternBindingSchema,
  capability: patternCapabilitySchema.nullable(),
  capabilities: z.array(patternCapabilitySchema).max(25),
  nextCapability: counter.nullable(),
  customerId: id,
  wearerId: id,
  designId: id.nullable(),
  measurementId: id.nullable(),
  comparisons: z.array(patternComparisonSchema).max(26),
  available: z.boolean(),
});
export const patternCompareQuerySchema = patternScopeSchema.extend({
  referenceId: id,
});
export type PatternBinding = z.infer<typeof patternBindingSchema>;
export type PatternCapabilityDraft = z.infer<
  typeof patternCapabilityDraftSchema
>;
export type PatternCapability = z.infer<typeof patternCapabilitySchema>;
export type PatternDraft = z.infer<typeof patternDraftSchema>;
export type PatternContent = z.infer<typeof patternContentSchema>;
export type PatternVersion = z.infer<typeof patternVersionSchema>;
export type PatternEvent = z.infer<typeof patternEventSchema>;
export type PatternState = z.infer<typeof patternStateSchema>;
export type PatternQuery = z.infer<typeof patternQuerySchema>;
export type PatternComparison = z.infer<typeof patternComparisonSchema>;
export type PatternPage = z.infer<typeof patternPageSchema>;
export function emptyPatternContent(): PatternContent {
  return {
    locator: "",
    sourceKind: "unknown",
    source: "",
    sourceDate: null,
    sourceVersion: "",
    notes: "",
    rights: "unknown",
    rightsEvidence: "",
    design: { state: "unknown", reason: "" },
    measurement: { state: "unknown", reason: "" },
    declaredUnits: "unknown",
    declaredScale: "",
    assumptions: "",
    checks: "",
  };
}
export function emptyPatternDraft(
  scope: z.infer<typeof patternScopeSchema>,
  customerId: string,
  wearerId: string,
): PatternDraft {
  return {
    ...scope,
    customerId,
    wearerId,
    baseVersion: 0,
    baseSavedId: null,
    operation: "save",
    method: "manual",
    referenceId: null,
    content: emptyPatternContent(),
    reviewState: "reviewed",
    evidence: "",
    reason: "",
    use: "reference-only",
    digest: null,
    acknowledged: false,
    erased: false,
  };
}
