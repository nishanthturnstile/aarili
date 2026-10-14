// 0.3.1a: signed integer paise and integer mm only. No rounding policy.
export const POSTGRES_BIGINT_MIN = -9223372036854775808n;
export const POSTGRES_BIGINT_MAX = 9223372036854775807n;
const wireMax = BigInt(Number.MAX_SAFE_INTEGER);
export type ExactValueErrorCode =
  | "INVALID_INTEGER"
  | "WIRE_RANGE"
  | "DATABASE_RANGE"
  | "INVALID_DECIMAL"
  | "NEGATIVE_INPUT"
  | "DIVISION_BY_ZERO"
  | "FRACTIONAL_RESULT";
export class ExactValueError extends Error {
  constructor(public readonly code: ExactValueErrorCode) {
    super(code); // Never include entered values or configuration in errors.
  }
}
export function assertPostgresBigint(value: bigint): bigint {
  if (typeof value !== "bigint") throw new ExactValueError("INVALID_INTEGER");
  if (value < POSTGRES_BIGINT_MIN || value > POSTGRES_BIGINT_MAX)
    throw new ExactValueError("DATABASE_RANGE");
  return value;
}
export function fromBigint(value: bigint): number {
  assertPostgresBigint(value);
  if (value < -wireMax || value > wireMax)
    throw new ExactValueError("WIRE_RANGE");
  return Number(value); // Conversion only after both range checks.
}
export function toBigint(value: number): bigint {
  if (!Number.isSafeInteger(value))
    throw new ExactValueError("INVALID_INTEGER");
  return assertPostgresBigint(BigInt(value));
}
export function nonNegativeInteger(value: number): number {
  toBigint(value);
  if (value < 0) throw new ExactValueError("NEGATIVE_INPUT");
  return value === 0 ? 0 : value;
}
export function toPostgresBigint(value: number): string {
  return toBigint(value).toString();
}
export function fromPostgresBigint(value: string): number {
  if (
    typeof value !== "string" ||
    value.length > 20 ||
    !/^-?(0|[1-9][0-9]*)$/.test(value)
  )
    throw new ExactValueError("INVALID_INTEGER");
  return fromBigint(BigInt(value));
}
export function checkedAdd(a: number, b: number): number {
  return fromBigint(toBigint(a) + toBigint(b));
}
export function checkedSubtract(a: number, b: number): number {
  return fromBigint(toBigint(a) - toBigint(b));
}
export function checkedMultiply(a: number, b: number): number {
  return fromBigint(toBigint(a) * toBigint(b));
}
export function checkedMultiplyDivide(
  a: number,
  b: number,
  divisor: number,
): number {
  const product = toBigint(a) * toBigint(b); // May exceed int8; only the result must fit.
  const denominator = toBigint(divisor);
  if (denominator === 0n) throw new ExactValueError("DIVISION_BY_ZERO");
  if (product % denominator !== 0n)
    throw new ExactValueError("FRACTIONAL_RESULT");
  return fromBigint(product / denominator);
}
export function checkedDivide(a: number, b: number): number {
  return checkedMultiplyDivide(a, 1, b);
}

function parseDecimal(
  input: string | null,
  places: number,
  signed: boolean,
): number | null {
  if (input === null) return null;
  if (typeof input !== "string") throw new ExactValueError("INVALID_DECIMAL");
  const text = input.trim();
  if (text === "") return null;
  if (text.length > 40) throw new ExactValueError("INVALID_DECIMAL");
  // Plain ASCII decimals, optionally valid en-IN or international grouping.
  // Symbols, exponent notation, incomplete fractions and excess precision fail.
  const match =
    /^(-?)([0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+|[1-9][0-9]?(?:,[0-9]{2})*,[0-9]{3})(?:\.([0-9]+))?$/.exec(
      text,
    );
  if (!match || (match[3]?.length ?? 0) > places)
    throw new ExactValueError("INVALID_DECIMAL");
  if (match[1] === "-" && !signed) throw new ExactValueError("NEGATIVE_INPUT");
  const whole = BigInt(match[2]?.replaceAll(",", "") ?? "");
  const fraction = BigInt((match[3] ?? "").padEnd(places, "0"));
  const value = whole * 10n ** BigInt(places) + fraction;
  return fromBigint(match[1] === "-" ? -value : value);
}
// Blank/null remain unknown. Nonnegative financial entry and signed postings
// have separate entry points; callers cannot accidentally enable negatives.
export function parseRupees(input: string | null): number | null {
  return parseDecimal(input, 2, false);
}
export function parseSignedRupees(input: string | null): number | null {
  return parseDecimal(input, 2, true);
}
export function parseMetres(input: string | null): number | null {
  return parseDecimal(input, 3, false);
}
export type MaterialCost =
  | { supported: true; amountPaise: number }
  | { supported: false; reason: "FRACTIONAL_PAISE" };
// The basis and purchase cost must be supplied. These are not business rates.
export function materialCost(
  consumedMm: number,
  basisMm: number,
  costPaise: number,
): MaterialCost {
  nonNegativeInteger(consumedMm);
  nonNegativeInteger(basisMm);
  nonNegativeInteger(costPaise);
  try {
    return {
      supported: true,
      amountPaise: checkedMultiplyDivide(consumedMm, costPaise, basisMm),
    };
  } catch (error) {
    if (error instanceof ExactValueError && error.code === "FRACTIONAL_RESULT")
      return { supported: false, reason: "FRACTIONAL_PAISE" };
    throw error;
  }
}
export function formatPaise(value: number): string {
  const paise = toBigint(value);
  const magnitude = paise < 0n ? -paise : paise;
  // Format only integer rupees with Intl; never convert paise to a float.
  const rupees = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(magnitude / 100n);
  return `${paise < 0n ? "-" : ""}₹${rupees}.${(magnitude % 100n).toString().padStart(2, "0")}`;
}
