// Loopback, synthetic-only manual review using the actual owner component,
// membership-bound Hono API, PostgreSQL, private storage and queued renderer.
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withJobSlipWeb } from "./test-support/job-slip-web.mjs";

const directory = resolve(".scratch/job-slip-review-host"),
  file = (n) => resolve(directory, n);
await mkdir(directory, { recursive: true });
if (process.argv.at(-1) === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Job slip review stop requested.");
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
    await withJobSlipWeb(async (f) => {
      await writeFile(
        file("private.json"),
        JSON.stringify({
          origin: f.origin,
          url: `${f.origin}/sign-in`,
          email: "a@example.test",
          password: "synthetic-isolation-password-15",
          orderId: f.scope.orderId,
          pieceId: f.scope.pieceId,
        }),
        { mode: 0o600 },
      );
      console.info(
        `Synthetic job slip review ready: ${f.origin}/sign-in; access details in .scratch/job-slip-review-host/private.json`,
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
    for (const n of ["private.json", "stop", "host.lock"])
      await rm(file(n), { force: true });
  }
}
