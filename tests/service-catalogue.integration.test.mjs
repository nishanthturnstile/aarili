import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import {
  catalogueReferencesEligible,
  serviceCatalogueDraftWorkflow,
} from "@aarili/core/service-catalogue";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { serviceCatalogueRepository } from "@aarili/db/service-catalogue-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const id = () => {
  const v = randomUUID();
  return `${v.slice(0, 14)}7${v.slice(15)}`;
};
const value = (kind = "category", code = "blouse", extra = {}) => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition",
  available: true,
  reason: "SYNTHETIC owner review",
  content: {
    ...emptyCatalogueContent(kind),
    code,
    labelEn: `SYNTHETIC ${code}`,
    labelTa: "செயற்கை ரவிக்கை",
    aliases: ["ravikkai"],
    ...extra,
  },
});
function request(
  f,
  path,
  {
    method = "GET",
    body,
    who = f.a,
    shop = who.shop,
    key = randomUUID(),
    etag,
    origin = f.owner.origin,
  } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${shop}/${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(etag ? { "If-Match": etag } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function ok(r) {
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
async function save(f, v, who = f.a) {
  const draftId = id();
  const { draft } = await ok(
    await request(f, `drafts/${draftId}`, {
      who,
      method: "PUT",
      body: { workflow: "service.catalogue", schemaVersion: 1, payload: v },
    }),
  );
  return { draftId, draft };
}
const promote = (f, d, key = randomUUID(), extra = {}) =>
  request(f, `drafts/${d.draftId}/promote`, {
    method: "POST",
    body: {},
    key,
    etag: `"v${d.draft.version}"`,
    ...extra,
  });
const current = async (f, entryId, who = f.a) =>
  (await ok(await request(f, `settings/catalogue/entries/${entryId}`, { who })))
    .revision;
async function publish(f, v, who = f.a) {
  const d = await save(f, v, who);
  await ok(await promote(f, d, undefined, { who }));
  return current(f, v.entryId, who);
}
const ref = (r) => ({ entryId: r.entryId, revisionId: r.definition.id });
const revised = (r, extra = {}) => ({
  entryId: r.entryId,
  baseVersion: r.version,
  baseRevisionId: r.id,
  operation: "definition",
  available: r.available,
  reason: "SYNTHETIC revision review",
  content: r.definition.content,
  ...extra,
});
test("ST-01/07/10/12 canonical catalogue, cross-script search, composition, availability and immutable old references", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      assert(
        (await assertIsolationCatalog(f.runtime.db)).includes(
          "public.service_catalogue_reference",
        ),
      );
      const category = await publish(f, value()),
        piece = await publish(f, value("piece", "top")),
        addon = await publish(f, value("addon", "pico"));
      assert.deepEqual(
        await ok(
          await request(
            f,
            `settings/catalogue/definitions/${category.definition.id}`,
          ),
        ),
        category.definition,
      );
      assert.equal(
        (
          await request(
            f,
            `settings/catalogue/definitions/${category.definition.id}`,
            { who: f.b },
          )
        ).status,
        404,
      );
      const sub = await publish(
        f,
        value("subcategory", "princess", { parent: ref(category) }),
      );
      const service = await publish(
        f,
        value("service", "salwar-stitching", {
          parent: ref(sub),
          serviceKind: "stitching",
          pieces: [{ ...ref(piece), optional: false }],
          addons: [{ ...ref(addon), optional: true }],
        }),
      );
      await publish(
        f,
        value("service", "alteration", {
          parent: ref(category),
          serviceKind: "alteration",
        }),
      );
      await publish(
        f,
        value("service", "fall", {
          parent: ref(category),
          serviceKind: "small-service",
        }),
      );
      assert.equal(service.definition.authority, "synthetic-fixture");
      for (const query of ["ரவிக்கை", "ravikkai", "blouse"]) {
        const l = await ok(
          await request(f, "settings/catalogue/list", {
            method: "POST",
            body: { query },
          }),
        );
        assert(l.entries.some((r) => r.entryId === category.entryId));
        assert.equal(l.intake, "templates-pending");
      }
      const foreign = await publish(f, value("category", "foreign"), f.b);
      assert.equal(await current(f, foreign.entryId), null);
      assert.equal(
        (await request(f, `settings/catalogue/revisions/${foreign.id}`)).status,
        404,
      );
      assert.equal(
        (
          await request(f, "settings/catalogue/list", {
            method: "POST",
            body: { query: "foreign" },
          }).then(ok)
        ).entries.length,
        0,
      );
      for (const bad of [
        value("subcategory", "bad-parent", { parent: ref(piece) }),
        value("subcategory", "foreign-parent", { parent: ref(foreign) }),
      ]) {
        const d = await save(f, bad);
        assert.equal((await promote(f, d)).status, 409);
      }
      const v2 = await publish(
        f,
        revised(category, {
          content: {
            ...category.definition.content,
            labelEn: "SYNTHETIC renamed blouse",
            warningDays: 7,
          },
        }),
      );
      assert.equal(
        (
          await ok(
            await request(f, `settings/catalogue/revisions/${category.id}`),
          )
        ).definition.content.warningDays,
        null,
      );
      assert.equal(v2.definition.content.warningDays, 7);
      await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
        const ctx = {
          shopId: f.a.shop,
          actorId: f.a.user,
          repository: serviceCatalogueRepository(tx, f.a.shop),
          synthetic: true,
        };
        assert.equal(await catalogueReferencesEligible(ctx, service), false);
      });
      const off = await publish(
        f,
        revised(v2, { operation: "availability", available: false }),
      );
      assert.deepEqual(off.definition, v2.definition);
      assert.equal(off.available, false);
      const on = await publish(
        f,
        revised(off, { operation: "availability", available: true }),
      );
      assert.deepEqual(on.definition, v2.definition);
      const badChange = await save(
        f,
        revised(on, {
          operation: "availability",
          available: false,
          content: { ...on.definition.content, labelEn: "Smuggled edit" },
        }),
      );
      assert.equal((await promote(f, badChange)).status, 409);
      const history = await ok(
        await request(f, "settings/catalogue/history", {
          method: "POST",
          body: { entryId: category.entryId },
        }),
      );
      assert.equal(history.revisions.length, 4);
      assert.equal(
        history.revisions.at(-1).definition.content.labelEn,
        category.definition.content.labelEn,
      );
      const duplicate = await save(f, value());
      assert.equal((await promote(f, duplicate)).status, 409);
      await assert.rejects(
        f.admin.query("update service_catalogue_revision set content=content"),
        /protected/,
      );
      await assert.rejects(
        f.admin.query("delete from service_catalogue_availability"),
        /protected/,
      );
      await f.runtime.db.transaction(async (tx) => {
        assert.equal(
          (await tx.execute(sql`select id from service_catalogue_revision`))
            .rowCount,
          0,
        );
      });
      const audit = (
        await f.admin.query(
          "select changes from audit_event where action='service-catalogue.publish'",
        )
      ).rows;
      assert(!JSON.stringify(audit).includes("SYNTHETIC"));
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
});
test("ST-07/10 atomic publication, exact replay, changed key binding, stale CAS, concurrent first publish and rollback", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const d = await save(f, value());
    const key = randomUUID();
    const [a, b] = await Promise.all([promote(f, d, key), promote(f, d, key)]);
    assert.deepEqual(await ok(a), await ok(b));
    assert.equal((await promote(f, d, key, { etag: '"v9"' })).status, 422);
    assert.equal(
      (await promote(f, d, key, { who: f.b, shop: f.a.shop })).status,
      403,
    );
    const r = await current(f, d.draft.payload.entryId);
    const one = await save(f, revised(r)),
      two = await save(f, revised(r, { reason: "Another explicit review" }));
    const responses = await Promise.all([promote(f, one), promote(f, two)]);
    assert.deepEqual(responses.map((x) => x.status).sort(), [200, 412]);
    const x = value("piece", "parallel"),
      first = await save(f, x),
      second = await save(f, x);
    assert.deepEqual(
      (await Promise.all([promote(f, first), promote(f, second)]))
        .map((r) => r.status)
        .sort(),
      [200, 412],
    );
    const header = await save(f, value("piece", "headers"));
    assert.equal(
      (await promote(f, header, undefined, { etag: null })).status,
      428,
    );
    const count = async () =>
      (
        await f.admin.query(
          "select (select count(*)::int from service_catalogue_revision) definitions,(select count(*)::int from service_catalogue_availability) changes,(select count(*)::int from audit_event where action='service-catalogue.publish') audits,(select count(*)::int from idempotency_key where action='draft.promote') keys",
        )
      ).rows[0];
    for (const point of ["append", "advance", "update", "audit", "persist"]) {
      const v = value("piece", `rollback-${point}`),
        draft = await save(f, v),
        before = await count();
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            const raw = serviceCatalogueRepository(tx, f.a.shop),
              dr = draftRepository(tx, f.a.shop),
              repository = { ...raw },
              drafts = { ...dr };
            const target = ["append", "advance"].includes(point)
                ? repository
                : drafts,
              original = ["append", "advance"].includes(point) ? raw : dr;
            target[point] = async (...args) => {
              await original[point](...args);
              throw Error("injected catalogue rollback");
            };
            return mutateDraft(
              {
                shopId: f.a.shop,
                actor: { type: "user", id: f.a.user },
                repository: drafts,
                workflows: new Map([
                  [
                    "service.catalogue",
                    serviceCatalogueDraftWorkflow({
                      shopId: f.a.shop,
                      actorId: f.a.user,
                      repository,
                      synthetic: true,
                    }),
                  ],
                ]),
              },
              draft.draftId,
              "promote",
              {},
              {
                key: randomUUID(),
                requestId: randomUUID(),
                ifMatch: `"v${draft.draft.version}"`,
              },
            );
          }),
        /injected/,
      );
      assert.deepEqual(await count(), before);
      assert.equal(await current(f, v.entryId), null);
    }
  });
});
