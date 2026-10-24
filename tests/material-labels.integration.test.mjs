import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import {
  designOk,
  designRequest,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import { withJobSlips } from "../scripts/test-support/job-slip-fixtures.mjs";

async function review(f, selections) {
  return designRequest(f, "material-labels/review", {
    method: "POST",
    body: { selections },
  }).then(designOk);
}
async function issue(f, selections, extra = {}) {
  const r = await review(f, selections),
    key = randomUUID(),
    input = {
      selections,
      docId: r.history[0]?.docId ?? randomUUID(),
      revision: (r.history[0]?.revision ?? 0) + 1,
      sourceDigest: r.sourceDigest,
      language: "ta",
      acknowledged: true,
      ...extra,
    };
  const result = await designRequest(f, "material-labels", {
    method: "POST",
    body: input,
    key,
    etag: `"v${r.version}"`,
  }).then(designOk);
  return { ...result.status, input, key, review: r };
}
test(
  "JS-B01/02/05 strict minimal native identity, atomic selection, immutable bytes and replay",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      await assertIsolationCatalog(f.runtime.db);
      const candidates = await designRequest(f, "material-labels/candidates", {
        method: "POST",
        body: {},
      }).then(designOk);
      const candidate = candidates.orders.find(
        (v) => v.orderId === f.scope.orderId,
      );
      assert(candidate);
      assert(candidate.pieces.some((p) => p.pieceId === f.scope.pieceId));
      assert.deepEqual(Object.keys(candidate).sort(), [
        "garment",
        "orderCode",
        "orderId",
        "pieces",
      ]);
      assert(!JSON.stringify(candidates).includes("PRIVATE-FITTING"));

      const selections = [{ ...f.scope, copies: 9 }],
        r = await review(f, selections);
      assert.equal(r.model.labels.length, 9);
      assert(r.model.labels.every((v) => v.pieceId === f.scope.pieceId));
      assert(!JSON.stringify(r.model).includes("PRIVATE-FITTING-SENTINEL"));
      assert.deepEqual(Object.keys(r.model).sort(), [
        "audience",
        "issued",
        "kind",
        "labels",
        "language",
      ]);
      const mixed = await designRequest(f, "material-labels/review", {
        method: "POST",
        body: {
          selections: [
            ...selections,
            { orderId: randomUUID(), pieceId: null, copies: 1 },
          ],
        },
      });
      assert.equal(mixed.status, 404);
      const d = await issue(f, selections);
      assert.equal(await f.processDocument(d), "accepted");
      const file = await designRequest(
        f,
        `documents/${d.docId}/${d.revision}/file`,
      );
      assert.equal(file.status, 200);
      const bytes = Buffer.from(await file.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      const replay = await designRequest(f, "material-labels", {
        method: "POST",
        body: d.input,
        key: d.key,
        etag: `"v${d.review.version}"`,
      }).then(designOk);
      assert.equal(replay.status.docId, d.docId);
      const changed = await designRequest(f, "material-labels", {
        method: "POST",
        body: { ...d.input, language: "en" },
        key: d.key,
        etag: `"v${d.review.version}"`,
      });
      assert.equal(changed.status, 422);
      const second = await issue(f, selections, { language: "en" });
      assert.equal(second.revision, 2);
      assert.equal(await f.processDocument(second), "accepted");
      const again = await designRequest(
        f,
        `documents/${d.docId}/${d.revision}/file`,
      );
      assert.deepEqual(Buffer.from(await again.arrayBuffer()), bytes);
      assert.equal((await review(f, selections)).history.length, 2);
      const status = await designRequest(
        f,
        `documents/${d.docId}/${d.revision}/status`,
      ).then(designOk);
      assert.equal(
        status.sha256,
        createHash("sha256").update(bytes).digest("hex"),
      );
      const order = await review(f, [
        { orderId: f.scope.orderId, pieceId: null, copies: 1 },
      ]);
      assert.equal(order.model.labels[0].quantity, null);
      assert.equal(order.model.labels[0].pieceId, null);
    }),
);

