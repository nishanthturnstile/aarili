import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { mutateWearer, wearerDraftWorkflow } from "@aarili/core/wearers";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { wearerRepository } from "@aarili/db/wearer-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const origin = "http://127.0.0.1:3103",
  at = "2026-10-17T00:00:00.000Z";
const emptyPrefs = {
  language: "",
  channel: "",
  fit: "",
  style: "",
  delivery: "",
  source: "",
};
function request(f, path, method = "GET", body, headers = {}, who = f.a) {
  return f.api.fetch(
    new Request(`${origin}/api/shops/${who.shop}${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function okay(r) {
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  return r.json();
}
async function rejected(r, status, code) {
  assert.equal(r.status, status, JSON.stringify(await r.clone().json()));
  assert.equal((await r.json()).error.code, code);
}
async function fixture(work) {
  await withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      await work(f);
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
}
async function customer(f, displayName = "Synthetic payer") {
  const result = await okay(
    await request(
      f,
      "/customers",
      "POST",
      {
        displayName,
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
      { "Idempotency-Key": randomUUID() },
    ),
  );
  return okay(await request(f, `/customers/${result.customerId}`));
}
const relationship = (c, kind = "family", overrides = {}) => ({
  kind,
  statementByPersonId: c.personId,
  authorised: true,
  informed: true,
  source: "in-person",
  occurredAt: at,
  interaction: "Synthetic family intake",
  ...overrides,
});
const registration = (c, overrides = {}) => ({
  mode: "new",
  displayName: "கண்ணு Synthetic wearer",
  age: "adult",
  preferences: {
    ...emptyPrefs,
    language: "தமிழில் பேசவும்",
    fit: "Original fit statement",
    source: "Wearer expressed in person",
  },
  relationship: relationship(c),
  ...overrides,
});
const prefix = (c) => `/customers/${c.id}/wearers`;
async function create(f, c, input, key = randomUUID()) {
  return okay(
    await request(f, prefix(c), "POST", input, { "Idempotency-Key": key }),
  );
}
async function read(f, c, id) {
  return okay(await request(f, `${prefix(c)}/${id}`));
}
async function update(f, c, p, changes = {}, key = randomUUID()) {
  const body = {
    reason: "SYNTHETIC wearer correction",
    age: p.age,
    preferences: p.preferences,
    relationship: {
      kind: p.relationship.kind,
      statementByPersonId: p.relationship.statementByPersonId,
      authorised: p.relationship.authorised,
      informed: p.relationship.informed,
      authorisationDeclined: p.relationship.authorisationDeclined,
      informedDeclined: p.relationship.informedDeclined,
      source: p.relationship.source,
      occurredAt: p.relationship.occurredAt,
      interaction: p.relationship.interaction,
    },
    ...changes,
  };
  return okay(
    await request(f, `${prefix(c)}/${p.id}`, "PATCH", body, {
      "Idempotency-Key": key,
      "If-Match": `"v${p.version}"`,
    }),
  );
}
const evidence = (p, overrides = {}) => ({
  purpose: "service",
  decision: "grant",
  noticeId: syntheticWearerPolicy.notice.id,
  noticeExplained: true,
  language: "ta",
  giverPersonId: p.personId,
  source: "in-person",
  occurredAt: at,
  ...overrides,
});
async function purpose(f, c, p, overrides = {}, key = randomUUID()) {
  return okay(
    await request(
      f,
      `${prefix(c)}/${p.id}/consent-events`,
      "POST",
      evidence(p, overrides),
      { "Idempotency-Key": key, "If-Match": `"v${p.version}"` },
    ),
  );
}
function run(f, work, who = f.a) {
  return withShop(f.parallel.db, who.user, who.shop, (tx) =>
    work(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: wearerRepository(
          tx,
          who.shop,
          syntheticWearerPolicy.notice.id,
        ),
        policy: syntheticWearerPolicy,
      },
      tx,
    ),
  );
}
const counts = async (f) =>
  (
    await f.admin.query(
      `select (select count(*)::int from wearer) as wearers,(select count(*)::int from customer_person) as people,(select count(*)::int from customer_wearer_relationship) as links,(select count(*)::int from wearer_relationship_event) as relationships,(select count(*)::int from wearer_purpose_event) as purposes,(select count(*)::int from wearer_preference_event) as preferences,(select count(*)::int from wearer_age_event) as ages,(select count(*)::int from privacy_notice_version) as notices,(select count(*)::int from audit_event where action like 'wearer.%') as audits,(select count(*)::int from idempotency_key where action like 'wearer.%') as keys`,
    )
  ).rows[0];
test(
  "CW-03/04/05/08/11/13 adult/self/existing identities, independent preferences, purpose refusal/withdrawal, concurrency and eligibility review",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        other = await customer(f, "Synthetic other payer");
      const self = await create(f, c, {
        mode: "self",
        age: "adult",
        preferences: emptyPrefs,
        relationship: relationship(c, "self"),
      });
      const key = randomUUID(),
        body = registration(c, { displayName: c.displayName }),
        newer = await create(f, c, body, key);
      assert.notEqual(newer.personId, self.personId);
      assert.equal(self.personId, c.personId);
      assert.deepEqual(await create(f, c, body, key), newer);
      await rejected(
        await request(
          f,
          prefix(c),
          "POST",
          { ...body, age: "minor" },
          { "Idempotency-Key": key },
        ),
        422,
        "IDEMPOTENCY_MISMATCH",
      );
      let p = await read(f, c, newer.wearerId);
      assert.equal(p.preferences.fit, "Original fit statement");
      assert.equal(p.purposes.length, 0);
      assert.equal((await read(f, c, self.wearerId)).preferences.fit, "");
      const search = await okay(
        await request(f, "/wearers/search", "POST", {
          query: "Synthetic",
          limit: 2,
        }),
      );
      assert(search.wearers.some((x) => x.id === p.id));
      assert(
        search.wearers.every(
          (x) =>
            !("preferences" in x) && !("relationship" in x) && !("notes" in x),
        ),
      );
      const linked = await create(f, other, {
        mode: "existing",
        wearerId: p.id,
        expectedVersion: p.version,
        relationship: relationship(other),
      });
      assert.equal(linked.personId, p.personId);
      p = await read(f, c, p.id);
      assert.equal(p.version, linked.version);
      await rejected(
        await request(
          f,
          `${prefix(c)}/${p.id}/consent-events`,
          "POST",
          evidence(p, { giverPersonId: c.personId }),
          { "Idempotency-Key": randomUUID(), "If-Match": `"v${p.version}"` },
        ),
        409,
        "PURPOSE_AUTHORITY_INVALID",
      );
      await purpose(f, c, p);
      p = await read(f, c, p.id);
      assert(p.purposes.find((e) => e.purpose === "service").eligible);
      assert.equal(
        p.purposes.find((e) => e.purpose === "service").recordedBy,
        f.a.user,
      );
      await purpose(f, c, p, { purpose: "marketing", decision: "refusal" });
      p = await read(f, c, p.id);
      assert.equal(
        p.purposes.find((e) => e.purpose === "marketing").decision,
        "refusal",
      );
      assert(p.purposes.find((e) => e.purpose === "service").eligible);
      await purpose(f, c, p, { purpose: "service", decision: "withdrawal" });
      p = await read(f, c, p.id);
      assert(!p.purposes.find((e) => e.purpose === "service").eligible);
      assert(p.purposes.find((e) => e.purpose === "service").previousId);
      await purpose(f, c, p);
      p = await read(f, c, p.id);
      await update(f, c, p, { age: "unknown" });
      p = await read(f, c, p.id);
      assert(!p.purposes.find((e) => e.purpose === "service").eligible);
      await rejected(
        await request(
          f,
          `${prefix(c)}/${p.id}/consent-events`,
          "POST",
          evidence(p),
          { "Idempotency-Key": randomUUID(), "If-Match": `"v${p.version}"` },
        ),
        409,
        "ADULT_AUTHORITY_REQUIRED",
      );
      await update(f, c, p, { age: "adult" });
      p = await read(f, c, p.id);
      assert(!p.purposes.find((e) => e.purpose === "service").eligible);
      await purpose(f, c, p);
      p = await read(f, c, p.id);
      await update(f, c, p, {
        relationship: relationship(c, "family", { authorised: false }),
      });
      p = await read(f, c, p.id);
      assert(!p.purposes.find((e) => e.purpose === "service").eligible);
      await update(f, c, p, { relationship: relationship(c) });
      p = await read(f, c, p.id);
      assert(!p.purposes.find((e) => e.purpose === "service").eligible);
      await purpose(f, c, p);
      p = await read(f, c, p.id);
      await update(f, c, p, {
        relationship: relationship(c, "family", {
          interaction: "Synthetic different service interaction",
        }),
      });
      p = await read(f, c, p.id);
      assert(!p.purposes.find((e) => e.purpose === "service").eligible);
      await update(f, c, p, {
        preferences: {
          ...p.preferences,
          style: "Another original style statement",
        },
      });
      p = await read(f, c, p.id);
      assert(
        !p.purposes.find((e) => e.purpose === "service").eligible,
        "preference correction must not restore an earlier interaction grant",
      );
      await purpose(f, c, p);
      p = await read(f, c, p.id);
      assert(p.purposes.find((e) => e.purpose === "service").eligible);
      const races = await Promise.all(
        ["grant", "withdrawal"].map((decision) =>
          request(
            f,
            `${prefix(c)}/${p.id}/consent-events`,
            "POST",
            evidence(p, { decision }),
            { "Idempotency-Key": randomUUID(), "If-Match": `"v${p.version}"` },
          ),
        ),
      );
      assert.deepEqual(races.map((r) => r.status).sort(), [200, 412]);
      await update(f, c, await read(f, c, p.id), {
        relationship: relationship(c, "family", {
          authorised: false,
          authorisationDeclined: true,
          informed: false,
          informedDeclined: true,
        }),
      });
      const declined = await read(f, c, p.id);
      assert(declined.relationship.authorisationDeclined);
      assert(declined.relationship.informedDeclined);
      assert.equal(declined.relationship.authorised, false);
      assert(!declined.purposes.find((e) => e.purpose === "service").eligible);
      const minor = await create(
          f,
          c,
          registration(c, {
            age: "minor",
            displayName: "Synthetic minor pending",
          }),
        ),
        mp = await read(f, c, minor.wearerId);
      await rejected(
        await request(
          f,
          `${prefix(c)}/${mp.id}/consent-events`,
          "POST",
          evidence(mp, { purpose: "publication" }),
          { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
        ),
        409,
        "ADULT_AUTHORITY_REQUIRED",
      );
      const age = (
        await f.admin.query(
          "select age,source,occurred_at,recorded_by from wearer_age_event where wearer_id=$1 order by wearer_version",
          [mp.id],
        )
      ).rows[0];
      assert.equal(age.age, "minor");
      assert.equal(age.recorded_by, f.a.user);
      assert.equal(age.source, "in-person");
      const latest = await read(f, c, p.id);
      const editBody = {
        reason: "SYNTHETIC wearer correction",
        age: latest.age,
        preferences: { ...latest.preferences, style: "Original new style" },
        relationship: relationship(c),
      };
      const updates = await Promise.all(
        [1, 2].map(() =>
          request(f, `${prefix(c)}/${latest.id}`, "PATCH", editBody, {
            "Idempotency-Key": randomUUID(),
            "If-Match": `"v${latest.version}"`,
          }),
        ),
      );
      assert.deepEqual(updates.map((r) => r.status).sort(), [200, 412]);
      const raw = (
        await f.admin.query(
          "select changes from audit_event where action like 'wearer.%' union all select response from idempotency_key where action like 'wearer.%'",
        )
      ).rows;
      assert(!JSON.stringify(raw).includes("Original fit statement"));
      assert(!JSON.stringify(raw).includes("Synthetic payer"));
    }),
);
test(
  "CW-06/07/10/13 real forced policies, same-shop composite links, binding mismatch and audit rollback",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        created = await create(f, c, registration(c)),
        p = await read(f, c, created.wearerId);
      await rejected(
        await request(f, `${prefix(c)}/${p.id}`, "GET", undefined, {}, f.b),
        404,
        "NOT_FOUND",
      );
      assert.equal(
        (
          await okay(
            await request(f, "/wearers/search", "POST", { query: "" }, {}, f.b),
          )
        ).wearers.length,
        0,
      );
      await rejected(
        await request(
          f,
          prefix(c),
          "POST",
          registration(c),
          { "Idempotency-Key": randomUUID() },
          f.b,
        ),
        404,
        "NOT_FOUND",
      );
      const foreign = await request(
        f,
        `${prefix(c)}/${p.id}/consent-events`,
        "POST",
        evidence(p, { noticeId: randomUUID() }),
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
      );
      await rejected(foreign, 409, "PURPOSE_AUTHORITY_INVALID");
      const before = await counts(f);
      await assert.rejects(
        run(f, (ctx) =>
          mutateWearer(
            {
              ...ctx,
              repository: {
                ...ctx.repository,
                audit: async () => {
                  throw Error("Injected audit failure");
                },
              },
            },
            c.id,
            "create",
            undefined,
            registration(c),
            { key: randomUUID(), requestId: randomUUID() },
          ),
        ),
      );
      assert.deepEqual(await counts(f), before);
      const key = randomUUID();
      await create(f, c, registration(c), key);
      await assert.rejects(
        run(f, (ctx) =>
          mutateWearer(
            { ...ctx, actor: { type: "user", id: f.b.user } },
            c.id,
            "create",
            undefined,
            registration(c),
            { key, requestId: randomUUID() },
          ),
        ),
        { status: 422, message: "IDEMPOTENCY_MISMATCH" },
      );
      await assert.rejects(
        run(f, (ctx) =>
          mutateWearer(ctx, c.id, "purpose", p.id, evidence(p), {
            key,
            ifMatch: '"v1"',
            requestId: randomUUID(),
          }),
        ),
        { status: 422, message: "IDEMPOTENCY_MISMATCH" },
      );
      await assert.rejects(
        run(
          f,
          (_ctx, tx) =>
            tx.execute(
              sql`insert into wearer_preferences(shop_id,wearer_id) values(${f.b.shop}::uuid,${p.id}::uuid)`,
            ),
          f.b,
        ),
        (e) => (e.cause?.code ?? e.code) === "23503",
      );
      for (const table of [
        "wearer_relationship_event",
        "wearer_preference_event",
        "wearer_age_event",
        "wearer_purpose_event",
      ])
        await assert.rejects(
          run(f, (_ctx, tx) => tx.execute(sql.raw(`delete from ${table}`))),
          (e) => (e.cause?.code ?? e.code) === "42501",
        );
      assert.equal(
        (await f.parallel.db.execute(sql`select * from wearer`)).rowCount,
        0,
      );
      const state = await f.parallel.db.execute(
        sql`select current_setting('app.shop_id',true) as s,current_setting('app.actor_id',true) as a`,
      );
      assert(Object.values(state.rows[0]).every((v) => !v));
      await assertIsolationCatalog(f.runtime.db);
    }),
);
function draftRequest(f, id, action, body, key, version) {
  return request(
    f,
    `/drafts/${id}${action === "save" ? "" : `/${action}`}`,
    action === "save" ? "PUT" : "POST",
    body,
    {
      "Idempotency-Key": key,
      ...(version ? { "If-Match": `"v${version}"` } : {}),
    },
  );
}
test(
  "CW-12/13 connected wearer drafts stay nonauthoritative until current-state promotion and retain exact origin/retry/rollback",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f);
      const draftId = await f.admin
          .query("select uuidv7() as id")
          .then((r) => r.rows[0].id),
        initial = await counts(f);
      const payload = {
        synthetic: true,
        noticeId: syntheticWearerPolicy.notice.id,
        customerId: c.id,
        customerVersion: c.version,
        registration: { relationship: { interaction: "" } },
      };
      const saved = await okay(
        await draftRequest(
          f,
          draftId,
          "save",
          { workflow: "customer.wearer", schemaVersion: 1, payload },
          randomUUID(),
        ),
      );
      assert.equal(saved.draft.lifecycle, "active");
      assert.equal(
        saved.draft.payload.registration.relationship.interaction,
        "",
      );
      assert.deepEqual(await counts(f), initial);
      await rejected(
        await draftRequest(f, draftId, "promote", {}, randomUUID(), 1),
        422,
        "VALIDATION_FAILED",
      );
      payload.registration = registration(c);
      const full = await okay(
        await draftRequest(
          f,
          draftId,
          "save",
          { workflow: "customer.wearer", schemaVersion: 1, payload },
          randomUUID(),
          1,
        ),
      );
      assert.equal(full.draft.version, 2);
      const key = randomUUID(),
        promotion = await okay(
          await draftRequest(f, draftId, "promote", {}, key, 2),
        );
      assert.equal(promotion.draft.result.type, "customer.wearer.relationship");
      assert.equal(promotion.draft.lifecycle, "promoted");
      assert.deepEqual(
        await okay(await draftRequest(f, draftId, "promote", {}, key, 2)),
        promotion,
      );
      const linked = (await okay(await request(f, prefix(c)))).wearers.find(
        (p) => p.relationship.id === promotion.draft.result.id,
      );
      assert(linked);
      assert.equal(linked.originDraftId, draftId);
      const origin = (
        await f.admin.query(
          "select origin_draft_id from customer_wearer_relationship where id=$1",
          [linked.relationship.id],
        )
      ).rows[0];
      assert.equal(origin.origin_draft_id, draftId);
      const staleId = (await f.admin.query("select uuidv7() as id")).rows[0].id;
      const oldNotice = { ...payload, noticeId: randomUUID() };
      await okay(
        await draftRequest(
          f,
          staleId,
          "save",
          { workflow: "customer.wearer", schemaVersion: 1, payload: oldNotice },
          randomUUID(),
        ),
      );
      await rejected(
        await draftRequest(f, staleId, "promote", {}, randomUUID(), 1),
        409,
        "REQUEST_CONFLICT",
      );
      const staleCustomer = (await f.admin.query("select uuidv7() as id"))
        .rows[0].id;
      await okay(
        await draftRequest(
          f,
          staleCustomer,
          "save",
          {
            workflow: "customer.wearer",
            schemaVersion: 1,
            payload: { ...payload, customerVersion: c.version },
          },
          randomUUID(),
        ),
      );
      const correction = await okay(
        await request(
          f,
          `/customers/${c.id}`,
          "PATCH",
          {
            displayName: "Synthetic payer corrected",
            aliases: [],
            reason: "SYNTHETIC payer correction",
          },
          { "Idempotency-Key": randomUUID(), "If-Match": `"v${c.version}"` },
        ),
      );
      await rejected(
        await draftRequest(f, staleCustomer, "promote", {}, randomUUID(), 1),
        409,
        "REQUEST_CONFLICT",
      );
      c.version = correction.version;
      payload.customerVersion = correction.version;
      const crossId = (await f.admin.query("select uuidv7() as id")).rows[0].id;
      await okay(
        await draftRequest(
          f,
          crossId,
          "save",
          {
            workflow: "customer.wearer",
            schemaVersion: 1,
            payload: { ...payload, customerId: randomUUID() },
          },
          randomUUID(),
        ),
      );
      await rejected(
        await draftRequest(f, crossId, "promote", {}, randomUUID(), 1),
        404,
        "NOT_FOUND",
      );
      const failId = (await f.admin.query("select uuidv7() as id")).rows[0].id;
      await okay(
        await draftRequest(
          f,
          failId,
          "save",
          { workflow: "customer.wearer", schemaVersion: 1, payload },
          randomUUID(),
        ),
      );
      const before = await counts(f);
      await assert.rejects(
        run(f, (ctx, tx) => {
          const adapter = wearerDraftWorkflow({
            ...ctx,
            repository: {
              ...ctx.repository,
              audit: async () => {
                throw Error("Injected promotion audit failure");
              },
            },
          });
          return mutateDraft(
            {
              shopId: f.a.shop,
              actor: { type: "user", id: f.a.user },
              repository: draftRepository(tx, f.a.shop),
              workflows: new Map([["customer.wearer", adapter]]),
            },
            failId,
            "promote",
            {},
            { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
          );
        }),
        { message: "Injected promotion audit failure" },
      );
      assert.deepEqual(await counts(f), before);
      assert.equal(
        (await okay(await request(f, `/drafts/${failId}`))).lifecycle,
        "active",
      );
    }),
);

test(
  "CW-08 production owner composition has no wearer policy activation path",
  { timeout: 180000 },
  async () =>
    withTenantFixture(async (f) => {
      const policy = await okay(await request(f, "/wearers/policy"));
      assert.equal(policy.enabled, false);
      await rejected(
        await request(
          f,
          `/customers/${randomUUID()}/wearers`,
          "POST",
          {
            mode: "new",
            displayName: "Synthetic blocked",
            age: "adult",
            preferences: emptyPrefs,
            relationship: {
              kind: "family",
              statementByPersonId: randomUUID(),
              authorised: false,
              informed: false,
              source: "phone",
              occurredAt: at,
              interaction: "Synthetic blocked",
            },
          },
          { "Idempotency-Key": randomUUID() },
        ),
        409,
        "WEARER_POLICY_PENDING",
      );
      assert.equal((await counts(f)).wearers, 0);
    }),
);

test(
  "CW-05/13 profile reads pin aggregate state while concurrent authority changes wait",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        created = await create(f, c, registration(c));
      let p = await read(f, c, created.wearerId);
      await purpose(f, c, p);
      p = await read(f, c, p.id);
      let ready, release;
      const available = new Promise((resolve) => {
          ready = resolve;
        }),
        gate = new Promise((resolve) => {
          release = resolve;
        });
      const reader = run(f, async (ctx) => {
        const snapshot = await ctx.repository.read(c.id, p.id);
        assert(snapshot.purposes.find((e) => e.purpose === "service").eligible);
        ready();
        await gate;
        return snapshot;
      });
      await available;
      const writer = update(f, c, p, { age: "unknown" });
      let waiting = false;
      try {
        for (let i = 0; i < 100; i++) {
          waiting = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where datname=current_database() and usename='app_user' and wait_event_type='Lock') as waiting",
            )
          ).rows[0].waiting;
          if (waiting) break;
          await delay(20);
        }
        assert(
          waiting,
          "authority update should wait for the complete profile read",
        );
      } finally {
        release();
      }
      const snapshot = await reader;
      await writer;
      assert.equal(snapshot.age, "adult");
      const current = await read(f, c, p.id);
      assert.equal(current.age, "unknown");
      assert(!current.purposes.find((e) => e.purpose === "service").eligible);
    }),
);
