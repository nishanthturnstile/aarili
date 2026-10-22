import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { sql, withShop } from "@aarili/db";
import { test } from "vitest";
import {
  designOk,
  designRequest,
  promoteDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  admitReference,
  processReference,
  publishSource,
  referenceItem,
  saveReferenceSpecification,
  withDesignReferences,
} from "../scripts/test-support/design-reference-fixtures.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const image = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
const state = (f) =>
  designRequest(f, "design-specifications/list", {
    method: "POST",
    body: { orderId: f.target.order.id, pieceId: f.pieceId },
  }).then(designOk);
test(
  "DS-B-06/07 real association read, audited subject tombstone and racing private draft/history/replay cannot recover erased values",
  { timeout: 240000 },
  () =>
    withDesignReferences(async (f) => {
      const source = await publishSource(f),
        grant = await admitReference(f, source.subject, await image());
      await processReference(f, grant);
      const sentinel = "SYNTHETIC ERASE CAPTION 148",
        ref = referenceItem(grant.asset.id, null, {
          caption: sentinel,
          annotations: [
            { note: sentinel, anchor: { kind: "point", x: 3000, y: 5000 } },
          ],
        });
      const draft = await saveReferenceSpecification(f, {
          ...f.value,
          referenceItems: [ref],
        }),
        key = randomUUID();
      await promoteDesign(f, draft, key).then(designOk);
      const first = await state(f),
        version = first.versions[0];
      const capability = await designRequest(f, "design-references/read", {
        method: "POST",
        body: { versionId: version.id, referenceId: ref.id },
      }).then(designOk);
      const activeRef = { ...ref, id: randomUUID(), replacesId: ref.id },
        activeDraft = await saveReferenceSpecification(f, {
          ...f.value,
          baseVersion: first.version,
          baseSavedId: first.latestSavedId,
          referenceItems: [activeRef],
        });
      await designRequest(f, "design-references/drafts/read", {
        method: "POST",
        body: { draftId: activeDraft.draftId, referenceId: activeRef.id },
      }).then(designOk);
      assert.equal(
        (
          await designRequest(f, "design-references/read", {
            method: "POST",
            who: f.b,
            body: { versionId: version.id, referenceId: ref.id },
          })
        ).status,
        404,
      );
      await assert.rejects(
        () =>
          withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`select redact_design_reference_subject(${f.a.shop}::uuid,${source.subject.id}::uuid,${randomUUID()}::uuid)`,
            ),
          ),
        (e) => e.cause?.code === "42501",
      );
      let readers;
      await f.admin.query("begin");
      try {
        const pid = (await f.admin.query("select pg_backend_pid() as pid"))
          .rows[0].pid;
        await f.admin.query("set local role app_privacy");
        await f.admin.query(
          "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
          [f.a.user, f.a.shop],
        );
        await f.admin.query(
          "select redact_design_reference_subject($1,$2,$3)",
          [f.a.shop, source.subject.id, randomUUID()],
        );
        await f.admin.query("reset role");
        readers = Promise.all([
          state(f),
          designRequest(f, `drafts/${draft.draftId}`).then(designOk),
          promoteDesign(f, draft, key).then(designOk),
          designRequest(f, "design-references/read", {
            method: "POST",
            body: { versionId: version.id, referenceId: ref.id },
          }),
          designRequest(f, "design-references/drafts/read", {
            method: "POST",
            body: { draftId: activeDraft.draftId, referenceId: activeRef.id },
          }),
        ]);
        let blocked = false;
        for (let i = 0; i < 40; i++) {
          if (
            (
              await f.admin.query(
                "select exists(select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid))) as blocked",
                [pid],
              )
            ).rows[0].blocked
          ) {
            blocked = true;
            break;
          }
          await delay(25);
        }
        assert(blocked);
        await f.admin.query("commit");
      } catch (e) {
        await f.admin.query("rollback");
        throw e;
      }
      const [history, current, replay, access, draftAccess] = await readers;
      assert(history.versions[0].redacted);
      assert.deepEqual(history.versions[0].referenceItems, []);
      assert.deepEqual(current.payload.referenceItems, []);
      assert.deepEqual(replay.draft.payload.referenceItems, []);
      assert.equal(access.status, 404);
      assert.equal(draftAccess.status, 404);
      assert(current.version > draft.draft.version);
      const rows = await f.admin.query(
        "select (select jsonb_agg(payload) from design_spec_draft_value where shop_id=$1) as exact,(select jsonb_agg(payload) from design_reference_draft_value where shop_id=$1) as sources,(select jsonb_agg(notes) from design_reference_value where shop_id=$1) as notes",
        [f.a.shop],
      );
      assert(!JSON.stringify(rows.rows).includes(sentinel));
      assert.equal(
        (
          await designRequest(
            f,
            `design-references/subjects/${source.subject.id}`,
          )
        ).status,
        404,
      );
      const issued = await fetch(capability.url);
      assert.equal(issued.status, 200);
      await issued.arrayBuffer(); // bounded prior capability, not remote erasure
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from media_derivative where shop_id=$1 and asset_id=$2",
            [f.a.shop, grant.asset.id],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (
          await f.runtime.db.execute(
            sql`select count(*)::int as n from design_spec_reference`,
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        () =>
          withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`insert into design_reference_annotation(shop_id,reference_id,position,anchor) values(${f.a.shop}::uuid,${ref.id}::uuid,1,'{"kind":"note"}')`,
            ),
          ),
        (e) => ["23514", "42501"].includes(e.cause?.code),
      );
    }),
);
