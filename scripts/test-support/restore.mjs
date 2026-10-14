import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  authDeliveryAuthority,
  withAuthDeliveryContext,
} from "@aarili/auth/delivery-guard";
import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { syntheticJobSchema } from "@aarili/contracts/jobs";
import { executeSynthetic } from "@aarili/core/commands";
import { consumeSyntheticJob, protectJobEpoch } from "@aarili/core/jobs";
import { guardedEffect } from "@aarili/core/restore";
import { ShopAccessError, sql, withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { syntheticJobRepository } from "@aarili/db/jobs-repository";
import { restoreRepository } from "@aarili/db/restore-repository";
import { handleSyntheticJob } from "@aarili/jobs";
import pg from "pg";
import { restoreControl } from "../restore-control.mjs";
import { withJobsFixture } from "./jobs.mjs";

// Only withJobsFixture supplies this disposable database. No target/config
// injection, provider package, retained environment or provider credential.
export async function withRestoreFixture(run) {
  return withJobsFixture(async (f) => {
    const password = randomBytes(24).toString("hex");
    await f.admin.query(
      `CREATE ROLE synthetic_restore_operator LOGIN PASSWORD '${password}' IN ROLE app_restore_operator`,
    );
    const target = new URL(f.admin.options.connectionString);
    target.username = "synthetic_restore_operator";
    target.password = password;
    const operator = new pg.Pool({
      connectionString: target.toString(),
      max: 3,
    });
    const control = async (action = "status", epoch) => {
      const client = await operator.connect();
      try {
        const expected =
          epoch ??
          (
            await client.query(
              "select restore_epoch from system_state where singleton",
            )
          ).rows[0]?.restore_epoch;
        return await restoreControl(client, action, expected);
      } finally {
        client.release();
      }
    };
    const fake = { operator: "disabled", calls: 0, authCalls: 0 };
    try {
      return await run({ ...f, operator, control, fake });
    } finally {
      await operator.end();
    }
  });
}

// Synthetic protected command uses the existing actor/action/hash-bound
// command/audit/idempotency primitives. It has no amount or business money row.
export async function syntheticFinancial(
  f,
  action,
  { key = randomUUID(), checkpoint = async () => {}, who = f.a } = {},
) {
  return withShop(f.parallel.db, who.user, who.shop, async (tx) => {
    assert(await authorizeJobPrincipal(tx, who.user, who.shop));
    const controls = restoreRepository(tx, who.shop);
    const response = await executeSynthetic(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: commandRepository(tx, who.shop),
        financial: { action, controls },
      },
      { action: "create", value: "alpha" },
      { key, requestId: randomUUID() },
      null,
    );
    await checkpoint(tx);
    return response;
  });
}

// This is the ONLY positive fake adapter composition. It lives in test-support,
// accepts no real adapter, and reads its private disposable operator state at
// the boundary. The caller input remains a strict ID/version/epoch locator.
export async function fakeOutbound(
  f,
  input,
  { checkpoint = async () => {}, breakDatabase = false } = {},
) {
  const parsed = syntheticJobSchema.safeParse(input);
  if (!parsed.success) return "obsolete_state";
  const p = parsed.data;
  try {
    return await withShop(
      f.parallel.db,
      p.initiatorId,
      p.shopId,
      async (tx) => {
        const controls = restoreRepository(tx, p.shopId);
        await controls.lockState();
        const jobs = syntheticJobRepository(tx, p.shopId);
        await jobs.lock(p.requestId);
        const request = await jobs.request(p.requestId);
        if (
          !request ||
          request.initiatorId !== p.initiatorId ||
          request.entityId !== p.entityId ||
          request.version !== p.version ||
          (p.epoch && p.epoch !== request.epoch)
        )
          return "obsolete_state";
        const epochOutcome = await protectJobEpoch(jobs, request, p.epoch);
        if (epochOutcome !== "current") return epochOutcome;
        let checks = 0;
        const result = await guardedEffect(
          controls,
          () => f.fake.operator,
          async () => {
            checks++;
            const authorized = await authorizeJobPrincipal(
              tx,
              p.initiatorId,
              p.shopId,
            );
            const record = await commandRepository(tx, p.shopId).read(
              p.entityId,
              true,
            );
            const current =
              !!record &&
              record.version === request.version &&
              record.eventId === request.requestId &&
              !(await jobs.effected(request.requestId));
            const practice = await controls.practice();
            if (checks === 1) {
              await checkpoint(tx);
              if (breakDatabase) {
                const pid = (
                  await tx.execute(sql`select pg_backend_pid() as pid`)
                ).rows[0].pid;
                await f.admin.query("select pg_terminate_backend($1)", [pid]);
              }
            }
            return { epoch: request.epoch, practice, authorized, current };
          },
          async () => {
            f.fake.calls++;
            assert.equal(
              await consumeSyntheticJob(
                {
                  shopId: p.shopId,
                  userId: p.initiatorId,
                  jobs,
                  records: commandRepository(tx, p.shopId),
                },
                p,
              ),
              "applied",
            );
          },
        );
        return result;
      },
    );
  } catch (error) {
    return error instanceof ShopAccessError
      ? "authority_revoked"
      : "control_unknown";
  }
}

export async function fakeAuthDelivery(f, userId, purpose = "reset") {
  try {
    return await withAuthDeliveryContext(
      f.parallel.db,
      userId,
      async (tx, shopId) => {
        const controls = restoreRepository(tx, shopId ?? undefined);
        const initial = await controls.lockState();
        return guardedEffect(
          controls,
          () => f.fake.operator,
          async () => ({
            epoch: initial?.epoch,
            practice: shopId ? await controls.practice() : false,
            authorized: await authDeliveryAuthority(
              tx,
              userId,
              purpose,
              shopId,
            ),
            current: true,
          }),
          async () => {
            f.fake.authCalls++;
          },
        );
      },
    );
  } catch {
    return "control_unknown";
  }
}

export async function quarantineJob(f, payload) {
  const outcome = await handleSyntheticJob(f.parallel.db, payload);
  assert.equal(outcome, "quarantined");
  return (
    await f.admin.query(
      "select request_epoch,observed_epoch,reason from synthetic_job_quarantine where request_id=$1",
      [payload.requestId],
    )
  ).rows[0];
}
