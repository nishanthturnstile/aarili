import {
  clearOwnerState,
  OwnerRequestError,
  onOwnerInvalidation,
  readGoogleConnection,
  readOwnerEntry,
  readOwnerShop,
} from "@aarili/api/client";
import { QueryClient } from "@tanstack/react-query";

// One client per mounted owner surface, never a server/global cache. The access
// epoch distinguishes identities even when a later session uses the same shop.
export function createOwnerQueries() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  let epoch = 0;
  let shopId: string | undefined;
  const requests = new Set<AbortController>();
  const listeners = new Set<() => void>();
  function clear(notify = true) {
    epoch++;
    shopId = undefined;
    for (const request of requests) request.abort();
    requests.clear();
    void client.cancelQueries();
    client.clear();
    if (notify) for (const listener of listeners) listener();
  }
  function guard(expected: number) {
    if (expected !== epoch) throw new OwnerRequestError("UNAUTHENTICATED");
  }
  function key(part: "shop" | "connection") {
    if (!shopId) throw new OwnerRequestError("SHOP_ACCESS_DENIED");
    return ["shop", shopId, "owner-access", epoch, part] as const;
  }
  async function shop() {
    const expected = epoch;
    const request = new AbortController();
    requests.add(request);
    try {
      // Resolve authorised shop identity before any tenant cache lookup. The
      // bootstrap itself is not cached under a guessed/client-supplied shop.
      const result = await readOwnerShop(request.signal);
      guard(expected);
      const next = result.state === "complete" ? result.shopId : undefined;
      if (shopId && next !== shopId) clearOwnerState();
      shopId = next;
      if (next) client.setQueryData(key("shop"), result);
      return result;
    } finally {
      requests.delete(request);
    }
  }
  return {
    client,
    version: () => epoch,
    isCurrent: (expected: number) => epoch === expected,
    connect() {
      const unsubscribe = onOwnerInvalidation(clear);
      return () => {
        unsubscribe();
        clear(false);
      };
    },
    onInvalidate(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    shop,
    async entry() {
      const expected = epoch;
      const request = new AbortController();
      requests.add(request);
      try {
        const result = await readOwnerEntry(request.signal);
        guard(expected);
        const next = result.state === "ready" ? result.shop.shopId : undefined;
        if (shopId && next !== shopId) clearOwnerState();
        shopId = next;
        if (result.state === "ready")
          client.setQueryData(key("shop"), {
            state: "complete",
            ...result.shop,
          });
        return result;
      } finally {
        requests.delete(request);
      }
    },
    async connection() {
      const expected = epoch;
      const result = await client.fetchQuery({
        queryKey: key("connection"),
        queryFn: async ({ signal }) => {
          guard(expected);
          const result = await readGoogleConnection(signal);
          guard(expected);
          return result;
        },
      });
      guard(expected);
      return result;
    },
    async workspace() {
      const current = await shop();
      if (current.state !== "complete")
        throw new OwnerRequestError("SHOP_ACCESS_DENIED");
      const expected = epoch;
      const connection = await client.fetchQuery({
        queryKey: key("connection"),
        queryFn: async ({ signal }) => {
          guard(expected);
          const result = await readGoogleConnection(signal);
          guard(expected);
          return result;
        },
      });
      guard(expected);
      return { shop: current, connection };
    },
  };
}
