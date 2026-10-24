import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { issueJobSlip } from "@aarili/core/job-slips";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import {
  designOk,
  designRequest,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import { withJobSlips } from "../scripts/test-support/job-slip-fixtures.mjs";
import {
  physicalPattern,
  publishPattern,
  referenceAction,
} from "../scripts/test-support/manual-pattern-fixtures.mjs";
import { eraseMeasurementFit } from "../scripts/test-support/measurement-fit-fixtures.mjs";

test(
  "JS-A01/02/04/06/08/09 exact piece issue commits immutable private PDF, replay and stored-byte identity",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const review = await f.review();
      assert(
        review.model.sources.some((s) => s.id === f.measurementVersion.id),
      );
      assert(!JSON.stringify(review).includes("PRIVATE-FITTING-SENTINEL-169"));
      const d = await f.issue();
      assert.equal(d.state, "pending");
      assert.equal(await f.processDocument(d), "accepted");
      const file = await designRequest(
        f,
        `documents/${d.docId}/${d.revision}/file`,
      );
      assert.equal(file.status, 200);
      const bytes = Buffer.from(await file.arrayBuffer()),
        hash = createHash("sha256").update(bytes).digest("hex");
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.equal(
        (
          await designRequest(
            f,
            `documents/${d.docId}/${d.revision}/status`,
          ).then(designOk)
        ).sha256,
        hash,
      );
      const repeated = await designRequest(f, "job-slips", {
        method: "POST",
        body: d.input,
        key: d.key,
        etag: `"v${d.review.version}"`,
      }).then(designOk);
      assert.equal(repeated.status.docId, d.docId);
      const changed = await designRequest(f, "job-slips", {
        method: "POST",
        body: { ...d.input, reason: "changed" },
        key: d.key,
        etag: `"v${d.review.version}"`,
      });
      assert.equal(changed.status, 422);
      assert.equal(await f.processDocument(d), "accepted");
      const again = await designRequest(
        f,
        `documents/${d.docId}/${d.revision}/file`,
      );
      assert.deepEqual(Buffer.from(await again.arrayBuffer()), bytes);
      const history = (await f.review()).history;
      assert.equal(history.length, 1);
      assert.equal(history[0].revision, 1);
      assert.equal(history[0].sourceDigest, d.review.sourceDigest);
    }),
);

test(
  "JS-A04/07/10 stale/missing preconditions, other-shop IDs and forced RLS fail closed",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const d = await f.issue();
      await assertIsolationCatalog(f.runtime.db);
      const missing = await designRequest(f, "job-slips", {
        method: "POST",
        body: { ...d.input, docId: randomUUID(), revision: 2 },
        key: randomUUID(),
      });
      assert.equal(missing.status, 428);
      const stale = await designRequest(f, "job-slips", {
        method: "POST",
        body: { ...d.input, revision: 2 },
        key: randomUUID(),
        etag: `"v${d.review.version}"`,
      });
      assert.equal(stale.status, 412);
      const foreign = { ...f, a: f.b };
      const r = await designRequest(foreign, "job-slips/review", {
        method: "POST",
        body: { ...f.scope, omittedAssetIds: [] },
      });
      assert.equal(r.status, 404);
      const file = await designRequest(foreign, `documents/${d.docId}/1/file`);
      assert.equal(file.status, 404);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from job_slip_revision",
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "JS-A05/07 erased frozen values are revoked and privately purged; retries cannot resurrect artifacts",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const d = await f.issue();
      assert.equal(await f.processDocument(d), "accepted");
      const key = (
        await f.admin.query(
          "select object_key from document_output where doc_id=$1",
          [d.docId],
        )
      ).rows[0].object_key;
      await eraseMeasurementFit(f);
      assert.deepEqual(
        (
          await f.admin.query(
            "select model from document_revision where doc_id=$1",
            [d.docId],
          )
        ).rows[0].model,
        {},
      );
      assert.equal(
        (await designRequest(f, `documents/${d.docId}/1/file`)).status,
        404,
      );
      const purge = (
        await f.admin.query(
          'select id as "purgeId",shop_id as "shopId",initiator_id as "initiatorId",restore_epoch as epoch from job_slip_purge where doc_id=$1',
          [d.docId],
        )
      ).rows[0];
      const handler = f.documentComposition.handlers.get("media.process");
      assert.equal(
        await handler(
          f.parallel.db,
          { kind: "job-slip-purge", ...purge },
          async () => {},
        ),
        "accepted",
      );
      assert.equal(await f.documentMaintenance.has(key), false);
      assert.equal(
        await handler(
          f.parallel.db,
          { kind: "job-slip-purge", ...purge },
          async () => {},
        ),
        "accepted",
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from job_slip_purge_receipt where purge_id=$1",
            [purge.purgeId],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(() => f.processDocument(d));
    }),
);

