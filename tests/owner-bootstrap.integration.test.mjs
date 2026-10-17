import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApi } from "@aarili/api";
import { createOwnerAuth } from "@aarili/auth";
import { createDatabase, sql, withShop } from "@aarili/db";
import pg from "pg";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withHttpsApi } from "../scripts/test-support/https-api.mjs";
import { withPostgres } from "../scripts/test-support/postgres.mjs";

const input = {
  name: "Synthetic Owner",
  email: "owner@example.test",
  password: "synthetic-long-passphrase-12",
  shopName: "சோதனைக் கடை",
};
const policy = {
  passwordMin: 15,
  passwordMax: 128,
  sessionSeconds: 43200,
  updateSeconds: 3600,
  verificationSeconds: 1800,
  signInMax: 100,
  signInWindow: 60,
  setupMax: 100,
  setupWindow: 300,
};
const origin = "http://127.0.0.1:3103";
const token = randomBytes(32).toString("hex");
const secret = randomBytes(32).toString("hex");

test("ACCESS-01/04/05 new nameless registration, atomic shop creation, replay, conflict and concurrent tabs", {
  timeout: 120000,
}, async () => {
  await fixture(async ({ make, capture, connectionString, runtime }) => {
    const owner = make();
    const api = createApi(async () => true, owner);
    const { shopName: _, ...account } = input;
    const admissionKey = randomUUID();
    await owner.admit(account, token, admissionKey);
    await owner.admit(account, token, admissionKey);
    assert.equal(
      (await runtime.query("select shop_name from owner_bootstrap")).rows[0]
        .shop_name,
      null,
    );
    assert.equal(
      (
        await request(
          api,
          "/owner/complete",
          { shopName: "Shop" },
          { "Idempotency-Key": randomUUID() },
        )
      ).status,
      401,
    );
    await owner.verify(capture.at(-1).code);
    const headers = cookie(await signIn(owner));
    assert.deepEqual((await owner.ownerShop(headers)).data, {
      state: "pending-shop",
    });
    assert.equal(
      (await request(api, "/owner/complete", {}, Object.fromEntries(headers)))
        .status,
      422,
    );
    assert.equal(
      (
        await request(
          api,
          "/owner/complete",
          { shopName: "Shop" },
          Object.fromEntries(headers),
        )
      ).status,
      422,
    );
    const key = randomUUID();
    const named = { shopName: "  ஆரிலி Aarili  " };
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () => owner.complete(headers, named, key)),
    );
    const shopId = attempts[0].data.shopId;
    assert.equal(new Set(attempts.map((result) => result.data.shopId)).size, 1);
    assert.deepEqual((await owner.ownerShop(headers)).data, {
      state: "complete",
      shopId,
      name: "ஆரிலி Aarili",
    });
    assert.equal(
      (await request(api, "/owner/complete", {}, Object.fromEntries(headers)))
        .status,
      422,
    );
    await assert.rejects(
      runtime.query("select complete_owner_bootstrap($1::uuid)", [
        (await runtime.query("select user_id from owner_bootstrap")).rows[0]
          .user_id,
      ]),
      { code: "22023" },
    );
    await assert.rejects(
      owner.complete(headers, { shopName: "Changed" }, key),
      { code: "REQUEST_CONFLICT" },
    );
    await assert.rejects(
      owner.complete(headers, { shopName: "Changed" }, randomUUID()),
      { code: "REQUEST_CONFLICT" },
    );
    assert.equal(
      (
        await owner.complete(
          headers,
          { shopName: "ஆரிலி Aarili" },
          randomUUID(),
        )
      ).data.shopId,
      shopId,
    );
    const { db, pool } = createDatabase(connectionString);
    try {
      const userId = (
        await runtime.query("select user_id from owner_bootstrap")
      ).rows[0].user_id;
      await withShop(db, userId, shopId, async (tx) => {
        assert.equal(
          (await tx.execute(sql`select count(*)::int as n from shop`)).rows[0]
            .n,
          1,
        );
        assert.equal(
          (
            await tx.execute(
              sql`select count(*)::int as n from shop_membership`,
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await tx.execute(
              sql`select count(*)::int as n from audit_event where action='owner.shop.create'`,
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await tx.execute(
              sql`select count(*)::int as n from idempotency_key where action='owner.shop.create'`,
            )
          ).rows[0].n,
          2,
        );
      });
    } finally {
      await pool.end();
    }
  });
});

