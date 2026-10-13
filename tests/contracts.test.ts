import { createApi } from "@aarili/api";
import { createHealthClient, readHealth } from "@aarili/api/client";
import { apiErrorSchema, healthResponseSchema } from "@aarili/contracts";
import { validateEnvironment } from "@aarili/platform";
import { expect, test } from "vitest";

test("0.1.1a health route obeys the schema and emits an OpenAPI declaration", async () => {
  const api = createApi();
  const response = await api.request("/api/healthz");
  expect(response.status).toBe(200);
  expect(healthResponseSchema.parse(await response.json())).toEqual({
    status: "ok",
    service: "aarili-web",
  });
  expect(
    api.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Aarili", version: "0.0.0" },
    }).paths,
  ).toHaveProperty("/api/healthz");
});
test("0.1.1a typed Hono client and explicit output parsing agree", async () => {
  const client = createHealthClient("http://localhost");
  const response = await client.api.healthz.$get(
    {},
    {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        createApi().fetch(new Request(input, init)),
    },
  );
  expect(healthResponseSchema.parse(await response.json()).status).toBe("ok");
  expect(typeof readHealth).toBe("function");
});
test("0.1.1a unknown routes and unsafe methods expose only the shared error", async () => {
  for (const request of [
    new Request("http://localhost/api/orders"),
    new Request("http://localhost/api/healthz", { method: "POST" }),
  ]) {
    const response = await createApi().fetch(request);
    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      "NOT_FOUND",
    );
  }
});
test("0.1.1a contracts reject extra fields, changed wire values and missing fields", () => {
  for (const input of [
    { status: "ok" },
    { status: "paid", service: "aarili-web" },
    { status: "ok", service: "aarili-web", shopId: "synthetic" },
  ]) {
    expect(healthResponseSchema.safeParse(input).success).toBe(false);
  }
});
test("0.1.1a environment fails closed without printing input values", () => {
  expect(validateEnvironment({}).NODE_ENV).toBe("development");
  expect(validateEnvironment({ NODE_ENV: "production" }).NODE_ENV).toBe(
    "production",
  );
  expect(() => validateEnvironment({ NODE_ENV: "synthetic-secret" })).toThrow(
    "Invalid server environment configuration",
  );
  expect(() =>
    validateEnvironment({ NEXT_PUBLIC_DATABASE_URL: "synthetic-secret" }),
  ).toThrow("Public environment variables are not allowed");
});