test(
  "JS-A02/04/06 source correction preserves old bytes; concurrent issue and enqueue rollback stay atomic",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const r = await f.review(),
        input = {
          ...f.scope,
          omittedAssetIds: [],
          docId: randomUUID(),
          revision: 1,
          sourceDigest: r.sourceDigest,
          language: "en",
          acknowledged: true,
          reason: "SYNTHETIC atomic source issue",
        },
        key = randomUUID(),
        etag = `"v${r.version}"`;
      await assert.rejects(
        () =>
          f.transaction((c) =>
            issueJobSlip(
              {
                ...c,
                documents: {
                  ...c.documents,
                  jobs: {
                    ...c.documents.jobs,
                    async enqueue(a) {
                      await c.documents.jobs.enqueue(a);
                      throw Error("SYNTHETIC enqueue rollback");
                    },
                  },
                },
              },
              input,
              key,
              etag,
            ),
          ),
        /enqueue rollback/,
      );
      for (const table of [
        "job_slip_revision",
        "document_revision",
        "document_attempt",
      ])
        assert.equal(
          (
            await f.admin.query(
              `select count(*)::int as n from ${table} where doc_id=$1`,
              [input.docId],
            )
          ).rows[0].n,
          0,
        );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from pgboss.job where name='pdf.render' and data->>'docId'=$1",
            [input.docId],
          )
        ).rows[0].n,
        0,
      );
      const results = await Promise.all(
        [0, 1].map(() =>
          designRequest(f, "job-slips", {
            method: "POST",
            body: input,
            key,
            etag,
          }).then(designOk),
        ),
      );
      assert.deepEqual(results[0], results[1]);
      const d = results[0].status;
      await f.processDocument(d);
      const before = Buffer.from(
        await (
          await designRequest(f, `documents/${d.docId}/1/file`)
        ).arrayBuffer(),
      );
      const old = (await f.review()).model.sources.find(
        (s) => s.kind === "pattern",
      ).id;
      const next = await physicalPattern(f, {
        content: {
          ...(await physicalPattern(f)).content,
          locator: "SYNTHETIC corrected cabinet",
        },
      });
      await publishPattern(f, next);
      const page = await designRequest(f, "manual-patterns/list", {
        method: "POST",
        body: { ...f.scope, readerVersion: 2 },
      }).then(designOk);
      await publishPattern(
        f,
        await referenceAction(f, page.state.latestSavedId, "select"),
      );
      const current = await f.review();
      assert.notEqual(
        current.model.sources.find((s) => s.kind === "pattern").id,
        old,
      );
      assert.deepEqual(
        Buffer.from(
          await (
            await designRequest(f, `documents/${d.docId}/1/file`)
          ).arrayBuffer(),
        ),
        before,
      );
      const stale = await designRequest(f, "job-slips", {
        method: "POST",
        body: { ...input, revision: 2 },
        key: randomUUID(),
        etag,
      });
      assert.equal(stale.status, 412);
      const revised = await f.issue({ language: "en" });
      assert.equal(revised.revision, 2);
      assert.equal((await f.review()).history.length, 2);
    }),
);

