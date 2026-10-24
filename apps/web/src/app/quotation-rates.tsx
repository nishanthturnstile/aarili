import {
  listQuotationRates,
  quotationPolicyHistory,
  quotationRateHistory,
  resolveQuotationRate,
} from "@aarili/api/quotation-rates-client";
import { readServiceCatalogue } from "@aarili/api/service-catalogue-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  emptyRate,
  type QuotePolicyBinding,
  type QuotePolicyReviewDraft,
  quotePolicyKinds,
  quotePolicyReviewCommandSchema,
  quotePolicyReviewDraftSchema,
  type RateDraft,
  type RateRevision,
  rateCommandSchema,
  rateComponents,
  rateDraftSchema,
} from "@aarili/contracts/quotation-rates";
import { shopPoliciesDraftSchema } from "@aarili/contracts/shop-policies";
import { type Locale, quotationRateMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { v7 } from "uuid";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type T = (typeof quotationRateMessages)[Locale];
type Catalogue = Awaited<ReturnType<typeof readServiceCatalogue>>;
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "rates");
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function RateView({ r, t, locale }: { r: RateRevision; t: T; locale: Locale }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <>
      <h3>
        {locale === "ta" ? r.labelTa : r.labelEn} · {t[r.component]}
      </h3>
      <p>
        {t.version} {r.version} ·{" "}
        {r.authority === "synthetic-only" ? t.fixture : t.owner} ·{" "}
        {r.available ? t.available : t.inactive}
      </p>
      <p>
        {t.basis}: {r.basisQuantity} {t[r.unit]}
      </p>
      <dl className="shop-profile-values">
        <div>
          <dt>{t.sourceId}</dt>
          <dd className="shop-actor">{r.source.revisionId}</dd>
        </div>
        <div>
          <dt>{t.actor}</dt>
          <dd className="shop-actor">{r.actorId}</dd>
        </div>
        <div>
          <dt>{t.recorded}</dt>
          <dd>{r.recordedAt}</dd>
        </div>
      </dl>
      <details>
        <summary>{t.hash}</summary>
        <p className="shop-actor">{r.contentHash}</p>
      </details>
      {r.entries.map((e) => (
        <p key={e.entryId}>
          {e.from > today
            ? t.future
            : e.until && e.until <= today
              ? t.historical
              : t.current}{" "}
          · {e.from} → {e.until ?? "…"} · ₹
          {(BigInt(e.ratePaise) / 100n).toString()}.
          {(BigInt(e.ratePaise) % 100n).toString().padStart(2, "0")}
        </p>
      ))}
      <p className="policy-text">{r.reason}</p>
    </>
  );
}
function PolicyView({ policy, t }: { policy: unknown; t: T }) {
  const pt = useTranslations("policies");
  const parsed = shopPoliciesDraftSchema.safeParse(policy);
  if (!parsed.success) return null;
  return (
    <div className="policy-text">
      <h3>{t.policySnapshot}</h3>
      <p>
        {pt(parsed.data.policy.kind)} · {pt(parsed.data.policy.state)} ·{" "}
        {parsed.data.policy.authority.label}
      </p>
      <p lang="en">{parsed.data.policy.terms.en || t.unknown}</p>
      <p lang="ta">{parsed.data.policy.terms.ta || t.unknown}</p>
      <dl className="shop-profile-values">
        {Object.entries(parsed.data.policy)
          .filter(([k]) => !["kind", "state", "authority", "terms"].includes(k))
          .map(([k, v]) => (
            <div key={k}>
              <dt>{pt(k as "calendarDays")}</dt>
              <dd>
                {v === null
                  ? t.unknown
                  : typeof v === "string" &&
                      [
                        "owner",
                        "fixed-paise",
                        "percentage-bps",
                        "case-by-case",
                      ].includes(v)
                    ? pt(v as "owner")
                    : String(v)}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
function DraftView({ value, t }: { value: unknown; t: T }) {
  const r = rateDraftSchema.safeParse(value),
    p = quotePolicyReviewDraftSchema.safeParse(value);
  if (r.success)
    return (
      <div>
        <p>
          {r.data.component ? t[r.data.component] : t.unknown} ·{" "}
          {r.data.basisText || t.unknown}{" "}
          {r.data.unit ? t[r.data.unit] : t.unknown}
        </p>
        <p className="shop-actor">
          {t.sourceId}: {r.data.source?.revisionId ?? t.none}
        </p>
        {r.data.entries.map((e) => (
          <p key={e.entryId}>
            {e.from || t.unknown} → {e.until || "…"} · ₹
            {e.rateText || t.unknown}
          </p>
        ))}
        <p className="policy-text">{r.data.reason || t.unknown}</p>
      </div>
    );
  if (p.success)
    return (
      <div>
        <p className="shop-actor">
          {t.sourceId}: {p.data.sourceDraftId ?? t.none}
        </p>
        <p>
          {t.version} {p.data.sourceDraftVersion}
        </p>
        <p>{p.data.reason || t.unknown}</p>
      </div>
    );
  return <p>{t.invalid}</p>;
}
function Editor({
  controller,
  catalogue,
  current,
  sourcePolicy,
  onCompare,
  onReapply,
  t,
  locale,
}: {
  controller: DraftRecovery;
  catalogue: Catalogue["entries"];
  current: RateRevision | undefined;
  sourcePolicy: DraftRecord | undefined;
  onCompare: () => Promise<void>;
  onReapply: (v: RateDraft) => void;
  t: T;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    [review, setReview] = useState<string>(),
    [compared, setCompared] = useState(false);
  const policy = quotePolicyReviewDraftSchema.safeParse(s.values),
    rate = rateDraftSchema.safeParse(s.values),
    closed = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || closed;
  const valid = policy.success
    ? quotePolicyReviewCommandSchema.safeParse(s.values).success
    : rateCommandSchema.safeParse(s.values).success;
  const edit = (v: Record<string, unknown>) => {
    setReview(undefined);
    setCompared(false);
    controller.edit(v);
  };
  if (s.status === "denied") return <p role="alert">{t.denied}</p>;
  if (!policy.success && !rate.success) return <p role="alert">{t.invalid}</p>;
  const v = rate.success ? rate.data : null;
  return (
    <section
      className="shop-profile-form"
      aria-label={policy.success ? t.policies : t.newRate}
    >
      <p role="status">
        {t[s.status as keyof T] ?? s.status}
        {s.error
          ? ` · ${s.error === "RATE_LIMITED" ? t.rateLimited : s.status === "saved" ? t.reviewRejected : t.error}`
          : ""}
      </p>
      {["REQUEST_CONFLICT", "VALIDATION_FAILED"].includes(s.error ?? "") && (
        <p role="alert">{t.checkSources}</p>
      )}
      {closed && <p>{t.closed}</p>}
      {s.status === "conflict" && (
        <section className="shop-conflict">
          <h3>{t.conflict}</h3>
          <p>{t.conflictHelp}</p>
          <Button
            onClick={() =>
              void Promise.all([controller.refreshConflict(), onCompare()])
                .then(() => setCompared(true))
                .catch(() => setCompared(false))
            }
          >
            {t.compare}
          </Button>
          {compared && (
            <>
              <h4>{t.current}</h4>
              {current && <RateView r={current} t={t} locale={locale} />}
              <h4>{t.local}</h4>
              <DraftView value={s.values} t={t} />
              <h4>{t.server}</h4>
              <DraftView value={s.conflict?.payload} t={t} />
              {s.conflict && (
                <Button
                  onClick={() => {
                    controller.resolveConflict("server");
                    setReview(undefined);
                    setCompared(false);
                  }}
                >
                  {t.savedChoice}
                </Button>
              )}
              {s.conflict?.lifecycle === "active" &&
                (!v ||
                  current?.version === v.baseVersion ||
                  (!current && v.baseVersion === 0)) && (
                  <Button
                    onClick={() => {
                      controller.resolveConflict("local");
                      setReview(undefined);
                      setCompared(false);
                    }}
                  >
                    {t.localChoice}
                  </Button>
                )}
              {v && current && (
                <Button
                  onClick={() =>
                    onReapply({
                      ...v,
                      baseVersion: current.version,
                      baseRevisionId: current.id,
                    })
                  }
                >
                  {t.reapply}
                </Button>
              )}
            </>
          )}
        </section>
      )}
      <fieldset
        disabled={busy}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        {v ? (
          <>
            <Field>
              <FieldLabel htmlFor="rate-source">{t.source}</FieldLabel>
              <select
                id="rate-source"
                value={v.source?.revisionId ?? ""}
                onChange={(e) => {
                  const r = catalogue.find((r) => r.id === e.target.value);
                  edit({
                    ...v,
                    source: r ? { entryId: r.entryId, revisionId: r.id } : null,
                  });
                }}
              >
                <option value="">{t.none}</option>
                {v.source &&
                  !catalogue.some((r) => r.id === v.source?.revisionId) && (
                    <option value={v.source.revisionId}>
                      {t.unavailable} · {v.source.revisionId}
                    </option>
                  )}
                {catalogue
                  .filter((r) => r.configurationEligible)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {locale === "ta"
                        ? r.definition.content.labelTa
                        : r.definition.content.labelEn}{" "}
                      · {r.definition.content.kind}
                    </option>
                  ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rate-component">{t.component}</FieldLabel>
              <select
                id="rate-component"
                value={v.component ?? ""}
                onChange={(e) =>
                  edit({ ...v, component: e.target.value || null })
                }
              >
                <option value="">{t.none}</option>
                {rateComponents.map((c) => (
                  <option key={c} value={c}>
                    {t[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rate-unit">{t.unit}</FieldLabel>
              <select
                id="rate-unit"
                value={v.unit ?? ""}
                onChange={(e) => edit({ ...v, unit: e.target.value || null })}
              >
                <option value="">{t.none}</option>
                <option value="item">{t.item}</option>
                <option value="mm">{t.mm}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rate-basis">{t.basis}</FieldLabel>
              <Input
                id="rate-basis"
                inputMode="numeric"
                value={v.basisText}
                onChange={(e) => edit({ ...v, basisText: e.target.value })}
              />
            </Field>
            <p>{t.basisHelp}</p>
            {v.entries.map((e, i) => (
              <fieldset key={e.entryId}>
                <legend>{i + 1}</legend>
                {(["from", "until", "rateText"] as const).map((k) => (
                  <Field key={k}>
                    <FieldLabel htmlFor={`rate-${e.entryId}-${k}`}>
                      {k === "from"
                        ? t.from
                        : k === "until"
                          ? t.until
                          : t.price}
                    </FieldLabel>
                    <Input
                      id={`rate-${e.entryId}-${k}`}
                      inputMode={k === "rateText" ? "decimal" : "text"}
                      placeholder={k === "rateText" ? undefined : "YYYY-MM-DD"}
                      value={e[k]}
                      onChange={(event) =>
                        edit({
                          ...v,
                          entries: v.entries.map((x) =>
                            x.entryId === e.entryId
                              ? { ...x, [k]: event.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    edit({
                      ...v,
                      entries: v.entries.filter((x) => x.entryId !== e.entryId),
                    })
                  }
                >
                  {t.remove}
                </Button>
              </fieldset>
            ))}
            <Button
              variant="outline"
              disabled={v.entries.length >= 64}
              onClick={() =>
                edit({
                  ...v,
                  entries: [
                    ...v.entries,
                    { entryId: v7(), from: "", until: "", rateText: "" },
                  ],
                })
              }
            >
              {t.add}
            </Button>
            <label>
              <input
                type="checkbox"
                checked={v.available}
                onChange={(e) => edit({ ...v, available: e.target.checked })}
              />
              {t.available}
            </label>
          </>
        ) : policy.success ? (
          <>
            <PolicyView policy={sourcePolicy?.payload} t={t} />
            <p>
              {t.sourceId}:{" "}
              <span className="shop-actor">{policy.data.sourceDraftId}</span> ·{" "}
              {t.version} {policy.data.sourceDraftVersion}
            </p>
            <label>
              <input
                type="checkbox"
                checked={policy.data.acknowledged}
                onChange={(e) =>
                  edit({ ...policy.data, acknowledged: e.target.checked })
                }
              />
              {t.ack}
            </label>
          </>
        ) : null}
        <Field>
          <FieldLabel htmlFor="rate-reason">{t.reason}</FieldLabel>
          <Input
            id="rate-reason"
            value={s.values.reason as string}
            onChange={(e) => edit({ ...s.values, reason: e.target.value })}
          />
        </Field>
      </fieldset>
      {!valid && !closed && <p>{t.invalid}</p>}
      <div className="calendar-actions">
        <Button disabled={busy} onClick={() => void controller.save()}>
          {t.save}
        </Button>
        {(s.work.outcomeUnknown ||
          s.error === "RATE_LIMITED" ||
          s.status === "notSaved" ||
          s.status === "checking") && (
          <Button
            disabled={s.work.inFlight}
            onClick={() => void controller.retry()}
          >
            {t.retry}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy || !valid || s.status === "conflict"}
          onClick={() => {
            void controller.save().then(() => {
              const snapshot = controller.snapshot();
              if (snapshot.status === "saved")
                setReview(JSON.stringify(snapshot.values));
            });
          }}
        >
          {t.review}
        </Button>
      </div>
      {review === JSON.stringify(s.values) && s.status === "saved" && (
        <section>
          <h3>{t.review}</h3>
          <p>{t.reviewHelp}</p>
          {v && (
            <>
              <p>
                {t.sourceId}:{" "}
                <span className="shop-actor">{v.source?.revisionId}</span>
              </p>
              <p>
                {v.component ? t[v.component] : t.unknown} · {v.basisText}{" "}
                {v.unit ? t[v.unit] : t.unknown}
              </p>
              {v.entries.map((e) => (
                <p key={e.entryId}>
                  {e.from} → {e.until || "…"} · ₹{e.rateText}
                </p>
              ))}
              <p>{v.reason}</p>
            </>
          )}
          <Button
            disabled={busy || !valid}
            onClick={() =>
              void (s.error === "RATE_LIMITED"
                ? controller.retry()
                : controller.promote())
            }
          >
            {policy.success ? t.bind : t.publish}
          </Button>
        </section>
      )}
    </section>
  );
}
export function QuotationRates({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const locale = useLocale() as Locale,
    t = quotationRateMessages[locale],
    pt = useTranslations("policies");
  const [session, setSession] = useState<{
      scope: ReturnType<typeof createDraftScope>;
      alive: () => boolean;
    }>(),
    [controller, setController] = useState<DraftRecovery>();
  const [state, setState] =
      useState<Awaited<ReturnType<typeof listQuotationRates>>>(),
    [catalogue, setCatalogue] = useState<Catalogue>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<DraftCursor | null>(null),
    [history, setHistory] = useState<RateRevision[]>([]),
    [historyNext, setHistoryNext] = useState<number | null>(null),
    [historyRate, setHistoryRate] = useState<string>(),
    [bindings, setBindings] = useState<QuotePolicyBinding[]>([]),
    [bindingNext, setBindingNext] = useState<number | null>(null),
    [bindingKind, setBindingKind] = useState<QuotePolicyReviewDraft["kind"]>(),
    [sourcePolicy, setSourcePolicy] = useState<DraftRecord>(),
    [failed, setFailed] = useState(false),
    [reload, setReload] = useState(0),
    [lookup, setLookup] = useState(""),
    [resolution, setResolution] =
      useState<Awaited<ReturnType<typeof resolveQuotationRate>>>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each retry rebuilds the private scope; committed callback reads fresh current state.
  useEffect(() => {
    let mounted = true;
    const version = queries.version(),
      scope = createDraftScope(shopId, guard),
      alive = () => mounted && queries.isCurrent(version);
    setSession({ scope, alive });
    setState(undefined);
    setController(undefined);
    setDrafts([]);
    setHistory([]);
    setBindings([]);
    setFailed(false);
    setSourcePolicy(undefined);
    setResolution(undefined);
    void Promise.all([
      listQuotationRates(shopId),
      readServiceCatalogue(shopId),
      scope.list(),
    ])
      .then(async ([r, c, d]) => {
        if (!alive()) return;
        setState(r);
        setCatalogue(c);
        setDrafts(d.drafts);
        setCursor(d.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (
            !["pricing.rate", "pricing.policy-review"].includes(record.workflow)
          )
            throw Error("Invalid workflow");
          let source: DraftRecord | undefined;
          const p = quotePolicyReviewDraftSchema.safeParse(record.payload);
          if (p.success && p.data.sourceDraftId)
            source = await scope.read(p.data.sourceDraftId);
          if (!alive()) return;
          setSourcePolicy(source);
          setController(
            scope.open({
              workflow: record.workflow,
              schemaVersion: 1,
              initial: record.payload,
              record,
              committed: (r) => {
                if (!alive()) return;
                address(r.lifecycle === "active" ? r.id : undefined);
                if (r.lifecycle === "promoted")
                  void listQuotationRates(shopId)
                    .then((result) => {
                      if (alive()) setState(result);
                    })
                    .catch(() => {
                      if (alive()) setFailed(true);
                    });
              },
            }),
          );
        }
      })
      .catch(() => {
        if (alive()) setFailed(true);
      });
    return () => {
      mounted = false;
      scope.dispose();
    };
  }, [shopId, queries, guard, reload]);
  const attempt = async (run: () => Promise<void>) => {
    setFailed(false);
    try {
      await run();
    } catch {
      if (session?.alive()) setFailed(true);
    }
  };
  const refresh = async () => {
    if (!session) return;
    const [r, c, d] = await Promise.all([
      listQuotationRates(shopId),
      readServiceCatalogue(shopId),
      session.scope.list(),
    ]);
    if (!session?.alive()) return;
    setState(r);
    setCatalogue(c);
    setDrafts(d.drafts);
    setCursor(d.next);
  };
  const open = (
    value: RateDraft | QuotePolicyReviewDraft,
    record?: DraftRecord,
    policy?: DraftRecord,
    preserve = false,
  ) => {
    if (
      !session?.alive() ||
      (controller &&
        !preserve &&
        !controller.confirmLeave(() => window.confirm(t.discard)))
    )
      return;
    if (controller) session.scope.release(controller);
    const workflow = rateDraftSchema.safeParse(value).success
      ? "pricing.rate"
      : "pricing.policy-review";
    setSourcePolicy(policy);
    const next = session.scope.open({
      workflow,
      schemaVersion: 1,
      initial: value,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!session.alive()) return;
        address(r.lifecycle === "active" ? r.id : undefined);
        if (r.lifecycle === "promoted") void attempt(refresh);
      },
    });
    setController(next);
    if (!record) {
      address();
      next.edit(value);
    } else address(record.id);
  };
  const revise = (r: RateRevision) =>
    open({
      rateId: r.rateId,
      baseVersion: r.version,
      baseRevisionId: r.id,
      source: r.source,
      component: r.component,
      unit: r.unit,
      basisText: String(r.basisQuantity),
      available: r.available,
      reason: "",
      entries: r.entries.map((e) => ({
        ...e,
        until: e.until ?? "",
        rateText: `${BigInt(e.ratePaise) / 100n}.${(BigInt(e.ratePaise) % 100n).toString().padStart(2, "0")}`,
      })),
    });
  const choosePolicy = async (d: DraftRecord) => {
    const p = shopPoliciesDraftSchema.parse(d.payload);
    if (!quotePolicyKinds.some((k) => k === p.policy.kind)) return;
    const kind = p.policy.kind as QuotePolicyReviewDraft["kind"],
      h = await quotationPolicyHistory(shopId, kind);
    if (!session?.alive()) return;
    const b = h.bindings[0];
    open(
      {
        kind,
        baseVersion: b?.version ?? 0,
        baseRevisionId: b?.id ?? null,
        sourceDraftId: d.id,
        sourceDraftVersion: d.version,
        reason: "",
        acknowledged: false,
      },
      undefined,
      d,
    );
  };
  if (!state || !session)
    return (
      <section>
        <p role="status">{failed ? t.loadError : t.loading}</p>
        {failed && (
          <Button onClick={() => setReload((x) => x + 1)}>{t.retry}</Button>
        )}
      </section>
    );
  return (
    <section className="shop-settings-main" aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>{t.intro}</p>
      <p>{t.boundary}</p>
      {failed && <p role="alert">{t.loadError}</p>}
      <div className="calendar-actions">
        <Button onClick={() => open(emptyRate(v7()))}>{t.newRate}</Button>
        <Button variant="outline" onClick={() => void attempt(refresh)}>
          {t.refresh}
        </Button>
      </div>
      {controller && (
        <Editor
          key={controller.instance}
          controller={controller}
          catalogue={catalogue?.entries ?? []}
          current={state.revisions.find(
            (r) => r.rateId === controller.snapshot().values.rateId,
          )}
          sourcePolicy={sourcePolicy}
          onCompare={refresh}
          onReapply={(v) => open(v, undefined, undefined, true)}
          t={t}
          locale={locale}
        />
      )}
      {controller && (
        <Button
          variant="ghost"
          onClick={() => {
            if (controller.confirmLeave(() => window.confirm(t.discard))) {
              session.scope.release(controller);
              setController(undefined);
              address();
            }
          }}
        >
          {t.close}
        </Button>
      )}
      {catalogue?.next && (
        <Button
          variant="outline"
          onClick={() =>
            void attempt(async () => {
              const c = await readServiceCatalogue(
                shopId,
                catalogue.next ?? undefined,
              );
              if (session.alive())
                setCatalogue({
                  ...c,
                  entries: [...catalogue.entries, ...c.entries],
                });
            })
          }
        >
          {t.more} · {t.source}
        </Button>
      )}
      {!state.revisions.length && <p>{t.empty}</p>}
      {state.revisions.map((r) => (
        <article key={r.id} className="shop-profile-history">
          <RateView r={r} t={t} locale={locale} />
          <div className="calendar-actions">
            <Button variant="outline" onClick={() => revise(r)}>
              {t.edit}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  const h = await quotationRateHistory(shopId, r.rateId);
                  if (session.alive()) {
                    setHistory(h.revisions);
                    setHistoryNext(h.next);
                    setHistoryRate(r.rateId);
                  }
                })
              }
            >
              {t.history}
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor={`lookup-${r.rateId}`}>{t.lookup}</FieldLabel>
            <Input
              id={`lookup-${r.rateId}`}
              value={lookup}
              placeholder="YYYY-MM-DD"
              onChange={(e) => {
                setLookup(e.target.value);
                setResolution(undefined);
              }}
            />
          </Field>
          <Button
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const result = await resolveQuotationRate(
                  shopId,
                  r.rateId,
                  lookup,
                );
                if (session.alive()) setResolution(result);
              })
            }
          >
            {t.resolve}
          </Button>
          {resolution?.revision?.rateId === r.rateId && (
            <p role="status">
              {t[resolution.state]}
              {resolution.entry ? ` · ${resolution.entry.ratePaise} paise` : ""}{" "}
              · {t.noEffects}
            </p>
          )}
        </article>
      ))}
      {state.next && (
        <Button
          onClick={() =>
            void attempt(async () => {
              const r = await listQuotationRates(
                shopId,
                state.next ?? undefined,
              );
              if (session.alive())
                setState({
                  ...r,
                  revisions: [...state.revisions, ...r.revisions],
                });
            })
          }
        >
          {t.more}
        </Button>
      )}
      {!!history.length && (
        <section aria-label={t.history}>
          <h3>{t.history}</h3>
          {history.map((r) => (
            <RateView key={r.id} r={r} t={t} locale={locale} />
          ))}
          {historyNext && historyRate && (
            <Button
              onClick={() =>
                void attempt(async () => {
                  const h = await quotationRateHistory(
                    shopId,
                    historyRate,
                    historyNext,
                  );
                  if (session.alive()) {
                    setHistory([...history, ...h.revisions]);
                    setHistoryNext(h.next);
                  }
                })
              }
            >
              {t.more}
            </Button>
          )}
        </section>
      )}
      <h3>{t.resume}</h3>
      {drafts
        .filter((d) =>
          ["pricing.rate", "pricing.policy-review"].includes(d.workflow),
        )
        .map((d) => (
          <Button
            key={d.id}
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const record = await session.scope.read(d.id);
                const r = rateDraftSchema.safeParse(record.payload),
                  p = quotePolicyReviewDraftSchema.safeParse(record.payload);
                let source: DraftRecord | undefined;
                if (p.success && p.data.sourceDraftId)
                  source = await session.scope.read(p.data.sourceDraftId);
                if (session.alive() && (r.success || p.success))
                  open(
                    r.success
                      ? r.data
                      : quotePolicyReviewDraftSchema.parse(record.payload),
                    record,
                    source,
                  );
              })
            }
          >
            {t.draft} · {d.updatedAt}
          </Button>
        ))}
      {cursor && (
        <Button
          variant="outline"
          onClick={() =>
            void attempt(async () => {
              const list = await session.scope.list(cursor);
              if (session.alive()) {
                setDrafts([
                  ...new Map(
                    [...drafts, ...list.drafts].map((d) => [d.id, d]),
                  ).values(),
                ]);
                setCursor(list.next);
              }
            })
          }
        >
          {t.more} · {t.resume}
        </Button>
      )}
      <h3>{t.policies}</h3>
      <p>{t.policyIntro}</p>
      {drafts
        .filter(
          (d) => d.workflow === "shop.policies" && d.lifecycle === "active",
        )
        .map((d) => (
          <div key={d.id}>
            <PolicyView policy={d.payload} t={t} />
            <Button
              variant="outline"
              onClick={() => void attempt(() => choosePolicy(d))}
            >
              {t.proposal} · {t.version} {d.version}
            </Button>
          </div>
        ))}
      <div className="calendar-actions">
        {quotePolicyKinds.map((kind) => (
          <Button
            key={kind}
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const h = await quotationPolicyHistory(shopId, kind);
                if (session.alive()) {
                  setBindings(h.bindings);
                  setBindingNext(h.next);
                  setBindingKind(kind);
                }
              })
            }
          >
            {t.bindingHistory} · {pt(kind)}
          </Button>
        ))}
      </div>
      {bindingKind && (
        <section aria-label={t.bindingHistory}>
          <h3>
            {t.bindingHistory} · {pt(bindingKind)}
          </h3>
          {!bindings.length && <p>{t.unconfigured}</p>}
          {bindings.map((b) => (
            <article key={b.id}>
              <h4>
                {pt(b.kind)} · {t.version} {b.version}
              </h4>
              <p>
                {b.authority === "synthetic-only" ? t.fixture : t.owner} ·{" "}
                {b.sourceCurrent ? t.current : t.stale}
              </p>
              <PolicyView
                policy={{
                  baseVersion: 0,
                  baseRevisionId: null,
                  policy: b.policy,
                }}
                t={t}
              />
              <p className="shop-actor">{b.sourceHash}</p>
              <p>
                {b.recordedAt} · {b.actorId}
              </p>
              <p>{b.reason}</p>
            </article>
          ))}
          {bindingNext && bindingKind && (
            <Button
              onClick={() =>
                void attempt(async () => {
                  const h = await quotationPolicyHistory(
                    shopId,
                    bindingKind,
                    bindingNext,
                  );
                  if (session.alive()) {
                    setBindings([...bindings, ...h.bindings]);
                    setBindingNext(h.next);
                  }
                })
              }
            >
              {t.more}
            </Button>
          )}
        </section>
      )}
    </section>
  );
}
