import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyCalendarDefinition } from "@aarili/contracts/shop-calendar";
import {
  initialCommitmentScenario,
  syntheticCommitmentConfiguration,
} from "@aarili/contracts/shop-commitments";
import { mutateDraft } from "@aarili/core/drafts";
import {
  previewShopCommitments,
  shopCommitmentsDraftWorkflow,
} from "@aarili/core/shop-commitments";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { shopCalendarRepository } from "@aarili/db/shop-calendar-repository";
import { shopCommitmentsRepository } from "@aarili/db/shop-commitments-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const id = () => randomUUID().replace(/^(........-....-)./, "$17");
const value = () => ({
  baseVersion: 0,
  baseRevisionId: null,
  configuration: syntheticCommitmentConfiguration(),
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
  } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${shop}/${path}`, {
      method,
      headers: {
        Origin: f.owner.origin,
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
async function save(f, payload = value(), workflow = "shop.commitments") {
  const draftId = id();
  const record = (
    await ok(
      await request(f, `drafts/${draftId}`, {
        method: "PUT",
        body: { workflow, schemaVersion: 1, payload },
      }),
    )
  ).draft;
  return { draftId, record };
}
const promote = (f, d, key = randomUUID()) =>
  request(f, `drafts/${d.draftId}/promote`, {
    method: "POST",
    body: {},
    etag: `"v${d.record.version}"`,
    key,
  });
const preview = (
  f,
  source,
  calendarRevisionId = null,
  scenario = initialCommitmentScenario(),
  extra = {},
) =>
  request(f, "settings/commitments/preview", {
    method: "POST",
    body: {
      source,
      calendarRevisionId,
      scenario,
      previousFingerprint: null,
      ...extra,
    },
  });
const totals = async (f) =>
  (
    await f.admin.query(
      "select (select count(*)::int from shop_commitments_revision) revisions,(select count(*)::int from audit_event) audits,(select count(*)::int from idempotency_key) keys,(select count(*)::int from shop_commitments) pointers,(select count(*)::int from durable_draft where lifecycle='promoted') promoted",
    )
  ).rows[0];
test("SET-06/08/11 SS-05/06/07/09 unbound commitments publish/replay/CAS, preview authority and pinned calendar history", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    assert.deepEqual(await ok(await request(f, "settings/commitments")), {
      version: 0,
      revision: null,
    });
    const d = await save(f),
      other = await save(f),
      key = randomUUID();
    const replies = await Promise.all([
      promote(f, d, key).then(ok),
      promote(f, d, key.toUpperCase()).then(ok),
    ]);
    assert.deepEqual(replies[0], replies[1]);
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from shop_commitments_revision",
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await promote(f, other)).status, 412);
    const old = (await ok(await request(f, "settings/commitments"))).revision;
    assert.equal(old.authorityScope, "unbound-preview");
    const beforePreview = await totals(f);
    const r = await ok(
      await preview(f, { kind: "revision", revisionId: old.id }),
    );
    assert(
      r.warnings.includes("capacityExceeded") &&
        r.warnings.includes("cutoffPassed") &&
        r.warnings.includes("rush"),
    );
    assert.equal(r.effects, "none");
    assert.equal(r.activation, "unavailable");
    assert.deepEqual(await totals(f), beforePreview);
    const missing = await ok(
      await preview(f, { kind: "revision", revisionId: old.id }, null, {
        ...initialCommitmentScenario(),
        fixture: "missing-load",
      }),
    );
    assert(missing.unknowns.includes("loadMissing"));
    assert(missing.warnings.includes("rush"));
    const production = await ok(
      await preview(f, { kind: "revision", revisionId: old.id }, null, {
        ...initialCommitmentScenario(),
        mode: "production",
        categoryId: f.b.shop,
      }),
    );
    assert(production.unknowns.includes("categoryUnresolved"));
    assert(production.unknowns.includes("loadMissing"));
    assert.equal(production.activation, "unavailable");
    assert.equal(
      (
        await preview(
          f,
          { kind: "revision", revisionId: old.id },
          null,
          initialCommitmentScenario(),
          { load: { quantity: 0 } },
        )
      ).status,
      422,
    );
    const next = await save(f, {
      baseVersion: 1,
      baseRevisionId: old.id,
      configuration: { ...old.configuration, cap: 20 },
    });
    await ok(await promote(f, next));
    assert.deepEqual(
      await ok(await request(f, `settings/commitments/revisions/${old.id}`)),
      old,
    );
    assert.equal(
      (
        await ok(
          await request(f, "settings/commitments/history", {
            method: "POST",
            body: {},
          }),
        )
      ).revisions.length,
      2,
    );
    const definition = emptyCalendarDefinition();
    definition.week = definition.week.map(() => ({
      state: "closed",
      ranges: [],
      breaks: { state: "none", ranges: [] },
      slots: { state: "none", ranges: [] },
    }));
    const cal = await save(
      f,
      {
        baseVersion: 0,
        baseRevisionId: null,
        domain: "production",
        definition,
      },
      "shop.calendar",
    );
    await ok(await promote(f, cal));
    const cal1 = (await ok(await request(f, "settings/calendar"))).revision;
    const open = structuredClone(definition);
    open.week = open.week.map(() => ({
      state: "open",
      ranges: [{ start: "09:00", end: "17:00" }],
      breaks: { state: "none", ranges: [] },
      slots: { state: "none", ranges: [] },
    }));
    const cal2Draft = await save(
      f,
      {
        baseVersion: cal1.version,
        baseRevisionId: cal1.id,
        domain: "production",
        definition: open,
      },
      "shop.calendar",
    );
    await ok(await promote(f, cal2Draft));
    const cal2 = (await ok(await request(f, "settings/calendar"))).revision;
    const source = {
      kind: "draft",
      draft: {
        baseVersion: 2,
        baseRevisionId:
          next.record.result?.id ??
          (await ok(await request(f, "settings/commitments"))).revision.id,
        configuration: {
          ...old.configuration,
          leadBasis: "production",
          warningBasis: "production",
        },
      },
    };
    const closed = await ok(await preview(f, source, cal1.id));
    const opened = await ok(await preview(f, source, cal2.id));
    assert.equal(closed.facts.leadDays, 0);
    assert.equal(opened.facts.leadDays, 2);
    assert(closed.warnings.includes("noProductionAvailability"));
    assert.notEqual(closed.sources.calendar, opened.sources.calendar);
    assert.equal((await preview(f, source, f.b.shop)).status, 404);
    assert.equal(
      (
        await request(f, `settings/commitments/revisions/${old.id}`, {
          who: f.b,
        })
      ).status,
      404,
    );
    assert.equal(
      (await request(f, "settings/commitments", { who: f.b, shop: f.a.shop }))
        .status,
      403,
    );
    const foreign = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
      previewShopCommitments(
        {
          shopId: f.a.shop,
          actorId: f.a.user,
          repository: shopCommitmentsRepository(tx, f.a.shop),
          calendar: shopCalendarRepository(tx, f.a.shop),
          categories: {
            resolve: async () => ({
              shopId: f.b.shop,
              id: f.b.shop,
              version: "1",
              warningDays: 3,
              eligible: true,
              synthetic: false,
            }),
          },
        },
        {
          source: { kind: "revision", revisionId: old.id },
          calendarRevisionId: null,
          scenario: {
            ...initialCommitmentScenario(),
            mode: "production",
            categoryId: f.b.shop,
          },
          previousFingerprint: null,
        },
      ),
    );
    assert(foreign.unknowns.includes("categoryUnresolved"));
    const before = await totals(f);
    await assert.rejects(() =>
      f.runtime.db.transaction((tx) =>
        tx.execute(
          sql`insert into shop_commitments(shop_id,current_revision_id,version) values(${f.a.shop}::uuid,${old.id}::uuid,1)`,
        ),
      ),
    );
    await assert.rejects(() =>
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`update shop_commitments_revision set configuration='{}'::jsonb where shop_id=${f.a.shop}::uuid`,
        ),
      ),
    );
    assert.deepEqual(await totals(f), before);
  });
});
test("SS-07/09 commitments concurrent first publication and provenance deny foreign origins", {
  timeout: 120000,
}, async () => {
  await withTenantFixture(async (f) => {
    const a = await save(f),
      b = await save(f);
    const r = await Promise.all([promote(f, a), promote(f, b)]);
    assert.deepEqual(r.map((x) => x.status).sort(), [200, 412]);
    const revision = (await ok(await request(f, "settings/commitments")))
      .revision;
    await assert.rejects(() =>
      withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
        tx.execute(
          sql`insert into shop_commitments(shop_id,current_revision_id,version) values(${f.b.shop}::uuid,${revision.id}::uuid,1)`,
        ),
      ),
    );
    const invalid = await save(f, {
      ...value(),
      configuration: {
        ...value().configuration,
        peaks: [
          {
            label: "bad",
            start: "2026-02-30",
            end: "2026-03-01",
            cutoffDate: "2026-01-01",
            cutoffTime: "25:00",
          },
        ],
      },
    });
    assert.equal((await promote(f, invalid)).status, 422);
  });
});
test("SS-07/09 commitment revision/pointer/draft/audit/replay roll back at each boundary", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    for (const point of ["append", "advance", "update", "audit", "persist"]) {
      const d = await save(f),
        before = await totals(f),
        key = randomUUID();
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            const raw = shopCommitmentsRepository(tx, f.a.shop),
              dr = draftRepository(tx, f.a.shop);
            const repository = { ...raw };
            const drafts = { ...dr };
            if (point === "append" || point === "advance")
              repository[point] = async (...args) => {
                await raw[point](...args);
                throw Error("injected");
              };
            else
              drafts[point] = async (...args) => {
                await dr[point](...args);
                throw Error("injected");
              };
            return mutateDraft(
              {
                shopId: f.a.shop,
                actor: { type: "user", id: f.a.user },
                repository: drafts,
                workflows: new Map([
                  [
                    "shop.commitments",
                    shopCommitmentsDraftWorkflow({
                      shopId: f.a.shop,
                      actorId: f.a.user,
                      repository,
                      calendar: shopCalendarRepository(tx, f.a.shop),
                      categories: { resolve: async () => null },
                    }),
                  ],
                ]),
              },
              d.draftId,
              "promote",
              {},
              {
                key,
                ifMatch: `"v${d.record.version}"`,
                requestId: randomUUID(),
              },
            );
          }),
        /injected/,
      );
      assert.deepEqual(await totals(f), before);
      assert.equal(
        (await ok(await request(f, `drafts/${d.draftId}`))).lifecycle,
        "active",
      );
    }
  });
});
