import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { usageEventSchema } from "@aarili/contracts/usage";
import {
  createUsageWriter,
  usageMetricBasis,
  usageMetricDefinitions,
} from "@aarili/core/usage";
import { createPrivateTelemetry } from "@aarili/platform/telemetry";
import fc from "fast-check";
import { test, vi } from "vitest";

const canaries = {
  name: "private-name-canary-54",
  phone: "private-phone-canary-54",
  measurements: { waist: "private-measurement-canary-54" },
  cookie: "private-cookie-canary-54",
  token: "private-token-canary-54",
  body: "private-body-canary-54",
  signedUrl:
    "https://private.invalid/private-url-canary-54?token=private-token-canary-54",
  fileContent: "private-file-canary-54",
  error: new Error("private-error-canary-54"),
  context: { nested: "private-context-canary-54" },
};
test("0.4.1d D2 TRU-13 strict allowlist excludes arbitrary values, unsupported providers and invalid units", async () => {
  const base = {
    actionId: randomUUID(),
    subjectId: randomUUID(),
    name: "draft.saved",
    schemaVersion: 1,
  };
  assert(usageEventSchema.safeParse(base).success);
  for (const extra of Object.keys(canaries))
    assert(
      !usageEventSchema.safeParse({ ...base, [extra]: canaries[extra] })
        .success,
    );
  for (const name of ["message.sent", "ai.called", "custom", ""])
    assert(!usageEventSchema.safeParse({ ...base, name }).success);
  for (const bytes of [-1, 0, 1.1, Number.MAX_SAFE_INTEGER + 1])
    assert(
      !usageEventSchema.safeParse({
        actionId: randomUUID(),
        subjectId: randomUUID(),
        name: "media.stored",
        bytes,
      }).success,
    );
  for (const durationSeconds of [null, 0, -1, 1.1, 2147483648])
    assert(
      !usageEventSchema.safeParse({
        actionId: randomUUID(),
        subjectId: randomUUID(),
        name: "support.recorded",
        category: "setup",
        durationSeconds,
      }).success,
    );
  const recorded = [];
  const usage = createUsageWriter({
    append: async (e) => {
      recorded.push(e);
    },
    read: async () => {
      throw Error("unused");
    },
  });
  await usage.recordDraftEvent({
    actionId: base.actionId,
    draftId: base.subjectId,
    event: "saved",
    schemaVersion: 1,
  });
  assert.deepEqual(recorded, [base]);
  assert.equal(usageMetricDefinitions.supportSeconds.unit, "seconds");
  assert.equal(usageMetricBasis.zeroDenominator, "N/A");
  await assert.rejects(usage.read({ from: "bad", to: "bad" }));
});
test("0.4.1d D5/D6 TRU-13 web/worker Pino and Sentry local envelopes exclude all private canaries", async () => {
  const lines = [];
  const envelopes = [];
  const telemetry = createPrivateTelemetry({
    logSink: (s) => lines.push(s),
    localErrorSink: (e) => envelopes.push(e),
  });
  for (const surface of ["web", "worker"]) {
    telemetry.report({
      ...canaries,
      surface,
      code: surface === "web" ? "web.unhandled" : "worker.unavailable",
      requestId: randomUUID(),
    });
  }
  telemetry.report({
    ...canaries,
    surface: "web",
    code: "private-error-canary-54",
  });
  await telemetry.flush();
  assert.equal(lines.length, 2);
  assert.equal(envelopes.length, 2);
  const text = JSON.stringify({ lines, envelopes });
  for (const marker of [
    "private-name",
    "private-phone",
    "private-measurement",
    "private-cookie",
    "private-token",
    "private-body",
    "private-url",
    "private-file",
    "private-error",
    "private-context",
  ])
    assert(!text.includes(marker), marker);
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert(!("pid" in parsed));
    assert(!("hostname" in parsed));
    assert.deepEqual(
      Object.keys(parsed).sort(),
      ["code", "level", "msg", "requestId", "surface", "time"].sort(),
    );
  }
  const serialized = JSON.stringify(envelopes);
  for (const field of [
    '"user"',
    '"request"',
    '"contexts"',
    '"exception"',
    '"breadcrumbs"',
    '"server_name"',
  ])
    assert(!serialized.includes(field), field);
});
test("0.4.1d D6/D7 USE-09 diagnostics failures/unconfigured Sentry preserve owner health and standard errors", async () => {
  const broken = createPrivateTelemetry({
    logSink: () => {
      throw Error("sink");
    },
    localErrorSink: () => {
      throw Error("sink");
    },
  });
  assert.doesNotThrow(() =>
    broken.report({ surface: "web", code: "web.unhandled", ...canaries }),
  );
  await broken.flush();
  const unconfigured = createPrivateTelemetry({ logSink: () => {} });
  unconfigured.report({ surface: "worker", code: "worker.unavailable" });
  assert.equal(await unconfigured.flush(), true);
  const api = createApi(
    async () => true,
    undefined,
    () => {
      throw Error("reporter");
    },
  );
  api.get("/failure", () => {
    throw Error("private-error-canary-54");
  });
  assert.equal((await api.request("http://localhost/api/healthz")).status, 200);
  const failed = await api.request("http://localhost/api/failure");
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), {
    error: { code: "INTERNAL_ERROR", message: "Request failed" },
  });
});

