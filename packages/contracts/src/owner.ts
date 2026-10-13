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
export const verificationCommandSchema = z
  .object({ code: z.string().min(1).max(256) })
  .strict();
export const ownerActionSchema = z.object({
  state: z.enum(["pending-verification", "verified", "complete"]),
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
