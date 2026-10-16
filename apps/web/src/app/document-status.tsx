"use client";
import type { DocumentStatus } from "@aarili/contracts/documents";
import { documentMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { useId } from "react";
export function PrivateDocumentStatus({
  status,
  locale,
  busy = false,
  outcomeUnknown = false,
  onCheck,
  onRetry,
}: {
  status: DocumentStatus | null;
  locale: "en" | "ta";
  busy?: boolean;
  outcomeUnknown?: boolean;
  onCheck: () => void;
  onRetry: () => void;
}) {
  const t = documentMessages[locale];
  const heading = useId();
  const detail =
    status?.failure === "RENDER_RETRYABLE"
      ? t.retrying
      : status?.failure === "RETRIES_EXHAUSTED"
        ? t.exhausted
        : status?.failure === "RESTORE_BLOCKED"
          ? t.restore
          : null;
  return (
    <section className="owner-content" lang={locale} aria-labelledby={heading}>
      <h2 id={heading}>{t.title}</h2>
      <div className="owner-form" aria-busy={busy}>
        <p role="status" aria-live="polite">
          {outcomeUnknown
            ? t.unknown
            : status
              ? t[status.state]
              : t.unavailable}
        </p>
        {detail ? <p>{detail}</p> : null}
        <div className="owner-actions">
          <Button type="button" disabled={busy} onClick={onCheck}>
            {t.check}
          </Button>
          {status?.canRetry ? (
            <Button
              type="button"
              disabled={busy || outcomeUnknown}
              onClick={onRetry}
            >
              {t.retry}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
