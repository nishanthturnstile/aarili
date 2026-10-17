import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createApi } from "@aarili/api";
import {
  DraftFailure,
  draftDeletionEligible,
  mutateDraft,
  productionDraftRetention,
  readDraft,
} from "@aarili/core/drafts";
import { createUsageWriter } from "@aarili/core/usage";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { usageRepository } from "@aarili/db/usage-repository";
import { startSyntheticQueue } from "@aarili/jobs";
import { test } from "vitest";
import { syntheticDraftRegistry } from "../scripts/test-support/drafts.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const origin = "http://127.0.0.1:3103";
const complete = {
  value: "alpha",
  amountRaw: "100",
  measurementRaw: "25",
  oldApproval: true,
};
const save = (payload) => ({
  workflow: "fixture.intake",
  schemaVersion: 1,
  payload,
});
async function fixture(run) {
  const instrumentation = [];
  const transactions = new WeakMap();
  let failUsage = false;
  await withTenantFixture(
    async (f) => {
      await f.migration.query(
        await readFile("tests/fixtures/drafts.sql", "utf8"),
      );
      const owner = {
        ...f.owner,
        withOwnerDraft(headers, shopId, run) {
          return f.owner.withOwnerDraft(headers, shopId, (ctx) => {
            assert.deepEqual([...ctx.workflows.keys()], ["shop.calendar"]);
            assert.ok(ctx.instrumentation);
            // Only test-only workflow construction obtains the transaction; the
            // actual auth factory, repository and private writer remain intact.
            const tx = transactions.get(ctx.instrumentation);
            assert.ok(tx);
            return run({
              ...ctx,
              workflows: syntheticDraftRegistry(tx, shopId),
            });
          });
        },
      };
      // Exercise the real owner-before-drafts mount used by the Next route.
      const api = createApi(async () => true, owner);
      await run({
        ...f,
        api,
        instrumentation,
        setUsageFailure(value) {
          failUsage = value;
        },
      });
    },
    {
      draftInstrumentation(tx, shopId) {
        const writer = createUsageWriter(usageRepository(tx, shopId));
        const adapter = {
          async recordDraftEvent(event) {
            await writer.recordDraftEvent(event);
            if (failUsage)
              throw Error("Injected private usage failure after insert");
            instrumentation.push(event);
          },
        };
        transactions.set(adapter, tx);
        return adapter;
      },
    },
  );
}

