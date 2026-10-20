import { z } from "zod";
import { apiErrorSchema } from "./index.js";
import {
  orderDecisionSchema,
  orderReviewSchema,
  quickOrderDraftSchema,
  quickOrderPreviewSchema,
} from "./orders.js";
import { localDateValid } from "./shop-calendar.js";
import { commitmentUnitSchema } from "./shop-commitments.js";

const text = (n: number) => z.string().max(n);
const key = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const exactManifest = quickOrderDraftSchema.shape.manifest;
export const serviceProfileContentSchema = z.strictObject({
  labelEn: text(160),
  labelTa: text(160),
  manifest: exactManifest,
  wearerRequirement: z.enum(["unresolved", "required", "not-required"]),
  wearerReason: text(1000),
  capacityUnit: commitmentUnitSchema.nullable(),
  lines: z
    .array(
      z.strictObject({
        key: text(80),
        addonKey: text(80).nullable(),
        optional: z.boolean(),
        taskKey: text(80).nullable(),
        coverageKey: text(80),
        quantity: z.number().int().min(0).max(1000000).nullable(),
      }),
    )
    .max(32),
});
export type ServiceProfileContent = z.infer<typeof serviceProfileContentSchema>;
export const serviceProfileDraftSchema = z.strictObject({
  entryId: z.uuid(),
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  content: serviceProfileContentSchema,
  available: z.boolean(),
  reason: text(1000),
});
export type ServiceProfileDraft = z.infer<typeof serviceProfileDraftSchema>;
export const serviceProfileCommandSchema =
  serviceProfileDraftSchema.superRefine((v, c) => {
    const issue = (field: string) =>
      c.addIssue({
        code: "custom",
        path: [field],
        message: "Review service intake profile",
      });
    if ((v.baseVersion === 0) !== (v.baseRevisionId === null))
      issue("baseVersion");
    if (!v.reason.trim()) issue("reason");
    if (
      !v.content.manifest ||
      !v.content.labelEn.trim() ||
      !v.content.labelTa.trim() ||
      !v.content.lines.length
    )
      issue("content");
    if (
      v.content.wearerRequirement === "unresolved" ||
      (v.content.wearerRequirement === "not-required" &&
        !v.content.wearerReason.trim())
    )
      issue("content");
    if (
      new Set(v.content.lines.map((l) => l.key)).size !== v.content.lines.length
    )
      issue("content");
    const groups = new Map<string, number | null>();
    for (const line of v.content.lines) {
      if (!key.safeParse(line.key).success || !line.coverageKey.trim())
        issue("content");
      if (
        groups.has(line.coverageKey) &&
        groups.get(line.coverageKey) !== line.quantity
      )
        issue("content");
      groups.set(line.coverageKey, line.quantity);
    }
  });
export const serviceProfileRevisionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  content: serviceProfileContentSchema,
  available: z.boolean(),
  reason: z.string(),
  authority: z.enum(["owner-proposal", "synthetic-fixture"]),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ServiceProfileRevision = z.infer<
  typeof serviceProfileRevisionSchema
