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

// Guardian claims, verification and purpose decisions are independent evidence.
const guardianIdSchema = z.uuid().transform((value) => value.toLowerCase());
export const guardianScopeSchema = z.enum([
  "measurement",
  "private-photo",
  "measurement-and-private-photo",
]);
export const guardianPersonSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("new"),
    displayName: z.string().trim().min(1).max(120),
  }),
  z.strictObject({ mode: z.literal("existing"), personId: guardianIdSchema }),
]);
export const guardianClaimSchema = z.strictObject({
  guardian: guardianPersonSchema,
  authority: z.enum(["parent", "legal-guardian"]),
  scope: guardianScopeSchema,
  source: z.enum(["in-person", "phone"]),
  occurredAt: z.iso.datetime(),
});
export const guardianVerificationSchema = z.strictObject({
  authorityId: guardianIdSchema,
  status: z.enum(["pending", "confirmed", "rejected", "withdrawn"]),
  method: z.enum(["synthetic-review-v1", "not-verified"]),
  evidenceRef: z.string().trim().max(500),
  scope: guardianScopeSchema,
  source: z.enum(["in-person", "phone"]),
  occurredAt: z.iso.datetime(),
});
export const guardianPurposeEventSchema = z.strictObject({
  authorityId: guardianIdSchema,
  purpose: z.enum(["measurement", "private-photo", "marketing", "publication"]),
  decision: z.enum(["grant", "refusal", "withdrawal"]),
  noticeId: guardianIdSchema,
  noticeExplained: z.literal(true),
  language: z.enum(["en", "ta"]),
  giverPersonId: guardianIdSchema,
  source: z.enum(["in-person", "phone"]),
  occurredAt: z.iso.datetime(),
});
const provenance = {
  id: guardianIdSchema,
  recordedBy: guardianIdSchema,
  recordedAt: z.iso.datetime(),
  wearerVersion: z.number().int().min(1),
};
export const guardianVerificationRecordSchema =
  guardianVerificationSchema.extend({
    ...provenance,
    previousId: guardianIdSchema.nullable(),
  });
export const guardianAuthoritySchema = guardianClaimSchema
  .omit({ guardian: true })
  .extend({
    ...provenance,
    personId: guardianIdSchema,
    displayName: z.string(),
    status: z.enum(["pending", "confirmed", "rejected", "withdrawn"]),
    verifications: z.array(guardianVerificationRecordSchema),
    verifiedCurrent: z.boolean(),
    originDraftId: guardianIdSchema.nullable(),
  });
export const guardianPurposeRecordSchema = guardianPurposeEventSchema.extend({
  ...provenance,
  noticeVersion: z.string(),
  verificationId: guardianIdSchema.nullable(),
  previousId: guardianIdSchema.nullable(),
  eligible: z.boolean(),
});
export const guardianProfileSchema = z.strictObject({
  wearerId: guardianIdSchema,
  version: z.number().int().min(1),
  synthetic: z.literal(true),
  authority: guardianAuthoritySchema.nullable(),
  authorities: z.array(guardianAuthoritySchema),
  purposes: z.array(guardianPurposeRecordSchema),
});
export const guardianMutationSchema = z.strictObject({
  wearerId: guardianIdSchema,
  authorityId: guardianIdSchema,
  version: z.number().int().min(1),
});
export const guardianPeoplePageSchema = z.strictObject({
  people: z.array(
    z.strictObject({ personId: guardianIdSchema, displayName: z.string() }),
  ),
  next: guardianIdSchema.nullable(),
});
export const guardianDraftClaimSchema = guardianClaimSchema.partial().extend({
  guardian: z
    .strictObject({
      mode: z.enum(["new", "existing"]).optional(),
      displayName: z.string().max(120).optional(),
      personId: guardianIdSchema.optional(),
    })
    .optional(),
});
const guardianDraftBase = {
  synthetic: z.literal(true),
  noticeId: guardianIdSchema,
  customerId: guardianIdSchema,
  customerVersion: z.number().int().min(1),
  wearerId: guardianIdSchema,
  wearerVersion: z.number().int().min(1),
};
export const guardianDraftSchema = z.strictObject({
  ...guardianDraftBase,
  claim: guardianDraftClaimSchema,
});
export const guardianDraftCommandSchema = z.strictObject({
  ...guardianDraftBase,
  claim: guardianClaimSchema,
});
export const guardianErrorSchema = z.strictObject({
  error: z.strictObject({ code: z.string(), message: z.string() }),
  current: guardianProfileSchema.optional(),
});
export type GuardianClaim = z.infer<typeof guardianClaimSchema>;
export type GuardianVerification = z.infer<typeof guardianVerificationSchema>;
export type GuardianPurposeEvent = z.infer<typeof guardianPurposeEventSchema>;
export type GuardianAuthority = z.infer<typeof guardianAuthoritySchema>;
export type GuardianProfile = z.infer<typeof guardianProfileSchema>;
export type GuardianMutation = z.infer<typeof guardianMutationSchema>;
export type GuardianDraft = z.infer<typeof guardianDraftSchema>;
