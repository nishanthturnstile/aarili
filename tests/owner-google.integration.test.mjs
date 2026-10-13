import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createApi } from "@aarili/api";
import { createOwnerAuth } from "@aarili/auth";
import pg from "pg";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { syntheticGoogle } from "../scripts/test-support/google-provider.mjs";
import { withPostgres } from "../scripts/test-support/postgres.mjs";

const origin = "http://127.0.0.1:3103";
const input = {
  name: "Synthetic owner",
  email: "owner@example.test",
  password: "synthetic-google-password-14",
  shopName: "சோதனைக் கடை",
};
const cookies = (response) =>
  response.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
function request(owner, path, body, cookie = "", extra = {}, method = "POST") {
  return createApi(async () => true, owner).fetch(
    new Request(`${origin}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function fixture(run) {
  await withPostgres(
    async ({ connectionString, migrationConnectionString }) => {
      await migrateDatabase(migrationConnectionString);
      const runtime = new pg.Pool({ connectionString });
      const migration = new pg.Pool({
        connectionString: migrationConnectionString,
      });
      const captures = [];
      const owners = [];
      const provider = syntheticGoogle();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (url, init) => {
        const address = String(url instanceof Request ? url.url : url);
        if (address.startsWith("https://"))
          return provider.transport(url, init);
        return originalFetch(url, init);
      };
      const secret = randomBytes(32).toString("hex");
      const setupToken = randomBytes(32).toString("hex");
      const allowedEmails = [input.email];
      function make(extra = {}) {
        const owner = createOwnerAuth({
          connectionString,
          origin,
          secret,
          setupToken,
          capture: async (m) => captures.push(m),
          policy: { signInMax: 1000, setupMax: 1000, reauthMax: 1000 },
          google: {
            clientId: "synthetic-google-client-14",
            clientSecret: "synthetic-google-secret-14",
            approvedOrigin: origin,
            environment: "development",
            allowedEmails,
          },
          ...extra,
        });
        owners.push(owner);
        return owner;
      }
      const owner = make();
      try {
        await owner.admit(input, setupToken, randomUUID());
        await owner.verify(captures.at(-1).code);
        const signed = await request(owner, "/auth/sign-in/email", {
          email: input.email,
          password: input.password,
        });
        assert.equal(signed.status, 200);
        const cookie = cookies(signed);
        await owner.complete(new Headers({ Cookie: cookie }));
        async function start(link = true, cookieValue = cookie, body = {}) {
          const response = await request(
            owner,
            link ? "/auth/link-social" : "/auth/sign-in/social",
            { provider: "google", ...body },
            cookieValue,
          );
          assert.equal(response.status, 200, await response.clone().text());
          const url = (await response.json()).url;
          return { url, cookie: `${cookieValue}; ${cookies(response)}` };
        }
        const callback = (flow, profile = {}) =>
          request(
            owner,
            provider.issue(flow.url, profile).replace(`${origin}/api`, ""),
            undefined,
            flow.cookie,
            {},
            "GET",
          );
        async function counts() {
          // FORCE RLS also hides tenant rows from app_owner without context.
          // Count the actual owner membership as app_user, never an empty view.
          const inspector = await runtime.connect();
          try {
            await inspector.query("begin");
            await inspector.query(
              "select set_config('app.user_id',(select user_id::text from owner_bootstrap),true)",
            );
            const snapshot = (
              await inspector.query(
                "select (select count(*)::int from auth_user) as users, (select count(*)::int from shop_membership) as members, (select count(*)::int from auth_account) as accounts, (select count(*)::int from auth_connection_event) as events",
              )
            ).rows[0];
            assert.equal(
              snapshot.members,
              1,
              "The real protected owner membership must remain present",
            );
            return snapshot;
          } finally {
            await inspector.query("rollback");
            inspector.release();
          }
        }
        await run({
          owner,
          make,
          runtime,
          migration,
          provider,
          captures,
          cookie,
          start,
          callback,
          counts,
          allowedEmails,
        });
      } finally {
        globalThis.fetch = originalFetch;
        await Promise.all(owners.map((o) => o.close()));
        await runtime.end();
        await migration.end();
      }
    },
  );
}
test("0.2.1c C1/C3/C5 explicit owner Google link, original session and disconnect retain credential/recovery and provenance", async () => {
  await fixture(
    async ({
      owner,
      cookie,
      start,
      callback,
      counts,
      runtime,
      migration,
      captures,
      allowedEmails,
    }) => {
      const before = await counts();
      const provenance = (await runtime.query("select * from owner_bootstrap"))
        .rows;
      const implicit = await callback(await start(false, ""));
      assert.equal(
        implicit.headers.get("Location"),
        `${origin}/sign-in#google-denied`,
      );
      assert.deepEqual(await counts(), before);
      const linked = await callback(await start());
      assert.equal(
        linked.headers.get("Location"),
        `${origin}/connections#google-linked`,
      );
      assert.deepEqual(await counts(), {
        ...before,
        accounts: before.accounts + 1,
        events: 1,
      });
      const signIn = await callback(await start(false, ""));
      assert.equal(signIn.headers.get("Location"), `${origin}/owner`);
      const session = await owner.ownerShop(
        new Headers({ Cookie: cookies(signIn) }),
      );
      assert.equal(session.data.shopId, provenance[0].shop_id);
      assert.deepEqual(
        (
          await runtime.query(
            "select access_token,refresh_token,id_token from auth_account where provider_id='google'",
          )
        ).rows[0],
        { access_token: null, refresh_token: null, id_token: null },
      );
      allowedEmails.splice(0);
      await assert.rejects(
        owner.ownerShop(new Headers({ Cookie: cookies(signIn) })),
      );
      assert.equal(
        (await callback(await start(false, ""))).headers.get("Location"),
        `${origin}/sign-in#google-denied`,
      );
      allowedEmails.push(input.email);
      assert.equal(
        (await request(owner, "/owner/google/disconnect", undefined, cookie))
          .status,
        200,
      );
      await assert.rejects(
        owner.ownerShop(new Headers({ Cookie: cookies(signIn) })),
      );
      assert.equal(
        (await callback(await start(false, ""))).headers.get("Location"),
        `${origin}/sign-in#google-denied`,
      );
      const credential = await runtime.query(
        "select id from auth_account where provider_id='credential'",
      );
      const resumed = await request(owner, "/auth/sign-in/email", {
        email: input.email,
        password: input.password,
      });
      assert.equal(
        (
          await request(
            owner,
            "/auth/unlink-account",
            { accountId: credential.rows[0].id },
            cookies(resumed),
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(owner, "/auth/sign-in/email", {
            email: input.email,
            password: input.password,
          })
        ).status,
        200,
      );
      await owner.requestRecovery(input.email);
      assert.equal(captures.at(-1).purpose, "reset");
      assert.deepEqual(
        (await runtime.query("select * from owner_bootstrap")).rows,
        provenance,
      );
      const history = await migration.query(
        "select user_id,session_id,action from auth_connection_event order by created_at",
      );
      assert.deepEqual(
        history.rows.map((r) => r.action),
        ["linked", "disconnected"],
      );
      assert(
        history.rows.every(
          (r) => r.user_id === provenance[0].user_id && r.session_id,
        ),
      );
      await assert.rejects(runtime.query("delete from auth_connection_event"));
      await assert.rejects(
        migration.query("update auth_connection_event set action='linked'"),
      );
    },
  );
}, 60000);

