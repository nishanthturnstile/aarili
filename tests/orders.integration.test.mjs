import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { test } from "vitest";
import { seedServiceTemplates } from "../scripts/test-support/seed-service-templates.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const id = () => {
  const u = randomUUID();
  return `${u.slice(0, 14)}7${u.slice(15)}`;
};
const at = "2026-10-19T00:00:00.000Z";
function request(
  f,
  path,
  {
    method = "POST",
    body,
    who = f.a,
    key = randomUUID(),
    etag,
    api = f.api,
  } = {},
) {
  return api.fetch(
    new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
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
async function customer(f, who = f.a) {
  const c = await ok(
    await request(f, "customers", {
      who,
      body: {
        displayName: "SYNTHETIC Meena மீனா",
        aliases: [],
        serviceEvidence: {
          noticeId: syntheticCustomerPolicy.notice.id,
          language: "en",
          decision: "grant",
          giver: "self",
          noticeExplained: true,
          source: "in-person",
          occurredAt: at,
        },
      },
    }),
  );
  return ok(
    await request(f, `customers/${c.customerId}`, { method: "GET", who }),
  );
}
async function wearer(f, c, overrides = {}) {
  return ok(
    await request(f, `customers/${c.id}/wearers`, {
      body: {
        mode: "self",
        age: "adult",
        preferences: {
          language: "",
          channel: "",
          fit: "",
          style: "",
          delivery: "",
          source: "",
        },
        relationship: {
          kind: "self",
          statementByPersonId: c.personId,
          authorised: true,
          informed: true,
          source: "in-person",
          occurredAt: at,
          interaction: "SYNTHETIC service intake",
        },
        ...overrides,
      },
    }),
  );
}
const save = (f, d, v, options = {}) =>
  request(f, `drafts/${d}`, {
    method: "PUT",
    body: { workflow: "order.quick", schemaVersion: 1, payload: v },
    ...options,
  });
async function fixture(work, extra = {}) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      await work(f);
    },
    { customerPolicy: syntheticCustomerPolicy, ...extra },
  );
}

test("QO-01/03/04/05/06 real PostgreSQL exact-source draft reload/replay/stale edits and source-disable history", async () => {
  await fixture(async (f) => {
    const sources = await seedServiceTemplates(f.runtime.pool, f.a.shop);
    try {
      const c = await customer(f),
        w = await wearer(f, c),
        d = id();
      const v = {
        ...emptyQuickOrder(),
        customerId: c.id,
        wearerId: w.wearerId,
        manifest: {
          entryId: sources.before.entryId,
          revisionId: sources.before.id,
          definitionId: sources.before.definition.id,
        },
        priceState: "quoted",
        priceText: "0",
        instructions: "SYNTHETIC இன்னும் தீர்மானிக்கவில்லை",
      };
      const original = await ok(
        await request(f, "orders/intake-preview", { body: v }),
      );
      assert.equal(original.pricePaise, 0);
      assert.equal(original.sourceState, "current");
      assert.equal(original.effects, "none");
      assert.equal(original.commitment, "unavailable");
      assert(original.requirements.items.some((i) => i.state === "unresolved"));
      assert(
        original.requirements.items
          .filter((i) => i.section === "tasks")
          .every((i) => i.assigneeId === f.a.user),
      );
      for (const [text, paise] of [
        ["0.01", 1],
        ["123.45", 12345],
        ["90,071,992,547,409.91", Number.MAX_SAFE_INTEGER],
      ]) {
        const r = await ok(
          await request(f, "orders/intake-preview", {
            body: { ...v, priceText: text },
          }),
        );
        assert.equal(r.pricePaise, paise);
      }
      for (const text of ["-1", "1.001", "90071992547409.92", "1e3", ""]) {
        const r = await ok(
          await request(f, "orders/intake-preview", {
            body: { ...v, priceText: text },
          }),
        );
        assert(r.issues.includes("priceText"));
      }
      const unknown = await ok(
        await request(f, "orders/intake-preview", {
          body: { ...v, priceState: "to-be-quoted" },
        }),
      );
      assert.equal(unknown.pricePaise, null);
      const key = randomUUID(),
        [a, b] = await Promise.all([
          save(f, d, v, { key }),
          save(f, d, v, { key }),
        ]);
      const first = await ok(a);
      assert.deepEqual(await ok(b), first);
      assert.equal(first.draft.version, 1);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from audit_event where shop_id=$1 and entity_id=$2 and action='draft.save'",
            [f.a.shop, d],
          )
        ).rows[0].n,
        1,
      );
      assert.deepEqual(
        (await ok(await request(f, `drafts/${d}`, { method: "GET" }))).payload,
        v,
      );
      assert.equal(
        (await save(f, d, { ...v, instructions: "different" }, { key })).status,
        422,
      );
      assert.equal(
        (
          await request(f, `drafts/${d}/abandon`, {
            body: {},
            key,
            etag: '"v1"',
          })
        ).status,
        422,
      );
      assert.equal((await save(f, d, v)).status, 428);
      const updated = {
        ...v,
        presentation: "detailed",
        deliveryDate: "2026-10-27",
      };
      await ok(await save(f, d, updated, { etag: '"v1"' }));
      const stale = await save(f, d, v, { etag: '"v1"' });
      assert.equal(stale.status, 412);
      assert.equal(
        (await stale.json()).current.payload.presentation,
        "detailed",
      );
      const preview = await ok(
        await request(f, "orders/intake-preview", { body: updated }),
      );
      assert.deepEqual(preview.requirements, original.requirements);
      await sources.command("service.templates", {
        entryId: sources.before.entryId,
        baseVersion: sources.before.version,
        baseRevisionId: sources.before.id,
        operation: "availability",
        available: false,
        reason: "SYNTHETIC disabled after draft",
        content: sources.before.definition.content,
      });
      const disabled = await ok(
        await request(f, "orders/intake-preview", { body: updated }),
      );
      assert.equal(disabled.sourceState, "unavailable");
      assert.deepEqual(disabled.requirements, original.requirements);
      assert.deepEqual(
        (await ok(await request(f, `drafts/${d}`, { method: "GET" }))).payload,
        updated,
      );
      assert.equal(
        (await request(f, `drafts/${d}/promote`, { body: {}, etag: '"v2"' }))
          .status,
        409,
      );
      const abandonKey = randomUUID();
      const abandoned = await ok(
        await request(f, `drafts/${d}/abandon`, {
          body: {},
          key: abandonKey,
          etag: '"v2"',
        }),
      );
      assert.equal(abandoned.draft.lifecycle, "abandoned");
      assert.deepEqual(
        await ok(
          await request(f, `drafts/${d}/abandon`, {
            body: {},
            key: abandonKey,
            etag: '"v2"',
          }),
        ),
        abandoned,
      );
    } finally {
      await sources.close();
    }
  });
}, 180000);

