import { createMoneyFixtureClient } from "@aarili/api/money-fixture-client";
import {
  decodeMoneyValues,
  encodeMoneyValues,
  financialInputSchema,
  moneyDraftSchema,
  moneyValuesSchema,
  postingInputSchema,
} from "@aarili/contracts/money";
import { requestHash } from "@aarili/core/commands";
import { roundTripMoney } from "@aarili/core/money-fixture";
import type { MoneyFixtureRepository } from "@aarili/db/repositories/money-fixture";
import {
  assertPostgresBigint,
  checkedAdd,
  checkedDivide,
  checkedMultiply,
  checkedMultiplyDivide,
  checkedSubtract,
  formatPaise,
  fromBigint,
  fromPostgresBigint,
  materialCost,
  parseMetres,
  parseRupees,
  parseSignedRupees,
  toBigint,
  toPostgresBigint,
} from "@aarili/money";
import fc from "fast-check";
import { expect, test, vi } from "vitest";

const limit = 9007199254740991n;
const safe = fc.bigInt({ min: -limit, max: limit });
test("0.3.1a A2 rejects fractional JSON tokens that JSON.parse would round into safe integers", () => {
  for (const json of [
    '{"amountPaise":9007199254740990.9,"lengthMm":0}',
    '{"amountPaise":9007199254740991.1,"lengthMm":0}',
    '{"amountPaise":-9007199254740991.1,"lengthMm":0}',
    '{"amountPaise":0,"lengthMm":9007199254740990.9}',
    '{"amountPaise":1e-400,"lengthMm":0}',
  ])
    expect(() => decodeMoneyValues(json)).toThrow();
});
test("0.3.1a A2/A6 operational typed client validates request before transport and rejects invalid responses", async () => {
  const transport = vi.fn(async (json: string) => json);
  const client = createMoneyFixtureClient(transport);
  expect(await client({ amountPaise: 100001, lengthMm: 2200 })).toEqual({
    amountPaise: 100001,
    lengthMm: 2200,
  });
  transport.mockClear();
  for (const invalid of [
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
    1n,
    null,
  ])
    await expect(
      client({ amountPaise: invalid as number, lengthMm: 0 }),
    ).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
  for (const json of [
    '{"amountPaise":1.5,"lengthMm":0}',
    '{"amountPaise":9007199254740992,"lengthMm":0}',
    '{"amountPaise":null,"lengthMm":0}',
    "null",
  ])
    await expect(
      createMoneyFixtureClient(async () => json)({
        amountPaise: 0,
        lengthMm: 0,
      }),
    ).rejects.toThrow();
});
function matchesReference(run: () => number, expected: bigint) {
  if (expected < -9223372036854775808n || expected > 9223372036854775807n)
    expect(run).toThrow("DATABASE_RANGE");
  else if (expected < -limit || expected > limit)
    expect(run).toThrow("WIRE_RANGE");
  else expect(run().toString()).toBe(expected.toString());
}
test("0.3.1a A1 FIN-12/TRU-12 checked arithmetic matches independent bigint reference and overflow", () => {
  fc.assert(
    fc.property(safe, safe, (a, b) => {
      const x = Number(a),
        y = Number(b);
      matchesReference(() => checkedAdd(x, y), a + b);
      matchesReference(() => checkedSubtract(x, y), a - b);
      matchesReference(() => checkedMultiply(x, y), a * b);
      if (b === 0n)
        expect(() => checkedDivide(x, y)).toThrow("DIVISION_BY_ZERO");
      else if (a % b !== 0n)
        expect(() => checkedDivide(x, y)).toThrow("FRACTIONAL_RESULT");
      else matchesReference(() => checkedDivide(x, y), a / b);
    }),
    { seed: 320031, numRuns: 500 },
  );
  expect(checkedSubtract(0, 1)).toBe(-1);
  expect(checkedDivide(-6, -3)).toBe(2);
  expect(() => checkedAdd(Number.MAX_SAFE_INTEGER, 1)).toThrow("WIRE_RANGE");
  expect(() => checkedSubtract(Number.MIN_SAFE_INTEGER, 1)).toThrow(
    "WIRE_RANGE",
  );
  for (const invalid of [
    NaN,
    Infinity,
    -Infinity,
    0.01,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
    "1",
    1n,
    null,
  ])
    for (const operation of [
      checkedAdd,
      checkedSubtract,
      checkedMultiply,
      checkedDivide,
    ]) {
      expect(() => operation(invalid as number, 1)).toThrow("INVALID_INTEGER");
      expect(() => operation(1, invalid as number)).toThrow("INVALID_INTEGER");
    }
});
test("0.3.1a A1/A4 multiplication/division preserves large intermediates and rejects fractions", () => {
  fc.assert(
    fc.property(safe, safe, safe, (a, b, d) => {
      const run = () => checkedMultiplyDivide(Number(a), Number(b), Number(d));
      if (d === 0n) expect(run).toThrow("DIVISION_BY_ZERO");
      else if ((a * b) % d !== 0n) expect(run).toThrow("FRACTIONAL_RESULT");
      else matchesReference(run, (a * b) / d);
    }),
    { seed: 320032, numRuns: 500 },
  );
  fc.assert(
    fc.property(
      safe,
      safe.filter((v) => v !== 0n),
      (a, b) => {
        expect(
          checkedMultiplyDivide(Number(a), Number(b), Number(b)).toString(),
        ).toBe(a.toString());
      },
    ),
    { seed: 320033, numRuns: 500 },
  );
  expect(
    checkedMultiplyDivide(
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ),
  ).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => checkedMultiplyDivide(1, 1, 2)).toThrow("FRACTIONAL_RESULT");
});
test("0.3.1a A1/A2 bigint/storage conversion checks both bounds without narrowing", () => {
  for (const value of [0n, limit, -limit]) {
    expect(toBigint(fromBigint(value))).toBe(value);
    expect(fromPostgresBigint(toPostgresBigint(Number(value)))).toBe(
      Number(value),
    );
    expect(fromPostgresBigint(value.toString()).toString()).toBe(
      value.toString(),
    );
  }
  for (const value of [
    limit + 1n,
    -limit - 1n,
    -9223372036854775808n,
    9223372036854775807n,
  ]) {
    expect(assertPostgresBigint(value)).toBe(value);
    expect(() => fromBigint(value)).toThrow("WIRE_RANGE");
    expect(() => fromPostgresBigint(value.toString())).toThrow("WIRE_RANGE");
  }
  for (const value of [-9223372036854775809n, 9223372036854775808n])
    expect(() => fromBigint(value)).toThrow("DATABASE_RANGE");
  for (const text of [
    "",
    " 1",
    "1.0",
    "1e2",
    "+1",
    "00",
    "NaN",
    "Infinity",
    "0".repeat(100),
  ])
    expect(() => fromPostgresBigint(text)).toThrow("INVALID_INTEGER");
});
test("0.3.1a A2/A3 strict draft/command/signed JSON contracts and wire codec", async () => {
  expect(moneyDraftSchema.parse({})).toEqual({});
  expect(moneyDraftSchema.parse({ amountPaise: null, lengthMm: null })).toEqual(
    { amountPaise: null, lengthMm: null },
  );
  expect(moneyDraftSchema.parse({ amountPaise: 0, lengthMm: 0 })).toEqual({
    amountPaise: 0,
    lengthMm: 0,
  });
  expect(financialInputSchema.safeParse({ amountPaise: -1 }).success).toBe(
    false,
  );
  expect(postingInputSchema.parse({ amountPaise: -1 }).amountPaise).toBe(-1);
  for (const invalid of [
    "",
    null,
    undefined,
    "1",
    1.5,
    NaN,
    Infinity,
    -Infinity,
    1n,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
  ]) {
    expect(
      moneyValuesSchema.safeParse({ amountPaise: invalid, lengthMm: 0 })
        .success,
    ).toBe(false);
    expect(
      moneyValuesSchema.safeParse({ amountPaise: 0, lengthMm: invalid })
        .success,
    ).toBe(false);
    expect(() =>
      encodeMoneyValues({ amountPaise: invalid as number, lengthMm: 0 }),
    ).toThrow();
  }
  for (const json of [
    "null",
    "{}",
    '{"amountPaise":1.5,"lengthMm":0}',
    '{"amountPaise":9007199254740992,"lengthMm":0}',
    '{"amountPaise":1e400,"lengthMm":0}',
    '{"amountPaise":0,"lengthMm":-1}',
    '{"amountPaise":0,"lengthMm":0,"shopId":"forged"}',
  ]) {
    const repository: MoneyFixtureRepository = {
      insert: vi.fn(),
      read: vi.fn(),
    };
    await expect(roundTripMoney(repository, json)).rejects.toThrow();
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.read).not.toHaveBeenCalled();
  }
  fc.assert(
    fc.property(safe, fc.bigInt({ min: 0n, max: limit }), (amount, mm) => {
      const values = { amountPaise: Number(amount), lengthMm: Number(mm) };
      expect(decodeMoneyValues(encodeMoneyValues(values))).toEqual(values);
    }),
    { seed: 320034, numRuns: 500 },
  );
  const validated = decodeMoneyValues('{"amountPaise":100001,"lengthMm":2200}');
  expect(await requestHash(validated)).toBe(
    await requestHash({ lengthMm: 2200, amountPaise: 100001 }),
  );
});
test("0.3.1a A2/A3 formatting and decimal text parsing conserve exact paise/mm", () => {
  for (const text of ["", " ", null]) {
    expect(parseRupees(text)).toBeNull();
    expect(parseMetres(text)).toBeNull();
  }
  expect(parseRupees("0")).toBe(0);
  expect(parseRupees("0.01")).toBe(1);
  expect(parseRupees("1,000.01")).toBe(100001);
  expect(parseRupees("1,00,000.01")).toBe(10000001);
  expect(parseRupees("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  expect(parseSignedRupees("-90071992547409.91")).toBe(Number.MIN_SAFE_INTEGER);
  expect(parseMetres("9007199254740.991")).toBe(Number.MAX_SAFE_INTEGER);
  for (const text of [
    ".01",
    "1.",
    "1e3",
    "₹1",
    "1,00",
    "1,234,56",
    "+1",
    "NaN",
    "Infinity",
    "1_000",
    "0.001",
    "0.000",
    "1".repeat(100),
  ])
    expect(() => parseRupees(text)).toThrow("INVALID_DECIMAL");
  expect(() => parseRupees("-0.01")).toThrow("NEGATIVE_INPUT");
  expect(() => parseMetres("-1")).toThrow("NEGATIVE_INPUT");
  expect(() => parseMetres("2.2001")).toThrow("INVALID_DECIMAL");
  expect(() => parseRupees("90071992547409.92")).toThrow("WIRE_RANGE");
  expect(() => parseMetres("9007199254740.992")).toThrow("WIRE_RANGE");
  expect(formatPaise(Number.MAX_SAFE_INTEGER)).toBe("₹9,00,71,99,25,47,409.91");
  expect(formatPaise(Number.MIN_SAFE_INTEGER)).toBe(
    "-₹9,00,71,99,25,47,409.91",
  );
  expect(formatPaise(1)).toBe("₹0.01");
  fc.assert(
    fc.property(safe, (paise) => {
      expect(
        parseSignedRupees(
          formatPaise(Number(paise)).replace("₹", ""),
        )?.toString(),
      ).toBe(paise.toString());
    }),
    { seed: 320035, numRuns: 500 },
  );
  fc.assert(
    fc.property(fc.bigInt({ min: 0n, max: limit }), (mm) => {
      const text = `${mm / 1000n}.${(mm % 1000n).toString().padStart(3, "0")}`;
      expect(parseMetres(text)?.toString()).toBe(mm.toString());
    }),
    { seed: 320036, numRuns: 500 },
  );
});
test("0.3.1a A4 AC-23/AC-58 exact stated-basis costs and unsupported fractions", () => {
  expect(parseMetres("2.2")).toBe(2200);
  expect(materialCost(2200, 1000, 10000)).toEqual({
    supported: true,
    amountPaise: 22000,
  });
  expect(materialCost(2000, 5000, 50000)).toEqual({
    supported: true,
    amountPaise: 20000,
  });
  expect(materialCost(0, 5000, 50000)).toEqual({
    supported: true,
    amountPaise: 0,
  });
  expect(materialCost(1, 1000, 1)).toEqual({
    supported: false,
    reason: "FRACTIONAL_PAISE",
  });
  expect(() => materialCost(1, 0, 1)).toThrow("DIVISION_BY_ZERO");
  expect(() => materialCost(-1, 1000, 1)).toThrow("NEGATIVE_INPUT");
  expect(() => materialCost(1, 1000, -1)).toThrow("NEGATIVE_INPUT");
  expect(() => materialCost(Number.MAX_SAFE_INTEGER, 1, 2)).toThrow(
    "WIRE_RANGE",
  );
  fc.assert(
    fc.property(
      fc.bigInt({ min: 0n, max: limit }),
      fc.bigInt({ min: 0n, max: limit }),
      fc.bigInt({ min: 1n, max: limit }),
      (mm, cost, basis) => {
        const product = mm * cost;
        if (product % basis !== 0n)
          expect(materialCost(Number(mm), Number(basis), Number(cost))).toEqual(
            { supported: false, reason: "FRACTIONAL_PAISE" },
          );
        else if (product / basis > limit)
          expect(() =>
            materialCost(Number(mm), Number(basis), Number(cost)),
          ).toThrow();
        else {
          const result = materialCost(Number(mm), Number(basis), Number(cost));
          expect(result.supported).toBe(true);
          if (result.supported)
            expect(BigInt(result.amountPaise) * basis).toBe(product);
        }
      },
    ),
    { seed: 320037, numRuns: 500 },
  );
});
