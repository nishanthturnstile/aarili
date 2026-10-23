import assert from "node:assert/strict";
import { createDatabase, sql } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { startJobRuntime } from "@aarili/jobs/runtime";
import pg from "pg";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withPostgres } from "../scripts/test-support/postgres.mjs";

test("#28 pg-boss 45→46 preserves pending jobs, migration history and runtime DDL denial", async () => {
  await withPostgres(async (c) => {
    await migrateDatabase(c.migrationConnectionString, {
      through: "0045_measurement_sessions.sql",
    });
    const owner = new pg.Client({
      connectionString: c.migrationConnectionString,
    });
    const runtime = createDatabase(c.connectionString);
    await owner.connect();
    try {
      const before = await owner.query(
        "SELECT name,sha256 FROM aarili_migration ORDER BY name",
      );
      const pending = await owner.query(
        "INSERT INTO pgboss.job(name,data) VALUES ('foundation.dead',$1) RETURNING id,data,state",
        [{ synthetic: "issue-28-pending" }],
      );
      await assert.rejects(
        () => startJobRuntime(c.connectionString, { mode: "worker" }),
        /setup missing or incompatible/,
      );
      await Promise.all([
        // Freeze this historical pg-boss upgrade at its reviewed migration;
        // later feature migrations have their own populated-upgrade fixtures.
        migrateDatabase(c.migrationConnectionString, {
          through: "0046_pgboss_12_38.sql",
        }),
        migrateDatabase(c.migrationConnectionString, {
          through: "0046_pgboss_12_38.sql",
        }),
      ]);
      assert.equal(
        (await owner.query("SELECT version FROM pgboss.version")).rows[0]
          .version,
        46,
      );
      assert.deepEqual(
        (
          await owner.query(
            "SELECT id,data,state FROM pgboss.job WHERE id=$1",
            [pending.rows[0].id],
          )
        ).rows,
        pending.rows,
      );
      assert.deepEqual(
        (
          await owner.query(
            "SELECT name,sha256 FROM aarili_migration WHERE name<>$1 ORDER BY name",
            ["0046_pgboss_12_38.sql"],
          )
        ).rows,
        before.rows,
      );
      const worker = await startJobRuntime(c.connectionString, {
        mode: "worker",
      });
      try {
        assert(worker.handlers.includes("media.process"));
        await assertIsolationCatalog(runtime.db);
        await assert.rejects(() =>
          runtime.db.execute(
            sql`ALTER TABLE pgboss.queue ADD COLUMN forbidden int`,
          ),
        );
      } finally {
        await worker.stop();
      }
    } finally {
      await owner.end();
      await runtime.pool.end();
    }
  });
}, 120000);

test("#28 pg-boss upgrade fails atomically for unreviewed queue partitions", async () => {
  await withPostgres(async (c) => {
    await migrateDatabase(c.migrationConnectionString, {
      through: "0045_measurement_sessions.sql",
    });
    const owner = new pg.Client({
      connectionString: c.migrationConnectionString,
    });
    await owner.connect();
    try {
      await owner.query(
        'SELECT pgboss.create_queue(\'upgrade.partition\', \'{"policy":"standard","partition":true}\'::jsonb)',
      );
      await assert.rejects(
        () => migrateDatabase(c.migrationConnectionString),
        /reviewed partition index plan/,
      );
      assert.equal(
        (await owner.query("SELECT version FROM pgboss.version")).rows[0]
          .version,
        45,
      );
      assert.equal(
        (
          await owner.query(
            "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='pgboss' AND table_name='queue' AND column_name='retained_count'",
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await owner.end();
    }
  });
}, 120000);
