import { createServer } from "node:net";
import { createApi } from "@aarili/api";
import { checkDatabaseReadiness } from "@aarili/platform/database-health";
import pg from "pg";
import { expect, test } from "vitest";
import { withPostgres } from "../scripts/test-support/postgres.mjs";

test("USE-08/09 0.1.2a real PostgreSQL readiness, query timeout, unavailable and failure cleanup", async () => {
  await withPostgres(async ({ connectionString, stop }) => {
    const probe = () => checkDatabaseReadiness(connectionString);
    expect(await probe()).toBe(true);
    expect((await createApi(probe).request("/api/healthz")).status).toBe(200);
    const started = Date.now();
    expect(
      await checkDatabaseReadiness(connectionString, {
        timeoutMs: 100,
        createClient: (config) => {
          const client = new pg.Client(config);
          const query = client.query.bind(client);
          client.query = () => query("SELECT pg_sleep(5), 1 AS ready");
          return client;
        },
      }),
    ).toBe(false);
    expect(Date.now() - started).toBeLessThan(1500);
    const observer = new pg.Client({ connectionString });
    try {
      await observer.connect();
      // Connections and timed-out server statements must be gone, not merely detached promises.
      await expect
        .poll(
          async () =>
            (
              await observer.query(
                "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE application_name = 'aarili-health'",
              )
            ).rows[0].count,
          // Allow bounded backend teardown on the VM, but fail before the
          // five-second sleep can finish naturally if cancellation is lost.
          { timeout: 2500 },
        )
        .toBe(0);
    } finally {
      await observer.end();
    }
    await stop();
    expect((await createApi(probe).request("/api/healthz")).status).toBe(503);
  });
}, 180000);

test("0.1.2a failed callback cleans up a running PostgreSQL fixture", async () => {
  await expect(
    withPostgres(async () => {
      throw new Error("handled running-fixture failure");
    }),
  ).rejects.toThrow("handled running-fixture failure");
}, 180000);

test("0.1.2a silent PostgreSQL handshake times out and closes native sockets", async () => {
  const sockets = new Set();
  const server = createServer((socket) => {
    // Drain the startup packet so the synthetic server observes peer EOF.
    socket.resume();
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const started = Date.now();
    expect(
      await checkDatabaseReadiness(
        `postgres://app_user:synthetic@127.0.0.1:${server.address().port}/test`,
        { timeoutMs: 100 },
      ),
    ).toBe(false);
    expect(Date.now() - started).toBeLessThan(1500);
    await expect.poll(() => sockets.size).toBe(0);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
