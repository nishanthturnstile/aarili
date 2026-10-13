import { createApi } from "@aarili/api";
import { readHealth } from "@aarili/api/client";
import { healthUnavailableSchema } from "@aarili/contracts";
import { checkDatabaseReadiness } from "@aarili/platform/database-health";
import type { Client } from "pg";
import { expect, test, vi } from "vitest";

test.each([true, false, "throw"])(
  "USE-08/09 0.1.2a thin Hono readiness maps %s without leaking diagnostics",
  async (state) => {
    const check = vi.fn(async () => {
      if (state === "throw")
        throw new Error("postgres://private-password@private-host");
      return state === true;
    });
    const response = await createApi(check).request("/api/healthz");
    expect(check).toHaveBeenCalledOnce();
    expect(response.status).toBe(state === true ? 200 : 503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    if (state !== true)
      expect(
        healthUnavailableSchema.parse(await response.json()).error.message,
      ).toBe("Database is unavailable");
  },
);

test.each(["success", "connect", "query", "timeout", "bad-result"])(
  "0.1.2a database %s always closes the connection",
  async (path) => {
    const end = vi.fn(async () => {});
    const client = {
      connect: vi.fn(async () => {
        if (path === "connect") throw new Error("private-secret");
      }),
      query: vi.fn(async () => {
        if (path === "query") throw new Error("private-secret");
        if (path === "timeout") return new Promise(() => {});
        return { rows: [{ ready: path === "bad-result" ? "1" : 1 }] };
      }),
      end,
      on: vi.fn(),
    };
    const ready = await checkDatabaseReadiness(
      "postgres://app_user:synthetic@localhost/test",
      {
        timeoutMs: 20,
        createClient: () => client as unknown as Client,
      },
    );
    expect(ready).toBe(path === "success");
    expect(end).toHaveBeenCalledOnce();
  },
);

test("0.1.2a missing, invalid and privileged configuration fails closed without connecting", async () => {
  const createClient = vi.fn();
  for (const value of [
    undefined,
    "",
    "bad-url",
    "http://app_user@localhost/test",
    "postgres://postgres@localhost/test",
    "postgres://app_user@localhost/test?user=postgres",
    "postgres://app_user@localhost/test?statement_timeout=0",
    "postgres://app_user@localhost/",
  ]) {
    expect(await checkDatabaseReadiness(value, { createClient })).toBe(false);
  }
  expect(createClient).not.toHaveBeenCalled();
});

test("0.1.2a typed client validates success and failure wire data at runtime", async () => {
  const success = { status: "ok", service: "aarili-web" };
  const unavailable = {
    error: { code: "DATABASE_UNAVAILABLE", message: "Database is unavailable" },
  };
  for (const [status, body] of [
    [200, success],
    [503, unavailable],
  ] as const) {
    expect(
      await readHealth("http://localhost", {
        fetch: async () => Response.json(body, { status }),
      }),
    ).toEqual(body);
  }
  for (const [status, body] of [
    [200, unavailable],
    [503, success],
    [200, { ...success, password: "private" }],
    [503, { error: { code: "DATABASE_UNAVAILABLE", message: "private" } }],
  ] as const) {
    await expect(
      readHealth("http://localhost", {
        fetch: async () => Response.json(body, { status }),
      }),
    ).rejects.toThrow();
  }
  await expect(
    readHealth("http://localhost", {
      fetch: async () => new Response("not-json"),
    }),
  ).rejects.toThrow();
  await expect(
    readHealth("http://localhost", {
      fetch: async () => new Response("private", { status: 500 }),
    }),
  ).rejects.toThrow("Health request failed");
});
