import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createApi } from "@aarili/api";
import { createOwnerAuth } from "@aarili/auth";
import { createDatabase, sql } from "@aarili/db";
import pg from "pg";
import { migrateDatabase } from "../migrate.mjs";
import { withPostgres } from "./postgres.mjs";

// All implemented tenant paths are registered here. Add a real case before
// exposing another repository/indirect path; future search/export/media/jobs/AI
// deliberately have no entries until their implementations exist.
export const tenantPaths = [
  "mediaRepository.read/insert/start/claim/accept/expire",
  "mediaRepository.derivatives/release",
  "mediaRepository.claims/cleanupIntents/intent/cleaned",
  "shops/:shopId/files",
  "shopRepository.read",
  "owner.ownerShop",
  "draftRepository.read/list/insert/update/audit",
  "shops/:shopId/drafts",
  "shops/:shopId",
  "membership-bootstrap",
  "commandRepository.read/insert/update/correctionExists",
  "commandRepository.lockKey/replay/persist/audit/expiredKeys",
  "dev/shops/:shopId/records",
  "moneyFixtureRepository.insert/read",
  "journalRepository.read/source/replay/positions/linked/append",
  "syntheticJobRepository.request/lock/effected/effect",
  "syntheticJobWriter.enqueue/handleSyntheticJob",
  "restoreRepository.lockState/practice",
  "syntheticJobRepository.restoreState/quarantined/quarantine",
  "syntheticFinancial/fakeOutbound",
  "scheduleRepository.run/enabled/effected/quarantine/apply",
  "enqueueDueSchedules/handleScheduledJob/redriveSyntheticJob",
  "usageRepository.append/read",
  "createUsageWriter.record/recordDraftEvent/read",
  "vocabularyRepository.current/read/resolve/append/advance",
  "reviseVocabulary/resolveVocabulary/searchSynthetic",
];
const origin = "http://127.0.0.1:3103";
export function apiRequest(api, path, headers = {}, body) {
  return api.fetch(
    new Request(`${origin}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
function cookies(response) {
  return response.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
}
export async function withTenantFixture(
  run,
  { legacy = false, draftInstrumentation, mediaAdapters } = {},
) {
  return withPostgres(
    async ({
      connectionString,
      migrationConnectionString,
      adminConnectionString,
    }) => {
      await migrateDatabase(
        migrationConnectionString,
        legacy ? { through: "0002_auth_connection_history.sql" } : {},
      );
      const runtime = createDatabase(connectionString, 1);
      const parallel = createDatabase(connectionString, 2);
      const migration = new pg.Pool({
        connectionString: migrationConnectionString,
      });
      const admin = new pg.Pool({ connectionString: adminConnectionString });
      const capture = [];
      const setupToken = randomBytes(32).toString("hex");
      const owner = createOwnerAuth({
        connectionString,
        origin,
        secret: randomBytes(32).toString("hex"),
        setupToken,
        policy: { signInMax: 100 },
        ...(draftInstrumentation ? { draftInstrumentation } : {}),
        ...(mediaAdapters ? { mediaAdapters } : {}),
        capture: async (message) => {
          capture.push(message);
        },
      });
      const api = createApi(async () => true, owner);
      const password = "synthetic-isolation-password-15";
      try {
        await owner.admit(
          {
            name: "Synthetic A",
            email: "a@example.test",
            password,
            shopName: "சோதனை A",
          },
          setupToken,
          randomUUID(),
        );
        await owner.verify(capture.at(-1).code);
        const aSign = await apiRequest(
          api,
          "/auth/sign-in/email",
          {},
          { email: "a@example.test", password },
        );
        assert.equal(aSign.status, 200);
        const cookieA = cookies(aSign);
        const complete = await owner.complete(new Headers({ Cookie: cookieA }));
        const a = {
          user: (await admin.query("select user_id from owner_bootstrap"))
            .rows[0].user_id,
          shop: complete.data.shopId,
          cookie: cookieA,
        };
        const b = { user: randomUUID(), shop: randomUUID(), cookie: "" };
        // Admin fixture admission is setup only; no production multi-shop path.
        await admin.query(
          "insert into auth_user(id,name,email,email_verified) values($1,'Synthetic B','b@example.test',true)",
          [b.user],
        );
        await admin.query(
          "insert into auth_account(id,account_id,provider_id,user_id,password) select uuidv7(),$1::text,'credential',$1::uuid,password from auth_account where provider_id='credential' and user_id=$2::uuid",
          [b.user, a.user],
        );
        await admin.query(
          "insert into shop(shop_id,name) values($1,'Synthetic B')",
          [b.shop],
        );
        await admin.query(
          "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
          [b.shop, b.user],
        );
        const bSign = await apiRequest(
          api,
          "/auth/sign-in/email",
          {},
          { email: "b@example.test", password },
        );
        assert.equal(bSign.status, 200);
        b.cookie = cookies(bSign);
        if (!legacy)
          await migration.query(
            await readFile("tests/fixtures/tenant-isolation.sql", "utf8"),
          );
        const parentA = randomUUID(),
          parentB = randomUUID(),
          childA = randomUUID(),
          childB = randomUUID();
        if (!legacy) {
          await admin.query(
            "insert into isolation_parent(shop_id,id,label) values($1,$2,'parent-A'),($3,$4,'parent-B')",
            [a.shop, parentA, b.shop, parentB],
          );
          await admin.query(
            "insert into isolation_child(shop_id,id,parent_id,label) values($1,$2,$3,'child-A'),($4,$5,$6,'child-B')",
            [a.shop, childA, parentA, b.shop, childB, parentB],
          );
        }
        return await run({
          runtime,
          parallel,
          migration,
          admin,
          owner,
          api,
          a,
          b,
          parentA,
          parentB,
          childA,
          childB,
          migrationConnectionString,
        });
      } finally {
        await owner.close();
        await Promise.all([
          runtime.pool.end(),
          parallel.pool.end(),
          migration.end(),
          admin.end(),
        ]);
      }
    },
  );
}

export function fixtureRepository(tx) {
  return {
    // Controlled omission proves RLS's defence when a repository forgets WHERE.
    list: () => tx.execute(sql`select * from isolation_parent order by id`),
    byId: (id) =>
      tx.execute(sql`select * from isolation_parent where id=${id}::uuid`),
    children: (id) =>
      tx.execute(
        sql`select * from isolation_child where parent_id=${id}::uuid`,
      ),
    update: (id) =>
      tx.execute(
        sql`update isolation_parent set label=label||'-changed' where id=${id}::uuid returning id`,
      ),
    delete: (id) =>
      tx.execute(
        sql`delete from isolation_child where id=${id}::uuid returning id`,
      ),
  };
}
