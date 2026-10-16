import {
  clearOwnerState,
  createDraftClient,
  getDraft,
  putDraft,
} from "@aarili/api/client";
import { createDraftRoutes } from "@aarili/api/drafts";
import { draftIdSchema, draftSaveSchema } from "@aarili/contracts/drafts";
import {
  draftDeletionEligible,
  productionDraftRegistry,
  productionDraftRetention,
} from "@aarili/core/drafts";
import { canonicalJson, requestHash } from "@aarili/core/request-binding";
import { parseExpectedVersion } from "@aarili/core/request-version";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";

const id = "019a5e55-2222-7000-8000-000000000001";
afterEach(() => {
  vi.unstubAllGlobals();
  clearOwnerState();
});
test("0.4.2a E1/E2/E8 generic binding/version and strict draft envelopes preserve blank unknown inputs", async () => {
  expect(
    draftSaveSchema.parse({
      workflow: "fixture",
      schemaVersion: 1,
      payload: { amount: "", measurement: "" },
    }).payload,
  ).toEqual({ amount: "", measurement: "" });
  expect(
    draftSaveSchema.safeParse({
      workflow: "fixture",
      schemaVersion: 1,
      payload: {},
      actor: id,
    }).success,
  ).toBe(false);
  expect(draftIdSchema.safeParse(id).success).toBe(true);
  expect(draftIdSchema.safeParse(crypto.randomUUID()).success).toBe(false);
  expect(parseExpectedVersion(undefined)).toEqual({
    ok: false,
    status: 428,
    code: "PRECONDITION_REQUIRED",
  });
  expect(parseExpectedVersion('"v1"')).toEqual({ ok: true, version: 1 });
  expect(parseExpectedVersion('"v2147483648"').ok).toBe(false);
  await fc.assert(
    fc.asyncProperty(
      fc.dictionary(fc.string(), fc.jsonValue()),
      async (values) => {
        const reverse = Object.fromEntries(Object.entries(values).reverse());
        expect(canonicalJson(reverse)).toBe(canonicalJson(values));
        expect(await requestHash(reverse)).toBe(await requestHash(values));
      },
    ),
  );
  expect(productionDraftRegistry().size).toBe(0);
  expect(productionDraftRetention.enabled).toBe(false);
});
test("0.4.2a E6 deletion requires explicit notice policy and never purges promoted results", () => {
  const now = new Date("2026-10-16T00:00:00.000Z");
  const draft = {
    updatedAt: "2026-09-01T00:00:00.000Z",
    lifecycle: "active",
  } as Parameters<typeof draftDeletionEligible>[0];
  const policy = {
    enabled: true,
    noticeApproved: true,
    deletionApproved: true,
    noticeDays: 2,
  };
  expect(
    draftDeletionEligible(
      draft,
      now,
      new Date("2026-10-12T00:00:00.000Z"),
      productionDraftRetention,
    ),
  ).toBe(false);
  expect(
    draftDeletionEligible(
      draft,
      now,
      new Date("2026-10-12T00:00:00.000Z"),
      policy,
    ),
  ).toBe(true);
  expect(
    draftDeletionEligible(
      { ...draft, lifecycle: "promoted" },
      now,
      new Date("2026-10-12T00:00:00.000Z"),
      policy,
    ),
  ).toBe(false);
  for (const noticeDays of [null, 0, -1, 0.5])
    expect(
      draftDeletionEligible(draft, now, now, { ...policy, noticeDays }),
    ).toBe(false);
});
test("0.4.2a E8 typed client uses authenticated no-store transport and rejects late old-identity draft responses", async () => {
  expect(typeof createDraftClient().shops[":shopId"].drafts[":id"].$put).toBe(
    "function",
  );
  let settle: (response: Response) => void = () => {};
  let observed: RequestInit | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: unknown, init?: RequestInit) => {
      observed = init;
      return new Promise<Response>((resolve) => {
        settle = resolve;
      });
    }),
  );
  const pending = getDraft(id, id);
  clearOwnerState();
  settle(new Response(JSON.stringify({}), { status: 200 }));
  await expect(pending).rejects.toThrow("UNAUTHENTICATED");
  expect(observed?.cache).toBe("no-store");
  await expect(
    putDraft(
      id,
      id,
      { workflow: "fixture", schemaVersion: 0, payload: {} },
      id,
    ),
  ).rejects.toThrow();
});
test("0.4.2a E8 draft admission middleware leaves other owner modules independent", async () => {
  const commandLimit = vi.fn(async () => 0);
  const app = createDraftRoutes({
    origin: "http://localhost",
    commandLimit,
    withOwnerDraft: async () => {
      throw Error("Unexpected draft transaction");
    },
  });
  const response = await app.request(`/shops/${id}/vocabulary`, {
    method: "POST",
  });
  expect(response.status).toBe(404);
  expect(commandLimit).not.toHaveBeenCalled();
});
test("0.4.2a E2/E8 draft transport rejects oversized and chunked bodies before JSON/owner work", async () => {
  const withOwnerDraft = vi.fn(async () => {
    throw Error("Unexpected owner transaction");
  });
  const app = createDraftRoutes({
    origin: "http://localhost",
    commandLimit: async () => 0,
    withOwnerDraft,
  });
  const url = `http://localhost/shops/${id}/drafts/${id}`;
  const headers = {
    Origin: "http://localhost",
    "Content-Type": "application/json",
    "Idempotency-Key": id,
  };
  for (const declared of [String(512 * 1024 + 1), "1", undefined]) {
    const response = await app.fetch(
      new Request(url, {
        method: "PUT",
        headers: {
          ...headers,
          ...(declared ? { "Content-Length": declared } : {}),
        },
        body: "x".repeat(512 * 1024 + 1),
      }),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "Request body too large" },
    });
  }
  let chunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunks++;
      controller.enqueue(new Uint8Array(65536));
      if (chunks === 100) controller.close();
    },
  });
  const streamRequest = new Request(url, {
    method: "PUT",
    headers: { ...headers, "Transfer-Encoding": "chunked" },
    body,
    duplex: "half",
  } as RequestInit);
  const streamed = await app.fetch(streamRequest);
  expect(streamed.status).toBe(413);
  expect(chunks).toBeLessThan(100);
  expect(withOwnerDraft).not.toHaveBeenCalled();
  const other = await app.request(`/shops/${id}/vocabulary`, {
    method: "POST",
    body: "x".repeat(512 * 1024 + 1),
    headers: { "Content-Length": String(512 * 1024 + 1) },
  });
  expect(other.status).toBe(404);
});
test("0.4.2a E2/E8 multilingual draft body passes streaming admission and schema validation intact", async () => {
  const payload = { note: "தமிழ் அளவுகள்".repeat(1000) };
  let received: unknown;
  let stored = false;
  const app = createDraftRoutes({
    origin: "http://localhost",
    commandLimit: async () => 0,
    withOwnerDraft: async (_headers, _shop, run) => {
      const now = "2026-10-16T00:00:00.000Z";
      const draft = {
        id,
        workflow: "fixture.tamil",
        schemaVersion: 1,
        payload,
        creatorId: id,
        lifecycle: "active" as const,
        version: 1,
        createdAt: now,
        updatedAt: now,
        stale: false,
        result: null,
      };
      return {
        data: await run({
          shopId: id,
          actor: { type: "user", id },
          workflows: new Map([
            [
              "fixture.tamil",
              {
                schemaVersion: 1,
                draftSchema: {
                  safeParse(value: unknown) {
                    received = value;
                    return {
                      success: true as const,
                      data: value as Record<string, unknown>,
                    };
                  },
                },
                commandSchema: {
                  safeParse() {
                    return { success: false as const };
                  },
                },
                async revalidate() {},
                async promote() {
                  throw Error("No promotion");
                },
                async verifyResult() {},
              },
            ],
          ]),
          repository: {
            async lockKey() {},
            async replay() {
              return undefined;
            },
            async persist() {},
            async expiredKeys() {
              return [];
            },
            async now() {
              return new Date(now);
            },
            async actionId() {
              return id;
            },
            async lockDraft() {},
            async read() {
              return stored ? draft : undefined;
            },
            async list() {
              return { rows: [], before: now };
            },
            async insert() {
              stored = true;
            },
            async update() {
              return true;
            },
            async audit() {},
          },
        }),
        headers: new Headers(),
      };
    },
  });
  const response = await app.request(`/shops/${id}/drafts/${id}`, {
    method: "PUT",
    headers: {
      Origin: "http://localhost",
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    body: JSON.stringify({
      workflow: "fixture.tamil",
      schemaVersion: 1,
      payload,
    }),
  });
  expect(response.status).toBe(200);
  expect(received).toEqual(payload);
  expect((await response.json()).draft.payload).toEqual(payload);
});
