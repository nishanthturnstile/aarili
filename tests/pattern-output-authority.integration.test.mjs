import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { productionJobComposition } from "@aarili/jobs/production";
import { createMeasurementFitErasureStorage } from "@aarili/platform/media-storage";
import { test } from "vitest";
import {
  designOk,
  designRequest,
  promoteDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  patternPage,
  physicalPattern,
  publishPattern,
  publishPatternCapability,
  referenceAction,
} from "../scripts/test-support/manual-pattern-fixtures.mjs";
import {
  additionalFitWearer,
  eraseMeasurementFit,
  fitPhotoConsent,
} from "../scripts/test-support/measurement-fit-fixtures.mjs";
import { approveMeasurementForm } from "../scripts/test-support/measurement-session-fixtures.mjs";
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
const image = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
const reuse = (f, id) =>
  designRequest(f, "manual-patterns/reuse", {
    method: "POST",
    body: { ...f.scope, referenceId: id },
  });

test(
  "MP-B05/06/07 private reuse never crosses wearers; shop-owned reuse checks target photo and all source generations",
  { timeout: 240000 },
  () =>
    withPatternOutputs(async (f) => {
      const subject = await publishPatternSubject(f),
        grant = await admitPatternOutput(f, subject, await image());
      await f.process(grant, await f.complete(grant));
      await publishOutput(f, await outputDraft(f, grant.asset.id));
      const original = await latestOutput(f);
      const approval = await approveMeasurementForm(f, f.sources.forms[0]);
      const other = await additionalFitWearer({ ...f, approval }, "adult"),
        target = await targetPattern(f, other.identity);
      assert.equal((await reuse(target, original.id)).status, 404);
      await fitPhotoConsent(other, "grant");
      assert.equal(
        (await reuse(target, original.id)).status,
        404,
        "Shared payer and photo consent never promote private rights",
      );
      const owned = await outputDraft(f, grant.asset.id);
      owned.content.rights = "shop-owned";
      owned.content.rightsEvidence =
        "SYNTHETIC shop-created non-body sketch, reusable rights recorded";
      await publishOutput(f, owned);
      const source = await latestOutput(f);
      const comparison = await reuse(target, source.id).then(designOk);
      const d = await publishOutput(
        target,
        await outputDraft(target, null, {
          reuse: { referenceId: source.id, digest: comparison.digest },
          acknowledged: true,
          evidence:
            "SYNTHETIC rights, target authority and unknown inputs reviewed",
        }),
      );
      const ref = await latestOutput(target);
      assert.equal((await outputRead(target, ref.id)).status, 200);
      const privateReview = await saveOutput(target, {
        ...(await referenceAction(target, ref.id, "review")),
        assetId: null,
        reuse: null,
      });
      await fitPhotoConsent(other, "withdrawal");
      assert.equal((await outputRead(target, ref.id)).status, 404);
      assert.equal(
        (await designRequest(target, `drafts/${privateReview.draftId}`)).status,
        404,
      );
      assert.equal((await promoteDesign(target, d, d.key)).status, 404);
      await fitPhotoConsent(other, "grant");
      await eraseMeasurementFit(f);
      assert.equal((await outputRead(target, ref.id)).status, 404);
      assert.equal(
        (await designRequest(target, `drafts/${d.draftId}`)).status,
        404,
      );
      const targetValues = (
        await f.admin.query(
          "select x.payload,x.redacted_at from pattern_value x join pattern_event e on(e.shop_id,e.id)=(x.shop_id,x.event_id) where e.order_id=$1",
          [target.scope.orderId],
        )
      ).rows;
      assert(
        targetValues.length > 0 &&
          targetValues.every((r) => r.payload === null && r.redacted_at),
      );
      const copies = (
        await f.admin.query(
          "select payload,redacted_at from pattern_draft_value where draft_id=$1",
          [d.draftId],
        )
      ).rows;
      assert(
        copies.every(
          (r) => r.payload.erased && r.payload.reuse === null && r.redacted_at,
        ),
      );
    }),
);

