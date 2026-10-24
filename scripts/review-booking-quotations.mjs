// Disposable loopback, synthetic-only B review. No live provider or messages.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { seedBookingQuotation } from "./test-support/booking-quotation-fixtures.mjs";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { draftUuid } from "./test-support/quotation-rate-fixtures.mjs";

const directory = resolve(".scratch/booking-quotations-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Booking quotation review stop requested.");
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
          { name: "Synthetic quotation owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC quotation proposals" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shopId } = await request("/owner/shop");
        const setup = async (
          path,
          { method = "POST", body, etag, key = randomUUID() } = {},
        ) => {
          const r = await seedCommand(
            new Request(`${origin}/api/shops/${shopId}/${path}`, {
              method,
              headers: {
                Origin: origin,
                Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
                "Content-Type": "application/json",
                "Idempotency-Key": key,
                ...(etag ? { "If-Match": etag } : {}),
              },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
          );
          if (!r.ok)
            throw Error(
              "Synthetic quotation source setup failed: " +
                path +
                " " +
                r.status,
            );
          return r.json();
        };
        const sources = await seedBookingQuotation({ setup, runtime, shopId });
        try {
          const first = await setup("quotations/review", {
            body: sources.value,
          });
          const payload = first.suggested;
          payload.discountDecision = {
            policyId: sources.policyId,
            eligibleKeys: first.customer.lines
              .filter((l) => l.role === "charge")
              .map((l) => l.key),
            stacking: true,
            manual: true,
            reason:
              "SYNTHETIC explicit discount eligibility, stacking and manual attribution",
          };
          payload.discounts = [
            {
              id: randomUUID(),
              target: first.customer.lines[0].key,
              mode: "fixed",
              valueText: "100",
              reason: "SYNTHETIC package discount",
            },
            {
              id: randomUUID(),
              target: null,
              mode: "fixed",
              valueText: "50.01",
              reason: "SYNTHETIC booking discount",
            },
          ];
          payload.sharedCost = {
            amountText: "25.01",
            reason: "SYNTHETIC PRIVATE craft estimate",
          };
          const draftId = draftUuid();
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
                workflow: "pricing.quotation",
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
              url: `${origin}/orders?section=quotations&quotationDraft=${draftId}`,
              email,
              password,
              shopId,
            }),
            { mode: 0o600 },
          );
          console.info(
            `Booking quotation review ready: ${origin}/orders?section=quotations&quotationDraft=${draftId}; private sign-in in .scratch/booking-quotations-review-host/private.json`,
          );
          while (!stopping) {
            try {
              await readFile(file("stop"));
              break;
            } catch {}
            await delay(500);
          }
        } finally {
          await sources.close();
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
