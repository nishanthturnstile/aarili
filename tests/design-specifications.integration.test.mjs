import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { designSpecificationWorkflow } from "@aarili/core/design-specifications";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  designRef,
  designScenarios,
  designOk as ok,
  promoteDesign,
  publishDesign,
  designRequest as request,
  revisedDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  publishSpecification,
  specificationDraft,
  specificationSources,
} from "../scripts/test-support/design-specification-fixtures.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { seedSmallServices } from "../scripts/test-support/small-services.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

async function withSpecifications(run, options = {}) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
      try {
        const sources = await specificationSources(f, {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        });
        await run(f, sources, seed);
      } finally {
        await seed.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}
const stateOf = (f, v) =>
  request(f, "design-specifications/list", {
    method: "POST",
    body: { orderId: v.orderId, pieceId: v.pieceId },
  }).then(ok);
async function currentRevision(f, v, extra = {}) {
  const state = await stateOf(f, v);
  return {
    ...v,
    baseVersion: state.version,
    baseSavedId: state.latestSavedId,
    reason: "SYNTHETIC reasoned revision",
    ...extra,
  };
}

test(
  "DS-A2-02/07 additive upgrade preserves populated orders and supports explicit whole-garment scope",
  { timeout: 240000 },
  () =>
    withSpecifications(
      async (f, s) => {
        const accepted = await s.accept();
        const snapshot = async () => {
          const result = {};
          for (const table of [
            "garment_order",
            "order_acceptance_snapshot",
            "order_piece_set",
            "order_piece",
            "durable_draft",
            "design_config_revision",
            "service_template_revision",
          ]) {
            result[table] = (
              await f.admin.query(
                `select to_jsonb(t) value from ${table} t order by to_jsonb(t)::text`,
              )
            ).rows;
          }
          return result;
        };
        const before = await snapshot();
        await migrateDatabase(f.migrationConnectionString);
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(await snapshot(), before);
        assert.equal(
          (await f.admin.query("select count(*)::int n from design_spec_scope"))
            .rows[0].n,
          0,
        );
        const scenarios = await designScenarios(f, s),
          whole = scenarios.find((x) => x.code === "alteration");
        await s.acceptance.publish("service.commitment-bindings", {
          categoryId: whole.category.entryId,
          categoryRevisionId: whole.category.definition.id,
          availabilityId: whole.category.id,
          ruleRevisionId: s.acceptance.ruleId,
          baseVersion: 0,
          baseRevisionId: null,
          review: "reviewed",
          reason: "SYNTHETIC whole scope",
        });
        const { order, pieces } = await s.accept(whole.manifest);
        assert.deepEqual(pieces.identities, []);
        const v = specificationDraft(order.id, null, whole.profiles[0]);
        await publishSpecification(f, v);
        const current = await stateOf(f, v);
        assert.equal(current.pieceId, null);
        assert.equal(current.versions.length, 1);
        const wrongPiece = accepted.pieces.identities[0].id;
        assert.equal(
          (
            await request(f, "design-specifications/list", {
              method: "POST",
              body: { orderId: order.id, pieceId: wrongPiece },
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from design_spec_scope where order_id=$1 and piece_id is null",
              [order.id],
            )
          ).rows[0].n,
          1,
        );
      },
      { migrationThrough: "0042_design_choices.sql" },
    ),
);

test(
  "DS-A2-02/03/05/06 exact scope, inactive retention, repeat mapping and unchanged accepted context",
  { timeout: 240000 },
  () =>
    withSpecifications(async (f, s, seed) => {
      const first = await s.accept(),
        second = await s.accept(),
        pieceId = first.pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id;
      const v = specificationDraft(first.order.id, pieceId, s.profile);
      await publishSpecification(f, v);
      const initial = (await stateOf(f, v)).versions[0];
      const snapshot = await f.admin.query(
        "select content,digest from order_acceptance_snapshot where shop_id=$1 and order_id=$2",
        [f.a.shop, first.order.id],
      );
      const foreignPiece = { ...v, orderId: second.order.id };
      assert.equal(
        (
          await request(
            f,
            `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
            {
              method: "PUT",
              body: {
                workflow: "design.specification",
                schemaVersion: 1,
                payload: foreignPiece,
              },
            },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(f, `design-specifications/versions/${initial.id}`, {
            who: f.b,
          })
        ).status,
        404,
      );
      const targetPiece = second.pieces.identities.find(
        (p) => p.key === s.top.definition.content.code,
      ).id;
      const reuse = {
        orderId: second.order.id,
        pieceId: targetPiece,
        profile: designRef(s.profile),
        source: {
          versionId: initial.id,
          scopeVersion: 1,
          digest: initial.digest,
          fields: [v.answers[0].questionId, v.answers[4].questionId],
        },
      };
      const candidate = await request(f, "design-specifications/reuse", {
        method: "POST",
        body: reuse,
      }).then(ok);
      assert(
        candidate.answers
          .filter((a) => a.state === "selected")
          .every((a) => a.intent === "inspiration"),
      );
      assert.equal(candidate.reuse.versionId, initial.id);
      assert.equal(candidate.baseVersion, 0);
      await publishSpecification(f, candidate);
      const renamedProfile = await publishDesign(
        f,
        revisedDesign(s.profile, {
          content: {
            ...s.profile.definition.content,
            labelEn: "SYNTHETIC revised profile label",
          },
        }),
      );
      assert.deepEqual(
        await request(f, `design-specifications/versions/${initial.id}`).then(
          ok,
        ),
        initial,
      );
      await publishSpecification(
        f,
        await currentRevision(f, v, { use: false }),
      );
      const third = await s.accept(),
        thirdPiece = third.pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id;
      reuse.profile = designRef(renamedProfile);
      const historicalReuse = {
        ...reuse,
        orderId: third.order.id,
        pieceId: thirdPiece,
        source: {
          ...reuse.source,
          scopeVersion: (await stateOf(f, v)).version,
        },
      };
      const oldCandidate = await request(f, "design-specifications/reuse", {
        method: "POST",
        body: historicalReuse,
      }).then(ok);
      await publishSpecification(f, oldCandidate);
      assert.equal(
        (await stateOf(f, oldCandidate)).versions[0].reuse.versionId,
        initial.id,
      );
      const other = await seedQuickOrder(f.runtime.pool, f.a.shop, {
        outfit: true,
        templatePrefix: "different-wearer-",
      });
      try {
        const target = await s.accept(s.manifest, {
          customerId: other.customer.customerId,
          wearerId: other.wearer.wearerId,
        });
        const pieceId = target.pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id;
        assert.equal(
          (
            await request(f, "design-specifications/reuse", {
              method: "POST",
              body: { ...historicalReuse, orderId: target.order.id, pieceId },
            })
          ).status,
          404,
        );
      } finally {
        await other.close();
      }
      const disable = await publishDesign(
        f,
        revisedDesign(s.choices[0], {
          operation: "availability",
          available: false,
        }),
      );
      const revision = await currentRevision(f, v, { use: false });
      const missing = await saveDesign(f, revision, "design.specification");
      assert.equal((await promoteDesign(f, missing)).status, 409);
      revision.answers = revision.answers.map((a, i) =>
        i === 0
          ? {
              ...a,
              retainedReason: "SYNTHETIC unchanged historical choice reviewed",
            }
          : a,
      );
      await publishSpecification(f, revision);
      const retained = (await stateOf(f, v)).versions[0];
      assert(retained.answers[0].retainedReason);
      assert.deepEqual(
        (await stateOf(f, v)).versions.find((x) => x.id === initial.id),
        initial,
      );
      assert.equal(
        (
          await request(f, "design-specifications/reuse", {
            method: "POST",
            body: {
              ...reuse,
              source: {
                ...reuse.source,
                scopeVersion: (await stateOf(f, v)).version,
              },
            },
          })
        ).status,
        409,
      );
      // Category and manifest disable do not rewrite an already accepted exact scope.
      await publishDesign(
        f,
        revisedDesign(s.category, {
          operation: "availability",
          available: false,
        }),
        "service.catalogue",
        "catalogue",
      );
      await publishDesign(
        f,
        revisedDesign(s.manifest, {
          operation: "availability",
          available: false,
        }),
        "service.templates",
        "service-templates",
      );
      await publishSpecification(f, await currentRevision(f, revision));
      assert.deepEqual(
        (
          await f.admin.query(
            "select content,digest from order_acceptance_snapshot where shop_id=$1 and order_id=$2",
            [f.a.shop, first.order.id],
          )
        ).rows,
        snapshot.rows,
      );
      // A label publication cannot change the sealed specification or its original choices.
      const saved = await request(
        f,
        `design-specifications/versions/${initial.id}`,
      ).then(ok);
      assert.deepEqual(saved, initial);
      assert.equal(disable.available, false);
      await assertIsolationCatalog(f.runtime.db);
      for (const table of [
        "design_spec_event",
        "design_spec_version",
        "design_spec_answer",
        "design_spec_value",
      ]) {
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(sql.raw(`update ${table} set shop_id=shop_id`)),
          ),
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
            sql`insert into design_spec_answer select * from design_spec_answer where shop_id=${f.a.shop}::uuid limit 1`,
          ),
        ),
      );
      const hidden = await withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
        tx.execute(sql`select * from design_spec_version`),
      );
      assert.equal(hidden.rowCount, 0);
      const services = await seedSmallServices({
        setup: s.setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
        seed,
        configuration: s.acceptance,
      });
      for (const scenario of [services.kurti, services.saree]) {
        const review = await s.setup("small-services/orders/review", {
          body: scenario.intake,
        });
        const intake = {
          ...scenario.intake,
          commitmentReview: {
            fingerprint: review.fingerprint,
            acknowledged: true,
            exceptionReason: review.commitment.evaluation.warnings.length
              ? "SYNTHETIC service review"
              : "",
            waiveRush: false,
            waiverReason: "",
          },
        };
        const d = await saveDesign(f, intake, "order.service"),
          result = await ok(await promoteDesign(f, d));
        const orderId = result.draft.result.id;
        assert.equal(
          (
            await request(f, "design-specifications/list", {
              method: "POST",
              body: { orderId, pieceId: null },
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from design_spec_scope where order_id=$1",
              [orderId],
            )
          ).rows[0].n,
          0,
        );
      }
    }),
);

test(
  "DS-A2-04/07 first-save, saved-base/selection CAS, exact retry, actor binding and injected rollback",
  { timeout: 240000 },
  () =>
    withSpecifications(async (f, s) => {
      const { order, pieces } = await s.accept(),
        pieceId = pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id;
      const v = specificationDraft(order.id, pieceId, s.profile),
        one = await saveDesign(f, v, "design.specification"),
        two = await saveDesign(f, v, "design.specification"),
        firstKey = randomUUID(),
        secondKey = randomUUID();
      const results = await Promise.all([
        promoteDesign(f, one, firstKey),
        promoteDesign(f, two, secondKey),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 412]);
      const a = results[0].status === 200 ? one : two,
        key = results[0].status === 200 ? firstKey : secondKey;
      const replay = await ok(await promoteDesign(f, a, key));
      assert.equal(replay.draft.result.type, "design.specification");
      assert.equal(
        (await promoteDesign(f, a, key, { etag: '"v99"' })).status,
        422,
      );
      const stored = await f.admin.query(
        "select response from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      assert.deepEqual(stored.rows[0].response.draft.payload, {});
      const savedKey = (
        await f.admin.query(
          "select key from idempotency_key where shop_id=$1 and response#>>'{draft,id}'=$2 and response#>>'{draft,version}'='1'",
          [f.a.shop, a.draftId],
        )
      ).rows[0].key;
      const oldResponse = await request(f, `drafts/${a.draftId}`, {
        method: "PUT",
        body: {
          workflow: "design.specification",
          schemaVersion: 1,
          payload: v,
        },
        key: savedKey,
      }).then(ok);
      assert.deepEqual(
        oldResponse.draft,
        a.draft,
        "Exact lost save response survives the later promotion",
      );
      await f.admin.query(
        "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
        [f.a.shop, f.b.user],
      );
      assert.equal(
        (await promoteDesign(f, a, key, { who: f.b, shop: f.a.shop })).status,
        422,
      );
      const state = await stateOf(f, v),
        next = await currentRevision(f, v, { use: false }),
        x = await saveDesign(f, next, "design.specification"),
        y = await saveDesign(
          f,
          { ...next, reason: "SYNTHETIC other writer" },
          "design.specification",
        );
      assert.deepEqual(
        (await Promise.all([promoteDesign(f, x), promoteDesign(f, y)]))
          .map((r) => r.status)
          .sort(),
        [200, 412],
      );
      const select = await saveDesign(
        f,
        {
          ...(await currentRevision(f, v)),
          operation: "select",
          selectedId: state.latestSavedId,
          answers: [],
          use: true,
        },
        "design.specification",
      );
      const save = await saveDesign(
        f,
        await currentRevision(f, v, { use: false }),
        "design.specification",
      );
      assert.deepEqual(
        (await Promise.all([promoteDesign(f, select), promoteDesign(f, save)]))
          .map((r) => r.status)
          .sort(),
        [200, 412],
      );
      const missing = await saveDesign(
        f,
        await currentRevision(f, v),
        "design.specification",
      );
      assert.equal(
        (await promoteDesign(f, missing, undefined, { etag: null })).status,
        428,
      );
      const count = async () =>
        (
          await f.admin.query(
            "select (select count(*) from design_spec_event) events,(select count(*) from design_spec_version) versions,(select count(*) from design_spec_answer) answers,(select count(*) from design_spec_value) values,(select count(*) from audit_event) audits,(select count(*) from idempotency_key) keys",
          )
        ).rows;
      await f.admin.query(
        `create function test_design_failure() returns trigger language plpgsql as $$begin if TG_TABLE_NAME='audit_event' and NEW.action not like 'design.specification.%' then return NEW;end if;if TG_TABLE_NAME='idempotency_key' and NEW.action<>'draft.promote' then return NEW;end if;raise exception 'synthetic injected design rollback';end$$`,
      );
      for (const table of [
        "audit_event",
        "design_spec_event",
        "design_spec_version",
        "design_spec_answer",
        "design_spec_value",
        "design_spec_draft_value",
        "design_spec_scope",
        "durable_draft",
        "idempotency_key",
      ]) {
        const d = await saveDesign(
            f,
            await currentRevision(f, v, { use: false }),
            "design.specification",
          ),
          before = await count(),
          retryKey = randomUUID();
        await f.admin.query(
          `create trigger test_design_failure after ${["durable_draft", "design_spec_scope"].includes(table) ? "update" : "insert"} on ${table} for each row execute function test_design_failure()`,
        );
        assert.equal((await promoteDesign(f, d, retryKey)).status, 503, table);
        await f.admin.query(`drop trigger test_design_failure on ${table}`);
        assert.deepEqual(await count(), before, table);
        assert.equal(
          (await request(f, `drafts/${d.draftId}`).then(ok)).lifecycle,
          "active",
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from design_spec_draft_value where shop_id=$1 and draft_id=$2 and version=2",
              [f.a.shop, d.draftId],
            )
          ).rows[0].n,
          0,
        );
        const committed = await ok(await promoteDesign(f, d, retryKey));
        assert.deepEqual(
          await ok(await promoteDesign(f, d, retryKey)),
          committed,
        );
      }
      await f.admin.query("drop function test_design_failure()");
      // Availability races are serialized with A1 configuration publication.
      const fresh = await s.accept(),
        freshPiece = fresh.pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id;
      const saveRace = await saveDesign(
          f,
          specificationDraft(fresh.order.id, freshPiece, s.profile),
          "design.specification",
        ),
        disableRace = await saveDesign(
          f,
          revisedDesign(s.choices[0], {
            operation: "availability",
            available: false,
          }),
        );
      const race = await Promise.all([
        promoteDesign(f, saveRace),
        promoteDesign(f, disableRace),
      ]);
      assert.equal(race[1].status, 200);
      assert([200, 409].includes(race[0].status));
    }),
);

test(
  "DS-A2-07/05 current authority, history privacy cursors and audited draft/value erasure",
  { timeout: 240000 },
  () =>
    withSpecifications(async (f, s, seed) => {
      const { order, pieces } = await s.accept(),
        pieceId = pieces.identities.find(
          (p) => p.key === s.top.definition.content.code,
        ).id,
        v = specificationDraft(order.id, pieceId, s.profile);
      const { draft, result } = await publishSpecification(f, v),
        state = await stateOf(f, v),
        version = state.versions[0];
      const history = () =>
        request(f, "customer-history", {
          method: "POST",
          body: { customerId: seed.customer.customerId, limit: 1 },
        });
      const before = await history();
      assert.equal(before.status, 200, await before.clone().text());
      const feed = await before.json();
      assert.equal(feed.events[0].action, "design.specification.save");
      assert.deepEqual(feed.events[0].pieceIds, [pieceId]);
      assert.equal(feed.events[0].source.version, null);
      const raw = await f.admin.query(
        "select origin_draft_id,command_key from design_spec_event where shop_id=$1 and id=$2",
        [f.a.shop, result.draft.result.id],
      );
      assert.equal(raw.rows[0].origin_draft_id, draft.draftId);
      let privateReads;
      await f.admin.query("begin");
      try {
        await f.admin.query("set local role app_privacy");
        await f.admin.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await f.admin.query("select redact_design_specification($1,$2,$3)", [
          f.a.shop,
          result.draft.result.id,
          randomUUID(),
        ]);
        await f.admin.query("reset role");
        privateReads = Promise.all([
          request(f, `design-specifications/versions/${version.id}`).then(ok),
          request(f, `drafts/${draft.draftId}`).then(ok),
          promoteDesign(f, draft, raw.rows[0].command_key).then(ok),
        ]);
        let waiting = false;
        for (let i = 0; i < 30; i++) {
          const r = await f.admin.query(
            "select exists(select 1 from pg_stat_activity where wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0) blocked",
          );
          if (r.rows[0].blocked) {
            waiting = true;
            break;
          }
          await delay(50);
        }
        assert(waiting, "Private readers must wait for the erasure order lock");
        await f.admin.query("commit");
      } catch (e) {
        await f.admin.query("rollback");
        throw e;
      }
      const [racingVersion, racingDraft, racingReplay] = await privateReads;
      assert.deepEqual(racingVersion.answers, []);
      assert.deepEqual(racingVersion.choices, []);
      assert.deepEqual(racingDraft.payload.answers, []);
      assert.deepEqual(racingReplay.draft.payload.answers, []);
      const erased = await request(
        f,
        `design-specifications/versions/${version.id}`,
      ).then(ok);
      assert.equal(erased.redacted, true);
      assert.deepEqual(erased.answers, []);
      assert.deepEqual(erased.choices, []);
      assert.equal(erased.reason, "");
      assert.equal(erased.digest, version.digest);
      const recovered = await request(f, `drafts/${draft.draftId}`).then(ok);
      assert.deepEqual(recovered.payload.answers, []);
      assert.equal(recovered.payload.reason, "");
      assert.equal(recovered.version, result.draft.version + 1);
      const stale = await request(f, `drafts/${draft.draftId}`, {
        method: "PUT",
        etag: `"v${result.draft.version}"`,
        body: {
          workflow: "design.specification",
          schemaVersion: 1,
          payload: v,
        },
      });
      assert.equal(stale.status, 412);
      assert.deepEqual((await stale.json()).current.payload.answers, []);
      // A never-published draft has its own audited erasure seam.
      const unsaved = await saveDesign(
        f,
        await currentRevision(f, v, { use: false }),
        "design.specification",
      );
      await f.admin.query("begin");
      try {
        await f.admin.query("set local role app_privacy");
        await f.admin.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await f.admin.query(
          "select redact_design_specification_draft($1,$2,$3)",
          [f.a.shop, unsaved.draftId, randomUUID()],
        );
        await f.admin.query("commit");
      } catch (e) {
        await f.admin.query("rollback");
        throw e;
      }
      const cleared = await request(f, `drafts/${unsaved.draftId}`).then(ok);
      assert.equal(cleared.lifecycle, "active");
      assert.equal(cleared.version, unsaved.draft.version + 1);
      assert.deepEqual(cleared.payload.answers, []);
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`select redact_design_specification_draft(${f.a.shop}::uuid,${unsaved.draftId}::uuid,${randomUUID()}::uuid)`,
          ),
        ),
      );
      if (feed.next)
        assert.equal(
          (
            await request(f, "customer-history", {
              method: "POST",
              body: {
                customerId: seed.customer.customerId,
                limit: 1,
                cursor: feed.next,
              },
            })
          ).status,
          409,
        );
      // A revocation checked against immutable history and all draft/replay paths.
      const pending = await saveDesign(
        f,
        await currentRevision(f, v, { use: false }),
        "design.specification",
      );
      await f.admin.query("begin");
      await f.admin.query(
        "select pg_advisory_xact_lock(hashtextextended('aarili:wearer:'||$1::text||':'||$2::text,0))",
        [f.a.shop, seed.wearer.wearerId],
      );
      const competing = promoteDesign(f, pending);
      let blocked = false;
      for (let i = 0; i < 30; i++) {
        const r = await f.admin.query(
          "select exists(select 1 from pg_stat_activity where wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0) as blocked",
        );
        if (r.rows[0].blocked) {
          blocked = true;
          break;
        }
        await delay(50);
      }
      assert(blocked, "Save must wait for the wearer authority lock");
      await f.admin.query(
        "update customer_wearer_relationship set authorised=false where shop_id=$1 and wearer_id=$2",
        [f.a.shop, seed.wearer.wearerId],
      );
      await f.admin.query("commit");
      assert.equal((await competing).status, 404);
      assert.equal(
        (await request(f, `design-specifications/versions/${version.id}`))
          .status,
        404,
      );
      assert.equal((await request(f, `drafts/${draft.draftId}`)).status, 404);
    }),
);

test(
  "DS-A2-01/02/04 real PG immutable version save-only and explicit selection",
  { timeout: 240000 },
  async () =>
    withTenantFixture(
      async (f) => {
        f.api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
        try {
          const sources = await specificationSources(f, {
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          });
          const { order, pieces } = await sources.accept(),
            pieceId = pieces.identities.find(
              (p) => p.key === sources.top.definition.content.code,
            ).id;
          const v = specificationDraft(order.id, pieceId, sources.profile);
          await publishSpecification(f, v);
          const state = () =>
            request(f, "design-specifications/list", {
              method: "POST",
              body: { orderId: order.id, pieceId },
            }).then(ok);
          const first = await state();
          assert.equal(first.versions.length, 1);
          assert.equal(first.currentId, first.latestSavedId);
          // Future governed evidence is a current policy decision, including old-version selection.
          for (const operation of ["save", "select"]) {
            const governed = {
              ...v,
              baseVersion: first.version,
              baseSavedId: first.latestSavedId,
              operation,
              selectedId: operation === "select" ? first.latestSavedId : null,
              answers: operation === "select" ? [] : v.answers,
              use: true,
            };
            await assert.rejects(
              f.owner.withOwnerDesignSpecifications(
                new Headers({ Cookie: f.a.cookie }),
                f.a.shop,
                (ctx) =>
                  designSpecificationWorkflow({
                    ...ctx,
                    repository: {
                      ...ctx.repository,
                      governed: async () => true,
                    },
                  }).revalidate(governed, randomUUID()),
              ),
              (e) => e.status === 409,
            );
          }
          const revision = {
            ...v,
            baseVersion: first.version,
            baseSavedId: first.latestSavedId,
            use: false,
            reason: "SYNTHETIC revision",
            answers: v.answers.map((a) => ({ ...a, intent: "inspiration" })),
          };
          await publishSpecification(f, revision);
          const second = await state();
          assert.equal(second.versions.length, 2);
          assert.equal(second.currentId, first.currentId);
          assert.deepEqual(second.versions[1], first.versions[0]);
          await publishSpecification(f, {
            ...revision,
            baseVersion: second.version,
            baseSavedId: second.latestSavedId,
            operation: "select",
            selectedId: second.latestSavedId,
            answers: [],
            reuse: null,
            use: true,
          });
          const selected = await state();
          assert.equal(selected.currentId, second.latestSavedId);
          assert.equal(selected.selections.length, 2);
        } finally {
          await seed.close();
        }
      },
      { customerPolicy: syntheticCustomerPolicy },
    ),
);
