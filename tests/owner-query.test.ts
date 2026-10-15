import { clearOwnerState, readOwnerShop } from "@aarili/api/client";
import { afterEach, expect, test, vi } from "vitest";
import { createOwnerQueries } from "../apps/web/src/app/owner-query.js";

const firstShop = "019b5555-0000-7000-8000-000000000001";
const secondShop = "019b5555-0000-7000-8000-000000000002";
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function profile(shopId = firstShop) {
  return Response.json({ state: "complete", shopId, name: "Synthetic shop" });
}
afterEach(() => {
  clearOwnerState();
  vi.unstubAllGlobals();
});

test("0.4.1a A4 TRU-01 Query cache is shop/access-scoped and clears on identity invalidation", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    String(url).endsWith("/shop")
      ? profile()
      : Response.json({ enabled: false, linked: false }),
  );
  const scope = createOwnerQueries();
  const disconnect = scope.connect();
  try {
    await scope.workspace();
    const keys = scope.client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(keys).toHaveLength(2);
    expect(
      keys.every(
        (key) =>
          key[0] === "shop" &&
          key[1] === firstShop &&
          key[2] === "owner-access",
      ),
    ).toBe(true);
    const version = scope.version();
    const invalidate = vi.fn();
    const unsubscribe = scope.onInvalidate(invalidate);
    clearOwnerState();
    expect(scope.client.getQueryCache().getAll()).toHaveLength(0);
    expect(scope.isCurrent(version)).toBe(false);
    expect(invalidate).toHaveBeenCalledOnce();
    unsubscribe();
    await scope.workspace();
    expect(
      scope.client
        .getQueryCache()
        .getAll()
        .every((q) => q.queryKey[3] !== version),
    ).toBe(true);
  } finally {
    disconnect();
  }
});

test("0.4.1a A4 USE-08 logout aborts Query reads and ignored cancellation cannot refill private state", async () => {
  const late = deferred<Response>();
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (String(url).endsWith("/shop")) return profile();
    signal = init.signal ?? undefined;
    return late.promise;
  });
  const scope = createOwnerQueries();
  const disconnect = scope.connect();
  try {
    const pending = scope.workspace();
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(signal).toBeDefined());
    clearOwnerState();
    expect(signal?.aborted).toBe(true);
    late.resolve(Response.json({ enabled: true, linked: true }));
    await rejected;
    await Promise.resolve();
    expect(scope.client.getQueryCache().getAll()).toHaveLength(0);
  } finally {
    disconnect();
  }
});

test("0.4.1a A4 TRU-01 authoritative shop change cancels the old shop and retains only the new scope", async () => {
  const late = deferred<Response>();
  let selectedShop = firstShop;
  let started = false;
  vi.stubGlobal("fetch", async (url: string) => {
    if (String(url).endsWith("/shop")) return profile(selectedShop);
    started = true;
    return late.promise;
  });
  const scope = createOwnerQueries();
  const disconnect = scope.connect();
  try {
    const old = scope.workspace();
    const rejected = expect(old).rejects.toThrow();
    await vi.waitFor(() => expect(started).toBe(true));
    selectedShop = secondShop;
    await scope.shop();
    late.resolve(Response.json({ enabled: true, linked: true }));
    await rejected;
    const queries = scope.client.getQueryCache().getAll();
    expect(queries).toHaveLength(1);
    expect(queries[0]?.queryKey[1]).toBe(secondShop);
    expect(JSON.stringify(queries.map((q) => q.state.data))).not.toContain(
      firstShop,
    );
  } finally {
    disconnect();
  }
});

test("0.4.1a A4/A5 unmount aborts uncached bootstrap and caller signal reaches the typed transport", async () => {
  const late = deferred<Response>();
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    signal = init.signal ?? undefined;
    return late.promise;
  });
  const scope = createOwnerQueries();
  const disconnect = scope.connect();
  const pending = scope.shop();
  const rejected = expect(pending).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  disconnect();
  expect(signal?.aborted).toBe(true);
  late.resolve(profile());
  await rejected;
  expect(scope.client.getQueryCache().getAll()).toHaveLength(0);
});

test("0.4.1a A4/A5 membership denial clears cache but an unrelated permission denial does not end the session", async () => {
  vi.stubGlobal("fetch", async () => profile());
  const scope = createOwnerQueries();
  const disconnect = scope.connect();
  try {
    await scope.shop();
    vi.stubGlobal("fetch", async () =>
      Response.json(
        { error: { code: "GOOGLE_DENIED", message: "Denied" } },
        { status: 403 },
      ),
    );
    await expect(readOwnerShop()).rejects.toMatchObject({
      code: "GOOGLE_DENIED",
    });
    expect(scope.client.getQueryCache().getAll()).toHaveLength(1);
    vi.stubGlobal("fetch", async () =>
      Response.json(
        { error: { code: "SHOP_ACCESS_DENIED", message: "Denied" } },
        { status: 403 },
      ),
    );
    await expect(readOwnerShop()).rejects.toMatchObject({
      code: "SHOP_ACCESS_DENIED",
    });
    expect(scope.client.getQueryCache().getAll()).toHaveLength(0);
  } finally {
    disconnect();
  }
});
