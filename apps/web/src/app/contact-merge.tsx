import { OwnerRequestError } from "@aarili/api/client";
import {
  readContactMerge,
  recordContactMerge,
} from "@aarili/api/customer-history-client";
import type {
  ContactMergeCommand,
  ContactMergePreview,
  CustomerPair,
} from "@aarili/contracts/customer-history";
import { contactMergeMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Status } from "@aarili/ui/components/status";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

const fieldNames = [
  "displayName",
  "phone",
  "email",
  "aliases",
  "notes",
] as const;
type Attempt = { key: string; etag: string; input: ContactMergeCommand };
export function ContactMerge({
  shopId,
  pair,
  queries,
  guard,
  onPendingChange,
}: {
  shopId: string;
  pair: CustomerPair;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
  onPendingChange: (value: boolean) => void;
}) {
  const locale = useLocale() as Locale,
    t = contactMergeMessages[locale],
    id = useId();
  const merged = pair.contacts.find(
    (c) =>
      c.customer.mergedInto &&
      pair.contacts.some((x) => x.customer.id === c.customer.mergedInto?.id),
  );
  const mode = merged ? "restore" : "merge";
  const [sourceId, setSourceId] = useState(merged?.customer.id ?? ""),
    [preview, setPreview] = useState<ContactMergePreview>(),
    [fields, setFields] = useState<Partial<ContactMergeCommand["fields"]>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [attempt, setAttempt] = useState<Attempt>(),
    [saved, setSaved] = useState(false),
    [stale, setStale] = useState(false),
    [invalidated, setInvalidated] = useState(false);
  const abort = useRef<AbortController | null>(null),
    locked = useRef(false),
    generation = useRef(0),
    pending = useRef<Attempt | undefined>(undefined),
    heading = useRef<HTMLHeadingElement>(null);
  pending.current = attempt;
  const [work] = useState(() => guard.track());
  useEffect(() => () => work.dispose(), [work]);
  useEffect(
    () =>
      work.set({
        dirty:
          !!reason || selected.length > 0 || Object.keys(fields).length > 0,
        inFlight: busy,
        outcomeUnknown: !!attempt,
      }),
    [work, reason, selected, fields, busy, attempt],
  );
  useEffect(() => {
    if (preview) heading.current?.focus();
  }, [preview]);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      abort.current?.abort();
      setPreview(undefined);
      setInvalidated(true);
      setSaved(false);
      setReason("");
      setFields({});
      setSelected([]);
      setConfirmed(false);
      setBusy(false);
      setFailure(t.changed);
    };
    const invalid = () => {
      clear();
      setAttempt(undefined);
    };
    const un = queries.onInvalidate(invalid);
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("focus", clear);
    window.addEventListener("beforeunload", leave);
    return () => {
      generation.current++;
      abort.current?.abort();
      un();
      window.removeEventListener("focus", clear);
      window.removeEventListener("beforeunload", leave);
    };
  }, [queries, t.changed]);
  const survivorId = pair.contacts.find((c) => c.customer.id !== sourceId)
    ?.customer.id;
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    const seq = ++generation.current,
      epoch = queries.version(),
      controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setBusy(true);
    setFailure("");
    try {
      await action(controller.signal);
    } catch (e) {
      if (seq !== generation.current || !queries.isCurrent(epoch)) return;
      setPreview(undefined);
      setInvalidated(true);
      const changed =
        e instanceof OwnerRequestError &&
        ["PAIR_CHANGED", "VERSION_STALE"].includes(e.code);
      setStale(changed);
      if (changed) {
        setAttempt(undefined);
        onPendingChange(false);
      }
      setFailure(
        changed
          ? t.changed
          : e instanceof OwnerRequestError && e.code === "RATE_LIMITED"
            ? t.limited
            : t.error,
      );
    } finally {
      locked.current = false;
      if (seq === generation.current && queries.isCurrent(epoch))
        setBusy(false);
    }
  }
  function load() {
    if (!sourceId || !survivorId || attempt) return;
    void run(async (signal) => {
      setPreview(undefined);
      setFields(
        mode === "restore"
          ? {
              displayName: "survivor",
              phone: "survivor",
              email: "survivor",
              aliases: "survivor",
              notes: "survivor",
            }
          : {},
      );
      setSelected([]);
      setReason("");
      setConfirmed(false);
      setStale(false);
      setSaved(false);
      const v = await readContactMerge(
        shopId,
        { sourceId, survivorId, mode },
        signal,
      );
      if (!signal.aborted) {
        setPreview(v);
        setInvalidated(false);
      }
    });
  }
  function save() {
    if (locked.current) return;
    if (
      !attempt &&
      (!preview ||
        !confirmed ||
        !reason.trim() ||
        fieldNames.some((f) => !fields[f]))
    )
      return;
    const next = attempt ?? {
      key: crypto.randomUUID(),
      etag: `"v${preview?.version}"`,
      input: {
        sourceId,
        survivorId: survivorId as string,
        mode,
        fingerprint: preview?.fingerprint as string,
        fields: fields as ContactMergeCommand["fields"],
        orderIds: [...selected].sort(),
        reason: reason.trim(),
        confirmed: true as const,
      },
    };
    setAttempt(next);
    pending.current = next;
    onPendingChange(true);
    void run(async (signal) => {
      await recordContactMerge(shopId, next.input, next.key, next.etag, signal);
      if (!signal.aborted) {
        setAttempt(undefined);
        pending.current = undefined;
        onPendingChange(false);
        setPreview(undefined);
        setReason("");
        setFields({});
        setSelected([]);
        setSaved(true);
      }
    });
  }
  return (
    <section className="identity-review" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{mode === "restore" ? t.restore : t.title}</h3>
      <p>{mode === "restore" ? t.restoreHelp : t.intro}</p>
      {!saved && !invalidated && (
        <Field>
          <FieldLabel htmlFor={`${id}-source`}>{t.source}</FieldLabel>
          <select
            id={`${id}-source`}
            className="ui-input"
            disabled={busy || !!attempt || !!preview || mode === "restore"}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">{t.choose}</option>
            {pair.contacts.map((c) => (
              <option key={c.customer.id} value={c.customer.id}>
                {c.customer.code} · {c.customer.displayName}
              </option>
            ))}
          </select>
        </Field>
      )}
      {sourceId && survivorId && !saved && !invalidated && (
        <p>
          {t.survivor}:{" "}
          {
            pair.contacts.find((c) => c.customer.id === survivorId)?.customer
              .code
          }
        </p>
      )}
      {!preview && !saved && (
        <Button
          type="button"
          variant="outline"
          disabled={busy || !!attempt || !sourceId}
          onClick={load}
        >
          {stale
            ? t.refresh
            : mode === "restore"
              ? t.restorePreview
              : t.preview}
        </Button>
      )}
      <div role="status">{busy ? t.busy : saved ? t.saved : ""}</div>
      {failure && (
        <div role="alert">
          <Status tone="warning">{failure}</Status>
        </div>
      )}
      {preview && (
        <>
          <h4 ref={heading} tabIndex={-1}>
            {mode === "restore" ? t.restorePreview : t.fields}
          </h4>
          <p>{t.retained}</p>
          {preview.blocked.length > 0 && (
            <Status tone="warning">
              <span>
                {t.blocked}
                <ul>
                  {preview.blocked.map((b) => (
                    <li key={b}>{t.conflicts[b]}</li>
                  ))}
                </ul>
              </span>
            </Status>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <fieldset
              disabled={busy || !!attempt || preview.blocked.length > 0}
            >
              <legend>{mode === "restore" ? t.restore : t.fields}</legend>
              {mode === "merge" &&
                fieldNames.map((f) => (
                  <Field key={f}>
                    <FieldLabel htmlFor={`${id}-${f}`}>{t[f]}</FieldLabel>
                    <div className="identity-pair">
                      <p>
                        {t.sourceValue}:{" "}
                        {String(preview.source[f] || t.unknown)}
                      </p>
                      <p>
                        {t.survivorValue}:{" "}
                        {String(preview.survivor[f] || t.unknown)}
                      </p>
                    </div>
                    <select
                      id={`${id}-${f}`}
                      className="ui-input"
                      required
                      value={fields[f] ?? ""}
                      onChange={(e) => {
                        setFields({
                          ...fields,
                          [f]: e.target.value as "source" | "survivor",
                        });
                        setConfirmed(false);
                      }}
                    >
                      <option value="">{t.choose}</option>
                      <option value="source">{t.sourceValue}</option>
                      <option value="survivor">{t.survivorValue}</option>
                    </select>
                  </Field>
                ))}
              <h4>{t.associations}</h4>
              <p>{t.associationHelp}</p>
              {!preview.associations.length && <p>{t.empty}</p>}
              <ul className="identity-candidates">
                {preview.associations.map((o) => (
                  <li key={o.id}>
                    <a
                      href={
                        o.wearerId
                          ? `/orders?order=${o.id}`
                          : `/orders?serviceOrder=${o.id}`
                      }
                    >
                      {o.code}
                    </a>
                    <p>
                      {t.original}:{" "}
                      {
                        pair.contacts.find(
                          (c) => c.customer.id === o.originalCustomerId,
                        )?.customer.code
                      }{" "}
                      · {t.current}:{" "}
                      {
                        pair.contacts.find(
                          (c) => c.customer.id === o.currentCustomerId,
                        )?.customer.code
                      }
                    </p>
                    {o.eligible &&
                    (mode === "merge"
                      ? o.currentCustomerId === sourceId
                      : o.currentCustomerId === survivorId) ? (
                      <label className="identity-select">
                        <input
                          type="checkbox"
                          checked={selected.includes(o.id)}
                          onChange={(e) => {
                            setSelected(
                              e.target.checked
                                ? [...selected, o.id]
                                : selected.filter((x) => x !== o.id),
                            );
                            setConfirmed(false);
                          }}
                        />{" "}
                        {o.code}
                      </label>
                    ) : (
                      <p>
                        {o.exclusion ? t.exclusions[o.exclusion] : t.retained}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <Field>
                <FieldLabel htmlFor={`${id}-reason`}>{t.reason}</FieldLabel>
                <textarea
                  id={`${id}-reason`}
                  className="ui-input"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </Field>
              <label className="identity-select">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t.confirm}
              </label>
            </fieldset>
            <Button
              type="submit"
              disabled={
                busy ||
                preview.blocked.length > 0 ||
                (!attempt &&
                  (!confirmed ||
                    !reason.trim() ||
                    fieldNames.some((f) => !fields[f])))
              }
            >
              {attempt ? t.retry : mode === "restore" ? t.restore : t.apply}
            </Button>
          </form>
          <h4>{t.history}</h4>
          <ol>
            {preview.events.map((e) => (
              <li key={e.id}>
                {e.mode === "merge" ? t.title : t.restore} · {e.version}
                <p>
                  {new Date(e.recordedAt).toLocaleString(locale)} · {e.actorId}
                </p>
                <p>{e.reason ?? t.unknown}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      {attempt && !preview && (
        <Button type="button" disabled={busy} onClick={save}>
          {t.retry}
        </Button>
      )}
      {(preview || attempt) && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (
              (attempt ||
                reason ||
                selected.length ||
                (mode === "merge" && Object.keys(fields).length)) &&
              !window.confirm(attempt ? t.discard : t.discardEdits)
            )
              return;
            generation.current++;
            abort.current?.abort();
            setPreview(undefined);
            setAttempt(undefined);
            pending.current = undefined;
            onPendingChange(false);
            setFields({});
            setSelected([]);
            setReason("");
            setFailure("");
          }}
        >
          {t.cancel}
        </Button>
      )}
      {saved &&
        pair.contacts.map((c) => (
          <p key={c.customer.id}>
            <a href={`/customers/${c.customer.id}`}>{c.customer.code}</a>
          </p>
        ))}
    </section>
  );
}
