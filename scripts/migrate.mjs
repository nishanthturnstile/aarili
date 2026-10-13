import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

export async function migrateDatabase(connectionString, { through } = {}) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(120021)");
    const { rows } = await client.query("SELECT current_user AS role");
    if (rows[0].role !== "app_owner")
      throw new Error("Migrations require app_owner");
    await client.query(
      "CREATE TABLE IF NOT EXISTS aarili_migration (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const paths = [
      ...(await readdir("packages/db/migrations/generated"))
        .filter((f) => f.endsWith(".sql"))
        .map((f) => `generated/${f}`),
      ...(await readdir("packages/db/migrations")).filter((f) =>
        f.endsWith(".sql"),
      ),
    ].sort();
    // Generated auth schema must precede the reviewed grants/RLS/bootstrap SQL.
    paths.sort(
      (a, b) =>
        Number(!a.startsWith("generated/")) -
          Number(!b.startsWith("generated/")) || a.localeCompare(b),
    );
    if (through && !paths.includes(through))
      throw new Error("Unknown migration boundary");
    for (const name of paths) {
      const source = await readFile(`packages/db/migrations/${name}`, "utf8");
      const hash = createHash("sha256").update(source).digest("hex");
      const prior = await client.query(
        "SELECT sha256 FROM aarili_migration WHERE name = $1",
        [name],
      );
      if (prior.rowCount) {
        if (prior.rows[0].sha256 !== hash)
          throw new Error("Applied migration changed");
        if (name === through) break;
        continue;
      }
      await client.query(source);
      await client.query(
        "INSERT INTO aarili_migration(name, sha256) VALUES($1, $2)",
        [name, hash],
      );
      if (name === through) break;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (resolve(process.argv[1] ?? "") === resolve("scripts/migrate.mjs")) {
  try {
    if (!process.env.MIGRATION_DATABASE_URL)
      throw new Error("Migration configuration missing");
    await migrateDatabase(process.env.MIGRATION_DATABASE_URL);
    console.info(
      "Reviewed migrations applied with app_owner and advisory locking.",
    );
  } catch {
    console.error(
      "Migration failed; inspect configuration and reviewed SQL without exposing credentials.",
    );
    process.exitCode = 1;
  }
}
