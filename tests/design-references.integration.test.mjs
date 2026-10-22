import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql, withShop } from "@aarili/db";
import { test } from "vitest";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  admitReference,
  processReference,
  publishSource,
  referenceItem,
  saveReferenceSpecification,
  sourceDraft,
  withDesignReferences,
} from "../scripts/test-support/design-reference-fixtures.mjs";
import {
  blankPdf,
  silenceM4a,
  silenceMp3,
  silenceWav,
} from "../scripts/test-support/media-formats.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const image = () =>
  sharp({
    create: { width: 240, height: 160, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
const state = (f) =>
  designRequest(f, "design-specifications/list", {
    method: "POST",
    body: { orderId: f.target.order.id, pieceId: f.pieceId },
  }).then(designOk);
test(
  "DS-B-01/02/03 real PG/S3/worker every supported class, exact captions/anchors, save-only and version-preserving replacement",
  { timeout: 240000 },
  () =>
    withDesignReferences(async (f) => {
      const { subject } = await publishSource(f);
      const library = await publishSource(f, sourceDraft(f, "library"));
      const references = [];
      for (const [contentType, bytes] of [
        ["image/jpeg", await image()],
        [
          "image/png",
          await sharp(await image())
            .png()
            .toBuffer(),
        ],
        [
          "image/webp",
          await sharp(await image())
            .webp()
            .toBuffer(),
        ],
        ["application/pdf", blankPdf()],
        ["audio/mpeg", silenceMp3()],
        ["audio/mp4", silenceM4a()],
        ["audio/wav", silenceWav()],
      ]) {
        const selected = contentType.startsWith("audio/")
          ? library.subject
          : subject;
        const grant = await admitReference(f, selected, bytes, contentType);
        assert.equal(
          (await designRequest(f, `files/${grant.asset.id}/access`)).status,
          404,
        );
        const pending = await saveReferenceSpecification(f, {
          ...f.value,
          referenceItems: [referenceItem(grant.asset.id)],
        });
        assert.equal((await promoteDesign(f, pending)).status, 409);
        await processReference(f, grant);
        references.push(
          referenceItem(grant.asset.id, f.value.answers[0].questionId, {
            caption: `SYNTHETIC ${contentType}`,
            annotations: contentType.startsWith("image/")
              ? [
                  {
                    note: "SYNTHETIC upper corner",
                    anchor: { kind: "point", x: 1000, y: 1000 },
                  },
                ]
              : [
                  {
                    note: "SYNTHETIC private download note",
                    anchor: { kind: "note" },
                  },
                ],
          }),
        );
      }
      const draft = await saveReferenceSpecification(f, {
          ...f.value,
          referenceItems: references,
        }),
        key = randomUUID();
      for (const item of references) {
        const review = await designRequest(f, "design-references/drafts/read", {
          method: "POST",
          body: { draftId: draft.draftId, referenceId: item.id },
        }).then(designOk);
        assert.equal(review.reference.assetId, item.assetId);
        assert.equal(review.reference.subject.sourceDate, null);
        const bytes = await fetch(review.access.url);
        assert.equal(bytes.status, 200);
        await bytes.arrayBuffer();
      }
      assert.equal(
        (
          await designRequest(f, "design-references/drafts/read", {
            method: "POST",
            who: f.b,
            body: { draftId: draft.draftId, referenceId: references[0].id },
          })
        ).status,
        404,
      );
      const tables = [
        "design_spec_scope",
        "design_spec_version",
        "design_spec_value",
        "design_spec_reference",
        "design_reference_value",
        "design_reference_annotation",
        "media_reference",
        "design_spec_draft_value",
        "audit_event",
        "idempotency_key",
      ];
      const counts = async () => {
        const result = [];
        for (const table of tables)
          result.push(
            (
              await f.admin.query(
                `select count(*)::int n from ${table} where shop_id=$1`,
                [f.a.shop],
              )
            ).rows[0].n,
          );
        return result;
      };
      const before = await counts();
      await f.migration.query(
        "create function injected_reference_write_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic reference write fault';end$$; create trigger injected_reference_write before insert on design_reference_annotation for each row execute function injected_reference_write_failure()",
      );
      try {
        assert.equal((await promoteDesign(f, draft, key)).status, 503);
        assert.deepEqual(await counts(), before);
      } finally {
        await f.migration.query(
          "drop trigger injected_reference_write on design_reference_annotation;drop function injected_reference_write_failure()",
        );
      }
      const promoted = await promoteDesign(f, draft, key).then(designOk);
      assert.equal(
        (
          await designRequest(f, "design-references/drafts/read", {
            method: "POST",
            body: { draftId: draft.draftId, referenceId: references[0].id },
          })
        ).status,
        404,
      );
      assert.deepEqual(
        await promoteDesign(f, draft, key).then(designOk),
        promoted,
      );
      const first = await state(f),
        v1 = first.versions[0];
      assert.equal(v1.referenceItems.length, 7);
      assert.equal(v1.referenceItems[0].subject.sourceDate, null);
      assert.equal(v1.approval, "not-recorded");
      for (const r of v1.referenceItems) {
        assert.equal(
          (await designRequest(f, `files/${r.assetId}/access`)).status,
          404,
        );
        const access = await designRequest(f, "design-references/read", {
          method: "POST",
          body: { versionId: v1.id, referenceId: r.id },
        }).then(designOk);
        const download = await fetch(access.url);
        assert.equal(download.status, 200);
        assert.equal(
          download.headers
            .get("content-disposition")
            ?.startsWith("attachment;"),
          true,
        );
        await download.arrayBuffer();
      }
      const revised = {
        ...f.value,
        baseVersion: first.version,
        baseSavedId: first.latestSavedId,
        use: false,
        reason: "SYNTHETIC caption and intent revision",
        referenceItems: references.map((r) => ({
          ...r,
          id: randomUUID(),
          replacesId: r.id,
          caption: `${r.caption} v2`,
          intent: "instruction",
        })),
      };
      await promoteDesign(f, await saveReferenceSpecification(f, revised)).then(
        designOk,
      );
      const second = await state(f);
      assert.equal(second.currentId, v1.id);
      assert.deepEqual(second.versions[1], v1);
      assert(
        second.versions[0].referenceItems.every(
          (r) => r.intent === "instruction",
        ),
      );
      const wrong = await designRequest(f, "design-references/read", {
        method: "POST",
        body: {
          versionId: second.versions[0].id,
          referenceId: v1.referenceItems[0].id,
        },
      });
      assert.equal(wrong.status, 404);
      const replacementGrant = await admitReference(
        f,
        subject,
        await sharp(await image())
          .resize(120, 80)
          .jpeg()
          .toBuffer(),
        "image/jpeg",
      );
      await processReference(f, replacementGrant);
      const makeReplacement = (reviewed) => ({
        ...revised,
        baseVersion: second.version,
        baseSavedId: second.latestSavedId,
        referenceItems: [
          {
            ...second.versions[0].referenceItems[0],
            id: randomUUID(),
            assetId: replacementGrant.asset.id,
            replacesId: second.versions[0].referenceItems[0].id,
            geometryReviewed: reviewed,
          },
        ].map(
          ({
            id,
            assetId,
            questionId,
            intent,
            caption,
            annotations,
            replacesId,
            geometryReviewed,
          }) => ({
            id,
            assetId,
            questionId,
            intent,
            caption,
            annotations,
            replacesId,
            geometryReviewed,
          }),
        ),
      });
      assert.equal(
        (
          await promoteDesign(
            f,
            await saveReferenceSpecification(f, makeReplacement(false)),
          )
        ).status,
        409,
      );
      const a = await saveReferenceSpecification(f, makeReplacement(true)),
        b = await saveReferenceSpecification(f, makeReplacement(true));
      assert.deepEqual(
        (await Promise.all([promoteDesign(f, a), promoteDesign(f, b)]))
          .map((r) => r.status)
          .sort(),
        [200, 412],
      );
      const third = await state(f);
      assert.equal(third.versions[0].referenceItems.length, 1);
      assert.equal(
        third.versions[0].referenceItems[0].assetId,
        replacementGrant.asset.id,
      );
      assert.deepEqual(third.versions[1], second.versions[0]);
      assert.deepEqual(third.versions[2], v1);
    }),
);

test(
  "DS-B-04/08 source atomicity, same-wearer explicit association, unknown rights remain private inspiration and opaque relinking is denied",
  { timeout: 240000 },
  () =>
    withDesignReferences(async (f) => {
      const d = await saveDesign(
          f,
          { ...sourceDraft(f), rightsBasis: "unknown" },
          "design.reference",
        ),
        key = randomUUID();
      const tables = [
        "design_media_subject",
        "design_media_order_subject",
        "design_media_library_subject",
        "design_media_value",
        "design_reference_draft_value",
        "audit_event",
        "idempotency_key",
      ];
      const counts = async () => {
        const values = [];
        for (const table of tables)
          values.push(
            (
              await f.admin.query(
                `select count(*)::int n from ${table} where shop_id=$1`,
                [f.a.shop],
              )
            ).rows[0].n,
          );
        return values;
      };
      const before = await counts();
      await f.migration.query(
        "create function injected_source_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic source write fault';end$$;create trigger injected_source_write before insert on design_media_value for each row execute function injected_source_failure()",
      );
      try {
        assert.equal((await promoteDesign(f, d, key)).status, 503);
        assert.deepEqual(await counts(), before);
      } finally {
        await f.migration.query(
          "drop trigger injected_source_write on design_media_value;drop function injected_source_failure()",
        );
      }
      const promoted = await promoteDesign(f, d, key).then(designOk);
      assert.deepEqual(await promoteDesign(f, d, key).then(designOk), promoted);
      const subject = await designRequest(
          f,
          `design-references/subjects/${promoted.draft.result.id}`,
        ).then(designOk),
        grant = await admitReference(f, subject, await image());
      await processReference(f, grant);
      const instruction = await saveReferenceSpecification(f, {
        ...f.value,
        referenceItems: [
          referenceItem(grant.asset.id, null, { intent: "instruction" }),
        ],
      });
      assert.equal((await promoteDesign(f, instruction)).status, 409);
      const other = await f.s.accept(),
        piece = other.pieces.identities.find(
          (p) => p.key === f.s.top.definition.content.code,
        ).id;
      const reuse = await saveReferenceSpecification(f, {
        ...f.value,
        orderId: other.order.id,
        pieceId: piece,
        referenceItems: [referenceItem(grant.asset.id)],
      });
      await promoteDesign(f, reuse).then(designOk);
      const origin = await state(f);
      assert.equal(origin.versions.length, 0); // Explicit target association did not edit the source scope.
      assert.equal(
        (
          await designRequest(f, "design-references/assets", {
            method: "POST",
            who: f.b,
            body: { subjectId: subject.id },
          })
        ).status,
        404,
      );
      await assert.rejects(
        withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`insert into media_reference(shop_id,asset_id,reference_id) values(${f.a.shop}::uuid,${grant.asset.id}::uuid,${randomUUID()}::uuid)`,
          ),
        ),
        (e) => ["23514", "42501"].includes(e.cause?.code ?? e.code),
      );
    }),
);
