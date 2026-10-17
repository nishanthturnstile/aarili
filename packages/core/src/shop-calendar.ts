import {
  type CalendarDefinition,
  type CalendarDomain,
  calendarDayErrors,
  calendarIntervals,
  calendarPreviewInputSchema,
  emptyCalendarDefinition,
  localDateValid,
  type ShopCalendarRevision,
  shopCalendarCommandSchema,
  shopCalendarDraftSchema,
  shopCalendarHistoryQuerySchema,
  subtractCalendarBreaks,
} from "@aarili/contracts/shop-calendar";
import type { ShopCalendarRepository } from "@aarili/db/repositories/shop-calendar";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";

export type ShopCalendarContext = {
  shopId: string;
  actorId: string;
  repository: ShopCalendarRepository;
};
function fail(
  status: 404 | 409 | 412 | 422,
  code:
    | "NOT_FOUND"
    | "REQUEST_CONFLICT"
    | "VERSION_STALE"
    | "VALIDATION_FAILED",
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Calendar request rejected" },
  });
}
export async function readShopCalendar(ctx: ShopCalendarContext) {
  const revision = await ctx.repository.current();
  return { version: revision?.version ?? 0, revision: revision ?? null };
}
export async function readShopCalendarRevision(
  ctx: ShopCalendarContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readShopCalendarHistory(
  ctx: ShopCalendarContext,
  input: unknown,
) {
  const q = shopCalendarHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.history(q.data.beforeVersion);
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function shopCalendarDraftWorkflow(
  ctx: ShopCalendarContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: shopCalendarDraftSchema,
    commandSchema: shopCalendarCommandSchema,
    async revalidate(command) {
      const c = shopCalendarCommandSchema.parse(command);
      await ctx.repository.lock();
      const current = await readShopCalendar(ctx);
      if (
        current.version !== c.baseVersion ||
        (current.revision?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
    },
    async promote(command, _actionId, draftId, request) {
      const c = shopCalendarCommandSchema.parse(command);
      const current = await readShopCalendar(ctx);
      // Revalidate and promote run under the same transaction/aggregate lock.
      if (
        current.version !== c.baseVersion ||
        (current.revision?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
      const calendar = current.revision?.calendar ?? {
        customer: emptyCalendarDefinition(),
        production: emptyCalendarDefinition(),
      };
      const revision = await ctx.repository.append({
        calendar: { ...calendar, [c.domain]: c.definition },
        version: current.version + 1,
        previousId: current.revision?.id ?? null,
        actorId: ctx.actorId,
        originDraftId: draftId,
        key: request.key,
        requestId: request.requestId,
        domain: c.domain,
      });
      if (!(await ctx.repository.advance(revision, current.version)))
        fail(412, "VERSION_STALE");
      return { type: "shop.calendar.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "shop.calendar.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
export type CalendarResolution =
  | {
      state: "unknown";
      reason:
        | "missingRevision"
        | "invalidDate"
        | "invalidConfiguration"
        | "unconfigured";
    }
  | {
      state: "closed" | "open";
      source: "week" | "exception";
      intervals: [number, number][];
      revisionId: string;
    };
export function resolveCalendarDate(
  revision: ShopCalendarRevision | null,
  domain: CalendarDomain,
  date: string,
): CalendarResolution {
  if (!localDateValid(date)) return { state: "unknown", reason: "invalidDate" };
  if (!revision) return { state: "unknown", reason: "missingRevision" };
  return resolveDefinition(
    revision.calendar[domain],
    domain,
    date,
    revision.id,
  );
}
function resolveDefinition(
  def: CalendarDefinition,
  domain: CalendarDomain,
  date: string,
  revisionId: string,
): CalendarResolution {
  if (!localDateValid(date)) return { state: "unknown", reason: "invalidDate" };
  const exceptions = def.exceptions.filter((e) => e.date === date);
  if (exceptions.length > 1)
    return { state: "unknown", reason: "invalidConfiguration" };
  const exception = exceptions[0];
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const day = exception?.day ?? def.week[weekday];
  if (!day || calendarDayErrors(day, domain).length)
    return { state: "unknown", reason: "invalidConfiguration" };
  if (
    day.state === "unconfigured" ||
    (day.state === "open" && day.breaks.state === "unconfigured")
  )
    return { state: "unknown", reason: "unconfigured" };
  const intervals =
    day.state === "closed"
      ? []
      : subtractCalendarBreaks(
          calendarIntervals(day.ranges) ?? [],
          calendarIntervals(day.breaks.ranges) ?? [],
        );
  return {
    state: intervals.length ? "open" : "closed",
    source: exception ? "exception" : "week",
    intervals,
    revisionId,
  };
}
export function countCalendarWorkingDays(
  revision: ShopCalendarRevision | null,
  domain: CalendarDomain,
  start: string,
  endExclusive: string,
) {
  if (
    !localDateValid(start) ||
    !localDateValid(endExclusive) ||
    endExclusive < start
  )
    return { state: "unknown" as const, reason: "invalidDate" };
  const cursor = new Date(`${start}T00:00:00Z`);
  let count = 0,
    visited = 0;
  while (cursor.toISOString().slice(0, 10) < endExclusive) {
    if (++visited > 3660)
      return { state: "unknown" as const, reason: "horizonExceeded" };
    const result = resolveCalendarDate(
      revision,
      domain,
      cursor.toISOString().slice(0, 10),
    );
    if (result.state === "unknown") return result;
    if (result.state === "open") count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!revision)
    return { state: "unknown" as const, reason: "missingRevision" };
  return { state: "known" as const, count, revisionId: revision.id };
}

// Pure non-authoritative seven-date preview; it cannot issue a revision or order.
export function previewShopCalendar(input: unknown) {
  const parsed = calendarPreviewInputSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const { draft, date } = parsed.data;
  const cursor = new Date(`${date}T00:00:00Z`);
  const days = Array.from({ length: 7 }, () => {
    const local = cursor.toISOString().slice(0, 10);
    const result = resolveDefinition(
      draft.definition,
      draft.domain,
      local,
      draft.baseRevisionId ?? "",
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return {
      date: local,
      state: result.state,
      intervals: result.state === "unknown" ? [] : result.intervals,
      ...(result.state === "unknown" ? {} : { source: result.source }),
    };
  });
  return { days };
}
