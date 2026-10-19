// Disposable loopback review, using the existing synthetic-only auth host.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { mutateDraft } from "@aarili/core/drafts";
import { measurementFormsDraftWorkflow } from "@aarili/core/measurement-forms";
import { serviceCatalogueDraftWorkflow } from "@aarili/core/service-catalogue";
import { createDatabase, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { measurementFormsRepository } from "@aarili/db/measurement-forms-repository";
import { serviceCatalogueRepository } from "@aarili/db/service-catalogue-repository";
import { withOwnerWeb } from "./test-support/owner-web.mjs";

const directory = resolve(".scratch/measurement-forms-review-host"),
  privateFile = resolve(directory, "private.json"),
  stopFile = resolve(directory, "stop"),
  lockFile = resolve(directory, "host.lock");
await mkdir(directory, { recursive: true });
if (process.argv[2] === "expire") {
  await writeFile(resolve(directory, "expire"), "expire");
  console.info("Synthetic authentication expiry requested.");
} else if (process.argv[2] === "stop") {
  await writeFile(stopFile, "stop");
  console.info(
    "Measurement forms review stop requested; disposable data/private access will be removed.",
  );
} else {
  const lock = await open(lockFile, "wx");
  await lock.close();
  await rm(stopFile, { force: true });
  const email = "service-measurement-forms-review@example.test",
    password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, expireAuthentication, runtime }) => {
        const seedDatabase = createDatabase(
          runtime.options.connectionString,
          1,
        );
        try {
          const cookies = new Map();
          let seedActorId;
          async function request(
            path,
            body,
            extra = {},
            method = body ? "POST" : "GET",
            retry = 0,
          ) {
            // Setup-only synthetic records still use the real membership transaction,
            // draft/idempotency/audit/publication workflows. Interactive HTTP admission
            // stays unchanged; setup does not spend six minutes in its five/minute bucket.
            const seed = path.match(
              /^\/shops\/([^/]+)\/drafts\/([^/]+)(\/promote)?$/,
            );
            if (seedActorId && seed && ["PUT", "POST"].includes(method))
              return withShop(
                seedDatabase.db,
                seedActorId,
                seed[1],
                async (tx) => {
                  const catalogue = {
                    shopId: seed[1],
                    actorId: seedActorId,
                    repository: serviceCatalogueRepository(tx, seed[1]),
                    synthetic: true,
                  };
                  return mutateDraft(
                    {
                      shopId: seed[1],
                      actor: { type: "user", id: seedActorId },
                      repository: draftRepository(tx, seed[1]),
                      workflows: new Map([
                        [
                          "service.catalogue",
                          serviceCatalogueDraftWorkflow(catalogue),
                        ],
                        [
                          "measurement.forms",
                          measurementFormsDraftWorkflow({
                            shopId: seed[1],
                            actorId: seedActorId,
                            repository: measurementFormsRepository(tx, seed[1]),
                            catalogue,
                            synthetic: true,
                          }),
                        ],
                      ]),
                    },
                    seed[2],
                    seed[3] ? "promote" : "save",
                    body,
                    {
                      key: extra["Idempotency-Key"],
                      requestId: randomUUID(),
                      ...(extra["If-Match"]
                        ? { ifMatch: extra["If-Match"] }
                        : {}),
                    },
                  );
                },
              );
            const response = await fetch(`${origin}/api${path}`, {
              method,
              headers: {
                Origin: origin,
                "Content-Type": "application/json",
                Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
                ...extra,
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            });
            for (const c of response.headers.getSetCookie()) {
              const pair = c.split(";")[0],
                i = pair.indexOf("=");
              cookies.set(pair.slice(0, i), pair.slice(i + 1));
            }
            if (response.status === 429 && retry < 2) {
              const seconds = Math.max(
                1,
                Math.min(60, Number(response.headers.get("Retry-After") ?? 60)),
              );
              await response.arrayBuffer();
              await delay(seconds * 1000 + 100);
              return request(path, body, extra, method, retry + 1);
            }
            if (!response.ok)
              throw Error(
                `SYNTHETIC catalogue review setup failed (${response.status})`,
              );
            return response.json();
          }
          await request(
            "/owner/setup",
            { name: "SYNTHETIC review owner", email, password },
            { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
          );
          await request("/owner/verify", { code: await code() });
          await request("/auth/sign-in/email", { email, password });
          await request(
            "/owner/complete",
            { shopName: "SYNTHETIC catalogue review" },
            { "Idempotency-Key": randomUUID() },
          );
          const { shopId } = await request("/owner/shop"),
            path = `/shops/${shopId}/settings/profile`;
          const initial = await request(path);
          await request(
            path,
            {
              ...initial.profile,
              displayName: "Synthetic Aarili review",
              tagline: "Synthetic text branding — தமிழ்",
            },
            {
              "Idempotency-Key": randomUUID(),
              "If-Match": `"v${initial.version}"`,
            },
            "PUT",
          );
          const policy = await request(`/shops/${shopId}/customers/policy`);
          await request(
            `/shops/${shopId}/customers`,
            {
              displayName: "Synthetic preserved customer",
              serviceEvidence: {
                noticeId: policy.notice.id,
                language: "en",
                decision: "grant",
                giver: "self",
                noticeExplained: true,
                source: "in-person",
                occurredAt: new Date(Date.now() - 60000).toISOString(),
              },
            },
            { "Idempotency-Key": randomUUID() },
          );
          seedActorId = (
            await runtime.query(
              "select user_id from owner_bootstrap where singleton",
            )
          ).rows[0]?.user_id;
          if (!seedActorId) throw Error("Synthetic owner identity unavailable");
          const publish = async (kind, code, labelEn, labelTa, extra = {}) => {
            const v = randomUUID(),
              entryId = randomUUID(),
              draftId = `${v.slice(0, 14)}7${v.slice(15)}`;
            await request(
              `/shops/${shopId}/drafts/${draftId}`,
              {
                workflow: "service.catalogue",
                schemaVersion: 1,
                payload: {
                  entryId,
                  baseVersion: 0,
                  baseRevisionId: null,
                  operation: "definition",
                  available: true,
                  reason: "SYNTHETIC review fixture, not production policy",
                  content: {
                    ...emptyCatalogueContent(kind),
                    code,
                    labelEn,
                    labelTa,
                    ...extra,
                  },
                },
              },
              { "Idempotency-Key": randomUUID() },
              "PUT",
            );
            await request(
              `/shops/${shopId}/drafts/${draftId}/promote`,
              {},
              { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
            );
            return (
              await request(
                `/shops/${shopId}/settings/catalogue/entries/${entryId}`,
              )
            ).revision;
          };
          const ref = (r) => ({
            entryId: r.entryId,
            revisionId: r.definition.id,
          });
          const blouse = await publish(
            "category",
            "blouse",
            "SYNTHETIC blouse",
            "செயற்கை ரவிக்கை",
            { aliases: ["ravikkai"] },
          );
          const salwar = await publish(
            "category",
            "salwar",
            "SYNTHETIC salwar / chudidhar",
            "செயற்கை சல்வார் / சுடிதார்",
          );
          const small = await publish(
            "category",
            "small-services",
            "SYNTHETIC small services",
            "செயற்கை சிறு சேவைகள்",
          );
          const top = await publish(
            "piece",
            "top",
            "SYNTHETIC top",
            "செயற்கை மேலாடை",
          );
          const bottom = await publish(
            "piece",
            "bottom",
            "SYNTHETIC bottom",
            "செயற்கை காலாடை",
          );
          const pico = await publish(
            "addon",
            "pico",
            "SYNTHETIC pico",
            "செயற்கை பிக்கோ",
          );
          const princess = await publish(
            "subcategory",
            "princess",
            "SYNTHETIC princess cut",
            "செயற்கை பிரின்சஸ் கட்",
            { parent: ref(blouse) },
          );
          const blouseService = await publish(
            "service",
            "blouse-stitching",
            "SYNTHETIC blouse stitching",
            "செயற்கை ரவிக்கை தையல்",
            { parent: ref(princess), serviceKind: "stitching" },
          );
          const salwarService = await publish(
            "service",
            "salwar-stitching",
            "SYNTHETIC salwar stitching",
            "செயற்கை சல்வார் தையல்",
            {
              parent: ref(salwar),
              serviceKind: "stitching",
              pieces: [
                { ...ref(top), optional: false },
                { ...ref(bottom), optional: true },
              ],
              addons: [{ ...ref(pico), optional: true }],
            },
          );
          await publish(
            "service",
            "blouse-alteration",
            "SYNTHETIC blouse alteration",
            "செயற்கை ரவிக்கை திருத்தம்",
            { parent: ref(blouse), serviceKind: "alteration" },
          );
          const fallService = await publish(
            "service",
            "fall",
            "SYNTHETIC fall only",
            "செயற்கை ஃபால் மட்டும்",
            { parent: ref(small), serviceKind: "small-service" },
          );
          async function publishForm(service, piece, code, none = false) {
            const u = randomUUID(),
              draftId = `${u.slice(0, 14)}7${u.slice(15)}`,
              entryId = randomUUID();
            await request(
              `/shops/${shopId}/drafts/${draftId}`,
              {
                workflow: "measurement.forms",
                schemaVersion: 1,
                payload: {
                  entryId,
                  baseVersion: 0,
                  baseRevisionId: null,
                  operation: "definition",
                  available: true,
                  reason: "SYNTHETIC reviewed example; no production authority",
                  content: {
                    ...emptyMeasurementFormContent(),
                    code,
                    labelEn: `SYNTHETIC ${code}`,
                    labelTa: "செயற்கை அளவுப் படிவம்",
                    service: ref(service),
                    piece: piece ? ref(piece) : null,
                    decision: none ? "not-required" : "required",
                    decisionReason: none
                      ? "SYNTHETIC standalone service needs no measurements"
                      : "",
                    groups: none
                      ? []
                      : [
                          {
                            id: randomUUID(),
                            labelEn: "Body",
                            labelTa: "உடல்",
                            fields: [
                              {
                                id: randomUUID(),
                                key: "body-length",
                                meaning:
                                  "SYNTHETIC shoulder to hem body length",
                                kind: "base-length",
                                illustration: null,
                                labelEn: "Body length",
                                labelTa: "உடல் நீளம்",
                                hintEn: "SYNTHETIC method for review",
                                hintTa: "செயற்கை முறை விளக்கம்",
                                units: ["in", "cm"],
                                defaultUnit: "in",
                                required: true,
                                precision: {
                                  unit: "in",
                                  increment: "0.25",
                                  review: "SYNTHETIC owner precision review",
                                },
                              },
                            ],
                          },
                        ],
                  },
                },
              },
              { "Idempotency-Key": randomUUID() },
              "PUT",
            );
            await request(
              `/shops/${shopId}/drafts/${draftId}/promote`,
              {},
              { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
            );
          }
          await publishForm(blouseService, null, "blouse-body");
          await publishForm(salwarService, top, "salwar-top");
          await publishForm(salwarService, bottom, "salwar-bottom");
          await publishForm(fallService, null, "fall-no-measurements", true);
          await writeFile(
            privateFile,
            JSON.stringify({
              origin,
              email,
              password,
              url: `${origin}/settings?section=measurementForms`,
            }),
            { mode: 0o600 },
          );
          console.info(
            `Measurement forms review ready: ${origin}/settings?section=measurementForms`,
          );
          console.info(
            "Private sign-in is in .scratch/measurement-forms-review-host/private.json; do not publish it.",
          );
          while (!stopping) {
            try {
              await readFile(resolve(directory, "expire"));
              await expireAuthentication();
              await rm(resolve(directory, "expire"));
            } catch {}

            try {
              await readFile(stopFile);
              break;
            } catch {}
            await delay(500);
          }
        } finally {
          await seedDatabase.pool.end();
        }
      },
      { secrets: [password] },
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await rm(privateFile, { force: true });
    await rm(stopFile, { force: true });
    await rm(lockFile, { force: true });
  }
}