>;
export const serviceProfileQuerySchema = z.strictObject({
  before: z.uuid().optional(),
});
export const serviceProfileListSchema = z.strictObject({
  profiles: z
    .array(serviceProfileRevisionSchema.extend({ eligible: z.boolean() }))
    .max(25),
  next: z.uuid().nullable(),
});
export const serviceProfileHistoryQuerySchema = z.strictObject({
  entryId: z.uuid(),
  beforeVersion: z.number().int().positive().optional(),
});
export const serviceProfileHistorySchema = z.strictObject({
  revisions: z.array(serviceProfileRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const serviceLineInputSchema = z.strictObject({
  id: z.uuid(),
  key: text(80),
  requestedWork: text(2000),
  priceState: z.enum(["quoted", "to-be-quoted"]),
  priceText: text(40),
  notRequired: z.boolean(),
  notRequiredReason: text(1000),
});
export const serviceOrderDraftSchema = z.strictObject({
  customerId: z.uuid().nullable(),
  wearerId: z.uuid().nullable(),
  profile: z
    .strictObject({ entryId: z.uuid(), revisionId: z.uuid() })
    .nullable(),
  subjectId: z.uuid(),
  subjectDescription: text(1000),
  propertyReference: text(160),
  intakeContext: text(1000),
  sourceOrderId: z.uuid().nullable(),
  sourcePieceId: z.uuid().nullable(),
  lines: z.array(serviceLineInputSchema).max(32),
  deliveryDate: text(10),
  deliveryTime: text(5),
  requestedDate: text(10),
  eventDate: text(10),
  occasion: text(160),
  orderDate: text(10),
  historicalReason: text(1000),
  priority: z.enum(["normal", "rush"]),
  instructions: text(2000),
  presentation: z.enum(["simple", "detailed"]),
  presentationRevisionId: z.uuid().nullable(),
  commitmentReview: orderDecisionSchema.nullable(),
});
export type ServiceOrderDraft = z.infer<typeof serviceOrderDraftSchema>;
export const serviceOrderCommandSchema = serviceOrderDraftSchema.superRefine(
  (v, c) => {
    const issue = (field: string) =>
      c.addIssue({
        code: "custom",
        path: [field],
        message: "Review service intake",
      });
    if (!v.customerId) issue("customerId");
    if (!v.profile) issue("profile");
    if (!v.subjectDescription.trim()) issue("subjectDescription");
    if (!v.lines.length || v.lines.every((l) => l.notRequired)) issue("lines");
    if (
      new Set(v.lines.map((l) => l.id.toLowerCase())).size !== v.lines.length ||
      new Set(v.lines.map((l) => l.key)).size !== v.lines.length
    )
      issue("lines");
    if (!localDateValid(v.deliveryDate)) issue("deliveryDate");
    for (const k of ["requestedDate", "eventDate", "orderDate"] as const)
      if (v[k] && !localDateValid(v[k])) issue(k);
    if (
      v.deliveryTime &&
      !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(v.deliveryTime)
    )
      issue("deliveryTime");
    if (v.sourcePieceId && !v.sourceOrderId) issue("sourcePieceId");
    for (const line of v.lines)
      if (
        line.notRequired
          ? !line.notRequiredReason.trim()
          : !line.requestedWork.trim() ||
            (line.priceState === "quoted" && !line.priceText.trim())
      )
        issue("lines");
  },
);
export function emptyServiceOrder(subjectId: string): ServiceOrderDraft {
  return {
    customerId: null,
    wearerId: null,
    profile: null,
    subjectId,
    subjectDescription: "",
    propertyReference: "",
    intakeContext: "",
    sourceOrderId: null,
    sourcePieceId: null,
    lines: [],
    deliveryDate: "",
    deliveryTime: "",
    requestedDate: "",
    eventDate: "",
    occasion: "",
    orderDate: "",
    historicalReason: "",
    priority: "normal",
    instructions: "",
    presentation: "simple",
    presentationRevisionId: null,
    commitmentReview: null,
  };
}
export function emptyServiceProfile(entryId: string): ServiceProfileDraft {
  return {
    entryId,
    baseVersion: 0,
    baseRevisionId: null,
    content: {
      labelEn: "",
      labelTa: "",
      manifest: null,
      wearerRequirement: "unresolved",
      wearerReason: "",
      capacityUnit: null,
      lines: [],
    },
    available: true,
    reason: "",
  };
}
export const acceptedServiceLineSchema = z.strictObject({
  id: z.uuid(),
  key: z.string(),
  labelEn: z.string(),
  labelTa: z.string(),
  requestedWork: z.string(),
  addonKey: z.string().nullable(),
  taskKey: z.string().nullable(),
  priceState: z.enum(["quoted", "to-be-quoted"]),
  pricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  state: z.enum(["pending", "not-required"]),
  notRequiredReason: z.string(),
  // Intake profile revision pins this mapping; its manifest + addonKey pin the
  // exact catalogue definition. No current-source lookup rewrites accepted lines.
  sourceRevisionId: z.uuid(),
  coverageKey: z.string(),
  quantity: z.number().int().min(0).nullable(),
});
export const serviceOrderReviewSchema = z.strictObject({
  fingerprint: z.string(),
  profile: serviceProfileRevisionSchema.nullable(),
  customer: quickOrderPreviewSchema.shape.customer,
  wearer: quickOrderPreviewSchema.shape.wearer,
  sourceState: z.enum(["not-selected", "current", "changed", "unavailable"]),
  lines: z.array(acceptedServiceLineSchema),
  totalPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  quantity: z.number().int().min(0).nullable(),
  unit: commitmentUnitSchema.nullable(),
  commitment: orderReviewSchema.nullable(),
  issues: z.array(z.string()),
  effects: z.literal("none"),
});
export type ServiceOrderReview = z.infer<typeof serviceOrderReviewSchema>;
export const acceptedServiceOrderSchema = z.strictObject({
  kind: z.literal("service"),
  id: z.uuid(),
  code: z.string(),
  version: z.number().int().positive(),
  originDraftId: z.uuid(),
  ownerId: z.uuid(),
  acceptedAt: z.iso.datetime(),
  intake: serviceOrderDraftSchema,
  profile: serviceProfileRevisionSchema,
  customer: quickOrderPreviewSchema.shape.customer,
  wearer: quickOrderPreviewSchema.shape.wearer,
  lines: z.array(acceptedServiceLineSchema),
  totalPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  originalPromise: z.strictObject({ date: z.string(), time: z.string() }),
  currentPromise: z.strictObject({ date: z.string(), time: z.string() }),
  review: serviceOrderReviewSchema,
  snapshotDigest: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  synthetic: z.literal(true),
});
export type AcceptedServiceOrder = z.infer<typeof acceptedServiceOrderSchema>;
export const serviceOrderListSchema = z.strictObject({
  orders: z.array(acceptedServiceOrderSchema).max(25),
  next: z.uuid().nullable(),
});
export const smallServiceErrorSchema = apiErrorSchema;
