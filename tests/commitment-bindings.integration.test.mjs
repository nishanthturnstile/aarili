import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import {
  initialCommitmentScenario,
  syntheticCommitmentConfiguration,
} from "@aarili/contracts/shop-commitments";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { serviceCatalogueDraftWorkflow } from "@aarili/core/service-catalogue";
import {
  commitmentBindingsDraftWorkflow,
  previewBoundShopCommitments,
  shopCommitmentsDraftWorkflow,
} from "@aarili/core/shop-commitments";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import {
  approvedCategoryResolver,
  serviceCatalogueRepository,
} from "@aarili/db/service-catalogue-repository";
import { shopCalendarRepository } from "@aarili/db/shop-calendar-repository";
import {
  commitmentBindingsRepository,
  shopCommitmentsRepository,
} from "@aarili/db/shop-commitments-repository";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
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
async function save(
  f,
  payload,
  workflow = "service.commitment-bindings",
  who = f.a,
) {
  const draftId = id();
  const { draft } = await ok(
    await request(f, `drafts/${draftId}`, {
      method: "PUT",
      body: { workflow, schemaVersion: 1, payload },
      who,
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
async function publish(f, payload, workflow) {
  const d = await save(f, payload, workflow);
  return (await ok(await promote(f, d))).draft.result.id;
}
const categoryValue = (extra = {}) => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition",
  available: true,
  reason: "SYNTHETIC test review only",
  content: {
    ...emptyCatalogueContent("category"),
    code: `category-${randomUUID()}`,
    labelEn: "SYNTHETIC category",
    labelTa: "சோதனை வகை",
    warningDays: 7,
  },
  ...extra,
});
async function category(f, value = categoryValue()) {
  const rid = await publish(f, value, "service.catalogue");
  return ok(await request(f, `settings/catalogue/revisions/${rid}`));
}
async function rule(
  f,
  configuration = {
    ...syntheticCommitmentConfiguration(),
    authority: "owner-proposal",
  },
  base = null,
) {
  const rid = await publish(
    f,
    {
      baseVersion: base?.version ?? 0,
      baseRevisionId: base?.id ?? null,
      configuration,
    },
    "shop.commitments",
  );
  return ok(await request(f, `settings/commitments/revisions/${rid}`));
}
const value = (c, r, base = null) => ({
  categoryId: c.entryId,
  categoryRevisionId: c.definition.id,
  availabilityId: c.id,
  ruleRevisionId: r.id,
  baseVersion: base?.version ?? 0,
  baseRevisionId: base?.id ?? null,
  review: "reviewed",
  reason: "SYNTHETIC exact source review",
});
const preview = (f, b, extra = {}) =>
  request(f, "settings/commitments/bound-preview", {
    method: "POST",
    body: {
      contractVersion: 2,
      bindingId: b.id,
      calendarRevisionId: null,
      scenario: {
        ...initialCommitmentScenario(),
        mode: "production",
        quantity: null,
        unit: null,
      },
      previousFingerprint: null,
      ...extra,
    },
  });
const revision = async (f, rid) =>
  ok(await request(f, `settings/commitments/binding-revisions/${rid}`));
const totals = async (f) =>
  (
    await f.admin.query(
      "select (select count(*)::int from service_commitment_binding_revision) revisions,(select count(*)::int from service_commitment_binding) pointers,(select count(*)::int from audit_event) audits,(select count(*)::int from idempotency_key) keys,(select count(*)::int from durable_draft where lifecycle='promoted') promoted",
    )
  ).rows[0];

test("ST-07/09 bound preview keeps its validated category when a source edit commits during calendar lookup", {
  timeout: 120000,
}, async () => {
  await withTenantFixture(async (f) => {
    const c = await category(f),
      r = await rule(f),
      b = await revision(
        f,
        await publish(f, value(c, r), "service.commitment-bindings"),
      ),
      changed = await save(
        f,
        {
          ...categoryValue(),
          entryId: c.entryId,
          baseVersion: c.version,
          baseRevisionId: c.id,
          content: { ...c.definition.content, warningDays: 15 },
        },
        "service.catalogue",
      );
    const result = await withShop(
      f.parallel.db,
      f.a.user,
      f.a.shop,
      async (tx) => {
        const calendar = shopCalendarRepository(tx, f.a.shop);
        return previewBoundShopCommitments(
          {
            shopId: f.a.shop,
            actorId: f.a.user,
            repository: shopCommitmentsRepository(tx, f.a.shop),
            catalogue: serviceCatalogueRepository(tx, f.a.shop),
            bindings: commitmentBindingsRepository(tx, f.a.shop),
            categories: approvedCategoryResolver(tx, f.a.shop),
            calendar: {
              ...calendar,
              async current() {
                await ok(await promote(f, changed));
                return calendar.current();
              },
            },
          },
          {
            contractVersion: 2,
            bindingId: b.id,
            calendarRevisionId: null,
            scenario: { ...initialCommitmentScenario(), mode: "production" },
            previousFingerprint: null,
          },
        );
      },
    );
    assert.equal(result.sources.categoryRevision, c.definition.id);
    assert.equal(result.sources.availability, c.id);
    assert.equal(result.facts.warningWindow, 7);
    assert.equal((await preview(f, b)).status, 409);
  });
});

test("ST-07/08/09/10/12 exact bound sources, v1 bytes, replay/CAS/409/422, immutable retirement history and resolver", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const c = await category(f),
      earlierRule = await rule(f),
      r = await rule(f, { ...earlierRule.configuration, cap: 12 }, earlierRule),
      other = await category(f);
    const oldBytes = (
      await f.admin.query(
        "select row_to_json(r)::text bytes from shop_commitments_revision r where id=$1",
        [r.id],
      )
    ).rows[0].bytes;
    const d = await save(f, value(c, r)),
      stale = await save(f, value(c, r)),
      key = randomUUID();
    assert.equal((await promote(f, d, key, { etag: undefined })).status, 428);
    assert.equal((await promote(f, d, key, { etag: '"v99"' })).status, 412);
    const [a, b] = await Promise.all([
      promote(f, d, key).then(ok),
      promote(f, d, key.toUpperCase()).then(ok),
    ]);
    assert.deepEqual(a, b);
    assert.equal((await promote(f, stale)).status, 412);
    const binding = await revision(f, a.draft.result.id),
      before = await totals(f);
    const p = await ok(await preview(f, binding));
    assert.equal(p.contractVersion, 2);
    assert.equal(p.authority, "owner-reviewed");
    assert.equal(p.facts.warningWindow, 7);
    assert(
      p.unknowns.includes("loadMissing") &&
        p.unknowns.includes("candidateDemandMissing"),
    );
    assert(!p.unknowns.includes("productionAuthorityPending"));
    assert(p.warnings.includes("rush") && p.warnings.includes("cutoffPassed"));
    assert.equal(p.activation, "unavailable");
    assert.equal(p.effects, "none");
    assert.deepEqual(await totals(f), before);
    assert.equal(
      (await preview(f, binding, { ruleRevisionId: randomUUID() })).status,
      409,
    );
    assert.equal(
      (await preview(f, binding, { ruleRevisionId: earlierRule.id })).status,
      409,
    );
    assert.equal(
      (await preview(f, binding, { categoryRevisionId: other.definition.id }))
        .status,
      409,
    );
    assert.equal(
      (
        await preview(f, binding, {
          scenario: {
            ...initialCommitmentScenario(),
            mode: "production",
            categoryId: other.entryId,
          },
        })
      ).status,
      409,
    );
    for (const extra of [
      { load: { quantity: 0 } },
      { approved: true },
      { eligible: true },
    ])
      assert.equal((await preview(f, binding, extra)).status, 422);
    assert.equal(
      (
        await request(
          f,
          `settings/commitments/binding-revisions/${binding.id}`,
          { who: f.b },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          f,
          `settings/commitments/binding-revisions/${binding.id}`,
          { who: f.b, shop: f.a.shop },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(f, `drafts/${d.draftId}/promote`, {
          method: "POST",
          body: { changed: true },
          key,
          etag: '"v1"',
        })
      ).status,
      422,
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      const resolver = approvedCategoryResolver(tx, f.a.shop);
      assert.equal((await resolver.resolve(c.entryId)).warningDays, 7);
      assert.equal(await resolver.resolve(f.b.shop), null);
      assert.equal(await resolver.resolve(randomUUID()), null);
      const tables = await assertIsolationCatalog(tx);
      assert(tables.includes("public.service_commitment_binding_revision"));
    });
    assert.equal(
      (
        await f.runtime.db.execute(
          sql`select * from service_commitment_binding_revision`,
        )
      ).rowCount,
      0,
    );
    const r2 = await rule(f, { ...r.configuration, warningDays: 9 }, r);
    assert.equal((await preview(f, binding)).status, 409);
    assert.equal(
      (await preview(f, binding, { ruleRevisionId: r2.id })).status,
      409,
    );
    assert.equal(
      (await promote(f, await save(f, value(c, r, binding)))).status,
      409,
    );
    const c2 = await category(f, {
      ...categoryValue(),
      entryId: c.entryId,
      baseVersion: c.version,
      baseRevisionId: c.id,
      content: { ...c.definition.content, warningDays: 12 },
    });
    assert.equal(
      (
        await preview(f, binding, {
          categoryRevisionId: c2.definition.id,
          ruleRevisionId: r2.id,
        })
      ).status,
      409,
    );
    assert.deepEqual(await revision(f, binding.id), binding);
    const b2 = await revision(
      f,
      await publish(f, value(c2, r2, binding), "service.commitment-bindings"),
    );
    assert.equal((await ok(await preview(f, b2))).facts.warningWindow, 12);
    assert.deepEqual(
      await ok(await request(f, `settings/catalogue/revisions/${c.id}`)),
      c,
    );
    assert.equal(
      Math.max(
        (await ok(await request(f, `settings/commitments/revisions/${r.id}`)))
          .configuration.warningDays,
        c.definition.content.warningDays,
      ),
      7,
    );
    const retired = await category(f, {
      ...categoryValue(),
      entryId: c2.entryId,
      baseVersion: c2.version,
      baseRevisionId: c2.id,
      operation: "availability",
      content: c2.definition.content,
      available: false,
    });
    assert.equal((await preview(f, b2)).status, 409);
    assert.equal(
      (await ok(await request(f, `settings/commitments/bindings/${c.entryId}`)))
        .currentEligible,
      false,
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      assert.equal(
        await approvedCategoryResolver(tx, f.a.shop).resolve(retired.entryId),
        null,
      );
      await assert.rejects(() =>
        tx.execute(
          sql`update service_commitment_binding_revision set reason='changed' where shop_id=${f.a.shop}::uuid`,
        ),
      );
    });
    assert.deepEqual(await revision(f, binding.id), binding);
    assert.equal(
      (
        await f.admin.query(
          "select row_to_json(r)::text bytes from shop_commitments_revision r where id=$1",
          [r.id],
        )
      ).rows[0].bytes,
      oldBytes,
    );
    for (const response of [
      await promote(f, d, key, { etag: '"v2"' }),
      await promote(f, stale, key),
      await request(f, `drafts/${d.draftId}`, {
        method: "PUT",
        key,
        etag: '"v1"',
        body: {
          workflow: "service.commitment-bindings",
          schemaVersion: 1,
          payload: value(c, r),
        },
      }),
    ]) {
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, "IDEMPOTENCY_MISMATCH");
    }
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    const actorReplay = await promote(f, d, key, { who: f.b, shop: f.a.shop });
    assert.equal(actorReplay.status, 422);
    assert.equal((await actorReplay.json()).error.code, "IDEMPOTENCY_MISMATCH");
    assert.equal(
      (
        await ok(
          await request(f, "settings/commitments/binding-history", {
            method: "POST",
            body: { categoryId: c.entryId },
          }),
        )
      ).revisions.length,
      2,
    );
  });
});