async function id(f) {
  return (await f.admin.query("select uuidv7() as id")).rows[0].id;
}
function request(f, who, path, method = "GET", body, headers = {}) {
  return f.api.fetch(
    new Request(`${origin}/api/shops/${who.shop}/drafts${path}`, {
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
async function reject(response, status, code) {
  assert.equal(
    response.status,
    status,
    JSON.stringify(await response.clone().json()),
  );
  assert.equal((await response.json()).error.code, code);
}
async function put(f, draftId, payload = {}, headers = {}, who = f.a) {
  const response = await request(f, who, `/${draftId}`, "PUT", save(payload), {
    "Idempotency-Key": randomUUID(),
    ...headers,
  });
  assert.equal(
    response.status,
    200,
    JSON.stringify(await response.clone().json()),
  );
  return (await response.json()).draft;
}
async function state(
  f,
  draftId,
  { duplicate = false, authorized = true } = {},
) {
  await f.admin.query(
    "insert into draft_synthetic_state(shop_id,id,duplicate,authorized) values($1,$2,$3,$4) on conflict(shop_id,id) do update set duplicate=$3,authorized=$4",
    [f.a.shop, draftId, duplicate, authorized],
  );
}
function command(
  f,
  draftId,
  action,
  input,
  {
    key = randomUUID(),
    version,
    who = f.a,
    pool = f.parallel,
    decorate = (r) => r,
    instrumentation,
    failure,
    boss,
    wrongResult,
  } = {},
) {
  return withShop(pool.db, who.user, who.shop, (tx) =>
    mutateDraft(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: decorate(draftRepository(tx, who.shop)),
        workflows: syntheticDraftRegistry(tx, who.shop, {
          failure,
          boss,
          wrongResult,
        }),
        ...(instrumentation ? { instrumentation } : {}),
      },
      draftId,
      action,
      input,
      {
        key,
        requestId: randomUUID(),
        ...(version ? { ifMatch: `"v${version}"` } : {}),
      },
    ),
  );
}
async function counts(f) {
  return (
    await f.admin.query(
      "select (select count(*)::int from durable_draft) as drafts,(select count(*)::int from draft_synthetic_result) as results,(select count(*)::int from draft_synthetic_enlisted) as enlisted,(select count(*)::int from audit_event where entity_type='durable_draft') as audit,(select count(*)::int from idempotency_key where action like 'draft.%') as keys",
    )
  ).rows[0];
}
const fails = (status, code) => (e) =>
  e instanceof DraftFailure &&
  e.status === status &&
  e.body.error.code === code;

test("0.4.2a E1/E2/E3/E5/E8 USE-03 AC-02/40/55 complete typed synthetic API journey, current authority, no production fixture", async () => {
  await fixture(async (f) => {
    const draftId = await id(f);
    const key = randomUUID();
    const first = await put(
      f,
      draftId,
      { amountRaw: "", measurementRaw: "" },
      { "Idempotency-Key": key },
    );
    assert.equal(first.creatorId, f.a.user);
    assert.equal(first.version, 1);
    assert.equal(first.lifecycle, "active");
    assert.deepEqual(first.payload, { amountRaw: "", measurementRaw: "" });
    assert.equal(first.stale, false);
    const recovered = await request(f, f.a, `/${draftId}`);
    assert.equal(recovered.headers.get("ETag"), '"v1"');
    assert.equal(recovered.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await recovered.json(), first);
    const replay = await put(
      f,
      draftId,
      { amountRaw: "", measurementRaw: "" },
      { "Idempotency-Key": key },
    );
    assert.deepEqual(replay, first);
    await reject(
      await request(f, f.a, `/${draftId}`, "PUT", save({}), {
        "Idempotency-Key": key,
      }),
      422,
      "IDEMPOTENCY_MISMATCH",
    );
    await reject(
      await request(f, f.a, `/${draftId}`, "PUT", save({}), {
        "Idempotency-Key": randomUUID(),
      }),
      428,
      "PRECONDITION_REQUIRED",
    );
    await reject(
      await request(
        f,
        f.a,
        `/${draftId}/promote`,
        "POST",
        {},
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
      ),
      422,
      "VALIDATION_FAILED",
    );
    const updated = await put(f, draftId, complete, { "If-Match": '"v1"' });
    assert.equal(updated.version, 2);
    await reject(
      await request(f, f.a, `/${draftId}`, "PUT", save({}), {
        "Idempotency-Key": randomUUID(),
        "If-Match": '"v1"',
      }),
      412,
      "VERSION_STALE",
    );
    await state(f, draftId, { authorized: false });
    await reject(
      await request(
        f,
        f.a,
        `/${draftId}/promote`,
        "POST",
        {},
        { "Idempotency-Key": randomUUID(), "If-Match": '"v2"' },
      ),
      409,
      "REQUEST_CONFLICT",
    );
    await state(f, draftId, { duplicate: true });
    await reject(
      await request(
        f,
        f.a,
        `/${draftId}/promote`,
        "POST",
        {},
        { "Idempotency-Key": randomUUID(), "If-Match": '"v2"' },
      ),
      409,
      "REQUEST_CONFLICT",
    );
    assert.equal((await counts(f)).results, 0);
    await state(f, draftId);
    const promoteKey = randomUUID();
    const promotedResponse = await request(
      f,
      f.a,
      `/${draftId}/promote`,
      "POST",
      {},
      { "Idempotency-Key": promoteKey, "If-Match": '"v2"' },
    );
    assert.equal(
      promotedResponse.status,
      200,
      JSON.stringify(await promotedResponse.clone().json()),
    );
    const promoted = await promotedResponse.json();
    assert.equal(promoted.draft.lifecycle, "promoted");
    assert.equal(promoted.draft.version, 3);
    const lost = await request(
      f,
      f.a,
      `/${draftId}/promote`,
      "POST",
      {},
      { "Idempotency-Key": promoteKey, "If-Match": '"v2"' },
    );
    assert.deepEqual(await lost.json(), promoted);
    await reject(
      await request(f, f.a, `/${draftId}`, "PUT", save({}), {
        "Idempotency-Key": randomUUID(),
        "If-Match": '"v3"',
      }),
      409,
      "REQUEST_CONFLICT",
    );
    await reject(
      await request(
        f,
        f.a,
        `/${draftId}/promote`,
        "POST",
        {},
        { "Idempotency-Key": randomUUID(), "If-Match": '"v3"' },
      ),
      409,
      "REQUEST_CONFLICT",
    );
    assert.deepEqual(await counts(f), {
      drafts: 1,
      results: 1,
      enlisted: 1,
      audit: 3,
      keys: 3,
    });
    assert.equal(f.instrumentation.length, 3);
    assert.equal(f.instrumentation[2].event, "promoted");
    const event = await f.admin.query(
      "select id,changes from audit_event where entity_type='durable_draft' and action='draft.promote'",
    );
    assert.equal(event.rows[0].id, f.instrumentation[2].actionId);
    assert.equal(JSON.stringify(event.rows).includes("oldApproval"), false);
    const production = createApi(async () => true, f.owner);
    const req = new Request(
      `${origin}/api/shops/${f.a.shop}/drafts/${await id(f)}`,
      {
        method: "PUT",
        headers: {
          Origin: origin,
          Cookie: f.a.cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(save({})),
      },
    );
    const absent = await production.fetch(req);
    await reject(absent, 422, "VALIDATION_FAILED");
    const routes = production.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "production", version: "test" },
    });
    assert.equal(JSON.stringify(routes).includes("fixture.intake"), false);
    assert.equal(JSON.stringify(routes).includes("/dev/"), false);
    for (const [headers, status, code] of [
      [
        { Origin: "https://foreign.test", "Idempotency-Key": randomUUID() },
        403,
        "UNSAFE_ORIGIN",
      ],
      [{}, 422, "IDEMPOTENCY_REQUIRED"],
      [{ "Idempotency-Key": "bad" }, 422, "VALIDATION_FAILED"],
      [
        { "Idempotency-Key": randomUUID(), "If-Match": "*" },
        422,
        "VALIDATION_FAILED",
      ],
    ])
      await reject(
        await request(f, f.a, `/${await id(f)}`, "PUT", save({}), headers),
        status,
        code,
      );
    const anonymous = await f.api.fetch(
      new Request(`${origin}/api/shops/${f.a.shop}/drafts`),
    );
    await reject(anonymous, 401, "UNAUTHENTICATED");
  });
}, 120000);

test("0.4.2a E3/E4/E7 AC-38/55 same-key races, initial PUT conflict, distinct-key promotion, atomic injected rollback and retry", async () => {
  await fixture(async (f) => {
    const draftId = await id(f);
    const key = randomUUID();
    const calls = await Promise.all([
      command(f, draftId, "save", save(complete), { key }),
      command(f, draftId, "save", save(complete), { key }),
    ]);
    assert.deepEqual(calls[0], calls[1]);
    assert.deepEqual(await counts(f), {
      drafts: 1,
      results: 0,
      enlisted: 0,
      audit: 1,
      keys: 1,
    });
    const initial = await id(f);
    const race = await Promise.allSettled([
      command(f, initial, "save", save({ value: "alpha" })),
      command(f, initial, "save", save({ value: "beta" })),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok(
      race.some(
        (r) =>
          r.status === "rejected" &&
          fails(428, "PRECONDITION_REQUIRED")(r.reason),
      ),
    );
    const edits = await Promise.allSettled([
      command(f, initial, "save", save({ value: "alpha" }), { version: 1 }),
      command(f, initial, "save", save({ value: "beta" }), { version: 1 }),
    ]);
    assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok(
      edits.some(
        (r) => r.status === "rejected" && fails(412, "VERSION_STALE")(r.reason),
      ),
    );
    await state(f, draftId);
    const promotions = await Promise.allSettled([
      command(f, draftId, "promote", {}, { version: 1 }),
      command(f, draftId, "promote", {}, { version: 1 }),
    ]);
    assert.equal(promotions.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok(
      promotions.some(
        (r) => r.status === "rejected" && fails(412, "VERSION_STALE")(r.reason),
      ),
    );
    assert.equal((await counts(f)).results, 1);
    const rollbackId = await id(f);
    await command(f, rollbackId, "save", save(complete));
    await state(f, rollbackId);
    const before = await counts(f);
    const retryKey = randomUUID();
    for (const failure of [
      "result",
      "enlisted",
      "update",
      "audit",
      "persist",
      "instrumentation",
    ]) {
      await assert.rejects(
        command(
          f,
          rollbackId,
          "promote",
          {},
          {
            key: retryKey,
            version: 1,
            failure,
            decorate(repo) {
              return {
                ...repo,
                ...(["update", "audit", "persist"].includes(failure)
                  ? {
                      [failure]: async (...args) => {
                        await repo[failure](...args);
                        throw Error(`Injected ${failure}`);
                      },
                    }
                  : {}),
              };
            },
            ...(failure === "instrumentation"
              ? {
                  instrumentation: {
                    async recordDraftEvent() {
                      throw Error("Injected instrumentation");
                    },
                  },
                }
              : {}),
          },
        ),
        /Injected/,
      );
      assert.deepEqual(await counts(f), before);
      assert.equal(
        (
          await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            readDraft(
              { repository: draftRepository(tx, f.a.shop) },
              rollbackId,
            ),
          )
        ).version,
        1,
      );
    }
    const retried = await command(
      f,
      rollbackId,
      "promote",
      {},
      { key: retryKey, version: 1 },
    );
    assert.equal(retried.draft.version, 2);
    assert.deepEqual(
      await command(
        f,
        rollbackId,
        "promote",
        {},
        { key: retryKey, version: 1 },
      ),
      retried,
    );
    await assert.rejects(
      command(f, rollbackId, "save", save({}), { key: retryKey, version: 1 }),
      fails(422, "IDEMPOTENCY_MISMATCH"),
    );
    const sameShopOtherActor = { ...f.a, user: f.b.user };
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    await assert.rejects(
      command(
        f,
        rollbackId,
        "promote",
        {},
        { key: retryKey, version: 1, who: sameShopOtherActor },
      ),
      fails(422, "IDEMPOTENCY_MISMATCH"),
    );
  });
}, 120000);

test("0.4.2a E2/E6/E7 AC-38/40 committed recovery, stable pagination, stale trusted clock, explicit retention and forced RLS", async () => {
  await fixture(async (f) => {
    const ids = [];
    for (let n = 0; n < 4; n++) {
      const draftId = await id(f);
      ids.push(draftId);
      await put(f, draftId, { value: n % 2 ? "alpha" : "beta" });
    }
    const pages = [];
    let cursor;
    do {
      const r = await request(
        f,
        f.a,
        `?limit=2${cursor ? `&cursor=${encodeURIComponent(JSON.stringify(cursor))}` : ""}`,
      );
      assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
      const data = await r.json();
      pages.push(...data.drafts.map((d) => d.id));
      cursor = data.next;
      if (cursor) {
        await put(f, ids[0], { value: "beta" }, { "If-Match": '"v1"' });
      }
    } while (cursor);
    assert.equal(new Set(pages).size, 4);
    assert.deepEqual(pages, ids);
    const abandoned = await command(f, ids[1], "abandon", {}, { version: 1 });
    assert.equal(abandoned.draft.lifecycle, "abandoned");
    await assert.rejects(
      command(f, ids[1], "save", save({}), { version: 2 }),
      fails(409, "REQUEST_CONFLICT"),
    );
    const isolated = await request(f, f.b, `/${ids[0]}`);
    await reject(isolated, 404, "NOT_FOUND");
    const foreignKey = randomUUID();
    await command(f, ids[2], "save", save({}), { key: foreignKey, version: 1 });
    await assert.rejects(
      command(
        f,
        ids[2],
        "promote",
        {},
        { key: foreignKey, version: 2, who: f.b },
      ),
      fails(404, "NOT_FOUND"),
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select * from durable_draft`)).rowCount,
      0,
    );
    await assert.rejects(
      f.runtime.db.execute(
        sql`insert into durable_draft(shop_id,id,workflow,schema_version,creator_id,lifecycle,version,payload) values(${f.a.shop}::uuid,${await id(f)}::uuid,'fixture.intake',1,${f.a.user}::uuid,'active',1,'{}')`,
      ),
    );
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`delete from durable_draft where shop_id=${f.a.shop}::uuid`,
        ),
      ),
      (e) => e.cause?.code === "42501",
    );
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`update durable_draft set payload='{}',version=version+1 where shop_id=${f.a.shop}::uuid and id=${ids[1]}::uuid`,
        ),
      ),
      (e) => e.cause?.code === "42501",
    );
    const catalog = await assertIsolationCatalog(f.runtime.db);
    assert.ok(catalog.includes("public.durable_draft"));
    // Trusted-time synthetic fixture, without granting runtime timestamp/deletion bypass.
    await f.admin.query(
      "alter table durable_draft disable trigger durable_draft_guard",
    );
    await f.admin.query(
      "update durable_draft set updated_at=now()-interval '31 days' where shop_id=$1 and id=$2",
      [f.a.shop, ids[3]],
    );
    await f.admin.query(
      "alter table durable_draft enable trigger durable_draft_guard",
    );
    const staleResponse = await request(f, f.a, `/${ids[3]}`);
    const stale = await staleResponse.json();
    assert.equal(stale.stale, true);
    const now = (await f.admin.query("select now() as now")).rows[0].now;
    assert.equal(
      draftDeletionEligible(
        stale,
        now,
        new Date(now.getTime() - 86400000),
        productionDraftRetention,
      ),
      false,
    );
    const syntheticPolicy = {
      enabled: true,
      noticeDays: 1,
      noticeApproved: true,
      deletionApproved: true,
    };
    assert.equal(
      draftDeletionEligible(stale, now, null, syntheticPolicy),
      false,
    );
    assert.equal(
      draftDeletionEligible(
        stale,
        now,
        new Date(now.getTime() - 86400000),
        syntheticPolicy,
      ),
      true,
    );
    // Privileged disposable exercise only; production policy remains disabled.
    if (
      draftDeletionEligible(
        stale,
        now,
        new Date(now.getTime() - 86400000),
        syntheticPolicy,
      )
    )
      await f.admin.query(
        "delete from durable_draft where shop_id=$1 and id=$2",
        [f.a.shop, ids[3]],
      );
    await reject(await request(f, f.a, `/${ids[3]}`), 404, "NOT_FOUND");
    const invalid = await request(f, f.a, "?limit=0");
    await reject(invalid, 422, "VALIDATION_FAILED");
    await reject(
      await request(f, f.a, "?cursor=not-json"),
      422,
      "VALIDATION_FAILED",
    );
  });
}, 120000);

test("0.4.2a E4/E7 AC-38 real transactional pg-boss draft promotion and result-origin rejection", async () => {
  await fixture(async (f) => {
    const boss = await startSyntheticQueue(f.parallel.db);
    try {
      const firstId = await id(f);
      await command(f, firstId, "save", save(complete));
      await state(f, firstId);
      const otherId = await id(f);
      await command(f, otherId, "save", save(complete));
      await state(f, otherId);
      const first = await command(
        f,
        firstId,
        "promote",
        {},
        { version: 1, boss },
      );
      const jobCount = async () =>
        Number(
          (await f.admin.query("select count(*)::int as n from pgboss.job"))
            .rows[0].n,
        );
      assert.equal(await jobCount(), 1);
      const xid = (
        await f.admin.query(
          "select xmin::text as xid from durable_draft where id=$1 union all select xmin::text from draft_synthetic_result where draft_id=$1 union all select xmin::text from draft_synthetic_enlisted where id=$2 union all select xmin::text from audit_event where entity_id=$1 and action='draft.promote' union all select xmin::text from idempotency_key where action='draft.promote' union all select xmin::text from pgboss.job",
          [firstId, first.draft.result.id],
        )
      ).rows;
      assert.equal(xid.length, 6);
      assert.ok(xid.every((r) => r.xid === xid[0].xid));
      const before = await counts(f);
      // Same-shop result from another draft cannot be linked, nor a foreign-shop result.
      await assert.rejects(
        command(
          f,
          otherId,
          "promote",
          {},
          { version: 1, boss, wrongResult: first.draft.result },
        ),
        fails(409, "REQUEST_CONFLICT"),
      );
      assert.deepEqual(await counts(f), before);
      assert.equal(await jobCount(), 1);
      const foreignDraft = await id(f);
      await command(f, foreignDraft, "save", save(complete), { who: f.b });
      const foreignResult = (
        await f.admin.query(
          "insert into draft_synthetic_result(shop_id,draft_id,value) values($1,$2,'alpha') returning id",
          [f.b.shop, foreignDraft],
        )
      ).rows[0].id;
      const foreignBefore = await counts(f);
      await assert.rejects(
        command(
          f,
          otherId,
          "promote",
          {},
          {
            version: 1,
            boss,
            wrongResult: { type: "fixture.intake", id: foreignResult },
          },
        ),
        fails(409, "REQUEST_CONFLICT"),
      );
      assert.deepEqual(await counts(f), foreignBefore);
      assert.equal(await jobCount(), 1);
      for (const stage of ["queue", "audit", "persist"]) {
        await assert.rejects(
          command(
            f,
            otherId,
            "promote",
            {},
            {
              version: 1,
              boss,
              failure: stage,
              decorate: (repo) => ({
                ...repo,
                ...(stage === "queue"
                  ? {}
                  : {
                      [stage]: async (...args) => {
                        await repo[stage](...args);
                        throw Error(`Injected ${stage}`);
                      },
                    }),
              }),
            },
          ),
          /Injected/,
        );
        assert.deepEqual(await counts(f), foreignBefore);
        assert.equal(await jobCount(), 1);
      }
      const key = randomUUID();
      const committed = await command(
        f,
        otherId,
        "promote",
        {},
        { key, version: 1, boss },
      );
      assert.equal(await jobCount(), 2);
      assert.deepEqual(
        await command(f, otherId, "promote", {}, { key, version: 1, boss }),
        committed,
      );
      assert.equal(await jobCount(), 2);
    } finally {
      await boss.stop();
    }
  });
}, 120000);

test("0.4.2a E8 real private usage factory composes through production API with replay and atomic rollback", async () => {
  await fixture(async (f) => {
    const draftId = await id(f);
    const saveKey = randomUUID();
    const period = {
      from: new Date(Date.now() - 86400000).toISOString(),
      to: new Date(Date.now() + 86400000).toISOString(),
    };
    const usage = (who = f.a) =>
      withShop(f.runtime.db, who.user, who.shop, (tx) =>
        createUsageWriter(usageRepository(tx, who.shop)).read(period),
      );
    const saved = await put(f, draftId, complete, {
      "Idempotency-Key": saveKey,
    });
    assert.equal((await usage()).totals.events, "1");
    assert.deepEqual(
      await put(f, draftId, complete, { "Idempotency-Key": saveKey }),
      saved,
    );
    assert.equal((await usage()).totals.events, "1");
    assert.equal(f.instrumentation.length, 1);
    assert.equal((await usage(f.b)).totals.events, "0");
    await state(f, draftId);
    const before = await counts(f);
    const promoteKey = randomUUID();
    f.setUsageFailure(true);
    await reject(
      await request(
        f,
        f.a,
        `/${draftId}/promote`,
        "POST",
        {},
        { "Idempotency-Key": promoteKey, "If-Match": '"v1"' },
      ),
      503,
      "SERVICE_UNAVAILABLE",
    );
    assert.deepEqual(await counts(f), before);
    assert.equal((await usage()).totals.events, "1");
    assert.equal(f.instrumentation.length, 1);
    assert.equal(
      (await (await request(f, f.a, `/${draftId}`)).json()).lifecycle,
      "active",
    );
    f.setUsageFailure(false);
    const promotedResponse = await request(
      f,
      f.a,
      `/${draftId}/promote`,
      "POST",
      {},
      { "Idempotency-Key": promoteKey, "If-Match": '"v1"' },
    );
    assert.equal(
      promotedResponse.status,
      200,
      JSON.stringify(await promotedResponse.clone().json()),
    );
    const promoted = await promotedResponse.json();
    assert.equal(promoted.draft.lifecycle, "promoted");
    const replay = await request(
      f,
      f.a,
      `/${draftId}/promote`,
      "POST",
      {},
      { "Idempotency-Key": promoteKey, "If-Match": '"v1"' },
    );
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), promoted);
    const readout = await usage();
    assert.equal(readout.totals.events, "2");
    assert.equal(readout.totals.draftsSaved, "1");
    assert.equal(readout.totals.draftsPromoted, "1");
    assert.equal(f.instrumentation.length, 2);
    assert.equal((await usage(f.b)).totals.events, "0");
    const binding = await f.admin.query(
      "select p.name,p.subject_id,a.entity_id,p.occurred_at=a.occurred_at as same_time from product_event p join audit_event a on a.shop_id=p.shop_id and a.id=p.action_id where p.shop_id=$1 order by p.occurred_at,p.action_id",
      [f.a.shop],
    );
    // Audit transaction timestamps are the usage date basis, not a monotonic
    // sequence across transactions. Prove event identity/counts independently
    // of wall-clock ordering while preserving the exact audit-time bindings.
    assert.equal(binding.rows.length, 2);
    assert.equal(
      binding.rows.filter((row) => row.name === "draft.saved").length,
      1,
    );
    assert.equal(
      binding.rows.filter((row) => row.name === "draft.promoted").length,
      1,
    );
    assert.ok(
      binding.rows.every(
        (row) =>
          row.subject_id === draftId &&
          row.entity_id === draftId &&
          row.same_time,
      ),
    );
    assert.deepEqual(await counts(f), {
      drafts: 1,
      results: 1,
      enlisted: 1,
      audit: 2,
      keys: 2,
    });
  });
}, 120000);
