import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyGroupIntake, emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { materializeOrderPieces } from "@aarili/core/orders";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withHistoricalCustomReader } from "../scripts/test-support/historical-custom-reader.mjs";
import { seedHistoricalPieceOrder } from "../scripts/test-support/historical-pieces.mjs";
import { seedOrderAcceptance } from "../scripts/test-support/order-acceptance.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { seedServiceTemplates } from "../scripts/test-support/seed-service-templates.mjs";
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
 (select count(*)::int from order_piece_set) piece_sets,(select count(*)::int from order_piece) pieces,(select count(*)::int from order_requirement_scope) scopes,
 (select count(*)::int from order_presentation_event) history,(select count(*)::int from audit_event) audit,
 (select count(*)::int from idempotency_key) keys,(select count(*)::int from durable_draft where lifecycle='promoted') promoted`)
        ).rows[0];
      for (const target of [
        "garment_order",
        "order_acceptance_snapshot",
        "order_requirement",
        "order_capacity_demand",
        "order_presentation_event",
        "order_piece_set",
        "order_piece",
        "order_requirement_scope",
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
for (const intakeMode of ["quick", "group"])
  for (const source of [
    "service.catalogue",
    "service.templates",
    "shop.commitments",
    "service.commitment-bindings",
    "shop.calendar",
    "shop.policies",
  ])
    test(
      `${intakeMode === "group" ? "GB-C06" : "QO-03/07/08"} ${source} publisher race serializes current authority and prevents mixed acceptance snapshots`,
      { timeout: 180000 },
      async () =>
        fixture(async (f) => {
          const v = await f.reviewed(),
            d =
              intakeMode === "group"
                ? await saveNewGroup(f, newGroup(f))
                : await f.save(v),
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

async function acceptedFixture(f, value = f.value) {
  const d = await f.save(await f.reviewed(value));
  const r = await f.promote(d);
  assert.equal(r.status, 200, await r.clone().text());
  return f.ok(`orders/${(await r.json()).draft.result.id}/read`);
}
// Disposable synthetic downgrade of ONLY the new structural schema creates the
// exact existing v1 acceptance rows that a 0030 installation supplies. No accepted
// snapshot/demand/draft/audit is edited. Then run the real migration runner.
async function legacyFixture(f) {
  const o = await acceptedFixture(f);
  // This disposable structural downgrade predates the empty service/design FKs.
  // Capture and restore those exact FKs (including repeat selections) and the current piece guard around the
  // real 0031 migration; do not cascade away later history or weaken runtime.
  assert.equal(
    (
      await f.admin.query(
        "select (select count(*) from service_property_subject)+(select count(*) from order_service_change_line)+(select count(*) from service_repeat_selection)+(select count(*) from design_spec_scope)+(select count(*) from design_spec_draft_value)+(select count(*) from design_media_order_subject)+(select count(*) from measurement_selection)+(select count(*) from measurement_draft_value) as n",
      )
    ).rows[0].n,
    "0",
  );
  const references = (
    await f.admin.query(
      "select conrelid::regclass::text relation,conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid in('service_property_subject'::regclass,'order_service_change_line'::regclass,'service_repeat_selection'::regclass,'design_spec_scope'::regclass,'design_spec_draft_value'::regclass,'design_media_order_subject'::regclass,'measurement_selection'::regclass,'measurement_draft_value'::regclass) and confrelid='order_piece'::regclass order by conrelid,conname",
    )
  ).rows;
  assert.equal(references.length, 8);
  for (const reference of references) {
    assert(
      [
        "service_property_subject",
        "order_service_change_line",
        "service_repeat_selection",
        "design_spec_scope",
        "design_spec_draft_value",
        "design_media_order_subject",
        "measurement_selection",
        "measurement_draft_value",
      ].includes(reference.relation),
    );
    assert.match(reference.conname, /^[a-z_][a-z0-9_]*$/);
  }
  const currentGuard = (
    await f.admin.query(
      "select pg_get_functiondef('order_piece_commit_guard()'::regprocedure) definition",
    )
  ).rows[0].definition;
  for (const reference of references)
    await f.admin.query(
      `ALTER TABLE ${reference.relation} DROP CONSTRAINT ${reference.conname}`,
    );
  await f.admin.query(`DROP TRIGGER order_piece_acceptance_commit ON garment_order;
    DROP TABLE order_requirement_scope,order_piece,order_piece_set;
    DROP FUNCTION order_piece_commit_guard(),order_piece_child_guard(),order_piece_set_guard();
    DELETE FROM aarili_migration WHERE name='0031_outfit_pieces.sql'`);
  const before = (
    await f.admin.query("select count(*)::int n from audit_event")
  ).rows[0].n;
  await migrateDatabase(f.migrationConnectionString);
  await f.admin.query(currentGuard);
  for (const reference of references)
    await f.admin.query(
      `ALTER TABLE ${reference.relation} ADD CONSTRAINT ${reference.conname} ${reference.definition}`,
    );
  for (const reference of references)
    assert.equal(
      (
        await f.admin.query(
          "select pg_get_constraintdef(oid) definition from pg_constraint where conrelid=$1::regclass and conname=$2",
          [reference.relation, reference.conname],
        )
      ).rows[0].definition,
      reference.definition,
    );
  assert.equal(
    (
      await f.admin.query(
        "select pg_get_functiondef('order_piece_commit_guard()'::regprocedure) definition",
      )
    ).rows[0].definition,
    currentGuard,
  );
  assert.equal(
    (await f.admin.query("select count(*)::int n from audit_event")).rows[0].n,
    before,
  );
  assert.deepEqual(await f.ok(`orders/${o.id}/read`), o);
  return o;
}

test(
  "GB-05/06 minor guardian withdrawal serializes with historical materialisation and denies read/exact replay afterwards",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
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
        let g = await f.ok(path, { method: "GET" });
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
        const o = await acceptedFixture(f, {
          ...f.value,
          wearerId: w.wearerId,
        });
        await seedHistoricalPieceOrder(f.admin, o.id);
        g = await f.ok(path, { method: "GET" });
        const key = randomUUID(),
          body = {
            snapshotDigest: o.snapshotDigest,
            reason: "SYNTHETIC parent-authorised historical structure",
          };
        let entered, release;
        const ready = new Promise((r) => {
            entered = r;
          }),
          gate = new Promise((r) => {
            release = r;
          });
        const preparing = f.owner.withOwnerQuickOrder(
          new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
          f.a.shop,
          async (ctx) => {
            const original = ctx.acceptance.repository.pieces;
            const pieces = {
              ...original,
              async write(...args) {
                await original.write(...args);
                entered();
                await gate;
              },
            };
            return materializeOrderPieces(
              {
                ...ctx,
                acceptance: {
                  ...ctx.acceptance,
                  repository: { ...ctx.acceptance.repository, pieces },
                },
              },
              o.id,
              body,
              { key, ifMatch: '"v1"', requestId: randomUUID() },
            );
          },
        );
        await Promise.race([
          ready,
          preparing.then(() => assert.fail("Missing piece write barrier")),
        ]);
        const withdrawal = f.request(`${path}/verification-events`, {
          etag: `"v${g.version}"`,
          body: { ...verification, status: "withdrawn" },
        });
        try {
          await waitForLock(f);
        } finally {
          release();
        }
        assert.equal((await preparing).data.state, "materialized");
        assert.equal((await withdrawal).status, 200);
        assert.equal(
          (await f.request(`orders/${o.id}/pieces/read`)).status,
          404,
        );
        assert.equal(
          (
            await f.request(`orders/${o.id}/pieces/materialize`, {
              key,
              etag: '"v1"',
              body,
            })
          ).status,
          404,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int n from order_piece_set"))
            .rows[0].n,
          1,
        );
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-02/04/05/08/10 accept and reopen three exact outfit pieces, scoped unresolved work, immutable source history and forced isolation",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const o = await acceptedFixture(f),
          path = `orders/${o.id}/pieces/read`,
          p = await f.ok(path);
        assert.equal(p.state, "materialized");
        assert.equal(p.execution, "unavailable");
        assert.equal(p.identities.length, 3);
        assert.equal(new Set(p.identities.map((i) => i.id)).size, 3);
        assert.deepEqual(
          p.structure.pieces.map((p) => p.key),
          ["top", "bottom", "dupatta"],
        );
        const bottom = p.structure.requirements.filter(
          (r) => r.pieceKey === "bottom",
        );
        assert(
          bottom.some((r) => o.requirements.items[r.position].key === "stitch"),
        );
        assert(
          bottom.some(
            (r) => o.requirements.items[r.position].section === "measurement",
          ),
        );
        assert(
          bottom.every(
            (r) => o.requirements.items[r.position].state === "unresolved",
          ),
        );
        assert.equal((await f.request(path, { who: f.b })).status, 404);
        for (const table of [
          "order_piece_set",
          "order_piece",
          "order_requirement_scope",
        ]) {
          assert.equal(
            (
              await f.runtime.db.execute(
                sql.raw(`select count(*)::int n from ${table}`),
              )
            ).rows[0].n,
            0,
          );
          assert.equal(
            await withShop(
              f.runtime.db,
              f.b.user,
              f.b.shop,
              async (tx) =>
                (
                  await tx.execute(
                    sql.raw(`select count(*)::int n from ${table}`),
                  )
                ).rows[0].n,
            ),
            0,
          );
          await assert.rejects(
            withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
              tx.execute(sql.raw(`delete from ${table}`)),
            ),
            (e) => e.cause?.code === "42501",
          );
          await assert.rejects(
            f.admin.query(`update ${table} set shop_id=shop_id`),
            (e) => e.code === "42501",
          );
        }
        await assertIsolationCatalog(f.runtime.db);
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from order_capacity_demand",
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int n from journal_batch"))
            .rows[0].n,
          0,
        );
        const piece = f.seed.sources.piece;
        await f.seed.sources.command("service.catalogue", {
          entryId: piece.entryId,
          baseVersion: piece.version,
          baseRevisionId: piece.id,
          operation: "definition",
          available: true,
          reason: "SYNTHETIC new wording",
          content: {
            ...piece.definition.content,
            labelEn: "CHANGED CURRENT LABEL",
          },
        });
        assert.deepEqual(await f.ok(path), p);
        const mode = await f.ok(`orders/${o.id}/presentation`, {
          body: { mode: "detailed" },
          etag: '"v1"',
        });
        assert.deepEqual(mode.requirements, o.requirements);
        const after = await f.ok(path);
        assert.deepEqual(after.structure, p.structure);
        assert.deepEqual(after.identities, p.identities);
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-06/08 populated v1 upgrade has no backfill; explicit legacy materialisation races/replays once with stale and changed-request protection",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const o = await legacyFixture(f),
          path = `orders/${o.id}/pieces/materialize`,
          before = await f.ok(`orders/${o.id}/pieces/read`);
        assert.equal(before.state, "historical-preview");
        assert.deepEqual(before.identities, []);
        const body = {
          snapshotDigest: o.snapshotDigest,
          reason: "SYNTHETIC reviewed historic structure",
        };
        assert.equal((await f.request(path, { body })).status, 428);
        assert.equal(
          (await f.request(path, { body, etag: '"v1"', who: f.b })).status,
          404,
        );
        await f.ok(`orders/${o.id}/presentation`, {
          body: { mode: "detailed" },
          etag: '"v1"',
        });
        assert.equal(
          (await f.request(path, { body, etag: '"v1"' })).status,
          412,
        );
        assert.equal(
          (
            await f.request(path, {
              body: { ...body, snapshotDigest: "0".repeat(64) },
              etag: '"v2"',
            })
          ).status,
          409,
        );
        const key = randomUUID(),
          options = { body, etag: '"v2"', key };
        const results = await Promise.all([
          f.request(path, options),
          f.request(path, options),
        ]);
        assert.deepEqual(
          results.map((r) => r.status),
          [200, 200],
        );
        const [a, b] = await Promise.all(results.map((r) => r.json()));
        assert.deepEqual(a, b);
        assert.equal(a.state, "materialized");
        assert.equal(a.provenance.version, 1);
        assert.equal(
          (
            await f.request(path, {
              ...options,
              body: { ...body, reason: "changed" },
            })
          ).status,
          422,
        );
        assert.equal(
          (await f.request(path, { ...options, key: randomUUID() })).status,
          409,
        );
        await f.admin.query(
          "delete from idempotency_key where shop_id=$1 and key=$2",
          [f.a.shop, key],
        );
        assert.equal(
          (await f.request(path, { ...options, key: randomUUID() })).status,
          409,
        );
        const after = await f.ok(`orders/${o.id}/read`);
        assert.equal(after.snapshotDigest, o.snapshotDigest);
        assert.deepEqual(after.originalPromise, o.originalPromise);
        assert.deepEqual(
          (
            await f.admin.query(
              "select (select count(*)::int from order_piece_set) sets,(select count(*)::int from order_capacity_demand) demand,(select count(*)::int from audit_event where action='order.pieces.materialize') audit",
            )
          ).rows[0],
          { sets: 1, demand: 1, audit: 1 },
        );
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-05/06 actual-write failures roll back legacy piece set, identities, scoped links, audit and request result before exact retry",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const o = await legacyFixture(f),
          path = `orders/${o.id}/pieces/materialize`,
          key = randomUUID(),
          options = {
            body: {
              snapshotDigest: o.snapshotDigest,
              reason: "SYNTHETIC recovery",
            },
            etag: '"v1"',
            key,
          };
        const counts = async () =>
          (
            await f.admin.query(
              "select (select count(*)::int from order_piece_set) sets,(select count(*)::int from order_piece) pieces,(select count(*)::int from order_requirement_scope) scopes,(select count(*)::int from audit_event) audit,(select count(*)::int from idempotency_key) keys",
            )
          ).rows[0];
        const baseline = await counts();
        for (const target of [
          "audit_event",
          "order_piece_set",
          "order_piece",
          "order_requirement_scope",
          "idempotency_key",
        ]) {
          await f.admin.query(
            `CREATE FUNCTION test_piece_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC after actual piece write'; END $$; CREATE TRIGGER test_piece_fault AFTER INSERT ON ${target} FOR EACH ROW EXECUTE FUNCTION test_piece_fault()`,
          );
          try {
            assert.equal((await f.request(path, options)).status, 503, target);
            assert.deepEqual(await counts(), baseline, target);
          } finally {
            await f.admin.query(
              `DROP TRIGGER test_piece_fault ON ${target};DROP FUNCTION test_piece_fault()`,
            );
          }
        }
        const result = await f.ok(path, options);
        assert.equal(result.identities.length, 3);
        assert.deepEqual(await f.ok(path, options), result);
        const scope = (
          await f.admin.query(
            "select * from order_requirement_scope where piece_id is not null limit 1",
          )
        ).rows[0];
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`insert into order_requirement_scope(shop_id,order_id,position,piece_key,piece_id) values(${f.b.shop}::uuid,${o.id}::uuid,${scope.position},${scope.piece_key},${scope.piece_id}::uuid)`,
            ),
          ),
          (e) => ["42501", "23514", "23503"].includes(e.cause?.code),
        );
        // Isolate the composite FK from the earlier immutable-structure guard, only in this disposable admin fixture.
        const other = await acceptedFixture(f);
        const otherPiece = (await f.ok(`orders/${other.id}/pieces/read`))
          .identities[0].id;
        await f.admin.query(
          "alter table order_requirement_scope disable trigger order_requirement_scope_immutable",
        );
        try {
          await assert.rejects(
            f.admin.query(
              "update order_requirement_scope set piece_id=$4 where shop_id=$1 and order_id=$2 and position=$3",
              [f.a.shop, o.id, scope.position, otherPiece],
            ),
            (e) => e.code === "23503" && e.constraint.includes("piece"),
          );
        } finally {
          await f.admin.query(
            "alter table order_requirement_scope enable trigger order_requirement_scope_immutable",
          );
        }
      },
      {},
      { outfit: true },
    ),
);

