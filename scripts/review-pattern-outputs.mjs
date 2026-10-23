// Synthetic loopback host with actual private processing and owner components.
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  patternPage,
  physicalPattern,
  publishPattern,
  publishPatternCapability,
  referenceAction,
} from "./test-support/manual-pattern-fixtures.mjs";
import { withPatternWeb } from "./test-support/manual-pattern-web.mjs";
import {
  admitPatternOutput,
  outputDraft,
  publishOutput,
  publishPatternSubject,
  samplePatternPdf,
} from "./test-support/pattern-output-fixtures.mjs";

const sharp = createRequire(
  new URL("../packages/platform/package.json", import.meta.url),
)("sharp");
const directory = resolve(".scratch/pattern-output-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv.at(-1) === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Pattern output review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withPatternWeb(
      async (f) => {
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin: f.origin,
            url: `${f.origin}/sign-in`,
            email: "a@example.test",
            password: "synthetic-isolation-password-15",
            ...f.patternReview,
          }),
          { mode: 0o600 },
        );
        console.info(
          `Synthetic pattern output review ready: ${f.origin}/sign-in`,
        );
        while (!stopping) {
          try {
            await readFile(file("stop"));
            break;
          } catch {}
          await delay(500);
        }
      },
      {
        photo: true,
        seed: async (f) => {
          const pieceId = f.target.pieces.identities.find(
              (p) => p.key === f.sources.top.definition.content.code,
            ).id,
            p = { ...f, scope: { orderId: f.target.order.id, pieceId } };
          await publishPatternCapability(p);
          const physical = await physicalPattern(p);
          physical.content.rights = "private-fulfilment";
          await publishPattern(p, physical);
          const original = (await patternPage(p)).state.latestSavedId;
          await publishPattern(p, await referenceAction(p, original, "review"));
          await publishPattern(p, await referenceAction(p, original, "select"));
          await publishPattern(
            p,
            await physicalPattern(p, {
              content: {
                ...physical.content,
                locator: "Cabinet B / folder 13",
              },
            }),
          );
          const subject = await publishPatternSubject(p),
            pixels = await sharp({
              create: {
                width: 640,
                height: 480,
                channels: 3,
                background: "white",
              },
            })
              .composite([
                {
                  input: Buffer.from(
                    '<svg width="640" height="480"><text x="40" y="110" font-size="30" fill="black">SYNTHETIC SHOP SKETCH</text><text x="40" y="160" font-size="26" fill="black">SCALE UNVERIFIED</text><path d="M160 240 L280 210 L390 240 L350 410 L200 410 Z" fill="none" stroke="black" stroke-width="3"/></svg>',
                  ),
                },
              ])
              .jpeg()
              .toBuffer();
          const sketch = await admitPatternOutput(p, subject, pixels);
          await f.process(sketch, await f.complete(sketch));
          const imageValue = await outputDraft(p, sketch.asset.id);
          imageValue.content.rights = "shop-owned";
          imageValue.content.rightsEvidence =
            "SYNTHETIC shop-created non-body drawing, reusable rights recorded";
          await publishOutput(p, imageValue);
          const imageId = (await patternPage(p)).state.latestSavedId;
          await publishPattern(p, await referenceAction(p, imageId, "review"));
          await publishPattern(p, await referenceAction(p, imageId, "select"));
          const pdf = await admitPatternOutput(
            p,
            subject,
            samplePatternPdf(),
            "application/pdf",
          );
          await f.process(pdf, await f.complete(pdf));
          const pdfValue = await outputDraft(p, pdf.asset.id);
          pdfValue.method = "external";
          pdfValue.content.sourceKind = "external-supplier";
          pdfValue.content.source = "SYNTHETIC external source";
          pdfValue.content.sourceVersion = "SYNTHETIC R2";
          pdfValue.content.measurement = {
            state: "known",
            versionId: f.version.id,
          };
          await publishOutput(p, pdfValue);
          const pdfId = (await patternPage(p)).state.latestSavedId;
          const failed = await admitPatternOutput(
            p,
            subject,
            Buffer.from("SYNTHETIC rejected non-image fixture"),
          );
          await f.process(failed, await f.complete(failed));
          const sourceOrder = await f.sources.accept(),
            sourcePiece = sourceOrder.pieces.identities.find(
              (q) => q.key === f.sources.top.definition.content.code,
            ).id,
            source = {
              ...f,
              scope: { orderId: sourceOrder.order.id, pieceId: sourcePiece },
            };
          await publishPattern(
            source,
            await physicalPattern(source, {
              content: {
                ...physical.content,
                locator: "SYNTHETIC reusable source / cabinet C",
              },
            }),
          );
          f.patternReview = {
            orderId: p.scope.orderId,
            pieceId,
            originalReferenceId: original,
            selectedSketchId: imageId,
            unselectedPdfId: pdfId,
            sourceReferenceId: (await patternPage(source)).state.latestSavedId,
            sourceOrderId: source.scope.orderId,
            failedAssetId: failed.asset.id,
          };
        },
      },
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    for (const name of ["private.json", "stop", "host.lock"])
      await rm(file(name), { force: true });
  }
}
