import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createApi } from "@aarili/api";
import { createCommandRoutes } from "@aarili/api/commands";
import {
  commandErrorSchema,
  syntheticSuccessSchema,
} from "@aarili/contracts/command";
import { executeSynthetic, idempotencyCutoff } from "@aarili/core/commands";
import { sql, withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { auditEvent, idempotencyKey } from "@aarili/db/command-schema";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const origin = "http://127.0.0.1:3103";
const root = (shop) => `/dev/shops/${shop}/records`;
async function fixture(run) {
  await withTenantFixture(async (f) => {
    // Absence before fixture installation proves application migrations do not
    // install this synthetic capability, on the same retained auth schema.
    assert.equal(
      (await f.admin.query("select to_regclass('synthetic_record') as r"))
        .rows[0].r,
      null,
    );
    await f.migration.query(
      await readFile("tests/fixtures/command.sql", "utf8"),
    );
    await run({
      ...f,
      api: createApi(async () => true, f.owner).route(
        "/",
        createCommandRoutes(f.owner),
      ),
    });
  });
}
function request(f, path, method = "GET", body, headers = {}, identity = f.a) {
  return f.api.fetch(
    new Request(`${origin}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: identity.cookie,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function create(f, identity = f.a, key = randomUUID()) {
  const response = await request(
    f,
    root(identity.shop),
    "POST",
    { value: "alpha" },
    { "Idempotency-Key": key },
    identity,
  );
  assert.equal(
    response.status,
    200,
    JSON.stringify(await response.clone().json()),
  );
  return syntheticSuccessSchema.parse(await response.json()).record;
}
async function counts(f) {
  return (
    await f.admin.query(
      "select (select count(*)::int from synthetic_record) as records,(select count(*)::int from audit_event) as audit,(select count(*)::int from idempotency_key) as keys",
    )
  ).rows[0];
}
function command(
  f,
  who,
  input,
  {
    key = randomUUID(),
    id = null,
    version,
    pool = f.runtime,
    decorate = (repo) => repo,
  } = {},
) {
  return withShop(pool.db, who.user, who.shop, (tx) =>
    executeSynthetic(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: decorate(commandRepository(tx, who.shop), tx),
      },
      input,
      {
        key,
        ...(version ? { ifMatch: `"v${version}"` } : {}),
        requestId: randomUUID(),
      },
      id,
    ),
  );
}
async function reject(response, status, code) {
  assert.equal(
    response.status,
    status,
    JSON.stringify(await response.clone().json()),
  );
  assert.equal(
    commandErrorSchema.parse(await response.json()).error.code,
    code,
  );
}

test("0.2.3 E1/E2/E3/E9 TRU-01 AC-38 AC-55 authenticated API → core; headers, DTO, 428/412/409/422 and origin negatives", async () => {
  await fixture(async (f) => {
    const r = await create(f);
    const path = `${root(f.a.shop)}/${r.id}`;
    const get = await request(f, path);
    assert.equal(get.headers.get("ETag"), '"v1"');
    assert.equal(get.headers.get("Cache-Control"), "no-store");
    await reject(
      await request(
        f,
        path,
        "PATCH",
        { action: "edit", value: "beta" },
        { "Idempotency-Key": randomUUID() },
      ),
      428,
      "PRECONDITION_REQUIRED",
    );
    const negatives = [
      [{ action: "edit", value: "beta" }, {}, "IDEMPOTENCY_REQUIRED"],
      [
        { action: "edit", value: "beta" },
        { "Idempotency-Key": "bad" },
        "VALIDATION_FAILED",
      ],
      [
        { action: "edit", value: "beta" },
        { "Idempotency-Key": randomUUID(), "If-Match": "*" },
        "VALIDATION_FAILED",
      ],
      [
        { action: "edit", value: "beta" },
        { "Idempotency-Key": randomUUID(), "If-Match": 'W/"v1"' },
        "VALIDATION_FAILED",
      ],
      [
        { action: "edit", value: "beta" },
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1", "v2"' },
        "VALIDATION_FAILED",
      ],
      [
        { action: "edit", value: "" },
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
        "VALIDATION_FAILED",
      ],
      [
        { action: "edit", value: 0 },
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
        "VALIDATION_FAILED",
      ],
      [
        { action: "correct", value: "beta", reason: " " },
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
        "VALIDATION_FAILED",
      ],
      [
        { action: "edit", value: "beta", actor: f.b.user, shopId: f.b.shop },
        { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
        "VALIDATION_FAILED",
      ],
    ];
    for (const [body, headers, code] of negatives)
      await reject(await request(f, path, "PATCH", body, headers), 422, code);
    await reject(
      await request(
        f,
        root(f.a.shop),
        "POST",
        { value: "beta" },
        {
          "Idempotency-Key": randomUUID(),
          Origin: "http://evil.test",
          "X-Forwarded-For": "spoof",
        },
      ),
      403,
      "UNSAFE_ORIGIN",
    );
    await reject(
      await request(
        f,
        path,
        "PATCH",
        { action: "edit", value: "beta" },
        {
          Cookie: "",
          "Idempotency-Key": randomUUID(),
          "If-Match": '"v1"',
          "X-Actor-Id": f.a.user,
        },
      ),
      401,
      "UNAUTHENTICATED",
    );
    await reject(
      await f.api.fetch(
        new Request(`${origin}/api${path}`, {
          method: "PATCH",
          headers: {
            Cookie: f.a.cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: "{",
        }),
      ),
      422,
      "VALIDATION_FAILED",
    );
    await reject(
      await request(f, `${root(f.a.shop)}/bad-id`),
      422,
      "VALIDATION_FAILED",
    );
    await reject(
      await request(f, `${root(f.a.shop)}/${randomUUID()}`),
      404,
      "NOT_FOUND",
    );
    await reject(
      await request(f, `${path}?value=alpha`),
      422,
      "INVALID_REQUEST",
    );
    assert.deepEqual(await counts(f), { records: 1, audit: 1, keys: 1 });
    const key = randomUUID();
    const edit = await request(
      f,
      path,
      "PATCH",
      { action: "edit", value: "beta" },
      { "Idempotency-Key": key, "If-Match": '"v1"' },
    );
    assert.equal(edit.status, 200);
    assert.equal(edit.headers.get("ETag"), '"v2"');
    const stale = await request(
      f,
      path,
      "PATCH",
      { action: "edit", value: "gamma" },
      { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
    );
    assert.equal(stale.status, 412);
    const conflict = commandErrorSchema.parse(await stale.json());
    assert.equal(conflict.current.value, "beta");
    assert.equal(stale.headers.get("ETag"), '"v2"');
    const finalized = await request(
      f,
      path,
      "PATCH",
      { action: "finalize" },
      { "Idempotency-Key": randomUUID(), "If-Match": '"v2"' },
    );
    assert.equal(finalized.status, 200);
    await reject(
      await request(
        f,
        path,
        "PATCH",
        { action: "edit", value: "gamma" },
        { "Idempotency-Key": randomUUID(), "If-Match": '"v3"' },
      ),
      409,
      "RECORD_FINALIZED",
    );
    assert.deepEqual(await counts(f), { records: 1, audit: 3, keys: 3 });
  });
}, 180000);

test("0.2.3 E4/E5/E7/E9 TRU-06 AC-55 persisted replay survives lost response/stale If-Match; actor/action/target binding and shops", async () => {
  await fixture(async (f) => {
    const key = randomUUID();
    const r = await create(f, f.a, key);
    const replay = await create(f, f.a, key.toUpperCase());
    assert.deepEqual(replay, r);
    const path = `${root(f.a.shop)}/${r.id}`;
    const editKey = randomUUID();
    const headers = {
      "Idempotency-Key": editKey,
      "If-Match": '"v1"',
      "X-Actor-Id": f.b.user,
      "X-Shop-Id": f.b.shop,
      "X-Request-Id": randomUUID(),
    };
    const lost = await request(
      f,
      path,
      "PATCH",
      { action: "edit", value: "beta" },
      headers,
    );
    assert.equal(lost.status, 200);
    const stored = await lost.json(); // Simulate loss after commit; caller retries original request.
    const retry = await request(
      f,
      path,
      "PATCH",
      { action: "edit", value: "beta" },
      headers,
    );
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), stored);
    assert.equal(retry.headers.get("ETag"), '"v2"');
    for (const [body, target, extra] of [
      [{ action: "edit", value: "gamma" }, r.id, {}],
      [{ action: "finalize" }, r.id, {}],
      [{ action: "edit", value: "beta" }, randomUUID(), {}],
      [{ action: "edit", value: "beta" }, r.id, { "If-Match": '"v2"' }],
    ])
      await reject(
        await request(f, `${root(f.a.shop)}/${target}`, "PATCH", body, {
          ...headers,
          ...extra,
        }),
        422,
        "IDEMPOTENCY_MISMATCH",
      );
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    const foreignActor = await request(
      f,
      path,
      "PATCH",
      { action: "edit", value: "beta" },
      headers,
      f.b,
    );
    await reject(foreignActor, 422, "IDEMPOTENCY_MISMATCH");
    const b = await create(f, f.b, key);
    assert.notEqual(b.id, r.id);
    await reject(
      await request(
        f,
        `${root(f.b.shop)}/${r.id}`,
        "PATCH",
        { action: "edit", value: "beta" },
        { "Idempotency-Key": editKey, "If-Match": '"v1"' },
        f.b,
      ),
      404,
      "NOT_FOUND",
    );
    const events = (
      await f.admin.query(
        "select * from audit_event where shop_id=$1 order by occurred_at,id",
        [f.a.shop],
      )
    ).rows;
    assert.equal(events.length, 2);
    for (const e of events) {
      assert.equal(e.actor_type, "user");
      assert.equal(e.actor_id, f.a.user);
      assert.notEqual(e.request_id, headers["X-Request-Id"]);
      assert.deepEqual(Object.keys(e.changes).sort(), [
        "finalized",
        "valueChanged",
        "version",
      ]);
      assert.equal(e.entity_id, r.id);
      assert(e.occurred_at instanceof Date);
      assert(!JSON.stringify(e).includes("password"));
      assert(!JSON.stringify(e.changes).includes("beta"));
    }
    assert.deepEqual(await counts(f), { records: 2, audit: 3, keys: 3 });
    // Earlier installation/connection provenance is retained, not copied into
    // the business audit or given new runtime mutation grants.
    assert(
      (await f.admin.query("select completed_at from owner_bootstrap")).rows[0]
        .completed_at,
    );
  });
}, 180000);

test("0.2.3 E3/E5/E6 AC-55 two real transactions serialize duplicates, different-key versions and rollback then retry", async () => {
  await fixture(async (f) => {
    async function overlap(rollback) {
      const key = randomUUID();
      let release, entered;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const firstEntered = new Promise((resolve) => {
        entered = resolve;
      });
      const pids = new Set();
      const decorate = (first) => (repo, tx) => ({
        ...repo,
        async lockKey(k) {
          pids.add(
            (await tx.execute(sql`select pg_backend_pid() as pid`)).rows[0].pid,
          );
          await repo.lockKey(k);
          if (first) {
            entered();
            await gate;
          }
        },
        async persist(...args) {
          await repo.persist(...args);
          if (first && rollback)
            throw new Error("Injected after persisted response");
        },
      });
      const first = command(
        f,
        f.a,
        { action: "create", value: "alpha" },
        { key, pool: f.parallel, decorate: decorate(true) },
      );
      // Handle expected rejection immediately; do not leave an unhandled promise.
      const firstSettled = first.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await firstEntered;
      const second = command(
        f,
        f.a,
        { action: "create", value: "alpha" },
        { key, pool: f.parallel, decorate: decorate(false) },
      );
      let blocked = false;
      try {
        for (let i = 0; i < 100; i++) {
          if (
            (
              await f.admin.query(
                "select 1 from pg_locks where locktype='advisory' and not granted",
              )
            ).rowCount
          ) {
            blocked = true;
            break;
          }
          await delay(20);
        }
        assert(
          blocked,
          "Second physical transaction did not wait on the key lock",
        );
        assert.equal(pids.size, 2);
      } finally {
        release();
      }
      const a = await firstSettled,
        b = await second;
      if (rollback) assert.match(a.error.message, /Injected/);
      else assert.deepEqual(a.value, b);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from idempotency_key where key=$1",
            [key],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from audit_event where idempotency_key=$1",
            [key],
          )
        ).rows[0].n,
        1,
      );
    }
    await overlap(false);
    await overlap(true);
    const r = await create(f);
    const writes = await Promise.allSettled(
      ["beta", "gamma"].map((value) =>
        command(
          f,
          f.a,
          { action: "edit", value },
          { id: r.id, version: 1, pool: f.parallel },
        ),
      ),
    );
    assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      writes.find((r) => r.status === "rejected").reason.status,
      412,
    );
    assert.deepEqual(await counts(f), { records: 3, audit: 4, keys: 4 });
  });
}, 180000);

test("0.2.3 E6 TRU-06 mutation/audit/key/enlisted-write failures leave no partial effects and permit retry", async () => {
  await fixture(async (f) => {
    for (const step of ["insert", "audit", "persist", "enlisted"]) {
      const before = await counts(f),
        key = randomUUID(),
        childId = randomUUID();
      await assert.rejects(
        command(
          f,
          f.a,
          { action: "create", value: "alpha" },
          {
            key,
            decorate: (repo, tx) => ({
              ...repo,
              async insert(r) {
                await repo.insert(r);
                if (step === "insert") throw new Error("Injected mutation");
              },
              async audit(e) {
                await repo.audit(e);
                if (step === "audit") throw new Error("Injected audit");
              },
              async persist(...args) {
                await repo.persist(...args);
                // Test-only write enlists using the exact tx. This is not pg-boss,
                // an outbox or proof of queue/worker behaviour (owned by 0.3.2).
                await tx.execute(
                  sql`insert into isolation_child(shop_id,id,parent_id,label) values(${f.a.shop}::uuid,${childId}::uuid,${f.parentA}::uuid,'command-enlisted')`,
                );
                if (step === "persist")
                  throw new Error("Injected response/key");
                if (step === "enlisted")
                  await tx.execute(
                    sql`insert into isolation_child(shop_id,id,parent_id,label) values(${f.a.shop}::uuid,${randomUUID()}::uuid,${randomUUID()}::uuid,'invalid')`,
                  );
              },
            }),
          },
        ),
      );
      assert.deepEqual(await counts(f), before);
      assert.equal(
        (
          await f.admin.query("select 1 from isolation_child where id=$1", [
            childId,
          ])
        ).rowCount,
        0,
      );
      const result = await command(
        f,
        f.a,
        { action: "create", value: "alpha" },
        {
          key,
          decorate: (repo, tx) => ({
            ...repo,
            async persist(...args) {
              await repo.persist(...args);
              await tx.execute(
                sql`insert into isolation_child(shop_id,id,parent_id,label) values(${f.a.shop}::uuid,${childId}::uuid,${f.parentA}::uuid,'command-enlisted')`,
              );
            },
          }),
        },
      );
      assert(result.record.id);
      assert.equal(
        (
          await f.admin.query("select 1 from isolation_child where id=$1", [
            childId,
          ])
        ).rowCount,
        1,
      );
    }
    assert.deepEqual(await counts(f), { records: 4, audit: 4, keys: 4 });
  });
}, 180000);

test("0.2.3 E7/E8/E9 TRU-06/TRU-12 finalized history, concurrent correction/finalization, cross-shop references, grants and triggers", async () => {
  await fixture(async (f) => {
    const r = await create(f);
    const finals = await Promise.allSettled(
      [1, 2].map(() =>
        command(
          f,
          f.a,
          { action: "finalize" },
          { id: r.id, version: 1, pool: f.parallel },
        ),
      ),
    );
    assert.equal(finals.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      finals.find((x) => x.status === "rejected").reason.status,
      412,
    );
    const finalized = finals.find((x) => x.status === "fulfilled").value.record;
    const corrections = await Promise.allSettled(
      ["beta", "gamma"].map((value) =>
        command(
          f,
          f.a,
          { action: "correct", value, reason: "Synthetic correction" },
          { id: r.id, version: 2, pool: f.parallel },
        ),
      ),
    );
    assert.equal(corrections.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      corrections.find((x) => x.status === "rejected").reason.status,
      409,
    );
    const correction = corrections.find((x) => x.status === "fulfilled").value
      .record;
    assert.equal(correction.correctionOf, r.id);
    assert.deepEqual(
      (await request(f, `${root(f.a.shop)}/${r.id}`)).status,
      200,
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) =>
      assert.deepEqual(
        await commandRepository(tx, f.a.shop).read(r.id),
        finalized,
      ),
    );
    const correctionAudit = (
      await f.admin.query("select * from audit_event where id=$1", [
        correction.eventId,
      ])
    ).rows[0];
    assert.equal(correctionAudit.source_event_id, finalized.eventId);
    assert.equal(correctionAudit.reason, "Synthetic correction");
    const foreign = await create(f, f.b);
    const deniedSql = [
      sql`update synthetic_record set value='gamma',version=version+1 where id=${r.id}::uuid`,
      sql`delete from synthetic_record where id=${r.id}::uuid`,
      sql`update synthetic_record set value='alpha',version=version+1 where id=${correction.id}::uuid`,
      sql`delete from synthetic_record where id=${correction.id}::uuid`,
      sql`update audit_event set reason='changed' where shop_id=${f.a.shop}::uuid`,
      sql`delete from audit_event where shop_id=${f.a.shop}::uuid`,
      sql`update idempotency_key set response='{}'::jsonb where shop_id=${f.a.shop}::uuid`,
      sql`delete from idempotency_key where shop_id=${f.a.shop}::uuid`,
      sql`set role app_privacy`,
      sql`insert into audit_event(shop_id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${f.a.shop}::uuid,'user',${f.b.user}::uuid,'forged','synthetic_record',${r.id}::uuid,${randomUUID()}::uuid,${randomUUID()}::uuid,'{}')`,
      sql`insert into audit_event(shop_id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes,source_event_id) values(${f.a.shop}::uuid,'user',${f.a.user}::uuid,'forged','synthetic_record',${r.id}::uuid,${randomUUID()}::uuid,${randomUUID()}::uuid,'{}',${foreign.eventId}::uuid)`,
      sql`insert into synthetic_record(shop_id,id,version,value,finalized,event_id) values(${f.a.shop}::uuid,${randomUUID()}::uuid,1,'alpha',false,${foreign.eventId}::uuid)`,
      sql`insert into synthetic_record(shop_id,id,version,value,finalized,correction_of,event_id) values(${f.a.shop}::uuid,${randomUUID()}::uuid,1,'alpha',true,${foreign.id}::uuid,${foreign.eventId}::uuid)`,
    ];
    for (const statement of deniedSql)
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(statement),
        ),
      );
    // Defence even if an accidental grant is added: audit trigger rejects it.
    await f.migration.query("grant update,delete on audit_event to app_user");
    try {
      for (const statement of deniedSql.slice(4, 6))
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(statement),
          ),
        );
    } finally {
      await f.migration.query(
        "revoke update,delete on audit_event from app_user",
      );
    }
    assert.deepEqual(await counts(f), { records: 3, audit: 4, keys: 4 });
    await assertIsolationCatalog(f.runtime.db);
  });
}, 180000);

test("0.2.3 E9/E10 TRU-01 AC-38 new tenant catalog, bidirectional isolation, 30-day cutoff, PostgreSQL rate boundary and production exposure", async () => {
  await fixture(async (f) => {
    const key = randomUUID();
    const a = await create(f, f.a, key),
      b = await create(f, f.b, key);
    const tenant = await assertIsolationCatalog(f.runtime.db);
    for (const table of [auditEvent, idempotencyKey]) {
      assert.equal(table.shopId.notNull, true);
      assert.equal(table.actorId.notNull, true);
    }
    for (const name of [
      "public.audit_event",
      "public.idempotency_key",
      "public.synthetic_record",
    ])
      assert(tenant.includes(name));
    for (const [own, other, record] of [
      [f.a, f.b, b],
      [f.b, f.a, a],
    ]) {
      await reject(
        await request(
          f,
          `${root(other.shop)}/${record.id}`,
          "GET",
          undefined,
          {},
          own,
        ),
        403,
        "SHOP_ACCESS_DENIED",
      );
      await reject(
        await request(
          f,
          `${root(own.shop)}/${record.id}`,
          "GET",
          undefined,
          {},
          own,
        ),
        404,
        "NOT_FOUND",
      );
      await withShop(f.runtime.db, own.user, own.shop, async (tx) => {
        for (const table of [
          sql`audit_event`,
          sql`idempotency_key`,
          sql`synthetic_record`,
        ]) {
          const result = await tx.execute(sql`select shop_id from ${table}`);
          assert(result.rows.every((row) => row.shop_id === own.shop));
        }
        assert.equal(
          await commandRepository(tx, own.shop).read(record.id),
          undefined,
        );
      });
    }
    for (const table of ["audit_event", "idempotency_key", "synthetic_record"])
      assert.equal(
        (await f.runtime.pool.query(`select * from ${table}`)).rowCount,
        0,
      );
    await assert.rejects(
      f.runtime.db.execute(
        sql`insert into idempotency_key(shop_id,key,actor_type,actor_id,action,request_hash,status,response) values(${f.a.shop}::uuid,${randomUUID()}::uuid,'user',${f.a.user}::uuid,'synthetic.create',${"a".repeat(64)},200,'{}')`,
      ),
    );
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into idempotency_key(shop_id,key,actor_type,actor_id,action,request_hash,status,response) values(${f.a.shop}::uuid,${randomUUID()}::uuid,'user',${f.b.user}::uuid,'synthetic.create',${"a".repeat(64)},200,'{}')`,
        ),
      ),
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      await tx.execute(sql`select set_config('app.actor_id',${f.b.user},true)`);
      for (const table of [
        sql`audit_event`,
        sql`idempotency_key`,
        sql`synthetic_record`,
      ])
        assert.equal(
          (await tx.execute(sql`select * from ${table}`)).rowCount,
          0,
        );
    });
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        executeSynthetic(
          {
            shopId: f.a.shop,
            actor: { type: "support", id: f.a.user },
            repository: commandRepository(tx, f.a.shop),
          },
          { action: "create", value: "alpha" },
          { key: randomUUID(), requestId: randomUUID() },
          null,
        ),
      ),
      (error) => error.status === 422,
    );
    const created = (
      await f.admin.query(
        "select created_at from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      )
    ).rows[0].created_at;
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      const repo = commandRepository(tx, f.a.shop);
      const atExpiry = new Date(created.getTime() + 30 * 86400000);
      assert.deepEqual(
        await repo.expiredKeys(
          idempotencyCutoff(new Date(atExpiry.getTime() - 1)),
        ),
        [],
      );
      assert.deepEqual(await repo.expiredKeys(idempotencyCutoff(atExpiry)), [
        key,
      ]);
    });
    // Shared real PostgreSQL bucket: no forwarded headers can create a bucket.
    await f.admin.query(
      "update application_rate_limit set points=100 where key='command:installation'",
    );
    const before = await counts(f);
    const rate = await request(
      f,
      root(f.a.shop),
      "POST",
      { value: "alpha" },
      { "Idempotency-Key": randomUUID(), "X-Forwarded-For": randomUUID() },
    );
    await reject(rate, 429, "RATE_LIMITED");
    assert(Number(rate.headers.get("Retry-After")) > 0);
    assert.deepEqual(await counts(f), before);
    const production = createApi(async () => true, f.owner);
    for (const method of ["GET", "POST", "PATCH"])
      assert.equal(
        (
          await production.fetch(
            new Request(`${origin}/api${root(f.a.shop)}/${a.id}`, {
              method,
              headers: { Origin: origin, Cookie: f.a.cookie },
            }),
          )
        ).status,
        404,
      );
    const doc = production.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Aarili", version: "0.0.0" },
    });
    assert(!Object.keys(doc.paths).some((path) => path.includes("/dev/")));
    for (const path of ["/openapi.json", "/docs"])
      assert.equal((await production.request(`/api${path}`)).status, 404);
    // Re-running reviewed migrations preserves keys, audit and finalized refs.
    await migrateDatabase(f.migrationConnectionString);
    assert.deepEqual(await counts(f), before);
  });
}, 180000);
