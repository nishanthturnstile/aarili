// Disposable loopback, synthetic-only A1 review. No live provider or messages.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { emptyPolicy } from "@aarili/contracts/shop-policies";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import {
  draftUuid,
  seedQuotationSources,
} from "./test-support/quotation-rate-fixtures.mjs";

const directory = resolve(".scratch/quotation-rates-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Quotation rate review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const email = "quotation-review@example.test",
    password = randomBytes(24).toString("hex");
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, runtime, seedCommand }) => {
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
          for (const cookie of r.headers.getSetCookie()) {
            const pair = cookie.split(";")[0],
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          if (!r.ok)
            throw Error(`Synthetic quotation setup failed (${r.status})`);
          return r.json();
        }
        await request(
          "/owner/setup",
          { name: "Synthetic rate owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC quotation rates" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shopId } = await request("/owner/shop");
        await seedQuotationSources(runtime, shopId);
        const policy = {
          ...emptyPolicy("quoteValidity"),
          state: "reviewed",
          calendarDays: 7,
          terms: {
            en: "SYNTHETIC seven-day quotation terms — not production policy",
            ta: "செயற்கை ஏழு நாள் விலைப்புள்ளி விதிகள் — நேரடிப் பயன்பாட்டிற்கு அல்ல",
          },
          authority: {
            kind: "owner-proposal",
            label: "SYNTHETIC review proposal",
          },
        };
        const seeded = await seedCommand(
          new Request(`${origin}/api/shops/${shopId}/drafts/${draftUuid()}`, {
            method: "PUT",
            headers: {
              Origin: origin,
              Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              "Content-Type": "application/json",
              "Idempotency-Key": randomUUID(),
            },
            body: JSON.stringify({
              workflow: "shop.policies",
              schemaVersion: 1,
              payload: { baseVersion: 0, baseRevisionId: null, policy },
            }),
          }),
        );
        if (!seeded.ok) throw Error("Synthetic policy seed failed");
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin,
            url: `${origin}/settings?section=rates`,
            email,
            password,
            shopId,
          }),
          { mode: 0o600 },
        );
        console.info(
          `Quotation rate review ready: ${origin}/settings?section=rates; private sign-in in .scratch/quotation-rates-review-host/private.json`,
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
