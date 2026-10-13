import {
  createOwnerAuth,
  googleFromEnvironment,
  ownerAuthFromEnvironment,
} from "@aarili/auth";
import { googleDisconnectSchema, googleEntrySchema } from "@aarili/contracts";
import { expect, test } from "vitest";

test("0.2.1c C2/C6 strict Google entry excludes scopes, direct ID tokens, alternate providers and client-controlled state context", () => {
  for (const extra of [
    { scopes: ["drive"] },
    { idToken: { token: "synthetic-token" } },
    { additionalData: { serverContext: { sessionId: "spoof" } } },
    { additionalParams: { scope: "drive" } },
    { provider: "github" },
  ])
    expect(
      googleEntrySchema.safeParse({ provider: "google", ...extra }).success,
    ).toBe(false);
  expect(
    googleDisconnectSchema.safeParse({ providerId: "credential" }).success,
  ).toBe(false);
});

test("0.2.1c C6 missing/invalid activation fails closed; environment-specific clients, approved exact origins and email allow-list", () => {
  const env = {
    AUTH_GOOGLE_ENABLED: "true",
    AUTH_GOOGLE_ENVIRONMENT: "development",
    AUTH_GOOGLE_APPROVED_ORIGIN: "http://127.0.0.1:3000",
    AUTH_ORIGIN: "http://127.0.0.1:3000",
    GOOGLE_DEV_CLIENT_ID: "synthetic-google-client-14",
    GOOGLE_DEV_CLIENT_SECRET: "synthetic-google-secret-14",
    GOOGLE_PROD_CLIENT_ID: "synthetic-production-client",
    GOOGLE_PROD_CLIENT_SECRET: "synthetic-production-secret",
    AUTH_GOOGLE_ALLOWED_EMAILS: "owner@example.test",
  };
  expect(googleFromEnvironment(env)?.clientId).toBe(env.GOOGLE_DEV_CLIENT_ID);
  for (const key of [
    "AUTH_GOOGLE_ENABLED",
    "AUTH_GOOGLE_ENVIRONMENT",
    "AUTH_GOOGLE_APPROVED_ORIGIN",
    "AUTH_GOOGLE_ALLOWED_EMAILS",
    "GOOGLE_DEV_CLIENT_ID",
    "GOOGLE_DEV_CLIENT_SECRET",
  ])
    expect(googleFromEnvironment({ ...env, [key]: "" })).toBeUndefined();
  for (const override of [
    { AUTH_GOOGLE_ENVIRONMENT: "production" },
    { AUTH_GOOGLE_APPROVED_ORIGIN: "https://*.example.test" },
    { AUTH_GOOGLE_ALLOWED_EMAILS: "*@example.test" },
    { AUTH_GOOGLE_ALLOWED_EMAILS: "owner@example.test," },
    { AUTH_GOOGLE_ALLOWED_EMAILS: "OWNER@example.test" },
    { AUTH_GOOGLE_APPROVED_ORIGIN: "http://127.0.0.1:3000/" },
  ])
    expect(googleFromEnvironment({ ...env, ...override })).toBeUndefined();
  const production = googleFromEnvironment({
    ...env,
    AUTH_GOOGLE_ENVIRONMENT: "production",
    AUTH_ORIGIN: "https://app.example.test",
    AUTH_GOOGLE_APPROVED_ORIGIN: "https://app.example.test",
  });
  expect(production?.clientId).toBe(env.GOOGLE_PROD_CLIENT_ID);
  if (!production)
    throw new Error("Synthetic production configuration was rejected");
  expect(ownerAuthFromEnvironment(env)).toBeUndefined(); // Auth/live-mail gate remains closed.
  expect(() =>
    createOwnerAuth({
      connectionString: "unused",
      origin: "http://127.0.0.1:3000",
      secret: "s".repeat(32),
      setupToken: "",
      capture: async () => {},
      google: { ...production, approvedOrigin: "http://127.0.0.1:3000" },
    }),
  ).toThrow("Google approval configuration invalid");
});
