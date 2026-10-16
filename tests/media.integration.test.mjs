import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import {
  cleanupMedia,
  completeMedia,
  MediaValidationFailure,
  processMedia,
} from "@aarili/core/media";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { mediaRepository } from "@aarili/db/media-repository";
import { startSyntheticQueue } from "@aarili/jobs";
import { mediaJobWriter, mediaProcessingHost } from "@aarili/jobs/media";
import { createMediaStorage } from "@aarili/platform/media-storage";
import { test } from "vitest";
import { withPrivateS3 } from "../scripts/test-support/private-s3.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const origin = "http://127.0.0.1:3103";
const payload = (subjectId) => ({
  subjectId,
  purpose: "order-document",
  contentType: "application/pdf",
  size: 13,
});
const validator = {
  async validate(bytes) {
    assert.equal(new TextDecoder().decode(bytes).startsWith("%PDF"), true);
    return bytes;
  },
};
async function fixture(run) {
  await withPrivateS3(async (config) => {
    const storage = createMediaStorage(config);
    let boss;
    let failQueue = false;
    let failStored = false;
    const factory = (tx, shopId) => ({
      policy: {
        async authorize({ subjectId }) {
          const r = await tx.execute(
            sql`select minor,(guardian_consent AND consent_by=guardian_id) as "guardianConsent",allowed from media_test_subject where shop_id=${shopId}::uuid and id=${subjectId}::uuid for share`,
          );
          return r.rows[0]?.allowed ? r.rows[0] : null;
        },
      },
      storage,
      jobs: {
        async enqueue(attempt) {
          await mediaJobWriter(boss, tx, shopId).enqueue(attempt);
          if (failQueue) throw Error("Injected enqueue rollback");
        },
      },
    });
    try {
      await withTenantFixture(
        async (f) => {
          await f.migration.query(
            `create table media_test_subject(shop_id uuid not null references shop(shop_id),id uuid not null,minor boolean not null default false,guardian_consent boolean not null default false,guardian_id uuid not null default gen_random_uuid(),payer_id uuid not null default gen_random_uuid(),consent_by uuid,allowed boolean not null default true,primary key(shop_id,id));alter table media_test_subject enable row level security;alter table media_test_subject force row level security;create policy tenant_context on media_test_subject as restrictive for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id));create policy tenant_access on media_test_subject for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id));grant select,update on media_test_subject to app_user;grant select on media_test_subject to app_backup;`,
          );
          await f.admin.query(
            "update system_state set side_effects_enabled=true",
          );
          const subject = randomUUID();
          await f.admin.query(
            "insert into media_test_subject(shop_id,id) values($1,$2)",
            [f.a.shop, subject],
          );
          boss = await startSyntheticQueue(f.runtime.db, "media.process");
          const ctx = (tx, who = f.a) => ({
            shopId: who.shop,
            actor: { type: "user", id: who.user },
            repository: mediaRepository(tx, who.shop),
            ...factory(tx, who.shop),
          });
          const transaction = (fn, who = f.a, pool = f.parallel) =>
            withShop(pool.db, who.user, who.shop, (tx) => fn(ctx(tx, who)));
          const host = mediaProcessingHost(
            f.parallel.db,
            f.a.shop,
            f.a.user,
            (tx) => factory(tx, f.a.shop),
          );
          // Instrumentation failure after the real accepted-media write is injected at
          // the outer transaction boundary to prove rollback, never a production switch.
          const failHost = {
            transaction: (fn) =>
              host.transaction(async (c) => {
                if (failStored) {
                  const actual = c.instrumentation;
                  c = {
                    ...c,
                    instrumentation: {
                      async stored(...args) {
                        await actual.stored(...args);
                        throw Error("Injected usage rollback");
                      },
                    },
                  };
                }
                return fn(c);
              }),
          };
          const request = (
            path,
            {
              who = f.a,
              method = "GET",
              body,
              key = randomUUID(),
              etag = '"v1"',
              cookie = who.cookie,
              extra = {},
            } = {},
          ) =>
            f.api.fetch(
              new Request(`${origin}/api/shops/${who.shop}/files${path}`, {
                method,
                headers: {
                  Origin: origin,
                  "Content-Type": "application/json",
                  Cookie: cookie,
                  "Idempotency-Key": key,
                  "If-Match": etag,
                  ...extra,
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              }),
            );
          const admit = async (data = payload(subject), key = randomUUID()) => {
            const r = await request("/uploads", {
              method: "POST",
              body: data,
              key,
            });
            assert.equal(
              r.status,
              200,
              "Private media fixture request rejected",
            );
            return r.json();
          };
          const upload = async (a, bytes = "%PDF-12345678") => {
            const r = await fetch(a.upload.url, {
              method: "PUT",
              headers: a.upload.headers,
              body: bytes,
            });
            assert.equal(r.status, 200);
          };
          const complete = async (a, key = randomUUID()) => {
            const r = await request(`/${a.asset.id}/complete`, {
              method: "POST",
              body: {},
              key,
            });
            assert.equal(
              r.status,
              200,
              "Private media fixture request rejected",
            );
            return r.json();
          };
          await run({
            ...f,
            config,
            storage,
            subject,
            transaction,
            ctx,
            host: failHost,
            request,
            admit,
            upload,
            complete,
            setQueueFailure: (v) => {
              failQueue = v;
            },
            setStoredFailure: (v) => {
              failStored = v;
            },
          });
        },
        { mediaAdapters: factory },
      );
    } finally {
      await boss?.stop();
      storage.destroy();
    }
  });
}
async function attempt(f, id) {
  return f.transaction((c) => c.repository.attempt(id));
}
async function expireLease(f, id) {
  await f.admin.query(
    "update media_attempt set lease_until=now()-interval '1 minute' where asset_id=$1",
    [id],
  );
}

test("0.4.3a G1/G2/G5/G6 TRU-01/03/05/07 AC-38/39/53 verified API, trusted guardian policy, private capabilities and forced RLS", async () => {
  await fixture(async (f) => {
    const noAuth = await f.request("/uploads", {
      method: "POST",
      body: payload(f.subject),
      cookie: "",
    });
    assert.equal(noAuth.status, 401);
    const foreign = await f.request("/uploads", {
      who: f.b,
      method: "POST",
      body: payload(f.subject),
    });
    assert.equal(foreign.status, 403);
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: { ...payload(f.subject), guardianConsent: true },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: { ...payload(f.subject), subjectId: randomUUID() },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: payload(f.subject),
          extra: { Origin: "https://foreign.invalid" },
        })
      ).status,
      403,
    );
    await f.admin.query(
      "update media_test_subject set minor=true where id=$1",
      [f.subject],
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: {
            ...payload(f.subject),
            purpose: "wearer-photo",
            contentType: "image/png",
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: {
            ...payload(f.subject),
            purpose: "manual-pattern",
            contentType: "image/png",
          },
        })
      ).status,
      403,
    );
    await f.admin.query(
      "update media_test_subject set guardian_consent=true,consent_by=guardian_id where id=$1",
      [f.subject],
    );
    await f.admin.query(
      "update media_test_subject set consent_by=payer_id where id=$1",
      [f.subject],
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: {
            ...payload(f.subject),
            purpose: "wearer-photo",
            contentType: "image/png",
          },
        })
      ).status,
      403,
      "a non-guardian payer cannot give guardian consent",
    );
    await f.admin.query(
      "update media_test_subject set consent_by=guardian_id where id=$1",
      [f.subject],
    );
    const minor = await f.admit({
      ...payload(f.subject),
      purpose: "wearer-photo",
      contentType: "image/png",
    });
    assert.equal(minor.asset.status, "pending_upload");
    const key = randomUUID();
    const a = await f.admit(payload(f.subject), key);
    assert(
      Number(new URL(a.upload.url).searchParams.get("X-Amz-Expires")) <= 300,
    );
    const repeated = await f.admit(payload(f.subject), key);
    assert.equal(repeated.asset.id, a.asset.id);
    assert.equal(repeated.upload.expiresAt, a.upload.expiresAt);
    assert.equal(
      (
        await fetch(a.upload.url, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: "bad",
        })
      ).status,
      403,
    );
    const expired = await f.storage.signPut(
      `shops/${f.a.shop}/staging/${a.asset.id}`,
      "application/pdf",
      1,
      new Date(Date.now() - 600000),
    );
    assert(
      (
        await fetch(expired, {
          method: "PUT",
          headers: a.upload.headers,
          body: "%PDF-12345678",
        })
      ).status >= 400,
    );
    assert.equal((await f.request(`/${a.asset.id}`)).status, 404);
    assert.equal((await f.request(`/${a.asset.id}`, { who: f.b })).status, 404);
    assert.equal(
      (await f.runtime.pool.query("select * from media_asset")).rowCount,
      0,
    );
    await withShop(f.runtime.db, f.b.user, f.b.shop, async (tx) =>
      assert.equal(
        (await tx.execute(sql`select * from media_asset`)).rowCount,
        0,
      ),
    );
    const tables = await assertIsolationCatalog(f.runtime.db);
    assert(tables.includes("public.media_asset"));
    assert(tables.includes("public.media_attempt"));
    const privateState = await f.admin.query(
      "select response::text from idempotency_key where key=$1",
      [key],
    );
    assert(!privateState.rows[0].response.includes("X-Amz"));
    assert(!privateState.rows[0].response.includes("staging"));
    await f.admin.query(
      "update media_test_subject set allowed=false where id=$1",
      [f.subject],
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: payload(f.subject),
          key,
        })
      ).status,
      403,
    );
    // Normal host has no synthetic authority adapter and cannot mint a capability.
    const productionApi = createApi(async () => true, {
      ...f.owner,
      withOwnerMedia: (headers, shopId, fn) =>
        f.owner.withOwnerMedia(headers, shopId, (c) =>
          fn({ ...c, policy: { authorize: async () => null } }),
        ),
    });
    const denied = await productionApi.fetch(
      new Request(`${origin}/api/shops/${f.a.shop}/files/uploads`, {
        method: "POST",
        headers: {
          Cookie: f.a.cookie,
          Origin: origin,
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(payload(f.subject)),
      }),
    );
    assert.equal(denied.status, 403);
  });
}, 120000);

