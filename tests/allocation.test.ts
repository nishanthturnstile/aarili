import { financialPaiseSchema } from "@aarili/contracts/money";
import {
  type AllocationLine,
  type AllocationResult,
  allocateFin05,
  nonNegativeInteger,
  parseRupees,
} from "@aarili/money";
import fc from "fast-check";
import { expect, test } from "vitest";

const limit = 9007199254740991n;
const paise = fc.bigInt({ min: 0n, max: limit });
const linesFor = (charges: readonly number[]) =>
  charges.map((chargePaise, i) => ({ lineId: `line-${i}`, chargePaise }));
// Reference uses integer-paise quotient then whole-rupee truncation; choose
// the recipient by independent stable ranking rather than an incremental max.
function reference(
  source: bigint,
  charges: readonly bigint[],
): AllocationResult {
  const total = charges.reduce((sum, charge) => sum + charge, 0n);
  const shares = charges
    .map((charge) => (total === 0n ? 0n : (source * charge) / total))
    .map((share) => share - (share % 100n));
  const ranked = charges
    .map((charge, index) => ({ charge, index }))
    .sort((a, b) =>
      a.charge === b.charge ? a.index - b.index : a.charge > b.charge ? -1 : 1,
    );
  const winner = ranked[0];
  if (total > 0n && winner) {
    shares[winner.index] =
      (shares[winner.index] ?? 0n) +
      source -
      shares.reduce((sum, share) => sum + share, 0n);
  }
  return {
    allocations: shares.map((share, i) => ({
      lineId: `line-${i}`,
      amountPaise: Number(share),
    })),
    unallocatedPaise: total === 0n ? Number(source) : 0,
  };
}
function amounts(result: AllocationResult) {
  return result.allocations.map((line) => line.amountPaise);
}
test("0.3.1b B1/B2/B3 FIN-05 AC-17/AC-49 decided whole-rupee and paise examples", () => {
  for (const [source, charges, expected] of [
    [100000, [100000, 150000], [40000, 60000]],
    [100000, [70000, 70000, 70000], [33400, 33300, 33300]],
    // Largest fractional remainder is line 1, but largest charge is line 0.
    [100000, [70000, 40000, 30000], [50100, 28500, 21400]],
    [100001, [70000, 70000, 70000], [33401, 33300, 33300]],
    [1, [0, 1, 1], [0, 1, 0]],
    [0, [100, 200], [0, 0]],
  ] as const) {
    expect(amounts(allocateFin05(source, linesFor(charges)))).toEqual(expected);
  }
});
test("0.3.1b B4/B5 FIN-05 zero-charge credit, single line and explicit earliest input order", () => {
  expect(allocateFin05(100001, linesFor([0, 0]))).toEqual({
    allocations: [
      { lineId: "line-0", amountPaise: 0 },
      { lineId: "line-1", amountPaise: 0 },
    ],
    unallocatedPaise: 100001,
  });
  expect(amounts(allocateFin05(Number(limit), linesFor([1])))).toEqual([
    Number(limit),
  ]);
  const a = { lineId: "a", chargePaise: 70000 };
  const b = { lineId: "b", chargePaise: 70000 };
  const z = { lineId: "zero", chargePaise: 0 };
  expect(allocateFin05(100001, [z, b, a]).allocations).toEqual([
    { lineId: "zero", amountPaise: 0 },
    { lineId: "b", amountPaise: 50001 },
    { lineId: "a", amountPaise: 50000 },
  ]);
  expect(allocateFin05(100001, [a, z, b]).allocations).toEqual([
    { lineId: "a", amountPaise: 50001 },
    { lineId: "zero", amountPaise: 0 },
    { lineId: "b", amountPaise: 50000 },
  ]);
});
test("0.3.1b B1/B5/B6 FIN-05/FIN-12 properties conserve source, order and nonnegative exact wire results without mutation", () => {
  fc.assert(
    fc.property(
      paise,
      fc.array(paise, { minLength: 1, maxLength: 30 }),
      (source, charges) => {
        const lines = Object.freeze(
          linesFor(charges.map(Number)).map((line) => Object.freeze(line)),
        );
        const result = allocateFin05(Number(source), lines);
        expect(result).toEqual(reference(source, charges));
        expect(allocateFin05(Number(source), lines)).toEqual(result);
        expect(result.allocations.map((line) => line.lineId)).toEqual(
          lines.map((line) => line.lineId),
        );
        expect(
          result.allocations.reduce(
            (sum, line) => sum + BigInt(line.amountPaise),
            BigInt(result.unallocatedPaise),
          ),
        ).toBe(source);
        for (const line of result.allocations)
          expect(financialPaiseSchema.parse(line.amountPaise)).toBe(
            nonNegativeInteger(line.amountPaise),
          );
        expect(financialPaiseSchema.parse(result.unallocatedPaise)).toBe(
          result.unallocatedPaise,
        );
        expect(lines.map((line) => BigInt(line.chargePaise))).toEqual(charges);
        // Mutating an output cannot mutate the inputs or affect a fresh result.
        const first = result.allocations[0];
        if (first) first.lineId = "changed";
        expect(allocateFin05(Number(source), lines)).toEqual(
          reference(source, charges),
        );
      },
    ),
    { seed: 330031, numRuns: 1000 },
  );
});
test("0.3.1b B4/B5 FIN-05 generated all-zero credit, single line and sub-rupee sources", () => {
  fc.assert(
    fc.property(paise, fc.integer({ min: 1, max: 30 }), (source, count) => {
      const credit = allocateFin05(
        Number(source),
        linesFor(Array.from({ length: count }, () => 0)),
      );
      expect(credit.unallocatedPaise).toBe(Number(source));
      expect(amounts(credit)).toEqual(Array.from({ length: count }, () => 0));
      expect(amounts(allocateFin05(Number(source), linesFor([1])))).toEqual([
        Number(source),
      ]);
    }),
    { seed: 330033, numRuns: 500 },
  );
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 99 }),
      fc.array(fc.bigInt({ min: 1n, max: limit }), {
        minLength: 1,
        maxLength: 20,
      }),
      (source, charges) => {
        expect(allocateFin05(source, linesFor(charges.map(Number)))).toEqual(
          reference(BigInt(source), charges),
        );
      },
    ),
    { seed: 330034, numRuns: 500 },
  );
});
test("0.3.1b B5 FIN-05 generated ties/reordering and exact large intermediate products/totals", () => {
  fc.assert(
    fc.property(
      paise,
      fc.bigInt({ min: 1n, max: limit }),
      fc.integer({ min: 2, max: 20 }),
      (source, charge, count) => {
        const lines = linesFor(
          Array.from({ length: count }, () => Number(charge)),
        ).reverse();
        const result = allocateFin05(Number(source), lines);
        const base = (source / BigInt(count) / 100n) * 100n;
        expect(amounts(result)).toEqual([
          Number(source - base * BigInt(count - 1)),
          ...Array.from({ length: count - 1 }, () => Number(base)),
        ]);
        expect(result.allocations[0]?.lineId).toBe(`line-${count - 1}`);
      },
    ),
    { seed: 330032, numRuns: 500 },
  );
  expect(
    allocateFin05(Number(limit), linesFor([Number(limit), Number(limit)])),
  ).toEqual(reference(limit, [limit, limit]));
});
test("0.3.1b B4/B5 FIN-05 rejects empty/malformed/duplicate IDs and approved money parsing/range negatives", () => {
  for (const lines of [[], null, undefined, {}, [null], [1], new Array(1)])
    expect(() => allocateFin05(1, lines as readonly AllocationLine[])).toThrow(
      "INVALID_LINES",
    );
  for (const lineId of [
    "",
    " ",
    "a b",
    "a\n",
    "=",
    "a/b",
    "x".repeat(129),
    1,
    null,
  ])
    expect(() =>
      allocateFin05(1, [{ lineId: lineId as string, chargePaise: 1 }]),
    ).toThrow("INVALID_LINE_ID");
  expect(() =>
    allocateFin05(1, [
      { lineId: "a", chargePaise: 1 },
      { lineId: "a", chargePaise: 0 },
    ]),
  ).toThrow("DUPLICATE_LINE_ID");
  for (const invalid of [
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
    1n,
    null,
    undefined,
  ]) {
    expect(financialPaiseSchema.safeParse(invalid).success).toBe(false);
    expect(() => allocateFin05(invalid as number, linesFor([1]))).toThrow();
    expect(() => allocateFin05(1, linesFor([invalid as number]))).toThrow();
  }
  for (const invalid of ["0.001", "1e3", "90071992547409.92", "-1"])
    expect(() => parseRupees(invalid)).toThrow();
  expect(parseRupees("")).toBeNull();
});
