import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { decodeMoneyValues, encodeMoneyValues } from "@aarili/contracts/money";
import { roundTripMoney } from "@aarili/core/money-fixture";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { moneyFixtureRepository } from "@aarili/db/money-fixture-repository";
import { fromPostgresBigint } from "@aarili/money";
import fc from "fast-check";
import { test } from "vitest";
import { withMoneyFixture } from "../scripts/test-support/money-fixture.mjs";

const wireMax = 9007199254740991n;
const run = (f, identity, work) =>
  withShop(f.runtime.db, identity.user, identity.shop, work);
const count = async (f) =>
  (await f.admin.query("select count(*)::int as n from synthetic_money_value"))
    .rows[0].n;

test("0.3.1a A1/A2/A5 FIN-12 exact pg int8/JSON round trips, properties and corrupted wire-range rejection", async () => {
  await withMoneyFixture(async (f) => {
    assert(
      (await assertIsolationCatalog(f.runtime.db)).includes(
        "public.synthetic_money_value",
      ),
    );
    const roundTrip = async (amountPaise, lengthMm) => {
      const values = { amountPaise, lengthMm };
      const result = await run(f, f.a, (tx) =>
        roundTripMoney(moneyFixtureRepository(tx), encodeMoneyValues(values)),
      );
      assert.deepEqual(decodeMoneyValues(result.responseJson), values);
      // Independent pg driver read of actual bigint columns (not ::text).
      const raw = (
        await f.admin.query(
          "select amount_paise,length_mm,pg_typeof(amount_paise)::text as t from synthetic_money_value where shop_id=$1 and id=$2",
          [f.a.shop, result.id],
        )
      ).rows[0];
      assert.equal(raw.t, "bigint");
      assert.equal(raw.amount_paise, amountPaise.toString());
      assert.equal(raw.length_mm, lengthMm.toString());
      // A later transaction re-reads the committed value, with clean context.
      assert.deepEqual(
        await run(f, f.a, (tx) => moneyFixtureRepository(tx).read(result.id)),
        values,
      );
    };
    for (const value of [
      0,
      1,
      -1,
      100001,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
    ])
      await roundTrip(value, Number.MAX_SAFE_INTEGER);
    await fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: -wireMax, max: wireMax }),
        fc.bigInt({ min: 0n, max: wireMax }),
        async (paise, mm) => roundTrip(Number(paise), Number(mm)),
      ),
      { seed: 320038, numRuns: 75 },
    );
    for (const bad of [
      "9007199254740992",
      "-9007199254740992",
      "9223372036854775807",
      "-9223372036854775808",
    ]) {
      const id = randomUUID();
      await f.admin.query(
        "insert into synthetic_money_value(shop_id,id,amount_paise,length_mm) values($1,$2,$3::bigint,0)",
        [f.a.shop, id, bad],
      );
      assert.equal(
        (
          await f.admin.query(
            "select amount_paise from synthetic_money_value where shop_id=$1 and id=$2",
            [f.a.shop, id],
          )
        ).rows[0].amount_paise,
        bad,
      );
      await assert.rejects(
        () => run(f, f.a, (tx) => moneyFixtureRepository(tx).read(id)),
        /WIRE_RANGE/,
      );
      assert.equal(
        await run(f, f.b, (tx) => moneyFixtureRepository(tx).read(id)),
        undefined,
      );
    }
    const invalidQuantity = randomUUID();
    await f.admin.query(
      "insert into synthetic_money_value(shop_id,id,amount_paise,length_mm) values($1,$2,0,9007199254740992)",
      [f.a.shop, invalidQuantity],
    );
    await assert.rejects(
      () =>
        run(f, f.a, (tx) => moneyFixtureRepository(tx).read(invalidQuantity)),
      /WIRE_RANGE/,
    );
    for (const bad of ["9223372036854775808", "-9223372036854775809"])
      await assert.rejects(
        () => f.admin.query("select $1::bigint", [bad]),
        (e) => e.code === "22003",
      );
    assert.equal(
      fromPostgresBigint("9007199254740991"),
      Number.MAX_SAFE_INTEGER,
    );
  });
}, 120000);

