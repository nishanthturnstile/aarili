import { DraftRequestError, OwnerRequestError } from "@aarili/api/client";
import type {
  DraftRecord,
  DraftSave,
  DraftSuccess,
} from "@aarili/contracts/drafts";
import type { WorkState } from "./pwa-runtime.js";

export type DraftTransport = {
  read(id: string): Promise<DraftRecord>;
  save(
    id: string,
    input: DraftSave,
    key: string,
    etag?: string,
  ): Promise<DraftSuccess>;
  promote(id: string, key: string, etag: string): Promise<DraftSuccess>;
  convert?(id: string, key: string, etag: string): Promise<DraftSuccess>;
  abandon?(id: string, key: string, etag: string): Promise<DraftSuccess>;
};
export type DraftState = {
  id: string;
  values: Record<string, unknown>;
  committed?: DraftRecord | undefined;
  conflict?: DraftRecord | undefined;
  status:
    | "notSaved"
    | "saving"
    | "saved"
    | "checking"
    | "conflict"
    | "promoting"
    | "promoted"
    | "closed"
    | "denied";
  error?: string | undefined;
  work: WorkState;
  pendingPromotion?: boolean | undefined;
};
type Pending =
  | { kind: "save"; input: DraftSave; key: string; etag?: string }
  | { kind: "promote" | "abandon" | "convert"; key: string; etag: string };
