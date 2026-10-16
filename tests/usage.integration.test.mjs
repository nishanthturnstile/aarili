import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { executeSynthetic } from "@aarili/core/commands";
import { createUsageWriter } from "@aarili/core/usage";
import { sql, withShop } from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { usageRepository } from "@aarili/db/usage-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const period = {
  from: "2020-01-01T00:00:00.000Z",
  to: "2020-12-31T00:00:00.000Z",
};
const currentPeriod = () => {
  const now = Date.now();
  return {
    from: new Date(now - 86400000).toISOString(),
    to: new Date(now + 86400000).toISOString(),
  };
};
async function fixture(run) {
  await withTenantFixture(async (f) => {
    await f.migration.query(
      await readFile("tests/fixtures/command.sql", "utf8"),
    );
    await run(f);
  });
}
function command(
  f,
  who = f.a,
  {
    key = randomUUID(),
    fail = false,
    usageFailure = false,
    kind = "draft.saved",
    amount = 1,
    pool = f.runtime,
  } = {},
) {
  return withShop(pool.db, who.user, who.shop, async (tx) => {
    const response = await executeSynthetic(
      {
        shopId: who.shop,
        actor: { type: "user", id: who.user },
        repository: commandRepository(tx, who.shop),
      },
      { action: "create", value: "alpha" },
      { key, requestId: randomUUID() },
      null,
    );
    const writer = createUsageWriter(usageRepository(tx, who.shop));
    const identity = {
      actionId: response.record.eventId,
      subjectId: usageFailure ? randomUUID() : response.record.id,
    };
    const event =
      kind === "media.stored"
        ? { ...identity, name: kind, bytes: amount }
        : kind === "support.recorded"
          ? {
              ...identity,
              name: kind,
              category: "troubleshooting",
              durationSeconds: amount,
            }
          : { ...identity, name: kind, schemaVersion: 1 };
    await writer.record(event);
    if (fail) throw Error("forced rollback");
    return event;
  });
}
function read(f, who = f.a, p = currentPeriod()) {
  return withShop(f.runtime.db, who.user, who.shop, (tx) =>
    createUsageWriter(usageRepository(tx, who.shop)).read(p),
  );
}
test("0.4.1d D1/D2/D3 TRU-01/03 bounded usage readouts, audit action dedupe, concurrent replay and rollback atomicity", async () => {
  await fixture(async (f) => {
    const key = randomUUID();
    const events = await Promise.all([
      command(f, f.a, { key, pool: f.parallel }),
      command(f, f.a, { key, pool: f.parallel }),
    ]);
    assert.deepEqual(events[0], events[1]);
    await command(f, f.a, { kind: "media.stored", amount: 98765 });
    await command(f, f.a, { kind: "support.recorded", amount: 123 });
    const before = await read(f);
    assert.equal(before.totals.events, "3");
    assert.equal(before.totals.mediaBytes, "98765");
    assert.equal(before.totals.supportSeconds, "123");
    assert.equal(before.totals.draftsSaved, "1");
    assert.equal(before.messaging, null);
    assert.equal(before.ai, null);
    assert.equal(before.sources.length, 3);
    assert.equal((await read(f, f.a, period)).totals.events, "0");
    await assert.rejects(command(f, f.a, { fail: true }), /forced rollback/);
    assert.deepEqual(await read(f), before);
    await assert.rejects(
      command(f, f.a, { usageFailure: true }),
      (error) => error.cause?.code === "42501",
    );
    assert.deepEqual(await read(f), before);
    assert.equal(
      (await f.admin.query("select count(*)::int n from synthetic_record"))
        .rows[0].n,
      3,
    );
    assert.equal(
      (await f.admin.query("select count(*)::int n from audit_event")).rows[0]
        .n,
      3,
    );
    assert.equal(
      (await f.admin.query("select count(*)::int n from idempotency_key"))
        .rows[0].n,
      3,
    );
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        createUsageWriter(usageRepository(tx, f.a.shop)).record({
          ...events[0],
          schemaVersion: 2,
        }),
      ),
      /binding mismatch/,
    );
    const times = await f.admin.query(
      "select p.occurred_at=a.occurred_at as matches from product_event p join audit_event a on a.shop_id=p.shop_id and a.id=p.action_id",
    );
    assert(times.rows.every((r) => r.matches));
  });
}, 120000);
test("0.4.1d D4 TRU-01 real PostgreSQL forced RLS, missing context, foreign references, immutable rows and field checks", async () => {
  await fixture(async (f) => {
    const own = await command(f);
    await command(f, f.b);
    const tables = await assertIsolationCatalog(f.runtime.db);
    assert(tables.includes("public.product_event"));
    await f.admin.query("grant update on product_event to app_user");
    try {
      await assert.rejects(
        assertIsolationCatalog(f.runtime.db),
        /append-only journal grants/,
      );
    } finally {
      await f.admin.query("revoke update on product_event from app_user");
    }

    assert.equal((await read(f)).totals.events, "1");
    assert.equal((await read(f, f.b)).totals.events, "1");
    assert.equal(
      (await f.runtime.pool.query("select * from product_event")).rowCount,
      0,
    );
    await assert.rejects(
      withShop(f.runtime.db, f.a.user, f.b.shop, (tx) =>
        usageRepository(tx, f.b.shop).read(currentPeriod()),
      ),
      /denied/,
    );
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      assert.equal(
        (
          await tx.execute(
            sql`select * from product_event where shop_id=${f.b.shop}::uuid`,
          )
        ).rowCount,
        0,
      );
    });
    const raw = (values) =>
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into product_event(shop_id,action_id,name,subject_id,schema_version) values(${values.shop}::uuid,${values.action}::uuid,${values.name},${values.subject}::uuid,${values.version})`,
        ),
      );
    await assert.rejects(
      raw({
        shop: f.b.shop,
        action: own.actionId,
        subject: own.subjectId,
        name: "draft.saved",
        version: 1,
      }),
    );
    await assert.rejects(
      raw({
        shop: f.a.shop,
        action: own.actionId,
        subject: randomUUID(),
        name: "draft.saved",
        version: 1,
      }),
      (error) => error.cause?.code === "42501",
    );
    await assert.rejects(
      raw({
        shop: f.a.shop,
        action: randomUUID(),
        subject: own.subjectId,
        name: "draft.saved",
        version: 1,
      }),
      (error) => error.cause?.code === "42501",
    );
    for (const statement of [
      "update product_event set name='pdf.rendered'",
      "delete from product_event",
    ]) {
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql.raw(statement)),
        ),
      );
    }
    // A valid existing audit source, but a NULL required field, must fail SQL CHECK.
    await assert.rejects(
      raw({
        shop: f.a.shop,
        action: own.actionId,
        subject: own.subjectId,
        name: "draft.saved",
        version: null,
      }),
      (error) => error.cause?.code === "23514",
    );
  });
}, 120000);
test("0.4.1d D1/D4 UTC source drilldown paginates without losing timestamp precision or changing aggregate totals", async () => {
  await fixture(async (f) => {
    await withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
      const writer = createUsageWriter(usageRepository(tx, f.a.shop));
      for (let i = 0; i < 101; i++) {
        const result = await executeSynthetic(
          {
            shopId: f.a.shop,
            actor: { type: "user", id: f.a.user },
            repository: commandRepository(tx, f.a.shop),
          },
          { action: "create", value: "alpha" },
          { key: randomUUID(), requestId: randomUUID() },
          null,
        );
        await writer.recordDraftEvent({
          actionId: result.record.eventId,
          draftId: result.record.id,
          event: "saved",
          schemaVersion: 1,
        });
      }
    });
    const p = currentPeriod();
    const first = await read(f, f.a, p);
    assert.equal(first.totals.events, "101");
    assert.equal(first.sources.length, 100);
    assert(first.next);
    assert(first.truncated);
    const second = await read(f, f.a, { ...p, after: first.next });
    assert.equal(second.sources.length, 1);
    assert.equal(second.next, null);
    assert.deepEqual(second.totals, first.totals);
    assert.equal(
      new Set(
        [...first.sources, ...second.sources].map((s) => s.event.actionId),
      ).size,
      101,
    );
  });
}, 120000);
