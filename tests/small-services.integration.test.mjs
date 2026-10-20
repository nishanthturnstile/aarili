import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyGroupIntake, emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { smallServicesRepository } from "@aarili/db/small-services-repository";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withHistoricalCustomReader } from "../scripts/test-support/historical-custom-reader.mjs";
import { seedOrderAcceptance } from "../scripts/test-support/order-acceptance.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import {
  seedSmallServices,
  serviceDraftId,
} from "../scripts/test-support/small-services.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

function requests(f) {
  f.request = (
    path,
    {
      method = "POST",
      body,
      etag,
      key = randomUUID(),
      who = f.a,
      origin = f.owner.origin,
      cookie = who.cookie,
    } = {},
  ) =>
    f.api.fetch(
      new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
        method,
        headers: {
          ...(origin ? { Origin: origin } : {}),
          Cookie: cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
          ...(etag ? { "If-Match": etag } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  f.ok = async (path, options) => {
    const response = await f.request(path, options);
    assert.equal(
      response.status,
      200,
      `${path}: ${await response.clone().text()}`,
    );
    return response.json();
  };
  f.save = async (
    value,
    { id = serviceDraftId(), etag, workflow = "order.service", key } = {},
  ) => ({
    id,
    ...(await f.ok(`drafts/${id}`, {
      method: "PUT",
      body: { workflow, schemaVersion: 1, payload: value },
      etag,
      key,
    })),
  });
  f.promote = (draft, options = {}) =>
    f.request(`drafts/${draft.id}/promote`, {
      body: {},
      etag: `"v${draft.draft.version}"`,
      ...options,
    });
  f.review = (value) => f.ok("small-services/orders/review", { body: value });
  f.reviewed = async (value) => {
    const review = await f.review(value);
    assert.deepEqual(review.issues, [], JSON.stringify(review));
    assert(review.commitment);
    assert.deepEqual(review.commitment.unknowns, []);
    return {
      ...value,
      commitmentReview: {
        fingerprint: review.fingerprint,
        acknowledged: true,
        exceptionReason: review.commitment.evaluation.warnings.length
          ? "SYNTHETIC explicit capacity exception"
          : "",
        waiveRush: false,
        waiverReason: "",
      },
    };
  };
  f.accept = async (value) => {
    const draft = await f.save(await f.reviewed(value));
    const key = randomUUID();
    const response = await f.promote(draft, { key });
    if (response.status === 503) {
      // Surface the synthetic-only database reason without changing the public
      // API's deliberately private error or generating a different request key.
      try {
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
          f.a.shop,
          (ctx) =>
            mutateDraft(
              ctx,
              draft.id,
              "promote",
              {},
              {
                key,
                requestId: randomUUID(),
                ifMatch: `"v${draft.draft.version}"`,
              },
            ),
        );
      } catch (error) {
        let cause = error;
        while (cause.cause) cause = cause.cause;
        assert.fail(
          `Synthetic acceptance: ${cause.code ?? ""} ${cause.message} ${cause.where ?? ""}`,
        );
      }
    }
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.draft.result.type, "service-order.accepted");
    return {
      draft,
      result,
      order: await f.ok(`small-services/orders/${result.draft.result.id}`, {
        method: "GET",
      }),
    };
  };
}
async function fixture(work) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      requests(f);
      f.services = await seedSmallServices({
        setup: f.ok,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      try {
        await work(f);
      } finally {
        await f.services.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
}
const fresh = (v) => ({
  ...structuredClone(v),
  subjectId: randomUUID(),
  lines: v.lines.map((l) => ({ ...l, id: randomUUID() })),
  commitmentReview: null,
});
async function counts(f) {
  return (
    await f.admin.query(`select
    (select count(*)::int from garment_order) orders,
    (select count(*)::int from service_property_subject) subjects,
    (select count(*)::int from service_order_line) lines,
    (select count(*)::int from order_acceptance_snapshot) snapshots,
    (select count(*)::int from order_capacity_demand) demand,
    (select count(*)::int from order_piece_set) piece_sets,
    (select count(*)::int from order_piece) pieces,
    (select count(*)::int from order_requirement_scope) scopes,
    (select count(*)::int from order_presentation_event) presentation,
    (select count(*)::int from audit_event) audit,
    (select count(*)::int from idempotency_key) keys,
    (select count(*)::int from durable_draft where lifecycle='promoted') promoted,
    (select count(*)::int from journal_batch) money,
    (select count(*)::int from pgboss.job) jobs`)
  ).rows[0];
}

test(
  "SS-01/02/03/06/07/09/10/13/14 standalone kurti and saree retain minimal exact priced lines, covered demand and immutable source history",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      await assertIsolationCatalog(f.runtime.db);
      const { kurti, saree } = f.services;
      const before = await counts(f);
      const review = await f.review(saree.intake);
      assert.equal(review.effects, "none");
      assert.equal(
        review.quantity,
        1,
        "fall+pico cover the same physical saree once",
      );
      assert.equal(
        review.totalPaise,
        null,
        "unknown second price prevents a complete total",
      );
      assert.equal(
        review.lines[0].pricePaise,
        0,
        "explicit zero survives independently",
      );
      assert.equal(review.lines[1].pricePaise, null);
      assert.equal(review.wearer, null);
      assert.deepEqual(
        await counts(f),
        before,
        "review has no persistence/capacity effects",
      );
      const first = await f.accept(kurti.intake),
        second = await f.accept(saree.intake);
      for (const path of [
        `small-services/orders/${second.order.id}`,
        `small-services/profiles/${saree.profile.id}`,
      ]) {
        const response = await f.request(path, { method: "GET" });
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get("Cache-Control"),
          "private, no-store",
        );
        assert.equal(response.headers.get("ETag"), '"v1"');
      }
      assert.equal(first.order.code, "QO-000001");
      assert.equal(second.order.code, "QO-000002");
      assert(first.order.wearer);
      assert.equal(second.order.wearer, null);
      assert.equal(second.order.kind, "service");
      assert.equal(second.order.intake.subjectId, saree.intake.subjectId);
      assert.deepEqual(
        second.order.lines.map((l) => l.id),
        saree.intake.lines.map((l) => l.id),
      );
      assert.deepEqual(
        second.order.lines.map((l) => l.state),
        ["pending", "pending"],
      );
      assert.deepEqual(
        second.order.lines.map((l) => l.pricePaise),
        [0, null],
      );
      assert.deepEqual(
        second.order.originalPromise,
        second.order.currentPromise,
      );
      assert.equal(second.order.profile.id, saree.profile.id);
      assert.deepEqual(
        second.order.profile.content.manifest,
        saree.profile.content.manifest,
      );
      const acceptedCounts = await counts(f);
      assert.equal(acceptedCounts.orders, before.orders + 2);
      assert.equal(acceptedCounts.subjects, 2);
      assert.equal(acceptedCounts.lines, 3);
      assert.equal(acceptedCounts.demand, 2);
      assert.equal(acceptedCounts.money, before.money);
      assert.equal(acceptedCounts.jobs, before.jobs);
      const demand = await f.admin.query(
        "select quantity,unit from order_capacity_demand order by order_id",
      );
      assert(
        demand.rows.every(
          (r) => Number(r.quantity) === 1 && r.unit === "garments",
        ),
      );
      assert.equal(
        (await f.ok("orders/list", { body: {} })).orders.length,
        0,
        "strict custom reader does not reinterpret service snapshots",
      );
      assert.equal(
        (await f.ok("small-services/orders/list", { body: {} })).orders.length,
        2,
      );
      assert.equal(
        (await f.ok("small-services/profiles/list", { body: {} })).profiles
          .length,
        3,
      );
      const copiedSubject = {
        ...fresh(kurti.intake),
        subjectId: first.order.intake.subjectId,
      };
      const copiedLine = fresh(saree.intake);
      copiedLine.lines[0].id = second.order.lines[0].id;
      for (const collision of [copiedSubject, copiedLine]) {
        const conflict = await f.review(collision);
        assert(conflict.issues.includes("serviceIdentityConflict"));
        const retained = await f.save({
          ...collision,
          commitmentReview: {
            fingerprint: conflict.fingerprint,
            acknowledged: true,
            exceptionReason:
              "SYNTHETIC cannot waive reused physical/line identity",
            waiveRush: false,
            waiverReason: "",
          },
        });
        const response = await f.promote(retained);
        assert.equal(response.status, 409, await response.clone().text());
        assert.equal(
          (await f.ok(`drafts/${retained.id}`, { method: "GET" })).lifecycle,
          "active",
        );
        assert.equal((await counts(f)).orders, 2);
        assert.equal((await counts(f)).demand, 2);
      }
      const explicitlyOmitted = fresh(saree.intake);
      explicitlyOmitted.lines.push({
        id: randomUUID(),
        key: "pre-pleating",
        requestedWork: "",
        priceState: "to-be-quoted",
        priceText: "",
        notRequired: true,
        notRequiredReason: "SYNTHETIC customer requested edge finishing only",
      });
      const omitted = await f.accept(explicitlyOmitted);
      assert.deepEqual(
        omitted.order.lines.map((l) => l.state),
        ["pending", "pending", "not-required"],
      );
      assert.equal(omitted.order.review.quantity, 1);
      assert.equal(
        omitted.order.lines[2].pricePaise,
        null,
        "not-required is not a quoted zero or completed line",
      );
      const changed = await f.services.publishProfile({
        entryId: saree.profile.entryId,
        baseVersion: 1,
        baseRevisionId: saree.profile.id,
        content: {
          ...saree.profile.content,
          labelEn: "SYNTHETIC revised future label",
        },
        available: false,
        reason: "SYNTHETIC future disable keeps accepted history",
      });
      assert.equal(changed.version, 2);
      assert.deepEqual(
        await f.ok(`small-services/profiles/${saree.profile.id}`, {
          method: "GET",
        }),
        saree.profile,
      );
      assert.equal(
        (
          await f.ok("small-services/profiles/history", {
            body: { entryId: saree.profile.entryId },
          })
        ).revisions.length,
        2,
      );
      assert.deepEqual(
        await f.ok(`small-services/orders/${second.order.id}`, {
          method: "GET",
        }),
        second.order,
      );
      const stale = await f.review(fresh(saree.intake));
      assert(stale.issues.length > 0);
      // No application completion, receipt, movement, ready or handover state exists
      // in this intake result; taskless lines are still explicitly pending.
      for (const line of second.order.lines) assert.equal(line.taskKey, null);
      assert(!("receivedAt" in second.order.intake));
      assert(!("handedOverAt" in second.order));
    }),
);

