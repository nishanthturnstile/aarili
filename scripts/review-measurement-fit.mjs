// Disposable loopback review with labelled non-body images and synthetic access.

import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  admitFitImage,
  fitReferenceDraft,
  fitState,
  publishFitReference,
  publishFitSubject,
  withMeasurementFit,
} from "./test-support/measurement-fit-fixtures.mjs";
import { withMediaWeb } from "./test-support/media-web.mjs";

const directory = resolve(".scratch/measurement-fit-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv.at(-1) === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Private fitting review stop requested.");
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
    await withMediaWeb(
      async (f) => {
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin: f.origin,
            url: `${f.origin}/sign-in`,
            email: "a@example.test",
            password: "synthetic-isolation-password-15",
            measurementVersionId: f.version.id,
            originalReferenceId: f.original.id,
          }),
          { mode: 0o600 },
        );
        console.info(`Private fitting review ready: ${f.origin}/sign-in`);
        console.info(
          `Private synthetic access: ${file("private.json")} (never publish).`,
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
        surface: "measurement-fit",
        fixture: (run) =>
          withMeasurementFit(async (f) => {
            const sharp = createRequire(
                new URL("../packages/platform/package.json", import.meta.url),
              )("sharp"),
              pixels = await sharp({
                create: {
                  width: 320,
                  height: 240,
                  channels: 3,
                  background: "white",
                },
              })
                .composite([
                  {
                    input: Buffer.from(
                      '<svg width="320" height="240"><text x="18" y="100" fill="black" font-size="18">SYNTHETIC PRIVATE</text><text x="18" y="130" fill="black" font-size="18">RESEARCH FIXTURE</text></svg>',
                    ),
                  },
                ])
                .jpeg()
                .toBuffer(),
              subject = await publishFitSubject(f),
              image = await admitFitImage(f, subject, pixels);
            if (
              (await f.process(image, await f.complete(image))) !== "accepted"
            )
              throw Error("Synthetic fitting image was not accepted");
            await publishFitReference(f, {
              ...fitReferenceDraft(f, image.asset.id),
              caption:
                "SYNTHETIC private research fixture — original reference",
            });
            const original = (await fitState(f)).references[0];
            await publishFitReference(f, {
              ...fitReferenceDraft(f, image.asset.id, original),
              caption:
                "SYNTHETIC private research fixture — reviewed replacement",
            });
            const target = await f.sources.accept();
            await run({ ...f, target, original });
          }),
      },
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    for (const name of ["private.json", "stop", "host.lock"])
      await rm(file(name), { force: true });
  }
}
