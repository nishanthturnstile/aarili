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
      "HISTORY_CHANGED",
      "INVALID_CURSOR",
      "INTERNAL_ERROR",
      "SETUP_CLOSED",
      "INVALID_CREDENTIALS",
      "INVALID_VERIFICATION",
      "MAIL_UNAVAILABLE",
      "UNAUTHENTICATED",
      "AUTHENTICATION_STALE",
      "INVALID_RESET",
      "REQUEST_CONFLICT",
      "VALIDATION_FAILED",
      "UNSAFE_ORIGIN",
      "INVALID_REQUEST",
      "RATE_LIMITED",
      "SERVICE_UNAVAILABLE",
      "GOOGLE_DENIED",
      "GOOGLE_UNAVAILABLE",
      "SHOP_ACCESS_DENIED",
      "PRECONDITION_REQUIRED",
      "VERSION_STALE",
      "IDEMPOTENCY_REQUIRED",
      "IDEMPOTENCY_MISMATCH",
      "RECORD_FINALIZED",
    ]),
    message: z.string(),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export const shopRecordSchema = z.strictObject({
  shopId: z.uuid(),
  name: z.string(),
});
export type { OwnerEntry } from "./owner.js";
export {
  createOwnerShopSchema,
  googleConnectionSchema,
  googleDisconnectSchema,
  googleEntrySchema,
  googleRedirectSchema,
  ownerActionSchema,
  ownerEntrySchema,
  ownerShopSchema,
  reauthenticationSchema,
  recoveryRequestSchema,
  recoveryResetSchema,
  resendCommandSchema,
  setupCommandSchema,
  signInCommandSchema,
  verificationCommandSchema,
} from "./owner.js";
