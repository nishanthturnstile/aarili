import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { sql, withShop } from "@aarili/db";
import { mediaRepository } from "@aarili/db/media-repository";
import { startSyntheticQueue } from "@aarili/jobs";
import { mediaJobWriter, mediaProcessingHost } from "@aarili/jobs/media";
import { productionJobComposition } from "@aarili/jobs/production";
import { createMediaStorage } from "@aarili/platform/media-storage";
import { withPrivateS3 } from "./private-s3.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";
export async function withMediaProcessing(run) {
  await withPrivateS3(async (config) => {
    const actualStorage = createMediaStorage(config);
    let boss,
      failSnapshot = false,
      failSeal = 0,
      seals = 0;
    const storage = {
      ...actualStorage,
      async snapshot(...args) {
        if (failSnapshot) throw Error("Injected private read failure");
        return actualStorage.snapshot(...args);
      },
      async seal(...args) {
        seals++;
        if (failSeal && seals === failSeal)
          throw Error("Injected private write failure");
        return actualStorage.seal(...args);
      },
    };
    const adapters = (tx, shopId) => ({
      policy: {
        async authorize({ subjectId }) {
          const result = await tx.execute(
            sql`select allowed,minor,guardian_consent as "guardianConsent" from media_processing_subject where shop_id=${shopId}::uuid and id=${subjectId}::uuid for share`,
          );
          const r = result.rows[0];
          return r?.allowed ? r : null;
        },
      },
      storage,
      jobs: {
        enqueue: (attempt) => mediaJobWriter(boss, tx, shopId).enqueue(attempt),
        status: (attempt) => mediaJobWriter(boss, tx, shopId).status(attempt),
      },
    });
    try {
      await withTenantFixture(
        async (f) => {
          await f.migration.query(
            `create table media_processing_subject(shop_id uuid not null references shop(shop_id),id uuid not null,allowed boolean not null default true,minor boolean not null default false,guardian_consent boolean not null default false,primary key(shop_id,id));alter table media_processing_subject enable row level security;alter table media_processing_subject force row level security;create policy tenant_context on media_processing_subject as restrictive for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id));create policy tenant_access on media_processing_subject for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id));grant select,update on media_processing_subject to app_user;grant select on media_processing_subject to app_backup;`,
          );
          await f.admin.query(
            "update system_state set side_effects_enabled=true",
          );
          const subjectId = randomUUID();
          await f.admin.query(
            "insert into media_processing_subject(shop_id,id) values($1,$2)",
            [f.a.shop, subjectId],
          );
          boss = await startSyntheticQueue(f.runtime.db, "media.process");
          const api = createApi(async () => true, {
            ...f.owner,
            async withOwnerMedia(...args) {
              try {
                return await f.owner.withOwnerMedia(...args);
              } catch (error) {
                console.info("Synthetic media request failure", {
                  name: error?.name,
                  pgCode: error?.cause?.code ?? error?.code,
                });
                throw error;
              }
            },
          });
          const request = (
            path,
            {
              who = f.a,
              method = "GET",
              body,
              key = randomUUID(),
              etag = '"v1"',
            } = {},
          ) =>
            api.fetch(
              new Request(
                `${f.owner.origin}/api/shops/${who.shop}/files${path}`,
                {
                  method,
                  headers: {
                    Origin: f.owner.origin,
                    Cookie: who.cookie,
                    "Content-Type": "application/json",
                    "Idempotency-Key": key,
                    "If-Match": etag,
                  },
                  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                },
              ),
            );
          const transaction = (run, who = f.a) =>
            withShop(f.parallel.db, who.user, who.shop, (tx) =>
              run({
                shopId: who.shop,
                actor: { type: "user", id: who.user },
                repository: mediaRepository(tx, who.shop),
                ...adapters(tx, who.shop),
              }),
            );
          const host = mediaProcessingHost(
            f.parallel.db,
            f.a.shop,
            f.a.user,
            (tx) => adapters(tx, f.a.shop),
          );
          const composition = productionJobComposition(adapters);
          const admission = async (bytes, type = "image/jpeg") => {
            const purpose = type.startsWith("image/")
              ? "wearer-photo"
              : type.startsWith("audio/")
                ? "voice-note"
                : "order-document";
            const response = await request("/uploads", {
              method: "POST",
              body: {
                subjectId,
                purpose,
                contentType: type,
                size: bytes.length,
              },
            });
            assert.equal(response.status, 200);
            const grant = await response.json();
            const put = await fetch(grant.upload.url, {
              method: "PUT",
              headers: grant.upload.headers,
              body: bytes,
            });
            assert.equal(put.status, 200);
            return grant;
          };
          const complete = async (grant) => {
            const response = await request(`/${grant.asset.id}/complete`, {
              method: "POST",
              body: {},
            });
            assert.equal(response.status, 200);
            await response.arrayBuffer();
            return (
              await f.admin.query(
                "select id,restore_epoch from media_attempt where shop_id=$1 and asset_id=$2",
                [f.a.shop, grant.asset.id],
              )
            ).rows[0];
          };
          const process = async (
            grant,
            attempt,
            beforeCommit = async () => {},
          ) =>
            composition.handlers.get("media.process")(
              f.parallel.db,
              {
                shopId: f.a.shop,
                assetId: grant.asset.id,
                attemptId: attempt.id,
                initiatorId: f.a.user,
                epoch: attempt.restore_epoch,
              },
              beforeCommit,
            );
          await run({
            ...f,
            subjectId,
            api,
            storage,
            actualStorage,
            adapters,
            composition,
            host,
            request,
            transaction,
            admission,
            complete,
            process,
            boss,
            config,
            failRead(value) {
              failSnapshot = value;
            },
            failWrite(index) {
              seals = 0;
              failSeal = index;
            },
          });
        },
        { mediaAdapters: adapters },
      );
    } finally {
      if (boss) await boss.stop();
      actualStorage.destroy();
    }
  });
}