test(
  "JS-A05/07/10 failed render and storage write retry the frozen revision; erase during rendering prevents upload",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const d = await f.issue();
      f.setRenderFailure(true);
      await assert.rejects(() => f.processDocument(d), /render failure/);
      assert.equal(
        (
          await f.admin.query(
            "select state from document_attempt where doc_id=$1",
            [d.docId],
          )
        ).rows[0].state,
        "failed",
      );
      await f.admin.query(
        "delete from pgboss.job where name='pdf.render' and data->>'docId'=$1",
        [d.docId],
      );
      const failed = await designRequest(
        f,
        `documents/${d.docId}/1/status`,
      ).then(designOk);
      assert.equal(failed.canRetry, true);
      await designRequest(f, `documents/${d.docId}/1/retry`, {
        method: "POST",
        body: {},
        key: randomUUID(),
        etag: `"v${failed.version}"`,
      }).then(designOk);
      f.setRenderFailure(false);
      f.setDocumentStorageFailure(true);
      await assert.rejects(() => f.processDocument(d), /write failure/);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from document_artifact where doc_id=$1",
            [d.docId],
          )
        ).rows[0].n,
        0,
      );
      f.setDocumentStorageFailure(false);
      await f.processDocument(d);
      const second = await f.issue();
      const original = f.documentComposition;
      let entered, resume;
      const gate = new Promise((r) => {
          entered = r;
        }),
        release = new Promise((r) => {
          resume = r;
        });
      const { processDocument } = await import("@aarili/core/documents");
      const { documentProcessingHost } = await import("@aarili/jobs/documents");
      const host = documentProcessingHost(
        f.parallel.db,
        f.a.shop,
        f.a.user,
        f.owner.jobSlipDocuments,
      );
      const processing = processDocument(host, await f.job(second), {
        async render(doc, assets) {
          entered();
          await release;
          return f.documentRenderer.render(doc, assets);
        },
      });
      await gate;
      await eraseMeasurementFit(f);
      resume();
      await assert.rejects(() => processing);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from document_output where doc_id=$1 and revision=2",
            [d.docId],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await designRequest(f, `documents/${d.docId}/2/file`)).status,
        404,
      );
      assert(original);
    }),
);

