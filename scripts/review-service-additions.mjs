// Disposable loopback owner review. All data and credentials are synthetic and
// short-lived. Start only after the production web build; stop removes the host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { emptyGroupIntake } from "@aarili/contracts/orders";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedServiceAdditions } from "./test-support/service-additions.mjs";
import { serviceDraftId } from "./test-support/small-services.mjs";

const operation = process.argv[2];
const directory = resolve(".scratch/service-additions-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (operation === "stop") {
  await writeFile(file(operation), "requested");
  console.info(`Small-service review ${operation} requested.`);
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "service-additions-review@example.test";
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
        const services = await seedServiceAdditions({
          setup,
          runtime,
          shopId: shop.shopId,
        });
        try {
          async function valueFor(orderId, commercial = "additional-charge") {
            const scope = await setup(`small-services/scope/${orderId}`, {
              method: "GET",
            });
            return {
              ...services.change,
              orderId,
              version: scope.version,
              originalDigest: scope.originalDigest,
              scopeDigest: scope.scopeDigest,
              commercial,
              lines: services.change.lines.map((l) => ({
                ...l,
                id: randomUUID(),
              })),
              review: null,
            };
          }
          async function accept(value, existingId) {
            const review = await setup("small-services/changes/review", {
              body: value,
            });
            if (review.issues.length)
              throw Error("Synthetic review scope is blocked");
            value.review = {
              fingerprint: review.fingerprint,
              acknowledged: true,
              exceptionReason:
                "SYNTHETIC expressly reviewed capacity/cut-off exception",
              waiveRush: false,
              waiverReason: "",
            };
            if (existingId) {
              await setup(`drafts/${existingId}`, {
                method: "PUT",
                etag: '"v1"',
                body: {
                  workflow: "order.service-change",
                  schemaVersion: 1,
                  payload: value,
                },
              });
              await setup(`drafts/${existingId}/promote`, {
                body: {},
                etag: '"v2"',
              });
            } else await services.config.publish("order.service-change", value);
          }
          await accept(services.change, services.changeDraftId);
          await accept(await valueFor(services.groups[0].orderIds[0]));
          await accept(
            await valueFor(services.groups[1].orderIds[0], "outside-package"),
          );
          const covered = await valueFor(services.customId);
          covered.lines = [
            {
              id: randomUUID(),
              key: services.saree.profile.content.lines[2].key,
              requestedWork:
                "SYNTHETIC requested pre-pleating; base demand explicitly covers this work",
              priceState: "to-be-quoted",
              priceText: "",
              notRequired: false,
              notRequiredReason: "",
            },
          ];
          covered.capacity = {
            basis: "already-covered",
            coveredBy: services.customId,
            reason:
              "SYNTHETIC owner reviewed this exact profile and existing base demand; no additional contribution",
          };
          covered.reason = "SYNTHETIC explicit already-covered example";
          await accept(covered);
          const blocked = await valueFor(services.groups[0].orderIds[1]);
          blocked.profile = services.unknown.intake.profile;
          const blockedId = serviceDraftId();
          await setup(`drafts/${blockedId}`, {
            method: "PUT",
            body: {
              workflow: "order.service-change",
              schemaVersion: 1,
              payload: blocked,
            },
          });
          const packageBlocked = await valueFor(
            services.groups[1].orderIds[1],
            "unresolved",
          );
          const packageBlockedId = serviceDraftId();
          await setup(`drafts/${packageBlockedId}`, {
            method: "PUT",
            body: {
              workflow: "order.service-change",
              schemaVersion: 1,
              payload: packageBlocked,
            },
          });
          const groupSourceId = serviceDraftId();
          await setup(`drafts/${groupSourceId}`, {
            method: "PUT",
            body: {
              workflow: "order.group",
              schemaVersion: 1,
              payload: {
                ...emptyGroupIntake(),
                reason: "SYNTHETIC explicit group conversion source",
                lines: [
                  { id: serviceDraftId(), intake: services.base },
                  { id: serviceDraftId(), intake: services.base },
                ],
                commercial: {
                  basis: "package-proposal",
                  packagePriceState: "quoted",
                  packagePriceText: "1800",
                },
              },
            },
          });
          await writeFile(
            file("private.json"),
            JSON.stringify({
              origin,
              email,
              password,
              url: origin + "/orders",
              customId: services.customId,
              groups: services.groups,
              sourceDraftId: services.sourceDraftId,
              changeDraftId: services.changeDraftId,
              blockedId,
              packageBlockedId,
              groupSourceId,
              scenarios: {
                custom: origin + "/orders?order=" + services.customId,
                garmentPrices:
                  origin + "/orders?order=" + services.groups[0].orderIds[0],
                package:
                  origin + "/orders?order=" + services.groups[1].orderIds[0],
                conversion: origin + "/orders?draft=" + services.sourceDraftId,
                groupConversion: `${origin}/orders?draft=${groupSourceId}`,
                unmapped: `${origin}/orders?order=${services.groups[0].orderIds[1]}`,
                packageInclusion: `${origin}/orders?order=${services.groups[1].orderIds[1]}`,
              },
              profileIds: services.profiles.map((p) => p.id),
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