test(
  "JS-B05 enqueue rollback, concurrent replay, preconditions and cross-shop reads fail closed",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const { issueMaterialLabels } = await import(
        "@aarili/core/material-labels"
      );
      const selections = [{ ...f.scope, copies: 1 }],
        r = await review(f, selections),
        key = randomUUID(),
        input = {
          selections,
          docId: randomUUID(),
          revision: 1,
          sourceDigest: r.sourceDigest,
          language: "en",
          acknowledged: true,
        },
        etag = `"v${r.version}"`;
      const transaction = (run) =>
        f.owner
          .withOwnerMaterialLabels(
            new Headers({ Cookie: f.a.cookie }),
            f.a.shop,
            run,
          )
          .then((r) => r.data);
      await assert.rejects(
        () =>
          transaction((c) =>
            issueMaterialLabels(
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
        "material_label_revision",
        "material_label_member",
        "document_revision",
        "document_attempt",
      ])
        assert.equal(
          (
            await f.admin.query(
              `select count(*)::int n from ${table} where doc_id=$1`,
              [input.docId],
            )
          ).rows[0].n,
          0,
          table,
        );
      const results = await Promise.all(
        [1, 2].map(() =>
          designRequest(f, "material-labels", {
            method: "POST",
            body: input,
            key,
            etag,
          }).then(designOk),
        ),
      );
      assert.deepEqual(results[0], results[1]);
      assert.equal(
        (
          await designRequest(f, "material-labels", {
            method: "POST",
            body: { ...input, revision: 2 },
            key: randomUUID(),
          })
        ).status,
        428,
      );
      assert.equal(
        (
          await designRequest(f, "material-labels", {
            method: "POST",
            body: { ...input, revision: 2 },
            key: randomUUID(),
            etag,
          })
        ).status,
        412,
      );
      const foreign = { ...f, a: f.b };
      assert.equal(
        (
          await designRequest(foreign, "material-labels/review", {
            method: "POST",
            body: { selections },
          })
        ).status,
        404,
      );
      assert.equal(
        (await designRequest(foreign, `documents/${input.docId}/1/file`))
          .status,
        404,
      );
      const poisoned = await designRequest(f, "material-labels", {
        method: "POST",
        body: { ...input, measurements: ["POISON"] },
        key: randomUUID(),
        etag,
      });
      assert.equal(poisoned.status, 422);
    }),
);

test(
  "JS-B05 failed render/storage retries, frozen labels, erasure and exact-key purge cannot resurrect PDFs",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const { eraseMeasurementFit } = await import(
        "../scripts/test-support/measurement-fit-fixtures.mjs"
      );
      const d = await issue(f, [{ ...f.scope, copies: 1 }]);
      f.setRenderFailure("DOCUMENT_LAYOUT_OVERFLOW:label-1");
      await assert.rejects(
        () => f.processDocument(d),
        /DOCUMENT_LAYOUT_OVERFLOW/,
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
      assert.equal(failed.layoutFailure, "label-1");
      await designRequest(f, `documents/${d.docId}/1/retry`, {
        method: "POST",
        body: {},
        key: randomUUID(),
        etag: `"v${failed.version}"`,
      }).then(designOk);
      f.setRenderFailure(false);
      f.setDocumentStorageFailure(true);
      await assert.rejects(() => f.processDocument(d), /write failure/);
      f.setDocumentStorageFailure(false);
      assert.equal(await f.processDocument(d), "accepted");
      const key = (
        await f.admin.query(
          "select object_key from document_output where doc_id=$1",
          [d.docId],
        )
      ).rows[0].object_key;
      const second = await issue(f, [{ ...f.scope, copies: 1 }]);
      const { processDocument } = await import("@aarili/core/documents");
      const { documentProcessingHost } = await import("@aarili/jobs/documents");
      let entered, resume;
      const gate = new Promise((r) => {
          entered = r;
        }),
        release = new Promise((r) => {
          resume = r;
        });
      const host = documentProcessingHost(
        f.parallel.db,
        f.a.shop,
        f.a.user,
        f.owner.jobSlipDocuments,
      );
      const processing = processDocument(host, await f.job(second), {
        async render(d, assets) {
          entered();
          await release;
          return f.documentRenderer.render(d, assets);
        },
      });
      await gate;
      await eraseMeasurementFit(f);
      resume();
      await assert.rejects(() => processing);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from document_output where doc_id=$1 and revision=2",
            [d.docId],
          )
        ).rows[0].n,
        0,
      );
      assert.deepEqual(
        (
          await f.admin.query(
            "select model from document_revision where doc_id=$1 and revision=1",
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
            'select id as "purgeId",shop_id as "shopId",initiator_id as "initiatorId",restore_epoch as epoch from job_slip_purge where doc_id=$1 and revision=1',
            [d.docId],
          )
        ).rows[0],
        handler = f.documentComposition.handlers.get("media.process");
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
      await assert.rejects(() => f.processDocument(d));
    }),
);

