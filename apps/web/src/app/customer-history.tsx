import { OwnerRequestError } from "@aarili/api/client";
import { readCustomerHistory } from "@aarili/api/customer-history-client";
import type {
  CustomerHistoryEvent,
  CustomerHistoryPage,
} from "@aarili/contracts/customer-history";
import { customerHistoryMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { Status } from "@aarili/ui/components/status";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { createOwnerQueries } from "./owner-query";

export function CustomerHistory({
  shopId,
  customerId,
  wearerId,
  queries,
  onWearer,
}: {
  shopId: string;
  customerId: string;
  wearerId: string | null;
  queries: ReturnType<typeof createOwnerQueries>;
  onWearer: (id: string) => void;
}) {
  const locale = useLocale() as Locale,
    t = customerHistoryMessages[locale],
    id = useId();
  const [open, setOpen] = useState(false),
    [onlyWearer, setOnlyWearer] = useState(!!wearerId),
    [text, setText] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState<CustomerHistoryPage>(),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const seq = useRef(0),
    abort = useRef<AbortController | null>(null),
    alive = useRef(true);
  const scope = onlyWearer ? wearerId : null;
  useEffect(() => {
    alive.current = true;
    const clear = () => {
      seq.current++;
      abort.current?.abort();
      setPage(undefined);
      setText("");
      setQuery("");
      setFailure(t.changed);
      setBusy(false);
    };
    const unsubscribe = queries.onInvalidate(clear);
    // Re-entry does not leave stale private history visible after another tab's
    // correction/withdrawal. The owner explicitly refreshes current authority.
    window.addEventListener("focus", clear);
    return () => {
      alive.current = false;
      seq.current++;
      abort.current?.abort();
      unsubscribe();
      window.removeEventListener("focus", clear);
    };
  }, [queries, t.changed]);
  async function load(next = false, search = query) {
    const current = ++seq.current,
      epoch = queries.version();
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setFailure("");
    if (!next) setPage(undefined);
    try {
      const result = await readCustomerHistory(
        shopId,
        {
          customerId,
          wearerId: scope,
          query: search,
          limit: 15,
          ...(next && page?.next ? { cursor: page.next } : {}),
        },
        controller.signal,
      );
      if (
        !alive.current ||
        current !== seq.current ||
        !queries.isCurrent(epoch)
      )
        return;
      setPage((old) =>
        next && old
          ? { ...result, events: [...old.events, ...result.events] }
          : result,
      );
      setQuery(search);
    } catch (error) {
      if (
        alive.current &&
        current === seq.current &&
        queries.isCurrent(epoch)
      ) {
        setPage(undefined);
        setFailure(
          error instanceof OwnerRequestError &&
            ["HISTORY_CHANGED", "NOT_FOUND"].includes(error.code)
            ? t.changed
            : t.failed,
        );
      }
    } finally {
      if (alive.current && current === seq.current) setBusy(false);
    }
  }
  function resetScope(value: boolean) {
    seq.current++;
    abort.current?.abort();
    setOnlyWearer(value);
    setPage(undefined);
    setFailure("");
    setText("");
    setQuery("");
    setBusy(false);
  }
  function source(e: CustomerHistoryEvent, related = false) {
    const ref = related ? e.related[0] : e.source;
    if (!ref) return null;
    const label = related ? t.related : t.source;
    if (ref.kind === "wearer")
      return (
        <Button variant="outline" onClick={() => onWearer(ref.id)}>
          {label}
        </Button>
      );
    const href =
      ref.kind === "booking"
        ? `/orders?historyBooking=${ref.id}`
        : ref.kind === "order"
          ? `/orders?order=${ref.id}`
          : ref.kind === "service"
            ? `/orders?serviceOrder=${ref.id}`
            : `/customers/${ref.id}`;
    return (
      <a className="customer-history-link" href={href}>
        {label}
      </a>
    );
  }
  return (
    <section className="customer-history" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{onlyWearer ? t.wearerTitle : t.title}</h3>
      <p>{t.intro}</p>
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            seq.current++;
            abort.current?.abort();
            setPage(undefined);
            setText("");
            setQuery("");
            setBusy(false);
          } else void load();
          setOpen(!open);
        }}
      >
        {open ? t.close : t.open}
      </Button>
      {open && (
        <>
          <div className="customer-toolbar">
            <Button
              variant={!onlyWearer ? "default" : "outline"}
              aria-pressed={!onlyWearer}
              onClick={() => resetScope(false)}
            >
              {t.all}
            </Button>
            {wearerId && (
              <Button
                variant={onlyWearer ? "default" : "outline"}
                aria-pressed={onlyWearer}
                onClick={() => resetScope(true)}
              >
                {t.one}
              </Button>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(false, text);
            }}
          >
            <Field>
              <FieldLabel htmlFor={`${id}-search`}>{t.search}</FieldLabel>
              <Input
                id={`${id}-search`}
                value={text}
                maxLength={120}
                autoComplete="off"
                aria-describedby={`${id}-help`}
                onChange={(e) => setText(e.target.value)}
              />
              <p id={`${id}-help`}>{t.searchHelp}</p>
            </Field>
            <div className="customer-toolbar">
              <Button disabled={busy} type="submit">
                {t.find}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void load(false, text)}
              >
                {t.refresh}
              </Button>
            </div>
          </form>
          {busy && <p role="status">{t.loading}</p>}
          {failure && <Status tone="warning">{failure}</Status>}
          {page && (
            <>
              <p className="customer-muted">{t.attribution}</p>
              <p className="customer-muted">{t.boundary}</p>
              {page.events.length === 0 && (
                <p role="status">{query ? t.noMatch : t.empty}</p>
              )}
              <ol className="customer-history-events">
                {page.events.map((e) => (
                  <li key={e.id}>
                    <h4>
                      {t.actions[e.action as keyof typeof t.actions] ??
                        e.action}
                      {e.code ? ` · ${e.code}` : ""}
                    </h4>
                    {(e.labelEn || e.labelTa) && (
                      <p>
                        {(locale === "ta" ? e.labelTa : e.labelEn) ??
                          e.labelEn ??
                          e.labelTa}
                      </p>
                    )}
                    <time dateTime={e.recordedAt}>
                      {new Date(e.recordedAt).toLocaleString(locale)}
                    </time>
                    <details>
                      <summary>{t.details}</summary>
                      <dl>
                        <dt>{t.current}</dt>
                        <dd>
                          {e.currentCustomer}
                          {e.currentWearer ? ` / ${e.currentWearer}` : ""}
                        </dd>
                        <dt>{t.original}</dt>
                        <dd>
                          {t.customer}: {e.original.customerId ?? t.unknown}
                          <br />
                          {t.wearer}: {e.original.wearerId ?? t.noWearer}
                        </dd>
                        <dt>{t.actor}</dt>
                        <dd>
                          {
                            {
                              user: t.owner,
                              system: t.system,
                              import: t.imported,
                              support: t.support,
                            }[e.actorType]
                          }{" "}
                          · {e.actorId}
                        </dd>
                        <dt>{t.version}</dt>
                        <dd>{e.source.version ?? "—"}</dd>
                        <dt>{t.reason}</dt>
                        <dd>
                          {e.redacted
                            ? t.redacted
                            : (e.reason ?? t.absentReason)}
                        </dd>
                        <dt>{t.fields}</dt>
                        <dd>
                          {e.fields
                            .map(
                              (field) =>
                                t.fieldLabels[
                                  field as keyof typeof t.fieldLabels
                                ] ?? field,
                            )
                            .join(", ")}
                          <br />
                          {t.fieldHelp}
                        </dd>
                        <dt>{t.reference}</dt>
                        <dd>{e.id}</dd>
                        {e.pieceIds.length > 0 && (
                          <>
                            <dt>{t.pieces}</dt>
                            <dd>{e.pieceIds.join(", ")}</dd>
                          </>
                        )}
                        {e.lineIds.length > 0 && (
                          <>
                            <dt>{t.line}</dt>
                            <dd>{e.lineIds.join(", ")}</dd>
                          </>
                        )}
                        {e.lineId && (
                          <>
                            <dt>{t.line}</dt>
                            <dd>
                              {e.lineId} ·{" "}
                              {e.state === "completed"
                                ? t.completed
                                : t.pending}
                            </dd>
                          </>
                        )}
                        {e.facts.map((fact) => (
                          <div key={fact.field}>
                            <dt>
                              {t.fieldLabels[
                                fact.field as keyof typeof t.fieldLabels
                              ] ?? fact.field}
                            </dt>
                            <dd>
                              {t.values[fact.value as keyof typeof t.values] ??
                                fact.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                    <div className="customer-toolbar">
                      {source(e)}
                      {source(e, true)}
                    </div>
                  </li>
                ))}
              </ol>
              {page.next && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void load(true)}
                >
                  {t.more}
                </Button>
              )}
            </>
          )}
          <h4>{t.unavailable}</h4>
          <p>{t.unavailableHelp}</p>
        </>
      )}
    </section>
  );
}
