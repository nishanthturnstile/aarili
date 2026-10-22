import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { syntheticGuardianPolicy } from "@aarili/core/wearer-policy";
import { test } from "vitest";
import {
  designOk,
  designRequest,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  admitReference,
  publishSource,
  referenceItem,
  sourceDraft,
  withDesignReferences,
} from "../scripts/test-support/design-reference-fixtures.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const photo = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
test(
  "DS-B-05 actual minor guardian purpose at admission, completion and worker finalization; payer alone never grants photo access",
  { timeout: 240000 },
  () =>
    withDesignReferences(async (f) => {
      const customerId = f.seed.customer.customerId,
        customer = await designRequest(f, `customers/${customerId}`).then(
          designOk,
        ),
        at = new Date().toISOString();
      const created = await designRequest(
        f,
        `customers/${customerId}/wearers`,
        {
          method: "POST",
          body: {
            mode: "new",
            displayName: "SYNTHETIC child",
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
              statementByPersonId: customer.personId,
              authorised: true,
              informed: true,
              source: "in-person",
              occurredAt: at,
              interaction: "SYNTHETIC family contact is not a guardian",
            },
          },
        },
      ).then(designOk);
      const path = `customers/${customerId}/wearers/${created.wearerId}`,
        w = await designRequest(f, path).then(designOk),
        gp = `${path}/guardians`;
      await designRequest(f, gp, {
        method: "POST",
        etag: `"v${w.version}"`,
        body: {
          guardian: { mode: "new", displayName: "SYNTHETIC parent" },
          authority: "parent",
          scope: "measurement-and-private-photo",
          source: "in-person",
          occurredAt: at,
        },
      }).then(designOk);
      let g = await designRequest(f, gp).then(designOk);
      await designRequest(f, `${gp}/verification-events`, {
        method: "POST",
        etag: `"v${g.version}"`,
        body: {
          authorityId: g.authority.id,
          status: "confirmed",
          method: "synthetic-review-v1",
          evidenceRef: "SYNTHETIC invented review 148",
          scope: g.authority.scope,
          source: "in-person",
          occurredAt: at,
        },
      }).then(designOk);
      g = await designRequest(f, gp).then(designOk);
      const accepted = await f.s.accept(undefined, {
          customerId,
          wearerId: w.id,
        }),
        pieceId = accepted.pieces.identities.find(
          (p) => p.key === f.s.top.definition.content.code,
        ).id;
      const subject = await publishSource(f, {
          ...sourceDraft(f),
          orderId: accepted.order.id,
          pieceId,
        }).then((r) => r.subject),
        bytes = await photo();
      const admission = () =>
        designRequest(f, "files/uploads", {
          method: "POST",
          body: {
            subjectId: subject.id,
            purpose: "wearer-photo",
            contentType: "image/jpeg",
            size: bytes.length,
          },
        });
      const count = async () =>
        Number(
          (
            await f.admin.query(
              "select count(*) n from media_asset where shop_id=$1 and subject_id=$2",
              [f.a.shop, subject.id],
            )
          ).rows[0].n,
        );
      assert.equal((await admission()).status, 403);
      assert.equal(await count(), 0);
      async function decision(value) {
        g = await designRequest(f, gp).then(designOk);
        await designRequest(f, `${gp}/consent-events`, {
          method: "POST",
          etag: `"v${g.version}"`,
          body: {
            authorityId: g.authority.id,
            purpose: "private-photo",
            decision: value,
            noticeId: syntheticGuardianPolicy.notice.id,
            noticeExplained: true,
            language: "en",
            giverPersonId: g.authority.personId,
            source: "in-person",
            occurredAt: new Date().toISOString(),
          },
        }).then(designOk);
      }
      await decision("grant");
      const first = await admitReference(f, subject, bytes);
      await decision("withdrawal");
      assert.equal(
        (
          await designRequest(f, `files/${first.asset.id}/complete`, {
            method: "POST",
            etag: `"v${first.asset.version}"`,
            body: {},
          })
        ).status,
        403,
      );
      await decision("grant");
      const second = await admitReference(f, subject, bytes),
        attempt = await f.complete(second);
      let reached, release;
      const started = new Promise((r) => {
          reached = r;
        }),
        gate = new Promise((r) => {
          release = r;
        }),
        snapshot = f.storage.snapshot;
      f.storage.snapshot = async (...args) => {
        reached();
        await gate;
        return snapshot(...args);
      };
      const running = f.process(second, attempt);
      try {
        await Promise.race([
          started,
          running.then((outcome) => {
            throw Error(`Worker returned before snapshot: ${outcome}`);
          }),
        ]);
        await decision("withdrawal");
      } finally {
        release();
      }
      await assert.rejects(running, (e) => e.status === 403);
      f.storage.snapshot = snapshot;
      assert.equal(
        (
          await f.admin.query(
            "select status from media_asset where shop_id=$1 and id=$2",
            [f.a.shop, second.asset.id],
          )
        ).rows[0].status,
        "processing",
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from product_event where shop_id=$1 and subject_id=$2 and name='media.stored'",
            [f.a.shop, second.asset.id],
          )
        ).rows[0].n,
        0,
      );
      // The accepted order still points at its original child and payer; consent
      // changes cannot transfer a file to the fixture's unrelated adult wearer.
      const foreign = await designRequest(
        f,
        `drafts/${crypto.randomUUID().replace(/^(........-....-)./, "$17")}`,
        {
          method: "PUT",
          body: {
            workflow: "design.specification",
            schemaVersion: 2,
            payload: {
              ...f.value,
              referenceItems: [referenceItem(second.asset.id)],
            },
          },
        },
      );
      assert.equal(foreign.status, 404);
      await decision("grant");
      const third = await admitReference(f, subject, bytes),
        thirdAttempt = await f.complete(third);
      let ageReached, ageRelease;
      const ageStarted = new Promise((resolve) => {
          ageReached = resolve;
        }),
        ageGate = new Promise((resolve) => {
          ageRelease = resolve;
        });
      f.storage.snapshot = async (...args) => {
        ageReached();
        await ageGate;
        return snapshot(...args);
      };
      const ageRun = f.process(third, thirdAttempt);
      try {
        await Promise.race([
          ageStarted,
          ageRun.then((outcome) => {
            throw Error(`Worker returned before age race: ${outcome}`);
          }),
        ]);
        const current = await designRequest(f, path).then(designOk);
        const {
          id: _id,
          customerId: _customer,
          ...relationship
        } = current.relationship;
        await designRequest(f, path, {
          method: "PATCH",
          etag: `"v${current.version}"`,
          body: {
            age: "unknown",
            preferences: current.preferences,
            relationship,
            reason: "SYNTHETIC age review while media is processing",
          },
        }).then(designOk);
      } finally {
        ageRelease();
      }
      await assert.rejects(ageRun, (error) => error.status === 403);
      f.storage.snapshot = snapshot;
      assert.equal(
        (
          await f.admin.query(
            "select status from media_asset where shop_id=$1 and id=$2",
            [f.a.shop, third.asset.id],
          )
        ).rows[0].status,
        "processing",
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from product_event where shop_id=$1 and subject_id=$2 and name='media.stored'",
            [f.a.shop, third.asset.id],
          )
        ).rows[0].n,
        0,
      );
    }),
);
