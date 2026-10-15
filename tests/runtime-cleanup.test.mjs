import { createApi } from "@aarili/api";
import * as client from "@aarili/api/client";
import { afterEach, expect, test, vi } from "vitest";
import { createOwnerVerificationApi } from "../scripts/test-support/owner-api.mjs";

afterEach(() => vi.unstubAllEnvs());

test("#48 USE-08/09 removed command, probe and documentation routes stay 404 in every environment with configured auth", async () => {
  const owner = new Proxy(
    {},
    {
      get() {
        throw Error("Removed route touched owner auth");
      },
    },
  );
  for (const environment of ["development", "test", "production"]) {
    vi.stubEnv("NODE_ENV", environment);
    const api = createApi(async () => true, owner);
    for (const path of [
      "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records",
      "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records/019a5e55-2222-7000-8000-000000000002",
      "/api/owner/sensitive-probe",
      "/api/docs",
      "/api/openapi.json",
    ]) {
      for (const method of [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ]) {
        for (const suffix of ["", "?untrusted=1"]) {
          const result = await api.request(path + suffix, { method });
          expect(
            result.status,
            `${environment} ${method} ${path}${suffix}`,
          ).toBe(404);
        }
      }
    }
    const document = api.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Aarili", version: "0" },
    });
    expect(
      Object.keys(document.paths).some((path) =>
        /\/dev\/|sensitive-probe/.test(path),
      ),
    ).toBe(false);
    expect((await api.request("/api/healthz")).status).toBe(200);
  }
});

test("#48 ordinary browser client exports real owner transport without exemplars", () => {
  for (const name of [
    "createCommandClient",
    "createSyntheticRecord",
    "changeSyntheticRecord",
    "readSyntheticRecord",
    "CommandRequestError",
    "probeRecentOwner",
  ])
    expect(name in client, name).toBe(false);
  expect(typeof client.readOwnerShop).toBe("function");
  expect(typeof client.clearOwnerState).toBe("function");
});

test("#48 recent-auth probe requires explicit verification composition and a trusted origin", async () => {
  const owner = {
    origin: "http://localhost",
    withRecentOwner: async (_headers, run) => ({
      data: await run(),
      headers: new Headers(),
    }),
  };
  const path = "/api/owner/sensitive-probe";
  expect(
    (await createApi(async () => true, owner).request(path, { method: "POST" }))
      .status,
  ).toBe(404);
  const fixture = createOwnerVerificationApi(async () => true, owner);
  expect((await fixture.request(path, { method: "POST" })).status).toBe(403);
  const result = await fixture.request(path, {
    method: "POST",
    headers: { Origin: owner.origin },
  });
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ state: "probe-accepted" });
});
