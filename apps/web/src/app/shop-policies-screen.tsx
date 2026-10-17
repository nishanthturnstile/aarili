import {
  readShopPolicies,
  readShopPoliciesHistory,
  readShopPoliciesReadiness,
} from "@aarili/api/shop-policies-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  emptyPolicy,
  type PolicyReadiness,
  type PolicyValue,
  policyErrors,
  policyKinds,
  type ShopPoliciesDraft,
  type ShopPoliciesRevision,
  type ShopPoliciesState,
  shopPoliciesCommandSchema,
  shopPoliciesDraftSchema,
} from "@aarili/contracts/shop-policies";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type T = ReturnType<typeof useTranslations<"policies">>;
function address(id?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("section", "policies");
  if (id) url.searchParams.set("draft", id);
  else url.searchParams.delete("draft");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
function PolicyView({ policy, t }: { policy: PolicyValue; t: T }) {
  return (
    <dl className="shop-profile-values">
      <div>
        <dt>{t("decision")}</dt>
        <dd>{t(policy.state)}</dd>
      </div>
      <div>
        <dt>{t("authority")}</dt>
        <dd>
          {t(policy.authority.kind)} · {policy.authority.label || t("unknown")}
        </dd>
      </div>
      <div>
        <dt>{t("termsEn")}</dt>
        <dd className="policy-text" lang="en">
          {policy.terms.en || t("unknown")}
        </dd>
      </div>
      <div>
        <dt>{t("termsTa")}</dt>
        <dd className="policy-text" lang="ta">
          {policy.terms.ta || t("unknown")}
        </dd>
      </div>
      <div>
        <dt>{t("reason")}</dt>
        <dd className="policy-text">{policy.reason || t("unknown")}</dd>
      </div>
      {Object.entries(policy)
        .filter(
          ([k]) =>
            !["kind", "state", "terms", "reason", "authority"].includes(k),
        )
        .map(([key, value]) => (
          <div key={key}>
            <dt>{t(key as "percentageBps")}</dt>
            <dd>
              {value === null
                ? t("unknown")
                : typeof value === "boolean"
                  ? t(value ? "yes" : "no")
                  : typeof value === "string" &&
                      [
                        "owner",
                        "fixed-paise",
                        "percentage-bps",
                        "case-by-case",
                      ].includes(value)
                    ? t(value as "owner")
                    : String(value)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function Editor({
  controller,
  published,
  readiness,
  compare,
  rebase,
  t,
}: {
  controller: DraftRecovery;
  published: ShopPoliciesState;
  readiness: PolicyReadiness | undefined;
  compare: () => Promise<void>;
  rebase: (v: ShopPoliciesDraft) => void;
  t: T;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [review, setReview] = useState(false),
    [compared, setCompared] = useState(false),
    [comparisonFailed, setComparisonFailed] = useState(false);
  const parsed = shopPoliciesDraftSchema.safeParse(s.values);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("incompatible")}</p>;
  const v = parsed.data,
    p = v.policy,
    inactive = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  const edit = (policy: PolicyValue) => {
    setReview(false);
    setCompared(false);
    controller.edit({ ...v, policy });
  };
  const errors = policyErrors(p),
    valid = shopPoliciesCommandSchema.safeParse(v).success;
  return (
    <section className="shop-profile-form" aria-label={t("editor")}>
      <h3>{t(p.kind)}</h3>
      <p>
        {t("affectedActions")}:{" "}
        {readiness?.actions
          .filter((a) => a.reasons.some((r) => r.policy === p.kind))
          .map((a) => t(a.action))
          .join(" · ")}
      </p>
      <p role="status">
        {t(s.status)}
        {s.error
          ? ` · ${t(s.error === "RATE_LIMITED" ? "rateLimited" : "saveError")}`
          : ""}
      </p>
      {inactive && (
        <>
          <p>{t("readOnlyDraft")}</p>
          <Button
            onClick={() =>
              rebase({
                ...v,
                baseVersion: published.version,
                baseRevisionId: published.revision?.id ?? null,
              })
            }
          >
            {t("newDraft")}
          </Button>
        </>
      )}
      {s.status === "checking" && (
        <Button onClick={() => void controller.retry()}>{t("retry")}</Button>
      )}
      {s.status === "conflict" && (
        <section className="shop-conflict" aria-label={t("conflict")}>
          <h4>{t("conflict")}</h4>
          <p>{t("conflictHelp")}</p>
          <Button
            disabled={s.work.inFlight}
            onClick={() => {
              setCompared(false);
              setComparisonFailed(false);
              void Promise.all([controller.refreshConflict(), compare()])
                .then(() => setCompared(true))
                .catch(() => setComparisonFailed(true));
            }}
          >
            {t("compare")}
          </Button>
          {comparisonFailed && <p role="alert">{t("loadError")}</p>}
          {compared && (
            <>
              <h4>{t("published")}</h4>
              <PolicyView
                policy={
                  published.revision?.policies.find((x) => x.kind === p.kind) ??
                  emptyPolicy(p.kind)
                }
                t={t}
              />
              {s.conflict &&
                shopPoliciesDraftSchema.safeParse(s.conflict.payload)
                  .success && (
                  <>
                    <h4>{t("serverDraft")}</h4>
                    <PolicyView
                      policy={
                        shopPoliciesDraftSchema.parse(s.conflict.payload).policy
                      }
                      t={t}
                    />
                  </>
                )}
              <h4>{t("yourChanges")}</h4>
              <PolicyView policy={p} t={t} />
              {s.conflict?.lifecycle === "active" &&
                published.version === v.baseVersion && (
                  <Button
                    onClick={() => {
                      controller.resolveConflict("local");
                      setCompared(false);
                    }}
                  >
                    {t("keepLocal")}
                  </Button>
                )}
              {s.conflict && (
                <Button
                  variant="outline"
                  onClick={() => {
                    controller.resolveConflict("server");
                    setCompared(false);
                  }}
                >
                  {t("useServer")}
                </Button>
              )}
              <Button
                onClick={() =>
                  rebase({
                    ...v,
                    baseVersion: published.version,
                    baseRevisionId: published.revision?.id ?? null,
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
        className="calendar-editor"
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <legend>{t("decision")}</legend>
        <Field>
          <FieldLabel htmlFor="policy-state">{t("decision")}</FieldLabel>
          <select
            className="ui-input"
            id="policy-state"
            value={p.state}
            onChange={(e) =>
              edit({ ...p, state: e.target.value as PolicyValue["state"] })
            }
          >
            {(["draft", "reviewed", "not-applicable"] as const).map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </Field>
        <p>{t("fixtureHelp")}</p>
        <Field>
          <FieldLabel htmlFor="policy-authority">{t("authority")}</FieldLabel>
          <select
            className="ui-input"
            id="policy-authority"
            value={p.authority.kind}
            onChange={(e) =>
              edit({
                ...p,
                authority: {
                  ...p.authority,
                  kind: e.target.value as PolicyValue["authority"]["kind"],
                },
              })
            }
          >
            {(["owner-proposal", "synthetic-fixture"] as const).map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="policy-label">{t("authorityLabel")}</FieldLabel>
          <Input
            id="policy-label"
            maxLength={200}
            value={p.authority.label}
            onChange={(e) =>
              edit({
                ...p,
                authority: { ...p.authority, label: e.target.value },
              })
            }
          />
        </Field>
        {(["en", "ta"] as const).map((lang) => (
          <Field key={lang}>
            <FieldLabel htmlFor={`policy-${lang}`}>
              {t(lang === "en" ? "termsEn" : "termsTa")}
            </FieldLabel>
            <textarea
              className="ui-input policy-textarea"
              id={`policy-${lang}`}
              lang={lang}
              rows={4}
              maxLength={4000}
              value={p.terms[lang]}
              onChange={(e) =>
                edit({ ...p, terms: { ...p.terms, [lang]: e.target.value } })
              }
            />
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor="policy-reason">{t("reason")}</FieldLabel>
          <textarea
            className="ui-input policy-textarea"
            id="policy-reason"
            rows={2}
            maxLength={4000}
            value={p.reason}
            onChange={(e) => edit({ ...p, reason: e.target.value })}
          />
        </Field>
        <p>{t("numericHelp")}</p>
        {Object.entries(p)
          .filter(
            ([k]) =>
              !["kind", "state", "terms", "reason", "authority"].includes(k),
          )
          .map(([key, value]) => {
            const choices =
              key === "approval"
                ? ["owner"]
                : key === "chargeBasis"
                  ? ["fixed-paise", "percentage-bps", "case-by-case"]
                  : key === "allowed"
                    ? ["yes", "no"]
                    : null;
            return (
              <Field key={key}>
                <FieldLabel htmlFor={`policy-${key}`}>
                  {t(key as "percentageBps")}
                </FieldLabel>
                {choices ? (
                  <select
                    className="ui-input"
                    id={`policy-${key}`}
                    value={
                      value === null
                        ? ""
                        : typeof value === "boolean"
                          ? value
                            ? "yes"
                            : "no"
                          : String(value)
                    }
                    onChange={(e) =>
                      edit({
                        ...p,
                        [key]:
                          e.target.value === ""
                            ? null
                            : key === "allowed"
                              ? e.target.value === "yes"
                              : e.target.value,
                      })
                    }
                  >
                    <option value="">{t("unknown")}</option>
                    {choices.map((x) => (
                      <option key={x} value={x}>
                        {t(x as "owner")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`policy-${key}`}
                    inputMode="numeric"
                    type={key.endsWith("Paise") ? "text" : "number"}
                    maxLength={key.endsWith("Paise") ? 32 : undefined}
                    step="1"
                    value={value === null ? "" : String(value)}
                    onChange={(e) =>
                      edit({
                        ...p,
                        [key]:
                          e.target.value === ""
                            ? null
                            : key.endsWith("Paise")
                              ? e.target.value
                              : Number(e.target.value),
                      })
                    }
                  />
                )}
              </Field>
            );
          })}
      </fieldset>
      {errors.length > 0 && (
        <div role="status">
          {errors.map((code) => (
            <p key={code}>{t(code as "authorityGate")}</p>
          ))}
        </div>
      )}
      {!inactive && (
        <div className="calendar-actions">
          <Button
            variant="outline"
            disabled={busy || s.status === "conflict"}
            onClick={() => void controller.save()}
          >
            {t("saveDraft")}
          </Button>
          <Button
            disabled={!valid || s.status !== "saved" || s.work.dirty}
            onClick={() => setReview(true)}
          >
            {t("review")}
          </Button>
        </div>
      )}
      {review && valid && s.status !== "conflict" && !inactive && (
        <section className="calendar-review" aria-label={t("review")}>
          <h4>{t("review")}</h4>
          <p>{t("publishHelp")}</p>
          <h5>{t("published")}</h5>
          <PolicyView
            policy={
              published.revision?.policies.find((x) => x.kind === p.kind) ??
              emptyPolicy(p.kind)
            }
            t={t}
          />
          <h5>{t("yourChanges")}</h5>
          <PolicyView policy={p} t={t} />
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

type Props = {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
};
export function ShopPoliciesScreen({ shopId, queries, guard }: Props) {
  const t = useTranslations("policies"),
    locale = useLocale();
  const [session, setSession] = useState<{
    scope: ReturnType<typeof createDraftScope>;
    alive: () => boolean;
  }>();
  const [readiness, setReadiness] = useState<PolicyReadiness>();
  const [state, setState] = useState<ShopPoliciesState>();
  const [controller, setController] = useState<DraftRecovery>();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<DraftCursor | null>(null);
  const [history, setHistory] = useState<ShopPoliciesRevision[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [initialFailed, setInitialFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retrying recreates the scope and repeats both initial reads while retaining the draft URL.
  useEffect(() => {
    setFailed(false);
    setInitialFailed(false);
    setState(undefined);
    setController(undefined);
    setDrafts([]);
    setHistory([]);
    setCursor(null);
    setNext(null);
    let mounted = true;
    const version = queries.version(),
      scope = createDraftScope(shopId, guard);
    const alive = () => mounted && queries.isCurrent(version);
    const current = { scope, alive };
    setSession(current);
    const load = async () => {
      try {
        const [published, list] = await Promise.all([
          readShopPolicies(shopId),
          scope.list(),
        ]);
        if (!alive()) return;
        setState(published);
        const ready = await readShopPoliciesReadiness(shopId);
        if (!alive()) return;
        setReadiness(ready);
        setDrafts(list.drafts);
        setCursor(list.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (
            record.workflow !== "shop.policies" ||
            record.schemaVersion !== 1 ||
            !shopPoliciesDraftSchema.safeParse(record.payload).success
          ) {
            setFailed(true);
            setInitialFailed(true);
            return;
          }
          setController(
            scope.open({
              workflow: "shop.policies",
              schemaVersion: 1,
              initial: record.payload,
              record,
              committed: (r) => {
                if (alive() && r.lifecycle === "promoted") {
                  address();
                  void readShopPolicies(shopId).then((s) => {
                    if (alive()) setState(s);
                  });
                }
              },
            }),
          );
        }
      } catch {
        if (alive()) {
          setFailed(true);
          setInitialFailed(true);
        }
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
    const fresh = await readShopPolicies(shopId);
    if (!session?.alive()) throw Error("Access ended");
    setState(fresh);
    const ready = await readShopPoliciesReadiness(shopId);
    if (session?.alive()) setReadiness(ready);
  };
  const open = (
    v: ShopPoliciesDraft,
    record?: DraftRecord,
    preservingChanges = false,
  ) => {
    if (
      !session?.alive() ||
      (controller &&
        !preservingChanges &&
        !controller.confirmLeave(() => window.confirm(t("discard"))))
    )
      return;
    if (controller) session.scope.release(controller);
    const active = session.scope.open({
      workflow: "shop.policies",
      schemaVersion: 1,
      initial: v,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!session.alive()) return;
        if (r.lifecycle === "active") address(r.id);
        if (r.lifecycle === "promoted") {
          address();
          void attempt(refresh);
        }
      },
    });
    setController(active);
    if (!record) {
      address();
      active.edit(v);
    } else address(record.id);
  };
  if (!state || !session)
    return (
      <div>
        <p role="status">{t(failed ? "loadError" : "loading")}</p>
        {initialFailed && (
          <Button onClick={() => setLoadAttempt((n) => n + 1)}>
            {t("retryLoad")}
          </Button>
        )}
      </div>
    );
  return (
    <section className="shop-settings-main" aria-label={t("title")}>
      <h2>{t("title")}</h2>
      <p>{t("intro")}</p>
      <p>{t("fixtureHelp")}</p>
      <p>{t("communication")}</p>
      <details className="shop-profile-history">
        <summary>{t("readiness")}</summary>
        {!readiness ? (
          <p role="status">{t("loading")}</p>
        ) : (
          <dl className="shop-profile-values">
            {readiness.actions.map((a) => (
              <div key={a.action}>
                <dt>{t(a.action)}</dt>
                <dd>
                  {t(a.state)}
                  {a.reasons.map((r) => (
                    <p key={`${r.code}-${r.policy ?? ""}`}>
                      {r.policy ? `${t(r.policy)}: ` : ""}
                      {t(r.code)}
                    </p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </details>
      {failed && <p role="alert">{t("loadError")}</p>}
      {initialFailed && (
        <Button onClick={() => setLoadAttempt((n) => n + 1)}>
          {t("retryLoad")}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void attempt(refresh)}
      >
        {t("refresh")}
      </Button>
      <p>
        {state.revision
          ? t("version", { version: state.version })
          : t("unconfigured")}
      </p>
      <div className="calendar-actions">
        {policyKinds.map((kind) => (
          <Button
            key={kind}
            variant="outline"
            disabled={busy}
            onClick={() =>
              open({
                baseVersion: state.version,
                baseRevisionId: state.revision?.id ?? null,
                policy:
                  state.revision?.policies.find((p) => p.kind === kind) ??
                  emptyPolicy(kind),
              })
            }
          >
            {t(kind)}
          </Button>
        ))}
      </div>
      {controller && (
        <Editor
          key={controller.instance}
          controller={controller}
          published={state}
          readiness={readiness}
          compare={refresh}
          rebase={(v) => open(v, undefined, true)}
          t={t}
        />
      )}
      {controller && (
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
          {t("cancelEditing")}
        </Button>
      )}
      {!controller &&
        policyKinds.map((kind) => (
          <details key={kind}>
            <summary>{t(kind)}</summary>
            {state.revision?.policies.find((p) => p.kind === kind) ? (
              <PolicyView
                policy={
                  state.revision.policies.find((p) => p.kind === kind) ??
                  emptyPolicy(kind)
                }
                t={t}
              />
            ) : (
              <p>{t("unconfigured")}</p>
            )}
          </details>
        ))}
      <section className="shop-profile-history">
        <h3>{t("resume")}</h3>
        {drafts
          .filter(
            (d) => d.workflow === "shop.policies" && d.lifecycle === "active",
          )
          .map((d) => (
            <Button
              key={d.id}
              variant="outline"
              disabled={busy}
              onClick={() => {
                const parsed = shopPoliciesDraftSchema.safeParse(d.payload);
                if (d.schemaVersion !== 1 || !parsed.success) {
                  setFailed(true);
                  return;
                }
                open(parsed.data, d);
              }}
            >
              {t("draft")} ·{" "}
              {new Date(d.updatedAt).toLocaleString(
                locale === "ta" ? "ta-IN" : "en-IN",
                { timeZone: "Asia/Kolkata" },
              )}
            </Button>
          ))}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              const list = await session.scope.list();
              if (session.alive()) {
                setDrafts(list.drafts);
                setCursor(list.next);
              }
            })
          }
        >
          {t("refreshDrafts")}
        </Button>
        {cursor && (
          <Button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const list = await session.scope.list(cursor);
                if (session.alive()) {
                  setDrafts((d) => [...d, ...list.drafts]);
                  setCursor(list.next);
                }
              })
            }
          >
            {t("more")}
          </Button>
        )}
      </section>
      <section className="shop-profile-history">
        <h3>{t("history")}</h3>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              const h = await readShopPoliciesHistory(shopId);
              if (session.alive()) {
                setHistory(h.revisions);
                setNext(h.next);
              }
            })
          }
        >
          {t("loadHistory")}
        </Button>
        {history.map((r) => (
          <details key={r.id}>
            <summary>
              {t("version", { version: r.version })} ·{" "}
              {new Date(r.effectiveAt).toLocaleString(
                locale === "ta" ? "ta-IN" : "en-IN",
                { timeZone: "Asia/Kolkata" },
              )}
            </summary>
            <p className="shop-actor">
              {t("author")}: {r.actorId}
            </p>
            <p>{t(r.authorityScope)}</p>
            {r.policies.map((policy) => (
              <section key={policy.kind}>
                <h4>{t(policy.kind)}</h4>
                <PolicyView policy={policy} t={t} />
              </section>
            ))}
          </details>
        ))}
        {next && (
          <Button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const h = await readShopPoliciesHistory(shopId, next);
                if (session.alive()) {
                  setHistory((rows) => [...rows, ...h.revisions]);
                  setNext(h.next);
                }
              })
            }
          >
            {t("more")}
          </Button>
        )}
      </section>
    </section>
  );
}
