import { z } from "zod";

export const policyKinds = [
  "advance",
  "quoteValidity",
  "discount",
  "cancellation",
  "changeCharges",
  "trialRework",
  "creditHandover",
  "refund",
] as const;
export const policyKindSchema = z.enum(policyKinds);
export type PolicyKind = z.infer<typeof policyKindSchema>;
const text = z.string().max(4000);
const bps = z.number().nullable();
const days = z.number().nullable();
const paise = z.string().max(32).nullable();
const approval = z.literal("owner").nullable();
const common = {
  state: z.enum(["draft", "reviewed", "not-applicable"]),
  terms: z.strictObject({ en: text, ta: text }),
  reason: text,
  authority: z.strictObject({
    kind: z.enum(["owner-proposal", "synthetic-fixture"]),
    label: z.string().max(200),
  }),
};
const charge = {
  chargeBasis: z
    .enum(["fixed-paise", "percentage-bps", "case-by-case"])
    .nullable(),
  amountPaise: paise,
  percentageBps: bps,
  approval,
};
export const policyDraftValueSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...common, kind: z.literal("advance"), percentageBps: bps }),
  z.strictObject({
    ...common,
    kind: z.literal("quoteValidity"),
    calendarDays: days,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("discount"),
    maximumBps: bps,
    approval,
  }),
  z.strictObject({ ...common, kind: z.literal("cancellation"), ...charge }),
  z.strictObject({ ...common, kind: z.literal("changeCharges"), ...charge }),
  z.strictObject({
    ...common,
    kind: z.literal("trialRework"),
    includedTrials: z.number().nullable(),
    approval,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("creditHandover"),
    allowed: z.boolean().nullable(),
    limitPaise: paise,
    approval,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("refund"),
    calendarDays: days,
    approval,
  }),
]);
export type PolicyValue = z.infer<typeof policyDraftValueSchema>;
// Drafts accept incomplete decisions. Publication deliberately has a different schema.
export function policyErrors(v: PolicyValue): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(v)) {
    if (
      typeof value === "number" &&
      (!Number.isSafeInteger(value) ||
        value < 0 ||
        value >
          (key.endsWith("Bps")
            ? 10000
            : key === "includedTrials"
              ? 1000
              : 36500))
    )
      errors.push("valuesRequired");
    if (
      key.endsWith("Paise") &&
      value !== null &&
      (typeof value !== "string" ||
        !/^(0|[1-9][0-9]{0,15})$/.test(value) ||
        BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER))
    )
      errors.push("valuesRequired");
  }

  if (v.authority.kind !== "synthetic-fixture" || !v.authority.label.trim())
    errors.push("authorityGate");
  if (v.state === "draft") errors.push("reviewRequired");
  if (v.state === "not-applicable") {
    if (!v.reason.trim()) errors.push("reasonRequired");
    return [...new Set(errors)];
  }
  if (!v.terms.en.trim() || !v.terms.ta.trim()) errors.push("termsRequired");
  if (v.kind === "advance" && v.percentageBps === null)
    errors.push("valuesRequired");
  if (
    v.kind === "quoteValidity" &&
    (v.calendarDays === null || v.calendarDays < 1)
  )
    errors.push("valuesRequired");
  if (v.kind === "discount" && (v.maximumBps === null || v.approval === null))
    errors.push("valuesRequired");
  if (v.kind === "cancellation" || v.kind === "changeCharges") {
    if (
      v.approval === null ||
      v.chargeBasis === null ||
      (v.chargeBasis === "fixed-paise" &&
        (v.amountPaise === null || v.percentageBps !== null)) ||
      (v.chargeBasis === "percentage-bps" &&
        (v.percentageBps === null || v.amountPaise !== null)) ||
      (v.chargeBasis === "case-by-case" &&
        (v.amountPaise !== null || v.percentageBps !== null))
    )
      errors.push("valuesRequired");
  }
  if (
    v.kind === "trialRework" &&
    (v.includedTrials === null || v.approval === null)
  )
    errors.push("valuesRequired");
  if (
    v.kind === "creditHandover" &&
    (v.allowed === null ||
      v.approval === null ||
      (v.allowed && v.limitPaise === null) ||
      (!v.allowed && v.limitPaise !== null))
  )
    errors.push("valuesRequired");
  if (v.kind === "refund" && (v.calendarDays === null || v.approval === null))
    errors.push("valuesRequired");
  return [...new Set(errors)];
}
export const shopPoliciesDraftSchema = z.strictObject({
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  policy: policyDraftValueSchema,
});
export const shopPoliciesCommandSchema = shopPoliciesDraftSchema.superRefine(
  (v, ctx) => {
    if ((v.baseVersion === 0) !== (v.baseRevisionId === null))
      ctx.addIssue({
        code: "custom",
        path: ["baseVersion"],
        message: "invalidBase",
      });
    for (const message of policyErrors(v.policy))
      ctx.addIssue({ code: "custom", path: ["policy"], message });
  },
);
export const policySnapshotSchema = z
  .array(policyDraftValueSchema)
  .max(8)
  .refine((v) => new Set(v.map((p) => p.kind)).size === v.length);
