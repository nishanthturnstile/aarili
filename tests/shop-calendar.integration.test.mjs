import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyCalendarDay,
  emptyCalendarDefinition,
} from "@aarili/contracts/shop-calendar";
import { mutateDraft } from "@aarili/core/drafts";
import { shopCalendarDraftWorkflow } from "@aarili/core/shop-calendar";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { shopCalendarRepository } from "@aarili/db/shop-calendar-repository";
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
    method = "GET",
    body,
    who = f.a,
    shop = who.shop,
    key = randomUUID(),
    etag,
    cookie = who.cookie,
    origin = f.owner.origin,
  } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${shop}/${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
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
async function rejected(r, status) {
  assert.equal(r.status, status, await r.clone().text());
  return r.json();
}
function payload(domain = "customer", baseVersion = 0, baseRevisionId = null) {
  const definition = emptyCalendarDefinition();
  definition.week[0] = {
    ...emptyCalendarDay(),
    state: "open",
    ranges: [{ start: "09:00", end: "17:00" }],
  };
  return { domain, baseVersion, baseRevisionId, definition };
}
async function saved(f, value = payload()) {
  const draftId = id();
  const result = await ok(
    await request(f, `drafts/${draftId}`, {
      method: "PUT",
      body: { workflow: "shop.calendar", schemaVersion: 1, payload: value },
    }),
  );
  return { draftId, record: result.draft };
}
function promote(f, d, key = randomUUID(), etag = `"v${d.record.version}"`) {
  return request(f, `drafts/${d.draftId}/promote`, {
    method: "POST",
    body: {},
    key,
    etag,
  });
}
const totals = async (f) =>
  (
    await f.admin.query(
      "select (select count(*)::int from shop_calendar_revision) revisions,(select count(*)::int from audit_event where action='shop-calendar.publish') audits,(select count(*)::int from idempotency_key where action='draft.promote') keys",
    )
  ).rows[0];

test("SET-02/08 SS-02/07/09 calendar publication, retry, stale drafts and independent historical domains", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const tables = await assertIsolationCatalog(f.runtime.db);
    assert(tables.includes("public.shop_calendar_revision"));
    assert.deepEqual(await ok(await request(f, "settings/calendar")), {
      version: 0,
      revision: null,
    });
    const first = await saved(f),
      concurrent = await saved(f, payload("production"));
    const key = randomUUID();
    const replies = await Promise.all([
      promote(f, first, key).then(ok),
      promote(f, first, key.toUpperCase()).then(ok),
    ]);
    assert.deepEqual(replies[0], replies[1]);
    assert.equal(replies[0].draft.lifecycle, "promoted");
    assert.deepEqual(await totals(f), { revisions: 1, audits: 1, keys: 1 });
    const old = await ok(await request(f, "settings/calendar"));
    assert.equal(old.version, 1);
    assert.equal(
      old.revision.calendar.production.week[0].state,
      "unconfigured",
    );
    await rejected(await promote(f, concurrent), 412);
    assert.equal(
      (await ok(await request(f, `drafts/${concurrent.draftId}`))).lifecycle,
      "active",
    );
    await rejected(await promote(f, first, key, '"v2"'), 422);
    const next = await saved(f, payload("production", 1, old.revision.id));
    await rejected(
      await request(f, `drafts/${next.draftId}/promote`, {
        method: "POST",
        body: {},
      }),
      428,
    );
    const update = await request(f, `drafts/${next.draftId}`, {
      method: "PUT",
      body: {
        workflow: "shop.calendar",
        schemaVersion: 1,
        payload: payload("production", 1, old.revision.id),
      },
      etag: '"v1"',
    });
    await ok(update);
    await rejected(await promote(f, next), 412); // Draft ETag, distinct from aggregate base.
    next.record.version = 2;
    await ok(await promote(f, next));
    const current = await ok(await request(f, "settings/calendar"));
    assert.equal(current.version, 2);
    assert.deepEqual(
      current.revision.calendar.customer,
      old.revision.calendar.customer,
    );
    assert.equal(current.revision.calendar.production.week[0].state, "open");
    assert.deepEqual(
      await ok(
        await request(f, `settings/calendar/revisions/${old.revision.id}`),
      ),
      old.revision,
    );
    assert.equal(
      (
        await ok(
          await request(f, "settings/calendar/history", {
            method: "POST",
            body: {},
          }),
        )
      ).revisions.length,
      2,
    );
    const preview = await ok(
      await request(f, "settings/calendar/preview", {
        method: "POST",
        body: { draft: payload(), date: "2024-02-29" },
      }),
    );
    assert.equal(preview.days.length, 7);
    await rejected(
      await request(f, "settings/calendar/preview", {
        method: "POST",
        body: { draft: payload(), date: "2025-02-29" },
      }),
      422,
    );
    const invalid = payload();
    invalid.definition.week[0].ranges = [{ start: "22:00", end: "02:00" }];
    const incomplete = await saved(f, invalid);
    await rejected(await promote(f, incomplete), 422);
  });
});

