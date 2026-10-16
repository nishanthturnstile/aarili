import { createApi } from "@aarili/api";
import { expect, test, vi } from "vitest";

const shopId = "019a5e55-2222-7000-8000-000000000001";
const secondId = "019a5e55-2222-7000-8000-000000000002";
const time = "2026-10-16T00:00:00.000Z";
const record = {
  id: shopId,
  workflow: "fixture.intake",
  schemaVersion: 1,
  payload: {},
  creatorId: shopId,
  lifecycle: "active",
  version: 1,
  createdAt: time,
  updatedAt: time,
  stale: false,
  result: null,
};
test("0.4.2a E6/E8 production API composition admits draft limit/cursor while preserving owner boundaries", async () => {
  const list = vi.fn(async (_limit, cursor) => ({
    rows: cursor
      ? [{ ...record, id: secondId }]
      : [record, { ...record, id: secondId }],
    before: time,
  }));
  const withOwnerShop = vi.fn(async () => {
    throw Error("Unexpected shop read");
  });
  const owner = {
    origin: "http://localhost",
    commandLimit: async () => 0,
    withOwnerShop,
    withOwnerDraft: async (_headers, _shop, run) => ({
      data: await run({ repository: { list } }),
      headers: new Headers(),
    }),
  };
  const app = createApi(async () => true, owner);
  const first = await app.request(
    `http://localhost/api/shops/${shopId}/drafts?limit=1`,
  );
  expect(first.status).toBe(200);
  const page = await first.json();
  expect(page.drafts.map((d) => d.id)).toEqual([shopId]);
  expect(page.next).toEqual({ createdAt: time, id: shopId, before: time });
  const second = await app.request(
    `http://localhost/api/shops/${shopId}/drafts?limit=1&cursor=${encodeURIComponent(JSON.stringify(page.next))}`,
  );
  expect(second.status).toBe(200);
  expect((await second.json()).drafts.map((d) => d.id)).toEqual([secondId]);
  expect(list.mock.calls[1]).toEqual([2, page.next]);
  const ownQuery = await app.request(
    `http://localhost/api/shops/${shopId}?limit=1`,
  );
  expect(ownQuery.status).toBe(422);
  expect((await ownQuery.json()).error.code).toBe("INVALID_REQUEST");
  expect(withOwnerShop).not.toHaveBeenCalled();
  const unrelated = await app.request(
    `http://localhost/api/shops/${shopId}/other-module?q=term`,
  );
  expect(unrelated.status).toBe(404);
  const ownerUnsafe = await app.request("http://localhost/api/owner/complete", {
    method: "POST",
    headers: { Origin: "https://foreign.test" },
  });
  expect(ownerUnsafe.status).toBe(403);
  expect((await ownerUnsafe.json()).error.code).toBe("UNSAFE_ORIGIN");
  const draftUnsafe = await app.request(
    `http://localhost/api/shops/${shopId}/drafts/${shopId}`,
    { method: "PUT", headers: { Origin: "https://foreign.test" } },
  );
  expect(draftUnsafe.status).toBe(403);
  expect((await draftUnsafe.json()).error.code).toBe("UNSAFE_ORIGIN");
});
