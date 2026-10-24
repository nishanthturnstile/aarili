import {
  bookingQuotationHistory,
  currentBookingQuotation,
  customerBookingQuotation,
  listBookingQuotations,
  quotationEstimateOptions,
  readBookingQuotation,
  reviewBookingQuotation,
} from "@aarili/api/booking-quotations-client";
import { onOwnerInvalidation } from "@aarili/api/client";
import {
  listAcceptedOrders,
  listBookings,
  readBooking,
} from "@aarili/api/orders-client";
import { listServiceOrders } from "@aarili/api/small-services-client";
import {
  type CustomerQuotation,
  emptyQuotation,
  type QuotationDraft,
  type QuotationReview,
  type QuotationVersion,
  quotationCommandSchema,
  quotationDraftSchema,
} from "@aarili/contracts/booking-quotations";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  estimateMessages,
  formatEstimatePaise,
  type Locale,
  quotationMessages,
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
import { QuotationIssues } from "./quotation-issues";

type T = (typeof quotationMessages)[Locale];
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "quotations");
  if (id) u.searchParams.set("quotationDraft", id);
  else u.searchParams.delete("quotationDraft");
  window.history.replaceState(null, "", u.pathname + u.search);
}
function Text({
  id,
  label,
  value,
  edit,
}: {
  id: string;
  label: string;
  value: string;
  edit: (v: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} onChange={(e) => edit(e.target.value)} />
    </Field>
  );
}
function PublicView({
  value,
  t,
  locale,
  garment = false,
}: {
  value: CustomerQuotation;
  t: T;
  locale: Locale;
  garment?: boolean;
}) {
  const visible = garment ? value.lines.filter((l) => l.orderId) : value.lines;
  return (
    <section aria-label={t.customer}>
      <h3>{t.notIssued}</h3>
      {visible.map((l) => (
        <article key={l.key} className="shop-profile-history">
          <h4>{locale === "ta" ? l.labelTa : l.labelEn}</h4>
          <p>
            {t[l.role]}
            {l.parentKey
              ? ` · ${value.lines.find((x) => x.key === l.parentKey)?.[locale === "ta" ? "labelTa" : "labelEn"] ?? t.unknown}`
              : ""}
          </p>
          <p>
            {t.comparison}: {formatEstimatePaise(l.acceptedPaise, locale)} →{" "}
            {formatEstimatePaise(l.grossPaise, locale)}
          </p>
          {l.role === "charge" && (
            <>
              <p>
                {t.lineDiscount}:{" "}
                {formatEstimatePaise(l.lineDiscountPaise, locale)} ·{" "}
                {t.bookingDiscount}:{" "}
                {formatEstimatePaise(l.bookingDiscountPaise, locale)}
              </p>
              <p>
                {t.net}: {formatEstimatePaise(l.netPaise, locale)}
              </p>
            </>
          )}
          <p>{l.reason}</p>
        </article>
      ))}
      <p>
        {t.subtotal}: {formatEstimatePaise(value.knownSubtotalPaise, locale)} ·{" "}
        {t.unknown}: {value.unknownCount}
      </p>
      <p>
        {t.discountTotal}: {formatEstimatePaise(value.discountPaise, locale)}
      </p>
      <p>
        {value.complete
          ? `${t.total}: ${formatEstimatePaise(value.totalPaise, locale)}`
          : t.incomplete}
      </p>
      {value.attribution.map((a) => (
        <p key={a.orderId}>
          {value.lines.find((l) => l.orderId === a.orderId)?.labelEn}:{" "}
          {formatEstimatePaise(a.amountPaise, locale)}
        </p>
      ))}
      {value.unattributedSellingPaise > 0 && (
        <p>
          {t.packageUnallocated}:{" "}
          {formatEstimatePaise(value.unattributedSellingPaise, locale)}
        </p>
      )}
      <p>{value.assumptions}</p>
    </section>
  );
}
function Editor({
  controller,
  shopId,
  locale,
  onSaved,
  onRebase,
}: {
  controller: DraftRecovery;
  shopId: string;
  locale: Locale;
  onSaved: (v: QuotationVersion) => void;
  onRebase: (v: QuotationDraft) => void;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = quotationMessages[locale],
    e = estimateMessages[locale],
    v = quotationDraftSchema.parse(s.values);
  const [review, setReview] = useState<QuotationReview>(),
    [reviewInput, setReviewInput] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [garment, setGarment] = useState(false),
    [current, setCurrent] = useState<QuotationVersion>();
  const [options, setOptions] = useState<
    Record<string, Awaited<ReturnType<typeof quotationEstimateOptions>>>
  >({});
  const active = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: commercial scope is immutable for this controller; a different scope mounts a new controller.
  useEffect(() => {
    active.current = true;
    void Promise.all(
      v.orderIds.map(
        async (id) => [id, await quotationEstimateOptions(shopId, id)] as const,
      ),
    )
      .then((rows) => {
        if (active.current) setOptions(Object.fromEntries(rows));
      })
      .catch(() => {
        if (active.current) setFailed(true);
      });
    return () => {
      active.current = false;
    };
  }, [shopId, controller]);
  function edit(next: QuotationDraft) {
    setReviewInput("");
    controller.edit({ ...next, review: null });
  }
  const locked =
    busy ||
    s.work.inFlight ||
    s.work.outcomeUnknown ||
    s.committed?.lifecycle === "promoted";
  async function compare() {
    setBusy(true);
    setFailed(false);
    try {
      await controller.save();
      const snap = controller.snapshot();
      if (snap.status !== "saved") return;
      const r = await reviewBookingQuotation(
        shopId,
        quotationDraftSchema.parse(snap.values),
      );
      if (!active.current) return;
      setReview(r);
      if (!r.blockers.length && r.customer.complete) {
        const next = {
          ...quotationDraftSchema.parse(snap.values),
          review: r.fingerprint,
        };
        controller.edit(next);
        await controller.save();
        if (active.current) setReviewInput(JSON.stringify(next));
      }
    } catch {
      if (active.current) setFailed(true);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function recover() {
    try {
      await controller.refreshConflict();
      const id = controller.snapshot().values.familyId;
      if (typeof id === "string") {
        const r = await currentBookingQuotation(shopId, id);
        if (active.current) setCurrent(r.version);
      }
    } catch {
      if (active.current) setFailed(true);
    }
  }
  const charges =
    review?.customer.lines.filter((l) => l.role === "charge") ?? [];
  return (
    <section aria-label={t.new} className="shop-profile-form">
      <p role="status">
        {s.status === "promoted"
          ? t.savedVersion
          : s.status === "promoting"
            ? t.saveVersion
            : e[s.status]}
        {s.error && (s.status !== "checking" || s.error === "RATE_LIMITED")
          ? ` · ${s.error === "RATE_LIMITED" ? e.rateLimited : e.staleReview}`
          : ""}
      </p>
      {failed && <p role="alert">{e.error}</p>}
      {s.status === "conflict" && (
        <section aria-label={e.conflict}>
          <h3>{e.conflict}</h3>
          <p>
            {e.local}: {v.reason}
          </p>
          <Button onClick={() => void recover()}>{e.compare}</Button>
          {s.conflict && (
            <>
              <p>
                {e.server}: {String(s.conflict.payload.reason ?? "")}
              </p>
              <Button onClick={() => controller.resolveConflict("server")}>
                {e.useServer}
              </Button>
              <Button onClick={() => controller.resolveConflict("local")}>
                {e.keepLocal}
              </Button>
            </>
          )}
          {current && (
            <>
              <PublicView value={current.customer} t={t} locale={locale} />
              <Button
                onClick={() =>
                  onRebase({
                    ...v,
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
      {s.committed?.lifecycle === "promoted" ? (
        <Button
          onClick={() =>
            void readBookingQuotation(shopId, s.committed?.result?.id ?? "")
              .then((r) => {
                if (active.current) onSaved(r.version);
              })
              .catch(() => setFailed(true))
          }
        >
          {t.savedVersion}
        </Button>
      ) : (
        <>
          <fieldset
            disabled={locked}
            onCompositionStart={() => controller.composition(true)}
            onCompositionEnd={() => controller.composition(false)}
          >
            <p>{t.scopeChanged}</p>
            {v.orderIds.map((id, i) => (
              <Field key={id}>
                <FieldLabel htmlFor={`quotation-estimate-${i}`}>
                  {t.estimate} · {i + 1}
                </FieldLabel>
                <select
                  id={`quotation-estimate-${i}`}
                  value={
                    v.estimates.find((e) => e.orderId === id)?.revisionId ?? ""
                  }
                  onChange={(ev) =>
                    edit({
                      ...v,
                      estimates: [
                        ...v.estimates.filter((e) => e.orderId !== id),
                        ...(ev.target.value
                          ? [{ orderId: id, revisionId: ev.target.value }]
                          : []),
                      ],
                    })
                  }
                >
                  <option value="">{t.accepted}</option>
                  {options[id]?.estimates.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.version} · {o.reason}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            <Text
              id="quotation-reason"
              label={t.reason}
              value={v.reason}
              edit={(reason) => edit({ ...v, reason })}
            />
            <Text
              id="quotation-assumptions"
              label={e.assumptions}
              value={v.assumptions}
              edit={(assumptions) => edit({ ...v, assumptions })}
            />
            <Field>
              <FieldLabel htmlFor="quotation-selection">
                {t.selection}
              </FieldLabel>
              <select
                id="quotation-selection"
                value={v.selection}
                onChange={(ev) =>
                  edit({
                    ...v,
                    selection: ev.target.value as QuotationDraft["selection"],
                    predecessors: [],
                  })
                }
              >
                <option value="alternative">{t.alternative}</option>
                <option value="current">{t.current}</option>
              </select>
            </Field>
            <details open={v.discounts.length > 0}>
              <summary>{t.discounts}</summary>
              {v.discounts.map((d, i) => (
                <section key={d.id} className="shop-profile-history">
                  <Field>
                    <FieldLabel htmlFor={`quotation-target-${i}`}>
                      {t.target}
                    </FieldLabel>
                    <select
                      id={`quotation-target-${i}`}
                      value={d.target ?? ""}
                      onChange={(ev) =>
                        edit({
                          ...v,
                          discounts: v.discounts.map((x) =>
                            x.id === d.id
                              ? { ...x, target: ev.target.value || null }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="">{t.bookingDiscount}</option>
                      {charges.map((l) => (
                        <option key={l.key} value={l.key}>
                          {locale === "ta" ? l.labelTa : l.labelEn}
                        </option>
                      ))}
                      {d.target && !charges.some((l) => l.key === d.target) && (
                        <option value={d.target}>{t.reload}</option>
                      )}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`quotation-mode-${i}`}>
                      {t.mode}
                    </FieldLabel>
                    <select
                      id={`quotation-mode-${i}`}
                      value={d.mode}
                      onChange={(ev) =>
                        edit({
                          ...v,
                          discounts: v.discounts.map((x) =>
                            x.id === d.id
                              ? {
                                  ...x,
                                  mode: ev.target.value as "fixed" | "bps",
                                }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="fixed">{t.fixed}</option>
                      <option value="bps">{t.bps}</option>
                    </select>
                  </Field>
                  <Text
                    id={`quotation-value-${i}`}
                    label={t.amount}
                    value={d.valueText}
                    edit={(valueText) =>
                      edit({
                        ...v,
                        discounts: v.discounts.map((x) =>
                          x.id === d.id ? { ...x, valueText } : x,
                        ),
                      })
                    }
                  />
                  <Text
                    id={`quotation-discount-reason-${i}`}
                    label={t.reason}
                    value={d.reason}
                    edit={(reason) =>
                      edit({
                        ...v,
                        discounts: v.discounts.map((x) =>
                          x.id === d.id ? { ...x, reason } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      edit({
                        ...v,
                        discounts: v.discounts.filter((x) => x.id !== d.id),
                      })
                    }
                  >
                    {e.remove}
                  </Button>
                </section>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  edit({
                    ...v,
                    discounts: [
                      ...v.discounts,
                      {
                        id: v7(),
                        target: null,
                        mode: "fixed",
                        valueText: "",
                        reason: "",
                      },
                    ],
                  })
                }
              >
                {t.addDiscount}
              </Button>
              <Text
                id="quotation-decision"
                label={t.decisionReason}
                value={v.discountDecision.reason}
                edit={(reason) =>
                  edit({
                    ...v,
                    discountDecision: { ...v.discountDecision, reason },
                  })
                }
              />
              {(["stacking", "manual"] as const).map((key) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`quotation-${key}`}>{t[key]}</FieldLabel>
                  <select
                    id={`quotation-${key}`}
                    value={
                      v.discountDecision[key] === null
                        ? ""
                        : String(v.discountDecision[key])
                    }
                    onChange={(ev) =>
                      edit({
                        ...v,
                        discountDecision: {
                          ...v.discountDecision,
                          [key]:
                            ev.target.value === ""
                              ? null
                              : ev.target.value === "true",
                        },
                      })
                    }
                  >
                    <option value="">{t.unset}</option>
                    <option value="true">{t.yes}</option>
                    <option value="false">{t.no}</option>
                  </select>
                </Field>
              ))}
            </details>
            <details>
              <summary>{t.manualAmounts}</summary>
              {(
                review?.customer.lines.filter((l) => l.role === "charge") ??
                v.manual.map((m) => ({
                  key: m.key,
                  labelEn: m.key,
                  labelTa: m.key,
                }))
              ).map((l, i) => (
                <Text
                  key={l.key}
                  id={`quotation-manual-${i}`}
                  label={locale === "ta" ? l.labelTa : l.labelEn}
                  value={
                    v.manual.find((m) => m.key === l.key)?.amountText ?? ""
                  }
                  edit={(amountText) =>
                    edit({
                      ...v,
                      manual: [
                        ...v.manual.filter((m) => m.key !== l.key),
                        ...(amountText ? [{ key: l.key, amountText }] : []),
                      ],
                    })
                  }
                />
              ))}
              <Text
                id="quotation-manual-reason"
                label={t.manualReason}
                value={v.manualReason}
                edit={(manualReason) => edit({ ...v, manualReason })}
              />
            </details>
            <details>
              <summary>{t.packageSplits}</summary>
              {v.orderIds.map((id, i) => (
                <Text
                  key={id}
                  id={`quotation-package-${i}`}
                  label={`${t.garmentView} ${i + 1}`}
                  value={
                    v.packageSplits.find((s) => s.orderId === id)?.amountText ??
                    ""
                  }
                  edit={(amountText) =>
                    edit({
                      ...v,
                      packageSplits: [
                        ...v.packageSplits.filter((s) => s.orderId !== id),
                        ...(amountText ? [{ orderId: id, amountText }] : []),
                      ],
                    })
                  }
                />
              ))}
            </details>
            <details>
              <summary>{t.pieceSplits}</summary>
              {v.orderIds.flatMap((orderId, i) =>
                (options[orderId]?.pieces ?? []).map((p, j) => (
                  <Text
                    key={p.id}
                    id={`quotation-piece-${i}-${j}`}
                    label={locale === "ta" ? p.labelTa : p.labelEn}
                    value={
                      v.pieceSplits.find(
                        (s) => s.orderId === orderId && s.pieceId === p.id,
                      )?.amountText ?? ""
                    }
                    edit={(amountText) =>
                      edit({
                        ...v,
                        pieceSplits: [
                          ...v.pieceSplits.filter((s) => s.pieceId !== p.id),
                          ...(amountText
                            ? [{ orderId, pieceId: p.id, amountText }]
                            : []),
                        ],
                      })
                    }
                  />
                )),
              )}
            </details>
            <details>
              <summary>{t.private}</summary>
              <Text
                id="quotation-cost"
                label={t.shared}
                value={v.sharedCost.amountText}
                edit={(amountText) =>
                  edit({ ...v, sharedCost: { ...v.sharedCost, amountText } })
                }
              />
              <Text
                id="quotation-cost-reason"
                label={t.costReason}
                value={v.sharedCost.reason}
                edit={(reason) =>
                  edit({ ...v, sharedCost: { ...v.sharedCost, reason } })
                }
              />
              <p>{t.costUnavailable}</p>
            </details>
          </fieldset>
          <div className="calendar-actions">
            <Button disabled={locked} onClick={() => void controller.save()}>
              {e.save}
            </Button>
            <Button
              variant="outline"
              disabled={busy || s.work.inFlight}
              onClick={() => void controller.retry()}
            >
              {e.retry}
            </Button>
            <Button disabled={locked} onClick={() => void compare()}>
              {e.review}
            </Button>
          </div>
          {review && (
            <section>
              <h3>{e.review}</h3>
              {reviewInput !== JSON.stringify(s.values) && (
                <p role="status">{e.staleReview}</p>
              )}
              {review.stale && <p role="alert">{t.stale}</p>}
              {review.blockers.length > 0 && <p role="alert">{t.blocked}</p>}
              <p>
                {t.predecessors}:{" "}
                {review.source.current
                  .map((c) => c.revisionId)
                  .filter((x, i, a) => a.indexOf(x) === i)
                  .join(" · ") || e.none}
              </p>
              {review.stale && (
                <>
                  <p className="break-all">
                    {e.old}: {v.sourceFingerprint ?? e.none}
                  </p>
                  <p>
                    {e.proposed}:{" "}
                    {review.source.orders
                      .map((o) => `${o.code} · ${o.aggregateVersion}`)
                      .join(" · ")}
                  </p>
                  <p className="break-all">
                    {t.authority}: {v.discountDecision.policyId ?? e.none} →{" "}
                    {review.source.policy?.id ?? e.none}
                  </p>
                  <Button
                    disabled={locked}
                    onClick={() =>
                      edit({
                        ...v,
                        sourceFingerprint: review.source.fingerprint,
                        predecessors:
                          v.selection === "current"
                            ? [
                                ...new Set(
                                  review.source.current.map(
                                    (c) => c.revisionId,
                                  ),
                                ),
                              ]
                            : [],
                      })
                    }
                  >
                    {e.apply}
                  </Button>
                </>
              )}
              <h4>{t.authority}</h4>
              {review.source.policy ? (
                <>
                  <p className="policy-text">
                    {review.source.policy.policy.terms[locale]}
                  </p>
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() =>
                      edit({
                        ...v,
                        discountDecision: {
                          ...v.discountDecision,
                          policyId: review.source.policy?.id ?? null,
                        },
                      })
                    }
                  >
                    {t.bind}
                  </Button>
                </>
              ) : (
                <p>{t.noCurrentPolicy}</p>
              )}
              {charges.map((l) => (
                <label key={l.key} className="calendar-actions">
                  <input
                    type="checkbox"
                    checked={v.discountDecision.eligibleKeys.includes(l.key)}
                    disabled={locked || (l.grossPaise ?? 0) === 0}
                    onChange={(ev) =>
                      edit({
                        ...v,
                        discountDecision: {
                          ...v.discountDecision,
                          eligibleKeys: ev.target.checked
                            ? [...v.discountDecision.eligibleKeys, l.key]
                            : v.discountDecision.eligibleKeys.filter(
                                (k) => k !== l.key,
                              ),
                        },
                      })
                    }
                  />
                  {t.eligibility}: {locale === "ta" ? l.labelTa : l.labelEn}
                </label>
              ))}
              <Button variant="outline" onClick={() => setGarment(!garment)}>
                {t.view}: {garment ? t.bookingView : t.garmentView}
              </Button>
              <PublicView
                value={
                  reviewInput === JSON.stringify(s.values)
                    ? review.customer
                    : { ...review.customer, complete: false, totalPaise: null }
                }
                t={t}
                locale={locale}
                garment={garment}
              />
              <details>
                <summary>{t.private}</summary>
                <p>
                  {t.shared}:{" "}
                  {formatEstimatePaise(
                    review.privateCosts.shared.amountPaise,
                    locale,
                  )}
                </p>
                <p>
                  {t.unattributed}:{" "}
                  {formatEstimatePaise(
                    review.privateCosts.unattributedPaise,
                    locale,
                  )}
                </p>
                <p>
                  {t.costUnknown}: {review.privateCosts.unknownCount}
                </p>
                {review.privateCosts.unattributedPaise > 0 && (
                  <p>{t.zeroCost}</p>
                )}
                {review.privateCosts.estimates.map((c) => (
                  <p key={`${c.revisionId}-${c.lineId}`}>
                    {formatEstimatePaise(c.amountPaise, locale)} · {c.reason}
                  </p>
                ))}
                {review.privateCosts.allocations.map((a) => (
                  <p key={a.key}>
                    {
                      review.customer.lines.find((l) => l.key === a.key)
                        ?.labelEn
                    }{" "}
                    · {formatEstimatePaise(a.amountPaise, locale)}
                  </p>
                ))}
                <p>{t.costUnavailable}</p>
              </details>
              <Button
                disabled={
                  locked ||
                  s.status !== "saved" ||
                  s.work.dirty ||
                  reviewInput !== JSON.stringify(s.values) ||
                  review.blockers.length > 0 ||
                  !review.customer.complete ||
                  !quotationCommandSchema.safeParse(s.values).success
                }
                onClick={() => void controller.promote()}
              >
                {t.saveVersion}
              </Button>
            </section>
          )}
        </>
      )}
      <p>{t.noApply}</p>
    </section>
  );
}
export function BookingQuotations({
  shopId,
  guard,
  onBack,
}: {
  shopId: string;
  guard: OwnerGuard;
  onBack: () => void;
}) {
  const locale = useLocale() as Locale,
    t = quotationMessages[locale],
    e = estimateMessages[locale],
    alive = useRef(true),
    request = useRef(0),
    quotationNavigation = useRef(() => true);
  const [scope] = useState(() => createDraftScope(shopId, guard)),
    [controller, setController] = useState<DraftRecovery>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [draftCursor, setDraftCursor] =
      useState<Parameters<typeof scope.list>[0]>(),
    [bookings, setBookings] =
      useState<Awaited<ReturnType<typeof listBookings>>>(),
    [orders, setOrders] = useState<{ id: string; code: string }[]>([]),
    [orderCursor, setOrderCursor] = useState<string | null>(null),
    [serviceCursor, setServiceCursor] = useState<string | null>(null),
    [booking, setBooking] = useState(""),
    [members, setMembers] = useState<{ id: string; code: string }[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [version, setVersion] = useState<QuotationVersion>(),
    [isSelected, setIsSelected] = useState(false),
    [history, setHistory] = useState<QuotationVersion[]>([]),
    [saved, setSaved] =
      useState<Awaited<ReturnType<typeof listBookingQuotations>>>(),
    [historyNext, setHistoryNext] = useState<number | null>(null),
    [customer, setCustomer] = useState<CustomerQuotation>(),
    [failed, setFailed] = useState(false),
    [access, setAccess] = useState(true),
    [ready, setReady] = useState(false);
  async function attempt(fn: () => Promise<void>) {
    setFailed(false);
    try {
      await fn();
    } catch {
      if (alive.current) setFailed(true);
    }
  }
  async function list() {
    const [r, saved] = await Promise.all([
      scope.list(),
      listBookingQuotations(shopId),
    ]);
    if (alive.current) {
      setSaved(saved);
      setDrafts(r.drafts.filter((d) => d.workflow === "pricing.quotation"));
      setDraftCursor(r.next ?? undefined);
    }
  }
  function open(v: QuotationDraft, record?: DraftRecord) {
    if (
      !alive.current ||
      !quotationNavigation.current() ||
      (controller && !controller.confirmLeave(() => window.confirm(e.discard)))
    )
      return;
    if (controller) scope.release(controller);
    const next = scope.open({
      workflow: "pricing.quotation",
      schemaVersion: 1,
      initial: v,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!alive.current) return;
        address(r.lifecycle === "active" ? r.id : undefined);
        if (r.lifecycle === "promoted" && r.result)
          void attempt(async () => {
            const saved = await readBookingQuotation(
              shopId,
              r.result?.id ?? "",
            );
            if (alive.current) {
              setVersion(saved.version);
              setIsSelected(saved.selected);
            }
            await list();
          });
      },
    });
    setController(next);
    setCustomer(undefined);
    address(record?.id);
    if (!record) next.edit(v);
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: one private scope per mounted shop; generation guards all async results.
  useEffect(() => {
    alive.current = true;
    const stop = onOwnerInvalidation(() => {
      alive.current = false;
      scope.dispose();
      request.current++;
      setAccess(false);
      setController(undefined);
      setDrafts([]);
      setBookings(undefined);
      setOrders([]);
      setMembers([]);
      setSelected([]);
      setVersion(undefined);
      setSaved(undefined);
      setHistory([]);
      setCustomer(undefined);
      setBooking("");
      setDraftCursor(undefined);
      setReady(false);
    });
    void attempt(async () => {
      const [b, o, s] = await Promise.all([
        listBookings(shopId),
        listAcceptedOrders(shopId),
        listServiceOrders(shopId),
      ]);
      if (!alive.current) return;
      setBookings(b);
      setOrders(
        [...o.orders, ...s.orders].map(({ id, code }) => ({ id, code })),
      );
      setOrderCursor(o.next);
      setServiceCursor(s.next);
      await list();
      const id = new URL(window.location.href).searchParams.get(
        "quotationDraft",
      );
      if (id) {
        const r = await scope.read(id);
        if (!alive.current) return;
        if (r.workflow !== "pricing.quotation") throw Error("Wrong workflow");
        open(quotationDraftSchema.parse(r.payload), r);
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
  }, []);
  async function chooseBooking(id: string) {
    setBooking(id);
    setMembers([]);
    setSelected([]);
    const n = ++request.current;
    if (!id) return;
    await attempt(async () => {
      const b = await readBooking(shopId, id);
      if (alive.current && n === request.current) {
        setMembers(b.orders.map((o) => ({ id: o.id, code: o.code })));
        setSelected(b.orders.map((o) => o.id));
      }
    });
  }
  if (!access) return <p role="alert">{e.denied}</p>;
  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>{t.intro}</p>
      {failed && <p role="alert">{e.error}</p>}
      <Button
        variant="outline"
        onClick={() => {
          if (!quotationNavigation.current()) return;
          if (
            controller &&
            !controller.confirmLeave(() => window.confirm(e.discard))
          )
            return;
          onBack();
        }}
      >
        {e.back}
      </Button>
      <details open={!controller}>
        <summary>{t.members}</summary>
        <Field>
          <FieldLabel htmlFor="quotation-booking">{t.booking}</FieldLabel>
          <select
            id="quotation-booking"
            value={booking}
            onChange={(ev) => void chooseBooking(ev.target.value)}
          >
            <option value="">{t.single}</option>
            {bookings?.bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </select>
        </Field>
        {booking ? (
          members.map((o) => (
            <label key={o.id} className="calendar-actions">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={(ev) =>
                  setSelected(
                    ev.target.checked
                      ? [...selected, o.id]
                      : selected.filter((id) => id !== o.id),
                  )
                }
              />
              {o.code}
            </label>
          ))
        ) : (
          <Field>
            <FieldLabel htmlFor="quotation-order">{t.single}</FieldLabel>
            <select
              id="quotation-order"
              value={selected[0] ?? ""}
              onChange={(ev) =>
                setSelected(ev.target.value ? [ev.target.value] : [])
              }
            >
              <option value="">{e.none}</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Button
          disabled={!ready || !selected.length}
          onClick={() =>
            open({
              ...emptyQuotation(v7()),
              bookingId: booking || null,
              orderIds: selected,
            })
          }
        >
          {t.new}
        </Button>
        {bookings?.next && (
          <Button
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const b = await listBookings(
                  shopId,
                  bookings.next ?? undefined,
                );
                if (alive.current)
                  setBookings({
                    ...b,
                    bookings: [...bookings.bookings, ...b.bookings],
                  });
              })
            }
          >
            {t.more} · {t.booking}
          </Button>
        )}
        {(orderCursor || serviceCursor) && (
          <Button
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const [o, s] = await Promise.all([
                  orderCursor
                    ? listAcceptedOrders(shopId, orderCursor)
                    : undefined,
                  serviceCursor
                    ? listServiceOrders(shopId, serviceCursor)
                    : undefined,
                ]);
                if (alive.current) {
                  setOrders(
                    [...orders, ...(o?.orders ?? []), ...(s?.orders ?? [])].map(
                      ({ id, code }) => ({ id, code }),
                    ),
                  );
                  setOrderCursor(o?.next ?? null);
                  setServiceCursor(s?.next ?? null);
                }
              })
            }
          >
            {t.more} · {t.single}
          </Button>
        )}
      </details>
      {controller && (
        <>
          <Editor
            key={controller.snapshot().id}
            controller={controller}
            shopId={shopId}
            locale={locale}
            onSaved={setVersion}
            onRebase={(v) => open(v)}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!controller.confirmLeave(() => window.confirm(e.discard)))
                return;
              scope.release(controller);
              setController(undefined);
              address();
            }}
          >
            {e.close}
          </Button>
        </>
      )}
      {version && (
        <section aria-label={t.savedVersion}>
          <h3>
            {t.savedVersion} {version.version} ·{" "}
            {isSelected ? t.selected : t.superseded}
          </h3>
          <p>{version.input.reason}</p>
          <div className="calendar-actions">
            <Button
              onClick={() =>
                open({
                  ...version.input,
                  baseVersion: version.version,
                  baseRevisionId: version.id,
                  reason: "",
                  review: null,
                })
              }
            >
              {e.revise}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  const r = await bookingQuotationHistory(
                    shopId,
                    version.familyId,
                  );
                  if (alive.current) {
                    setHistory(r.versions);
                    setHistoryNext(r.next);
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
                  const r = await customerBookingQuotation(shopId, version.id);
                  if (alive.current) setCustomer(r);
                })
              }
            >
              {t.customer}
            </Button>
          </div>
          <PublicView value={version.customer} t={t} locale={locale} />
          {(!controller || controller.snapshot().status === "promoted") && (
            <QuotationIssues
              key={version.id}
              shopId={shopId}
              proposalId={version.id}
              locale={locale}
              guard={guard}
              navigation={quotationNavigation}
            />
          )}
          <details>
            <summary>{t.private}</summary>
            <p>
              {t.shared}:{" "}
              {formatEstimatePaise(
                version.privateCosts.shared.amountPaise,
                locale,
              )}{" "}
              · {version.privateCosts.shared.reason}
            </p>
            <p>
              {t.unattributed}:{" "}
              {formatEstimatePaise(
                version.privateCosts.unattributedPaise,
                locale,
              )}
            </p>
            <p>{t.costUnavailable}</p>
          </details>
        </section>
      )}
      {customer && <PublicView value={customer} t={t} locale={locale} />}{" "}
      {!!history.length && (
        <section aria-label={t.history}>
          <h3>{t.history}</h3>
          {history.map((r) => (
            <Button
              key={r.id}
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  if (!quotationNavigation.current()) return;
                  const read = await readBookingQuotation(shopId, r.id);
                  if (alive.current) {
                    setVersion(read.version);
                    setIsSelected(read.selected);
                    setCustomer(undefined);
                  }
                })
              }
            >
              {r.version} · {r.recordedAt} · {r.input.reason}
            </Button>
          ))}
          {historyNext && version && (
            <Button
              onClick={() =>
                void attempt(async () => {
                  const r = await bookingQuotationHistory(
                    shopId,
                    version.familyId,
                    historyNext,
                  );
                  if (alive.current) {
                    setHistory([...history, ...r.versions]);
                    setHistoryNext(r.next);
                  }
                })
              }
            >
              {t.more}
            </Button>
          )}
        </section>
      )}
      {saved?.versions.map((r) => (
        <Button
          key={r.id}
          variant="outline"
          onClick={() =>
            void attempt(async () => {
              if (!quotationNavigation.current()) return;
              const read = await readBookingQuotation(shopId, r.id);
              if (alive.current) {
                setVersion(read.version);
                setIsSelected(read.selected);
                setCustomer(undefined);
              }
            })
          }
        >
          {t.savedVersion} {r.version} · {r.input.reason}
        </Button>
      ))}
      {saved?.next && (
        <Button
          variant="outline"
          onClick={() =>
            void attempt(async () => {
              const more = await listBookingQuotations(
                shopId,
                saved.next ?? undefined,
              );
              if (alive.current)
                setSaved({
                  ...more,
                  versions: [...saved.versions, ...more.versions],
                });
            })
          }
        >
          {t.more} · {t.savedVersion}
        </Button>
      )}
      {drafts.map((d) => (
        <Button
          key={d.id}
          variant="outline"
          onClick={() =>
            void attempt(async () => {
              const r = await scope.read(d.id);
              if (alive.current) open(quotationDraftSchema.parse(r.payload), r);
            })
          }
        >
          {t.restore} · {d.updatedAt}
        </Button>
      ))}
      {draftCursor && (
        <Button
          onClick={() =>
            void attempt(async () => {
              const r = await scope.list(draftCursor);
              if (alive.current) {
                setDrafts([
                  ...drafts,
                  ...r.drafts.filter((d) => d.workflow === "pricing.quotation"),
                ]);
                setDraftCursor(r.next ?? undefined);
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
