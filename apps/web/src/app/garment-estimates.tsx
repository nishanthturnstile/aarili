import { onOwnerInvalidation } from "@aarili/api/client";
import { searchCustomers } from "@aarili/api/customer-client";
import {
  customerGarmentEstimate,
  garmentEstimateHistory,
  readGarmentEstimate,
  reviewGarmentEstimate,
} from "@aarili/api/garment-estimates-client";
import { listAcceptedOrders } from "@aarili/api/orders-client";
import { listQuotationRates } from "@aarili/api/quotation-rates-client";
import {
  listServiceOrders,
  readServiceRepeatSource,
} from "@aarili/api/small-services-client";
import { listWearers } from "@aarili/api/wearer-client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  type CustomerEstimate,
  type EstimateDraft,
  type EstimateLine,
  type EstimateReview,
  type EstimateSource,
  type EstimateVersion,
  emptyEstimate,
  emptyEstimateLine,
  estimateCommandSchema,
  estimateDraftSchema,
} from "@aarili/contracts/garment-estimates";
import { rateComponents } from "@aarili/contracts/quotation-rates";
import {
  estimateMessages,
  formatEstimatePaise as formatOrderPaise,
  type Locale,
  quotationRateMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { v7 } from "uuid";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";

type T = (typeof estimateMessages)[Locale];
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "estimates");
  if (id) u.searchParams.set("estimateDraft", id);
  else u.searchParams.delete("estimateDraft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function TextField({
  name,
  label,
  value,
  edit,
  disabled = false,
}: {
  name: string;
  label: string;
  value: string;
  edit: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        value={value}
        disabled={disabled}
        onChange={(e) => edit(e.target.value)}
      />
    </Field>
  );
}
function CustomerView({
  value,
  t,
  locale,
}: {
  value: CustomerEstimate;
  t: T;
  locale: Locale;
}) {
  return (
    <section aria-label={t.customerView}>
      <h3>{t.notIssued}</h3>
      {value.lines.map((l) => (
        <article key={l.id} className="shop-profile-history">
          <h4>{locale === "ta" ? l.labelTa : l.labelEn}</h4>
          <p>
            {t[l.state]} · {l.quantity === null ? t.unknown : l.quantity}{" "}
            {t[l.unit]}
          </p>
          <p>
            {formatOrderPaise(l.amountPaise, locale)}
            {l.state === "included" &&
              ` · ${t.covering}: ${value.lines.find((x) => x.id === l.coveringLineId)?.[locale === "ta" ? "labelTa" : "labelEn"] ?? t.unknown}`}
          </p>
          {l.material === "customer" && <p>{t.customerMaterial}</p>}
          <p className="policy-text">{l.assumptions}</p>
          <p>{l.reason}</p>
          {l.issues.length > 0 && <p>{t.incomplete}</p>}
        </article>
      ))}
      <p role="status">
        {t.subtotal}: {formatOrderPaise(value.knownSubtotalPaise, locale)} ·{" "}
        {t.unknownCount}: {value.unknownCount}
      </p>
      <p>
        {value.complete
          ? `${t.complete}: ${formatOrderPaise(value.totalPaise, locale)}`
          : t.incomplete}
      </p>
      <p className="policy-text">{value.assumptions}</p>
    </section>
  );
}