async function acceptedForBooking(f, overrides = {}) {
  const d = await f.save(await f.reviewed({ ...f.value, ...overrides }));
  const response = await f.promote(d);
  assert.equal(response.status, 200, await response.clone().text());
  return f.ok(`orders/${(await response.json()).draft.result.id}/read`);
}
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
test(
  "GB-C07/09 bounded Tamil grouped drafts remain reviewable across UTF-8 transport",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const input = newGroup(f);
      input.lines = Array.from({ length: 20 }, () => ({
        id: uuid7(),
        intake: { ...f.value, instructions: "க".repeat(1700) },
      }));
      assert.ok(JSON.stringify(input).length < 65536);
      assert.ok(Buffer.byteLength(JSON.stringify(input)) > 65536);
      const saved = await saveNewGroup(f, input);
      assert.equal(saved.draft.lifecycle, "active");
      const oversized = structuredClone(input);
      for (const line of oversized.lines) {
        line.intake.instructions = "க".repeat(2000);
        line.intake.historicalReason = "x".repeat(1000);
      }
      assert.ok(JSON.stringify(oversized).length > 65536);
      assert.equal(
        (await f.request("orders/bookings/intake-review", { body: oversized }))
          .status,
        422,
      );
      assert.equal(
        (
          await f.request(`drafts/${uuid7()}`, {
            method: "PUT",
            body: {
              workflow: "order.group",
              schemaVersion: 1,
              payload: oversized,
            },
          })
        ).status,
        422,
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        0,
      );
    }),
);
test(
  "GB-C01/03/04/08 atomic group intake preserves exact garments and included proposal amounts",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        for (const basis of ["garment-prices", "package-proposal"]) {
          const input = newGroup(f, {
              commercial: {
                basis,
                packagePriceState: "quoted",
                packagePriceText: " 2,000.25 ",
              },
            }),
            d = await saveNewGroup(f, input),
            key = randomUUID();
          const response = await f.promote(d, { key });
          if (response.status === 503)
            await f.owner.withOwnerDraft(
              new Headers({ Cookie: f.a.cookie }),
              f.a.shop,
              (ctx) =>
                mutateDraft(
                  ctx,
                  d.id,
                  "promote",
                  {},
                  {
                    key,
                    ifMatch: `"v${d.draft.version}"`,
                    requestId: randomUUID(),
                  },
                ),
            );
          assert.equal(response.status, 200, await response.clone().text());
          const result = await response.json();
          assert.deepEqual(await (await f.promote(d, { key })).json(), result);
          const detail = await f.ok("orders/bookings/read", {
            body: { id: result.draft.result.id, revision: true },
          });
          assert.equal(detail.orders.length, 2);
          assert.equal(detail.commercial.scope.length, 2);
          assert.equal(detail.commercial.allocation, "unresolved");
          const sourceIds = new Set(detail.orders.map((o) => o.id));
          assert.equal(sourceIds.size, 2);
          assert.deepEqual(
            detail.commercial.scope.map((s) => s.lineId),
            input.lines.map((l) => l.id),
          );
          for (const o of detail.orders) {
            assert.ok(o.wearer.label);
            assert.ok(
              o.requirements.items.some((i) => i.state === "unresolved"),
            );
            assert.equal(
              (await f.ok(`orders/${o.id}/pieces/read`, { body: {} })).state,
              "materialized",
            );
          }
          if (basis === "package-proposal") {
            assert.deepEqual(detail.summary, {
              basis,
              packagePaise: "200025",
              allocation: "unresolved",
            });
            assert.ok(
              detail.orders.every(
                (o) =>
                  o.pricePaise === null &&
                  o.commercial.allocationPaise === null,
              ),
            );
            assert.equal(
              detail.orders.find((o) => o.commercial.referencePaise !== null)
                .commercial.referencePaise,
              120000,
            );
          } else
            assert.deepEqual(detail.summary, {
              basis,
              knownSubtotalPaise: "120000",
              unknownCount: 1,
            });
          assert.equal((await f.promote(d, { key: randomUUID() })).status, 412);
          assert.equal(
            (
              await f.request("orders/bookings/read", {
                body: { id: detail.booking.id },
                who: f.b,
              })
            ).status,
            404,
          );
        }
        const counts = (
          await f.admin.query(
            "select (select count(*) from garment_order)::int orders,(select count(*) from order_capacity_demand)::int demand,(select count(*) from journal_batch)::int money",
          )
        ).rows[0];
        assert.deepEqual(counts, { orders: 4, demand: 4, money: 0 });
        await assertIsolationCatalog(f.runtime.db);
      },
      {},
      { outfit: true },
    ),
);
test(
  "GB-C07 exact one-time Quick Order draft conversion preserves incomplete input",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const original = {
          ...f.value,
          wearerId: null,
          deliveryDate: "",
          instructions: "SYNTHETIC unsized draft",
          commitmentReview: null,
        },
        d = await f.save(original),
        key = randomUUID();
      const convert = (options = {}) =>
        f.request(`drafts/${d.id}/convert`, {
          body: {},
          etag: '"v1"',
          key,
          ...options,
        });
      const results = await Promise.all([convert(), convert()]);
      for (const r of results)
        assert.equal(r.status, 200, await r.clone().text());
      const first = await results[0].json();
      assert.deepEqual(await results[1].json(), first);
      const target = await f.ok(`drafts/${first.draft.result.id}`, {
        method: "GET",
      });
      assert.equal(target.workflow, "order.group");
      assert.deepEqual(target.payload.lines[0].intake, original);
      assert.equal(target.lifecycle, "active");
      assert.equal((await f.promote(d)).status, 412);
      await f.admin.query("delete from idempotency_key where key=$1", [key]);
      assert.equal((await convert()).status, 412);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from order_draft_conversion",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        0,
      );
    }),
);
async function groupingDraft(f, orders, overrides = {}) {
  const input = {
    customerId: orders[0]?.intake.customerId ?? f.value.customerId,
    target: null,
    context: {
      occasion: "bridal",
      eventDate: "2026-12-01",
      notes: "SYNTHETIC family visit",
      payerId: null,
    },
    orders: orders.map((o) => ({
      id: o.id,
      version: o.version,
      snapshotDigest: o.snapshotDigest,
    })),
    reason: "SYNTHETIC group existing garments",
    reviewFingerprint: null,
    ...overrides,
  };
  const review = await f.ok("orders/bookings/review", { body: input });
  input.reviewFingerprint = review.fingerprint;
  const id = uuid7();
  return {
    id,
    ...(await f.ok(`drafts/${id}`, {
      method: "PUT",
      body: { workflow: "booking.group", schemaVersion: 1, payload: input },
    })),
  };
}
test(
  "GB-C05 adult service withdrawal denies saved group and exact accepted-result replay",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const d = await saveNewGroup(f, newGroup(f)),
        key = randomUUID(),
        r = await f.promote(d, { key });
      assert.equal(r.status, 200, await r.clone().text());
      const result = await r.json();
      const c = await f.ok(`customers/${f.value.customerId}`, {
          method: "GET",
        }),
        w = await f.ok(`customers/${c.id}/wearers/${f.value.wearerId}`, {
          method: "GET",
        });
      await f.ok(`customers/${c.id}/wearers/${w.id}/consent-events`, {
        etag: `"v${w.version}"`,
        body: {
          purpose: "service",
          decision: "withdrawal",
          noticeId: syntheticWearerPolicy.notice.id,
          noticeExplained: true,
          language: "en",
          giverPersonId: w.personId,
          source: "in-person",
          occurredAt: new Date().toISOString(),
        },
      });
      assert.equal((await f.promote(d, { key })).status, 404);
      assert.equal(
        (await f.request(`drafts/${d.id}`, { method: "GET" })).status,
        404,
      );
      assert.equal(
        (
          await f.request("orders/bookings/read", {
            body: { id: result.draft.result.id, revision: true },
          })
        ).status,
        404,
      );
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
  "GB-C03/06 unknown effort, forged authority and invalid proposal/reference amounts fail closed",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      await acceptedForBooking(f);
      const ruleId = await f.config.publish("shop.commitments", {
        baseVersion: 1,
        baseRevisionId: f.config.ruleId,
        configuration: { ...f.config.configuration, unit: "effort-points" },
      });
      await f.config.publish("service.commitment-bindings", {
        categoryId: f.config.category.entryId,
        categoryRevisionId: f.config.category.definition.id,
        availabilityId: f.config.category.id,
        ruleRevisionId: ruleId,
        baseVersion: 1,
        baseRevisionId: f.config.bindingId,
        review: "reviewed",
        reason: "SYNTHETIC unresolved effort",
      });
      const input = newGroup(f),
        review = await f.ok("orders/bookings/intake-review", { body: input });
      assert.ok(
        review.lines.every((l) =>
          l.review.unknowns.includes("effortMappingMissing"),
        ),
      );
      assert.ok(review.lines[0].review.unknowns.includes("incomparableDemand"));
      assert.equal((await f.promote(await saveNewGroup(f, input))).status, 409);
      for (const forged of [
        { load: 0 },
        { approved: true },
        { nowTime: "00:00" },
        { quantity: 0 },
      ])
        assert.equal(
          (
            await f.request("orders/bookings/intake-review", {
              body: { ...input, ...forged },
            })
          ).status,
          422,
        );
      for (const amount of ["bad", "9007199254740992.00", "-1.00"]) {
        const invalid = {
          ...input,
          commercial: {
            basis: "package-proposal",
            packagePriceState: "quoted",
            packagePriceText: amount,
          },
        };
        assert.equal(
          (await f.promote(await saveNewGroup(f, invalid))).status,
          422,
        );
      }
      const reference = {
        ...input,
        commercial: {
          basis: "package-proposal",
          packagePriceState: "quoted",
          packagePriceText: "0",
        },
        lines: input.lines.map((l, i) =>
          i ? l : { ...l, intake: { ...l.intake, priceText: "invalid" } },
        ),
      };
      assert.equal(
        (await f.promote(await saveNewGroup(f, reference))).status,
        422,
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        1,
      );
    }),
);

