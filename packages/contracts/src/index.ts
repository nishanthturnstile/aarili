import { z } from "zod";

// Operational contracts only. No tenant or business DTOs in this increment.
export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  service: z.literal("aarili-web"),
});
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(["NOT_FOUND", "INTERNAL_ERROR"]),
    message: z.string(),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
