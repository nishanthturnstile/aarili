import { readFile } from "node:fs/promises";
import pg from "pg";
import { migrateDatabase } from "./migrate.mjs";

async function installFixture() {
  // Explicit synthetic-only fixture setup, separate from application migrations.
  const url = process.env.MIGRATION_DATABASE_URL;
  if (
    !["development", "test"].includes(process.env.NODE_ENV) ||
    !url ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  ) {
    throw new Error(
      "Command fixture requires explicit development/test and loopback migration configuration",
    );
  }
  await migrateDatabase(url);
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(120021)");
    if (
      (await client.query("select current_user as role")).rows[0].role !==
      "app_owner"
    )
      throw new Error("Fixture requires app_owner");
    if (
      !(await client.query("select to_regclass('synthetic_record') as r"))
        .rows[0].r
    )
      await client.query(await readFile("tests/fixtures/command.sql", "utf8"));
    await client.query("COMMIT");
    console.info(
      "Synthetic command fixture installed; no external activation.",
    );
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error(
      "Command fixture installation failed; inspect reviewed SQL/configuration privately",
    );
  } finally {
    await client.end();
  }
}
try {
  await installFixture();
} catch {
  console.error(
    "Synthetic command fixture installation denied or failed; inspect private configuration and reviewed SQL",
  );
  process.exitCode = 1;
}
