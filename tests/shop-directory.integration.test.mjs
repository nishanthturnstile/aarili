import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyCalendarDefinition } from "@aarili/contracts/shop-calendar";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { selectDirectoryEntry } from "@aarili/core/shop-directory";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { shopDirectoryRepository } from "@aarili/db/shop-directory-repository";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const id = () => {
  const v = randomUUID();
  return `${v.slice(0, 14)}7${v.slice(15)}`;
};
const account = {
  kind: "account",
  label: "SYNTHETIC family",
  active: true,
  method: "upi",
  recipient: "family",
  upiId: "synthetic@invalid",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  ifsc: "",
};
const vendor = {
  kind: "vendor",
  label: "SYNTHETIC artisan and supplier",
  active: true,
  phone: "",
  capability: "Aari",
  artisan: true,
  supplier: true,
};
const value = (
  content = account,
  entryId = randomUUID(),
  baseVersion = 0,
  baseRevisionId = null,
) => ({ entryId, baseVersion, baseRevisionId, content });
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
async function saved(f, v = value(), who = f.a) {
  const draftId = id();
  const record = (
    await ok(
      await request(f, `drafts/${draftId}`, {
        method: "PUT",
        who,
        body: { workflow: "shop.directory", schemaVersion: 1, payload: v },
      }),
    )
  ).draft;
  return { draftId, record };
}
const promote = (f, d, key = randomUUID(), extra = {}) =>
  request(f, `drafts/${d.draftId}/promote`, {
    method: "POST",
    body: {},
    etag: `"v${d.record.version}"`,
    key,
    ...extra,
  });
const current = async (f, entryId) =>
  (await ok(await request(f, `settings/directory/entries/${entryId}`)))
    .revision;
const list = (f) =>
  request(f, "settings/directory/list", { method: "POST", body: {} }).then(ok);
async function policyReceiving(f, reason) {
  const ready = await ok(await request(f, "settings/policies/readiness"));
  const payment = ready.actions.find((a) => a.action === "paymentRecording");
  assert.equal(payment.state, "not-yet-implemented");
  assert(payment.reasons.some((r) => r.code === "actionNotImplemented"));
  assert(
    !payment.reasons.some((r) => r.code === "receivingAccountsNotIntegrated"),
  );
  if (reason) assert(payment.reasons.some((r) => r.code === reason));
  else
    assert(
      !payment.reasons.some((r) =>
        ["receivingMethodsMissing", "receivingAccountMissing"].includes(r.code),
      ),
    );
}
const totals = async (f) =>
  (
    await f.admin.query(
      "select (select count(*)::int from shop_directory_revision) revisions,(select count(*)::int from audit_event where action='shop-directory.publish') audits,(select count(*)::int from idempotency_key where action='draft.promote') keys",
    )
  ).rows[0];
