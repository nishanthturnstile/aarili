import { randomUUID } from "node:crypto";
import {
  boundCommitmentPreviewInputSchema,
  commitmentBindingCommandSchema,
  initialCommitmentScenario,
  syntheticCommitmentConfiguration,
} from "@aarili/contracts/shop-commitments";
import { evaluateCommitment } from "@aarili/core/commitment-evaluator";
import fc from "fast-check";
import { expect, it } from "vitest";

it("ST-08/09 v1 remains unbound; trusted bound authority retains unknown demand/load and conventions", async () => {
  const shopId = randomUUID(),
    configuration = {
      ...syntheticCommitmentConfiguration(),
      authority: "owner-proposal" as const,
    };
  const input = {
    shopId,
    configuration,
    configurationSource: "rule1",
    calendar: null,
    category: {
      shopId,
      id: randomUUID(),
      version: "definition:availability:v1",
      eligible: true,
      synthetic: false,
      warningDays: 7,
    },
    load: null,
    scenario: {
      ...initialCommitmentScenario(),
      mode: "production" as const,
      quantity: null,
      unit: null,
    },
    previousFingerprint: null,
  };
  const old = await evaluateCommitment(input);
  expect(old.binding).toBe("unbound");
  expect(old.unknowns).toContain("productionAuthorityPending");
  const bound = await evaluateCommitment({
    ...input,
    boundAuthority: {
      reviewed: true,
      sources: { binding: "b1", availability: "a1" },
    },
  });
  expect(bound.unknowns).not.toContain("productionAuthorityPending");
  expect(bound.unknowns).toEqual(
    expect.arrayContaining(["loadMissing", "candidateDemandMissing"]),
  );
  expect(bound.warnings).toEqual(
    expect.arrayContaining(["rush", "cutoffPassed"]),
  );
  expect(bound.activation).toBe("unavailable");
  expect(bound.effects).toBe("none");
  const changed = await evaluateCommitment({
    ...input,
    boundAuthority: {
      reviewed: true,
      sources: { binding: "b1", availability: "a2" },
    },
  });
  expect(changed.fingerprint).not.toBe(bound.fingerprint);
  const missing = await evaluateCommitment({
    ...input,
    configuration: {
      ...configuration,
      allocation: null,
      weekStart: null,
      leadBasis: null,
    },
    boundAuthority: { reviewed: true, sources: { binding: "b1" } },
  });
  expect(missing.unknowns).toContain("capacityConventionMissing");
  expect(await evaluateCommitment(input)).toEqual(old);
});
it("ST-08 property: category null never extends; shorter never reduces; missing shop window remains unknown", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 3660 }),
      fc.option(fc.integer({ min: 0, max: 3660 }), { nil: null }),
      async (shop, category) => {
        const shopId = randomUUID(),
          base = {
            shopId,
            configuration: {
              ...syntheticCommitmentConfiguration(),
              warningDays: shop,
            },
            configurationSource: "rule",
            calendar: null,
            category: {
              shopId,
              id: "c",
              version: "v",
              eligible: true,
              synthetic: false,
              warningDays: category,
            },
            load: null,
            scenario: initialCommitmentScenario(),
            previousFingerprint: null,
          };
        expect((await evaluateCommitment(base)).facts.warningWindow).toBe(
          Math.max(shop, category ?? 0),
        );
        const missing = await evaluateCommitment({
          ...base,
          configuration: { ...base.configuration, warningDays: null },
        });
        expect(missing.facts.warningWindow).toBeNull();
        expect(missing.unknowns).toContain("warningWindowMissing");
      },
    ),
    { numRuns: 60 },
  );
});
it("ST-10 strict binding/v2 DTOs reject browser authority/eligibility/load and keep incomplete drafts explicit", () => {
  const binding = {
    categoryId: randomUUID(),
    categoryRevisionId: randomUUID(),
    availabilityId: randomUUID(),
    ruleRevisionId: randomUUID(),
    baseVersion: 0,
    baseRevisionId: null,
    review: "pending",
    reason: "review",
  };
  expect(commitmentBindingCommandSchema.safeParse(binding).success).toBe(true);
  for (const extra of [
    { authority: "owner-reviewed" },
    { eligible: true },
    { actorId: randomUUID() },
    { digest: "a".repeat(64) },
  ])
    expect(
      commitmentBindingCommandSchema.safeParse({ ...binding, ...extra })
        .success,
    ).toBe(false);
  const preview = {
    contractVersion: 2,
    bindingId: randomUUID(),
    calendarRevisionId: null,
    scenario: initialCommitmentScenario(),
    previousFingerprint: null,
  };
  for (const extra of [
    { load: { quantity: 0 } },
    { approved: true },
    { category: { eligible: true } },
  ])
    expect(
      boundCommitmentPreviewInputSchema.safeParse({ ...preview, ...extra })
        .success,
    ).toBe(false);
});