test(
  "JS-A03/07 exact image/annotation manifest, optional omission, digest failure and design erasure are enforced",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const { createRequire } = await import("node:module");
      const sharp = createRequire(
        new URL("../packages/platform/package.json", import.meta.url),
      )("sharp");
      const {
        publishSource,
        sourceDraft,
        admitReference,
        processReference,
        referenceItem,
        saveReferenceSpecification,
      } = await import("../scripts/test-support/design-reference-fixtures.mjs");
      const { specificationDraft } = await import(
        "../scripts/test-support/design-specification-fixtures.mjs"
      );
      const { promoteDesign } = await import(
        "../scripts/test-support/design-choices-fixtures.mjs"
      );
      const scope = {
        ...f,
        s: f.sources,
        target: f.accepted,
        pieceId: f.scope.pieceId,
      };
      const { subject } = await publishSource(
        scope,
        sourceDraft(scope, "library"),
      );
      const bytes = await sharp({
        create: { width: 240, height: 160, channels: 3, background: "white" },
      })
        .jpeg()
        .toBuffer();
      const grant = await admitReference(scope, subject, bytes);
      await processReference(scope, grant);
      const state = await designRequest(f, "design-specifications/list", {
        method: "POST",
        body: f.scope,
      }).then(designOk);
      const critical = referenceItem(grant.asset.id, null, {
        intent: "instruction",
        geometryReviewed: true,
        annotations: [
          {
            note: "SYNTHETIC exact neckline",
            anchor: { kind: "point", x: 1000, y: 2000 },
          },
        ],
      });
      const candidate = {
        ...specificationDraft(
          f.scope.orderId,
          f.scope.pieceId,
          f.sources.profile,
        ),
        baseVersion: state.version,
        baseSavedId: state.latestSavedId,
        referenceItems: [critical],
      };
      await promoteDesign(
        f,
        await saveReferenceSpecification(f, candidate),
      ).then(designOk);
      const r = await f.review();
      assert.deepEqual(r.blockers, []);
      assert.equal(r.model.assets[0].assetId, grant.asset.id);
      assert.deepEqual(r.model.assets[0].annotations, critical.annotations);
      assert(
        (await f.review([grant.asset.id])).blockers.includes(
          "critical-asset-unavailable",
        ),
      );
      const realRead = f.storage.snapshotPrivate;
      f.storage.snapshotPrivate = async () => {
        throw Error("SYNTHETIC missing private object");
      };
      try {
        assert(
          (await f.review()).blockers.includes("critical-asset-unavailable"),
        );
      } finally {
        f.storage.snapshotPrivate = realRead;
      }
      const d = await f.issue();
      await f.processDocument(d);
      // Frozen display digest is checked again, not silently replaced by fresh bytes.
      await f.transaction(async (ctx) => {
        const bad = {
          ...r.model,
          assets: [{ ...r.model.assets[0], displaySha256: "0".repeat(64) }],
        };
        await assert.rejects(() => ctx.sources.assets(bad));
      });
      const next = await designRequest(f, "design-specifications/list", {
        method: "POST",
        body: f.scope,
      }).then(designOk);
      await promoteDesign(
        f,
        await saveReferenceSpecification(f, {
          ...candidate,
          baseVersion: next.version,
          baseSavedId: next.latestSavedId,
          referenceItems: [
            {
              ...critical,
              id: randomUUID(),
              intent: "inspiration",
              annotations: [],
              geometryReviewed: false,
            },
          ],
        }),
      ).then(designOk);
      const omitted = await f.review([grant.asset.id]);
      assert.deepEqual(omitted.blockers, []);
      assert.equal(omitted.model.assets.length, 0);
      assert(omitted.model.warnings.some((w) => w.en.includes("omitted")));
      const { silenceWav } = await import(
        "../scripts/test-support/media-formats.mjs"
      );
      const audio = await admitReference(
        scope,
        subject,
        silenceWav(),
        "audio/wav",
      );
      await processReference(scope, audio);
      const audioState = await designRequest(f, "design-specifications/list", {
        method: "POST",
        body: f.scope,
      }).then(designOk);
      await promoteDesign(
        f,
        await saveReferenceSpecification(f, {
          ...candidate,
          baseVersion: audioState.version,
          baseSavedId: audioState.latestSavedId,
          referenceItems: [
            referenceItem(audio.asset.id, null, { annotations: [] }),
          ],
        }),
      ).then(designOk);
      assert(
        (await f.review()).blockers.includes("critical-asset-unavailable"),
      );
      assert.deepEqual(
        (await f.review([audio.asset.id])).blockers,
        [],
        "optional unsupported media may be explicitly omitted without embedding it",
      );
      const c = await f.admin.connect();
      try {
        await c.query("begin");
        await c.query("set local role app_privacy");
        await c.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await c.query("select redact_design_reference_subject($1,$2,$3)", [
          f.a.shop,
          subject.id,
          randomUUID(),
        ]);
        await c.query("commit");
      } catch (e) {
        await c.query("rollback");
        throw e;
      } finally {
        c.release();
      }
      assert.deepEqual(
        (
          await f.admin.query(
            "select model from document_revision where doc_id=$1",
            [d.docId],
          )
        ).rows[0].model,
        {},
      );
      assert.equal(
        (await designRequest(f, `documents/${d.docId}/1/file`)).status,
        404,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from job_slip_purge where doc_id=$1",
            [d.docId],
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "JS-A01 standalone service slip preserves separate requested lines without private measurement or pattern sections",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const { seedSmallServices } = await import(
        "../scripts/test-support/small-services.mjs"
      );
      const { saveDesign, promoteDesign } = await import(
        "../scripts/test-support/design-choices-fixtures.mjs"
      );
      const setup = (path, options = {}) =>
        designRequest(f, path, { method: "POST", ...options }).then(designOk);
      const services = await seedSmallServices({
        setup,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
        seed: f.seed,
        configuration: f.sources.acceptance,
      });
      const intake = services.saree.intake;
      const review = await setup("small-services/orders/review", {
        body: intake,
      });
      assert.deepEqual(review.issues, []);
      const payload = {
        ...intake,
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
      const result = await promoteDesign(
        f,
        await saveDesign(f, payload, "order.service"),
      ).then(designOk);
      const scope = { orderId: result.draft.result.id, pieceId: null };
      const r = await setup("job-slips/review", {
        body: { ...scope, omittedAssetIds: [] },
      });
      assert.deepEqual(r.blockers, []);
      assert.deepEqual(r.model.measurements, []);
      assert.deepEqual(r.model.sources, []);
      assert.equal(
        r.model.instructions.filter((s) => s.includes("[pending]")).length,
        2,
      );
      assert(r.model.instructions.every((s) => s.includes("SYNTHETIC")));
      const d = await setup("job-slips", {
        body: {
          ...scope,
          omittedAssetIds: [],
          docId: randomUUID(),
          revision: 1,
          sourceDigest: r.sourceDigest,
          language: "en",
          acknowledged: true,
          reason: "SYNTHETIC service slip",
        },
        key: randomUUID(),
        etag: `"v${r.version}"`,
      });
      await f.processDocument(d.status);
      assert.equal(
        (await designRequest(f, `documents/${d.status.docId}/1/file`)).status,
        200,
      );
      await assert.rejects(() =>
        f.runtime.pool.query("select redact_job_slip($1,$2,1,$3)", [
          f.a.shop,
          d.status.docId,
          randomUUID(),
        ]),
      );
      const c = await f.admin.connect();
      try {
        await c.query("begin");
        await c.query("set local role app_privacy");
        await c.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await c.query("select redact_job_slip($1,$2,1,$3)", [
          f.a.shop,
          d.status.docId,
          randomUUID(),
        ]);
        await c.query("commit");
      } catch (error) {
        await c.query("rollback");
        throw error;
      } finally {
        c.release();
      }
      assert.equal(
        (await designRequest(f, `documents/${d.status.docId}/1/file`)).status,
        404,
      );
      assert.deepEqual(
        (
          await f.admin.query(
            "select model from document_revision where doc_id=$1",
            [d.status.docId],
          )
        ).rows[0].model,
        {},
      );
      assert.equal(
        (
          await f.admin.query(
            "select wearer_id from job_slip_purge where doc_id=$1",
            [d.status.docId],
          )
        ).rows[0].wearer_id,
        null,
      );
    }),
);

