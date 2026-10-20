import { z } from "zod";
import { bookingRecordSchema, bookingRevisionSchema } from "./bookings.js";

export * from "./bookings.js";

import { apiErrorSchema } from "./index.js";
import { serviceRequirementsPreviewSchema } from "./service-templates.js";
import { localDateValid } from "./shop-calendar.js";
import { commitmentPreviewSchema } from "./shop-commitments.js";

export const orderDecisionSchema = z.strictObject({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledged: z.boolean(),
  exceptionReason: z.string().max(1000),
  waiveRush: z.boolean(),
  waiverReason: z.string().max(1000),
});

// Intake retains raw incomplete values. It is never an accepted commitment.
export const quickOrderDraftSchema = z.strictObject({
  customerId: z.uuid().nullable(),
  wearerId: z.uuid().nullable(),
  manifest: z
    .strictObject({
      entryId: z.uuid(),
      revisionId: z.uuid(),
      definitionId: z.uuid(),
    })
    .nullable(),
  presentation: z.enum(["simple", "detailed"]),
  presentationRevisionId: z.uuid().nullable(),
  deliveryDate: z.string().max(10),
  deliveryTime: z.string().max(5),
  orderDate: z.string().max(10),
  historicalReason: z.string().max(1000),
  requestedDate: z.string().max(10),
  eventDate: z.string().max(10),
  occasion: z.string().max(160),
  priority: z.enum(["normal", "rush"]),
  priceState: z.enum(["to-be-quoted", "quoted"]),
  priceText: z.string().max(40),
  instructions: z.string().max(2000),
  commitmentReview: orderDecisionSchema.nullable().optional(),
});
export type QuickOrderDraft = z.infer<typeof quickOrderDraftSchema>;
export const quickOrderCommandSchema = quickOrderDraftSchema.superRefine(
  (v, c) => {
    const issue = (path: string) =>
      c.addIssue({ code: "custom", path: [path], message: "Review intake" });
    for (const key of ["customerId", "wearerId", "manifest"] as const)
      if (!v[key]) issue(key);
    if (!localDateValid(v.deliveryDate)) issue("deliveryDate");
    for (const key of ["orderDate", "requestedDate", "eventDate"] as const)
      if (v[key] && !localDateValid(v[key])) issue(key);
    if (
      v.deliveryTime &&
      !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(v.deliveryTime)
    )
      issue("deliveryTime");
    if (v.priceState === "quoted" && !v.priceText.trim()) issue("priceText");
  },
);
export function emptyQuickOrder(
  presentation: "simple" | "detailed" = "simple",
  presentationRevisionId: string | null = null,
): QuickOrderDraft {
  return {
    customerId: null,
    wearerId: null,
    manifest: null,
    presentation,
    presentationRevisionId,
    deliveryDate: "",
    deliveryTime: "",
    orderDate: "",
    historicalReason: "",
    requestedDate: "",
    eventDate: "",
    occasion: "",
    priority: "normal",
    priceState: "to-be-quoted",
    priceText: "",
    instructions: "",
  };
}
export const quickOrderPreviewSchema = z.strictObject({
  customer: z
    .strictObject({ id: z.uuid(), label: z.string(), code: z.string() })
    .nullable(),
  wearer: z
    .strictObject({ id: z.uuid(), label: z.string(), kind: z.string() })
    .nullable(),
  sourceState: z.enum(["not-selected", "current", "changed", "unavailable"]),
  requirements: serviceRequirementsPreviewSchema.nullable(),
  issues: z.array(
    z.enum([
      "customer",
      "wearer",
      "service",
      "servicePermission",
      "guardian",
      "deliveryDate",
      "deliveryTime",
      "orderDate",
      "requestedDate",
      "eventDate",
      "priceText",
    ]),
  ),
  pricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  effects: z.literal("none"),
  commitment: z.literal("unavailable"),
});
export type QuickOrderPreview = z.infer<typeof quickOrderPreviewSchema>;

