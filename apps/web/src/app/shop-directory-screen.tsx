import { reauthenticateOwner } from "@aarili/api/client";
import {
  readDirectoryEntry,
  readDirectoryHistory,
  readShopDirectory,
} from "@aarili/api/shop-directory-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type DirectoryContent,
  type DirectoryDraft,
  type DirectoryRevision,
  type DirectorySummary,
  directoryCommandSchema,
  directoryDraftSchema,
} from "@aarili/contracts/shop-directory";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { v7 } from "uuid";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type T = ReturnType<typeof useTranslations<"directory">>;
const methods = ["cash", "upi", "bank"] as const;
function focusTask(target: HTMLElement | null) {
  target?.focus();
  target?.scrollIntoView({ block: "start" });
}
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "directory");
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function empty(kind: DirectoryContent["kind"]): DirectoryContent {
  return kind === "methods"
    ? { kind, enabled: [] }
    : kind === "vendor"
      ? {
          kind,
          label: "",
          active: true,
          phone: "",
          capability: "",
          artisan: false,
          supplier: false,
        }
      : {
          kind,
          label: "",
          active: true,
          method: "cash",
          recipient: "owner",
          upiId: "",
          bankName: "",
          accountHolder: "",
          accountNumber: "",
          ifsc: "",
        };
}
function ContentView({ content: c, t }: { content: DirectoryContent; t: T }) {
  return (
    <dl className="shop-profile-values">
      {Object.entries(c)
        .filter(([k]) => k !== "kind")
        .map(([key, value]) => (
          <div key={key}>
            <dt>{t(key as Parameters<T>[0])}</dt>
            <dd>
              {Array.isArray(value)
                ? value.map((v) => t(v)).join(", ") || t("unknown")
                : typeof value === "boolean"
                  ? t(value ? "enabled" : "disabled")
                  : value
                    ? ["cash", "upi", "bank", "owner", "family"].includes(value)
                      ? t(value as "cash")
                      : value
                    : t("unknown")}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function Editor({
  controller,
  published,
  compare,
  rebase,
  t,
}: {
  controller: DraftRecovery;
  published: DirectoryRevision | null;
  compare: (id: string) => Promise<void>;
  rebase: (v: DirectoryDraft) => void;
  t: T;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [review, setReview] = useState(false),
    [compared, setCompared] = useState(false),
    [comparisonFailed, setComparisonFailed] = useState(false),
    [authBusy, setAuthBusy] = useState(false),
    [authError, setAuthError] = useState(false);
  const password = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    reviewHeading = useRef<HTMLHeadingElement>(null),
    conflictHeading = useRef<HTMLHeadingElement>(null),
    comparisonHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    focusTask(review ? reviewHeading.current : heading.current);
  }, [review]);
  useEffect(() => {
    if (compared) focusTask(comparisonHeading.current);
  }, [compared]);
  useEffect(() => {
    if (s.status === "conflict") focusTask(conflictHeading.current);
  }, [s.status]);
  useEffect(() => {
    if (s.error === "AUTHENTICATION_STALE" && !authBusy)
      focusTask(password.current);
  }, [s.error, authBusy]);
  const parsed = directoryDraftSchema.safeParse(s.values);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("invalidDraft")}</p>;
  const v = parsed.data,
    c = v.content,
    valid = directoryCommandSchema.safeParse(v),
    inactive = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  const edit = (content: DirectoryContent) => {
    setReview(false);
    setCompared(false);
    controller.edit({ ...v, content });
  };
  const text = (
    key:
      | "label"
      | "upiId"
      | "bankName"
      | "accountHolder"
      | "accountNumber"
      | "ifsc"
      | "phone"
      | "capability",
    max: number,
  ) => {
    const value = key in c ? String(c[key as keyof typeof c] ?? "") : "";
    const invalid =
      !valid.success && valid.error.issues.some((i) => i.path[1] === key);
    return (
      <Field key={key}>
        <FieldLabel htmlFor={`directory-${key}`}>{t(key)}</FieldLabel>
        <Input
          id={`directory-${key}`}
          value={value}
          maxLength={max}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? "directory-validation" : undefined}
          onChange={(e) => edit({ ...c, [key]: e.target.value })}
        />
      </Field>
    );
  };
  const check = (key: "active" | "artisan" | "supplier") => (
    <label className="directory-check">
      <input
        type="checkbox"
        aria-invalid={
          !valid.success && valid.error.issues.some((i) => i.path[1] === key)
        }
        aria-describedby={
          !valid.success && valid.error.issues.some((i) => i.path[1] === key)
            ? "directory-validation"
            : undefined
        }
        checked={key in c ? Boolean(c[key as keyof typeof c]) : false}
        onChange={(e) => edit({ ...c, [key]: e.target.checked })}
      />
      {t(key)}
    </label>
  );
  return (
    <section aria-label={t(c.kind)} className="directory-editor directory-task">
      <h3 ref={heading} tabIndex={-1}>
        {t(c.kind)}
      </h3>
      <p role="status">{t(s.status)}</p>
      {s.error && s.error !== "AUTHENTICATION_STALE" && (
        <p role="alert">
          {t(s.error === "RATE_LIMITED" ? "rateLimited" : "error")}
        </p>
      )}
      {s.status === "checking" && s.error !== "AUTHENTICATION_STALE" && (
        <Button
          disabled={s.work.inFlight}
          onClick={() => void controller.retry()}
        >
          {t("retry")}
        </Button>
      )}
      {s.error === "AUTHENTICATION_STALE" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (authBusy) return;
            const value = password.current?.value ?? "";
            if (password.current) password.current.value = "";
            setAuthBusy(true);
            setAuthError(false);
            try {
              await reauthenticateOwner(value, true);
              await controller.retry();
            } catch {
              setAuthError(true);
            } finally {
              setAuthBusy(false);
            }
          }}
        >
          <p>{t("recent")}</p>
          <Field>
            <FieldLabel htmlFor="directory-password">
              {t("password")}
            </FieldLabel>
            <Input
              ref={password}
              type="password"
              id="directory-password"
              autoComplete="current-password"
              required
              disabled={authBusy}
            />
          </Field>
          {authError && <p role="alert">{t("authError")}</p>}
          <Button type="submit" disabled={authBusy}>
            {t("reauth")}
          </Button>
        </form>
      )}
      {inactive && <p>{t("readOnly")}</p>}
      {s.status === "conflict" && (
        <section className="shop-conflict">
          <h4 ref={conflictHeading} tabIndex={-1}>
            {t("conflict")}
          </h4>
          <Button
            disabled={s.work.inFlight}
            onClick={() => {
              setCompared(false);
              setComparisonFailed(false);
              void Promise.all([
                controller.refreshConflict(),
                compare(v.entryId),
              ])
                .then(() => setCompared(true))
                .catch(() => setComparisonFailed(true));
            }}
          >
            {t("compare")}
          </Button>
          {comparisonFailed && <p role="alert">{t("error")}</p>}
          {compared && (
            <>
              <h4 ref={comparisonHeading} tabIndex={-1}>
                {t("published")}
              </h4>
              {published ? (
                <ContentView content={published.content} t={t} />
              ) : (
                <p>{t("unknown")}</p>
              )}
              {s.conflict &&
                directoryDraftSchema.safeParse(s.conflict.payload).success && (
                  <>
                    <h4>{t("serverDraft")}</h4>
                    <ContentView
                      content={
                        directoryDraftSchema.parse(s.conflict.payload).content
                      }
                      t={t}
                    />
                  </>
                )}
              <h4>{t("yours")}</h4>
              <ContentView content={c} t={t} />
              {s.conflict && (
                <Button
                  onClick={() => {
                    controller.resolveConflict("server");
                    setCompared(false);
                    focusTask(heading.current);
                  }}
                >
                  {t("useServer")}
                </Button>
              )}
              {s.conflict?.lifecycle === "active" &&
                (published?.version ?? 0) === v.baseVersion && (
                  <Button
                    onClick={() => {
                      controller.resolveConflict("local");
                      setCompared(false);
                      focusTask(heading.current);
                    }}
                  >
                    {t("keepLocal")}
                  </Button>
                )}
              <Button
                onClick={() =>
                  rebase({
                    ...v,
                    baseVersion: published?.version ?? 0,
                    baseRevisionId: published?.id ?? null,
                  })
                }
              >
                {t("rebase")}
              </Button>
            </>
          )}
        </section>
      )}
      <fieldset
        disabled={busy || s.status === "conflict"}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <legend>{t("yours")}</legend>
        {c.kind === "methods" ? (
          methods.map((m) => (
            <label key={m} className="directory-check">
              <input
                type="checkbox"
                checked={c.enabled.includes(m)}
                onChange={(e) =>
                  edit({
                    ...c,
                    enabled: e.target.checked
                      ? [...c.enabled, m]
                      : c.enabled.filter((x) => x !== m),
                  })
                }
              />
              {t(m)}
            </label>
          ))
        ) : (
          <>
            {text("label", 160)}
            {check("active")}
            {c.kind === "vendor" ? (
              <>
                {text("phone", 40)}
                {text("capability", 500)}
                {check("artisan")}
                {check("supplier")}
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="directory-method">
                    {t("method")}
                  </FieldLabel>
                  <select
                    className="ui-input"
                    id="directory-method"
                    value={c.method}
                    onChange={(e) =>
                      edit({
                        ...c,
                        method: e.target.value as typeof c.method,
                        upiId: "",
                        bankName: "",
                        accountHolder: "",
                        accountNumber: "",
                        ifsc: "",
                      })
                    }
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {t(m)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="directory-recipient">
                    {t("recipient")}
                  </FieldLabel>
                  <select
                    className="ui-input"
                    id="directory-recipient"
                    value={c.recipient}
                    onChange={(e) =>
                      edit({
                        ...c,
                        recipient: e.target.value as typeof c.recipient,
                      })
                    }
                  >
                    {(["owner", "family"] as const).map((r) => (
                      <option key={r} value={r}>
                        {t(r)}
                      </option>
                    ))}
                  </select>
                </Field>
                {c.method === "upi" && text("upiId", 254)}
                {c.method === "bank" && (
                  <>
                    {text("bankName", 160)}
                    {text("accountHolder", 160)}
                    {text("accountNumber", 34)}
                    {text("ifsc", 11)}
                  </>
                )}
              </>
            )}
          </>
        )}
      </fieldset>
      {!valid.success && (
        <p id="directory-validation" role="status">
          {t("invalid")}
        </p>
      )}
      {!inactive && (
        <div className="calendar-actions">
          <Button
            variant="outline"
            disabled={busy || s.status === "conflict"}
            onClick={() => void controller.save()}
          >
            {t("save")}
          </Button>
          <Button
            disabled={!valid.success || s.status !== "saved" || s.work.dirty}
            onClick={() => setReview(true)}
          >
            {t("review")}
          </Button>
        </div>
      )}
      {review && valid.success && !inactive && s.status !== "conflict" && (
        <section aria-label={t("review")}>
          <h4 ref={reviewHeading} tabIndex={-1}>
            {t("review")}
          </h4>
          <p>{t("effective")}</p>
          <h5>{t("published")}</h5>
          {published ? (
            <ContentView content={published.content} t={t} />
          ) : (
            <p>{t("unknown")}</p>
          )}
          <h5>{t("yours")}</h5>
          <ContentView content={c} t={t} />
          <Button
            disabled={s.status !== "saved" || s.work.dirty}
            onClick={() => void controller.promote()}
          >
            {t("publish")}
          </Button>
          <Button variant="ghost" onClick={() => setReview(false)}>
            {t("back")}
          </Button>
        </section>
      )}
    </section>
  );
}
export function ShopDirectoryScreen({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const t = useTranslations("directory"),
    locale = useLocale();
  const [session, setSession] = useState<{
      scope: ReturnType<typeof createDraftScope>;
      alive: () => boolean;
    }>(),
    [entries, setEntries] = useState<DirectorySummary[]>([]),
    [next, setNext] = useState<string | null>(null),
    [readiness, setReadiness] = useState<
      "missingMethods" | "missingReceivingAccount" | "configured"
    >("missingMethods");
  const [controller, setController] = useState<DraftRecovery>(),
    [published, setPublished] = useState<DirectoryRevision | null>(null),
    [detail, setDetail] = useState<DirectoryRevision | null>(null),
    [history, setHistory] = useState<DirectoryRevision[]>([]),
    [historyNext, setHistoryNext] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<DraftCursor | null>(null),
    [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [loadAttempt, setLoadAttempt] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement>(null),
    historyHeading = useRef<HTMLHeadingElement>(null);
  const [focusRequest, setFocusRequest] = useState<{
    target: "detail" | "history";
  }>();
  useEffect(() => {
    if (focusRequest)
      focusTask(
        focusRequest.target === "detail"
          ? detailHeading.current
          : historyHeading.current,
      );
  }, [focusRequest]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry rebuilds the complete scope and reloads the opaque draft locator.
  useEffect(() => {
    let mounted = true;
    const version = queries.version(),
      scope = createDraftScope(shopId, guard),
      alive = () => mounted && queries.isCurrent(version);
    setSession({ scope, alive });
    setLoaded(false);
    setFailed(false);
    setController(undefined);
    setEntries([]);
    setDetail(null);
    setHistory([]);
    setDrafts([]);
    setPublished(null);
    const load = async () => {
      try {
        const [list, recovery] = await Promise.all([
          readShopDirectory(shopId),
          scope.list(),
        ]);
        if (!alive()) return;
        setEntries(list.entries);
        setNext(list.next);
        setReadiness(list.readiness);
        setDrafts(recovery.drafts);
        setCursor(recovery.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (
            record.workflow !== "shop.directory" ||
            !directoryDraftSchema.safeParse(record.payload).success
          )
            throw Error("Incompatible draft");
          const v = directoryDraftSchema.parse(record.payload);
          const current = await readDirectoryEntry(shopId, v.entryId);
          if (!alive()) return;
          setPublished(current.revision);
          setController(
            scope.open({
              workflow: "shop.directory",
              schemaVersion: 1,
              initial: v,
              record,
              committed: (r) => {
                if (alive() && r.lifecycle === "promoted") {
                  address();
                  void readShopDirectory(shopId).then((l) => {
                    if (alive()) {
                      setEntries(l.entries);
                      setNext(l.next);
                      setReadiness(l.readiness);
                    }
                  });
                }
              },
            }),
          );
        }
        setLoaded(true);
      } catch {
        if (alive()) setFailed(true);
      }
    };
    void load();
    return () => {
      mounted = false;
      scope.dispose();
    };
  }, [shopId, queries, guard, loadAttempt]);
  const attempt = async (run: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await run();
    } catch {
      if (session?.alive()) setFailed(true);
    } finally {
      if (session?.alive()) setBusy(false);
    }
  };
  const refresh = async () => {
    const l = await readShopDirectory(shopId);
    if (!session?.alive()) return;
    setEntries(l.entries);
    setNext(l.next);
    setReadiness(l.readiness);
  };
  const open = (v: DirectoryDraft, record?: DraftRecord, preserve = false) => {
    if (
      !session?.alive() ||
      (controller &&
        !preserve &&
        !controller.confirmLeave(() => window.confirm(t("discard"))))
    )
      return;
    if (controller) session.scope.release(controller);
    setDetail(null);
    setHistory([]);
    setHistoryNext(null);
    const active = session.scope.open({
      workflow: "shop.directory",
      schemaVersion: 1,
      initial: v,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!session.alive()) return;
        if (r.lifecycle === "active") address(r.id);
        if (r.lifecycle === "promoted") {
          address();
          setDetail(null);
          setHistory([]);
          void attempt(refresh);
        }
      },
    });
    setController(active);
    if (record) address(record.id);
    else {
      address();
      active.edit(v);
    }
  };
  const start = (kind: DirectoryContent["kind"]) => {
    setPublished(null);
    open({
      entryId: v7(),
      baseVersion: 0,
      baseRevisionId: null,
      content: empty(kind),
    });
  };
  if (!loaded || !session)
    return (
      <div>
        <p role="status">{t(failed ? "error" : "loading")}</p>
        {failed && (
          <Button onClick={() => setLoadAttempt((n) => n + 1)}>
            {t("refresh")}
          </Button>
        )}
      </div>
    );
  return (
    <section className="shop-settings-main" aria-label={t("title")}>
      <h2>{t("title")}</h2>
      <p>{t("intro")}</p>
      <p>{t("manual")}</p>
      <p>{t("privacy")}</p>
      <p role="status">{t(readiness)}</p>
      {failed && <p role="alert">{t("error")}</p>}
      <div className="calendar-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void attempt(refresh)}
        >
          {t("refresh")}
        </Button>
        <Button disabled={busy} onClick={() => start("account")}>
          {t("newAccount")}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => start("vendor")}
        >
          {t("newVendor")}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              let row = entries.find((e) => e.kind === "methods");
              let before = next;
              while (!row && before) {
                const more = await readShopDirectory(shopId, before);
                row = more.entries.find((e) => e.kind === "methods");
                before = more.next;
              }
              if (!session.alive()) return;
              if (row) {
                const current = await readDirectoryEntry(shopId, row.entryId);
                if (!session.alive()) return;
                setPublished(current.revision);
                if (current.revision)
                  open({
                    entryId: row.entryId,
                    baseVersion: current.revision.version,
                    baseRevisionId: current.revision.id,
                    content: current.revision.content,
                  });
              } else start("methods");
            })
          }
        >
          {t("editMethods")}
        </Button>
      </div>
      {entries.length === 0 && <p>{t("empty")}</p>}
      <ul className="directory-list">
        {entries.map((e) => (
          <li key={e.entryId}>
            <div>
              <h3>{e.kind === "methods" ? t("methods") : e.label}</h3>
              <p>
                {t(e.kind)} · {t(e.active ? "enabled" : "disabled")}
                {e.maskedIdentifier ? ` · ${e.maskedIdentifier}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const r = await readDirectoryEntry(shopId, e.entryId);
                  if (!session.alive()) return;
                  setDetail(r.revision);
                  setHistory([]);
                  setHistoryNext(null);
                  setFocusRequest({ target: "detail" });
                })
              }
            >
              {t("detail")}
            </Button>
          </li>
        ))}
      </ul>
      {next && (
        <Button
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              const l = await readShopDirectory(shopId, next);
              if (session.alive()) {
                setEntries((v) => [...v, ...l.entries]);
                setNext(l.next);
              }
            })
          }
        >
          {t("more")}
        </Button>
      )}
      {detail && (
        <section className="directory-task" aria-label={t("detail")}>
          <h3 ref={detailHeading} tabIndex={-1}>
            {detail.content.kind === "methods"
              ? t("methods")
              : detail.content.label}
          </h3>
          <p>
            {t("revision", {
              version: detail.version,
              time: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kolkata",
              }).format(new Date(detail.effectiveAt)),
            })}
          </p>
          <p>{t("author", { id: detail.actorId })}</p>
          <ContentView content={detail.content} t={t} />
          <div className="calendar-actions">
            <Button
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const current = await readDirectoryEntry(
                    shopId,
                    detail.entryId,
                  );
                  if (!session.alive() || !current.revision) return;
                  setPublished(current.revision);
                  open({
                    entryId: current.revision.entryId,
                    baseVersion: current.revision.version,
                    baseRevisionId: current.revision.id,
                    content: current.revision.content,
                  });
                })
              }
            >
              {t("edit")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const h = await readDirectoryHistory(shopId, detail.entryId);
                  if (session.alive()) {
                    setHistory(h.revisions);
                    setHistoryNext(h.next);
                    setFocusRequest({ target: "history" });
                  }
                })
              }
            >
              {t("history")}
            </Button>
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section
          className="shop-profile-history directory-task"
          aria-label={t("history")}
        >
          <h3 ref={historyHeading} tabIndex={-1}>
            {t("history")}
          </h3>
          {history.map((r) => (
            <details key={r.id}>
              <summary>
                {t("revision", {
                  version: r.version,
                  time: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(new Date(r.effectiveAt)),
                })}
              </summary>
              <p className="shop-actor">{t("author", { id: r.actorId })}</p>
              <ContentView content={r.content} t={t} />
            </details>
          ))}
          {historyNext && detail && (
            <Button
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const h = await readDirectoryHistory(
                    shopId,
                    detail.entryId,
                    historyNext,
                  );
                  if (session.alive()) {
                    setHistory((v) => [...v, ...h.revisions]);
                    setHistoryNext(h.next);
                  }
                })
              }
            >
              {t("more")}
            </Button>
          )}
        </section>
      )}
      <section className="directory-task" aria-label={t("drafts")}>
        <h3>{t("drafts")}</h3>
        {drafts
          .filter(
            (d) => d.workflow === "shop.directory" && d.lifecycle === "active",
          )
          .map((d) => (
            <div key={d.id}>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void attempt(async () => {
                    const record = await session.scope.read(d.id);
                    const v = directoryDraftSchema.parse(record.payload);
                    const current = await readDirectoryEntry(shopId, v.entryId);
                    if (session.alive()) {
                      setPublished(current.revision);
                      open(v, record);
                    }
                  })
                }
              >
                {t("resume")} ·{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(d.updatedAt))}
              </Button>
            </div>
          ))}
        {cursor && (
          <Button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const l = await session.scope.list(cursor);
                if (session.alive()) {
                  setDrafts((v) => [...v, ...l.drafts]);
                  setCursor(l.next);
                }
              })
            }
          >
            {t("more")}
          </Button>
        )}
      </section>
      {controller && (
        <>
          <Editor
            key={controller.instance}
            controller={controller}
            published={published}
            t={t}
            compare={async (id) => {
              const r = await readDirectoryEntry(shopId, id);
              if (!session.alive()) throw Error("Access ended");
              setPublished(r.revision);
            }}
            rebase={(v) => open(v, undefined, true)}
          />
          <Button
            variant="ghost"
            onClick={() => {
              if (controller.confirmLeave(() => window.confirm(t("discard")))) {
                session.scope.release(controller);
                setController(undefined);
                address();
              }
            }}
          >
            {t("cancel")}
          </Button>
        </>
      )}
    </section>
  );
}
