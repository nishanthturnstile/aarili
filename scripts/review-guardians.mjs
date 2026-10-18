// Disposable loopback synthetic review. Credentials never enter published files.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const { v7 } = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
)("uuid");
const directory = resolve(".scratch/guardian-review-host");
const privateFile = resolve(directory, "private.json");
const stopFile = resolve(directory, "stop");
const lockFile = resolve(directory, "host.lock");
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(stopFile, "stop");
  console.info(
    "Guardian review stop requested; disposable database and private access will be removed.",
  );
} else {
  const lock = await open(lockFile, "wx");
  await lock.close();
  await rm(stopFile, { force: true });
  const email = "guardian-review@example.test";
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
          if (response.status === 429 && retry < 2) {
            const seconds = Number(response.headers.get("Retry-After"));
            await delay(
              (Number.isFinite(seconds)
                ? Math.max(1, Math.min(seconds, 60))
                : 60) *
                1000 +
                100,
            );
            return request(path, body, extra, method, retry + 1);
          }
          if (!response.ok)
            throw Error(
              `Synthetic guardian review setup failed (${response.status})`,
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
          { shopName: "Synthetic guardian review" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shopId } = await request("/owner/shop");
        const customerPolicy = await request(
          `/shops/${shopId}/customers/policy`,
        );
        const occurredAt = new Date(Date.now() - 60000).toISOString();
        const aunt = await request(
          `/shops/${shopId}/customers`,
          {
            displayName: "செயற்கை அத்தை மீனா — Synthetic aunt",
            phone: "+1 202 555 0101",
            serviceEvidence: {
              noticeId: customerPolicy.notice.id,
              language: "ta",
              decision: "grant",
              giver: "self",
              noticeExplained: true,
              source: "in-person",
              occurredAt,
            },
          },
          { "Idempotency-Key": randomUUID() },
        );
        const child = await request(
          `/shops/${shopId}/customers/${aunt.customerId}/wearers`,
          {
            mode: "new",
            displayName: "செயற்கை சிறார் காவியா — Synthetic child",
            age: "minor",
            preferences: {
              language: "தமிழ்",
              channel: "",
              fit: "",
              style: "",
              delivery: "",
              source: "Synthetic family statement",
            },
            relationship: {
              kind: "family",
              statementByPersonId: aunt.personId,
              authorised: true,
              informed: true,
              source: "in-person",
              occurredAt,
              interaction:
                "Synthetic aunt arranging a child's tailoring service; aunt is not the guardian",
            },
          },
          { "Idempotency-Key": randomUUID() },
        );
        const guardianPath = `/shops/${shopId}/customers/${aunt.customerId}/wearers/${child.wearerId}/guardians`;
        await request(
          guardianPath,
          {
            guardian: {
              mode: "new",
              displayName: "செயற்கை பெற்றோர் லதா — Synthetic parent",
            },
            authority: "parent",
            scope: "measurement-and-private-photo",
            source: "in-person",
            occurredAt,
          },
          {
            "Idempotency-Key": randomUUID(),
            "If-Match": `"v${child.version}"`,
          },
        );
        const guardian = await request(guardianPath);
        const policy = await request(`/shops/${shopId}/guardians/policy`);
        const draftId = v7();
        const draft = await request(
          `/shops/${shopId}/drafts/${draftId}`,
          {
            workflow: "wearer.guardian",
            schemaVersion: 1,
            payload: {
              synthetic: true,
              noticeId: policy.notice.id,
              customerId: aunt.customerId,
              customerVersion: 1,
              wearerId: child.wearerId,
              wearerVersion: guardian.version,
              claim: {
                guardian: {
                  mode: "existing",
                  personId: guardian.authority.personId,
                },
                authority: "parent",
                scope: "measurement-and-private-photo",
                source: "phone",
                occurredAt,
              },
            },
          },
          { "Idempotency-Key": randomUUID() },
          "PUT",
        );
        const reviewUrl = `${origin}/customers/${aunt.customerId}`;
        await writeFile(
          privateFile,
          JSON.stringify(
            {
              origin,
              email,
              password,
              shopId,
              aunt,
              child,
              guardian,
              draft,
              reviewUrl,
              note: "Synthetic only. Select the child, review pending parent authority, record the invented synthetic verification reference, then test the separate purpose decisions. The aunt is not the guardian. Never copy these credentials to Git or chat.",
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
        console.info(`Guardian review ready: ${reviewUrl}`);
        console.info(
          "Private sign-in: .scratch/guardian-review-host/private.json. Stop: node scripts/review-guardians.mjs stop",
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
