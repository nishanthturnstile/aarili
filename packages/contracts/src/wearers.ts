import { z } from "zod";
import { customerPolicySchema } from "./customers.js";
export const wearerAgeSchema = z.enum(["adult", "minor", "unknown"]);
const text = z.string().max(1000);
export const wearerPreferencesSchema = z.strictObject({
  language: text.default(""),
  channel: text.default(""),
  fit: text.default(""),
  style: text.default(""),
  delivery: text.default(""),
  source: text.default(""),
});
export const wearerRelationshipSchema = z.strictObject({
  kind: z.enum(["self", "family", "other"]),
  statementByPersonId: z.uuid(),
  authorised: z.boolean(),
  informed: z.boolean(),
  authorisationDeclined: z.boolean().default(false),
  informedDeclined: z.boolean().default(false),
  source: z.enum(["in-person", "phone"]),
  occurredAt: z.iso.datetime(),
  interaction: z.string().trim().min(1).max(500),
});
const common = {
  age: wearerAgeSchema,
  preferences: wearerPreferencesSchema,
  relationship: wearerRelationshipSchema,
};
export const wearerCreateSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("self"), ...common }),
  z.strictObject({
    mode: z.literal("new"),
    displayName: z.string().trim().min(1).max(120),
    ...common,
  }),
  z.strictObject({
    mode: z.literal("existing"),
    wearerId: z.uuid(),
    expectedVersion: z.number().int().min(1),
    relationship: wearerRelationshipSchema,
  }),
]);
export const wearerUpdateSchema = z.strictObject(common);
export const wearerPurposeEventSchema = z.strictObject({
  purpose: z.enum(["service", "marketing", "publication", "private-media"]),
  decision: z.enum(["grant", "refusal", "withdrawal"]),
  noticeId: z.uuid(),
  noticeExplained: z.literal(true),
  language: z.enum(["en", "ta"]),
  giverPersonId: z.uuid(),
  source: z.enum(["in-person", "phone"]),
  occurredAt: z.iso.datetime(),
});
export const wearerPurposeRecordSchema = wearerPurposeEventSchema.extend({
  id: z.uuid(),
  noticeVersion: z.string(),
  recordedAt: z.iso.datetime(),
  recordedBy: z.uuid(),
  previousId: z.uuid().nullable(),
  eligible: z.boolean(),
});
export const wearerProfileSchema = z.strictObject({
  id: z.uuid(),
  personId: z.uuid(),
  displayName: z.string(),
  age: wearerAgeSchema,
  version: z.number().int().min(1),
  synthetic: z.literal(true),
  preferences: wearerPreferencesSchema,
  relationship: wearerRelationshipSchema.extend({
    id: z.uuid(),
    customerId: z.uuid(),
  }),
  purposes: z.array(wearerPurposeRecordSchema),
  originDraftId: z.uuid().nullable(),
});
export const wearerListSchema = z.strictObject({
  wearers: z.array(wearerProfileSchema),
});
export const wearerMutationSchema = z.strictObject({
  wearerId: z.uuid(),
  personId: z.uuid(),
  relationshipId: z.uuid(),
  version: z.number().int().min(1),
});
export const wearerSearchSchema = z.strictObject({
  query: z.string().trim().max(120),
  limit: z.number().int().min(1).max(50).default(25),
  cursor: z.uuid().optional(),
});
export const wearerSearchPageSchema = z.strictObject({
  wearers: z.array(
    wearerProfileSchema.pick({
      id: true,
      personId: true,
      displayName: true,
      age: true,
      version: true,
    }),
  ),
  next: z.uuid().nullable(),
});
export const wearerDraftRegistrationSchema = z.strictObject({
  mode: z.enum(["self", "new", "existing"]).optional(),
  displayName: z.string().max(120).optional(),
  age: wearerAgeSchema.optional(),
  preferences: wearerPreferencesSchema.partial().optional(),
  relationship: wearerRelationshipSchema
    .partial()
    .extend({ interaction: z.string().max(500).optional() })
    .optional(),
  wearerId: z.uuid().optional(),
  expectedVersion: z.number().int().min(1).optional(),
});
export const wearerDraftSchema = z.strictObject({
  synthetic: z.literal(true),
  noticeId: z.uuid(),
  customerId: z.uuid(),
  customerVersion: z.number().int().min(1),
  registration: wearerDraftRegistrationSchema,
});
export const wearerDraftCommandSchema = z.strictObject({
  synthetic: z.literal(true),
  noticeId: z.uuid(),
  customerId: z.uuid(),
  customerVersion: z.number().int().min(1),
  registration: wearerCreateSchema,
});
export const wearerPolicySchema = customerPolicySchema;
export const wearerErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
  current: wearerProfileSchema.optional(),
});
export type WearerCreate = z.infer<typeof wearerCreateSchema>;
export type WearerUpdate = z.infer<typeof wearerUpdateSchema>;
export type WearerPurposeEvent = z.infer<typeof wearerPurposeEventSchema>;
export type WearerProfile = z.infer<typeof wearerProfileSchema>;
export type WearerDraft = z.infer<typeof wearerDraftSchema>;
export type WearerPreferences = z.infer<typeof wearerPreferencesSchema>;
export type WearerRelationship = z.infer<typeof wearerRelationshipSchema>;
export type WearerMutation = z.infer<typeof wearerMutationSchema>;
export type WearerSearch = z.infer<typeof wearerSearchSchema>;
