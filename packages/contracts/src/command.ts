import { z } from "zod";
import { apiErrorSchema } from "./index.js";

export {
  type Actor,
  actorSchema,
  etagSchema,
  idempotencyHeaderSchema,
} from "./request.js";

// A synthetic, non-personal enum: no money/measurement coercion or business entity.
const valueSchema = z.enum(["alpha", "beta", "gamma"]);
export const syntheticDraftSchema = z.strictObject({
  value: valueSchema.optional(),
});
export const syntheticCreateSchema = z.strictObject({ value: valueSchema });
export const syntheticChangeSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("edit"), value: valueSchema }),
  z.strictObject({ action: z.literal("finalize") }),
  z.strictObject({
    action: z.literal("correct"),
    value: valueSchema,
    reason: z.string().trim().min(1).max(240),
  }),
]);
export const syntheticCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), value: valueSchema }),
  ...syntheticChangeSchema.options,
]);
export type SyntheticCommand = z.infer<typeof syntheticCommandSchema>;
export const syntheticRecordSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().min(1).max(2147483647),
  value: valueSchema,
  finalized: z.boolean(),
  correctionOf: z.uuid().nullable(),
  eventId: z.uuid(),
});
export type SyntheticRecord = z.infer<typeof syntheticRecordSchema>;
// All errors retain the common error envelope; only stale state has this field.
export const commandErrorSchema = apiErrorSchema.extend({
  current: syntheticRecordSchema.optional(),
});
export type CommandError = z.infer<typeof commandErrorSchema>;
export const syntheticSuccessSchema = z.strictObject({
  record: syntheticRecordSchema,
});
export type SyntheticSuccess = z.infer<typeof syntheticSuccessSchema>;
