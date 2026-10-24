import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { createDocumentRenderer } from "@aarili/documents";
import { jobSlipTemplates } from "@aarili/documents/job-slip";
import { materialLabelTemplates } from "@aarili/documents/material-labels";
import { quotationTemplates } from "@aarili/documents/quotation";
import { startSyntheticQueue } from "@aarili/jobs";
import { documentJobWriter } from "@aarili/jobs/documents";
import { productionJobComposition } from "@aarili/jobs/production";
import {
  createDocumentOrphanStorage,
  createDocumentStorage,
} from "@aarili/platform/document-storage";
import { designOk, designRequest } from "./design-choices-fixtures.mjs";
import {
  publishSpecification,
  specificationDraft,
} from "./design-specification-fixtures.mjs";
import {
  physicalPattern,
  publishPattern,
  referenceAction,
} from "./manual-pattern-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSelectionDraft,
  publishMeasurement,
} from "./measurement-session-fixtures.mjs";
import { withPatternOutputs } from "./pattern-output-fixtures.mjs";

export async function withJobSlips(run) {
  const quotes = await quotationTemplates(),
    slips = await jobSlipTemplates(),
    labels = await materialLabelTemplates(),
    templates = {
      resolve: async (id, revision) =>
        (await quotes.resolve(id, revision)) ??
        (await labels.resolve(id, revision)) ??
        slips.resolve(id, revision),
    },
    native = createDocumentRenderer(templates);
  let storage, maintenance, boss;
  let failRender = false,
    failPut = false;
  const adapters = (tx, shopId) => ({
    templates,
    policy: { authorize: async () => false },
    storage: {
      read: (...a) => storage.read(...a),
      signGet: (...a) => storage.signGet(...a),
      put: async (...a) => {
        if (failPut) throw Error("Synthetic document write failure");
        return storage.put(...a);
      },
    },
    jobs: {
      enqueue: (a) => documentJobWriter(boss, tx, shopId).enqueue(a),
      phase: (a) => documentJobWriter(boss, tx, shopId).phase(a),
    },
  });
  try {
    await withPatternOutputs(
      async (f) => {
        storage = createDocumentStorage(f.config);
        maintenance = createDocumentOrphanStorage(f.config);
        boss = await startSyntheticQueue(f.runtime.db, "pdf.render");
        const api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        const renderer = {
          render: (d, assets) => {
            if (failRender)
              throw Error(
                typeof failRender === "string"
                  ? failRender
                  : "Synthetic document render failure",
              );
            return native.render(d, assets);
          },
        };
        const composition = productionJobComposition(f.adapters, {
          adapters: (tx, shopId, actorId) =>
            f.owner.jobSlipDocuments(tx, shopId, actorId),
          renderer,
          erasureStorage: maintenance,
        });
        const feature = {
          ...f,
          api,
          templates,
          documentStorage: storage,
          documentMaintenance: maintenance,
          documentRenderer: native,
          documentComposition: composition,
          async transaction(run) {
            return f.owner
              .withOwnerJobSlips(
                new Headers({ Cookie: f.a.cookie }),
                f.a.shop,
                run,
              )
              .then((r) => r.data);
          },
          async review(omittedAssetIds = []) {
            return designRequest(feature, "job-slips/review", {
              method: "POST",
              body: { ...f.scope, omittedAssetIds },
            }).then(designOk);
          },
          async issue(extra = {}, key = randomUUID()) {
            const review = await feature.review();
            assert.deepEqual(review.blockers, [], "synthetic source readiness");
            const input = {
              ...f.scope,
              omittedAssetIds: [],
              docId: review.history[0]?.docId ?? randomUUID(),
              revision: (review.history[0]?.revision ?? 0) + 1,
              sourceDigest: review.sourceDigest,
              language: "ta",
              acknowledged: true,
              reason: "SYNTHETIC exact source issue",
              ...extra,
            };
            const r = await designRequest(feature, "job-slips", {
              method: "POST",
              body: input,
              key,
              etag: `"v${review.version}"`,
            });
            const result = await designOk(r);
            return { ...result.status, input, key, review };
          },
          async job(d) {
            return feature.transaction(async (ctx) => {
              const a = await ctx.documents.repository.attempt(
                d.docId,
                d.revision,
              );
              return {
                shopId: f.a.shop,
                docId: d.docId,
                revision: d.revision,
                jobId: a.jobId,
                initiatorId: a.initiatorId,
                epoch: a.epoch,
              };
            });
          },
          async processDocument(d, before = async () => {}) {
            return composition.handlers.get("pdf.render")(
              f.parallel.db,
              await feature.job(d),
              before,
            );
          },
          setRenderFailure: (v) => {
            failRender = v;
          },
          setDocumentStorageFailure: (v) => {
            failPut = v;
          },
        };
        const spec = specificationDraft(
          f.scope.orderId,
          f.scope.pieceId,
          f.sources.profile,
        );
        // Sentinels in non-projected fields prove minimisation, not CSS hiding.
        await publishSpecification(feature, spec);
        const approval = await approveMeasurementForm(
          feature,
          f.sources.forms[0],
        );
        const measurement = measurementDraft(
          f.identity,
          f.sources.forms[0],
          approval,
        );
        measurement.fitNotes = "PRIVATE-FITTING-SENTINEL-169";
        const saved = await publishMeasurement(feature, measurement);
        const version = await designRequest(
          feature,
          `measurements/versions/${saved.result.draft.result.id}`,
        ).then(designOk);
        await publishMeasurement(
          feature,
          measurementSelectionDraft(version, f.scope),
        );
        await publishPattern(feature, await physicalPattern(feature));
        const page = await designRequest(feature, "manual-patterns/list", {
          method: "POST",
          body: { ...f.scope, readerVersion: 2 },
        }).then(designOk);
        await publishPattern(
          feature,
          await referenceAction(feature, page.state.versions[0].id, "select"),
        );
        feature.measurementVersion = version;
        await run(feature);
      },
      { documentAdapters: adapters },
    );
  } finally {
    if (boss) await boss.stop();
    await native.close();
    storage?.destroy();
    maintenance?.destroy();
  }
}
