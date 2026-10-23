import { createApi } from "@aarili/api";
import { emptyPatternDraft } from "@aarili/contracts/manual-patterns";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import {
  syntheticGuardianPolicy,
  syntheticWearerPolicy,
} from "@aarili/core/wearer-policy";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "./design-choices-fixtures.mjs";
import { specificationSources } from "./design-specification-fixtures.mjs";
import { seedQuickOrder } from "./seed-quick-order.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";
export async function withPatterns(run, options = {}) {
  return withTenantFixture(
    async (f) => {
      const owner = { ...f.owner, commandLimit: async () => 0 };
      for (const name of ["withOwnerDraft", "withOwnerManualPatterns"])
        owner[name] = async (...args) => {
          try {
            return await f.owner[name](...args);
          } catch (e) {
            console.info("Synthetic pattern failure", {
              name: e?.name,
              pgCode: e?.cause?.code,
              pgMessage: e?.cause?.message,
              validation: e?.issues?.map((i) => ({
                path: i.path,
                message: i.message,
              })),
            });
            throw e;
          }
        };
      f.api = createApi(async () => true, owner);
      const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
      try {
        const identity = {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        };
        const sources = await specificationSources(f, identity),
          accepted = await sources.accept();
        const piece = accepted.pieces.identities.find(
          (p) => p.key === sources.top.definition.content.code,
        );
        await run({
          ...f,
          seed,
          identity,
          sources,
          accepted,
          scope: { orderId: accepted.order.id, pieceId: piece.id },
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
export const patternPage = (f, extra = {}) =>
  designRequest(f, "manual-patterns/list", {
    method: "POST",
    body: { ...f.scope, ...extra },
  }).then(designOk);
export async function publishPatternCapability(f, extra = {}) {
  const p = await patternPage(f);
  const v = {
    binding: p.binding,
    baseVersion: p.capability?.version ?? 0,
    manual: "available",
    external: "available",
    reason: "SYNTHETIC availability review",
    reviewed: true,
    ...extra,
  };
  return promoteDesign(f, await saveDesign(f, v, "pattern.capability")).then(
    designOk,
  );
}
export async function physicalPattern(f, extra = {}) {
  const p = await patternPage(f),
    v = emptyPatternDraft(f.scope, f.identity.customerId, f.identity.wearerId);
  return {
    ...v,
    baseVersion: p.state.version,
    baseSavedId: p.state.latestSavedId,
    content: {
      ...v.content,
      locator: "Cabinet B / folder 12",
      design: {
        state: "unknown",
        reason: "SYNTHETIC imported reference; inputs not supplied",
      },
      measurement: {
        state: "unknown",
        reason: "SYNTHETIC imported reference; inputs not supplied",
      },
    },
    reason: "SYNTHETIC physical reference",
    ...extra,
  };
}
export async function publishPattern(f, v) {
  return promoteDesign(f, await saveDesign(f, v, "pattern.reference")).then(
    designOk,
  );
}
export async function referenceAction(f, id, operation, extra = {}) {
  const p = await patternPage(f),
    ref = p.state.versions.find((v) => v.id === id) ?? p.selected;
  const comparison = await designRequest(f, "manual-patterns/compare", {
    method: "POST",
    body: { ...f.scope, referenceId: id },
  }).then(designOk);
  return physicalPattern(f, {
    operation,
    method: ref.method,
    referenceId: id,
    digest: comparison.digest,
    acknowledged: true,
    evidence: "SYNTHETIC reference-only review; scale and formula unverified",
    reason: "SYNTHETIC explicit reference decision",
    ...extra,
  });
}
