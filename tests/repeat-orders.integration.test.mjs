import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyGroupIntake, emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { seedOrderAcceptance } from "../scripts/test-support/order-acceptance.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const uuid7 = () => randomUUID().replace(/^(........-....-)./, "$17");
async function fixture(work, extra = {}, seedOptions = {}) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      f.request = async (
        path,
        { body, method = "POST", etag, key = randomUUID(), who = f.a } = {},
      ) =>
        f.api.fetch(
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
      f.ok = async (path, options) => {
        const r = await f.request(path, options);
        assert.equal(r.status, 200, await r.clone().text());
        return r.json();
      };
      f.seed = await seedQuickOrder(f.runtime.pool, f.a.shop, {
        outfit: !!seedOptions.outfit,
      });
      try {
        f.config = await seedOrderAcceptance(f.ok, f.seed.sources, seedOptions);
        f.value = {
          ...emptyQuickOrder(),
          customerId: f.seed.customer.customerId,
          wearerId: f.seed.wearer.wearerId,
          manifest: {
            entryId: f.seed.sources.before.entryId,
            revisionId: f.seed.sources.before.id,
            definitionId: f.seed.sources.before.definition.id,
          },
          deliveryDate: new Date(Date.now() + 30 * 86400000)
            .toISOString()
            .slice(0, 10),
          priceState: "quoted",
          priceText: "0",
        };
        f.save = async (v = f.value, d = uuid7(), etag) => ({
          id: d,
          ...(await f.ok(`drafts/${d}`, {
            method: "PUT",
            body: { workflow: "order.quick", schemaVersion: 1, payload: v },
            etag,
          })),
        });
        f.review = async (v = f.value) => f.ok("orders/review", { body: v });
        f.reviewed = async (v = f.value) => {
          const r = await f.review(v);
          assert.deepEqual(r.unknowns, []);
          return {
            ...v,
            commitmentReview: {
              fingerprint: r.fingerprint,
              acknowledged: true,
              exceptionReason: r.evaluation.warnings.length
                ? "SYNTHETIC owner exception"
                : "",
              waiveRush: false,
              waiverReason: "",
            },
          };
        };
        f.promote = (d, options = {}) =>
          f.request(`drafts/${d.id}/promote`, {
            body: {},
            etag: `"v${d.draft.version}"`,
            ...options,
          });
        await work(f);
      } finally {
        await f.seed.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy, ...extra },
  );
}

async function source(f) {
  const d = await f.save(
    await f.reviewed({
      ...f.value,
      priceState: "quoted",
      priceText: "125.50",
      instructions: "SYNTHETIC reuse requested instructions",
    }),
  );
  const r = await f.promote(d);
  assert.equal(r.status, 200, await r.clone().text());
  const orderId = (await r.json()).draft.result.id;
  return await f.ok(`orders/${orderId}/repeat/source`);
}
async function repeat(f, s, options = {}) {
  const input = {
    draftId: uuid7(),
    snapshotDigest: s.order.snapshotDigest,
    scopeDigest: s.scopeDigest,
    reuseInstructions: true,
    ...options,
  };
  return {
    input,
    ...(await f.ok(`orders/${s.order.id}/repeat/create`, {
      body: input,
      etag: `"v${s.order.version}"`,
    })),
  };
}
async function ready(f, d, changes = {}) {
  let v = {
    ...d.draft.payload,
    deliveryDate: f.value.deliveryDate,
    ...changes,
  };
  const r = await f.ok("orders/repeat/review", { body: v });
  assert.deepEqual(r.unknowns, []);
  v = {
    ...v,
    commitmentReview: {
      fingerprint: r.fingerprint,
      acknowledged: true,
      exceptionReason: "SYNTHETIC repeat capacity review",
      waiveRush: false,
      waiverReason: "",
    },
  };
  return {
    id: d.draft.id,
    ...(await f.ok(`drafts/${d.draft.id}`, {
      method: "PUT",
      etag: `"v${d.draft.version}"`,
      body: { workflow: "order.repeat", schemaVersion: 1, payload: v },
    })),
  };
}