export const orderReviewSchema = z.strictObject({
  fingerprint: z.string(),
  intake: quickOrderPreviewSchema,
  evaluation: commitmentPreviewSchema.nullable(),
  unknowns: z.array(z.string()),
  synthetic: z.boolean(),
  serverDate: z.string(),
});
export type OrderReview = z.infer<typeof orderReviewSchema>;
const canonicalUuid = z.uuid().transform((v) => v.toLowerCase());
export const groupCommercialSchema = z.strictObject({
  schemaVersion: z.literal(2),
  version: z.literal(1),
  predecessorId: z.null(),
  id: canonicalUuid,
  bookingId: canonicalUuid,
  basis: z.enum(["garment-prices", "package-proposal"]),
  packagePaise: z.string().regex(/^\d+$/).nullable(),
  allocation: z.literal("unresolved"),
  scope: z
    .array(z.strictObject({ lineId: canonicalUuid, orderId: canonicalUuid }))
    .min(2)
    .max(20),
  actorId: canonicalUuid,
  recordedAt: z.iso.datetime(),
  reason: z.string(),
});
export type GroupCommercial = z.infer<typeof groupCommercialSchema>;
export const includedOrderCommercialSchema = z.strictObject({
  schemaVersion: z.literal(2),
  basis: z.literal("package-included"),
  packageVersionId: canonicalUuid,
  groupDraftId: canonicalUuid,
  lineId: canonicalUuid,
  allocationPaise: z.null(),
  referencePaise: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
});
export type IncludedOrderCommercial = z.infer<
  typeof includedOrderCommercialSchema
