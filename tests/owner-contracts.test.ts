import { createOwnerAuth, ownerAuthFromEnvironment } from "@aarili/auth";
import { setupCommandSchema } from "@aarili/contracts";
import { expect, test } from "vitest";

test("0.2.1a A1/A8 bootstrap contracts reject missing, short, oversized and injected inputs", () => {
  const valid = {
    name: "சோதனை",
    email: "owner@example.test",
    password: "long-unique-synthetic-password",
    shopName: "சோதனைக் கடை",
  };
  for (const input of [
    { ...valid, name: " " },
    { ...valid, shopName: "" },
    { ...valid, email: "invalid" },
    { ...valid, password: "short" },
    { ...valid, password: "x".repeat(129) },
    { ...valid, role: "owner" },
    { ...valid, emailVerified: true },
  ])
    expect(setupCommandSchema.safeParse(input).success).toBe(false);
  expect(
    setupCommandSchema.parse({ ...valid, email: "OWNER@example.test" }).email,
  ).toBe("owner@example.test");
});

test("0.2.1a A7/A8 exact HTTPS origins and fail-closed synthetic activation configuration", () => {
  expect(
    ownerAuthFromEnvironment({ AARILI_SYNTHETIC_AUTH: "false" }),
  ).toBeUndefined();
  expect(ownerAuthFromEnvironment({})).toBeUndefined();
  expect(() =>
    ownerAuthFromEnvironment({ AARILI_SYNTHETIC_AUTH: "true" }),
  ).toThrow("Synthetic auth configuration missing");
  for (const origin of [
    "http://public.example",
    "https://*.example",
    "https://localhost/setup",
  ])
    expect(() =>
      createOwnerAuth({
        connectionString: "postgresql://unused",
        origin,
        secret: "x".repeat(32),
        setupToken: "x".repeat(32),
        capture: async () => {},
      }),
    ).toThrow();
});
