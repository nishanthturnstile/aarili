import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { executeSynthetic } from "@aarili/core/commands";
import { sql, withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

test("0.2.3 E5/E6 process/connection loss before commit and failed finalization leave clean retry/history", async () => {
  await withTenantFixture(async ({ runtime, migration, admin, a }) => {
    await migration.query(await readFile("tests/fixtures/command.sql", "utf8"));
    const key = randomUUID();
    const input = { action: "create", value: "alpha" };
    const run = (headers, command, target, decorate = (repo) => repo) =>
      withShop(runtime.db, a.user, a.shop, (tx) =>
        executeSynthetic(
          {
            shopId: a.shop,
            actor: { type: "user", id: a.user },
            repository: decorate(commandRepository(tx, a.shop), tx),
          },
          command,
          { ...headers, requestId: randomUUID() },
          target,
        ),
      );
    await assert.rejects(
      run({ key }, input, null, (repo, tx) => ({
        ...repo,
        async persist(...args) {
          await repo.persist(...args);
          const pid = (await tx.execute(sql`select pg_backend_pid() as pid`))
            .rows[0].pid;
          // Disposable runtime backend only. PostgreSQL must roll back a connection
          // that disappears after every write but before COMMIT, as after process loss.
          assert.equal(
            (
              await admin.query("select pg_terminate_backend($1) as ended", [
                pid,
              ])
            ).rows[0].ended,
            true,
          );
          await tx.execute(sql`select 1`);
        },
      })),
    );
    for (const table of ["synthetic_record", "audit_event", "idempotency_key"])
      assert.equal(
        (
          await admin.query(
            `select * from ${table}${table === "synthetic_record" ? "" : " where action like 'synthetic.%'"}`,
          )
        ).rowCount,
        0,
      );
    const created = await run({ key }, input, null);
    const finalizeKey = randomUUID();
    await assert.rejects(
      run(
        { key: finalizeKey, ifMatch: '"v1"' },
        { action: "finalize" },
        created.record.id,
        (repo) => ({
          ...repo,
          async audit(e) {
            await repo.audit(e);
            throw new Error("Injected finalization audit failure");
          },
        }),
      ),
    );
    await withShop(runtime.db, a.user, a.shop, async (tx) =>
      assert.deepEqual(
        await commandRepository(tx, a.shop).read(created.record.id),
        created.record,
      ),
    );
    assert.equal(
      (
        await admin.query("select 1 from idempotency_key where key=$1", [
          finalizeKey,
        ])
      ).rowCount,
      0,
    );
    const final = await run(
      { key: finalizeKey, ifMatch: '"v1"' },
      { action: "finalize" },
      created.record.id,
    );
    assert.equal(final.record.finalized, true);
    assert.equal(
      (
        await admin.query(
          "select * from audit_event where action like 'synthetic.%'",
        )
      ).rowCount,
      2,
    );
    assert.equal(
      (
        await admin.query(
          "select * from idempotency_key where action like 'synthetic.%'",
        )
      ).rowCount,
      2,
    );
  });
}, 180000);