test(
  "RH-06/14 populated 0036 upgrade preserves source snapshots, requirements, demand and draft history",
  { timeout: 180000 },
  () =>
    fixture(
      async (f) => {
        const draft = await f.save(await f.reviewed()),
          r = await f.promote(draft);
        assert.equal(r.status, 200, await r.clone().text());
        const id = (await r.json()).draft.result.id;
        const tables = [
          "garment_order",
          "order_acceptance_snapshot",
          "order_capacity_demand",
          "order_requirement",
          "durable_draft",
          "audit_event",
        ];
        const capture = async () =>
          Promise.all(
            tables.map(
              async (table) =>
                (
                  await f.admin.query(
                    `select to_jsonb(t) row from ${table} t order by to_jsonb(t)::text`,
                  )
                ).rows,
            ),
          );
        const before = await capture();
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(await capture(), before);
        const s = await f.ok(`orders/${id}/repeat/source`),
          d = await repeat(f, s);
        assert.equal(d.draft.lifecycle, "active");
        await assertIsolationCatalog(f.runtime.db);
      },
      { migrationThrough: "0036_service_line_completion.sql" },
    ),
);

test(
  "RH-04/06 current manifest publication serializes with repeat acceptance and rejects mixed authority",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const s = await source(f),
        d = await ready(f, await repeat(f, s)),
        t = f.seed.sources.before,
        pub = uuid7();
      await f.ok(`drafts/${pub}`, {
        method: "PUT",
        body: {
          workflow: "service.templates",
          schemaVersion: 1,
          payload: {
            entryId: t.entryId,
            baseVersion: t.version,
            baseRevisionId: t.id,
            operation: "availability",
            available: false,
            reason: "SYNTHETIC repeat publication race",
            content: t.definition.content,
          },
        },
      });
      let entered, release;
      const reached = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      const publisher = f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          const adapter = ctx.workflows.get("service.templates"),
            workflows = new Map(ctx.workflows);
          workflows.set("service.templates", {
            ...adapter,
            async promote(...args) {
              const result = await adapter.promote(...args);
              entered();
              await gate;
              return result;
            },
          });
          return mutateDraft(
            { ...ctx, workflows },
            pub,
            "promote",
            {},
            { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
          );
        },
      );
      await Promise.race([
        reached,
        publisher.then(() => assert.fail("Missing publisher barrier")),
      ]);
      const accepting = f.promote(d);
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          blocked = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where datname=current_database() and usename='app_user' and wait_event='advisory') waiting",
            )
          ).rows[0].waiting;
          if (blocked) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(blocked, true);
      } finally {
        release();
      }
      await publisher;
      assert.equal((await accepting).status, 409);
      assert.equal(
        (await f.admin.query("select count(*)::int n from order_repeat_target"))
          .rows[0].n,
        0,
      );
    }),
);

