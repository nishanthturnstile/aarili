// Disposable loopback owner review. All data and credentials are synthetic and
// short-lived. Start only after the production web build; stop removes the host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import {
  seedSmallServices,
  serviceDraftId,
} from "./test-support/small-services.mjs";

const operation = process.argv[2];
const directory = resolve(".scratch/small-service-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (operation === "stop") {
  await writeFile(file(operation), "requested");
  console.info(`Small-service review ${operation} requested.`);
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "small-service-review@example.test";
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
          { name: "SYNTHETIC Small-service owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Alteration and saree services" },
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
        const services = await seedSmallServices({
          setup,
          runtime,
          shopId: shop.shopId,
        });
        try {
          const draftIds = [];
          for (const payload of services.intakes) {
            const id = serviceDraftId();
            await setup(`drafts/${id}`, {
              method: "PUT",
              body: { workflow: "order.service", schemaVersion: 1, payload },
            });
            draftIds.push(id);
          }
          const customer = await setup(
            `customers/${services.seed.customer.customerId}`,
            { method: "GET" },
          );
          const at = new Date().toISOString();
          const minor = await setup(`customers/${customer.id}/wearers`, {
            body: {
              mode: "new",
              displayName: "SYNTHETIC minor — aunt has no guardian authority",
              age: "minor",
              preferences: {
                language: "",
                channel: "",
                fit: "",
                style: "",
                delivery: "",
                source: "",
              },
              relationship: {
                kind: "family",
                statementByPersonId: customer.personId,
                authorised: true,
                informed: true,
                source: "in-person",
                occurredAt: at,
                interaction: "SYNTHETIC unverified guardian case",
              },
            },
          });
          // Keep unverified minor identity in the review fixture; an authorised
          // service draft must reject it until real guardian authority is supplied.
          await writeFile(
            file("private.json"),
            JSON.stringify({
              origin,
              email,
              password,
              url: `${origin}/orders`,
              draftIds,
              scenarios: Object.fromEntries(
                ["kurti", "saree", "unknownCapacity"].map((name, index) => [
                  name,
                  `${origin}/orders?services=1&draft=${draftIds[index]}`,
                ]),
              ),
              customerId: customer.id,
              minorWearerId: minor.wearerId,
              profileIds: services.profiles.map((p) => p.id),
              promises: services.intakes.map((v) => v.deliveryDate),
            }),
            { mode: 0o600 },
          );
          console.info(`Small-service review ready: ${origin}/orders`);
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
          await services.close();
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
