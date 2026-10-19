import {
  emptyQuickOrder,
  quickOrderCommandSchema,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import { formatOrderPaise } from "@aarili/i18n";
import { parseRupees } from "@aarili/money";
import fc from "fast-check";
import { expect, test } from "vitest";

test("QO-01/07 exact intake currency formatting round-trips every safe paise boundary in English and Tamil", () => {
  for (const locale of ["en", "ta"] as const) {
    expect(formatOrderPaise(0, locale)).toBe("₹0.00");
    expect(formatOrderPaise(1, locale)).toBe("₹0.01");
    expect(
      parseRupees(
        formatOrderPaise(Number.MAX_SAFE_INTEGER, locale)
          .replace("₹", "")
          .replaceAll(",", ""),
      ),
    ).toBe(Number.MAX_SAFE_INTEGER);
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: BigInt(Number.MAX_SAFE_INTEGER) }),
        (v) => {
          expect(
            parseRupees(
              formatOrderPaise(Number(v), locale)
                .replace("₹", "")
                .replaceAll(",", ""),
            ),
          ).toBe(Number(v));
        },
      ),
    );
  }
});

test("QO-01/04 incomplete intake retains partial values and quoted zero without authorising a command", () => {
  const v = {
    ...emptyQuickOrder(),
    deliveryDate: "2026-",
    priceState: "quoted" as const,
    priceText: "0",
    instructions: "அளவு பின்னர்",
  };
  expect(quickOrderDraftSchema.parse(v)).toEqual(v);
  expect(quickOrderCommandSchema.safeParse(v).success).toBe(false);
  for (const injected of [
    { amountPaise: 0 },
    { approved: true },
    { shopId: crypto.randomUUID() },
    { load: 0 },
    { actorId: crypto.randomUUID() },
  ])
    expect(quickOrderDraftSchema.safeParse({ ...v, ...injected }).success).toBe(
      false,
    );
});
test("QO-03/06 disclosure and language never remove canonical draft values or pinned versions", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 150 }),
      fc.array(fc.boolean(), { maxLength: 20 }),
      (instructions, switches) => {
        const v = {
          ...emptyQuickOrder(),
          instructions,
          manifest: {
            entryId: crypto.randomUUID(),
            revisionId: crypto.randomUUID(),
            definitionId: crypto.randomUUID(),
          },
          priceText: "123.45",
        };
        let current = quickOrderDraftSchema.parse(v);
        for (const detailed of switches)
          current = quickOrderDraftSchema.parse({
            ...current,
            presentation: detailed ? "detailed" : "simple",
          });
        expect({ ...current, presentation: "simple" }).toEqual(v);
      },
    ),
    { seed: 121101, numRuns: 100 },
  );
});
test("QO-01/04 strict future command shape cannot treat blank date, wearer or quote as complete", () => {
  const v = {
    ...emptyQuickOrder(),
    customerId: crypto.randomUUID(),
    wearerId: crypto.randomUUID(),
    manifest: {
      entryId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      definitionId: crypto.randomUUID(),
    },
    deliveryDate: "2026-10-26",
  };
  expect(quickOrderCommandSchema.safeParse(v).success).toBe(true);
  for (const change of [
    { wearerId: null },
    { deliveryDate: "2026-02-30" },
    { deliveryTime: "25:00" },
    { priceState: "quoted", priceText: "" },
  ])
    expect(quickOrderCommandSchema.safeParse({ ...v, ...change }).success).toBe(
      false,
    );
});
