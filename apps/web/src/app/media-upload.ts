import {
  completeMediaUpload,
  MediaRequestError,
  onOwnerInvalidation,
  requestMediaStatus,
  requestMediaUpload,
} from "@aarili/api/client";
import type {
  MediaPurpose,
  MediaRecord,
  MediaType,
  MediaUpload,
} from "@aarili/contracts/media";
import { v7 } from "uuid";
import { PhotoPreparationError, preparePrivateFile } from "./media-photo";
import type { createWorkGuard } from "./pwa-runtime";
export type UploadState =
  | "empty"
  | "preparing"
  | "selected"
  | "uploading"
  | "processing"
  | "ready"
  | "rejected"
  | "failed"
  | "uncertain"
  | "accessEnded";
export type UploadSnapshot = {
  state: UploadState;
  error: string | null;
  asset: MediaRecord | null;
  bytes: number | null;
  processingState: string | null;
  busy: boolean;
};
// Own this controller in the verified owner/shop scope and dispose on shop
// switch/unmount. Values, file bytes and signed capabilities stay in page memory.
export function createPrivateUpload(options: {
  shopId: string;
  subjectId: string;
  purpose: MediaPurpose;
  guard?: ReturnType<typeof createWorkGuard>;
}) {
  let epoch = 0,
    active = true,
    pending: Blob | null = null,
    grant: MediaUpload | null = null,
    admissionKey: string | null = null,
    completionKey: string | null = null,
    uploaded = false;
  let state: UploadSnapshot = {
    state: "empty",
    error: null,
    asset: null,
    bytes: null,
    processingState: null,
    busy: false,
  };
  const listeners = new Set<() => void>(),
    requests = new Set<AbortController>();
  const tracked = options.guard?.track();
  const emit = (next: Partial<UploadSnapshot>) => {
    state = { ...state, ...next };
    tracked?.set({
      dirty: state.state === "selected",
      inFlight: state.busy,
      outcomeUnknown: state.state === "uncertain",
    });
    for (const listener of listeners) listener();
  };
  const current = (expected: number) => active && epoch === expected;
  const clear = () => {
    epoch++;
    active = false;
    pending = null;
    grant = null;
    admissionKey = null;
    completionKey = null;
    uploaded = false;
    for (const request of requests) request.abort();
    requests.clear();
    emit({
      state: "accessEnded",
      error: null,
      asset: null,
      bytes: null,
      processingState: null,
      busy: false,
    });
  };
  const unsubscribe = onOwnerInvalidation(clear);
  async function refresh() {
    if (!active || !state.asset || state.busy) return;
    const expected = epoch,
      id = state.asset.id;
    emit({ busy: true });
    try {
      const result = await requestMediaStatus(options.shopId, id);
      if (!current(expected)) return;
      const status = result.asset.status;
      emit({
        asset: result.asset,
        state:
          status === "ready"
            ? "ready"
            : status === "quarantined"
              ? "rejected"
              : ["failed", "unavailable"].includes(
                    result.processingState ?? "",
                  ) || ["expired", "deleted"].includes(status)
                ? "failed"
                : "processing",
        processingState: result.processingState,
        error: null,
      });
      if (status === "ready" || status === "quarantined") {
        pending = null;
        grant = null;
      }
    } catch {
      if (current(expected)) emit({ error: "STATUS_UNAVAILABLE" });
    } finally {
      if (current(expected)) emit({ busy: false });
    }
  }
  return {
    scopeKey: v7(),
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async select(file: File) {
      if (!active || state.busy) return;
      const expected = ++epoch;
      pending = null;
      grant = null;
      admissionKey = null;
      completionKey = null;
      uploaded = false;
      emit({
        state: "preparing",
        error: null,
        asset: null,
        bytes: null,
        busy: true,
        processingState: null,
      });
      try {
        const prepared = await preparePrivateFile(file);
        if (!current(expected)) return;
        pending = prepared;
        admissionKey = v7();
        completionKey = v7();
        emit({ state: "selected", bytes: prepared.size });
      } catch (error) {
        if (current(expected))
          emit({
            state: "failed",
            error:
              error instanceof PhotoPreparationError
                ? error.code
                : "PREPARATION_FAILED",
          });
      } finally {
        if (current(expected)) emit({ busy: false });
      }
    },
    async upload() {
      if (
        !active ||
        state.busy ||
        !pending ||
        !admissionKey ||
        !completionKey ||
        state.state === "ready" ||
        state.state === "rejected"
      )
        return;
      const expected = epoch;
      emit({ state: "uploading", busy: true, error: null });
      try {
        if (!grant) {
          const result = await requestMediaUpload(
            options.shopId,
            {
              subjectId: options.subjectId,
              purpose: options.purpose,
              contentType: pending.type as MediaType,
              size: pending.size,
            },
            admissionKey,
          );
          if (!current(expected)) return;
          grant = result;
          emit({ asset: grant.asset });
        }
        if (!uploaded) {
          if (Date.parse(grant.upload.expiresAt) <= Date.now())
            throw new Error("UPLOAD_CLOSED");
          const request = new AbortController();
          requests.add(request);
          try {
            const response = await fetch(grant.upload.url, {
              method: "PUT",
              headers: grant.upload.headers,
              body: pending,
              signal: request.signal,
              credentials: "omit",
              cache: "no-store",
              redirect: "error",
            });
            if (!response.ok) throw Error("UPLOAD_FAILED");
            await response.arrayBuffer();
          } finally {
            requests.delete(request);
          }
          if (!current(expected)) return;
          uploaded = true;
        }
        const result = await completeMediaUpload(
          options.shopId,
          grant.asset.id,
          completionKey,
          `"v${grant.asset.version}"`,
        );
        if (!current(expected)) return;
        // Completion acknowledges queued processing; only a later authorized
        // ready status can claim acceptance. Retry retains exact mutation keys.
        pending = null;
        grant = null;
        emit({
          state: "processing",
          asset: result.asset,
          processingState: "queued",
        });
      } catch (error) {
        const rejected =
          error instanceof MediaRequestError &&
          error.status >= 400 &&
          error.status < 500;
        if (rejected) {
          pending = null;
          grant = null;
        }
        if (current(expected))
          emit({
            state:
              rejected ||
              (error instanceof Error && error.message === "UPLOAD_CLOSED")
                ? "failed"
                : "uncertain",
            error: rejected
              ? "REQUEST_REJECTED"
              : error instanceof Error && error.message === "UPLOAD_CLOSED"
                ? "UPLOAD_CLOSED"
                : "UPLOAD_UNCERTAIN",
          });
      } finally {
        if (current(expected)) emit({ busy: false });
      }
    },
    refresh,
    discard() {
      if (!active || state.busy || state.state === "uncertain") return;
      epoch++;
      pending = null;
      grant = null;
      admissionKey = null;
      completionKey = null;
      uploaded = false;
      // Abandon only this page's selection. Never delete an asset or undo a
      // queued/accepted upload; ordinary unreferenced retention owns cleanup.
      emit({
        state: "empty",
        error: null,
        asset: null,
        bytes: null,
        processingState: null,
        busy: false,
      });
    },
    dispose() {
      unsubscribe();
      clear();
      tracked?.dispose();
      listeners.clear();
    },
  };
}
export type PrivateUpload = ReturnType<typeof createPrivateUpload>;
