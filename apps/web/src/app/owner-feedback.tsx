import { OwnerRequestError } from "@aarili/api/client";
import { Status } from "@aarili/ui/components/status";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { createWorkGuard } from "./pwa-runtime";

export type OwnerGuard = ReturnType<typeof createWorkGuard>;
export function useOwnerRequest(guard: OwnerGuard) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const dirty = useRef(false);
  const unknown = useRef(false);
  const [work] = useState(() => guard.track());
  useEffect(() => () => work.dispose(), [work]);
  function changed() {
    dirty.current = true;
    work.set({
      dirty: true,
      inFlight: locked.current,
      outcomeUnknown: unknown.current,
    });
  }
  const cleared = useCallback(() => {
    dirty.current = false;
    unknown.current = false;
    work.set({ dirty: false, inFlight: locked.current, outcomeUnknown: false });
  }, [work]);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailure("");
    setNotice("");
    work.set({
      dirty: dirty.current,
      inFlight: true,
      outcomeUnknown: unknown.current,
    });
    try {
      await action();
      unknown.current = false;
    } catch (error) {
      unknown.current = true;
      const code = error instanceof OwnerRequestError ? error.code : "";
      const messages: Record<string, string> = {
        GOOGLE_DENIED: "googleDenied",
        GOOGLE_UNAVAILABLE: "googleUnavailable",
        VALIDATION_FAILED: "validation",
        SETUP_CLOSED: "closed",
        REQUEST_CONFLICT: "conflict",
        UNAUTHENTICATED: "expired",
        AUTHENTICATION_STALE: "stale",
        INVALID_RESET: "badReset",
        INVALID_CREDENTIALS: "invalid",
        INVALID_VERIFICATION: "badCode",
        MAIL_UNAVAILABLE: "mailError",
        RATE_LIMITED: "limited",
        NOT_FOUND: "unavailable",
        SIGN_OUT_UNCONFIRMED: "signOutError",
      };
      setFailure(messages[code] ?? "error");
    } finally {
      locked.current = false;
      setBusy(false);
      work.set({
        dirty: dirty.current,
        inFlight: false,
        outcomeUnknown: unknown.current,
      });
    }
  }
  return {
    busy,
    failure,
    notice,
    setFailure,
    setNotice,
    run,
    changed,
    cleared,
  };
}
export type OwnerRequest = ReturnType<typeof useOwnerRequest>;

export function OwnerFeedback({ request }: { request: OwnerRequest }) {
  const t = useTranslations();
  const target = useRef<HTMLDivElement>(null);
  const message = request.failure || request.notice;
  useEffect(() => {
    if (message) target.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div
      ref={target}
      tabIndex={-1}
      role={request.failure ? "alert" : "status"}
      className="access-feedback"
    >
      <Status tone={request.failure ? "error" : "success"}>{t(message)}</Status>
    </div>
  );
}
