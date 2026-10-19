import { randomUUID } from "node:crypto";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { syntheticCommitmentConfiguration } from "@aarili/contracts/shop-commitments";

const id = () => {
  const v = randomUUID();
  return `${v.slice(0, 14)}7${v.slice(15)}`;
};
// Only disposable synthetic hosts use this helper. All writes use real commands.
export async function seedCommitmentBindingReview(request, shopId) {
  const base = `/shops/${shopId}`;
  async function save(payload, workflow) {
    const draftId = id();
    const r = await request(
      `${base}/drafts/${draftId}`,
      { workflow, schemaVersion: 1, payload },
      { "Idempotency-Key": randomUUID() },
      "PUT",
    );
    return { draftId, draft: r.draft };
  }
  async function publish(payload, workflow) {
    const d = await save(payload, workflow);
    const result = await request(
      `${base}/drafts/${d.draftId}/promote`,
      {},
      { "Idempotency-Key": randomUUID(), "If-Match": `"v${d.draft.version}"` },
    );
    return result.draft.result.id;
  }
  const categoryId = randomUUID();
  const categoryChange = await publish(
    {
      entryId: categoryId,
      baseVersion: 0,
      baseRevisionId: null,
      operation: "definition",
      available: true,
      reason: "SYNTHETIC review only",
      content: {
        ...emptyCatalogueContent("category"),
        code: "synthetic-blouse",
        labelEn: "SYNTHETIC blouse",
        labelTa: "சோதனை ரவிக்கை",
        warningDays: 7,
      },
    },
    "service.catalogue",
  );
  const category = await request(
    `${base}/settings/catalogue/revisions/${categoryChange}`,
  );
  const ruleId = await publish(
    {
      baseVersion: 0,
      baseRevisionId: null,
      configuration: syntheticCommitmentConfiguration(),
    },
    "shop.commitments",
  );
  const value = {
    categoryId,
    categoryRevisionId: category.definition.id,
    availabilityId: category.id,
    ruleRevisionId: ruleId,
    baseVersion: 0,
    baseRevisionId: null,
    review: "pending",
    reason: "SYNTHETIC pending review — no production authority",
  };
  const bindingId = await publish(value, "service.commitment-bindings");
  const draft = await save(
    {
      ...value,
      baseVersion: 1,
      baseRevisionId: bindingId,
      reason: "SYNTHETIC second binding review",
    },
    "service.commitment-bindings",
  );
  return { category, ruleId, bindingId, draftId: draft.draftId };
}