test("QO-02/09 real PostgreSQL foreign/missing context and revoked wearer deny draft save/read/replay/list", async () => {
  await fixture(async (f) => {
    const c = await customer(f),
      foreign = await customer(f, f.b),
      w = await wearer(f, c),
      d = id();
    const v = { ...emptyQuickOrder(), customerId: c.id, wearerId: w.wearerId },
      key = randomUUID();
    await ok(await save(f, d, v, { key }));
    assert.equal(
      (await save(f, id(), { ...v, customerId: foreign.id })).status,
      404,
    );
    assert.equal(
      (await request(f, `drafts/${d}`, { method: "GET", who: f.b })).status,
      404,
    );
    assert.equal(
      (await request(f, "orders/intake-preview", { body: v, who: f.b })).status,
      404,
    );
    const without = await draftRepository(f.runtime.db, f.a.shop).read(d);
    assert.equal(without, undefined);
    const profile = await ok(
      await request(f, `customers/${c.id}/wearers/${w.wearerId}`, {
        method: "GET",
      }),
    );
    await ok(
      await request(f, `customers/${c.id}/wearers/${w.wearerId}`, {
        method: "PATCH",
        etag: `"v${profile.version}"`,
        body: {
          age: profile.age,
          preferences: profile.preferences,
          relationship: {
            ...profile.relationship,
            id: undefined,
            customerId: undefined,
            authorised: false,
          },
        },
      }),
    );
    assert.equal(
      (await request(f, `drafts/${d}`, { method: "GET" })).status,
      404,
    );
    assert.equal((await save(f, d, v, { key })).status, 404);
    const list = await ok(await request(f, "drafts", { method: "GET" }));
    assert(!list.drafts.some((row) => row.id === d));
    assert.equal(
      (await request(f, "orders/intake-preview", { body: v })).status,
      404,
    );
    // Every command response carries a draft; revoked access must not expose it.
    for (const etag of ['"v1"', '"v99"'])
      assert.equal(
        (await request(f, `drafts/${d}/abandon`, { body: {}, etag })).status,
        404,
      );
  });
}, 120000);