function copy<T>(value: T): T {
  return structuredClone(value);
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(stable(a)) === JSON.stringify(stable(b));
function savedStatus(record: DraftRecord) {
  return record.lifecycle === "promoted"
    ? "promoted"
    : record.lifecycle === "abandoned"
      ? "closed"
      : "saved";
}

let nextControllerInstance = 0;

// The pending command is a private, detached snapshot. A transport rejection
// never releases its key, payload or precondition for a later edit to reuse.
export function createDraftRecovery(options: {
  id: string;
  workflow: string;
  schemaVersion: number;
  initial: Record<string, unknown>;
  record?: DraftRecord;
  transport: DraftTransport;
  key: () => string;
  committed?: (record: DraftRecord) => void;
  debounceMs?: number;
}) {
  const {
    workflow,
    schemaVersion,
    transport,
    key,
    committed: onCommitted,
    debounceMs = 1000,
  } = options;
  let state: DraftState = {
    id: options.id,
    values: copy(options.record?.payload ?? options.initial),
    ...(options.record ? { committed: copy(options.record) } : {}),
    status: options.record ? savedStatus(options.record) : "notSaved",
    work: { dirty: !options.record, inFlight: false, outcomeUnknown: false },
  };
  const listeners = new Set<() => void>();
  let pending: Pending | undefined;
  let admissionRetry: Pending | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let composition = false;
  let stopped = false;
  let epoch = 0;
  function emit(next: Partial<DraftState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }
  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    cancelTimer();
    if (
      stopped ||
      composition ||
      pending ||
      state.conflict ||
      !state.work.dirty ||
      state.status === "denied" ||
      (state.committed?.lifecycle !== undefined &&
        state.committed.lifecycle !== "active")
    )
      return;
    timer = setTimeout(() => {
      void save();
    }, debounceMs);
  }
  async function execute() {
    if (!pending || state.work.inFlight || stopped) return;
    const command = pending;
    const expected = epoch;
    emit({
      pendingPromotion: command.kind !== "save",
      error: undefined,
      status: state.work.outcomeUnknown
        ? "checking"
        : command.kind === "save"
          ? "saving"
          : "promoting",
      work: { ...state.work, inFlight: true },
    });
    try {
      const result =
        command.kind === "save"
          ? await transport.save(
              state.id,
              copy(command.input),
              command.key,
              command.etag,
            )
          : command.kind === "convert" && transport.convert
            ? await transport.convert(state.id, command.key, command.etag)
            : command.kind === "abandon" && transport.abandon
              ? await transport.abandon(state.id, command.key, command.etag)
              : await transport.promote(state.id, command.key, command.etag);
      if (stopped || expected !== epoch) return;
      pending = undefined;
      admissionRetry = undefined;
      const record = copy(result.draft);
      const dirty = !equal(state.values, record.payload);
      emit({
        committed: record,
        pendingPromotion: false,
        conflict: undefined,
        status:
          record.lifecycle !== "active"
            ? savedStatus(record)
            : dirty
              ? "notSaved"
              : "saved",
        work: { dirty, inFlight: false, outcomeUnknown: false },
      });
      try {
        onCommitted?.(copy(record));
      } catch {
        emit({ error: "DRAFT_LINK_UNAVAILABLE" });
      }
      schedule();
    } catch (error) {
      if (stopped || expected !== epoch) return;
      if (
        (error instanceof OwnerRequestError &&
          ["UNAUTHENTICATED", "SHOP_ACCESS_DENIED"].includes(error.code)) ||
        (error instanceof DraftRequestError &&
          (error.status === 401 ||
            (error.status === 403 &&
              error.body.error.code === "SHOP_ACCESS_DENIED")))
      ) {
        invalidate();
        return;
      }
      if (
        error instanceof DraftRequestError &&
        (error.body.error.code === "AUTHENTICATION_STALE" ||
          (error.status === 429 && state.work.outcomeUnknown))
      ) {
        // Admission rejected this retry before looking up the original key. It
        // cannot establish whether that original save/promotion committed.
        emit({
          status: "checking",
          error: error.body.error.code,
          work: { ...state.work, inFlight: false, outcomeUnknown: true },
        });
      } else if (error instanceof DraftRequestError && error.status < 500) {
        // Admission is known to have rejected this command. Keep its explicit
        // retry intent without claiming an unknown outcome or blocking edits.
        admissionRetry =
          error.status === 429 && command.kind !== "save" ? command : undefined;
        pending = undefined;
        const dirty =
          !state.committed || !equal(state.values, state.committed.payload);
        emit({
          pendingPromotion: false,
          status:
            error.status === 412
              ? "conflict"
              : command.kind !== "save" && !dirty
                ? "saved"
                : "notSaved",
          conflict: error.body.current ? copy(error.body.current) : undefined,
          error: error.body.error.code,
          work: {
            dirty: error.status === 412 || dirty,
            inFlight: false,
            outcomeUnknown: false,
          },
        });
      } else {
        emit({
          status: "checking",
          error: "REQUEST_FAILED",
          work: { ...state.work, inFlight: false, outcomeUnknown: true },
        });
      }
    }
  }
  async function save() {
    cancelTimer();
    if (
      stopped ||
      composition ||
      state.work.inFlight ||
      state.status === "denied" ||
      state.status === "conflict" ||
      (state.committed && state.committed.lifecycle !== "active")
    )
      return;
    if (!pending) {
      if (!state.work.dirty) return;
      pending = {
        kind: "save",
        input: {
          workflow: workflow,
          schemaVersion: schemaVersion,
          payload: copy(state.values),
        },
        key: key(),
        ...(state.committed ? { etag: `"v${state.committed.version}"` } : {}),
      };
    }
    await execute();
  }
  function invalidate() {
    epoch++;
    cancelTimer();
    pending = undefined;
    admissionRetry = undefined;
    emit({
      values: {},
      pendingPromotion: false,
      committed: undefined,
      conflict: undefined,
      error: undefined,
      status: "denied",
      work: { dirty: false, inFlight: false, outcomeUnknown: false },
    });
  }
  return {
    instance: ++nextControllerInstance,
    confirmLeave(confirm: () => boolean) {
      return (
        !(
          state.work.dirty ||
          state.work.inFlight ||
          state.work.outcomeUnknown
        ) || confirm()
      );
    },
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    edit(values: Record<string, unknown>) {
      if (
        stopped ||
        (pending && pending.kind !== "save") ||
        state.status === "denied" ||
        (state.committed && state.committed.lifecycle !== "active")
      )
        return;
      if (!equal(state.values, values)) admissionRetry = undefined;
      const dirty = !state.committed || !equal(values, state.committed.payload);
      emit({
        values: copy(values),
        status:
          !dirty &&
          state.committed &&
          !pending &&
          !state.work.inFlight &&
          state.status === "notSaved"
            ? savedStatus(state.committed)
            : state.status === "saved" && dirty
              ? "notSaved"
              : state.status,
        work: { ...state.work, dirty },
      });
      schedule();
    },
    composition(active: boolean) {
      composition = active;
      if (active) cancelTimer();
      else schedule();
    },
    save,
    async retry() {
      if (composition && admissionRetry) return;
      if (!pending && admissionRetry && !state.work.dirty) {
        pending = admissionRetry;
        admissionRetry = undefined;
      }
      if (pending) await execute();
      else await save();
    },
    async refreshConflict() {
      if (state.status !== "conflict" || state.work.inFlight || stopped) return;
      const expected = epoch;
      emit({ work: { ...state.work, inFlight: true } });
      try {
        const record = await transport.read(state.id);
        if (!stopped && expected === epoch)
          emit({
            conflict: copy(record),
            error: undefined,
            work: { ...state.work, inFlight: false },
          });
      } catch {
        if (!stopped && expected === epoch)
          emit({
            error: "DRAFT_UNAVAILABLE",
            work: { ...state.work, inFlight: false },
          });
      }
    },
    async convert() {
      cancelTimer();
      if (
        !transport.convert ||
        stopped ||
        composition ||
        pending ||
        state.work.inFlight ||
        state.work.dirty ||
        state.status !== "saved" ||
        !state.committed
      )
        return;
      admissionRetry = undefined;
      pending = {
        kind: "convert",
        key: key(),
        etag: `"v${state.committed.version}"`,
      };
      await execute();
    },
    async promote() {
      cancelTimer();
      if (
        stopped ||
        composition ||
        pending ||
        state.work.inFlight ||
        state.work.dirty ||
        state.status !== "saved" ||
        !state.committed
      )
        return;
      admissionRetry = undefined;
      pending = {
        kind: "promote",
        key: key(),
        etag: `"v${state.committed.version}"`,
      };
      await execute();
    },
    async abandon() {
      cancelTimer();
      if (
        stopped ||
        composition ||
        pending ||
        state.work.inFlight ||
        state.work.dirty ||
        state.status !== "saved" ||
        !state.committed ||
        !transport.abandon
      )
        return;
      admissionRetry = undefined;
      pending = {
        kind: "abandon",
        key: key(),
        etag: `"v${state.committed.version}"`,
      };
      emit({ pendingPromotion: true });
      await execute();
    },
    resolveConflict(choice: "server" | "local") {
      if (state.status !== "conflict" || !state.conflict) return;
      const record = state.conflict;
      if (record.lifecycle !== "active" && choice === "local") return;
      emit({
        committed: copy(record),
        conflict: undefined,
        values: choice === "server" ? copy(record.payload) : state.values,
        error: undefined,
        status: choice === "server" ? savedStatus(record) : "notSaved",
        work: {
          dirty: choice === "local",
          inFlight: false,
          outcomeUnknown: false,
        },
      });
      // Explicit user choice authorises a fresh command against this version.
      if (choice === "local") schedule();
    },
    invalidate,
    dispose() {
      stopped = true;
      epoch++;
      cancelTimer();
      pending = undefined;
      admissionRetry = undefined;
      state = {
        ...state,
        values: {},
        committed: undefined,
        conflict: undefined,
      };
      listeners.clear();
    },
  };
}
export type DraftRecovery = ReturnType<typeof createDraftRecovery>;
