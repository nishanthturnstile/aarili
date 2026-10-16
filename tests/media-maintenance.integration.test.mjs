import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { reconcileMediaOutputs } from "@aarili/core/media";
import { mediaProcessingHost } from "@aarili/jobs/media";
import { startJobRuntime } from "@aarili/jobs/runtime";
import { createMediaOrphanStorage } from "@aarili/platform/media-storage";
import { test } from "vitest";
import { withMediaProcessing } from "../scripts/test-support/media-processing.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const image = () =>
  sharp({
    create: { width: 100, height: 80, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
async function ageClaims(f, id) {
  // Disposable synthetic time advancement only, never an application operation.
  await f.admin.query("alter table audit_event disable trigger user");
  try {
    await f.admin.query(
      "update audit_event set occurred_at=now()-interval '10 minutes' where entity_id=$1 and action='media.claim'",
      [id],
    );
  } finally {
    await f.admin.query("alter table audit_event enable trigger user");
  }
}
async function until(run, description) {
  for (let i = 0; i < 100; i++) {
    if (await run()) return;
    await delay(100);
  }
  throw Error(`Timed out: ${description}`);
}
test("0.4.3b H6/H7 committed orphan intents, partial crash retry, accepted/reference/lease/restore isolation", async () => {
  await withMediaProcessing(async (f) => {
    const maintenance = createMediaOrphanStorage(f.config);
    try {
      const source = await image(),
        grant = await f.admission(source),
        attempt = await f.complete(grant);
      f.failWrite(2);
      await assert.rejects(() => f.process(grant, attempt));
      const failed = await f.transaction((ctx) =>
        ctx.repository.attempt(grant.asset.id),
      );
      const prefix = `shops/${f.a.shop}/private/${grant.asset.id}/${failed.fence}`;
      assert.equal((await maintenance.list(prefix)).length, 1);
      f.failWrite(0);
      assert.equal(await f.process(grant, attempt), "accepted");
      const accepted = await f.transaction(async (ctx) => ({
        asset: await ctx.repository.read(grant.asset.id),
        derivatives: await ctx.repository.derivatives(grant.asset.id),
      }));
      await ageClaims(f, grant.asset.id);
      let failAfterDelete = true,
        deletedKey;
      const reconciler = {
        list: maintenance.list,
        async remove(key) {
          assert.equal(
            (
              await f.admin.query(
                "select count(*)::int as n from media_cleanup_intent where object_key=$1 and completed_at is null",
                [key],
              )
            ).rows[0].n,
            1,
            "deletion intent committed before external I/O",
          );
          await maintenance.remove(key);
          deletedKey = key;
          if (failAfterDelete) {
            failAfterDelete = false;
            throw Error("Injected crash after object deletion");
          }
        },
      };
      await assert.rejects(() =>
        reconcileMediaOutputs(f.host, grant.asset.id, reconciler, 300),
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from media_cleanup_intent where completed_at is null",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, grant.asset.id, reconciler, 3600),
        0,
        "longer caller grace rechecked for pending intent",
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, grant.asset.id, reconciler, 300),
        1,
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, grant.asset.id, reconciler, 300),
        0,
      );
      assert.deepEqual(await maintenance.list(prefix), []);
      const gone = await f.actualStorage.signGet(
        deletedKey,
        "image/jpeg",
        `file-${grant.asset.id}.jpg`,
        300,
        new Date(),
      );
      assert.equal((await fetch(gone)).status, 404);
      const after = await f.transaction(async (ctx) => ({
        asset: await ctx.repository.read(grant.asset.id),
        derivatives: await ctx.repository.derivatives(grant.asset.id),
      }));
      assert.deepEqual(after, accepted);
      const acceptedPrefix = accepted.asset.acceptedKey.slice(
        0,
        accepted.asset.acceptedKey.lastIndexOf("/"),
      );
      assert.equal((await maintenance.list(acceptedPrefix)).length, 3);
      // Fresh current-epoch intent preserves the old immutable denied intent.
      const extra = await f.actualStorage.seal(
        prefix,
        new Uint8Array([1, 2, 3]),
        "image/jpeg",
      );
      await assert.rejects(() =>
        reconcileMediaOutputs(
          f.host,
          grant.asset.id,
          {
            list: maintenance.list,
            remove: async () => {
              throw Error("Injected pre-delete failure");
            },
          },
          300,
        ),
      );
      const old = (
        await f.admin.query(
          "select * from media_cleanup_intent where object_key=$1",
          [extra],
        )
      ).rows[0];
      await f.admin.query(
        "update system_state set side_effects_enabled=false,restore_epoch=uuidv7()",
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, grant.asset.id, maintenance, 300),
        0,
      );
      await f.admin.query("update system_state set side_effects_enabled=true");
      assert.equal(
        await reconcileMediaOutputs(f.host, grant.asset.id, maintenance, 300),
        1,
      );
      const records = (
        await f.admin.query(
          "select * from media_cleanup_intent where object_key=$1 order by created_at",
          [extra],
        )
      ).rows;
      assert.equal(records.length, 2);
      assert.deepEqual(records[0], old);
      assert(records[1].completed_at);
      const referenced = await f.actualStorage.seal(
        acceptedPrefix,
        new Uint8Array([4]),
        "image/jpeg",
      );
      await f.admin.query(
        "insert into media_reference(shop_id,asset_id,reference_id) values($1,$2,$3)",
        [f.a.shop, grant.asset.id, randomUUID()],
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, grant.asset.id, maintenance, 300),
        0,
      );
      assert((await maintenance.list(acceptedPrefix)).includes(referenced));
      const foreign = mediaProcessingHost(
        f.parallel.db,
        f.b.shop,
        f.b.user,
        (tx) => f.adapters(tx, f.b.shop),
      );
      assert.equal(
        await reconcileMediaOutputs(foreign, grant.asset.id, maintenance, 300),
        0,
      );
      const active = await f.admission(source),
        activeAttempt = await f.complete(active);
      f.failWrite(2);
      await assert.rejects(() => f.process(active, activeAttempt));
      f.failWrite(0);
      await ageClaims(f, active.asset.id);
      await f.admin.query(
        "update media_attempt set lease_until=now()+interval '5 minutes' where id=$1",
        [activeAttempt.id],
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, active.asset.id, maintenance, 300),
        0,
      );
      await f.admin.query(
        "update media_attempt set lease_until=now()-interval '1 minute' where id=$1",
        [activeAttempt.id],
      );
      assert.equal(
        await reconcileMediaOutputs(f.host, active.asset.id, maintenance, 300),
        1,
      );
      assert.equal(
        (await f.runtime.pool.query("select * from media_cleanup_intent"))
          .rowCount,
        0,
      );
      await assert.rejects(() =>
        reconcileMediaOutputs(
          f.host,
          active.asset.id,
          {
            list: async () => [
              `shops/${f.b.shop}/private/${active.asset.id}/${randomUUID()}/${randomUUID()}`,
            ],
            remove: async () => {
              throw Error("must not delete");
            },
          },
          300,
        ),
      );
    } finally {
      maintenance.destroy();
    }
  });
}, 120000);
test("0.4.3b H5/H6 worker-mode shutdown after usage vetoes final commit; crashed lease expires before real retry", async () => {
  await withMediaProcessing(async (f) => {
    const grant = await f.admission(await image()),
      attempt = await f.complete(grant);
    const metadata = (
      await f.admin.query(
        "select expire_seconds,retry_limit,retry_delay from pgboss.job where id=$1",
        [attempt.id],
      )
    ).rows[0];
    assert(metadata.expire_seconds >= 300);
    assert.equal(metadata.retry_limit, 3);
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(".scratch", { recursive: true });
    await writeFile(
      ".scratch/media-queue-observation.json",
      JSON.stringify(metadata, null, 2),
    );
    console.info(
      `Synthetic media queue technical metadata: ${JSON.stringify(metadata)}`,
    );
    let release,
      reached,
      count = 0;
    const barrier = new Promise((r) => {
      reached = r;
    });
    const runtime = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      {
        mode: "worker",
        pollMilliseconds: 50,
        hooks: {
          async beforeCommit() {
            if (++count === 2) {
              reached();
              await new Promise((r) => {
                release = r;
              });
            }
          },
        },
      },
      f.composition,
    );
    assert.deepEqual(runtime.handlers, ["media.process"]);
    await barrier;
    assert.equal(await runtime.stop(20), "timed-out");
    release();
    await until(
      async () =>
        Number(
          (
            await f.admin.query(
              "select count(*)::int as n from media_derivative",
            )
          ).rows[0].n,
        ) === 0,
      "timed out worker rollback",
    );
    await delay(100);
    assert.equal(
      (await f.transaction((ctx) => ctx.repository.read(grant.asset.id)))
        .status,
      "processing",
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int as n from product_event where name='media.stored'",
        )
      ).rows[0].n,
      0,
    );
    // Simulate elapsed technical timestamps; no accepted business history changes.
    await f.admin.query(
      "update media_attempt set lease_until=now()-interval '1 minute' where id=$1",
      [attempt.id],
    );
    await f.admin.query(
      "update pgboss.job set started_on=now()-interval '1 hour' where id=$1",
      [attempt.id],
    );
    const successor = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      { mode: "worker", pollMilliseconds: 50 },
      f.composition,
    );
    try {
      await until(
        async () =>
          (
            await f.admin.query("select state from pgboss.job where id=$1", [
              attempt.id,
            ])
          ).rows[0]?.state === "completed",
        "crashed job real queue expiry and recovery",
      );
    } finally {
      assert.equal(await successor.stop(), "stopped");
    }
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int as n from product_event where name='media.stored'",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await f.admin.query("select count(*)::int as n from media_derivative"))
        .rows[0].n,
      2,
    );
  });
}, 120000);
