import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import {
  emptyEstimate,
  emptyEstimateLine,
} from "@aarili/contracts/garment-estimates";
import { emptyRate } from "@aarili/contracts/quotation-rates";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import {
  estimateDraftWorkflow,
  readEstimate,
  reviewEstimate,
} from "@aarili/core/garment-estimates";
import { sql } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { specificationSources } from "../scripts/test-support/design-specification-fixtures.mjs";
import {
  draftUuid,
  seedQuotationSources,
} from "../scripts/test-support/quotation-rate-fixtures.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { seedServiceAdditions } from "../scripts/test-support/service-additions.mjs";
import { seedSmallServices } from "../scripts/test-support/small-services.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const headers = (version, key = randomUUID()) => ({
  key,
  requestId: randomUUID(),
  ...(version ? { ifMatch: `"v${version}"` } : {}),
});
const run = (f, action, who = f.a) =>
  f.owner
    .withOwnerGarmentEstimates(
      new Headers({ Cookie: who.cookie }),
      who.shop,
      action,
    )
    .then((r) => r.data);
async function command(f, id, action, input, h, change, who = f.a) {
  return run(
    f,
    (ctx) => {
      change?.(ctx);
      return mutateDraft(
        {
          shopId: who.shop,
          actor: { type: "user", id: who.user },
          repository: ctx.rates.drafts,
          workflows: new Map([
            ["pricing.estimate", estimateDraftWorkflow(ctx)],
          ]),
        },
        id,
        action,
        input,
        h,
      );
    },
    who,
  );
}
const save = async (f, v) =>
  (
    await command(
      f,
      draftUuid(),
      "save",
      { workflow: "pricing.estimate", schemaVersion: 1, payload: v },
      headers(),
    )
  ).draft;
const promote = (f, d, key = randomUUID(), change) =>
  command(f, d.id, "promote", {}, headers(d.version, key), change);
async function reviewed(f, v) {
  const initial = await run(f, (ctx) => reviewEstimate(ctx, v));
  const next = initial.suggested;
  const r = await run(f, (ctx) => reviewEstimate(ctx, next));
  assert.equal(r.stale, false);
  assert.deepEqual(r.invalid, []);
  return { ...next, review: r.fingerprint };
}
const value = () => {
  const v = emptyEstimate(randomUUID());
  v.pricingDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  v.reason = "SYNTHETIC reviewed estimate";
  v.lines = [
    {
      ...emptyEstimateLine(randomUUID()),
      labelEn: "SYNTHETIC blouse",
      labelTa: "செயற்கை ரவிக்கை",
      quantityText: "1",
    },
  ];
  return v;
};
const fixture = (fn, options = {}) =>
  withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      return fn(f);
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
const counts = async (f) =>
  (
    await f.admin.query(
      "select (select count(*) from garment_estimate_revision) versions,(select count(*) from garment_estimate_line) lines,(select count(*) from garment_estimate_cost) costs,(select count(*) from audit_event) audits,(select count(*) from idempotency_key) keys,(select count(*) from journal_batch) journal,(select count(*) from garment_order) orders",
    )
  ).rows[0];

