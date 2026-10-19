import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
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
      f.seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
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

test(
  "QO-01/03/05/06/09/10 accepted order exact snapshots, origin recovery, replay, modes and isolated immutable history",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      await assertIsolationCatalog(f.runtime.db);
      const v = await f.reviewed(),
        d = await f.save(v),
        key = randomUUID();
      const r = await f.promote(d, { key });
      assert.equal(r.status, 200, await r.clone().text());
      const promoted = await r.json(),
        orderId = promoted.draft.result.id;
      const order = await f.ok(`orders/${orderId}/read`);
      assert.equal(order.code, "QO-000001");
      assert.equal(order.pricePaise, 0);
      assert.equal(order.synthetic, true);
      assert(order.requirements.items.some((i) => i.state === "unresolved"));
      assert(
        order.requirements.items
          .filter((i) => i.section === "tasks")
          .every((i) => i.assigneeId === f.a.user),
      );
      assert.deepEqual(await (await f.promote(d, { key })).json(), promoted);
      assert.equal((await f.promote(d, { key: randomUUID() })).status, 412);
      const changed = await f.ok(`orders/${orderId}/presentation`, {
        body: { mode: "detailed" },
        etag: '"v1"',
      });
      assert.equal(changed.version, 2);
      assert.equal(changed.snapshotDigest, order.snapshotDigest);
      assert.deepEqual(changed.requirements, order.requirements);
      const stale = await f.request(`orders/${orderId}/presentation`, {
        body: { mode: "simple" },
        etag: '"v1"',
      });
      assert.equal(stale.status, 412);
      assert.equal(stale.headers.get("ETag"), '"v2"');
      assert.equal((await stale.json()).current.presentation, "detailed");
      assert.equal(
        (
          await f.request(`orders/${orderId}/presentation`, {
            body: { mode: "simple" },
          })
        ).status,
        428,
      );
      assert.equal(
        (
          await f.request(`orders/${orderId}/presentation`, {
            body: { mode: "simple" },
            etag: '"v1"',
          })
        ).status,
        412,
      );
      assert.equal(
        (await f.ok(`orders/${orderId}/history`, { body: {} })).entries.length,
        2,
      );
      assert.equal(
        (await f.request(`orders/${orderId}/read`, { who: f.b })).status,
        404,
      );
      assert.deepEqual(
        (await f.ok("orders/list", { body: {}, who: f.b })).orders,
        [],
      );
      assert.equal((await f.ok("orders/list", { body: {} })).orders.length, 1);
      const raw = await f.admin.query(
        "select count(*)::int n from order_capacity_demand",
      );
      assert.equal(raw.rows[0].n, 1);
      const source = f.seed.sources.before;
      await f.seed.sources.command("service.templates", {
        entryId: source.entryId,
        baseVersion: source.version,
        baseRevisionId: source.id,
        operation: "availability",
        available: false,
        reason: "SYNTHETIC historical read after disable",
        content: source.definition.content,
      });
      assert.deepEqual(
        (await f.ok(`orders/${orderId}/read`)).requirements,
        order.requirements,
      );
      assert((await f.review()).unknowns.includes("service"));
      for (const table of [
        "order_acceptance_snapshot",
        "order_requirement",
        "order_capacity_demand",
        "order_presentation_event",
      ]) {
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(sql.raw(`delete from ${table}`)),
          ),
          (e) => e.cause?.code === "42501",
        );
      }
    }),
);

