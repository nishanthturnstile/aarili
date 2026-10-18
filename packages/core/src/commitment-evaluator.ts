import type { ShopCalendarRevision } from "@aarili/contracts/shop-calendar";
import { localDateValid } from "@aarili/contracts/shop-calendar";
import type {
  CommitmentConfiguration,
  CommitmentPreview,
  CommitmentScenario,
} from "@aarili/contracts/shop-commitments";
import { commitmentErrors } from "@aarili/contracts/shop-commitments";
import { requestHash } from "./request-binding.js";
import {
  countCalendarWorkingDays,
  resolveCalendarDate,
} from "./shop-calendar.js";

// 1.1.2 implements this repository-side seam. Browser input never satisfies it.
export type ApprovedCategoryRef = {
  shopId: string;
  id: string;
  version: string;
  warningDays: number | null;
  eligible: boolean;
  synthetic: boolean;
};
export interface ApprovedCategoryResolver {
  resolve(id: string): Promise<ApprovedCategoryRef | null>;
}
export type CommitmentLoad = {
  quantity: number;
  unit: "garments" | "effort-points";
  weekStart: string;
  source: string;
  asOf: string;
};
export function calendarDistance(start: string, end: string) {
  return (
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86400000
  );
}
export function capacityWeek(date: string, mondayBasedStart: number) {
  if (
    !localDateValid(date) ||
    !Number.isInteger(mondayBasedStart) ||
    mondayBasedStart < 0 ||
    mondayBasedStart > 6
  )
    return null;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(
    d.getUTCDate() - ((((d.getUTCDay() + 6) % 7) - mondayBasedStart + 7) % 7),
  );
  const start = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 7);
  const end = d.toISOString().split("T")[0] ?? "";
  return localDateValid(start) && localDateValid(end) ? { start, end } : null;
}
export async function evaluateCommitment(input: {
  shopId: string;
  configuration: CommitmentConfiguration;
  configurationSource: string;
  calendar: ShopCalendarRevision | null;
  category: ApprovedCategoryRef | null;
  load: CommitmentLoad | null;
  scenario: CommitmentScenario;
  previousFingerprint: string | null;
  // Set only by the server after resolving a reviewed binding. Never from v1 DTOs.
  boundAuthority?: { reviewed: boolean; sources: Record<string, string> };
}): Promise<CommitmentPreview> {
  const { configuration: c, scenario: s, calendar, load } = input;
  const warnings: string[] = [],
    unknowns: string[] = [];
  const unknown = (v: string) => {
    if (!unknowns.includes(v)) unknowns.push(v);
  };
  const warn = (v: string) => {
    if (!warnings.includes(v)) warnings.push(v);
  };
  const category =
    input.category?.shopId === input.shopId && input.category.eligible
      ? input.category
      : null;
  if (!category) unknown("categoryUnresolved");
  if (s.mode === "production" && category?.synthetic)
    unknown("syntheticCategoryDenied");
  if (commitmentErrors(c).length) unknown("invalidConfiguration");
  if (
    !input.boundAuthority?.reviewed &&
    (c.authority !== "synthetic-fixture" || s.mode === "production")
  )
    unknown("productionAuthorityPending");
  if (c.escalation === "unconfigured") unknown("escalationUnconfigured");
  const dayCount = (
    start: string,
    end: string,
    basis: "calendar" | "production" | null,
  ): number | null => {
    if (!basis) {
      unknown("countBasisMissing");
      return null;
    }
    if (basis === "calendar") return calendarDistance(start, end);
    const r = countCalendarWorkingDays(calendar, "production", start, end);
    if (r.state === "unknown") {
      unknown("calendarUnresolved");
      return null;
    }
    return r.count;
  };
  const effectiveWindow =
    c.warningDays === null
      ? null
      : Math.max(c.warningDays, category?.warningDays ?? 0);
  if (c.warningDays === null) unknown("warningWindowMissing");
  const distance =
    s.deliveryDate < s.today
      ? calendarDistance(s.today, s.deliveryDate)
      : dayCount(s.today, s.deliveryDate, c.warningBasis);
  if (
    distance !== null &&
    effectiveWindow !== null &&
    distance >= 0 &&
    distance <= effectiveWindow
  )
    warn("deliveryWindow");
  if (s.deliveryDate < s.today) warn("overdue");
  if (s.deliveryDate === s.today) {
    if (s.deliveryTime) {
      if (s.nowTime > s.deliveryTime) warn("overdue");
    } else {
      const r = resolveCalendarDate(calendar, "production", s.today);
      if (r.state === "unknown") unknown("workingDayEndUnresolved");
      else if (r.state === "closed") warn("noProductionAvailability");
      else {
        const last = r.intervals.at(-1)?.[1];
        const [h, m] = s.nowTime.split(":").map(Number);
        if (last !== undefined && (h ?? 0) * 60 + (m ?? 0) > last)
          warn("overdue");
      }
    }
  }
  const lead = dayCount(s.bookingDate, s.deliveryDate, c.leadBasis);
  if (c.leadDays === null) unknown("leadTimeMissing");
  const rush =
    s.priority === "rush" ||
    (lead !== null && c.leadDays !== null && lead < c.leadDays);
  if (rush) warn("rush");
  if (
    c.leadBasis === "production" &&
    lead === 0 &&
    s.bookingDate < s.deliveryDate
  )
    warn("noProductionAvailability");
  if (rush && c.rushPaise === null) unknown("rushSuggestionMissing");
  const week =
    c.weekStart === null ? null : capacityWeek(s.deliveryDate, c.weekStart);
  if (!week || !c.allocation) unknown("capacityConventionMissing");
  if (c.cap === null) unknown("capacityCapMissing");
  if (c.cap === 0 && !c.zeroCap) unknown("zeroCapConventionMissing");
  if (!c.unit || !s.unit || s.quantity === null)
    unknown("candidateDemandMissing");
  if (!load) unknown("loadMissing");
  let total: number | null = null;
  if (load && week && c.unit && s.unit && s.quantity !== null) {
    if (load.unit !== c.unit || s.unit !== c.unit) unknown("unitMismatch");
    else if (load.weekStart !== week.start) unknown("loadBucketMismatch");
    else if (
      !Number.isSafeInteger(load.quantity) ||
      load.quantity < 0 ||
      !Number.isSafeInteger(load.quantity + s.quantity)
    )
      unknown("invalidLoad");
    else {
      total = load.quantity + s.quantity;
      if (c.cap !== null && total > c.cap && (c.cap !== 0 || c.zeroCap))
        warn("capacityExceeded");
    }
  }
  const peaks = c.peaks.filter(
    (p) => p.start <= s.deliveryDate && p.end >= s.deliveryDate,
  );
  if (peaks.length && (!c.peakConvention || !c.cutoffBoundary))
    unknown("peakConventionMissing");
  else
    for (const p of peaks)
      if (
        `${s.bookingDate}T${s.bookingTime}` > `${p.cutoffDate}T${p.cutoffTime}`
      )
        warn("cutoffPassed");
  const sources: CommitmentPreview["sources"] = {
    evaluator: "commitments-v1",
    configuration: input.configurationSource,
    calendar: calendar ? `${calendar.id}:v${calendar.version}` : null,
    category: category ? `${category.id}:${category.version}` : null,
    load: load?.source ?? null,
    asOf: load?.asOf ?? null,
    synthetic: s.mode === "synthetic",
  };
  const {
    acknowledge: _a,
    review: _r,
    exceptionReason: _e,
    waiver: _w,
    waiverReason: _wr,
    ...candidate
  } = s;
  const fingerprint = await requestHash({
    configuration: c,
    sources,
    load,
    candidate,
    ...(input.boundAuthority ? { binding: input.boundAuthority.sources } : {}),
  });
  const errors: string[] = [];
  if (s.review) {
    if (warnings.length && !s.exceptionReason.trim())
      errors.push("exceptionReasonRequired");
    if (s.waiver && (!rush || c.rushPaise === null || !s.waiverReason.trim()))
      errors.push("waiverReasonRequired");
    if (unknowns.length) errors.push("unresolvedInputs");
  }
  return {
    state: warnings.length ? "warning" : unknowns.length ? "unknown" : "clear",
    warnings,
    unknowns,
    facts: {
      warningWindow: effectiveWindow,
      deliveryDistance: distance,
      leadDays: lead,
      requiredLead: c.leadDays,
      cap: c.cap,
      existing: load?.quantity ?? null,
      candidate: s.quantity,
      total,
      unit: c.unit,
      weekStart: week?.start ?? null,
      weekEndExclusive: week?.end ?? null,
      cutoffs: peaks.map((p) => ({
        label: p.label,
        date: p.cutoffDate,
        time: p.cutoffTime,
      })),
      rush,
      rushPaise: rush ? c.rushPaise : null,
    },
    sources,
    fingerprint,
    stale:
      input.previousFingerprint !== null &&
      input.previousFingerprint !== fingerprint,
    decisions: {
      state: !s.review
        ? "inspection"
        : errors.length
          ? "incomplete"
          : "recorded-preview",
      errors,
      acknowledged: s.acknowledge,
      waived: s.waiver,
    },
    binding: "unbound",
    activation: "unavailable",
    effects: "none",
  };
}