test(
  "SS-05/09/10/11 incomplete drafts, ETags, request binding, missing mapping, wearer and foreign references fail closed",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { kurti, saree, unknown } = f.services;
      for (const path of [
        "small-services/profiles/list",
        "small-services/orders/list",
        "small-services/orders/review",
      ]) {
        const body = path.endsWith("review") ? saree.intake : {};
        assert.equal(
          (await f.request(path, { body, origin: null })).status,
          403,
        );
        assert.equal(
          (
            await f.request(path, {
              body,
              origin: "https://foreign.example.test",
            })
          ).status,
          403,
        );
        assert.equal(
          (await f.request(`${path}?private=forbidden`, { body })).status,
          422,
        );
        assert.equal((await f.request(path, { body, cookie: "" })).status, 401);
        assert.equal(
          (await f.request(path, { body, who: { ...f.a, shop: f.b.shop } }))
            .status,
          403,
        );
      }
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            body: { ...saree.intake, fabricatedReceipt: true },
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            body: { ...saree.intake, instructions: "x".repeat(70000) },
          })
        ).status,
        413,
      );
      const incomplete = {
        ...fresh(kurti.intake),
        customerId: null,
        wearerId: null,
        subjectDescription: "",
        deliveryDate: "",
        lines: [],
      };
      const draft = await f.save(incomplete);
      assert.deepEqual(
        (await f.ok(`drafts/${draft.id}`, { method: "GET" })).payload,
        incomplete,
      );
      assert.equal((await f.promote(draft)).status, 422);
      assert.equal(
        (
          await f.request(`drafts/${draft.id}`, {
            method: "PUT",
            body: {
              workflow: "order.service",
              schemaVersion: 1,
              payload: incomplete,
            },
          })
        ).status,
        428,
      );
      const changed = await f.save(
        { ...incomplete, instructions: "SYNTHETIC recovered Tamil குறிப்பு" },
        { id: draft.id, etag: '"v1"' },
      );
      assert.equal(changed.draft.version, 2);
      assert.equal(
        (
          await f.request(`drafts/${draft.id}`, {
            method: "PUT",
            etag: '"v1"',
            body: {
              workflow: "order.service",
              schemaVersion: 1,
              payload: incomplete,
            },
          })
        ).status,
        412,
      );
      assert.equal(
        (await f.request(`drafts/${draft.id}`, { method: "GET", who: f.b }))
          .status,
        404,
      );
      const noWearer = await f.review({ ...kurti.intake, wearerId: null });
      assert(noWearer.issues.length > 0);
      const missing = await f.review(unknown.intake);
      assert.equal(missing.quantity, null);
      assert(
        missing.issues.length > 0 || missing.commitment?.unknowns.length > 0,
      );
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            body: {
              ...saree.intake,
              sourceOrderId: randomUUID(),
              sourcePieceId: randomUUID(),
            },
          })
        ).status,
        404,
      );
      for (const value of [
        { ...saree.intake, customerId: randomUUID() },
        { ...saree.intake, wearerId: randomUUID() },
        {
          ...saree.intake,
          profile: { entryId: randomUUID(), revisionId: kurti.profile.id },
        },
        {
          ...saree.intake,
          profile: { entryId: saree.profile.entryId, revisionId: randomUUID() },
        },
      ]) {
        const r = await f.request("small-services/orders/review", {
          body: value,
        });
        if (r.status === 200) assert((await r.json()).issues.length > 0);
        else assert([404, 409, 422].includes(r.status), await r.clone().text());
      }
      const id = serviceDraftId(),
        key = randomUUID(),
        payload = fresh(saree.intake);
      const a = await f.save(payload, { id, key });
      assert.deepEqual(await f.save(payload, { id, key }), a);
      const saveBody = {
        workflow: "order.service",
        schemaVersion: 1,
        payload: { ...payload, instructions: "different" },
      };
      assert.equal(
        (
          await f.request(`drafts/${id}`, {
            method: "PUT",
            key,
            body: saveBody,
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await f.request(`drafts/${id}/abandon`, {
            key,
            body: {},
            etag: '"v1"',
          })
        ).status,
        422,
      );
      await f.ok(`drafts/${draft.id}/abandon`, { body: {}, etag: '"v2"' });
      assert.equal(
        (await f.ok(`drafts/${draft.id}`, { method: "GET" })).lifecycle,
        "abandoned",
      );
      assert.equal((await counts(f)).demand, 0);
    }),
);

