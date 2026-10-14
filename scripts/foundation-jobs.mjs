import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { sql } from "@aarili/db";
import { handleSyntheticJob, syntheticQueue } from "@aarili/jobs";
import {
  barrier,
  consumeOne,
  jobCounts,
  jobPayload,
  jobsApiRequest,
} from "./test-support/jobs.mjs";
import { withRestoreFixture } from "./test-support/restore.mjs";
import { createRestoreInspection } from "./test-support/restore-inspection.mjs";
import {
  createRuntimeInspection,
  runtimeCommands,
} from "./test-support/runtime-inspection.mjs";

export function validateJobsHarness(args, env) {
  if (
    args.length !== 1 ||
    !["--demo", "--interactive"].includes(args[0]) ||
    env.NODE_ENV === "production" ||
    Object.keys(env).some(
      (name) =>
        /^(?:PG|.*DATABASE_URL$|.*(?:API_KEY|ACCESS_KEY|ACCESS_KEY_ID|SECRET_ACCESS_KEY|PROVIDER_TOKEN)$|RESEND_.*|SMTP_.*)/i.test(
          name,
        ) && env[name],
    ) ||
    (env.OUTBOUND_EFFECTS &&
      !["disabled", "false", "0"].includes(env.OUTBOUND_EFFECTS))
  )
    throw Error(
      "Use --demo or --interactive without a database target, production mode or outbound activation",
    );
  return args[0];
}

export function createJobsInspection(f) {
  let pending,
    release,
    abort = false,
    key,
    result;
  const inspect = async () => {
    const counts = await jobCounts(f);
    console.info(JSON.stringify(counts));
    return counts;
  };
  const settle = async (rollback) => {
    assert(pending, "Run pause first");
    abort = rollback;
    release.resolve();
    const response = await pending;
    pending = undefined;
    f.setApiCheckpoint(async () => {});
    assert.equal(response.status, rollback ? 503 : 200);
    if (!rollback) result = await response.json();
    return inspect();
  };
  const action = async (name) => {
    if (name === "pause") {
      assert(!pending, "Settle the current command first");
      key = randomUUID();
      result = undefined;
      abort = false;
      const entered = barrier();
      release = barrier();
      f.setApiCheckpoint(async (tx) => {
        // Only this disposable manual fixture extends the idle window.
        await tx.execute(
          sql`select set_config('idle_in_transaction_session_timeout','600000',true)`,
        );
        entered.resolve();
        await release.promise;
        if (abort) throw Error("Synthetic rollback after real enqueue");
      });
      pending = jobsApiRequest(f, { key });
      const checkpoint = await Promise.race([
        entered.promise.then(() => "paused"),
        pending.then(() => "failed"),
      ]);
      assert.equal(checkpoint, "paused");
      assert.deepEqual(await f.boss.fetch(syntheticQueue), []);
      console.info(
        "Synthetic API paused after change/audit/key/request/job writes: separate app_user fetch returned zero runnable jobs. Use commit or rollback within 10 minutes.",
      );
      return inspect();
    }
    if (name === "commit") return settle(false);
    if (name === "rollback") return settle(true);
    if (name === "inspect") return inspect();
    assert(!pending, "Commit or rollback before another operation");
    assert(result, "Run pause and commit first");
    if (name === "replay") {
      const response = await jobsApiRequest(f, { key });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), result);
      console.info(
        "200: committed response replayed; no additional job or audit",
      );
    } else if (name === "changed") {
      const response = await jobsApiRequest(f, { key, value: "beta" });
      assert.equal(response.status, 422);
      console.info("422: changed request binding rejected");
    } else if (name === "consume") {
      const outcome = await consumeOne(f);
      console.info(`Database-only handler: ${outcome}`);
    } else if (name === "duplicate") {
      const outcome = await handleSyntheticJob(
        f.parallel.db,
        await jobPayload(f, result),
      );
      console.info(`Duplicate delivery: ${outcome}`);
    } else if (name === "revoke") {
      await f.admin.query(
        "delete from shop_membership where shop_id=$1 and user_id=$2",
        [f.a.shop, f.a.user],
      );
      console.info(
        "Disposable fixture membership revoked; use consume to observe ignored/no effect",
      );
    } else if (name === "stale") {
      const response = await jobsApiRequest(f, {
        path: `/dev/shops/${f.a.shop}/records/${result.record.id}`,
        method: "PATCH",
        input: { action: "edit", value: "beta" },
        headers: { "If-Match": '"v1"' },
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).record.version, 2);
      console.info(
        "Disposable entity moved to version 2; queued version 1 is obsolete",
      );
    } else
      throw Error(
        "Use pause, commit, rollback, inspect, replay, changed, consume, duplicate, revoke or stale",
      );
    return inspect();
  };
  return {
    action,
    cleanup: async () => {
      if (pending) await settle(true);
    },
  };
}

