import { OwnerRequestError } from "@aarili/api/client";
import {
  commandServiceLine,
  readServiceLineProgress,
} from "@aarili/api/small-services-client";
import type {
  ServiceLineCommand,
  ServiceLineProgress,
} from "@aarili/contracts/small-services";
import {
  formatOrderPaise,
  type Locale,
  serviceLineMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { useEffect, useId, useRef, useState } from "react";

export function ServiceLineCompletion({
  shopId,
  orderId,
  locale,
}: {
  shopId: string;
  orderId: string;
  locale: Locale;
}) {
  const t = serviceLineMessages[locale],
    uid = useId(),
    [view, setView] = useState<ServiceLineProgress>(),
    [selected, setSelected] = useState<string>(),
    [note, setNote] = useState(""),
    [attested, setAttested] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<
      "saved" | "error" | "conflict" | "unavailable"
    >(),
    [loading, setLoading] = useState(true);
  const retry = useRef<
      | {
          lineId: string;
          version: number;
          key: string;
          command: ServiceLineCommand;
        }
      | undefined
    >(undefined),
    heading = useRef<HTMLHeadingElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (selected) noteField.current?.focus();
  }, [selected]);
  useEffect(() => {
    const ac = new AbortController();
    setView(undefined);
    setLoading(true);
    void readServiceLineProgress(shopId, orderId, ac.signal).then(
      (v) => {
        setView(v);
        setLoading(false);
      },
      () => {
        if (!ac.signal.aborted) {
          setStatus("error");
          setLoading(false);
        }
      },
    );
    return () => ac.abort();
  }, [shopId, orderId]);
  function clearUnavailable(e: unknown) {
    if (
      !(e instanceof OwnerRequestError) ||
      !["NOT_FOUND", "SHOP_ACCESS_DENIED", "UNAUTHENTICATED"].includes(e.code)
    )
      return false;
    setView(undefined);
    setSelected(undefined);
    setNote("");
    setAttested(false);
    retry.current = undefined;
    setStatus("unavailable");
    return true;
  }
  async function reload() {
    setBusy(true);
    try {
      setView(await readServiceLineProgress(shopId, orderId));
      retry.current = undefined;
      setSelected(undefined);
      setStatus(undefined);
      heading.current?.focus();
    } catch (e) {
      if (!clearUnavailable(e)) setStatus("error");
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const v = retry.current;
    if (!v || busy) return;
    setBusy(true);
    setStatus(undefined);
    try {
      await commandServiceLine(
        shopId,
        orderId,
        v.lineId,
        v.command,
        v.version,
        v.key,
      );
      const current = await readServiceLineProgress(shopId, orderId);
      retry.current = undefined;
      setSelected(undefined);
      setNote("");
      setAttested(false);
      setView(current);
      setStatus("saved");
      heading.current?.focus();
    } catch (e) {
      if (clearUnavailable(e)) return;
      setStatus(
        e instanceof OwnerRequestError &&
          ["VERSION_STALE", "REQUEST_CONFLICT", "VALIDATION_FAILED"].includes(
            e.code,
          )
          ? "conflict"
          : "error",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openLine(line: ServiceLineProgress["lines"][number]) {
    if (busy || selected || retry.current) return;
    setBusy(true);
    try {
      const current = await readServiceLineProgress(shopId, orderId);
      const exact = current.lines.find((l) => l.line.id === line.line.id);
      setView(current);
      if (
        !exact?.eligible ||
        exact.version !== line.version ||
        exact.state !== line.state ||
        exact.sourceId !== line.sourceId ||
        exact.sourceDigest !== line.sourceDigest
      ) {
        setStatus("conflict");
        return;
      }
      setSelected(line.line.id);
      setStatus(undefined);
      setAttested(false);
    } catch (e) {
      if (!clearUnavailable(e)) setStatus("error");
    } finally {
      setBusy(false);
    }
  }
  const line = view?.lines.find((l) => l.line.id === selected);
  if (view?.lines.length === 0 && !status) return null;
  return (
    <section
      className="order-editor service-additions"
      aria-label={t.title}
      aria-busy={busy || loading}
    >
      <h3 tabIndex={-1} ref={heading}>
        {t.title}
      </h3>
      <p>{t.intro}</p>
      {loading && <p role="status">{t.loading}</p>}
      {status && (
        <p role={status === "saved" ? "status" : "alert"}>{t[status]}</p>
      )}
      {view && (
        <>
          <p>
            {t.summary}: <strong>{view.summary.pending}</strong> · {t.completed}
            : {view.summary.completed} · {t.notRequired}:{" "}
            {view.summary.notRequired}
          </p>
          {!view.lines.length && <p>{t.empty}</p>}
          <ul className="owner-form">
            {view.lines.map((l) => (
              <li key={l.line.id}>
                <h4>{locale === "ta" ? l.line.labelTa : l.line.labelEn}</h4>
                <p className="preserve-text">{l.line.requestedWork}</p>
                <p>
                  <strong>
                    {l.state === "pending"
                      ? t.pending
                      : l.state === "completed"
                        ? t.completed
                        : t.notRequired}
                  </strong>
                  {l.state !== "not-required" && (
                    <>
                      {" "}
                      · {t.price}:{" "}
                      {l.line.priceState === "to-be-quoted"
                        ? t.toQuote
                        : formatOrderPaise(l.line.pricePaise, locale)}
                    </>
                  )}
                </p>
                {l.blocked === "not-required" && (
                  <p>{l.line.notRequiredReason}</p>
                )}
                {l.blocked === "task-linked" && (
                  <p>
                    {t.task} {t.taskReference}:{" "}
                    <span className="wrap-anywhere">{l.line.taskKey}</span>
                  </p>
                )}
                {l.blocked === "unreviewed" && <p>{t.unreviewed}</p>}
                {l.eligible && (
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      selected !== undefined ||
                      retry.current !== undefined
                    }
                    onClick={() => void openLine(l)}
                  >
                    {l.state === "completed" ? t.correct : t.complete} ·{" "}
                    {locale === "ta" ? l.line.labelTa : l.line.labelEn}
                  </Button>
                )}
                {l.history.length > 0 && (
                  <details>
                    <summary>
                      {t.history} ({l.history.length})
                    </summary>
                    <ol>
                      {l.history.map((h) => (
                        <li key={h.id} className="wrap-anywhere">
                          <p>
                            {h.to === "completed" ? t.completed : t.pending} ·{" "}
                            {t.version} {h.version}
                          </p>
                          <p>
                            {t.actor} {h.actorId} · {t.at}{" "}
                            <time dateTime={h.recordedAt}>
                              {new Date(h.recordedAt).toLocaleString(
                                locale === "ta" ? "ta-IN" : "en-IN",
                              )}
                            </time>
                          </p>
                          <p className="preserve-text">
                            {h.redacted ? t.redacted : h.note}
                          </p>
                          {h.correctionOf && (
                            <p>
                              {t.correction}: {h.correctionOf}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {line && view && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              busy ||
              retry.current ||
              !note.trim() ||
              (line.state === "pending" && !attested)
            )
              return;
            const common = {
              commandId: crypto.randomUUID(),
              orderVersion: view.orderVersion,
              scopeDigest: view.scopeDigest,
              sourceId: line.sourceId,
              sourceDigest: line.sourceDigest,
            };
            const latest = line.history.at(-1);
            if (line.state === "completed" && !latest) return;
            retry.current = {
              lineId: line.line.id,
              version: line.version,
              key: crypto.randomUUID(),
              command:
                line.state === "completed"
                  ? {
                      ...common,
                      action: "correct",
                      correctionOf: latest?.id ?? "",
                      reason: note,
                    }
                  : { ...common, action: "complete", attested: true, note },
            };
            void send();
          }}
        >
          <fieldset disabled={busy || retry.current !== undefined}>
            <legend>
              {line.state === "completed" ? t.correct : t.complete} ·{" "}
              {locale === "ta" ? line.line.labelTa : line.line.labelEn}
            </legend>
            <label htmlFor={`${uid}-note`}>{t.note}</label>
            <textarea
              ref={noteField}
              id={`${uid}-note`}
              required
              maxLength={line.state === "completed" ? 1000 : 2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {line.state === "pending" && (
              <label>
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  required
                />
                {t.attest}
              </label>
            )}
            <div className="owner-actions">
              <Button type="submit">{t.save}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelected(undefined);
                  setAttested(false);
                }}
              >
                {t.cancel}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {status === "error" && retry.current && (
        <Button disabled={busy} onClick={() => void send()}>
          {t.retry}
        </Button>
      )}
      {(status === "conflict" || status === "error") && (
        <Button variant="outline" disabled={busy} onClick={() => void reload()}>
          {t.reload}
        </Button>
      )}
    </section>
  );
}