test(
  "SS-10/11 simultaneous acceptances serialize capacity; exact retries and expired keys cannot duplicate subjects, lines or demand",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const v = f.services.saree.intake;
      const secondCustomer = await f.ok("customers", {
        body: {
          displayName: "SYNTHETIC independent capacity customer",
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
      const a = await f.save(await f.reviewed(fresh(v))),
        b = await f.save(
          await f.reviewed({
            ...fresh(v),
            customerId: secondCustomer.customerId,
          }),
        );
      const responses = await Promise.all([f.promote(a), f.promote(b)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      const loser = responses[0].status === 409 ? a : b;
      const next = await f.review(fresh(v));
      assert.equal(next.commitment.evaluation.facts.existing, 1);
      assert(next.commitment.evaluation.warnings.includes("capacityExceeded"));
      const reReviewed = await f.reviewed(
        (await f.ok(`drafts/${loser.id}`, { method: "GET" })).payload,
      );
      const d = await f.save(reReviewed, { id: loser.id, etag: '"v1"' });
      const key = randomUUID();
      const retried = await Promise.all([
        f.promote(d, { key }),
        f.promote(d, { key }),
      ]);
      assert(retried.every((r) => r.status === 200));
      const result = await retried[0].json();
      assert.deepEqual(await retried[1].json(), result);
      const baseline = await counts(f);
      assert.equal(baseline.orders, 2);
      assert.equal(baseline.subjects, 2);
      assert.equal(baseline.lines, 4);
      assert.equal(baseline.demand, 2);
      assert.equal(
        (await f.promote(d, { key, etag: `"v${result.draft.version}"` }))
          .status,
        422,
        "same key cannot change its precondition",
      );
      await f.admin.query(
        "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
        [f.a.shop, f.b.user],
      );
      try {
        assert.equal(
          (await f.promote(d, { key, who: { ...f.b, shop: f.a.shop } })).status,
          422,
          "same request key is actor-bound even for another authorised owner",
        );
      } finally {
        await f.admin.query(
          "delete from shop_membership where shop_id=$1 and user_id=$2",
          [f.a.shop, f.b.user],
        );
      }
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      assert.equal(
        (
          await f.promote(
            { id: d.id, draft: { version: result.draft.version } },
            { key: randomUUID() },
          )
        ).status,
        409,
      );
      assert.equal((await counts(f)).orders, baseline.orders);
      assert.equal((await counts(f)).demand, baseline.demand);
    }),
);

test(
  "SS-07/09/11 profile publication holds acceptance source locks and rejects mixed old review/new mapping",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { saree } = f.services;
      const draft = await f.save(await f.reviewed(saree.intake));
      const pub = await f.save(
        {
          entryId: saree.profile.entryId,
          baseVersion: 1,
          baseRevisionId: saree.profile.id,
          content: {
            ...saree.profile.content,
            lines: saree.profile.content.lines.map((l) => ({
              ...l,
              quantity: 2,
            })),
          },
          available: true,
          reason: "SYNTHETIC concurrent reviewed mapping edit",
        },
        { workflow: "service.intake-profile" },
      );
      let entered, release;
      const ready = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      const publisher = f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
        f.a.shop,
        async (ctx) => {
          const adapter = ctx.workflows.get("service.intake-profile"),
            workflows = new Map(ctx.workflows);
          workflows.set("service.intake-profile", {
            ...adapter,
            async promote(...args) {
              const r = await adapter.promote(...args);
              entered();
              await gate;
              return r;
            },
          });
          return mutateDraft(
            { ...ctx, workflows },
            pub.id,
            "promote",
            {},
            { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
          );
        },
      );
      await Promise.race([
        ready,
        publisher.then(() => assert.fail("publisher missed write barrier")),
      ]);
      const accepting = f.promote(draft);
      try {
        await waitForLock(f);
      } finally {
        release();
      }
      await publisher;
      const r = await accepting;
      assert.equal(r.status, 409, await r.clone().text());
      assert.equal((await counts(f)).orders, 0);
      assert.equal((await counts(f)).demand, 0);
    }),
);

async function waitForLock(f) {
  for (let i = 0; i < 150; i++) {
    const r = await f.admin.query(
      "select count(*)::int n from pg_stat_activity where usename='app_user' and wait_event_type='Lock'",
    );
    if (r.rows[0].n > 0) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail("real PostgreSQL transaction did not wait on expected lock");
}

test(
  "SS-09 reviewed effort-points accept exact comparable demand; unknown mapping and historical garment-count demand stay blocked",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { kurti, saree, config } = f.services;
      await f.accept(saree.intake);
      const ruleId = await config.publish("shop.commitments", {
        baseVersion: 1,
        baseRevisionId: config.ruleId,
        configuration: {
          ...config.configuration,
          unit: "effort-points",
          cap: 20,
        },
      });
      for (const service of [kurti, saree])
        await config.publish("service.commitment-bindings", {
          categoryId: service.category.entryId,
          categoryRevisionId: service.category.definition.id,
          availabilityId: service.category.id,
          ruleRevisionId: ruleId,
          baseVersion: 1,
          baseRevisionId: service.bindingId,
          review: "reviewed",
          reason: "SYNTHETIC reviewed comparable effort mapping",
        });
      const kurtiProfile = await f.services.publishProfile({
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        available: true,
        reason:
          "SYNTHETIC exact four-point alteration, no production quantities",
        content: {
          ...kurti.profile.content,
          capacityUnit: "effort-points",
          lines: kurti.profile.content.lines.map((l) => ({
            ...l,
            quantity: 4,
          })),
        },
      });
      const effortIntake = {
        ...fresh(kurti.intake),
        profile: { entryId: kurtiProfile.entryId, revisionId: kurtiProfile.id },
      };
      const review = await f.review(effortIntake);
      assert.equal(review.quantity, 4);
      assert.equal(review.unit, "effort-points");
      assert.deepEqual(review.issues, []);
      const accepted = await f.accept(effortIntake);
      assert.equal(accepted.order.review.quantity, 4);
      const rows = (
        await f.admin.query(
          "select order_id,unit,quantity from order_capacity_demand order by order_id",
        )
      ).rows;
      assert(
        rows.some(
          (r) =>
            r.order_id === accepted.order.id &&
            r.unit === "effort-points" &&
            Number(r.quantity) === 4,
        ),
      );
      assert(
        rows.some((r) => r.unit === "garments" && Number(r.quantity) === 1),
        "historical count demand is retained exactly",
      );
      const mixedProfile = await f.services.publishProfile({
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        available: true,
        reason:
          "SYNTHETIC separate additive effort groups, cannot convert count history",
        content: {
          ...saree.profile.content,
          capacityUnit: "effort-points",
          lines: saree.profile.content.lines.map((l, i) => ({
            ...l,
            coverageKey: `incremental-${l.key}`,
            quantity: i + 2,
          })),
        },
      });
      const mixed = {
        ...fresh(saree.intake),
        profile: { entryId: mixedProfile.entryId, revisionId: mixedProfile.id },
      };
      const mixedReview = await f.review(mixed);
      assert.equal(
        mixedReview.quantity,
        5,
        "distinct reviewed fall/pico effort groups sum exactly",
      );
      assert(
        mixedReview.issues.length > 0 ||
          mixedReview.commitment?.unknowns.length > 0,
        "count and effort history is incomparable",
      );
      const mixedDraft = await f.save({
        ...mixed,
        commitmentReview: {
          fingerprint: mixedReview.fingerprint,
          acknowledged: true,
          exceptionReason: "SYNTHETIC cannot waive incomparable units",
          waiveRush: false,
          waiverReason: "",
        },
      });
      assert.equal((await f.promote(mixedDraft)).status, 409);
      const unknownProfile = await f.services.publishProfile({
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        available: true,
        reason: "SYNTHETIC unknown effort must not become zero",
        content: {
          ...kurtiProfile.content,
          lines: kurtiProfile.content.lines.map((l) => ({
            ...l,
            quantity: null,
          })),
        },
      });
      const unknown = await f.review({
        ...fresh(effortIntake),
        profile: {
          entryId: unknownProfile.entryId,
          revisionId: unknownProfile.id,
        },
      });
      assert.equal(unknown.quantity, null);
      assert(unknown.issues.length > 0);
      assert.equal((await counts(f)).demand, 2);
    }),
);

