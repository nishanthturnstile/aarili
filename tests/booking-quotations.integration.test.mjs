import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import {
  customerQuotationSchema,
  emptyQuotation,
} from "@aarili/contracts/booking-quotations";
import {
  emptyEstimate,
  emptyEstimateLine,
} from "@aarili/contracts/garment-estimates";
import {
  currentQuotation,
  quotationDraftWorkflow,
  quotationHistory,
  readQuotation,
  reviewQuotation,
} from "@aarili/core/booking-quotations";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { listDrafts, mutateDraft } from "@aarili/core/drafts";
import { sql } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { seedBookingQuotation } from "../scripts/test-support/booking-quotation-fixtures.mjs";
import { draftUuid } from "../scripts/test-support/quotation-rate-fixtures.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const run = (f, fn, who = f.a) =>
  f.owner
    .withOwnerBookingQuotations(
      new Headers({ Cookie: who.cookie }),
      who.shop,
      fn,
    )
    .then((r) => r.data);
async function command(
  f,
  id,
  action,
  input,
  version,
  key = randomUUID(),
  change,
) {
  return run(f, (ctx) => {
    change?.(ctx);
    return mutateDraft(
      {
        shopId: f.a.shop,
        actor: { type: "user", id: f.a.user },
        repository: ctx.estimates.rates.drafts,
        workflows: new Map([
          ["pricing.quotation", quotationDraftWorkflow(ctx)],
        ]),
      },
      id,
      action,
      input,
      {
        key,
        requestId: randomUUID(),
        ...(version ? { ifMatch: `"v${version}"` } : {}),
      },
    );
  });
}
const save = async (f, v) =>
  (
    await command(f, draftUuid(), "save", {
      workflow: "pricing.quotation",
      schemaVersion: 1,
      payload: v,
    })
  ).draft;
const promote = (f, d, key = randomUUID(), change) =>
  command(f, d.id, "promote", {}, d.version, key, change);
