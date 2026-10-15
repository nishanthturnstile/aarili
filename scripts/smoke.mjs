import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { readHealth } from "../packages/api/dist/client.js";
import { migrateDatabase } from "./migrate.mjs";
import { withPostgres } from "./test-support/postgres.mjs";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}
function child(args, cwd, overrides = {}) {
  const proc = spawn(process.execPath, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, NODE_ENV: "production", ...overrides },
  });
  let output = "";
  proc.stdout.on("data", (chunk) => {
    output += chunk;
  });
  proc.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const exit = once(proc, "exit");
  return { proc, exit, output: () => output };
}
async function waitUntil(predicate, process) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await predicate()) return;
    if (process.proc.exitCode !== null) throw new Error(process.output());
    await delay(100);
  }
  throw new Error(`Boot timed out: ${process.output()}`);
}
await withPostgres(
  async ({ connectionString, migrationConnectionString, stop }) => {
    await migrateDatabase(migrationConnectionString);
    const port = await freePort();
    cpSync(
      "apps/web/.next/static",
      "apps/web/.next/standalone/apps/web/.next/static",
      { recursive: true },
    );
    const web = child([".next/standalone/apps/web/server.js"], "apps/web", {
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DATABASE_URL: connectionString,
    });
    const worker = child(["dist/index.js"], "apps/worker", {
      DATABASE_URL: connectionString,
      OUTBOUND_EFFECTS: "disabled",
      RUN_JOBS_INPROCESS: "false",
    });
    try {
      await waitUntil(async () => {
        try {
          const result = await readHealth(`http://127.0.0.1:${port}`);
          return "status" in result && result.status === "ok";
        } catch {
          return false;
        }
      }, web);
      const page = await fetch(`http://127.0.0.1:${port}`);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.equal(new URL(page.url).pathname, "/sign-in");
      assert(!html.includes("The development workspace is running"));
      assert(!html.includes("data-aarili-theme"));
      assert.match(html, /Aarili/);
      assert.match(html, /<main[^>]*lang="en"/);
      const asset = html.match(/src="([^"]*\/_next\/static\/[^"]+)"/)?.[1];
      assert(asset, "Production page has no client asset");
      assert.equal(
        (await fetch(new URL(asset, `http://127.0.0.1:${port}`))).status,
        200,
      );
      const missing = await fetch(`http://127.0.0.1:${port}/api/orders`);
      assert.equal(missing.status, 404);
      for (const path of [
        "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records",
        "/api/openapi.json",
        "/api/docs",
      ]) {
        for (const method of ["GET", "POST", "PATCH"])
          assert.equal(
            (await fetch(`http://127.0.0.1:${port}${path}`, { method })).status,
            404,
            "0.2.3 exemplar/docs must be absent in production",
          );
      }
      const preview = await fetch(`http://127.0.0.1:${port}/dev/design-system`);
      assert.equal(
        preview.status,
        404,
        "Removed design preview must be unavailable in production",
      );
      const unsupported = await fetch(`http://127.0.0.1:${port}/api/healthz`, {
        method: "POST",
      });
      assert.equal(unsupported.status, 404);
      await waitUntil(
        () => worker.output().includes("aarili-worker ready"),
        worker,
      );
      worker.proc.send("shutdown");
      assert.match(
        worker.output(),
        /foundation.schedule; real providers disabled/,
      );
      assert(!worker.output().includes("no job consumers registered"));
      const [code] = await Promise.race([
        worker.exit,
        delay(5000).then(() => {
          throw new Error("Worker did not shut down");
        }),
      ]);
      assert.equal(code, 0);
      assert.match(worker.output(), /aarili-worker stopped/);
      await stop();
      const unavailable = await fetch(`http://127.0.0.1:${port}/api/healthz`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await readHealth(`http://127.0.0.1:${port}`), {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database is unavailable",
        },
      });
      console.info(
        "0.1.2a production Next/Hono/real PostgreSQL readiness and outage, typed client, worker shutdown passed.",
      );
    } finally {
      web.proc.kill();
      if (worker.proc.exitCode === null) worker.proc.kill();
      await Promise.all([web.exit, worker.exit]);
    }
  },
);