test(
  "SS-11 actual-write fault injection rolls back subject, independent lines, demand, audit, result and draft before exact retry",
  { timeout: 300000 },
  async () =>
    fixture(async (f) => {
      for (const target of [
        "service_property_subject",
        "service_order_line",
        "order_capacity_demand",
        "audit_event",
        "durable_draft",
        "idempotency_key",
      ]) {
        const draft = await f.save(
            await f.reviewed(fresh(f.services.saree.intake)),
          ),
          key = randomUUID(),
          before = await counts(f);
        const condition =
          target === "durable_draft"
            ? "NEW.lifecycle='promoted' AND NEW.workflow='order.service'"
            : target === "audit_event"
              ? "NEW.action='draft.promote'"
              : target === "idempotency_key"
                ? `NEW.key='${key}'::uuid`
                : "true";
        await f.admin.query(
          `create function test_service_fault() returns trigger language plpgsql as $$ begin if ${condition} then raise exception 'SYNTHETIC fault after actual write'; end if; return NEW; end $$; create trigger test_service_fault after ${target === "durable_draft" ? "UPDATE" : "INSERT"} on ${target} for each row execute function test_service_fault()`,
        );
        try {
          const result = await f.promote(draft, { key });
          assert.equal(
            result.status,
            503,
            `${target}: ${await result.clone().text()}`,
          );
          assert.deepEqual(await counts(f), before, target);
          assert.equal(
            (await f.ok(`drafts/${draft.id}`, { method: "GET" })).lifecycle,
            "active",
          );
        } finally {
          await f.admin.query(
            `drop trigger test_service_fault on ${target}; drop function test_service_fault()`,
          );
        }
        const result = await f.promote(draft, { key });
        assert.equal(
          result.status,
          200,
          `${target}: ${await result.clone().text()}`,
        );
        const after = await counts(f);
        assert.equal(after.orders, before.orders + 1);
        assert.equal(after.subjects, before.subjects + 1);
        assert.equal(after.lines, before.lines + 2);
        assert.equal(after.demand, before.demand + 1);
        assert.equal(after.money, before.money);
        assert.equal(after.jobs, before.jobs);
      }
    }),
);

