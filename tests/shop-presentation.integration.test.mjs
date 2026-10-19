import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mutateDraft } from "@aarili/core/drafts";
import { presentationDraftWorkflow } from "@aarili/core/service-templates";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { serviceTemplatesRepository } from "@aarili/db/service-templates-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const id = () => {
  const v = randomUUID();
  return `${v.slice(0, 14)}7${v.slice(15)}`;
};
function request(
  f,
  path,
  {
    method = "POST",
    body = {},
    key = randomUUID(),
    etag,
    who = f.a,
    shop = who.shop,
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
      body: JSON.stringify(body),
    }),
  );
}
async function ok(r) {
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
const read = (f, extra = {}) =>
  request(f, "settings/service-templates/presentation", extra).then(ok);
const value = (revision = null, mode = "detailed") => ({
  baseVersion: revision?.version ?? 0,
  baseRevisionId: revision?.id ?? null,
  mode,
  reason: "SYNTHETIC presentation review",
});
async function save(f, payload, options = {}) {
  const draftId = id();
  const { draft } = await ok(
    await request(f, `drafts/${draftId}`, {
      method: "PUT",
      body: { workflow: "shop.presentation", schemaVersion: 1, payload },
      ...options,
    }),
  );
  return { draftId, draft };
}
const promote = (f, d, key = randomUUID(), extra = {}) =>
  request(f, `drafts/${d.draftId}/promote`, {
    body: {},
    key,
    etag: `"v${d.draft.version}"`,
    ...extra,
  });

test("ST-05/07/10 presentation defaults, exact history, owner/RLS and strict command validation", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    assert.deepEqual(await read(f), {
      mode: "simple",
      revision: null,
      history: [],
      next: null,
    });
    const d = await save(f, value());
    assert.equal((await promote(f, d, undefined, { etag: null })).status, 428);
    assert.equal(
      (await promote(f, d, undefined, { etag: '"v99"' })).status,
      412,
    );
    await ok(await promote(f, d));
    const first = await read(f);
    assert.equal(first.mode, "detailed");
    assert.equal(first.revision.actorId, f.a.user);
    await ok(await promote(f, await save(f, value(first.revision, "simple"))));
    const second = await read(f);
    assert.deepEqual(second.history[1], first.revision);
    assert.equal(second.revision.previousId, first.revision.id);
    assert.deepEqual(await read(f, { who: f.b }), {
      mode: "simple",
      revision: null,
      history: [],
      next: null,
    });
    assert.equal(
      (
        await request(f, "settings/service-templates/presentation", {
          who: f.b,
          shop: f.a.shop,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(f, "settings/service-templates/presentation", {
          body: { actorId: f.b.user },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request(f, "settings/service-templates/presentation", {
          origin: "https://foreign.test",
        })
      ).status,
      403,
    );
    for (const payload of [
      { ...value(second.revision), reason: "" },
      { ...value(second.revision), baseRevisionId: null },
    ])
      assert.equal((await promote(f, await save(f, payload))).status, 422);
    assert.equal(
      (await promote(f, await save(f, value(second.revision, "simple"))))
        .status,
      409,
    );
    const tables = ["shop_presentation", "shop_presentation_revision"];
    const catalog = await assertIsolationCatalog(f.runtime.db);
    for (const table of tables) {
      assert(catalog.includes(`public.${table}`));
      assert.equal(
        (await f.runtime.db.execute(sql.raw(`select * from ${table}`)))
          .rowCount,
        0,
      );
      await assert.rejects(() =>
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql.raw(`delete from ${table}`)),
        ),
      );
    }
    await assert.rejects(() =>
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(sql`update shop_presentation_revision set mode='simple'`),
      ),
    );
    await assert.rejects(() =>
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`update shop_presentation set current_id=${first.revision.id}::uuid,version=1`,
        ),
      ),
    );
    // Tenant-composite actor, audit, origin and previous references are checked in PostgreSQL.
    await assert.rejects(() =>
      withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
        tx.execute(
          sql`insert into shop_presentation_revision(shop_id,id,version,mode,reason,actor_id,audit_id,origin_draft_id) values(${f.a.shop}::uuid,uuidv7(),1,'simple','foreign',${f.b.user}::uuid,uuidv7(),uuidv7())`,
        ),
      ),
    );
  });
});

