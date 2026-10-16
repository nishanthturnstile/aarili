import {
  clearOwnerState,
  DraftRequestError,
  getDraft,
  getDrafts,
  OwnerRequestError,
  onOwnerInvalidation,
  putDraft,
} from "@aarili/api/client";
import { afterEach, expect, test, vi } from "vitest";

const id = "019a5e55-2222-7000-8000-000000000001";
const draft = {
  id,
  workflow: "fixture.intake",
  schemaVersion: 1,
  payload: { value: "current" },
  creatorId: id,
  lifecycle: "active" as const,
  version: 2,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:01:00.000Z",
  stale: false,
  result: null,
};
const input = { workflow: "fixture.intake", schemaVersion: 1, payload: {} };
afterEach(() => {
  vi.unstubAllGlobals();
  clearOwnerState();
});
test("0.4.2a E3/E8 draft client preserves 428/412 current/409/422 status, body and ETag", async () => {
  for (const [status, code] of [
    [428, "PRECONDITION_REQUIRED"],
    [412, "VERSION_STALE"],
    [409, "REQUEST_CONFLICT"],
    [422, "IDEMPOTENCY_MISMATCH"],
  ] as const) {
    const body = {
      error: { code, message: "Draft request rejected" },
      ...(status === 412 ? { current: draft } : {}),
    };
    const etag = status === 412 ? '"v2"' : null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(body, { status, headers: etag ? { ETag: etag } : {} }),
      ),
    );
    await expect(putDraft(id, id, input, id, '"v1"')).rejects.toEqual(
      new DraftRequestError(status, body, etag),
    );
  }
});
test("0.4.2a E8 draft client validates version ETags and allows list responses without one", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(draft, { headers: { ETag: '"v2"' } })),
  );
  expect(await getDraft(id, id)).toEqual(draft);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ drafts: [draft], next: null })),
  );
  expect(await getDrafts(id)).toEqual({ drafts: [draft], next: null });
  for (const etag of [undefined, "*", '"v1"']) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(draft, { headers: etag ? { ETag: etag } : {} }),
      ),
    );
    await expect(getDraft(id, id)).rejects.toThrow("REQUEST_FAILED");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: { code: "VERSION_STALE", message: "Draft request rejected" },
            current: draft,
          },
          { status: 412, headers: etag ? { ETag: etag } : {} },
        ),
      ),
    );
    await expect(putDraft(id, id, input, id, '"v1"')).rejects.toThrow(
      "REQUEST_FAILED",
    );
  }
});
test("0.4.2a E8 current draft auth errors invalidate owner state independently of ETag", async () => {
  const invalidated = vi.fn();
  const stop = onOwnerInvalidation(invalidated);
  try {
    for (const [status, code] of [
      [401, "UNAUTHENTICATED"],
      [403, "SHOP_ACCESS_DENIED"],
    ] as const) {
      const before = invalidated.mock.calls.length;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            { error: { code, message: "Request denied" } },
            { status, headers: { ETag: "*" } },
          ),
        ),
      );
      await expect(getDraft(id, id)).rejects.toThrow("REQUEST_FAILED");
      expect(invalidated.mock.calls.length).toBe(before + 1);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            { error: { code, message: "Request denied" } },
            { status },
          ),
        ),
      );
      await expect(getDraft(id, id)).rejects.toEqual(
        new DraftRequestError(
          status,
          { error: { code, message: "Request denied" } },
          null,
        ),
      );
    }
  } finally {
    stop();
  }
});
test("0.4.2a E8 delayed old-identity error body cannot expose current draft or invalidate a newer session", async () => {
  for (const status of [412, 401]) {
    const oldBody = {
      error: {
        code: status === 412 ? "VERSION_STALE" : "UNAUTHENTICATED",
        message: "old response",
      },
      current: { ...draft, payload: { private: "old identity" } },
    };
    let release: (value: unknown) => void = () => {};
    let entered: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const response = Response.json(oldBody, {
      status,
      headers: { ETag: '"v2"' },
    });
    response.json = () => {
      entered();
      return new Promise<unknown>((resolve) => {
        release = resolve;
      });
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const invalidated = vi.fn();
    const stop = onOwnerInvalidation(invalidated);
    try {
      const pending = getDraft(id, id);
      await started;
      clearOwnerState();
      const before = invalidated.mock.calls.length;
      release(oldBody);
      const error = await pending.catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(OwnerRequestError);
      expect(error).not.toBeInstanceOf(DraftRequestError);
      expect(error).not.toHaveProperty("body");
      expect((error as Error).message).toBe("UNAUTHENTICATED");
      expect(invalidated.mock.calls.length).toBe(before);
    } finally {
      stop();
    }
  }
});

test("0.4.2a E3/E8 initial conditional PUT preserves 412 when no committed draft/current ETag exists", async () => {
  const body = {
    error: {
      code: "VERSION_STALE" as const,
      message: "Draft request rejected",
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(body, { status: 412 })),
  );
  await expect(putDraft(id, id, input, id, '"v1"')).rejects.toEqual(
    new DraftRequestError(412, body, null),
  );
});