test(
  "RH-01/02/03/04/05/06/08/09 custom repeat reset, fresh demand, source immutability and exact replay",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const s = await source(f);
      await assertIsolationCatalog(f.runtime.db);
      const original = await f.admin.query(
        "select to_jsonb(o) row from garment_order o where id=$1",
        [s.order.id],
      );
      const body = {
          draftId: uuid7(),
          snapshotDigest: s.order.snapshotDigest,
          scopeDigest: s.scopeDigest,
          reuseInstructions: true,
        },
        key = randomUUID();
      const path = `orders/${s.order.id.toUpperCase()}/repeat/create`;
      assert.equal((await f.request(path, { body })).status, 428);
      const d = await f.ok(path, { body, key, etag: '"v1"' });
      assert.deepEqual(await f.ok(path, { body, key, etag: '"v1"' }), d);
      assert.equal(
        (
          await f.request(path, {
            body: { ...body, reuseInstructions: false },
            key,
            etag: '"v1"',
          })
        ).status,
        422,
      );
      const v = d.draft.payload;
      assert.equal(v.priceState, "to-be-quoted");
      assert.equal(v.priceText, "");
      assert.equal(v.deliveryDate, "");
      assert.equal(v.eventDate, "");
      assert.equal(v.priority, "normal");
      assert.equal(v.commitmentReview, undefined);
      assert.equal(v.instructions, s.order.intake.instructions);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from order_capacity_demand",
          )
        ).rows[0].n,
        1,
      );
      const readyDraft = await ready(f, d),
        acceptKey = randomUUID();
      const result = await f.promote(readyDraft, { key: acceptKey });
      assert.equal(result.status, 200, await result.clone().text());
      const accepted = await result.json(),
        id = accepted.draft.result.id;
      assert.deepEqual(
        await (await f.promote(readyDraft, { key: acceptKey })).json(),
        accepted,
      );
      assert.notEqual(id, s.order.id);
      const o = await f.ok(`orders/${id}/read`);
      assert.equal(o.pricePaise, null);
      assert.equal(o.snapshot.repeat.sourceId, s.order.id);
      assert(
        o.requirements.items.every((i) =>
          ["unresolved", "not-required"].includes(i.state),
        ),
      );
      assert.deepEqual(
        (await f.ok(`orders/${id}/repeat/links`, { body: {} })).source,
        { id: s.order.id, code: s.order.code },
      );
      assert.equal(
        (await f.ok(`orders/${s.order.id}/repeat/links`, { body: {} }))
          .children[0].id,
        id,
      );
      assert.deepEqual(
        await f.admin
          .query("select to_jsonb(o) row from garment_order o where id=$1", [
            s.order.id,
          ])
          .then((r) => r.rows),
        original.rows,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from order_capacity_demand",
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (await f.request(path, { body, etag: '"v1"', who: f.b })).status,
        404,
      );
      const d2 = await repeat(f, s, { reuseInstructions: false });
      assert.equal(d2.draft.payload.instructions, "");
      await f.ok(`drafts/${d2.draft.id}/abandon`, { body: {}, etag: '"v1"' });
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from order_capacity_demand",
          )
        ).rows[0].n,
        2,
      );
    }),
);
test(
  "RH-02/06/07 source stale review, locked identity, unknown versus zero and current manifest",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const s = await source(f),
        d = await repeat(f, s);
      await f.ok(`orders/${s.order.id}/presentation`, {
        body: { mode: "detailed" },
        etag: '"v1"',
      });
      assert.equal(
        (await f.request("orders/repeat/review", { body: d.draft.payload }))
          .status,
        412,
      );
      const current = await f.ok(`orders/${s.order.id}/repeat/source`),
        payload = {
          ...d.draft.payload,
          repeat: {
            ...d.draft.payload.repeat,
            sourceVersion: current.order.version,
            scopeDigest: current.scopeDigest,
          },
        };
      const changed = await f.ok(`drafts/${d.draft.id}`, {
        method: "PUT",
        etag: '"v1"',
        body: { workflow: "order.repeat", schemaVersion: 1, payload },
      });
      assert.equal(
        (
          await f.request(`drafts/${d.draft.id}`, {
            method: "PUT",
            etag: '"v2"',
            body: {
              workflow: "order.repeat",
              schemaVersion: 1,
              payload: { ...payload, wearerId: randomUUID() },
            },
          })
        ).status,
        404,
      );
      const z = await ready(f, changed, {
          priceState: "quoted",
          priceText: "0",
        }),
        r = await f.promote(z);
      assert.equal(r.status, 200, await r.clone().text());
      assert.equal(
        (await f.ok(`orders/${(await r.json()).draft.result.id}/read`))
          .pricePaise,
        0,
      );
    }),
);
test(
  "RH-06/08/14 direct-SQL lineage guards, draft rollback, missing context and forced policies",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const s = await source(f),
        d = await repeat(f, s);
      assert.equal(
        (
          await f.request(`drafts/${uuid7()}`, {
            method: "PUT",
            body: {
              workflow: "order.repeat",
              schemaVersion: 1,
              payload: d.draft.payload,
            },
          })
        ).status,
        503,
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql`delete from order_repeat_origin`),
        ),
        (e) => e.cause?.code === "42501",
      );
      assert.equal(
        (
          await f.runtime.db.execute(
            sql`select count(*)::int n from order_repeat_origin`,
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from order_repeat_origin"))
          .rows[0].n,
        1,
      );
      const trigger =
        "create function repeat_fail_test() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC failure after target write';end$$; create trigger repeat_fail_test after insert on order_repeat_target for each row execute function repeat_fail_test()";
      await f.admin.query(trigger);
      const r = await f.promote(await ready(f, d));
      assert.equal(r.status, 503);
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        1,
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from order_repeat_target"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from order_capacity_demand",
          )
        ).rows[0].n,
        1,
      );
    }),
);

