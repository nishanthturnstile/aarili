import { DraftRequestError, reauthenticateOwner } from "@aarili/api/client";
import type { DraftRecord, DraftSave } from "@aarili/contracts/drafts";
import { afterEach, expect, test, vi } from "vitest";
import { createDraftRecovery } from "../apps/web/src/app/draft-recovery.js";
import { createWorkGuard } from "../apps/web/src/app/pwa-runtime.js";

const id = "019a5e55-2222-7000-8000-000000000001";

test("QO-04/05 abandonment freezes its exact envelope across lost response and blocks edits/double clicks", async () => {
  let count = 0;
  const initial = record({ instructions: "செயற்கை" });
  const abandon = vi.fn(async (_id: string, _key: string, _etag: string) => {
    if (++count === 1) throw Error("Lost response after commit");
    return {
      draft: { ...initial, version: 2, lifecycle: "abandoned" as const },
    };
  });
  const promote = vi.fn();
  const controller = createDraftRecovery({
    id,
    workflow: initial.workflow,
    schemaVersion: 1,
    initial: initial.payload,
    record: initial,
    key: () => "frozen-abandon-key",
    transport: { save: vi.fn(), promote, abandon, read: async () => initial },
  });
  await controller.abandon();
  expect(controller.snapshot().pendingPromotion).toBe(true);
  expect(controller.snapshot().status).toBe("checking");
  controller.edit({ instructions: "must not replace uncertain command" });
  expect(controller.snapshot().values).toEqual(initial.payload);
  await controller.abandon();
  expect(abandon).toHaveBeenCalledTimes(1);
  await controller.retry();
  expect(abandon.mock.calls).toEqual([
    [id, "frozen-abandon-key", '"v1"'],
    [id, "frozen-abandon-key", '"v1"'],
  ]);
  expect(controller.snapshot().status).toBe("closed");
  expect(promote).not.toHaveBeenCalled();
  controller.dispose();
});
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
test("SS-B D6 uncertain service conversion freezes the explicit target across retries and blocks duplicate conversions", async () => {
  const initial = record({ instructions: "exact raw intake" });
  let tries = 0;
  const convert = vi.fn(
    async (_id: string, _key: string, _etag: string, _target?: "services") => {
      if (++tries === 1) throw Error("Lost committed response");
      return {
        draft: {
          ...initial,
          version: 2,
          lifecycle: "promoted" as const,
          result: { type: "order.services-intake-draft", id },
        },
      };
    },
  );
  const controller = createDraftRecovery({
    id,
    workflow: initial.workflow,
    schemaVersion: 1,
    initial: initial.payload,
    record: initial,
    key: () => "service-conversion-key",
    transport: {
      read: async () => initial,
      save: vi.fn(),
      promote: vi.fn(),
      convert,
    },
  });
  await controller.convert("services");
  await controller.convert();
  controller.edit({ instructions: "must not replace frozen input" });
  expect(convert).toHaveBeenCalledOnce();
  expect(controller.snapshot().values).toEqual(initial.payload);
  await controller.retry();
  expect(convert.mock.calls).toEqual([
    [id, "service-conversion-key", '"v1"', "services"],
    [id, "service-conversion-key", '"v1"', "services"],
  ]);
  expect(controller.snapshot().committed?.result?.type).toBe(
    "order.services-intake-draft",
  );
  controller.dispose();
});
function fixture(editableTargetConflict = false) {
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
    editableTargetConflict,
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
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("SS-10 undo to acknowledged draft restores saved state without a redundant command", async () => {
  const { controller, save, promote } = fixture();
  controller.edit({ value: "a" });
  await controller.save();
  controller.composition(true);
  controller.edit({ value: "temporary" });
  controller.edit({ value: "a" });
  controller.composition(false);
  expect(controller.snapshot().work.dirty).toBe(false);
  expect(controller.snapshot().status).toBe("saved");
  await controller.save();
  expect(save).toHaveBeenCalledOnce();
  await controller.promote();
  expect(promote).toHaveBeenCalledOnce();
  controller.dispose();
});
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
test("ST-06 AC-55 stale preference promotion stays locked until explicit comparison", async () => {
  const { controller, promote } = fixture();
  controller.edit({ value: "exact preference", baseVersion: 1 });
  await controller.save();
  promote.mockRejectedValueOnce(
    new DraftRequestError(
      412,
      { error: { code: "VERSION_STALE", message: "Preference changed" } },
      null,
    ),
  );
  await controller.promote();
  expect(controller.snapshot().status).toBe("conflict");
  expect(controller.snapshot().values).toEqual({
    value: "exact preference",
    baseVersion: 1,
  });
  await controller.promote();
  expect(promote).toHaveBeenCalledOnce();
  await controller.refreshConflict();
  expect(controller.snapshot().conflict?.version).toBe(2);
  controller.dispose();
});

test("SS-B AC-55 editable target policy still locks a competing draft revision", async () => {
  const { controller, promote } = fixture(true);
  controller.edit({ value: "exact added work", targetVersion: 1 });
  await controller.save();
  const current = record({ value: "other saved draft" }, 3);
  promote.mockRejectedValueOnce(
    new DraftRequestError(
      412,
      { error: { code: "VERSION_STALE", message: "Draft changed" }, current },
      '"v3"',
    ),
  );
  await controller.promote();
  expect(controller.snapshot().status).toBe("conflict");
  expect(controller.snapshot().values).toEqual({
    value: "exact added work",
    targetVersion: 1,
  });
  await controller.promote();
  expect(promote).toHaveBeenCalledOnce();
  expect(controller.snapshot().conflict).toEqual(current);
  controller.dispose();
});

test("SS-B AC-55 stale target promotion keeps its current saved draft editable without merging a competing draft", async () => {
  const { controller, save, promote } = fixture(true);
  controller.edit({ value: "exact added work", targetVersion: 1 });
  await controller.save();
  promote.mockRejectedValueOnce(
    new DraftRequestError(
      412,
      { error: { code: "VERSION_STALE", message: "Target order changed" } },
      null,
    ),
  );
  await controller.promote();
  expect(controller.snapshot().status).toBe("saved");
  expect(controller.snapshot().values).toEqual({
    value: "exact added work",
    targetVersion: 1,
  });
  expect(controller.snapshot().work).toMatchObject({
    dirty: false,
    inFlight: false,
    outcomeUnknown: false,
  });
  controller.edit({
    value: "exact added work",
    targetVersion: 2,
    review: null,
  });
  await controller.save();
  expect(save).toHaveBeenCalledTimes(2);
  expect(promote).toHaveBeenCalledOnce();
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
test("CW-13 a throttled retry cannot discard an unknown save key, payload or precondition", async () => {
  vi.useFakeTimers();
  const { controller, save } = fixture();
  controller.edit({ value: "a" });
  await controller.save();
  save.mockRejectedValueOnce(new TypeError("lost after commit"));
  save.mockRejectedValueOnce(
    new DraftRequestError(
      429,
      { error: { code: "RATE_LIMITED", message: "Wait before trying again" } },
      null,
    ),
  );
  save.mockResolvedValueOnce({ draft: record({ value: "first" }, 2) });
  controller.edit({ value: "first" });
  await controller.save();
  controller.edit({ value: "later" });
  await controller.retry();
  expect(controller.snapshot()).toMatchObject({
    status: "checking",
    error: "RATE_LIMITED",
    work: { dirty: true, inFlight: false, outcomeUnknown: true },
  });
  expect(save.mock.calls[2]).toEqual(save.mock.calls[1]);
  expect(save.mock.calls[2]?.[3]).toBe('"v1"');
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).toHaveBeenCalledTimes(3);
  await controller.retry();
  expect(save.mock.calls[3]).toEqual(save.mock.calls[1]);
  expect(controller.snapshot().committed?.payload).toEqual({ value: "first" });
  expect(controller.snapshot().values).toEqual({ value: "later" });
  expect(controller.snapshot().work.outcomeUnknown).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(save.mock.calls[4]?.[1].payload).toEqual({ value: "later" });
  expect(save.mock.calls[4]?.[2]).toBe("key-3");
  expect(save.mock.calls[4]?.[3]).toBe('"v2"');
  controller.dispose();
});
test("CW-13 an unknown promotion stays locked across admission throttling and replays the same promotion", async () => {
  const { controller, promote } = fixture();
  controller.edit({ value: "a" });
  await controller.save();
  promote.mockRejectedValueOnce(new TypeError("lost promotion response"));
  promote.mockRejectedValueOnce(
    new DraftRequestError(
      429,
      { error: { code: "RATE_LIMITED", message: "Wait before trying again" } },
      null,
    ),
  );
  await controller.promote();
  await controller.retry();
  expect(controller.snapshot()).toMatchObject({
    status: "checking",
    pendingPromotion: true,
    work: { dirty: false, inFlight: false, outcomeUnknown: true },
  });
  controller.edit({ value: "must not replace the pending promotion" });
  expect(controller.snapshot().values).toEqual({ value: "a" });
  expect(promote.mock.calls[1]).toEqual(promote.mock.calls[0]);
  await controller.retry();
  expect(promote.mock.calls[2]).toEqual(promote.mock.calls[0]);
  expect(controller.snapshot()).toMatchObject({
    status: "promoted",
    pendingPromotion: false,
    work: { dirty: false, inFlight: false, outcomeUnknown: false },
  });
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
test("SS-03 recent-auth pause retains original promotion key after response loss and clears on invalidation", async () => {
  const { controller, promote } = fixture();
  controller.edit({ value: "a" });
  await controller.save();
  promote.mockRejectedValueOnce(new TypeError("lost response"));
  await controller.promote();
  promote.mockRejectedValueOnce(
    new DraftRequestError(
      403,
      { error: { code: "AUTHENTICATION_STALE", message: "Confirm identity" } },
      null,
    ),
  );
  await controller.retry();
  expect(controller.snapshot().status).toBe("checking");
  expect(controller.snapshot().pendingPromotion).toBe(true);
  expect(controller.snapshot().work.outcomeUnknown).toBe(true);
  controller.edit({ value: "blocked while paused" });
  expect(controller.snapshot().values).toEqual({ value: "a" });
  vi.stubGlobal("fetch", async () =>
    Response.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Denied" } },
      { status: 401 },
    ),
  );
  await expect(
    reauthenticateOwner("synthetic-password", true),
  ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  expect(controller.snapshot().pendingPromotion).toBe(true);
  expect(controller.snapshot().values).toEqual({ value: "a" });
  expect(promote).toHaveBeenCalledTimes(2);
  vi.stubGlobal("fetch", async () =>
    Response.json({ state: "reauthenticated" }),
  );
  await reauthenticateOwner("synthetic-password", true);
  await controller.retry();
  expect(promote.mock.calls[0]).toEqual(promote.mock.calls[1]);
  expect(promote.mock.calls[1]).toEqual(promote.mock.calls[2]);
  expect(controller.snapshot().status).toBe("promoted");
  controller.invalidate();
  expect(controller.snapshot().values).toEqual({});
  controller.dispose();
  vi.unstubAllGlobals();
});
