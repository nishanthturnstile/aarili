// Disposable loopback review only: actual policies, PG, S3, worker and shipping UI.
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  designOk,
  promoteDesign,
} from "./test-support/design-choices-fixtures.mjs";
import {
  admitReference,
  processReference,
  publishSource,
  referenceItem,
  saveReferenceSpecification,
  sourceDraft,
  withDesignReferences,
} from "./test-support/design-reference-fixtures.mjs";
import { blankPdf, silenceMp3 } from "./test-support/media-formats.mjs";
import { withMediaWeb } from "./test-support/media-web.mjs";

const directory = resolve(".scratch/design-references-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Design-reference review stop requested.");
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
            signInUrl: `${f.origin}/sign-in`,
            email: "a@example.test",
            password: "synthetic-isolation-password-15",
            url: f.origin,
            shopId: f.a.shop,
            cookie: f.a.cookie,
            orderId: f.target.order.id,
            pieceId: f.pieceId,
            profileId: f.s.profile.entryId,
          }),
          { mode: 0o600 },
        );
        console.info(`Design-reference review ready: ${f.origin}`);
        console.info(
          `Private access: ${file("private.json")} (never publish).`,
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
        surface: "design-references",
        fixture: (run) =>
          withDesignReferences(async (f) => {
            const sharp = createRequire(
                new URL("../packages/platform/package.json", import.meta.url),
              )("sharp"),
              privateSource = await publishSource(f),
              library = await publishSource(f, sourceDraft(f, "library")),
              items = [];
            for (const [type, bytes, s] of [
              [
                "image/jpeg",
                await sharp({
                  create: {
                    width: 320,
                    height: 240,
                    channels: 3,
                    background: "white",
                  },
                })
                  .jpeg()
                  .toBuffer(),
                privateSource.subject,
              ],
              ["application/pdf", blankPdf(), library.subject],
              ["audio/mpeg", silenceMp3(), library.subject],
            ]) {
              const grant = await admitReference(f, s, bytes, type);
              await processReference(f, grant);
              items.push(
                referenceItem(grant.asset.id, f.value.answers[0].questionId, {
                  caption: `SYNTHETIC ${type} reference`,
                }),
              );
            }
            await promoteDesign(
              f,
              await saveReferenceSpecification(f, {
                ...f.value,
                referenceItems: items,
              }),
              randomUUID(),
            ).then(designOk);
            await run(f);
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