function newGroup(f, overrides = {}) {
  return {
    ...emptyGroupIntake(),
    reason: "SYNTHETIC atomic intake",
    lines: [
      {
        id: uuid7(),
        intake: {
          ...f.value,
          priceText: "1200",
          instructions: "SYNTHETIC first garment",
        },
      },
      {
        id: uuid7(),
        intake: {
          ...f.value,
          priceState: "to-be-quoted",
          priceText: "",
          instructions: "SYNTHETIC second garment",
          deliveryDate: new Date(Date.now() + 32 * 86400000)
            .toISOString()
            .slice(0, 10),
        },
      },
    ],
    ...overrides,
  };
}
async function saveNewGroup(f, input, id = uuid7(), etag) {
  const r = await f.ok("orders/bookings/intake-review", { body: input });
  const payload = {
    ...input,
    review: {
      fingerprint: r.fingerprint,
      acknowledged: true,
      exceptionReason: r.lines.some((l) => l.review.evaluation?.warnings.length)
        ? "SYNTHETIC explicit exception"
        : "",
      waiveRush: false,
      waiverReason: "",
    },
  };
  return {
    id,
    ...(await f.ok(`drafts/${id}`, {
      method: "PUT",
      body: { workflow: "order.group", schemaVersion: 1, payload },
      etag,
    })),
  };
}

async function bookingMinor(f) {
  const c = await f.ok(`customers/${f.value.customerId}`, {
      method: "GET",
    }),
    at = new Date().toISOString();
  const w = await f.ok(`customers/${c.id}/wearers`, {
    body: {
      mode: "new",
      displayName: "SYNTHETIC piece child",
      age: "minor",
      preferences: {
        language: "",
        channel: "",
        fit: "",
        style: "",
        delivery: "",
        source: "",
      },
      relationship: {
        kind: "family",
        statementByPersonId: c.personId,
        authorised: true,
        informed: true,
        source: "in-person",
        occurredAt: at,
        interaction: "SYNTHETIC guarded outfit",
      },
    },
  });
  const path = `customers/${c.id}/wearers/${w.wearerId}/guardians`;
  await f.ok(path, {
    etag: `"v${w.version}"`,
    body: {
      guardian: { mode: "new", displayName: "SYNTHETIC guardian" },
      authority: "parent",
      scope: "measurement",
      source: "in-person",
      occurredAt: at,
    },
  });
  const g = await f.ok(path, { method: "GET" });
  const verification = {
    authorityId: g.authority.id,
    status: "confirmed",
    method: "synthetic-review-v1",
    evidenceRef: "SYNTHETIC",
    scope: "measurement",
    source: "in-person",
    occurredAt: at,
  };
  await f.ok(`${path}/verification-events`, {
    etag: `"v${g.version}"`,
    body: verification,
  });

  return { c, w, path, verification };
}

test(
  "RH-01/02/08 package member repeats only its selected garment, never package price or siblings",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const group = await saveNewGroup(
        f,
        newGroup(f, {
          commercial: {
            basis: "package-proposal",
            packagePriceState: "quoted",
            packagePriceText: "2000",
          },
        }),
      );
      const promoted = await f.promote(group);
      assert.equal(promoted.status, 200, await promoted.clone().text());
      const detail = await f.ok("orders/bookings/read", {
        body: { id: (await promoted.json()).draft.result.id, revision: true },
      });
      const original = structuredClone(detail),
        s = await f.ok(`orders/${detail.orders[0].id}/repeat/source`),
        d = await repeat(f, s);
      assert.equal(d.draft.payload.priceText, "");
      assert.equal(d.draft.payload.priceState, "to-be-quoted");
      const r = await f.promote(await ready(f, d));
      assert.equal(r.status, 200, await r.clone().text());
      const child = await f.ok(
        `orders/${(await r.json()).draft.result.id}/read`,
      );
      assert.equal(child.pricePaise, null);
      assert.equal(child.commercial, undefined);
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        3,
      );
      assert.deepEqual(
        await f.ok("orders/bookings/read", {
          body: { id: detail.booking.revision.id, revision: true },
        }),
        original,
      );
    }),
);

