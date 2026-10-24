"use client";
import {
  DocumentRequestError,
  onOwnerInvalidation,
  requestDocumentFile,
  requestDocumentHistory,
  requestDocumentRetry,
  requestDocumentShare,
  requestDocumentStatus,
} from "@aarili/api/client";
import type {
  DocumentShareCommand,
  DocumentShareEvent,
  DocumentStatus,
} from "@aarili/contracts/documents";
import { sharingMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PrivateDocumentStatus } from "./document-status";

type Selection = { shopId: string; docId: string; revision: number };
// The authorised feature supplies the intended recipient. Text is a reviewed
// literal; no model, private URL, cost or phone enters history/events.
type Props = {
  selection: Selection | null;
  locale: "en" | "ta";
  recipient: { phone: string };
  requirePreview?: boolean;
  allowExternalShare?: boolean;
};
export function PrivateDocumentSharing(props: Props) {
  const s = props.selection;
  return s ? (
    <SelectedDocument
      key={`${s.shopId}:${s.docId}:${s.revision}`}
      {...props}
      selection={s}
    />
  ) : null;
}
function SelectedDocument({
  selection: s,
  locale,
  recipient,
  requirePreview = false,
  allowExternalShare = true,
}: Props & { selection: Selection }) {
  const t = sharingMessages[locale],
    heading = useId();
  const [status, setStatus] = useState<DocumentStatus | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<keyof typeof t | null>(null),
    [url, setUrl] = useState<string | null>(null),
    [prepared, setPrepared] = useState<string | null>(null),
    [history, setHistory] = useState<DocumentShareEvent[] | null>(null),
    [pending, setPending] = useState(false),
    [canShare, setCanShare] = useState(false),
    [inlinePreview, setInlinePreview] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const canPublish = allowExternalShare && (!requirePreview || reviewed);
  const resource = useRef<{ file: File; url: string; expires: number } | null>(
      null,
    ),
    valid = useRef(true),
    sequence = useRef(0),
    request = useRef<AbortController | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    action = useRef<{ key: string; input: DocumentShareCommand } | null>(null),
    retry = useRef<{ key: string; version: number } | null>(null),
    working = useRef(false);
  const release = useCallback(() => {
    setReviewed(false);
    request.current?.abort();
    request.current = null;
    if (timer.current) clearTimeout(timer.current);
    if (resource.current) URL.revokeObjectURL(resource.current.url);
    resource.current = null;
  }, []);
  useEffect(() => {
    valid.current = true;
    const remove = onOwnerInvalidation(() => {
      valid.current = false;
      sequence.current++;
      release();
      action.current = null;
      retry.current = null;
      setUrl(null);
      setPrepared(null);
      setHistory(null);
      setStatus(null);
      setPending(false);
      setNotice("denied");
      setBusy(false);
    });
    return () => {
      valid.current = false;
      sequence.current++;
      release();
      remove();
    };
  }, [release]);
  function current(n: number) {
    return valid.current && sequence.current === n;
  }
  function live() {
    if (
      !valid.current ||
      !resource.current ||
      Date.now() >= resource.current.expires
    ) {
      release();
      setUrl(null);
      setPrepared(null);
      setNotice("expired");
      return null;
    }
    return resource.current;
  }
  async function run(operation: (n: number) => Promise<void>) {
    if (!valid.current || working.current) return;
    working.current = true;
    setBusy(true);
    const n = sequence.current;
    try {
      await operation(n);
    } catch (error) {
      if (current(n)) {
        if (
          error instanceof DocumentRequestError &&
          error.status < 500 &&
          error.status !== 429
        ) {
          action.current = null;
          retry.current = null;
          release();
          setUrl(null);
          setPrepared(null);
          setHistory(null);
          setStatus(null);
        }
        setNotice(action.current ? "unknown" : "error");
      }
    } finally {
      working.current = false;
      if (current(n)) {
        setBusy(false);
        setPending(!!action.current);
      }
    }
  }
  async function confirm(n: number) {
    const a = action.current;
    if (!a) return;
    const e = await requestDocumentShare(
      s.shopId,
      s.docId,
      s.revision,
      a.input,
      a.key,
    );
    if (!current(n)) return;
    action.current = null;
    setPending(false);
    if (e.kind === "prepared" && resource.current) {
      setPrepared(e.id);
      setNotice("ready");
    } else if (e.kind === "marked-sent") setNotice("sent");
    if (history !== null)
      setHistory((old) =>
        [e, ...(old ?? []).filter((x) => x.id !== e.id)].slice(0, 50),
      );
  }
  function prepare() {
    void run(async (n) => {
      release();
      setUrl(null);
      setPrepared(null);
      setNotice("preparing");
      const d = await requestDocumentStatus(s.shopId, s.docId, s.revision);
      if (!current(n)) return;
      setStatus(d);
      if (d.state !== "ready" || !d.sha256) {
        setNotice(null);
        return;
      }
      const abort = new AbortController();
      request.current = abort;
      const file = await requestDocumentFile(
        s.shopId,
        s.docId,
        s.revision,
        d.sha256,
        abort.signal,
      );
      if (!current(n)) return;
      const memoryUrl = URL.createObjectURL(file);
      resource.current = { file, url: memoryUrl, expires: Date.now() + 120000 };
      setUrl(memoryUrl);
      setInlinePreview(navigator.pdfViewerEnabled === true);
      try {
        setCanShare(
          isSecureContext &&
            !!navigator.share &&
            !!navigator.canShare?.({ files: [file] }),
        );
      } catch {
        setCanShare(false);
      }
      timer.current = setTimeout(() => {
        sequence.current++;
        release();
        setUrl(null);
        setPrepared(null);
        setBusy(false);
        setPending(!!action.current);
        setNotice("expired");
      }, 120000);
      action.current = {
        key: crypto.randomUUID(),
        input: { kind: "prepared" },
      };
      await confirm(n);
    });
  }
  function share() {
    const r = live();
    if (!r || !prepared || pending || working.current || !canPublish) return;
    // No awaited work precedes this native call: the tap retains activation.
    working.current = true;
    setBusy(true);
    const n = sequence.current;
    try {
      if (!navigator.canShare?.({ files: [r.file] }) || !navigator.share)
        throw Error("Unsupported");
      void navigator
        .share({ files: [r.file] })
        .then(
          () => {
            if (current(n)) setNotice("honest");
          },
          (e) => {
            if (current(n))
              setNotice(
                e instanceof DOMException && e.name === "AbortError"
                  ? "cancelled"
                  : "failed",
              );
          },
        )
        .finally(() => {
          working.current = false;
          if (current(n)) setBusy(false);
        });
    } catch {
      working.current = false;
      setBusy(false);
      setCanShare(false);
      setNotice("failed");
    }
  }
  function download() {
    const r = live();
    if (!r || !prepared) return;
    const a = document.createElement("a");
    a.href = r.url;
    a.download = r.file.name;
    a.rel = "noreferrer";
    a.click();
    setNotice("manual");
  }
  function openText() {
    if (!live() || !prepared || !canPublish) return;
    if (!/^\+?[1-9][0-9]{7,14}$/.test(recipient.phone)) {
      setNotice("error");
      return;
    }
    window.open(
      `https://wa.me/${recipient.phone.replace(/^\+/, "")}?text=${encodeURIComponent(t.message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  return (
    <div lang={locale} className="document-sharing">
      <PrivateDocumentStatus
        status={status}
        locale={locale}
        busy={busy}
        outcomeUnknown={pending || !!retry.current}
        onCheck={() => {
          void run(async (n) => {
            if (retry.current) {
              const a = retry.current;
              const d = await requestDocumentRetry(
                s.shopId,
                s.docId,
                s.revision,
                a.key,
                a.version,
              );
              if (current(n)) {
                setStatus(d);
                retry.current = null;
              }
            } else {
              const d = await requestDocumentStatus(
                s.shopId,
                s.docId,
                s.revision,
              );
              if (current(n)) setStatus(d);
            }
          });
        }}
        onRetry={() => {
          void run(async (n) => {
            if (!status) return;
            retry.current ??= {
              key: crypto.randomUUID(),
              version: status.version,
            };
            const a = retry.current;
            const d = await requestDocumentRetry(
              s.shopId,
              s.docId,
              s.revision,
              a.key,
              a.version,
            );
            if (current(n)) {
              retry.current = null;
              setStatus(d);
            }
          });
        }}
      />
      <section className="owner-content" aria-labelledby={heading}>
        <h2 id={heading}>{t.title}</h2>
        {recipient.phone ? (
          <p>
            {t.recipient}: {recipient.phone}
          </p>
        ) : null}
        <p role="status" aria-live="polite">
          {notice ? t[notice] : t.honest}
        </p>
        <div className="owner-actions">
          <Button
            disabled={busy || pending || !valid.current}
            onClick={prepare}
          >
            {t.prepare}
          </Button>
          {pending ? (
            <Button
              disabled={busy}
              onClick={() => {
                void run(confirm);
              }}
            >
              {t.retry}
            </Button>
          ) : null}
          {prepared && url ? (
            <>
              {canShare && canPublish ? (
                <Button disabled={busy || pending} onClick={share}>
                  {t.share}
                </Button>
              ) : null}
              <Button disabled={busy || pending} onClick={download}>
                {t.download}
              </Button>
              {canPublish && recipient.phone ? (
                <Button disabled={busy || pending} onClick={openText}>
                  {t.text}
                </Button>
              ) : null}
              {canPublish ? (
                <Button
                  disabled={busy || pending}
                  onClick={() => {
                    if (working.current || action.current || !live()) return;
                    action.current = {
                      key: crypto.randomUUID(),
                      input: { kind: "marked-sent", preparedId: prepared },
                    };
                    void run(confirm);
                  }}
                >
                  {t.mark}
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            disabled={busy || !valid.current}
            onClick={() => {
              void run(async (n) => {
                const h = await requestDocumentHistory(
                  s.shopId,
                  s.docId,
                  s.revision,
                );
                if (current(n)) setHistory(h);
              });
            }}
          >
            {t.history}
          </Button>
        </div>
        <p>{t.manual}</p>
        <p>{t.honest}</p>
        {url && prepared ? (
          <div className="document-preview" data-testid="pdf-preview">
            <p>{t.previewHelp}</p>
            {requirePreview && allowExternalShare ? (
              <label>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />{" "}
                {t.reviewPrivate}
              </label>
            ) : null}
            {inlinePreview ? (
              <iframe
                title={t.preview}
                src={`${url}#view=FitH&navpanes=0`}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <Button
              onClick={() => {
                sequence.current++;
                release();
                setUrl(null);
                setPrepared(null);
              }}
            >
              {t.close}
            </Button>
          </div>
        ) : null}
        {history !== null ? (
          <>
            <h3>{t.recent}</h3>
            {history.length ? (
              <ol>
                {history.map((e) => (
                  <li key={e.id}>
                    {e.kind === "prepared" ? t.prepared : t.marked} —{" "}
                    <time dateTime={e.createdAt}>
                      {new Date(e.createdAt).toLocaleString(
                        locale === "ta" ? "ta-IN" : "en-IN",
                      )}
                    </time>{" "}
                    — {e.actorId}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{t.empty}</p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
