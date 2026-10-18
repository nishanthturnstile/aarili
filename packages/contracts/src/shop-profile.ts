import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
// Draft values can be incomplete; publishing uses the complete command schema.
export const shopProfileDraftSchema = z.strictObject({
  displayName: text(120),
  legalName: text(160),
  address: text(1000),
  phone: text(40),
  email: z.union([z.literal(""), z.email().max(254)]),
  tagline: text(240),
  footer: text(1000),
  datePresentation: z.enum(["day-first", "iso"]),
  timePresentation: z.enum(["12-hour", "24-hour"]),
  presentationLocale: z.enum(["en-IN", "ta-IN"]),
  currency: z.literal("INR"),
  timezone: z.literal("Asia/Kolkata"),
  billingRegime: z.literal("unregistered-non-tax"),
  logoAssetId: z.uuid().nullable(),
});
export const shopProfileInputSchema = shopProfileDraftSchema.extend({
  displayName: text(120).min(1),
});
export const shopProfileRevisionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().min(1).max(2147483647),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  baseline: z.boolean(),
  profile: shopProfileInputSchema,
});
export const shopProfileStateSchema = z.strictObject({
  currentActorId: z.uuid(),
  version: z.number().int().min(1).max(2147483647),
  revision: shopProfileRevisionSchema.nullable(),
  profile: shopProfileInputSchema,
  brandingAvailable: z.boolean(),
  missing: z.array(z.enum(["legalName", "address", "contact"])),
});
export const shopProfileHistorySchema = z.strictObject({
  revisions: z.array(shopProfileRevisionSchema).max(25),
  next: z.number().int().min(1).nullable(),
});
export const shopProfileHistoryQuerySchema = z.strictObject({
  beforeVersion: z.number().int().min(1).max(2147483647).optional(),
});
export const shopProfileErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
  current: shopProfileStateSchema.optional(),
});
export type ShopProfileInput = z.infer<typeof shopProfileInputSchema>;
export type ShopProfileRevision = z.infer<typeof shopProfileRevisionSchema>;
export type ShopProfileState = z.infer<typeof shopProfileStateSchema>;

export function initialShopProfile(displayName: string): ShopProfileInput {
  return {
    displayName,
    legalName: "",
    address: "",
    phone: "",
    email: "",
    tagline: "",
    footer: "",
    datePresentation: "day-first",
    timePresentation: "12-hour",
    presentationLocale: "en-IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    billingRegime: "unregistered-non-tax",
    logoAssetId: null,
  };
}
