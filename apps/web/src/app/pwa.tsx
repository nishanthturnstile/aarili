"use client";

import { type Locale, pwaMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Status } from "@aarili/ui/components/status";
import { useEffect, useState, useSyncExternalStore } from "react";
import { type createWorkGuard, type PwaState, startPwa } from "./pwa-runtime";

export function PwaNotice({
  locale,
  guard,
}: {
  locale: Locale;
  guard: ReturnType<typeof createWorkGuard>;
}) {
  const [state, setState] = useState<PwaState>("starting");
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<
    "online" | "offline" | "reconnected"
  >("online");
  const safe = useSyncExternalStore(guard.subscribe, guard.safe, () => true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry restarts registration after a visible failure
  useEffect(() => startPwa(setState), [attempt]);
  useEffect(() => {
    const offline = () => setConnection("offline");
    const online = () =>
      setConnection((previous) =>
        previous === "offline" ? "reconnected" : previous,
      );
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  const t = pwaMessages[locale];
  return (
    <div className="pwa-notice" aria-live="polite" aria-atomic="true">
      {connection !== "online" && (
        <p>
          <Status tone={connection === "offline" ? "warning" : "info"}>
            {connection === "offline" ? t.offline : t.connected}
          </Status>
        </p>
      )}
      {state === "unavailable" && (
        <p>
          <Status tone="warning">{t.unavailable}</Status>{" "}
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t.retry}
          </Button>
        </p>
      )}
      {state === "waiting" && safe && (
        <p>
          <Status>{t.waiting}</Status>
        </p>
      )}
    </div>
  );
}