test("0.3.1a A3/A5/A6 TRU-12/USE-08 fixture isolation, append-only history, rollback and safe retry", async () => {
  await withMoneyFixture(async (f) => {
    const input = { amountPaise: 1, lengthMm: 2200 };
    const [a, b] = await Promise.all([
      run(f, f.a, (tx) =>
        roundTripMoney(moneyFixtureRepository(tx), encodeMoneyValues(input)),
      ),
      run(f, f.b, (tx) =>
        roundTripMoney(
          moneyFixtureRepository(tx),
          encodeMoneyValues({ amountPaise: 100001, lengthMm: 0 }),
        ),
      ),
    ]);
    for (const [own, foreign] of [
      [f.a, b],
      [f.b, a],
    ])
      assert.equal(
        await run(f, own, (tx) => moneyFixtureRepository(tx).read(foreign.id)),
        undefined,
      );
    assert.equal(
      await run(f, f.a, (tx) => moneyFixtureRepository(tx).read(randomUUID())),
      undefined,
    );
    await assert.rejects(
      () =>
        withShop(f.runtime.db, f.b.user, f.a.shop, (tx) =>
          moneyFixtureRepository(tx).read(a.id),
        ),
      /Shop access denied/,
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select * from synthetic_money_value`))
        .rowCount,
      0,
    );
    await assert.rejects(() =>
      f.runtime.db.execute(
        sql`insert into synthetic_money_value(shop_id,amount_paise,length_mm) values(${f.a.shop}::uuid,1,0)`,
      ),
    );
    await assert.rejects(() =>
      run(f, f.a, (tx) =>
        tx.execute(
          sql`insert into synthetic_money_value(shop_id,amount_paise,length_mm) values(${f.b.shop}::uuid,1,0)`,
        ),
      ),
    );
    // Grants AND triggers protect values. Admin maintenance has no fixture bypass.
    for (const verb of ["update", "delete"])
      await assert.rejects(() =>
        run(f, f.a, (tx) =>
          tx.execute(
            verb === "update"
              ? sql`update synthetic_money_value set amount_paise=2 where id=${a.id}::uuid`
              : sql`delete from synthetic_money_value where id=${a.id}::uuid`,
          ),
        ),
      );
    for (const query of [
      "update synthetic_money_value set amount_paise=2 where shop_id=$1 and id=$2",
      "delete from synthetic_money_value where shop_id=$1 and id=$2",
    ])
      await assert.rejects(
        () => f.admin.query(query, [f.a.shop, a.id]),
        (e) => e.code === "42501",
      );
    const before = await count(f);
    for (const json of [
      '{"amountPaise":1.5,"lengthMm":0}',
      '{"amountPaise":9007199254740990.9,"lengthMm":0}',
      '{"amountPaise":1e-400,"lengthMm":0}',
      '{"amountPaise":9007199254740992,"lengthMm":0}',
      '{"amountPaise":null,"lengthMm":0}',
      '{"amountPaise":0,"lengthMm":null}',
    ])
      await assert.rejects(() =>
        run(f, f.a, (tx) => roundTripMoney(moneyFixtureRepository(tx), json)),
      );
    for (const invalid of [
      { amountPaise: Infinity, lengthMm: 0 },
      { amountPaise: 0, lengthMm: -1 },
    ])
      await assert.rejects(() =>
        run(f, f.a, (tx) => moneyFixtureRepository(tx).insert(invalid)),
      );
    for (const failure of [
      "after-insert",
      "after-read",
      "enlisted-write",
      "disconnect",
    ]) {
      await assert.rejects(() =>
        run(f, f.a, async (tx) => {
          const repo = moneyFixtureRepository(tx);
          const id = await repo.insert(input);
          if (failure === "after-read") await repo.read(id);
          if (failure === "enlisted-write") await tx.execute(sql`select 1/0`);
          if (failure === "disconnect") {
            const pid = (await tx.execute(sql`select pg_backend_pid() as pid`))
              .rows[0].pid;
            await f.admin.query("select pg_terminate_backend($1)", [pid]);
            await tx.execute(sql`select 1`);
          }
          throw new Error("injected synthetic failure");
        }),
      );
      assert.equal(await count(f), before);
    }
    const retry = await run(f, f.a, (tx) =>
      roundTripMoney(moneyFixtureRepository(tx), encodeMoneyValues(input)),
    );
    assert.deepEqual(decodeMoneyValues(retry.responseJson), input);
    assert.equal(await count(f), before + 1);
    // The original committed value survives failed attempts, and a reused
    // pooled connection has no residual user/shop/actor context.
    assert.deepEqual(
      await run(f, f.a, (tx) => moneyFixtureRepository(tx).read(a.id)),
      input,
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select * from synthetic_money_value`))
        .rowCount,
      0,
    );
    await assert.rejects(() => f.runtime.db.execute(sql`set role app_privacy`));
  });
}, 120000);
