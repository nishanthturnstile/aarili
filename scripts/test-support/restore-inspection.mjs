import assert from "node:assert/strict";
import { prospectiveAuthDelivery } from "@aarili/auth/delivery-guard";
import { sql } from "@aarili/db";
import { handleSyntheticJob, startSyntheticQueue } from "@aarili/jobs";
import {
  barrier,
  consumeOne,
  jobCommand,
  jobCounts,
  jobPayload,
} from "./jobs.mjs";
import {
  fakeAuthDelivery,
  fakeOutbound,
  syntheticFinancial,
} from "./restore.mjs";

export function createRestoreInspection(f) {
  let payload, pending, release, transition, restarted;
  const status = async () => {
    const controls = await f.control();
    const quarantine = (
      await f.admin.query(
        "select request_id,request_epoch,observed_epoch,reason from synthetic_job_quarantine order by occurred_at",
      )
    ).rows;
    const counts = await jobCounts(f);
    const queueQuarantine = (
      await f.admin.query(
        "select id,data->>'shopId' as shop_id,data->>'epoch' as request_epoch,output->>'error' as reason,state from pgboss.job where output->>'error' in ('RESTORE_QUARANTINED','SYNTHETIC_JOB_DENIED')",
      )
    ).rows;
    const state = {
      ...controls,
      quarantine,
      queueQuarantine,
      counts,
      operator: f.fake.operator,
      fakeCalls: f.fake.calls,
      authFakeCalls: f.fake.authCalls,
    };
    console.info(JSON.stringify(state));
    return state;
  };
  const pause = async (kind) => {
    assert(!pending, "Resume before pausing again");
    const entered = barrier();
    release = barrier();
    const checkpoint = async (tx) => {
      await tx.execute(
        sql`select set_config('idle_in_transaction_session_timeout','600000',true)`,
      );
      entered.resolve();
      await release.promise;
    };
    pending =
      kind === "finance"
        ? syntheticFinancial(f, "confirmation", { checkpoint })
        : fakeOutbound(f, payload, { checkpoint });
    try {
      await Promise.race([
        entered.promise,
        pending.then(() => {
          throw Error("Pause guard denied");
        }),
      ]);
    } catch (error) {
      release.resolve();
      pending = undefined;
      throw error;
    }
    console.info(
      `Paused ${kind} before commit/boundary. Use freeze-queued or restore-queued then resume within 10 minutes.`,
    );
  };
  const resume = async () => {
    assert(pending);
    release.resolve();
    const operation = pending;
    pending = undefined;
    console.info(`Protected outcome: ${JSON.stringify(await operation)}`);
    if (transition) {
      await transition;
      transition = undefined;
    }
  };
  const action = async (name) => {
    if (name === "guard-status") return status();
    if (name === "resume") {
      await resume();
      return status();
    }
    if (["freeze-queued", "restore-queued"].includes(name)) {
      assert(pending && !transition);
      transition = f.control(name === "freeze-queued" ? "freeze" : "restore");
      // The paused operation holds the shared lock. The private transition
      // remains pending; the next resume command permits its completion.
      console.info(
        "Operator transition requested; cannot complete before the paused transaction settles.",
      );
      return;
    }
    assert(!pending, "Resume the paused operation before this command");
    if (name === "guard-queue")
      payload = await jobPayload(f, await jobCommand(f));
    else if (name === "operator-disable") f.fake.operator = "disabled";
    else if (name === "fake-enable")
      f.fake.operator = "enabled"; // Disposable counter only, not process.env.
    else if (
      [
        "restore",
        "freeze",
        "reconcile",
        "database-enable",
        "database-disable",
      ].includes(name)
    )
      await f.control(name.replace("database-", ""));
    else if (name === "restart") {
      await f.boss.stop();
      f.boss = await startSyntheticQueue(f.parallel.db);
      restarted = f.boss;
      console.info(
        "Queue client restarted; database and all guards preserved.",
      );
    } else if (name === "quarantine")
      console.info(`Queue outcome: ${await consumeOne(f)}`);
    else if (name === "redrive") {
      assert(payload);
      console.info(
        `Redrive: ${await handleSyntheticJob(f.parallel.db, payload)}`,
      );
    } else if (name === "fake-send") {
      assert(payload);
      console.info(`Fake boundary: ${await fakeOutbound(f, payload)}`);
    } else if (name === "attempt-release") {
      await assert.rejects(() =>
        f.runtime.db.execute(sql`update system_state set money_frozen=false`),
      );
      await assert.rejects(() =>
        f.operator.query("delete from synthetic_job_quarantine"),
      );
      console.info(
        "Runtime unfreeze and operator quarantine deletion denied. No release API exists.",
      );
    } else if (name.startsWith("finance-")) {
      const kind = name.slice("finance-".length);
      assert(
        ["confirmation", "allocation", "reversal", "refund"].includes(kind),
      );
      try {
        await syntheticFinancial(f, kind);
        console.info(`Synthetic ${kind}: committed`);
      } catch (error) {
        if (error.message !== "FINANCIAL_MUTATION_FROZEN") throw error;
        console.info(`Synthetic ${kind}: FINANCIAL_MUTATION_FROZEN`);
      }
    } else if (name === "pause-finance") await pause("finance");
    else if (name === "pause-effect") {
      assert(payload);
      await pause("effect");
    } else if (name === "auth-probe") {
      console.info(
        `Prospective real delivery: ${await prospectiveAuthDelivery(f.runtime.db, f.a.user, "reset")}; disposable fake: ${await fakeAuthDelivery(f, f.a.user)}`,
      );
    } else throw Error("Unknown restore inspection command");
    if (!pending) return status();
  };
  return {
    action,
    cleanup: async () => {
      if (pending) await resume();
      if (restarted) await restarted.stop();
    },
  };
}
