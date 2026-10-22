// Disposable loopback review: synthetic records, private access file, no outbound mail.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  designRef,
  designScenarios,
  designSources,
  publishDesign,
} from "./test-support/design-choices-fixtures.mjs";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const directory = resolve(".scratch/design-choices-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Design-choice review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "design-review@example.test",
    password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, seedCommand }) => {
        const cookies = new Map();
        async function request(path, body, extra = {}) {
          const r = await fetch(`${origin}/api${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              ...extra,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          for (const c of r.headers.getSetCookie()) {
            const pair = c.split(";")[0],
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          if (!r.ok) throw Error(`Synthetic review setup failed (${r.status})`);
          return r.json();
        }
        await request(
          "/owner/setup",
          { name: "SYNTHETIC Design owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Design choices" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shop } = await request("/owner/entry");
        const fixture = {
          a: {
            shop: shop.shopId,
            cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          },
          owner: { origin },
          api: { fetch: seedCommand },
        };
        const base = await designSources(fixture);
        base.profile.content.questions[1].when = [
          {
            questionId: base.profile.content.questions[0].id,
            choice: designRef(base.choices[0]),
          },
        ];
        const profile = await publishDesign(fixture, base.profile);
        const scenarios = await designScenarios(fixture, base);
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin,
            email,
            password,
            url: `${origin}/settings?section=design-choices`,
            profileId: profile.entryId,
            choiceIds: base.choices.map((c) => c.entryId),
            scenarios: scenarios.map((s) => ({
              code: s.code,
              profileIds: s.profiles.map((p) => p.entryId),
            })),
          }),
          { mode: 0o600 },
        );
        console.info(
          `Design-choice review ready: ${origin}/settings?section=design-choices`,
        );
        console.info(
          `Private sign-in: ${directory}/private.json (never publish).`,
        );
        while (!stopping) {
          try {
            await readFile(file("stop"));
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
    for (const name of ["private.json", "stop", "host.lock"])
      await rm(file(name), { force: true });
  }
}
