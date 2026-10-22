// Exact, bounded wire codec. Lengths never pass through a JavaScript number.
export type ExactLength = { numerator: string; denominator: string };
export type LengthUnit = "in" | "cm";
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
function reduced(n: bigint, d: bigint): ExactLength {
  if (n < 0n || d <= 0n) throw new RangeError("Invalid exact length");
  const g = gcd(n, d);
  return { numerator: String(n / g), denominator: String(d / g) };
}
export function parseLength(text: string): ExactLength | null {
  if (text.length > 80) return null;
  const s = text.trim();
  let m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (m?.[1]) {
    const d = 10n ** BigInt(m[2]?.length ?? 0);
    return reduced(BigInt(m[1]) * d + BigInt(m[2] || 0), d);
  }
  m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(s);
  if (!m?.[2] || !m[3]) return null;
  const d = BigInt(m[3]),
    n = BigInt(m[2]);
  // Mixed notation requires a proper fractional part; no ambiguous 1 3/2.
  if (d === 0n || (m[1] !== undefined && n >= d)) return null;
  return reduced(BigInt(m[1] || 0) * d + n, d);
}
export function convertLength(
  v: ExactLength,
  from: LengthUnit,
  to: LengthUnit,
): ExactLength {
  const n = BigInt(v.numerator),
    d = BigInt(v.denominator);
  return from === to
    ? reduced(n, d)
    : from === "in"
      ? reduced(n * 127n, d * 50n)
      : reduced(n * 50n, d * 127n);
}
export function exactDecimal(v: ExactLength): string | null {
  let d = BigInt(v.denominator),
    twos = 0,
    fives = 0;
  if (d <= 0n || BigInt(v.numerator) < 0n)
    throw new RangeError("Invalid exact length");
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return null;
  const places = Math.max(twos, fives),
    scale = 10n ** BigInt(places);
  const digits = String(
    (BigInt(v.numerator) * scale) / BigInt(v.denominator),
  ).padStart(places + 1, "0");
  return places
    ? `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(
        /\.?0+$/,
        "",
      )
    : digits;
}
export function displayExactLength(v: ExactLength): string {
  return exactDecimal(v) ?? `${v.numerator}/${v.denominator}`;
}
export function compareLengths(a: ExactLength, b: ExactLength): -1 | 0 | 1 {
  const l = BigInt(a.numerator) * BigInt(b.denominator),
    r = BigInt(b.numerator) * BigInt(a.denominator);
  return l < r ? -1 : l > r ? 1 : 0;
}
export function matchesIncrement(
  v: ExactLength,
  increment: ExactLength,
): boolean {
  const n = BigInt(increment.numerator);
  return (
    n > 0n &&
    (BigInt(v.numerator) * BigInt(increment.denominator)) %
      (BigInt(v.denominator) * n) ===
      0n
  );
}
