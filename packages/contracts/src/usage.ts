import { z } from "zod";

const identity = {
  actionId: z.uuid().transform((value) => value.toLowerCase()),
  subjectId: z.uuid().transform((value) => value.toLowerCase()),
};
export const usageEventSchema = z.discriminatedUnion("name", [
  z.strictObject({
    ...identity,
    name: z.enum(["draft.saved", "draft.promoted", "draft.abandoned"]),
    schemaVersion: z.number().int().min(1).max(2147483647),
  }),
  z.strictObject({
    ...identity,
    name: z.literal("media.stored"),
    bytes: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  }),
  z.strictObject({ ...identity, name: z.literal("pdf.rendered") }),
  z.strictObject({
    ...identity,
    name: z.literal("support.recorded"),
    category: z.enum(["setup", "training", "troubleshooting", "recovery"]),
    durationSeconds: z.number().int().min(1).max(2147483647),
  }),
]);
export type UsageEvent = z.infer<typeof usageEventSchema>;
export const usagePeriodSchema = z
  .strictObject({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    after: z
      .strictObject({ occurredAt: z.iso.datetime(), actionId: z.uuid() })
      .optional(),
  })
  .refine(
    (p) =>
      Date.parse(p.from) < Date.parse(p.to) &&
      Date.parse(p.to) - Date.parse(p.from) <= 366 * 86400000,
  );
export type UsagePeriod = z.infer<typeof usagePeriodSchema>;
export type UsageSource = { event: UsageEvent; occurredAt: string };
export type UsageTotals = {
  events: string;
  mediaBytes: string;
  supportSeconds: string;
  draftsSaved: string;
  draftsPromoted: string;
  draftsAbandoned: string;
  pdfsRendered: string;
};
export type UsageReadout = {
  totals: UsageTotals;
  sources: UsageSource[];
  truncated: boolean;
  next: { occurredAt: string; actionId: string } | null;
  messaging: null;
  ai: null;
};