function EstimateEditor({
  controller,
  shopId,
  rates,
  onVersion,
  onRebase,
  t,
  locale,
}: {
  controller: DraftRecovery;
  shopId: string;
  rates: Awaited<ReturnType<typeof listQuotationRates>>;
  onVersion: (v: EstimateVersion) => void;
  onRebase: (v: EstimateDraft) => void;
  t: T;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = estimateDraftSchema.safeParse(s.values);
  const [selected, setSelected] = useState<string>(),
    [proposal, setProposal] = useState<EstimateReview>(),
    [previousSource, setPreviousSource] = useState<EstimateSource>(),
    [fingerprint, setFingerprint] = useState<string>(),
    [customerOnly, setCustomerOnly] = useState(false),
    [current, setCurrent] = useState<EstimateVersion>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  if (!v.success || s.status === "denied")
    return <p role="alert">{t.denied}</p>;
  const value = v.data,
    line = value.lines.find((l) => l.id === selected) ?? value.lines[0],
    closed =
      s.committed?.lifecycle !== undefined &&
      s.committed.lifecycle !== "active",
    locked = busy || s.work.inFlight || s.work.outcomeUnknown || closed;
  const edit = (next: EstimateDraft) => {
    setProposal(undefined);
    setFingerprint(undefined);
    controller.edit({ ...next, review: null });
  };
  const change = (key: keyof EstimateLine, val: unknown) => {
    if (line)
      edit({
        ...value,
        lines: value.lines.map((l) =>
          l.id === line.id ? { ...l, [key]: val } : l,
        ),
      });
  };
  const field = (
    key:
      | "labelEn"
      | "labelTa"
      | "quantityText"
      | "basisText"
      | "rateText"
      | "fixedText"
      | "reason"
      | "assumptions",
  ) =>
    line && (
      <TextField
        name={`estimate-${key}`}
        label={
          t[
            key === "quantityText"
              ? "quantity"
              : key === "basisText"
                ? "basis"
                : key
          ]
        }
        value={line[key]}
        edit={(x) => change(key, x)}
      />
    );
  async function review() {
    setBusy(true);
    setFailed(false);
    try {
      await controller.save();
      const snap = controller.snapshot();
      if (snap.status !== "saved") return;
      const r = await reviewGarmentEstimate(
        shopId,
        estimateDraftSchema.parse(snap.values),
      );
      const previousId = estimateDraftSchema.parse(snap.values).baseRevisionId;
      const previous = previousId
        ? (await readGarmentEstimate(shopId, previousId)).version.source
        : undefined;
      if (!active.current) return;
      setProposal(r);
      setPreviousSource(previous);
      setCustomerOnly(false);
      if (!r.stale && r.invalid.length === 0) {
        const next = {
          ...estimateDraftSchema.parse(snap.values),
          review: r.fingerprint,
        };
        controller.edit(next);
        await controller.save();
        if (active.current) setFingerprint(JSON.stringify(next));
      }
    } catch {
      if (active.current) setFailed(true);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function readSaved() {
    const id = controller.snapshot().committed?.result?.id;
    if (id) {
      const r = await readGarmentEstimate(shopId, id);
      if (active.current) onVersion(r.version);
    }
  }
  return (
    <section aria-label={t.new} className="shop-profile-form">
      <p role="status">
        {t[s.status]}
        {s.error && s.status !== "checking"
          ? ` · ${s.error === "RATE_LIMITED" ? t.rateLimited : t.staleReview}`
          : ""}
      </p>
      {(failed || (s.error && s.status !== "checking")) && (
        <p role="alert">{t.error}</p>
      )}
      {s.status === "conflict" && (
        <section>
          <h3>{t.conflict}</h3>
          <Button
            onClick={() =>
              void controller.refreshConflict().then(async () => {
                const h = await garmentEstimateHistory(
                  shopId,
                  value.estimateId,
                );
                if (active.current) setCurrent(h.versions[0]);
              })
            }
          >
            {t.compare}
          </Button>
          <p>
            {t.local}: {value.reason}
          </p>
          {s.conflict && (
            <>
              <p>
                {t.server}: {String(s.conflict.payload.reason ?? "")}
              </p>
              <Button onClick={() => controller.resolveConflict("server")}>
                {t.useServer}
              </Button>
              <Button onClick={() => controller.resolveConflict("local")}>
                {t.keepLocal}
              </Button>
            </>
          )}
          {current && (
            <>
              <p>
                {t.savedVersion} {current.version}:{" "}
                {formatOrderPaise(current.customer.knownSubtotalPaise, locale)}
              </p>
              <CustomerView value={current.customer} t={t} locale={locale} />
              <Button
                onClick={() =>
                  onRebase({
                    ...value,
                    baseVersion: current.version,
                    baseRevisionId: current.id,
                    review: null,
                  })
                }
              >
                {t.rebase}
              </Button>
            </>
          )}
        </section>
      )}
      {closed ? (
        <Button onClick={() => void readSaved().catch(() => setFailed(true))}>
          {t.savedVersion}
        </Button>
      ) : (
        <>
          <fieldset
            disabled={locked}
            onCompositionStart={() => controller.composition(true)}
            onCompositionEnd={() => controller.composition(false)}
          >
            <TextField
              name="estimate-date"
              label={t.pricingDate}
              value={value.pricingDate}
              edit={(x) => edit({ ...value, pricingDate: x })}
            />
            <p>{value.target.orderId ? t.orders : t.standalone}</p>
            <p>{t.notice}</p>
            <div className="calendar-actions">
              {value.lines.map((l, i) => (
                <Button
                  key={l.id}
                  variant="outline"
                  aria-pressed={line?.id === l.id}
                  onClick={() => setSelected(l.id)}
                >
                  {i + 1}.{" "}
                  {locale === "ta"
                    ? l.labelTa || t.selectLine
                    : l.labelEn || t.selectLine}
                </Button>
              ))}
              <Button
                onClick={() => {
                  const l = emptyEstimateLine(v7());
                  edit({ ...value, lines: [...value.lines, l] });
                  setSelected(l.id);
                }}
              >
                {t.add}
              </Button>
            </div>
            {line && (
              <section aria-label={t.selectLine}>
                <h3>{t.selectLine}</h3>
                {field("labelEn")}
                {field("labelTa")}
                <Field>
                  <FieldLabel htmlFor="estimate-component">
                    {t.component}
                  </FieldLabel>
                  <select
                    id="estimate-component"
                    value={line.component}
                    onChange={(e) => change("component", e.target.value)}
                  >
                    {[...rateComponents, "handling"].map((c) => (
                      <option key={c} value={c}>
                        {c === "handling"
                          ? locale === "ta"
                            ? "கையாளும் சேவை"
                            : "Handling service"
                          : quotationRateMessages[locale][
                              c as (typeof rateComponents)[number]
                            ]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="estimate-material">
                    {t.material}
                  </FieldLabel>
                  <select
                    id="estimate-material"
                    value={line.material}
                    onChange={(e) => change("material", e.target.value)}
                  >
                    {["none", "unknown", "shop", "customer"].map((m) => (
                      <option key={m} value={m}>
                        {m === "none"
                          ? t.notMaterial
                          : m === "customer"
                            ? t.customerMaterial
                            : t[m as "unknown" | "shop"]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="estimate-state">{t.state}</FieldLabel>
                  <select
                    id="estimate-state"
                    value={line.state}
                    onChange={(e) => change("state", e.target.value)}
                  >
                    {[
                      "unknown",
                      "charge",
                      "included",
                      "complimentary",
                      "excluded",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {t[s as EstimateLine["state"]]}
                      </option>
                    ))}
                  </select>
                </Field>
                {line.state === "included" && (
                  <Field>
                    <FieldLabel htmlFor="estimate-cover">
                      {t.covering}
                    </FieldLabel>
                    <select
                      id="estimate-cover"
                      value={line.coveringLineId ?? ""}
                      onChange={(e) =>
                        change("coveringLineId", e.target.value || null)
                      }
                    >
                      <option value="">{t.none}</option>
                      {value.lines
                        .filter((l) => l.id !== line.id && l.state === "charge")
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {locale === "ta" ? l.labelTa : l.labelEn}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="estimate-mode">{t.mode}</FieldLabel>
                  <select
                    id="estimate-mode"
                    value={line.mode}
                    onChange={(e) => change("mode", e.target.value)}
                  >
                    <option value="fixed">{t.fixed}</option>
                    <option value="rate">{t.rate}</option>
                  </select>
                </Field>
                {field("quantityText")}
                <Field>
                  <FieldLabel htmlFor="estimate-unit">{t.unit}</FieldLabel>
                  <select
                    id="estimate-unit"
                    value={line.unit}
                    onChange={(e) => change("unit", e.target.value)}
                  >
                    <option value="item">{t.item}</option>
                    <option value="mm">{t.mm}</option>
                  </select>
                </Field>
                {line.mode === "fixed" ? (
                  field("fixedText")
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="estimate-rate">
                        {t.rateSelect}
                      </FieldLabel>
                      <select
                        id="estimate-rate"
                        value={line.rateId ?? ""}
                        onChange={(e) =>
                          change("rateId", e.target.value || null)
                        }
                      >
                        <option value="">{t.none}</option>
                        {rates.revisions
                          .filter(
                            (r) =>
                              r.component === line.component &&
                              r.unit === line.unit,
                          )
                          .map((r) => (
                            <option key={r.id} value={r.rateId}>
                              {locale === "ta" ? r.labelTa : r.labelEn} ·{" "}
                              {r.version}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {field("basisText")}
                    {field("rateText")}
                  </>
                )}
                {proposal && (
                  <Field>
                    <FieldLabel htmlFor="estimate-source-key">
                      {t.sourceKey}
                    </FieldLabel>
                    <select
                      id="estimate-source-key"
                      value={line.sourceKey ?? ""}
                      onChange={(e) =>
                        change("sourceKey", e.target.value || null)
                      }
                    >
                      <option value="">{t.manual}</option>
                      {proposal.source.candidates.map((c) => (
                        <option key={c.key} value={c.key}>
                          {locale === "ta" ? c.labelTa : c.labelEn}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {field("reason")}
                {field("assumptions")}
                <Button
                  variant="outline"
                  onClick={() => {
                    edit({
                      ...value,
                      lines: value.lines.filter((l) => l.id !== line.id),
                      privateCosts: value.privateCosts.filter(
                        (c) => c.lineId !== line.id,
                      ),
                    });
                    setSelected(undefined);
                  }}
                >
                  {t.remove}
                </Button>
                {!customerOnly && (
                  <details>
                    <summary>{t.private}</summary>
                    <p>{t.costPrivateOnly}</p>
                    <p>{t.actual}</p>
                    <TextField
                      name="estimate-cost"
                      label={t.cost}
                      value={
                        value.privateCosts.find((c) => c.lineId === line.id)
                          ?.amountText ?? ""
                      }
                      edit={(x) => {
                        const old = value.privateCosts.find(
                          (c) => c.lineId === line.id,
                        );
                        edit({
                          ...value,
                          privateCosts: [
                            ...value.privateCosts.filter(
                              (c) => c.lineId !== line.id,
                            ),
                            {
                              lineId: line.id,
                              amountText: x,
                              reason: old?.reason ?? "",
                            },
                          ],
                        });
                      }}
                    />
                    <TextField
                      name="estimate-cost-reason"
                      label={t.costReason}
                      value={
                        value.privateCosts.find((c) => c.lineId === line.id)
                          ?.reason ?? ""
                      }
                      edit={(x) => {
                        const old = value.privateCosts.find(
                          (c) => c.lineId === line.id,
                        );
                        edit({
                          ...value,
                          privateCosts: [
                            ...value.privateCosts.filter(
                              (c) => c.lineId !== line.id,
                            ),
                            {
                              lineId: line.id,
                              amountText: old?.amountText ?? "",
                              reason: x,
                            },
                          ],
                        });
                      }}
                    />
                  </details>
                )}
              </section>
            )}
            <TextField
              name="estimate-review-reason"
              label={t.reason}
              value={value.reason}
              edit={(x) => edit({ ...value, reason: x })}
            />
            <TextField
              name="estimate-general-assumptions"
              label={t.assumptions}
              value={value.assumptions}
              edit={(x) => edit({ ...value, assumptions: x })}
            />
          </fieldset>
          <div className="calendar-actions">
            <Button disabled={locked} onClick={() => void controller.save()}>
              {t.save}
            </Button>
            <Button
              disabled={s.work.inFlight || busy}
              onClick={() => void controller.retry()}
            >
              {t.retry}
            </Button>
            <Button
              disabled={locked || s.status === "conflict"}
              onClick={() => void review()}
            >
              {t.review}
            </Button>
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => void review()}
            >
              {t.refresh}
            </Button>
          </div>
          {proposal && (
            <section>
              <h3>{t.review}</h3>
              {proposal.stale && <p role="alert">{t.sourceChanged}</p>}
              {proposal.invalid.length > 0 && <p role="alert">{t.invalid}</p>}
              {proposal.source.acceptedPaise !== null && (
                <p>
                  {t.accepted}:{" "}
                  {formatOrderPaise(proposal.source.acceptedPaise, locale)}
                </p>
              )}
              {proposal.source.packageIncluded && <p>{t.package}</p>}
              <CustomerView value={proposal.customer} t={t} locale={locale} />
              {!customerOnly && (
                <section aria-label={t.private}>
                  <h4>{t.private}</h4>
                  <p>
                    {t.costSubtotal}:{" "}
                    {formatOrderPaise(proposal.costSubtotalPaise, locale)} ·{" "}
                    {t.costUnknown}: {proposal.unknownCostCount}
                  </p>
                  <p>
                    {t.margin}:{" "}
                    {proposal.estimatedMarginPaise === null
                      ? t.unknown
                      : formatOrderPaise(proposal.estimatedMarginPaise, locale)}
                  </p>
                  <p>{t.actual}</p>
                </section>
              )}
              <Button
                variant="outline"
                onClick={() => setCustomerOnly(!customerOnly)}
              >
                {customerOnly ? t.ownerView : t.customerView}
              </Button>
              {proposal.stale && (
                <>
                  <h4>
                    {t.old} → {t.proposed}
                  </h4>
                  <p>
                    {t.sourceVersion}: {previousSource?.code ?? t.unknown} ·{" "}
                    {previousSource?.aggregateVersion ?? t.unknown} →{" "}
                    {proposal.source.code ?? t.unknown} ·{" "}
                    {proposal.source.aggregateVersion ?? t.unknown}
                  </p>
                  <p>
                    {t.specificationVersion}:{" "}
                    {previousSource?.specificationVersion ?? t.unknown} →{" "}
                    {proposal.source.specificationVersion ?? t.unknown}
                  </p>
                  <p>
                    {t.bookingVersion}:{" "}
                    {previousSource?.bookingVersion ?? t.unknown} →{" "}
                    {proposal.source.bookingVersion ?? t.unknown}
                  </p>
                  <p className="break-all">
                    {t.package}: {previousSource?.commercialId ?? t.none} →{" "}
                    {proposal.source.commercialId ?? t.none}
                  </p>
                  <p>
                    {t.accepted}:{" "}
                    {formatOrderPaise(
                      previousSource?.acceptedPaise ?? null,
                      locale,
                    )}{" "}
                    → {formatOrderPaise(proposal.source.acceptedPaise, locale)}
                  </p>
                  {proposal.suggested.lines.map((l) => (
                    <p key={l.id}>
                      {locale === "ta" ? l.labelTa : l.labelEn}:{" "}
                      {value.lines.find((x) => x.id === l.id)?.rateText ||
                        t.unknown}{" "}
                      → {l.rateText || t.unknown}
                      {" · "}
                      {t.basis}:{" "}
                      {value.lines.find((x) => x.id === l.id)?.basisText ||
                        t.unknown}
                      {" → "}
                      {l.basisText || t.unknown} {t[l.unit]}
                    </p>
                  ))}
                  <Button
                    disabled={locked}
                    onClick={() => edit(proposal.suggested)}
                  >
                    {t.apply}
                  </Button>
                </>
              )}
              <Button
                disabled={
                  locked ||
                  s.status !== "saved" ||
                  s.work.dirty ||
                  fingerprint !== JSON.stringify(s.values) ||
                  proposal.stale ||
                  proposal.invalid.length > 0 ||
                  !estimateCommandSchema.safeParse(s.values).success
                }
                onClick={() =>
                  void (s.error === "RATE_LIMITED"
                    ? controller.retry()
                    : controller.promote())
                }
              >
                {t.version}
              </Button>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export function GarmentEstimates({
  shopId,
  guard,
  onBack,
  initialOrderId,
}: {
  shopId: string;
  guard: OwnerGuard;
  onBack: () => void;
  initialOrderId?: string | undefined;
}) {
  const locale = useLocale() as Locale,
    t = estimateMessages[locale];
  const [scope] = useState(() => createDraftScope(shopId, guard)),
    alive = useRef(true),
    sourceRequest = useRef(0),
    wearerRequest = useRef(0);
  const [controller, setController] = useState<DraftRecovery>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<Parameters<typeof scope.list>[0]>(),
    [rates, setRates] =
      useState<Awaited<ReturnType<typeof listQuotationRates>>>(),
    [orders, setOrders] = useState<{ id: string; code: string }[]>([]),
    [orderCursor, setOrderCursor] = useState<string | null>(null),
    [serviceCursor, setServiceCursor] = useState<string | null>(null),
    [order, setOrder] = useState(initialOrderId ?? ""),
    [native, setNative] =
      useState<Awaited<ReturnType<typeof readServiceRepeatSource>>>(),
    [piece, setPiece] = useState(""),
    [versions, setVersions] = useState<EstimateVersion[]>([]),
    [historyNext, setHistoryNext] = useState<number | null>(null),
    [version, setVersion] = useState<EstimateVersion>(),
    [customer, setCustomer] = useState<CustomerEstimate>(),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false);
  const [query, setQuery] = useState(""),
    [customers, setCustomers] =
      useState<Awaited<ReturnType<typeof searchCustomers>>>(),
    [wearers, setWearers] = useState<Awaited<ReturnType<typeof listWearers>>>(),
    [identity, setIdentity] = useState({
      customerId: null as string | null,
      wearerId: null as string | null,
    });
  const [access, setAccess] = useState(true);
  async function attempt(run: () => Promise<void>) {
    setFailed(false);
    try {
      await run();
    } catch {
      if (alive.current) setFailed(true);
    }
  }
  async function list() {
    const d = await scope.list();
    if (alive.current) {
      setDrafts(d.drafts.filter((r) => r.workflow === "pricing.estimate"));
      setCursor(d.next ?? undefined);
    }
  }
  function open(value: EstimateDraft, record?: DraftRecord) {
    if (
      !alive.current ||
      (controller && !controller.confirmLeave(() => window.confirm(t.discard)))
    )
      return;
    if (controller) scope.release(controller);
    const next = scope.open({
      workflow: "pricing.estimate",
      schemaVersion: 1,
      initial: value,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!alive.current) return;
        address(r.lifecycle === "active" ? r.id : undefined);
        if (r.lifecycle === "promoted" && r.result)
          void attempt(async () => {
            const saved = await readGarmentEstimate(shopId, r.result?.id ?? "");
            if (alive.current) setVersion(saved.version);
            await list();
          });
      },
    });
    setController(next);
    setCustomer(undefined);
    address(record?.id);
    if (!record) next.edit(value);
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: one private scope per mounted shop; dispose on exit/access loss.
  useEffect(() => {
    alive.current = true;
    const stop = onOwnerInvalidation(() => {
      setAccess(false);
      alive.current = false;
      scope.dispose();
      setController(undefined);
      setDrafts([]);
      setRates(undefined);
      setOrders([]);
      setNative(undefined);
      setVersions([]);
      setVersion(undefined);
      setCustomer(undefined);
      setCustomers(undefined);
      setWearers(undefined);
      setIdentity({ customerId: null, wearerId: null });
      sourceRequest.current++;
      wearerRequest.current++;
      setQuery("");
      setOrder("");
      setPiece("");
      setCursor(undefined);
      setReady(false);
    });
    void attempt(async () => {
      const [r, o, s] = await Promise.all([
        listQuotationRates(shopId),
        listAcceptedOrders(shopId),
        listServiceOrders(shopId),
      ]);
      if (!alive.current) return;
      setRates(r);
      setOrders(
        [...o.orders, ...s.orders].map(({ id, code }) => ({ id, code })),
      );
      setOrderCursor(o.next);
      setServiceCursor(s.next);
      await list();
      const id = new URL(window.location.href).searchParams.get(
        "estimateDraft",
      );
      if (id) {
        const record = await scope.read(id);
        if (!alive.current) return;
        if (record.workflow !== "pricing.estimate") throw Error("Wrong draft");
        open(estimateDraftSchema.parse(record.payload), record);
      }
      if (initialOrderId) {
        const request = ++sourceRequest.current;
        const src = await readServiceRepeatSource(shopId, initialOrderId);
        if (alive.current && request === sourceRequest.current) setNative(src);
      }
      if (alive.current) setReady(true);
    });
    return () => {
      alive.current = false;
      stop();
      queueMicrotask(() => {
        if (!alive.current) scope.dispose();
      });
    };
  }, [scope, shopId]);
  function targetDraft(target: EstimateDraft["target"]) {
    const committed = controller?.snapshot().committed;
    const existing =
      version && (!controller || committed?.lifecycle === "promoted")
        ? {
            ...version.input,
            baseVersion: version.version,
            baseRevisionId: version.id,
          }
        : controller
          ? estimateDraftSchema.parse(controller.snapshot().values)
          : emptyEstimate(v7());
    open({
      ...existing,
      target,
      lines: existing.lines.map((l) => ({ ...l, sourceKey: null })),
      sourceFingerprint: null,
      review: null,
      pricingDate: existing.pricingDate || rates?.today || "",
    });
  }
  if (!access) return <p role="alert">{t.denied}</p>;
  return (
    <section className="order-intake" aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>{t.intro}</p>
      <div className="calendar-actions">
        <Button
          variant="outline"
          onClick={() => {
            if (
              !controller ||
              controller.confirmLeave(() => window.confirm(t.discard))
            )
              onBack();
          }}
        >
          {t.back}
        </Button>
        <Button
          disabled={!ready}
          onClick={() => {
            setVersion(undefined);
            setVersions([]);
            const v = emptyEstimate(v7());
            v.pricingDate = rates?.today ?? "";
            open(v);
          }}
        >
          {t.new}
        </Button>
      </div>
      {failed && <p role="alert">{t.error}</p>}
      {!ready && <p role="status">{t.loading}</p>}
      <details>
        <summary>{t.scope}</summary>
        {(orderCursor || serviceCursor) && (
          <Button
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const [o, s] = await Promise.all([
                  orderCursor
                    ? listAcceptedOrders(shopId, orderCursor)
                    : Promise.resolve(null),
                  serviceCursor
                    ? listServiceOrders(shopId, serviceCursor)
                    : Promise.resolve(null),
                ]);
                if (!alive.current) return;
                setOrders((prior) => [
                  ...new Map(
                    [...prior, ...(o?.orders ?? []), ...(s?.orders ?? [])].map(
                      (r) => [r.id, { id: r.id, code: r.code }],
                    ),
                  ).values(),
                ]);
                setOrderCursor(o?.next ?? null);
                setServiceCursor(s?.next ?? null);
              })
            }
          >
            {t.more} · {t.orders}
          </Button>
        )}
        <Field>
          <FieldLabel htmlFor="estimate-order">{t.orders}</FieldLabel>
          <select
            id="estimate-order"
            value={order}
            onChange={(e) => {
              const id = e.target.value;
              const request = ++sourceRequest.current;
              setOrder(id);
              setPiece("");
              setNative(undefined);
              if (id)
                void attempt(async () => {
                  const src = await readServiceRepeatSource(shopId, id);
                  if (alive.current && request === sourceRequest.current)
                    setNative(src);
                });
            }}
          >
            <option value="">{t.standalone}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code}
              </option>
            ))}
          </select>
        </Field>
        {native && (
          <>
            <Field>
              <FieldLabel htmlFor="estimate-piece">{t.piece}</FieldLabel>
              <select
                id="estimate-piece"
                value={piece}
                onChange={(e) => setPiece(e.target.value)}
              >
                <option value="">{t.parent}</option>
                {native.pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {locale === "ta" ? p.labelTa : p.labelEn}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              onClick={() =>
                targetDraft({
                  orderId: native.id,
                  pieceId: piece || null,
                  customerId: native.customer?.id ?? null,
                  wearerId: native.wearer?.id ?? null,
                })
              }
            >
              {t.attach}
            </Button>
          </>
        )}
        {!order && (
          <>
            <TextField
              name="estimate-customer-query"
              label={t.search}
              value={query}
              edit={setQuery}
            />
            <Button
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  const found = await searchCustomers(shopId, {
                    query,
                    limit: 10,
                  });
                  if (alive.current) setCustomers(found);
                })
              }
            >
              {t.search}
            </Button>
            <Field>
              <FieldLabel htmlFor="estimate-customer">{t.customer}</FieldLabel>
              <select
                id="estimate-customer"
                value={identity.customerId ?? ""}
                onChange={(e) => {
                  const id = e.target.value,
                    request = ++wearerRequest.current;
                  setIdentity({ customerId: id || null, wearerId: null });
                  setWearers(undefined);
                  if (id)
                    void attempt(async () => {
                      const w = await listWearers(shopId, id);
                      if (alive.current && request === wearerRequest.current)
                        setWearers(w);
                    });
                }}
              >
                <option value="">{t.none}</option>
                {customers?.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} · {c.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="estimate-wearer">{t.wearer}</FieldLabel>
              <select
                id="estimate-wearer"
                value={identity.wearerId ?? ""}
                onChange={(e) =>
                  setIdentity({ ...identity, wearerId: e.target.value || null })
                }
              >
                <option value="">{t.none}</option>
                {wearers?.wearers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              onClick={() =>
                targetDraft({ orderId: null, pieceId: null, ...identity })
              }
            >
              {t.applyIdentity}
            </Button>
          </>
        )}
      </details>
      {controller && rates && (
        <>
          <EstimateEditor
            key={controller.snapshot().id}
            controller={controller}
            shopId={shopId}
            rates={rates}
            onVersion={setVersion}
            onRebase={open}
            t={t}
            locale={locale}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!controller.confirmLeave(() => window.confirm(t.discard)))
                return;
              scope.release(controller);
              setController(undefined);
              address();
            }}
          >
            {t.close}
          </Button>
        </>
      )}
      {rates?.next && (
        <Button
          variant="outline"
          onClick={() =>
            void attempt(async () => {
              const r = await listQuotationRates(
                shopId,
                rates.next ?? undefined,
              );
              if (alive.current)
                setRates({
                  ...r,
                  revisions: [...rates.revisions, ...r.revisions],
                });
            })
          }
        >
          {t.more} · {t.rateSelect}
        </Button>
      )}
      {version && (
        <section aria-label={t.savedVersion}>
          <h3>
            {t.savedVersion} {version.version}
          </h3>
          <p>{version.input.reason}</p>
          <p>
            {t.subtotal}:{" "}
            {formatOrderPaise(version.customer.knownSubtotalPaise, locale)}
          </p>
          <div className="calendar-actions">
            <Button
              onClick={() =>
                open({
                  ...version.input,
                  baseVersion: version.version,
                  baseRevisionId: version.id,
                  review: null,
                  reason: "",
                })
              }
            >
              {t.revise}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  const h = await garmentEstimateHistory(
                    shopId,
                    version.estimateId,
                  );
                  if (alive.current) {
                    setVersions(h.versions);
                    setHistoryNext(h.next);
                  }
                })
              }
            >
              {t.history}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  const c = await customerGarmentEstimate(shopId, version.id);
                  if (alive.current) setCustomer(c);
                })
              }
            >
              {t.customerView}
            </Button>
          </div>
          <details>
            <summary>{t.private}</summary>
            {version.costs.map((c) => (
              <p key={c.lineId}>
                {formatOrderPaise(c.amountPaise, locale)} · {c.reason}
              </p>
            ))}
            <p>{t.actual}</p>
          </details>
        </section>
      )}
      {customer && <CustomerView value={customer} t={t} locale={locale} />}
      {!!versions.length && (
        <section aria-label={t.history}>
          <h3>{t.history}</h3>
          {versions.map((r) => (
            <article key={r.id}>
              <Button
                variant="outline"
                onClick={() => {
                  setVersion(r);
                  setCustomer(undefined);
                }}
              >
                {t.savedVersion} {r.version} · {r.recordedAt}
              </Button>
              <p>
                {r.input.reason} ·{" "}
                {formatOrderPaise(r.customer.knownSubtotalPaise, locale)}
              </p>
            </article>
          ))}
          {historyNext && version && (
            <Button
              onClick={() =>
                void attempt(async () => {
                  const h = await garmentEstimateHistory(
                    shopId,
                    version.estimateId,
                    historyNext,
                  );
                  if (alive.current) {
                    setVersions([...versions, ...h.versions]);
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
      {drafts.map((d) => (
        <Button
          variant="outline"
          key={d.id}
          onClick={() =>
            void attempt(async () => {
              const r = await scope.read(d.id);
              if (alive.current) open(estimateDraftSchema.parse(r.payload), r);
            })
          }
        >
          {t.resume} · {d.updatedAt}
        </Button>
      ))}
      {cursor && (
        <Button
          onClick={() =>
            void attempt(async () => {
              const d = await scope.list(cursor);
              if (alive.current) {
                setDrafts([
                  ...drafts,
                  ...d.drafts.filter((r) => r.workflow === "pricing.estimate"),
                ]);
                setCursor(d.next ?? undefined);
              }
            })
          }
        >
          {t.more}
        </Button>
      )}
    </section>
  );
}