test(
  "QO-05/09 actual-write fault at every acceptance stage rolls back all effects; exact retry and origin uniqueness survive key expiry",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const counts = async () =>
        (
          await f.admin.query(`select
 (select count(*)::int from garment_order) orders,(select count(*)::int from order_acceptance_snapshot) snapshots,
 (select count(*)::int from order_requirement) requirements,(select count(*)::int from order_capacity_demand) demand,
 (select count(*)::int from order_presentation_event) history,(select count(*)::int from audit_event) audit,
 (select count(*)::int from idempotency_key) keys,(select count(*)::int from durable_draft where lifecycle='promoted') promoted`)
        ).rows[0];
      for (const target of [
        "garment_order",
        "order_acceptance_snapshot",
        "order_requirement",
        "order_capacity_demand",
        "order_presentation_event",
        "durable_draft",
        "audit_event",
        "idempotency_key",
      ]) {
        const v = await f.reviewed(),
          d = await f.save(v),
          key = randomUUID(),
          baseline = await counts();
        const condition =
          target === "durable_draft"
            ? "NEW.lifecycle='promoted' AND NEW.workflow='order.quick'"
            : target === "audit_event"
              ? "NEW.action='draft.promote'"
              : target === "idempotency_key"
                ? `NEW.key='${key}'::uuid`
                : "true";
        await f.admin.query(
          `CREATE FUNCTION test_order_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'SYNTHETIC fault after actual write'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_order_fault AFTER ${target === "durable_draft" ? "UPDATE" : "INSERT"} ON ${target} FOR EACH ROW EXECUTE FUNCTION test_order_fault()`,
        );
        try {
          assert.equal((await f.promote(d, { key })).status, 503, target);
          assert.deepEqual(await counts(), baseline, target);
          assert.equal(
            (await f.ok(`drafts/${d.id}`, { method: "GET" })).lifecycle,
            "active",
          );
        } finally {
          await f.admin.query(
            `DROP TRIGGER test_order_fault ON ${target}; DROP FUNCTION test_order_fault()`,
          );
        }
        const r = await f.promote(d, { key });
        assert.equal(r.status, 200, await r.clone().text());
        const accepted = await r.json();
        assert.equal((await counts()).orders, baseline.orders + 1);
        await f.admin.query(
          "delete from idempotency_key where shop_id=$1 and key=$2",
          [f.a.shop, key],
        );
        assert.equal(
          (
            await f.promote(
              { id: d.id, draft: { version: accepted.draft.version } },
              { key: randomUUID() },
            )
          ).status,
          409,
        );
        assert.equal((await counts()).orders, baseline.orders + 1);
      }
    }),
);

test(
  "QO-05/08 concurrent exact promotion and presentation replay bind actor/action/hash without duplicate demand or history",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const d = await f.save(await f.reviewed()),
        key = randomUUID();
      const responses = await Promise.all([
        f.promote(d, { key }),
        f.promote(d, { key }),
      ]);
      assert(responses.every((r) => r.status === 200));
      const bodies = await Promise.all(responses.map((r) => r.json()));
      assert.deepEqual(bodies[0], bodies[1]);
      const id = bodies[0].draft.result.id,
        modeKey = randomUUID(),
        opts = { body: { mode: "detailed" }, etag: '"v1"', key: modeKey };
      const first = await f.ok(`orders/${id}/presentation`, opts);
      assert.deepEqual(await f.ok(`orders/${id}/presentation`, opts), first);
      assert.equal(
        (
          await f.request(`orders/${id}/presentation`, {
            ...opts,
            body: { mode: "simple" },
          })
        ).status,
        422,
      );
      assert.equal(
        (await f.request(`orders/${id}/presentation`, { ...opts, key })).status,
        422,
      );
      const rows = (
        await f.admin.query(
          "select (select count(*)::int from garment_order) orders,(select count(*)::int from order_capacity_demand) demand,(select count(*)::int from order_presentation_event) history",
        )
      ).rows[0];
      assert.deepEqual(rows, { orders: 1, demand: 1, history: 2 });
    }),
);

test(
  "QO-07 missing effort mapping and forged browser authority remain unresolved, old demand is never reinterpreted",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const d = await f.save(await f.reviewed());
      assert.equal((await f.promote(d)).status, 200);
      for (const injected of [
        { load: 0 },
        { approved: true },
        { nowTime: "00:00" },
        { quantity: 0 },
        { serverDate: "2020-01-01" },
      ])
        assert.equal(
          (
            await f.request("orders/review", {
              body: { ...f.value, ...injected },
            })
          ).status,
          422,
        );
      const rule = await f.config.publish("shop.commitments", {
        baseVersion: 1,
        baseRevisionId: f.config.ruleId,
        configuration: { ...f.config.configuration, unit: "effort-points" },
      });
      await f.config.publish("service.commitment-bindings", {
        categoryId: f.config.category.entryId,
        categoryRevisionId: f.config.category.definition.id,
        availabilityId: f.config.category.id,
        ruleRevisionId: rule,
        baseVersion: 1,
        baseRevisionId: f.config.bindingId,
        review: "reviewed",
        reason: "SYNTHETIC unresolved effort mapping",
      });
      const r = await f.review();
      assert(r.unknowns.includes("effortMappingMissing"));
      assert(r.unknowns.includes("incomparableDemand"));
      assert.equal(r.evaluation.facts.total, null);
      const v = {
          ...f.value,
          commitmentReview: {
            fingerprint: r.fingerprint,
            acknowledged: true,
            exceptionReason: "Cannot bypass missing mapping",
            waiveRush: false,
            waiverReason: "",
          },
        },
        saved = await f.save(v);
      assert.equal((await f.promote(saved)).status, 409);
    }),
);

