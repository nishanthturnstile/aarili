import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initialShopProfile } from "@aarili/contracts/shop-profile";
import { reviseShopProfile } from "@aarili/core/shop-profile";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { shopProfileRepository } from "@aarili/db/shop-profile-repository";
import { test } from "vitest";
import { withMediaProcessing } from "../scripts/test-support/media-processing.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

function request(
  f,
  path = "",
  {
    who = f.a,
    method = "GET",
    body,
    key = randomUUID(),
    etag = '"v1"',
    origin = f.owner.origin,
    cookie = who.cookie,
  } = {},
) {
  return f.api.fetch(
    new Request(
      `${f.owner.origin}/api/shops/${who.shop}/settings/profile${path}`,
      {
        method,
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
          ...(etag ? { "If-Match": etag } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    ),
  );
}
async function ok(r) {
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
async function rejected(r, status, code) {
  assert.equal(r.status, status, await r.clone().text());
  assert.equal((await r.json()).error.code, code);
}
function run(f, fn, who = f.a) {
  return withShop(f.parallel.db, who.user, who.shop, (tx) =>
    fn(
      {
        shopId: who.shop,
        actorId: who.user,
        repository: shopProfileRepository(tx, who.shop),
        brandingAvailable: false,
      },
      tx,
    ),
  );
}
const totals = async (f) =>
  (
    await f.admin.query(
      "select (select count(*)::int from shop_profile_revision) revisions,(select count(*)::int from audit_event where action like 'shop-profile.%') audits,(select count(*)::int from idempotency_key where action='shop-profile.revise') keys",
    )
  ).rows[0];

test("SS-01/07/08/09 existing identity, immutable effective history, API scope, replay and concurrent CAS", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const tables = await assertIsolationCatalog(f.runtime.db);
    assert(tables.includes("public.shop_profile_revision"));
    const initial = await ok(await request(f));
    assert.equal(initial.version, 1);
    assert.equal(initial.revision, null);
    assert.equal(initial.profile.legalName, "");
    assert.equal(initial.brandingAvailable, false);
    const profile = {
        ...initial.profile,
        displayName: "Synthetic தமிழ் shop",
        tagline: "Synthetic private tagline",
      },
      key = randomUUID();
    await rejected(
      await request(f, "", { method: "PUT", body: profile, etag: null }),
      428,
      "PRECONDITION_REQUIRED",
    );
    await rejected(
      await request(f, "", {
        method: "PUT",
        body: { ...profile, retail: true },
      }),
      422,
      "VALIDATION_FAILED",
    );
    await rejected(
      await request(f, "", {
        method: "PUT",
        body: { ...profile, currency: "USD" },
      }),
      422,
      "VALIDATION_FAILED",
    );
    await rejected(
      await request(f, "", {
        method: "PUT",
        body: profile,
        origin: "https://invalid.example.test",
      }),
      403,
      "UNSAFE_ORIGIN",
    );
    await rejected(
      await request(f, "", { cookie: "" }),
      401,
      "UNAUTHENTICATED",
    );
    assert.deepEqual(await totals(f), { revisions: 0, audits: 0, keys: 0 });
    const results = await Promise.all(
      [key, key.toUpperCase()].map((key) =>
        request(f, "", { method: "PUT", body: profile, key }).then(ok),
      ),
    );
    assert.deepEqual(results[0], results[1]);
    assert.equal(results[0].version, 2);
    assert.deepEqual(await totals(f), { revisions: 2, audits: 2, keys: 1 });
    assert.equal(
      (await f.owner.ownerEntry(new Headers({ Cookie: f.a.cookie }))).data.shop
        .name,
      profile.displayName,
    );
    const history = await ok(
      await request(f, "/history", { method: "POST", body: {} }),
    );
    assert.equal(history.revisions.length, 2);
    assert.equal(history.revisions[1].baseline, true);
    assert.equal(
      history.revisions[1].profile.displayName,
      initial.profile.displayName,
    );
    const old = history.revisions[0],
      digest = createHash("sha256").update(JSON.stringify(old)).digest("hex");
    await rejected(
      await request(f, "", {
        method: "PUT",
        body: { ...profile, tagline: "Changed" },
        key,
      }),
      422,
      "IDEMPOTENCY_MISMATCH",
    );
    const writes = await Promise.all(
      ["One", "Two"].map((tagline) =>
        request(f, "", {
          method: "PUT",
          body: { ...profile, tagline },
          etag: '"v2"',
        }),
      ),
    );
    assert.deepEqual(writes.map((r) => r.status).sort(), [200, 412]);
    const conflict = await writes.find((r) => r.status === 412).json();
    assert.equal(conflict.current.version, 3);
    assert.equal(
      createHash("sha256")
        .update(
          JSON.stringify(await ok(await request(f, `/revisions/${old.id}`))),
        )
        .digest("hex"),
      digest,
    );
    await rejected(
      await request(f, `/revisions/${old.id}`, { who: f.b }),
      404,
      "NOT_FOUND",
    );
    await rejected(
      await f.api.fetch(
        new Request(
          `${f.owner.origin}/api/shops/${f.a.shop}/settings/profile`,
          { headers: { Cookie: f.b.cookie } },
        ),
      ),
      403,
      "SHOP_ACCESS_DENIED",
    );
    await rejected(await request(f, "?private=value"), 422, "INVALID_REQUEST");
    await run(f, async (_ctx, tx) => {
      assert.equal(
        (
          await tx.execute(
            sql`select count(*)::int as n from shop_profile_revision`,
          )
        ).rows[0].n,
        3,
      );
      await assert.rejects(
        tx.execute(
          sql`update shop_profile_revision set profile='{}'::jsonb where shop_id=${f.a.shop}::uuid`,
        ),
      );
    });
  });
});
test("SS-09 rollback, real two-connection replay, missing context and cross-shop references", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const input = initialShopProfile("Synthetic rollback name"),
      key = randomUUID();
    await assert.rejects(
      run(f, (ctx) =>
        reviseShopProfile(
          {
            ...ctx,
            repository: {
              ...ctx.repository,
              persist: async () => {
                throw Error("Injected key persistence failure");
              },
            },
          },
          input,
          { key, ifMatch: '"v1"', requestId: randomUUID() },
        ),
      ),
    );
    assert.deepEqual(await totals(f), { revisions: 0, audits: 0, keys: 0 });
    assert.notEqual(
      (await ok(await request(f))).profile.displayName,
      input.displayName,
    );
    const result = await Promise.all(
      [key, key.toUpperCase()].map((key) =>
        run(f, (ctx) =>
          reviseShopProfile(ctx, input, {
            key,
            ifMatch: '"v1"',
            requestId: randomUUID(),
          }),
        ),
      ),
    );
    assert.deepEqual(result[0], result[1]);
    assert.deepEqual(await totals(f), { revisions: 2, audits: 2, keys: 1 });
    await assert.rejects(
      run(f, (ctx) =>
        reviseShopProfile({ ...ctx, actorId: f.b.user }, input, {
          key,
          ifMatch: '"v1"',
          requestId: randomUUID(),
        }),
      ),
      (e) => e.code === "IDEMPOTENCY_MISMATCH",
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select * from shop_profile_revision`))
        .rowCount,
      0,
    );
    await assert.rejects(
      f.runtime.db.execute(
        sql`insert into shop_profile(shop_id,current_revision_id,version) values(${f.a.shop}::uuid,${result[0].revision.id}::uuid,2)`,
      ),
    );
    await assert.rejects(
      run(f, (_ctx, tx) =>
        tx.execute(
          sql`update shop set name='direct bypass' where shop_id=${f.a.shop}::uuid`,
        ),
      ),
    );
    await assert.rejects(
      run(
        f,
        (_ctx, tx) =>
          tx.execute(
            sql`insert into shop_profile(shop_id,current_revision_id,version) values(${f.a.shop}::uuid,${result[0].revision.id}::uuid,2)`,
          ),
        f.b,
      ),
    );
    await rejected(
      await request(f, "", {
        method: "PUT",
        body: { ...input, logoAssetId: randomUUID() },
        etag: '"v2"',
      }),
      409,
      "LOGO_NOT_READY",
    );
    const before = await totals(f);
    await assert.rejects(
      run(f, (ctx, tx) =>
        reviseShopProfile(
          {
            ...ctx,
            repository: {
              ...ctx.repository,
              append: async (r) => {
                const row = await ctx.repository.append(r);
                await tx.execute(sql`select 1/0`);
                return row;
              },
            },
          },
          { ...input, tagline: "rollback after audit" },
          { key: randomUUID(), ifMatch: '"v2"', requestId: randomUUID() },
        ),
      ),
    );
    assert.deepEqual(await totals(f), before);
  });
});
test("SS-01/07/09 shop logo uses real private storage, validation, immutable references and tenant authority", {
  timeout: 180000,
}, async () => {
  await withMediaProcessing(async (f) => {
    const sharp = createRequire(
      new URL("../packages/platform/package.json", import.meta.url),
    )("sharp");
    const bytes = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const admission = {
      subjectId: f.a.shop,
      purpose: "shop-branding",
      contentType: "image/png",
      size: bytes.length,
    };
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: { ...admission, subjectId: f.b.shop },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/uploads", {
          method: "POST",
          body: { ...admission, contentType: "application/pdf" },
        })
      ).status,
      422,
    );
    const grant = await ok(
      await f.request("/uploads", { method: "POST", body: admission }),
    );
    const profile = {
      ...initialShopProfile("Synthetic logo shop"),
      logoAssetId: grant.asset.id,
    };
    await rejected(
      await request(f, "", { method: "PUT", body: profile }),
      409,
      "LOGO_NOT_READY",
    );
    assert.equal(
      (
        await fetch(grant.upload.url, {
          method: "PUT",
          headers: grant.upload.headers,
          body: bytes,
        })
      ).status,
      200,
    );
    const attempt = await f.complete(grant);
    assert.equal(await f.process(grant, attempt), "accepted");
    const saved = await ok(
      await request(f, "", { method: "PUT", body: profile }),
    );
    assert.equal(saved.profile.logoAssetId, grant.asset.id);
    const link = await ok(await f.request(`/${grant.asset.id}/access`));
    assert.equal((await fetch(link.url)).status, 200);
    assert.equal(
      (await f.request(`/${grant.asset.id}/access`, { who: f.b })).status,
      404,
    );
    await rejected(
      await request(f, "", { who: f.b, method: "PUT", body: profile }),
      409,
      "LOGO_NOT_READY",
    );
    await ok(
      await request(f, "", {
        method: "PUT",
        etag: '"v2"',
        body: { ...profile, logoAssetId: null },
      }),
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int as n from media_reference where asset_id=$1",
          [grant.asset.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await ok(await request(f, `/revisions/${saved.revision.id}`))).profile
        .logoAssetId,
      grant.asset.id,
    );
    await assertIsolationCatalog(f.runtime.db);
  });
});
