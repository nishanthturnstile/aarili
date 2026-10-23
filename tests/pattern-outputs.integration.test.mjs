import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { productionJobComposition } from "@aarili/jobs/production";
import { createMeasurementFitErasureStorage } from "@aarili/platform/media-storage";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  patternPage,
  physicalPattern,
  publishPattern,
  publishPatternCapability,
  referenceAction,
  withPatterns,
} from "../scripts/test-support/manual-pattern-fixtures.mjs";
import { eraseMeasurementFit } from "../scripts/test-support/measurement-fit-fixtures.mjs";
import { blankPdf } from "../scripts/test-support/media-formats.mjs";
import {
  admitPatternOutput,
  latestOutput,
  outputDraft,
  outputRead,
  publishOutput,
  publishPatternSubject,
  saveOutput,
  targetPattern,
  withPatternOutputs,
} from "../scripts/test-support/pattern-output-fixtures.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const sketch = () =>
  sharp({ create: { width: 80, height: 60, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
const samplePdf = () => blankPdf("% SAMPLE / SCALE UNVERIFIED\n");
const reviewReuse = (f, id) =>
  designRequest(f, "manual-patterns/reuse", {
    method: "POST",
    body: { ...f.scope, referenceId: id },
  });
const commit = async (f, v) =>
  publishPattern(f, await referenceAction(f, v.id, "select"));

test(
  "MP-B01/02/03/04/05/09 owned sketch/PDF lifecycle preserves physical and selected history, rejects pending/substituted bytes",
  { timeout: 240000 },
  () =>
    withPatternOutputs(async (f) => {
      await publishPattern(f, await physicalPattern(f));
      const physical = await latestOutput(f);
      await commit(f, physical);
      const legacy = await designRequest(f, "manual-patterns/list", {
        method: "POST",
        body: f.scope,
      }).then(designOk);
      assert(
        !("output" in legacy.state.versions[0]) &&
          !("source" in legacy.state.versions[0]),
        "A's strict physical-only reader remains compatible",
      );
      const subject = await publishPatternSubject(f),
        g = await admitPatternOutput(f, subject, await sketch());
      const pending = await saveOutput(f, await outputDraft(f, g.asset.id));
      assert.equal(
        (
          await designRequest(f, `drafts/${pending.draftId}`, {
            method: "PUT",
            key: pending.saveKey,
            body: {
              workflow: "pattern.reference",
              schemaVersion: 2,
              payload: {
                ...pending.draft.payload,
                reason: "SYNTHETIC changed retry payload",
              },
            },
          })
        ).status,
        422,
      );
      assert.equal((await promoteDesign(f, pending)).status, 409);
      const attempt = await f.complete(g);
      assert.equal((await promoteDesign(f, pending)).status, 409);
      assert.equal(await f.process(g, attempt), "accepted");
      const key = randomUUID(),
        saved = await promoteDesign(f, pending, key).then(designOk);
      assert.deepEqual(
        await promoteDesign(f, pending, key).then(designOk),
        saved,
      );
      let p = await patternPage(f),
        image = p.state.versions[0];
      assert.equal(
        (
          await designRequest(f, "manual-patterns/list", {
            method: "POST",
            body: f.scope,
          })
        ).status,
        409,
        "An older viewer cannot omit output/lineage limitations",
      );
      assert.equal(p.state.currentId, physical.id);
      assert.equal(image.previousId, physical.id);
      assert.equal(image.output.assetId, g.asset.id);
      assert(image.output.display.width > 0);
      assert.match(image.content.declaredScale, /UNVERIFIED/);
      assert.match(image.content.assumptions, /unverified/);
      assert.equal(p.comparisons[0].reviewState, "unreviewed");
      const read = await outputRead(f, image.id).then(designOk),
        bytes = await fetch(read.access.url);
      assert.equal(bytes.status, 200);
      assert.match(bytes.headers.get("Content-Type"), /^image\/webp/);
      for (const path of [
        `files/${g.asset.id}/access`,
        `files/${g.asset.id}/variants/display/access`,
      ])
        assert.equal((await designRequest(f, path)).status, 404);
      assert.equal((await outputRead(f, image.id, { who: f.b })).status, 404);
      for (const [purpose, contentType] of [
        ["private-fitting", "image/jpeg"],
        ["wearer-photo", "image/jpeg"],
        ["order-document", "application/pdf"],
      ])
        assert.equal(
          (
            await designRequest(f, "files/uploads", {
              method: "POST",
              body: {
                subjectId: subject.id,
                purpose,
                contentType,
                size: 100,
              },
            })
          ).status,
          403,
        );
      const target = await targetPattern(f);
      assert.equal((await outputRead(target, image.id)).status, 404);
      const wrong = { ...(await outputDraft(target, g.asset.id)) };
      const bad = await designRequest(
        target,
        `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
        {
          method: "PUT",
          body: {
            workflow: "pattern.reference",
            schemaVersion: 2,
            payload: wrong,
          },
        },
      );
      assert.equal(bad.status, 404);
      await assert.rejects(() =>
        withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`insert into media_reference(shop_id,asset_id,reference_id) values(${f.a.shop}::uuid,${g.asset.id}::uuid,${randomUUID()}::uuid)`,
          ),
        ),
      );
      await assert.rejects(() =>
        withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update pattern_output set evidence='{}'::jsonb where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      const akey = (
        await f.admin.query(
          "select accepted_key from media_asset where id=$1",
          [g.asset.id],
        )
      ).rows[0].accepted_key;
      await commit(f, image);
      const pdf = await admitPatternOutput(
        f,
        subject,
        samplePdf(),
        "application/pdf",
      );
      assert.equal(await f.process(pdf, await f.complete(pdf)), "accepted");
      const replacement = await saveOutput(
        f,
        await outputDraft(f, pdf.asset.id),
      );
      await f.admin.query(
        "create function reject_pattern_output_test() returns trigger language plpgsql as $$begin raise exception 'synthetic output failure';end$$;create trigger synthetic_pattern_output_failure before insert on pattern_output for each row execute function reject_pattern_output_test()",
      );
      try {
        assert.equal((await promoteDesign(f, replacement)).status, 503);
      } finally {
        await f.admin.query(
          "drop trigger synthetic_pattern_output_failure on pattern_output;drop function reject_pattern_output_test()",
        );
      }
      p = await patternPage(f);
      assert.equal(p.state.currentId, image.id);
      assert.equal(p.state.latestSavedId, image.id);
      await promoteDesign(f, replacement).then(designOk);
      const doc = await latestOutput(f);
      assert.equal(doc.output.display, null);
      assert.equal((await patternPage(f)).state.currentId, image.id);
      const download = await outputRead(f, doc.id).then(designOk),
        response = await fetch(download.access.url);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("Content-Disposition"), /^attachment/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), samplePdf());
      await commit(f, doc);
      await publishPattern(
        f,
        await physicalPattern(f, {
          content: { ...physical.content, locator: "Cabinet B / folder 13" },
        }),
      );
      p = await patternPage(f);
      assert.equal(p.state.currentId, doc.id);
      assert.equal(p.state.versions[0].output, null);
      assert.equal((await outputRead(f, image.id)).status, 200);
      assert.equal(
        (
          await f.admin.query(
            "select accepted_key from media_asset where id=$1",
            [g.asset.id],
          )
        ).rows[0].accepted_key,
        akey,
      );
      await withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        assertIsolationCatalog(tx),
      );
    }),
);

test(
  "MP-B07/08/09 explicit same-wearer reuse pins source lineage and fresh inputs, review remains stable and selection never carries over",
  { timeout: 240000 },
  () =>
    withPatternOutputs(async (f) => {
      const subject = await publishPatternSubject(f),
        g = await admitPatternOutput(f, subject, await sketch());
      await f.process(g, await f.complete(g));
      await publishOutput(f, await outputDraft(f, g.asset.id));
      const source = await latestOutput(f);
      await publishPattern(f, await referenceAction(f, source.id, "review"));
      await commit(f, source);
      const context = await designRequest(
        f,
        `orders/${f.scope.orderId}/repeat/source`,
        { method: "POST" },
      ).then(designOk);
      assert.equal(context.patternContext.adapterVersion, 1);
      assert.deepEqual(
        context.patternContext.references.map((r) => r.referenceId),
        [source.id],
      );
      const target = await targetPattern(f);
      assert.equal((await patternPage(target)).state.currentId, null);
      const compare = await reviewReuse(target, source.id).then(designOk);
      const value = await outputDraft(target, null, {
        reuse: { referenceId: source.id, digest: compare.digest },
        evidence: "SYNTHETIC source rights and target unknown inputs reviewed",
        acknowledged: true,
      });
      const d = await saveOutput(target, value),
        other = await saveOutput(target, value);
      const concurrent = await Promise.all([
        promoteDesign(target, d),
        promoteDesign(target, other),
      ]);
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 412]);
      let p = await patternPage(target),
        v = p.state.versions[0];
      assert.equal(p.state.currentId, null);
      assert.equal(v.source.referenceId, source.id);
      assert.equal(v.output.assetId, g.asset.id);
      assert.equal(v.content.design.state, "unknown");
      assert.equal(p.comparisons[0].reviewState, "unreviewed");
      await publishPattern(
        target,
        await referenceAction(target, v.id, "review"),
      );
      p = await patternPage(target);
      assert.equal(p.comparisons[0].reviewState, "reviewed");
      await commit(target, v);
      assert.equal((await patternPage(target)).state.currentId, v.id);
      assert.equal((await patternPage(f)).state.currentId, source.id);
      const access = await outputRead(target, v.id).then(designOk);
      assert.equal((await fetch(access.access.url)).status, 200);
      await publishPattern(
        f,
        await referenceAction(f, source.id, "review", {
          reviewState: "withdrawn",
        }),
      );
      assert.equal((await outputRead(target, v.id)).status, 404);
      assert.equal((await reviewReuse(target, source.id)).status, 404);
      assert.equal(
        (await designRequest(target, `drafts/${d.draftId}`)).status,
        404,
      );
    }),
);

test(
  "MP-B06/09 audited erasure redacts private replay and fences all retained/staging purge phases, deletion failure retries and restore epoch quarantines",
  { timeout: 420000 },
  () =>
    withPatternOutputs(async (f) => {
      const subject = await publishPatternSubject(f),
        g = await admitPatternOutput(f, subject, await sketch());
      await f.process(g, await f.complete(g));
      const saved = await publishOutput(f, await outputDraft(f, g.asset.id)),
        ref = await latestOutput(f);
      const capability = await outputRead(f, ref.id).then(designOk);
      const pending = await admitPatternOutput(
          f,
          subject,
          samplePdf(),
          "application/pdf",
        ),
        pendingAttempt = await f.complete(pending);
      await f.admin.query(
        "create function fail_pattern_erasure_test() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC purge enqueue failure';end$$;create trigger fail_pattern_erasure_test before insert on pattern_output_purge for each row execute function fail_pattern_erasure_test()",
      );
      try {
        await assert.rejects(
          () => eraseMeasurementFit(f),
          /purge enqueue failure/,
        );
      } finally {
        await f.admin.query(
          "drop trigger fail_pattern_erasure_test on pattern_output_purge;drop function fail_pattern_erasure_test()",
        );
      }
      assert.equal((await outputRead(f, ref.id)).status, 200);
      assert.equal(
        (await f.admin.query("select count(*)::int n from measurement_erasure"))
          .rows[0].n,
        0,
      );
      await eraseMeasurementFit(f);
      assert.equal((await outputRead(f, ref.id)).status, 404);
      assert.equal(
        (await designRequest(f, `drafts/${saved.draftId}`)).status,
        404,
      );
      assert.equal((await promoteDesign(f, saved)).status, 404);
      await assert.rejects(
        () => f.process(pending, pendingAttempt),
        (e) => [403, 404].includes(e.status),
      );
      const values = (
        await f.admin.query("select payload,redacted_at from pattern_value")
      ).rows;
      assert(values.every((r) => r.payload === null && r.redacted_at));
      const replays = (
        await f.admin.query(
          "select payload,redacted_at from pattern_draft_value",
        )
      ).rows;
      assert(replays.every((r) => r.redacted_at && r.payload.erased));
      assert(
        replays
          .filter((r) => "assetId" in r.payload)
          .every((r) => r.payload.assetId === null && r.payload.reuse === null),
      );
      const intents = (
        await f.admin.query(
          "select p.*,j.data from pattern_output_purge p join pgboss.job j on j.id=p.id order by p.phase,p.asset_id",
        )
      ).rows;
      assert.equal(intents.length, 4);
      const erasure = createMeasurementFitErasureStorage(f.config);
      let deletes = 0,
        fail = true;
      const c = productionJobComposition((tx, shop) => ({
        ...f.adapters(tx, shop),
        erasureStorage: {
          objects: (prefix) => erasure.objects(prefix),
          remove: async (key) => {
            deletes++;
            await erasure.remove(key);
            if (fail) {
              fail = false;
              throw Error("SYNTHETIC lost deletion receipt");
            }
          },
        },
      }));
      const purge = (input) =>
        c.handlers.get("media.process")(f.parallel.db, input, async () => {});
      try {
        const retained = intents.find(
          (i) => i.phase === "retained" && i.asset_id === g.asset.id,
        );
        await assert.rejects(() => purge(retained.data));
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int n from pattern_output_purge_receipt",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(await purge(retained.data), "completed");
        assert(deletes >= 4);
        const count = deletes;
        assert.equal(await purge(retained.data), "completed");
        assert.equal(deletes, count);
        assert.equal((await fetch(capability.access.url)).status, 404);
        const stage = intents.find(
          (i) => i.phase === "staging" && i.asset_id === pending.asset.id,
        );
        await assert.rejects(() => purge(stage.data), /not yet eligible/);
        const late = await fetch(pending.upload.url, {
          method: "PUT",
          headers: pending.upload.headers,
          body: samplePdf(),
        });
        assert.equal(
          late.status,
          200,
          "An unexpired pre-erasure PUT still reaches staging only",
        );
        let eligible = false;
        const deadline = Date.now() + 360000;
        while (Date.now() < deadline) {
          const clock = (
            await f.admin.query(
              "select clock_timestamp() as clock,not_before,greatest(0,extract(epoch from(not_before-clock_timestamp()))*1000)::integer ms from pattern_output_purge where id=$1",
              [stage.id],
            )
          ).rows[0];
          console.info("Synthetic staging expiry: trusted PostgreSQL clock", {
            clock: clock.clock,
            notBefore: clock.not_before,
            remainingMs: clock.ms,
          });
          if (Number(clock.ms) === 0) {
            eligible = true;
            break;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(Number(clock.ms) + 250, 10000)),
          );
        }
        assert(
          eligible,
          "The actual PostgreSQL not-before boundary must be reached without changing the grant or clock",
        );
        assert.equal(await purge(stage.data), "completed");
        await assert.rejects(() =>
          f.actualStorage.snapshot(stage.manifest.keys[0], 1024 * 1024),
        );
        const expired = await fetch(pending.upload.url, {
          method: "PUT",
          headers: pending.upload.headers,
          body: samplePdf(),
        });
        assert(
          [400, 403].includes(expired.status),
          "Expired PUT must be rejected by the S3-compatible service",
        );
        assert.match(
          await expired.text(),
          /expir|date is too old/i,
          "The rejection must specifically identify expiry",
        );
        await assert.rejects(
          () => f.actualStorage.snapshot(stage.manifest.keys[0], 1024 * 1024),
          "Rejected expired PUT cannot recreate purged staging bytes",
        );
        await f.admin.query("update system_state set restore_epoch=uuidv7()");
        assert.equal(await purge(retained.data), "quarantined");
        assert.equal(
          await purge({ ...retained.data, shopId: f.b.shop }),
          "ignored",
        );
      } finally {
        erasure.destroy();
      }
    }),
);

test(
  "MP-B migration populated A versions, review, selection and strict draft bytes survive additive B and inert reapplication",
  { timeout: 240000 },
  () =>
    withPatterns(
      async (f) => {
        await publishPatternCapability(f);
        await publishPattern(f, await physicalPattern(f));
        const v = (await patternPage(f)).state.versions[0];
        await publishPattern(f, await referenceAction(f, v.id, "review"));
        await commit(f, v);
        const draft = await saveDesign(
          f,
          await physicalPattern(f),
          "pattern.reference",
        );
        const snapshot = () =>
          f.admin.query(
            "select * from (select 'version' kind,to_jsonb(v) value from pattern_version v union all select 'event',to_jsonb(e) from pattern_event e union all select 'value',to_jsonb(x) from pattern_value x union all select 'scope',to_jsonb(s) from pattern_scope s union all select 'draft',to_jsonb(d) from durable_draft d) retained order by kind,value::text",
          );
        const before = (await snapshot()).rows;
        await migrateDatabase(f.migrationConnectionString);
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual((await snapshot()).rows, before);
        assert.equal((await patternPage(f)).state.currentId, v.id);
        assert.equal(
          (await designRequest(f, `drafts/${draft.draftId}`)).status,
          200,
        );
      },
      { migrationThrough: "0049_manual_patterns.sql" },
    ),
);