test(
  "GB-C07 actual conversion write faults and competing keys preserve one active target",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const d = await f.save(),
        key = randomUUID(),
        convert = (source = d, k = key) =>
          f.request(`drafts/${source.id}/convert`, {
            body: {},
            etag: '"v1"',
            key: k,
          });
      const count = async () => ({
        rows: (
          await f.admin.query(
            "select (select count(*) from order_draft_conversion)::int links,(select count(*) from durable_draft)::int drafts,(select count(*) from audit_event)::int audit,(select count(*) from idempotency_key)::int keys",
          )
        ).rows[0],
        source: await f.ok(`drafts/${d.id}`, { method: "GET" }),
      });
      const before = await count();
      for (const [table, operation, condition] of [
        ["durable_draft", "INSERT", "NEW.workflow='order.group'"],
        ["audit_event", "INSERT", "NEW.action='draft.convert.target'"],
        ["order_draft_conversion", "INSERT", "true"],
        ["durable_draft", "UPDATE", "NEW.result_type='order.group-draft'"],
        ["audit_event", "INSERT", "NEW.action='draft.convert'"],
        ["idempotency_key", "INSERT", `NEW.key='${key}'::uuid`],
      ]) {
        await f.admin.query(
          `CREATE FUNCTION test_conversion_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'SYNTHETIC after conversion write';END IF;RETURN NEW;END $$;CREATE TRIGGER test_conversion_fault AFTER ${operation} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_conversion_fault()`,
        );
        try {
          assert.equal((await convert()).status, 503);
          assert.deepEqual(await count(), before);
        } finally {
          await f.admin.query(
            `DROP TRIGGER test_conversion_fault ON ${table};DROP FUNCTION test_conversion_fault()`,
          );
        }
      }
      assert.equal((await convert()).status, 200);
      const second = await f.save();
      const raced = await Promise.all([
        convert(second, randomUUID()),
        convert(second, randomUUID()),
      ]);
      assert.deepEqual(raced.map((r) => r.status).sort(), [200, 412]);
      assert.equal((await count()).rows.links, 2);
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        0,
      );
    }),
);

