// Disposable loopback review, using the existing synthetic-only auth host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const directory = resolve(".scratch/shop-directory-review-host"),
  privateFile = resolve(directory, "private.json"),
  stopFile = resolve(directory, "stop"),
  lockFile = resolve(directory, "host.lock");
await mkdir(directory, { recursive: true });
if (process.argv[2] === "expire") {
  await writeFile(resolve(directory, "expire"), "expire");
  console.info("Synthetic authentication expiry requested.");
} else if (process.argv[2] === "stop") {
  await writeFile(stopFile, "stop");
  console.info(
    "Shop directory review stop requested; disposable data/private access will be removed.",
  );
} else {
  const lock = await open(lockFile, "wx");
  await lock.close();
  await rm(stopFile, { force: true });
  const email = "shop-directory-review@example.test",
    password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, expireAuthentication }) => {
        const cookies = new Map();
        async function request(
          path,
          body,
          extra = {},
          method = body ? "POST" : "GET",
          retry = 0,
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
          if (response.status === 429 && retry < 2) {
            const seconds = Math.max(
              1,
              Math.min(60, Number(response.headers.get("Retry-After") ?? 60)),
            );
            await response.arrayBuffer();
            await delay(seconds * 1000 + 100);
            return request(path, body, extra, method, retry + 1);
          }
          if (!response.ok)
            throw Error(
              `SYNTHETIC directory review setup failed (${response.status})`,
            );
          return response.json();
        }
        await request(
          "/owner/setup",
          { name: "SYNTHETIC review owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC directory review" },
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
        const fixtureContents = [
          { kind: "methods", enabled: ["cash", "upi", "bank"] },
          {
            kind: "account",
            label: "SYNTHETIC family UPI",
            active: true,
            method: "upi",
            recipient: "family",
            upiId: "synthetic@invalid",
            bankName: "",
            accountHolder: "",
            accountNumber: "",
            ifsc: "",
          },
          {
            kind: "account",
            label: "SYNTHETIC owner bank",
            active: true,
            method: "bank",
            recipient: "owner",
            upiId: "",
            bankName: "SYNTHETIC bank",
            accountHolder: "SYNTHETIC owner",
            accountNumber: "000000000086",
            ifsc: "TEST0000086",
          },
          {
            kind: "vendor",
            label: "SYNTHETIC artisan and supplier",
            active: true,
            phone: "",
            capability: "SYNTHETIC Aari / materials",
            artisan: true,
            supplier: true,
          },
        ];
        for (const content of fixtureContents) {
          const v = randomUUID();
          const draftId = `${v.slice(0, 14)}7${v.slice(15)}`;
          await request(
            `/shops/${shopId}/drafts/${draftId}`,
            {
              workflow: "shop.directory",
              schemaVersion: 1,
              payload: {
                entryId: randomUUID(),
                baseVersion: 0,
                baseRevisionId: null,
                content,
              },
            },
            { "Idempotency-Key": randomUUID() },
            "PUT",
          );
          await request(
            `/shops/${shopId}/drafts/${draftId}/promote`,
            {},
            { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
          );
        }
        await writeFile(
          privateFile,
          JSON.stringify({
            origin,
            email,
            password,
            url: `${origin}/settings?section=directory`,
          }),
          { mode: 0o600 },
        );
        console.info(
          `Shop directory review ready: ${origin}/settings?section=directory`,
        );
        console.info(
          "Private sign-in is in .scratch/shop-directory-review-host/private.json; do not publish it.",
        );
        while (!stopping) {
          try {
            await readFile(resolve(directory, "expire"));
            await expireAuthentication();
            await rm(resolve(directory, "expire"));
          } catch {}

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