test("QO-04/05/09 failed draft instrumentation rolls back actual draft/audit/key writes and retry succeeds once", async () => {
  await fixture(async (f) => {
    const d = id(),
      key = randomUUID(),
      v = emptyQuickOrder();
    const broken = createApi(async () => true, {
      ...f.owner,
      commandLimit: async () => 0,
      withOwnerDraft: (headers, shop, run) =>
        f.owner.withOwnerDraft(headers, shop, (ctx) =>
          run({
            ...ctx,
            instrumentation: {
              recordDraftEvent: async () => {
                throw Error("SYNTHETIC after audit failure");
              },
            },
          }),
        ),
    });
    assert.equal((await save(f, d, v, { key, api: broken })).status, 503);
    assert.equal(
      (await request(f, `drafts/${d}`, { method: "GET" })).status,
      404,
    );
    const counts = await f.admin.query(
      "select (select count(*)::int from durable_draft where shop_id=$1 and id=$2) as drafts,(select count(*)::int from idempotency_key where shop_id=$1 and key=$3) as keys,(select count(*)::int from audit_event where shop_id=$1 and entity_id=$2) as audits",
      [f.a.shop, d, key],
    );
    assert.deepEqual(counts.rows[0], { drafts: 0, keys: 0, audits: 0 });
    const saved = await ok(await save(f, d, v, { key }));
    assert.equal(saved.draft.version, 1);
    assert.deepEqual(await ok(await save(f, d, v, { key })), saved);
    const restored = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
      draftRepository(tx, f.a.shop).read(d),
    );
    assert.equal(restored.version, 1);
    assert.equal(
      await draftRepository(f.runtime.db, f.a.shop).read(d),
      undefined,
    );
  });
}, 120000);

test("QO-02/03 minor guardian verification withdrawal returns to unresolved without losing an incomplete draft or authorising measurements", async () => {
  await fixture(async (f) => {
    const c = await customer(f);
    const w = await wearer(f, c, {
      mode: "new",
      displayName: "SYNTHETIC child",
      age: "minor",
      relationship: {
        kind: "family",
        statementByPersonId: c.personId,
        authorised: true,
        informed: true,
        source: "in-person",
        occurredAt: at,
        interaction: "SYNTHETIC family intake",
      },
    });
    const d = id(),
      v = { ...emptyQuickOrder(), customerId: c.id, wearerId: w.wearerId };
    const preview = () =>
      request(f, "orders/intake-preview", { body: v }).then(ok);
    await ok(await save(f, d, v));
    assert((await preview()).issues.includes("guardian"));
    const path = `customers/${c.id}/wearers/${w.wearerId}/guardians`;
    await ok(
      await request(f, path, {
        etag: `"v${w.version}"`,
        body: {
          guardian: { mode: "new", displayName: "SYNTHETIC parent" },
          authority: "parent",
          scope: "measurement",
          source: "in-person",
          occurredAt: at,
        },
      }),
    );
    let g = await ok(await request(f, path, { method: "GET" }));
    const verification = {
      authorityId: g.authority.id,
      status: "confirmed",
      method: "synthetic-review-v1",
      evidenceRef: "SYNTHETIC fixture only",
      scope: "measurement",
      source: "in-person",
      occurredAt: at,
    };
    await ok(
      await request(f, `${path}/verification-events`, {
        etag: `"v${g.version}"`,
        body: verification,
      }),
    );
    assert(!(await preview()).issues.includes("guardian"));
    g = await ok(await request(f, path, { method: "GET" }));
    await ok(
      await request(f, `${path}/verification-events`, {
        etag: `"v${g.version}"`,
        body: { ...verification, status: "withdrawn" },
      }),
    );
    assert((await preview()).issues.includes("guardian"));
    const saved = await ok(await save(f, d, v, { etag: '"v1"' }));
    assert.equal(saved.draft.lifecycle, "active");
    assert.equal(
      (await request(f, `drafts/${d}/promote`, { etag: '"v2"', body: {} }))
        .status,
      422,
    );
    const adult = await wearer(f, c);
    const purposePath = `customers/${c.id}/wearers/${adult.wearerId}/consent-events`;
    const purpose = {
      purpose: "service",
      decision: "grant",
      noticeId: syntheticCustomerPolicy.notice.id,
      noticeExplained: true,
      language: "en",
      giverPersonId: c.personId,
      source: "in-person",
      occurredAt: at,
    };
    // Wearer and customer notices are separate; use the wearer fixture notice.
    purpose.noticeId = syntheticWearerPolicy.notice.id;
    const granted = await ok(
      await request(f, purposePath, {
        etag: `"v${adult.version}"`,
        body: purpose,
      }),
    );
    const adultDraft = { ...v, wearerId: adult.wearerId },
      adultId = id(),
      key = randomUUID();
    await ok(await save(f, adultId, adultDraft, { key }));
    await ok(
      await request(f, purposePath, {
        etag: `"v${granted.version}"`,
        body: { ...purpose, decision: "withdrawal" },
      }),
    );
    assert.equal((await save(f, adultId, adultDraft, { key })).status, 404);
    assert.equal(
      (await request(f, "orders/intake-preview", { body: adultDraft })).status,
      404,
    );
  });
}, 120000);