test(
  "RH-05/06/09 guardian withdrawal serializes with repeat acceptance and denies draft, source, links and exact replay",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const minor = await bookingMinor(f);
      f.value.wearerId = minor.w.wearerId;
      const s = await source(f),
        d = await ready(f, await repeat(f, s)),
        key = randomUUID();
      let entered, release;
      const reached = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      const accepting = f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          const original = ctx.workflows.get("order.repeat"),
            workflows = new Map(ctx.workflows);
          workflows.set("order.repeat", {
            ...original,
            async promote(...args) {
              const result = await original.promote(...args);
              entered();
              await gate;
              return result;
            },
          });
          return mutateDraft(
            { ...ctx, workflows },
            d.id,
            "promote",
            {},
            { key, ifMatch: `"v${d.draft.version}"`, requestId: randomUUID() },
          );
        },
      );
      await Promise.race([
        reached,
        accepting.then(() => assert.fail("Missing acceptance barrier")),
      ]);
      const g = await f.ok(minor.path, { method: "GET" });
      const withdrawing = f.request(`${minor.path}/verification-events`, {
        etag: `"v${g.version}"`,
        body: { ...minor.verification, status: "withdrawn" },
      });
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          blocked = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock') waiting",
            )
          ).rows[0].waiting;
          if (blocked) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(
          blocked,
          true,
          "withdrawal waits for source identity locks",
        );
      } finally {
        release();
      }
      const accepted = (await accepting).data;
      assert.equal((await withdrawing).status, 200);
      assert.equal((await f.promote(d, { key })).status, 404);
      for (const path of [
        `orders/${s.order.id}/repeat/source`,
        `orders/${s.order.id}/repeat/links`,
        `orders/${accepted.draft.result.id}/repeat/links`,
      ])
        assert.equal(
          (
            await f.request(path, {
              body: path.endsWith("links") ? {} : undefined,
            })
          ).status,
          404,
        );
      assert.equal(
        (await f.request(`drafts/${d.id}`, { method: "GET" })).status,
        404,
      );
    }),
);

test(
  "RH-03/04/06 retired manifests remain historical, block acceptance and permit explicit current selection; concurrent replay accepts once",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const s = await source(f),
        d = await repeat(f, s),
        old = f.seed.sources.before;
      await f.seed.sources.command("service.templates", {
        entryId: old.entryId,
        baseVersion: old.version,
        baseRevisionId: old.id,
        operation: "availability",
        available: false,
        reason: "SYNTHETIC repeat retirement",
        content: old.definition.content,
      });
      const review = await f.ok("orders/repeat/review", {
        body: { ...d.draft.payload, deliveryDate: f.value.deliveryDate },
      });
      assert.ok(review.intake.issues.includes("service"));
      assert.equal((await f.promote(d)).status, 422);
      assert.equal(
        (await f.ok(`orders/${s.order.id}/repeat/source`)).order.snapshotDigest,
        s.order.snapshotDigest,
      );
      assert.equal(
        (await f.ok(`orders/${s.order.id}/repeat/source`)).currentManifest,
        null,
      );
      const fresh = f.seed.sources.after;
      const updated = await ready(f, d, {
          manifest: {
            entryId: fresh.entryId,
            revisionId: fresh.id,
            definitionId: fresh.definition.id,
          },
        }),
        key = randomUUID();
      const results = await Promise.all([
        f.promote(updated, { key }),
        f.promote(updated, { key }),
      ]);
      for (const r of results)
        assert.equal(r.status, 200, await r.clone().text());
      assert.deepEqual(await results[0].json(), await results[1].json());
      assert.equal(
        (await f.admin.query("select count(*)::int n from order_repeat_target"))
          .rows[0].n,
        1,
      );
    }),
);