test(
  "GB-C04/06 actual writes roll back every order, piece, demand, group, commercial proposal and command",
  { timeout: 240000 },
  async () =>
    fixture(
      async (f) => {
        const input = newGroup(f, {
            commercial: {
              basis: "package-proposal",
              packagePriceState: "quoted",
              packagePriceText: "0",
            },
          }),
          d = await saveNewGroup(f, input),
          key = randomUUID();
        const tables = [
          "garment_order",
          "order_acceptance_snapshot",
          "order_requirement",
          "order_piece_set",
          "order_piece",
          "order_requirement_scope",
          "order_capacity_demand",
          "order_presentation_event",
          "booking",
          "booking_revision",
          "booking_member",
          "booking_membership_history",
          "booking_commercial_revision",
          "audit_event",
          "durable_draft",
          "idempotency_key",
        ];
        const counts = async () => {
          const result = {};
          for (const table of [...tables, "journal_batch", "pgboss.job"])
            result[table] = (
              await f.admin.query(`select count(*)::int n from ${table}`)
            ).rows[0].n;
          result.draft = await f.ok(`drafts/${d.id}`, { method: "GET" });
          return result;
        };
        const before = await counts();
        for (const table of tables) {
          const condition =
            table === "durable_draft"
              ? "NEW.lifecycle='promoted' AND NEW.workflow='order.group'"
              : table === "audit_event"
                ? "NEW.action='draft.promote'"
                : table === "idempotency_key"
                  ? `NEW.key='${key}'::uuid`
                  : table.startsWith("order_") || table === "garment_order"
                    ? `(SELECT count(*) FROM ${table})>=2`
                    : "true";
          await f.admin.query(
            `CREATE FUNCTION test_group_intake_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'SYNTHETIC actual group write fault';END IF;RETURN NEW;END $$;CREATE TRIGGER test_group_intake_fault AFTER ${table === "durable_draft" ? "UPDATE" : "INSERT"} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_group_intake_fault()`,
          );
          try {
            assert.equal((await f.promote(d, { key })).status, 503, table);
            assert.deepEqual(await counts(), before, table);
          } finally {
            await f.admin.query(
              `DROP TRIGGER test_group_intake_fault ON ${table};DROP FUNCTION test_group_intake_fault()`,
            );
          }
        }
        const result = await f.promote(d, { key });
        assert.equal(result.status, 200, await result.clone().text());
        const after = await counts();
        assert.equal(after.garment_order, 2);
        assert.equal(after.order_capacity_demand, 2);
        assert.equal(after.journal_batch, 0);
        assert.equal(after["pgboss.job"], 0);
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-C04/06 cumulative last-slot and single-versus-group races reject stale whole-set reviews",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const input = newGroup(f);
      input.lines[1].intake.deliveryDate = input.lines[0].intake.deliveryDate;
      const review = await f.ok("orders/bookings/intake-review", {
        body: input,
      });
      assert.equal(review.lines[0].review.evaluation.facts.existing, 0);
      assert.equal(review.lines[1].review.evaluation.facts.existing, 1);
      assert.ok(
        review.lines[1].review.evaluation.warnings.includes("capacityExceeded"),
      );
      const refused = await saveNewGroup(f, input);
      const blocked = await f.ok(`drafts/${refused.id}`, {
        method: "PUT",
        etag: '"v1"',
        body: {
          workflow: "order.group",
          schemaVersion: 1,
          payload: {
            ...refused.draft.payload,
            review: { ...refused.draft.payload.review, exceptionReason: "" },
          },
        },
      });
      assert.equal(
        (await f.promote({ id: refused.id, draft: blocked.draft })).status,
        422,
      );
      assert.equal((await f.ok("orders/list", { body: {} })).orders.length, 0);
      const a = await saveNewGroup(f, input),
        b = await saveNewGroup(f, {
          ...input,
          lines: [...input.lines].reverse(),
        });
      const raced = await Promise.all([f.promote(a), f.promote(b)]);
      assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
      const next = newGroup(f),
        g = await saveNewGroup(f, next),
        single = await f.save(await f.reviewed());
      const mixed = await Promise.all([f.promote(g), f.promote(single)]);
      assert.deepEqual(mixed.map((r) => r.status).sort(), [200, 409]);
      const rows = (
        await f.admin.query("select count(*)::int n from garment_order")
      ).rows[0].n;
      assert.ok([3, 4].includes(rows));
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from order_capacity_demand",
          )
        ).rows[0].n,
        rows,
      );
      assert.equal((await f.promote(g, { etag: undefined })).status, 428);
      assert.equal(
        (
          await f.request(`drafts/${g.id}/promote`, {
            body: { unexpected: true },
            etag: '"v1"',
          })
        ).status,
        422,
      );
    }),
);

