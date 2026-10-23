import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { validateMeasurementValues } from "@aarili/core/measurement-sessions";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  designOk as ok,
  promoteDesign,
  publishDesign,
  designRequest as request,
  revisedDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSelectionDraft,
  measurementSources,
  publishMeasurement,
} from "../scripts/test-support/measurement-session-fixtures.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const uuid7 = () => randomUUID().replace(/^(........-....-)./, "$17");

// The migration fixture uses the actual pre-0047 relations/guards and the old
// insert shape in the same runtime transaction as the generic draft engine.
// No trigger is disabled and no private content is backfilled or fabricated by
// the migration under test.
async function legacyWrite(tx, shopId, v, saved) {
  const { id, audit } = (
    await tx.execute(sql`select uuidv7() as id,uuidv7() as audit`)
  ).rows[0];
  await tx.execute(
    sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${audit}::uuid,'user',${v.actorId}::uuid,${`measurement.${v.operation}`},'measurement',${id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ operation: v.operation })}::jsonb)`,
  );
  await tx.execute(
    sql`insert into measurement_event(shop_id,id,operation,customer_id,wearer_id,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${id}::uuid,${v.operation},${v.customerId}::uuid,${v.wearerId}::uuid,${v.actorId}::uuid,${v.draftId}::uuid,${audit}::uuid,${v.key}::uuid)`,
  );
  await tx.execute(
    sql`insert into measurement_private(shop_id,event_id,source,fit_notes,reason) values(${shopId}::uuid,${id}::uuid,${JSON.stringify(v.source)}::jsonb,${v.fitNotes},${v.reason})`,
  );
  if (saved) {
    await tx.execute(
      sql`insert into measurement_version(shop_id,id,form_entry_id,form_id,approval_id,frozen) values(${shopId}::uuid,${id}::uuid,${saved.form.entryId}::uuid,${saved.form.id}::uuid,${saved.approval.id}::uuid,${JSON.stringify(saved.form)}::jsonb)`,
    );
    for (const [position, a] of saved.values.entries())
      await tx.execute(
        sql`insert into measurement_value(shop_id,version_id,field_id,position,raw_text,unit,numeric_value,numerator,denominator,source,warning_reason) values(${shopId}::uuid,${id}::uuid,${a.fieldId}::uuid,${position},${a.rawText},${a.unit},${a.numeric}::numeric,${a.exact?.numerator ?? null}::numeric,${a.exact?.denominator ?? null}::numeric,${a.source ? JSON.stringify(a.source) : null}::jsonb,${a.warningReason})`,
      );
  } else
    await tx.execute(
      sql`insert into measurement_selection(shop_id,event_id,order_id,scope_key,piece_id,selected_id) values(${shopId}::uuid,${id}::uuid,${v.target.orderId}::uuid,${v.target.pieceId ?? v.target.orderId}::uuid,${v.target.pieceId}::uuid,${v.selectedId}::uuid)`,
    );
  return { type: "measurement.session", id };
}

test("MV-B01/07 populated 0046→0047 upgrade preserves real V1 selection/values and all accepted snapshots; reapplication is inert", {
  timeout: 240000,
}, async () => {
  let transaction, form, approval;
  await withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
        withOwnerDraft: (headers, shopId, run) =>
          f.owner.withOwnerDraft(headers, shopId, (ctx) => {
            const base = ctx.workflows.get("measurement.session"),
              workflows = new Map(ctx.workflows);
            workflows.set("measurement.session", {
              ...base,
              authorizeDraft: (input) =>
                base.authorizeDraft({ ...input, selectedId: null }),
              authorizePublication: (input) =>
                base.authorizePublication({ ...input, selectedId: null }),
              async revalidate(input, id) {
                if (input.operation === "save")
                  await base.revalidate(input, id);
              },
              promote: (input, _action, draftId, request) =>
                legacyWrite(
                  transaction,
                  shopId,
                  { ...input, ...request, draftId, actorId: f.a.user },
                  input.operation === "save"
                    ? {
                        form: form.definition,
                        approval,
                        values: validateMeasurementValues(
                          input,
                          form.definition,
                          approval.policy,
                        ),
                      }
                    : null,
                ),
            });
            return run({ ...ctx, workflows });
          }),
      });
      const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
      try {
        const identity = {
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          },
          s = await measurementSources(f, identity);
        form = s.forms[0];
        approval = await approveMeasurementForm(f, form);
        const v = measurementDraft(identity, form, approval),
          saved = await publishMeasurement(f, v),
          version = { id: saved.result.draft.result.id, ...identity },
          o1 = await s.accept();
        const target = {
          orderId: o1.order.id,
          pieceId: o1.pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id,
        };
        await publishMeasurement(f, measurementSelectionDraft(version, target));
        const snapshot = async () => {
          const result = {};
          for (const table of [
            "measurement_event",
            "measurement_private",
            "measurement_value",
            "measurement_version",
            "measurement_selection",
            "measurement_draft_value",
            "garment_order",
            "order_acceptance_snapshot",
            "order_piece",
            "design_config_revision",
            "measurement_form_revision",
            "service_template_revision",
          ]) {
            const remove =
              table === "measurement_version"
                ? ["session_id", "previous_id", "version"]
                : table === "measurement_selection"
                  ? ["version"]
                  : [];
            result[table] = (
              await f.admin.query(
                `select to_jsonb(t)-$1::text[] as value from ${table} t order by (to_jsonb(t)-$1::text[])::text`,
                [remove],
              )
            ).rows;
          }
          return result;
        };
        const before = await snapshot();
        await migrateDatabase(f.migrationConnectionString, {
          through: "0047_measurement_history.sql",
        });
        assert.deepEqual(await snapshot(), before);
        await assertIsolationCatalog(f.runtime.db);
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(sql`select selected_id from measurement_selection`),
          ),
          (e) => e.code === "42501" || e.cause?.code === "42501",
        );
        assert.equal(
          (await f.runtime.db.execute(sql`select id from measurement_version`))
            .rows.length,
          0,
          "Missing context and pooled rollback stay closed",
        );
        await migrateDatabase(f.migrationConnectionString, {
          through: "0047_measurement_history.sql",
        });
        assert.deepEqual(await snapshot(), before);
        f.api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        const detail = await request(
          f,
          `measurements/versions/${version.id}`,
        ).then(ok);
        assert.equal(detail.sessionId, version.id);
        assert.equal(detail.version, 1);
        assert.equal(detail.previousId, null);
        const state = await request(f, "measurements/target", {
          method: "POST",
          body: target,
        }).then(ok);
        assert.equal(state.selectedId, version.id);
        assert.equal(state.version, 1);
        const corrected = await publishMeasurement(f, {
          ...v,
          correctionId: version.id,
          reason: "SYNTHETIC post-upgrade correction",
        });
        assert.notEqual(corrected.result.draft.result.id, version.id);
        assert.equal(
          (
            await request(f, "measurements/target", {
              method: "POST",
              body: target,
            }).then(ok)
          ).selectedId,
          version.id,
        );
      } finally {
        await seed.close();
      }
    },
    {
      customerPolicy: syntheticCustomerPolicy,
      migrationThrough: "0046_pgboss_12_38.sql",
      draftInstrumentation: (tx) => {
        transaction = tx;
        return { recordDraftEvent: async () => {} };
      },
    },
  );
});
async function fixture(run) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
      try {
        const identity = {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        };
        const s = await measurementSources(f, identity),
          form = s.forms[0],
          approval = await approveMeasurementForm(f, form),
          v = measurementDraft(identity, form, approval);
        const save = async (value) => {
          const result = await publishMeasurement(f, value);
          return request(
            f,
            `measurements/versions/${result.result.draft.result.id}`,
          ).then(ok);
        };
        const accept = async () => {
          const a = await s.accept();
          return {
            orderId: a.order.id,
            pieceId: a.pieces.identities.find(
              (p) => p.key === s.top.definition.content.code,
            ).id,
          };
        };
        const review = (
          version,
          target,
          impact = { physical: "not-started", commercial: "none" },
        ) =>
          request(f, "measurements/review", {
            method: "POST",
            body: { selectedId: version.id, target, impact },
          }).then(ok);
        const selection = async (version, target) => {
          const r = await review(version, target);
          assert.deepEqual(r.blocked, []);
          return {
            ...measurementSelectionDraft(version, target),
            baseVersion: r.target.version,
            reuseReview: {
              digest: r.digest,
              impact: { physical: "not-started", commercial: "none" },
            },
          };
        };
        await run(f, {
          identity,
          s,
          form,
          approval,
          v,
          save,
          accept,
          review,
          selection,
        });
      } finally {
        await seed.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
}

test(
  "MV-B01/03/05/06 correction appends V2, old garment pins V1, reviewed reuse/replacement retains selection history and independent scopes",
  { timeout: 240000 },
  () =>
    fixture(async (f, { v, form, save, accept, selection, review }) => {
      const v1 = await save(v),
        o1 = await accept();
      await publishMeasurement(f, await selection(v1, o1));
      const before = (
        await f.admin.query(
          "select content from order_acceptance_snapshot where order_id=$1",
          [o1.orderId],
        )
      ).rows[0].content;
      const correction = {
        ...v,
        correctionId: v1.id,
        values: v.values.map((a, i) => ({
          ...a,
          rawText: i === 0 ? "12 1/2" : a.rawText,
        })),
        reason: "SYNTHETIC transcription correction",
      };
      const v2 = await save(correction);
      assert.equal(v2.sessionId, v1.id);
      assert.equal(v2.previousId, v1.id);
      assert.equal(v2.version, 2);
      const original = await request(f, `measurements/versions/${v1.id}`).then(
        ok,
      );
      assert.deepEqual(original.values, v1.values);
      assert.equal(original.headId, v2.id);
      const state = (target) =>
        request(f, "measurements/target", {
          method: "POST",
          body: target,
        }).then(ok);
      assert.equal((await state(o1)).selectedId, v1.id);
      const o2 = await accept();
      await publishMeasurement(f, await selection(v2, o2));
      assert.equal((await state(o2)).selectedId, v2.id);
      const r = await review(v1, o2);
      assert(r.sources.some((s) => s.orderId === o1.orderId));
      await publishMeasurement(f, await selection(v1, o2));
      assert.deepEqual(
        (await state(o2)).history.map((h) => h.selectedId),
        [v1.id, v2.id],
      );
      assert.equal((await state(o1)).selectedId, v1.id);
      assert.deepEqual(
        (
          await f.admin.query(
            "select content from order_acceptance_snapshot where order_id=$1",
            [o1.orderId],
          )
        ).rows[0].content,
        before,
      );
      assert(
        (
          await review(v2, o2, { physical: "unknown", commercial: "unknown" })
        ).blocked.includes("unsupported-impact"),
      );
      const changed = await saveDesign(
        f,
        {
          ...correction,
          correctionId: v2.id,
          source: { ...v.source, date: "2026-10-23" },
        },
        "measurement.session",
      );
      assert.equal((await promoteDesign(f, changed)).status, 422);
      const fresh = await save({
        ...v,
        source: { ...v.source, date: "2026-10-23" },
      });
      assert.equal(fresh.version, 1);
      assert.equal(fresh.sessionId, fresh.id);
      assert.equal(fresh.previousId, null);
      const pagedTarget = await accept();
      for (let i = 0; i < 27; i++)
        await publishMeasurement(
          f,
          await selection(i % 2 === 0 ? v1 : v2, pagedTarget),
        );
      const firstPage = await state(pagedTarget);
      assert.equal(firstPage.history.length, 25);
      assert.equal(firstPage.nextHistory, 3);
      assert.equal(firstPage.version, 27);
      const secondPage = await state({
        ...pagedTarget,
        beforeVersion: firstPage.nextHistory,
      });
      assert.deepEqual(
        secondPage.history.map((h) => h.version),
        [2, 1],
      );
      assert.equal(secondPage.nextHistory, null);
      assert.equal(secondPage.selectedId, v1.id);
      assert.equal(secondPage.version, 27);
      const pendingReuse = await saveDesign(
        f,
        await selection(v2, o2),
        "measurement.session",
      );
      await publishDesign(
        f,
        revisedDesign(form, { operation: "availability", available: false }),
        "measurement.forms",
        "measurement-forms",
      );
      assert((await review(v2, o2)).blocked.includes("unavailable"));
      assert.equal((await promoteDesign(f, pendingReuse)).status, 409);
      assert.equal((await state(o2)).selectedId, v1.id);
      assert.deepEqual(
        (await request(f, `measurements/versions/${v1.id}`).then(ok)).values,
        v1.values,
      );
      for (const table of ["measurement_version", "measurement_selection"]) {
        const c = await f.runtime.pool.connect();
        try {
          await c.query("begin");
          await c.query(
            "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
            [f.a.user, f.a.shop],
          );
          await assert.rejects(
            c.query(`delete from ${table} where shop_id=$1`, [f.a.shop]),
          );
        } finally {
          await c.query("rollback");
          c.release();
        }
      }
    }),
);

test(
  "MV-B02/07 competing lineage and target CAS, same-key lost-response replay and injected rollback preserve exact immutable history",
  { timeout: 240000 },
  () =>
    fixture(async (f, { v, save, accept, selection }) => {
      const v1 = await save(v);
      const correction = {
        ...v,
        correctionId: v1.id,
        reason: "SYNTHETIC correction race",
      };
      const a = await saveDesign(f, correction, "measurement.session"),
        b = await saveDesign(
          f,
          {
            ...correction,
            values: v.values.map((x) => ({ ...x, rawText: "12 1/2" })),
          },
          "measurement.session",
        );
      const key = randomUUID(),
        responses = await Promise.all([
          promoteDesign(f, a, key),
          promoteDesign(f, b),
        ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 412]);
      if (responses[0].status === 200) {
        const first = await responses[0].json(),
          replay = await promoteDesign(f, a, key).then(ok);
        assert.equal(replay.draft.result.id, first.draft.result.id);
      }
      const target = await accept(),
        input = await selection(v1, target);
      const x = await saveDesign(f, input, "measurement.session"),
        y = await saveDesign(f, input, "measurement.session");
      const race = await Promise.all([
        promoteDesign(f, x),
        promoteDesign(f, y),
      ]);
      assert.deepEqual(race.map((r) => r.status).sort(), [200, 412]);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from measurement_selection where order_id=$1",
            [target.orderId],
          )
        ).rows[0].n,
        1,
      );
      const head = (await request(f, `measurements/versions/${v1.id}`).then(ok))
        .headId;
      const retry = await saveDesign(
        f,
        { ...correction, correctionId: head },
        "measurement.session",
      );
      const counts = async () =>
        (
          await f.admin.query(
            "select (select count(*) from measurement_event) e,(select count(*) from measurement_version) v,(select count(*) from audit_event) a,(select count(*) from idempotency_key) k",
          )
        ).rows[0];
      for (const table of [
        "measurement_event",
        "measurement_version",
        "measurement_value",
        "measurement_private",
        "measurement_draft_value",
        "idempotency_key",
      ]) {
        await f.admin.query(
          "create or replace function test_measurement_history_failure() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC rollback';end$$",
        );
        await f.admin.query(
          `create trigger test_measurement_history_failure before insert on ${table} for each row execute function test_measurement_history_failure()`,
        );
        const before = await counts();
        assert.equal((await promoteDesign(f, retry)).status, 503);
        assert.deepEqual(await counts(), before);
        await f.admin.query(
          `drop trigger test_measurement_history_failure on ${table}`,
        );
      }
      assert.equal((await promoteDesign(f, retry)).status, 200);
    }),
);

test(
  "MV-B04/07 versioned repeat carries only reviewed IDs, v1 stays compatible and erasure denies repeat/detail/replay/history",
  { timeout: 240000 },
  () =>
    fixture(async (f, { v, save, accept, selection, identity, s }) => {
      const version = await save(v),
        target = await accept();
      await publishMeasurement(f, await selection(version, target));
      const source = await request(
        f,
        `orders/${target.orderId}/repeat/source`,
        { method: "POST" },
      ).then(ok);
      const reference = {
        selectedId: version.id,
        sourcePieceId: target.pieceId,
        pieceKey: s.top.definition.content.code,
        reviewed: true,
      };
      const create = async (extra) =>
        request(f, `orders/${target.orderId}/repeat/create`, {
          method: "POST",
          etag: `"v${source.order.version}"`,
          body: {
            draftId: uuid7(),
            snapshotDigest: source.order.snapshotDigest,
            scopeDigest: source.scopeDigest,
            reuseInstructions: false,
            ...extra,
          },
        }).then(ok);
      const old = await create({}),
        next = await create({ measurementReuse: reference });
      assert.equal(old.draft.schemaVersion, 1);
      assert.equal(old.draft.payload.measurementReuse, undefined);
      assert.equal(next.draft.schemaVersion, 2);
      assert.deepEqual(next.draft.payload.measurementReuse, reference);
      assert(!JSON.stringify(next).includes(v.source.measurer));
      assert(!JSON.stringify(next).includes(v.values[0].rawText));
      let payload = {
        ...next.draft.payload,
        deliveryDate: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        priceState: "quoted",
        priceText: "0",
      };
      const reviewed = await request(f, "orders/repeat/review", {
        method: "POST",
        body: payload,
      }).then(ok);
      payload = {
        ...payload,
        commitmentReview: {
          fingerprint: reviewed.fingerprint,
          acknowledged: true,
          exceptionReason: reviewed.evaluation?.warnings.length
            ? "SYNTHETIC reviewed exception"
            : "",
          waiveRush: false,
          waiverReason: "",
        },
      };
      const ready = await request(f, `drafts/${next.draft.id}`, {
        method: "PUT",
        etag: `"v${next.draft.version}"`,
        body: { workflow: "order.repeat", schemaVersion: 2, payload },
      }).then(ok);
      const result = await promoteDesign(f, {
        draftId: ready.draft.id,
        draft: ready.draft,
      }).then(ok);
      const repeated = await request(
        f,
        `orders/${result.draft.result.id}/read`,
        { method: "POST" },
      ).then(ok);
      assert.notEqual(repeated.id, target.orderId);
      assert.deepEqual(repeated.snapshot.measurementReuse, reference);
      const pieces = await request(f, `orders/${repeated.id}/pieces/read`, {
        method: "POST",
      }).then(ok);
      const newTarget = {
        orderId: repeated.id,
        pieceId: pieces.identities.find((p) => p.key === reference.pieceKey).id,
      };
      assert.equal(
        (
          await request(f, "measurements/target", {
            method: "POST",
            body: newTarget,
          }).then(ok)
        ).selectedId,
        null,
      );
      await publishMeasurement(f, await selection(version, newTarget));
      const history = await request(f, "customer-history", {
        method: "POST",
        body: { ...identity, limit: 25 },
      });
      // The private feed has minimal references; values require the dedicated detail read.
      assert.equal(history.status, 200, await history.clone().text());
      const feed = await history.json();
      assert(feed.events.some((e) => e.kind === "measurement"));
      assert(!JSON.stringify(feed).includes(v.values[0].rawText));
      const c = await f.admin.connect();
      try {
        await c.query("begin");
        await c.query("set local role app_privacy");
        await c.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await c.query("select redact_measurements($1,$2,$3)", [
          f.a.shop,
          identity.wearerId,
          randomUUID(),
        ]);
        await c.query("commit");
      } finally {
        c.release();
      }
      assert.equal(
        (await request(f, `measurements/versions/${version.id}`)).status,
        404,
      );
      assert.equal((await request(f, `drafts/${next.draft.id}`)).status, 404);
      assert.equal(
        (
          await request(f, `drafts/${next.draft.id}/promote`, {
            method: "POST",
            etag: `"v${next.draft.version}"`,
            body: {},
          })
        ).status,
        404,
      );
      const erasedFeed = await request(f, "customer-history", {
        method: "POST",
        body: { ...identity, limit: 25 },
      }).then(ok);
      assert(!erasedFeed.events.some((e) => e.kind === "measurement"));
    }),
);

test(
  "MV-B02/07 failed replacement and correction/erasure race leave no partial effects or resurrected private revisions",
  { timeout: 240000 },
  () =>
    fixture(async (f, { v, save, accept, selection, identity }) => {
      const v1 = await save(v),
        v2 = await save({
          ...v,
          correctionId: v1.id,
          reason: "SYNTHETIC corrected observation",
        });
      const target = await accept();
      await publishMeasurement(f, await selection(v1, target));
      const replacement = await saveDesign(
        f,
        await selection(v2, target),
        "measurement.session",
      );
      const before = (
        await f.admin.query(
          "select (select count(*) from measurement_event) e,(select count(*) from measurement_selection) s,(select count(*) from audit_event) a,(select count(*) from idempotency_key) k",
        )
      ).rows[0];
      await f.admin.query(
        "create function test_replace_rollback() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC selection rollback';end$$;create trigger test_replace_rollback before insert on measurement_selection for each row execute function test_replace_rollback()",
      );
      assert.equal((await promoteDesign(f, replacement)).status, 503);
      assert.deepEqual(
        (
          await f.admin.query(
            "select (select count(*) from measurement_event) e,(select count(*) from measurement_selection) s,(select count(*) from audit_event) a,(select count(*) from idempotency_key) k",
          )
        ).rows[0],
        before,
      );
      await f.admin.query(
        "drop trigger test_replace_rollback on measurement_selection",
      );
      const pending = await saveDesign(
        f,
        {
          ...v,
          correctionId: v2.id,
          reason: "SYNTHETIC blocked concurrent correction",
        },
        "measurement.session",
      );
      const gate = await f.admin.connect();
      let response;
      try {
        await gate.query("begin");
        await gate.query("set local role app_privacy");
        await gate.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await gate.query("select redact_measurements($1,$2,$3)", [
          f.a.shop,
          identity.wearerId,
          randomUUID(),
        ]);
        let finished = false;
        response = promoteDesign(f, pending).then((r) => {
          finished = true;
          return r;
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(
          finished,
          false,
          "Correction waits behind erasure's authority/draft barriers",
        );
        await gate.query("commit");
        assert.equal((await response).status, 404);
      } catch (e) {
        await gate.query("rollback");
        throw e;
      } finally {
        gate.release();
      }
      assert.equal(
        (await f.admin.query("select count(*)::int n from measurement_version"))
          .rows[0].n,
        2,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from measurement_value where raw_text is not null or numeric_value is not null or source is not null",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await request(f, `measurements/versions/${v1.id}`)).status,
        404,
      );
      assert.equal(
        (await request(f, `measurements/versions/${v2.id}`)).status,
        404,
      );
      assert.equal((await promoteDesign(f, replacement)).status, 404);
    }),
);

test(
  "MV-B02/03/07 foreign reuse reviews reject before taking a second wearer's authority barrier",
  { timeout: 240000 },
  () =>
    fixture(async (f, { v, save, accept, s, identity }) => {
      const first = await save(v),
        a = await accept(),
        at = new Date().toISOString();
      const contact = await request(f, `customers/${identity.customerId}`).then(
        ok,
      );
      const other = await request(
        f,
        `customers/${identity.customerId}/wearers`,
        {
          method: "POST",
          body: {
            mode: "new",
            displayName: "SYNTHETIC independent adult",
            age: "adult",
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
              statementByPersonId: contact.personId,
              authorised: true,
              informed: true,
              source: "in-person",
              occurredAt: at,
              interaction: "SYNTHETIC independent wearer",
            },
          },
        },
      ).then(ok);
      await request(
        f,
        `customers/${identity.customerId}/wearers/${other.wearerId}/consent-events`,
        {
          method: "POST",
          etag: `"v${other.version}"`,
          body: {
            purpose: "service",
            decision: "grant",
            noticeId: syntheticWearerPolicy.notice.id,
            noticeExplained: true,
            language: "en",
            giverPersonId: other.personId,
            source: "in-person",
            occurredAt: at,
          },
        },
      ).then(ok);
      const second = await save({ ...v, wearerId: other.wearerId });
      const order = await s.accept({
        customerId: identity.customerId,
        wearerId: other.wearerId,
      });
      const b = {
        orderId: order.order.id,
        pieceId: order.pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id,
      };
      const gate = await f.admin.connect();
      let responses;
      try {
        await gate.query("begin");
        for (const wearerId of [identity.wearerId, other.wearerId].sort())
          await gate.query(
            "select pg_advisory_xact_lock(hashtextextended('aarili:wearer:'||$1::text||':'||$2::text,0))",
            [f.a.shop, wearerId],
          );
        const review = (target, version) =>
          request(f, "measurements/review", {
            method: "POST",
            body: {
              target,
              selectedId: version.id,
              impact: { physical: "not-started", commercial: "none" },
            },
          });
        responses = Promise.all([review(a, second), review(b, first)]);
        const deadline = Date.now() + 5000;
        while (
          (
            await f.admin.query(
              "select count(*)::int n from pg_locks where locktype='advisory' and not granted",
            )
          ).rows[0].n < 2
        ) {
          assert(
            Date.now() < deadline,
            "Both independent target authorities must wait at the controlled barrier",
          );
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        await gate.query("commit");
        const result = await responses;
        assert.deepEqual(result.map((r) => r.status).sort(), [404, 404]);
        for (const r of result)
          assert(!JSON.stringify(await r.json()).includes(v.values[0].rawText));
      } catch (e) {
        await gate.query("rollback");
        throw e;
      } finally {
        gate.release();
      }
      assert.equal(
        (await f.admin.query("select count(*)::int n from measurement_event"))
          .rows[0].n,
        2,
      );
    }),
);