>;
export const acceptedOrderSchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  originDraftId: z.uuid(),
  version: z.number().int().positive(),
  presentation: z.enum(["simple", "detailed"]),
  ownerId: z.uuid(),
  createdAt: z.iso.datetime(),
  draftCreatedAt: z.iso.datetime(),
  acceptedAt: z.iso.datetime(),
  intake: quickOrderDraftSchema,
  customer: quickOrderPreviewSchema.shape.customer,
  wearer: quickOrderPreviewSchema.shape.wearer,
  pricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  originalPromise: z.strictObject({ date: z.string(), time: z.string() }),
  currentPromise: z.strictObject({ date: z.string(), time: z.string() }),
  requirements: serviceRequirementsPreviewSchema,
  review: orderReviewSchema,
  snapshotDigest: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  synthetic: z.literal(true),
  commercial: includedOrderCommercialSchema.optional(),
});
export type AcceptedOrder = z.infer<typeof acceptedOrderSchema>;
export const bookingDetailSchema = z.strictObject({
  booking: bookingRecordSchema,
  orders: z.array(acceptedOrderSchema).max(50),
  commercial: groupCommercialSchema.nullable(),
  summary: z.union([
    z.strictObject({
      basis: z.literal("garment-prices"),
      knownSubtotalPaise: z.string().regex(/^\d+$/),
      unknownCount: z.number().int().min(0).max(50),
    }),
    z.strictObject({
      basis: z.literal("package-proposal"),
      packagePaise: z.string().regex(/^\d+$/).nullable(),
      allocation: z.literal("unresolved"),
    }),
  ]),
});
export const bookingListSchema = z.strictObject({
  bookings: z.array(bookingRecordSchema).max(25),
  next: z.uuid().nullable(),
});
export const bookingHistorySchema = z.strictObject({
  entries: z.array(bookingRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const bookingReviewSchema = z.strictObject({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export const groupIntakeDraftSchema = z
  .strictObject({
    context: bookingRecordSchema.shape.revision.shape.context,
    reason: z.string().max(1000),
    lines: z
      .array(
        z.strictObject({ id: canonicalUuid, intake: quickOrderDraftSchema }),
      )
      .max(20),
    commercial: z.strictObject({
      basis: z.enum(["garment-prices", "package-proposal"]),
      packagePriceState: z.enum(["quoted", "to-be-quoted"]),
      packagePriceText: z.string().max(40),
    }),
    review: orderDecisionSchema.nullable(),
  })
  .superRefine((v, c) => {
    if (new Set(v.lines.map((l) => l.id)).size !== v.lines.length)
      c.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Duplicate garment identity",
      });
  });
export type GroupIntakeDraft = z.infer<typeof groupIntakeDraftSchema>;
export function emptyGroupIntake(): GroupIntakeDraft {
  return {
    context: { occasion: "visit", eventDate: "", notes: "", payerId: null },
    reason: "",
    lines: [],
    commercial: {
      basis: "garment-prices",
      packagePriceState: "to-be-quoted",
      packagePriceText: "",
    },
    review: null,
  };
}
export const groupIntakeCommandSchema = groupIntakeDraftSchema.superRefine(
  (v, c) => {
    if (v.lines.length < 2 || !v.reason.trim() || !v.review?.acknowledged)
      c.addIssue({ code: "custom", message: "Review all garments" });
    for (const [i, l] of v.lines.entries())
      if (!quickOrderCommandSchema.safeParse(l.intake).success)
        c.addIssue({
          code: "custom",
          path: ["lines", i],
          message: "Complete garment intake",
        });
  },
);

// Additive structural contract; acceptance snapshots and v1 price meaning stay intact.
const pieceFormSchema = z.strictObject({
  entryId: z.uuid(),
  revisionId: z.uuid(),
  labelEn: z.string(),
  labelTa: z.string(),
});
export const orderPieceDefinitionSchema = z.strictObject({
  key: z.string().min(1).max(80),
  entryId: z.uuid(),
  revisionId: z.uuid(),
  labelEn: z.string(),
  labelTa: z.string(),
  applicability: z.enum(["applicable", "unresolved", "not-applicable"]),
  reason: z.string(),
  form: pieceFormSchema.nullable(),
});
export const orderPieceStructureSchema = z.strictObject({
  schemaVersion: z.literal(1),
  pieces: z.array(orderPieceDefinitionSchema).max(32),
  requirements: z.array(
    z.strictObject({
      position: z.number().int().min(0),
      pieceKey: z.string().nullable(),
      addonKey: z.string().nullable(),
    }),
  ),
});
export type OrderPieceStructure = z.infer<typeof orderPieceStructureSchema>;
export const orderPiecesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  orderId: z.uuid(),
  orderVersion: z.number().int().positive(),
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["historical-preview", "materialized", "unsupported"]),
  structure: orderPieceStructureSchema.nullable(),
  identities: z
    .array(z.strictObject({ key: z.string(), id: z.uuid() }))
    .max(32),
  provenance: z
    .strictObject({
      version: z.literal(1),
      actorId: z.uuid(),
      recordedAt: z.iso.datetime(),
      reason: z.string(),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .nullable(),
  execution: z.literal("unavailable"),
});
export type OrderPieces = z.infer<typeof orderPiecesSchema>;
export const materializeOrderPiecesSchema = z.strictObject({
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(1).max(1000),
});
export const orderErrorSchema = apiErrorSchema.extend({
  current: acceptedOrderSchema.optional(),
});
export type OrderError = z.infer<typeof orderErrorSchema>;
export const orderListQuerySchema = z.strictObject({
  before: z.uuid().optional(),
});
export const orderListSchema = z.strictObject({
  orders: z.array(acceptedOrderSchema).max(25),
  next: z.uuid().nullable(),
});
export const orderModeSchema = z.strictObject({
  mode: z.enum(["simple", "detailed"]),
});
export const orderHistoryQuerySchema = z.strictObject({
  beforeVersion: z.number().int().positive().optional(),
});
export const orderHistoryEntrySchema = z.strictObject({
  version: z.number().int().positive(),
  mode: z.enum(["simple", "detailed"]),
  actorId: z.uuid(),
  recordedAt: z.iso.datetime(),
});
export const orderHistorySchema = z.strictObject({
  entries: z.array(orderHistoryEntrySchema).max(25),
  next: z.number().int().positive().nullable(),
});

export const groupIntakeReviewSchema = z.strictObject({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  lines: z
    .array(
      z.strictObject({
        id: canonicalUuid,
        review: orderReviewSchema,
        pieces: orderPieceStructureSchema.nullable(),
      }),
    )
    .max(20),
  basis: z.enum(["garment-prices", "package-proposal"]),
  packagePaise: z.string().regex(/^\d+$/).nullable(),
  unknowns: z.array(z.string()),
});
export type GroupIntakeReview = z.infer<typeof groupIntakeReviewSchema>;
