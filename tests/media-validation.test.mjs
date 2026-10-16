import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  MediaContentRejected,
  validatePrivateMedia,
} from "@aarili/platform/media-validation";
import { test } from "vitest";
import {
  blankPdf,
  silenceM4a,
  silenceMp3,
  silenceWav,
} from "../scripts/test-support/media-formats.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
test("0.4.3b H2/H4 supported private attachment structures and mismatched/truncated payloads", async () => {
  for (const [type, source] of [
    ["application/pdf", blankPdf],
    ["audio/wav", silenceWav],
    ["audio/mpeg", silenceMp3],
    ["audio/mp4", silenceM4a],
  ]) {
    const bytes = source();
    const result = await validatePrivateMedia(bytes, type);
    assert.deepEqual(result.original, bytes);
    assert.deepEqual(result.derivatives, []);
    for (const malformed of [
      bytes.subarray(0, bytes.length - 3),
      Buffer.from("<html>not media</html>"),
      Buffer.concat([bytes, Buffer.from("evil")]),
    ])
      await assert.rejects(
        () => validatePrivateMedia(malformed, type),
        MediaContentRejected,
      );
  }
});
test("0.4.3b H2 bounded PDF xref/root/page/stream consistency; unsupported profiles distinguished", async () => {
  const stream = "BT /F1 12 Tf (synthetic only) Tj ET";
  const source = blankPdf(stream);
  for (const [from, to] of [
    ["/Root 1 0 R", "/Root 9 0 R"],
    ["/Count 1", "/Count 2"],
    [`/Length ${Buffer.byteLength(stream)}`, "/Length 99"],
    ["/MediaBox", "/OtherBox"],
    ["xref\n0 5", "xref\n9 5"],
  ]) {
    const text = source.toString().replace(from, to);
    assert.notEqual(text, source.toString(), `Missing mutation target ${from}`);
    await assert.rejects(
      () => validatePrivateMedia(Buffer.from(text), "application/pdf"),
      MediaContentRejected,
    );
  }
  await assert.rejects(
    () =>
      validatePrivateMedia(
        Buffer.from(
          blankPdf().toString().replace("/Size 5", "/Encrypt null /Size 5"),
        ),
        "application/pdf",
      ),
    { reason: "unsupported" },
  );
  await assert.rejects(
    () =>
      validatePrivateMedia(
        blankPdf("", {
          0: `<< /Type /Catalog /Pages 2 0 R /Invalid ${"9".repeat(2000)}x >>`,
        }),
        "application/pdf",
      ),
    MediaContentRejected,
  );
  await assert.rejects(
    () =>
      validatePrivateMedia(
        blankPdf("", {
          0: `<< /Type /Catalog /Pages 2 0 R /Invalid ${"9".repeat(8000)}x >>`,
        }),
        "application/pdf",
      ),
    { reason: "unsupported" },
  );
  for (const page of [
    "<< /Type /Page /Parent 2 0 R /Contents /BadName >>",
    "<< /Type /Page /Parent 2 0 R /Contents 1 0 R >>",
    "<< /Type /Page /Parent 2 0 R /Contents [4 0 R 1 0 R] >>",
  ])
    await assert.rejects(
      () => validatePrivateMedia(blankPdf("", { 2: page }), "application/pdf"),
      MediaContentRejected,
    );
  await assert.rejects(
    () =>
      validatePrivateMedia(
        blankPdf("", { 1: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" }),
        "application/pdf",
      ),
    MediaContentRejected,
  );
  await assert.rejects(
    () =>
      validatePrivateMedia(
        Buffer.from(
          blankPdf()
            .toString()
            .replace("0000000000 65535 f", "0000000000 00000 f"),
        ),
        "application/pdf",
      ),
    MediaContentRejected,
  );
});
test("0.4.3b H3 at-limit 40MP synthetic image resource observation (one serial decode pipeline)", async () => {
  const source = await sharp({
    create: { width: 8000, height: 5000, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  const start = performance.now(),
    before = process.memoryUsage().rss;
  const result = await validatePrivateMedia(source, "image/jpeg");
  assert.equal(result.derivatives.length, 2);
  console.info(
    `Synthetic 40MP observation: ${JSON.stringify({ elapsedMs: Math.round(performance.now() - start), rssBeforeMiB: Math.round(before / 1048576), rssAfterMiB: Math.round(process.memoryUsage().rss / 1048576), processPeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024), sourceBytes: source.length, acceptedBytes: result.original.length + result.derivatives.reduce((n, d) => n + d.bytes.length, 0) })}`,
  );
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(".scratch", { recursive: true });
  await writeFile(
    ".scratch/media-resource-observation.json",
    JSON.stringify(
      {
        elapsedMs: Math.round(performance.now() - start),
        rssBeforeMiB: Math.round(before / 1048576),
        rssAfterMiB: Math.round(process.memoryUsage().rss / 1048576),
        processPeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
        sourceBytes: source.length,
        acceptedBytes:
          result.original.length +
          result.derivatives.reduce((n, d) => n + d.bytes.length, 0),
      },
      null,
      2,
    ),
  );
}, 15000);
test("0.4.3b H2 audio headers, timing, samples, offsets and external references reject", async () => {
  const wav = silenceWav();
  wav.writeUInt32LE(123, 28);
  await assert.rejects(
    () => validatePrivateMedia(wav, "audio/wav"),
    MediaContentRejected,
  );
  const mp3 = silenceMp3();
  mp3[4] = 255;
  await assert.rejects(
    () => validatePrivateMedia(mp3, "audio/mpeg"),
    MediaContentRejected,
  );
  const invalidPairs = silenceMp3();
  invalidPairs[8] = 255;
  invalidPairs[9] = 128;
  await assert.rejects(
    () => validatePrivateMedia(invalidPairs, "audio/mpeg"),
    MediaContentRejected,
  );
  for (const name of [
    "mvhd",
    "tkhd",
    "mdhd",
    "soun",
    "mp4a",
    "stsz",
    "stsc",
    "stco",
    "stts",
  ]) {
    const bytes = silenceM4a(),
      position = bytes.indexOf(Buffer.from(name));
    assert(position > 0);
    bytes.write("xxxx", position);
    await assert.rejects(
      () => validatePrivateMedia(bytes, "audio/mp4"),
      MediaContentRejected,
    );
  }
  const offset = silenceM4a();
  offset.writeUInt32BE(1, offset.indexOf(Buffer.from("stco")) + 12);
  await assert.rejects(
    () => validatePrivateMedia(offset, "audio/mp4"),
    MediaContentRejected,
  );
});
test("0.4.3b H1/H3 native sharp pin rotates and strips every output; creates bounded immutable variant candidates", async () => {
  const source = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: "white" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Orientation: "6" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "13/1 0/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "80/1 0/1 0/1",
      },
    })
    .toBuffer();
  const before = await sharp(source).metadata();
  assert(before.exif);
  const output = await validatePrivateMedia(source, "image/jpeg");
  const original = await sharp(output.original).metadata();
  assert.equal(original.width, 1200);
  assert.equal(original.height, 1800);
  for (const bytes of [
    output.original,
    ...output.derivatives.map((d) => d.bytes),
  ]) {
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.equal(metadata.orientation, undefined);
  }
  assert.equal(output.derivatives.length, 2);
  for (const derivative of output.derivatives) {
    const edge = derivative.variant === "thumbnail" ? 320 : 1600;
    assert(derivative.width <= edge && derivative.height <= edge);
    assert.equal((await sharp(derivative.bytes).metadata()).format, "webp");
  }
  for (const type of ["image/png", "image/webp"]) {
    const source = await sharp({
      create: { width: 30, height: 20, channels: 3, background: "white" },
    })
      [type === "image/png" ? "png" : "webp"]()
      .toBuffer();
    assert.equal(
      (await validatePrivateMedia(source, type)).derivatives.length,
      2,
    );
  }
  await assert.rejects(
    () => validatePrivateMedia(source, "image/png"),
    MediaContentRejected,
  );
  await assert.rejects(
    () =>
      validatePrivateMedia(Buffer.alloc(20 * 1024 * 1024 + 1), "image/jpeg"),
    MediaContentRejected,
  );
  const bomb = await sharp({
    create: { width: 6400, height: 6400, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () => validatePrivateMedia(bomb, "image/png"),
    MediaContentRejected,
  );
  await assert.rejects(
    () =>
      validatePrivateMedia(
        source.subarray(0, source.length - 20),
        "image/jpeg",
      ),
    MediaContentRejected,
  );
});
