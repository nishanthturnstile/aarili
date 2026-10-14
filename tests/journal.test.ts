import { reversalEntries, validateJournal } from "@aarili/core/journal";
import type { JournalInput } from "@aarili/db/repositories/journal";
import fc from "fast-check";
import { expect, test } from "vitest";

const base: JournalInput = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  subjectId: "22222222-2222-4222-8222-222222222222",
  kind: "posting",
  relatedId: null,
  reason: "Synthetic example",
  entries: [],
};
test("0.3.1c C1/C4 FIN-12 TRU-12 exact balanced batches and reversal properties", () => {
  fc.assert(
    fc.property(fc.bigInt({ min: 1n, max: 9007199254740991n }), (amount) => {
      const entries = [
        { account: "cash" as const, amountPaise: Number(amount) },
        { account: "deposit" as const, amountPaise: -Number(amount) },
      ];
      const command = { ...base, entries };
      const result = validateJournal(command);
      expect(
        result.entries.reduce((sum, e) => sum + BigInt(e.amountPaise), 0n),
      ).toBe(0n);
      expect(reversalEntries(reversalEntries(result.entries))).toEqual(
        result.entries,
      );
      expect(result.entries).not.toBe(entries);
      expect(entries).toEqual(command.entries);
      expect(() =>
        validateJournal({
          ...base,
          entries: [
            { account: "cash", amountPaise: Number(amount) },
            { account: "deposit", amountPaise: -Number(amount) + 1 },
          ],
        }),
      ).toThrow();
    }),
    { seed: 340031, numRuns: 1000 },
  );
});
test("0.3.1c C1/C6 rejects incomplete, unknown, unsafe, duplicated accounts and aggregate overflow", () => {
  for (const entries of [
    [],
    [{ account: "cash", amountPaise: 1 }],
    [
      { account: "cash", amountPaise: null },
      { account: "deposit", amountPaise: -1 },
    ],
    [
      { account: "cash", amountPaise: 1.5 },
      { account: "deposit", amountPaise: -1.5 },
    ],
    [
      { account: "cash", amountPaise: Number.MAX_SAFE_INTEGER + 1 },
      { account: "deposit", amountPaise: -1 },
    ],
    [
      { account: "cash", amountPaise: 1 },
      { account: "cash", amountPaise: -1 },
    ],
    [
      { account: "unknown", amountPaise: 1 },
      { account: "deposit", amountPaise: -1 },
    ],
    [
      { account: "cash", amountPaise: Number.MAX_SAFE_INTEGER },
      { account: "receivable", amountPaise: 1 },
      { account: "deposit", amountPaise: -Number.MAX_SAFE_INTEGER },
      { account: "revenue", amountPaise: -1 },
    ],
  ])
    expect(() =>
      validateJournal({ ...base, entries } as JournalInput),
    ).toThrow();
  const entries = [
    { account: "cash" as const, amountPaise: 1 },
    { account: "deposit" as const, amountPaise: -1 },
  ];
  for (const change of [
    { sourceId: "bad" },
    { subjectId: "bad" },
    { reason: " " },
    { reason: "x".repeat(241) },
    { relatedId: base.sourceId },
    { kind: "settlement", relatedId: null },
  ])
    expect(() =>
      validateJournal({ ...base, entries, ...change } as JournalInput),
    ).toThrow();
});
