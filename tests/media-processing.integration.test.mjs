import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { startJobRuntime } from "@aarili/jobs/runtime";
import { test } from "vitest";
import {
  blankPdf,
  silenceM4a,
  silenceMp3,
  silenceWav,
} from "../scripts/test-support/media-formats.mjs";
import { withMediaProcessing } from "../scripts/test-support/media-processing.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const image = () =>
  sharp({
    create: { width: 1800, height: 1200, channels: 3, background: "white" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "13/1 0/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "80/1 0/1 0/1",
      },
    })
    .toBuffer();
async function until(run, description) {
  for (let i = 0; i < 100; i++) {
    if (await run()) return;
    await delay(100);
  }
  throw Error(`Timed out: ${description}`);
}
test("0.4.3b H2/H3/H4/H7 real S3/PG accepted sets, usage once, unsupported and malformed format matrix", async () => {
  await withMediaProcessing(async (f) => {
    const tables = await assertIsolationCatalog(f.runtime.db);
    assert(tables.includes("public.media_derivative"));
    const source = await image(),
      grant = await f.admission(source),
      attempt = await f.complete(grant);
    assert.equal(await f.process(grant, attempt), "accepted");
    assert.equal(await f.process(grant, attempt), "accepted");
    const row = await f.transaction((ctx) =>
      ctx.repository.read(grant.asset.id),
    );
    const derivatives = await f.transaction((ctx) =>
      ctx.repository.derivatives(grant.asset.id),
    );
    assert.equal(derivatives.length, 2);
    const keys = new Set([row.acceptedKey, ...derivatives.map((d) => d.key)]);
    assert.equal(keys.size, 3);
    const status = await f.request(`/${grant.asset.id}/status`);
    assert.equal(status.status, 200);
    const body = await status.json();
    assert.equal(body.asset.status, "ready");
    assert.equal(body.derivatives.length, 2);
    assert(!JSON.stringify(body).includes("shops/"));
    let total = row.acceptedBytes;
    for (const variant of [null, "display", "thumbnail"]) {
      const response = await f.request(
        `/${grant.asset.id}${variant ? `/variants/${variant}` : ""}/access`,
      );
      assert.equal(response.status, 200);
      const link = await response.json();
      const download = await fetch(link.url);
      assert.equal(download.status, 200);
      assert.match(download.headers.get("content-disposition"), /^attachment/);
      const bytes = Buffer.from(await download.arrayBuffer()),
        metadata = await sharp(bytes).metadata();
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.orientation, undefined);
      const expected = variant
        ? derivatives.find((d) => d.variant === variant)
        : { sha256: row.sha256 };
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        expected.sha256,
      );
      if (variant) {
        assert.equal(metadata.format, "webp");
        total += bytes.length;
      } else {
        assert.equal(metadata.width, 1200);
        assert.equal(metadata.height, 1800);
      }
    }
    const events = await f.admin.query(
      "select bytes from product_event where subject_id=$1 and name='media.stored'",
      [grant.asset.id],
    );
    assert.equal(events.rowCount, 1);
    assert.equal(Number(events.rows[0].bytes), total);
    const foreign = await f.request(`/${grant.asset.id}/status`, { who: f.b });
    assert.equal(foreign.status, 404);
    assert.equal(
      (await f.runtime.pool.query("select * from media_derivative")).rowCount,
      0,
    );
    await assert.rejects(() =>
      f.transaction((ctx) =>
        ctx.repository.accept(
          grant.asset.id,
          attempt.id,
          randomUUID(),
          row.acceptedKey,
          row.sha256,
          row.acceptedBytes,
        ),
      ),
    );
    // A legacy zero-variant accepted image proves a later transaction cannot
    // append the missing variant even with the correct initiator/fence.
    const old = await f.admission(source),
      oldAttempt = await f.complete(old);
    const { processMedia } = await import("@aarili/core/media");
    assert.equal(
      await processMedia(f.host, old.asset.id, oldAttempt.id, {
        validate: async (bytes) => bytes,
      }),
      "accepted",
    );
    await assert.rejects(() =>
      f.transaction(async (ctx) => {
        const p = await ctx.repository.attempt(old.asset.id);
        return ctx.repository.accept(
          old.asset.id,
          p.id,
          p.fence,
          `shops/${f.a.shop}/private/${old.asset.id}/${p.fence}/${randomUUID()}`,
          "0".repeat(64),
          10,
          [],
        );
      }),
    );
    // Direct insertion is the security regression assertion (no replay/update).
    const stale = await f.transaction((ctx) =>
      ctx.repository.attempt(old.asset.id),
    );
    const { withShop } = await import("@aarili/db");
    await assert.rejects(() =>
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into media_derivative(shop_id,asset_id,variant,object_key,sha256,accepted_bytes,width,height,content_type) values(${f.a.shop}::uuid,${old.asset.id}::uuid,'display',${`shops/${f.a.shop}/private/${old.asset.id}/${stale.fence}/${randomUUID()}`},${"0".repeat(64)},10,10,10,'image/webp')`,
        ),
      ),
    );
    for (const [type, source] of [
      ["application/pdf", blankPdf],
      ["audio/wav", silenceWav],
      ["audio/mpeg", silenceMp3],
      ["audio/mp4", silenceM4a],
    ]) {
      const bytes = source(),
        good = await f.admission(bytes, type),
        goodAttempt = await f.complete(good);
      assert.equal(await f.process(good, goodAttempt), "accepted");
      const bad = await f.admission(bytes.subarray(0, bytes.length - 4), type),
        badAttempt = await f.complete(bad);
      assert.equal(await f.process(bad, badAttempt), "content-rejected");
      assert.equal((await f.request(`/${bad.asset.id}/access`)).status, 404);
      assert.equal(
        (await (await f.request(`/${bad.asset.id}/status`)).json()).asset
          .status,
        "quarantined",
      );
    }
    const badImage = await f.admission(Buffer.from("not JPEG")),
      badAttempt = await f.complete(badImage);
    assert.equal(await f.process(badImage, badAttempt), "content-rejected");
    const bomb = await sharp({
      create: { width: 6400, height: 6400, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const huge = await f.admission(bomb, "image/png"),
      hugeAttempt = await f.complete(huge);
    assert.equal(await f.process(huge, hugeAttempt), "content-rejected");
  });
}, 120000);
test("0.4.3b H5/H6/H7 real runtime retries owned failures, accepted redelivery, final-transaction veto and exhausted status", async () => {
  await withMediaProcessing(async (f) => {
    const source = await image();
    const direct = await f.admission(source),
      directAttempt = await f.complete(direct);
    await assert.rejects(() =>
      f.process(direct, directAttempt, async () => {
        throw Error("Injected final transaction veto");
      }),
    );
    assert.equal(
      (await f.transaction((ctx) => ctx.repository.read(direct.asset.id)))
        .status,
      "processing",
    );
    assert.equal(await f.process(direct, directAttempt), "accepted");
    const bad = await f.admission(Buffer.from("not JPEG")),
      badAttempt = await f.complete(bad);
    await assert.rejects(() =>
      f.process(bad, badAttempt, async () => {
        throw Error("Injected quarantine veto");
      }),
    );
    assert.equal(
      (await f.transaction((ctx) => ctx.repository.read(bad.asset.id))).status,
      "processing",
    );
    assert.equal(await f.process(bad, badAttempt), "content-rejected");
    const retry = await f.admission(source),
      retryAttempt = await f.complete(retry);
    f.failRead(true);
    const runtime = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      { mode: "inprocess", pollMilliseconds: 50 },
      f.composition,
    );
    try {
      await until(
        async () =>
          (
            await f.admin.query("select state from pgboss.job where id=$1", [
              retryAttempt.id,
            ])
          ).rows[0]?.state === "retry",
        "real queue retry",
      );
      assert.equal(
        (await (await f.request(`/${retry.asset.id}/status`)).json())
          .processingState,
        "retrying",
      );
      f.failRead(false);
      await until(
        async () =>
          (
            await f.admin.query("select state from pgboss.job where id=$1", [
              retryAttempt.id,
            ])
          ).rows[0]?.state === "completed",
        "retry after private storage recovers",
      );
      assert.equal(
        (await (await f.request(`/${retry.asset.id}/status`)).json()).asset
          .status,
        "ready",
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from product_event where subject_id=$1 and name='media.stored'",
            [retry.asset.id],
          )
        ).rows[0].n,
        1,
      );
      const dead = await f.admission(source),
        deadAttempt = await f.complete(dead);
      f.failRead(true);
      await until(
        async () =>
          (
            await f.admin.query("select state from pgboss.job where id=$1", [
              deadAttempt.id,
            ])
          ).rows[0]?.state === "failed",
        "bounded retry exhaustion",
      );
      assert.equal(
        (await (await f.request(`/${dead.asset.id}/status`)).json())
          .processingState,
        "failed",
      );
      assert.equal((await f.request(`/${dead.asset.id}/access`)).status, 404);
    } finally {
      f.failRead(false);
      assert.equal(await runtime.stop(), "stopped");
    }
  });
}, 120000);
