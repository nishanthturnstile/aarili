import { z } from "zod";

export const setupCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(15).max(128),
    shopName: z.string().trim().min(1).max(120),
  })
  .strict();
export const resendCommandSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
export const signInCommandSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
export const verificationCommandSchema = z
  .object({ code: z.string().min(1).max(256) })
  .strict();
export const recoveryRequestSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
  })
  .strict();
export const recoveryResetSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9]{24}$/),
    newPassword: z.string().min(15).max(128),
  })
  .strict();
export const reauthenticationSchema = z
  .object({ password: z.string().min(1).max(128) })
  .strict();
export const googleEntrySchema = z.strictObject({
  provider: z.literal("google"),
  callbackURL: z.string().max(512).optional(),
  errorCallbackURL: z.string().max(512).optional(),
  newUserCallbackURL: z.string().max(512).optional(),
  requestSignUp: z.boolean().optional(),
  disableRedirect: z.boolean().optional(),
  loginHint: z.email().max(254).optional(),
});
export const googleDisconnectSchema = z.strictObject({ accountId: z.uuid() });
export const googleConnectionSchema = z.strictObject({
  enabled: z.boolean(),
  linked: z.boolean(),
});
export const googleRedirectSchema = z.strictObject({ url: z.url() });
export const ownerActionSchema = z.object({
  state: z.enum([
    "pending-verification",
    "verified",
    "complete",
    "recovery-requested",
    "password-reset",
    "reauthenticated",
    "probe-accepted",
    "google-disconnected",
  ]),
  shopId: z.uuid().optional(),
});
export const ownerShopSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("pending-shop") }),
  z.object({
    state: z.literal("complete"),
    shopId: z.uuid(),
    name: z.string(),
  }),
]);
