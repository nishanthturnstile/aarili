import {
  type CalendarDay,
  calendarDayErrors,
  emptyCalendarDay,
  emptyCalendarDefinition,
  localDateValid,
  type ShopCalendarDraft,
  type ShopCalendarRevision,
  shopCalendarCommandSchema,
  shopCalendarDraftSchema,
} from "@aarili/contracts/shop-calendar";
import {
  countCalendarWorkingDays,
  previewShopCalendar,
  resolveCalendarDate,
} from "@aarili/core/shop-calendar";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const open = (start = "09:00", end = "17:00"): CalendarDay => ({
  ...emptyCalendarDay(),
  state: "open",
  ranges: [{ start, end }],
});
function revision(): ShopCalendarRevision {
  return {
    id: "019a5e55-2222-7000-8000-000000000001",
    version: 1,
    previousId: null,
    actorId: "019a5e55-2222-7000-8000-000000000002",
    originDraftId: "019a5e55-2222-7000-8000-000000000003",
    effectiveAt: "2026-10-17T00:00:00Z",
    schemaVersion: 1,
    calendar: {
      customer: emptyCalendarDefinition(),
      production: emptyCalendarDefinition(),
    },
  };
}
const command = (day: CalendarDay): ShopCalendarDraft => ({
  domain: "customer",
  baseVersion: 0,
  baseRevisionId: null,
  definition: { week: Array.from({ length: 7 }, () => day), exceptions: [] },
});
describe("SET-02 SS-02/09 calendar validation", () => {
  it("saves incomplete drafts but rejects invalid publication and invented fields", () => {
    const c = command(open("", ""));
    expect(shopCalendarDraftSchema.safeParse(c).success).toBe(true);
    expect(shopCalendarCommandSchema.safeParse(c).success).toBe(false);
    expect(
      shopCalendarCommandSchema.safeParse({
        ...command(emptyCalendarDay()),
        effectiveAt: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      shopCalendarCommandSchema.safeParse({
        ...command(emptyCalendarDay()),
        baseVersion: 1,
      }).success,
    ).toBe(false);
  });
  it("supports midnight split and adjacency; rejects overnight, duplicate and inverted ranges", () => {
    for (const [start, end] of [
      ["23:00", "24:00"],
      ["00:00", "02:00"],
    ])
      expect(calendarDayErrors(open(start, end), "customer")).toEqual([]);
    for (const [start, end] of [
      ["23:00", "02:00"],
      ["24:00", "24:00"],
      ["10:00", "10:00"],
      ["09:60", "12:00"],
    ])
      expect(calendarDayErrors(open(start, end), "customer")).toContain(
        "invalidRanges",
      );
    expect(
      calendarDayErrors(
        {
          ...open(),
          ranges: [
            { start: "09:00", end: "12:00" },
            { start: "12:00", end: "15:00" },
          ],
        },
        "customer",
      ),
    ).toEqual([]);
    expect(
      calendarDayErrors(
        { ...open(), ranges: [...open().ranges, ...open().ranges] },
        "customer",
      ),
    ).toContain("invalidRanges");
  });
  it("contains breaks and slots inside net customer availability without manufacturing durations", () => {
    const day = {
      ...open(),
      breaks: {
        state: "defined" as const,
        ranges: [{ start: "12:00", end: "13:00" }],
      },
      slots: {
        state: "defined" as const,
        ranges: [{ start: "11:30", end: "12:30" }],
      },
    };
    expect(calendarDayErrors(day, "customer")).toContain("slotOutside");
    day.slots.ranges = [{ start: "13:00", end: "13:20" }];
    expect(calendarDayErrors(day, "customer")).toEqual([]);
    expect(calendarDayErrors(day, "production")).toContain("productionSlots");
    day.breaks.ranges = [{ start: "08:00", end: "09:30" }];
    expect(calendarDayErrors(day, "customer")).toContain("breakOutside");
  });
  it("validates leap dates and unique independent exception dates", () => {
    expect(localDateValid("2024-02-29")).toBe(true);
    for (const d of ["2025-02-29", "2026-04-31", "0000-01-01", "2026-13-01"])
      expect(localDateValid(d)).toBe(false);
    const c = command(emptyCalendarDay());
    c.definition.exceptions.push({
      date: "2024-02-29",
      day: emptyCalendarDay("closed"),
    });
    expect(shopCalendarCommandSchema.safeParse(c).success).toBe(true);
    c.definition.exceptions.push({
      date: "2024-02-29",
      day: emptyCalendarDay("closed"),
    });
    expect(shopCalendarCommandSchema.safeParse(c).success).toBe(false);
  });
  it("property: contained nonzero ranges retain exact net minutes", () => {
    const time = (n: number) =>
      n === 1440
        ? "24:00"
        : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1438 }),
        fc.integer({ min: 1, max: 1440 }),
        (a, width) => {
          const b = Math.min(1440, a + width),
            r = revision();
          r.calendar.customer.week = Array.from({ length: 7 }, () =>
            open(time(a), time(b)),
          );
          const result = resolveCalendarDate(r, "customer", "2026-12-31");
          expect(result.state).toBe("open");
          if (result.state !== "unknown")
            expect(result.intervals.reduce((n, [s, e]) => n + e - s, 0)).toBe(
              b - a,
            );
        },
      ),
      { numRuns: 200 },
    );
  });
});
describe("DAY-06 SET-08 SS-07 calendar resolution and history", () => {
  it("keeps missing unknown and explicit closures zero, with bounded year/week/leap arithmetic", () => {
    const r = revision();
    expect(
      countCalendarWorkingDays(null, "customer", "2024-02-28", "2024-03-01")
        .state,
    ).toBe("unknown");
    expect(
      countCalendarWorkingDays(r, "customer", "2024-02-28", "2024-03-01").state,
    ).toBe("unknown");
    r.calendar.customer.week = Array.from({ length: 7 }, () =>
      emptyCalendarDay("closed"),
    );
    expect(
      countCalendarWorkingDays(r, "customer", "2026-12-28", "2027-01-04"),
    ).toMatchObject({ state: "known", count: 0 });
    r.calendar.customer.week = Array.from({ length: 7 }, () => open());
    expect(
      countCalendarWorkingDays(r, "customer", "2024-02-28", "2024-03-01"),
    ).toMatchObject({ state: "known", count: 2 });
    expect(
      countCalendarWorkingDays(r, "customer", "2026-01-01", "2040-01-01"),
    ).toMatchObject({ state: "unknown", reason: "horizonExceeded" });
  });
  it("replaces one domain only, subtracts breaks and preserves the pinned old revision", () => {
    const old = revision();
    old.calendar.customer.week = Array.from({ length: 7 }, () => ({
      ...open(),
      breaks: { state: "defined", ranges: [{ start: "12:00", end: "13:00" }] },
    }));
    old.calendar.production.week = Array.from({ length: 7 }, () =>
      open("18:00", "24:00"),
    );
    const changed = structuredClone(old);
    changed.calendar.customer.exceptions = [
      { date: "2026-10-17", day: emptyCalendarDay("closed") },
    ];
    expect(
      resolveCalendarDate(changed, "customer", "2026-10-17"),
    ).toMatchObject({ state: "closed", source: "exception" });
    expect(
      resolveCalendarDate(changed, "production", "2026-10-17"),
    ).toMatchObject({ state: "open", intervals: [[1080, 1440]] });
    expect(resolveCalendarDate(old, "customer", "2026-10-17")).toMatchObject({
      state: "open",
      intervals: [
        [540, 720],
        [780, 1020],
      ],
    });
  });
  it("previews seven local dates and exception precedence without publication", () => {
    const draft = command(open());
    draft.definition.exceptions = [
      { date: "2026-12-31", day: emptyCalendarDay("closed") },
    ];
    const preview = previewShopCalendar({ draft, date: "2026-12-28" });
    expect(preview.days).toHaveLength(7);
    expect(preview.days[3]).toMatchObject({
      date: "2026-12-31",
      state: "closed",
      source: "exception",
    });
    expect(preview.days[6]?.date).toBe("2027-01-03");
  });
});
