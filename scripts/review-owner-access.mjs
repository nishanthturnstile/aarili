// Local, synthetic-only review host. No deployed fixture route or seeded account.
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const directory = resolve(".scratch/access-review");
const privateFile = resolve(directory, "private.json");
const stopFile = resolve(directory, "stop");
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(stopFile, "stop");
  console.info(
    "Local owner review stop requested; its web process and disposable database will be cleaned up.",
  );
} else {
  const lockFile = resolve(directory, "host.lock");
  const lock = await open(lockFile, "wx").catch(() => {
    throw new Error(
      "A review host is already running or its lock needs inspection. Stop that host before starting another.",
    );
  });
  await lock.close();
  await rm(stopFile, { force: true });
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(async ({ origin, setupToken, code }) => {
      const access = {
        origin,
        setupToken,
        verificationCode: "",
        resetCode: "",
        note: "Synthetic only. Choose a synthetic email/password on /setup. Latest local email codes appear here. This file is removed when stopped.",
      };
      await writeFile(privateFile, JSON.stringify(access, null, 2), {
        mode: 0o600,
      });
      console.info(`Owner access review ready: ${origin}/setup`);
      console.info(
        "Private setup token and local email codes: .scratch/access-review/private.json (never copy into Git/chat).",
      );
      console.info("Stop: node scripts/review-owner-access.mjs stop");
      while (!stopping) {
        if (
          await readFile(stopFile, "utf8").then(
            () => true,
            () => false,
          )
        )
          break;
        let changed = false;
        for (const [purpose, field] of [
          ["verification", "verificationCode"],
          ["reset", "resetCode"],
        ]) {
          const latest = await code(purpose).catch(() => "");
          if (latest && latest !== access[field]) {
            access[field] = latest;
            changed = true;
          }
        }
        if (changed)
          await writeFile(privateFile, JSON.stringify(access, null, 2), {
            mode: 0o600,
          });
        await delay(500);
      }
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await rm(privateFile, { force: true });
    await rm(stopFile, { force: true });
    await rm(lockFile, { force: true });
  }
}
