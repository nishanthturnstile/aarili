// Disposable loopback owner review. All data and credentials are synthetic and
// short-lived. Start only after the production web build; stop removes the host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedServiceAdditions } from "./test-support/service-additions.mjs";
import {
  seedSmallServices,
  serviceDraftId,
} from "./test-support/small-services.mjs";

const operation = process.argv[2];
const directory = resolve(
  process.argv.includes("--merge")
    ? ".scratch/contact-merge-review-host"
    : process.argv.includes("--identity")
      ? ".scratch/identity-review-host"
      : process.argv.includes("--history")
        ? ".scratch/customer-history-review-host"
        : ".scratch/repeat-services-review-host",
);
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (operation === "stop") {
  await writeFile(file(operation), "requested");
  console.info(`Repeat-service review ${operation} requested.`);
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "repeat-service-review@example.test";
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
          { name: "SYNTHETIC Repeat-service owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Repeat-service review" },
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
        const seed = await seedSmallServices({
          setup,
          runtime,
          shopId: shop.shopId,
        });
        try {
          let intake = seed.saree.intake;
          const review = await setup("small-services/orders/review", {
            body: intake,
          });
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
              workflow: "order.service",
              schemaVersion: 1,
              payload: intake,
            },
          });
          const result = await setup(`drafts/${draftId}/promote`, {
              body: {},
              etag: '"v1"',
            }),
            sourceId = result.draft.result.id;
          const custom = await seedServiceAdditions({
            setup,
            runtime,
            shopId: shop.shopId,
            services: seed,
          });
          const native = await setup(
            `service-repeats/${custom.customId}/source`,
          );
          if (!native.pieces[0])
            throw Error("Synthetic native piece was not prepared");
          const change = { ...custom.change, pieceId: native.pieces[0].id };
          const current = await setup("small-services/changes/review", {
            body: change,
          });
          await setup(`drafts/${custom.changeDraftId}`, {
            method: "PUT",
            etag: '"v1"',
            body: {
              workflow: "order.service-change",
              schemaVersion: 1,
              payload: {
                ...change,
                review: {
                  fingerprint: current.fingerprint,
                  acknowledged: true,
                  exceptionReason: "SYNTHETIC native-piece review",
                  waiveRush: false,
                  waiverReason: "",
                },
              },
            },
          });
          await setup(`drafts/${custom.changeDraftId}/promote`, {
            body: {},
            etag: '"v2"',
          });
          if (
            process.argv.includes("--identity") ||
            process.argv.includes("--merge")
          ) {
            const c = await setup(
              `customers/${seed.seed.customer.customerId}`,
              { method: "GET" },
            );
            const policy = await setup("customers/policy", { method: "GET" });
            await setup(`customers/${c.id}`, {
              method: "PATCH",
              etag: `"v${c.version}"`,
              body: {
                displayName: c.displayName,
                phone: "9000000737",
                email: c.email,
                aliases: c.aliases,
                notes: c.notes,
                reason: "SYNTHETIC shared household phone review",
              },
            });
            await setup("customers", {
              body: {
                displayName: "SYNTHETIC separate contact",
                phone: "9000000737",
                aliases: [c.displayName],
                serviceEvidence: {
                  noticeId: policy.notice.id,
                  language: "en",
                  decision: "grant",
                  giver: "self",
                  noticeExplained: true,
                  source: "in-person",
                  occurredAt: new Date().toISOString(),
                },
              },
            });
          }
          await writeFile(
            file("private.json"),
            JSON.stringify({
              origin,
              email,
              password,
              sourceId,
              customerId: seed.seed.customer.customerId,
              wearerId: seed.seed.wearer.wearerId,
              historyUrl: `${origin}/customers/${seed.seed.customer.customerId}`,
              url: `${origin}/orders?services=1&serviceOrder=${sourceId}`,
              pieceSourceId: custom.customId,
              pieceUrl: `${origin}/orders?order=${custom.customId}`,
              groupedUrls: custom.groups.map(
                (g) => `${origin}/orders?order=${g.orderIds[0]}`,
              ),
            }),
            { mode: 0o600 },
          );
          console.info(
            `Customer-history review ready: ${origin}/customers/${seed.seed.customer.customerId}`,
          );
          console.info(
            `Repeat-service review ready: ${origin}/orders?services=1&serviceOrder=${sourceId}`,
          );
          console.info(
            `Native-piece/add-on review: ${origin}/orders?order=${custom.customId}`,
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