test(
  "JS-B02/05 service, grouped selections and native pieces stay ordered without quantity-generated units",
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
          designRequest(f, path, { method: "POST", ...options }).then(designOk),
        services = await seedSmallServices({
          setup,
          runtime: f.runtime.pool,
          shopId: f.a.shop,
          seed: f.seed,
          configuration: f.sources.acceptance,
        }),
        intake = services.saree.intake,
        checked = await setup("small-services/orders/review", { body: intake });
      assert.deepEqual(checked.issues, []);
      const payload = {
          ...intake,
          commitmentReview: {
            fingerprint: checked.fingerprint,
            acknowledged: true,
            exceptionReason: checked.commitment.evaluation.warnings.length
              ? "SYNTHETIC capacity exception"
              : "",
            waiveRush: false,
            waiverReason: "",
          },
        },
        result = await promoteDesign(
          f,
          await saveDesign(f, payload, "order.service"),
        ).then(designOk),
        serviceId = result.draft.result.id;
      const selections = [
          { orderId: serviceId, pieceId: null, copies: 2 },
          { ...f.scope, copies: 1 },
          { orderId: f.scope.orderId, pieceId: null, copies: 1 },
        ],
        r = await review(f, selections);
      assert.deepEqual(
        r.model.labels.map((v) => v.orderId),
        [serviceId, serviceId, f.scope.orderId, f.scope.orderId],
      );
      assert.deepEqual(
        r.model.labels.map((v) => v.quantity),
        [null, null, 1, null],
      );
      assert.deepEqual(
        r.model.labels.map((v) => v.copy),
        [1, 2, 1, 1],
      );
      assert.equal(
        r.model.labels[0].garment.en,
        services.saree.profile.content.labelEn,
      );
      const d = await issue(f, selections);
      assert.equal(await f.processDocument(d), "accepted");
    }),
);

test(
  "JS-B05 restore quarantine and current service permission loss deny labels",
  { timeout: 240000 },
  () =>
    withJobSlips(async (f) => {
      const { syntheticWearerPolicy } = await import(
        "@aarili/core/wearer-policy"
      );
      const selections = [{ ...f.scope, copies: 1 }],
        d = await issue(f, selections);
      await f.admin.query("update system_state set restore_epoch=uuidv7()");
      assert.equal(await f.processDocument(d), "quarantined");
      assert.equal(
        (await designRequest(f, `documents/${d.docId}/1/file`)).status,
        404,
      );
      const fresh = await issue(f, selections);
      assert.equal(await f.processDocument(fresh), "accepted");
      const path = `customers/${f.identity.customerId}/wearers/${f.identity.wearerId}`,
        wearer = await designRequest(f, path).then(designOk);
      await designRequest(f, `${path}/consent-events`, {
        method: "POST",
        key: randomUUID(),
        etag: `"v${wearer.version}"`,
        body: {
          purpose: "service",
          decision: "withdrawal",
          noticeId: syntheticWearerPolicy.notice.id,
          noticeExplained: true,
          language: "en",
          giverPersonId: wearer.personId,
          source: "in-person",
          occurredAt: "2026-10-24T00:00:00.000Z",
        },
      }).then(designOk);
      assert.equal(
        (
          await designRequest(
            f,
            `documents/${fresh.docId}/${fresh.revision}/file`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await designRequest(f, "material-labels/review", {
            method: "POST",
            body: { selections },
          })
        ).status,
        404,
      );
    }),
);
