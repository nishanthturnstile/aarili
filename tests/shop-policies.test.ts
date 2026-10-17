import {
  emptyPolicy,
  policyErrors,
  policyKinds,
  type ShopPoliciesRevision,
  shopPoliciesCommandSchema,
  shopPoliciesDraftSchema,
} from "@aarili/contracts/shop-policies";
import { policyReadiness } from "@aarili/core/shop-policies";
import { shopPoliciesMessages } from "@aarili/i18n";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const command = () => ({
  baseVersion: 0,
  baseRevisionId: null,
  policy: {
    ...emptyPolicy("advance"),
    kind: "advance" as const,
    state: "reviewed" as const,
    percentageBps: 0,
    terms: { en: "Synthetic only", ta: "சோதனை மட்டும்" },
    authority: {
      kind: "synthetic-fixture" as const,
      label: "Issue 87 fixture",
    },
  },
});
describe("SET-05/08/09 SS-04 AC-44 limited configuration and action readiness", () => {
  it("SS-10 supplies the same complete message keys in English and Tamil", () => {
    expect(Object.keys(shopPoliciesMessages.en).sort()).toEqual(
      Object.keys(shopPoliciesMessages.ta).sort(),
    );
    for (const message of Object.values(shopPoliciesMessages.ta))
      expect(message).not.toMatch(/\?{3}/);
  });
  it("keeps incomplete typed drafts, explicit zero and production authority separate", () => {
    const c = command();
    expect(shopPoliciesCommandSchema.safeParse(c).success).toBe(true);
    expect(
      shopPoliciesDraftSchema.safeParse({
        ...c,
        policy: { ...c.policy, percentageBps: null },
      }).success,
    ).toBe(true);
    expect(
      shopPoliciesCommandSchema.safeParse({
        ...c,
        policy: { ...c.policy, percentageBps: null },
      }).success,
    ).toBe(false);
    expect(
      shopPoliciesCommandSchema.safeParse({
        ...c,
        policy: {
          ...c.policy,
          authority: { kind: "owner-proposal", label: "Owner" },
        },
      }).success,
    ).toBe(false);
    expect(
      shopPoliciesCommandSchema.safeParse({
        ...c,
        policy: { ...c.policy, productionReviewed: true },
      }).success,
    ).toBe(false);
    expect(
      shopPoliciesCommandSchema.safeParse({
        ...c,
        policy: { ...c.policy, terms: { en: "Only English", ta: " " } },
      }).success,
    ).toBe(false);
  });
  it("accepts only exact bounded basis points; never coalesces unknown to zero", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), (n) => {
        expect(
          shopPoliciesCommandSchema.safeParse({
            ...command(),
            policy: { ...command().policy, percentageBps: n },
          }).success,
        ).toBe(n >= 0 && n <= 10000);
      }),
    );
  });
  it("validates every policy's nullable typed decisions and consistent charge basis", () => {
    for (const kind of policyKinds)
      expect(
        policyErrors({
          ...emptyPolicy(kind),
          state: "reviewed",
          terms: command().policy.terms,
          authority: command().policy.authority,
        }),
      ).toContain("valuesRequired");
    const base = {
      ...command().policy,
      kind: "cancellation" as const,
      chargeBasis: "fixed-paise" as const,
      amountPaise: "0",
      percentageBps: null,
      approval: "owner" as const,
    };
    // Construct the actual discriminated shape rather than accepting alien fields.
    const charge = {
      ...emptyPolicy("cancellation"),
      state: "reviewed" as const,
      terms: base.terms,
      authority: base.authority,
      chargeBasis: base.chargeBasis,
      amountPaise: base.amountPaise,
      percentageBps: null,
      approval: base.approval,
    };
    expect(policyErrors(charge)).toEqual([]);
    for (const amountPaise of ["-1", "1.5", "01", "9007199254740992"])
      expect(policyErrors({ ...charge, amountPaise })).toContain(
        "valuesRequired",
      );
    expect(policyErrors({ ...charge, percentageBps: 1 })).toContain(
      "valuesRequired",
    );
  });
  it("N/A needs reasons and cannot satisfy mandatory actions; fixtures never make actions ready", () => {
    const c = command();
    const policy = {
      ...c.policy,
      state: "not-applicable" as const,
      reason: "Synthetic scope decision",
    };
    expect(shopPoliciesCommandSchema.safeParse({ ...c, policy }).success).toBe(
      true,
    );
    expect(
      shopPoliciesCommandSchema.safeParse({
        ...c,
        policy: { ...policy, reason: "" },
      }).success,
    ).toBe(false);
    const r = {
      id: crypto.randomUUID(),
      version: 1,
      previousId: null,
      actorId: crypto.randomUUID(),
      originDraftId: crypto.randomUUID(),
      schemaVersion: 1,
      effectiveAt: new Date().toISOString(),
      authorityScope: "synthetic-only",
      policies: [policy],
    } satisfies ShopPoliciesRevision;
    for (const revision of [null, r]) {
      const actions = policyReadiness(revision).actions;
      expect(
        actions.find((a) => a.action === "customerRegistration")?.state,
      ).toBe("available");
      expect(
        actions.find((a) => a.action === "wearerRegistration")?.state,
      ).toBe("available");
      expect(actions.find((a) => a.action === "draftQuote")?.reasons).toEqual([
        { code: "actionNotImplemented" },
      ]);
      expect(
        actions.find((a) => a.action === "paymentRecording")?.reasons,
      ).toContainEqual({ code: "receivingAccountsNotIntegrated" });
      expect(
        actions.find((a) => a.action === "billIssue")?.reasons,
      ).toContainEqual({ code: "billFormatNotImplemented" });
      expect(actions.find((a) => a.action === "retailReturn")?.state).toBe(
        "release-ineligible",
      );
      for (const a of actions.filter(
        (a) =>
          ![
            "profileSave",
            "customerRegistration",
            "wearerRegistration",
            "calendarSave",
            "retailReturn",
          ].includes(a.action),
      ))
        expect(a.state).toBe("not-yet-implemented");
    }
    expect(
      policyReadiness(r).actions.find((a) => a.action === "bindingQuote")
        ?.reasons,
    ).toContainEqual({ code: "policyNotApplicable", policy: "advance" });
  });
  it("records explicit reviewed typed decisions for every supported policy without defaults", () => {
    const common = {
      state: "reviewed" as const,
      terms: command().policy.terms,
      authority: command().policy.authority,
    };
    const policies = [
      { ...emptyPolicy("quoteValidity"), ...common, calendarDays: 1 },
      {
        ...emptyPolicy("discount"),
        ...common,
        maximumBps: 0,
        approval: "owner" as const,
      },
      {
        ...emptyPolicy("changeCharges"),
        ...common,
        chargeBasis: "case-by-case" as const,
        approval: "owner" as const,
      },
      {
        ...emptyPolicy("trialRework"),
        ...common,
        includedTrials: 0,
        approval: "owner" as const,
      },
      {
        ...emptyPolicy("creditHandover"),
        ...common,
        allowed: false,
        approval: "owner" as const,
      },
      {
        ...emptyPolicy("creditHandover"),
        ...common,
        allowed: true,
        limitPaise: "0",
        approval: "owner" as const,
      },
      {
        ...emptyPolicy("refund"),
        ...common,
        calendarDays: 0,
        approval: "owner" as const,
      },
    ];
    for (const policy of policies)
      expect(
        shopPoliciesCommandSchema.safeParse({ ...command(), policy }).success,
      ).toBe(true);
    expect(
      policyReadiness(null, ["advance"]).actions.find(
        (a) => a.action === "bindingQuote",
      )?.reasons,
    ).toContainEqual({ code: "policyDraft", policy: "advance" });
  });
});
