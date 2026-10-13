import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { expect, test } from "vitest";
import { availablePort, ports, reservedPort } from "../scripts/local-infra.mjs";

test("0.1.1b USE-09: validate overrides without echoing secret-like invalid values", () => {
  expect(ports({})).toEqual({ AARILI_PG_PORT: 55432, AARILI_S3_PORT: 53900 });
  for (const value of ["password-canary", "0", "65536", "1.5", "-1", "5432"])
    expect(() => ports({ AARILI_PG_PORT: value })).toThrow();
  expect(() => ports({ AARILI_PG_PORT: "53900" })).toThrow("distinct");
  expect(() => ports({ AARILI_S3_PORT: "5432" })).toThrow("reserved");
  try {
    execFileSync(process.execPath, ["scripts/local-infra.mjs", "doctor"], {
      env: { ...process.env, AARILI_PG_PORT: "password-canary" },
      stdio: "pipe",
    });
    throw new Error("Expected diagnostic failure");
  } catch (error) {
    expect(error.status).toBe(1);
    expect(error.stderr.toString()).toContain("integer");
    expect(error.stderr.toString()).not.toContain("password-canary");
  }
});

test("0.1.1b USE-09: Windows reservation boundaries, including admin exclusions", () => {
  const output =
    "Start Port End Port\r\n---------- --------\r\n 55000 55499\r\n 56000 56009 *\r\n";
  for (const port of [55000, 55432, 55499, 56000, 56009])
    expect(reservedPort(output, port)).toBeTruthy();
  for (const port of [54999, 55500, 56010])
    expect(reservedPort(output, port)).toBeFalsy();
});

test("0.1.1b TRU-01/USE-09: occupied loopback listener is preserved", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    expect(await availablePort(port)).toBe(false);
    expect(server.listening).toBe(true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  expect(await availablePort(port)).toBe(true);
});
