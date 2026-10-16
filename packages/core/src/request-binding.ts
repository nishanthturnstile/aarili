// Canonical JSON v1: sorted UTF-16 keys, JSON string escaping, preserved array
// order; reject non-JSON values rather than silently omitting/coercing them.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${Array.from(value, canonicalJson).join(",")}]`;
  if (
    typeof value === "object" &&
    value &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Non-JSON request binding");
}
export async function requestHash(value: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