async function reauth(f) {
  const r = await f.api.fetch(
    new Request(`${f.owner.origin}/api/owner/reauthenticate`, {
      method: "POST",
      headers: {
        Origin: f.owner.origin,
        Cookie: f.a.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "synthetic-isolation-password-15" }),
    }),
  );
  await ok(r);
  f.a.cookie = r.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
}
test("SET-07/08/09 SS-03/07/09/11 directory identity, recent-auth, exact replay, masking, active selection and old references", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    assert(
      (await assertIsolationCatalog(f.runtime.db)).includes(
        "public.shop_directory_revision",
      ),
    );
    assert.equal((await list(f)).readiness, "missingMethods");
    await policyReceiving(f, "receivingMethodsMissing");
    const d = await saved(f);
    const key = randomUUID();
    await f.admin.query(
      "update auth_session set created_at=now()-interval '10 minutes' where user_id=$1",
      [f.a.user],
    );
    assert.equal(
      (await rejected(await promote(f, d, key), 403)).error.code,
      "AUTHENTICATION_STALE",
    );
    assert.deepEqual(await totals(f), { revisions: 0, audits: 0, keys: 0 });
    await reauth(f);
    const replies = await Promise.all([
      promote(f, d, key).then(ok),
      promote(f, d, key.toUpperCase()).then(ok),
    ]);
    assert.deepEqual(replies[0], replies[1]);
    assert.deepEqual(await totals(f), { revisions: 1, audits: 1, keys: 1 });
    const old = await current(f, d.record.payload.entryId);
    assert.equal(old.version, 1);
    assert.equal(old.content.upiId, account.upiId);
    assert(!JSON.stringify(await list(f)).includes(account.upiId));
    const methods = await saved(
      f,
      value({ kind: "methods", enabled: ["upi"] }),
    );
    await ok(await promote(f, methods));
    assert.equal((await list(f)).readiness, "configured");
    await policyReceiving(f, null);
    const duplicateMethods = await saved(
      f,
      value({ kind: "methods", enabled: ["cash"] }),
    );
    await rejected(await promote(f, duplicateMethods), 409);
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      const ctx = {
        shopId: f.a.shop,
        actorId: f.a.user,
        repository: shopDirectoryRepository(tx, f.a.shop),
        requireRecent: async () => {},
      };
      assert.equal(
        (await selectDirectoryEntry(ctx, old.entryId, "account")).id,
        old.id,
      );
    });
    const change = await saved(
      f,
      value({ ...account, active: false }, old.entryId, 1, old.id),
    );
    const race = await saved(
      f,
      value({ ...account, label: "SYNTHETIC race" }, old.entryId, 1, old.id),
    );
    const outcomes = await Promise.all([promote(f, change), promote(f, race)]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 412]);
    const committed = await current(f, old.entryId);
    assert.equal(committed.version, 2);
    const disable = committed.content.active
      ? await saved(
          f,
          value(
            { ...committed.content, active: false },
            old.entryId,
            committed.version,
            committed.id,
          ),
        )
      : null;
    if (disable) await ok(await promote(f, disable));
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      await assert.rejects(
        () =>
          selectDirectoryEntry(
            {
              shopId: f.a.shop,
              actorId: f.a.user,
              repository: shopDirectoryRepository(tx, f.a.shop),
              requireRecent: async () => {},
            },
            old.entryId,
            "account",
          ),
        (e) => e.status === 409,
      );
    });
    assert.equal((await list(f)).readiness, "missingReceivingAccount");
    await policyReceiving(f, "receivingAccountMissing");
    const off = await current(f, old.entryId);
    const on = await saved(
      f,
      value(
        { ...off.content, active: true, label: "SYNTHETIC revised" },
        off.entryId,
        off.version,
        off.id,
      ),
    );
    await ok(await promote(f, on));
    assert.equal((await current(f, old.entryId)).entryId, old.entryId);
    assert.deepEqual(
      await ok(await request(f, `settings/directory/revisions/${old.id}`)),
      old,
    );
    const h = await ok(
      await request(f, "settings/directory/history", {
        method: "POST",
        body: { entryId: old.entryId },
      }),
    );
    assert(h.revisions.length >= 3);
    assert.equal(h.revisions.at(-1).id, old.id);
    const v = await saved(f, value(vendor));
    await ok(await promote(f, v));
    const vr = await current(f, v.record.payload.entryId);
    assert(vr.content.artisan && vr.content.supplier);
    const voff = await saved(
      f,
      value({ ...vendor, active: false }, vr.entryId, 1, vr.id),
    );
    await ok(await promote(f, voff));
    await f.admin.query(
      "update auth_session set created_at=now()-interval '10 minutes' where user_id=$1",
      [f.a.user],
    );
    // A previously committed response-loss replay still needs live fresh auth.
    await rejected(await promote(f, d, key), 403);
    await reauth(f);
    assert.deepEqual(await ok(await promote(f, d, key)), replies[0]);
    await rejected(await promote(f, d, key, { etag: '"v9"' }), 422);
    assert((await current(f, old.entryId)).content.active);
    const audit = (
      await f.admin.query(
        "select changes from audit_event where action='shop-directory.publish'",
      )
    ).rows;
    assert(!JSON.stringify(audit).includes(account.upiId));
    assert(!JSON.stringify(audit).includes("SYNTHETIC"));
  });
});
test("SS-07/09/11 tenant/reference denial, missing context, provenance, version headers and rollback", {
  timeout: 180000,
}, async () => {
  let inject = false;
  await withTenantFixture(
    async (f) => {
      const d = await saved(f, value(vendor));
      await ok(await promote(f, d));
      const old = await current(f, d.record.payload.entryId);
      await rejected(
        await request(f, "settings/directory/list", {
          method: "POST",
          body: {},
          who: f.a,
          shop: f.b.shop,
        }),
        403,
      );
      assert.deepEqual(
        (
          await ok(
            await request(f, "settings/directory/list", {
              method: "POST",
              body: {},
              who: f.b,
            }),
          )
        ).entries,
        [],
      );
      await rejected(
        await request(f, `settings/directory/revisions/${old.id}`, {
          who: f.b,
        }),
        404,
      );
      assert.equal(
        (
          await ok(
            await request(f, `settings/directory/entries/${old.entryId}`, {
              who: f.b,
            }),
          )
        ).revision,
        null,
      );
      const foreign = await saved(
        f,
        value(vendor, old.entryId, 1, old.id),
        f.b,
      );
      await rejected(
        await promote(f, foreign, randomUUID(), { who: f.b }),
        412,
      );
      assert.equal(
        (
          await f.runtime.db.execute(
            sql`select id from shop_directory_revision`,
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() =>
        f.admin.query("update shop_directory_revision set content=content"),
      );
      await assert.rejects(() =>
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql`update shop_directory set version=version`),
        ),
      );
      await assert.rejects(() =>
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql`delete from shop_directory_revision`),
        ),
      );
      const edit = await saved(
        f,
        value(
          { ...vendor, label: "SYNTHETIC changed" },
          old.entryId,
          1,
          old.id,
        ),
      );
      await rejected(
        await promote(f, edit, randomUUID(), { etag: undefined }),
        428,
      );
      await rejected(
        await promote(f, edit, randomUUID(), { etag: "bad" }),
        422,
      );
      await rejected(
        await request(f, "settings/directory/list?private=x", {
          method: "POST",
          body: {},
        }),
        422,
      );
      await rejected(
        await request(f, "settings/directory/list", {
          method: "POST",
          body: {},
          origin: "https://invalid.example.test",
        }),
        403,
      );
      const before = await totals(f);
      const rollbackKey = randomUUID();
      inject = true;
      await rejected(await promote(f, edit, rollbackKey), 503);
      inject = false;
      assert.deepEqual(await totals(f), before);
      assert.equal((await current(f, old.entryId)).version, 1);
      assert.equal(
        (await ok(await request(f, `drafts/${edit.draftId}`))).lifecycle,
        "active",
      );
      await ok(await promote(f, edit, rollbackKey));
      const bad = await saved(f, value({ ...account, upiId: "" }));
      await rejected(await promote(f, bad), 422);
      // Populated customer/calendar paths remain available regardless of receiving readiness.
      assert.equal((await request(f, "settings/calendar")).status, 200);
    },
    {
      draftInstrumentation: () => ({
        async recordDraftEvent(e) {
          if (inject && e.event === "promoted")
            throw Error("Synthetic rollback");
        },
      }),
    },
  );
});
test("SS-03/07/09/11 receiving create/edit/deactivate/reactivate freshness, membership and bounded history/list pages", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    let r = null;
    for (const content of [
      account,
      { ...account, label: "SYNTHETIC edited" },
      { ...account, active: false },
      { ...account, active: true },
    ]) {
      const d = await saved(
        f,
        r ? value(content, r.entryId, r.version, r.id) : value(content),
      );
      const key = randomUUID();
      await f.admin.query(
        "update auth_session set created_at=now()-interval '10 minutes' where user_id=$1",
        [f.a.user],
      );
      await rejected(await promote(f, d, key), 403);
      await reauth(f);
      await ok(await promote(f, d, key));
      r = await current(f, d.record.payload.entryId);
    }
    const d = await saved(
      f,
      value({ ...account, label: "SYNTHETIC no membership" }),
    );
    // Fresh authentication cannot authorise a supplied foreign tenant.
    await rejected(await promote(f, d, randomUUID(), { shop: f.b.shop }), 403);
    for (let n = 0; n < 26; n++) {
      const d = await saved(
        f,
        value({ ...vendor, label: `SYNTHETIC vendor ${n}` }),
      );
      await ok(await promote(f, d));
    }
    const first = await list(f);
    assert.equal(first.entries.length, 25);
    assert(first.next);
    const second = await ok(
      await request(f, "settings/directory/list", {
        method: "POST",
        body: { before: first.next },
      }),
    );
    assert.equal(second.entries.length, 2);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...first.entries, ...second.entries].map((e) => e.entryId)).size,
      27,
    );
  });
});