test("ST-08/09 synthetic and pending source authority cannot become production; incomplete reviewed conventions stay unknown", {
  timeout: 120000,
}, async () => {
  await withTenantFixture(async (f) => {
    const c = await category(f),
      r = await rule(f),
      pending = await revision(
        f,
        await publish(
          f,
          { ...value(c, r), review: "pending" },
          "service.commitment-bindings",
        ),
      );
    assert(
      (await ok(await preview(f, pending))).unknowns.includes(
        "productionAuthorityPending",
      ),
    );
    const incomplete = await rule(
      f,
      { ...r.configuration, allocation: null, leadBasis: null },
      r,
    );
    const b = await revision(
      f,
      await publish(
        f,
        value(c, incomplete, pending),
        "service.commitment-bindings",
      ),
    );
    const p = await ok(await preview(f, b));
    assert(p.unknowns.includes("capacityConventionMissing"));
    assert(p.unknowns.includes("countBasisMissing"));
    const synthetic = await rule(
        f,
        syntheticCommitmentConfiguration(),
        incomplete,
      ),
      b2 = await revision(
        f,
        await publish(f, value(c, synthetic, b), "service.commitment-bindings"),
      );
    assert.equal(b2.authority, "synthetic-fixture");
    assert(
      (await ok(await preview(f, b2))).unknowns.includes(
        "productionAuthorityPending",
      ),
    );
  });
  await withTenantFixture(
    async (f) => {
      const c = await category(f),
        r = await rule(f),
        b = await revision(
          f,
          await publish(f, value(c, r), "service.commitment-bindings"),
        );
      assert.equal(b.authority, "synthetic-fixture");
      assert(
        (await ok(await preview(f, b))).unknowns.includes(
          "syntheticCategoryDenied",
        ),
      );
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
});

test("ST-10 binding publication concurrent CAS and stale source publication locks", {
  timeout: 120000,
}, async () => {
  await withTenantFixture(async (f) => {
    const c = await category(f),
      r = await rule(f),
      d1 = await save(f, value(c, r)),
      d2 = await save(f, value(c, r));
    const replies = await Promise.all([promote(f, d1), promote(f, d2)]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 412]);
    const old = (
      await ok(await request(f, `settings/commitments/bindings/${c.entryId}`))
    ).revision;
    const d = await save(f, value(c, r, old));
    let release, locked;
    const gate = new Promise((r) => {
        release = r;
      }),
      ready = new Promise((r) => {
        locked = r;
      });
    const change = withShop(f.parallel.db, f.a.user, f.a.shop, async (tx) => {
      await serviceCatalogueRepository(tx, f.a.shop).lock();
      locked();
      await gate;
    });
    await ready;
    const publishing = promote(f, d);
    await new Promise((r) => setTimeout(r, 50));
    release();
    await change;
    await ok(await publishing);
    // A genuinely changed source committed while holding the same canonical lock makes a waiting publication stale.
    const now = (
        await ok(await request(f, `settings/commitments/bindings/${c.entryId}`))
      ).revision,
      d3 = await save(f, value(c, r, now));
    const changedRule = await save(
      f,
      {
        baseVersion: r.version,
        baseRevisionId: r.id,
        configuration: { ...r.configuration, cap: 11 },
      },
      "shop.commitments",
    );
    let commitRule, ruleWritten;
    const waitRule = new Promise((resolve) => {
        commitRule = resolve;
      }),
      wroteRule = new Promise((resolve) => {
        ruleWritten = resolve;
      });
    const sourceChange = withShop(
      f.parallel.db,
      f.a.user,
      f.a.shop,
      async (tx) => {
        const ctx = {
          shopId: f.a.shop,
          actorId: f.a.user,
          repository: shopCommitmentsRepository(tx, f.a.shop),
          calendar: shopCalendarRepository(tx, f.a.shop),
          categories: approvedCategoryResolver(tx, f.a.shop),
        };
        await mutateDraft(
          {
            shopId: f.a.shop,
            actor: { type: "user", id: f.a.user },
            repository: draftRepository(tx, f.a.shop),
            workflows: new Map([
              ["shop.commitments", shopCommitmentsDraftWorkflow(ctx)],
            ]),
          },
          changedRule.draftId,
          "promote",
          {},
          { key: randomUUID(), ifMatch: '"v1"', requestId: randomUUID() },
        );
        ruleWritten();
        await waitRule;
      },
    );
    await wroteRule;
    const waiting = promote(f, d3);
    await new Promise((resolve) => setTimeout(resolve, 50));
    commitRule();
    await sourceChange;
    assert.equal((await waiting).status, 409);
    const latest = (await ok(await request(f, "settings/commitments")))
      .revision;
    const bDraft = await save(f, value(c, latest, now));
    const categoryDraft = await save(
      f,
      {
        ...categoryValue(),
        entryId: c.entryId,
        baseVersion: c.version,
        baseRevisionId: c.id,
        content: { ...c.definition.content, warningDays: 15 },
      },
      "service.catalogue",
    );
    let commitCategory, categoryWritten;
    const waitCategory = new Promise((resolve) => {
        commitCategory = resolve;
      }),
      wroteCategory = new Promise((resolve) => {
        categoryWritten = resolve;
      });
    const categoryChange = withShop(
      f.parallel.db,
      f.a.user,
      f.a.shop,
      async (tx) => {
        const workflow = serviceCatalogueDraftWorkflow({
          shopId: f.a.shop,
          actorId: f.a.user,
          repository: serviceCatalogueRepository(tx, f.a.shop),
          synthetic: false,
        });
        await mutateDraft(
          {
            shopId: f.a.shop,
            actor: { type: "user", id: f.a.user },
            repository: draftRepository(tx, f.a.shop),
            workflows: new Map([["service.catalogue", workflow]]),
          },
          categoryDraft.draftId,
          "promote",
          {},
          { key: randomUUID(), ifMatch: '"v1"', requestId: randomUUID() },
        );
        categoryWritten();
        await waitCategory;
      },
    );
    await wroteCategory;
    const categoryWaiting = promote(f, bDraft);
    await new Promise((resolve) => setTimeout(resolve, 50));
    commitCategory();
    await categoryChange;
    assert.equal((await categoryWaiting).status, 409);
  });
});

test("ST-10 rollback after actual revision, pointer, draft, audit and replay writes; tenant composite source rejection", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const c = await category(f),
      r = await rule(f);
    for (const point of ["append", "advance", "update", "audit", "persist"]) {
      const d = await save(f, value(c, r)),
        before = await totals(f);
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            const raw = commitmentBindingsRepository(tx, f.a.shop),
              dr = draftRepository(tx, f.a.shop),
              bindings = { ...raw },
              drafts = { ...dr };
            if (point === "append" || point === "advance")
              bindings[point] = async (...args) => {
                await raw[point](...args);
                throw Error(`injected ${point}`);
              };
            else
              drafts[point] = async (...args) => {
                await dr[point](...args);
                throw Error(`injected ${point}`);
              };
            const ctx = {
              shopId: f.a.shop,
              actorId: f.a.user,
              repository: shopCommitmentsRepository(tx, f.a.shop),
              calendar: shopCalendarRepository(tx, f.a.shop),
              catalogue: serviceCatalogueRepository(tx, f.a.shop),
              categories: approvedCategoryResolver(tx, f.a.shop),
              bindings,
            };
            return mutateDraft(
              {
                shopId: f.a.shop,
                actor: { type: "user", id: f.a.user },
                repository: drafts,
                workflows: new Map([
                  [
                    "service.commitment-bindings",
                    commitmentBindingsDraftWorkflow(ctx),
                  ],
                ]),
              },
              d.draftId,
              "promote",
              {},
              { key: randomUUID(), ifMatch: '"v1"', requestId: randomUUID() },
            );
          }),
        new RegExp(`injected ${point}`),
      );
      assert.deepEqual(await totals(f), before);
      assert.equal(
        (await ok(await request(f, `drafts/${d.draftId}`))).lifecycle,
        "active",
      );
    }
    const foreign = await save(f, { ...value(c, r), categoryId: f.b.shop });
    assert.equal((await promote(f, foreign)).status, 409);
    const missing = await save(f, {
      ...value(c, r),
      ruleRevisionId: randomUUID(),
    });
    assert.equal((await promote(f, missing)).status, 409);
    const constraints = (
      await f.admin.query(
        "select pg_get_constraintdef(oid) def from pg_constraint where conrelid='service_commitment_binding_revision'::regclass and contype='f'",
      )
    ).rows.map((x) => x.def);
    assert(
      constraints.some((x) =>
        x.includes("FOREIGN KEY (shop_id, category_id, category_revision_id)"),
      ),
    );
    assert(
      constraints.some((x) =>
        x.includes("FOREIGN KEY (shop_id, rule_revision_id)"),
      ),
    );
  });
});

