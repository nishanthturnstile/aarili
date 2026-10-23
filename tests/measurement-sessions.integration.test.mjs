import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import {
  syntheticGuardianPolicy,
  syntheticWearerPolicy,
} from "@aarili/core/wearer-policy";
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
import { specificationSources } from "../scripts/test-support/design-specification-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSelectionDraft,
  publishMeasurement,
} from "../scripts/test-support/measurement-session-fixtures.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

async function withMeasurements(run, options = {}) {
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
          },
          s = await specificationSources(f, identity);
        const form = s.forms[0],
          approval = await approveMeasurementForm(f, form),
          v = measurementDraft(identity, form, approval);
        await run(f, { seed, identity, s, form, approval, v });
      } finally {
        await seed.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}

test(
  "MV-A01/06/09/11 populated upgrade, independent same-contact adults, frozen form history and isolation",
  { timeout: 240000 },
  () =>
    withTenantFixture(
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
            },
            s = await specificationSources(f, identity),
            accepted = await s.accept();
          const tables = [
            "garment_order",
            "order_acceptance_snapshot",
            "order_piece",
            "measurement_form_revision",
            "measurement_form_availability",
            "service_template_revision",
            "design_config_revision",
            "durable_draft",
          ];
          const snapshot = async () => {
            const result = {};
            for (const table of tables)
              result[table] = (
                await f.admin.query(
                  `select to_jsonb(t) value from ${table} t order by to_jsonb(t)::text`,
                )
              ).rows;
            return result;
          };
          const before = await snapshot();
          await migrateDatabase(f.migrationConnectionString);
          await migrateDatabase(f.migrationConnectionString);
          assert.deepEqual(await snapshot(), before);
          const form = s.forms[0],
            approval = await approveMeasurementForm(f, form),
            v = measurementDraft(identity, form, approval),
            result = await publishMeasurement(f, v),
            saved = await request(
              f,
              `measurements/versions/${result.result.draft.result.id}`,
            ).then(ok);
          const c = await request(f, `customers/${identity.customerId}`).then(
              ok,
            ),
            at = new Date().toISOString();
          await request(f, `customers/${c.id}`, {
            method: "PATCH",
            etag: `"v${c.version}"`,
            body: {
              displayName: c.displayName,
              phone: "SYNTHETIC 0000000000",
              aliases: c.aliases,
              reason: "SYNTHETIC shared phone fixture",
            },
          }).then(ok);
          const b = await request(f, `customers/${c.id}/wearers`, {
            method: "POST",
            body: {
              mode: "new",
              displayName: "SYNTHETIC second adult",
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
                statementByPersonId: c.personId,
                authorised: true,
                informed: true,
                source: "in-person",
                occurredAt: at,
                interaction: "SYNTHETIC shared contact, independent wearer",
              },
            },
          }).then(ok);
          await request(
            f,
            `customers/${c.id}/wearers/${b.wearerId}/consent-events`,
            {
              method: "POST",
              etag: `"v${b.version}"`,
              body: {
                purpose: "service",
                decision: "grant",
                noticeId: syntheticWearerPolicy.notice.id,
                noticeExplained: true,
                language: "en",
                giverPersonId: b.personId,
                source: "in-person",
                occurredAt: at,
              },
            },
          ).then(ok);
          const secondIdentity = { customerId: c.id, wearerId: b.wearerId };
          assert.deepEqual(
            (
              await request(f, "measurements/list", {
                method: "POST",
                body: secondIdentity,
              }).then(ok)
            ).versions,
            [],
          );
          const secondOrder = await s.accept(s.manifest, secondIdentity),
            target = {
              orderId: secondOrder.order.id,
              pieceId: secondOrder.pieces.identities.find(
                (p) => p.key === s.top.definition.content.code,
              ).id,
            };
          const wrong = {
            ...measurementSelectionDraft(saved, target),
            wearerId: b.wearerId,
          };
          assert.equal(
            (
              await request(
                f,
                `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
                {
                  method: "PUT",
                  body: {
                    workflow: "measurement.session",
                    schemaVersion: 1,
                    payload: wrong,
                  },
                },
              )
            ).status,
            404,
          );
          const foreignPiece = {
            orderId: accepted.order.id,
            pieceId: randomUUID(),
          };
          assert.equal(
            (
              await request(f, "measurements/target", {
                method: "POST",
                body: foreignPiece,
              })
            ).status,
            404,
          );
          const revised = revisedDesign(form);
          revised.content.labelEn = "SYNTHETIC renamed form";
          revised.content.groups.reverse();
          await publishDesign(
            f,
            revised,
            "measurement.forms",
            "measurement-forms",
          );
          assert.deepEqual(
            await request(f, `measurements/versions/${saved.id}`).then(ok),
            saved,
          );
          const oldDraft = await saveDesign(f, v, "measurement.session");
          assert.equal((await promoteDesign(f, oldDraft)).status, 409);
          assert.equal(
            (
              await request(f, `measurements/versions/${saved.id}`, {
                who: f.b,
                shop: f.a.shop,
              })
            ).status,
            403,
          );
          for (const table of [
            "measurement_use_event",
            "measurement_event",
            "measurement_version",
            "measurement_selection",
            "measurement_private",
            "measurement_value",
            "measurement_draft_value",
            "measurement_erasure",
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
              (
                await withShop(f.parallel.db, f.b.user, f.b.shop, (tx) =>
                  tx.execute(sql.raw(`select count(*)::int n from ${table}`)),
                )
              ).rows[0].n,
              0,
            );
          }
          assert(
            (await assertIsolationCatalog(f.runtime.db)).includes(
              "public.measurement_draft_value",
            ),
          );
          const otherContact = await request(f, "customers", {
            method: "POST",
            body: {
              displayName: "SYNTHETIC same phone contact",
              phone: "SYNTHETIC 0000000000",
              aliases: [],
              serviceEvidence: {
                noticeId: syntheticCustomerPolicy.notice.id,
                language: "en",
                decision: "grant",
                giver: "self",
                noticeExplained: true,
                source: "in-person",
                occurredAt: at,
              },
            },
          }).then(ok);
          const merge = await request(f, "customer-history/merge-preview", {
            method: "POST",
            body: {
              sourceId: c.id,
              survivorId: otherContact.customerId,
              mode: "merge",
            },
          }).then(ok);
          assert(merge.blocked.includes("measurement-association"));
        } finally {
          await seed.close();
        }
      },
      {
        customerPolicy: syntheticCustomerPolicy,
        migrationThrough: "0044_design_references.sql",
      },
    ),
);

test(
  "MV-A07/09 erasure barrier serializes exact reads and prevents replay or a new draft from resurrecting values",
  { timeout: 240000 },
  () =>
    withMeasurements(async (f, { v, identity }) => {
      const saved = await publishMeasurement(f, v),
        connection = await f.admin.connect();
      let reads;
      try {
        await connection.query("begin");
        await connection.query("set local role app_privacy");
        await connection.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await connection.query("select redact_measurements($1,$2,$3)", [
          f.a.shop,
          identity.wearerId,
          randomUUID(),
        ]);
        let finished = false;
        reads = Promise.all([
          request(f, `measurements/versions/${saved.result.draft.result.id}`),
          request(f, `drafts/${saved.draftId}`),
        ]).then((r) => {
          finished = true;
          return r;
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(
          finished,
          false,
          "Private readers wait for erasure authority barrier",
        );
        await connection.query("commit");
        assert.deepEqual(
          (await reads).map((r) => r.status),
          [404, 404],
        );
        const before = (
          await f.admin.query("select count(*)::int n from measurement_event")
        ).rows[0].n;
        const raw = randomUUID(),
          id = `${raw.slice(0, 14)}7${raw.slice(15)}`;
        assert.equal(
          (
            await request(f, `drafts/${id}`, {
              method: "PUT",
              body: {
                workflow: "measurement.session",
                schemaVersion: 1,
                payload: v,
              },
            })
          ).status,
          404,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int n from measurement_event"))
            .rows[0].n,
          before,
        );
        const tombstone = (
          await f.admin.query(
            "select result_id,payload from durable_draft where id=$1",
            [saved.draftId],
          )
        ).rows[0];
        assert.equal(tombstone.result_id, saved.result.draft.result.id);
        assert.equal(tombstone.payload.erased, true);
      } catch (e) {
        await connection.query("rollback");
        throw e;
      } finally {
        connection.release();
      }
    }),
);

test(
  "MV-A02/04/06/08 drafts preserve invalid/partial text; exact command, authority and ETag checks fail closed",
  { timeout: 240000 },
  () =>
    withMeasurements(async (f, { v, approval }) => {
      for (const patch of [
        { source: { ...v.source, date: "" } },
        { source: { ...v.source, measurer: "" } },
        { source: { ...v.source, kind: "unknown" } },
        { values: [{ ...v.values[0], rawText: "" }] },
        { values: [{ ...v.values[0], rawText: "0" }] },
        { values: [{ ...v.values[0], rawText: "1/3" }] },
        { values: [{ ...v.values[0], rawText: "12.26" }] },
        { values: [{ ...v.values[0], rawText: "1/0" }] },
        { values: [{ ...v.values[0], unit: null }] },
        { values: [{ ...v.values[0], fieldId: randomUUID() }] },
        { approvalId: randomUUID() },
      ]) {
        const input = { ...v, ...patch },
          d = await saveDesign(f, input, "measurement.session");
        assert.equal(
          (await promoteDesign(f, d)).status,
          patch.approvalId ? 409 : 422,
        );
        assert.deepEqual(
          (await request(f, `drafts/${d.draftId}`).then(ok)).payload,
          input,
        );
      }
      const d = await saveDesign(f, v, "measurement.session"),
        body = {
          workflow: "measurement.session",
          schemaVersion: 1,
          payload: { ...v, fitNotes: "SYNTHETIC changed text" },
        },
        key = randomUUID();
      assert.equal(
        (await request(f, `drafts/${d.draftId}`, { method: "PUT", body }))
          .status,
        428,
      );
      assert.equal(
        (
          await request(f, `drafts/${d.draftId}`, {
            method: "PUT",
            body,
            etag: '"v0"',
          })
        ).status,
        422,
      );
      const edit = await request(f, `drafts/${d.draftId}`, {
        method: "PUT",
        body,
        key,
        etag: '"v1"',
      }).then(ok);
      assert.equal(edit.draft.payload.fitNotes, body.payload.fitNotes);
      assert.equal(
        (
          await request(f, `drafts/${d.draftId}`, {
            method: "PUT",
            body: { ...body, payload: v },
            key,
            etag: '"v1"',
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await request(f, `drafts/${d.draftId}`, {
            method: "PUT",
            body,
            etag: '"v1"',
          })
        ).status,
        412,
      );
      const withdrawn = {
        form: approval.form,
        baseId: approval.id,
        operation: "withdraw",
        policy: approval.policy,
        reason: "SYNTHETIC withdrawal",
        reviewed: true,
      };
      await promoteDesign(
        f,
        await saveDesign(f, withdrawn, "measurement.use"),
      ).then(ok);
      assert.equal(
        (await promoteDesign(f, await saveDesign(f, v, "measurement.session")))
          .status,
        409,
      );
      const revoked = (
        await request(f, "measurements/use", {
          method: "POST",
          body: { form: approval.form },
        }).then(ok)
      ).approval;
      assert.equal(revoked.operation, "withdraw");
      const renewal = {
        ...withdrawn,
        baseId: revoked.id,
        operation: "approve",
        reason: "SYNTHETIC renewed policy review",
      };
      const renewalA = await saveDesign(f, renewal, "measurement.use"),
        renewalB = await saveDesign(
          f,
          { ...renewal, reason: "SYNTHETIC competing review" },
          "measurement.use",
        );
      const policyRace = await Promise.all([
        promoteDesign(f, renewalA),
        promoteDesign(f, renewalB),
      ]);
      assert.deepEqual(policyRace.map((r) => r.status).sort(), [200, 412]);
      const renewed = (
        await request(f, "measurements/use", {
          method: "POST",
          body: { form: approval.form },
        }).then(ok)
      ).approval;
      assert.equal(renewed.baseId, revoked.id);
      assert.equal(renewed.operation, "approve");
    }),
);

test(
  "MV-A05/08/11 runtime SQL guards, concurrent first selection and injected atomic rollback",
  { timeout: 240000 },
  () =>
    withMeasurements(async (f, { v, s }) => {
      const d = await saveDesign(f, v, "measurement.session");
      const count = async () =>
        (
          await f.admin.query(
            "select (select count(*) from measurement_event)::int events,(select count(*) from measurement_version)::int versions,(select count(*) from measurement_value)::int values,(select count(*) from audit_event)::int audits,(select count(*) from idempotency_key)::int keys,(select count(*) from measurement_draft_value)::int responses",
          )
        ).rows;
      for (const table of [
        "measurement_event",
        "measurement_private",
        "measurement_version",
        "measurement_value",
        "measurement_draft_value",
        "idempotency_key",
        "audit_event",
        "durable_draft",
      ]) {
        await f.admin.query(
          `create function test_measurement_failure() returns trigger language plpgsql as $$begin if TG_TABLE_NAME='audit_event' and NEW.action not like 'measurement.%' then return NEW;end if;if TG_TABLE_NAME='idempotency_key' and NEW.action<>'draft.promote' then return NEW;end if;raise exception 'synthetic injected measurement rollback';end$$`,
        );
        await f.admin.query(
          `create trigger test_measurement_failure after ${table === "durable_draft" ? "update" : "insert"} on ${table} for each row execute function test_measurement_failure()`,
        );
        const before = await count();
        assert.equal((await promoteDesign(f, d)).status, 503);
        assert.deepEqual(await count(), before);
        await f.admin.query(
          `drop trigger test_measurement_failure on ${table}`,
        );
        await f.admin.query("drop function test_measurement_failure()");
      }
      const saved = await promoteDesign(f, d).then(ok),
        version = await request(
          f,
          `measurements/versions/${saved.draft.result.id}`,
        ).then(ok);
      for (const statement of [
        sql`update measurement_value set raw_text='999' where shop_id=${f.a.shop}::uuid`,
        sql`delete from measurement_version where shop_id=${f.a.shop}::uuid`,
        sql`insert into measurement_event(shop_id,id,operation,customer_id,wearer_id,actor_id,origin_draft_id,audit_id,command_key) values(${f.a.shop}::uuid,uuidv7(),'save',${v.customerId}::uuid,${v.wearerId}::uuid,${f.a.user}::uuid,${d.draftId}::uuid,uuidv7(),uuidv7())`,
      ]) {
        await assert.rejects(
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(statement),
          ),
        );
      }
      const accepted = await s.accept(),
        target = {
          orderId: accepted.order.id,
          pieceId: accepted.pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id,
        };
      const a = await saveDesign(
          f,
          measurementSelectionDraft(version, target),
          "measurement.session",
        ),
        b = await saveDesign(
          f,
          measurementSelectionDraft(version, target),
          "measurement.session",
        );
      await f.admin.query(
        `create function test_selection_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic injected selection rollback';end$$`,
      );
      await f.admin.query(
        "create trigger test_selection_failure after insert on measurement_selection for each row execute function test_selection_failure()",
      );
      const beforeSelection = await count();
      assert.equal((await promoteDesign(f, a)).status, 503);
      assert.deepEqual(await count(), beforeSelection);
      await f.admin.query(
        "drop trigger test_selection_failure on measurement_selection",
      );
      await f.admin.query("drop function test_selection_failure()");
      const race = await Promise.all([
        promoteDesign(f, a),
        promoteDesign(f, b),
      ]);
      assert.deepEqual(race.map((r) => r.status).sort(), [200, 412]);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from measurement_selection",
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "MV-A07/09 current guardian measurement purpose precedes draft persistence and audited erasure covers all copies",
  { timeout: 240000 },
  () =>
    withMeasurements(async (f, { v, form, approval, identity }) => {
      const c = await request(f, `customers/${identity.customerId}`).then(ok),
        at = new Date().toISOString();
      const child = await request(
        f,
        `customers/${identity.customerId}/wearers`,
        {
          method: "POST",
          body: {
            mode: "new",
            displayName: "SYNTHETIC minor",
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
              source: "phone",
              occurredAt: at,
              interaction: "SYNTHETIC registration",
            },
          },
        },
      ).then(ok);
      const minor = { ...v, wearerId: child.wearerId };
      const draftId = () => {
        const r = randomUUID();
        return `${r.slice(0, 14)}7${r.slice(15)}`;
      };
      const attempt = () =>
        request(f, `drafts/${draftId()}`, {
          method: "PUT",
          body: {
            workflow: "measurement.session",
            schemaVersion: 1,
            payload: minor,
          },
        });
      assert.equal((await attempt()).status, 404);
      const path = `customers/${identity.customerId}/wearers/${child.wearerId}/guardians`;
      await request(f, path, {
        method: "POST",
        etag: '"v1"',
        body: {
          guardian: { mode: "new", displayName: "SYNTHETIC parent" },
          authority: "parent",
          scope: "measurement-and-private-photo",
          source: "phone",
          occurredAt: at,
        },
      }).then(ok);
      let guardian = await request(f, path).then(ok);
      await request(f, `${path}/verification-events`, {
        method: "POST",
        etag: `"v${guardian.version}"`,
        body: {
          authorityId: guardian.authority.id,
          status: "confirmed",
          method: "synthetic-review-v1",
          evidenceRef: "SYNTHETIC reviewed verification",
          scope: guardian.authority.scope,
          source: "in-person",
          occurredAt: at,
        },
      }).then(ok);
      guardian = await request(f, path).then(ok);
      const purpose = {
        authorityId: guardian.authority.id,
        purpose: "private-photo",
        decision: "grant",
        noticeId: syntheticGuardianPolicy.notice.id,
        noticeExplained: true,
        language: "en",
        giverPersonId: guardian.authority.personId,
        source: "in-person",
        occurredAt: at,
      };
      await request(f, `${path}/consent-events`, {
        method: "POST",
        etag: `"v${guardian.version}"`,
        body: purpose,
      }).then(ok);
      assert.equal((await attempt()).status, 404);
      guardian = await request(f, path).then(ok);
      await request(f, `${path}/consent-events`, {
        method: "POST",
        etag: `"v${guardian.version}"`,
        body: { ...purpose, purpose: "measurement" },
      }).then(ok);
      const d = await saveDesign(f, minor, "measurement.session"),
        key = randomUUID(),
        result = await promoteDesign(f, d, key).then(ok);
      guardian = await request(f, path).then(ok);
      // Hold a real withdrawal after it owns the wearer barrier. A new private
      // draft must wait, then deny after withdrawal commits, without storing text.
      await f.admin.query(
        `create function test_measurement_withdrawal() returns trigger language plpgsql as $$begin if NEW.purpose='measurement' and NEW.decision='withdrawal' then perform pg_advisory_xact_lock(153007);end if;return NEW;end$$`,
      );
      await f.admin.query(
        "create trigger test_measurement_withdrawal after insert on guardian_purpose_event for each row execute function test_measurement_withdrawal()",
      );
      const gate = await f.admin.connect();
      let withdrawal, racingDraft;
      try {
        await gate.query("begin");
        await gate.query("select pg_advisory_xact_lock(153007)");
        withdrawal = request(f, `${path}/consent-events`, {
          method: "POST",
          etag: `"v${guardian.version}"`,
          body: { ...purpose, purpose: "measurement", decision: "withdrawal" },
        });
        let blocked = false;
        for (let i = 0; i < 40; i++) {
          if (
            (
              await f.admin.query(
                "select exists(select 1 from pg_stat_activity where wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0) waiting",
              )
            ).rows[0].waiting
          ) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        assert(
          blocked,
          "Withdrawal reached the controlled transaction barrier",
        );
        let finished = false;
        racingDraft = attempt().then((r) => {
          finished = true;
          return r;
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(
          finished,
          false,
          "Private draft waits for current guardian purpose",
        );
        await gate.query("commit");
        await withdrawal.then(ok);
        assert.equal((await racingDraft).status, 404);
      } finally {
        await gate.query("rollback");
        gate.release();
        await Promise.allSettled([withdrawal, racingDraft]);
        await f.admin.query(
          "drop trigger test_measurement_withdrawal on guardian_purpose_event",
        );
        await f.admin.query("drop function test_measurement_withdrawal()");
      }
      assert.equal(
        (await request(f, `measurements/versions/${result.draft.result.id}`))
          .status,
        404,
      );
      assert.equal((await request(f, `drafts/${d.draftId}`)).status, 404);
      assert.equal((await promoteDesign(f, d, key)).status, 404);
      const adult = await publishMeasurement(
        f,
        measurementDraft(identity, form, approval),
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`select redact_measurements(${f.a.shop}::uuid,${identity.wearerId}::uuid,${randomUUID()}::uuid)`,
          ),
        ),
      );
      await f.admin.query("begin");
      try {
        await f.admin.query("set local role app_privacy");
        await f.admin.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await f.admin.query("select redact_measurements($1,$2,$3)", [
          f.a.shop,
          identity.wearerId,
          randomUUID(),
        ]);
        await f.admin.query("commit");
      } catch (e) {
        await f.admin.query("rollback");
        throw e;
      }
      assert.equal(
        (
          await request(
            f,
            `measurements/versions/${adult.result.draft.result.id}`,
          )
        ).status,
        404,
      );
      const copies = await f.admin.query(
        "select payload from measurement_draft_value where wearer_id=$1",
        [identity.wearerId],
      );
      assert(copies.rows.length);
      assert(
        copies.rows.every(
          (r) =>
            r.payload.erased &&
            r.payload.values.length === 0 &&
            !r.payload.fitNotes &&
            !r.payload.source.measurer,
        ),
      );
      const values = await f.admin.query(
        "select x.* from measurement_value x join measurement_event e on (e.shop_id,e.id)=(x.shop_id,x.version_id) where e.wearer_id=$1",
        [identity.wearerId],
      );
      assert(
        values.rows.every(
          (r) =>
            r.raw_text === null && r.numeric_value === null && r.redacted_at,
        ),
      );
      assert.equal((await attempt()).status, 404); // Withdrawn minor remains denied independently.
    }),
);

test(
  "MV-A01/02/03/05/08/11 real PostgreSQL immutable observation and separate first selection",
  { timeout: 240000 },
  () =>
    withTenantFixture(
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
            },
            s = await specificationSources(f, identity);
          const form = s.forms[0],
            approval = await approveMeasurementForm(f, form),
            v = measurementDraft(identity, form, approval);
          const d = await saveDesign(f, v, "measurement.session"),
            key = randomUUID();
          const promoted = await promoteDesign(f, d, key).then(ok),
            replay = await promoteDesign(f, d, key).then(ok);
          assert.deepEqual(replay, promoted);
          const saved = await request(
            f,
            `measurements/versions/${promoted.draft.result.id}`,
          ).then(ok);
          assert.equal(saved.values[0].rawText, "12 1/4");
          assert.equal(saved.values[0].numeric, "12.25");
          assert.deepEqual(saved.values[0].exact, {
            numerator: "49",
            denominator: "4",
          });
          const accepted = await s.accept(),
            target = {
              orderId: accepted.order.id,
              pieceId: accepted.pieces.identities.find(
                (p) => p.key === s.top.definition.content.code,
              ).id,
            };
          const state = () =>
            request(f, "measurements/target", {
              method: "POST",
              body: target,
            }).then(ok);
          assert.equal((await state()).selectedId, null);
          const wrongFormTarget = {
            orderId: accepted.order.id,
            pieceId: accepted.pieces.identities.find(
              (p) => p.key === s.bottom.definition.content.code,
            ).id,
          };
          const wrongForm = await saveDesign(
            f,
            measurementSelectionDraft(saved, wrongFormTarget),
            "measurement.session",
          );
          assert.equal((await promoteDesign(f, wrongForm)).status, 409);
          assert.equal(
            (await request(f, `measurements/versions/${saved.id}`).then(ok))
              .values[0].rawText,
            "12 1/4",
          );
          await publishMeasurement(f, measurementSelectionDraft(saved, target));
          assert.equal((await state()).selectedId, saved.id);
          const another = await s.accept(),
            otherTarget = {
              orderId: another.order.id,
              pieceId: another.pieces.identities.find(
                (p) => p.key === s.top.definition.content.code,
              ).id,
            };
          const reuseDraft = await saveDesign(
            f,
            measurementSelectionDraft(saved, otherTarget),
            "measurement.session",
          );
          assert.equal(
            (await promoteDesign(f, reuseDraft)).status,
            409,
            "Contextual reuse requires the separate B workflow",
          );
          assert.equal(
            (
              await request(f, "measurements/target", {
                method: "POST",
                body: otherTarget,
              }).then(ok)
            ).selectedId,
            null,
          );
          const repeated = await saveDesign(
            f,
            measurementSelectionDraft(saved, target),
            "measurement.session",
          );
          assert.equal((await promoteDesign(f, repeated)).status, 412);
          assert.equal(
            (
              await request(f, `measurements/versions/${saved.id}`, {
                who: f.b,
              })
            ).status,
            404,
          );
          const ids = await assertIsolationCatalog(f.runtime.db);
          assert(ids.includes("public.measurement_value"));
        } finally {
          await seed.close();
        }
      },
      { customerPolicy: syntheticCustomerPolicy },
    ),
);
