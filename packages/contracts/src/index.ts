import { z } from "zod";

// Shared operational and owner-bootstrap wire contracts.
export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  service: z.literal("aarili-web"),
});
export const healthUnavailableSchema = z.strictObject({
  error: z.strictObject({
    code: z.literal("DATABASE_UNAVAILABLE"),
    message: z.literal("Database is unavailable"),
  }),
});
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "NOT_FOUND",
      "INTERNAL_ERROR",
      "SETUP_CLOSED",
      "INVALID_CREDENTIALS",
      "INVALID_VERIFICATION",
      "MAIL_UNAVAILABLE",
      "UNAUTHENTICATED",
      "REQUEST_CONFLICT",
      "VALIDATION_FAILED",
      "UNSAFE_ORIGIN",
      "INVALID_REQUEST",
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
    ]),
    message: z.string(),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export {
  ownerActionSchema,
  ownerShopSchema,
  resendCommandSchema,
  setupCommandSchema,
  verificationCommandSchema,
} from "./owner.js";
