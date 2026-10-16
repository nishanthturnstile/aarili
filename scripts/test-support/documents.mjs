import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { sql } from "@aarili/db";
import { documentRepository } from "@aarili/db/document-repository";
import { createDocumentRenderer } from "@aarili/documents";
import { startSyntheticQueue } from "@aarili/jobs";
import {
  documentJobWriter,
  documentProcessingHost,
} from "@aarili/jobs/documents";
import { productionJobComposition } from "@aarili/jobs/production";
import {
  createDocumentOrphanStorage,
  createDocumentStorage,
} from "@aarili/platform/document-storage";
import {
  command,
  documentRunArguments,
  ensureDocumentImage,
} from "../document-runtime-image.mjs";
import { syntheticDocumentTemplates } from "./document-template.mjs";
import { withPrivateS3 } from "./private-s3.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";

export async function withDocuments(run) {
  const templates = await syntheticDocumentTemplates();
  const native =
    process.platform === "win32" ? createDocumentRenderer(templates) : null;
  const image = native ? null : await ensureDocumentImage();
  await withPrivateS3(async (config) => {
    const actual = createDocumentStorage(config),
      maintenance = createDocumentOrphanStorage(config);
    let boss,
      failRender = false,
      failStorage = false,
      afterPut,
      renderCount = 0;
    const renderer = {
      async render(d) {
        renderCount++;
        if (failRender) throw Error("Injected renderer failure");
        return native
          ? native.render(d)
          : new Uint8Array(
              Buffer.from(
                await command(
                  [
                    "run",
                    "--rm",
                    "-i",
                    ...documentRunArguments,
                    image,
                    "--one",
                  ],
                  JSON.stringify(d),
                  true,
                ),
                "base64",
              ),
            );
      },
    };
    const storage = {
      ...actual,
      async put(...args) {
        if (failStorage) throw Error("Injected storage failure");
        await actual.put(...args);
        await afterPut?.();
      },
    };
    const adapters = (tx, shopId) => ({
      templates,
      storage,
      policy: {
        async authorize() {
          const r = await tx.execute(
            sql`select allowed from document_test_policy where shop_id=${shopId}::uuid for share`,
          );
          return r.rows[0]?.allowed === true;
        },
      },
      jobs: {
        enqueue: (a) => documentJobWriter(boss, tx, shopId).enqueue(a),
        phase: (a) => documentJobWriter(boss, tx, shopId).phase(a),
      },
    });
    try {
      await withTenantFixture(
        async (f) => {
          await f.migration.query(
            "create table document_test_policy(shop_id uuid not null primary key references shop(shop_id),allowed boolean not null);alter table document_test_policy enable row level security;alter table document_test_policy force row level security;create policy tenant_context on document_test_policy as restrictive for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id));create policy tenant_access on document_test_policy for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id));grant select,update on document_test_policy to app_user;grant select on document_test_policy to app_backup",
          );
          await f.admin.query(
            "insert into document_test_policy values($1,true),($2,true)",
            [f.a.shop, f.b.shop],
          );
          await f.admin.query(
            "update system_state set side_effects_enabled=true",
          );
          boss = await startSyntheticQueue(f.runtime.db, "pdf.render");
          const api = createApi(async () => true, f.owner);
          const request = (
            path = "",
            { who = f.a, method = "GET", body, key = randomUUID(), etag } = {},
          ) =>
            api.fetch(
              new Request(
                `${f.owner.origin}/api/shops/${who.shop}/documents${path}`,
                {
                  method,
                  headers: {
                    Origin: f.owner.origin,
                    Cookie: who.cookie,
                    "Content-Type": "application/json",
                    "Idempotency-Key": key,
                    ...(etag ? { "If-Match": etag } : {}),
                  },
                  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                },
              ),
            );
          const host = (who = f.a) =>
            documentProcessingHost(f.parallel.db, who.shop, who.user, adapters);
          const transaction = (run, who = f.a) => host(who).transaction(run);
          const issue = async (
            overrides = {},
            key = randomUUID(),
            who = f.a,
          ) => {
            const input = {
              docId: randomUUID(),
              revision: 1,
              template: "synthetic.document",
              templateRevision: 1,
              language: "ta",
              model: { title: "செயற்கை ஆவணம்", lines: ["சோதனை வரி ₹1,250.50"] },
              ...overrides,
            };
            const r = await request("", {
              who,
              method: "POST",
              body: input,
              key,
            });
            assert.equal(r.status, 200, "synthetic document issuance");
            return { input, key, status: await r.json() };
          };
          const composition = productionJobComposition(undefined, {
            adapters,
            renderer,
          });
          const job = async (d) => {
            const a = await transaction((c) =>
              c.repository.attempt(d.docId, d.revision),
            );
            return {
              shopId: f.a.shop,
              docId: d.docId,
              revision: d.revision,
              jobId: a.jobId,
              initiatorId: a.initiatorId,
              epoch: a.epoch,
            };
          };
          const process = async (d, before = async () => {}) =>
            composition.handlers.get("pdf.render")(
              f.parallel.db,
              await job(d),
              before,
            );
          await run({
            ...f,
            api,
            request,
            issue,
            host: host(),
            transaction,
            job,
            process,
            composition,
            renderer,
            storage,
            actual,
            maintenance,
            config,
            templates,
            documentRepository,
            setRenderFailure: (v) => {
              failRender = v;
            },
            setStorageFailure: (v) => {
              failStorage = v;
            },
            setAfterPut: (v) => {
              afterPut = v;
            },
            renderCount: () => renderCount,
          });
        },
        { documentAdapters: adapters },
      );
    } finally {
      if (boss) await boss.stop();
      actual.destroy();
      maintenance.destroy();
      await native?.close();
    }
  });
}