test("ACCESS-05 creation checkpoint failure rolls back shop, membership, completion, audit and replay together", {
  timeout: 120000,
}, async () => {
  await fixture(async ({ make, capture, runtime }) => {
    const { shopName: _, ...account } = input;
    const owner = make({
      checkpoint: async (step) => {
        if (step === "shop") throw new Error("injected rollback");
      },
    });
    await owner.admit(account, token, randomUUID());
    await owner.verify(capture.at(-1).code);
    const headers = cookie(await signIn(owner));
    const key = randomUUID();
    await assert.rejects(
      owner.complete(headers, { shopName: "Rollback shop" }, key),
      /injected rollback/,
    );
    const pending = (
      await runtime.query("select shop_id,completed_at from owner_bootstrap")
    ).rows[0];
    assert.deepEqual(pending, { shop_id: null, completed_at: null });
    const good = make();
    const completed = await good.complete(
      headers,
      { shopName: "Rollback shop" },
      key,
    );
    assert.equal(
      (await good.ownerShop(headers)).data.shopId,
      completed.data.shopId,
    );
  });
});

test("ACCESS-06 expand migration preserves legacy pending/completed admission provenance and old completion", {
  timeout: 120000,
}, async () => {
  for (const completed of [false, true])
    await withPostgres(
      async ({ connectionString, migrationConnectionString }) => {
        await migrateDatabase(migrationConnectionString, {
          through: "0015_document_sharing.sql",
        });
        const capture = [];
        const owner = createOwnerAuth({
          connectionString,
          origin,
          secret,
          setupToken: token,
          policy,
          capture: async (message) => capture.push(message),
        });
        const runtime = new pg.Pool({ connectionString });
        try {
          await owner.admit(input, token, randomUUID());
          await owner.verify(capture.at(-1).code);
          const headers = cookie(await signIn(owner));
          if (completed) await owner.complete(headers);
          const before = (await runtime.query("select * from owner_bootstrap"))
            .rows[0];
          await migrateDatabase(migrationConnectionString);
          assert.deepEqual(
            (await runtime.query("select * from owner_bootstrap")).rows[0],
            before,
          );
          if (!completed)
            assert.equal(
              (await owner.ownerShop(headers)).data.suggestedName,
              input.shopName,
            );
          const result = await owner.complete(headers);
          assert.equal(
            (await owner.ownerShop(headers)).data.name,
            input.shopName,
          );
          assert.equal(
            (await owner.complete(headers)).data.shopId,
            result.data.shopId,
          );
        } finally {
          await owner.close();
          await runtime.end();
        }
      },
    );
});
test("ENTRY-02/04/07/08/11 entry context is own-owner only, preserves legacy completion and distinguishes membership denial/outage", {
  timeout: 120000,
}, async () => {
  await fixture(async ({ make, capture, adminConnectionString, stop }) => {
    const owner = make();
    const api = createApi(async () => true, owner);
    assert.equal(
      (await request(api, "/owner/entry", undefined, {}, "GET")).status,
      401,
    );
    const headers = await provision(owner, capture);
    const read = () =>
      request(
        api,
        "/owner/entry",
        undefined,
        Object.fromEntries(headers),
        "GET",
      );
    const pending = await read();
    assert.equal(pending.status, 200);
    assert.equal(pending.headers.get("cache-control"), "no-store");
    assert.deepEqual(await pending.json(), {
      state: "needs-onboarding",
      owner: { name: input.name, email: input.email },
      suggestedName: input.shopName,
    });
    const { shopId } = (await owner.complete(headers)).data;
    const ready = await read();
    assert.deepEqual(await ready.json(), {
      state: "ready",
      owner: { name: input.name, email: input.email },
      shop: { shopId, name: input.shopName },
    });
    const admin = new pg.Client({ connectionString: adminConnectionString });
    await admin.connect();
    try {
      await admin.query("delete from shop_membership where shop_id=$1", [
        shopId,
      ]);
    } finally {
      await admin.end();
    }
    const denied = await read();
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), {
      error: { code: "SHOP_ACCESS_DENIED", message: "Request denied" },
    });
    const spec = api.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Entry contract", version: "1" },
    });
    assert.ok(spec.paths["/api/owner/entry"].get.responses[200]);
    await stop();
    assert.equal((await read()).status, 503);
  });
});

