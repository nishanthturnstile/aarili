import { z } from "zod";
import { localDateValid } from "./shop-calendar.js";

export const commitmentBasisSchema = z.enum(["calendar", "production"]);
export const commitmentUnitSchema = z.enum(["garments", "effort-points"]);
const localDate = z.string().refine(localDateValid);
const time = z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);
const peak = z.strictObject({
  label: z.string().max(160),
  start: z.string(),
  end: z.string(),
  cutoffDate: z.string(),
  cutoffTime: z.string(),
});
export const commitmentConfigurationSchema = z.strictObject({
  warningDays: z.number().nullable(),
  warningBasis: commitmentBasisSchema,
  escalation: z.enum(["unconfigured", "manual-owner-review", "none"]),
  ruleLabel: z.string().max(200),
  authority: z.enum(["owner-proposal", "synthetic-fixture"]),
  leadDays: z.number().nullable(),
  leadBasis: commitmentBasisSchema.nullable(),
  cap: z.number().nullable(),
  unit: commitmentUnitSchema.nullable(),
  weekStart: z.number().nullable(),
  allocation: z.literal("delivery-date").nullable(),
  zeroCap: z.literal("closed-capacity").nullable(),
  peakConvention: z.literal("all-matching-delivery-ranges").nullable(),
  cutoffBoundary: z.literal("after-cutoff").nullable(),
  peaks: z.array(peak).max(32),
  rushPaise: z.string().max(32).nullable(),
});
export type CommitmentConfiguration = z.infer<
  typeof commitmentConfigurationSchema
>;
export function commitmentErrors(c: CommitmentConfiguration) {
  const errors: string[] = [];
  for (const key of ["warningDays", "leadDays", "cap", "weekStart"] as const) {
    const v = c[key];
    const max = key === "weekStart" ? 6 : key === "cap" ? 1000000 : 3660;
    if (v !== null && (!Number.isSafeInteger(v) || v < 0 || v > max))
      errors.push(key);
  }
  if (c.warningDays === null) errors.push("warningDays");
  if (
    c.rushPaise !== null &&
    (!/^(0|[1-9][0-9]{0,15})$/.test(c.rushPaise) ||
      BigInt(c.rushPaise) > BigInt(Number.MAX_SAFE_INTEGER))
  )
    errors.push("rushPaise");
  for (const p of c.peaks)
    if (
      !p.label.trim() ||
      !localDateValid(p.start) ||
      !localDateValid(p.end) ||
      p.end < p.start ||
      !localDateValid(p.cutoffDate) ||
      !time.safeParse(p.cutoffTime).success
    )
      errors.push("peaks");
  return [...new Set(errors)];
}
export const shopCommitmentsDraftSchema = z.strictObject({
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  configuration: commitmentConfigurationSchema,
});
export type ShopCommitmentsDraft = z.infer<typeof shopCommitmentsDraftSchema>;
export const shopCommitmentsCommandSchema =
  shopCommitmentsDraftSchema.superRefine((v, ctx) => {
    if ((v.baseVersion === 0) !== (v.baseRevisionId === null))
      ctx.addIssue({
        code: "custom",
        path: ["baseVersion"],
        message: "Invalid base",
      });
    for (const field of commitmentErrors(v.configuration))
      ctx.addIssue({
        code: "custom",
        path: ["configuration", field],
        message: field,
      });
  });
export const shopCommitmentsRevisionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  authorityScope: z.literal("unbound-preview"),
  configuration: commitmentConfigurationSchema,
});
export type ShopCommitmentsRevision = z.infer<
  typeof shopCommitmentsRevisionSchema