test(
  "JS-A01/07 guessed piece identity, stale restore epoch and session loss cannot publish or expose slips",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const wrong = await designRequest(f, "job-slips/review", {
        method: "POST",
        body: {
          orderId: f.scope.orderId,
          pieceId: randomUUID(),
          omittedAssetIds: [],
        },
      });
      assert.equal(wrong.status, 404);
      const d = await f.issue();
      await f.admin.query("update system_state set restore_epoch=uuidv7()");
      assert.equal(await f.processDocument(d), "quarantined");
      assert.equal(
        (await designRequest(f, `documents/${d.docId}/1/file`)).status,
        404,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from document_output where doc_id=$1",
            [d.docId],
          )
        ).rows[0].n,
        0,
      );
      await f.admin.query("delete from auth_session where user_id=$1", [
        f.a.user,
      ]);
      for (const suffix of ["status", "file", "access", "history"])
        assert.equal(
          (await designRequest(f, `documents/${d.docId}/1/${suffix}`)).status,
          401,
        );
      assert.equal(
        (
          await designRequest(f, "job-slips/review", {
            method: "POST",
            body: { ...f.scope, omittedAssetIds: [] },
          })
        ).status,
        401,
      );
    }),
);

test(
  "JS-A05 shared production composition runs the real queued slip in worker mode",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const { startJobRuntime } = await import("@aarili/jobs/runtime");
      const d = await f.issue();
      const runtime = await startJobRuntime(
        f.runtime.pool.options.connectionString,
        { mode: "worker", pollMilliseconds: 50 },
        f.documentComposition,
      );
      try {
        const deadline = Date.now() + 45000;
        let state;
        while (Date.now() < deadline) {
          state = await designRequest(f, `documents/${d.docId}/1/status`).then(
            designOk,
          );
          if (state.state === "ready") break;
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.equal(state.state, "ready");
        assert.equal(
          (await designRequest(f, `documents/${d.docId}/1/file`)).status,
          200,
        );
      } finally {
        await runtime.stop();
      }
    }),
);