test(
  "GB-C04/06 different category and week locks use stable complete-set ordering",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const extra = await seedServiceTemplates(f.runtime.pool, f.a.shop, {
          templatePrefix: "group-second-",
        });
        try {
          const category = (
            await f.ok(
              `settings/catalogue/entries/${extra.service.definition.content.parent.entryId}`,
              { method: "GET" },
            )
          ).revision;
          await f.config.publish("service.commitment-bindings", {
            categoryId: category.entryId,
            categoryRevisionId: category.definition.id,
            availabilityId: category.id,
            ruleRevisionId: f.config.ruleId,
            baseVersion: 0,
            baseRevisionId: null,
            review: "reviewed",
            reason: "SYNTHETIC category group",
          });
          const input = newGroup(f);
          input.lines[1].intake.manifest = {
            entryId: extra.before.entryId,
            revisionId: extra.before.id,
            definitionId: extra.before.definition.id,
          };
          const a = await saveNewGroup(f, input),
            b = await saveNewGroup(f, {
              ...input,
              lines: [...input.lines].reverse(),
            });
          const raced = await Promise.all([f.promote(a), f.promote(b)]);
          assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
          const weeks = newGroup(f);
          weeks.lines[1].intake.deliveryDate = new Date(
            Date.parse(weeks.lines[0].intake.deliveryDate) + 7 * 86400000,
          )
            .toISOString()
            .slice(0, 10);
          const review = await f.ok("orders/bookings/intake-review", {
            body: weeks,
          });
          assert.notEqual(
            review.lines[0].review.evaluation.facts.weekStart,
            review.lines[1].review.evaluation.facts.weekStart,
          );
          assert.equal(review.lines[1].review.evaluation.facts.existing, 0);
          const counts = (
            await f.admin.query(
              "select category_id,count(*)::int n from order_capacity_demand group by category_id",
            )
          ).rows;
          assert.equal(counts.length, 2);
          assert.ok(counts.every((r) => r.n === 1));
        } finally {
          await extra.close();
        }
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-C05/08 populated A/B upgrade preserves snapshots and enforces immutable commercial/conversion isolation",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const before = await withHistoricalCustomReader(f.admin, async () => {
          const a = await acceptedForBooking(f),
            b = await acceptedForBooking(f),
            old = await groupingDraft(f, [a, b]);
          assert.equal((await f.promote(old)).status, 200);
          return (
            await f.admin.query(
              "select order_id,content,digest from order_acceptance_snapshot order by order_id",
            )
          ).rows;
        });
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(
          (
            await f.admin.query(
              "select order_id,content,digest from order_acceptance_snapshot order by order_id",
            )
          ).rows,
          before,
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from booking_commercial_revision",
            )
          ).rows[0].n,
          0,
        );
        const input = newGroup(f),
          d = await saveNewGroup(f, input);
        assert.equal((await f.promote(d)).status, 200);
        const quick = await f.save();
        const converted = await f.ok(`drafts/${quick.id}/convert`, {
          body: {},
          etag: '"v1"',
        });
        assert.equal(converted.draft.result.type, "order.group-draft");
        for (const table of [
          "booking_commercial_revision",
          "order_draft_conversion",
        ]) {
          await f.runtime.db.transaction(async (tx) => {
            assert.equal(
              (await tx.execute(sql.raw(`select * from ${table}`))).rows.length,
              0,
            );
          });
          await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) => {
            assert.equal(
              (await tx.execute(sql.raw(`select * from ${table}`))).rows.length,
              0,
            );
          });
          await assert.rejects(
            withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
              tx.execute(sql.raw(`delete from ${table}`)),
            ),
            (e) => e.code === "42501" || e.cause?.code === "42501",
          );
        }
        await assertIsolationCatalog(f.runtime.db);
      },
      { migrationThrough: "0032_accepted_booking_groups.sql" },
      { outfit: true },
    ),
);
test(
  "GB-B01/03/04/08 accepted garments group atomically with exact prices and independent immutable snapshots",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const a = await acceptedForBooking(f, { priceText: "1200" }),
          b = await acceptedForBooking(f, {
            priceState: "to-be-quoted",
            priceText: "",
            deliveryDate: new Date(Date.now() + 31 * 86400000)
              .toISOString()
              .slice(0, 10),
          });
        const candidates = await f.ok("orders/bookings/candidates", {
          body: {},
        });
        for (const expected of [a, b]) {
          const actual = candidates.orders.find((o) => o.id === expected.id);
          assert.ok(actual?.wearer?.label);
          assert.deepEqual(actual.customer, expected.customer);
          assert.deepEqual(actual.wearer, expected.wearer);
        }
        const before = (
          await f.admin.query(
            "select (select count(*) from order_capacity_demand)::int demand,(select count(*) from journal_batch)::int money",
          )
        ).rows;
        const d = await groupingDraft(f, [a, b], {
            context: {
              occasion: "bridal",
              eventDate: "2026-12-01",
              notes: "SYNTHETIC family visit",
              payerId: a.intake.customerId,
            },
          }),
          key = randomUUID();
        const res = await f.promote(d, { key });
        assert.equal(res.status, 200, await res.clone().text());
        const result = await res.json();
        assert.deepEqual(await (await f.promote(d, { key })).json(), result);
        const detail = await f.ok("orders/bookings/read", {
          body: { id: result.draft.result.id, revision: true },
        });
        assert.equal(detail.booking.code, "BK-000001");
        assert.deepEqual(detail.summary, {
          basis: "garment-prices",
          knownSubtotalPaise: "120000",
          unknownCount: 1,
        });
        assert.equal(detail.orders.length, 2);
        for (const expected of [a, b]) {
          const actual = detail.orders.find((o) => o.id === expected.id);
          assert.deepEqual(actual.customer, expected.customer);
          assert.deepEqual(actual.wearer, expected.wearer);
        }
        assert.deepEqual(await f.ok(`orders/${a.id}/read`), a);
        assert.deepEqual(await f.ok(`orders/${b.id}/read`), b);
        assert.deepEqual(
          (
            await f.admin.query(
              "select (select count(*) from order_capacity_demand)::int demand,(select count(*) from journal_batch)::int money",
            )
          ).rows,
          before,
        );
        const edit = await groupingDraft(f, [], {
          customerId: a.intake.customerId,
          target: { id: detail.booking.id, version: 1 },
          context: {
            ...detail.booking.revision.context,
            eventDate: "2026-12-09",
          },
        });
        const edited = await f.promote(edit);
        assert.equal(edited.status, 200, await edited.clone().text());
        const history = await f.ok("orders/bookings/history", {
          body: { id: detail.booking.id },
        });
        assert.equal(history.entries.length, 2);
        assert.equal(history.entries[1].context.eventDate, "2026-12-01");
        const retained = await f.ok("orders/bookings/read", {
          body: { id: detail.booking.id },
        });
        const originalTemplate = f.seed.sources.before;
        await f.seed.sources.command("service.templates", {
          entryId: originalTemplate.entryId,
          baseVersion: originalTemplate.version,
          baseRevisionId: originalTemplate.id,
          operation: "availability",
          available: false,
          reason: "SYNTHETIC source retired after grouping",
          content: originalTemplate.definition.content,
        });
        assert.deepEqual(
          await f.ok("orders/bookings/read", {
            body: { id: detail.booking.id },
          }),
          retained,
        );
        assert.deepEqual(
          await f.ok("orders/bookings/history", {
            body: { id: detail.booking.id },
          }),
          history,
        );
        assert.deepEqual(await f.ok(`orders/${a.id}/read`), a);
        assert.equal(
          (
            await f.request("orders/bookings/read", {
              body: { id: detail.booking.id },
              who: f.b,
            })
          ).status,
          404,
        );
        await assertIsolationCatalog(f.runtime.db);
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-B06 concurrent exact creation, competing attachments, stale context and durable origin after expiry",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const orders = [];
      for (let i = 0; i < 5; i++) orders.push(await acceptedForBooking(f));
      const a = await groupingDraft(f, orders.slice(0, 2)),
        key = randomUUID();
      const exact = await Promise.all([
        f.promote(a, { key }),
        f.promote(a, { key }),
      ]);
      assert.deepEqual(
        exact.map((r) => r.status),
        [200, 200],
      );
      const first = await exact[0].json();
      assert.deepEqual(await exact[1].json(), first);
      const mismatch = await f.promote(a, { key, etag: '"v2"' });
      assert.equal(mismatch.status, 422);
      assert.equal((await mismatch.json()).error.code, "IDEMPOTENCY_MISMATCH");
      const one = await f.ok("orders/bookings/read", {
        body: { id: first.draft.result.id, revision: true },
      });
      const b = await groupingDraft(f, orders.slice(2, 4)),
        br = await f.promote(b);
      assert.equal(br.status, 200);
      const second = await f.ok("orders/bookings/read", {
        body: { id: (await br.json()).draft.result.id, revision: true },
      });
      const links = await Promise.all(
        [one, second].map((d) =>
          groupingDraft(f, [orders[4]], {
            target: { id: d.booking.id, version: d.booking.version },
          }),
        ),
      );
      const raced = await Promise.all(links.map((d) => f.promote(d)));
      assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
      const groups = await f.ok("orders/bookings/list", { body: {} });
      const current = await f.ok("orders/bookings/read", {
        body: { id: groups.bookings[0].id },
      });
      const edits = await Promise.all(
        ["first", "second"].map((notes) =>
          groupingDraft(f, [], {
            target: {
              id: current.booking.id,
              version: current.booking.version,
            },
            context: { ...current.booking.revision.context, notes },
            customerId: current.booking.customerId,
          }),
        ),
      );
      const changed = await Promise.all(edits.map((d) => f.promote(d)));
      assert.deepEqual(changed.map((r) => r.status).sort(), [200, 412]);
      assert.equal(
        (await f.promote(a, { key: randomUUID(), etag: undefined })).status,
        428,
      );
      assert.equal(
        (
          await f.request(`drafts/${a.id}/promote`, {
            body: { unexpected: true },
            key,
            etag: '"v1"',
          })
        ).status,
        422,
      );
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      assert.equal((await f.promote(a, { key })).status, 412);
      assert.equal(
        (await f.admin.query("select count(*)::int n from booking_member"))
          .rows[0].n,
        5,
      );
      const versioned = await acceptedForBooking(f),
        sibling = await acceptedForBooking(f),
        stale = await groupingDraft(f, [versioned, sibling]);
      await f.ok(`orders/${versioned.id}/presentation`, {
        body: { mode: "detailed" },
        etag: '"v1"',
      });
      assert.equal((await f.promote(stale)).status, 412);
    }),
);