test(
  "MP-B06/09 late protected output and erasure serialize and orphan claim prefixes are purged",
  { timeout: 240000 },
  () =>
    withPatternOutputs(async (f) => {
      const subject = await publishPatternSubject(f),
        grant = await admitPatternOutput(f, subject, await image()),
        attempt = await f.complete(grant);
      const seal = f.storage.seal;
      let entered,
        release,
        first = true;
      const ready = new Promise((resolve) => {
          entered = resolve;
        }),
        gate = new Promise((resolve) => {
          release = resolve;
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
            assert.fail("Missing protected pattern output barrier"),
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
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert(blocked, "Erasure must serialize behind accepted output writes");
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
      const intent = (
        await f.admin.query(
          "select p.*,j.data from pattern_output_purge p join pgboss.job j on j.id=p.id where phase='retained'",
        )
      ).rows[0];
      assert.equal(intent.manifest.prefixes.length, 1);
      const storage = createMeasurementFitErasureStorage(f.config);
      let removed = 0;
      try {
        const c = productionJobComposition((tx, shop) => ({
          ...f.adapters(tx, shop),
          erasureStorage: {
            objects: (p) => storage.objects(p),
            remove: async (key) => {
              await storage.remove(key);
              removed++;
            },
          },
        }));
        assert.equal(
          await c.handlers.get("media.process")(
            f.parallel.db,
            intent.data,
            async () => {},
          ),
          "completed",
        );
        assert.equal(removed, 1);
      } finally {
        storage.destroy();
      }
    }),
);

test(
  "MP-B07/08/10 real repeat acceptance carries context only and private pattern history has exact links",
  { timeout: 240000 },
  () =>
    withPatternOutputs(async (f) => {
      const v = await physicalPattern(f);
      v.content.rights = "private-fulfilment";
      await publishPattern(f, v);
      const source = await latestOutput(f);
      await publishPattern(f, await referenceAction(f, source.id, "select"));
      const context = await designRequest(
        f,
        `orders/${f.scope.orderId}/repeat/source`,
        { method: "POST" },
      ).then(designOk);
      const id = randomUUID().replace(/^(........-....-)./, "$17");
      const saved = await designRequest(
        f,
        `orders/${f.scope.orderId}/repeat/create`,
        {
          method: "POST",
          etag: `"v${context.order.version}"`,
          body: {
            draftId: id,
            snapshotDigest: context.order.snapshotDigest,
            scopeDigest: context.scopeDigest,
            reuseInstructions: false,
          },
        },
      ).then(designOk);
      assert(!("pattern" in saved.draft.payload));
      assert(!("patternContext" in saved.draft.payload));
      const payload = {
        ...saved.draft.payload,
        priceState: "quoted",
        priceText: "0",
        deliveryDate: context.order.intake.deliveryDate,
      };
      const review = await designRequest(f, "orders/repeat/review", {
        method: "POST",
        body: payload,
      }).then(designOk);
      payload.commitmentReview = {
        fingerprint: review.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC fresh repeat commitment",
        waiveRush: false,
        waiverReason: "",
      };
      const ready = await designRequest(f, `drafts/${id}`, {
        method: "PUT",
        etag: `"v${saved.draft.version}"`,
        body: {
          workflow: "order.repeat",
          schemaVersion: saved.draft.schemaVersion,
          payload,
        },
      }).then(designOk);
      const accepted = await promoteDesign(f, {
          draftId: id,
          draft: ready.draft,
        }).then(designOk),
        orderId = accepted.draft.result.id;
      const pieces = await designRequest(f, `orders/${orderId}/pieces/read`, {
          method: "POST",
          body: {},
        }).then(designOk),
        pieceId = pieces.identities.find(
          (p) => p.key === f.sources.top.definition.content.code,
        ).id;
      const target = { ...f, scope: { orderId, pieceId } };
      await publishPatternCapability(target);
      assert.equal((await patternPage(target)).state.currentId, null);
      assert.equal((await patternPage(target)).state.versions.length, 0);
      const comparison = await reuse(target, source.id).then(designOk);
      await publishOutput(
        target,
        await outputDraft(target, null, {
          content: {
            ...v.content,
            design: {
              state: "unknown",
              reason: "SYNTHETIC new design unknown",
            },
            measurement: {
              state: "unknown",
              reason: "SYNTHETIC new measurements unknown",
            },
          },
          reuse: { referenceId: source.id, digest: comparison.digest },
          acknowledged: true,
          evidence: "SYNTHETIC fresh reference-only reuse",
        }),
      );
      const targetRef = await latestOutput(target);
      assert.equal((await patternPage(target)).state.currentId, null);
      assert.equal(targetRef.source.referenceId, source.id);
      assert.equal(targetRef.output, null);
      const history = await designRequest(f, "customer-history", {
        method: "POST",
        body: {
          customerId: f.identity.customerId,
          wearerId: f.identity.wearerId,
          limit: 25,
        },
      }).then(designOk);
      const events = history.events.filter((e) =>
        e.action.startsWith("pattern."),
      );
      assert(events.length >= 3);
      assert.equal(new Set(events.map((e) => e.id)).size, events.length);
      assert(events.every((e) => e.source.kind === "order"));
      assert(!JSON.stringify(events).includes("Cabinet B"));
      await publishPatternCapability(f, { manual: "unavailable" });
      assert.equal((await reuse(target, source.id)).status, 409);
      assert.equal((await patternPage(f)).selected.id, source.id);
    }),
);
