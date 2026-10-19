import { z } from "zod";
import { serviceRequirementsPreviewSchema } from "./service-templates.js";
import { localDateValid } from "./shop-calendar.js";

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
