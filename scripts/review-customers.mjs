// Disposable loopback review host; no deployed fixture route or real records.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const directory = resolve(".scratch/customer-review-host");
const privateFile = resolve(directory, "private.json");
const stopFile = resolve(directory, "stop");
const lockFile = resolve(directory, "host.lock");
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(stopFile, "stop");
  console.info(
    "Customer review stop requested; disposable database and private access will be removed.",
  );
} else {
  const lock = await open(lockFile, "wx");
  await lock.close();
  await rm(stopFile, { force: true });
  const email = "customer-review@example.test";
  const password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code }) => {
        const cookies = new Map();
        async function request(path, body, extra = {}) {
          const response = await fetch(`${origin}/api${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              Cookie: [...cookies]
                .map(([key, value]) => `${key}=${value}`)
                .join("; "),
              ...extra,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(";")[0],
              split = pair.indexOf("=");
            cookies.set(pair.slice(0, split), pair.slice(split + 1));
          }
          if (!response.ok)
            throw Error(
              `Synthetic customer review setup failed (${response.status})`,
            );
          return response.json();
        }
        await request(
          "/owner/setup",
          { name: "Synthetic review owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "Synthetic Aarili review" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shopId } = await request("/owner/shop");
        const { notice } = await request(`/shops/${shopId}/customers/policy`);
        const customers = [];
        for (const [displayName, aliases] of [
          ["மீனா Meena", ["Meenaa"]],
          ["Synthetic second person", ["Second"]],
        ]) {
          customers.push(
            await request(
              `/shops/${shopId}/customers`,
              {
                displayName,
                aliases,
                phone: "+1 202 555 0101",
                serviceEvidence: {
                  noticeId: notice.id,
                  language: "ta",
                  decision: "grant",
                  giver: "self",
                  noticeExplained: true,
                  source: "in-person",
                  occurredAt: new Date().toISOString(),
                },
              },
              { "Idempotency-Key": randomUUID() },
            ),
          );
        }
        await writeFile(
          privateFile,
          JSON.stringify(
            {
              origin,
              email,
              password,
              customers,
              note: "Synthetic only. Sign in using these ephemeral details; never copy them into Git or chat.",
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
        console.info(`Customer review ready: ${origin}/customers`);
        console.info(
          "Private sign-in: .scratch/customer-review-host/private.json. Stop: node scripts/review-customers.mjs stop",
        );
        while (!stopping) {
          if (
            await readFile(stopFile, "utf8").then(
              () => true,
              () => false,
            )
          )
            break;
          await delay(500);
        }
      },
      { secrets: [password] },
    );
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await rm(privateFile, { force: true });
    await rm(stopFile, { force: true });
    await rm(lockFile, { force: true });
  }
}
