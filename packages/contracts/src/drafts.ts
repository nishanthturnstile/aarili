import { z } from "zod";
import { apiErrorSchema } from "./index.js";
// Opaque identity is allocated when a form opens. No business values enter URLs.
export const draftIdSchema = z
  .uuid()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
export const draftPayloadSchema = z.record(z.string(), z.unknown());
export const draftSaveSchema = z.strictObject({
  workflow: z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/),
  schemaVersion: z.number().int().min(1).max(2147483647),
  payload: draftPayloadSchema,
});
export type DraftSave = z.infer<typeof draftSaveSchema>;
export const draftResultSchema = z.strictObject({
  type: z.string().min(1).max(80),
  id: z.uuid(),
});
export type DraftResult = z.infer<typeof draftResultSchema>;
export const draftRecordSchema = draftSaveSchema.extend({
  id: draftIdSchema,
  creatorId: z.uuid(),
  lifecycle: z.enum(["active", "promoted", "abandoned"]),
  version: z.number().int().min(1).max(2147483647),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  stale: z.boolean(),
  result: draftResultSchema.nullable(),
});
export type DraftRecord = z.infer<typeof draftRecordSchema>;
export const draftSuccessSchema = z.strictObject({ draft: draftRecordSchema });
export type DraftSuccess = z.infer<typeof draftSuccessSchema>;
export const draftErrorSchema = apiErrorSchema.extend({
  current: draftRecordSchema.optional(),
});
export type DraftError = z.infer<typeof draftErrorSchema>;
// Keyset order is immutable creation time/id, bounded by the first page time horizon.
export const draftCursorSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  id: draftIdSchema,
  before: z.iso.datetime(),
});
export type DraftCursor = z.infer<typeof draftCursorSchema>;
export const draftListQuerySchema = z.strictObject({
  limit: z
    .string()
    .regex(/^[1-9][0-9]?$/)
    .optional(),
  cursor: z.string().max(800).optional(),
});
export const draftListSchema = z.strictObject({
  drafts: z.array(draftRecordSchema),
  next: draftCursorSchema.nullable(),
});
export type DraftList = z.infer<typeof draftListSchema>;
export const draftPromotionSchema = z.strictObject({});
export const draftConversionSchema = z.strictObject({
  target: z.literal("services").optional(),
});
