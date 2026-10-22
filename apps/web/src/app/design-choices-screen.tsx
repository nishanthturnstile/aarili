import { reauthenticateOwner } from "@aarili/api/client";
import {
  readDesignChoices,
  readDesignChoicesEntry,
  readDesignChoicesHistory,
} from "@aarili/api/design-choices-client";
import {
  type DesignChoicesContent,
  type DesignChoicesDraft,
  type DesignChoicesRevision,
  designChoicesCommandSchema,
  designChoicesDraftSchema,
  emptyDesignChoicesContent,
} from "@aarili/contracts/design-choices";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { v7 } from "uuid";
import {
  DesignContentEditor,
  DesignContentView,
} from "./design-choice-content";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type T = ReturnType<typeof useTranslations<"designChoices">>;
type Listed = Awaited<ReturnType<typeof readDesignChoices>>["entries"][number];
function focusTask(target: HTMLElement | null) {
  target?.focus();
  target?.scrollIntoView({ block: "start" });
}
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "design-choices");
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function Editor({
  shopId,
  controller,
  published,
  compare,
  rebase,
  t,
}: {
  shopId: string;
  controller: DraftRecovery;
  published: DesignChoicesRevision | null;
  compare: (id: string) => Promise<void>;
  rebase: (v: DesignChoicesDraft) => void;
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
  const parsed = designChoicesDraftSchema.safeParse(s.values);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("invalidDraft")}</p>;
  const v = parsed.data,
    c = v.content,
    valid = designChoicesCommandSchema.safeParse(v),
    inactive = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  const edit = (content: DesignChoicesContent) => {
    setReview(false);
    setCompared(false);
    controller.edit({ ...v, content });
  };

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
                <>
                  <DesignContentView
                    shopId={shopId}
                    content={published.definition.content}
                    t={t}
                  />
                  <p>
                    {t(published.available ? "enabled" : "disabled")} -{" "}
                    {published.reason}
                  </p>
                </>
              ) : (
                <p>{t("unknown")}</p>
              )}
              {s.conflict &&
                designChoicesDraftSchema.safeParse(s.conflict.payload)
                  .success && (
                  <>
                    <h4>{t("serverDraft")}</h4>
                    <DesignContentView
                      shopId={shopId}
                      content={
                        designChoicesDraftSchema.parse(s.conflict.payload)
                          .content
                      }
                      t={t}
                    />
                    <p>
                      {t(
                        designChoicesDraftSchema.parse(s.conflict.payload)
                          .available
                          ? "enabled"
                          : "disabled",
                      )}{" "}
                      -{" "}
                      {
                        designChoicesDraftSchema.parse(s.conflict.payload)
                          .reason
                      }
                    </p>
                  </>
                )}
              <h4>{t("yours")}</h4>
              <DesignContentView shopId={shopId} content={c} t={t} />
              <p>
                {t(v.available ? "enabled" : "disabled")} — {v.reason}
              </p>
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
        <p>{t(v.operation)}</p>
        <fieldset disabled={v.operation === "availability"}>
          <DesignContentEditor
            shopId={shopId}
            content={c}
            onChange={edit}
            issues={valid.success ? [] : valid.error.issues}
          />
        </fieldset>
        <label className="directory-check">
          <input
            type="checkbox"
            checked={v.available}
            onChange={(e) => {
              setReview(false);
              controller.edit({ ...v, available: e.target.checked });
            }}
          />
          {t("available")}
        </label>
        <Field>
          <FieldLabel htmlFor="designChoices-reason">{t("reason")}</FieldLabel>
          <Input
            id="designChoices-reason"
            value={v.reason}
            maxLength={1000}
            aria-describedby={
              !valid.success &&
              valid.error.issues.some((i) => i.path[0] === "reason")
                ? "directory-validation"
                : undefined
            }
            aria-invalid={
              !valid.success &&
              valid.error.issues.some((i) => i.path[0] === "reason")
            }
            onChange={(e) => {
              setReview(false);
              controller.edit({ ...v, reason: e.target.value });
            }}
          />
        </Field>
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
            <>
              <DesignContentView
                shopId={shopId}
                content={published.definition.content}
                t={t}
              />
              <p>
                {t(published.available ? "enabled" : "disabled")} -{" "}
                {published.reason}
              </p>
            </>
          ) : (
            <p>{t("unknown")}</p>
          )}
          <h5>{t("yours")}</h5>
          <DesignContentView shopId={shopId} content={c} t={t} />
          <p>
            {t(v.available ? "enabled" : "disabled")} — {v.reason}
          </p>
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
export function DesignChoicesScreen({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const t = useTranslations("designChoices"),
    locale = useLocale();
  const [session, setSession] = useState<{
      scope: ReturnType<typeof createDraftScope>;
      alive: () => boolean;
    }>(),
    [entries, setEntries] = useState<Listed[]>([]),
    [next, setNext] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const [controller, setController] = useState<DraftRecovery>(),
    [published, setPublished] = useState<DesignChoicesRevision | null>(null),
    [detail, setDetail] = useState<DesignChoicesRevision | null>(null),
    [history, setHistory] = useState<DesignChoicesRevision[]>([]),
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
          readDesignChoices(shopId),
          scope.list(),
        ]);
        if (!alive()) return;
        setEntries(list.entries);
        setNext(list.next);
        setDrafts(recovery.drafts);
        setCursor(recovery.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (
            record.workflow !== "design.choices" ||
            !designChoicesDraftSchema.safeParse(record.payload).success
          )
            throw Error("Incompatible draft");
          const v = designChoicesDraftSchema.parse(record.payload);
          const current = await readDesignChoicesEntry(shopId, v.entryId);
          if (!alive()) return;
          setPublished(current.revision);
          setController(
            scope.open({
              workflow: "design.choices",
              schemaVersion: 1,
              initial: v,
              record,
              committed: (r) => {
                if (alive() && r.lifecycle === "promoted") {
                  address();
                  void readDesignChoices(shopId).then((l) => {
                    if (alive()) {
                      setEntries(l.entries);
                      setNext(l.next);
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
    const l = await readDesignChoices(shopId);
    if (!session?.alive()) return;
    setEntries(l.entries);
    setNext(l.next);
  };
  const open = (
    v: DesignChoicesDraft,
    record?: DraftRecord,
    preserve = false,
  ) => {
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
      workflow: "design.choices",
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
  const start = (kind: DesignChoicesContent["kind"]) => {
    setPublished(null);
    open({
      entryId: v7(),
      baseVersion: 0,
      baseRevisionId: null,
      content: emptyDesignChoicesContent(kind),
      operation: "definition",
      available: false,
      reason: "",
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
      <Field>
        <FieldLabel htmlFor="designChoices-search">{t("search")}</FieldLabel>
        <Input
          id="designChoices-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={160}
        />
      </Field>
      <Button
        disabled={busy}
        onClick={() =>
          void attempt(async () => {
            const l = await readDesignChoices(shopId, undefined, search);
            if (session.alive()) {
              setEntries(l.entries);
              setNext(l.next);
            }
          })
        }
      >
        {t("search")}
      </Button>
      {failed && <p role="alert">{t("error")}</p>}
      <div className="calendar-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void attempt(refresh)}
        >
          {t("refresh")}
        </Button>
        {(["choice", "profile"] as const).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={busy}
            onClick={() => start(kind)}
          >
            {t("addKind", { kind: t(kind) })}
          </Button>
        ))}
      </div>
      {entries.length === 0 && <p>{t("empty")}</p>}
      <ul className="directory-list">
        {entries.map((e) => (
          <li key={e.entryId}>
            <div>
              <h3>
                {locale === "ta"
                  ? e.definition.content.labelTa
                  : e.definition.content.labelEn}
              </h3>
              <p>
                {t(e.definition.content.kind)} ·{" "}
                {t(e.available ? "enabled" : "disabled")}
                {!e.configurationEligible &&
                  e.available &&
                  ` · ${t("referencesUnavailable")}`}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const r = await readDesignChoicesEntry(shopId, e.entryId);
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
              const l = await readDesignChoices(shopId, next, search);
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
            {locale === "ta"
              ? detail.definition.content.labelTa
              : detail.definition.content.labelEn}
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
          <DesignContentView
            shopId={shopId}
            content={detail.definition.content}
            t={t}
          />
          <p>
            {t(detail.available ? "enabled" : "disabled")} —{" "}
            {t(detail.definition.authority)}
          </p>
          <p>{detail.reason}</p>
          <div className="calendar-actions">
            <Button
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const current = await readDesignChoicesEntry(
                    shopId,
                    detail.entryId,
                  );
                  if (!session.alive() || !current.revision) return;
                  setPublished(current.revision);
                  open({
                    entryId: current.revision.entryId,
                    baseVersion: current.revision.version,
                    baseRevisionId: current.revision.id,
                    content: current.revision.definition.content,
                    operation: "definition",
                    available: false,
                    reason: "",
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
                  const r = await readDesignChoicesEntry(
                    shopId,
                    detail.entryId,
                  );
                  if (!session.alive() || !r.revision) return;
                  setPublished(r.revision);
                  open({
                    entryId: r.revision.entryId,
                    baseVersion: r.revision.version,
                    baseRevisionId: r.revision.id,
                    operation: "availability",
                    content: r.revision.definition.content,
                    available: !r.revision.available,
                    reason: "",
                  });
                })
              }
            >
              {t("availability")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const h = await readDesignChoicesHistory(
                    shopId,
                    detail.entryId,
                  );
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
              <DesignContentView
                shopId={shopId}
                content={r.definition.content}
                t={t}
              />
              <p>
                {t(r.available ? "enabled" : "disabled")} — {t(r.operation)}
              </p>
              <p>{r.reason}</p>
            </details>
          ))}
          {historyNext && detail && (
            <Button
              disabled={busy}
              onClick={() =>
                void attempt(async () => {
                  const h = await readDesignChoicesHistory(
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
            (d) => d.workflow === "design.choices" && d.lifecycle === "active",
          )
          .map((d) => (
            <div key={d.id}>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void attempt(async () => {
                    const record = await session.scope.read(d.id);
                    const v = designChoicesDraftSchema.parse(record.payload);
                    const current = await readDesignChoicesEntry(
                      shopId,
                      v.entryId,
                    );
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
            shopId={shopId}
            controller={controller}
            published={published}
            t={t}
            compare={async (id) => {
              const r = await readDesignChoicesEntry(shopId, id);
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
