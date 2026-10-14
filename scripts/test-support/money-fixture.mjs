import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createDatabase } from "@aarili/db";
import pg from "pg";
import { migrateDatabase } from "../migrate.mjs";
import { withPostgres } from "./postgres.mjs";

// No URL/config argument. The only target is created and owned by Testcontainers.
export async function withMoneyFixture(run) {
  return withPostgres(async (configuration) => {
    await migrateDatabase(configuration.migrationConnectionString);
    const migration = new pg.Client({
      connectionString: configuration.migrationConnectionString,
    });
    const admin = new pg.Client({
      connectionString: configuration.adminConnectionString,
    });
    const runtime = createDatabase(configuration.connectionString, 2);
    const a = { user: randomUUID(), shop: randomUUID() };
    const b = { user: randomUUID(), shop: randomUUID() };
    try {
      await migration.connect();
      await admin.connect();
      assert.equal(
        (
          await migration.query(
            "select to_regclass('synthetic_money_value') as r",
          )
        ).rows[0].r,
        null,
        "Production migrations must not install the synthetic money fixture",
      );
      await migration.query("BEGIN");
      await migration.query("SELECT pg_advisory_xact_lock(120021)");
      assert.equal(
        (await migration.query("select current_user as role")).rows[0].role,
        "app_owner",
      );
      await migration.query(await readFile("tests/fixtures/money.sql", "utf8"));
      await migration.query("COMMIT");
      for (const [identity, name] of [
        [a, "money-a"],
        [b, "money-b"],
      ]) {
        await admin.query(
          "insert into auth_user(id,name,email,email_verified) values($1,$2,$3,true)",
          [identity.user, `Synthetic ${name}`, `${name}@example.test`],
        );
        await admin.query("insert into shop(shop_id,name) values($1,$2)", [
          identity.shop,
          `Synthetic ${name}`,
        ]);
        await admin.query(
          "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
          [identity.shop, identity.user],
        );
      }
      return await run({ runtime, migration, admin, a, b });
    } finally {
      await migration.query("ROLLBACK").catch(() => {});
      await Promise.all([runtime.pool.end(), migration.end(), admin.end()]);
    }
  });
}