export const shopPoliciesRevisionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().min(1),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  authorityScope: z.literal("synthetic-only"),
  policies: policySnapshotSchema,
});
export const shopPoliciesStateSchema = z.strictObject({
  version: z.number().int().min(0),
  revision: shopPoliciesRevisionSchema.nullable(),
});
export const shopPoliciesHistoryQuerySchema = z.strictObject({
  beforeVersion: z.number().int().min(1).optional(),
});
export const shopPoliciesHistorySchema = z.strictObject({
  revisions: z.array(shopPoliciesRevisionSchema).max(25),
  next: z.number().int().min(1).nullable(),
});
export type ShopPoliciesDraft = z.infer<typeof shopPoliciesDraftSchema>;
export type ShopPoliciesRevision = z.infer<typeof shopPoliciesRevisionSchema>;
export type ShopPoliciesState = z.infer<typeof shopPoliciesStateSchema>;
export const policyActions = [
  "profileSave",
  "customerRegistration",
  "wearerRegistration",
  "calendarSave",
  "draftQuote",
  "bindingQuote",
  "paymentRecording",
  "billIssue",
  "cancellation",
  "changeCharge",
  "trialRework",
  "creditHandover",
  "refund",
  "retailReturn",
] as const;
export const policyReadinessSchema = z.strictObject({
  actions: z.array(
    z.strictObject({
      action: z.enum(policyActions),
      state: z.enum(["available", "not-yet-implemented", "release-ineligible"]),
      reasons: z.array(
        z.strictObject({
          code: z.enum([
            "policyMissing",
            "policyDraft",
            "policyNotApplicable",
            "syntheticOnly",
            "productionAuthorityPending",
            "receivingAccountsNotIntegrated",
            "billFormatNotImplemented",
            "actionNotImplemented",
            "retailIneligible",
          ]),
          policy: policyKindSchema.optional(),
        }),
      ),
    }),
  ),
});
export type PolicyReadiness = z.infer<typeof policyReadinessSchema>;
export function emptyPolicy<K extends PolicyKind>(
  kind: K,
): Extract<PolicyValue, { kind: K }>;
export function emptyPolicy(kind: PolicyKind): PolicyValue {
  const base = {
    state: "draft" as const,
    terms: { en: "", ta: "" },
    reason: "",
    authority: { kind: "owner-proposal" as const, label: "" },
  };
  switch (kind) {
    case "advance":
      return { ...base, kind, percentageBps: null };
    case "quoteValidity":
      return { ...base, kind, calendarDays: null };
    case "discount":
      return { ...base, kind, maximumBps: null, approval: null };
    case "cancellation":
    case "changeCharges":
      return {
        ...base,
        kind,
        chargeBasis: null,
        amountPaise: null,
        percentageBps: null,
        approval: null,
      };
    case "trialRework":
      return { ...base, kind, includedTrials: null, approval: null };
    case "creditHandover":
      return { ...base, kind, allowed: null, limitPaise: null, approval: null };
    case "refund":
      return { ...base, kind, calendarDays: null, approval: null };
  }
}
