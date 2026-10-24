import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyRate } from "@aarili/contracts/quotation-rates";
import { emptyPolicy } from "@aarili/contracts/shop-policies";
import { mutateDraft } from "@aarili/core/drafts";
import {
  quotePolicyReviewWorkflow,
  rateDraftWorkflow,
  resolveRate,
  shopDate,
} from "@aarili/core/quotation-rates";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  draftUuid,
  rateContext,
  seedQuotationSources,
} from "../scripts/test-support/quotation-rate-fixtures.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const headers = (version, key = randomUUID()) => ({
  key,
  requestId: randomUUID(),
  ...(version ? { ifMatch: `"v${version}"` } : {}),
});
const setup = async (f) => {
  const source = await seedQuotationSources(f.runtime.pool, f.a.shop);
  return {
    ...source,
    value: {
      ...emptyRate(randomUUID()),
      source: { entryId: source.source.entryId, revisionId: source.source.id },
      component: "labour",
      unit: "item",
      basisText: "1",
      reason: "SYNTHETIC exact owner review",
      entries: [
        {
          entryId: randomUUID(),
          from: shopDate(new Date()),
          until: "",
          rateText: "100.01",
        },
      ],
    },
  };
};
async function command(f, id, action, input, h, change, who = f.a) {
  return withShop(f.parallel.db, who.user, who.shop, async (tx) => {
    const ctx = rateContext(tx, who.shop, who.user);
    change?.(ctx);
    return mutateDraft(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: ctx.drafts,
        workflows: new Map([
          ["pricing.rate", rateDraftWorkflow(ctx)],
          ["pricing.policy-review", quotePolicyReviewWorkflow(ctx)],
        ]),
      },
      id,
      action,
      input,
      h,
    );
  });
}
async function save(f, value, workflow = "pricing.rate") {
  const id = draftUuid();
  return (
    await command(
      f,
      id,
      "save",
      { workflow, schemaVersion: 1, payload: value },
      headers(),
    )
  ).draft;
}
const promotion = (f, d, key = randomUUID(), change) =>
  command(f, d.id, "promote", {}, headers(d.version, key), change);

test("A1-01/06 populated 0052 upgrade retains catalogue/profile bytes and seeds no rates; production cannot adopt fixtures", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      const { value } = await setup(f);
      const snapshot = async () =>
        (
          await f.admin.query(
            "select (select jsonb_agg(to_jsonb(p) order by p.id) from shop_profile_revision p) profiles,(select jsonb_agg(to_jsonb(c) order by c.id) from service_catalogue_revision c) catalogue",
          )
        ).rows[0];
      const before = await snapshot();
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await counts(f)).rates, "0");
      assert.equal((await counts(f)).policies, "0");
      const draft = await save(f, value);
      await assert.rejects(
        promotion(f, draft, randomUUID(), (ctx) => {
          ctx.synthetic = false;
        }),
        (e) => e.status === 409,
      );
      assert.equal((await counts(f)).rates, "0");
    },
    { migrationThrough: "0052_material_labels.sql" },
  );
});
const counts = async (f) =>
  (
    await f.admin.query(
      "select (select count(*) from quotation_rate_revision) rates,(select count(*) from quotation_rate_entry) entries,(select count(*) from quotation_policy_binding) policies,(select count(*) from journal_batch) journal,(select count(*) from audit_event) audits,(select count(*) from idempotency_key) keys",
    )
  ).rows[0];