test("SS-09 tenant calendar access, immutable provenance and concurrent initial publication", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const a = await saved(f),
      b = await saved(f, payload("production"));
    const outcomes = await Promise.all([promote(f, a), promote(f, b)]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 412]);
    const current = await ok(await request(f, "settings/calendar"));
    await rejected(
      await request(f, "settings/calendar", { who: f.b, shop: f.a.shop }),
      403,
    );
    await rejected(
      await request(f, `settings/calendar/revisions/${current.revision.id}`, {
        who: f.b,
      }),
      404,
    );
    await rejected(await request(f, `drafts/${a.draftId}`, { who: f.b }), 404);
    await rejected(await request(f, "settings/calendar", { cookie: "" }), 401);
    await rejected(
      await request(f, "settings/calendar/history", {
        method: "POST",
        body: {},
        origin: "https://invalid.test",
      }),
      403,
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select id from shop_calendar_revision`))
        .rowCount,
      0,
    );
    await assert.rejects(
      f.admin.query("update shop_calendar_revision set calendar=calendar"),
      /Calendar history protected/,
    );
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(sql`update shop_calendar set version=version`),
      ),
      (e) => e.cause?.code === "42501",
    );
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into shop_calendar_revision(shop_id,id,version,actor_id,audit_id,origin_draft_id,schema_version,calendar) values(${f.a.shop}::uuid,uuidv7(),3,${f.b.user}::uuid,uuidv7(),${b.draftId}::uuid,1,'{"customer":{},"production":{}}'::jsonb)`,
        ),
      ),
    );
    assert.deepEqual(await totals(f), { revisions: 1, audits: 1, keys: 1 });
  });
});

test("SS-07/09 calendar revision, pointer, draft, audit and replay roll back together at each write boundary", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const d = await saved(f);
    for (const stage of ["append", "advance", "update", "audit", "persist"]) {
      const key = randomUUID();
      await assert.rejects(
        withShop(f.parallel.db, f.a.user, f.a.shop, async (tx) => {
          const business = shopCalendarRepository(tx, f.a.shop),
            drafts = draftRepository(tx, f.a.shop);
          const target =
            stage === "append" || stage === "advance" ? business : drafts;
          const original = target[stage];
          target[stage] = async (...args) => {
            await original(...args);
            throw Error(`injected ${stage}`);
          };
          return mutateDraft(
            {
              shopId: f.a.shop,
              actor: { type: "user", id: f.a.user },
              repository: drafts,
              workflows: new Map([
                [
                  "shop.calendar",
                  shopCalendarDraftWorkflow({
                    shopId: f.a.shop,
                    actorId: f.a.user,
                    repository: business,
                  }),
                ],
              ]),
            },
            d.draftId,
            "promote",
            {},
            { key, requestId: randomUUID(), ifMatch: '"v1"' },
          );
        }),
        new RegExp(`injected ${stage}`),
      );
      assert.deepEqual(await totals(f), { revisions: 0, audits: 0, keys: 0 });
      assert.equal(
        (await ok(await request(f, `drafts/${d.draftId}`))).lifecycle,
        "active",
      );
    }
    await ok(await promote(f, d));
    assert.deepEqual(await totals(f), { revisions: 1, audits: 1, keys: 1 });
  });
});