test(
  "SS-05/11 guardian authority, aunt denial, withdrawal and exact replay enforce current minor permissions",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const c = await f.ok(`customers/${f.services.seed.customer.customerId}`, {
          method: "GET",
        }),
        at = new Date().toISOString();
      const w = await f.ok(`customers/${c.id}/wearers`, {
        body: {
          mode: "new",
          displayName: "SYNTHETIC child brought by aunt",
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
            interaction: "SYNTHETIC aunt is contact only",
          },
        },
      });
      const value = { ...fresh(f.services.kurti.intake), wearerId: w.wearerId };
      const aunt = await f.review(value);
      assert(aunt.issues.length > 0 || aunt.commitment?.unknowns.length > 0);
      const path = `customers/${c.id}/wearers/${w.wearerId}/guardians`;
      await f.ok(path, {
        etag: `"v${w.version}"`,
        body: {
          guardian: { mode: "new", displayName: "SYNTHETIC verified parent" },
          authority: "parent",
          scope: "measurement",
          source: "in-person",
          occurredAt: at,
        },
      });
      let guardian = await f.ok(path, { method: "GET" });
      const verification = {
        authorityId: guardian.authority.id,
        status: "confirmed",
        method: "synthetic-review-v1",
        evidenceRef: "SYNTHETIC no real child",
        scope: "measurement",
        source: "in-person",
        occurredAt: at,
      };
      await f.ok(`${path}/verification-events`, {
        etag: `"v${guardian.version}"`,
        body: verification,
      });
      const draft = await f.save(await f.reviewed(value)),
        key = randomUUID();
      const response = await f.promote(draft, { key });
      assert.equal(response.status, 200, await response.clone().text());
      const result = await response.json(),
        order = result.draft.result.id;
      assert.equal(
        (await f.request(`small-services/orders/${order}`, { method: "GET" }))
          .status,
        200,
      );
      guardian = await f.ok(path, { method: "GET" });
      const racingDraft = await f.save(await f.reviewed(fresh(value)));
      let entered, release;
      const ready = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
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
              ifMatch: `"v${guardian.version}"`,
            },
          );
        },
      );
      await Promise.race([
        ready,
        revoking.then(() =>
          assert.fail("guardian revocation missed write barrier"),
        ),
      ]);
      const accepting = f.promote(racingDraft);
      try {
        await waitForLock(f);
      } finally {
        release();
      }
      await revoking;
      assert(
        [404, 409].includes((await accepting).status),
        "withdrawal wins the actual authority lock race",
      );
      assert.equal(
        (await f.request(`small-services/orders/${order}`, { method: "GET" }))
          .status,
        404,
      );
      assert.equal((await f.promote(draft, { key })).status, 404);
      assert.equal(
        (await f.request(`drafts/${draft.id}`, { method: "GET" })).status,
        404,
      );
      assert.equal(
        (await f.ok("small-services/orders/list", { body: {} })).orders.length,
        0,
      );
      assert.equal(
        (await counts(f)).demand,
        1,
        "revocation does not erase original accepted demand",
      );
    }),
);

