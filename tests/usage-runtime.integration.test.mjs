import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { executeSynthetic } from "@aarili/core/commands";
import { withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { startJobRuntime } from "@aarili/jobs/runtime";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

test("0.4.1d D5/D7 real worker handler rollback and retry survive a throwing reporter with zero private arguments", async () => {
  await withTenantFixture(async (f) => {
    await f.migration.query(
      await readFile("tests/fixtures/command.sql", "utf8"),
    );
    let queued = false,
      attempts = 0;
    const reports = [];
    const key = randomUUID();
    const runtime = await startJobRuntime(
      f.parallel.pool.options.connectionString,
      {
        mode: "worker",
        pollMilliseconds: 25,
        reportFailure: (...args) => {
          reports.push(args);
          throw Error("private-reporter-canary-54");
        },
      },
      {
        handlers: new Map([
          [
            "foundation.schedule",
            async (db) => {
              attempts++;
              await withShop(db, f.a.user, f.a.shop, async (tx) => {
                await executeSynthetic(
                  {
                    shopId: f.a.shop,
                    actor: { type: "user", id: f.a.user },
                    repository: commandRepository(tx, f.a.shop),
                  },
                  { action: "create", value: "alpha" },
                  { key, requestId: randomUUID() },
                  null,
                );
                if (attempts === 1) throw Error("private-job-error-canary-54");
              });
              return "completed";
            },
          ],
        ]),
        enqueue: async (_db, boss) => {
          if (!queued) {
            queued = true;
            await boss.send(
              "foundation.schedule",
              { body: "private-job-body-canary-54" },
              { retryLimit: 1, retryDelay: 0 },
            );
          }
        },
        status: async () => ({}),
      },
    );
    try {
      let completed = false;
      for (let i = 0; i < 100; i++) {
        completed =
          (
            await f.admin.query(
              "select count(*)::int n from pgboss.job where name='foundation.schedule' and state='completed'",
            )
          ).rows[0].n === 1;
        if (completed) break;
        await delay(50);
      }
      assert(completed, "retry did not complete");
      assert.equal(attempts, 2);
      assert.deepEqual(reports, [[]]);
      for (const table of [
        "synthetic_record",
        "audit_event",
        "idempotency_key",
      ])
        assert.equal(
          (
            await f.admin.query(
              `select count(*)::int n from ${table}${table === "synthetic_record" ? "" : " where action like 'synthetic.%'"}`,
            )
          ).rows[0].n,
          1,
        );
    } finally {
      await runtime.stop();
    }
  });
}, 120000);
