import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { createMoneyFixtureClient } from "@aarili/api/money-fixture-client";
import {
  decodeMoneyValues,
  encodeMoneyValues,
  moneyDraftSchema,
} from "@aarili/contracts/money";
import { roundTripMoney } from "@aarili/core/money-fixture";
import { sql, withShop } from "@aarili/db";
import { moneyFixtureRepository } from "@aarili/db/money-fixture-repository";
import {
  formatPaise,
  materialCost,
  parseMetres,
  parseRupees,
} from "@aarili/money";
import {
  allocationDemonstrations,
  inspectAllocation,
} from "./test-support/allocation.mjs";
import { withMoneyFixture } from "./test-support/money-fixture.mjs";

export function validateMoneyHarness(args, env) {
  if (
    args.length !== 1 ||
    !["--demo", "--interactive"].includes(args[0]) ||
    env.NODE_ENV === "production" ||
    env.DATABASE_URL ||
    env.MIGRATION_DATABASE_URL ||
    (env.OUTBOUND_EFFECTS &&
      !["disabled", "false", "0"].includes(env.OUTBOUND_EFFECTS))
  )
    throw new Error(
      "Use --demo or --interactive with no database target, production mode or outbound activation",
    );
  return args[0];
}
async function inspect(f, json) {
  let storedId;
  const client = createMoneyFixtureClient(async (requestJson) => {
    const result = await withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
      roundTripMoney(moneyFixtureRepository(tx), requestJson),
    );
    storedId = result.id;
    return result.responseJson;
  });
  const readBack = await client(decodeMoneyValues(json));
  const raw = await withShop(
    f.runtime.db,
    f.a.user,
    f.a.shop,
    async (tx) =>
      (
        await tx.execute(sql`select amount_paise,length_mm,pg_typeof(amount_paise)::text as storage_type
          from synthetic_money_value where shop_id=${f.a.shop}::uuid and id=${storedId}::uuid`)
      ).rows[0],
  );
  assert.equal(raw.amount_paise, readBack.amountPaise.toString());
  assert.equal(raw.length_mm, readBack.lengthMm.toString());
  console.info(
    JSON.stringify({
      request: decodeMoneyValues(json),
      database: raw,
      readBack,
      formatted: formatPaise(readBack.amountPaise),
    }),
  );
}
async function entry(f, amount, length) {
  const draft = moneyDraftSchema.parse({
    amountPaise: parseRupees(amount),
    lengthMm: parseMetres(length),
  });
  if (draft.amountPaise === null || draft.lengthMm === null) {
    console.info(JSON.stringify({ draft, outcome: "UNKNOWN_NOT_PERSISTED" }));
    return;
  }
  const cost = materialCost(draft.lengthMm, 1000, 10000);
  await inspect(
    f,
    encodeMoneyValues({
      amountPaise: draft.amountPaise,
      lengthMm: draft.lengthMm,
    }),
  );
  console.info(
    JSON.stringify({
      syntheticBasis: "INR 100 per metre",
      cost,
    }),
  );
}
async function demo(f) {
  for (const inspection of allocationDemonstrations())
    console.info(JSON.stringify(inspection));
  for (const [amount, length] of [
    ["", ""],
    ["0", "0"],
    ["0.01", "2.2"],
    ["1,000.01", "2.2"],
    ["90071992547409.91", "0"],
  ]) {
    await entry(f, amount, length);
  }
  await inspect(
    f,
    encodeMoneyValues({ amountPaise: 0, lengthMm: Number.MAX_SAFE_INTEGER }),
  );
  for (const [amount, length] of [
    ["0.001", "2.2"],
    ["90071992547409.92", "0"],
    ["1e3", "2"],
    ["1", "2.2001"],
  ]) {
    await assert.rejects(() => entry(f, amount, length));
    console.info(
      "Malformed, unsafe or excess-precision text rejected before persistence",
    );
  }
  for (const json of [
    '{"amountPaise":1.5,"lengthMm":0}',
    '{"amountPaise":9007199254740990.9,"lengthMm":0}',
    '{"amountPaise":9007199254740992,"lengthMm":0}',
  ]) {
    await assert.rejects(() => inspect(f, json));
    console.info("Fractional/unsafe wire amount rejected before persistence");
  }
  const ac23 = materialCost(2000, 5000, 50000);
  const ac58 = materialCost(2200, 1000, 10000);
  const fractional = materialCost(1, 1000, 1);
  assert.deepEqual(ac23, { supported: true, amountPaise: 20000 });
  assert.deepEqual(ac58, { supported: true, amountPaise: 22000 });
  assert.deepEqual(fractional, {
    supported: false,
    reason: "FRACTIONAL_PAISE",
  });
  console.info(JSON.stringify({ AC23: ac23, AC58: ac58, fractional }));
}
async function interactive(f) {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.info(
    "Synthetic only. Plain decimal text, no currency symbol. Blank stays unknown. :quit exits.",
  );
  console.info(
    'At the amount prompt, :json {"amountPaise":1.5,"lengthMm":0} tests raw wire validation; :demo runs documented fixtures.',
  );
  console.info(
    "FIN-05: :allocations runs deposit/discount/direct-cost fixtures; :allocate 1000 a=700 b=400 c=300 inspects source and ordered line charges in INR. Pure inspection does not persist/authorize money.",
  );
  try {
    for (;;) {
      const amount = await input.question(
        "Amount (INR), :json, :demo or :quit: ",
      );
      if (amount === ":quit") break;
      try {
        if (amount === ":allocations") {
          for (const inspection of allocationDemonstrations())
            console.info(JSON.stringify(inspection));
        } else if (amount.startsWith(":allocate ")) {
          const [source, ...lines] = amount.slice(10).trim().split(/\s+/);
          console.info(JSON.stringify(inspectAllocation(source, lines)));
        } else if (amount === ":demo") await demo(f);
        else if (amount.startsWith(":json ")) await inspect(f, amount.slice(6));
        else await entry(f, amount, await input.question("Length (metres): "));
      } catch {
        console.info(
          "Input or operational check failed; writes are transactional. Use supported precision or integer JSON. :quit removes the disposable fixture.",
        );
      }
    }
  } finally {
    input.close();
  }
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const mode = validateMoneyHarness(process.argv.slice(2), process.env);
    await withMoneyFixture((f) =>
      mode === "--interactive" ? interactive(f) : demo(f),
    );
    console.info(
      "Synthetic money demonstration completed; disposable PostgreSQL removed.",
    );
  } catch {
    console.error(
      "Synthetic money demonstration denied or failed. Check arguments, Docker and local verification prerequisites privately.",
    );
    process.exitCode = 1;
  }
}
