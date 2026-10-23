import {
  compareLengths,
  convertLength,
  displayExactLength,
  exactDecimal,
  matchesIncrement,
  parseLength,
} from "@aarili/contracts/measurement-values";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

function parsed(text: string) {
  const v = parseLength(text);
  if (!v) throw Error("Invalid fixture");
  return v;
}
describe("MV-A03/04 exact measurement wire codec", () => {
  it("preserves fractions and exact nonterminating conversions without rounding", () => {
    const v = parsed("12 1/4");
    expect(v).toEqual({ numerator: "49", denominator: "4" });
    expect(exactDecimal(v)).toBe("12.25");
    expect(displayExactLength(convertLength(v, "in", "cm"))).toBe("31.115");
    expect(displayExactLength(convertLength(parsed("2.54"), "cm", "in"))).toBe(
      "1",
    );
    expect(displayExactLength(convertLength(parsed("1"), "cm", "in"))).toBe(
      "50/127",
    );
    expect(exactDecimal(parsed("1/3"))).toBeNull();
    expect(parseLength("")).toBeNull();
    expect(parseLength("0")).toEqual({ numerator: "0", denominator: "1" });
  });
  it.each([
    "-1",
    "+1",
    "1e3",
    "1/0",
    "1 3/2",
    "1,2",
    "12in",
    "¼",
    ".5",
    "1.",
    "1/2/3",
    "9".repeat(81),
  ])("rejects unsupported/ambiguous grammar %s", (s) =>
    expect(parseLength(s)).toBeNull(),
  );
  it("round trips arbitrary bounded decimals through both units", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 50n }),
        fc.integer({ min: 0, max: 12 }),
        (n, places) => {
          const s = n.toString().padStart(places + 1, "0"),
            text = places ? `${s.slice(0, -places)}.${s.slice(-places)}` : s;
          const v = parsed(text);
          expect(
            convertLength(convertLength(v, "in", "cm"), "cm", "in"),
          ).toEqual(v);
          expect(
            convertLength(convertLength(v, "cm", "in"), "in", "cm"),
          ).toEqual(v);
          expect(parseLength(exactDecimal(v) ?? "invalid")).toEqual(v);
        },
      ),
      { numRuns: 500 },
    );
  });
  it("tests exact divisibility in the approved unit", () => {
    expect(
      matchesIncrement(
        convertLength(parsed("31.115"), "cm", "in"),
        parsed("0.25"),
      ),
    ).toBe(true);
    expect(matchesIncrement(parsed("12.26"), parsed("1/4"))).toBe(false);
    expect(matchesIncrement(parsed("0"), parsed("0"))).toBe(false);
    expect(
      compareLengths(
        parsed("100000000000000000000.25"),
        parsed("100000000000000000000.24"),
      ),
    ).toBe(1);
  });
});
