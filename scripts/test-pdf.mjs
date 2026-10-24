import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  command,
  documentRunArguments,
  ensureDocumentImage,
} from "./document-runtime-image.mjs";

const image = await ensureDocumentImage(),
  name = `aarili59-pdf-proof-${randomUUID()}`;
const output = resolve(`.scratch/pdf-proof-${randomUUID()}`);
await mkdir(output, { recursive: true });
await chmod(output, 0o777);
try {
  await command([
    "run",
    "--name",
    name,
    ...documentRunArguments,
    "--mount",
    `type=bind,source=${output},target=/proof`,
    image,
  ]);
} finally {
  await command(["rm", "--force", name], undefined, true);
}
const evidence = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
assert.equal(evidence.sandbox.uid, 1000);
assert.match(evidence.sandbox.report, /adequately sandboxed/);
const golden = resolve("tests/goldens/documents"),
  update = process.argv.includes("--update");
const files = (await readdir(output))
  .filter((x) =>
    /^(A3|A4|JS-en|JS-ta|LBL-en-[189]|LBL-ta-[189]|QT-(?:en|ta)-(?:single|package|long))-\d+\.png$/.test(
      x,
    ),
  )
  .sort();
assert(files.length >= 4);
const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
for (const file of files) {
  const actual = `${output}/${file}`,
    reference = `${golden}/${file}`;
  if (update) {
    await mkdir(golden, { recursive: true });
    await cp(actual, reference);
    continue;
  }
  const a = await sharp(actual)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const b = await sharp(reference)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(a.info.width, b.info.width, `PDF golden width ${file}`);
  assert.equal(a.info.height, b.info.height, `PDF golden height ${file}`);
  assert.equal(a.data.length, b.data.length);
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 3)
    if (
      Math.max(
        ...[0, 1, 2].map((n) => Math.abs(a.data[i + n] - b.data[i + n])),
      ) > 24
    )
      changed++;
  const ratio = changed / (a.info.width * a.info.height);
  assert(
    ratio <= 0.001,
    `PDF golden differs ${file}: ${(ratio * 100).toFixed(3)}% pixels`,
  );
}
if (!update)
  assert.deepEqual(
    (await readdir(golden)).filter((x) => x.endsWith(".png")).sort(),
    files,
    "PDF page-count golden drift",
  );
await writeFile(
  ".scratch/pdf59-latest-proof.json",
  JSON.stringify({ image, output, files, evidence }, null, 2),
);
console.info(
  `0.4.4a I3/I4/I5/I9 Linux sandbox + 50 synthetic strings, ${files.length} A4/A3 PDF page goldens ${update ? "generated as review candidates" : "passed"}; fluent Tamil review deferred.`,
);
