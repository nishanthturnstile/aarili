import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyPolicy } from "@aarili/contracts/shop-policies";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { createDocumentRenderer } from "@aarili/documents";
import { quotationTemplates } from "@aarili/documents/quotation";
import { startSyntheticQueue } from "@aarili/jobs";
import { documentJobWriter } from "@aarili/jobs/documents";
import { productionJobComposition } from "@aarili/jobs/production";
import {
  createDocumentOrphanStorage,
  createDocumentStorage,
} from "@aarili/platform/document-storage";
import { seedBookingQuotation } from "./booking-quotation-fixtures.mjs";
import { syntheticDocumentTemplates } from "./document-template.mjs";
import { withPrivateS3 } from "./private-s3.mjs";
import { draftUuid } from "./quotation-rate-fixtures.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";

async function seedQuotationIssueSources(options) {
  const s = await seedBookingQuotation(options),
    setup = options.setup;
  try {
    const p = await setup("settings/profile", { method: "GET" });
    await setup("settings/profile", {
      method: "PUT",
      etag: `"v${p.version}"`,
      body: {
        ...p.profile,
        displayName: "SYNTHETIC quotations",
        legalName: "SYNTHETIC quotation shop",
        address: "SYNTHETIC test address — not a real business",
        phone: "9000000000",
      },
    });
    const source = draftUuid();
    await setup(`drafts/${source}`, {
      method: "PUT",
      body: {
        workflow: "shop.policies",
        schemaVersion: 1,
        payload: {
          baseVersion: 0,
          baseRevisionId: null,
          policy: {
            ...emptyPolicy("quoteValidity"),
            state: "reviewed",
            calendarDays: 7,
            terms: {
              en: "SYNTHETIC reviewed validity; no agreement or payment.",
              ta: "மாதிரி செல்லுபடிக் காலம்; ஒப்பந்தம் அல்லது பணம் செலுத்தல் அல்ல.",
            },
            authority: {
              kind: "owner-proposal",
              label: "SYNTHETIC owner-reviewed",
            },
            reason: "SYNTHETIC validity only",
          },
        },
      },
    });
    await s.config.publish("pricing.policy-review", {
      kind: "quoteValidity",
      baseVersion: 0,
      baseRevisionId: null,
      sourceDraftId: source,
      sourceDraftVersion: 1,
      acknowledged: true,
      reason: "SYNTHETIC quote validity authority",
    });
    const value = {
      ...s.value,
      selection: "current",
      sharedCost: { amountText: "25.01", reason: "PRIVATE-COST-176" },
    };
    let r = await setup("quotations/review", { body: value });
    r = await setup("quotations/review", { body: r.suggested });
    const proposalId = await s.config.publish("pricing.quotation", {
      ...r.suggested,
      review: r.fingerprint,
    });
    return {
      ...s,
      proposalId,
      proposalValue: { ...r.suggested, review: r.fingerprint },
    };
  } catch (error) {
    await s.close();
    throw error;
  }
}
export async function withQuotationIssues(run, options = {}) {
  const quotes = await quotationTemplates(),
    synthetic = await syntheticDocumentTemplates(),
    templates = {
      resolve: async (id, version) =>
        (await quotes.resolve(id, version)) ?? synthetic.resolve(id, version),
    },
    renderer = createDocumentRenderer(templates);
  let boss,
    storage,
    maintenance,
    failRender = false,
    failPut = false,
    afterPut;
  try {
    await withPrivateS3(async (config) => {
      storage = createDocumentStorage(config);
      maintenance = createDocumentOrphanStorage(config);
      const adapters = (tx, shopId) => ({
        templates,
        storage: {
          ...storage,
          put: async (...args) => {
            if (failPut) throw Error("Injected quote storage failure");
            await storage.put(...args);
            await afterPut?.();
          },
        },
        policy: { authorize: async (d) => d.template === "synthetic.document" },
        jobs: {
          enqueue: (a) => documentJobWriter(boss, tx, shopId).enqueue(a),
          phase: (a) => documentJobWriter(boss, tx, shopId).phase(a),
        },
      });
      await withTenantFixture(
        async (f) => {
          boss = await startSyntheticQueue(f.runtime.db, "pdf.render");
          await f.admin.query(
            "update system_state set side_effects_enabled=true",
          );
          const api = createApi(async () => true, {
            ...f.owner,
            commandLimit: async () => 0,
            withOwnerQuotationIssues: async (...args) => {
              try {
                return await f.owner.withOwnerQuotationIssues(...args);
              } catch (e) {
                console.info("Synthetic quotation failure", {
                  name: e?.name,
                  code: e?.code,
                  pgCode: e?.cause?.code,
                  pgMessage: e?.cause?.message,
                  validation: e?.issues?.map((i) => ({
                    path: i.path,
                    message: i.message,
                  })),
                });
                throw e;
              }
            },
          });
          const request = (
            path,
            { method = "POST", body, key = randomUUID(), etag, who = f.a } = {},
          ) =>
            api.fetch(
              new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
                method,
                headers: {
                  Origin: f.owner.origin,
                  Cookie: who.cookie,
                  "Content-Type": "application/json",
                  "Idempotency-Key": key,
                  ...(etag ? { "If-Match": etag } : {}),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              }),
            );
          const setup = async (path, options) => {
            const r = await request(path, options);
            assert.equal(r.status, 200, `${path}: ${await r.clone().text()}`);
            return r.json();
          };
          const s = await seedQuotationIssueSources({
            setup,
            runtime: f.runtime.pool,
            shopId: f.a.shop,
          });
          const composition = productionJobComposition(undefined, {
            adapters: (tx, shopId, userId) =>
              f.owner.jobSlipDocuments(tx, shopId, userId),
            renderer: {
              render: (...args) => {
                if (failRender) throw Error("Injected quote renderer failure");
                return renderer.render(...args);
              },
            },
            erasureStorage: maintenance,
          });
          const transaction = (fn) =>
            f.owner
              .withOwnerQuotationIssues(
                new Headers({ Cookie: f.a.cookie }),
                f.a.shop,
                fn,
              )
              .then((r) => r.data);
          const feature = {
            ...f,
            ...s,
            config,
            storage,
            api,
            request,
            setup,
            transaction,
            templates,
            documentStorage: storage,
            documentMaintenance: maintenance,
            composition,
            failRender: (v) => {
              failRender = v;
            },
            failPut: (v) => {
              failPut = v;
            },
            afterPut: (fn) => {
              afterPut = fn;
            },
            async issueInput(proposalId = s.proposalId, extra = {}) {
              const v = {
                  proposalId,
                  language: "ta",
                  expiryDate: "",
                  customerLabel: "SYNTHETIC customer",
                  ...extra,
                },
                review = await setup("quotation-issues/review", { body: v });
              assert.deepEqual(review.blockers, []);
              return {
                input: {
                  ...v,
                  digest: review.digest,
                  previousRevision: review.history[0]?.revision ?? null,
                  acknowledged: true,
                  reason: "SYNTHETIC quotation issue",
                },
                version: review.version,
              };
            },
            async job(entry) {
              return transaction(async (c) => {
                const a = await c.documents.repository.attempt(
                  entry.docId,
                  entry.revision,
                );
                return {
                  shopId: f.a.shop,
                  docId: entry.docId,
                  revision: entry.revision,
                  jobId: a.jobId,
                  initiatorId: a.initiatorId,
                  epoch: a.epoch,
                };
              });
            },
            async process(entry, before = async () => {}) {
              return composition.handlers.get("pdf.render")(
                f.parallel.db,
                await feature.job(entry),
                before,
              );
            },
            async revise(extra = {}) {
              const current = await setup("quotations/read", {
                body: { id: s.proposalId },
              });
              const v = {
                ...current.version.input,
                baseVersion: current.version.version,
                baseRevisionId: current.version.id,
                reason: "SYNTHETIC revised proposal",
                review: null,
                ...extra,
              };
              let r = await setup("quotations/review", { body: v });
              r = await setup("quotations/review", { body: r.suggested });
              return s.config.publish("pricing.quotation", {
                ...r.suggested,
                review: r.fingerprint,
              });
            },
          };
          try {
            await options.beforeUpgrade?.(feature);
            await run(feature);
          } finally {
            await s.close();
          }
        },
        {
          ...(options.migrationThrough
            ? { migrationThrough: options.migrationThrough }
            : {}),
          customerPolicy: syntheticCustomerPolicy,
          documentAdapters: adapters,
        },
      );
    });
  } finally {
    if (boss) await boss.stop();
    await renderer.close();
    storage?.destroy();
    maintenance?.destroy();
  }
}
