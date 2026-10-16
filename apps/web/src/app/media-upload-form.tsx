"use client";
import { mediaMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { useSyncExternalStore } from "react";
import type { PrivateUpload } from "./media-upload";
export function PrivateUploadForm({
  controller,
  locale,
}: {
  controller: PrivateUpload;
  locale: "en" | "ta";
}) {
  const state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = mediaMessages[locale];
  const error =
    state.error === "REQUEST_REJECTED"
      ? t.requestRejected
      : state.error === "CONVERSION_REQUIRED"
        ? t.conversion
        : state.error === "PHOTO_LIMIT"
          ? t.photoLimit
          : state.error === "PREPARATION_FAILED"
            ? t.prepareFailed
            : state.error === "FILE_UNSUPPORTED"
              ? t.unsupported
              : state.error === "STATUS_UNAVAILABLE"
                ? t.statusFailed
                : state.error === "UPLOAD_CLOSED"
                  ? t.closed
                  : state.error
                    ? t.unknown
                    : null;
  const phase =
    state.processingState === "queued"
      ? t.queued
      : state.processingState === "running"
        ? t.running
        : state.processingState === "retrying"
          ? t.retrying
          : state.processingState === "failed"
            ? t.queueFailed
            : state.processingState === "unavailable"
              ? t.unavailable
              : null;
  return (
    <section
      className="owner-content"
      lang={locale}
      aria-labelledby="media-heading"
    >
      <h2 id="media-heading">{t.title}</h2>
      <div className="owner-form">
        <label htmlFor="private-file">{t.choose}</label>
        <input
          className="ui-input"
          id="private-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,audio/mpeg,audio/mp4,audio/wav"
          disabled={state.busy || state.state === "accessEnded"}
          aria-describedby="media-limits"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void controller.select(file);
          }}
        />
        <p id="media-limits">{t.limits}</p>
        <p role="status" aria-live="polite">
          {t[state.state]}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {phase ? <p>{phase}</p> : null}
        <div className="owner-actions">
          {state.state === "selected" || state.state === "uncertain" ? (
            <Button
              type="button"
              disabled={state.busy}
              onClick={() => void controller.upload()}
            >
              {state.state === "uncertain" ? t.retry : t.upload}
            </Button>
          ) : null}
          {state.asset && ["processing", "failed"].includes(state.state) ? (
            <Button
              type="button"
              disabled={state.busy}
              onClick={() => void controller.refresh()}
            >
              {t.refresh}
            </Button>
          ) : null}
        </div>
        <details>
          <summary className="ui-button">
            {locale === "ta"
              ? "ஆதரிக்கப்படும் கோப்பு வகைகள்"
              : "Supported file profiles"}
          </summary>
          <p>{t.guidance}</p>
        </details>
      </div>
    </section>
  );
}
