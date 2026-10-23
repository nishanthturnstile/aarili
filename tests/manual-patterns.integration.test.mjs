import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
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

test(
  "MP-A01/02/03/05/06/07/11 fileless manual/external reference, distinct review and explicit historical selection",
  { timeout: 240000 },
  () =>
    withPatterns(async (f) => {
      assert.equal((await patternPage(f)).capability, null);
      const privateRead = await designRequest(f, "manual-patterns/list", {
        method: "POST",
        body: f.scope,
      });
      assert.equal(privateRead.status, 200);
      assert.match(privateRead.headers.get("Cache-Control"), /no-store/);
      assert.equal(privateRead.headers.get("Referrer-Policy"), "no-referrer");
      for (const [path, body, origin, expected] of [
        ["manual-patterns/list?orderId=private", f.scope, f.owner.origin, 422],
        ["manual-patterns/list", f.scope, "https://untrusted.invalid", 403],
        [
          "manual-patterns/list",
          { ...f.scope, padding: "x".repeat(9000) },
          f.owner.origin,
          413,
        ],
      ])
        assert.equal(
          (await designRequest(f, path, { method: "POST", body, origin }))
            .status,
          expected,
        );
      const notConfigured = await saveDesign(
        f,
        await physicalPattern(f),
        "pattern.reference",
      );
      assert.equal((await promoteDesign(f, notConfigured)).status, 409);
      await publishPatternCapability(f);
      await publishPattern(
        f,
        await physicalPattern(f, { operation: "prepare" }),
      );
      assert.equal((await patternPage(f)).state.method, "manual");
      assert.equal((await patternPage(f)).state.latestSavedId, null);
      const d = await saveDesign(
          f,
          await physicalPattern(f),
          "pattern.reference",
        ),
        key = randomUUID();
      const r = await promoteDesign(f, d, key).then(designOk);
      assert.deepEqual(await promoteDesign(f, d, key).then(designOk), r);
      let p = await patternPage(f);
      const first = p.state.latestSavedId;
      assert.equal(p.state.currentId, null);
      assert.equal(
        p.state.versions[0].content.locator,
        "Cabinet B / folder 12",
      );
      await publishPattern(f, await referenceAction(f, first, "review"));
      await publishPattern(f, await referenceAction(f, first, "select"));
      p = await patternPage(f);
      assert.equal(p.state.currentId, first);
      assert.equal(p.comparisons[0].inputState, "unknown");
      const revision = await physicalPattern(f);
      revision.method = "external";
      revision.content.locator = "Cabinet B / folder 13";
      revision.content.sourceKind = "external-supplier";
      revision.content.source = "SYNTHETIC supplier";
      revision.content.sourceVersion = "Supplier R2";
      await publishPattern(f, revision);
      p = await patternPage(f);
      const second = p.state.latestSavedId;
      assert.notEqual(second, first);
      assert.equal(p.state.currentId, first);
      assert.equal(p.state.versions[0].previousId, first);
      assert.equal(
        p.state.versions.find((v) => v.id === first).content.locator,
        "Cabinet B / folder 12",
      );
      assert.equal(
        p.comparisons.find((c) => c.referenceId === second).reviewState,
        "unreviewed",
      );
      await publishPattern(f, await referenceAction(f, second, "review"));
      await publishPattern(f, await referenceAction(f, second, "select"));
      p = await patternPage(f);
      assert.equal(p.selected.id, second);
      assert.equal(
        p.state.events.filter((e) => e.operation === "select").length,
        2,
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from media_asset")).rows[0]
          .n,
        0,
      );
      await assert.rejects(() =>
        withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update pattern_version set version=99 where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      await withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        assertIsolationCatalog(tx),
      );
      assert.equal(
        (
          await f.runtime.pool.query(
            "select count(*)::int n from pattern_version",
          )
        ).rows[0].n,
        0,
      );
      await withShop(f.parallel.db, f.b.user, f.b.shop, async (tx) => {
        assert.equal(
          (await tx.execute(sql`select count(*)::int n from pattern_version`))
            .rows[0].n,
          0,
        );
      });
    }),
);