test("0.2.1c C4 a valid callback queued behind rejected native state cannot race rollback and consumption", async () => {
  await fixture(async ({ owner, make, start, provider, runtime, counts }) => {
    let release;
    let reached;
    const wait = new Promise((resolve) => {
      release = resolve;
    });
    const checkpoint = new Promise((resolve) => {
      reached = resolve;
    });
    const controlled = make({
      checkpoint: async (step) => {
        if (step === "google-state-consumed") {
          reached();
          await wait;
        }
      },
    });
    const before = await counts();
    const flow = await start();
    const validURL = provider.issue(flow.url).replace(`${origin}/api`, "");
    const invalidURL = validURL.replace(/code=[^&]+/, "code=invalid");
    const rejected = request(
      controlled,
      invalidURL,
      undefined,
      flow.cookie,
      {},
      "GET",
    );
    await checkpoint;
    const queued = request(owner, validURL, undefined, flow.cookie, {}, "GET");
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        const waiting = await runtime.query(
          "select 1 from pg_stat_activity where usename=current_user and wait_event='advisory' and query like '%pg_advisory_xact_lock(120023)%'",
        );
        if (waiting.rowCount) {
          blocked = true;
          break;
        }
        await delay(10);
      }
    } finally {
      release();
    }
    const result = await Promise.all([rejected, queued]);
    assert.equal(
      blocked,
      true,
      "The second native callback must actually queue on the database lock",
    );
    assert(
      result.every((r) =>
        r.headers.get("Location")?.endsWith("#google-denied"),
      ),
    );
    assert.deepEqual(await counts(), before);
    assert.equal(
      (
        await runtime.query(
          "select count(*)::int as n from auth_verification where identifier=$1",
          [`auth-state:${new URL(flow.url).searchParams.get("state")}`],
        )
      ).rows[0].n,
      0,
    );
  });
}, 60000);