async function waitForLock(f) {
  for (let i = 0; i < 100; i++) {
    const r = await f.admin.query(
      "select count(*)::int n from pg_stat_activity where datname=current_database() and usename='app_user' and wait_event='advisory'",
    );
    if (r.rows[0].n > 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail("Acceptance did not wait on publisher lock");
}
for (const source of [
  "service.catalogue",
  "service.templates",
  "shop.commitments",
  "service.commitment-bindings",
  "shop.calendar",
  "shop.policies",
])
  test(
    `QO-03/07/08 ${source} publisher race serializes current authority and prevents mixed acceptance snapshots`,
    { timeout: 180000 },
    async () =>
      fixture(async (f) => {
        const v = await f.reviewed(),
          d = await f.save(v),
          c = f.config.category;
        let payload;
        if (source === "service.catalogue")
          payload = {
            entryId: c.entryId,
            baseVersion: c.version,
            baseRevisionId: c.id,
            operation: "availability",
            available: false,
            reason: "SYNTHETIC race disable",
            content: c.definition.content,
          };
        if (source === "service.templates") {
          const t = f.seed.sources.before;
          payload = {
            entryId: t.entryId,
            baseVersion: t.version,
            baseRevisionId: t.id,
            operation: "availability",
            available: false,
            reason: "SYNTHETIC race disable",
            content: t.definition.content,
          };
        }
        if (source === "shop.commitments")
          payload = {
            baseVersion: 1,
            baseRevisionId: f.config.ruleId,
            configuration: { ...f.config.configuration, cap: 0 },
          };
        if (source === "service.commitment-bindings")
          payload = {
            categoryId: c.entryId,
            categoryRevisionId: c.definition.id,
            availabilityId: c.id,
            ruleRevisionId: f.config.ruleId,
            baseVersion: 1,
            baseRevisionId: f.config.bindingId,
            review: "pending",
            reason: "SYNTHETIC race withdraw review",
          };
        if (source === "shop.calendar") {
          const s = await f.ok("settings/calendar", { method: "GET" });
          payload = {
            baseVersion: s.version,
            baseRevisionId: s.revision.id,
            domain: "production",
            definition: {
              ...s.revision.calendar.production,
              week: s.revision.calendar.production.week.map((d, i) =>
                i === 0
                  ? {
                      state: "closed",
                      ranges: [],
                      breaks: { state: "none", ranges: [] },
                      slots: { state: "none", ranges: [] },
                    }
                  : d,
              ),
            },
          };
        }
        if (source === "shop.policies") {
          const s = await f.ok("settings/policies", { method: "GET" });
          payload = {
            baseVersion: s.version,
            baseRevisionId: s.revision.id,
            policy: {
              ...s.revision.policies[0],
              reason: "SYNTHETIC changed policy",
            },
          };
        }
        const pub = uuid7();
        await f.ok(`drafts/${pub}`, {
          method: "PUT",
          body: { workflow: source, schemaVersion: 1, payload },
        });
        let entered, release;
        const ready = new Promise((r) => (entered = r)),
          gate = new Promise((r) => (release = r));
        const publisher = f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
          f.a.shop,
          async (ctx) => {
            const adapter = ctx.workflows.get(source),
              workflows = new Map(ctx.workflows);
            workflows.set(source, {
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
        // Surface a publication validation failure instead of waiting for an unreachable barrier.
        await Promise.race([
          ready,
          publisher.then(() =>
            assert.fail("Publisher completed before barrier"),
          ),
        ]);
        const accepting = f.promote(d);
        try {
          await waitForLock(f);
        } finally {
          release();
        }
        await publisher;
        const r = await accepting;
        assert.equal(r.status, 409, await r.clone().text());
        assert.equal(
          (await f.ok("orders/list", { body: {} })).orders.length,
          0,
        );
      }),
  );

test(
  "QO-07/08 simultaneous first/last clear slot: stale review rejected, exception explicit, rule changes retain load",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const v = await f.reviewed(),
        a = await f.save(v),
        b = await f.save(v);
      const responses = await Promise.all([f.promote(a), f.promote(b)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      const loser = responses[0].status === 409 ? a : b;
      const next = await f.review(v);
      assert.equal(next.evaluation.facts.existing, 1);
      assert(next.evaluation.warnings.includes("capacityExceeded"));
      const missingReason = {
        ...v,
        commitmentReview: {
          ...v.commitmentReview,
          fingerprint: next.fingerprint,
          exceptionReason: "",
        },
      };
      const updated = await f.save(missingReason, loser.id, '"v1"');
      assert.equal((await f.promote(updated)).status, 422);
      const explicit = await f.save(
        {
          ...missingReason,
          commitmentReview: {
            ...missingReason.commitmentReview,
            exceptionReason: "SYNTHETIC extra slot approved",
          },
        },
        loser.id,
        '"v2"',
      );
      assert.equal((await f.promote(explicit)).status, 200);
      const rule = await f.config.publish("shop.commitments", {
        baseVersion: 1,
        baseRevisionId: f.config.ruleId,
        configuration: { ...f.config.configuration, cap: 2 },
      });
      await f.config.publish("service.commitment-bindings", {
        categoryId: f.config.category.entryId,
        categoryRevisionId: f.config.category.definition.id,
        availabilityId: f.config.category.id,
        ruleRevisionId: rule,
        baseVersion: 1,
        baseRevisionId: f.config.bindingId,
        review: "reviewed",
        reason: "SYNTHETIC cap revision",
      });
      const after = await f.review();
      assert.equal(after.evaluation.facts.existing, 2);
      assert.equal(after.evaluation.facts.total, 3);
    }),
);

for (const source of ["profile", "calendar", "policies"])
  test(
    `QO-07 missing ${source} is unknown and cannot be waived`,
    { timeout: 180000 },
    async () =>
      fixture(
        async (f) => {
          const review = await f.review();
          assert(review.unknowns.includes(`${source}Missing`));
          const d = await f.save({
            ...f.value,
            commitmentReview: {
              fingerprint: review.fingerprint,
              acknowledged: true,
              exceptionReason: "SYNTHETIC cannot bypass unknown",
              waiveRush: false,
              waiverReason: "",
            },
          });
          assert.equal((await f.promote(d)).status, 409);
        },
        {},
        { omit: [source] },
      ),
  );

test(
  "QO-02/07/08 minor guardian revocation races acceptance under the same wearer authority lock",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await f.ok(`customers/${f.value.customerId}`, {
        method: "GET",
      });
      const at = new Date().toISOString(),
        preferences = {
          language: "",
          channel: "",
          fit: "",
          style: "",
          delivery: "",
          source: "",
        };
      const w = await f.ok(`customers/${c.id}/wearers`, {
        body: {
          mode: "new",
          displayName: "SYNTHETIC child",
          age: "minor",
          preferences,
          relationship: {
            kind: "family",
            statementByPersonId: c.personId,
            authorised: true,
            informed: true,
            source: "in-person",
            occurredAt: at,
            interaction: "SYNTHETIC family intake",
          },
        },
      });
      const path = `customers/${c.id}/wearers/${w.wearerId}/guardians`;
      await f.ok(path, {
        etag: `"v${w.version}"`,
        body: {
          guardian: { mode: "new", displayName: "SYNTHETIC parent" },
          authority: "parent",
          scope: "measurement",
          source: "in-person",
          occurredAt: at,
        },
      });
      let g = await f.ok(path, { method: "GET" });
      const verification = {
        authorityId: g.authority.id,
        status: "confirmed",
        method: "synthetic-review-v1",
        evidenceRef: "SYNTHETIC fixture only",
        scope: "measurement",
        source: "in-person",
        occurredAt: at,
      };
      await f.ok(`${path}/verification-events`, {
        etag: `"v${g.version}"`,
        body: verification,
      });
      // UUID spelling cannot create a second advisory-lock identity.
      const value = { ...f.value, wearerId: w.wearerId.toUpperCase() },
        reviewed = await f.reviewed(value),
        d = await f.save(reviewed);
      g = await f.ok(path, { method: "GET" });
      let entered, release;
      const ready = new Promise((r) => (entered = r)),
        gate = new Promise((r) => (release = r));
      const revoking = f.owner.withOwnerGuardian(
        new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
        f.a.shop,
        async (ctx) => {
          const { mutateGuardian } = await import("@aarili/core/wearers");
          const repository = {
            ...ctx.repository,
            async verify(...args) {
              await ctx.repository.verify(...args);
              entered();
              await gate;
            },
          };
          return mutateGuardian(
            { ...ctx, repository },
            c.id,
            w.wearerId,
            "verify",
            { ...verification, status: "withdrawn" },
            {
              key: randomUUID(),
              requestId: randomUUID(),
              ifMatch: `"v${g.version}"`,
            },
          );
        },
      );
      await Promise.race([
        ready,
        revoking.then(() =>
          assert.fail("Revocation did not reach write barrier"),
        ),
      ]);
      const accepting = f.promote(d);
      try {
        await waitForLock(f);
      } finally {
        release();
      }
      await revoking;
      assert.equal((await accepting).status, 409);
      assert.equal((await f.ok("orders/list", { body: {} })).orders.length, 0);
    }),
);

test(
  "QO-07/10 current server acceptance date defeats historical cut-off backdating; rush waiver and zero-cap unknown are explicit",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const initial = await f.review(),
        today = initial.serverDate,
        yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000)
          .toISOString()
          .slice(0, 10);
      const cfg = {
        ...f.config.configuration,
        peaks: [
          {
            label: "SYNTHETIC peak",
            start: f.value.deliveryDate,
            end: f.value.deliveryDate,
            cutoffDate: yesterday,
            cutoffTime: "23:59",
          },
        ],
      };
      const rule = await f.config.publish("shop.commitments", {
        baseVersion: 1,
        baseRevisionId: f.config.ruleId,
        configuration: cfg,
      });
      const binding = await f.config.publish("service.commitment-bindings", {
        categoryId: f.config.category.entryId,
        categoryRevisionId: f.config.category.definition.id,
        availabilityId: f.config.category.id,
        ruleRevisionId: rule,
        baseVersion: 1,
        baseRevisionId: f.config.bindingId,
        review: "reviewed",
        reason: "SYNTHETIC peak review",
      });
      const v = {
        ...f.value,
        orderDate: yesterday,
        historicalReason: "SYNTHETIC historical intake",
        priceState: "to-be-quoted",
        priceText: "",
        priority: "rush",
      };
      const review = await f.review(v);
      assert(review.evaluation.warnings.includes("cutoffPassed"));
      assert(review.evaluation.facts.rush);
      assert.equal(review.intake.pricePaise, null);
      const decision = {
        fingerprint: review.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC current cut-off exception",
        waiveRush: true,
        waiverReason: "",
      };
      const d = await f.save({ ...v, commitmentReview: decision });
      assert.equal((await f.promote(d)).status, 422);
      const fixed = await f.save(
        {
          ...v,
          commitmentReview: {
            ...decision,
            waiverReason: "SYNTHETIC waiver recorded",
          },
        },
        d.id,
        '"v1"',
      );
      const response = await f.promote(fixed);
      assert.equal(response.status, 200, await response.clone().text());
      const accepted = await response.json(),
        order = await f.ok(`orders/${accepted.draft.result.id}/read`);
      assert.equal(order.intake.orderDate, yesterday);
      assert.equal(order.review.serverDate, today);
      assert.equal(order.pricePaise, null);
      assert.equal(order.snapshot.evaluation.facts.rushPaise, cfg.rushPaise);
      const zeroRule = await f.config.publish("shop.commitments", {
        baseVersion: 2,
        baseRevisionId: rule,
        configuration: { ...cfg, cap: 0, zeroCap: null },
      });
      await f.config.publish("service.commitment-bindings", {
        categoryId: f.config.category.entryId,
        categoryRevisionId: f.config.category.definition.id,
        availabilityId: f.config.category.id,
        ruleRevisionId: zeroRule,
        baseVersion: 2,
        baseRevisionId: binding,
        review: "reviewed",
        reason: "SYNTHETIC unresolved zero convention",
      });
      assert((await f.review()).unknowns.includes("zeroCapConventionMissing"));
    }),
);

