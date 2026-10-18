import { z } from "zod";

export const calendarDomainSchema = z.enum(["customer", "production"]);
export type CalendarDomain = z.infer<typeof calendarDomainSchema>;
const rangeSchema = z.strictObject({
  start: z.string().max(5),
  end: z.string().max(5),
});
const collectionSchema = z.strictObject({
  state: z.enum(["unconfigured", "none", "defined"]),
  ranges: z.array(rangeSchema).max(32),
});
export const calendarDaySchema = z.strictObject({
  state: z.enum(["unconfigured", "closed", "open"]),
  ranges: z.array(rangeSchema).max(32),
  breaks: collectionSchema,
  slots: collectionSchema,
});
export const calendarDomainDraftSchema = z.strictObject({
  week: z.array(calendarDaySchema).length(7), // Monday first
  exceptions: z
    .array(z.strictObject({ date: z.string().max(10), day: calendarDaySchema }))
    .max(366),
});
export type CalendarRange = z.infer<typeof rangeSchema>;
export type CalendarDay = z.infer<typeof calendarDaySchema>;
export type CalendarDefinition = z.infer<typeof calendarDomainDraftSchema>;

export function localDateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function calendarMinute(value: string, end = false): number | null {
  if (end && value === "24:00") return 1440;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function calendarIntervals(
  ranges: CalendarRange[],
): [number, number][] | null {
  const out: [number, number][] = [];
  for (const r of ranges) {
    const a = calendarMinute(r.start),
      b = calendarMinute(r.end, true);
    if (a === null || b === null || a >= b) return null;
    out.push([a, b]);
  }
  out.sort((a, b) => a[0] - b[0]);
  if (out.some((r, i) => i > 0 && r[0] < (out[i - 1]?.[1] ?? 0))) return null;
  return out;
}
export function subtractCalendarBreaks(
  ranges: [number, number][],
  breaks: [number, number][],
) {
  return breaks.reduce<[number, number][]>(
    (remaining, [a, b]) =>
      remaining.flatMap(([s, e]) => {
        if (b <= s || a >= e) return [[s, e]];
        const parts: [number, number][] = [];
        if (s < a) parts.push([s, a]);
        if (b < e) parts.push([b, e]);
        return parts;
      }),
    ranges,
  );
}
// Shared validation facts; UI translates codes, never exposes private field values.
export function calendarDayErrors(
  day: CalendarDay,
  domain: CalendarDomain,
): string[] {
  const errors = new Set<string>();
  const opening = calendarIntervals(day.ranges);
  if (day.state !== "open") {
    if (
      day.ranges.length ||
      day.breaks.ranges.length ||
      day.slots.ranges.length ||
      day.breaks.state !== "none" ||
      day.slots.state !== "none"
    )
      errors.add("inactiveRanges");
    return [...errors];
  }
  if (!opening?.length) errors.add("invalidRanges");
  for (const key of ["breaks", "slots"] as const) {
    const c = day[key],
      intervals = calendarIntervals(c.ranges);
    if ((c.state === "defined") !== c.ranges.length > 0 || !intervals)
      errors.add("invalidRanges");
    const bounds =
      key === "breaks"
        ? opening
        : opening &&
            day.breaks.state !== "unconfigured" &&
            calendarIntervals(day.breaks.ranges)
          ? subtractCalendarBreaks(
              opening,
              calendarIntervals(day.breaks.ranges) ?? [],
            )
          : null;
    if (
      c.state === "defined" &&
      (!bounds ||
        !intervals?.every(([a, b]) =>
          bounds.some(([s, e]) => a >= s && b <= e),
        ))
    )
      errors.add(key === "breaks" ? "breakOutside" : "slotOutside");
  }
  if (
    domain === "production" &&
    (day.slots.state !== "none" || day.slots.ranges.length)
  )
    errors.add("productionSlots");
  return [...errors];
}
export const shopCalendarDraftSchema = z.strictObject({
  domain: calendarDomainSchema,
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  definition: calendarDomainDraftSchema,
});
export const shopCalendarCommandSchema = shopCalendarDraftSchema.superRefine(
  (value, ctx) => {
    if ((value.baseVersion === 0) !== (value.baseRevisionId === null))
      ctx.addIssue({
        code: "custom",
        path: ["baseVersion"],
        message: "invalidBase",
      });
    const check = (day: CalendarDay, path: (string | number)[]) => {
      for (const message of calendarDayErrors(day, value.domain))
        ctx.addIssue({ code: "custom", path, message });
    };
    value.definition.week.forEach((day, i) => {
      check(day, ["definition", "week", i]);
    });
    const dates = new Set<string>();
    value.definition.exceptions.forEach((e, i) => {
      if (!localDateValid(e.date) || dates.has(e.date))
        ctx.addIssue({
          code: "custom",
          path: ["definition", "exceptions", i, "date"],
          message: "invalidDate",
        });
      dates.add(e.date);
      check(e.day, ["definition", "exceptions", i, "day"]);
    });
  },
);
export const shopCalendarSnapshotSchema = z.strictObject({
  customer: calendarDomainDraftSchema,
  production: calendarDomainDraftSchema,
});
export const shopCalendarRevisionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().min(1),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  calendar: shopCalendarSnapshotSchema,
});
export const shopCalendarStateSchema = z.strictObject({
  version: z.number().int().min(0),
  revision: shopCalendarRevisionSchema.nullable(),
});
export const shopCalendarHistoryQuerySchema = z.strictObject({
  beforeVersion: z.number().int().min(1).optional(),
});
export const shopCalendarHistorySchema = z.strictObject({
  revisions: z.array(shopCalendarRevisionSchema).max(25),
  next: z.number().int().min(1).nullable(),
});
export type ShopCalendarDraft = z.infer<typeof shopCalendarDraftSchema>;
export type ShopCalendarRevision = z.infer<typeof shopCalendarRevisionSchema>;
export type ShopCalendarState = z.infer<typeof shopCalendarStateSchema>;
export const calendarPreviewInputSchema = z.strictObject({
  draft: shopCalendarCommandSchema,
  date: z.string().refine(localDateValid),
});
export const calendarPreviewSchema = z.strictObject({
  days: z
    .array(
      z.strictObject({
        date: z.string(),
        state: z.enum(["unknown", "closed", "open"]),
        source: z.enum(["week", "exception"]).optional(),
        intervals: z.array(z.tuple([z.number(), z.number()])),
      }),
    )
    .length(7),
});
export type CalendarPreview = z.infer<typeof calendarPreviewSchema>;
export function emptyCalendarDay(
  state: "unconfigured" | "closed" = "unconfigured",
): CalendarDay {
  return {
    state,
    ranges: [],
    breaks: { state: "none", ranges: [] },
    slots: { state: "none", ranges: [] },
  };
}
export function emptyCalendarDefinition(): CalendarDefinition {
  return {
    week: Array.from({ length: 7 }, () => emptyCalendarDay()),
    exceptions: [],
  };
}