test("ST-07/10/12 presentation concurrent replay, actor/action/hash binding and stale publication", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const d = await save(f, value()),
      key = randomUUID();
    const results = await Promise.all([promote(f, d, key), promote(f, d, key)]);
    assert.deepEqual(await ok(results[0]), await ok(results[1]));
    const first = (await read(f)).revision;
    const a = await save(f, value(first, "simple")),
      b = await save(f, value(first, "simple"));
    assert.deepEqual(
      (await Promise.all([promote(f, a), promote(f, b)]))
        .map((r) => r.status)
        .sort(),
      [200, 412],
    );
    const changedId = id(),
      changedKey = randomUUID(),
      body = {
        workflow: "shop.presentation",
        schemaVersion: 1,
        payload: value(),
      };
    await ok(
      await request(f, `drafts/${changedId}`, {
        method: "PUT",
        key: changedKey,
        body,
      }),
    );
    assert.equal(
      (
        await request(f, `drafts/${changedId}`, {
          method: "PUT",
          key: changedKey,
          body: { ...body, payload: { ...body.payload, reason: "Changed" } },
        })
      ).status,
      422,
    );
    assert.equal((await promote(f, d, key, { etag: '"v9"' })).status, 422);
    assert.equal(
      (
        await request(f, `drafts/${d.draftId}`, {
          method: "PUT",
          key,
          etag: '"v1"',
          body,
        })
      ).status,
      422,
    );
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    assert.equal(
      (await promote(f, d, key, { who: f.b, shop: f.a.shop })).status,
      422,
    );
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.b.user],
    );
    assert.equal(
      (await promote(f, d, key, { who: f.b, shop: f.a.shop })).status,
      403,
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from shop_presentation_revision",
        )
      ).rows[0].n,
      2,
    );
  });
});

test("ST-10/12 presentation rollback after actual audit/revision/pointer/draft/result writes", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const count = async () =>
      (
        await f.admin.query(
          "select (select count(*) from shop_presentation_revision) revisions,(select count(*) from shop_presentation) pointers,(select count(*) from audit_event) audits,(select count(*) from idempotency_key) keys,(select count(*) from durable_draft where lifecycle='promoted') promoted",
        )
      ).rows[0];
    for (const point of [
      "presentationAppend",
      "presentationAdvance",
      "update",
      "audit",
      "persist",
    ]) {
      const d = await save(f, value()),
        before = await count();
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            const raw = serviceTemplatesRepository(tx, f.a.shop),
              dr = draftRepository(tx, f.a.shop),
              repository = { ...raw },
              drafts = { ...dr };
            const isDomain = point.startsWith("presentation"),
              target = isDomain ? repository : drafts,
              original = isDomain ? raw : dr;
            target[point] = async (...args) => {
              await original[point](...args);
              throw Error("injected presentation rollback");
            };
            return mutateDraft(
              {
                shopId: f.a.shop,
                actor: { type: "user", id: f.a.user },
                repository: drafts,
                workflows: new Map([
                  [
                    "shop.presentation",
                    presentationDraftWorkflow({
                      shopId: f.a.shop,
                      actorId: f.a.user,
                      repository,
                    }),
                  ],
                ]),
              },
              d.draftId,
              "promote",
              {},
              {
                key: randomUUID(),
                requestId: randomUUID(),
                ifMatch: `"v${d.draft.version}"`,
              },
            );
          }),
        /injected presentation rollback/,
      );
      assert.deepEqual(await count(), before);
      assert.equal((await read(f)).revision, null);
    }
  });
});
