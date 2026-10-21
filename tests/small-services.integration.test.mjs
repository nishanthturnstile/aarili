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
import { seedServiceAdditions } from "../scripts/test-support/service-additions.mjs";
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
async function fixture(work, options = {}) {
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
        taskLinked: options.taskLinked ?? false,
      });
      try {
        await work(f);
      } finally {
        await f.services.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}
const fresh = (v) => ({
  ...structuredClone(v),
  subjectId: randomUUID(),
  lines: v.lines.map((l) => ({ ...l, id: randomUUID() })),
  commitmentReview: null,
});
test(
  "SS-C/ORD-14 taskless completion is independent, corrected by linked history, retry safe and capacity neutral",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const accepted = await f.accept(f.services.saree.intake),
        id = accepted.order.id;
      const path = `small-services/progress/${id}`;
      const view = await f.ok(path, { method: "GET" });
      assert.equal(view.lines.length, 2);
      assert.equal(view.summary.pending, 2);
      const line = view.lines[0],
        key = randomUUID();
      const body = {
        commandId: randomUUID(),
        action: "complete",
        orderVersion: view.orderVersion,
        scopeDigest: view.scopeDigest,
        sourceId: line.sourceId,
        sourceDigest: line.sourceDigest,
        attested: true,
        note: "SYNTHETIC owner checked fall work",
      };
      const target = `${path}/lines/${line.line.id}`;
      const before = await counts(f);
      assert.equal((await f.request(target, { body })).status, 428);
      assert.equal(
        (await f.request(target, { body: { ...body, note: "" }, etag: '"v1"' }))
          .status,
        422,
      );
      const r = await f.request(target, { body, etag: '"v1"', key });
      assert.equal(r.status, 200, await r.clone().text());
      const result = await r.json();
      assert.equal(result.version, 2);
      assert.deepEqual(await f.ok(target, { body, etag: '"v1"', key }), result);
      assert.equal(
        (
          await f.request(target, {
            body: { ...body, sourceId: randomUUID() },
            etag: '"v1"',
            key,
          })
        ).status,
        422,
        "changed bound source is a payload mismatch, after current authorization",
      );
      const after = await f.ok(path, { method: "GET" });
      assert.equal(after.summary.completed, 1);
      assert.equal(after.summary.pending, 1);
      const done = after.lines.find((l) => l.line.id === line.line.id);
      assert.equal(done.history.length, 1);
      assert.equal(done.history[0].note, body.note);
      assert.equal((await counts(f)).demand, before.demand);
      const { audit: beforeAudit, keys: beforeKeys, ...beforeEffects } = before;
      const {
        audit: afterAudit,
        keys: afterKeys,
        ...afterEffects
      } = await counts(f);
      assert.deepEqual(
        afterEffects,
        beforeEffects,
        "completion changes no money, queue, requirements, property, garment or demand rows",
      );
      assert.equal(afterAudit, beforeAudit + 1);
      assert.equal(afterKeys, beforeKeys + 1);
      assert.deepEqual(
        await f.ok(`small-services/orders/${id}`, { method: "GET" }),
        accepted.order,
      );
      assert.equal(
        (
          await f.request(target, {
            body: { ...body, commandId: randomUUID() },
            etag: '"v1"',
          })
        ).status,
        412,
      );
      assert.equal(
        (
          await f.request(target, {
            body: { ...body, note: "changed" },
            etag: '"v1"',
            key,
          })
        ).status,
        422,
      );
      const correction = {
        commandId: randomUUID(),
        action: "correct",
        orderVersion: after.orderVersion,
        scopeDigest: after.scopeDigest,
        sourceId: line.sourceId,
        sourceDigest: line.sourceDigest,
        correctionOf: result.transitionId,
        reason: "SYNTHETIC completion entered against wrong line",
      };
      const corrected = await f.ok(target, { body: correction, etag: '"v2"' });
      assert.equal(corrected.version, 3);
      const final = await f.ok(path, { method: "GET" });
      assert.equal(final.summary.pending, 2);
      assert.equal(
        final.lines.find((l) => l.line.id === line.line.id).history.length,
        2,
      );
      assert.equal(
        (await f.request(path, { method: "GET", who: f.b })).status,
        404,
      );
    }),
);
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
  "SS-C expand migration retains existing A/B snapshots, grouped scope and demand, with initial progress version one",
  { timeout: 240000 },
  async () =>
    fixture(
      async (f) => {
        const standalone = await f.accept(f.services.saree.intake);
        const additions = await seedServiceAdditions({
          setup: f.ok,
          runtime: f.runtime.pool,
          shopId: f.a.shop,
          services: f.services,
        });
        const value = structuredClone(additions.change),
          r = await f.ok("small-services/changes/review", { body: value });
        assert.deepEqual(r.issues, []);
        value.review = {
          fingerprint: r.fingerprint,
          acknowledged: true,
          exceptionReason: "SYNTHETIC upgrade reviewed addition",
          waiveRush: false,
          waiverReason: "",
        };
        const d = await f.ok(`drafts/${additions.changeDraftId}`, {
          method: "GET",
        });
        const saved = await f.save(value, {
          id: d.id,
          workflow: "order.service-change",
          etag: `"v${d.version}"`,
        });
        const accepted = await f.promote(saved);
        assert.equal(accepted.status, 200, await accepted.clone().text());
        const packageOrderId = additions.groups[1].orderIds[0],
          packageScope = await f.ok(`small-services/scope/${packageOrderId}`, {
            method: "GET",
          });
        const packageChange = {
          ...structuredClone(value),
          orderId: packageOrderId,
          version: packageScope.version,
          originalDigest: packageScope.originalDigest,
          scopeDigest: packageScope.scopeDigest,
          commercial: "outside-package",
          lines: value.lines.map((l) => ({ ...l, id: randomUUID() })),
          review: null,
        };
        const packageReview = await f.ok("small-services/changes/review", {
          body: packageChange,
        });
        assert.deepEqual(packageReview.issues, []);
        packageChange.review = {
          ...value.review,
          fingerprint: packageReview.fingerprint,
        };
        const packageDraft = await f.save(packageChange, {
          workflow: "order.service-change",
        });
        assert.equal((await f.promote(packageDraft)).status, 200);
        const frozen = async () => ({
          snapshots: (
            await f.admin.query(
              "select * from order_acceptance_snapshot order by order_id",
            )
          ).rows,
          changes: (
            await f.admin.query(
              "select * from order_service_change order by id",
            )
          ).rows,
          demand: (
            await f.admin.query(
              "select * from order_capacity_demand order by order_id",
            )
          ).rows,
          contributions: (
            await f.admin.query(
              "select * from order_service_capacity_contribution order by change_id",
            )
          ).rows,
          commercial: (
            await f.admin.query(
              "select * from booking_commercial_revision order by id",
            )
          ).rows,
        });
        const before = await frozen();
        await migrateDatabase(f.migrationConnectionString);
        await assertIsolationCatalog(f.runtime.db);
        assert.deepEqual(await frozen(), before);
        for (const id of [
          standalone.order.id,
          additions.customId,
          packageOrderId,
        ]) {
          const v = await f.ok(`small-services/progress/${id}`, {
            method: "GET",
          });
          assert.equal(v.lines.length, 2);
          assert(
            v.lines.every(
              (l) =>
                l.version === 1 &&
                l.state === "pending" &&
                l.history.length === 0,
            ),
          );
        }
        const v = await f.ok(`small-services/progress/${additions.customId}`, {
            method: "GET",
          }),
          l = v.lines[0];
        const body = {
          commandId: randomUUID(),
          action: "complete",
          orderVersion: v.orderVersion,
          scopeDigest: v.scopeDigest,
          sourceId: l.sourceId,
          sourceDigest: l.sourceDigest,
          attested: true,
          note: "SYNTHETIC existing supplemental line checked",
        };
        await f.ok(`small-services/progress/${v.orderId}/lines/${l.line.id}`, {
          body,
          etag: '"v1"',
        });
        assert.deepEqual(await frozen(), before);
        const packageProgress = await f.ok(
            `small-services/progress/${packageOrderId}`,
            { method: "GET" },
          ),
          packageLine = packageProgress.lines[0];
        await f.ok(
          `small-services/progress/${packageOrderId}/lines/${packageLine.line.id}`,
          {
            etag: '"v1"',
            body: {
              ...body,
              commandId: randomUUID(),
              orderVersion: packageProgress.orderVersion,
              scopeDigest: packageProgress.scopeDigest,
              sourceId: packageLine.sourceId,
              sourceDigest: packageLine.sourceDigest,
            },
          },
        );
        assert.equal(
          (
            await f.ok(`small-services/progress/${packageOrderId}`, {
              method: "GET",
            })
          ).summary.pending,
          1,
        );
        assert.equal(
          (
            await f.ok(
              `small-services/progress/${additions.groups[1].orderIds[1]}`,
              { method: "GET" },
            )
          ).lines.length,
          0,
          "completion does not add lines to a sibling garment",
        );
        assert.deepEqual(
          await frozen(),
          before,
          "group membership, frozen package proposal and supplemental demand survive completion",
        );
        const pending = v.lines[1];
        let entered, release;
        const ready = new Promise((r) => {
            entered = r;
          }),
          gate = new Promise((r) => {
            release = r;
          });
        const changing = f.owner.withOwnerQuickOrder(
          new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
          f.a.shop,
          async (ctx) => {
            const { changeOrderPresentation } = await import(
              "@aarili/core/orders"
            );
            const result = await changeOrderPresentation(
              ctx,
              v.orderId,
              { mode: "detailed" },
              {
                key: randomUUID(),
                requestId: randomUUID(),
                ifMatch: `"v${v.orderVersion}"`,
              },
            );
            entered();
            await gate;
            return result;
          },
        );
        await Promise.race([
          ready,
          changing.then(() => assert.fail("SS-C parent write barrier missed")),
        ]);
        const completing = f.request(
          `small-services/progress/${v.orderId}/lines/${pending.line.id}`,
          {
            etag: '"v1"',
            body: {
              ...body,
              commandId: randomUUID(),
              sourceId: pending.sourceId,
              sourceDigest: pending.sourceDigest,
            },
          },
        );
        try {
          await waitForLock(f);
        } finally {
          release();
        }
        await changing;
        assert.equal(
          (await completing).status,
          412,
          "SS-C parent scope change wins the actual aggregate lock race",
        );
        assert.equal(
          (
            await f.ok(`small-services/progress/${v.orderId}`, {
              method: "GET",
            })
          ).summary.pending,
          1,
        );
      },
      { migrationThrough: "0035_service_order_addons.sql" },
    ),
);

