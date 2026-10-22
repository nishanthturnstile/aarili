import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import {
  syntheticGuardianPolicy,
  syntheticWearerPolicy,
} from "@aarili/core/wearer-policy";
import {
  designOk,
  designRef,
  designRequest,
  promoteDesign,
  saveDesign,
} from "./design-choices-fixtures.mjs";
import {
  specificationDraft,
  specificationSources,
} from "./design-specification-fixtures.mjs";
import { withMediaProcessing } from "./media-processing.mjs";
import { seedQuickOrder } from "./seed-quick-order.mjs";
export async function withDesignReferences(run, options = {}) {
  return withMediaProcessing(
    async (f) => {
      const owner = { ...f.owner };
      for (const name of [
        "withOwnerDraft",
        "withOwnerDesignReferences",
        "withOwnerMedia",
      ])
        owner[name] = async (...args) => {
          try {
            return await f.owner[name](...args);
          } catch (e) {
            if (!e?.status || e.status >= 500)
              console.info("Synthetic design reference failure", {
                name: e?.name,
                pgCode: e?.cause?.code,
                pgMessage: e?.cause?.message,
                issues: e?.issues?.map((i) => ({ path: i.path, code: i.code })),
              });
            throw e;
          }
        };
      f.api = createApi(async () => true, {
        ...owner,
        commandLimit: async () => 0,
      });
      const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
      try {
        const s = await specificationSources(f, {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        });
        const target = await s.accept(),
          pieceId = target.pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id;
        const path = `customers/${seed.customer.customerId}/wearers/${seed.wearer.wearerId}`;
        const w = await designRequest(f, path).then(designOk);
        await designRequest(f, `${path}/consent-events`, {
          method: "POST",
          etag: `"v${w.version}"`,
          body: {
            purpose: "private-media",
            decision: "grant",
            noticeId: syntheticWearerPolicy.notice.id,
            noticeExplained: true,
            language: "en",
            giverPersonId: w.personId,
            source: "in-person",
            occurredAt: new Date().toISOString(),
          },
        }).then(designOk);
        await run({
          ...f,
          s,
          seed,
          target,
          pieceId,
          value: {
            ...specificationDraft(target.order.id, pieceId, s.profile),
            referenceItems: [],
          },
        });
      } finally {
        await seed.close();
      }
    },
    {
      customerPolicy: syntheticCustomerPolicy,
      wearerPolicy: syntheticWearerPolicy,
      guardianPolicy: syntheticGuardianPolicy,
      ...options,
    },
  );
}
export const sourceDraft = (f, kind = "private") => ({
  kind,
  orderId: kind === "private" ? f.target.order.id : null,
  pieceId: kind === "private" ? f.pieceId : null,
  category: kind === "library" ? designRef(f.s.category) : null,
  previousId: null,
  sourceKind: kind === "private" ? "customer-provided" : "shop-created",
  sourceText: "SYNTHETIC shop-owned sketch or private customer source",
  sourceDate: null,
  rightsBasis: kind === "private" ? "private-fulfilment" : "shop-owned",
  rightsEvidence:
    kind === "private" ? "" : "SYNTHETIC created by this shop; reusable",
  reason: "SYNTHETIC source review",
});
export async function publishSource(f, value = sourceDraft(f)) {
  const d = await saveDesign(f, value, "design.reference"),
    r = await promoteDesign(f, d).then(designOk);
  return {
    draft: d,
    subject: await designRequest(
      f,
      `design-references/subjects/${r.draft.result.id}`,
    ).then(designOk),
  };
}
export async function saveReferenceSpecification(f, value = f.value) {
  const id = randomUUID().replace(/^(........-....-)./, "$17");
  const r = await designRequest(f, `drafts/${id}`, {
    method: "PUT",
    body: {
      workflow: "design.specification",
      schemaVersion: 2,
      payload: value,
    },
  }).then(designOk);
  return { draftId: id, draft: r.draft };
}
export async function admitReference(
  f,
  subject,
  bytes,
  contentType = "image/jpeg",
) {
  const purpose = contentType.startsWith("audio/")
    ? "voice-note"
    : contentType === "application/pdf"
      ? "order-document"
      : subject.kind === "library"
        ? "manual-pattern"
        : "wearer-photo";
  const grant = await designRequest(f, "files/uploads", {
    method: "POST",
    body: { subjectId: subject.id, purpose, contentType, size: bytes.length },
  }).then(designOk);
  const put = await fetch(grant.upload.url, {
    method: "PUT",
    headers: grant.upload.headers,
    body: bytes,
  });
  if (!put.ok) throw Error(`Synthetic S3 upload failed ${put.status}`);
  return grant;
}
export async function processReference(f, grant) {
  const attempt = await f.complete(grant);
  const result = await f.process(grant, attempt);
  if (result !== "accepted")
    throw Error(`Synthetic processing outcome ${result}`);
  return { grant, attempt };
}
export const referenceItem = (assetId, questionId = null, extra = {}) => ({
  id: randomUUID(),
  assetId,
  questionId,
  intent: "inspiration",
  caption: "SYNTHETIC neckline source",
  annotations: [
    { note: "SYNTHETIC keep this detail", anchor: { kind: "note" } },
  ],
  replacesId: null,
  geometryReviewed: false,
  ...extra,
});