test(
  "MP-A04/09/10/11 privacy, tenant negatives, immutable references, stale and concurrent commands",
  { timeout: 240000 },
  () =>
    withPatterns(async (f) => {
      await publishPatternCapability(f);
      const v = await physicalPattern(f);
      const foreign = await designRequest(f, "manual-patterns/list", {
        method: "POST",
        who: f.b,
        body: f.scope,
      });
      assert.equal(foreign.status, 404);
      assert.equal(
        (
          await designRequest(f, "manual-patterns/list", {
            method: "POST",
            body: { ...f.scope, pieceId: randomUUID() },
          })
        ).status,
        404,
      );
      const wrongWearer = { ...v, wearerId: randomUUID() };
      assert.equal(
        (
          await designRequest(
            f,
            `drafts/${randomUUID().replace(/^(........-....-)./, "$17")}`,
            {
              method: "PUT",
              body: {
                workflow: "pattern.reference",
                schemaVersion: 1,
                payload: wrongWearer,
              },
            },
          )
        ).status,
        404,
      );
      const known = {
        ...v,
        content: {
          ...v.content,
          design: { state: "known", versionId: randomUUID() },
        },
      };
      const bad = await saveDesign(f, known, "pattern.reference");
      assert.equal((await promoteDesign(f, bad)).status, 404);
      const ds = await Promise.all([
        saveDesign(f, v, "pattern.reference"),
        saveDesign(f, { ...v, reason: "Other contender" }, "pattern.reference"),
      ]);
      assert.deepEqual(
        (await Promise.all(ds.map((d) => promoteDesign(f, d))))
          .map((r) => r.status)
          .sort(),
        [200, 412],
      );
      const p = await patternPage(f),
        id = p.state.latestSavedId;
      const reviewed = await referenceAction(f, id, "review");
      reviewed.reviewState = "changes-required";
      await publishPattern(f, reviewed);
      const selecting = await saveDesign(
        f,
        await referenceAction(f, id, "select"),
        "pattern.reference",
      );
      assert.equal((await promoteDesign(f, selecting)).status, 409);
      await publishPatternCapability(f, { manual: "unavailable" });
      const unavailable = await patternPage(f);
      assert.equal(unavailable.state.versions.length, 1);
      assert.equal(unavailable.comparisons[0].reviewState, "changes-required");
      await publishPatternCapability(f);
      await publishPattern(
        f,
        await referenceAction(f, id, "review", { reviewState: "withdrawn" }),
      );
      await publishPatternCapability(f, { manual: "unavailable" });
      assert.equal(
        (await patternPage(f)).comparisons[0].reviewState,
        "withdrawn",
      );
      const stale = await saveDesign(
        f,
        { ...v, baseVersion: 0 },
        "pattern.reference",
      );
      assert.equal((await promoteDesign(f, stale)).status, 412);
      await f.admin.query(
        "select set_config('app.user_id',$1,false),set_config('app.shop_id',$2,false),set_config('app.actor_id',$1,false)",
        [f.a.user, f.a.shop],
      );
      await f.admin.query("set role app_privacy");
      try {
        await f.admin.query("select redact_measurements($1,$2,$3)", [
          f.a.shop,
          f.identity.wearerId,
          randomUUID(),
        ]);
      } finally {
        await f.admin.query("reset role");
      }
      assert.equal(
        (
          await designRequest(f, "manual-patterns/list", {
            method: "POST",
            body: f.scope,
          })
        ).status,
        404,
      );
      const privateRows = await f.admin.query(
        "select payload,redacted_at from pattern_value",
      );
      assert.ok(
        privateRows.rows.every((r) => r.payload === null && r.redacted_at),
      );
      const replays = await f.admin.query(
        "select payload from pattern_draft_value",
      );
      assert.ok(
        replays.rows.every(
          (r) => r.payload.erased && r.payload.content.locator === "",
        ),
      );
      assert.equal(
        (await f.admin.query("select count(*)::int n from pattern_version"))
          .rows[0].n,
        1,
      );
      for (const d of ds) {
        assert.equal(
          (await designRequest(f, `drafts/${d.draftId}`)).status,
          404,
        );
        assert.equal((await promoteDesign(f, d)).status, 404);
      }
    }),
);

test(
  "MP-A11/12 atomic rollback and command binding; 428/412/422 and no partial history",
  { timeout: 240000 },
  () =>
    withPatterns(async (f) => {
      await publishPatternCapability(f);
      const value = await physicalPattern(f),
        d = await saveDesign(f, value, "pattern.reference");
      assert.equal(
        (
          await designRequest(f, `drafts/${d.draftId}/promote`, {
            method: "POST",
            body: {},
          })
        ).status,
        428,
      );
      assert.equal(
        (await promoteDesign(f, d, undefined, { etag: '"v99"' })).status,
        412,
      );
      const key = randomUUID();
      await promoteDesign(f, d, key).then(designOk);
      const other = await saveDesign(
        f,
        await physicalPattern(f),
        "pattern.reference",
      );
      assert.equal((await promoteDesign(f, other, key)).status, 422);
      const before = (
        await f.admin.query("select count(*)::int n from pattern_event")
      ).rows[0].n;
      await f.admin.query(
        "create function reject_pattern_test() returns trigger language plpgsql as $$begin raise exception 'synthetic failure';end$$; create trigger synthetic_pattern_failure before insert on pattern_value for each row execute function reject_pattern_test()",
      );
      try {
        assert.equal((await promoteDesign(f, other)).status, 503);
      } finally {
        await f.admin.query(
          "drop trigger synthetic_pattern_failure on pattern_value;drop function reject_pattern_test()",
        );
      }
      assert.equal(
        (await f.admin.query("select count(*)::int n from pattern_event"))
          .rows[0].n,
        before,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from audit_event where action='pattern.save'",
          )
        ).rows[0].n,
        before,
      );
    }),
);

test(
  "MP-A upgrade: populated prior snapshots unchanged, additive and idempotent migration",
  { timeout: 240000 },
  () =>
    withPatterns(
      async (f) => {
        const snapshots = () =>
          f.admin.query(
            "select to_jsonb(s) value from order_acceptance_snapshot s order by order_id",
          );
        const before = (await snapshots()).rows;
        await migrateDatabase(f.migrationConnectionString);
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual((await snapshots()).rows, before);
        assert.equal((await patternPage(f)).state.version, 0);
      },
      { migrationThrough: "0048_measurement_fit.sql" },
    ),
);
