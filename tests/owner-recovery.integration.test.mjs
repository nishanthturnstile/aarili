import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createOwnerAuth } from "@aarili/auth";
import { sql } from "@aarili/db";
import pg from "pg";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withHttpsApi } from "../scripts/test-support/https-api.mjs";
import { createOwnerVerificationApi as createApi } from "../scripts/test-support/owner-api.mjs";
import { withPostgres } from "../scripts/test-support/postgres.mjs";

const origin = "http://127.0.0.1:3103";
const input = {
  name: "Synthetic owner",
  email: "owner@example.test",
  password: "synthetic-old-password-13",
  shopName: "சோதனைக் கடை",
};
const newPassword = "synthetic-new-password-13";
const secret = randomBytes(32).toString("hex");
const setupToken = randomBytes(32).toString("hex");
const testPolicy = {
  signInMax: 100,
  setupMax: 100,
  recoveryMax: 100,
  redemptionMax: 100,
  reauthMax: 100,
};
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
      function make(overrides = {}) {
        const owner = createOwnerAuth({
          connectionString,
          origin,
          secret,
          setupToken,
          policy: testPolicy,
          capture: async (message) => {
            captures.push(message);
          },
          ...overrides,
        });
        owners.push(owner);
        return owner;
      }
      async function child(action, body) {
        const processChild = spawn(
          process.execPath,
          ["scripts/test-support/owner-recovery-process.mjs"],
          {
            stdio: ["ignore", "pipe", "pipe", "ipc"],
            env: {
              ...process.env,
              DATABASE_URL: connectionString,
              TEST_AUTH_SECRET: secret,
            },
          },
        );
        let output = "";
        let result;
        processChild.stdout.on("data", (b) => {
          output += b;
        });
        processChild.stderr.on("data", (b) => {
          output += b;
        });
        processChild.on("message", (message) => {
          if (message.capture) captures.push(message.capture);
          if (message.status) result = message.status;
        });
        const exited = once(processChild, "exit");
        processChild.send({ action, body });
        const [code] = await exited;
        assert.equal(code, 0, "Recovery process exited unsuccessfully");
        assert.equal(output.includes(secret), false);
        assert.equal(output.includes(input.password), false);
        if (body.token) assert.equal(output.includes(body.token), false);
        return result;
      }
      try {
        await run({ make, runtime, migration, captures, child });
      } finally {
        await Promise.all(owners.map((o) => o.close()));
        await runtime.end();
        await migration.end();
      }
    },
  );
}
function request(
  owner,
  path,
  body,
  cookie = "",
  headers = {},
  method = "POST",
) {
  return createApi(async () => true, owner).fetch(
    new Request(`${owner.origin}/api${path}`, {
      method,
      headers: {
        Origin: owner.origin,
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const signIn = (owner, password = input.password) =>
  request(owner, "/auth/sign-in/email", { email: input.email, password });
const cookie = (response) =>
  response.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
async function provision(owner, captures) {
  await owner.admit(input, setupToken, randomUUID());
  await owner.verify(captures.at(-1).code);
  const session = await signIn(owner);
  assert.equal(session.status, 200);
  const headers = new Headers({ Cookie: cookie(session) });
  await owner.complete(headers);
  return cookie(session);
}
async function resetCode(owner, captures) {
  assert.equal(
    (await request(owner, "/owner/recovery/request", { email: input.email }))
      .status,
    200,
  );
  assert.equal(captures.at(-1).purpose, "reset");
  return captures.at(-1).code;
}

test("0.2.1b B1/B7 generic owner-only recovery, failed capture retry, restart; no signup or provenance loss", async () => {
  await fixture(async ({ make, captures, runtime, migration, child }) => {
    const owner = make();
    await owner.admit(input, setupToken, randomUUID());
    const pending = await request(owner, "/owner/recovery/request", {
      email: input.email,
    });
    assert.equal(pending.status, 200);
    assert.equal(captures.filter((m) => m.purpose === "reset").length, 0);
    await owner.verify(captures[0].code);
    const session = await signIn(owner);
    await owner.complete(new Headers({ Cookie: cookie(session) }));
    const provenance = (await runtime.query("select * from owner_bootstrap"))
      .rows;
    const alien = randomUUID();
    await migration.query(
      "insert into auth_user(id,name,email,email_verified) values($1,'Synthetic alien','alien@example.test',true)",
      [alien],
    );
    const unknown = await request(owner, "/owner/recovery/request", {
      email: "absent@example.test",
    });
    const other = await request(owner, "/owner/recovery/request", {
      email: "alien@example.test",
    });
    const known = await request(owner, "/owner/recovery/request", {
      email: input.email,
    });
    assert.equal(unknown.status, 200);
    assert.equal(await unknown.text(), await other.text());
    assert.equal(
      await known.text(),
      JSON.stringify({ state: "recovery-requested" }),
    );
    assert.equal(captures.filter((m) => m.purpose === "reset").length, 1);
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_verification"))
        .rows[0].n,
      1,
    );
    const failedMail = make({
      capture: async () => {
        throw new Error("synthetic capture failure");
      },
    });
    assert.equal(
      (
        await request(failedMail, "/owner/recovery/request", {
          email: input.email,
        })
      ).status,
      200,
    );
    await runtime.query(
      "delete from application_rate_limit where key like 'owner-recovery%'",
    );
    assert.equal(await child("request", { email: input.email }), 200);
    const token = captures.at(-1).code;
    assert.equal(await child("reset", { token, newPassword }), 200);
    assert.equal((await signIn(make())).status, 401);
    assert.equal((await signIn(make(), newPassword)).status, 200);
    assert.deepEqual(
      (await runtime.query("select * from owner_bootstrap")).rows,
      provenance,
    );
    const membership = await runtime.connect();
    try {
      await membership.query("begin");
      await membership.query("select set_config('app.user_id',$1,true)", [
        provenance[0].user_id,
      ]);
      assert.equal(
        (
          await membership.query(
            "select count(*)::int as n from shop_membership",
          )
        ).rows[0].n,
        1,
      );
      await membership.query("rollback");
    } finally {
      membership.release();
    }
    await assert.rejects(
      owner.admit(input, setupToken, randomUUID()),
      /SETUP_CLOSED/,
    );
    assert.equal(
      (await request(owner, "/auth/sign-up/email", input)).status,
      404,
    );
  });
}, 120000);

test("0.2.1b B2 real PostgreSQL cross-process single redemption, invalid/expired tokens and injected-write rollback/retry", async () => {
  await fixture(async ({ make, captures, runtime, migration, child }) => {
    const owner = make();
    const originalCookie = await provision(owner, captures);
    const token = await resetCode(owner, captures);
    const failing = make({
      checkpoint: async (step) => {
        if (step === "reset") throw new Error("injected post-password failure");
      },
    });
    const failed = await request(failing, "/owner/recovery/reset", {
      token,
      newPassword,
    });
    assert.equal(failed.status, 503);
    assert.equal(
      (
        await request(
          owner,
          "/owner/shop",
          undefined,
          originalCookie,
          {},
          "GET",
        )
      ).status,
      200,
    );
    assert.equal((await signIn(owner)).status, 200);
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_verification"))
        .rows[0].n,
      1,
    );
    // A real PostgreSQL failure after password write must preserve token/password/sessions.
    await migration.query(
      "create function reject_synthetic_session_delete() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$",
    );
    await migration.query(
      "create trigger synthetic_session_failure before delete on auth_session for each row execute function reject_synthetic_session_delete()",
    );
    assert.equal(
      (await request(owner, "/owner/recovery/reset", { token, newPassword }))
        .status,
      503,
    );
    await migration.query(
      "drop trigger synthetic_session_failure on auth_session; drop function reject_synthetic_session_delete()",
    );
    assert.equal((await signIn(owner)).status, 200);
    const results = await Promise.all([
      child("reset", { token, newPassword }),
      child("reset", { token, newPassword: "synthetic-concurrent-other-13" }),
    ]);
    assert.equal(results.filter((r) => r === 200).length, 1);
    assert.equal(results.filter((r) => r === 403).length, 1);
    assert.equal(
      (await request(owner, "/owner/recovery/reset", { token, newPassword }))
        .status,
      403,
    );
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_session"))
        .rows[0].n,
      0,
    );
    const expired = await resetCode(owner, captures);
    await runtime.query(
      "update auth_verification set expires_at=now()-interval '1 second'",
    );
    assert.equal(
      (
        await request(owner, "/owner/recovery/reset", {
          token: expired,
          newPassword,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(owner, "/owner/recovery/reset", {
          token: "A".repeat(24),
          newPassword,
        })
      ).status,
      403,
    );
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_account"))
        .rows[0].n,
      1,
    );
  });
}, 120000);

test("0.2.1b B3 logout cookie replay, reset revocation, expiry and old-password sign-in race", async () => {
  await fixture(async ({ make, captures, runtime }) => {
    const owner = make();
    const first = await provision(owner, captures);
    const second = cookie(await signIn(owner));
    const signedOut = await request(owner, "/auth/sign-out", {}, first);
    assert.equal(signedOut.status, 200);
    assert(
      signedOut.headers.getSetCookie().some((s) => s.includes("Max-Age=0")),
    );
    assert.equal(
      (await request(owner, "/owner/shop", undefined, first, {}, "GET")).status,
      401,
    );
    assert.equal(
      (await request(owner, "/owner/shop", undefined, second, {}, "GET"))
        .status,
      200,
    );
    const token = await resetCode(owner, captures);
    const reset = request(owner, "/owner/recovery/reset", {
      token,
      newPassword,
    });
    const raced = Promise.all(Array.from({ length: 5 }, () => signIn(make())));
    assert.equal((await reset).status, 200);
    for (const response of await raced) {
      assert([200, 401].includes(response.status));
      if (response.status === 200)
        assert.equal(
          (
            await request(
              owner,
              "/owner/shop",
              undefined,
              cookie(response),
              {},
              "GET",
            )
          ).status,
          401,
        );
    }
    assert.equal(
      (await request(owner, "/owner/shop", undefined, second, {}, "GET"))
        .status,
      401,
    );
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_session"))
        .rows[0].n,
      0,
    );
    const after = cookie(await signIn(owner, newPassword));
    await runtime.query(
      "update auth_session set expires_at=now()-interval '1 second'",
    );
    assert.equal(
      (await request(owner, "/owner/shop", undefined, after, {}, "GET")).status,
      401,
    );
    assert.equal(
      (
        await runtime.query(
          "select completed_at is not null as done from owner_bootstrap",
        )
      ).rows[0].done,
      true,
    );
  });
}, 120000);

test("0.2.1b B4 reusable recent-auth guard ignores renewal/client authority; reauth rotation, failure rollback and membership denial", async () => {
  await fixture(async ({ make, captures, runtime, migration }) => {
    let time = Date.now();
    const owner = make({
      now: () => new Date(time),
      policy: { ...testPolicy, freshSeconds: 1 },
    });
    const first = await provision(owner, captures);
    time = Date.now();
    let effects = 0;
    const effect = async (tx, actor) => {
      const context = (
        await tx.execute(
          sql`select current_setting('app.user_id') as actor, current_setting('app.shop_id') as shop`,
        )
      ).rows[0];
      assert.equal(context.actor, actor.userId);
      assert.equal(context.shop, actor.shopId);
      assert.equal((await tx.execute(sql`select * from shop`)).rowCount, 1);
      effects++;
      return true;
    };
    await assert.rejects(
      owner.withRecentOwner(new Headers(), effect),
      /UNAUTHENTICATED/,
    );
    await owner.withRecentOwner(new Headers({ Cookie: first }), effect);
    assert.equal(effects, 1);
    await runtime.query(
      "update auth_session set created_at=now()-interval '2 hours', updated_at=now()-interval '2 hours',expires_at=now()+interval '10 hours'",
    );
    // Forces actual library renewal, not just an edited updated_at test double.
    const renewed = await request(
      owner,
      "/owner/shop",
      undefined,
      first,
      {},
      "GET",
    );
    assert.equal(renewed.status, 200);
    assert(renewed.headers.getSetCookie().length > 0);
    const updated = (
      await runtime.query("select created_at,updated_at from auth_session")
    ).rows[0];
    assert(updated.updated_at > updated.created_at);
    await assert.rejects(
      owner.withRecentOwner(new Headers({ Cookie: first }), effect),
      /AUTHENTICATION_STALE/,
    );
    assert.equal(
      (
        await request(
          owner,
          "/owner/sensitive-probe",
          { userId: randomUUID(), now: Date.now() },
          first,
        )
      ).status,
      403,
    );
    const failing = make({
      checkpoint: async (step) => {
        if (step === "reauthenticated") throw new Error("synthetic failure");
      },
    });
    assert.equal(
      (
        await request(
          failing,
          "/owner/reauthenticate",
          { password: input.password },
          first,
        )
      ).status,
      503,
    );
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_session"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (
        await request(
          owner,
          "/owner/reauthenticate",
          { password: "incorrect" },
          first,
        )
      ).status,
      401,
    );
    const reauth = await request(
      owner,
      "/owner/reauthenticate",
      { password: input.password },
      first,
    );
    assert.equal(reauth.status, 200);
    assert.equal(
      (await request(owner, "/owner/shop", undefined, first, {}, "GET")).status,
      401,
    );
    const freshCookie = cookie(reauth);
    time = Date.now();
    await owner.withRecentOwner(new Headers({ Cookie: freshCookie }), effect);
    const createdAt = (
      await runtime.query("select created_at from auth_session")
    ).rows[0].created_at.getTime();
    time = createdAt + 1000; // Exact injected-clock boundary is stale.
    await assert.rejects(
      owner.withRecentOwner(new Headers({ Cookie: freshCookie }), effect),
      /AUTHENTICATION_STALE/,
    );
    assert.equal(effects, 2);
    // Existing policies stay forced; removing membership denies protected work.
    await migration.query(
      "alter table shop_membership disable row level security",
    );
    await migration.query("delete from shop_membership");
    await migration.query(
      "alter table shop_membership enable row level security; alter table shop_membership force row level security",
    );
    time = Date.now();
    await assert.rejects(
      owner.withRecentOwner(new Headers({ Cookie: freshCookie }), effect),
      /Shop access denied/,
    );
    assert.equal(effects, 2);
  });
}, 120000);

