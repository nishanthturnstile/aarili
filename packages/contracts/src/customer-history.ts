import { z } from "zod";
import { customerContactSchema, customerSummarySchema } from "./customers.js";

export const duplicateCandidatesQuerySchema = z.strictObject({
  customerId: z.uuid(),
  after: z.uuid().optional(),
});
export const duplicateCandidatesSchema = z.strictObject({
  candidates: z.array(
    z.strictObject({
      customer: customerSummarySchema,
      reasons: z.array(z.enum(["phone", "name", "skeleton"])),
      decision: z.enum(["keep-separate", "dismiss"]).nullable(),
    }),
  ),
  next: z.uuid().nullable(),
});
export const customerPairQuerySchema = z.strictObject({
  firstId: z.uuid(),
  secondId: z.uuid(),
});
const pairContact = z.strictObject({
  customer: customerSummarySchema,
  wearers: z.array(
    z.strictObject({
      id: z.uuid(),
      version: z.number().int().positive(),
      displayName: z.string().nullable(),
      age: z.enum(["adult", "minor", "unknown"]),
      eligible: z.boolean(),
      relationship: z.enum(["self", "family", "other"]),
      guardianVerified: z.boolean(),
    }),
  ),
});
export const customerPairSchema = z.strictObject({
  contacts: z.array(pairContact).length(2),
  version: z.number().int().positive(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  decisions: z.array(
    z.strictObject({
      id: z.uuid(),
      version: z.number().int().positive(),
      decision: z.enum(["keep-separate", "dismiss"]),
      actorId: z.uuid(),
      recordedAt: z.iso.datetime(),
      reason: z.string().nullable(),
      redacted: z.boolean(),
    }),
  ),
});
export const customerPairDecisionSchema = customerPairQuerySchema.extend({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["keep-separate", "dismiss"]),
  reason: z.string().trim().min(1).max(1000),
});
export const customerPairResultSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
});

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

export type DuplicateCandidates = z.infer<typeof duplicateCandidatesSchema>;
export type CustomerPair = z.infer<typeof customerPairSchema>;
export type CustomerPairResult = z.infer<typeof customerPairResultSchema>;
export type CustomerPairDecision = z.infer<typeof customerPairDecisionSchema>;

export const contactMergeQuerySchema = z.strictObject({
  sourceId: z.uuid(),
  survivorId: z.uuid(),
  mode: z.enum(["merge", "restore"]),
});
export const contactMergeFieldsSchema = z.strictObject({
  displayName: z.enum(["source", "survivor"]),
  phone: z.enum(["source", "survivor"]),
  email: z.enum(["source", "survivor"]),
  aliases: z.enum(["source", "survivor"]),
  notes: z.enum(["source", "survivor"]),
});
export const contactMergeAssociationSchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  version: z.number().int().positive(),
  originalCustomerId: z.uuid(),
  currentCustomerId: z.uuid(),
  wearerId: z.uuid().nullable(),
  digest: z.string(),
  eligible: z.boolean(),
  exclusion: z
    .enum([
      "wearer",
      "booking",
      "source",
      "repeat",
      "additions",
      "profile",
      "other-contact",
    ])
    .nullable(),
  attributionVersion: z.number().int().nonnegative(),
});
export const contactMergePreviewSchema = z.strictObject({
  pair: customerPairSchema,
  source: customerContactSchema,
  survivor: customerContactSchema,
  version: z.number().int().positive(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  associations: z.array(contactMergeAssociationSchema),
  blocked: z.array(
    z.enum([
      "alias-conflict",
      "wearer-conflict",
      "too-many-records",
      "not-merged",
    ]),
  ),
  unavailable: z.array(
    z.enum([
      "measurements",
      "private-media",
      "issued-finance",
      "bookings",
      "wearer-authority",
      "drafts",
    ]),
  ),
  events: z.array(
    z.strictObject({
      id: z.uuid(),
      version: z.number().int().positive(),
      mode: z.enum(["merge", "restore"]),
      sourceId: z.uuid(),
      survivorId: z.uuid(),
      actorId: z.uuid(),
      recordedAt: z.iso.datetime(),
      reason: z.string().nullable(),
      redacted: z.boolean(),
    }),
  ),
});
export const contactMergeCommandSchema = contactMergeQuerySchema.extend({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  fields: contactMergeFieldsSchema,
  orderIds: z.array(z.uuid()).max(100),
  reason: z.string().trim().min(1).max(1000),
  confirmed: z.literal(true),
});
export const contactMergeResultSchema = z.strictObject({
  id: z.uuid(),
  sourceId: z.uuid(),
  survivorId: z.uuid(),
  version: z.number().int().positive(),
});
export type ContactMergeQuery = z.infer<typeof contactMergeQuerySchema>;
export type ContactMergeCommand = z.infer<typeof contactMergeCommandSchema>;
export type ContactMergePreview = z.infer<typeof contactMergePreviewSchema>;
export type ContactMergeResult = z.infer<typeof contactMergeResultSchema>;