test("ST-07/10 upgrade from populated baseline preserves every old unbound byte and existing settings/customer data", {
  timeout: 120000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      const c = await category(f),
        r = await rule(f);
      const policy = await ok(await request(f, "customers/policy"));
      await ok(
        await request(f, "customers", {
          method: "POST",
          body: {
            displayName: "SYNTHETIC preserved customer",
            serviceEvidence: {
              noticeId: policy.notice.id,
              language: "en",
              decision: "grant",
              giver: "self",
              noticeExplained: true,
              source: "in-person",
              occurredAt: new Date(Date.now() - 60000).toISOString(),
            },
          },
        }),
      );
      const profile = await ok(await request(f, "settings/profile"));
      await ok(
        await request(f, "settings/profile", {
          method: "PUT",
          etag: `"v${profile.version}"`,
          body: {
            ...profile.profile,
            displayName: "SYNTHETIC preserved settings",
          },
        }),
      );
      const snapshot = async () =>
        (
          await f.admin.query(
            "select (select jsonb_agg(row_to_json(r)::text order by id) from shop_commitments_revision r) rules,(select jsonb_agg(row_to_json(r)::text order by id) from service_catalogue_revision r) categories,(select jsonb_agg(row_to_json(r)::text order by shop_id) from shop r) shops,(select jsonb_agg(row_to_json(r)::text order by id) from durable_draft r) drafts,(select jsonb_agg(row_to_json(r)::text order by id) from customer r) customers,(select jsonb_agg(row_to_json(r)::text order by id) from shop_profile_revision r) profiles",
          )
        ).rows[0];
      const before = await snapshot();
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await snapshot(), before);
      const b = await revision(
        f,
        await publish(f, value(c, r), "service.commitment-bindings"),
      );
      assert.equal(b.authority, "synthetic-fixture");
      assert.equal((await ok(await preview(f, b))).effects, "none");
    },
    {
      migrationThrough: "0026_measurement_forms.sql",
      customerPolicy: syntheticCustomerPolicy,
    },
  );
});
