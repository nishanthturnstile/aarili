import { z } from "zod";

// Strict numbers, without coercion. Validation precedes hashing/persistence.
export const signedPaiseSchema = z
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
export const financialPaiseSchema = signedPaiseSchema.nonnegative();
export const millimetresSchema = z
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const moneyDraftSchema = z.strictObject({
  amountPaise: financialPaiseSchema.nullable().optional(),
  lengthMm: millimetresSchema.nullable().optional(),
});
export const financialInputSchema = z.strictObject({
  amountPaise: financialPaiseSchema,
});
export const postingInputSchema = z.strictObject({
  amountPaise: signedPaiseSchema,
});
export const moneyValuesSchema = z.strictObject({
  amountPaise: signedPaiseSchema,
  lengthMm: millimetresSchema,
});
export type MoneyValues = z.infer<typeof moneyValuesSchema>;
// A typed, runtime-validated wire boundary for the operational client. There
// is deliberately no production money endpoint or handwritten duplicate DTO.
export function encodeMoneyValues(values: MoneyValues): string {
  return JSON.stringify(moneyValuesSchema.parse(values));
}
export function decodeMoneyValues(json: string): MoneyValues {
  // Node 24 preserves primitive source text in the reviver. Checking only
  // the parsed number would accept a fractional token rounded to an integer
  // near MAX_SAFE_INTEGER (or tiny exponents underflowed to zero).
  const values: unknown = JSON.parse(
    json,
    (_key: string, value: unknown, context?: { source?: string }) => {
      if (typeof value === "number") {
        const source = context?.source;
        if (
          !source ||
          source.length > 17 ||
          !/^-?(0|[1-9][0-9]*)$/.test(source) ||
          !Number.isSafeInteger(value) ||
          BigInt(source) !== BigInt(value)
        )
          throw new Error("Invalid integer money wire token");
      }
      return value;
    },
  );
  return moneyValuesSchema.parse(values);
}
