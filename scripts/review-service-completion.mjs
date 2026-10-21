// Disposable, loopback-only synthetic owner review; never a production seed.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedServiceAdditions } from "./test-support/service-additions.mjs";
import { seedSmallServices } from "./test-support/small-services.mjs";

const directory = resolve(".scratch/service-completion-review-host"),
  file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Service-completion review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const password = randomBytes(24).toString("hex"),
    email = "service-completion-review@example.test";
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
        async function request(path, body, headers = {}) {
          const r = await fetch(`${origin}/api${path}`, {
            method: body === undefined ? "GET" : "POST",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              ...headers,
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
          for (const c of r.headers.getSetCookie()) {
            const pair = c.split(";")[0],
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          if (!r.ok)
            throw Error(`Synthetic review authentication failed (${r.status})`);
          return r.json();
        }
        await request(
          "/owner/setup",
          { name: "SYNTHETIC service completion owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC independent service completion" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shop } = await request("/owner/entry"),
          shopId = shop.shopId;
        async function setup(
          path,
          { method = "POST", body, etag, key = randomUUID() } = {},
        ) {
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
              `Synthetic completion fixture failed (${method} ${path}: ${r.status})`,
            );
          return r.json();
        }
        const services = await seedSmallServices({
          setup,
          runtime,
          shopId,
          taskLinked: true,
        });
        try {
          async function accept(payload) {
            const r = await setup("small-services/orders/review", {
              body: payload,
            });
            if (r.issues.length)
              throw Error("Synthetic service review blocked");
            return services.config.publish("order.service", {
              ...payload,
              commitmentReview: {
                fingerprint: r.fingerprint,
                acknowledged: true,
                exceptionReason:
                  "SYNTHETIC explicit review; no production authority",
                waiveRush: false,
                waiverReason: "",
              },
            });
          }
          const value = structuredClone(services.saree.intake);
          value.lines.push({
            id: randomUUID(),
            key: "pre-pleating",
            requestedWork: "",
            priceState: "to-be-quoted",
            priceText: "",
            notRequired: true,
            notRequiredReason:
              "SYNTHETIC pre-pleating explicitly not requested",
          });
          const pendingId = await accept(value),
            taskId = await accept(services.kurti.intake);
          const customer = await setup(
              `customers/${services.seed.customer.customerId}`,
              { method: "GET" },
            ),
            at = new Date().toISOString();
          const minor = await setup(`customers/${customer.id}/wearers`, {
            body: {
              mode: "new",
              displayName: "SYNTHETIC child service wearer",
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
                interaction:
                  "SYNTHETIC customer is contact; guardian verified separately",
              },
            },
          });
          const guardianPath = `customers/${customer.id}/wearers/${minor.wearerId}/guardians`;
          await setup(guardianPath, {
            etag: `"v${minor.version}"`,
            body: {
              guardian: {
                mode: "new",
                displayName: "SYNTHETIC verified parent",
              },
              authority: "parent",
              scope: "measurement",
              source: "in-person",
              occurredAt: at,
            },
          });
          const guardian = await setup(guardianPath, { method: "GET" });
          await setup(`${guardianPath}/verification-events`, {
            etag: `"v${guardian.version}"`,
            body: {
              authorityId: guardian.authority.id,
              status: "confirmed",
              method: "synthetic-review-v1",
              evidenceRef: "SYNTHETIC no real child",
              scope: "measurement",
              source: "in-person",
              occurredAt: at,
            },
          });
          const profile = await services.publishProfile({
            entryId: randomUUID(),
            baseVersion: 0,
            baseRevisionId: null,
            available: true,
            reason: "SYNTHETIC verified minor service fixture",
            content: {
              ...services.saree.profile.content,
              labelEn: "SYNTHETIC minor saree finishing",
              labelTa: "செயற்கை சிறுவர் புடவைச் சேவை",
              wearerRequirement: "required",
              wearerReason:
                "SYNTHETIC explicit wearer and verified guardian authority",
            },
          });
          const minorId = await accept({
            ...structuredClone(services.saree.intake),
            subjectId: randomUUID(),
            wearerId: minor.wearerId,
            profile: { entryId: profile.entryId, revisionId: profile.id },
            lines: services.saree.intake.lines.map((l) => ({
              ...l,
              id: randomUUID(),
            })),
          });
          const additions = await seedServiceAdditions({
            setup,
            runtime,
            shopId,
            services,
          });
          const attached = [];
          for (const orderId of [
            additions.customId,
            additions.groups[1].orderIds[0],
          ]) {
            const scope = await setup(`small-services/scope/${orderId}`, {
                method: "GET",
              }),
              v = {
                ...structuredClone(additions.change),
                orderId,
                version: scope.version,
                originalDigest: scope.originalDigest,
                scopeDigest: scope.scopeDigest,
                commercial: scope.package
                  ? "outside-package"
                  : "additional-charge",
                lines: additions.change.lines.map((l) => ({
                  ...l,
                  id: randomUUID(),
                })),
                review: null,
              };
            const r = await setup("small-services/changes/review", { body: v });
            if (r.issues.length)
              throw Error(
                `Synthetic supplemental review blocked: ${r.issues.join(", ")}`,
              );
            v.review = {
              fingerprint: r.fingerprint,
              acknowledged: true,
              exceptionReason: "SYNTHETIC independent completion review",
              waiveRush: false,
              waiverReason: "",
            };
            await services.config.publish("order.service-change", v);
            attached.push(orderId);
          }
          const scenarios = {
            pending: `${origin}/orders?services=1&serviceOrder=${pendingId}`,
            taskLinked: `${origin}/orders?services=1&serviceOrder=${taskId}`,
            minorAuthority: `${origin}/orders?services=1&serviceOrder=${minorId}`,
            custom: `${origin}/orders?order=${attached[0]}`,
            package: `${origin}/orders?order=${attached[1]}`,
          };
          await writeFile(
            file("private.json"),
            JSON.stringify({ origin, email, password, shopId, scenarios }),
            { mode: 0o600 },
          );
          console.info(`Service completion review ready: ${origin}/orders`);
          console.info(
            `Private synthetic sign-in and scenarios: ${directory}/private.json (never publish).`,
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
