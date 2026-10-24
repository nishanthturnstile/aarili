import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withPaymentWeb } from "./test-support/payment-web.mjs";

const folder = resolve(".scratch/payments-review-host");
await mkdir(folder, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(resolve(folder, "stop"), "requested");
  console.info("Payment review stop requested.");
} else {
  await (await open(resolve(folder, "host.lock"), "wx")).close();
  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });
  try {
    await withPaymentWeb(async (f) => {
      await writeFile(
        resolve(folder, "private.json"),
        JSON.stringify({
          url: f.origin,
          email: "a@example.test",
          password: "synthetic-isolation-password-15",
        }),
        { mode: 0o600 },
      );
      console.info(
        `Synthetic payment review ready: ${f.origin}/payments; private sign-in: .scratch/payments-review-host/private.json`,
      );
      while (!stopping) {
        try {
          await readFile(resolve(folder, "stop"));
          break;
        } catch {}
        await delay(500);
      }
    });
  } finally {
    for (const name of ["private.json", "host.lock", "stop"])
      await rm(resolve(folder, name), { force: true });
  }
}