test("SS-07/09 bounded immutable history pages use an independent synthetic fixture", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const first = await saved(f, value(vendor));
    await ok(await promote(f, first));
    const entryId = first.record.payload.entryId;
    let v = await current(f, entryId);
    for (let n = v.version; n < 27; n++) {
      const d = await saved(
        f,
        value(
          { ...v.content, label: `SYNTHETIC revision ${n}` },
          v.entryId,
          v.version,
          v.id,
        ),
      );
      await ok(await promote(f, d));
      v = await current(f, entryId);
    }
    const h = await ok(
      await request(f, "settings/directory/history", {
        method: "POST",
        body: { entryId },
      }),
    );
    assert.equal(h.revisions.length, 25);
    assert.equal(h.next, 3);
    const tail = await ok(
      await request(f, "settings/directory/history", {
        method: "POST",
        body: { entryId, beforeVersion: h.next },
      }),
    );
    assert.deepEqual(
      tail.revisions.map((r) => r.version),
      [2, 1],
    );
  });
});

test("SS-07/09 populated synthetic customer/adult/minor/calendar upgrade is additive and idempotent", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      const at = new Date(Date.now() - 60000).toISOString();
      const added = await ok(
        await request(f, "customers", {
          method: "POST",
          body: {
            displayName: "SYNTHETIC preserved payer",
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
      const customer = await ok(
        await request(f, `customers/${added.customerId}`),
      );
      for (const age of ["adult", "minor"]) {
        const person = {
          mode: "new",
          displayName: `SYNTHETIC ${age} wearer`,
          age,
          preferences: {},
          relationship: {
            kind: "family",
            statementByPersonId: customer.personId,
            authorised: true,
            informed: true,
            source: "in-person",
            occurredAt: at,
            interaction: "SYNTHETIC existing family registration",
          },
        };
        await ok(
          await request(f, `customers/${customer.id}/wearers`, {
            method: "POST",
            body: person,
          }),
        );
      }
      const draftId = id();
      await ok(
        await request(f, `drafts/${draftId}`, {
          method: "PUT",
          body: {
            workflow: "shop.calendar",
            schemaVersion: 1,
            payload: {
              domain: "customer",
              baseVersion: 0,
              baseRevisionId: null,
              definition: emptyCalendarDefinition(),
            },
          },
        }),
      );
      await ok(
        await request(f, `drafts/${draftId}/promote`, {
          method: "POST",
          body: {},
          etag: '"v1"',
        }),
      );
      const calendar = await ok(await request(f, "settings/calendar"));
      const wearers = await ok(
        await request(f, `customers/${customer.id}/wearers`),
      );
      const snapshot = async () => {
        const result = {};
        for (const table of [
          "customer_person",
          "customer",
          "wearer",
          "wearer_preferences",
          "customer_wearer_relationship",
          "wearer_relationship_event",
          "wearer_preference_event",
          "wearer_age_event",
          "wearer_purpose_event",
          "consent_record",
          "shop_calendar",
          "shop_calendar_revision",
        ])
          result[table] = (
            await f.admin.query(
              `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as content from ${table} t`,
            )
          ).rows[0].content;
        return result;
      };
      const before = await snapshot();
      assert.equal(
        (await f.admin.query("select to_regclass('shop_directory') as name"))
          .rows[0].name,
        null,
      );
      await migrateDatabase(f.migrationConnectionString);
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await snapshot(), before);
      assert.equal((await list(f)).readiness, "missingMethods");
      const v = await saved(f, value(vendor));
      await ok(await promote(f, v));
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(
        await ok(await request(f, `customers/${customer.id}`)),
        customer,
      );
      assert.deepEqual(
        await ok(await request(f, `customers/${customer.id}/wearers`)),
        wearers,
      );
      assert.deepEqual(
        await ok(await request(f, "settings/calendar")),
        calendar,
      );
    },
    {
      migrationThrough: "0021_shop_calendar.sql",
      customerPolicy: syntheticCustomerPolicy,
    },
  );
});
