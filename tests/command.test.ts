import { createApi } from "@aarili/api";
import { clearOwnerState } from "@aarili/api/client";
import {
  CommandRequestError,
  changeSyntheticRecord,
  createCommandClient,
  createSyntheticRecord,
  readSyntheticRecord,
} from "@aarili/api/command-fixture-client";
import { createCommandRoutes } from "@aarili/api/commands";
import {
  actorSchema,
  etagSchema,
  syntheticCreateSchema,
  syntheticDraftSchema,
  syntheticRecordSchema,
} from "@aarili/contracts/command";
import {
  canonicalJson,
  expectedVersion,
  idempotencyCutoff,
  requestHash,
} from "@aarili/core/commands";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  clearOwnerState();
});
const uuid = "019a5e55-2222-7000-8000-000000000001";
const record = {
  id: uuid,
  version: 1,
  value: "alpha" as const,
  finalized: false,
  correctionOf: null,
  eventId: uuid,
};
test("0.2.3 E2/E9 draft/command validation, actor shapes and strict integer ETags", () => {
  expect(syntheticDraftSchema.parse({})).toEqual({});
  for (const input of [
    {},
    { value: "" },
    { value: 0 },
    { value: "alpha", actor: uuid },
  ])
    expect(syntheticCreateSchema.safeParse(input).success).toBe(false);
  for (const type of ["user", "system", "import", "support"])
    expect(actorSchema.safeParse({ type, id: uuid }).success).toBe(true);
  for (const input of [
    "",
    "v1",
    'W/"v1"',
    '"v0"',
    '"v01"',
    '"v2147483648"',
    "*",
    '"v1", "v2"',
  ])
    expect(etagSchema.safeParse(input).success).toBe(false);
  expect(expectedVersion('"v2147483647"')).toBe(2147483647);
  expect(() => expectedVersion(undefined)).toThrow("PRECONDITION_REQUIRED");
  expect(() => expectedVersion("*")).toThrow("VALIDATION_FAILED");
  expect(
    syntheticRecordSchema.safeParse({ ...record, version: null }).success,
  ).toBe(false);
});
test("0.2.3 E4/E9 property: canonical request JSON ignores object order, preserves JSON/array semantics", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.dictionary(fc.string(), fc.jsonValue()),
      async (data) => {
        const reversed = Object.fromEntries(Object.entries(data).reverse());
        expect(canonicalJson(data)).toBe(canonicalJson(reversed));
        expect(JSON.parse(canonicalJson(data))).toEqual(
          JSON.parse(JSON.stringify(data)),
        );
        expect(await requestHash(data)).toBe(await requestHash(reversed));
      },
    ),
    { seed: 160023, numRuns: 250 },
  );
  expect(canonicalJson(["a", "b"])).not.toBe(canonicalJson(["b", "a"]));
  for (const value of [
    undefined,
    NaN,
    Infinity,
    1n,
    new Date(),
    { a: undefined },
    Array(2),
  ])
    expect(() => canonicalJson(value)).toThrow("Non-JSON");
});
test("0.2.3 E4/E9 property: hash binds actor/action/target/precondition and payload with unambiguous encoding", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      fc.uuid(),
      fc.integer({ min: 1, max: 100000 }),
      async (a, target, version) => {
        const binding = {
          actor: { type: "user", id: a },
          action: "edit",
          target,
          version,
          command: { value: "alpha" },
        };
        const original = await requestHash(binding);
        for (const patch of [
          { actor: { type: "support", id: a } },
          { actor: { type: "user", id: `${a}-other` } },
          { action: "finalize" },
          { target: `${target}-other` },
          { version: version + 1 },
          { command: { value: "beta" } },
        ])
          expect(await requestHash({ ...binding, ...patch })).not.toBe(
            original,
          );
      },
    ),
    { seed: 161023, numRuns: 100 },
  );
});
test("0.2.3 E10 exact 30-day cutoff including leap days and year boundaries", () => {
  expect(
    idempotencyCutoff(new Date("2028-03-01T00:00:00.001Z")).toISOString(),
  ).toBe("2028-01-31T00:00:00.001Z");
  expect(
    idempotencyCutoff(new Date("2027-01-01T00:00:00.000Z")).toISOString(),
  ).toBe("2026-12-02T00:00:00.000Z");
});
test("0.2.3 E2 OpenAPI declares complete commands/errors and compiled per-module client executes schema-derived JSON", async () => {
  const routes = createCommandRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => 0,
    withOwnerCommand: async () => {
      throw new Error("Schema-only adapter");
    },
  });
  const app = createApi(async () => true).route("/", routes);
  const doc = app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Synthetic", version: "0.2.3" },
  });
  const patch = doc.paths?.["/api/dev/shops/{shopId}/records/{id}"]?.patch;
  expect(patch).toBeDefined();
  expect(Object.keys(patch?.responses ?? {})).toEqual([
    "200",
    "401",
    "403",
    "404",
    "409",
    "412",
    "422",
    "428",
    "429",
    "503",
  ]);
  expect(doc.paths).toHaveProperty("/api/healthz");
  const result = await createCommandClient(
    "http://127.0.0.1:3103/api",
  ).dev.shops[":shopId"].records.$post(
    {
      param: { shopId: uuid },
      json: { value: "alpha" },
      header: { "idempotency-key": uuid },
    },
    {
      fetch: async () =>
        Response.json({ record }, { headers: { ETag: '"v1"' } }),
    },
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ record });
});
test("0.2.3 E2/E3 schema-validated module wrappers reject malformed state/ETag and preserve 412 state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ record }, { headers: { ETag: '"v1"' } })),
  );
  expect(await createSyntheticRecord(uuid, { value: "alpha" }, uuid)).toEqual({
    record,
  });
  expect(
    await changeSyntheticRecord(
      uuid,
      uuid,
      { action: "edit", value: "beta" },
      uuid,
      '"v1"',
    ),
  ).toEqual({ record });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ ...record, version: "1" }, { headers: { ETag: '"v1"' } }),
    ),
  );
  await expect(readSyntheticRecord(uuid, uuid)).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(record, { headers: { ETag: "*" } })),
  );
  await expect(readSyntheticRecord(uuid, uuid)).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          error: { code: "VERSION_STALE", message: "Command rejected" },
          current: record,
        },
        { status: 412 },
      ),
    ),
  );
  await expect(
    changeSyntheticRecord(uuid, uuid, { action: "finalize" }, uuid, '"v1"'),
  ).rejects.toEqual(
    new CommandRequestError(412, {
      error: { code: "VERSION_STALE", message: "Command rejected" },
      current: record,
    }),
  );
});
test("0.2.3 E2 module reads discard late responses after sign-out/shop transition", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  const pending = readSyntheticRecord(uuid, uuid);
  clearOwnerState();
  resolve(Response.json(record, { headers: { ETag: '"v1"' } }));
  await expect(pending).rejects.toThrow("UNAUTHENTICATED");
});
