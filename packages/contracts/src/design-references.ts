import { z } from "zod";
import {
  mediaPurposeSchema,
  mediaReadSchema,
  mediaRecordSchema,
  mediaTypeSchema,
} from "./media.js";
import { catalogueRefSchema } from "./service-catalogue.js";

const coordinate = z.number().int().min(0).max(10000);
export const designAnnotationSchema = z
  .strictObject({
    note: z.string().trim().min(1).max(2000),
    anchor: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("note") }),
      z.strictObject({
        kind: z.literal("point"),
        x: coordinate,
        y: coordinate,
      }),
      z.strictObject({
        kind: z.literal("rectangle"),
        x: coordinate,
        y: coordinate,
        width: coordinate.positive(),
        height: coordinate.positive(),
      }),
    ]),
  })
  .superRefine((v, c) => {
    if (
      v.anchor.kind === "rectangle" &&
      (v.anchor.x + v.anchor.width > 10000 ||
        v.anchor.y + v.anchor.height > 10000)
    )
      c.addIssue({
        code: "custom",
        path: ["anchor"],
        message: "Keep the rectangle within the accepted display image",
      });
  });
// The existing structural PDF/audio profiles expose no trusted page/duration
// metadata. Their annotations are plain notes; no invented anchor validation.
export const designReferenceDraftSchema = z.strictObject({
  id: z.uuid(),
  assetId: z.uuid(),
  questionId: z.uuid().nullable(),
  intent: z.enum(["inspiration", "instruction"]),
  caption: z.string().max(1000),
  annotations: z.array(designAnnotationSchema).max(20),
  replacesId: z.uuid().nullable(),
  geometryReviewed: z.boolean(),
});
export const designMediaSubjectDraftSchema = z.strictObject({
  kind: z.enum(["private", "library"]),
  orderId: z.uuid().nullable(),
  pieceId: z.uuid().nullable(),
  category: catalogueRefSchema.nullable(),
  previousId: z.uuid().nullable(),
  sourceKind: z.enum([
    "shop-created",
    "customer-provided",
    "licensed",
    "other",
  ]),
  sourceText: z.string().max(2000),
  sourceDate: z.iso.date().nullable(),
  rightsBasis: z.enum([
    "shop-owned",
    "licensed-reuse",
    "private-fulfilment",
    "unknown",
  ]),
  rightsEvidence: z.string().max(2000),
  reason: z.string().max(1000),
});
export const designMediaSubjectCommandSchema =
  designMediaSubjectDraftSchema.superRefine((v, c) => {
    const issue = (path: string, message: string) =>
      c.addIssue({ code: "custom", path: [path], message });
    if (!v.reason.trim() || !v.sourceText.trim())
      issue("reason", "Record source and reason");
    if (
      v.kind === "private"
        ? !v.orderId || v.category !== null || v.previousId !== null
        : v.orderId !== null || v.pieceId !== null || !v.category
    )
      issue("kind", "Review the concrete garment or reusable library category");
    if (
      v.kind === "library" &&
      (!v.rightsEvidence.trim() ||
        !["shop-owned", "licensed-reuse"].includes(v.rightsBasis) ||
        !["shop-created", "licensed"].includes(v.sourceKind))
    )
      issue(
        "rightsEvidence",
        "Reusable shop examples need explicit source and reuse rights",
      );
  });
export const designMediaSubjectSchema = designMediaSubjectDraftSchema.extend({
  id: z.uuid(),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
  redacted: z.boolean(),
});
export const designReferenceSnapshotSchema = designReferenceDraftSchema.extend({
  subject: designMediaSubjectSchema,
  contentType: mediaTypeSchema,
  purpose: mediaPurposeSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  uploaderId: z.uuid(),
  uploadedAt: z.iso.datetime(),
  display: z
    .strictObject({
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable(),
  redacted: z.boolean(),
});
export const designReferencePageSchema = z.strictObject({
  subjects: z.array(designMediaSubjectSchema).max(25),
  next: z.uuid().nullable(),
});
export const designReferenceAssetsSchema = z.strictObject({
  assets: z.array(mediaRecordSchema).max(25),
  next: z.uuid().nullable(),
});
export type DesignReferenceDraft = z.infer<typeof designReferenceDraftSchema>;
export type DesignReferenceSnapshot = z.infer<
  typeof designReferenceSnapshotSchema
>;
export const designDraftReferenceReadSchema = z.strictObject({
  reference: designReferenceSnapshotSchema,
  access: mediaReadSchema,
});
export type DesignMediaSubjectDraft = z.infer<
  typeof designMediaSubjectDraftSchema
>;
export type DesignMediaSubject = z.infer<typeof designMediaSubjectSchema>;
