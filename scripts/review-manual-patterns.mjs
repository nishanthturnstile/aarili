// Disposable loopback host: synthetic order, actual UI/API, no uploaded output.
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
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

const directory = resolve(".scratch/manual-pattern-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv.at(-1) === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Manual pattern review stop requested.");
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
    await withPatternWeb(async (f) => {
      const p = {
        ...f,
        scope: {
          orderId: f.target.order.id,
          pieceId: f.target.pieces.identities[0].id,
        },
      };
      await publishPatternCapability(p);
      await publishPattern(p, await physicalPattern(p));
      const original = (await patternPage(p)).state.latestSavedId;
      await publishPattern(p, await referenceAction(p, original, "review"));
      await publishPattern(p, await referenceAction(p, original, "select"));
      const revision = await physicalPattern(p);
      revision.content.locator = "Cabinet B / folder 13";
      revision.reason =
        "SYNTHETIC reasoned locator revision; earlier selection preserved";
      await publishPattern(p, revision);
      await writeFile(
        file("private.json"),
        JSON.stringify({
          origin: f.origin,
          url: `${f.origin}/sign-in`,
          email: "a@example.test",
          password: "synthetic-isolation-password-15",
          pieceId: p.scope.pieceId,
          originalReferenceId: original,
          latestReferenceId: (await patternPage(p)).state.latestSavedId,
        }),
        { mode: 0o600 },
      );
      console.info(
        `Synthetic manual pattern review ready: ${f.origin}/sign-in`,
      );
      while (!stopping) {
        try {
          await readFile(file("stop"));
          break;
        } catch {}
        await delay(500);
      }
    });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    for (const name of ["private.json", "stop", "host.lock"])
      await rm(file(name), { force: true });
  }
}
