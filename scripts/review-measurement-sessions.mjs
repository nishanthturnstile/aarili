// Disposable loopback review: synthetic records, private access file, no outbound mail.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import {
  designOk,
  designRequest,
} from "./test-support/design-choices-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSources,
  publishMeasurement,
} from "./test-support/measurement-session-fixtures.mjs";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedQuickOrder } from "./test-support/seed-quick-order.mjs";
import { seedSmallServices } from "./test-support/small-services.mjs";

const directory = resolve(".scratch/measurement-sessions-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Measurement-session review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "measurement-review@example.test",
    password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, seedCommand, runtime }) => {
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
          { name: "SYNTHETIC Measurement owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Measurement sessions" },
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
        const seed = await seedQuickOrder(runtime, shop.shopId);
        const identity = {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        };
        const setup = (path, options = {}) =>
          designRequest(fixture, path, { method: "POST", ...options }).then(
            designOk,
          );
        const customer = await setup(`customers/${identity.customerId}`, {
          method: "GET",
        });
        await setup(`customers/${customer.id}`, {
          method: "PATCH",
          etag: `"v${customer.version}"`,
          body: {
            displayName: customer.displayName,
            phone: "SYNTHETIC 0000000000",
            email: customer.email ?? "",
            notes: customer.notes ?? "",
            aliases: customer.aliases,
            reason: "SYNTHETIC shared contact phone",
          },
        });
        const makeWearer = async (name, age) =>
          setup(`customers/${customer.id}/wearers`, {
            body: {
              mode: "new",
              displayName: name,
              age,
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
                occurredAt: new Date().toISOString(),
                interaction: "SYNTHETIC independent wearer",
              },
            },
          });
        const second = await makeWearer("SYNTHETIC Meena B மீனா B", "adult"),
          minor = await makeWearer("SYNTHETIC minor சிறுவர்", "minor");
        await setup(
          `customers/${customer.id}/wearers/${second.wearerId}/consent-events`,
          {
            etag: `"v${second.version}"`,
            body: {
              purpose: "service",
              decision: "grant",
              noticeId: syntheticWearerPolicy.notice.id,
              noticeExplained: true,
              language: "en",
              giverPersonId: second.personId,
              source: "in-person",
              occurredAt: new Date().toISOString(),
            },
          },
        );
        const base = await measurementSources(fixture, identity);
        for (const form of base.forms)
          await approveMeasurementForm(fixture, form);
        const secondOrder = await base.accept({
          customerId: identity.customerId,
          wearerId: second.wearerId,
        });
        const target = await base.accept(),
          pieceId = target.pieces.identities.find(
            (p) => p.key === base.top.definition.content.code,
          ).id;
        const observed = measurementDraft(
          identity,
          base.forms[0],
          (
            await setup("measurements/use", {
              body: {
                form: {
                  entryId: base.forms[0].entryId,
                  revisionId: base.forms[0].definition.id,
                },
              },
            })
          ).approval,
        );
        observed.values = observed.values.map((value, i) =>
          i === 0 ? value : { ...value, rawText: "", unit: null },
        );
        const saved = await publishMeasurement(fixture, observed);
        const small = await seedSmallServices({
          setup,
          runtime,
          shopId: shop.shopId,
          seed,
          configuration: base.acceptance,
        });
        await seed.close();
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin,
            email,
            password,
            url: `${origin}/orders?order=${target.order.id}`,
            customerId: identity.customerId,
            wearerId: identity.wearerId,
            secondWearerId: second.wearerId,
            secondOrderId: secondOrder.order.id,
            minorWearerId: minor.wearerId,
            versionId: saved.result.draft.result.id,
            orderId: target.order.id,
            pieceId,
            noMeasurementProfileId: small.saree.profile.entryId,
            formIds: base.forms.map((f) => f.definition.id),
          }),
          { mode: 0o600 },
        );
        console.info(
          `Measurement-session review ready: ${origin}/orders?order=${target.order.id}`,
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
