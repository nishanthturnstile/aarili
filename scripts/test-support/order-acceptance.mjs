import { randomUUID } from "node:crypto";
import { emptyCalendarDefinition } from "@aarili/contracts/shop-calendar";
import { syntheticCommitmentConfiguration } from "@aarili/contracts/shop-commitments";
import { emptyPolicy } from "@aarili/contracts/shop-policies";
import { initialShopProfile } from "@aarili/contracts/shop-profile";

// Disposable synthetic setup only. Every write uses the real registered commands.
export async function seedOrderAcceptance(
  request,
  sources,
  { omit = [] } = {},
) {
  const uuid7 = () => randomUUID().replace(/^(........-....-)./, "$17");
  async function publish(workflow, payload) {
    const id = uuid7();
    await request(`drafts/${id}`, {
      method: "PUT",
      body: { workflow, schemaVersion: 1, payload },
    });
    return (await request(`drafts/${id}/promote`, { body: {}, etag: '"v1"' }))
      .draft.result.id;
  }
  const profile = await request("settings/profile", { method: "GET" });
  if (!omit.includes("profile"))
    await request("settings/profile", {
      method: "PUT",
      etag: `"v${profile.version}"`,
      body: initialShopProfile("SYNTHETIC order review"),
    });
  if (!omit.includes("calendar"))
    await publish("shop.calendar", {
      baseVersion: 0,
      baseRevisionId: null,
      domain: "production",
      definition: emptyCalendarDefinition(),
    });
  const policy = {
    ...emptyPolicy("cancellation"),
    state: "not-applicable",
    reason: "SYNTHETIC acceptance test only",
    authority: { kind: "synthetic-fixture", label: "SYNTHETIC" },
  };
  if (!omit.includes("policies"))
    await publish("shop.policies", {
      baseVersion: 0,
      baseRevisionId: null,
      policy,
    });
  const configuration = {
    ...syntheticCommitmentConfiguration(),
    cap: 1,
    peaks: [],
  };
  const ruleId = await publish("shop.commitments", {
    baseVersion: 0,
    baseRevisionId: null,
    configuration,
  });
  // Resolve the category from the actual seeded service, never a second catalogue.
  let ref = sources.service.definition.content.parent;
  let category;
  while (ref) {
    const d = await request(
      `settings/catalogue/definitions/${ref.revisionId}`,
      { method: "GET" },
    );
    if (d.content.kind === "category") {
      category = (
        await request(`settings/catalogue/entries/${ref.entryId}`, {
          method: "GET",
        })
      ).revision;
      break;
    }
    ref = d.content.parent;
  }
  if (!category) throw Error("SYNTHETIC category unavailable");
  const binding = {
    categoryId: category.entryId,
    categoryRevisionId: category.definition.id,
    availabilityId: category.id,
    ruleRevisionId: ruleId,
    baseVersion: 0,
    baseRevisionId: null,
    review: "reviewed",
    reason: "SYNTHETIC acceptance review only",
  };
  const bindingId = await publish("service.commitment-bindings", binding);
  return { category, configuration, ruleId, bindingId, publish };
}
