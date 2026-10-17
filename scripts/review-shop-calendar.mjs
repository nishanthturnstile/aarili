// Disposable loopback review, using the existing synthetic-only auth host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const directory = resolve(".scratch/shop-calendar-review-host"),
  privateFile = resolve(directory, "private.json"),
  stopFile = resolve(directory, "stop"),
  lockFile = resolve(directory, "host.lock");
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(stopFile, "stop");
  console.info(
    "Shop calendar review stop requested; disposable data/private access will be removed.",
  );
} else {
  const lock = await open(lockFile, "wx");
  await lock.close();
  await rm(stopFile, { force: true });
  const email = "shop-calendar-review@example.test",
    password = randomBytes(24).toString("hex");
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
        async function request(
          path,
          body,
          extra = {},
          method = body ? "POST" : "GET",
        ) {
          const response = await fetch(`${origin}/api${path}`, {
            method,
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              ...extra,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          for (const c of response.headers.getSetCookie()) {
            const pair = c.split(";")[0],
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          if (!response.ok)
            throw Error(
              `Synthetic calendar review setup failed (${response.status})`,
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
          { shopName: "Synthetic calendar review" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shopId } = await request("/owner/shop"),
          path = `/shops/${shopId}/settings/profile`;
        const initial = await request(path);
        await request(
          path,
          {
            ...initial.profile,
            displayName: "Synthetic Aarili review",
            tagline: "Synthetic text branding — தமிழ்",
          },
          {
            "Idempotency-Key": randomUUID(),
            "If-Match": `"v${initial.version}"`,
          },
          "PUT",
        );
        const policy = await request(`/shops/${shopId}/customers/policy`);
        await request(
          `/shops/${shopId}/customers`,
          {
            displayName: "Synthetic preserved customer",
            serviceEvidence: {
              noticeId: policy.notice.id,
              language: "en",
              decision: "grant",
              giver: "self",
              noticeExplained: true,
              source: "in-person",
              occurredAt: new Date(Date.now() - 60000).toISOString(),
            },
          },
          { "Idempotency-Key": randomUUID() },
        );
        await writeFile(
          privateFile,
          JSON.stringify({
            origin,
            email,
            password,
            url: `${origin}/settings`,
          }),
          { mode: 0o600 },
        );
        console.info(`Shop calendar review ready: ${origin}/settings`);
        console.info(
          "Private sign-in is in .scratch/shop-calendar-review-host/private.json; do not publish it.",
        );
        while (!stopping) {
          try {
            await readFile(stopFile);
            break;
          } catch {}
          await delay(500);
        }
      },
      { secrets: [password] },
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await rm(privateFile, { force: true });
    await rm(stopFile, { force: true });
    await rm(lockFile, { force: true });
  }
}