test(
  "GB-B04/06 every actual grouping write rolls back draft, links, audit and result together",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const a = await acceptedForBooking(f),
        b = await acceptedForBooking(f),
        d = await groupingDraft(f, [a, b]),
        key = randomUUID();
      const counts = async () =>
        (
          await f.admin.query(
            `select (select count(*) from booking)::int bookings,(select count(*) from booking_revision)::int revisions,(select count(*) from booking_member)::int members,(select count(*) from booking_membership_history)::int history,(select count(*) from audit_event)::int audit,(select count(*) from idempotency_key)::int keys,(select count(*) from durable_draft where lifecycle='promoted')::int promoted,(select count(*) from order_capacity_demand)::int demand,(select count(*) from journal_batch)::int money,(select count(*) from pgboss.job)::int jobs`,
          )
        ).rows[0];
      const before = await counts();
      for (const table of [
        "booking",
        "booking_revision",
        "booking_member",
        "booking_membership_history",
        "audit_event",
        "durable_draft",
        "idempotency_key",
      ]) {
        const condition =
          table === "durable_draft"
            ? "NEW.lifecycle='promoted' AND NEW.workflow='booking.group'"
            : table === "audit_event"
              ? "NEW.action='booking.revise' OR NEW.action='draft.promote'"
              : table === "idempotency_key"
                ? `NEW.key='${key}'::uuid`
                : "true";
        await f.admin.query(
          `CREATE FUNCTION test_booking_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'SYNTHETIC after actual booking write'; END IF;RETURN NEW; END $$;CREATE TRIGGER test_booking_fault AFTER ${table === "durable_draft" ? "UPDATE" : "INSERT"} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_booking_fault()`,
        );
        try {
          assert.equal((await f.promote(d, { key })).status, 503, table);
          assert.deepEqual(await counts(), before, table);
          assert.equal(
            (await f.ok(`drafts/${d.id}`, { method: "GET" })).lifecycle,
            "active",
          );
        } finally {
          await f.admin.query(
            `DROP TRIGGER test_booking_fault ON ${table};DROP FUNCTION test_booking_fault()`,
          );
        }
      }
      const result = await f.promote(d, { key });
      assert.equal(result.status, 200, await result.clone().text());
      assert.equal((await counts()).members, 2);
      const revision = (await result.json()).draft.result.id,
        group = await f.ok("orders/bookings/read", {
          body: { id: revision, revision: true },
        });
      const edit = await groupingDraft(f, [], {
          customerId: a.intake.customerId,
          target: { id: group.booking.id, version: 1 },
          context: {
            ...group.booking.revision.context,
            notes: "SYNTHETIC edit fault",
          },
        }),
        base = await counts();
      await f.admin.query(
        "CREATE FUNCTION test_booking_update_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC pointer fault'; END $$;CREATE TRIGGER test_booking_update_fault AFTER UPDATE ON booking FOR EACH ROW EXECUTE FUNCTION test_booking_update_fault()",
      );
      try {
        assert.equal((await f.promote(edit)).status, 503);
        assert.deepEqual(await counts(), base);
      } finally {
        await f.admin.query(
          "DROP TRIGGER test_booking_update_fault ON booking;DROP FUNCTION test_booking_update_fault()",
        );
      }
      assert.equal((await f.promote(edit)).status, 200);
    }),
);

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
  "GB-B05 guardian withdrawal serializes with linking and denies private summaries, history, saved drafts and replay",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const m = await bookingMinor(f),
          child = await acceptedForBooking(f, { wearerId: m.w.wearerId }),
          adult = await acceptedForBooking(f),
          d = await groupingDraft(f, [adult, child]),
          key = randomUUID();
        let entered, release;
        const ready = new Promise((r) => {
            entered = r;
          }),
          gate = new Promise((r) => {
            release = r;
          });
        const grouping = f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          async (ctx) => {
            const original = ctx.workflows.get("booking.group");
            const workflows = new Map(ctx.workflows);
            workflows.set("booking.group", {
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
              { key, ifMatch: '"v1"', requestId: randomUUID() },
            );
          },
        );
        await Promise.race([
          ready,
          grouping.then(() => assert.fail("Missing link barrier")),
        ]);
        const g = await f.ok(m.path, { method: "GET" });
        const withdrawal = f.request(`${m.path}/verification-events`, {
          etag: `"v${g.version}"`,
          body: { ...m.verification, status: "withdrawn" },
        });
        try {
          await waitForLock(f);
        } finally {
          release();
        }
        const result = (await grouping).data;
        assert.equal((await withdrawal).status, 200);
        assert.equal((await f.promote(d, { key })).status, 404);
        assert.equal(
          (
            await f.request("orders/bookings/read", {
              body: { id: result.draft.result.id, revision: true },
            })
          ).status,
          404,
        );
        assert.equal(
          (await f.request("orders/bookings/list", { body: {} })).status,
          404,
        );
        const group = (await f.admin.query("select id from booking")).rows[0]
          .id;
        assert.equal(
          (await f.request("orders/bookings/history", { body: { id: group } }))
            .status,
          404,
        );
        assert.equal(
          (await f.request(`drafts/${d.id}`, { method: "GET" })).status,
          404,
        );
        assert.equal(
          (
            await f.request("orders/bookings/review", {
              body: d.draft.payload,
              who: f.b,
            })
          ).status,
          404,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int n from booking_member"))
            .rows[0].n,
          2,
        );
      },
      {},
      { outfit: true },
    ),
);