test(
  "QO-03/04/09 populated 0029 upgrade preserves active intake and configuration; additive schema has no backfill",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const d = await f.save({
          ...f.value,
          deliveryDate: "",
          instructions: "SYNTHETIC unfinished intake",
        });
        const totals = async () =>
          (
            await f.admin.query(
              "select (select count(*)::int from durable_draft) drafts,(select count(*)::int from audit_event) audit,(select count(*)::int from idempotency_key) keys,(select count(*)::int from service_template_revision) templates",
            )
          ).rows[0];
        const before = await totals();
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(await totals(), before);
        const restored = await f.ok(`drafts/${d.id}`, { method: "GET" });
        assert.deepEqual(restored.payload, d.draft.payload);
        assert.equal(restored.lifecycle, "active");
        assert.deepEqual((await f.ok("orders/list", { body: {} })).orders, []);
        const ready = await f.save(await f.reviewed(), d.id, '"v1"');
        assert.equal((await f.promote(ready)).status, 200);
      },
      { migrationThrough: "0029_shop_presentation.sql" },
    ),
);

test(
  "QO-09 missing context, cross-shop relational links and frozen-order writes fail closed through app_user",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      for (const table of [
        "garment_order",
        "order_acceptance_snapshot",
        "order_requirement",
        "order_capacity_demand",
        "order_presentation_event",
      ])
        assert.equal(
          (
            await f.runtime.db.execute(
              sql.raw(`select count(*)::int n from ${table}`),
            )
          ).rows[0].n,
          0,
        );
      await assert.rejects(
        withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) => {
          const d = uuid7(),
            audit = randomUUID(),
            order = randomUUID(),
            now = new Date().toISOString(),
            key = randomUUID();
          await draftRepository(tx, f.b.shop).insert({
            id: d,
            workflow: "order.quick",
            schemaVersion: 1,
            payload: f.value,
            creatorId: f.b.user,
            lifecycle: "active",
            version: 1,
            createdAt: now,
            updatedAt: now,
            stale: false,
            result: null,
          });
          await tx.execute(
            sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${f.b.shop}::uuid,${audit}::uuid,'user',${f.b.user}::uuid,'order.accept','garment_order',${order}::uuid,${randomUUID()}::uuid,${key}::uuid,'{}'::jsonb)`,
          );
          await tx.execute(
            sql`insert into garment_order(shop_id,id,code_number,code,origin_draft_id,customer_id,wearer_id,owner_id,audit_id,presentation,price_state,price_paise) values(${f.b.shop}::uuid,${order}::uuid,1,'QO-000001',${d}::uuid,${f.value.customerId}::uuid,${f.value.wearerId}::uuid,${f.b.user}::uuid,${audit}::uuid,'simple','quoted',0)`,
          );
        }),
        (e) => e.cause?.code === "23503",
      );
      const d = await f.save(await f.reviewed()),
        p = await f.promote(d);
      assert.equal(p.status, 200);
      const accepted = await p.json(),
        id = accepted.draft.result.id;
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update garment_order set version=version+1,presentation='detailed' where shop_id=${f.a.shop}::uuid and id=${id}::uuid`,
          ),
        ),
        (e) => e.cause?.code === "23514",
      );
      for (const table of [
        "order_acceptance_snapshot",
        "order_requirement",
        "order_capacity_demand",
        "order_presentation_event",
      ])
        await assert.rejects(
          f.admin.query(`delete from ${table}`),
          (e) => e.code === "42501",
        );
    }),
);
