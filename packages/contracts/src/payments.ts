import { z } from "zod";
import { receivingMethodSchema } from "./shop-directory.js";

const uuid = z.uuid().transform((v) => v.toLowerCase());
const text = (max: number) => z.string().max(max);
export const paymentDraftSchema = z.strictObject({
  receiptId: uuid.nullable(),
  expectedVersion: z.number().int().min(0).max(2147483646),
  customerId: uuid.nullable(),
  payerId: uuid.nullable(),
  orderId: uuid.nullable(),
  bookingId: uuid.nullable(),
  action: z.enum(["report", "cash-received", "upi-seen", "fail", "correct"]),
  amountText: text(40),
  method: receivingMethodSchema,
  paymentDate: text(10),
  accountId: uuid.nullable(),
  accountRevisionId: uuid.nullable(),
  profileId: uuid.nullable(),
  reference: text(1000),
  reason: text(1000),
  attested: z.boolean(),
  restoreEpoch: uuid.nullable(),
});
export type PaymentDraft = z.infer<typeof paymentDraftSchema>;
export const paymentCommandSchema = paymentDraftSchema.superRefine((v, ctx) => {
  const issue = (path: keyof PaymentDraft) =>
    ctx.addIssue({ code: "custom", path: [path], message: "Review payment" });
  if (!v.customerId) issue("customerId");
  if (!v.payerId) issue("payerId");
  if (!v.profileId) issue("profileId");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v.paymentDate) ||
    v.paymentDate.startsWith("0000") ||
    Number.isNaN(Date.parse(`${v.paymentDate}T00:00:00Z`)) ||
    new Date(`${v.paymentDate}T00:00:00Z`).toISOString().slice(0, 10) !==
      v.paymentDate
  )
    issue("paymentDate");
  if (!v.amountText.trim()) issue("amountText");
  if ((v.receiptId === null) !== (v.expectedVersion === 0))
    issue("expectedVersion");
  if (
    v.method === "cash"
      ? v.accountId !== null || v.accountRevisionId !== null
      : !v.accountId || !v.accountRevisionId
  )
    issue("accountId");
  if (["cash-received", "upi-seen"].includes(v.action)) {
    if (!v.attested) issue("attested");
    if (!v.restoreEpoch) issue("restoreEpoch");
    if (v.method !== (v.action === "cash-received" ? "cash" : "upi"))
      issue("method");
  } else if (v.attested) issue("attested");
  if (
    v.receiptId === null &&
    ["correct", "fail", "upi-seen"].includes(v.action)
  )
    issue("action");
  if (v.receiptId !== null && v.action === "report") issue("action");
  if (["correct", "fail"].includes(v.action) && !v.reason.trim())
    issue("reason");
});
export function emptyPayment(date: string): PaymentDraft {
  return {
    receiptId: null,
    expectedVersion: 0,
    customerId: null,
    payerId: null,
    orderId: null,
    bookingId: null,
    action: "report",
    amountText: "",
    method: "cash",
    paymentDate: date,
    accountId: null,
    accountRevisionId: null,
    profileId: null,
    reference: "",
    reason: "",
    attested: false,
    restoreEpoch: null,
  };
}
export function normalizeUpiReference(raw: string): string | null {
  return raw.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "") || null;
}
export const paymentEventSchema = z.strictObject({
  id: uuid,
  receiptId: uuid,
  version: z.number().int().positive(),
  previousId: uuid.nullable(),
  status: z.enum(["pending", "confirmed", "failed"]),
  amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  method: receivingMethodSchema,
  paymentDate: z.string(),
  accountId: uuid.nullable(),
  accountRevisionId: uuid.nullable(),
  accountLabel: z.string(),
  maskedIdentifier: z.string(),
  profileId: uuid,
  recipientBusiness: z.string(),
  reference: z.string(),
  reason: z.string(),
  attestation: z.enum(["none", "cash-received", "upi-seen"]),
  restoreEpoch: uuid.nullable(),
  actorId: uuid,
  recordedAt: z.iso.datetime(),
  journalId: uuid.nullable(),
  originDraftId: uuid,
});
export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export const paymentReceiptSchema = z.strictObject({
  id: uuid,
  customerId: uuid,
  payerId: uuid,
  orderId: uuid.nullable(),
  bookingId: uuid.nullable(),
  customerLabel: z.string(),
  payerLabel: z.string(),
  createdAt: z.iso.datetime(),
  current: paymentEventSchema,
});
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;
export const paymentQuerySchema = z.strictObject({
  customerId: uuid.nullable().optional(),
  before: uuid.nullable().optional(),
});
export const paymentReadSchema = z.strictObject({ id: uuid });
export const paymentDuplicateQuerySchema = z.strictObject({
  customerId: uuid,
  reference: z.string().min(1).max(1000),
});
export const paymentListSchema = z.strictObject({
  receipts: z.array(paymentReceiptSchema),
  next: uuid.nullable(),
});
export const paymentHistoryQuerySchema = z.strictObject({
  id: uuid,
  beforeVersion: z.number().int().positive().optional(),
});
export const paymentHistorySchema = z.strictObject({
  events: z.array(paymentEventSchema),
  next: z.number().int().positive().nullable(),
});
export const paymentPositionSchema = z.strictObject({
  customerId: uuid,
  pendingPaise: z.string(),
  confirmedPaise: z.string(),
  unallocatedPaise: z.string(),
  allocatedPaise: z.literal("0"),
  agreedCharges: z.literal("not-established"),
  corrections: z.literal("not-available"),
  receipts: z.number().int().nonnegative(),
});
export const paymentOptionsSchema = z.strictObject({
  profileId: uuid.nullable(),
  recipientBusiness: z.string(),
  timezone: z.literal("Asia/Kolkata"),
  today: z.string(),
  enabled: z.array(receivingMethodSchema),
  accounts: z.array(
    z.strictObject({
      id: uuid,
      revisionId: uuid,
      method: receivingMethodSchema,
      label: z.string(),
      maskedIdentifier: z.string(),
    }),
  ),
  restoreEpoch: uuid.nullable(),
  frozen: z.boolean(),
  synthetic: z.boolean(),
});
export type PaymentOptions = z.infer<typeof paymentOptionsSchema>;