test("0.4.3a G3/G4/G5/G8 real S3 PUT reuse, exact snapshot sealing, concurrent completion, immutable accepted history and event dedupe", async () => {
  await fixture(async (f) => {
    const admissionKey = randomUUID();
    const upper = await f.request("/uploads", {
      who: { ...f.a, shop: f.a.shop.toUpperCase() },
      method: "POST",
      body: { ...payload(f.subject), subjectId: f.subject.toUpperCase() },
      key: admissionKey.toUpperCase(),
    });
    assert.equal(upper.status, 200);
    const a = await upper.json();
    const lower = await f.admit(payload(f.subject), admissionKey.toLowerCase());
    assert.equal(lower.asset.id, a.asset.id);
    await f.upload(a);
    const key = randomUUID();
    const results = await Promise.all([
      f.complete(
        { ...a, asset: { ...a.asset, id: a.asset.id.toUpperCase() } },
        key.toUpperCase(),
      ),
      f.complete(a, key.toLowerCase()),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal(
      (await f.request(`/${a.asset.id}/complete`, { method: "POST", body: {} }))
        .status,
      409,
    );
    const p = await attempt(f, a.asset.id);
    assert.equal(
      (
        await f.admin.query(
          "select * from pgboss.job where name='media.process'",
        )
      ).rowCount,
      1,
    );
    let snapshot;
    let validatorOwned;
    const mutatingValidator = {
      async validate(bytes, asset) {
        snapshot = new Uint8Array(bytes);
        validatorOwned = bytes;
        await f.upload(a, "%PDF-CHANGED!");
        return validator.validate(bytes, asset);
      },
    };
    const ownedBufferHost = {
      transaction: (fn) =>
        f.host.transaction((c) =>
          fn({
            ...c,
            storage: {
              ...c.storage,
              async seal(...args) {
                validatorOwned.fill(0);
                return c.storage.seal(...args);
              },
            },
          }),
        ),
    };
    assert.equal(
      await processMedia(ownedBufferHost, a.asset.id, p.id, mutatingValidator),
      "accepted",
    );
    assert.equal(
      await processMedia(f.host, a.asset.id, p.id, validator),
      "ignored",
    );
    await f.upload(a, "%PDF-REUSED!!");
    const linkResponse = await f.request(`/${a.asset.id}/access`);
    assert.equal(linkResponse.status, 200);
    assert.equal(linkResponse.headers.get("cache-control"), "no-store");
    const link = await linkResponse.json();
    const download = await fetch(link.url);
    assert.equal(download.status, 200);
    assert.deepEqual(new Uint8Array(await download.arrayBuffer()), snapshot);
    assert.match(
      download.headers.get("content-disposition"),
      /^attachment; filename="file-/,
    );
    const redirect = await f.request(`/${a.asset.id}`);
    assert.equal(redirect.status, 303);
    assert.equal(redirect.headers.get("cache-control"), "no-store");
    assert.equal(redirect.headers.get("referrer-policy"), "no-referrer");
    assert(redirect.headers.has("location"));
    const redirectDownload = await fetch(redirect.headers.get("location"));
    assert.equal(redirectDownload.status, 200);
    assert.deepEqual(
      new Uint8Array(await redirectDownload.arrayBuffer()),
      snapshot,
    );
    const row = await f.transaction((c) => c.repository.read(a.asset.id));
    assert.notEqual(row.stagingKey, row.acceptedKey);
    assert.equal(row.acceptedBytes, snapshot.length);
    assert.equal(
      row.sha256,
      createHash("sha256").update(snapshot).digest("hex"),
    );
    await assert.rejects(
      f.storage.seal(row.acceptedKey, new Uint8Array([1]), row.contentType),
      /key rejected/,
    );
    const prefix = row.acceptedKey.slice(0, row.acceptedKey.lastIndexOf("/"));
    const siblingKeys = await Promise.all([
      f.storage.seal(prefix, new Uint8Array([1]), row.contentType),
      f.storage.seal(prefix, new Uint8Array([2]), row.contentType),
    ]);
    assert.notEqual(siblingKeys[0], siblingKeys[1]);
    assert(!siblingKeys.includes(row.acceptedKey));
    assert.deepEqual(
      new Uint8Array(await (await fetch(link.url)).arrayBuffer()),
      snapshot,
    );
    assert.equal(
      (
        await f.admin.query(
          "select * from product_event where subject_id=$1 and name='media.stored'",
          [a.asset.id],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      await f.transaction((c) => c.repository.expire(a.asset.id)),
      false,
    );
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`update media_asset set status='deleted',version=version+1 where shop_id=${f.a.shop}::uuid and id=${a.asset.id}::uuid`,
        ),
      ),
      (e) => e.cause?.code === "42501",
    );
    await f.admin.query(
      "update media_test_subject set allowed=false where id=$1",
      [f.subject],
    );
    assert.equal((await f.request(`/${a.asset.id}`)).status, 404);
    assert.equal(
      (await fetch(link.url)).status,
      200,
      "previously issued grant remains usable until expiry; no immediate revocation claim",
    );
  });
}, 120000);

test("0.4.3a G3/G4/G8 queue/database rollback, storage failure, crash lease retry, post-I/O authority/epoch/fence veto and private orphan evidence", async () => {
  await fixture(async (f) => {
    const a = await f.admit();
    await f.upload(a);
    const key = randomUUID();
    f.setQueueFailure(true);
    assert.equal(
      (
        await f.request(`/${a.asset.id}/complete`, {
          method: "POST",
          body: {},
          key,
        })
      ).status,
      503,
    );
    f.setQueueFailure(false);
    assert.equal(
      (await f.transaction((c) => c.repository.read(a.asset.id))).status,
      "pending_upload",
    );
    assert.equal(
      (await f.admin.query("select * from media_attempt")).rowCount,
      0,
    );
    assert.equal(
      (await f.admin.query("select * from idempotency_key where key=$1", [key]))
        .rowCount,
      0,
    );
    assert.equal(
      (
        await f.admin.query(
          "select * from pgboss.job where name='media.process'",
        )
      ).rowCount,
      0,
    );
    await f.complete(a, key);
    const p = await attempt(f, a.asset.id);
    const brokenHost = {
      transaction: (fn) =>
        f.host.transaction((c) =>
          fn({
            ...c,
            storage: {
              ...c.storage,
              seal: async () => {
                throw Error("Injected seal failure");
              },
            },
          }),
        ),
    };
    await assert.rejects(
      processMedia(brokenHost, a.asset.id, p.id, validator),
      /seal failure/,
    );
    assert.equal(
      (await f.transaction((c) => c.repository.read(a.asset.id))).status,
      "processing",
    );
    const released = await attempt(f, a.asset.id);
    assert(
      Date.parse(released.leaseUntil) <=
        (await f.transaction((c) => c.repository.now())).getTime(),
      "caught infrastructure failure releases only its owned technical lease",
    );
    // Explicitly establish an unexpired technical lease to retain the separate
    // claimant-exclusion proof. A caught failure is now immediately retryable.
    await f.admin.query(
      "update media_attempt set lease_until=now()+interval '5 minutes' where id=$1",
      [p.id],
    );
    assert.equal(
      await processMedia(f.host, a.asset.id, p.id, validator),
      "ignored",
      "active lease prevents a second claimant",
    );
    await expireLease(f, a.asset.id);
    f.setStoredFailure(true);
    await assert.rejects(
      processMedia(f.host, a.asset.id, p.id, validator),
      /usage rollback/,
    );
    f.setStoredFailure(false);
    assert.equal(
      (await f.transaction((c) => c.repository.read(a.asset.id))).acceptedKey,
      null,
    );
    assert.equal(
      (
        await f.admin.query("select * from product_event where subject_id=$1", [
          a.asset.id,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      await processMedia(f.host, a.asset.id, p.id, validator),
      "accepted",
    );
    // Every external-I/O veto leaves a private, unaccepted fence key reconstructible
    // from the committed media.claim audit. No accepted key is ever overwritten.
    for (const veto of ["authority", "epoch", "fence", "key"]) {
      const b = await f.admit();
      await f.upload(b);
      await f.complete(b);
      const q = await attempt(f, b.asset.id);
      const host = {
        transaction: (fn) =>
          f.host.transaction((c) =>
            fn({
              ...c,
              storage: {
                ...c.storage,
                async seal(...args) {
                  const sealedKey = await c.storage.seal(...args);
                  if (veto === "authority")
                    await f.admin.query(
                      "update media_test_subject set allowed=false where id=$1",
                      [f.subject],
                    );
                  if (veto === "epoch")
                    await f.admin.query(
                      "update system_state set restore_epoch=uuidv7()",
                    );
                  if (veto === "fence")
                    await f.admin.query(
                      "update media_attempt set fence=uuidv7() where id=$1",
                      [q.id],
                    );
                  if (veto === "key")
                    return `shops/${randomUUID()}/private/${b.asset.id}/${q.id}/${randomUUID()}`;
                  return sealedKey;
                },
              },
            }),
          ),
      };
      if (veto === "key")
        await assert.rejects(
          processMedia(host, b.asset.id, q.id, validator),
          /MEDIA_UNAVAILABLE/,
        );
      else if (veto === "authority")
        await assert.rejects(
          processMedia(host, b.asset.id, q.id, validator),
          /MEDIA_ACCESS_DENIED/,
        );
      else
        assert.equal(
          await processMedia(host, b.asset.id, q.id, validator),
          "orphaned",
        );
      assert.equal(
        (await f.transaction((c) => c.repository.read(b.asset.id))).acceptedKey,
        null,
      );
      assert(
        (
          await f.admin.query(
            "select * from audit_event where entity_id=$1 and action='media.claim'",
            [b.asset.id],
          )
        ).rowCount >= 1,
      );
      await f.admin.query(
        "update media_test_subject set allowed=true where id=$1",
        [f.subject],
      );
    }

    // A forged locator may nominate another real, verified same-shop owner.
    // Current membership alone must not replace the durable original initiator.
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    const revoked = await f.admit();
    await f.upload(revoked);
    await f.complete(revoked);
    const original = await attempt(f, revoked.asset.id);
    await f.admin.query(
      "update auth_user set email_verified=false where id=$1",
      [f.a.user],
    );
    const alternate = mediaProcessingHost(
      f.parallel.db,
      f.a.shop,
      f.b.user,
      (tx) => {
        const c = f.ctx(tx, { ...f.b, shop: f.a.shop });
        return { policy: c.policy, storage: c.storage, jobs: c.jobs };
      },
    );
    assert.equal(
      await processMedia(alternate, revoked.asset.id, original.id, validator),
      "ignored",
    );
    assert.equal((await attempt(f, revoked.asset.id)).fence, null);
    assert.equal(
      (await f.transaction((c) => c.repository.read(revoked.asset.id)))
        .acceptedKey,
      null,
    );
    await f.admin.query(
      "update auth_user set email_verified=true where id=$1",
      [f.a.user],
    );
    // Both post-I/O finalization paths bind the same durable initiator, even if
    // a faulty host substitutes another actor after the claim transaction.
    for (const finalize of ["accept", "quarantine"]) {
      const item = await f.admit();
      await f.upload(item);
      await f.complete(item);
      const ownAttempt = await attempt(f, item.asset.id);
      let substitute = false;
      const changingHost = {
        transaction: (fn) =>
          f.host.transaction((c) =>
            fn({
              ...c,
              actor: substitute ? { type: "user", id: f.b.user } : c.actor,
              storage: {
                ...c.storage,
                async seal(...args) {
                  const key = await c.storage.seal(...args);
                  substitute = true;
                  return key;
                },
              },
            }),
          ),
      };
      const checker =
        finalize === "accept"
          ? validator
          : {
              async validate() {
                substitute = true;
                throw new MediaValidationFailure();
              },
            };
      assert.equal(
        await processMedia(changingHost, item.asset.id, ownAttempt.id, checker),
        "orphaned",
      );
      assert.equal(
        (await f.transaction((c) => c.repository.read(item.asset.id))).status,
        "processing",
      );
      assert.equal(
        (
          await f.admin.query(
            "select * from product_event where subject_id=$1",
            [item.asset.id],
          )
        ).rowCount,
        0,
      );
    }
    const racing = await f.admit();
    await f.upload(racing);
    const differentKeys = await Promise.all([
      f.request(`/${racing.asset.id}/complete`, {
        method: "POST",
        body: {},
        key: randomUUID(),
      }),
      f.request(`/${racing.asset.id}/complete`, {
        method: "POST",
        body: {},
        key: randomUUID(),
      }),
    ]);
    assert.deepEqual(differentKeys.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (
        await f.admin.query("select * from media_attempt where asset_id=$1", [
          racing.asset.id,
        ])
      ).rowCount,
      1,
    );
  });
}, 120000);

test("0.4.3a G4/G6/G7/G8 SQL provenance/null checks and abandoned cleanup storage/transaction races", async () => {
  await fixture(async (f) => {
    const a = await f.admit();
    await f.upload(a);
    // Direct SQL under real runtime tenant context cannot forge initial accepted attempt.
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into media_attempt(shop_id,id,asset_id,initiator_id,restore_epoch,state,fence,lease_until) select ${f.a.shop}::uuid,uuidv7(),${a.asset.id}::uuid,${f.a.user}::uuid,restore_epoch,'accepted',uuidv7(),now() from system_state`,
        ),
      ),
      (e) => e.cause?.code === "42501",
    );
    // Forge ready metadata on a processing row; NULL checksum/bytes must fail CHECK.
    await f.complete(a);
    await assert.rejects(
      withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`update media_asset set status='ready',version=version+1,accepted_key='shops/'||shop_id::text||'/private/'||id::text||'/'||id::text where id=${a.asset.id}::uuid`,
        ),
      ),
      (e) => e.cause?.code === "23514",
    );
    assert.equal(
      await f.transaction((c) => cleanupMedia(c, a.asset.id, 300)),
      false,
      "active attempt excluded",
    );
    const b = await f.admit();
    await f.upload(b);
    await f.admin.query(
      "alter table media_asset disable trigger media_asset_guard",
    );
    await f.admin.query(
      "update media_asset set staging_expires_at=now()-interval '15 minutes' where id=$1",
      [b.asset.id],
    );
    await f.admin.query(
      "alter table media_asset enable trigger media_asset_guard",
    );
    const result = await Promise.all([
      f.transaction((c) => cleanupMedia(c, b.asset.id, 300)),
      f
        .transaction((c) =>
          completeMedia(
            c,
            b.asset.id,
            {},
            { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
          ),
        )
        .then(
          () => "unexpected",
          () => "closed",
        ),
    ]);
    assert.equal(result[0], true);
    assert.equal(result[1], "closed");
    assert.equal(
      await f.transaction((c) => cleanupMedia(c, b.asset.id, 300)),
      true,
    );
    const stagedKey = `shops/${f.a.shop}/staging/${b.asset.id}`;
    await assert.rejects(f.storage.snapshot(stagedKey, 12), /read failed/);
    const c = await f.admit();
    await f.admin.query(
      "insert into media_reference(shop_id,asset_id,reference_id) values($1,$2,$3)",
      [f.a.shop, c.asset.id, randomUUID()],
    );
    await f.admin.query(
      "alter table media_asset disable trigger media_asset_guard",
    );
    await f.admin.query(
      "update media_asset set staging_expires_at=now()-interval '15 minutes' where id=$1",
      [c.asset.id],
    );
    await f.admin.query(
      "alter table media_asset enable trigger media_asset_guard",
    );
    assert.equal(
      await f.transaction((ctx) => cleanupMedia(ctx, c.asset.id, 300)),
      false,
    );
    assert.equal((await f.request(`/${b.asset.id}`)).status, 404);
    const rejected = await f.admit();
    await f.upload(rejected);
    await f.complete(rejected);
    const rejectedAttempt = await attempt(f, rejected.asset.id);
    assert.equal(
      await processMedia(f.host, rejected.asset.id, rejectedAttempt.id, {
        async validate() {
          throw new MediaValidationFailure();
        },
      }),
      "quarantined",
    );
    assert.equal((await f.request(`/${rejected.asset.id}`)).status, 404);
    // Both reference/cleanup lock orders: references already committed exclude
    // removal; a cleanup holder rejects a waiter from creating a late reference.
    const race = await f.admit();
    await f.admin.query(
      "alter table media_asset disable trigger media_asset_guard",
    );
    await f.admin.query(
      "update media_asset set staging_expires_at=now()-interval '15 minutes' where id=$1",
      [race.asset.id],
    );
    await f.admin.query(
      "alter table media_asset enable trigger media_asset_guard",
    );
    let removing;
    const held = new Promise((r) => {
      removing = r;
    });
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const cleanup = f.transaction((ctx) =>
      cleanupMedia(
        {
          ...ctx,
          storage: {
            ...ctx.storage,
            async removeStaging(key) {
              removing();
              await gate;
              return ctx.storage.removeStaging(key);
            },
          },
        },
        race.asset.id,
        300,
      ),
    );
    await held;
    const reference = withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
      tx.execute(
        sql`insert into media_reference(shop_id,asset_id,reference_id) values(${f.a.shop}::uuid,${race.asset.id}::uuid,${randomUUID()}::uuid)`,
      ),
    );
    release();
    assert.equal(await cleanup, true);
    await assert.rejects(reference, (e) => e.cause?.code === "42501");
  });
}, 120000);