async function fixture(run) {
  await withPostgres(
    async ({
      connectionString,
      migrationConnectionString,
      adminConnectionString,
      stop,
    }) => {
      await Promise.all([
        migrateDatabase(migrationConnectionString),
        migrateDatabase(migrationConnectionString),
      ]);
      const capture = [];
      const owners = [];
      const runtime = new pg.Pool({ connectionString });
      const migration = new pg.Pool({
        connectionString: migrationConnectionString,
      });
      function make(overrides = {}) {
        const owner = createOwnerAuth({
          connectionString,
          origin,
          secret,
          setupToken: token,
          policy,
          capture: async (message) => {
            capture.push(message);
          },
          ...overrides,
        });
        owners.push(owner);
        return owner;
      }
      try {
        await run({
          make,
          capture,
          runtime,
          migration,
          connectionString,
          adminConnectionString,
          stop,
        });
      } finally {
        await Promise.all(owners.map((owner) => owner.close()));
        await runtime.end();
        await migration.end();
      }
    },
  );
}
function request(api, path, body, headers = {}, method = "POST") {
  return api.fetch(
    new Request(`${origin}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function signIn(owner, email = input.email, password = input.password) {
  return request(
    createApi(async () => true, owner),
    "/auth/sign-in/email",
    { email, password },
  );
}
function cookie(response) {
  return new Headers({
    Cookie: response.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; "),
  });
}
async function provision(owner, capture) {
  await owner.admit(input, token, randomUUID());
  await owner.verify(capture.at(-1).code);
  const signedIn = await signIn(owner);
  assert.equal(signedIn.status, 200);
  return cookie(signedIn);
}

test("0.2.1a A1 protected admission, ordinary signup closure, exact origin and secret-free errors", async () => {
  await fixture(async ({ make, runtime, migration }) => {
    const owner = make();
    const api = createApi(async () => true, owner);
    for (const headers of [
      {},
      { "X-Setup-Token": "wrong" },
      { "X-Setup-Token": token, Origin: "https://evil.example" },
      { "X-Setup-Token": token, Origin: "" },
    ]) {
      const response = await request(api, "/owner/setup", input, {
        "Idempotency-Key": randomUUID(),
        ...headers,
      });
      assert.equal(response.status, 403);
      assert.equal((await response.text()).includes(token), false);
    }
    assert.equal(
      (await request(api, "/auth/sign-up/email", input)).status,
      404,
    );
    const direct = await owner.auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    assert.equal(direct.ok, false);
    assert.equal(
      (
        await request(api, "/owner/setup?token=forbidden", input, {
          "X-Setup-Token": token,
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request(
          api,
          "/owner/setup",
          { ...input, password: "short" },
          { "X-Setup-Token": token, "Idempotency-Key": randomUUID() },
        )
      ).status,
      422,
    );
    assert.equal(
      (await runtime.query("SELECT count(*)::int AS n FROM auth_user")).rows[0]
        .n,
      0,
    );
    await assert.rejects(
      migrateDatabase(runtime.options.connectionString),
      /app_owner/,
    );
    const privileged = make({
      connectionString: migration.options.connectionString,
    });
    assert.equal(
      (
        await request(
          createApi(async () => true, privileged),
          "/owner/setup",
          input,
          { "X-Setup-Token": token, "Idempotency-Key": randomUUID() },
        )
      ).status,
      503,
    );
    await runtime.query(
      "INSERT INTO auth_user(id,name,email) VALUES($1,'Existing Synthetic Identity','existing@example.test')",
      [randomUUID()],
    );
    await assert.rejects(
      owner.admit(input, token, randomUUID()),
      /SETUP_CLOSED/,
    );
  });
}, 120000);

test("0.2.1a A2 concurrent PostgreSQL admission and retry hash produce exactly one owner, credential and membership", async () => {
  await fixture(async ({ make, capture, runtime }) => {
    const owner = make();
    const otherProcess = make();
    const key = randomUUID();
    const results = await Promise.allSettled([
      owner.admit(input, token, key),
      ...Array.from({ length: 7 }, (_, n) =>
        otherProcess.admit(
          { ...input, email: `other${n}@example.test` },
          token,
          randomUUID(),
        ),
      ),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const reserved = (
      await runtime.query(
        "SELECT u.email, b.user_id, b.admission_key FROM owner_bootstrap b JOIN auth_user u ON u.id=b.user_id",
      )
    ).rows[0];
    await owner.admit(
      { ...input, email: reserved.email },
      token,
      reserved.admission_key,
    );
    await assert.rejects(
      owner.admit(
        { ...input, email: reserved.email, shopName: "Changed" },
        token,
        reserved.admission_key,
      ),
      /REQUEST_CONFLICT/,
    );
    assert.equal(
      (await runtime.query("SELECT count(*)::int AS n FROM auth_user")).rows[0]
        .n,
      1,
    );
    assert.equal(
      (
        await runtime.query(
          "SELECT count(*)::int AS n FROM auth_account WHERE provider_id='credential'",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      owner.admit({ ...input, email: "changed@example.test" }, token, key),
    );
    await owner.verify(capture.at(-1).code);
    const signed = await signIn(owner, reserved.email);
    const headers = cookie(signed);
    const shops = await Promise.all(
      Array.from({ length: 6 }, () => owner.complete(headers)),
    );
    assert.equal(new Set(shops.map((s) => s.data.shopId)).size, 1);
    const { pool, db } = createDatabase(runtime.options.connectionString);
    try {
      await withShop(db, reserved.user_id, shops[0].data.shopId, async (tx) => {
        assert.equal(
          (
            await tx.execute(
              sql`select count(*)::int as n from shop_membership`,
            )
          ).rows[0].n,
          1,
        );
      });
    } finally {
      await pool.end();
    }
  });
}, 120000);

test("0.2.1a A2/A3/A4 injected write failures rollback identity, credential, reservation, verification and tenant completion", async () => {
  for (const step of [
    "identity",
    "credential",
    "reservation",
    "verified",
    "shop",
  ])
    await fixture(async ({ make, capture, runtime }) => {
      const failing = make({
        checkpoint: async (current) => {
          if (current === step) throw new Error("Synthetic write failure");
        },
      });
      const resumed = make();
      if (["identity", "credential", "reservation"].includes(step)) {
        await assert.rejects(failing.admit(input, token, randomUUID()));
        assert.equal(
          (await runtime.query("SELECT count(*)::int AS n FROM auth_user"))
            .rows[0].n,
          0,
        );
        assert.equal(
          (await runtime.query("SELECT count(*)::int AS n FROM auth_account"))
            .rows[0].n,
          0,
        );
        assert.equal(
          (await runtime.query("SELECT user_id FROM owner_bootstrap")).rows[0]
            .user_id,
          null,
        );
        await resumed.admit(input, token, randomUUID());
      } else {
        await failing.admit(input, token, randomUUID());
        if (step === "verified") {
          await assert.rejects(failing.verify(capture.at(-1).code));
          assert.equal(
            (await runtime.query("SELECT email_verified FROM auth_user"))
              .rows[0].email_verified,
            false,
          );
          await resumed.verify(capture.at(-1).code);
        } else {
          await failing.verify(capture.at(-1).code);
          const signed = await signIn(resumed);
          const headers = cookie(signed);
          await assert.rejects(failing.complete(headers));
          assert.equal(
            (await runtime.query("SELECT completed_at FROM owner_bootstrap"))
              .rows[0].completed_at,
            null,
          );
          assert.equal(
            (await resumed.ownerShop(headers)).data.state,
            "pending-shop",
          );
          await resumed.complete(headers);
        }
      }
    });
}, 240000);

test("0.2.1a A3/A4 failed mail, real process restarts, expired/invalid/replayed codes and permanently closed setup", async () => {
  await fixture(async ({ make, capture, runtime, connectionString }) => {
    const failedMail = make({
      capture: async () => {
        throw new Error("Synthetic capture failure");
      },
    });
    await assert.rejects(
      failedMail.admit(input, token, randomUUID()),
      /MAIL_UNAVAILABLE/,
    );
    assert.equal((await signIn(failedMail)).status, 403);
    await assert.rejects(
      failedMail.ownerShop(new Headers()),
      /UNAUTHENTICATED/,
    );
    // New Node process resumes the persisted reservation; no in-memory admission flag.
    const child = spawn(
      process.execPath,
      ["scripts/test-support/owner-restart.mjs"],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
          TEST_AUTH_SECRET: secret,
          TEST_SETUP_TOKEN: token,
        },
      },
    );
    let output = "";
    child.stdout.on("data", (b) => {
      output += b;
    });
    child.stderr.on("data", (b) => {
      output += b;
    });
    const [message] = await once(child, "message");
    const [exit] = await once(child, "exit");
    assert.equal(exit, 0, output);
    assert.equal(output.includes(token), false);
    const owner = make();
    await assert.rejects(owner.verify("invalid"), /INVALID_VERIFICATION/);
    await runtime.query(
      "UPDATE owner_verification SET expires_at=now()-interval '1 second'",
    );
    await assert.rejects(owner.verify(message.code), /INVALID_VERIFICATION/);
    await owner.resend(input.email, input.password, token);
    const code = capture.at(-1).code;
    await owner.verify(code);
    await assert.rejects(owner.verify(code), /INVALID_VERIFICATION/);
    const signed = await signIn(owner);
    const headers = cookie(signed);
    const complete = (await owner.complete(headers)).data;
    const restarted = make();
    assert.deepEqual((await restarted.complete(headers)).data, complete);
    await assert.rejects(
      restarted.admit(input, token, randomUUID()),
      /SETUP_CLOSED/,
    );
    await assert.rejects(
      runtime.query(
        "UPDATE owner_bootstrap SET user_id=NULL,shop_name=NULL,reserved_at=NULL",
      ),
    );
    assert.equal((await restarted.ownerShop(headers)).data.state, "complete");
  });
}, 120000);

test("0.2.1a A5 TRU-01/AC-38 forced RLS, own membership, unauthorized grant, cross-shop reads and pooled context cleanup", async () => {
  await fixture(
    async ({ make, capture, runtime, migration, connectionString }) => {
      const owner = make();
      const headers = await provision(owner, capture);
      const { shopId } = (await owner.complete(headers)).data;
      const userId = (
        await runtime.query("SELECT user_id FROM owner_bootstrap")
      ).rows[0].user_id;
      const unauthorized = randomUUID();
      const otherShop = randomUUID();
      await migration.query(
        "INSERT INTO auth_user(id,name,email) VALUES($1,'Synthetic Stranger','stranger@example.test')",
        [unauthorized],
      );
      const seed = await migration.connect();
      try {
        await seed.query("BEGIN");
        await seed.query(
          "SELECT set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true)",
          [unauthorized, otherShop],
        );
        await seed.query(
          "INSERT INTO shop(shop_id,name) VALUES($1,'Other Synthetic Shop')",
          [otherShop],
        );
        await seed.query(
          "INSERT INTO shop_membership(shop_id,user_id,role) VALUES($1,$2,'owner')",
          [otherShop, unauthorized],
        );
        await seed.query("COMMIT");
      } finally {
        seed.release();
      }
      const tables = await runtime.query(
        "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='shop_id' AND NOT a.attisdropped WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND c.relname <> 'owner_bootstrap'",
      );
      assert.deepEqual(tables.rows.map((row) => row.relname).sort(), [
        "audit_event",
        "consent_record",
        "customer",
        "customer_person",
        "customer_search_key",
        "customer_wearer_relationship",
        "document_artifact",
        "document_attempt",
        "document_cleanup",
        "document_output",
        "document_revision",
        "document_share_event",
        "durable_draft",
        "guardian_authority",
        "guardian_purpose_event",
        "guardian_verification_event",
        "idempotency_key",
        "job_schedule",
        "job_schedule_effect",
        "job_schedule_event",
        "job_schedule_quarantine",
        "job_schedule_run",
        "journal_batch",
        "journal_entry",
        "media_asset",
        "media_attempt",
        "media_cleanup_intent",
        "media_derivative",
        "media_reference",
        "privacy_notice_version",
        "product_event",
        "shop",
        "shop_calendar",
        "shop_calendar_revision",
        "shop_directory",
        "shop_directory_revision",
        "shop_membership",
        "shop_profile",
        "shop_profile_revision",
        "vocabulary",
        "vocabulary_revision",
        "vocabulary_search_key",
        "wearer",
        "wearer_age_event",
        "wearer_preference_event",
        "wearer_preferences",
        "wearer_purpose_event",
        "wearer_relationship_event",
      ]);
      for (const row of tables.rows) {
        assert.equal(row.relrowsecurity, true);
        assert.equal(row.relforcerowsecurity, true);
      }
      const policies = await runtime.query(
        "SELECT tablename,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('shop','shop_membership')",
      );
      for (const table of ["shop", "shop_membership"]) {
        assert(
          policies.rows.some(
            (r) => r.tablename === table && r.cmd === "SELECT" && r.qual,
          ),
        );
        assert(
          policies.rows.some(
            (r) => r.tablename === table && r.cmd === "INSERT" && r.with_check,
          ),
        );
      }
      const role = (
        await runtime.query(
          "SELECT r.rolsuper,r.rolbypassrls,c.relowner=r.oid AS owns FROM pg_roles r JOIN pg_class c ON c.relname='shop' WHERE r.rolname=current_user",
        )
      ).rows[0];
      assert.deepEqual(role, {
        rolsuper: false,
        rolbypassrls: false,
        owns: false,
      });
      assert.equal((await runtime.query("SELECT * FROM shop")).rowCount, 0);
      await assert.rejects(
        runtime.query(
          "INSERT INTO shop_membership(shop_id,user_id,role) VALUES($1,$2,'owner')",
          [shopId, unauthorized],
        ),
      );
      await assert.rejects(
        runtime.query("SELECT complete_owner_bootstrap($1)", [unauthorized]),
      );
      const { db, pool } = createDatabase(connectionString);
      try {
        await assert.rejects(
          withShop(db, unauthorized, shopId, async () => {}),
          /Shop access denied/,
        );
        await withShop(db, userId, shopId, async (tx) => {
          assert.equal(
            (
              await tx.execute(
                sql`select * from shop where shop_id=${otherShop}::uuid`,
              )
            ).rowCount,
            0,
          );
        });
        await assert.rejects(
          withShop(db, userId, shopId, async () => {
            throw new Error("rollback");
          }),
          /rollback/,
        );
        const noContext = await db.execute(sql`select * from shop`);
        assert.equal(noContext.rowCount, 0);
        const own = await runtime.connect();
        try {
          await own.query("BEGIN");
          await own.query("SELECT set_config('app.user_id',$1,true)", [userId]);
          assert.equal(
            (await own.query("SELECT * FROM shop_membership")).rowCount,
            1,
          );
          assert.equal((await own.query("SELECT * FROM shop")).rowCount, 0);
          await own.query("ROLLBACK");
        } finally {
          own.release();
        }
      } finally {
        await pool.end();
      }
    },
  );
}, 120000);

test("0.2.1a A6/A7 database sessions, generic credential failures, revocation and concurrent/restarted durable abuse limits", async () => {
  await fixture(async ({ make, capture, runtime, connectionString }) => {
    const owner = make();
    const headers = await provision(owner, capture);
    const wrong = await signIn(owner, input.email, "wrong-password-000");
    const absent = await signIn(
      owner,
      "nobody@example.test",
      "wrong-password-000",
    );
    assert.equal(wrong.status, 401);
    assert.equal(await wrong.text(), await absent.text());
    const api = createApi(async () => true, owner);
    assert.equal(
      (await request(api, "/owner/shop", undefined, {}, "GET")).status,
      401,
    );
    const revoked = await request(
      api,
      "/auth/sign-out",
      {},
      Object.fromEntries(headers),
    );
    assert.equal(revoked.status, 200);
    await assert.rejects(owner.ownerShop(headers), /UNAUTHENTICATED/);
    const limited = make({ policy: { ...policy, signInMax: 5, setupMax: 3 } });
    const second = make({ policy: { ...policy, signInMax: 5, setupMax: 3 } });
    const responses = await Promise.all(
      Array.from({ length: 9 }, (_, n) =>
        request(
          createApi(async () => true, n % 2 ? limited : second),
          "/owner/setup",
          input,
          {
            "X-Setup-Token": "wrong",
            "Idempotency-Key": randomUUID(),
            "X-Forwarded-For": `192.0.2.${n}`,
            "X-Real-IP": `192.0.2.${n}`,
          },
        ),
      ),
    );
    assert.equal(responses.filter((r) => r.status === 403).length, 3);
    assert.equal(responses.filter((r) => r.status === 429).length, 6);
    const restart = make({ policy: { ...policy, signInMax: 5, setupMax: 3 } });
    assert.equal(
      (
        await request(
          createApi(async () => true, restart),
          "/owner/setup",
          input,
        )
      ).status,
      429,
    );
    await runtime.query("DELETE FROM auth_rate_limit");
    const authResponses = await Promise.all(
      Array.from({ length: 9 }, (_, n) =>
        signIn(n % 2 ? limited : second, input.email, "wrong-password-000"),
      ),
    );
    assert.equal(authResponses.filter((r) => r.status === 401).length, 5);
    assert.equal(authResponses.filter((r) => r.status === 429).length, 4);
    assert.equal(
      (await signIn(restart, input.email, "wrong-password-000")).status,
      429,
    );
    const child = spawn(
      process.execPath,
      ["scripts/test-support/owner-restart.mjs"],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
          TEST_AUTH_SECRET: secret,
          TEST_SETUP_TOKEN: token,
          TEST_AUTH_ACTION: "limits",
        },
      },
    );
    let output = "";
    child.stdout.on("data", (b) => {
      output += b;
    });
    child.stderr.on("data", (b) => {
      output += b;
    });
    const [message] = await once(child, "message");
    const [exit] = await once(child, "exit");
    assert.equal(exit, 0, output);
    assert.deepEqual(message, { setupStatus: 429, signInStatus: 429 });
    assert.equal(output.includes(token), false);
  });
}, 120000);

test("0.2.1a A6 fixed sign-in lifetime and HTTPS renewal cookies on pending/completed owner and session routes", async () => {
  await fixture(async ({ make, capture, runtime }) => {
    let owner;
    await withHttpsApi(
      (secureOrigin) => {
        owner = make({ origin: secureOrigin });
        return createApi(async () => true, owner);
      },
      async (send) => {
        await owner.admit(input, token, randomUUID());
        await owner.verify(capture.at(-1).code);
        const credentials = { email: input.email, password: input.password };
        for (const body of [
          { ...credentials, rememberMe: false },
          { ...credentials, rememberMe: true },
          { ...credentials, callbackURL: "/owner" },
          { ...credentials, email: "invalid" },
          { email: input.email },
          undefined,
        ]) {
          const denied = await send("/auth/sign-in/email", body);
          assert.equal(denied.status, 422);
          assert.equal(JSON.parse(denied.data).error.code, "VALIDATION_FAILED");
          assert.equal((denied.headers["set-cookie"] ?? []).length, 0);
        }
        assert.equal(
          (await runtime.query("SELECT count(*)::int AS n FROM auth_session"))
            .rows[0].n,
          0,
        );
        const signed = await send("/auth/sign-in/email", credentials);
        assert.equal(signed.status, 200);
        assert.deepEqual(JSON.parse(signed.data), { state: "signed-in" });
        assert.match(signed.headers["set-cookie"][0], /Max-Age=43200/);
        const lifetime = (
          await runtime.query(
            "SELECT extract(epoch FROM expires_at-created_at)::float AS seconds FROM auth_session",
          )
        ).rows[0].seconds;
        assert.ok(Math.abs(lifetime - policy.sessionSeconds) < 2);
        let headers = {
          Cookie: signed.headers["set-cookie"][0].split(";")[0],
        };
        const unchanged = await send(
          "/auth/get-session",
          undefined,
          headers,
          "GET",
        );
        assert.equal(unchanged.status, 200);
        assert.equal((unchanged.headers["set-cookie"] ?? []).length, 0);
        for (const [path, method, state] of [
          ["/owner/shop", "GET", "pending-shop"],
          ["/auth/get-session", "GET", "signed-in"],
          ["/owner/complete", "POST", "complete"],
          ["/owner/shop", "GET", "complete"],
          ["/auth/get-session", "GET", "signed-in"],
          ["/owner/complete", "POST", "complete"],
        ]) {
          // Cross the one-hour refresh boundary without a wall-clock wait.
          const previous = (
            await runtime.query(
              "UPDATE auth_session SET expires_at=now()+interval '10 hours', updated_at=now()-interval '2 hours' RETURNING updated_at, expires_at",
            )
          ).rows[0];
          const renewed = await send(path, undefined, headers, method);
          assert.equal(renewed.status, 200, path);
          assert.equal(JSON.parse(renewed.data).state, state);
          assert.equal(Object.hasOwn(JSON.parse(renewed.data), "token"), false);
          assert.equal(renewed.headers["cache-control"], "no-store");
          const cookies = renewed.headers["set-cookie"];
          assert.equal(cookies.length, 1, path);
          assert.match(cookies[0], /__Secure-/);
          assert.match(cookies[0], /Max-Age=43200/);
          assert.match(cookies[0], /HttpOnly/i);
          assert.match(cookies[0], /;\s*Secure(?:;|$)/i);
          assert.match(cookies[0], /SameSite=Lax/i);
          assert.equal(cookies[0].includes("session_data"), false);
          const persisted = (
            await runtime.query(
              "SELECT updated_at, expires_at, extract(epoch FROM expires_at-updated_at)::float AS seconds FROM auth_session",
            )
          ).rows[0];
          // Verify the actual stored renewal window, independent of response
          // latency or clock offset between native Node and container PostgreSQL.
          // Advancing both instants also prevents an unchanged 10h/2h fixture
          // from passing merely because its old duration happens to be 12h.
          assert(persisted.updated_at > previous.updated_at, path);
          assert(persisted.expires_at > previous.expires_at, path);
          assert.ok(
            Math.abs(persisted.seconds - policy.sessionSeconds) < 2,
            path,
          );
          headers = { Cookie: cookies[0].split(";")[0] };
        }
      },
    );
  });
}, 120000);

test("0.2.1a A6 controlled HTTPS Secure/HttpOnly/Lax cookie, no bearer JSON/cache, persisted session expiry and library CSRF", async () => {
  await fixture(async ({ make, capture, runtime }) => {
    let owner;
    await withHttpsApi(
      (secureOrigin) => {
        owner = make({ origin: secureOrigin });
        return createApi(async () => true, owner);
      },
      async (send) => {
        await owner.admit(input, token, randomUUID());
        await owner.verify(capture.at(-1).code);
        const signed = await send("/auth/sign-in/email", {
          email: input.email,
          password: input.password,
        });
        assert.equal(signed.status, 200);
        assert.deepEqual(JSON.parse(signed.data), { state: "signed-in" });
        const cookies = signed.headers["set-cookie"];
        assert.equal(cookies.length, 1);
        assert.match(cookies[0], /__Secure-/);
        assert.match(cookies[0], /HttpOnly/i);
        assert.match(cookies[0], /;\s*Secure(?:;|$)/i);
        assert.equal(signed.headers["cache-control"], "no-store");
        assert.match(cookies[0], /SameSite=Lax/i);
        assert.equal(cookies[0].includes("session_data"), false);
        const headers = { Cookie: cookies[0].split(";")[0] };
        assert.equal(
          (await send("/owner/shop", undefined, headers, "GET")).status,
          200,
        );
        assert.equal(
          (
            await send(
              "/auth/sign-in/email",
              { email: input.email, password: input.password },
              { Origin: "https://untrusted.example" },
            )
          ).status,
          403,
        );
        const direct = await owner.auth.handler(
          new Request(`${owner.origin}/api/auth/sign-in/email`, {
            method: "POST",
            headers: {
              Origin: "https://untrusted.example",
              "Sec-Fetch-Site": "cross-site",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Dest": "document",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: input.email,
              password: input.password,
            }),
          }),
        );
        assert.equal(direct.status, 403);
        await runtime.query(
          "UPDATE auth_session SET expires_at=now()-interval '1 second'",
        );
        assert.equal(
          (await send("/owner/shop", undefined, headers, "GET")).status,
          401,
        );
      },
    );
  });
}, 120000);
