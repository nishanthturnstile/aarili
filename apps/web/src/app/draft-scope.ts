import {
  abandonDraft,
  convertDraft,
  getDraft,
  getDrafts,
  onOwnerInvalidation,
  promoteDraft,
  putDraft,
} from "@aarili/api/client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import { QueryClient } from "@tanstack/react-query";
import { v7 } from "uuid";
import { createDraftRecovery, type DraftRecovery } from "./draft-recovery";
import type { createWorkGuard } from "./pwa-runtime.js";
// Per-mounted-owner memory cache. Recreate this scope when switching shops.
export function createDraftScope(
  shopId: string,
  guard?: ReturnType<typeof createWorkGuard>,
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always", staleTime: 0, gcTime: 0 },
    },
  });
  const controllers = new Set<DraftRecovery>();
  const guardCleanup = new Map<DraftRecovery, () => void>();
  let epoch = 0;
  let active = true;
  function clear() {
    active = false;
    epoch++;
    for (const controller of controllers) controller.invalidate();
    for (const cleanup of guardCleanup.values()) cleanup();
    guardCleanup.clear();
    controllers.clear();
    void client.cancelQueries();
    client.clear();
  }
  const unsubscribe = onOwnerInvalidation(clear);
  async function query<T>(part: unknown[], run: () => Promise<T>) {
    if (!active) throw new Error("Access ended");
    const expected = epoch;
    const result = await client.fetchQuery({
      queryKey: ["shop", shopId, "drafts", epoch, ...part],
      queryFn: async () => {
        const value = await run();
        if (!active || epoch !== expected) throw new Error("Access ended");
        return value;
      },
    });
    if (!active || epoch !== expected) throw new Error("Access ended");
    return result;
  }
  return {
    list: (cursor?: DraftCursor) =>
      query(["list", cursor ?? null], () => getDrafts(shopId, 25, cursor)),
    read: (id: string) => query(["record", id], () => getDraft(shopId, id)),
    open(options: {
      workflow: string;
      schemaVersion: number;
      initial: Record<string, unknown>;
      record?: DraftRecord;
      committed?: (record: DraftRecord) => void;
    }) {
      if (!active) throw new Error("Access ended");
      const controller = createDraftRecovery({
        ...options,
        id: options.record?.id ?? v7(),
        key: v7,
        transport: {
          read: (id) => getDraft(shopId, id),
          save: (id, input, key, etag) =>
            putDraft(shopId, id, input, key, etag),
          convert: (id, key, etag, target) =>
            convertDraft(shopId, id, key, etag, target),
          promote: (id, key, etag) => promoteDraft(shopId, id, key, etag),
          abandon: (id, key, etag) => abandonDraft(shopId, id, key, etag),
        },
      });
      controllers.add(controller);
      if (guard) {
        const tracked = guard.track();
        const update = () => tracked.set(controller.snapshot().work);
        update();
        const unsubscribe = controller.subscribe(update);
        guardCleanup.set(controller, () => {
          unsubscribe();
          tracked.dispose();
        });
      }
      return controller;
    },
    release(controller: DraftRecovery) {
      guardCleanup.get(controller)?.();
      guardCleanup.delete(controller);
      controllers.delete(controller);
      controller.dispose();
    },
    dispose() {
      unsubscribe();
      clear();
    },
  };
}
