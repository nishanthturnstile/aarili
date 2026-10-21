import { z } from "zod";

export const customerHistoryQuerySchema = z.strictObject({
  customerId: z.uuid(),
  wearerId: z.uuid().nullable().default(null),
  query: z.string().trim().max(120).default(""),
  limit: z.number().int().min(1).max(25).default(15),
  cursor: z.string().min(1).max(8192).optional(),
});
const reference = z.strictObject({
  kind: z.enum(["customer", "wearer", "order", "service", "booking"]),
  id: z.uuid(),
  version: z.number().int().positive().nullable(),
});
export const customerHistoryEventSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["customer", "wearer", "order", "booking", "service-progress"]),
  action: z.string().max(120),
  recordedAt: z.iso.datetime(),
  actorId: z.uuid(),
  actorType: z.enum(["user", "system", "import", "support"]),
  reason: z.string().nullable(),
  fields: z.array(z.string()),
  facts: z.array(z.strictObject({ field: z.string(), value: z.string() })),
  source: reference,
  code: z.string().nullable(),
  original: z.strictObject({
    customerId: z.uuid().nullable(),
    wearerId: z.uuid().nullable(),
  }),
  currentCustomer: z.string(),
  currentWearer: z.string().nullable(),
  labelEn: z.string().nullable(),
  labelTa: z.string().nullable(),
  pieceIds: z.array(z.uuid()),
  lineId: z.uuid().nullable(),
  lineIds: z.array(z.uuid()),
  state: z.enum(["pending", "completed"]).nullable(),
  related: z.array(reference),
  redacted: z.boolean(),
});
export const unavailableHistoryDomains = [
  "enquiries",
  "appointments",
  "documents",
  "money",
  "custody",
  "designs",
  "measurements",
  "fit",
] as const;
export const customerHistoryPageSchema = z.strictObject({
  events: z.array(customerHistoryEventSchema),
  next: z.string().nullable(),
  unavailable: z.array(z.enum(unavailableHistoryDomains)),
  attribution: z.literal("original-identifiers-current-labels"),
});
export type CustomerHistoryQuery = z.infer<typeof customerHistoryQuerySchema>;
export type CustomerHistoryEvent = z.infer<typeof customerHistoryEventSchema>;
export type CustomerHistoryPage = z.infer<typeof customerHistoryPageSchema>;
