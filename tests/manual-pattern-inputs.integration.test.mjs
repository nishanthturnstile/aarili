import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "vitest";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  publishSpecification,
  specificationDraft,
} from "../scripts/test-support/design-specification-fixtures.mjs";
import {
  patternPage,
  physicalPattern,
  publishPattern,
  publishPatternCapability,
  referenceAction,
  withPatterns,
} from "../scripts/test-support/manual-pattern-fixtures.mjs";
import { fitPhotoConsent } from "../scripts/test-support/measurement-fit-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSelectionDraft,
  publishMeasurement,
} from "../scripts/test-support/measurement-session-fixtures.mjs";

test(
  "MP-A04/06/08 exact input provenance, fresh review and stale-selection conflict without rebinding",
  { timeout: 240000 },
  () =>
    withPatterns(async (f) => {
      await publishPatternCapability(f);
      const ds = specificationDraft(
        f.scope.orderId,
        f.scope.pieceId,
        f.sources.profile,
      );
      await publishSpecification(f, ds);
      const form = f.sources.forms[0],
        approval = await approveMeasurementForm(f, form),
        saved = await publishMeasurement(
          f,
          measurementDraft(f.identity, form, approval),
        );
      const mv = await designRequest(
        f,
        `measurements/versions/${saved.result.draft.result.id}`,
      ).then(designOk);
      await publishMeasurement(f, measurementSelectionDraft(mv, f.scope));
      let p = await patternPage(f);
      const designId = p.designId;
      const draft = await physicalPattern(f);
      draft.content.design = { state: "known", versionId: designId };
      draft.content.measurement = { state: "known", versionId: mv.id };
      await publishPattern(f, draft);
      p = await patternPage(f);
      const id = p.state.latestSavedId;
      await publishPattern(f, await referenceAction(f, id, "review"));
      await publishPattern(
        f,
        await referenceAction(f, id, "select", { use: "inputs-reviewed" }),
      );
      p = await patternPage(f);
      assert.equal(p.comparisons[0].inputState, "matched");
      assert.equal(p.state.currentId, id);
      const selection = await saveDesign(
        f,
        await referenceAction(f, id, "select", { use: "inputs-reviewed" }),
        "pattern.reference",
      );
      const current = await designRequest(f, "design-specifications/list", {
        method: "POST",
        body: f.scope,
      }).then(designOk);
      await publishSpecification(f, {
        ...ds,
        baseVersion: current.version,
        baseSavedId: current.latestSavedId,
        reason: "SYNTHETIC exact design revision",
      });
      assert.equal((await promoteDesign(f, selection)).status, 412);
      p = await patternPage(f);
      assert.notEqual(p.designId, designId);
      assert.equal(p.selected.content.design.versionId, designId);
      assert.equal(p.selected.content.measurement.versionId, mv.id);
      assert.equal(p.comparisons[0].inputState, "mismatch");
      assert.equal(p.comparisons[0].reviewState, "unreviewed");
      const unsafe = await saveDesign(
        f,
        await referenceAction(f, id, "select", { use: "inputs-reviewed" }),
        "pattern.reference",
      );
      assert.equal((await promoteDesign(f, unsafe)).status, 409);
      await publishPattern(
        f,
        await referenceAction(f, id, "select", { use: "reference-only" }),
      );
      assert.equal((await patternPage(f)).selected.id, id);
    }),
);

test(
  "MP-A10/11 current authority fences racing private drafts, reads and exact replay",
  { timeout: 240000 },
  () =>
    withPatterns(async (f) => {
      await publishPatternCapability(f);
      const values = await physicalPattern(f),
        d = await saveDesign(f, values, "pattern.reference"),
        key = randomUUID();
      const original = await promoteDesign(f, d, key).then(designOk);
      const before = (
        await f.admin.query("select count(*)::int n from pattern_draft_value")
      ).rows[0].n;
      await f.admin.query(
        "create function test_pattern_withdrawal() returns trigger language plpgsql as $$begin if NEW.purpose='service' and NEW.decision='withdrawal' then perform pg_advisory_xact_lock(164010);end if;return NEW;end$$;create trigger test_pattern_withdrawal after insert on wearer_purpose_event for each row execute function test_pattern_withdrawal()",
      );
      const gate = await f.admin.connect();
      let withdrawal, racingDraft;
      const waitFor = async (n) => {
        for (let i = 0; i < 80; i++) {
          if (
            (
              await f.admin.query(
                "select count(*)::int n from pg_stat_activity where wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0",
              )
            ).rows[0].n >= n
          )
            return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        assert.fail(
          `Expected ${n} real transactions at the controlled authority barrier`,
        );
      };
      try {
        await gate.query("begin");
        await gate.query("select pg_advisory_xact_lock(164010)");
        withdrawal = fitPhotoConsent(f, "withdrawal", "service");
        await waitFor(1);
        const raw = randomUUID(),
          draftId = `${raw.slice(0, 14)}7${raw.slice(15)}`;
        racingDraft = designRequest(f, `drafts/${draftId}`, {
          method: "PUT",
          body: {
            workflow: "pattern.reference",
            schemaVersion: 1,
            payload: values,
          },
        });
        await waitFor(2);
        await gate.query("commit");
        await withdrawal;
        assert.equal((await racingDraft).status, 404);
      } finally {
        await gate.query("rollback");
        gate.release();
        await Promise.allSettled([withdrawal, racingDraft]);
        await f.admin.query(
          "drop trigger test_pattern_withdrawal on wearer_purpose_event;drop function test_pattern_withdrawal()",
        );
      }
      assert.equal(
        (await f.admin.query("select count(*)::int n from pattern_draft_value"))
          .rows[0].n,
        before,
      );
      assert.equal(
        (
          await designRequest(f, "manual-patterns/list", {
            method: "POST",
            body: f.scope,
          })
        ).status,
        404,
      );
      assert.equal((await designRequest(f, `drafts/${d.draftId}`)).status, 404);
      assert.equal((await promoteDesign(f, d, key)).status, 404);
      await fitPhotoConsent(f, "grant", "service");
      assert.deepEqual(await promoteDesign(f, d, key).then(designOk), original);
    }),
);
