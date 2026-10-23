import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

// Same reviewed image as local infra; no fixed host bindings, volumes or reuse.
const image =
  "postgres:18.6-bookworm@sha256:bbf83594798e144bff365a9c191c5d779f181fb3135902064ab8ff11918020fc";

async function isOpen(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function withPostgres(run) {
  const password = randomBytes(24).toString("hex");
  const ownerPassword = randomBytes(24).toString("hex");
  const userPassword = randomBytes(24).toString("hex");
  const container = await new PostgreSqlContainer(image)
    .withDatabase("aarili_health_test")
    .withPassword(password)
    .withStartupTimeout(120000)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  console.info(
    `0.1.2a disposable PostgreSQL ready: ${host}:${port}; container ${container.getId().slice(0, 12)}`,
  );
  let stopped = false;
  async function stop() {
    if (stopped) return;
    await container.stop({ timeout: 10000, remove: true, removeVolumes: true });
    stopped = true;
    for (let attempt = 0; attempt < 30 && (await isOpen(host, port)); attempt++)
      await delay(100);
    assert.equal(
      await isOpen(host, port),
      false,
      "Disposable PostgreSQL port remains open after cleanup",
    );
    console.info(`0.1.2a disposable PostgreSQL cleaned: ${host}:${port}`);
  }
  try {
    const admin = new pg.Client({
      connectionString: container.getConnectionUri(),
      connectionTimeoutMillis: 2000,
    });
    try {
      await admin.connect();
      assert.equal((await admin.query("SELECT 1 AS ready")).rows[0].ready, 1);
      // Generated hex only; admin credentials exist solely in this disposable fixture.
      await admin.query(
        `CREATE ROLE app_user LOGIN PASSWORD '${userPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
      await admin.query(
        `CREATE ROLE app_owner LOGIN PASSWORD '${ownerPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
      await admin.query(
        await readFile("infra/provision-maintenance-roles.sql", "utf8"),
      );
      await admin.query(
        "ALTER DATABASE aarili_health_test OWNER TO app_owner; REVOKE ALL ON SCHEMA public FROM PUBLIC; ALTER SCHEMA public OWNER TO app_owner; GRANT USAGE ON SCHEMA public TO app_user",
      );
    } finally {
      await admin.end();
    }
    const url = new URL(container.getConnectionUri());
    url.username = "app_user";
    url.password = userPassword;
    const migrationUrl = new URL(container.getConnectionUri());
    migrationUrl.username = "app_owner";
    migrationUrl.password = ownerPassword;
    return await run({
      connectionString: url.toString(),
      migrationConnectionString: migrationUrl.toString(),
      // Setup/drift only; tests must use app_user for runtime isolation claims.
      adminConnectionString: container.getConnectionUri(),
      host,
      port,
      stop,
    });
  } finally {
    await stop();
  }
}
