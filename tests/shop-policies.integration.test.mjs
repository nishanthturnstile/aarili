import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyPolicy } from "@aarili/contracts/shop-policies";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { shopPoliciesDraftWorkflow } from "@aarili/core/shop-policies";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { shopPoliciesRepository } from "@aarili/db/shop-policies-repository";
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
function payload(kind = "advance", baseVersion = 0, baseRevisionId = null) {
  const p = emptyPolicy(kind);
  return {
    baseVersion,
    baseRevisionId,
    policy: {
      ...p,
      state: "reviewed",
      terms: { en: "Synthetic review only", ta: "சோதனை மட்டும்" },
      authority: { kind: "synthetic-fixture", label: "Issue 87 fixture" },
      ...(kind === "advance"
        ? { percentageBps: 0 }
        : { calendarDays: 0, approval: "owner" }),
    },
  };
}
async function saved(f, value = payload()) {
  const draftId = id();
  const result = await ok(
    await request(f, `drafts/${draftId}`, {
      method: "PUT",
      body: { workflow: "shop.policies", schemaVersion: 1, payload: value },
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
      "select (select count(*)::int from shop_policies_revision) revisions,(select count(*)::int from audit_event where action='shop-policies.publish') audits,(select count(*)::int from idempotency_key where action='draft.promote') keys",
    )
  ).rows[0];

test("SET-05/08 SS-04/07 AC-44 draft resume, fixture-only authority, replay, CAS and exact history", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      assert(
        (await assertIsolationCatalog(f.runtime.db)).includes(
          "public.shop_policies_revision",
        ),
      );
      assert.deepEqual(await ok(await request(f, "settings/policies")), {
        version: 0,
        revision: null,
      });
      const initial = await ok(await request(f, "settings/policies/readiness"));
      assert.equal(
        initial.actions.find((a) => a.action === "profileSave").state,
        "available",
      );
      assert(
        initial.actions
          .find((a) => a.action === "paymentRecording")
          .reasons.some((r) => r.code === "receivingMethodsMissing"),
      );
      await ok(
        await request(f, "customers", {
          method: "POST",
          body: {
            displayName: "Synthetic retained policy customer",
            serviceEvidence: {
              noticeId: syntheticCustomerPolicy.notice.id,
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
      const consentBefore = (
        await f.admin.query("select * from consent_record order by shop_id,id")
      ).rows;
      const customerBefore = (
        await f.admin.query("select * from customer order by shop_id,id")
      ).rows;
      const first = await saved(f),
        concurrent = await saved(f, payload("refund")),
        key = randomUUID();
      assert.deepEqual(
        (await ok(await request(f, `drafts/${first.draftId}`))).payload,
        payload(),
      );
      const draftReadiness = await ok(
        await request(f, "settings/policies/readiness"),
      );
      assert(
        draftReadiness.actions
          .find((a) => a.action === "bindingQuote")
          .reasons.some(
            (r) => r.code === "policyDraft" && r.policy === "advance",
          ),
      );
      const replies = await Promise.all([
        promote(f, first, key).then(ok),
        promote(f, first, key.toUpperCase()).then(ok),
      ]);
      assert.deepEqual(replies[0], replies[1]);
      assert.equal(replies[0].draft.lifecycle, "promoted");
      assert.deepEqual(await totals(f), { revisions: 1, audits: 1, keys: 1 });
      const old = await ok(await request(f, "settings/policies"));
      assert.equal(old.revision.authorityScope, "synthetic-only");
      assert.equal(old.revision.policies[0].percentageBps, 0);
      await rejected(await promote(f, concurrent), 412);
      assert.equal(
        (await ok(await request(f, `drafts/${concurrent.draftId}`))).lifecycle,
        "active",
      );
      await rejected(await promote(f, first, key, '"v2"'), 422);
      const next = await saved(f, payload("refund", 1, old.revision.id));
      await rejected(
        await request(f, `drafts/${next.draftId}/promote`, {
          method: "POST",
          body: {},
        }),
        428,
      );
      await rejected(await promote(f, next, randomUUID(), "bad"), 422);
      await ok(
        await request(f, `drafts/${next.draftId}`, {
          method: "PUT",
          body: {
            workflow: "shop.policies",
            schemaVersion: 1,
            payload: payload("refund", 1, old.revision.id),
          },
          etag: '"v1"',
        }),
      );
      await rejected(await promote(f, next), 412);
      next.record.version = 2;
      await ok(await promote(f, next));
      const current = await ok(await request(f, "settings/policies"));
      assert.equal(current.version, 2);
      assert.deepEqual(
        current.revision.policies.find((p) => p.kind === "advance"),
        old.revision.policies[0],
      );
      assert.deepEqual(
        await ok(
          await request(f, `settings/policies/revisions/${old.revision.id}`),
        ),
        old.revision,
      );
      assert.equal(
        (
          await ok(
            await request(f, "settings/policies/history", {
              method: "POST",
              body: {},
            }),
          )
        ).revisions.length,
        2,
      );
      const ready = await ok(await request(f, "settings/policies/readiness"));
      assert.equal(
        ready.actions.find((a) => a.action === "refund").state,
        "not-yet-implemented",
      );
      assert(
        ready.actions
          .find((a) => a.action === "refund")
          .reasons.some((r) => r.code === "syntheticOnly"),
      );
      const audit = (
        await f.admin.query(
          "select changes from audit_event where action='shop-policies.publish'",
        )
      ).rows;
      for (const row of audit)
        assert.deepEqual(Object.keys(row.changes).sort(), ["kind", "version"]);
      for (const policy of [
        { ...payload().policy, percentageBps: null },
        { ...payload().policy, percentageBps: -1 },
        {
          ...payload().policy,
          authority: { kind: "owner-proposal", label: "Owner" },
        },
        { ...payload().policy, state: "draft" },
        { ...payload().policy, terms: { en: "English", ta: "" } },
      ]) {
        const incomplete = await saved(f, {
          ...payload(),
          baseVersion: 2,
          baseRevisionId: current.revision.id,
          policy,
        });
        await rejected(await promote(f, incomplete), 422);
      }
      const na = await saved(f, {
        ...payload("refund", 2, current.revision.id),
        policy: {
          ...payload("refund").policy,
          state: "not-applicable",
          reason: "Synthetic scope only",
        },
      });
      await ok(await promote(f, na));
      assert(
        (await ok(await request(f, "settings/policies/readiness"))).actions
          .find((a) => a.action === "refund")
          .reasons.some((r) => r.code === "policyNotApplicable"),
      );
      assert.deepEqual(
        (
          await f.admin.query(
            "select * from consent_record order by shop_id,id",
          )
        ).rows,
        consentBefore,
      );
      assert.deepEqual(
        (await f.admin.query("select * from customer order by shop_id,id"))
          .rows,
        customerBefore,
      );
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
});

test("SS-09 tenant policies access, immutable provenance and concurrent initial publication", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const a = await saved(f),
      b = await saved(f, payload("refund"));
    const outcomes = await Promise.all([promote(f, a), promote(f, b)]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 412]);
    const current = await ok(await request(f, "settings/policies"));
    await rejected(
      await request(f, "settings/policies", { who: f.b, shop: f.a.shop }),
      403,
    );
    await rejected(
      await request(f, `settings/policies/revisions/${current.revision.id}`, {
        who: f.b,
      }),
      404,
    );
    await rejected(await request(f, `drafts/${a.draftId}`, { who: f.b }), 404);
    await rejected(await request(f, "settings/policies", { cookie: "" }), 401);
    await rejected(
      await request(f, "settings/policies/history", {
        method: "POST",
        body: {},
        origin: "https://invalid.test",
      }),
      403,
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select id from shop_policies_revision`))
        .rowCount,
      0,
    );
    await assert.rejects(
      f.runtime.db.execute(
        sql`insert into shop_policies(shop_id,current_revision_id,version) values(${f.a.shop}::uuid,${current.revision.id}::uuid,1)`,
      ),
      (e) => e.cause?.code === "42501",
    );
    await assert.rejects(
      f.admin.query("delete from shop_policies_revision"),
      /Policies history protected/,
    );
    const foreignId = id();
    await ok(
      await request(f, `drafts/${foreignId}`, {
        who: f.b,
        method: "PUT",
        body: {
          workflow: "shop.policies",
          schemaVersion: 1,
          payload: payload(),
        },
      }),
    );
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        shopPoliciesRepository(tx, f.a.shop).append({
          policies: current.revision.policies,
          version: 2,
          previousId: current.revision.id,
          actorId: f.a.user,
          originDraftId: foreignId,
          key: randomUUID(),
          requestId: randomUUID(),
          kind: "advance",
        }),
      ),
      /./,
    );
    const refs = (
      await f.admin.query(
        "select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='shop_policies_revision'::regclass and contype='f'",
      )
    ).rows
      .map((r) => r.definition)
      .join("\n");
    for (const reference of [
      "(shop_id, previous_id)",
      "(shop_id, actor_id)",
      "(shop_id, audit_id)",
      "(shop_id, origin_draft_id)",
    ])
      assert(refs.includes(reference));
    await assert.rejects(
      f.admin.query("update shop_policies_revision set policies=policies"),
      /Policies history protected/,
    );
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(sql`update shop_policies set version=version`),
      ),
      (e) => e.cause?.code === "42501",
    );
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into shop_policies_revision(shop_id,id,version,actor_id,audit_id,origin_draft_id,schema_version,policies) values(${f.a.shop}::uuid,uuidv7(),3,${f.b.user}::uuid,uuidv7(),${b.draftId}::uuid,1,'[]'::jsonb)`,
        ),
      ),
    );
    assert.deepEqual(await totals(f), { revisions: 1, audits: 1, keys: 1 });
  });
});

test("SS-07/09 policies revision, pointer, draft, audit and replay roll back together at each write boundary", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const d = await saved(f);
    for (const stage of ["append", "advance", "update", "audit", "persist"]) {
      const key = randomUUID();
      await assert.rejects(
        withShop(f.parallel.db, f.a.user, f.a.shop, async (tx) => {
          const business = shopPoliciesRepository(tx, f.a.shop),
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
                  "shop.policies",
                  shopPoliciesDraftWorkflow({
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