async function main() {
  const mode = validateJobsHarness(process.argv.slice(2), process.env);
  console.info(
    "0.3.2a/b/c disposable synthetic PostgreSQL/API/pg-boss proof; real outbound stays disabled, no retained configuration or provider transport loaded.",
  );
  await withRestoreFixture(async (f) => {
    const inspection = createJobsInspection(f);
    const restore = createRestoreInspection(f);
    const runtime = createRuntimeInspection(f);
    const restoreCommands = new Set([
      "guard-status",
      "guard-queue",
      "operator-disable",
      "fake-enable",
      "restore",
      "freeze",
      "reconcile",
      "database-enable",
      "database-disable",
      "restart",
      "quarantine",
      "redrive",
      "fake-send",
      "attempt-release",
      "finance-confirmation",
      "finance-allocation",
      "finance-reversal",
      "finance-refund",
      "pause-finance",
      "pause-effect",
      "freeze-queued",
      "restore-queued",
      "resume",
      "auth-probe",
    ]);
    try {
      if (mode === "--demo") {
        for (const name of [
          "pause",
          "commit",
          "replay",
          "changed",
          "consume",
          "duplicate",
          "pause",
          "rollback",
        ])
          await inspection.action(name);
        for (const name of [
          "guard-queue",
          "database-enable",
          "operator-disable",
          "restore",
          "restart",
          "quarantine",
          "redrive",
          "attempt-release",
          "finance-confirmation",
          "finance-allocation",
          "finance-reversal",
          "finance-refund",
          "auth-probe",
          "reconcile",
          "database-enable",
          "guard-queue",
          "fake-enable",
          "fake-send",
          "operator-disable",
          "auth-probe",
        ])
          await restore.action(name);
        for (const name of [
          "runtime-two",
          "runtime-queue",
          "runtime-schedule",
          "runtime-status",
          "runtime-stop",
          "runtime-crash-before",
          "runtime-crash-after",
          "runtime-timeout",
          "runtime-stop",
        ])
          await runtime.action(name);
      } else {
        const input = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        console.info(
          "Commands: pause, commit, rollback, inspect, replay, changed, consume, duplicate, revoke, stale, quit. Run stale/revoke in separate fresh harnesses before consume.",
        );
        console.info(
          `Restore commands: ${[...restoreCommands].join(", ")}. fake-enable affects ONLY the disposable counter configuration. OUTBOUND_EFFECTS and all real adapters remain disabled.`,
        );
        console.info(
          `Runtime commands: ${runtimeCommands.join(", ")}. Consumers act asynchronously; runtime-status shows actual state. Start failures/revocation in fresh harnesses before effects.`,
        );
        try {
          for (;;) {
            const line = (await input.question("jobs> ")).trim();
            if (line === "quit") break;
            try {
              if (runtimeCommands.includes(line)) await runtime.action(line);
              else if (restoreCommands.has(line)) await restore.action(line);
              else await inspection.action(line);
            } catch {
              console.info(
                "Operation rejected; inspect state and the documented sequence. No private error logged.",
              );
            }
          }
        } finally {
          input.close();
        }
      }
    } finally {
      await runtime.cleanup();
      await restore.cleanup();
      await inspection.cleanup();
    }
  });
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      "Synthetic jobs proof failed; configuration and private errors suppressed",
    );
    process.exitCode = 1;
  });
