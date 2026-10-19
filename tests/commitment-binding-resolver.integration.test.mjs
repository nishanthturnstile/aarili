import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { withShop } from "@aarili/db";
import { approvedCategoryResolver } from "@aarili/db/service-catalogue-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

test("ST-08/09 actual foreign, unpublished and disabled category identities never resolve as current eligible sources", {
  timeout: 120000,
}, async () => {
  await withTenantFixture(async (f) => {
    const request = async (who, path, body, method = "POST", etag) => {
      const r = await f.api.fetch(
        new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
          method,
          headers: {
            Origin: f.owner.origin,
            Cookie: who.cookie,
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
            ...(etag ? { "If-Match": etag } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    };
    const categoryId = randomUUID(),
      raw = randomUUID(),
      draftId = `${raw.slice(0, 14)}7${raw.slice(15)}`;
    const payload = {
      entryId: categoryId,
      baseVersion: 0,
      baseRevisionId: null,
      operation: "definition",
      available: true,
      reason: "SYNTHETIC resolver review",
      content: {
        ...emptyCatalogueContent("category"),
        code: "foreign-category",
        labelEn: "SYNTHETIC foreign category",
        labelTa: "சோதனை வகை",
      },
    };
    await request(
      f.b,
      `drafts/${draftId}`,
      { workflow: "service.catalogue", schemaVersion: 1, payload },
      "PUT",
    );
    await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) =>
      assert.equal(
        await approvedCategoryResolver(tx, f.b.shop).resolve(categoryId),
        null,
      ),
    );
    await request(f.b, `drafts/${draftId}/promote`, {}, "POST", '"v1"');
    await f.runtime.db.transaction(async (tx) =>
      assert.equal(
        await approvedCategoryResolver(tx, f.b.shop).resolve(categoryId),
        null,
      ),
    );
    await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) =>
      assert.equal(
        (await approvedCategoryResolver(tx, f.b.shop).resolve(categoryId))
          .eligible,
        true,
      ),
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) =>
      assert.equal(
        await approvedCategoryResolver(tx, f.a.shop).resolve(categoryId),
        null,
      ),
    );
    const current = (
      await request(
        f.b,
        `settings/catalogue/entries/${categoryId}`,
        undefined,
        "GET",
      )
    ).revision;
    const rawRetire = randomUUID(),
      retireDraft = `${rawRetire.slice(0, 14)}7${rawRetire.slice(15)}`;
    await request(
      f.b,
      `drafts/${retireDraft}`,
      {
        workflow: "service.catalogue",
        schemaVersion: 1,
        payload: {
          ...payload,
          baseVersion: current.version,
          baseRevisionId: current.id,
          operation: "availability",
          available: false,
        },
      },
      "PUT",
    );
    await request(f.b, `drafts/${retireDraft}/promote`, {}, "POST", '"v1"');
    await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) =>
      assert.equal(
        await approvedCategoryResolver(tx, f.b.shop).resolve(categoryId),
        null,
      ),
    );
    const pieceId = randomUUID(),
      rawPiece = randomUUID(),
      pieceDraft = `${rawPiece.slice(0, 14)}7${rawPiece.slice(15)}`;
    await request(
      f.a,
      `drafts/${pieceDraft}`,
      {
        workflow: "service.catalogue",
        schemaVersion: 1,
        payload: {
          ...payload,
          entryId: pieceId,
          content: {
            ...payload.content,
            kind: "piece",
            code: "piece-identity",
          },
        },
      },
      "PUT",
    );
    await request(f.a, `drafts/${pieceDraft}/promote`, {}, "POST", '"v1"');
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) =>
      assert.equal(
        await approvedCategoryResolver(tx, f.a.shop).resolve(pieceId),
        null,
      ),
    );
  });
});
