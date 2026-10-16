import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createCommandRoutes } from "@aarili/api/commands";
import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { executeSynthetic } from "@aarili/core/commands";
import { withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import {
  handleSyntheticJob,
  startSyntheticQueue,
  syntheticJobWriter,
  syntheticQueue,
} from "@aarili/jobs";
import { withTenantFixture } from "./tenant-isolation.mjs";

const jobsOrigin = "http://127.0.0.1:3103";
export function barrier() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// No target URL. Only the existing Testcontainers helper creates/provisions DBs.
export async function withJobsFixture(run) {
  return withTenantFixture(async (f) => {
    assert.equal(
      (await f.admin.query("select to_regclass('synthetic_job_request') as r"))
        .rows[0].r,
      null,
    );
    assert.equal(
      (await f.admin.query("select count(*)::int as n from pgboss.queue"))
        .rows[0].n,
      4,
    );
    const migration = await f.migration.connect();
    try {
      await migration.query("BEGIN");
      await migration.query("SELECT pg_advisory_xact_lock(120021)");
      for (const name of ["command", "jobs"])
        await migration.query(
          await readFile(`tests/fixtures/${name}.sql`, "utf8"),
        );
      await migration.query("COMMIT");
    } finally {
      await migration.query("ROLLBACK").catch(() => {});
      migration.release();
    }
    const boss = await startSyntheticQueue(f.parallel.db);
    let apiCheckpoint = async () => {};
    const api = createCommandRoutes({
      ...f.owner,
      withOwnerCommand: (headers, shopId, runCommand) =>
        f.owner.withOwnerTransaction(headers, shopId, async (tx, userId) => {
          const response = await runCommand({
            shopId,
            actor: { type: "user", id: userId },
            repository: commandRepository(tx, shopId),
            jobs: syntheticJobWriter(boss, tx, shopId, userId),
          });
          await apiCheckpoint(tx, response);
          return response;
        }),
    });
    try {
      return await run({
        ...f,
        boss,
        jobsApi: api,
        setApiCheckpoint: (fn) => {
          apiCheckpoint = fn;
        },
      });
    } finally {
      await boss.stop();
    }
  });
}

export function jobCommand(
  f,
  {
    who = f.a,
    key = randomUUID(),
    input = { action: "create", value: "alpha" },
    target = null,
    version,
    decorate = (r) => r,
    decorateJobs = (r) => r,
    checkpoint = async () => {},
    pool = f.parallel,
  } = {},
) {
  return withShop(pool.db, who.user, who.shop, async (tx) => {
    assert(await authorizeJobPrincipal(tx, who.user, who.shop));
    const response = await executeSynthetic(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: decorate(commandRepository(tx, who.shop), tx),
        jobs: decorateJobs(
          syntheticJobWriter(f.boss, tx, who.shop, who.user),
          tx,
        ),
      },
      input,
      {
        key,
        requestId: randomUUID(),
        ...(version ? { ifMatch: `"v${version}"` } : {}),
      },
      target,
    );
    await checkpoint(tx, response);
    return response;
  });
}
export async function jobCounts(f) {
  return (
    await f.admin.query(`select
    (select count(*)::int from synthetic_record) as records,
    (select count(*)::int from audit_event where action like 'synthetic.%' and action<>'synthetic.job.consume') as command_audit,
    (select count(*)::int from audit_event where action='synthetic.job.consume') as handler_audit,
    (select count(*)::int from idempotency_key) as keys,
    (select count(*)::int from synthetic_job_request) as requests,
    (select count(*)::int from pgboss.job) as jobs,
    (select count(*)::int from synthetic_job_effect) as effects`)
  ).rows[0];
}
export async function jobPayload(f, response) {
  const { rows } = await f.admin.query(
    "select data from pgboss.job where name=$1 and id=$2",
    [syntheticQueue, response.record.eventId],
  );
  return rows[0]?.data;
}
export async function consumeOne(f) {
  const [job] = await f.boss.fetch(syntheticQueue, { includeMetadata: true });
  if (!job) return "empty";
  try {
    const result = await handleSyntheticJob(f.parallel.db, job.data);
    if (result === "quarantined")
      await f.boss.fail(syntheticQueue, job, { error: "RESTORE_QUARANTINED" });
    else if (result === "ignored")
      await f.boss.fail(syntheticQueue, job, { error: "SYNTHETIC_JOB_DENIED" });
    else await f.boss.complete(syntheticQueue, job);
    return result;
  } catch {
    // No driver error/payload in failure output; pg-boss handles retry state.
    await f.boss.fail(syntheticQueue, job, {
      error: "SYNTHETIC_HANDLER_FAILED",
    });
    return "retry";
  }
}

export function jobsApiRequest(
  f,
  {
    who = f.a,
    key = randomUUID(),
    value = "alpha",
    input,
    headers = {},
    path = `/dev/shops/${who.shop}/records`,
    method = "POST",
  } = {},
) {
  return f.jobsApi.fetch(
    new Request(`${jobsOrigin}${path}`, {
      method,
      headers: {
        Origin: jobsOrigin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...headers,
      },
      body: JSON.stringify(input ?? { value }),
    }),
  );
}
