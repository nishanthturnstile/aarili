import { z } from "zod";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional();
export const customerContactSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(120),
  phone: optionalText(40),
  email: z.union([z.literal(""), z.email().max(254)]).optional(),
  notes: optionalText(2000),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});
export const customerServiceEvidenceSchema = z.strictObject({
  noticeId: z.uuid(),
  language: z.enum(["en", "ta"]),
  decision: z.literal("grant"),
  giver: z.literal("self"),
  noticeExplained: z.literal(true),
  source: z.enum(["in-person", "phone"]),
  occurredAt: z.iso.datetime(),
});
export const customerCreateSchema = customerContactSchema.extend({
  serviceEvidence: customerServiceEvidenceSchema,
});
export const customerCorrectionSchema = customerContactSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});
export type CustomerCorrection = z.infer<typeof customerCorrectionSchema>;
export const customerMutationSchema = z.strictObject({
  customerId: z.uuid(),
  personId: z.uuid(),
  version: z.number().int().min(1),
});
export const customerNoticeSchema = z.strictObject({
  id: z.uuid(),
  version: z.string(),
  titleEn: z.string(),
  titleTa: z.string(),
  textEn: z.string(),
  textTa: z.string(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const customerPolicySchema = z.strictObject({
  enabled: z.boolean(),
  synthetic: z.boolean(),
  notice: customerNoticeSchema.nullable(),
});
const contactResolutionSchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  displayName: z.string(),
  eventId: z.uuid(),
});
export const customerProfileSchema = customerContactSchema.extend({
  id: z.uuid(),
  personId: z.uuid(),
  mergedInto: contactResolutionSchema.optional(),
  code: z.string(),
  version: z.number().int().min(1),
  synthetic: z.boolean(),
  serviceEvidence: customerServiceEvidenceSchema.extend({
    personId: z.uuid(),
    giverPersonId: z.uuid(),
    recordedBy: z.uuid(),
    noticeVersion: z.string(),
    recordedAt: z.iso.datetime(),
    synthetic: z.boolean(),
  }),
});
export const customerSummarySchema = customerContactSchema
  .omit({ notes: true })
  .extend({
    id: z.uuid(),
    code: z.string(),
    version: z.number().int().min(1),
    synthetic: z.boolean(),
    mergedInto: contactResolutionSchema.optional(),
  });
export const customerCursorSchema = z.strictObject({
  rank: z.number().int().min(0).max(4),
  id: z.uuid(),
});
export const customerSearchSchema = z.strictObject({
  query: z.string().trim().max(240),
  limit: z.number().int().min(1).max(50).default(25),
  cursor: customerCursorSchema.optional(),
});
export const customerSearchPageSchema = z.strictObject({
  customers: z.array(customerSummarySchema),
  next: customerCursorSchema.nullable(),
});
export const customerErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
  current: customerProfileSchema.optional(),
});
export type CustomerContact = z.infer<typeof customerContactSchema>;
export type CustomerCreate = z.infer<typeof customerCreateSchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CustomerPolicy = z.infer<typeof customerPolicySchema>;
export type CustomerNotice = z.infer<typeof customerNoticeSchema>;
export type CustomerSearch = z.infer<typeof customerSearchSchema>;
export type CustomerSearchPage = z.infer<typeof customerSearchPageSchema>;
export type CustomerMutationResult = z.infer<typeof customerMutationSchema>;