test(
  "SS-07/11 forced RLS, pooled context reset, foreign source/profile/draft and immutable direct SQL guards",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { order, draft } = await f.accept(f.services.saree.intake);
      for (const table of [
        "service_intake_profile",
        "service_intake_profile_revision",
        "service_property_subject",
        "service_order_line",
      ]) {
        assert.equal(
          (await f.runtime.pool.query(`select count(*)::int n from ${table}`))
            .rows[0].n,
          0,
          `${table}: missing context fails closed`,
        );
        const own = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql.raw(`select count(*)::int n from ${table}`)),
        );
        assert(own.rows[0].n > 0, table);
        const other = await withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
          tx.execute(sql.raw(`select count(*)::int n from ${table}`)),
        );
        assert.equal(other.rows[0].n, 0, table);
        assert.equal(
          (await f.runtime.pool.query(`select count(*)::int n from ${table}`))
            .rows[0].n,
          0,
          `${table}: pooled transaction context cleared`,
        );
      }
      for (const path of [
        `small-services/orders/${order.id}`,
        `small-services/profiles/${order.profile.id}`,
        `drafts/${draft.id}`,
      ])
        assert.equal(
          (await f.request(path, { method: "GET", who: f.b })).status,
          404,
          path,
        );
      assert.deepEqual(
        (await f.ok("small-services/orders/list", { body: {}, who: f.b }))
          .orders,
        [],
      );
      assert.deepEqual(
        (await f.ok("small-services/profiles/list", { body: {}, who: f.b }))
          .profiles,
        [],
      );
      assert.deepEqual(
        (
          await f.ok("small-services/profiles/history", {
            body: { entryId: order.profile.entryId },
            who: f.b,
          })
        ).revisions,
        [],
      );
      const seed = f.services.seed;
      const custom = {
        ...emptyQuickOrder(),
        customerId: seed.customer.customerId,
        wearerId: seed.wearer.wearerId,
        manifest: {
          entryId: seed.sources.before.entryId,
          revisionId: seed.sources.before.id,
          definitionId: seed.sources.before.definition.id,
        },
        deliveryDate: f.services.kurti.intake.deliveryDate,
        priceState: "quoted",
        priceText: "12.34",
      };
      const customReview = await f.ok("orders/review", { body: custom });
      custom.commitmentReview = {
        fingerprint: customReview.fingerprint,
        acknowledged: true,
        exceptionReason: "",
        waiveRush: false,
        waiverReason: "",
      };
      const customDraft = await f.save(custom, { workflow: "order.quick" });
      const customResponse = await f.promote(customDraft);
      assert.equal(
        customResponse.status,
        200,
        await customResponse.clone().text(),
      );
      const customId = (await customResponse.json()).draft.result.id;
      const piece = (
        await f.admin.query(
          "select id from order_piece where shop_id=$1 and order_id=$2 order by id limit 1",
          [f.a.shop, customId],
        )
      ).rows[0].id;
      const linked = {
        ...fresh(f.services.kurti.intake),
        sourceOrderId: customId,
        sourcePieceId: piece,
      };
      assert.deepEqual(
        (await f.review(linked)).issues,
        [],
        "authorised exact original order/piece link is contextual only",
      );
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            body: {
              ...fresh(f.services.saree.intake),
              sourceOrderId: customId,
              sourcePieceId: piece,
            },
          })
        ).status,
        404,
        "wearer exemption cannot strip the source order's wearer",
      );
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            body: { ...linked, sourceOrderId: order.id },
          })
        ).status,
        404,
        "real piece from a different order fails closed",
      );
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            who: f.b,
            body: linked,
          })
        ).status,
        404,
        "foreign source/profile/identity cannot be reviewed",
      );
      const foreignCustomer = await f.ok("customers", {
        who: f.b,
        body: {
          displayName: "SYNTHETIC foreign service contact",
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
      assert.equal(
        (
          await f.request("small-services/orders/review", {
            body: {
              ...fresh(f.services.saree.intake),
              customerId: foreignCustomer.customerId,
            },
          })
        ).status,
        404,
      );
      for (const table of [
        "service_intake_profile_revision",
        "service_property_subject",
        "service_order_line",
      ])
        await assert.rejects(
          f.admin.query(`delete from ${table}`),
          (error) => error.code === "42501",
          table,
        );
      const forged = {
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        available: true,
        reason:
          "SYNTHETIC direct SQL attack on fit alteration wearer exemption",
        content: {
          ...f.services.kurti.profile.content,
          wearerRequirement: "not-required",
          wearerReason: "SYNTHETIC forged claim",
        },
      };
      const forgedDraft = await f.save(forged, {
        workflow: "service.intake-profile",
      });
      const baseline = await counts(f);
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          smallServicesRepository(tx, f.a.shop).append({
            ...forged,
            actorId: f.a.user,
            originDraftId: forgedDraft.id,
            authority: "synthetic-fixture",
            digest: "a".repeat(64),
            key: randomUUID(),
            requestId: randomUUID(),
          }),
        ),
        (error) =>
          (error.cause?.code ?? error.code) === "23514" &&
          String(error.cause?.message ?? error.message).includes(
            "applicability",
          ),
      );
      assert.deepEqual(
        await counts(f),
        baseline,
        "SQL denies forged exemption and rolls back its audit",
      );
      await assert.rejects(
        f.admin.query(
          "update garment_order set intake_kind='custom',wearer_id=null where id=$1",
          [order.id],
        ),
      );
      await assert.rejects(
        f.admin.query(
          "update service_property_subject set shop_id=$1 where id=$2",
          [f.b.shop, order.intake.subjectId],
        ),
      );
    }),
);

