import { clearOwnerState } from "@aarili/api/client";
import { afterEach, expect, test, vi } from "vitest";
import { createDraftScope } from "../apps/web/src/app/draft-scope.ts";
import { createWorkGuard } from "../apps/web/src/app/pwa-runtime.js";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";

afterEach(() => vi.unstubAllGlobals());
test("0.4.2b F8 production imports cannot reach the synthetic browser editor", () => {
  const sources = new Map([
    [
      "apps/web/src/app/page.tsx",
      'import Host from "../../test-support/draft-host-app";',
    ],
    [
      "apps/web/test-support/draft-host-app.tsx",
      "export default function Host() { return null; }",
    ],
  ]);
  expect(checkBoundaries(sources)).toContainEqual(
    expect.stringContaining("foundation exemplar"),
  );
});
test("0.4.2b F6 memory-only owner scope rejects late resume queries after identity loss", async () => {
  let resolve;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  const scope = createDraftScope("019a5e55-2222-7000-8000-000000000001");
  const reading = scope.list();
  const rejected = expect(reading).rejects.toBeDefined();
  clearOwnerState();
  resolve(Response.json({ drafts: [], next: null }));
  await rejected;
  await expect(scope.list()).rejects.toThrow("Access ended");
  scope.dispose();
});
test("0.4.2b F6 scope owns dirty work guard even when its form panel unmounts", () => {
  const guard = createWorkGuard();
  const scope = createDraftScope("019a5e55-2222-7000-8000-000000000001", guard);
  const controller = scope.open({
    workflow: "fixture.intake",
    schemaVersion: 1,
    initial: { value: "private" },
  });
  expect(guard.safe()).toBe(false);
  clearOwnerState();
  expect(guard.safe()).toBe(true);
  expect(controller.snapshot().values).toEqual({});
  scope.dispose();
});

test("0.4.2b F4 resume forwards its bounded typed cursor without personal URL data", async () => {
  let captured;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      captured = new URL(
        typeof input === "string" ? input : input.url,
        "http://fixture.test",
      );
      return Response.json({ drafts: [], next: null });
    }),
  );
  const scope = createDraftScope("019a5e55-2222-7000-8000-000000000001");
  const cursor = {
    id: "019a5e55-2222-7000-8000-000000000001",
    createdAt: "2026-10-16T00:00:00.000Z",
    before: "2026-10-16T01:00:00.000Z",
  };
  await scope.list(cursor);
  expect(captured.searchParams.get("limit")).toBe("25");
  expect(JSON.parse(captured.searchParams.get("cursor"))).toEqual(cursor);
  scope.dispose();
});
