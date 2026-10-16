import { z } from "zod";
export const mediaTechnicalLimits = {
  imageBytes: 20 * 1024 * 1024,
  documentAudioBytes: 25 * 1024 * 1024,
  grantSeconds: 300,
} as const;
export const mediaTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);
export const mediaPurposeSchema = z.enum([
  "wearer-photo",
  "private-fitting",
  "manual-pattern",
  "order-document",
  "voice-note",
]);
export const mediaAdmissionSchema = z.strictObject({
  subjectId: z.uuid().transform((value) => value.toLowerCase()),
  purpose: mediaPurposeSchema,
  contentType: mediaTypeSchema,
  size: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
});
export const mediaCompletionSchema = z.strictObject({});
export const mediaRecordSchema = z.strictObject({
  id: z.uuid(),
  subjectId: z.uuid(),
  purpose: mediaPurposeSchema,
  contentType: mediaTypeSchema,
  size: z.number().int().positive(),
  status: z.enum([
    "pending_upload",
    "processing",
    "ready",
    "quarantined",
    "expired",
    "deleted",
  ]),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
});
export const mediaUploadSchema = z.strictObject({
  asset: mediaRecordSchema,
  upload: z.strictObject({
    url: z.url(),
    method: z.literal("PUT"),
    headers: z.strictObject({ "Content-Type": mediaTypeSchema }),
    expiresAt: z.iso.datetime(),
  }),
});
export const mediaSuccessSchema = z.strictObject({ asset: mediaRecordSchema });
export const mediaReadSchema = z.strictObject({
  url: z.url(),
  expiresAt: z.iso.datetime(),
  filename: z.string(),
});
export type MediaAdmission = z.infer<typeof mediaAdmissionSchema>;
export type MediaRecord = z.infer<typeof mediaRecordSchema>;
export type MediaUpload = z.infer<typeof mediaUploadSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type MediaPurpose = z.infer<typeof mediaPurposeSchema>;