test(
  "GB-B05/08 populated 0031 upgrade retains orders without automatic grouping and enforces tenant and pointer guards",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const { a, b, snapshots } = await withHistoricalCustomReader(
          f.admin,
          async () => {
            const a = await acceptedForBooking(f),
              b = await acceptedForBooking(f);
            const snapshots = (
              await f.admin.query(
                "select * from order_acceptance_snapshot order by order_id",
              )
            ).rows;
            return { a, b, snapshots };
          },
        );
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(
          (
            await f.admin.query(
              "select * from order_acceptance_snapshot order by order_id",
            )
          ).rows,
          snapshots,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int n from booking")).rows[0]
            .n,
          0,
        );
        const wrong = await f.ok("customers", {
          body: {
            displayName: "SYNTHETIC other booking contact",
            phone: "",
            aliases: [],
            serviceEvidence: {
              noticeId: syntheticCustomerPolicy.notice.id,
              language: "en",
              decision: "grant",
              giver: "self",
              noticeExplained: true,
              source: "in-person",
              occurredAt: new Date().toISOString(),
            },
          },
        });
        const payload = {
          customerId: wrong.customerId,
          target: null,
          context: {
            occasion: "visit",
            eventDate: "",
            notes: "",
            payerId: null,
          },
          orders: [a, b].map((o) => ({
            id: o.id,
            version: o.version,
            snapshotDigest: o.snapshotDigest,
          })),
          reason: "SYNTHETIC wrong contact",
          reviewFingerprint: null,
        };
        assert.equal(
          (await f.request("orders/bookings/review", { body: payload })).status,
          409,
        );
        assert.equal(
          (
            await f.request("orders/bookings/review", {
              body: {
                ...payload,
                customerId: a.intake.customerId,
                orders: [payload.orders[0], payload.orders[0]],
              },
            })
          ).status,
          422,
        );
        const d = await groupingDraft(f, [a, b]),
          r = await f.promote(d);
        assert.equal(r.status, 200);
        const g = await f.ok("orders/bookings/read", {
          body: { id: (await r.json()).draft.result.id, revision: true },
        });
        assert.equal(
          (await f.ok("orders/bookings/candidates", { body: {} })).orders
            .length,
          0,
        );
        for (const table of [
          "booking",
          "booking_revision",
          "booking_member",
          "booking_membership_history",
        ]) {
          assert.equal(
            (await f.runtime.pool.query(`select count(*)::int n from ${table}`))
              .rows[0].n,
            0,
          );
          assert.equal(
            (
              await withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
                tx.execute(sql.raw(`select count(*)::int n from ${table}`)),
              )
            ).rows[0].n,
            0,
          );
          await assert.rejects(
            withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
              tx.execute(sql.raw(`delete from ${table}`)),
            ),
          );
        }
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`update booking set version=version+1 where shop_id=${f.a.shop}::uuid and id=${g.booking.id}::uuid`,
            ),
          ),
        );
        await assertIsolationCatalog(f.runtime.db);
        const count = await f.admin.query(
          "select count(*)::int n from booking",
        );
        assert.equal(count.rows[0].n, 1);
        await f.admin.query(
          "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
          [f.a.shop, f.b.user],
        );
        const admitted = { ...f.b, shop: f.a.shop };
        assert.equal(
          (
            await f.request("orders/bookings/read", {
              body: { id: g.booking.id },
              who: admitted,
            })
          ).status,
          200,
        );
        await f.admin.query(
          "delete from shop_membership where shop_id=$1 and user_id=$2",
          [f.a.shop, f.b.user],
        );
        assert.equal(
          (await f.request("orders/bookings/list", { body: {}, who: admitted }))
            .status,
          403,
        );
      },
      { migrationThrough: "0031_outfit_pieces.sql" },
    ),
);

