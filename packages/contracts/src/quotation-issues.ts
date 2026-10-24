import { z } from "zod";
import { customerQuotationSchema } from "./booking-quotations.js";
import { documentStatusSchema } from "./documents.js";
import { customerEstimateSchema } from "./garment-estimates.js";

const id = z.uuid().transform((v) => v.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().max(4000);
const label = z.strictObject({ en: text, ta: text });
export const quoteIssueSelectionSchema = z.strictObject({ proposalId: id });
export const quoteIssueReviewInputSchema = quoteIssueSelectionSchema.extend({
  language: z.enum(["en", "ta"]),
  expiryDate: z.union([z.literal(""), z.iso.date()]),
  customerLabel: z.string().trim().max(240),
});
export const issuedQuotationModelSchema = z
  .strictObject({
    kind: z.literal("quotation.v1"),
    language: z.enum(["en", "ta"]),
    number: z.string().regex(/^QT-[0-9]{6,}$/),
    docId: id,
    revision: z.number().int().positive(),
    proposalId: id,
    previousRevision: z.number().int().positive().nullable(),
    issuedAt: z.iso.datetime(),
    issueDate: z.iso.date(),
    expiryDate: z.iso.date(),
    pricingDates: z.array(z.iso.date()).max(20),
    profileId: id,
    validityPolicyId: id,
    shop: z.strictObject({
      name: z.string().max(160),
      address: text,
      phone: z.string().max(40),
      email: z.string().max(254),
    }),
    customerLabel: z.string().max(240),
    scope: z
      .array(z.strictObject({ orderId: id, code: z.string().max(120) }))
      .min(1)
      .max(20),
    proposal: customerQuotationSchema,
    estimates: z.array(customerEstimateSchema).max(20),
    terms: z.array(label).max(8),
  })
  .superRefine((m, c) => {
    const p = m.proposal;
    let gross = 0,
      discount = 0,
      net = 0,
      valid = p.complete && p.unknownCount === 0 && p.totalPaise !== null;
    for (const l of p.lines) {
      if (l.role === "charge") {
        gross += l.grossPaise ?? 0;
        net += l.netPaise ?? 0;
        valid &&=
          l.grossPaise !== null &&
          l.netPaise !== null &&
          l.grossPaise - l.lineDiscountPaise - l.bookingDiscountPaise ===
            l.netPaise;
      } else
        valid &&=
          l.netPaise === (l.role === "complimentary" ? 0 : null) &&
          l.lineDiscountPaise === 0 &&
          l.bookingDiscountPaise === 0 &&
          l.role !== "unknown";
      discount += l.lineDiscountPaise + l.bookingDiscountPaise;
    }
    valid &&=
      [gross, discount, net].every(Number.isSafeInteger) &&
      gross === p.grossPaise &&
      discount === p.discountPaise &&
      net === p.totalPaise &&
      net === p.knownSubtotalPaise &&
      gross - discount === net &&
      m.estimates.every((e) => e.complete && e.unknownCount === 0);
    if (!valid)
      c.addIssue({
        code: "custom",
        message: "A complete reconciled customer quotation is required",
      });
  });
export type IssuedQuotationModel = z.infer<typeof issuedQuotationModelSchema>;
export const quoteIssueEntrySchema = z.strictObject({
  docId: id,
  revision: z.number().int().positive(),
  proposalId: id,
  number: z.string(),
  modelHash: hash,
  revoked: z.boolean(),
});
export type QuoteIssueEntry = z.infer<typeof quoteIssueEntrySchema>;
export const quoteResponseValueSchema = z.strictObject({
  kind: z.enum(["approved", "rejected", "withdrawn", "issue-withdrawn"]),
  respondentCustomerId: id.nullable(),
  reportedAt: z.iso.datetime(),
  channel: z.enum(["verbal", "manual-message", "written"]),
  evidence: z.string().trim().max(1000),
  reason: z.string().trim().min(1).max(1000),
});
export const quoteResponseEventSchema = z.strictObject({
  id,
  docId: id,
  revision: z.number().int().positive(),
  modelHash: hash,
  previousId: id.nullable(),
  actorId: id,
  recordedAt: z.iso.datetime(),
  value: quoteResponseValueSchema.nullable(),
});
export type QuoteResponseEvent = z.infer<typeof quoteResponseEventSchema>;
export const quoteResponseCommandSchema = z.strictObject({
  docId: id,
  revision: z.number().int().positive(),
  modelHash: hash,
  previousId: id.nullable(),
  value: quoteResponseValueSchema,
  acknowledged: z.literal(true),
});
export type QuoteResponseCommand = z.infer<typeof quoteResponseCommandSchema>;
export const quoteResponseResultSchema = z.strictObject({
  event: quoteResponseEventSchema,
  responseVersion: z.number().int().positive(),
});
export const quoteIssueReadSchema = z.strictObject({
  entry: quoteIssueEntrySchema,
  model: issuedQuotationModelSchema,
  status: documentStatusSchema,
  events: z.array(quoteResponseEventSchema).max(100),
  responseVersion: z.number().int().positive(),
  historical: z.boolean(),
  expired: z.boolean(),
  withdrawn: z.boolean(),
  agreementApplication: z.literal("unavailable"),
  respondentCustomerIds: z.array(id).max(20),
});
export const quoteIssueReviewSchema = z.strictObject({
  version: z.number().int().positive(),
  digest: hash,
  issueDate: z.iso.date(),
  expiryDate: z.iso.date().nullable(),
  validityTerms: label.nullable(),
  blockers: z.array(z.string()),
  history: z.array(quoteIssueEntrySchema).max(100),
});
export type QuoteIssueReview = z.infer<typeof quoteIssueReviewSchema>;
export const quoteIssueCommandSchema = quoteIssueReviewInputSchema.extend({
  digest: hash,
  previousRevision: z.number().int().positive().nullable(),
  acknowledged: z.literal(true),
  reason: z.string().trim().min(1).max(1000),
});
export type QuoteIssueCommand = z.infer<typeof quoteIssueCommandSchema>;
export const quoteIssueResultSchema = z.strictObject({
  entry: quoteIssueEntrySchema,
  status: documentStatusSchema,
});
export const quoteIssueLocatorSchema = z.strictObject({
  docId: id,
  revision: z.number().int().positive(),
});
export const quotePurgeLocatorSchema = z.strictObject({
  kind: z.literal("quotation-purge"),
  shopId: id,
  purgeId: id,
  initiatorId: id,
  epoch: id,
});