async function api(f, path, body, who = f.a) {
  return f.api.fetch(
    new Request(
      `${f.owner.origin}/api/shops/${who.shop}/settings/rates/${path}`,
      {
        method: "POST",
        headers: {
          Origin: f.owner.origin,
          Cookie: who.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    ),
  );
}
test(
  "A1-01/02/03/05/06 Q-01/10/11 real owner rate history, exact prices, no postings, replay and source disable",
  { timeout: 180000 },
  async () =>
    withTenantFixture(async (f) => {
      const { value } = await setup(f),
        before = await counts(f),
        d = await save(f, value),
        key = randomUUID();
      const results = await Promise.all([
        promotion(f, d, key),
        promotion(f, d, key),
      ]);
      assert.deepEqual(results[0], results[1]);
      const issue = results[0].draft.result;
      const result = await api(f, "list", {});
      assert.equal(result.status, 200, await result.clone().text());
      const list = await result.json();
      assert.equal(list.revisions[0].entries[0].ratePaise, 10001);
      assert.equal(list.revisions[0].authority, "synthetic-only");
      assert.match(list.revisions[0].contentHash, /^[a-f0-9]{64}$/);
      const old = list.revisions[0],
        oldBytes = JSON.stringify(old);
      assert.equal(
        (
          await (
            await api(f, "resolve", {
              rateId: old.rateId,
              date: value.entries[0].from,
            })
          ).json()
        ).state,
        "known",
      );
      await assert.rejects(
        command(
          f,
          d.id,
          "promote",
          { different: true },
          headers(d.version, key),
        ),
        (e) => e.status === 422,
      );
      const revised = await save(f, {
        ...value,
        baseVersion: 1,
        baseRevisionId: issue.id,
        reason: "SYNTHETIC deliberate new rate",
        entries: [{ ...value.entries[0], rateText: "0" }],
      });
      await promotion(f, revised);
      const hist = await (
        await api(f, "history", { rateId: old.rateId })
      ).json();
      assert.equal(hist.revisions.length, 2);
      assert.equal(JSON.stringify(hist.revisions[1]), oldBytes);
      assert.equal(hist.revisions[0].entries[0].ratePaise, 0);
      assert.notEqual(hist.revisions[0].contentHash, old.contentHash);
      const catalogueSource = await withShop(
        f.runtime.db,
        f.a.user,
        f.a.shop,
        (tx) =>
          rateContext(tx, f.a.shop, f.a.user).catalogue.repository.current(
            value.source.entryId,
          ),
      );
      const disabledDraft = (
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          (ctx) =>
            mutateDraft(
              ctx,
              draftUuid(),
              "save",
              {
                workflow: "service.catalogue",
                schemaVersion: 1,
                payload: {
                  entryId: catalogueSource.entryId,
                  baseVersion: catalogueSource.version,
                  baseRevisionId: catalogueSource.id,
                  operation: "availability",
                  available: false,
                  reason: "SYNTHETIC source disabled",
                  content: catalogueSource.definition.content,
                },
              },
              headers(),
            ),
        )
      ).data.draft;
      await f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        (ctx) =>
          mutateDraft(
            ctx,
            disabledDraft.id,
            "promote",
            {},
            headers(disabledDraft.version),
          ),
      );
      const staleSource = await save(f, {
        ...value,
        baseVersion: 2,
        baseRevisionId: hist.revisions[0].id,
      });
      await assert.rejects(promotion(f, staleSource), (e) => e.status === 409);
      assert.equal(
        (
          await (
            await api(f, "resolve", {
              rateId: old.rateId,
              date: value.entries[0].from,
            })
          ).json()
        ).state,
        "unavailable",
      );
      const retired = await save(f, {
        ...value,
        baseVersion: 2,
        baseRevisionId: hist.revisions[0].id,
        available: false,
        entries: [{ ...value.entries[0], rateText: "0" }],
      });
      await promotion(f, retired);
      assert.equal(
        (
          await (
            await api(f, "resolve", {
              rateId: old.rateId,
              date: value.entries[0].from,
            })
          ).json()
        ).state,
        "unavailable",
      );
      assert.equal((await counts(f)).journal, before.journal);
      assert(
        (await assertIsolationCatalog(f.runtime.db)).includes(
          "public.quotation_rate_entry",
        ),
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update quotation_rate_revision set content='{}'::jsonb where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update quotation_rate set version=version+1 where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`insert into quotation_rate_entry(shop_id,revision_id,entry_id,position,valid_from,rate_paise) values(${f.a.shop}::uuid,${old.id}::uuid,${randomUUID()}::uuid,10,current_date,0)`,
          ),
        ),
      );
      // New-key retry cannot promote an already consumed durable origin.
      await assert.rejects(
        promotion(f, d),
        (e) => e.status === 412 || e.status === 409,
      );
      const foreign = await api(f, "history", { rateId: old.rateId }, f.b);
      assert.equal(foreign.status, 200);
      assert.deepEqual((await foreign.json()).revisions, []);
      const foreignRead = await f.api.fetch(
        new Request(
          `${f.owner.origin}/api/shops/${f.b.shop}/settings/rates/revisions/${old.id}`,
          { headers: { Cookie: f.b.cookie } },
        ),
      );
      assert.equal(foreignRead.status, 404);
      assert.deepEqual(
        (
          await f.runtime.db.execute(
            sql`select id from quotation_rate_revision`,
          )
        ).rows,
        [],
      );
    }),
);
test(
  "A1-02/03/06 Q-01/11 gaps, overlap/backdate rejection, first identity races and rollback after real writes",
  { timeout: 180000 },
  async () =>
    withTenantFixture(async (f) => {
      const { value } = await setup(f),
        today = value.entries[0].from;
      const overlap = await save(f, {
        ...value,
        entries: [
          ...value.entries,
          { ...value.entries[0], entryId: randomUUID() },
        ],
      });
      await assert.rejects(promotion(f, overlap), (e) => e.status === 409);
      const past = await save(f, {
        ...value,
        entries: [{ ...value.entries[0], from: "2000-01-01" }],
      });
      await assert.rejects(promotion(f, past), (e) => e.status === 409);
      const d1 = await save(f, value),
        d2 = await save(f, { ...value, rateId: randomUUID() }),
        outcomes = await Promise.allSettled([
          promotion(f, d1),
          promotion(f, d2),
        ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      const winner = outcomes.find((r) => r.status === "fulfilled").value.draft
          .result,
        old = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          rateContext(tx, f.a.shop, f.a.user).repository.read(winner.id),
        );
      const candidate = await save(f, {
          ...value,
          rateId: old.rateId,
          baseVersion: 1,
          baseRevisionId: old.id,
          reason: "SYNTHETIC rollback proof",
        }),
        before = await counts(f);
      await assert.rejects(
        promotion(f, candidate, randomUUID(), (ctx) => {
          const append = ctx.repository.append;
          ctx.repository.append = async (v) => {
            await append(v);
            throw Error("INJECTED_AFTER_RATE_CHILDREN");
          };
        }),
        /INJECTED_AFTER_RATE_CHILDREN/,
      );
      assert.deepEqual(await counts(f), before);
      await assert.rejects(
        command(
          f,
          candidate.id,
          "promote",
          {},
          { key: randomUUID(), requestId: randomUUID() },
        ),
        (e) => e.status === 428,
      );
      await assert.rejects(
        command(f, candidate.id, "promote", {}, headers(999)),
        (e) => e.status === 412,
      );
      const resolver = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        resolveRate(rateContext(tx, f.a.shop, f.a.user), {
          rateId: old.rateId,
          date: "2000-01-01",
        }),
      );
      assert.equal(resolver.state, "missing");
      const replacement = await save(f, {
        ...candidate.payload,
        reason: "SYNTHETIC concurrent replacement",
      });
      const race = await Promise.allSettled([
        promotion(f, candidate),
        promotion(f, replacement),
      ]);
      assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        race.find((r) => r.status === "rejected").reason.status,
        412,
      );
      assert.equal(today, shopDate(new Date()));
      // No RLS context leaks after successful or rolled-back tenant transactions.
      assert.deepEqual(
        (await f.runtime.db.execute(sql`select * from quotation_rate_entry`))
          .rows,
        [],
      );
    }),
);
test(
  "A1-04/06 Q-07/10/11 exact policy proposal binding, history/stale source and no unrelated activation",
  { timeout: 180000 },
  async () =>
    withTenantFixture(async (f) => {
      const sourceId = draftUuid(),
        policy = {
          ...emptyPolicy("quoteValidity"),
          state: "reviewed",
          calendarDays: 7,
          terms: {
            en: "SYNTHETIC quote terms",
            ta: "செயற்கை விலைப்புள்ளி விதிகள்",
          },
          authority: {
            kind: "owner-proposal",
            label: "SYNTHETIC owner proposal",
          },
        },
        payload = { baseVersion: 0, baseRevisionId: null, policy };
      const source = (
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          (ctx) =>
            mutateDraft(
              ctx,
              sourceId,
              "save",
              { workflow: "shop.policies", schemaVersion: 1, payload },
              headers(),
            ),
        )
      ).data.draft;
      const review = await save(
        f,
        {
          kind: "quoteValidity",
          baseVersion: 0,
          baseRevisionId: null,
          sourceDraftId: source.id,
          sourceDraftVersion: source.version,
          reason: "SYNTHETIC quotation-only review",
          acknowledged: true,
        },
        "pricing.policy-review",
      );
      const policyKey = randomUUID(),
        beforeBinding = await counts(f);
      await assert.rejects(
        promotion(f, review, policyKey, (ctx) => {
          const bind = ctx.repository.bind;
          ctx.repository.bind = async (v) => {
            await bind(v);
            throw Error("INJECTED_AFTER_POLICY_BINDING_AND_AUDIT");
          };
        }),
        /INJECTED_AFTER_POLICY_BINDING_AND_AUDIT/,
      );
      assert.deepEqual(await counts(f), beforeBinding);
      const replayed = await Promise.all([
        promotion(f, review, policyKey),
        promotion(f, review, policyKey),
      ]);
      assert.deepEqual(replayed[0], replayed[1]);
      const list = await (
          await api(f, "policies", { kind: "quoteValidity" })
        ).json(),
        binding = list.bindings[0];
      assert.equal(binding.sourceCurrent, true);
      assert.equal(binding.authority, "synthetic-only");
      assert.equal(binding.actionScope, "quotation-only");
      assert.deepEqual(binding.policy, policy);
      // Unchanged old publisher still refuses owner proposals, even after the new binding.
      await assert.rejects(
        f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          (ctx) =>
            mutateDraft(ctx, sourceId, "promote", {}, headers(source.version)),
        ),
        (e) => e.status === 422,
      );
      await f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        (ctx) =>
          mutateDraft(
            ctx,
            sourceId,
            "save",
            {
              workflow: "shop.policies",
              schemaVersion: 1,
              payload: { ...payload, policy: { ...policy, calendarDays: 8 } },
            },
            headers(source.version),
          ),
      );
      const changed = await (
        await api(f, "policies", { kind: "quoteValidity" })
      ).json();
      assert.equal(changed.bindings[0].sourceCurrent, false);
      assert.equal(changed.bindings[0].policy.calendarDays, 7);
      assert.equal(changed.bindings[0].sourceHash, binding.sourceHash);
      const stale = await save(
        f,
        { ...review.payload, baseVersion: 1, baseRevisionId: binding.id },
        "pricing.policy-review",
      );
      await assert.rejects(promotion(f, stale), (e) => e.status === 409);
      const ready = await f.api.fetch(
        new Request(
          `${f.owner.origin}/api/shops/${f.a.shop}/settings/policies/readiness`,
          { headers: { Cookie: f.a.cookie } },
        ),
      );
      for (const action of (await ready.json()).actions.filter((a) =>
        ["bindingQuote", "paymentRecording", "billIssue", "refund"].includes(
          a.action,
        ),
      ))
        assert.equal(action.state, "not-yet-implemented");
      assert.deepEqual(
        (
          await (
            await api(f, "policies", { kind: "quoteValidity" }, f.b)
          ).json()
        ).bindings,
        [],
      );
      assert.equal((await counts(f)).journal, "0");
    }),
);
