import {
  bookingCommandSchema,
  bookingDraftSchema,
  emptyBookingDraft,
} from "@aarili/contracts/orders";
import { bookingPriceSummary } from "@aarili/core/orders";
import { formatBookingPaise } from "@aarili/i18n";
import fc from "fast-check";
import { expect, test } from "vitest";

test("GB-B03 quote aggregation preserves explicit zero, unknowns and exact large paise", () => {
  expect(
    bookingPriceSummary([{ pricePaise: 0 }, { pricePaise: null }]),
  ).toEqual({
    basis: "garment-prices",
    knownSubtotalPaise: "0",
    unknownCount: 1,
  });
  fc.assert(
    fc.property(
      fc.array(
        fc.option(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), {
          nil: null,
        }),
        { maxLength: 50 },
      ),
      (prices) => {
        const r = bookingPriceSummary(
          prices.map((pricePaise) => ({ pricePaise })),
        );
        expect(r.knownSubtotalPaise).toBe(
          prices.reduce((n, p) => n + BigInt(p ?? 0), 0n).toString(),
        );
        expect(r.unknownCount).toBe(prices.filter((p) => p === null).length);
      },
    ),
  );
  expect(formatBookingPaise("18014398509481982", "en")).toBe(
    "₹18,01,43,98,50,94,819.82",
  );
});
test("GB-B01/06 strict grouping draft rejects duplicate source identities and invalid dates", () => {
  expect(bookingDraftSchema.safeParse(emptyBookingDraft).success).toBe(true);
  expect(bookingCommandSchema.safeParse(emptyBookingDraft).success).toBe(false);
  const s = {
    id: "01995712-1111-7111-8111-111111111111",
    version: 1,
    snapshotDigest: "a".repeat(64),
  };
  expect(
    bookingDraftSchema.safeParse({ ...emptyBookingDraft, orders: [s, s] })
      .success,
  ).toBe(false);
  expect(
    bookingDraftSchema.safeParse({
      ...emptyBookingDraft,
      context: { ...emptyBookingDraft.context, eventDate: "2026-02-30" },
    }).success,
  ).toBe(false);
  expect(
    bookingDraftSchema.safeParse({ ...emptyBookingDraft, packagePrice: 0 })
      .success,
  ).toBe(false);
});
