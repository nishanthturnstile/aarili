import assert from "node:assert/strict";
import {
  documentIssueSchema,
  documentLocatorSchema,
} from "@aarili/contracts/documents";
import {
  createDocumentRenderer,
  documentFonts,
  documentTemplates,
  escapeDocumentText,
} from "@aarili/documents";
import { createDocumentRuntime } from "@aarili/jobs/document-runtime";
import { productionJobComposition } from "@aarili/jobs/production";
import { test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";
import {
  syntheticDocumentTemplates,
  tamilGoldenStrings,
} from "../scripts/test-support/document-template.mjs";

const id = "019a5e59-1111-7000-8000-000000000001";
test("0.4.4a I1/I3 immutable registry fingerprints change with code, font assets hash-check, unknown templates fail before native launch", async () => {
  const registry = await syntheticDocumentTemplates(),
    first = await registry.resolve("synthetic.document", 1),
    fonts = await documentFonts();
  assert.equal(first.fontRevision, fonts.revision);
  assert.equal(Object.keys(fonts.files).length, 4);
  assert.equal(tamilGoldenStrings.length, 50);
  const changed = documentTemplates([
    { ...first, body: () => "<p>changed source under same version</p>" },
  ]);
  assert.notEqual(
    (await changed.resolve("synthetic.document", 1)).templateHash,
    first.templateHash,
  );
  const r = createDocumentRenderer(changed);
  try {
    await assert.rejects(
      () =>
        r.render({
          docId: id,
          revision: 1,
          template: first.id,
          templateRevision: first.revision,
          language: "ta",
          paper: "A4",
          model: { title: "test", lines: [] },
          fontRevision: fonts.revision,
          templateHash: first.templateHash,
          modelHash: "0".repeat(64),
        }),
      /TEMPLATE_UNAVAILABLE/,
    );
    assert.equal(r.observation().launches, 0);
  } finally {
    await r.close();
  }
  assert.equal(
    escapeDocumentText("<script>\"&'</script>"),
    "&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;",
  );
});
test("0.4.4a I1/I5 minimal locator, explicit defaults, no renderer/template activation in ordinary registry", async () => {
  const input = {
    docId: id,
    revision: 1,
    template: "synthetic.document",
    templateRevision: 1,
    language: "ta",
    model: { title: "sample", lines: [] },
  };
  assert.equal(documentIssueSchema.parse(input).paper, "A4");
  assert.equal(
    documentIssueSchema.safeParse({ ...input, url: "file:///private" }).success,
    false,
  );
  assert.equal(
    documentLocatorSchema.safeParse({
      shopId: id,
      docId: id,
      revision: 1,
      jobId: id,
      initiatorId: id,
      epoch: id,
      model: { content: "not a locator" },
    }).success,
    false,
  );
  const c = productionJobComposition();
  const native = createDocumentRuntime(() => {
    throw Error("Unconfigured synthetic adapter");
  }, documentTemplates());
  try {
    const composed = productionJobComposition(undefined, native);
    assert.equal((await composed.status()).privateDocuments, "composed");
    assert.equal(native.renderer.observation().launches, 0);
    await composed.close();
    assert.equal(native.renderer.observation().connected, false);
  } finally {
    await native.close();
  }
  assert.deepEqual([...c.handlers.keys()], ["pdf.render", "media.process"]);
  assert.equal(
    await c.handlers.get("pdf.render")(
      null,
      { html: "<script/>" },
      async () => {},
    ),
    "ignored",
  );
  await assert.rejects(
    () =>
      c.handlers.get("pdf.render")(
        null,
        {
          shopId: id,
          docId: id,
          revision: 1,
          jobId: id,
          initiatorId: id,
          epoch: id,
        },
        async () => {},
      ),
    /adapter unavailable/,
  );
});
test("0.4.4a I3/I4 renderer and storage stay outside browser and framework-free core graphs", () => {
  assert(
    checkBoundaries(
      new Map([
        [
          "packages/documents/src/invalid.ts",
          'import {createDatabase} from "@aarili/db";export {createDatabase};',
        ],
      ]),
    ).length > 0,
  );
  for (const dependency of [
    "@aarili/documents",
    "@aarili/platform/document-storage",
    "@aarili/jobs/documents",
    "@aarili/db/document-repository",
  ])
    assert(
      checkBoundaries(
        new Map([
          [
            "apps/web/src/app/invalid.ts",
            `import * as server from "${dependency}";export {server};`,
          ],
        ]),
      ).length > 0,
    );
  assert(
    checkBoundaries(
      new Map([
        [
          "packages/core/src/invalid.ts",
          'import {chromium} from "playwright-core";export {chromium};',
        ],
      ]),
    ).length > 0,
  );
});