test(
  "SS-C NR and task-linked lines cannot be attested; illegal scope, order and correction references fail closed",
  { timeout: 240000 },
  async () =>
    fixture(
      async (f) => {
        const value = fresh(f.services.saree.intake);
        value.lines.push({
          id: randomUUID(),
          key: "pre-pleating",
          requestedWork: "",
          priceState: "to-be-quoted",
          priceText: "",
          notRequired: true,
          notRequiredReason: "SYNTHETIC explicitly not requested",
        });
        const accepted = await f.accept(value),
          task = await f.accept(f.services.kurti.intake);
        for (const [id, blocked] of [
          [accepted.order.id, "not-required"],
          [task.order.id, "task-linked"],
        ]) {
          const v = await f.ok(`small-services/progress/${id}`, {
              method: "GET",
            }),
            l = v.lines.find((l) => l.blocked === blocked);
          assert(l);
          assert.equal(l.eligible, false);
          const body = {
            commandId: randomUUID(),
            action: "complete",
            orderVersion: v.orderVersion,
            scopeDigest: v.scopeDigest,
            sourceId: l.sourceId,
            sourceDigest: l.sourceDigest,
            attested: true,
            note: "SYNTHETIC cannot override applicability or execution",
          };
          const target = `small-services/progress/${id}/lines/${l.line.id}`;
          assert.equal(
            (await f.request(target, { body, etag: '"v1"' })).status,
            409,
          );
          assert.equal(
            (
              await f.request(target, {
                body: { ...body, attested: false },
                etag: '"v1"',
              })
            ).status,
            422,
          );
          assert.equal(
            (
              await f.request(target, {
                body: { ...body, sourceId: randomUUID() },
                etag: '"v1"',
              })
            ).status,
            409,
          );
          assert.equal(
            (
              await f.request(
                `small-services/progress/${randomUUID()}/lines/${l.line.id}`,
                { body, etag: '"v1"' },
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await f.request(
                `small-services/progress/${id}/lines/${randomUUID()}`,
                { body, etag: '"v1"' },
              )
            ).status,
            404,
          );
        }
        const v = await f.ok(`small-services/progress/${accepted.order.id}`, {
            method: "GET",
          }),
          l = v.lines.find((l) => l.eligible);
        const correction = {
          commandId: randomUUID(),
          action: "correct",
          orderVersion: v.orderVersion,
          scopeDigest: v.scopeDigest,
          sourceId: l.sourceId,
          sourceDigest: l.sourceDigest,
          correctionOf: randomUUID(),
          reason: "SYNTHETIC cannot correct pending work",
        };
        assert.equal(
          (
            await f.request(
              `small-services/progress/${v.orderId}/lines/${l.line.id}`,
              { body: correction, etag: '"v1"' },
            )
          ).status,
          409,
        );
      },
      { taskLinked: true },
    ),
);

test(
  "SS-C AC-55/60 actual-write rollback, concurrent CAS, durable replay and audited note erasure",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const accepted = await f.accept(f.services.saree.intake),
        id = accepted.order.id,
        path = `small-services/progress/${id}`;
      let view = await f.ok(path, { method: "GET" });
      const line = view.lines[0],
        target = `${path}/lines/${line.line.id}`;
      const body = {
          commandId: randomUUID(),
          action: "complete",
          orderVersion: view.orderVersion,
          scopeDigest: view.scopeDigest,
          sourceId: line.sourceId,
          sourceDigest: line.sourceDigest,
          attested: true,
          note: "SYNTHETIC erasable evidence",
        },
        key = randomUUID();
      const state = async () => ({
        base: await counts(f),
        rows: (
          await f.admin.query(
            "select (select count(*)::int from service_line_transition) history,(select count(*)::int from service_line_current) current,(select count(*)::int from service_line_evidence) evidence",
          )
        ).rows[0],
      });
      const before = await state();
      await assert.rejects(
        f.owner.withOwnerSmallServices(
          new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
          f.a.shop,
          async (ctx) => {
            const { commandServiceLine } = await import(
              "@aarili/core/small-services"
            );
            return commandServiceLine(
              {
                ...ctx,
                repository: {
                  ...ctx.repository,
                  progress: {
                    ...ctx.repository.progress,
                    persist: (k, b, r) =>
                      ctx.repository.progress.persist(k, b, {
                        ...r,
                        note: "SYNTHETIC notes must never enter replay JSON",
                      }),
                  },
                },
              },
              id,
              line.line.id,
              body,
              { key, ifMatch: '"v1"', requestId: randomUUID() },
            );
          },
        ),
        (e) => e.code === "23514" || e.cause?.code === "23514",
      );
      assert.deepEqual(
        await state(),
        before,
        "deferred guard rejects nonminimal replay atomically",
      );
      for (const table of [
        "audit_event",
        "service_line_transition",
        "service_line_current",
        "service_line_evidence",
        "idempotency_key",
      ]) {
        await f.admin.query(
          `CREATE FUNCTION synthetic_line_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC actual service completion write fault';END$$; CREATE TRIGGER synthetic_line_fault AFTER INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION synthetic_line_fault()`,
        );
        try {
          assert.equal(
            (await f.request(target, { body, key, etag: '"v1"' })).status,
            503,
          );
          assert.deepEqual(await state(), before);
        } finally {
          await f.admin.query(
            `DROP TRIGGER synthetic_line_fault ON ${table}; DROP FUNCTION synthetic_line_fault()`,
          );
        }
      }
      const results = await Promise.all([
        f.request(target, { body, key, etag: '"v1"' }),
        f.request(target, {
          body: { ...body, commandId: randomUUID() },
          etag: '"v1"',
        }),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 412]);
      const winner = await results.find((r) => r.status === 200).json();
      const persisted = (
        await f.admin.query(
          "select command_key as key,command_id as id from service_line_transition where id=$1",
          [winner.transitionId],
        )
      ).rows[0];
      const winningBody = { ...body, commandId: persisted.id };
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, persisted.key],
      );
      assert.deepEqual(
        await f.ok(target, {
          body: winningBody,
          key: persisted.key,
          etag: '"v1"',
        }),
        winner,
        "durable history survives expired response keys",
      );
      assert.equal(
        (await f.request(target, { body: winningBody, etag: '"v1"' })).status,
        409,
        "command identity cannot move to a new key",
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`select redact_service_line_note(${f.a.shop}::uuid,${winner.transitionId}::uuid,${randomUUID()}::uuid)`,
          ),
        ),
        (e) => e.cause?.code === "42501",
      );
      const client = await f.admin.connect();
      try {
        await client.query(
          "CREATE TEMP TABLE service_line_evidence(note text); CREATE TEMP TABLE audit_event(note text)",
        );
        for (const shop of [null, f.b.shop]) {
          await client.query("begin");
          await client.query("set local role app_privacy");
          if (shop)
            await client.query(
              "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
              [f.a.user, shop],
            );
          await assert.rejects(
            client.query("select redact_service_line_note($1,$2,$3)", [
              f.a.shop,
              winner.transitionId,
              randomUUID(),
            ]),
            (e) => e.code === "42501",
          );
          await client.query("rollback");
        }
        await client.query("begin");
        await client.query("set local role app_privacy");
        await client.query(
          "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
          [f.a.user, f.a.shop],
        );
        await client.query("select redact_service_line_note($1,$2,$3)", [
          f.a.shop,
          winner.transitionId,
          randomUUID(),
        ]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        await client.query(
          "DROP TABLE IF EXISTS pg_temp.service_line_evidence,pg_temp.audit_event",
        );
        client.release();
      }
      view = await f.ok(path, { method: "GET" });
      const history = view.lines.find(
        (l) => l.line.id === line.line.id,
      ).history;
      assert.equal(history[0].note, null);
      assert.equal(history[0].redacted, true);
      assert.deepEqual(
        await f.ok(target, {
          body: winningBody,
          key: persisted.key,
          etag: '"v1"',
        }),
        winner,
      );
      assert.equal(JSON.stringify(winner).includes(body.note), false);
      assert.equal((await state()).rows.history, 1);
      const correction = {
        commandId: randomUUID(),
        action: "correct",
        orderVersion: view.orderVersion,
        scopeDigest: view.scopeDigest,
        sourceId: line.sourceId,
        sourceDigest: line.sourceDigest,
        correctionOf: winner.transitionId,
        reason: "SYNTHETIC concurrent correction",
      };
      const corrections = await Promise.all([
        f.request(target, { body: correction, etag: '"v2"' }),
        f.request(target, {
          body: { ...correction, commandId: randomUUID() },
          etag: '"v2"',
        }),
      ]);
      assert.deepEqual(corrections.map((r) => r.status).sort(), [200, 412]);
      view = await f.ok(path, { method: "GET" });
      const independent = await Promise.all(
        view.lines.map((l) =>
          f.request(`${path}/lines/${l.line.id}`, {
            etag: `"v${l.version}"`,
            body: {
              commandId: randomUUID(),
              action: "complete",
              orderVersion: view.orderVersion,
              scopeDigest: view.scopeDigest,
              sourceId: l.sourceId,
              sourceDigest: l.sourceDigest,
              attested: true,
              note: "SYNTHETIC independently checked line",
            },
          }),
        ),
      );
      assert.deepEqual(
        independent.map((r) => r.status),
        [200, 200],
      );
      assert.equal((await f.ok(path, { method: "GET" })).summary.completed, 2);
      assert.equal(
        (await f.runtime.db.execute(sql`select * from service_line_transition`))
          .rows.length,
        0,
        "missing tenant context fails closed",
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update service_line_current set version=version+1 where shop_id=${f.a.shop}::uuid and line_id=${line.line.id}::uuid`,
          ),
        ),
        (e) => e.cause?.code === "23514",
      );
      assert.deepEqual(
        await f.ok(`small-services/orders/${id}`, { method: "GET" }),
        accepted.order,
      );
    }),
);

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
      const custom = {
        ...emptyQuickOrder(),
        customerId: c.id,
        wearerId: w.wearerId,
        manifest: f.services.kurti.profile.content.manifest,
        deliveryDate: value.deliveryDate,
        presentationRevisionId: value.presentationRevisionId,
      };
      const cr = await f.ok("orders/review", { body: custom });
      custom.commitmentReview = {
        fingerprint: cr.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC reviewed minor work",
        waiveRush: false,
        waiverReason: "",
      };
      const cd = await f.save(custom, { workflow: "order.quick" }),
        cp = await f.promote(cd);
      assert.equal(cp.status, 200, await cp.clone().text());
      const customId = (await cp.json()).draft.result.id;
      const scope = await f.ok(`small-services/scope/${customId}`, {
        method: "GET",
      });
      const change = {
        orderId: customId,
        version: scope.version,
        originalDigest: scope.originalDigest,
        scopeDigest: scope.scopeDigest,
        pieceId: null,
        profile: value.profile,
        lines: value.lines.map((l) => ({ ...l, id: randomUUID() })),
        capacity: {
          basis: "incremental",
          coveredBy: null,
          reason: "SYNTHETIC reviewed additional demand",
        },
        commercial: "additional-charge",
        reason: "SYNTHETIC child requested extra alteration",
        agreement: "SYNTHETIC exact new guardian-authorised scope",
        review: null,
      };
      const ar = await f.ok("small-services/changes/review", { body: change });
      assert.deepEqual(ar.issues, []);
      change.review = {
        fingerprint: ar.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC exception",
        waiveRush: false,
        waiverReason: "",
      };
      const addDraft = await f.save(change, {
          workflow: "order.service-change",
        }),
        addKey = randomUUID();
      assert.equal((await f.promote(addDraft, { key: addKey })).status, 200);
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
      const completionCommands = [];
      for (const orderId of [order, customId]) {
        const v = await f.ok(`small-services/progress/${orderId}`, {
            method: "GET",
          }),
          l = v.lines[0];
        const command = {
          path: `small-services/progress/${orderId}/lines/${l.line.id}`,
          options: {
            key: randomUUID(),
            etag: '"v1"',
            body: {
              commandId: randomUUID(),
              action: "complete",
              orderVersion: v.orderVersion,
              scopeDigest: v.scopeDigest,
              sourceId: l.sourceId,
              sourceDigest: l.sourceDigest,
              attested: true,
              note: "SYNTHETIC current verified guardian authority",
            },
          },
        };
        await f.ok(command.path, command.options);
        completionCommands.push(command);
      }
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
      const completing = f.request(
        completionCommands[0].path,
        completionCommands[0].options,
      );
      try {
        await waitForLock(f);
      } finally {
        release();
      }
      await revoking;
      assert.equal(
        (await completing).status,
        404,
        "SS-C guardian withdrawal wins a concurrent cached completion replay",
      );
      assert.equal(
        (await f.request(`small-services/scope/${customId}`, { method: "GET" }))
          .status,
        404,
        "SS-B guardian withdrawal protects supplemental history",
      );
      for (const command of completionCommands)
        assert.equal(
          (await f.request(command.path, command.options)).status,
          404,
          "SS-C exact replay rechecks revoked guardian authority",
        );
      for (const orderId of [order, customId])
        assert.equal(
          (
            await f.request(`small-services/progress/${orderId}`, {
              method: "GET",
            })
          ).status,
          404,
          "SS-C history hides revoked minor authority",
        );
      assert.equal(
        (await f.promote(addDraft, { key: addKey })).status,
        404,
        "SS-B retry rechecks current guardian authority",
      );
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
        2,
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

// #125 uses the existing synthetic profile and acceptance paths; no privileged
// fixture INSERT can stand in for the supplemental command under test.
test(
  "SS-B ORD-14 AC-50 accepted additions preserve originals, exact totals, covered capacity, retry and stale aggregate",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { saree, seed } = f.services;
      const base = {
        ...emptyQuickOrder(),
        customerId: seed.customer.customerId,
        wearerId: seed.wearer.wearerId,
        manifest: saree.profile.content.manifest,
        deliveryDate: saree.intake.deliveryDate,
        deliveryTime: saree.intake.deliveryTime,
        presentationRevisionId: saree.intake.presentationRevisionId,
        priceState: "quoted",
        priceText: "1000",
      };
      const br = await f.ok("orders/review", { body: base });
      assert.deepEqual(br.unknowns, [], JSON.stringify(br));
      base.commitmentReview = {
        fingerprint: br.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC reviewed",
        waiveRush: false,
        waiverReason: "",
      };
      const bd = await f.save(base, { workflow: "order.quick" });
      const bp = await f.promote(bd);
      assert.equal(bp.status, 200, await bp.clone().text());
      const bid = (await bp.json()).draft.result.id;
      const original = await f.ok(`orders/${bid}/read`, { body: {} });
      const scope = await f.ok(`small-services/scope/${bid}`, {
        method: "GET",
      });
      const value = {
        orderId: bid,
        version: scope.version,
        originalDigest: scope.originalDigest,
        scopeDigest: scope.scopeDigest,
        pieceId: null,
        profile: saree.intake.profile,
        lines: saree.intake.lines.map((l, i) => ({
          ...l,
          id: randomUUID(),
          priceState: "quoted",
          priceText: i ? "50" : "100",
        })),
        capacity: {
          basis: "incremental",
          coveredBy: null,
          reason: "SYNTHETIC mapped extra demand",
        },
        commercial: "additional-charge",
        reason: "SYNTHETIC added edge work",
        agreement:
          "SYNTHETIC owner recorded agreement for these two priced lines and unchanged promise",
        review: null,
      };
      const r = await f.ok("small-services/changes/review", { body: value });
      assert.deepEqual(r.issues, [], JSON.stringify(r));
      value.review = {
        fingerprint: r.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC exception",
        waiveRush: false,
        waiverReason: "",
      };
      const d = await f.save(value, { workflow: "order.service-change" }),
        key = randomUUID();
      assert.equal((await f.promote(d, { etag: undefined })).status, 428);
      const result = await f.promote(d, { key });
      if (result.status !== 200) {
        try {
          await f.owner.withOwnerDraft(
            new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
            f.a.shop,
            (c) =>
              mutateDraft(
                c,
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
        } catch (e) {
          let c = e;
          while (c.cause) c = c.cause;
          assert.fail(`${c.code} ${c.message} ${c.where}`);
        }
      }
      assert.equal(result.status, 200, await result.clone().text());
      assert.deepEqual(
        await (await f.promote(d, { key })).json(),
        await result.json(),
      );
      const after = await f.ok(`orders/${bid}/read`, { body: {} }),
        current = await f.ok(`small-services/scope/${bid}`, { method: "GET" });
      assert.equal(after.snapshotDigest, original.snapshotDigest);
      assert.deepEqual(after.snapshot, original.snapshot);
      assert.equal(after.pricePaise, 100000);
      assert.deepEqual(after.currentPromise, original.currentPromise);
      assert.equal(current.additionsPaise, "15000");
      assert.equal(current.totalPaise, "115000");
      const secondValue = { ...base, priceText: "500", commitmentReview: null },
        secondReview = await f.ok("orders/review", { body: secondValue });
      secondValue.commitmentReview = {
        fingerprint: secondReview.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC reviewed",
        waiveRush: false,
        waiverReason: "",
      };
      const secondId = await f.services.config.publish(
          "order.quick",
          secondValue,
        ),
        secondOrder = await f.ok(`orders/${secondId}/read`, { body: {} });
      const bookingValue = {
        customerId: base.customerId,
        target: null,
        context: {
          occasion: "visit",
          eventDate: "",
          notes: "SYNTHETIC exact extra charges",
          payerId: null,
        },
        reason: "SYNTHETIC group two garments",
        orders: [after, secondOrder].map((o) => ({
          id: o.id,
          version: o.version,
          snapshotDigest: o.snapshotDigest,
        })),
        reviewFingerprint: null,
      };
      const bookReview = await f.ok("orders/bookings/review", {
        body: bookingValue,
      });
      bookingValue.reviewFingerprint = bookReview.fingerprint;
      const bookingRevision = await f.services.config.publish(
        "booking.group",
        bookingValue,
      );
      const detail = await f.ok("orders/bookings/read", {
          body: { id: bookingRevision, revision: true },
        }),
        prices = await f.ok(
          `small-services/booking-scope/${detail.booking.id}`,
          { method: "GET" },
        );
      assert.equal(prices.originalKnownPaise, "150000");
      assert.equal(prices.extraKnownPaise, "15000");
      assert.equal(prices.currentKnownPaise, "165000");
      assert.equal(
        prices.currentUnknownCount,
        0,
        "garment-price booking counts each extra charge once",
      );
      assert.equal(current.changes.length, 1);
      await assertIsolationCatalog(f.runtime.db);
      for (const table of [
        "order_service_change",
        "order_service_change_line",
        "order_service_capacity_contribution",
        "service_intake_conversion",
      ]) {
        const hidden = await withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
          tx.execute(sql`select 1 from ${sql.raw(table)}`),
        );
        assert.equal(hidden.rows.length, 0, `${table} cross-shop read`);
        assert.equal(
          (await f.runtime.db.execute(sql`select 1 from ${sql.raw(table)}`))
            .rows.length,
          0,
          `${table} missing context`,
        );
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(sql`update ${sql.raw(table)} set shop_id=shop_id`),
          ),
          (e) => e.cause?.code === "42501" || e.code === "42501",
        );
      }
      assert.equal(after.version, 2);
      assert.deepEqual(
        current.changes[0].content.lines.map((l) => l.state),
        ["pending", "pending"],
      );
      assert.equal(
        (
          await f.request(`small-services/scope/${bid}`, {
            method: "GET",
            who: f.b,
          })
        ).status,
        404,
      );
      assert.equal(
        (await f.request("small-services/changes/review", { body: value }))
          .status,
        412,
      );
      const copy = {
        ...value,
        version: current.version,
        scopeDigest: current.scopeDigest,
        lines: value.lines.map((l) => ({ ...l, id: randomUUID() })),
        review: null,
      };
      const dup = await f.ok("small-services/changes/review", { body: copy });
      assert(dup.issues.includes("duplicateServiceSource"));
      const covered = {
        ...copy,
        profile: {
          entryId: f.services.kurti.profile.entryId,
          revisionId: f.services.kurti.profile.id,
        },
        lines: f.services.kurti.intake.lines.map((l) => ({
          ...l,
          id: randomUUID(),
        })),
        capacity: {
          basis: "already-covered",
          coveredBy: bid,
          reason: "SYNTHETIC explicit original demand coverage",
        },
      };
      const blocked = await f.ok("small-services/changes/review", {
        body: covered,
      });
      assert(blocked.issues.includes("capacityCategoryChanged"));
      const table = await f.admin.query(
        "select quantity from order_service_capacity_contribution where order_id=$1",
        [bid],
      );
      assert.deepEqual(table.rows, [{ quantity: 1 }]);
      const hugeText = "90071992547409.91",
        hugeBase = { ...base, priceText: hugeText, commitmentReview: null },
        hugeReview = await f.ok("orders/review", { body: hugeBase });
      hugeBase.commitmentReview = {
        fingerprint: hugeReview.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC exact boundary test",
        waiveRush: false,
        waiverReason: "",
      };
      const hugeId = await f.services.config.publish("order.quick", hugeBase),
        hugeScope = await f.ok(`small-services/scope/${hugeId}`, {
          method: "GET",
        });
      const hugeChange = {
        ...value,
        orderId: hugeId,
        version: hugeScope.version,
        originalDigest: hugeScope.originalDigest,
        scopeDigest: hugeScope.scopeDigest,
        lines: [
          { ...value.lines[0], id: randomUUID(), priceText: hugeText },
          {
            ...value.lines[1],
            id: randomUUID(),
            notRequired: true,
            notRequiredReason:
              "SYNTHETIC independent optional line declined; leave the first line pending",
          },
        ],
        review: null,
      };
      let h = await f.ok("small-services/changes/review", {
        body: hugeChange,
      });
      assert(
        h.issues.includes("notRequiredPrice"),
        "not-required work cannot retain a quoted charge",
      );
      hugeChange.lines[1].priceState = "to-be-quoted";
      hugeChange.lines[1].priceText = "";
      h = await f.ok("small-services/changes/review", { body: hugeChange });
      assert.deepEqual(h.issues, []);
      hugeChange.review = {
        fingerprint: h.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC exact boundary test",
        waiveRush: false,
        waiverReason: "",
      };
      await f.services.config.publish("order.service-change", hugeChange);
      const exact = await f.ok(`small-services/scope/${hugeId}`, {
        method: "GET",
      });
      assert.equal(exact.additionsPaise, String(Number.MAX_SAFE_INTEGER));
      assert.deepEqual(
        exact.changes[0].content.lines.map((l) => l.state),
        ["pending", "not-required"],
      );
      assert.equal(
        exact.changes[0].content.lines[1].pricePaise,
        null,
        "not-required work does not become a quoted charge",
      );
      assert.equal(
        exact.totalPaise,
        (BigInt(Number.MAX_SAFE_INTEGER) * 2n).toString(),
        "supplemental totals beyond a safe number remain readable exact strings",
      );
      const demand = (
        await f.admin.query(
          "select * from order_service_capacity_contribution where order_id=$1",
          [bid],
        )
      ).rows[0];
      await assert.rejects(
        withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
          tx.execute(
            sql`insert into order_service_capacity_contribution(shop_id,change_id,order_id,category_id,delivery_date,unit,quantity) values(${f.b.shop}::uuid,${demand.change_id}::uuid,${bid}::uuid,${demand.category_id}::uuid,${demand.delivery_date},${demand.unit},1)`,
          ),
        ),
        (e) => e.cause?.code === "23503" || e.code === "23503",
      );
      await assert.rejects(
        withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
          tx.execute(
            sql`insert into order_service_capacity_contribution(shop_id,change_id,order_id,category_id,delivery_date,unit,quantity) values(${f.a.shop}::uuid,${demand.change_id}::uuid,${bid}::uuid,${demand.category_id}::uuid,${demand.delivery_date},${demand.unit},1)`,
          ),
        ),
        (e) => e.cause?.code === "42501" || e.code === "42501",
      );
    }),
);

test(
  "SS-B D6 AC-07/50 explicit custom and group conversion preserve raw input and accept selected work atomically",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { saree, seed } = f.services;
      const base = {
        ...emptyQuickOrder(),
        customerId: seed.customer.customerId,
        wearerId: seed.wearer.wearerId,
        manifest: saree.profile.content.manifest,
        deliveryDate: saree.intake.deliveryDate,
        presentationRevisionId: saree.intake.presentationRevisionId,
        priceState: "quoted",
        priceText: "1000",
        instructions: "SYNTHETIC exact raw custom note",
      };
      const raw = structuredClone(base),
        source = await f.save(base, { workflow: "order.quick" });
      const convertKey = randomUUID();
      const converted = await f.ok(`drafts/${source.id}/convert`, {
        body: { target: "services" },
        etag: `"v${source.draft.version}"`,
        key: convertKey,
      });
      assert.equal(converted.draft.lifecycle, "promoted");
      assert.equal(converted.draft.result.type, "order.services-intake-draft");
      assert.deepEqual(
        await f.ok(`drafts/${source.id}/convert`, {
          body: { target: "services" },
          etag: `"v${source.draft.version}"`,
          key: convertKey,
        }),
        converted,
      );
      assert.equal(
        (
          await f.request(`drafts/${source.id}/convert`, {
            body: {},
            etag: `"v${source.draft.version}"`,
            key: convertKey,
          })
        ).status,
        422,
      );
      const target = await f.ok(`drafts/${converted.draft.result.id}`, {
        method: "GET",
      });
      assert.deepEqual(target.payload.base, { ...raw, commitmentReview: null });
      assert.equal(target.payload.review, null);
      assert.deepEqual(target.payload.selections, []);
      const provenance = await f.admin.query(
        "select source_payload from service_intake_conversion where source_draft_id=$1",
        [source.id],
      );
      assert.deepEqual(provenance.rows[0].source_payload, raw);
      const selection = {
        lineId: null,
        profile: saree.intake.profile,
        lines: saree.intake.lines.map((l) => ({
          ...l,
          id: randomUUID(),
          priceState: "quoted",
          priceText: "25",
        })),
        capacity: {
          basis: "incremental",
          coveredBy: null,
          reason: "SYNTHETIC extra mapped demand",
        },
        commercial: "additional-charge",
        reason: "SYNTHETIC selected at intake",
        agreement: "SYNTHETIC explicit new full-scope agreement",
      };
      async function acceptWrapper(value, record) {
        const r = await f.ok("small-services/intake/review", { body: value });
        assert.deepEqual(r.issues, [], JSON.stringify(r));
        value.review = {
          fingerprint: r.fingerprint,
          acknowledged: true,
          exceptionReason: "SYNTHETIC reviewed all demand",
          waiveRush: false,
          waiverReason: "",
        };
        const draft = await f.save(value, {
          workflow: "order.services-intake",
          ...(record ? { id: record.id, etag: `"v${record.version}"` } : {}),
        });
        const key = randomUUID(),
          response = await f.promote(draft, { key });
        if (response.status !== 200) {
          try {
            await f.owner.withOwnerDraft(
              new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
              f.a.shop,
              (c) =>
                mutateDraft(
                  c,
                  draft.id,
                  "promote",
                  {},
                  {
                    key,
                    ifMatch: `"v${draft.draft.version}"`,
                    requestId: randomUUID(),
                  },
                ),
            );
          } catch (e) {
            let cause = e;
            while (cause.cause) cause = cause.cause;
            assert.fail(`${cause.code} ${cause.message} ${cause.where}`);
          }
        }
        assert.equal(response.status, 200, await response.clone().text());
        return response.json();
      }
      const accepted = await acceptWrapper(
        { ...target.payload, selections: [selection] },
        target,
      );
      const scope = await f.ok(
        `small-services/scope/${accepted.draft.result.id}`,
        { method: "GET" },
      );
      assert.equal(scope.totalPaise, "105000");
      assert.equal(scope.changes.length, 1);
      const lineA = serviceDraftId(),
        lineB = serviceDraftId();
      const group = {
        ...emptyGroupIntake(),
        reason: "SYNTHETIC frozen package",
        lines: [
          { id: lineA, intake: base },
          {
            id: lineB,
            intake: { ...base, instructions: "SYNTHETIC second garment" },
          },
        ],
        commercial: {
          basis: "package-proposal",
          packagePriceState: "quoted",
          packagePriceText: "1800",
        },
      };
      const oldGroup = await f.save(group, { workflow: "order.group" });
      const gc = await f.ok(`drafts/${oldGroup.id}/convert`, {
        body: { target: "services" },
        etag: `"v${oldGroup.draft.version}"`,
      });
      const gt = await f.ok(`drafts/${gc.draft.result.id}`, { method: "GET" });
      assert.deepEqual(gt.payload.base, {
        ...group,
        lines: group.lines.map((l) => ({
          ...l,
          intake: { ...l.intake, commitmentReview: null },
        })),
      });
      const gv = {
        ...gt.payload,
        selections: [
          {
            ...selection,
            lineId: lineA,
            commercial: "outside-package",
            lines: selection.lines.map((l) => ({ ...l, id: randomUUID() })),
          },
          {
            ...selection,
            lineId: lineB,
            commercial: "outside-package",
            lines: selection.lines.map((l) => ({ ...l, id: randomUUID() })),
            capacity: {
              basis: "already-covered",
              coveredBy: null,
              reason: "SYNTHETIC expressly covered by this base garment demand",
            },
          },
        ],
      };
      const before = (
        await f.admin.query("select count(*)::int n from garment_order")
      ).rows[0].n;
      const blocked = {
        ...gv,
        selections: gv.selections.map((s, i) =>
          i ? { ...s, profile: f.services.unknown.intake.profile } : s,
        ),
      };
      const bad = await f.ok("small-services/intake/review", { body: blocked });
      assert(bad.issues.length);
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        before,
      );
      const ga = await acceptWrapper(gv, gt);
      assert.equal(ga.draft.result.type, "booking.revision");
      const rows = (
        await f.admin.query(
          "select id,price_paise from garment_order where origin_draft_id=$1 order by id",
          [gt.id],
        )
      ).rows;
      assert.equal(rows.length, 2);
      assert(rows.every((r) => r.price_paise === null));
      for (const row of rows) {
        const s = await f.ok(`small-services/scope/${row.id}`, {
          method: "GET",
        });
        assert(s.package);
        assert.equal(s.totalPaise, null);
        assert.equal(s.additionsPaise, "5000");
        assert.equal(s.changes.length, 1);
      }
      const pc = await f.admin.query(
        "select package_paise from booking_commercial_revision where origin_draft_id=$1",
        [gt.id],
      );
      assert.equal(pc.rows[0].package_paise, "180000");
      const packageDetail = await f.ok("orders/bookings/read", {
        body: { id: ga.draft.result.id, revision: true },
      });
      const packageScope = await f.ok(
        `small-services/booking-scope/${packageDetail.booking.id}`,
        { method: "GET" },
      );
      assert.equal(packageScope.originalKnownPaise, "180000");
      assert.equal(packageScope.extraKnownPaise, "10000");
      assert.equal(packageScope.currentKnownPaise, "190000");
      assert.equal(
        packageScope.currentUnknownCount,
        0,
        "reference amounts are never added to package totals",
      );
      const demand = await f.admin.query(
        "select quantity from order_service_capacity_contribution where order_id=ANY($1::uuid[])",
        [rows.map((r) => r.id)],
      );
      assert.deepEqual(demand.rows, [{ quantity: 1 }]);
    }),
);

test(
  "SS-B AC-55/60 supplemental write faults roll back and aggregate CAS coordinates independent additions and presentation",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { saree, seed } = f.services;
      const base = {
        ...emptyQuickOrder(),
        customerId: seed.customer.customerId,
        wearerId: seed.wearer.wearerId,
        manifest: saree.profile.content.manifest,
        deliveryDate: saree.intake.deliveryDate,
        presentationRevisionId: saree.intake.presentationRevisionId,
        priceState: "quoted",
        priceText: "1000",
      };
      const br = await f.ok("orders/review", { body: base });
      base.commitmentReview = {
        fingerprint: br.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC reviewed",
        waiveRush: false,
        waiverReason: "",
      };
      const originalDraft = await f.save(base, { workflow: "order.quick" }),
        originalResult = await f.promote(originalDraft);
      assert.equal(
        originalResult.status,
        200,
        await originalResult.clone().text(),
      );
      const orderId = (await originalResult.json()).draft.result.id;
      async function change(key, basis = "incremental") {
        const scope = await f.ok(`small-services/scope/${orderId}`, {
            method: "GET",
          }),
          spec = saree.profile.content.lines.find((l) => l.key === key);
        const value = {
          orderId,
          version: scope.version,
          originalDigest: scope.originalDigest,
          scopeDigest: scope.scopeDigest,
          pieceId: null,
          profile: saree.intake.profile,
          lines: [
            {
              id: randomUUID(),
              key: spec.key,
              requestedWork: `SYNTHETIC ${key}`,
              priceState: "to-be-quoted",
              priceText: "",
              notRequired: false,
              notRequiredReason: "",
            },
          ],
          capacity: {
            basis,
            coveredBy: basis === "already-covered" ? orderId : null,
            reason: "SYNTHETIC reviewed exact coverage",
          },
          commercial: "additional-charge",
          reason: "SYNTHETIC add requested work",
          agreement: "SYNTHETIC new exact agreement",
          review: null,
        };
        const review = await f.ok("small-services/changes/review", {
          body: value,
        });
        assert.deepEqual(review.issues, [], JSON.stringify(review));
        value.review = {
          fingerprint: review.fingerprint,
          acknowledged: true,
          exceptionReason: "SYNTHETIC exception",
          waiveRush: false,
          waiverReason: "",
        };
        return {
          value,
          draft: await f.save(value, { workflow: "order.service-change" }),
        };
      }
      const fault = await change("fall");
      // Mixed recovery rows and exact scope reads share the aggregate -> identity
      // prefix, rather than taking it in opposite orders at page reload.
      for (let attempt = 0; attempt < 3; attempt++) {
        const reads = await Promise.all([
          f.request("drafts", { method: "GET" }),
          f.request(`small-services/scope/${orderId}`, { method: "GET" }),
        ]);
        for (const read of reads)
          assert.equal(read.status, 200, await read.clone().text());
      }
      const key = randomUUID(),
        before = await counts(f);
      await f.admin.query(
        "CREATE FUNCTION synthetic_addon_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC actual line write failure';END$$; CREATE TRIGGER synthetic_addon_fault BEFORE INSERT ON order_service_change_line FOR EACH ROW EXECUTE FUNCTION synthetic_addon_fault()",
      );
      try {
        assert.equal((await f.promote(fault.draft, { key })).status, 503);
        assert.deepEqual(await counts(f), before);
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from order_service_change",
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await f.admin.query(
          "DROP TRIGGER synthetic_addon_fault ON order_service_change_line; DROP FUNCTION synthetic_addon_fault()",
        );
      }
      const other = await change("pico");
      const outcomes = await Promise.all([
        f.promote(fault.draft, { key }),
        f.promote(other.draft),
      ]);
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 412]);
      const loser = outcomes[0].status === 412 ? fault : other;
      const ls = await f.ok(`drafts/${loser.draft.id}`, { method: "GET" });
      assert.equal(ls.lifecycle, "active");
      const scope = await f.ok(`small-services/scope/${orderId}`, {
        method: "GET",
      });
      assert.equal(scope.changes.length, 1);
      assert.equal(scope.totalPaise, null, "unknown extra price stays unknown");
      const staleCopy = {
        ...loser.value,
        version: scope.version,
        scopeDigest: scope.scopeDigest,
        review: null,
      };
      const rr = await f.ok("small-services/changes/review", {
        body: staleCopy,
      });
      assert.deepEqual(rr.issues, []);
      staleCopy.review = { ...loser.value.review, fingerprint: rr.fingerprint };
      const saved = await f.save(staleCopy, {
        id: ls.id,
        etag: `"v${ls.version}"`,
        workflow: "order.service-change",
      });
      assert.equal((await f.promote(saved)).status, 200);
      const covered = await change("pre-pleating", "already-covered");
      const oldScope = await f.ok(`small-services/scope/${orderId}`, {
        method: "GET",
      });
      const race = await Promise.all([
        f.promote(covered.draft),
        f.request(`orders/${orderId}/presentation`, {
          body: { mode: "detailed" },
          etag: `"v${oldScope.version}"`,
        }),
      ]);
      assert.deepEqual(race.map((r) => r.status).sort(), [200, 412]);
      if (race[0].status === 412) {
        const s = await f.ok(`small-services/scope/${orderId}`, {
          method: "GET",
        });
        const v = {
          ...covered.value,
          version: s.version,
          scopeDigest: s.scopeDigest,
          review: null,
        };
        const r = await f.ok("small-services/changes/review", { body: v });
        v.review = { ...covered.value.review, fingerprint: r.fingerprint };
        const d = await f.save(v, {
          id: covered.draft.id,
          etag: `"v${covered.draft.draft.version}"`,
          workflow: "order.service-change",
        });
        assert.equal((await f.promote(d)).status, 200);
      }
      const contributions = await f.admin.query(
        "select quantity from order_service_capacity_contribution where order_id=$1",
        [orderId],
      );
      assert.deepEqual(contributions.rows, [{ quantity: 1 }, { quantity: 1 }]);
      const final = await f.ok(`small-services/scope/${orderId}`, {
        method: "GET",
      });
      assert.equal(final.changes.length, 3);
      assert.equal(final.changes.at(-1).content.quantity, 0);
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      const closed = await f.ok(`drafts/${fault.draft.id}`, { method: "GET" });
      assert.equal(
        (await f.promote({ id: closed.id, draft: closed }, { key })).status,
        409,
        "expired request key cannot recreate an accepted source",
      );
      const foreignPiece = {
        ...covered.value,
        version: final.version,
        scopeDigest: final.scopeDigest,
        pieceId: randomUUID(),
      };
      assert.equal(
        (
          await f.request("small-services/changes/review", {
            body: foreignPiece,
          })
        ).status,
        404,
      );
    }),
);

test(
  "SS-B AC-60 accepted add-on versus first booking membership serializes without lost scope or deadlock",
  { timeout: 240000 },
  async () =>
    fixture(async (f) => {
      const { saree, seed } = f.services,
        orders = [];
      for (let i = 0; i < 2; i++) {
        const v = {
          ...emptyQuickOrder(),
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
          manifest: saree.profile.content.manifest,
          deliveryDate: saree.intake.deliveryDate,
          presentationRevisionId: saree.intake.presentationRevisionId,
        };
        const r = await f.ok("orders/review", { body: v });
        v.commitmentReview = {
          fingerprint: r.fingerprint,
          acknowledged: true,
          exceptionReason: "SYNTHETIC reviewed",
          waiveRush: false,
          waiverReason: "",
        };
        const id = await f.services.config.publish("order.quick", v);
        orders.push(await f.ok(`orders/${id}/read`, { body: {} }));
      }
      const target = orders[0],
        scope = await f.ok(`small-services/scope/${target.id}`, {
          method: "GET",
        });
      const value = {
        orderId: target.id,
        version: scope.version,
        originalDigest: scope.originalDigest,
        scopeDigest: scope.scopeDigest,
        pieceId: null,
        profile: saree.intake.profile,
        lines: saree.intake.lines.map((l) => ({ ...l, id: randomUUID() })),
        capacity: {
          basis: "incremental",
          coveredBy: null,
          reason: "SYNTHETIC reviewed incremental work",
        },
        commercial: "additional-charge",
        reason: "SYNTHETIC add after acceptance",
        agreement: "SYNTHETIC exact new agreement",
        review: null,
      };
      const r = await f.ok("small-services/changes/review", { body: value });
      assert.deepEqual(r.issues, []);
      value.review = {
        fingerprint: r.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC exception",
        waiveRush: false,
        waiverReason: "",
      };
      const addon = await f.save(value, { workflow: "order.service-change" });
      const booking = {
        customerId: target.intake.customerId,
        target: null,
        context: {
          occasion: "visit",
          eventDate: "",
          notes: "SYNTHETIC membership race",
          payerId: null,
        },
        orders: orders.map((o) => ({
          id: o.id,
          version: o.version,
          snapshotDigest: o.snapshotDigest,
        })),
        reason: "SYNTHETIC group accepted garments",
        reviewFingerprint: null,
      };
      const review = await f.ok("orders/bookings/review", { body: booking });
      booking.reviewFingerprint = review.fingerprint;
      const draft = await f.save(booking, { workflow: "booking.group" });
      let entered, release;
      const ready = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
        withOwnerDraft(headers, shopId, run) {
          return f.owner.withOwnerDraft(headers, shopId, (ctx) => {
            const workflows = new Map(ctx.workflows),
              original = workflows.get("booking.group");
            workflows.set("booking.group", {
              ...original,
              async promote(...args) {
                const result = await original.promote(...args);
                entered();
                await gate;
                return result;
              },
            });
            return run({ ...ctx, workflows });
          });
        },
      });
      const grouping = f.promote(draft);
      await Promise.race([
        ready,
        grouping.then(() => assert.fail("membership write barrier missed")),
      ]);
      const adding = f.promote(addon);
      try {
        await waitForLock(f);
      } finally {
        release();
      }
      assert.equal((await grouping).status, 200);
      assert.equal((await adding).status, 409);
      const current = await f.ok(`small-services/scope/${target.id}`, {
        method: "GET",
      });
      assert.equal(current.changes.length, 0);
      assert.equal(current.version, 1);
      assert.equal(current.originalDigest, target.snapshotDigest);
      assert.equal(
        (await f.ok(`drafts/${addon.id}`, { method: "GET" })).lifecycle,
        "active",
      );
      const fresh = await f.ok("small-services/changes/review", {
        body: value,
      });
      assert.notEqual(
        fresh.fingerprint,
        r.fingerprint,
        "membership source invalidates the old exact-scope agreement",
      );
      value.review = { ...value.review, fingerprint: fresh.fingerprint };
      const revalidated = await f.save(value, {
        id: addon.id,
        etag: `"v${addon.draft.version}"`,
        workflow: "order.service-change",
      });
      const intake = {
        ...emptyGroupIntake(),
        reason: "SYNTHETIC grouped capacity race",
        lines: orders.map((o) => ({ id: serviceDraftId(), intake: o.intake })),
      };
      const gr = await f.ok("orders/bookings/intake-review", { body: intake });
      intake.review = {
        fingerprint: gr.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC reviewed grouped demand",
        waiveRush: false,
        waiverReason: "",
      };
      const grouped = await f.save(intake, { workflow: "order.group" });
      const capacityRace = await Promise.all([
        f.promote(revalidated),
        f.promote(grouped),
      ]);
      assert.deepEqual(capacityRace.map((r) => r.status).sort(), [200, 409]);
      const acceptedDemand = await f.admin.query(
        "select (select coalesce(sum(quantity),0) from order_capacity_demand)+(select coalesce(sum(quantity),0) from order_service_capacity_contribution) as n",
      );
      assert.equal(
        acceptedDemand.rows[0].n,
        capacityRace[0].status === 200 ? "3" : "4",
        "add-on versus grouped intake counts only committed demand once",
      );
      if (capacityRace[0].status !== 200) {
        const updated = await f.ok("small-services/changes/review", {
          body: value,
        });
        value.review = { ...value.review, fingerprint: updated.fingerprint };
        const d = await f.save(value, {
          id: revalidated.id,
          etag: `"v${revalidated.draft.version}"`,
          workflow: "order.service-change",
        });
        assert.equal((await f.promote(d)).status, 200);
      }
      const bookingResult = await f.ok(`drafts/${draft.id}`, { method: "GET" }),
        bookingDetail = await f.ok("orders/bookings/read", {
          body: { id: bookingResult.result.id, revision: true },
        });
      const currentPrice = await f.ok(
        `small-services/booking-scope/${bookingDetail.booking.id}`,
        { method: "GET" },
      );
      assert.equal(currentPrice.extraKnownPaise, "0");
      assert.equal(currentPrice.extraUnknownCount, 1);
      assert.equal(
        currentPrice.currentUnknownCount,
        3,
        "unknown original and supplemental charges remain distinct unknowns",
      );
    }),
);

test(
  "SS-B expand migration retains populated A service, custom, garment-price and package histories",
  { timeout: 240000 },
  async () =>
    withTenantFixture(
      async (f) => {
        f.api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        requests(f);
        let services, serviceOrder, customId;
        try {
          await withHistoricalCustomReader(f.admin, async () => {
            services = await seedSmallServices({
              setup: f.ok,
              runtime: f.runtime.pool,
              shopId: f.a.shop,
            });
            f.services = services;
            serviceOrder = (await f.accept(services.saree.intake)).order;
            const base = {
              ...emptyQuickOrder(),
              customerId: services.seed.customer.customerId,
              wearerId: services.seed.wearer.wearerId,
              manifest: services.saree.profile.content.manifest,
              deliveryDate: services.saree.intake.deliveryDate,
              presentationRevisionId:
                services.saree.intake.presentationRevisionId,
              priceState: "quoted",
              priceText: "1000",
            };
            const r = await f.ok("orders/review", { body: base });
            base.commitmentReview = {
              fingerprint: r.fingerprint,
              acknowledged: true,
              exceptionReason: "SYNTHETIC upgrade",
              waiveRush: false,
              waiverReason: "",
            };
            customId = await services.config.publish("order.quick", base);
            for (const basis of ["garment-prices", "package-proposal"]) {
              const v = {
                ...emptyGroupIntake(),
                reason: "SYNTHETIC before-0035 group",
                lines: [
                  { id: serviceDraftId(), intake: base },
                  { id: serviceDraftId(), intake: base },
                ],
                commercial: {
                  basis,
                  packagePriceState:
                    basis === "package-proposal" ? "quoted" : "to-be-quoted",
                  packagePriceText: basis === "package-proposal" ? "1800" : "",
                },
              };
              const r = await f.ok("orders/bookings/intake-review", {
                body: v,
              });
              v.review = {
                fingerprint: r.fingerprint,
                acknowledged: true,
                exceptionReason: "SYNTHETIC upgrade",
                waiveRush: false,
                waiverReason: "",
              };
              await services.config.publish("order.group", v);
            }
          });
          const before = (
              await f.admin.query(
                "select order_id,content,digest from order_acceptance_snapshot order by order_id",
              )
            ).rows,
            commercial = (
              await f.admin.query(
                "select * from booking_commercial_revision order by id",
              )
            ).rows;
          await migrateDatabase(f.migrationConnectionString);
          await assertIsolationCatalog(f.runtime.db);
          assert.deepEqual(
            (
              await f.admin.query(
                "select order_id,content,digest from order_acceptance_snapshot order by order_id",
              )
            ).rows,
            before,
          );
          assert.deepEqual(
            (
              await f.admin.query(
                "select * from booking_commercial_revision order by id",
              )
            ).rows,
            commercial,
          );
          const service = await f.ok(
            `small-services/orders/${serviceOrder.id}`,
            { method: "GET" },
          );
          assert.deepEqual(service.lines, serviceOrder.lines);
          const scope = await f.ok(`small-services/scope/${customId}`, {
            method: "GET",
          });
          assert.equal(scope.totalPaise, "100000");
          assert.deepEqual(scope.changes, []);
          for (const table of [
            "order_service_change",
            "order_service_change_line",
            "order_service_capacity_contribution",
            "service_intake_conversion",
          ])
            assert.equal(
              (await f.admin.query(`select count(*)::int n from ${table}`))
                .rows[0].n,
              0,
            );
        } finally {
          await services?.close();
        }
      },
      {
        migrationThrough: "0034_standalone_service_intake.sql",
        customerPolicy: syntheticCustomerPolicy,
      },
    ),
);
