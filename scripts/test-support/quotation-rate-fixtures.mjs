import { randomUUID } from "node:crypto";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { initialShopProfile } from "@aarili/contracts/shop-profile";
import { mutateDraft } from "@aarili/core/drafts";
import { serviceCatalogueDraftWorkflow } from "@aarili/core/service-catalogue";
import { reviseShopProfile } from "@aarili/core/shop-profile";
import { createDatabase, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { quotationRatesRepository } from "@aarili/db/quotation-rates-repository";
import { serviceCatalogueRepository } from "@aarili/db/service-catalogue-repository";
import { shopProfileRepository } from "@aarili/db/shop-profile-repository";
export const draftUuid = () => {
  const s = randomUUID();
  return `${s.slice(0, 14)}7${s.slice(15)}`;
};
export function rateContext(tx, shopId, actorId, synthetic = true) {
  return {
    shopId,
    actorId,
    synthetic,
    repository: quotationRatesRepository(tx, shopId),
    drafts: draftRepository(tx, shopId),
    profile: shopProfileRepository(tx, shopId),
    catalogue: {
      shopId,
      actorId,
      synthetic,
      repository: serviceCatalogueRepository(tx, shopId),
    },
  };
}
export async function seedQuotationSources(runtime, shopId) {
  const actor = (
      await runtime.query("select user_id from owner_bootstrap where singleton")
    ).rows[0].user_id,
    db = createDatabase(runtime.options.connectionString, 1);
  try {
    return await withShop(db.db, actor, shopId, async (tx) => {
      const ctx = rateContext(tx, shopId, actor),
        profile = await ctx.profile.current();
      if (!profile)
        await reviseShopProfile(
          {
            shopId,
            actorId: actor,
            repository: ctx.profile,
            brandingAvailable: false,
          },
          initialShopProfile("SYNTHETIC rates shop"),
          { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
        );
      const id = draftUuid(),
        entryId = randomUUID(),
        c = {
          entryId,
          baseVersion: 0,
          baseRevisionId: null,
          operation: "definition",
          available: true,
          reason: "SYNTHETIC rate source",
          content: {
            ...emptyCatalogueContent("category"),
            code: `rates-${randomUUID().slice(0, 8)}`,
            labelEn: "SYNTHETIC blouse",
            labelTa: "செயற்கை ரவிக்கை",
          },
        };
      const d = {
        shopId,
        actor: { type: "user", id: actor },
        repository: ctx.drafts,
        workflows: new Map([
          ["service.catalogue", serviceCatalogueDraftWorkflow(ctx.catalogue)],
        ]),
      };
      await mutateDraft(
        d,
        id,
        "save",
        { workflow: "service.catalogue", schemaVersion: 1, payload: c },
        { key: randomUUID(), requestId: randomUUID() },
      );
      await mutateDraft(
        d,
        id,
        "promote",
        {},
        { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
      );
      const source = await ctx.catalogue.repository.current(entryId);
      return { actor, source };
    });
  } finally {
    await db.pool.end();
  }
}
