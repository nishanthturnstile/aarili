import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withMediaWeb } from "./test-support/media-web.mjs";
import { withQuotationIssues } from "./test-support/quotation-issue-fixtures.mjs";

const directory = resolve(".scratch/quotation-issues-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Quotation issue review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });
  try {
    await withMediaWeb(
      async (f) => {
        await writeFile(
          file("private.json"),
          JSON.stringify({
            url: f.origin,
            email: f.privateOwnerAccess.email,
            password: f.privateOwnerAccess.password,
          }),
          { mode: 0o600 },
        );
        console.info(
          `Quotation issue review ready: ${f.origin}; private sign-in in .scratch/quotation-issues-review-host/private.json`,
        );
        while (!stopping) {
          try {
            await readFile(file("stop"));
            break;
          } catch {}
          await delay(500);
        }
      },
      { surface: "quotation-issues", fixture: withQuotationIssues },
    );
  } finally {
    await rm(file("private.json"), { force: true });
    await rm(file("host.lock"), { force: true });
    await rm(file("stop"), { force: true });
  }
}