>;
export const shopCommitmentsStateSchema = z.strictObject({
  version: z.number().int().min(0),
  revision: shopCommitmentsRevisionSchema.nullable(),
});
export const shopCommitmentsHistoryQuerySchema = z.strictObject({
  beforeVersion: z.number().int().positive().optional(),
});
export const shopCommitmentsHistorySchema = z.strictObject({
  revisions: z.array(shopCommitmentsRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const commitmentScenarioSchema = z
  .strictObject({
    mode: z.enum(["synthetic", "production"]),
    fixture: z.enum(["peak-cap-rush", "missing-load"]),
    categoryId: z.uuid().nullable(),
    today: localDate,
    nowTime: time,
    bookingDate: localDate,
    bookingTime: time,
    deliveryDate: localDate,
    deliveryTime: time.nullable(),
    quantity: z.number().int().min(0).max(1000000).nullable(),
    unit: commitmentUnitSchema.nullable(),
    priority: z.enum(["normal", "rush"]),
    occasion: z.string().max(160),
    acknowledge: z.boolean(),
    review: z.boolean(),
    exceptionReason: z.string().max(1000),
    waiver: z.boolean(),
    waiverReason: z.string().max(1000),
  })
  .refine((v) => v.deliveryDate >= v.bookingDate, {
    message: "Delivery precedes booking",
    path: ["deliveryDate"],
  });
export type CommitmentScenario = z.infer<typeof commitmentScenarioSchema>;
export const commitmentPreviewInputSchema = z.strictObject({
  source: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("draft"),
      draft: shopCommitmentsDraftSchema,
    }),
    z.strictObject({ kind: z.literal("revision"), revisionId: z.uuid() }),
  ]),
  calendarRevisionId: z.uuid().nullable(),
  scenario: commitmentScenarioSchema,
  previousFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
export type CommitmentPreviewInput = z.infer<
  typeof commitmentPreviewInputSchema
>;
export const commitmentPreviewSchema = z.strictObject({
  state: z.enum(["clear", "warning", "unknown"]),
  warnings: z.array(z.string()),
  unknowns: z.array(z.string()),
  facts: z.strictObject({
    warningWindow: z.number().nullable(),
    deliveryDistance: z.number().nullable(),
    leadDays: z.number().nullable(),
    requiredLead: z.number().nullable(),
    cap: z.number().nullable(),
    existing: z.number().nullable(),
    candidate: z.number().nullable(),
    total: z.number().nullable(),
    unit: commitmentUnitSchema.nullable(),
    weekStart: z.string().nullable(),
    weekEndExclusive: z.string().nullable(),
    cutoffs: z.array(
      z.strictObject({ label: z.string(), date: z.string(), time: z.string() }),
    ),
    rush: z.boolean(),
    rushPaise: z.string().nullable(),
  }),
  sources: z.strictObject({
    evaluator: z.literal("commitments-v1"),
    configuration: z.string(),
    calendar: z.string().nullable(),
    category: z.string().nullable(),
    load: z.string().nullable(),
    asOf: z.string().nullable(),
    synthetic: z.boolean(),
  }),
  fingerprint: z.string(),
  stale: z.boolean(),
  decisions: z.strictObject({
    state: z.enum(["inspection", "incomplete", "recorded-preview"]),
    errors: z.array(z.string()),
    acknowledged: z.boolean(),
    waived: z.boolean(),
  }),
  binding: z.literal("unbound"),
  activation: z.literal("unavailable"),
  effects: z.literal("none"),
});
export type CommitmentPreview = z.infer<typeof commitmentPreviewSchema>;
export function initialCommitmentConfiguration(): CommitmentConfiguration {
  return {
    warningDays: 3,
    warningBasis: "calendar",
    escalation: "unconfigured",
    ruleLabel: "",
    authority: "owner-proposal",
    leadDays: null,
    leadBasis: null,
    cap: null,
    unit: null,
    weekStart: null,
    allocation: null,
    zeroCap: null,
    peakConvention: null,
    cutoffBoundary: null,
    peaks: [],
    rushPaise: null,
  };
}
// Review fixture conventions only. Never a production category or activated policy.
export function syntheticCommitmentConfiguration(): CommitmentConfiguration {
  return {
    ...initialCommitmentConfiguration(),
    ruleLabel: "SYNTHETIC peak/cap/rush",
    authority: "synthetic-fixture",
    escalation: "manual-owner-review",
    leadDays: 5,
    leadBasis: "calendar",
    cap: 10,
    unit: "garments",
    weekStart: 0,
    allocation: "delivery-date",
    zeroCap: "closed-capacity",
    peakConvention: "all-matching-delivery-ranges",
    cutoffBoundary: "after-cutoff",
    peaks: [
      {
        label: "SYNTHETIC festival",
        start: "2026-10-20",
        end: "2026-10-31",
        cutoffDate: "2026-10-18",
        cutoffTime: "18:00",
      },
    ],
    rushPaise: "50000",
  };
}
export function initialCommitmentScenario(): CommitmentScenario {
  return {
    mode: "synthetic",
    fixture: "peak-cap-rush",
    categoryId: null,
    today: "2026-10-20",
    nowTime: "12:00",
    bookingDate: "2026-10-20",
    bookingTime: "10:00",
    deliveryDate: "2026-10-22",
    deliveryTime: null,
    quantity: 1,
    unit: "garments",
    priority: "normal",
    occasion: "",
    acknowledge: false,
    review: false,
    exceptionReason: "",
    waiver: false,
    waiverReason: "",
  };
}
