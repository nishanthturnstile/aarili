// Test-only process preload. Production modules cannot select this transport.
const endpoint = new URL(process.env.TEST_GOOGLE_TRANSPORT_ORIGIN);
if (
  endpoint.protocol !== "http:" ||
  endpoint.hostname !== "127.0.0.1" ||
  process.env.AARILI_SYNTHETIC_AUTH !== "true"
)
  throw new Error("Synthetic Google transport must be loopback-only");
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.href === "https://oauth2.googleapis.com/token") {
    const target =
      input instanceof Request
        ? new Request(`${endpoint.origin}/token`, input)
        : `${endpoint.origin}/token`;
    return original(target, init);
  }
  if (url.protocol === "https:")
    throw new Error(
      "External network forbidden in synthetic Google verification",
    );
  return original(input, init);
};
