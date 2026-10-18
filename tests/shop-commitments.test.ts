import { randomUUID } from "node:crypto";
import {
  emptyCalendarDefinition,
  type ShopCalendarRevision,
} from "@aarili/contracts/shop-calendar";
import {
  commitmentPreviewInputSchema,
  initialCommitmentConfiguration,
  initialCommitmentScenario,
  shopCommitmentsCommandSchema,
  shopCommitmentsDraftSchema,
  syntheticCommitmentConfiguration,
} from "@aarili/contracts/shop-commitments";
import {
  capacityWeek,
  evaluateCommitment,
} from "@aarili/core/commitment-evaluator";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const shopId = randomUUID();
const category = {
  shopId,
  id: "SYNTHETIC",
  version: "1",
  eligible: true,
  synthetic: true,
  warningDays: 7,
};
const configuration = syntheticCommitmentConfiguration();
const scenario = initialCommitmentScenario();
const base = {
  shopId,
  configuration,
  configurationSource: "fixture-rule-v1",
  calendar: null,
  category,
  load: {
    quantity: 10,
    unit: "garments" as const,
    weekStart: "2026-10-19",
    source: "SYNTHETIC-load-v1",
    asOf: "2026-10-20",
  },
  scenario,
  previousFingerprint: null,
};
describe("SET-06/08/09/11 SS-05/06 AC-28/60 commitment preview boundary", () => {
  it("retains unbound incomplete drafts and validates numeric/date publication without activating", () => {
    const d = {
      baseVersion: 0,
      baseRevisionId: null,
      configuration: initialCommitmentConfiguration(),
    };
    expect(shopCommitmentsCommandSchema.safeParse(d).success).toBe(true);
    expect(
      shopCommitmentsDraftSchema.safeParse({
        ...d,
        configuration: { ...configuration, cap: -1 },
      }).success,
    ).toBe(true);
    expect(
      shopCommitmentsCommandSchema.safeParse({
        ...d,
        configuration: { ...configuration, cap: -1 },
      }).success,
    ).toBe(false);
    expect(
      shopCommitmentsCommandSchema.safeParse({ ...d, activate: true }).success,
    ).toBe(false);
    expect(
      shopCommitmentsCommandSchema.safeParse({
        ...d,
        configuration: { ...configuration, rushPaise: "0" },
      }).success,
    ).toBe(true);
    expect(
      shopCommitmentsCommandSchema.safeParse({
        ...d,
        configuration: { ...configuration, rushPaise: "9007199254740992" },
      }).success,
    ).toBe(false);
  });
  it("AC-60 shows cap, cutoff and rush with separate decisions and no financial effect", async () => {
    const r = await evaluateCommitment(base);
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        "capacityExceeded",
        "cutoffPassed",
        "rush",
        "deliveryWindow",
      ]),
    );
    expect(r.facts).toMatchObject({
      cap: 10,
      existing: 10,
      candidate: 1,
      total: 11,
      rushPaise: "50000",
      leadDays: 2,
    });
    const missing = await evaluateCommitment({
      ...base,
      scenario: { ...scenario, review: true, waiver: true },
    });
    expect(missing.decisions.errors).toContain("exceptionReasonRequired");
    expect(missing.decisions.errors).toContain("waiverReasonRequired");
    const waived = await evaluateCommitment({
      ...base,
      scenario: {
        ...scenario,
        review: true,
        acknowledge: true,
        waiver: true,
        exceptionReason: "Synthetic owner exception",
        waiverReason: "Synthetic waiver",
      },
    });
    expect(waived.warnings).toEqual(r.warnings);
    expect(waived.decisions.state).toBe("recorded-preview");
    expect(waived.effects).toBe("none");
    expect(waived.activation).toBe("unavailable");
  });
  it("known warning and missing load/category remain visible together", async () => {
    const r = await evaluateCommitment({ ...base, load: null, category: null });
    expect(r.state).toBe("warning");
    expect(r.unknowns).toEqual(
      expect.arrayContaining(["loadMissing", "categoryUnresolved"]),
    );
    expect(r.warnings).toContain("cutoffPassed");
    expect(r.facts.total).toBeNull();
    const foreign = await evaluateCommitment({
      ...base,
      category: { ...category, shopId: randomUUID() },
    });
    expect(foreign.unknowns).toContain("categoryUnresolved");
  });
  it("equality is allowed at the reviewed cap, lead-time and cutoff boundaries", async () => {
    const r = await evaluateCommitment({
      ...base,
      configuration: { ...configuration, leadDays: 2 },
      load: { ...base.load, quantity: 9 },
      scenario: {
        ...scenario,
        bookingDate: "2026-10-18",
        bookingTime: "18:00",
        deliveryDate: "2026-10-20",
        today: "2026-10-18",
      },
    });
    expect(r.warnings).not.toContain("capacityExceeded");
    expect(r.warnings).not.toContain("cutoffPassed");
    expect(r.warnings).not.toContain("rush");
    expect(r.facts.warningWindow).toBe(7);
    expect(
      (
        await evaluateCommitment({
          ...base,
          category: { ...category, warningDays: 1 },
        })
      ).facts.warningWindow,
    ).toBe(3);
  });
  it("does not turn unknown or zero into the other, or convert demand units", async () => {
    const z = await evaluateCommitment({
      ...base,
      configuration: { ...configuration, cap: 0, rushPaise: "0" },
    });
    expect(z.facts.cap).toBe(0);
    expect(z.facts.rushPaise).toBe("0");
    expect(z.warnings).toContain("capacityExceeded");
    const u = await evaluateCommitment({
      ...base,
      configuration: { ...configuration, cap: null, rushPaise: null },
    });
    expect(u.unknowns).toContain("capacityCapMissing");
    expect(u.unknowns).toContain("rushSuggestionMissing");
    expect(
      (
        await evaluateCommitment({
          ...base,
          scenario: { ...scenario, unit: "effort-points" },
        })
      ).unknowns,
    ).toContain("unitMismatch");
    expect(
      (
        await evaluateCommitment({
          ...base,
          scenario: { ...scenario, occasion: "Festival" },
        })
      ).facts.rush,
    ).toBe(true);
  });
  it("requires an explicit production calendar and counts all-closed days honestly", async () => {
    const config = {
      ...configuration,
      leadBasis: "production" as const,
      warningBasis: "production" as const,
    };
    expect(
      (await evaluateCommitment({ ...base, configuration: config })).unknowns,
    ).toContain("calendarUnresolved");
    const definition = emptyCalendarDefinition();
    definition.week = definition.week.map(() => ({
      state: "closed",
      ranges: [],
      breaks: { state: "none", ranges: [] },
      slots: { state: "none", ranges: [] },
    }));
    const calendar: ShopCalendarRevision = {
      id: randomUUID(),
      version: 1,
      previousId: null,
      actorId: randomUUID(),
      effectiveAt: "2026-01-01T00:00:00.000Z",
      originDraftId: randomUUID(),
      schemaVersion: 1,
      calendar: { customer: definition, production: definition },
    };
    const r = await evaluateCommitment({
      ...base,
      configuration: config,
      calendar,
    });
    expect(r.facts.leadDays).toBe(0);
    expect(r.warnings).toContain("noProductionAvailability");
    const overdue = await evaluateCommitment({
      ...base,
      scenario: {
        ...scenario,
        today: scenario.deliveryDate,
        nowTime: "12:01",
        deliveryTime: "12:00",
      },
    });
    expect(overdue.warnings).toContain("overdue");
  });
  it("new sources make a prior preview stale; acknowledgement is not a source change", async () => {
    const a = await evaluateCommitment(base);
    expect(
      (
        await evaluateCommitment({
          ...base,
          previousFingerprint: a.fingerprint,
          scenario: { ...scenario, acknowledge: true },
        })
      ).stale,
    ).toBe(false);
    expect(
      (
        await evaluateCommitment({
          ...base,
          configurationSource: "new-rule-v2",
          previousFingerprint: a.fingerprint,
        })
      ).stale,
    ).toBe(true);
    const p = {
      source: {
        kind: "draft",
        draft: { baseVersion: 0, baseRevisionId: null, configuration },
      },
      calendarRevisionId: null,
      scenario,
      previousFingerprint: null,
    };
    expect(
      commitmentPreviewInputSchema.safeParse({ ...p, load: { quantity: 0 } })
        .success,
    ).toBe(false);
    expect(
      commitmentPreviewInputSchema.safeParse({
        ...p,
        scenario: { ...scenario, deliveryDate: "2026-02-30" },
      }).success,
    ).toBe(false);
  });
  it("week buckets contain their delivery date across year boundaries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20000 }),
        fc.integer({ min: 0, max: 6 }),
        (offset, start) => {
          const d = new Date(Date.UTC(2000, 0, 1 + offset))
            .toISOString()
            .slice(0, 10);
          const w = capacityWeek(d, start);
          if (!w) throw Error("Expected a representable capacity week");
          expect(w.start <= d && d < w.end).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
    expect(capacityWeek("2027-01-01", 0)).toEqual({
      start: "2026-12-28",
      end: "2027-01-04",
    });
    expect(capacityWeek("9999-12-31", 0)).toBeNull();
    expect(capacityWeek("0001-01-01", 6)).toBeNull();
    expect(capacityWeek("2026-10-20", 1.5)).toBeNull();
  });
  it("returns clear only for complete synthetic facts and invalidates changed load", async () => {
    const complete = {
      ...base,
      load: { ...base.load, weekStart: "2026-10-26" },
      scenario: {
        ...scenario,
        today: "2026-10-01",
        bookingDate: "2026-10-01",
        deliveryDate: "2026-11-01",
        quantity: 0,
      },
    };
    const clear = await evaluateCommitment(complete);
    expect(clear.state).toBe("clear");
    expect(clear.unknowns).toEqual([]);
    const changed = await evaluateCommitment({
      ...complete,
      load: { ...complete.load, quantity: 11 },
      previousFingerprint: clear.fingerprint,
    });
    expect(changed.stale).toBe(true);
    expect(changed.warnings).toContain("capacityExceeded");
    expect((await evaluateCommitment({ ...complete, load: null })).state).toBe(
      "unknown",
    );
  });
  it("occasion alone cannot imply rush or a charge; overlapping cutoffs remain visible", async () => {
    const safe = {
      ...base,
      configuration: { ...configuration, leadDays: 0, peaks: [] },
      scenario: {
        ...scenario,
        priority: "normal" as const,
        occasion: "Wedding",
        quantity: 0,
      },
    };
    const r = await evaluateCommitment(safe);
    expect(r.facts.rush).toBe(false);
    expect(r.facts.rushPaise).toBeNull();
    expect(r.warnings).not.toContain("rush");
    const firstPeak = configuration.peaks[0];
    if (!firstPeak) throw Error("Missing labelled synthetic peak");
    const overlapping = await evaluateCommitment({
      ...base,
      configuration: {
        ...configuration,
        peaks: [
          ...configuration.peaks,
          {
            ...firstPeak,
            label: "Second synthetic peak",
            cutoffTime: "00:00",
          },
        ],
      },
    });
    expect(overlapping.facts.cutoffs).toHaveLength(2);
    expect(
      overlapping.warnings.filter((w) => w === "cutoffPassed"),
    ).toHaveLength(1);
  });
});
