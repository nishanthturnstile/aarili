import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { productionJobComposition } from "@aarili/jobs/production";
import { startJobRuntime } from "@aarili/jobs/runtime";
import { createMeasurementFitErasureStorage } from "@aarili/platform/media-storage";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import { referenceItem } from "../scripts/test-support/design-reference-fixtures.mjs";
import { specificationDraft } from "../scripts/test-support/design-specification-fixtures.mjs";
import {
  additionalFitWearer,
  admitFitImage,
  eraseMeasurementFit,
  fitIdentity,
  fitPhotoConsent,
  fitReferenceDraft,
  fitState,
  publishFitReference,
  publishFitSubject,
  withMeasurementFit,
} from "../scripts/test-support/measurement-fit-fixtures.mjs";
import {
  measurementSelectionDraft,
  publishMeasurement,
} from "../scripts/test-support/measurement-session-fixtures.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const image = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();

test(
  "MV-C01/03/04 exact private fitting references append replacement history without changing text or selecting a version",
  { timeout: 240000 },
  () =>
    withMeasurementFit(async (f) => {
      const before = await designRequest(
        f,
        `measurements/versions/${f.version.id}`,
      ).then(designOk);
      assert.equal((await fitState(f)).subject, null);
      const subject = await publishFitSubject(f),
        grant = await admitFitImage(f, subject, await image());
      const attempt = await f.complete(grant);
      assert.equal(await f.process(grant, attempt), "accepted");
      const draft = await saveDesign(
          f,
          fitReferenceDraft(f, grant.asset.id),
          "measurement.fit-reference",
        ),
        key = randomUUID();
      const committed = await promoteDesign(f, draft, key).then(designOk),
        replay = await promoteDesign(f, draft, key).then(designOk);
      assert.deepEqual(replay, committed);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from measurement_fit_reference",
          )
        ).rows[0].n,
        1,
      );
      const first = (await fitState(f)).references[0];
      const read = await designRequest(f, "measurements/fit/read", {
        method: "POST",
        body: {
          measurementVersionId: f.version.id,
          referenceId: first.id,
          variant: "display",
        },
      }).then(designOk);
      assert.equal((await fetch(read.access.url)).status, 200);
      assert.equal(
        (await designRequest(f, `files/${grant.asset.id}/access`)).status,
        404,
      );
      const target = await f.sources.accept(),
        pieceId = target.pieces.identities.find(
          (p) => p.key === f.sources.top.definition.content.code,
        ).id;
      const designAttempt = await designRequest(
        f,
        `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
        {
          method: "PUT",
          body: {
            workflow: "design.specification",
            schemaVersion: 2,
            payload: {
              ...specificationDraft(
                target.order.id,
                pieceId,
                f.sources.profile,
              ),
              referenceItems: [referenceItem(grant.asset.id)],
            },
          },
        },
      );
      assert.equal(designAttempt.status, 404);
      for (const purpose of ["wearer-photo", "manual-pattern"])
        assert.equal(
          (
            await designRequest(f, "files/uploads", {
              method: "POST",
              body: {
                subjectId: subject.id,
                purpose,
                contentType: "image/jpeg",
                size: 100,
              },
            })
          ).status,
          403,
        );
      await assert.rejects(
        () =>
          withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`insert into media_reference(shop_id,asset_id,reference_id) values(${f.a.shop}::uuid,${grant.asset.id}::uuid,${randomUUID()}::uuid)`,
            ),
          ),
        (e) => e.cause?.code === "23514",
      );
      assert.equal(
        (
          await designRequest(
            f,
            `files/${grant.asset.id}/variants/display/access`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await designRequest(f, "measurements/fit/read", {
            method: "POST",
            who: f.b,
            body: {
              measurementVersionId: f.version.id,
              referenceId: first.id,
              variant: "display",
            },
          })
        ).status,
        404,
      );
      const replacement = await publishFitReference(f, {
        ...fitReferenceDraft(f, grant.asset.id, first),
        caption: "SYNTHETIC corrected caption",
      });
      const state = await fitState(f),
        next = state.references.find(
          (r) => r.id === replacement.result.draft.result.id,
        );
      assert.equal(next.previousId, first.id);
      assert.equal(next.version, 2);
      assert.equal(
        state.references.find((r) => r.id === first.id).caption,
        first.caption,
      );
      const stale = await saveDesign(
        f,
        fitReferenceDraft(f, grant.asset.id, first),
        "measurement.fit-reference",
      );
      assert.equal((await promoteDesign(f, stale)).status, 412);
      const contenders = await Promise.all(
        ["left", "right"].map((side) =>
          saveDesign(
            f,
            {
              ...fitReferenceDraft(f, grant.asset.id, next),
              caption: `SYNTHETIC concurrent ${side}`,
            },
            "measurement.fit-reference",
          ),
        ),
      );
      const raced = await Promise.all(
        contenders.map((candidate) => promoteDesign(f, candidate)),
      );
      assert.deepEqual(raced.map((r) => r.status).sort(), [200, 412]);
      const racedHistory = (await fitState(f)).references;
      assert.equal(
        racedHistory.filter((r) => r.previousId === next.id).length,
        1,
      );
      assert.equal(
        racedHistory.find((r) => r.id === first.id).caption,
        first.caption,
      );
      assert.deepEqual(
        await designRequest(f, `measurements/versions/${f.version.id}`).then(
          designOk,
        ),
        before,
      );
      await designRequest(f, "measurements/fit/read", {
        method: "POST",
        body: {
          measurementVersionId: f.version.id,
          referenceId: first.id,
          variant: "thumbnail",
        },
      }).then(designOk);
      for (let i = 0; i < 25; i++)
        await publishFitReference(f, {
          ...fitReferenceDraft(f, grant.asset.id),
          caption: `SYNTHETIC independent reference ${i}`,
        });
      const firstPage = await fitState(f),
        older = await fitState(f, firstPage.next);
      assert.equal(firstPage.references.length, 25);
      assert(firstPage.next);
      assert.equal(older.references.length, 3);
      assert.equal(older.next, null);
      assert.equal(
        new Set([...firstPage.references, ...older.references].map((r) => r.id))
          .size,
        28,
      );
      await assertIsolationCatalog(f.runtime.db);
    }),
);

test(
  "MV-C02/03 minor measurement grant is not photo authority; same-payer wearers cannot exchange fitting assets or references",
  { timeout: 240000 },
  () =>
    withMeasurementFit(async (f) => {
      const subject = await publishFitSubject(f),
        grant = await admitFitImage(f, subject, await image());
      assert.equal(await f.process(grant, await f.complete(grant)), "accepted");
      await publishFitReference(f, fitReferenceDraft(f, grant.asset.id));
      const ref = (await fitState(f)).references[0];
      const child = await additionalFitWearer(f, "minor");
      assert.equal(
        (await designRequest(f, `measurements/versions/${child.version.id}`))
          .status,
        200,
      );
      assert.equal(
        (
          await designRequest(f, "measurements/fit/list", {
            method: "POST",
            body: { measurementVersionId: child.version.id },
          })
        ).status,
        404,
      );
      await child.photoConsent("grant");
      const childSubject = await publishFitSubject(child),
        childGrant = await admitFitImage(child, childSubject, await image());
      assert.equal(
        await f.process(childGrant, await f.complete(childGrant)),
        "accepted",
      );
      assert.equal(
        (
          await designRequest(f, "measurements/fit/read", {
            method: "POST",
            body: {
              measurementVersionId: child.version.id,
              referenceId: ref.id,
              variant: "display",
            },
          })
        ).status,
        404,
      );
      const forged = await designRequest(
        f,
        `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
        {
          method: "PUT",
          body: {
            workflow: "measurement.fit-reference",
            schemaVersion: 1,
            payload: fitReferenceDraft(child, grant.asset.id),
          },
        },
      );
      assert.equal(forged.status, 404);
      await assert.rejects(
        () =>
          withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`insert into measurement_fit_asset(shop_id,asset_id,subject_id) values(${f.a.shop}::uuid,${grant.asset.id}::uuid,${childSubject.id}::uuid)`,
            ),
          ),
        (e) => e.cause?.code === "23514",
      );
      await child.photoConsent("withdrawal");
      assert.equal(
        (await designRequest(f, `files/${childGrant.asset.id}/status`)).status,
        404,
      );
      assert.equal(
        (await designRequest(f, `measurements/versions/${child.version.id}`))
          .status,
        200,
      );
      const second = await additionalFitWearer(f, "adult");
      await second.photoConsent("grant");
      await publishFitSubject(second);
      const wrong = await designRequest(
        f,
        `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
        {
          method: "PUT",
          body: {
            workflow: "measurement.fit-reference",
            schemaVersion: 1,
            payload: fitReferenceDraft(second, grant.asset.id),
          },
        },
      );
      assert.equal(wrong.status, 404);
      assert.equal((await fitState(second)).references.length, 0);
      const path = `customers/${f.identity.customerId}/wearers/${f.identity.wearerId}`,
        w = await designRequest(f, path).then(designOk),
        { id: _id, customerId: _customer, ...relationship } = w.relationship;
      await designRequest(f, path, {
        method: "PATCH",
        etag: `"v${w.version}"`,
        body: {
          age: "unknown",
          preferences: w.preferences,
          relationship,
          reason: "SYNTHETIC age review denies fitting access",
        },
      }).then(designOk);
      assert.equal(
        (
          await designRequest(f, "measurements/fit/read", {
            method: "POST",
            body: {
              measurementVersionId: f.version.id,
              referenceId: ref.id,
              variant: "display",
            },
          })
        ).status,
        404,
      );
    }),
);

test(
  "MV-C02/05 erasure serializes with an in-flight fitting output write and purges that claim without post-erasure resurrection",
  { timeout: 240000 },
  () =>
    withMeasurementFit(async (f) => {
      const subject = await publishFitSubject(f),
        grant = await admitFitImage(f, subject, await image()),
        attempt = await f.complete(grant);
      const seal = f.storage.seal;
      let entered,
        release,
        first = true;
      const ready = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      f.storage.seal = async (...args) => {
        const key = await seal(...args);
        if (first) {
          first = false;
          entered();
          await gate;
        }
        return key;
      };
      const running = f.process(grant, attempt).then(
        (outcome) => ({ outcome }),
        (error) => ({ error }),
      );
      let erasing;
      try {
        await Promise.race([
          ready,
          running.then(() =>
            assert.fail("Missing protected fitting output barrier"),
          ),
        ]);
        erasing = eraseMeasurementFit(f);
        let blocked = false;
        for (let i = 0; i < 60; i++) {
          blocked = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='advisory') blocked",
            )
          ).rows[0].blocked;
          if (blocked) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        assert(
          blocked,
          "Erasure must wait for the protected output transaction",
        );
      } finally {
        release();
        f.storage.seal = seal;
      }
      await erasing;
      const result = await running;
      assert(result.error && [403, 404].includes(result.error.status));
      assert.equal(
        (await f.admin.query("select count(*)::int n from media_derivative"))
          .rows[0].n,
        0,
      );
      const queued = (
        await f.admin.query(
          "select j.data from measurement_fit_purge p join pgboss.job j on j.id=p.id and j.name='media.process' where p.phase='retained'",
        )
      ).rows[0].data;
      const actual = createMeasurementFitErasureStorage(f.config);
      let removed = 0;
      try {
        const c = productionJobComposition((tx, shop) => ({
          ...f.adapters(tx, shop),
          erasureStorage: {
            objects: (prefix) => actual.objects(prefix),
            async remove(key) {
              removed++;
              await actual.remove(key);
            },
          },
        }));
        assert.equal(
          await c.handlers.get("media.process")(
            f.parallel.db,
            queued,
            async () => {},
          ),
          "completed",
        );
        assert.equal(removed, 1);
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from measurement_fit_purge_receipt",
            )
          ).rows[0].n,
          1,
        );
      } finally {
        actual.destroy();
      }
    }),
);

test(
  "MV-C01/05 populated 0047 to 0048 upgrade preserves selected measurement, form, order and design snapshots without inventing images; reapplication is inert",
  { timeout: 240000 },
  () =>
    withMeasurementFit(
      async (f) => {
        const target = await f.sources.accept(),
          pieceId = target.pieces.identities.find(
            (p) => p.key === f.sources.top.definition.content.code,
          ).id;
        await publishMeasurement(
          f,
          measurementSelectionDraft(f.version, {
            orderId: target.order.id,
            pieceId,
          }),
        );
        const snapshot = async () => {
          const values = {};
          for (const table of [
            "measurement_event",
            "measurement_version",
            "measurement_value",
            "measurement_private",
            "measurement_selection",
            "measurement_form_revision",
            "order_acceptance_snapshot",
            "order_piece",
            "garment_order",
            "design_spec_version",
            "design_spec_value",
          ])
            values[table] = (
              await f.admin.query(
                `select row_to_json(t) value from ${table} t order by row_to_json(t)::text`,
              )
            ).rows;
          return values;
        };
        const before = await snapshot();
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(await snapshot(), before);
        assert.equal((await fitState(f)).subject, null);
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from measurement_fit_reference",
            )
          ).rows[0].n,
          0,
        );
        const history = (
          await f.admin.query(
            "select name,sha256 from aarili_migration order by name",
          )
        ).rows;
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(
          (
            await f.admin.query(
              "select name,sha256 from aarili_migration order by name",
            )
          ).rows,
          history,
        );
        assert.deepEqual(await snapshot(), before);
        await assertIsolationCatalog(f.runtime.db);
      },
      { migrationThrough: "0047_measurement_history.sql" },
    ),
);
test(
  "MV-C05 audited erasure rolls back atomically, scrubs every private copy, queues retained/staging phases and purges exact S3 bytes with retry receipts",
  { timeout: 240000 },
  () =>
    withMeasurementFit(async (f) => {
      const subject = await publishFitSubject(f),
        grant = await admitFitImage(f, subject, await image()),
        attempt = await f.complete(grant);
      assert.equal(await f.process(grant, attempt), "accepted");
      const sentinel = "SYNTHETIC FIT PRIVATE ERASE 155";
      const saved = await publishFitReference(f, {
        ...fitReferenceDraft(f, grant.asset.id),
        caption: sentinel,
        reason: sentinel,
      });
      const first = (await fitState(f)).references[0],
        pending = await saveDesign(
          f,
          {
            ...fitReferenceDraft(f, grant.asset.id, first),
            caption: sentinel,
            reason: sentinel,
          },
          "measurement.fit-reference",
        );
      const capability = await designRequest(f, "measurements/fit/read", {
        method: "POST",
        body: {
          measurementVersionId: f.version.id,
          referenceId: first.id,
          variant: "display",
        },
      }).then(designOk);
      assert.equal((await fetch(capability.access.url)).status, 200);
      await assert.rejects(
        () =>
          withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`select redact_measurements(${f.a.shop}::uuid,${f.identity.wearerId}::uuid,${randomUUID()}::uuid)`,
            ),
          ),
        (e) => e.cause?.code === "42501",
      );
      await f.admin.query(
        "create function fail_fit_erasure() returns trigger language plpgsql as $$begin raise exception 'Injected fitting intent failure';end$$;create trigger fail_fit_erasure before insert on measurement_fit_purge for each row execute function fail_fit_erasure()",
      );
      await assert.rejects(
        () => eraseMeasurementFit(f),
        /Injected fitting intent failure/,
      );
      assert.equal((await fitState(f)).references[0].caption, sentinel);
      assert.equal(
        (await f.admin.query("select count(*)::int n from measurement_erasure"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from measurement_fit_purge",
          )
        ).rows[0].n,
        0,
      );
      await f.admin.query(
        "drop trigger fail_fit_erasure on measurement_fit_purge;drop function fail_fit_erasure()",
      );
      await eraseMeasurementFit(f);
      for (const path of [
        `drafts/${saved.draftId}`,
        `drafts/${pending.draftId}`,
      ])
        assert.equal((await designRequest(f, path)).status, 404);
      assert.equal((await promoteDesign(f, saved)).status, 404);
      assert.equal(
        (
          await designRequest(f, "measurements/fit/list", {
            method: "POST",
            body: { measurementVersionId: f.version.id },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await designRequest(f, "measurements/fit/read", {
            method: "POST",
            body: {
              measurementVersionId: f.version.id,
              referenceId: first.id,
              variant: "display",
            },
          })
        ).status,
        404,
      );
      assert.equal(
        (await designRequest(f, `files/${grant.asset.id}/access`)).status,
        404,
      );
      const values = await f.admin.query(
        "select caption,reason from measurement_fit_value",
      );
      assert(values.rows.every((v) => v.caption === null && v.reason === null));
      const copies = await f.admin.query(
        "select payload::text value from durable_draft where workflow in ('measurement.fit-subject','measurement.fit-reference') union all select payload::text from measurement_fit_draft_value",
      );
      assert(copies.rows.every((v) => !v.value.includes(sentinel)));
      const intents = (
        await f.admin.query(
          "select p.*,j.data,j.start_after from measurement_fit_purge p join pgboss.job j on j.id=p.id and j.name='media.process' order by p.phase",
        )
      ).rows;
      assert.equal(intents.length, 2);
      const retained = intents.find((i) => i.phase === "retained"),
        staging = intents.find((i) => i.phase === "staging");
      assert.equal(retained.manifest.keys.length, 3);
      assert.equal(staging.manifest.keys.length, 1);
      assert(staging.start_after > new Date());
      await eraseMeasurementFit(f);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from measurement_fit_purge",
          )
        ).rows[0].n,
        2,
      );
      const actual = createMeasurementFitErasureStorage(f.config);
      let removed = 0;
      const storage = {
        objects: (prefix) => actual.objects(prefix),
        async remove(key) {
          removed++;
          return actual.remove(key);
        },
      };
      const composition = productionJobComposition((tx, shop) => ({
        ...f.adapters(tx, shop),
        erasureStorage: storage,
      }));
      const run = (data, before = async () => {}) =>
        composition.handlers.get("media.process")(f.parallel.db, data, before);
      try {
        assert.equal(
          await run({ ...retained.data, epoch: randomUUID() }),
          "quarantined",
        );
        assert.equal(removed, 0);
        await assert.rejects(() => run(staging.data), /not yet eligible/);
        assert.equal(removed, 0);
        let checkpoints = 0;
        await assert.rejects(
          () =>
            run(retained.data, async () => {
              if (++checkpoints === 2) throw Error("Injected receipt rollback");
            }),
          /Injected receipt rollback/,
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from measurement_fit_purge_receipt",
            )
          ).rows[0].n,
          0,
        );
        const worker = await startJobRuntime(
          f.runtime.pool.options.connectionString,
          { mode: "inprocess", pollMilliseconds: 50 },
          composition,
        );
        try {
          const deadline = Date.now() + 15000;
          let done = false;
          while (Date.now() < deadline) {
            done = (
              await f.admin.query(
                "select state='completed' done from pgboss.job where name='media.process' and id=$1",
                [retained.id],
              )
            ).rows[0]?.done;
            if (done) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          assert(
            done,
            "Actual queued fitting purge must complete through the registered worker",
          );
        } finally {
          await worker.stop();
        }
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from measurement_fit_purge_receipt",
            )
          ).rows[0].n,
          3,
        );
        assert(
          [403, 404].includes((await fetch(capability.access.url)).status),
        );
        const after = removed;
        assert.equal(await run(retained.data), "completed");
        assert.equal(removed, after);
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from measurement_fit_reference",
            )
          ).rows[0].n,
          1,
        );
      } finally {
        actual.destroy();
      }
    }),
);

test(
  "MV-C02/04 measurement authority alone cannot prepare photos; withdrawal at completion and during processing denies bytes while text remains usable",
  { timeout: 240000 },
  () =>
    withMeasurementFit(
      async (f) => {
        assert.equal(
          (
            await designRequest(f, "measurements/fit/list", {
              method: "POST",
              body: { measurementVersionId: f.version.id },
            })
          ).status,
          404,
        );
        assert.equal(
          (await designRequest(f, `measurements/versions/${f.version.id}`))
            .status,
          200,
        );
        const denied = await designRequest(
          f,
          `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
          {
            method: "PUT",
            body: {
              workflow: "measurement.fit-subject",
              schemaVersion: 1,
              payload: fitIdentity(f),
            },
          },
        );
        assert.equal(denied.status, 404);
        await fitPhotoConsent(f, "grant");
        const subject = await publishFitSubject(f),
          grant = await admitFitImage(f, subject, await image());
        await fitPhotoConsent(f, "withdrawal");
        assert(
          [403, 404].includes(
            (
              await designRequest(f, `files/${grant.asset.id}/complete`, {
                method: "POST",
                etag: '"v1"',
                body: {},
              })
            ).status,
          ),
        );
        assert.equal(
          (await designRequest(f, `measurements/versions/${f.version.id}`))
            .status,
          200,
        );
        await fitPhotoConsent(f, "grant");
        const attempt = await f.complete(grant);
        const snapshot = f.storage.snapshot;
        let entered, release;
        const ready = new Promise((r) => {
            entered = r;
          }),
          gate = new Promise((r) => {
            release = r;
          });
        f.storage.snapshot = async (...args) => {
          entered();
          await gate;
          return snapshot(...args);
        };
        const running = f.process(grant, attempt);
        await Promise.race([
          ready,
          running.then(() => assert.fail("Missing fitting read barrier")),
        ]);
        try {
          await fitPhotoConsent(f, "withdrawal");
        } finally {
          release();
        }
        await assert.rejects(running, (e) => [403, 404].includes(e.status));
        f.storage.snapshot = snapshot;
        assert.equal(
          (await f.admin.query("select count(*)::int n from media_derivative"))
            .rows[0].n,
          0,
        );
        assert.equal(
          (await designRequest(f, `measurements/versions/${f.version.id}`))
            .status,
          200,
        );
      },
      { photo: false },
    ),
);
