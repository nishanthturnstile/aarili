import { createOwnerAuth, ownerAuthFromEnvironment } from "@aarili/auth";
import { createOwnerShopSchema, setupCommandSchema } from "@aarili/contracts";
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

test("ACCESS-01/03 registration defers naming; shop naming is strict and preserves scripts", () => {
  const account = {
    name: "Owner",
    email: "owner@example.test",
    password: "long-synthetic-passphrase",
  };
  expect(setupCommandSchema.safeParse(account).success).toBe(true);
  const boundaryEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  expect(boundaryEmail.length).toBe(254);
  for (const length of [1, 120]) {
    const name = "x".repeat(length);
    expect(
      createOwnerShopSchema.parse({ shopName: ` ${name} ` }).shopName,
    ).toBe(name);
    expect(setupCommandSchema.parse({ ...account, name }).name).toBe(name);
  }
  for (const length of [15, 128]) {
    const password = ` ${"p".repeat(length - 2)} `;
    expect(setupCommandSchema.parse({ ...account, password }).password).toBe(
      password,
    );
  }
  expect(
    setupCommandSchema.safeParse({ ...account, email: boundaryEmail }).success,
  ).toBe(true);
  for (const extra of [
    { name: "x".repeat(121) },
    { email: `${boundaryEmail}d` },
    { password: "p".repeat(14) },
  ])
    expect(setupCommandSchema.safeParse({ ...account, ...extra }).success).toBe(
      false,
    );
  expect(createOwnerShopSchema.parse({ shopName: "  ஆரிலி Aarili  " })).toEqual(
    { shopName: "ஆரிலி Aarili" },
  );
  for (const body of [
    {},
    { shopName: "   " },
    { shopName: "x".repeat(121) },
    { shopName: "Shop", role: "owner" },
  ])
    expect(createOwnerShopSchema.safeParse(body).success).toBe(false);
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
