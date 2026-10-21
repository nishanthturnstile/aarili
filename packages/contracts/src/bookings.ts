import { z } from "zod";
import { localDateValid } from "./shop-calendar.js";

const uuid = z.uuid().transform((v) => v.toLowerCase());
export const bookingContextSchema = z.strictObject({
  occasion: z.enum(["visit", "bridal", "other"]),
  eventDate: z.string().refine((v) => v === "" || localDateValid(v)),
  notes: z.string().max(2000),
  payerId: uuid.nullable(),
});
export const bookingSourceSchema = z.strictObject({
  id: uuid,
  version: z.number().int().positive().max(2147483647),
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const bookingDraftSchema = z
  .strictObject({
    customerId: uuid.nullable(),
    target: z
      .strictObject({
        id: uuid,
        version: z.number().int().positive().max(2147483647),
      })
      .nullable(),
    context: bookingContextSchema,
    orders: z.array(bookingSourceSchema).max(50),
    reason: z.string().max(1000),
    reviewFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .superRefine((v, c) => {
    if (new Set(v.orders.map((o) => o.id)).size !== v.orders.length)
      c.addIssue({
        code: "custom",
        message: "Duplicate garment",
        path: ["orders"],
      });
  });
export type BookingDraft = z.infer<typeof bookingDraftSchema>;
export const bookingCommandSchema = bookingDraftSchema.superRefine((v, c) => {
  if (!v.customerId)
    c.addIssue({
      code: "custom",
      path: ["customerId"],
      message: "Choose the contact",
    });
  if (!v.reason.trim())
    c.addIssue({
      code: "custom",
      path: ["reason"],
      message: "Review reason required",
    });
  if (!v.reviewFingerprint)
    c.addIssue({
      code: "custom",
      path: ["reviewFingerprint"],
      message: "Review current garments",
    });
  if (!v.target && v.orders.length < 2)
    c.addIssue({
      code: "custom",
      path: ["orders"],
      message: "Choose at least two garments",
    });
});
export const emptyBookingDraft: BookingDraft = {
  customerId: null,
  target: null,
  context: { occasion: "visit", eventDate: "", notes: "", payerId: null },
  orders: [],
  reason: "",
  reviewFingerprint: null,
};
export const bookingRevisionSchema = z.strictObject({
  id: uuid,
  bookingId: uuid,
  version: z.number().int().positive(),
  originDraftId: uuid,
  context: bookingContextSchema,
  sources: z.array(bookingSourceSchema).max(50),
  actorId: uuid,
  recordedAt: z.iso.datetime(),
  reason: z.string(),
});
export type BookingRevision = z.infer<typeof bookingRevisionSchema>;
export const bookingRecordSchema = z.strictObject({
  id: uuid,
  code: z.string(),
  customerId: uuid,
  version: z.number().int().positive(),
  revision: bookingRevisionSchema,
});
export type BookingRecord = z.infer<typeof bookingRecordSchema>;
export const bookingReadQuerySchema = z.strictObject({
  id: uuid,
  revision: z.boolean().optional(),
});
export const bookingListQuerySchema = z.strictObject({
  before: uuid.optional(),
});