test("0.4.1d D2/D5 property: arbitrary contexts never escape bounded diagnostic projection", () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      const lines = [];
      const telemetry = createPrivateTelemetry({
        logSink: (line) => lines.push(line),
      });
      telemetry.report({
        code: "web.unhandled",
        surface: "web",
        body: value,
        context: value,
        error: value,
      });
      assert.equal(lines.length, 1);
      const record = JSON.parse(lines[0]);
      assert.deepEqual(
        Object.keys(record).sort(),
        ["code", "level", "msg", "surface", "time"].sort(),
      );
    }),
    { numRuns: 100 },
  );
});

test("0.4.1d D5 actual Next server hook ignores error/request/body/context canaries", async () => {
  const { onRequestError } = await import("../apps/web/src/instrumentation.ts");
  const write = process.stdout.write;
  const lines = [];
  try {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    process.stdout.write = (line) => {
      lines.push(String(line));
      return true;
    };
    await onRequestError(
      canaries.error,
      {
        path: canaries.signedUrl,
        method: "POST",
        headers: { cookie: canaries.cookie },
      },
      {
        routerKind: "App Router",
        routePath: "/owner",
        routeType: "render",
        revalidateReason: undefined,
        ...canaries,
      },
    );
  } finally {
    process.stdout.write = write;
    vi.unstubAllEnvs();
  }
  const record = JSON.parse(lines.join(""));
  assert.equal(record.code, "web.unhandled");
  assert.deepEqual(
    Object.keys(record).sort(),
    ["code", "level", "msg", "surface", "time"].sort(),
  );
});

test("0.4.1d D5/D7 final status observer covers child owner503/root500 exactly once with no private arguments", async () => {
  const reports = [];
  const api = createApi(
    async () => true,
    {
      origin: "http://localhost",
      ownerShop: async () => {
        throw canaries.error;
      },
    },
    (...args) => {
      reports.push(args);
      throw Error("private-reporter-canary-54");
    },
  );
  api.get("/failure", () => {
    throw canaries.error;
  });
  assert.equal((await api.request("http://localhost/api/healthz")).status, 200);
  assert.equal((await api.request("http://localhost/api/missing")).status, 404);
  assert.deepEqual(reports, []);
  const child = await api.request("http://localhost/api/owner/shop");
  assert.equal(child.status, 503);
  assert.deepEqual(await child.json(), {
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Request failed; try again",
    },
  });
  assert.deepEqual(reports, [[]]);
  const root = await api.request("http://localhost/api/failure");
  assert.equal(root.status, 500);
  assert.deepEqual(await root.json(), {
    error: { code: "INTERNAL_ERROR", message: "Request failed" },
  });
  assert.deepEqual(reports, [[], []]);
  const unavailable = createApi(
    async () => false,
    undefined,
    (...args) => reports.push(args),
  );
  assert.equal(
    (await unavailable.request("http://localhost/api/healthz")).status,
    503,
  );
  assert.deepEqual(reports, [[], [], []]);
});

test("0.4.1d D5 stateful getter canaries cannot change values after diagnostic validation", async () => {
  const lines = [];
  const envelopes = [];
  const reads = { code: 0, surface: 0, requestId: 0 };
  const requestId = "00000000-0000-4000-8000-000000000054";
  const telemetry = createPrivateTelemetry({
    logSink: (line) => lines.push(line),
    localErrorSink: (envelope) => envelopes.push(envelope),
  });
  telemetry.report({
    get code() {
      return ++reads.code === 1
        ? "web.unhandled"
        : "synthetic-private-getter-code-54";
    },
    get surface() {
      return ++reads.surface === 1
        ? "web"
        : "synthetic-private-getter-surface-54";
    },
    get requestId() {
      return ++reads.requestId === 1
        ? requestId
        : "synthetic-private-getter-request-54";
    },
  });
  await telemetry.flush();
  assert(
    !JSON.stringify({ lines, envelopes }).includes("synthetic-private-getter"),
    "private getter value escaped diagnostic validation",
  );
  assert.deepEqual(reads, { code: 1, surface: 1, requestId: 1 });
  assert.equal(lines.length, 1);
  const line = JSON.parse(lines[0]);
  assert.equal(line.code, "web.unhandled");
  assert.equal(line.surface, "web");
  assert.equal(line.requestId, requestId);
  assert.equal(envelopes.length, 1);
  const payload = envelopes[0][1][0][1];
  assert.deepEqual(payload.tags, {
    code: "web.unhandled",
    surface: "web",
    requestId,
  });
  assert.doesNotThrow(() =>
    telemetry.report({
      get code() {
        throw Error("synthetic-private-getter-thrown-54");
      },
    }),
  );
  assert.equal(lines.length, 1);
});