test("0.2.1c C5 disconnect requires a usable credential; failed disconnect rolls back account, sessions and attribution", async () => {
  await fixture(
    async ({ owner, make, cookie, start, callback, runtime, counts }) => {
      assert.equal(
        (await callback(await start())).headers.get("Location"),
        `${origin}/connections#google-linked`,
      );
      const credential = (
        await runtime.query(
          "select id,password from auth_account where provider_id='credential'",
        )
      ).rows[0];
      const before = await counts();
      const sessions = (
        await runtime.query("select * from auth_session order by id")
      ).rows;
      assert.equal(
        (
          await request(
            owner,
            "/auth/unlink-account",
            { accountId: credential.id },
            cookie,
          )
        ).status,
        403,
      );
      await runtime.query("update auth_account set password=null where id=$1", [
        credential.id,
      ]);
      assert.equal(
        (await request(owner, "/owner/google/disconnect", undefined, cookie))
          .status,
        403,
      );
      assert.deepEqual(await counts(), before);
      await runtime.query("update auth_account set password=$1 where id=$2", [
        credential.password,
        credential.id,
      ]);
      const failing = make({
        checkpoint: async (step) => {
          if (step === "google-written")
            throw new Error("synthetic disconnect failure");
        },
      });
      assert.equal(
        (await request(failing, "/owner/google/disconnect", undefined, cookie))
          .status,
        503,
      );
      assert.deepEqual(await counts(), before);
      assert.deepEqual(
        (await runtime.query("select * from auth_session order by id")).rows,
        sessions,
      );
      const success = await request(
        owner,
        "/owner/google/disconnect",
        undefined,
        cookie,
      );
      assert.equal(success.status, 200);
      assert.match(success.headers.getSetCookie().join(";"), /Max-Age=0/i);
      assert.equal(
        (await runtime.query("select count(*)::int as n from auth_session"))
          .rows[0].n,
        0,
      );
      assert.equal((await counts()).events, before.events + 1);
    },
  );
}, 60000);
test("0.2.1c C2/C3 closed Google signup and strict verified-email admission on native link and sign-in callbacks", async () => {
  await fixture(async ({ owner, cookie, start, callback, counts }) => {
    for (const profile of [
      { email: "new@example.test" },
      { email: "owner+alias@example.test" },
      { email: undefined },
      { email: "" },
      { email_verified: false },
      { email_verified: undefined },
      { email_verified: "true" },
    ]) {
      for (const linking of [true, false]) {
        const before = await counts();
        const rejected = await callback(
          await start(linking, linking ? cookie : "", { requestSignUp: true }),
          profile,
        );
        assert.equal(rejected.status, 302);
        assert.match(rejected.headers.get("Location"), /#google-denied$/);
        assert.deepEqual(await counts(), before);
      }
    }
    for (const path of [
      "/auth/sign-up/email",
      "/auth/sign-up/social",
      "/auth/sign-in/oauth2",
      "/auth/oauth2/callback/google",
      "/auth/get-access-token",
      "/auth/account-info",
      "/auth/refresh-token",
    ]) {
      const before = await counts();
      assert.equal(
        (await request(owner, path, { provider: "google", ...input }, cookie))
          .status,
        404,
      );
      assert.deepEqual(await counts(), before);
    }
    for (const extra of [
      { idToken: { token: "synthetic-direct-token" } },
      { scopes: ["drive"] },
      {
        additionalData: {
          link: { userId: randomUUID() },
          serverContext: { sessionId: randomUUID() },
        },
      },
      { additionalParams: { scope: "drive" } },
      { provider: "github" },
      { callbackURL: "https://evil.example.test" },
      { errorCallbackURL: "//evil.example.test" },
      { newUserCallbackURL: "https://evil.example.test" },
    ]) {
      const before = await counts();
      for (const path of ["/auth/link-social", "/auth/sign-in/social"])
        assert.equal(
          (await request(owner, path, { provider: "google", ...extra }, cookie))
            .status,
          403,
        );
      assert.deepEqual(await counts(), before);
    }
    const before = await counts();
    assert.equal(
      (
        await owner.auth.handler(
          new Request(`${origin}/api/auth/sign-up/email`, {
            method: "POST",
            body: JSON.stringify(input),
          }),
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          owner,
          "/auth/callback/google?code=unrequested",
          undefined,
          "",
          {},
          "GET",
        )
      ).status,
      302,
    );
    assert.deepEqual(await counts(), before);
  });
}, 60000);

test("0.2.1c C4 missing/expired/tampered/replayed native OAuth state and code, callback origins and session bindings fail without writes", async () => {
  await fixture(async ({ owner, cookie, start, provider, counts, runtime }) => {
    const before = await counts();
    async function deliver(address, cookieValue, extra = {}) {
      const response = await request(
        owner,
        address.replace(`${origin}/api`, ""),
        undefined,
        cookieValue,
        extra,
        "GET",
      );
      assert.match(response.headers.get("Location"), /#google-denied$/);
      assert.deepEqual(await counts(), before);
    }
    const missing = await start();
    const missingURL = provider.issue(missing.url);
    await deliver(missingURL, cookie); // No state cookie.
    const tampered = await start();
    await deliver(
      provider.issue(tampered.url).replace(/state=[^&]+/, "state=tampered"),
      tampered.cookie,
    );
    const badCookie = await start();
    await deliver(
      provider.issue(badCookie.url),
      badCookie.cookie.replace(
        /better-auth.state=[^;]+/,
        "better-auth.state=tampered",
      ),
    );
    const expired = await start();
    const state = new URL(expired.url).searchParams.get("state");
    await runtime.query(
      "update auth_verification set expires_at=now()-interval '1 second' where identifier=$1",
      [`auth-state:${state}`],
    );
    await deliver(provider.issue(expired.url), expired.cookie);
    const badCode = await start();
    const originalCodeURL = provider.issue(badCode.url);
    const badCodeURL = originalCodeURL.replace(/code=[^&]+/, "code=invalid");
    await deliver(badCodeURL, badCode.cookie);
    await deliver(originalCodeURL, badCode.cookie);
    const unsafe = await start();
    await deliver(provider.issue(unsafe.url), unsafe.cookie, {
      Origin: "https://evil.example.test",
    });
    const unsafeHost = await start();
    await deliver(provider.issue(unsafeHost.url), unsafeHost.cookie, {
      Host: "evil.example.test",
    });
    const missingCode = await start();
    const validCode = provider.issue(missingCode.url);
    await deliver(validCode.replace(/code=[^&]+&?/, ""), missingCode.cookie);
    await deliver(validCode, missingCode.cookie);
    const unverifiedOwner = await start();
    await runtime.query("update auth_user set email_verified=false");
    await deliver(provider.issue(unverifiedOwner.url), unverifiedOwner.cookie);
    await runtime.query("update auth_user set email_verified=true");
    const stale = await start();
    await runtime.query(
      "update auth_session set created_at=now()-interval '6 minutes'",
    );
    await deliver(provider.issue(stale.url), stale.cookie);
    assert.equal(
      (
        await request(
          owner,
          "/auth/link-social",
          { provider: "google" },
          cookie,
        )
      ).status,
      403,
    );
    await runtime.query(
      "update auth_session set created_at=now()-interval '1 second'",
    );
    const rotated = await start();
    const renewed = await owner.reauthenticate(
      new Headers({ Cookie: cookie }),
      input.password,
    );
    await deliver(
      provider.issue(rotated.url),
      `${cookies({ headers: renewed })}; ${rotated.cookie
        .split("; ")
        .filter((c) => c.startsWith("better-auth.state="))
        .join("; ")}`,
    );
    const freshCookie = cookies({ headers: renewed });
    const revoked = await start(true, freshCookie);
    await runtime.query("delete from auth_session");
    await deliver(provider.issue(revoked.url), revoked.cookie);
    // A direct native request also cannot bypass the application's recent guard.
    await assert.rejects(
      owner.auth.handler(
        new Request(`${origin}/api/auth/link-social`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: '{"provider":"google"}',
        }),
      ),
    );
  });
}, 60000);

test("0.2.1c C4/C6 native callback uniqueness, simultaneous replay, post-write and database failure rollback; no provider token retention", async () => {
  await fixture(
    async ({ owner, make, start, provider, counts, runtime, migration }) => {
      const before = await counts();
      const failing = make({
        checkpoint: async (step) => {
          if (step === "google-written")
            throw new Error("synthetic post-write failure");
        },
      });
      const first = await start();
      const failedURL = provider.issue(first.url);
      const failed = await request(
        failing,
        failedURL.replace(`${origin}/api`, ""),
        undefined,
        first.cookie,
        {},
        "GET",
      );
      assert.match(failed.headers.get("Location"), /#google-denied$/);
      assert.deepEqual(await counts(), before);
      assert.equal(
        (
          await runtime.query(
            "select count(*)::int as n from auth_verification where identifier=$1",
            [`auth-state:${new URL(first.url).searchParams.get("state")}`],
          )
        ).rows[0].n,
        0,
      );
      // Real PostgreSQL account-write failure, not a mocked adapter.
      await migration.query(
        "create function reject_google_account() returns trigger language plpgsql as $$ begin if NEW.provider_id='google' then raise exception 'synthetic write failure'; end if; return NEW; end $$; create trigger google_account_failure before insert on auth_account for each row execute function reject_google_account()",
      );
      const databaseFailure = await start();
      const failure = await request(
        owner,
        provider.issue(databaseFailure.url).replace(`${origin}/api`, ""),
        undefined,
        databaseFailure.cookie,
        {},
        "GET",
      );
      assert.match(failure.headers.get("Location"), /#google-denied$/);
      assert.deepEqual(await counts(), before);
      await migration.query(
        "drop trigger google_account_failure on auth_account; drop function reject_google_account()",
      );
      const stranger = randomUUID();
      await migration.query(
        "insert into auth_user(id,name,email,email_verified) values($1,'Fixture stranger','stranger@example.test',true)",
        [stranger],
      );
      const conflictingId = randomUUID();
      await runtime.query(
        "insert into auth_account(id,account_id,provider_id,user_id) values($1,'synthetic-google-owner','google',$2)",
        [conflictingId, stranger],
      );
      const conflictBefore = await counts();
      const conflict = await start();
      assert.match(
        (
          await request(
            owner,
            provider.issue(conflict.url).replace(`${origin}/api`, ""),
            undefined,
            conflict.cookie,
            {},
            "GET",
          )
        ).headers.get("Location"),
        /#google-denied$/,
      );
      assert.deepEqual(await counts(), conflictBefore);
      await runtime.query("delete from auth_account where id=$1", [
        conflictingId,
      ]);
      const concurrent = await start();
      const callbackURL = provider.issue(concurrent.url);
      const callbacks = await Promise.all(
        Array.from({ length: 2 }, () =>
          request(
            owner,
            callbackURL.replace(`${origin}/api`, ""),
            undefined,
            concurrent.cookie,
            {},
            "GET",
          ),
        ),
      );
      assert.equal(
        callbacks.filter(
          (r) =>
            r.headers.get("Location") === `${origin}/connections#google-linked`,
        ).length,
        1,
      );
      assert.equal(
        callbacks.filter((r) =>
          r.headers.get("Location")?.endsWith("#google-denied"),
        ).length,
        1,
      );
      const successful = await counts();
      assert.equal(successful.accounts, before.accounts + 1);
      assert.equal(successful.events, 1);
      const ownerId = (
        await runtime.query("select user_id from owner_bootstrap")
      ).rows[0].user_id;
      const competition = await Promise.allSettled(
        [ownerId, stranger].map((userId) =>
          runtime.query(
            "insert into auth_account(id,account_id,provider_id,user_id) values($1,'synthetic-concurrent-subject','google',$2)",
            [randomUUID(), userId],
          ),
        ),
      );
      assert.equal(
        competition.filter((r) => r.status === "fulfilled").length,
        1,
      );
      assert.equal(
        competition.filter((r) => r.status === "rejected").length,
        1,
      );
      assert.equal(
        (
          await runtime.query(
            "select count(*)::int as n from auth_account where account_id='synthetic-concurrent-subject'",
          )
        ).rows[0].n,
        1,
      );
      await runtime.query(
        "delete from auth_account where account_id='synthetic-concurrent-subject'",
      );
      const replay = await request(
        owner,
        callbackURL.replace(`${origin}/api`, ""),
        undefined,
        concurrent.cookie,
        {},
        "GET",
      );
      assert.match(replay.headers.get("Location"), /#google-denied$/);
      assert.deepEqual(await counts(), successful);
      // DB uniqueness is the independent final boundary for two distinct users.
      await assert.rejects(
        runtime.query(
          "insert into auth_account(id,account_id,provider_id,user_id) values($1,'synthetic-google-owner','google',$2)",
          [randomUUID(), stranger],
        ),
      );
      const account = (
        await runtime.query(
          "select * from auth_account where provider_id='google'",
        )
      ).rows[0];
      assert.equal(
        account.user_id,
        (await runtime.query("select user_id from owner_bootstrap")).rows[0]
          .user_id,
      );
      for (const token of provider.tokens) {
        assert.equal(JSON.stringify(account).includes(token), false);
        for (const response of callbacks)
          assert.equal(
            JSON.stringify([...response.headers]).includes(token),
            false,
          );
      }
      const signed = await start(false, "");
      const reusedCode = new URL(callbackURL).searchParams.get("code");
      const invalid = `${origin}/api/auth/callback/google?code=${reusedCode}&state=${new URL(signed.url).searchParams.get("state")}`;
      assert.match(
        (
          await request(
            owner,
            invalid.replace(`${origin}/api`, ""),
            undefined,
            signed.cookie,
            {},
            "GET",
          )
        ).headers.get("Location"),
        /#google-denied$/,
      );
      assert.deepEqual(await counts(), successful);
    },
  );
}, 60000);