test(
  "A2-01/03/06 standalone wearerless service keeps exact subject/line sources and creates no commitment changes",
  { timeout: 240000 },
  () =>
    fixture(async (f) => {
      const setup = async (
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
      const source = await seedSmallServices({
        setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      try {
        const input = source.saree.intake,
          r = await setup("small-services/orders/review", { body: input });
        const payload = {
          ...input,
          commitmentReview: {
            fingerprint: r.fingerprint,
            acknowledged: true,
            exceptionReason: r.commitment.evaluation.warnings.length
              ? "SYNTHETIC exception"
              : "",
            waiveRush: false,
            waiverReason: "",
          },
        };
        const d = (
          await setup(`drafts/${draftUuid()}`, {
            method: "PUT",
            body: { workflow: "order.service", schemaVersion: 1, payload },
          })
        ).draft;
        const accepted = await setup(`drafts/${d.id}/promote`, {
          body: {},
          etag: `"v${d.version}"`,
        });
        const order = await setup(
          `small-services/orders/${accepted.draft.result.id}`,
          { method: "GET" },
        );
        const before = (
          await f.admin.query(
            "select to_jsonb(o) header,s.content,s.digest from garment_order o join order_acceptance_snapshot s on(s.shop_id,s.order_id)=(o.shop_id,o.id)",
          )
        ).rows;
        const v = value();
        v.target = {
          orderId: order.id,
          pieceId: null,
          customerId: input.customerId,
          wearerId: null,
        };
        const first = await run(f, (ctx) => reviewEstimate(ctx, v));
        assert.equal(first.source.kind, "service");
        assert.equal(first.source.wearerId, null);
        v.lines[0].sourceKey = first.source.candidates[0].key;
        v.lines[0].component = "alteration";
        const saved = await save(f, await reviewed(f, v)),
          result = await promote(f, saved),
          version = (
            await run(f, (ctx) => readEstimate(ctx, result.draft.result.id))
          ).version;
        assert.equal(version.source.orderId, order.id);
        assert.equal(version.source.serviceSubjectId, input.subjectId);
        assert.equal(
          version.input.lines[0].sourceKey,
          first.source.candidates[0].key,
        );
        assert.deepEqual(
          (
            await f.admin.query(
              "select to_jsonb(o) header,s.content,s.digest from garment_order o join order_acceptance_snapshot s on(s.shop_id,s.order_id)=(o.shop_id,o.id)",
            )
          ).rows,
          before,
        );
        assert.equal((await counts(f)).journal, "0");
        const grouped = await seedServiceAdditions({
          setup,
          runtime: f.runtime.pool,
          shopId: f.a.shop,
          services: source,
        });
        for (const group of grouped.groups) {
          const detail = await setup("orders/bookings/read", {
            body: { id: group.revisionId, revision: true },
          });
          const original = detail.orders[0],
            value = emptyEstimate(randomUUID());
          value.pricingDate = v.pricingDate;
          value.reason = "SYNTHETIC grouped estimate";
          value.target = {
            orderId: original.id,
            pieceId: null,
            customerId: original.intake.customerId,
            wearerId: original.intake.wearerId,
          };
          value.lines = [
            {
              ...emptyEstimateLine(randomUUID()),
              sourceKey: "garment",
              labelEn: "SYNTHETIC group garment",
              labelTa: "செயற்கை குழு ஆடை",
              quantityText: "1",
            },
          ];
          const frozen = await f.admin.query(
            "select to_jsonb(c) content from booking_commercial_revision c where shop_id=$1 and booking_id=$2",
            [f.a.shop, detail.booking.id],
          );
          const saved = await save(f, await reviewed(f, value)),
            result = await promote(f, saved),
            read = (
              await run(f, (ctx) => readEstimate(ctx, result.draft.result.id))
            ).version;
          assert.equal(read.source.bookingId, detail.booking.id);
          assert.equal(
            read.source.packageIncluded,
            group.basis === "package-proposal",
          );
          assert(read.source.commercialId);
          assert.deepEqual(
            (
              await f.admin.query(
                "select to_jsonb(c) content from booking_commercial_revision c where shop_id=$1 and booking_id=$2",
                [f.a.shop, detail.booking.id],
              )
            ).rows,
            frozen.rows,
          );
          assert.equal(read.customer.totalPaise, null);
        }
      } finally {
        await source.close();
      }
    }),
);

test(
  "A2-05/06 Q-01/03 exact rate refresh is explicit; old estimate prices/costs survive catalogue replacement",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const seed = await seedQuotationSources(f.runtime.pool, f.a.shop),
        v = value();
      const rate = {
        ...emptyRate(randomUUID()),
        source: { entryId: seed.source.entryId, revisionId: seed.source.id },
        component: "labour",
        unit: "item",
        basisText: "1",
        reason: "SYNTHETIC reviewed rate",
        entries: [
          {
            entryId: randomUUID(),
            from: v.pricingDate,
            until: "",
            rateText: "100.01",
          },
        ],
      };
      const publishRate = async (payload) => {
        const draft = (
          await f.owner.withOwnerDraft(
            new Headers({ Cookie: f.a.cookie }),
            f.a.shop,
            (ctx) =>
              mutateDraft(
                ctx,
                draftUuid(),
                "save",
                { workflow: "pricing.rate", schemaVersion: 1, payload },
                headers(),
              ),
          )
        ).data.draft;
        return (
          await f.owner.withOwnerDraft(
            new Headers({ Cookie: f.a.cookie }),
            f.a.shop,
            (ctx) =>
              mutateDraft(ctx, draft.id, "promote", {}, headers(draft.version)),
          )
        ).data.draft.result.id;
      };
      const rateVersion = await publishRate(rate);
      Object.assign(v.lines[0], {
        state: "charge",
        mode: "rate",
        rateId: rate.rateId,
      });
      v.privateCosts = [
        {
          lineId: v.lines[0].id,
          amountText: "25.01",
          reason: "SYNTHETIC cost independent of selling",
        },
      ];
      const draft = await save(f, await reviewed(f, v)),
        result = await promote(f, draft),
        old = (await run(f, (ctx) => readEstimate(ctx, result.draft.result.id)))
          .version,
        bytes = JSON.stringify(old);
      assert.equal(old.customer.totalPaise, 10001);
      const pendingValue = await reviewed(f, {
          ...old.input,
          baseVersion: 1,
          baseRevisionId: old.id,
          review: null,
          reason: "SYNTHETIC next estimate",
        }),
        pending = await save(f, pendingValue);
      await publishRate({
        ...rate,
        baseVersion: 1,
        baseRevisionId: rateVersion,
        entries: [{ ...rate.entries[0], rateText: "200.02" }],
      });
      const read = await run(f, (ctx) => readEstimate(ctx, old.id));
      assert.equal(read.sourceChanged, true);
      assert.equal(JSON.stringify(read.version), bytes);
      await assert.rejects(promote(f, pending), (e) => e.status === 409);
      const proposal = await run(f, (ctx) => reviewEstimate(ctx, pendingValue));
      assert.equal(proposal.stale, true);
      assert.equal(proposal.customer.totalPaise, 10001);
      assert.equal(proposal.suggested.lines[0].rateText, "200.02");
      const refreshed = await save(f, await reviewed(f, proposal.suggested)),
        latest = await promote(f, refreshed),
        final = (
          await run(f, (ctx) => readEstimate(ctx, latest.draft.result.id))
        ).version;
      assert.equal(final.customer.totalPaise, 20002);
      assert.equal(final.costs[0].amountPaise, 2501);
      assert.equal((await counts(f)).journal, "0");
    }),
);

test(
  "A2-01/02/03/04/07 Q-02/04/10/11 real incomplete estimates, exact costs, customer projection, immutable history and retry",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const v = value();
      const d = await save(f, await reviewed(f, v)),
        key = randomUUID();
      const results = await Promise.all([
        promote(f, d, key),
        promote(f, d, key),
      ]);
      assert.deepEqual(results[0], results[1]);
      const id = results[0].draft.result.id,
        first = await run(f, (ctx) => readEstimate(ctx, id));
      assert.equal(first.version.customer.totalPaise, null);
      assert.equal(first.version.customer.unknownCount, 1);
      const old = JSON.stringify(first.version);
      const next = {
        ...first.version.input,
        baseVersion: 1,
        baseRevisionId: id,
        reason: "SYNTHETIC complimentary revision",
        lines: first.version.input.lines.map((l) => ({
          ...l,
          state: "complimentary",
          reason: "SYNTHETIC owner approved complimentary work",
        })),
        privateCosts: [
          {
            lineId: v.lines[0].id,
            amountText: "25.01",
            reason: "SYNTHETIC real private labour estimate",
          },
        ],
        review: null,
      };
      const changed = await save(f, await reviewed(f, next));
      const second = await promote(f, changed);
      const record = await run(f, (ctx) =>
        readEstimate(ctx, second.draft.result.id),
      );
      assert.equal(record.version.customer.totalPaise, 0);
      assert.equal(record.version.costs[0].amountPaise, 2501);
      assert.equal(record.version.estimatedMarginPaise, -2501);
      assert.equal(record.version.actualCost, "unavailable");
      assert.equal(
        JSON.stringify((await run(f, (ctx) => readEstimate(ctx, id))).version),
        old,
      );
      const response = await f.api.fetch(
        new Request(
          `${f.owner.origin}/api/shops/${f.a.shop}/estimates/customer`,
          {
            method: "POST",
            headers: {
              Cookie: f.a.cookie,
              Origin: f.owner.origin,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: record.version.id }),
          },
        ),
      );
      assert.equal(response.status, 200, await response.clone().text());
      const json = await response.text();
      assert(!json.includes("private"));
      assert(!json.includes("2501"));
      assert(!json.includes("cost"));
      assert(!json.includes("margin"));
      await assert.rejects(
        run(f, (ctx) => readEstimate(ctx, id), f.b),
        (e) => e.status === 404,
      );
      for (const table of [
        "garment_estimate_revision",
        "garment_estimate_line",
        "garment_estimate_cost",
      ])
        await assert.rejects(
          f.admin.query(`update ${table} set shop_id=shop_id`),
        );
      assert(
        (await assertIsolationCatalog(f.runtime.db)).includes(
          "public.garment_estimate_cost",
        ),
      );
      assert.deepEqual(
        (await f.runtime.db.execute(sql`select * from garment_estimate_cost`))
          .rows,
        [],
      );
      const end = await counts(f);
      assert.equal(end.journal, "0");
      assert.equal(end.orders, "0");
    }),
);
test(
  "A2-05/07 Q-03/10/11 same-base races, stale review, missing/stale preconditions and post-child rollback",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const v = value();
      v.lines[0] = {
        ...v.lines[0],
        state: "charge",
        fixedText: "100.01",
        reason: "SYNTHETIC reviewed fixed amount",
      };
      const a = await save(f, await reviewed(f, v)),
        b = await save(f, await reviewed(f, v));
      const race = await Promise.allSettled([promote(f, a), promote(f, b)]);
      assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        race.find((r) => r.status === "rejected").reason.status,
        412,
      );
      const winner = race.find((r) => r.status === "fulfilled").value.draft
          .result.id,
        prior = (await run(f, (ctx) => readEstimate(ctx, winner))).version;
      const candidate = await save(
        f,
        await reviewed(f, {
          ...prior.input,
          baseVersion: 1,
          baseRevisionId: prior.id,
          reason: "SYNTHETIC injected failure",
          review: null,
        }),
      );
      const before = await counts(f),
        key = randomUUID();
      await assert.rejects(
        promote(f, candidate, key, (ctx) => {
          const append = ctx.repository.append;
          ctx.repository.append = async (v) => {
            await append(v);
            throw Error("INJECTED_AFTER_ESTIMATE_COST_CHILDREN");
          };
        }),
        /INJECTED_AFTER_ESTIMATE_COST_CHILDREN/,
      );
      assert.deepEqual(await counts(f), before);
      await assert.rejects(
        command(
          f,
          candidate.id,
          "promote",
          {},
          { key: randomUUID(), requestId: randomUUID() },
        ),
        (e) => e.status === 428,
      );
      await assert.rejects(
        command(f, candidate.id, "promote", {}, headers(999)),
        (e) => e.status === 412,
      );
      const poisoned = await save(f, {
        ...candidate.payload,
        review: "0".repeat(64),
      });
      await assert.rejects(promote(f, poisoned), (e) => e.status === 409);
      await promote(f, candidate, key);
      assert.equal((await counts(f)).versions, "2");
    }),
);
test(
  "A2-01/06/07 populated 0053 upgrade preserves accepted order bytes; exact attachment and revoked subject authority",
  { timeout: 240000 },
  () =>
    fixture(
      async (f) => {
        const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
        try {
          const sources = await specificationSources(f, {
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          });
          const accepted = await sources.accept();
          const snapshot = async () =>
            (
              await f.admin.query(
                "select to_jsonb(o) order_row,s.content,s.digest from garment_order o join order_acceptance_snapshot s on(s.shop_id,s.order_id)=(o.shop_id,o.id) order by o.id",
              )
            ).rows;
          const before = await snapshot();
          await migrateDatabase(f.migrationConnectionString);
          assert.deepEqual(await snapshot(), before);
          assert.equal((await counts(f)).versions, "0");
          const v = value();
          v.target = {
            orderId: accepted.order.id,
            pieceId: accepted.pieces.identities[0]?.id ?? null,
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          };
          assert(v.target.pieceId, "Native piece fixture must be materialized");
          v.lines[0].sourceKey = "garment";
          const first = await save(f, await reviewed(f, v));
          const result = await promote(f, first);
          const stored = (
            await run(f, (ctx) => readEstimate(ctx, result.draft.result.id))
          ).version;
          assert.equal(
            stored.source.acceptedDigest,
            accepted.order.snapshotDigest,
          );
          assert.equal(stored.source.acceptedPaise, 0);
          assert.deepEqual(await snapshot(), before);
          const foreign = {
            ...v,
            target: { ...v.target, customerId: randomUUID() },
          };
          await assert.rejects(save(f, foreign), (e) => e.status === 404);
          await f.admin.query(
            "update customer_wearer_relationship set authorised=false,authorisation_declined=true where shop_id=$1 and wearer_id=$2",
            [f.a.shop, seed.wearer.wearerId],
          );
          await assert.rejects(
            run(f, (ctx) => readEstimate(ctx, stored.id)),
            (e) => e.status === 404,
          );
          await assert.rejects(promote(f, first), (e) => e.status === 404);
          assert.deepEqual(await snapshot(), before);
        } finally {
          await seed.close();
        }
      },
      { migrationThrough: "0053_quotation_rates.sql" },
    ),
);
