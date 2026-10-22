import { emptyQuickOrder } from "@aarili/contracts/orders";
import {
  designOk,
  designRef,
  designRequest,
  designSources,
  promoteDesign,
  publishDesign,
  saveDesign,
} from "./design-choices-fixtures.mjs";
import { seedOrderAcceptance } from "./order-acceptance.mjs";
export async function specificationSources(f, identity) {
  const sources = await designSources(f);
  for (const key of [
    "fit",
    "fastening",
    "lining",
    "placement",
    "finishing",
    "restrictions",
    "neck-depth",
    "front-neck-depth",
    "back-neck-depth",
    "sleeve-length",
  ]) {
    const length = key.includes("depth") || key === "sleeve-length";
    sources.profile.content.questions.push({
      id: crypto.randomUUID(),
      key,
      meaning: `SYNTHETIC ${key}`,
      labelEn: `SYNTHETIC ${key}`,
      labelTa: `செயற்கை ${key}`,
      kind: length ? "garment-length" : "text",
      applicability: "applicable",
      reason: "",
      required: true,
      choices: [],
      when: [],
      units: length ? ["in"] : [],
      precision: length
        ? {
            unit: "in",
            increment: "0.25",
            review: "SYNTHETIC reviewed precision",
          }
        : null,
    });
  }
  const profile = await publishDesign(f, sources.profile);
  const setup = (path, options = {}) =>
    designRequest(f, path, { method: "POST", ...options }).then(designOk);
  const acceptance = await seedOrderAcceptance(setup, sources);
  async function accept(
    manifest = sources.manifest,
    targetIdentity = identity,
  ) {
    const intake = {
      ...emptyQuickOrder(),
      customerId: targetIdentity.customerId,
      wearerId: targetIdentity.wearerId,
      manifest: {
        entryId: manifest.entryId,
        revisionId: manifest.id,
        definitionId: manifest.definition.id,
      },
      deliveryDate: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      priceState: "quoted",
      priceText: "0",
    };
    const review = await setup("orders/review", { body: intake });
    intake.commitmentReview = {
      fingerprint: review.fingerprint,
      acknowledged: true,
      exceptionReason: review.evaluation.warnings.length
        ? "SYNTHETIC reviewed exception"
        : "",
      waiveRush: false,
      waiverReason: "",
    };
    const draft = await saveDesign(f, intake, "order.quick"),
      r = await designOk(await promoteDesign(f, draft));
    const order = await setup(`orders/${r.draft.result.id}/read`, {
      method: "POST",
    });
    const pieces = await setup(`orders/${order.id}/pieces/read`, {
      method: "POST",
    });
    return { order, pieces };
  }
  return { ...sources, profile, accept, setup, acceptance };
}
export function specificationDraft(orderId, pieceId, profile) {
  return {
    orderId,
    pieceId,
    baseVersion: 0,
    baseSavedId: null,
    operation: "save",
    selectedId: null,
    profile: designRef(profile),
    answers: profile.definition.content.questions.map((q) => ({
      questionId: q.id,
      state: "selected",
      choice: q.choices[0] ?? null,
      text:
        q.kind === "text"
          ? "SYNTHETIC instruction"
          : q.kind === "garment-length"
            ? "12 1/4"
            : "",
      unit: q.kind === "garment-length" ? "in" : null,
      intent: "instruction",
      retainedReason: "",
    })),
    reason: "SYNTHETIC initial source",
    use: true,
    reuse: null,
  };
}
export async function publishSpecification(f, value) {
  const draft = await saveDesign(f, value, "design.specification");
  return { draft, result: await designOk(await promoteDesign(f, draft)) };
}
