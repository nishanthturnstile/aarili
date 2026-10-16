import { DraftRequestError } from "@aarili/api/client";
import type { DraftRecord, DraftSave } from "@aarili/contracts/drafts";
import { afterEach, expect, test, vi } from "vitest";
import { createDraftRecovery } from "../apps/web/src/app/draft-recovery.js";
import { createWorkGuard } from "../apps/web/src/app/pwa-runtime.js";

const id = "019a5e55-2222-7000-8000-000000000001";
function record(payload: Record<string, unknown>, version = 1): DraftRecord {
  return {
    id,
    workflow: "fixture.intake",
    schemaVersion: 1,
    payload,
    version,
    creatorId: id,
    lifecycle: "active",
    createdAt: "2026-10-16T00:00:00.000Z",
    updatedAt: "2026-10-16T00:00:00.000Z",
    stale: false,
    result: null,
  };
}
function fixture() {
  let key = 0;
  const save = vi.fn(
    async (_id: string, input: DraftSave, _key: string, _etag?: string) => ({
      draft: record(input.payload),
    }),
  );
  const promote = vi.fn(async () => ({
    draft: { ...record({ value: "a" }), lifecycle: "promoted" as const },
  }));
  const committed = vi.fn();
  const controller = createDraftRecovery({
    id,
    workflow: "fixture.intake",
    schemaVersion: 1,
    initial: { value: "" },
    key: () => `key-${++key}`,
    transport: {
      save,
      promote,
      read: async () => record({ value: "other" }, 2),
    },
    committed,
  });
  return { controller, save, promote, committed };
}
afterEach(() => vi.useRealTimers());
test("0.4.2b F6 caller navigation seam confirms dirty work and permits acknowledged work", async () => {
  const { controller } = fixture();
  const confirm = vi.fn(() => false);
  expect(controller.confirmLeave(confirm)).toBe(false);
  expect(confirm).toHaveBeenCalledOnce();
  await controller.save();
  confirm.mockClear();
  expect(controller.confirmLeave(confirm)).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  controller.dispose();
});
test("0.4.2b F5 an abandoned server draft stays visibly closed and cannot accept ignored edits", async () => {
  const closed = {
    ...record({ value: "closed" }),
    lifecycle: "abandoned" as const,
  };
  const mutate = vi.fn(async () => ({ draft: closed }));
  const controller = createDraftRecovery({
    id,
    workflow: "fixture.intake",
    schemaVersion: 1,
    initial: {},
    record: closed,
    key: () => "unused",
    transport: { save: mutate, promote: mutate, read: async () => closed },
  });
  expect(controller.snapshot().status).toBe("closed");
  controller.edit({ value: "ignored" });
  await controller.save();
  await controller.promote();
  expect(mutate).not.toHaveBeenCalled();
  expect(controller.snapshot().values).toEqual({ value: "closed" });
  controller.dispose();
});
test("0.4.2b F3 PostgreSQL JSONB key ordering cannot turn acknowledged input dirty", async () => {
  const { controller, save } = fixture();
  controller.edit({ value: "a", amountRaw: "", measurementRaw: "" });
  save.mockResolvedValueOnce({
    draft: record({ measurementRaw: "", amountRaw: "", value: "a" }),
  });
  await controller.save();
  expect(controller.snapshot().status).toBe("saved");
  expect(controller.snapshot().work.dirty).toBe(false);
  controller.dispose();
});
test("0.4.2b F4 stale response without current has explicit reload/review recovery", async () => {
  const { controller, save } = fixture();
  save.mockRejectedValueOnce(
    new DraftRequestError(
      412,
      { error: { code: "VERSION_STALE", message: "Stale version" } },
      null,
    ),
  );
  controller.edit({ value: "private input" });
  await controller.save();
  expect(controller.snapshot().status).toBe("conflict");
  expect(controller.snapshot().conflict).toBeUndefined();
  await controller.refreshConflict();
  expect(controller.snapshot().values).toEqual({ value: "private input" });
  expect(controller.snapshot().conflict?.version).toBe(2);
  controller.resolveConflict("server");
  expect(controller.snapshot().values).toEqual({ value: "other" });
  controller.dispose();
});
test("0.4.2b F5 rejected promotion keeps acknowledged values Saved and a deliberate new attempt gets a new key", async () => {
  const { controller, promote, save } = fixture();
  controller.edit({ value: "a" });
  await controller.save();
  promote.mockRejectedValueOnce(
    new DraftRequestError(
      409,
      {
        error: {
          code: "REQUEST_CONFLICT",
          message: "Current authority denied",
        },
      },
      null,
    ),
  );
  await controller.promote();
  expect(controller.snapshot().status).toBe("saved");
  expect(controller.snapshot().work.dirty).toBe(false);
  expect(controller.snapshot().error).toBe("REQUEST_CONFLICT");
  await controller.retry();
  expect(save).toHaveBeenCalledOnce();
  await controller.promote();
  expect(promote.mock.calls[0]).not.toEqual(promote.mock.calls[1]);
  controller.dispose();
});
test("0.4.2b F6 explicit shop access loss clears committed and unsaved personal values", async () => {
  const { controller, save } = fixture();
  controller.edit({ value: "committed private" });
  await controller.save();
  controller.edit({ value: "local private" });
  save.mockRejectedValueOnce(
    new DraftRequestError(
      403,
      { error: { code: "SHOP_ACCESS_DENIED", message: "Access ended" } },
      null,
    ),
  );
  await controller.save();
  expect(controller.snapshot().status).toBe("denied");
  expect(controller.snapshot().values).toEqual({});
  expect(controller.snapshot().committed).toBeUndefined();
  controller.dispose();
});
test("0.4.2b F1 USE-03 Tamil composition defers the one-second autosave", async () => {
  vi.useFakeTimers();
  const { controller, save } = fixture();
  controller.composition(true);
  controller.edit({ value: "தமிழ்" });
  await vi.advanceTimersByTimeAsync(3000);
  expect(save).not.toHaveBeenCalled();
  controller.composition(false);
  await vi.advanceTimersByTimeAsync(999);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledOnce();
  expect(controller.snapshot().status).toBe("saved");
  controller.dispose();
});
test("0.4.2b F2/F3 lost response replays exact key/payload/version before queued edits", async () => {
  vi.useFakeTimers();
  const { controller, save, committed } = fixture();
  save.mockRejectedValueOnce(new TypeError("lost after commit"));
  controller.edit({ value: "first" });
  await controller.save();
  expect(controller.snapshot().status).toBe("checking");
  expect(committed).not.toHaveBeenCalled();
  controller.edit({ value: "later" });
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).toHaveBeenCalledOnce();
  await controller.retry();
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  expect(controller.snapshot().status).toBe("notSaved");
  expect(controller.snapshot().values).toEqual({ value: "later" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(save.mock.calls[2]?.[1].payload).toEqual({ value: "later" });
  expect(save.mock.calls[2]?.[2]).toBe("key-2");
  expect(save.mock.calls[2]?.[3]).toBe('"v1"');
  controller.dispose();
});
test("0.4.2b F2/F3 one save in flight and late acknowledgement cannot label new input Saved", async () => {
  const { controller, save } = fixture();
  let resolve!: (value: { draft: DraftRecord }) => void;
  save.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  controller.edit({ value: "first" });
  const pending = controller.save();
  controller.edit({ value: "next" });
  await controller.save();
  expect(save).toHaveBeenCalledOnce();
  resolve({ draft: record({ value: "first" }) });
  await pending;
  expect(controller.snapshot().status).toBe("notSaved");
  expect(controller.snapshot().committed?.payload).toEqual({ value: "first" });
  controller.dispose();
});
test("0.4.2b F4 AC-55 stale response preserves input until explicit reviewed conflict choice", async () => {
  const { controller, save } = fixture();
  const current = record({ value: "other device" }, 3);
  save.mockRejectedValueOnce(
    new DraftRequestError(
      412,
      { error: { code: "VERSION_STALE", message: "Stale version" }, current },
      '"v3"',
    ),
  );
  controller.edit({ value: "mine" });
  await controller.save();
  expect(controller.snapshot().status).toBe("conflict");
  expect(controller.snapshot().values).toEqual({ value: "mine" });
  await controller.retry();
  expect(save).toHaveBeenCalledOnce();
  controller.resolveConflict("local");
  await controller.save();
  expect(save.mock.calls[1]?.[3]).toBe('"v3"');
  expect(save.mock.calls[1]?.[2]).toBe("key-2");
  controller.dispose();
});
test("0.4.2b F5 promotion waits for acknowledged current values and uncertain promotion keeps its key", async () => {
  const { controller, promote } = fixture();
  controller.edit({ value: "a" });
  await controller.promote();
  expect(promote).not.toHaveBeenCalled();
  await controller.save();
  promote.mockRejectedValueOnce(new TypeError("lost promotion"));
  await controller.promote();
  expect(controller.snapshot().status).toBe("checking");
  controller.edit({ value: "cannot edit pending promotion" });
  expect(controller.snapshot().values).toEqual({ value: "a" });
  await controller.promote();
  expect(promote).toHaveBeenCalledOnce();
  await controller.retry();
  expect(promote.mock.calls[0]).toEqual(promote.mock.calls[1]);
  expect(controller.snapshot().status).toBe("promoted");
  controller.dispose();
});
test("0.4.2b F6 auth loss clears personal input and rejects late result; PWA guard remains unsafe during unknown outcome", async () => {
  const { controller, save } = fixture();
  const guard = createWorkGuard();
  const tracked = guard.track();
  const stop = controller.subscribe(() =>
    tracked.set(controller.snapshot().work),
  );
  let resolve!: (value: { draft: DraftRecord }) => void;
  save.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  controller.edit({ value: "private" });
  const pending = controller.save();
  expect(guard.safe()).toBe(false);
  controller.invalidate();
  resolve({ draft: record({ value: "private" }) });
  await pending;
  expect(controller.snapshot().values).toEqual({});
  expect(controller.snapshot().committed).toBeUndefined();
  expect(guard.safe()).toBe(true);
  stop();
  tracked.dispose();
  controller.dispose();
});

test("0.4.2b F3 optional navigation callback failure cannot change an acknowledged outcome", async () => {
  const { controller, committed, save } = fixture();
  committed.mockImplementationOnce(() => {
    throw Error("History unavailable");
  });
  await controller.save();
  expect(controller.snapshot().status).toBe("saved");
  expect(controller.snapshot().work.outcomeUnknown).toBe(false);
  expect(controller.snapshot().error).toBe("DRAFT_LINK_UNAVAILABLE");
  await controller.retry();
  expect(save).toHaveBeenCalledOnce();
  controller.dispose();
});
test("0.4.2b F6 separate controllers for the same draft have distinct form lifetimes", () => {
  const first = fixture();
  const second = fixture();
  expect(first.controller.snapshot().id).toBe(second.controller.snapshot().id);
  expect(first.controller.instance).not.toBe(second.controller.instance);
  first.controller.dispose();
  second.controller.dispose();
});
