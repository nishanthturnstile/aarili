// Disposable loopback review. Credentials and all synthetic data are temporary.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { emptyBookingDraft } from "@aarili/contracts/orders";
import { seedBookingOrders } from "./test-support/booking-orders.mjs";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedQuickOrder } from "./test-support/seed-quick-order.mjs";

const operation = process.argv[2];
const directory = resolve(".scratch/booking-groups-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (["stop", "expire"].includes(operation)) {
  await writeFile(file(operation), "requested");
  console.info(`Booking group review ${operation} requested.`);
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "quick-order-review@example.test";
  const password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({
        origin,
        setupToken,
        code,
        runtime,
        expireAuthentication,
        seedCommand,
      }) => {
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
          { name: "SYNTHETIC Quick Order owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Booking group review" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shop } = await request("/owner/entry");
        const seed = await seedQuickOrder(runtime, shop.shopId, {
          outfit: true,
        });
        try {
          async function setup(
            path,
            { method = "POST", body, etag, key = randomUUID() } = {},
          ) {
            const response = await seedCommand(
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
            if (!response.ok)
              throw Error(
                `Synthetic acceptance setup failed (${response.status})`,
              );
            return response.json();
          }
          const seeded = await seedBookingOrders({
            setup,
            runtime,
            shopId: shop.shopId,
            seed,
          });
          await seeded.close();
          const draftId = randomUUID().replace(/^(........-....-)./, "$17");
          await setup(`drafts/${draftId}`, {
            method: "PUT",
            body: {
              workflow: "booking.group",
              schemaVersion: 1,
              payload: {
                ...emptyBookingDraft,
                customerId: seed.customer.customerId,
                context: {
                  ...emptyBookingDraft.context,
                  occasion: "bridal",
                  eventDate: "2026-12-01",
                  notes: "SYNTHETIC family occasion — குடும்ப வருகை",
                },
                orders: seeded.orders.map((o) => ({
                  id: o.id,
                  version: o.version,
                  snapshotDigest: o.snapshotDigest,
                })),
                reason: "SYNTHETIC owner review",
              },
            },
          });
          await writeFile(
            file("private.json"),
            JSON.stringify({
              origin,
              email,
              password,
              url: `${origin}/orders`,
              orderIds: seeded.orders.map((o) => o.id),
              draftId,
              promises: seeded.orders.map((o) => o.originalPromise.date),
            }),
            { mode: 0o600 },
          );
          console.info(`Booking group review ready: ${origin}/orders`);
          console.info(
            `Private sign-in: ${directory}/private.json (never publish).`,
          );
          while (!stopping) {
            try {
              await readFile(file("expire"));
              await expireAuthentication();
              await rm(file("expire"));
            } catch {}
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
    for (const name of ["private.json", "stop", "expire", "host.lock"])
      await rm(file(name), { force: true });
  }
}
