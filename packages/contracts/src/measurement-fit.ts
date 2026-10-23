import { z } from "zod";
import { mediaReadSchema, mediaRecordSchema } from "./media.js";

const identity = z.strictObject({
  customerId: z.uuid(),
  wearerId: z.uuid(),
  measurementVersionId: z.uuid(),
  erased: z.boolean(),
});
export const measurementFitSubjectDraftSchema = identity;
export const measurementFitReferenceDraftSchema = identity.extend({
  assetId: z.uuid().nullable(),
  previousId: z.uuid().nullable(),
  baseVersion: z.number().int().nonnegative(),
  caption: z.string().max(1000),
  reason: z.string().max(1000),
});
export const measurementFitReferenceCommandSchema =
  measurementFitReferenceDraftSchema.superRefine((v, c) => {
    if (!v.assetId || !v.reason.trim() || v.erased)
      c.addIssue({
        code: "custom",
        message: "Review the ready image and reason",
      });
    if ((v.previousId === null) !== (v.baseVersion === 0))
      c.addIssue({
        code: "custom",
        message: "Review the expected reference head",
      });
  });
export const measurementFitSubjectSchema = z.strictObject({
  id: z.uuid(),
  sessionId: z.uuid(),
  customerId: z.uuid(),
  wearerId: z.uuid(),
  originDraftId: z.uuid(),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
});
export const measurementFitReferenceSchema = z.strictObject({
  id: z.uuid(),
  measurementVersionId: z.uuid(),
  sessionId: z.uuid(),
  subjectId: z.uuid(),
  assetId: z.uuid(),
  rootId: z.uuid(),
  previousId: z.uuid().nullable(),
  headId: z.uuid(),
  version: z.number().int().positive(),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  caption: z.string(),
  reason: z.string(),
  redacted: z.boolean(),
  originalSha256: z.string().regex(/^[a-f0-9]{64}$/),
  display: z.strictObject({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  thumbnailSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const measurementFitQuerySchema = z.strictObject({
  measurementVersionId: z.uuid(),
  before: z.uuid().optional(),
});
export const measurementFitPageSchema = z.strictObject({
  subject: measurementFitSubjectSchema.nullable(),
  references: z.array(measurementFitReferenceSchema).max(25),
  next: z.uuid().nullable(),
});
export const measurementFitAssetsSchema = z.strictObject({
  assets: z.array(mediaRecordSchema).max(25),
  next: z.uuid().nullable(),
});
export const measurementFitReadSchema = z.strictObject({
  reference: measurementFitReferenceSchema,
  access: mediaReadSchema,
});
export const measurementFitReadQuerySchema = z.strictObject({
  measurementVersionId: z.uuid(),
  referenceId: z.uuid(),
  variant: z.enum(["display", "thumbnail"]),
});
// Same media queue, distinct strict locator. Erasure authority is a committed
// tombstone and purge intent, not the photo consent that has been withdrawn.
export const measurementFitPurgeLocatorSchema = z.strictObject({
  kind: z.literal("measurement-fit-purge"),
  shopId: z.uuid(),
  purgeId: z.uuid(),
  initiatorId: z.uuid(),
  epoch: z.uuid(),
});
export type MeasurementFitSubjectDraft = z.infer<
  typeof measurementFitSubjectDraftSchema
>;
export type MeasurementFitReferenceDraft = z.infer<
  typeof measurementFitReferenceDraftSchema
>;
export type MeasurementFitSubject = z.infer<typeof measurementFitSubjectSchema>;
export type MeasurementFitReference = z.infer<
  typeof measurementFitReferenceSchema
>;
export type MeasurementFitPurgeLocator = z.infer<
  typeof measurementFitPurgeLocatorSchema
>;