test(
  "GB-C05 guardian withdrawal serializes with linking and denies private summaries, history, saved drafts and replay",
  { timeout: 180000 },
  async () =>
    fixture(
      async (f) => {
        const m = await bookingMinor(f),
          input = newGroup(f),
          d = await saveNewGroup(f, {
            ...input,
            lines: input.lines.map((l) => ({
              ...l,
              intake: {
                ...l.intake,
                customerId: m.c.id,
                wearerId: m.w.wearerId,
              },
            })),
          }),
          key = randomUUID();
        let entered, release;
        const ready = new Promise((r) => {
            entered = r;
          }),
          gate = new Promise((r) => {
            release = r;
          });
        const grouping = f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          async (ctx) => {
            const original = ctx.workflows.get("order.group");
            const workflows = new Map(ctx.workflows);
            workflows.set("order.group", {
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
              { key, ifMatch: '"v1"', requestId: randomUUID() },
            );
          },
        );
        await Promise.race([
          ready,
          grouping.then(() => assert.fail("Missing link barrier")),
        ]);
        const g = await f.ok(m.path, { method: "GET" });
        const withdrawal = f.request(`${m.path}/verification-events`, {
          etag: `"v${g.version}"`,
          body: { ...m.verification, status: "withdrawn" },
        });
        try {
          await waitForLock(f);
        } finally {
          release();
        }
        const result = (await grouping).data;
        assert.equal((await withdrawal).status, 200);
        assert.equal((await f.promote(d, { key })).status, 404);
        assert.equal(
          (
            await f.request("orders/bookings/read", {
              body: { id: result.draft.result.id, revision: true },
            })
          ).status,
          404,
        );
        assert.equal(
          (await f.request("orders/bookings/list", { body: {} })).status,
          404,
        );
        const group = (await f.admin.query("select id from booking")).rows[0]
          .id;
        assert.equal(
          (await f.request("orders/bookings/history", { body: { id: group } }))
            .status,
          404,
        );
        assert.equal(
          (await f.request(`drafts/${d.id}`, { method: "GET" })).status,
          404,
        );
        assert.equal(
          (
            await f.request("orders/bookings/intake-review", {
              body: d.draft.payload,
              who: f.b,
            })
          ).status,
          404,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int n from booking_member"))
            .rows[0].n,
          2,
        );
      },
      {},
      { outfit: true },
    ),
);