test("0.2.1b B5 exact origins, strict token/redirect input, durable concurrent limits and restarted process", async () => {
  await fixture(async ({ make, captures, runtime, child }) => {
    const owner = make();
    const signedIn = await provision(owner, captures);
    for (const path of [
      "/owner/recovery/request",
      "/owner/recovery/reset",
      "/owner/reauthenticate",
    ]) {
      for (const Origin of [
        "",
        "https://evil.example",
        `${origin}.evil.example`,
      ])
        assert.equal(
          (
            await request(owner, path, {}, signedIn, {
              Origin,
              "X-Forwarded-Host": "127.0.0.1:3103",
            })
          ).status,
          403,
        );
    }
    for (const body of [
      { email: input.email, redirectTo: "https://evil.example" },
      { email: input.email, callbackURL: "/owner" },
    ])
      assert.equal(
        (await request(owner, "/owner/recovery/request", body)).status,
        422,
      );
    for (const token of ["", "../private", "x".repeat(256), "<script>"])
      assert.equal(
        (await request(owner, "/owner/recovery/reset", { token, newPassword }))
          .status,
        422,
      );
    assert.equal(
      (
        await request(owner, "/owner/recovery/reset?token=canary", {
          token: "A".repeat(24),
          newPassword,
        })
      ).status,
      422,
    );
    assert.equal(
      (await request(owner, "/auth/reset-password", {})).status,
      404,
    );
    await runtime.query("delete from application_rate_limit");
    const a = make({
      policy: { ...testPolicy, recoveryMax: 3, redemptionMax: 5, reauthMax: 5 },
    });
    const b = make({
      policy: { ...testPolicy, recoveryMax: 3, redemptionMax: 5, reauthMax: 5 },
    });
    const responses = await Promise.all(
      Array.from({ length: 9 }, (_, n) =>
        request(
          n % 2 ? a : b,
          "/owner/recovery/request",
          { email: input.email },
          "",
          { "X-Forwarded-For": `192.0.2.${n}` },
        ),
      ),
    );
    assert.equal(responses.filter((r) => r.status === 200).length, 3);
    assert.equal(responses.filter((r) => r.status === 429).length, 6);
    assert.equal(await child("request", { email: input.email }), 429);
    const redemptions = await Promise.all(
      Array.from({ length: 9 }, (_, n) =>
        request(n % 2 ? a : b, "/owner/recovery/reset", {
          token: "A".repeat(24),
          newPassword,
        }),
      ),
    );
    assert.equal(redemptions.filter((r) => r.status === 403).length, 5);
    assert.equal(redemptions.filter((r) => r.status === 429).length, 4);
    assert.equal(
      await child("reset", { token: "A".repeat(24), newPassword }),
      429,
    );
    const reauths = await Promise.all(
      Array.from({ length: 9 }, (_, n) =>
        request(
          n % 2 ? a : b,
          "/owner/reauthenticate",
          { password: "wrong" },
          signedIn,
        ),
      ),
    );
    assert.equal(reauths.filter((r) => r.status === 401).length, 5);
    assert.equal(reauths.filter((r) => r.status === 429).length, 4);
    const limited = await request(
      make({ policy: { ...testPolicy, reauthMax: 5 } }),
      "/owner/reauthenticate",
      { password: input.password },
      signedIn,
    );
    assert.equal(limited.status, 429);
    const text = await limited.text();
    assert.equal(text.includes(input.password), false);
    assert.equal(
      (await runtime.query("select count(*)::int as n from auth_account"))
        .rows[0].n,
      1,
    );
  });
}, 120000);