test(
  "SS-07/13 populated 0033 upgrade preserves Quick Order and grouped immutable snapshots and commercial facts",
  { timeout: 300000 },
  async () =>
    withTenantFixture(
      async (f) => {
        f.api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        requests(f);
        const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
        try {
          const quickOrder = await withHistoricalCustomReader(
            f.admin,
            async () => {
              await seedOrderAcceptance(f.ok, seed.sources);
              const base = {
                ...emptyQuickOrder(),
                customerId: seed.customer.customerId,
                wearerId: seed.wearer.wearerId,
                manifest: {
                  entryId: seed.sources.before.entryId,
                  revisionId: seed.sources.before.id,
                  definitionId: seed.sources.before.definition.id,
                },
                deliveryDate: new Date(Date.now() + 30 * 86400000)
                  .toISOString()
                  .slice(0, 10),
                priceState: "quoted",
                priceText: "0",
              };
              const review = await f.ok("orders/review", { body: base });
              const quick = {
                ...base,
                commitmentReview: {
                  fingerprint: review.fingerprint,
                  acknowledged: true,
                  exceptionReason: "",
                  waiveRush: false,
                  waiverReason: "",
                },
              };
              const quickDraft = await f.save(quick, {
                workflow: "order.quick",
              });
              const quickPromoted = await f.promote(quickDraft);
              assert.equal(
                quickPromoted.status,
                200,
                await quickPromoted.clone().text(),
              );
              const quickOrder = await f.ok(
                `orders/${(await quickPromoted.json()).draft.result.id}/read`,
              );
              const group = {
                ...emptyGroupIntake(),
                lines: [
                  { id: randomUUID(), intake: { ...base, priceText: "12.34" } },
                  {
                    id: randomUUID(),
                    intake: {
                      ...base,
                      priceState: "to-be-quoted",
                      priceText: "",
                    },
                  },
                ],
                reason: "SYNTHETIC 0033 populated upgrade",
              };
              const groupReview = await f.ok("orders/bookings/intake-review", {
                body: group,
              });
              group.review = {
                fingerprint: groupReview.fingerprint,
                acknowledged: true,
                exceptionReason: "SYNTHETIC group capacity exception",
                waiveRush: false,
                waiverReason: "",
              };
              const gd = await f.save(group, { workflow: "order.group" });
              const gp = await f.promote(gd);
              assert.equal(gp.status, 200, await gp.clone().text());
              return quickOrder;
            },
          );
          assert.equal(
            (
              await f.admin.query(
                "select count(*)::int n from information_schema.columns where table_name='garment_order' and column_name='intake_kind'",
              )
            ).rows[0].n,
            0,
            "fixture is genuinely populated schema0033 before migration",
          );
          const historical = async () =>
            (
              await f.admin.query(
                "select row_to_json(t) facts from (select o.id,o.code,o.price_state,o.price_paise,o.wearer_id,o.customer_id,o.version,s.content,s.digest from garment_order o join order_acceptance_snapshot s on s.shop_id=o.shop_id and s.order_id=o.id order by o.id) t",
              )
            ).rows;
          const before = await historical(),
            beforeCounts = await countsWithoutServices(f);
          await migrateDatabase(f.migrationConnectionString);
          assert.deepEqual(await historical(), before);
          assert.deepEqual(await countsWithoutServices(f), beforeCounts);
          assert.deepEqual(
            await f.ok(`orders/${quickOrder.id}/read`),
            quickOrder,
          );
          assert.equal(
            (await f.ok("orders/list", { body: {} })).orders.length,
            3,
          );
          await assertIsolationCatalog(f.runtime.db);
          assert.equal(
            (await counts(f)).subjects,
            0,
            "upgrade fabricates no property receipt or service subject",
          );
        } finally {
          await seed.close();
        }
      },
      {
        migrationThrough: "0033_grouped_order_acceptance.sql",
        customerPolicy: syntheticCustomerPolicy,
      },
    ),
);

async function countsWithoutServices(f) {
  return (
    await f.admin.query(
      "select (select count(*)::int from garment_order) orders,(select count(*)::int from order_capacity_demand) demand,(select count(*)::int from audit_event) audit,(select count(*)::int from durable_draft) drafts,(select count(*)::int from journal_batch) money",
    )
  ).rows[0];
}
