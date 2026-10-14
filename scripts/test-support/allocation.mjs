import assert from "node:assert/strict";
import { allocateFin05, formatPaise, parseRupees } from "@aarili/money";

// Operational text adapter only. Blank is unknown, never confirmed zero.
export function inspectAllocation(sourceText, entries) {
  const sourcePaise = parseRupees(sourceText);
  if (sourcePaise === null) throw new Error("UNKNOWN_SOURCE");
  const lines = entries.map((entry) => {
    const parts = entry.split("=");
    if (parts.length !== 2) throw new Error("INVALID_LINE_ENTRY");
    const chargePaise = parseRupees(parts[1]);
    if (chargePaise === null) throw new Error("UNKNOWN_CHARGE");
    return { lineId: parts[0], chargePaise };
  });
  const result = allocateFin05(sourcePaise, lines);
  const conservedPaise = result.allocations.reduce(
    (sum, line) => sum + BigInt(line.amountPaise),
    BigInt(result.unallocatedPaise),
  );
  assert.equal(conservedPaise, BigInt(sourcePaise));
  return {
    sourcePaise,
    lines,
    ...result,
    formatted: result.allocations.map((line) => ({
      lineId: line.lineId,
      amount: formatPaise(line.amountPaise),
    })),
    unallocated: formatPaise(result.unallocatedPaise),
    conservedPaise: conservedPaise.toString(),
  };
}

export function allocationDemonstrations() {
  const cases = [
    ["AC-17", "1000", ["a=1000", "b=1500"], [40000, 60000], 0],
    ["AC-49", "1000", ["a=700", "b=700", "c=700"], [33400, 33300, 33300], 0],
    [
      "B3 counterexample",
      "1000",
      ["a=700", "b=400", "c=300"],
      [50100, 28500, 21400],
      0,
    ],
    [
      "B3 paise",
      "1000.01",
      ["a=700", "b=700", "c=700"],
      [33401, 33300, 33300],
      0,
    ],
    ["B5 single", "1000.01", ["a=1"], [100001], 0],
    ["B4 credit", "1000.01", ["a=0", "b=0"], [0, 0], 100001],
    [
      "B5 reordered ties",
      "1000",
      ["c=700", "a=700", "b=700"],
      [33400, 33300, 33300],
      0,
    ],
  ];
  return ["deposit", "discount", "direct-cost"].flatMap((purpose) =>
    cases.map(([criterion, source, lines, expected, unallocated]) => {
      const inspection = inspectAllocation(source, lines);
      assert.deepEqual(
        inspection.allocations.map((line) => line.amountPaise),
        expected,
      );
      assert.equal(inspection.unallocatedPaise, unallocated);
      return { purpose, criterion, ...inspection };
    }),
  );
}
