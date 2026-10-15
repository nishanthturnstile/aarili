// No values, request bodies or identifiers enter storage or worker messages.
export type WorkState = {
  dirty: boolean;
  inFlight: boolean;
  outcomeUnknown: boolean;
};
export function createWorkGuard() {
  const states = new Map<symbol, WorkState>();
  const listeners = new Set<() => void>();
  const safe = () =>
    ![...states.values()].some(
      (state) => state.dirty || state.inFlight || state.outcomeUnknown,
    );
  return {
    safe,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    track() {
      const id = Symbol();
      return {
        set(state: WorkState) {
          states.set(id, state);
          for (const listener of listeners) listener();
        },
        dispose() {
          states.delete(id);
          for (const listener of listeners) listener();
        },
      };
    },
  };
}
export type PwaState = "starting" | "ready" | "waiting" | "unavailable";
export function startPwa(notify: (state: PwaState) => void) {
  let stopped = false;
  let registration: ServiceWorkerRegistration | undefined;
  let installing: ServiceWorker | null = null;
  const emit = (state: PwaState) => {
    if (!stopped) notify(state);
  };
  const changed = () => {
    if (registration?.waiting) emit("waiting");
    else if (installing?.state === "redundant") emit("unavailable");
    else if (registration?.active) emit("ready");
  };
  const found = () => {
    installing?.removeEventListener("statechange", changed);
    installing = registration?.installing ?? null;
    installing?.addEventListener("statechange", changed);
    changed();
  };
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    emit("unavailable");
    return () => {
      stopped = true;
    };
  }
  emit("starting");
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((result) => {
      if (stopped) return;
      registration = result;
      registration.addEventListener("updatefound", found);
      found();
      // No skipWaiting, clients.claim or controllerchange reload: every open
      // tab, including another tab with unsaved work, keeps its worker.
      return registration.update();
    })
    .catch(() => emit("unavailable"));
  return () => {
    stopped = true;
    registration?.removeEventListener("updatefound", found);
    installing?.removeEventListener("statechange", changed);
  };
}