async function reviewed(f, v) {
  let r = await run(f, (c) => reviewQuotation(c, v));
  r = await run(f, (c) => reviewQuotation(c, r.suggested));
  assert.deepEqual(r.blockers, []);
  return { ...r.suggested, review: r.fingerprint };
}
async function fixture(fn, options = {}) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      f.setup = async (
        path,
        { method = "POST", body, etag, key = randomUUID() } = {},
      ) => {
        const response = await f.api.fetch(
          new Request(`${f.owner.origin}/api/shops/${f.a.shop}/${path}`, {
            method,
            headers: {
              Origin: f.owner.origin,
              Cookie: f.a.cookie,
              "Content-Type": "application/json",
              "Idempotency-Key": key,
              ...(etag ? { "If-Match": etag } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
        assert.equal(
          response.status,
          200,
          `${path}: ${await response.clone().text()}`,
        );
        return response.json();
      };
      await fn(f);
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}
const counts = async (f) =>
  (
    await f.admin.query(
      "select (select count(*) from booking_quotation_revision) versions,(select count(*) from booking_quotation_scope) scopes,(select count(*) from booking_quotation_line) lines,(select count(*) from booking_quotation_selection) selections,(select count(*) from booking_quotation_private) costs,(select count(*) from audit_event) audits,(select count(*) from idempotency_key) keys,(select count(*) from journal_batch) journal,(select count(*) from garment_order) orders",
    )
  ).rows[0];
const accepted = async (f) =>
  (
    await f.admin.query(
      "select (select jsonb_agg(to_jsonb(c) order by id) from booking_commercial_revision c) commercial,(select jsonb_agg(content order by order_id) from order_acceptance_snapshot) snapshots,(select jsonb_agg(to_jsonb(o) order by id) from garment_order o) orders,(select jsonb_agg(to_jsonb(d) order by order_id) from order_capacity_demand d) demand",
    )
  ).rows[0];
test(
  "B-01/02/03/05/07/08 exact native package plus extras, private cost and frozen accepted prices; RLS/customer allowlist",
  { timeout: 240000 },
  () =>
    fixture(async (f) => {
      const seed = await seedBookingQuotation({
        setup: f.setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      try {
        const before = await accepted(f),
          initial = await run(f, (c) => reviewQuotation(c, seed.value));
        assert.equal(initial.customer.grossPaise, 195000);
        assert.deepEqual(
          initial.customer.lines
            .filter((l) => l.role === "reference")
            .map((l) => l.grossPaise),
          [100000, 100000],
        );
        assert.equal(
          initial.customer.lines.filter((l) => l.role === "reference").length,
          2,
        );
        const value = initial.suggested;
        value.discountDecision = {
          policyId: seed.policyId,
          eligibleKeys: initial.customer.lines
            .filter((l) => l.role === "charge")
            .map((l) => l.key),
          stacking: true,
          manual: true,
          reason:
            "SYNTHETIC explicit eligible scope and stacked owner permission",
        };
        value.discounts = [
          {
            id: randomUUID(),
            target: initial.customer.lines[0].key,
            mode: "fixed",
            valueText: "100",
            reason: "SYNTHETIC package line discount",
          },
          {
            id: randomUUID(),
            target: null,
            mode: "fixed",
            valueText: "50.01",
            reason: "SYNTHETIC booking discount",
          },
        ];
        value.sharedCost = {
          amountText: "25.01",
          reason: "SYNTHETIC PRIVATE craft cost",
        };
        const d = await save(f, await reviewed(f, value)),
          key = randomUUID();
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          (ctx) => listDrafts(ctx),
        );
        const pair = await Promise.all([
          promote(f, d, key),
          promote(f, d, key),
        ]);
        assert.deepEqual(pair[0], pair[1]);
        const id = pair[0].draft.result.id,
          r = await run(f, (c) => readQuotation(c, id));
        assert.equal(r.version.customer.totalPaise, 179999);
        assert.equal(r.version.privateCosts.shared.amountPaise, 2501);
        assert.equal(r.sourceChanged, false);
        assert.equal(r.selected, false);
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          (ctx) => listDrafts(ctx),
        );
        const bytes = JSON.stringify(r.version);
        assert.equal(
          JSON.stringify((await run(f, (c) => readQuotation(c, id))).version),
          bytes,
        );
        assert.deepEqual(await accepted(f), before);
        const publicView = await f.setup("quotations/customer", {
          body: { id },
        });
        assert(customerQuotationSchema.safeParse(publicView).success);
        assert(!JSON.stringify(publicView).includes("PRIVATE"));
        assert(!JSON.stringify(publicView).includes("privateCosts"));
        await assert.rejects(
          run(f, (c) => readQuotation(c, id), f.b),
          (e) => e.status === 404,
        );
        assert.deepEqual(
          (
            await f.runtime.db.execute(
              sql`select id from booking_quotation_revision`,
            )
          ).rows,
          [],
        );
        for (const table of [
          "booking_quotation_revision",
          "booking_quotation_line",
          "booking_quotation_private",
          "booking_quotation_scope",
        ])
          await assert.rejects(
            f.admin.query(
              `update ${table} set created_xid=pg_current_xact_id()`,
            ),
          );
        assert(
          (await assertIsolationCatalog(f.runtime.db)).includes(
            "public.booking_quotation_selection",
          ),
        );
        assert.equal((await counts(f)).journal, "0");
        const partial = {
          ...seed.value,
          orderIds: seed.value.orderIds.slice(0, 1),
        };
        assert(
          (await run(f, (c) => reviewQuotation(c, partial))).blockers.includes(
            "partial-indivisible-package",
          ),
        );
        await save(f, partial);
        const garmentGroup = seed.groups.find(
          (g) => g.basis === "garment-prices",
        );
        const single = {
          ...emptyQuotation(randomUUID()),
          orderIds: [garmentGroup.orderIds[0]],
          reason: "SYNTHETIC garment-only view of booking",
        };
        assert.equal(
          (await run(f, (c) => reviewQuotation(c, single))).customer.grossPaise,
          100000,
        );
        const serviceInput = {
          ...seed.saree.intake,
          lines: seed.saree.intake.lines.map((l, i) => ({
            ...l,
            priceState: "quoted",
            priceText: i ? "50" : "100",
          })),
        };
        const serviceReview = await f.setup("small-services/orders/review", {
          body: serviceInput,
        });
        assert.equal(serviceReview.totalPaise, 15000);
        const serviceId = await seed.config.publish("order.service", {
          ...serviceInput,
          commitmentReview: {
            fingerprint: serviceReview.fingerprint,
            acknowledged: true,
            exceptionReason: "SYNTHETIC reviewed service capacity",
            waiveRush: false,
            waiverReason: "",
          },
        });
        const standalone = await run(f, (c) =>
          reviewQuotation(c, {
            ...emptyQuotation(randomUUID()),
            orderIds: [serviceId],
            reason: "SYNTHETIC wearerless service quote",
          }),
        );
        assert.equal(standalone.customer.grossPaise, 15000);
        assert.equal(standalone.customer.lines.length, 2);
        assert(standalone.customer.lines.every((l) => l.serviceLineId));
      } finally {
        await seed.close();
      }
    }),
);
test(
  "B-06/08 overlapping family selection races, explicit predecessors, partial supersession and transactional post-write failure",
  { timeout: 240000 },
  () =>
    fixture(async (f) => {
      const seed = await seedBookingQuotation({
        setup: f.setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      try {
        const v = { ...seed.value, selection: "current" },
          a = await save(f, await reviewed(f, v)),
          b = await save(
            f,
            await reviewed(f, { ...v, familyId: randomUUID() }),
          );
        const pair = await Promise.allSettled([promote(f, a), promote(f, b)]);
        assert.equal(
          pair.filter((r) => r.status === "fulfilled").length,
          1,
          pair
            .map((r) =>
              r.status === "rejected"
                ? (r.reason.cause?.message ?? r.reason.message)
                : "ok",
            )
            .join("\n"),
        );
        assert.equal(
          pair.find((r) => r.status === "rejected").reason.status,
          409,
        );
        const winner = pair.find((r) => r.status === "fulfilled").value.draft
          .result.id;
        assert.equal(
          (await run(f, (c) => readQuotation(c, winner))).selected,
          true,
        );
        const next = await reviewed(f, {
          ...v,
          familyId: randomUUID(),
          reason: "SYNTHETIC explicit supersession",
        });
        assert.deepEqual(next.predecessors, [winner]);
        const d = await save(f, next),
          before = await counts(f),
          key = randomUUID();
        await assert.rejects(
          promote(f, d, key, (c) => {
            const append = c.repository.append;
            c.repository.append = async (v) => {
              await append(v);
              throw Error(
                "INJECTED_AFTER_QUOTATION_SELECTION_AND_PRIVATE_WRITES",
              );
            };
          }),
          /INJECTED_AFTER/,
        );
        assert.deepEqual(await counts(f), before);
        const p = await promote(f, d, key);
        assert.equal(
          (await run(f, (c) => readQuotation(c, winner))).selected,
          false,
        );
        assert.equal(
          (await run(f, (c) => readQuotation(c, p.draft.result.id))).selected,
          true,
        );
        assert.equal(
          (await run(f, (c) => quotationHistory(c, next.familyId))).versions
            .length,
          1,
        );
        assert.equal(
          (await run(f, (c) => currentQuotation(c, next.familyId))).version.id,
          p.draft.result.id,
        );
        assert.equal(
          (await f.setup("quotations/current", { body: { id: next.familyId } }))
            .version.id,
          p.draft.result.id,
        );
        await assert.rejects(
          command(f, d.id, "promote", {}, undefined),
          (e) => e.status === 428,
        );
        await assert.rejects(
          command(
            f,
            d.id,
            "save",
            {
              workflow: "pricing.quotation",
              schemaVersion: 1,
              payload: { ...next, reason: "different" },
            },
            d.version,
            key,
          ),
          (e) => e.status === 422 || e.status === 409 || e.status === 412,
        );
      } finally {
        await seed.close();
      }
    }),
);
test(
  "B-06 same family alternative CAS and expired request-cache removal preserve one durable origin",
  { timeout: 240000 },
  () =>
    fixture(async (f) => {
      const seed = await seedBookingQuotation({
        setup: f.setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      try {
        const v = await reviewed(f, seed.value),
          a = await save(f, v),
          b = await save(f, { ...v, reason: "SYNTHETIC second writer" }),
          keys = [randomUUID(), randomUUID()];
        // The second reason requires a fresh review of that exact payload.
        const bValue = await reviewed(f, {
          ...v,
          reason: "SYNTHETIC second writer",
        });
        const updated = (
          await command(
            f,
            b.id,
            "save",
            {
              workflow: "pricing.quotation",
              schemaVersion: 1,
              payload: bValue,
            },
            b.version,
          )
        ).draft;
        const results = await Promise.allSettled([
          promote(f, a, keys[0]),
          promote(f, updated, keys[1]),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          results.find((r) => r.status === "rejected").reason.status,
          412,
        );
        const i = results.findIndex((r) => r.status === "fulfilled"),
          winner = i === 0 ? a : updated,
          id = results[i].value.draft.result.id;
        const before = await counts(f);
        // Model a completed retention cleanup in this disposable request cache. Business
        // origin/history rows remain intact and must prevent a second publication.
        await f.admin.query(
          "delete from idempotency_key where shop_id=$1 and key=$2",
          [f.a.shop, keys[i]],
        );
        try {
          const retry = await promote(f, winner, keys[i]);
          assert.equal(retry.draft.result.id, id);
        } catch (error) {
          assert([409, 412].includes(error.status));
        }
        assert.equal((await counts(f)).versions, before.versions);
        assert.equal(
          (await run(f, (c) => currentQuotation(c, v.familyId))).version.id,
          id,
        );
      } finally {
        await seed.close();
      }
    }),
);
test(
  "B-02/06/07 current permission loss and stale policy cannot recover private history or overwrite agreed sources",
  { timeout: 240000 },
  () =>
    fixture(async (f) => {
      const seed = await seedBookingQuotation({
        setup: f.setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      try {
        const v = await reviewed(f, seed.value),
          d = await save(f, v),
          key = randomUUID(),
          p = await promote(f, d, key),
          before = await accepted(f);
        const frozen = JSON.stringify(
          (await run(f, (c) => readQuotation(c, p.draft.result.id))).version,
        );
        const pendingValue = structuredClone(seed.value);
        const comparison = await run(f, (c) =>
          reviewQuotation(c, pendingValue),
        );
        pendingValue.discountDecision = {
          policyId: seed.policyId,
          eligibleKeys: comparison.customer.lines
            .filter((l) => l.role === "charge")
            .map((l) => l.key),
          stacking: true,
          manual: false,
          reason: "SYNTHETIC scoped discount authorization",
        };
        pendingValue.discounts = [
          {
            id: randomUUID(),
            target: null,
            mode: "fixed",
            valueText: "10",
            reason: "SYNTHETIC discount",
          },
        ];
        const pending = await save(f, await reviewed(f, pendingValue));
        const policyDraft = await f.setup(`drafts/${seed.sourceId}`, {
          method: "GET",
        });
        await f.setup(`drafts/${seed.sourceId}`, {
          method: "PUT",
          etag: `"v${policyDraft.version}"`,
          body: {
            workflow: "shop.policies",
            schemaVersion: 1,
            payload: {
              ...policyDraft.payload,
              policy: {
                ...policyDraft.payload.policy,
                reason: "SYNTHETIC changed after discount review",
              },
            },
          },
        });
        await assert.rejects(promote(f, pending), (e) => e.status === 409);
        const changed = await run(f, (c) =>
          readQuotation(c, p.draft.result.id),
        );
        assert.equal(changed.sourceChanged, true);
        assert.equal(JSON.stringify(changed.version), frozen);
        await promote(f, d, key);
        const root = await run(f, (c) =>
          c.estimates.repository.current(randomUUID()),
        );
        assert.equal(root, undefined);
        await f.admin.query(
          "update customer_wearer_relationship set authorised=false,authorisation_declined=true where shop_id=$1 and customer_id=$2 and wearer_id=$3",
          [f.a.shop, seed.seed.customer.customerId, seed.seed.wearer.wearerId],
        );
        await assert.rejects(
          run(f, (c) => readQuotation(c, p.draft.result.id)),
          (e) => e.status === 404,
        );
        await assert.rejects(promote(f, d, key), (e) => e.status === 404);
        assert.deepEqual(await accepted(f), before);
      } finally {
        await seed.close();
      }
    }),
);
test(
  "B-08 populated 0054 upgrade retains historical estimate/source bytes and seeds no proposal or discount policy",
  { timeout: 240000 },
  () =>
    fixture(
      async (f) => {
        const seed = await seedBookingQuotation({
          setup: f.setup,
          runtime: f.runtime.pool,
          shopId: f.a.shop,
        });
        try {
          let estimate = {
            ...emptyEstimate(randomUUID()),
            pricingDate: new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),
            reason: "SYNTHETIC existing private cost history",
            target: {
              orderId: seed.customId,
              pieceId: null,
              customerId: seed.seed.customer.customerId,
              wearerId: seed.seed.wearer.wearerId,
            },
            lines: [
              {
                ...emptyEstimateLine(randomUUID()),
                sourceKey: "garment",
                labelEn: "SYNTHETIC complimentary labour",
                labelTa: "செயற்கை இலவச வேலை",
                quantityText: "1",
                state: "complimentary",
                reason: "SYNTHETIC complimentary; preserve real cost",
              },
            ],
          };
          estimate.privateCosts = [
            {
              lineId: estimate.lines[0].id,
              amountText: "25.01",
              reason: "SYNTHETIC PRIVATE internal labour",
            },
          ];
          const first = await f.setup("estimates/review", { body: estimate });
          estimate = first.suggested;
          const second = await f.setup("estimates/review", { body: estimate });
          const estimateId = await seed.config.publish("pricing.estimate", {
            ...estimate,
            review: second.fingerprint,
          });
          const historyBefore = await f.setup("estimates/read", {
              body: { id: estimateId },
            }),
            before = await accepted(f);
          await migrateDatabase(f.migrationConnectionString);
          assert.deepEqual(await accepted(f), before);
          assert.deepEqual(
            await f.setup("estimates/read", { body: { id: estimateId } }),
            historyBefore,
          );
          assert.equal((await counts(f)).versions, "0");
          assert.equal((await counts(f)).selections, "0");
          const v = emptyQuotation(randomUUID());
          const d = await save(f, v);
          assert.deepEqual(d.payload.orderIds, []);
          const review = await run(f, (c) => reviewQuotation(c, v));
          assert.equal(review.customer.complete, false);
          assert(review.blockers.includes("empty-scope"));
          const attached = {
            ...emptyQuotation(randomUUID()),
            orderIds: [seed.customId],
            estimates: [{ orderId: seed.customId, revisionId: estimateId }],
            reason: "SYNTHETIC frozen estimate source",
          };
          const q = await run(f, (c) => reviewQuotation(c, attached));
          assert.equal(q.privateCosts.estimates[0].amountPaise, 2501);
          assert.equal(q.customer.grossPaise, 0);
        } finally {
          await seed.close();
        }
      },
      { migrationThrough: "0054_garment_estimates.sql" },
    ),
);
