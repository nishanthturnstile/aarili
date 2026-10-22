import { z } from "zod";
import { designChoicesDefinitionSchema } from "./design-choices.js";
import {
  designReferenceDraftSchema,
  designReferenceSnapshotSchema,
} from "./design-references.js";
import { catalogueRefSchema } from "./service-catalogue.js";

export const designScopeSchema = z.strictObject({
  orderId: z.uuid(),
  pieceId: z.uuid().nullable(),
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const designAnswerSchema = z.strictObject({
  questionId: z.uuid(),
  state: z.enum(["unknown", "not-applicable", "selected"]),
  choice: catalogueRefSchema.nullable(),
  text: z.string().max(2000),
  unit: z.enum(["in", "cm"]).nullable(),
  intent: z.enum(["unresolved", "inspiration", "instruction"]),
  retainedReason: z.string().max(1000),
});
export type DesignAnswer = z.infer<typeof designAnswerSchema>;
export const designReuseSchema = z.strictObject({
  versionId: z.uuid(),
  scopeVersion: z.number().int().positive(),
  digest,
  fields: z.array(z.uuid()).min(1).max(40),
});
export const designSpecificationDraftSchema = designScopeSchema.extend({
  baseVersion: z.number().int().min(0).max(2147483646),
  baseSavedId: z.uuid().nullable(),
  operation: z.enum(["save", "select"]),
  selectedId: z.uuid().nullable(),
  profile: catalogueRefSchema.nullable(),
  answers: z.array(designAnswerSchema).max(40),
  reason: z.string().max(1000),
  use: z.boolean(),
  reuse: designReuseSchema.nullable(),
});
export type DesignSpecificationDraft = z.infer<
  typeof designSpecificationDraftSchema
>;
export const designSpecificationCommandSchema =
  designSpecificationDraftSchema.superRefine((v, c) => {
    const issue = (path: string, message: string) =>
      c.addIssue({ code: "custom", path: [path], message });
    if (!v.reason.trim())
      issue("reason", "Record the source or revision reason");
    if (
      v.operation === "save"
        ? !v.profile || v.selectedId !== null
        : !v.selectedId || !v.use || v.answers.length > 0 || v.reuse !== null
    )
      issue("operation", "Review save or selection");
    if (
      new Set(v.answers.map((a) => a.questionId.toLowerCase())).size !==
      v.answers.length
    )
      issue("answers", "Duplicate question");
    for (const a of v.answers) {
      if (
        a.state !== "selected" &&
        (a.choice ||
          a.text ||
          a.unit ||
          a.intent !== "unresolved" ||
          a.retainedReason)
      )
        issue("answers", "Unresolved answers cannot carry instructions");
      if (a.state === "selected" && a.intent === "unresolved")
        issue("answers", "Review instruction intent");
      if (
        a.state === "selected" &&
        (a.choice ? !!a.text || a.unit !== null : !a.text.trim())
      )
        issue("answers", "Choose a controlled value or enter the instruction");
    }
    if (v.reuse && new Set(v.reuse.fields).size !== v.reuse.fields.length)
      issue("reuse", "Duplicate reused field");
  });
export const designSpecificationVersionSchema = designScopeSchema.extend({
  id: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  customerId: z.uuid(),
  wearerId: z.uuid(),
  snapshotDigest: digest,
  profile: designChoicesDefinitionSchema,
  choices: z.array(designChoicesDefinitionSchema).max(40),
  answers: z.array(designAnswerSchema).max(40),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
  reason: z.string(),
  originDraftId: z.uuid(),
  digest,
  redacted: z.boolean(),
  reuse: designReuseSchema.nullable(),
  approval: z.literal("not-recorded"),
  references: z.enum(["unavailable", "available"]),
  referenceItems: z.array(designReferenceSnapshotSchema).max(20).default([]),
});
export type DesignSpecificationVersion = z.infer<
  typeof designSpecificationVersionSchema
>;
export const designSelectionSchema = z.strictObject({
  id: z.uuid(),
  versionId: z.uuid(),
  scopeVersion: z.number().int().positive(),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
  reason: z.string(),
  redacted: z.boolean(),
});
export const designSpecificationStateSchema = designScopeSchema.extend({
  version: z.number().int().min(0),
  latestSavedId: z.uuid().nullable(),
  currentId: z.uuid().nullable(),
  versions: z.array(designSpecificationVersionSchema).max(25),
  selections: z.array(designSelectionSchema).max(25),
});
export type DesignSpecificationState = z.infer<
  typeof designSpecificationStateSchema
>;
export const designSpecificationQuerySchema = designScopeSchema.extend({
  beforeVersion: z.number().int().positive().optional(),
  beforeSelectionVersion: z.number().int().positive().optional(),
});
export const designSpecificationResultSchema = z.strictObject({
  id: z.uuid(),
  scopeVersion: z.number().int().positive(),
});
export type DesignSpecificationResult = z.infer<
  typeof designSpecificationResultSchema
>;
export const designReuseRequestSchema = designScopeSchema.extend({
  profile: catalogueRefSchema,
  source: designReuseSchema,
});

export type DesignSpecificationQuery = z.infer<
  typeof designSpecificationQuerySchema
>;
export type DesignReuseRequest = z.infer<typeof designReuseRequestSchema>;

// Existing version-one draft/command schemas remain strict. Media editing has
// its own explicit draft schema version, including an exact complete child set.
export const designSpecificationMediaDraftSchema =
  designSpecificationDraftSchema.extend({
    referenceItems: z.array(designReferenceDraftSchema).max(20),
  });
export const designSpecificationMediaCommandSchema =
  designSpecificationMediaDraftSchema.superRefine((v, c) => {
    const { referenceItems, ...base } = v;
    const parsed = designSpecificationCommandSchema.safeParse(base);
    if (!parsed.success)
      for (const issue of parsed.error.issues) c.addIssue({ ...issue });
    if (new Set(referenceItems.map((r) => r.id)).size !== referenceItems.length)
      c.addIssue({
        code: "custom",
        path: ["referenceItems"],
        message: "Duplicate reference identity",
      });
    if (v.operation === "select" && referenceItems.length)
      c.addIssue({
        code: "custom",
        path: ["referenceItems"],
        message: "Select the saved exact version without editing references",
      });
  });
export type DesignSpecificationMediaDraft = z.infer<
  typeof designSpecificationMediaDraftSchema
>;
