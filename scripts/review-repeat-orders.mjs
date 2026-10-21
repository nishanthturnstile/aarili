// Disposable loopback owner review. All data and credentials are synthetic and
// short-lived. Start only after the production web build; stop removes the host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { seedOrderAcceptance } from "./test-support/order-acceptance.mjs";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedQuickOrder } from "./test-support/seed-quick-order.mjs";
import { serviceDraftId } from "./test-support/small-services.mjs";

const operation = process.argv[2];
const directory = resolve(".scratch/repeat-orders-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (operation === "stop") {
  await writeFile(file(operation), "requested");
  console.info(`Repeat-order review ${operation} requested.`);
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "repeat-review@example.test";
  const password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
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
          { name: "SYNTHETIC Repeat-order owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Repeat-order review" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shop } = await request("/owner/entry");
        async function setup(
          path,
          { method = "POST", body, etag, key = randomUUID() } = {},
        ) {
          const r = await seedCommand(
            new Request(`${origin}/api/shops/${shop.shopId}/${path}`, {
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
            throw Error(`Synthetic service setup failed (${r.status})`);
          return r.json();
        }
        const seed = await seedQuickOrder(runtime, shop.shopId);
        try {
          await seedOrderAcceptance(setup, seed.sources);
          let intake = {
            ...emptyQuickOrder(),
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
            manifest: {
              entryId: seed.sources.before.entryId,
              revisionId: seed.sources.before.id,
              definitionId: seed.sources.before.definition.id,
            },
            deliveryDate: new Date(Date.now() + 30 * 86400000)
              .toISOString()
              .slice(0, 10),
            priceState: "quoted",
            priceText: "125.50",
            instructions:
              "SYNTHETIC requested loose sleeve; review for the new order",
          };
          const review = await setup("orders/review", { body: intake });
          intake = {
            ...intake,
            commitmentReview: {
              fingerprint: review.fingerprint,
              acknowledged: true,
              exceptionReason: "SYNTHETIC review",
              waiveRush: false,
              waiverReason: "",
            },
          };
          const draftId = serviceDraftId();
          await setup(`drafts/${draftId}`, {
            method: "PUT",
            body: {
              workflow: "order.quick",
              schemaVersion: 1,
              payload: intake,
            },
          });
          const result = await setup(`drafts/${draftId}/promote`, {
              body: {},
              etag: '"v1"',
            }),
            sourceId = result.draft.result.id;
          await writeFile(
            file("private.json"),
            JSON.stringify({
              origin,
              email,
              password,
              sourceId,
              url: `${origin}/orders?order=${sourceId}`,
            }),
            { mode: 0o600 },
          );
          console.info(
            `Repeat-order review ready: ${origin}/orders?order=${sourceId}`,
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
        } finally {
          await seed.close();
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
