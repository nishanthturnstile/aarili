import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateCustomer } from "@aarili/core/customers";
import { sql, withShop } from "@aarili/db";
import { customerRepository } from "@aarili/db/customer-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const origin = "http://127.0.0.1:3103";
const input = (overrides = {}) => ({
  displayName: "Synthetic Kannu",
  phone: "+91 90000 01234",
  aliases: ["Kannu", "கண்ணு"],
  serviceEvidence: {
    noticeId: syntheticCustomerPolicy.notice.id,
    language: "en",
    decision: "grant",
    giver: "self",
    noticeExplained: true,
    source: "in-person",
    occurredAt: "2026-10-17T00:00:00.000Z",
  },
  ...overrides,
});
function request(f, path, method = "GET", body, extra = {}, who = f.a) {
  return f.api.fetch(
    new Request(`${origin}/api/shops/${who.shop}/customers${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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
function run(f, work, who = f.a, pool = f.runtime) {
  return withShop(pool.db, who.user, who.shop, (tx) =>
    work(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: customerRepository(tx, who.shop),
        policy: syntheticCustomerPolicy,
      },
      tx,
    ),
  );
}
const counts = async (f) =>
  (
    await f.admin.query(
      `select (select count(*)::int from customer_person) as people,(select count(*)::int from customer) as customers,(select count(*)::int from consent_record) as consents,(select count(*)::int from audit_event where action like 'customer.%') as audits,(select count(*)::int from idempotency_key where action like 'customer.%') as keys`,
    )
  ).rows[0];
test("CW-01/02/06/08/11/13 real owner API, synthetic policy, shared phones, replay, search, correction races and transactional privacy evidence", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    await rejected(
      await request(f, "", "POST", input(), {
        "Idempotency-Key": randomUUID(),
      }),
      409,
      "CUSTOMER_POLICY_PENDING",
    );
    assert.equal((await okay(await request(f, "/policy"))).enabled, false);
    const original = f.owner;
    f.api = createApi(async () => true, {
      ...original,
      withOwnerCustomer(h, s, work) {
        return original.withOwnerCustomer(h, s, (ctx) =>
          work({ ...ctx, policy: syntheticCustomerPolicy }),
        );
      },
    });
    const key = randomUUID(),
      a = input();
    const ordinaryApi = f.api;
    f.api = createApi(async () => true, {
      ...original,
      commandLimit: async () => 7,
      withOwnerCustomer(h, s, work) {
        return original.withOwnerCustomer(h, s, (ctx) =>
          work({ ...ctx, policy: syntheticCustomerPolicy }),
        );
      },
    });
    const limited = await request(f, "", "POST", a, {
      "Idempotency-Key": randomUUID(),
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("Retry-After"), "7");
    await okay(await request(f, "/search", "POST", { query: "" }));
    f.api = ordinaryApi;
    const saves = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(f, "", "POST", a, { "Idempotency-Key": key }).then(okay),
      ),
    );
    assert.deepEqual(saves[0], saves[1]);
    assert.deepEqual(saves[1], saves[2]);
    const id = saves[0].customerId;
    assert.deepEqual(Object.keys(saves[0]).sort(), [
      "customerId",
      "personId",
      "version",
    ]);
    const profileResponse = await request(f, `/${id}`),
      profile = await okay(profileResponse);
    assert.equal(profileResponse.headers.get("etag"), '"v1"');
    assert.equal(profile.synthetic, true);
    assert.equal(profile.serviceEvidence.giverPersonId, profile.personId);
    assert.equal(profile.serviceEvidence.recordedBy, f.a.user);
    assert.equal(
      profile.serviceEvidence.noticeVersion,
      syntheticCustomerPolicy.notice.version,
    );
    await rejected(
      await request(f, "", "POST", input({ displayName: "Changed" }), {
        "Idempotency-Key": key,
      }),
      422,
      "IDEMPOTENCY_MISMATCH",
    );
    await rejected(
      await request(f, "/search?query=private", "POST", { query: "private" }),
      422,
      "INVALID_REQUEST",
    );
    const second = await okay(
      await request(f, "", "POST", input({ displayName: "Synthetic second" }), {
        "Idempotency-Key": randomUUID(),
      }),
    );
    const nameOnly = await okay(
      await request(
        f,
        "",
        "POST",
        input({ displayName: "Name only", phone: undefined, aliases: [] }),
        { "Idempotency-Key": randomUUID() },
      ),
    );
    assert.equal(
      (await okay(await request(f, `/${nameOnly.customerId}`))).phone,
      "",
    );
    for (const query of [
      "Kannu",
      "கண்ணு",
      "kannu",
      "1234",
      "001234",
      "+91 90000 01234",
    ]) {
      const found = await okay(
        await request(f, "/search", "POST", { query, limit: 5 }),
      );
      assert(
        found.customers.some((r) => r.id === id),
        `top-five recall: ${query}`,
      );
      if (query === "1234")
        assert(found.customers.some((r) => r.id === second.customerId));
    }
    for (const query of ["123", "01234"])
      assert.equal(
        (await okay(await request(f, "/search", "POST", { query }))).customers
          .length,
        0,
      );
    assert.equal(
      (
        await okay(
          await request(f, "/search", "POST", { query: "NoName 1234" }),
        )
      ).customers.length,
      0,
    );
    assert.deepEqual(
      (
        await okay(await request(f, "/search", "POST", { query: profile.code }))
      ).customers.map((p) => p.id),
      [id],
    );
    const page = await okay(
      await request(f, "/search", "POST", { query: "", limit: 1 }),
    );
    assert(page.next);
    const page2 = await okay(
      await request(f, "/search", "POST", {
        query: "",
        limit: 1,
        cursor: page.next,
      }),
    );
    assert.notEqual(page.customers[0].id, page2.customers[0].id);
    const correction = {
      displayName: "Corrected private canary",
      phone: a.phone,
      email: "",
      notes: "Private note",
      aliases: ["new-alias"],
    };
    await rejected(
      await request(f, `/${id}`, "PATCH", correction, {
        "Idempotency-Key": randomUUID(),
      }),
      428,
      "PRECONDITION_REQUIRED",
    );
    const edits = await Promise.all(
      [1, 2].map(() =>
        request(f, `/${id}`, "PATCH", correction, {
          "Idempotency-Key": randomUUID(),
          "If-Match": '"v1"',
        }),
      ),
    );
    assert.deepEqual(edits.map((r) => r.status).sort(), [200, 412]);
    assert.deepEqual(
      await okay(await request(f, "", "POST", a, { "Idempotency-Key": key })),
      saves[0],
    );
    assert.equal(
      (
        await okay(await request(f, "/search", "POST", { query: "Kannu" }))
      ).customers.some((r) => r.id === id),
      false,
    );
    assert.equal(
      (await okay(await request(f, "/search", "POST", { query: "new-alias" })))
        .customers[0].id,
      id,
    );
    await rejected(
      await request(f, `/${id}`, "GET", undefined, {}, f.b),
      404,
      "NOT_FOUND",
    );
    assert.equal(
      (
        await okay(
          await request(f, "/search", "POST", { query: "1234" }, {}, f.b),
        )
      ).customers.length,
      0,
    );
    const wrong = new Request(
      `${origin}/api/shops/${f.a.shop}/customers/${id}`,
      { headers: { Cookie: f.b.cookie } },
    );
    assert.equal((await f.api.fetch(wrong)).status, 403);
    await rejected(
      await request(
        f,
        `/${id}`,
        "PATCH",
        correction,
        { "Idempotency-Key": randomUUID(), "If-Match": '"v2"' },
        f.b,
      ),
      404,
      "NOT_FOUND",
    );
    await rejected(
      await request(f, "", "POST", input(), {
        Origin: "https://foreign.example",
        "Idempotency-Key": randomUUID(),
      }),
      403,
      "UNSAFE_ORIGIN",
    );
    await rejected(
      await request(f, "", "POST", input({ synthetic: true }), {
        "Idempotency-Key": randomUUID(),
      }),
      422,
      "VALIDATION_FAILED",
    );
    await rejected(
      await request(f, "", "POST", input({ notes: "x".repeat(40000) }), {
        "Idempotency-Key": randomUUID(),
      }),
      413,
      "INVALID_REQUEST",
    );
    const before = await counts(f);
    for (const [body, contentType] of [
      ["{", "application/json"],
      ["{}", "text/plain"],
    ]) {
      const malformed = await f.api.fetch(
        new Request(`${origin}/api/shops/${f.a.shop}/customers`, {
          method: "POST",
          headers: {
            Origin: origin,
            Cookie: f.a.cookie,
            "Content-Type": contentType,
            "Idempotency-Key": randomUUID(),
          },
          body,
        }),
      );
      await rejected(malformed, 422, "VALIDATION_FAILED");
    }
    assert.deepEqual(await counts(f), before);
    await assert.rejects(
      run(f, (ctx) =>
        mutateCustomer(
          {
            ...ctx,
            repository: {
              ...ctx.repository,
              audit: async () => {
                throw Error("Injected audit failure");
              },
            },
          },
          "create",
          undefined,
          input(),
          { key: randomUUID(), requestId: randomUUID() },
        ),
      ),
    );
    assert.deepEqual(await counts(f), before);
    await assert.rejects(
      run(f, (ctx) =>
        mutateCustomer(
          { ...ctx, actor: { type: "user", id: f.b.user } },
          "create",
          undefined,
          a,
          { key, requestId: randomUUID() },
        ),
      ),
      { status: 422, message: "IDEMPOTENCY_MISMATCH" },
    );
    await assert.rejects(
      run(f, (ctx) =>
        mutateCustomer(
          { ...ctx, actor: { type: "system", id: f.a.user } },
          "create",
          undefined,
          input(),
          { key: randomUUID(), requestId: randomUUID() },
        ),
      ),
      { status: 422 },
    );
    await assert.rejects(
      run(f, (ctx) =>
        mutateCustomer(ctx, "correct", id, correction, {
          key,
          ifMatch: '"v2"',
          requestId: randomUUID(),
        }),
      ),
      { status: 422 },
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select * from customer`)).rowCount,
      0,
    );
    const context = await f.runtime.db.execute(
      sql`select current_setting('app.user_id',true) as u,current_setting('app.shop_id',true) as s,current_setting('app.actor_id',true) as a`,
    );
    assert(Object.values(context.rows[0]).every((v) => v === null || v === ""));
    await assert.rejects(
      run(
        f,
        (_ctx, tx) =>
          tx.execute(
            sql`insert into customer(shop_id,id,person_id,code_number,code) values(${f.b.shop}::uuid,uuidv7(),${profile.personId}::uuid,999,'foreign')`,
          ),
        f.b,
      ),
      (e) => (e.cause?.code ?? e.code) === "23503",
    );
    await assert.rejects(
      run(f, (_ctx, tx) =>
        tx.execute(sql`delete from customer where shop_id=${f.a.shop}::uuid`),
      ),
    );
    await assert.rejects(
      run(f, (_ctx, tx) =>
        tx.execute(
          sql`update consent_record set language='ta' where shop_id=${f.a.shop}::uuid`,
        ),
      ),
    );
    await run(f, (_ctx, tx) => assertIsolationCatalog(tx));
    const replay = (
      await f.admin.query(
        "select response from idempotency_key where action like 'customer.%'",
      )
    ).rows;
    assert(!JSON.stringify(replay).includes("Private note"));
    assert(!JSON.stringify(replay).includes(a.phone));
    const audit = (
      await f.admin.query(
        "select changes from audit_event where action like 'customer.%'",
      )
    ).rows;
    assert(!JSON.stringify(audit).includes("Private note"));
    assert(!JSON.stringify(audit).includes(a.phone));
  });
});
