// Disposable loopback, synthetic-only A2 review. No live provider or messages.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  emptyEstimate,
  emptyEstimateLine,
} from "@aarili/contracts/garment-estimates";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import {
  draftUuid,
  seedQuotationSources,
} from "./test-support/quotation-rate-fixtures.mjs";

const directory = resolve(".scratch/garment-estimates-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Garment estimate review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const email = "estimate-review@example.test",
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
          { shopName: "SYNTHETIC garment estimates" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shopId } = await request("/owner/shop");
        await seedQuotationSources(runtime, shopId);
        const draftId = draftUuid(),
          payload = emptyEstimate(randomUUID());
        payload.pricingDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        payload.reason = "SYNTHETIC incomplete estimate for review";
        payload.assumptions =
          "SYNTHETIC blouse labour unknown; customer fabric excluded; complimentary hooks keep private estimated labour cost.";
        const blouse = {
          ...emptyEstimateLine(randomUUID()),
          labelEn: "SYNTHETIC blouse labour",
          labelTa: "செயற்கை ரவிக்கை வேலை",
          quantityText: "1",
        };
        const fabric = {
          ...emptyEstimateLine(randomUUID()),
          labelEn: "SYNTHETIC customer fabric",
          labelTa: "செயற்கை வாடிக்கையாளர் துணி",
          component: "fabric",
          material: "customer",
          state: "excluded",
          reason: "Customer property ? no shop stock charge",
        };
        const hooks = {
          ...emptyEstimateLine(randomUUID()),
          labelEn: "SYNTHETIC complimentary hooks",
          labelTa: "செயற்கை இலவச கொக்கிகள்",
          state: "complimentary",
          quantityText: "1",
          reason: "Synthetic owner complimentary work",
        };
        payload.lines = [blouse, fabric, hooks];
        payload.privateCosts = [
          {
            lineId: hooks.id,
            amountText: "25.01",
            reason: "SYNTHETIC private estimated labour",
          },
        ];
        const seeded = await seedCommand(
          new Request(`${origin}/api/shops/${shopId}/drafts/${draftId}`, {
            method: "PUT",
            headers: {
              Origin: origin,
              Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              "Content-Type": "application/json",
              "Idempotency-Key": randomUUID(),
            },
            body: JSON.stringify({
              workflow: "pricing.estimate",
              schemaVersion: 1,
              payload,
            }),
          }),
        );
        if (!seeded.ok) throw Error("Synthetic estimate seed failed");
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin,
            url: `${origin}/orders?section=estimates&estimateDraft=${draftId}`,
            email,
            password,
            shopId,
          }),
          { mode: 0o600 },
        );
        console.info(
          `Garment estimate review ready: ${origin}/orders?section=estimates&estimateDraft=${draftId}; private sign-in in .scratch/garment-estimates-review-host/private.json`,
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
