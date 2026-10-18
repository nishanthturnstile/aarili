import { reauthenticateOwner } from "@aarili/api/client";
import {
  readCatalogueDefinition,
  readCatalogueEntry,
  readCatalogueHistory,
  readServiceCatalogue,
} from "@aarili/api/service-catalogue-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type CatalogueContent,
  type CatalogueDraft,
  type CatalogueRevision,
  catalogueCommandSchema,
  catalogueDraftSchema,
} from "@aarili/contracts/service-catalogue";
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

type T = ReturnType<typeof useTranslations<"catalogue">>;
type Listed = Awaited<
  ReturnType<typeof readServiceCatalogue>
>["entries"][number];
function focusTask(target: HTMLElement | null) {
  target?.focus();
  target?.scrollIntoView({ block: "start" });
}
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "catalogue");
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function empty(kind: CatalogueContent["kind"]): CatalogueContent {
  return {
    kind,
    code: "",
    labelEn: "",
    labelTa: "",
    description: "",
    aliases: [],
    parent: null,
    serviceKind: kind === "service" ? "stitching" : null,
    warningDays: null,
    pieces: [],
    addons: [],
  };
}
function ReferenceName({
  shopId,
  id,
  t,
}: {
  shopId: string;
  id: string;
  t: T;
}) {
  const locale = useLocale();
  const [definition, setDefinition] = useState<Awaited<
    ReturnType<typeof readCatalogueDefinition>
  > | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setDefinition(null);
    setFailed(false);
    void readCatalogueDefinition(shopId, id).then(
      (r) => {
        if (active) setDefinition(r);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [shopId, id]);
  return (
    <>
      <span>
        {definition
          ? locale === "ta"
            ? definition.content.labelTa
            : definition.content.labelEn
          : t(failed ? "error" : "loading")}
      </span>
      <details className="catalogue-reference">
        <summary>{t("pinnedDefinition")}</summary>
        <span className="shop-actor">{id}</span>
      </details>
    </>
  );
}
function ContentView({
  content: c,
  t,
  shopId,
}: {
  content: CatalogueContent;
  t: T;
  shopId: string;
}) {
  return (
    <dl className="shop-profile-values">
      {[
        "kind",
        "code",
        "labelEn",
        "labelTa",
        "description",
        "serviceKind",
        "warningDays",
      ].map((key) => (
        <div key={key}>
          <dt>{t(key as Parameters<T>[0])}</dt>
          <dd>
            {key === "kind"
              ? t(c.kind)
              : key === "serviceKind"
                ? c.serviceKind
                  ? t(c.serviceKind)
                  : t("unknown")
                : key === "warningDays" && c.warningDays === null
                  ? t("noCategoryOverride")
                  : String(c[key as keyof CatalogueContent] ?? t("unknown")) ||
                    t("unknown")}
          </dd>
        </div>
      ))}
      <div>
        <dt>{t("aliases")}</dt>
        <dd>{c.aliases.join(", ") || t("unknown")}</dd>
      </div>
      <div>
        <dt>{t("parent")}</dt>
        <dd className="shop-actor">
          {c.parent ? (
            <ReferenceName shopId={shopId} id={c.parent.revisionId} t={t} />
          ) : (
            t("unknown")
          )}
        </dd>
      </div>
      {(["pieces", "addons"] as const).map((role) => (
        <div key={role}>
          <dt>{t(role)}</dt>
          <dd>
            {c[role].length ? (
              <ul>
                {c[role].map((ref) => (
                  <li className="shop-actor" key={ref.entryId}>
                    <ReferenceName shopId={shopId} id={ref.revisionId} t={t} />{" "}
                    — {t(ref.optional ? "optional" : "required")}
                  </li>
                ))}
              </ul>
            ) : (
              t("unknown")
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ReferencePicker({
  shopId,
  referenceKind,
  selected,
  onChange,
  t,
}: {
  shopId: string;
  referenceKind: "parent" | "pieces" | "addons";
  selected: CatalogueContent["pieces"];
  onChange: (refs: CatalogueContent["pieces"]) => void;
  t: T;
}) {
  const [term, setTerm] = useState(""),
    [rows, setRows] = useState<Listed[]>([]),
    [next, setNext] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const locale = useLocale();
  const search = async (before?: string) => {
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceCatalogue(shopId, before, term);
      setRows((v) => (before ? [...v, ...r.entries] : r.entries));
      setNext(r.next);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset>
      <legend>{t(referenceKind)}</legend>
      <Field>
        <FieldLabel htmlFor={`refs-${referenceKind}`}>
          {t("searchReferences")}
        </FieldLabel>
        <Input
          id={`refs-${referenceKind}`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          maxLength={160}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void search()}
      >
        {t("search")}
      </Button>
      {failed && <p role="alert">{t("error")}</p>}
      {rows
        .filter(
          (r) =>
            r.configurationEligible &&
            (referenceKind === "parent"
              ? ["category", "subcategory"].includes(r.definition.content.kind)
              : r.definition.content.kind ===
                (referenceKind === "pieces" ? "piece" : "addon")),
        )
        .map((r) => (
          <label key={r.entryId} className="directory-check">
            <input
              type="checkbox"
              checked={selected.some((x) => x.entryId === r.entryId)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? referenceKind === "parent"
                      ? [
                          {
                            entryId: r.entryId,
                            revisionId: r.definition.id,
                            optional: false,
                          },
                        ]
                      : [
                          ...selected.filter((x) => x.entryId !== r.entryId),
                          {
                            entryId: r.entryId,
                            revisionId: r.definition.id,
                            optional: false,
                          },
                        ]
                    : selected.filter((x) => x.entryId !== r.entryId),
                )
              }
            />
            {locale === "ta"
              ? r.definition.content.labelTa
              : r.definition.content.labelEn}
          </label>
        ))}
      {next && (
        <Button type="button" disabled={busy} onClick={() => void search(next)}>
          {t("more")}
        </Button>
      )}
      <ol>
        {selected.map((r, i) => (
          <li key={r.entryId}>
            <div className="shop-actor">
              <ReferenceName shopId={shopId} id={r.revisionId} t={t} />
            </div>
            {referenceKind !== "parent" && (
              <label className="directory-check">
                <input
                  type="checkbox"
                  checked={r.optional}
                  onChange={(e) =>
                    onChange(
                      selected.map((x) =>
                        x.entryId === r.entryId
                          ? { ...x, optional: e.target.checked }
                          : x,
                      ),
                    )
                  }
                />
                {t("optional")}
              </label>
            )}
            <div className="calendar-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onChange(selected.filter((x) => x.entryId !== r.entryId))
                }
              >
                {t("remove")}
              </Button>
              {referenceKind !== "parent" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={i === 0}
                    onClick={() => {
                      const a = [...selected];
                      const other = a[i - 1];
                      if (!other) return;
                      [a[i - 1], a[i]] = [r, other];
                      onChange(a);
                    }}
                  >
                    {t("up")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={i === selected.length - 1}
                    onClick={() => {
                      const a = [...selected];
                      const other = a[i + 1];
                      if (!other) return;
                      [a[i + 1], a[i]] = [r, other];
                      onChange(a);
                    }}
                  >
                    {t("down")}
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </fieldset>
  );
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
  published: CatalogueRevision | null;
  compare: (id: string) => Promise<void>;
  rebase: (v: CatalogueDraft) => void;
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
  const parsed = catalogueDraftSchema.safeParse(s.values);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("invalidDraft")}</p>;
  const v = parsed.data,
    c = v.content,
    valid = catalogueCommandSchema.safeParse(v),
    inactive = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  const edit = (content: CatalogueContent) => {
    setReview(false);
    setCompared(false);
    controller.edit({ ...v, content });
  };
  const text = (
    key: "code" | "labelEn" | "labelTa" | "description",
    max: number,
  ) => {
    const invalid =
      !valid.success && valid.error.issues.some((i) => i.path[1] === key);
    return (
      <Field key={key}>
        <FieldLabel htmlFor={`catalogue-${key}`}>{t(key)}</FieldLabel>
        <Input
          id={`catalogue-${key}`}
          value={c[key]}
          maxLength={max}
          autoComplete="off"
          disabled={
            v.operation === "availability" ||
            (key === "code" && v.baseVersion > 0)
          }
          aria-invalid={invalid}
          aria-describedby={invalid ? "directory-validation" : undefined}
          onChange={(e) => edit({ ...c, [key]: e.target.value })}
        />
      </Field>
    );
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
                  <ContentView
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
                catalogueDraftSchema.safeParse(s.conflict.payload).success && (
                  <>
                    <h4>{t("serverDraft")}</h4>
                    <ContentView
                      shopId={shopId}
                      content={
                        catalogueDraftSchema.parse(s.conflict.payload).content
                      }
                      t={t}
                    />
                    <p>
                      {t(
                        catalogueDraftSchema.parse(s.conflict.payload).available
                          ? "enabled"
                          : "disabled",
                      )}{" "}
                      - {catalogueDraftSchema.parse(s.conflict.payload).reason}
                    </p>
                  </>
                )}
              <h4>{t("yours")}</h4>
              <ContentView shopId={shopId} content={c} t={t} />
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
          {text("code", 80)}
          {text("labelEn", 160)}
          {text("labelTa", 160)}
          {text("description", 2000)}
          <Field>
            <FieldLabel htmlFor="catalogue-aliases">{t("aliases")}</FieldLabel>
            <Input
              id="catalogue-aliases"
              value={c.aliases.join(",")}
              maxLength={3200}
              onChange={(e) =>
                edit({
                  ...c,
                  aliases: e.target.value
                    ? e.target.value.split(",").slice(0, 20)
                    : [],
                })
              }
            />
          </Field>
          {c.kind === "category" && (
            <Field>
              <FieldLabel htmlFor="catalogue-warning">
                {t("warningDays")}
              </FieldLabel>
              <Input
                id="catalogue-warning"
                type="number"
                min={0}
                max={3660}
                step={1}
                inputMode="numeric"
                value={c.warningDays ?? ""}
                aria-invalid={
                  !valid.success &&
                  valid.error.issues.some((i) => i.path[1] === "warningDays")
                }
                aria-describedby="catalogue-warning-hint"
                onChange={(e) =>
                  edit({
                    ...c,
                    warningDays:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <p id="catalogue-warning-hint">{t("warningHint")}</p>
            </Field>
          )}
          {c.kind === "service" && (
            <Field>
              <FieldLabel htmlFor="catalogue-service-kind">
                {t("serviceKind")}
              </FieldLabel>
              <select
                className="ui-input"
                id="catalogue-service-kind"
                value={c.serviceKind ?? ""}
                onChange={(e) =>
                  edit({
                    ...c,
                    serviceKind: e.target
                      .value as CatalogueContent["serviceKind"],
                  })
                }
              >
                {(["stitching", "alteration", "small-service"] as const).map(
                  (k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ),
                )}
              </select>
            </Field>
          )}
          {["subcategory", "service"].includes(c.kind) && (
            <ReferencePicker
              shopId={shopId}
              referenceKind="parent"
              selected={c.parent ? [{ ...c.parent, optional: false }] : []}
              onChange={(r) =>
                edit({
                  ...c,
                  parent: r[0]
                    ? { entryId: r[0].entryId, revisionId: r[0].revisionId }
                    : null,
                })
              }
              t={t}
            />
          )}
          {c.kind === "service" &&
            (["pieces", "addons"] as const).map((role) => (
              <ReferencePicker
                key={role}
                shopId={shopId}
                referenceKind={role}
                selected={c[role]}
                onChange={(r) => edit({ ...c, [role]: r })}
                t={t}
              />
            ))}
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
          <FieldLabel htmlFor="catalogue-reason">{t("reason")}</FieldLabel>
          <Input
            id="catalogue-reason"
            value={v.reason}
            maxLength={1000}
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
              <ContentView
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
          <ContentView shopId={shopId} content={c} t={t} />
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
export function ServiceCatalogueScreen({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const t = useTranslations("catalogue"),
    locale = useLocale();
  const [session, setSession] = useState<{
      scope: ReturnType<typeof createDraftScope>;
      alive: () => boolean;
    }>(),
    [entries, setEntries] = useState<Listed[]>([]),
    [next, setNext] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const [controller, setController] = useState<DraftRecovery>(),
    [published, setPublished] = useState<CatalogueRevision | null>(null),
    [detail, setDetail] = useState<CatalogueRevision | null>(null),
    [history, setHistory] = useState<CatalogueRevision[]>([]),
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
          readServiceCatalogue(shopId),
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
            record.workflow !== "service.catalogue" ||
            !catalogueDraftSchema.safeParse(record.payload).success
          )
            throw Error("Incompatible draft");
          const v = catalogueDraftSchema.parse(record.payload);
          const current = await readCatalogueEntry(shopId, v.entryId);
          if (!alive()) return;
          setPublished(current.revision);
          setController(
            scope.open({
              workflow: "service.catalogue",
              schemaVersion: 1,
              initial: v,
              record,
              committed: (r) => {
                if (alive() && r.lifecycle === "promoted") {
                  address();
                  void readServiceCatalogue(shopId).then((l) => {
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
    const l = await readServiceCatalogue(shopId);
    if (!session?.alive()) return;
    setEntries(l.entries);
    setNext(l.next);
  };
  const open = (v: CatalogueDraft, record?: DraftRecord, preserve = false) => {
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
      workflow: "service.catalogue",
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
  const start = (kind: CatalogueContent["kind"]) => {
    setPublished(null);
    open({
      entryId: v7(),
      baseVersion: 0,
      baseRevisionId: null,
      content: empty(kind),
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
        <FieldLabel htmlFor="catalogue-search">{t("search")}</FieldLabel>
        <Input
          id="catalogue-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={160}
        />
      </Field>
      <Button
        disabled={busy}
        onClick={() =>
          void attempt(async () => {
            const l = await readServiceCatalogue(shopId, undefined, search);
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
        {(
          ["category", "subcategory", "service", "piece", "addon"] as const
        ).map((kind) => (
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
                  const r = await readCatalogueEntry(shopId, e.entryId);
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
              const l = await readServiceCatalogue(shopId, next, search);
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
          <ContentView
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
                  const current = await readCatalogueEntry(
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
                  const r = await readCatalogueEntry(shopId, detail.entryId);
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
                  const h = await readCatalogueHistory(shopId, detail.entryId);
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
              <ContentView
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
                  const h = await readCatalogueHistory(
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
            (d) =>
              d.workflow === "service.catalogue" && d.lifecycle === "active",
          )
          .map((d) => (
            <div key={d.id}>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void attempt(async () => {
                    const record = await session.scope.read(d.id);
                    const v = catalogueDraftSchema.parse(record.payload);
                    const current = await readCatalogueEntry(shopId, v.entryId);
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
              const r = await readCatalogueEntry(shopId, id);
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