test("0.2.1b B3/B4 HTTPS rotated cookies remain Secure/HttpOnly/Lax, authoritative revoked-cookie rejection", async () => {
  await fixture(async ({ make, captures }) => {
    let owner;
    await withHttpsApi(
      (tlsOrigin) => {
        owner = make({ origin: tlsOrigin });
        return createApi(async () => true, owner);
      },
      async (send) => {
        await owner.admit(input, setupToken, randomUUID());
        await owner.verify(captures.at(-1).code);
        const signed = await send("/auth/sign-in/email", {
          email: input.email,
          password: input.password,
        });
        const first = signed.headers["set-cookie"]
          .map((s) => s.split(";")[0])
          .join("; ");
        await owner.complete(new Headers({ Cookie: first }));
        const reauth = await send(
          "/owner/reauthenticate",
          { password: input.password },
          { Cookie: first },
        );
        assert.equal(reauth.status, 200);
        const fresh = reauth.headers["set-cookie"].find((s) =>
          s.startsWith("__Secure-better-auth.session_token="),
        );
        assert(
          fresh?.includes("Secure") &&
            fresh.includes("HttpOnly") &&
            fresh.includes("SameSite=Lax"),
        );
        assert.equal(reauth.data, JSON.stringify({ state: "reauthenticated" }));
        assert.equal(
          (await send("/owner/shop", undefined, { Cookie: first }, "GET"))
            .status,
          401,
        );
        assert.equal(
          (
            await send(
              "/owner/sensitive-probe",
              {},
              { Cookie: fresh.split(";")[0] },
            )
          ).status,
          200,
        );
      },
    );
  });
}, 120000);
