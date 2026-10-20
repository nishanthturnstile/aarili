import { onOwnerInvalidation } from "@aarili/api/client";
import {
  historyBooking,
  listBookingCandidates,
  listBookings,
  OrderRequestError,
  readAcceptedOrder,
  readBooking,
  reviewBooking,
} from "@aarili/api/orders-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type AcceptedOrder,
  type BookingDraft,
  type BookingRecord,
  bookingDraftSchema,
  emptyBookingDraft,
} from "@aarili/contracts/orders";
import {
  bookingMessages,
  draftMessages,
  formatBookingPaise,
  formatOrderPaise,
  groupIntakeMessages,
  type Locale,
  orderAcceptanceMessages,
  orderPieceMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import { AcceptedOrderDetail } from "./order-acceptance";
import { OrderPiecesDetail } from "./order-pieces";
import type { OwnerGuard } from "./owner-feedback";

type Detail = Awaited<ReturnType<typeof readBooking>>;
const material = (v: BookingDraft) =>
  JSON.stringify({ ...v, reviewFingerprint: null });
const ignoreBusy = (_busy: boolean) => {};
const source = (o: AcceptedOrder) => ({
  id: o.id,
  version: o.version,
  snapshotDigest: o.snapshotDigest,
});
function Garment({
  order,
  locale,
  detailed,
  shopId,
  guard,
  showPieces = true,
}: {
  order: AcceptedOrder;
  locale: Locale;
  detailed: boolean;
  shopId: string;
  guard: OwnerGuard;
  showPieces?: boolean;
}) {
  const t = bookingMessages[locale],
    a = orderAcceptanceMessages[locale];
  return (
    <article className="owner-form">
      <h3>
        {order.code} · {order.wearer?.label ?? t.identityUnavailable}
      </h3>
      <p>
        {order.customer?.label ?? t.identityUnavailable} ·{" "}
        {locale === "ta"
          ? order.requirements.definition.labelTa
          : order.requirements.definition.labelEn}
      </p>
      <dl>
        <dt>{a.original}</dt>
        <dd>
          {order.originalPromise.date} {order.originalPromise.time}
        </dd>
        <dt>{a.current}</dt>
        <dd>
          {order.currentPromise.date} {order.currentPromise.time}
        </dd>
        <dt>{a.price}</dt>
        <dd>
          {order.commercial
            ? groupIntakeMessages[locale].included
            : order.pricePaise === null
              ? locale === "ta"
                ? "விலை குறிப்பிடப்படவில்லை"
                : "To be quoted"
              : formatOrderPaise(order.pricePaise, locale)}
        </dd>
      </dl>
      <p>{order.intake.instructions}</p>
      {order.commercial && (
        <p>
          {groupIntakeMessages[locale].included}{" "}
          {groupIntakeMessages[locale].reference}:{" "}
          {formatOrderPaise(order.commercial.referencePaise, locale)}
        </p>
      )}
      <p>{t.booked}</p>
      {showPieces && (
        <OrderPiecesDetail
          order={{ ...order, presentation: detailed ? "detailed" : "simple" }}
          shopId={shopId}
          locale={locale}
          guard={guard}
          disabled={true}
          onBusy={ignoreBusy}
          regionLabel={`${orderPieceMessages[locale].title} ${order.code}`}
        />
      )}
    </article>
  );
}
function Editor({
  controller,
  shopId,
  guard,
  locale,
  choices,
  loadMore,
  hasMore,
  target: initialTarget,
  onDenied,
}: {
  onDenied: () => void;
  controller: DraftRecovery;
  shopId: string;
  guard: OwnerGuard;
  locale: Locale;
  choices: AcceptedOrder[];
  loadMore: () => void;
  hasMore: boolean;
  target?: Detail | undefined;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = bookingDraftSchema.safeParse(s.values).success
      ? bookingDraftSchema.parse(s.values)
      : structuredClone(emptyBookingDraft),
    t = bookingMessages[locale];
  const [target, setTarget] = useState(initialTarget);
  const [reviewed, setReviewed] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [detailed, setDetailed] = useState(false),
    [selected, setSelected] = useState<AcceptedOrder[]>([]),
    [comparison, setComparison] = useState<{
      target: BookingDraft["target"];
      orders: BookingDraft["orders"];
      current?: Detail | undefined;
      currentOrders: AcceptedOrder[];
    }>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (s.status === "denied" || s.error === "NOT_FOUND") onDenied();
  }, [s.status, s.error, onDenied]);
  const ids = v.orders.map((o) => o.id).join(",");
  useEffect(() => {
    let active = true;
    setSelected([]);
    void Promise.all(
      ids ? ids.split(",").map((id) => readAcceptedOrder(shopId, id)) : [],
    ).then(
      (rows) => {
        if (active) setSelected(rows);
      },
      (e) => {
        if (
          active &&
          e instanceof OrderRequestError &&
          [403, 404].includes(e.status)
        ) {
          onDenied();
          return;
        }
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [ids, shopId, onDenied]);
  function update(form: UseFormReturn<BookingDraft>, next: BookingDraft) {
    setReviewed("");
    setComparison(undefined);
    form.reset({ ...next, reviewFingerprint: null });
    controller.edit({ ...next, reviewFingerprint: null });
  }
  async function inspect(form: UseFormReturn<BookingDraft>) {
    setBusy(true);
    setFailed(false);
    setReviewed("");
    try {
      await controller.save();
      const state = controller.snapshot(),
        input = bookingDraftSchema.parse(state.values);
      if (
        state.work.dirty ||
        state.work.outcomeUnknown ||
        state.status !== "saved"
      )
        throw Error("Save first");
      const r = await reviewBooking(shopId, input);
      if (
        alive.current &&
        material(bookingDraftSchema.parse(controller.snapshot().values)) ===
          material(input)
      ) {
        form.setValue("reviewFingerprint", r.fingerprint, {
          shouldDirty: true,
        });
        await controller.save();
        if (alive.current) setReviewed(material(input));
      }
    } catch (e) {
      if (
        alive.current &&
        e instanceof OrderRequestError &&
        [403, 404].includes(e.status)
      ) {
        onDenied();
        return;
      }
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function compare() {
    setBusy(true);
    setFailed(false);
    try {
      if (controller.snapshot().status === "conflict")
        await controller.refreshConflict();
      const current = await Promise.all(
          v.orders.map((o) => readAcceptedOrder(shopId, o.id)),
        ),
        b = v.target ? await readBooking(shopId, v.target.id) : undefined;
      if (alive.current)
        setComparison({
          current: b,
          currentOrders: current,
          orders: current.map(source),
          target: b ? { id: b.booking.id, version: b.booking.version } : null,
        });
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const valid =
    reviewed === material(v) &&
    !!v.reviewFingerprint &&
    s.status === "saved" &&
    !s.work.dirty &&
    !s.work.inFlight;
  return (
    <div className="order-editor booking-editor">
      <section aria-label={t.draft} className="booking-orientation">
        <h3>
          {t.draft}
          {target ? ` · ${target.booking.code}` : ""}
        </h3>
        <p role="status">{draftMessages[locale][s.status]}</p>
        <p>
          {t.selected}:{" "}
          {[...(target?.orders ?? []), ...selected]
            .map(
              (o) => `${o.code} · ${o.wearer?.label ?? t.identityUnavailable}`,
            )
            .join("; ") || "—"}
        </p>
      </section>
      <DraftForm
        controller={controller}
        schema={bookingDraftSchema}
        guard={guard}
        locale={locale}
        canPromote={false}
        renderConflict={(r) => (
          <section>
            <h3>{t.conflict}</h3>
            <p>{bookingDraftSchema.parse(r.payload).context.notes}</p>
            <p>{bookingDraftSchema.parse(r.payload).reason}</p>
          </section>
        )}
      >
        {(form) => (
          <>
            <Field>
              <FieldLabel htmlFor="booking-occasion">{t.occasion}</FieldLabel>
              <select
                id="booking-occasion"
                {...form.register("context.occasion")}
              >
                <option value="visit">{t.visit}</option>
                <option value="bridal">{t.bridal}</option>
                <option value="other">{t.other}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="booking-event">{t.event}</FieldLabel>
              <Input
                id="booking-event"
                type="date"
                {...form.register("context.eventDate")}
              />
            </Field>
            <p>{t.independent}</p>
            <Field>
              <FieldLabel htmlFor="booking-notes">{t.notes}</FieldLabel>
              <textarea
                id="booking-notes"
                maxLength={2000}
                {...form.register("context.notes")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="booking-payer">{t.payer}</FieldLabel>
              <select
                id="booking-payer"
                {...form.register("context.payerId", {
                  setValueAs: (v: string) => v || null,
                })}
              >
                <option value="">{t.none}</option>
                {v.context.payerId &&
                  !choices.some(
                    (o) => o.customer?.id === v.context.payerId,
                  ) && (
                    <option value={v.context.payerId}>{t.existingPayer}</option>
                  )}
                {[
                  ...new Map(
                    choices
                      .filter((o) => o.customer)
                      .map((o) => [o.customer?.id, o.customer]),
                  ).values(),
                ].map(
                  (c) =>
                    c && (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ),
                )}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="booking-reason">{t.reason}</FieldLabel>
              <Input
                id="booking-reason"
                maxLength={1000}
                {...form.register("reason")}
              />
            </Field>
            <div className="booking-garments">
              <section aria-label={t.choose}>
                <h3>{t.choose}</h3>
                {target?.commercial?.basis === "package-proposal" && (
                  <p>{groupIntakeMessages[locale].frozen}</p>
                )}
                {choices.length === 0 && <p>{t.noChoices}</p>}
                <ul className="order-choices">
                  {choices
                    .filter(
                      (o) =>
                        target?.commercial?.basis !== "package-proposal" &&
                        (!v.customerId ||
                          o.intake.customerId === v.customerId) &&
                        !v.orders.some((s) => s.id === o.id) &&
                        !target?.orders.some((s) => s.id === o.id),
                    )
                    .map((o) => (
                      <li key={o.id}>
                        <p>
                          {o.code} · {o.wearer?.label ?? t.identityUnavailable}{" "}
                          · {o.currentPromise.date}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            busy ||
                            v.orders.length + (target?.orders.length ?? 0) >= 50
                          }
                          onClick={() =>
                            update(form, {
                              ...v,
                              customerId: v.customerId ?? o.intake.customerId,
                              orders: [...v.orders, source(o)],
                            })
                          }
                        >
                          {t.add} {o.code}
                        </Button>
                      </li>
                    ))}
                </ul>
                {hasMore && (
                  <Button type="button" variant="outline" onClick={loadMore}>
                    {t.more}
                  </Button>
                )}
              </section>
              <section aria-label={t.selected}>
                <h3>{t.selected}</h3>
                <label className="order-check">
                  <input
                    type="checkbox"
                    checked={detailed}
                    onChange={(e) => setDetailed(e.target.checked)}
                  />
                  {t.detail}
                </label>
                {[...(target?.orders ?? []), ...selected].map((o) => (
                  <div key={o.id}>
                    <Garment
                      order={o}
                      shopId={shopId}
                      guard={guard}
                      locale={locale}
                      detailed={detailed}
                    />
                    {v.orders.some((s) => s.id === o.id) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          update(form, {
                            ...v,
                            orders: v.orders.filter((s) => s.id !== o.id),
                          })
                        }
                      >
                        {t.remove} {o.code}
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            </div>
            {target?.commercial?.basis === "package-proposal" ? (
              <p>
                {groupIntakeMessages[locale].packagePrice}:{" "}
                {target.commercial.packagePaise === null
                  ? groupIntakeMessages[locale].packageUnknown
                  : formatBookingPaise(
                      target.commercial.packagePaise,
                      locale,
                    )}{" "}
                · {groupIntakeMessages[locale].allocation}
              </p>
            ) : (
              <p>
                {t.subtotal}:{" "}
                {formatBookingPaise(
                  [...(target?.orders ?? []), ...selected]
                    .reduce((sum, o) => sum + BigInt(o.pricePaise ?? 0), 0n)
                    .toString(),
                  locale,
                )}{" "}
                · {t.unknown}:{" "}
                {
                  [...(target?.orders ?? []), ...selected].filter(
                    (o) => o.pricePaise === null,
                  ).length
                }
              </p>
            )}
            <p>
              {target?.commercial?.basis === "package-proposal"
                ? groupIntakeMessages[locale].noPayment
                : t.prices}
            </p>
            {(failed || s.status === "conflict" || s.error) && (
              <div role="alert">
                <p>{t.error}</p>
                <p>{t.stale}</p>
              </div>
            )}
            <div className="owner-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy || s.work.inFlight || s.work.outcomeUnknown}
                onClick={() => void controller.save()}
              >
                {t.save}
              </Button>
              <Button
                type="button"
                disabled={busy || s.work.inFlight || s.work.outcomeUnknown}
                onClick={() => void inspect(form)}
              >
                {t.review}
              </Button>
            </div>
            {valid && (
              <section aria-label={t.reviewed}>
                <p>{t.reviewed}</p>
                <p>
                  {v.context.occasion === "bridal"
                    ? t.bridal
                    : v.context.occasion === "visit"
                      ? t.visit
                      : t.other}{" "}
                  · {v.context.eventDate}
                </p>
                <p>{v.context.notes}</p>
                <p>{v.reason}</p>
                {[...(target?.orders ?? []), ...selected].map((o) => (
                  <Garment
                    key={o.id}
                    order={o}
                    shopId={shopId}
                    guard={guard}
                    locale={locale}
                    detailed={detailed}
                    showPieces={false}
                  />
                ))}
                <Button type="button" onClick={() => void controller.promote()}>
                  {t.confirm}
                </Button>
              </section>
            )}
            {(failed || s.status === "conflict" || !!s.error) && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || s.work.outcomeUnknown || s.work.inFlight}
                onClick={() => void compare()}
              >
                {t.reload}
              </Button>
            )}
            {comparison && (
              <section>
                <h3>{t.stale}</h3>
                <p>
                  {t.revision}: {v.target?.version ?? "—"} →{" "}
                  {comparison.target?.version ?? "—"}
                </p>
                {comparison.current && (
                  <p>
                    {comparison.current.booking.revision.context.eventDate} ·{" "}
                    {comparison.current.booking.revision.context.notes}
                  </p>
                )}
                {comparison.orders.map((o) => (
                  <p key={o.id}>
                    {selected.find((s) => s.id === o.id)?.code} · {t.revision}:{" "}
                    {v.orders.find((s) => s.id === o.id)?.version} → {o.version}
                  </p>
                ))}
                <Button
                  type="button"
                  onClick={() => {
                    setTarget(comparison.current);
                    setSelected(comparison.currentOrders);
                    if (controller.snapshot().conflict)
                      controller.resolveConflict("local");
                    update(form, {
                      ...v,
                      target: comparison.target,
                      orders: comparison.orders,
                    });
                  }}
                >
                  {t.rebase}
                </Button>
              </section>
            )}
          </>
        )}
      </DraftForm>
    </div>
  );
}
export function BookingGroups({
  shopId,
  guard,
  locale,
  back,
  initialBookingRevision,
}: {
  shopId: string;
  guard: OwnerGuard;
  locale: Locale;
  back: () => void;
  initialBookingRevision?: string | undefined;
}) {
  const t = bookingMessages[locale],
    [scope] = useState(() => createDraftScope(shopId, guard));
  const [controller, setController] = useState<DraftRecovery>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [draftNext, setDraftNext] = useState<DraftCursor | null>(null),
    [bookings, setBookings] = useState<BookingRecord[]>([]),
    [next, setNext] = useState<string | null>(null),
    [choices, setChoices] = useState<AcceptedOrder[]>([]),
    [choiceNext, setChoiceNext] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail>(),
    [target, setTarget] = useState<Detail>(),
    [order, setOrder] = useState<AcceptedOrder>(),
    [history, setHistory] =
      useState<Awaited<ReturnType<typeof historyBooking>>>(),
    [busy, setBusy] = useState(!!initialBookingRevision),
    [failed, setFailed] = useState(false),
    [detailed, setDetailed] = useState(false);
  const alive = useRef(true),
    selected = useRef<DraftRecovery | undefined>(undefined),
    safe = useSyncExternalStore(guard.subscribe, guard.safe, () => true);
  useEffect(() => {
    if (!initialBookingRevision) return;
    let active = true;
    setBusy(true);
    void readBooking(shopId, initialBookingRevision, true).then(
      (r) => {
        if (active) {
          setDetail(r);
          setFailed(false);
          setBusy(false);
        }
      },
      () => {
        if (active) {
          setFailed(true);
          setBusy(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [initialBookingRevision, shopId]);
  useEffect(() => {
    alive.current = true;
    const stop = onOwnerInvalidation(() => {
      alive.current = false;
      setController(undefined);
      setDrafts([]);
      setBookings([]);
      setChoices([]);
      setDetail(undefined);
      setTarget(undefined);
      setOrder(undefined);
      setHistory(undefined);
    });
    return () => {
      alive.current = false;
      stop();
      queueMicrotask(() => {
        if (!alive.current) scope.dispose();
      });
    };
  }, [scope]);
  const deny = useCallback(() => {
    if (selected.current) {
      scope.release(selected.current);
      selected.current = undefined;
    }
    setController(undefined);
    setTarget(undefined);
    setChoices([]);
    setDrafts([]);
    setBookings([]);
    setDetail(undefined);
    setOrder(undefined);
    setHistory(undefined);
    setFailed(true);
  }, [scope]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch (e) {
      if (alive.current) {
        if (e instanceof OrderRequestError && [403, 404].includes(e.status)) {
          release();
          setDrafts([]);
          setBookings([]);
          setChoices([]);
          setTarget(undefined);
        }
        setFailed(true);
        setDetail(undefined);
        setHistory(undefined);
        setOrder(undefined);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function loadChoices(before?: string) {
    const r = await listBookingCandidates(shopId, before);
    if (alive.current) {
      setChoices((v) =>
        before
          ? [...v, ...r.orders.filter((o) => !v.some((x) => x.id === o.id))]
          : r.orders,
      );
      setChoiceNext(r.next);
    }
  }
  async function refresh() {
    await run(async () => {
      const [b, d] = await Promise.all([listBookings(shopId), scope.list()]);
      if (alive.current) {
        setBookings(b.bookings);
        setNext(b.next);
        setDrafts(
          d.drafts.filter(
            (r) => r.workflow === "booking.group" && r.lifecycle === "active",
          ),
        );
        setDraftNext(d.next);
      }
      await loadChoices();
    });
  }
  useEffect(() => {
    if (initialBookingRevision) return;
    let active = true;
    setBusy(true);
    void Promise.all([
      listBookings(shopId),
      scope.list(),
      listBookingCandidates(shopId),
    ])
      .then(
        ([b, d, o]) => {
          if (active && alive.current) {
            setBookings(b.bookings);
            setNext(b.next);
            setDrafts(
              d.drafts.filter(
                (r) =>
                  r.workflow === "booking.group" && r.lifecycle === "active",
              ),
            );
            setDraftNext(d.next);
            setChoices(o.orders);
            setChoiceNext(o.next);
          }
        },
        () => {
          if (active && alive.current) setFailed(true);
        },
      )
      .finally(() => {
        if (active && alive.current) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [shopId, scope, initialBookingRevision]);
  function release() {
    if (selected.current) scope.release(selected.current);
    selected.current = undefined;
    setController(undefined);
  }
  function leave() {
    if (
      selected.current &&
      !selected.current.confirmLeave(() => window.confirm(t.close))
    )
      return false;
    if (!selected.current && !guard.safe()) return false;
    release();
    return true;
  }
  async function openBooking(id: string, revision = false) {
    await run(async () => {
      const r = await readBooking(shopId, id, revision);
      if (alive.current) {
        release();
        setTarget(undefined);
        setDetail(r);
        setHistory(undefined);
      }
    });
  }
  function open(initial: BookingDraft, record?: DraftRecord) {
    if (!leave()) return;
    setDetail(undefined);
    const c = scope.open({
      workflow: "booking.group",
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (
          alive.current &&
          r.lifecycle === "promoted" &&
          r.result?.type === "booking.revision"
        )
          void openBooking(r.result.id, true);
      },
    });
    selected.current = c;
    setController(c);
  }
  async function resume(id: string) {
    await run(async () => {
      const r = await scope.read(id),
        v = bookingDraftSchema.parse(r.payload),
        target = v.target ? await readBooking(shopId, v.target.id) : undefined;
      if (alive.current) {
        open(v, r);
        setTarget(target);
      }
    });
  }
  return (
    <section className="owner-form order-intake" aria-label={t.title}>
      <h2>{t.title}</h2>
      {!controller && !detail && !order && <p>{t.intro}</p>}
      <div className="owner-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (leave()) back();
          }}
        >
          {t.back}
        </Button>
        {!controller && !detail && !order && (
          <>
            <Button
              disabled={busy || (!controller && !safe)}
              onClick={() => {
                open(structuredClone(emptyBookingDraft));
                setTarget(undefined);
              }}
            >
              {t.new}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void refresh()}
            >
              {t.refresh}
            </Button>
          </>
        )}
      </div>
      {busy && <p role="status">{t.loading}</p>}
      {failed && <p role="alert">{t.error}</p>}
      {order ? (
        <AcceptedOrderDetail
          order={order}
          shopId={shopId}
          guard={guard}
          locale={locale}
          back={() => {
            if (guard.safe()) setOrder(undefined);
          }}
        />
      ) : controller ? (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (leave()) {
                setTarget(undefined);
                void refresh();
              }
            }}
          >
            {t.close}
          </Button>
          <Editor
            key={controller.instance}
            controller={controller}
            onDenied={deny}
            shopId={shopId}
            guard={guard}
            locale={locale}
            choices={choices}
            target={target}
            hasMore={!!choiceNext}
            loadMore={() =>
              void run(() => loadChoices(choiceNext ?? undefined))
            }
          />
        </>
      ) : detail ? (
        <>
          <h3>
            {detail.booking.code} · {t.revision} {detail.booking.version}
          </h3>
          <p>
            {t.selected}:{" "}
            {detail.orders
              .map(
                (o) =>
                  `${o.code} · ${o.wearer?.label ?? t.identityUnavailable}`,
              )
              .join("; ")}
          </p>
          <p>
            {detail.booking.revision.context.occasion === "bridal"
              ? t.bridal
              : detail.booking.revision.context.occasion === "visit"
                ? t.visit
                : t.other}{" "}
            · {detail.booking.revision.context.eventDate}
          </p>
          <p>{detail.booking.revision.context.notes}</p>
          {detail.summary.basis === "garment-prices" ? (
            <p>
              {t.subtotal}:{" "}
              {formatBookingPaise(detail.summary.knownSubtotalPaise, locale)} ·{" "}
              {t.unknown}: {detail.summary.unknownCount}
            </p>
          ) : (
            <p>
              {groupIntakeMessages[locale].packagePrice}:{" "}
              {detail.summary.packagePaise === null
                ? groupIntakeMessages[locale].packageUnknown
                : formatBookingPaise(detail.summary.packagePaise, locale)}{" "}
              · {groupIntakeMessages[locale].allocation}
            </p>
          )}
          <p>
            {detail.summary.basis === "package-proposal"
              ? groupIntakeMessages[locale].noPayment
              : t.prices}
          </p>
          <p>{t.independent}</p>
          <Button
            disabled={!safe || busy}
            onClick={() => {
              const r = detail;
              open({
                ...structuredClone(emptyBookingDraft),
                customerId: r.booking.customerId,
                target: { id: r.booking.id, version: r.booking.version },
                context: r.booking.revision.context,
              });
              setTarget(r);
              if (r.commercial?.basis !== "package-proposal")
                void run(() => loadChoices());
            }}
          >
            {detail.commercial?.basis === "package-proposal"
              ? groupIntakeMessages[locale].contextEdit
              : t.edit}
          </Button>
          <label className="order-check">
            <input
              type="checkbox"
              checked={detailed}
              onChange={(e) => setDetailed(e.target.checked)}
            />
            {t.detail}
          </label>
          {detail.orders.map((o) => (
            <div key={o.id}>
              <Garment
                order={o}
                shopId={shopId}
                guard={guard}
                locale={locale}
                detailed={detailed}
              />
              <Button
                variant="outline"
                disabled={!safe || busy}
                onClick={() => setOrder(o)}
              >
                {o.code}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const h = await historyBooking(shopId, detail.booking.id);
                if (alive.current) setHistory(h);
              })
            }
          >
            {t.history}
          </Button>
          {history && (
            <section aria-label={t.history}>
              <h3>{t.history}</h3>
              {history.entries.map((r) => (
                <article key={r.id}>
                  <h4>
                    {t.revision} {r.version}
                  </h4>
                  <p>
                    {r.recordedAt} · {r.reason}
                  </p>
                  <p>
                    {r.context.eventDate} · {r.context.notes}
                  </p>
                  <p>
                    {t.sources}:{" "}
                    {r.sources
                      .map(
                        (s) =>
                          `${detail.orders.find((o) => o.id === s.id)?.code ?? ""} v${s.version}`,
                      )
                      .join(", ")}
                  </p>
                </article>
              ))}
              {history.next && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void run(async () => {
                      const h = await historyBooking(
                        shopId,
                        detail.booking.id,
                        history.next ?? undefined,
                      );
                      if (alive.current)
                        setHistory({
                          entries: [...history.entries, ...h.entries],
                          next: h.next,
                        });
                    })
                  }
                >
                  {t.more}
                </Button>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <section>
            <h3>{t.title}</h3>
            {bookings.length === 0 && <p>{t.empty}</p>}
            <ul className="order-choices">
              {bookings.map((b) => (
                <li key={b.id}>
                  <Button
                    variant="outline"
                    onClick={() => void openBooking(b.id)}
                  >
                    {t.open} {b.code}
                  </Button>
                </li>
              ))}
            </ul>
            {next && (
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const r = await listBookings(shopId, next);
                    if (alive.current) {
                      setBookings((v) => [...v, ...r.bookings]);
                      setNext(r.next);
                    }
                  })
                }
              >
                {t.more}
              </Button>
            )}
          </section>
          <section>
            <h3>{t.drafts}</h3>
            <ul className="order-choices">
              {drafts.map((d, i) => (
                <li key={d.id}>
                  <Button variant="outline" onClick={() => void resume(d.id)}>
                    {t.resume} {i + 1}
                  </Button>
                  <p>{bookingDraftSchema.parse(d.payload).context.notes}</p>
                </li>
              ))}
            </ul>
            {draftNext && (
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const r = await scope.list(draftNext);
                    if (alive.current) {
                      setDrafts((v) => [
                        ...v,
                        ...r.drafts.filter(
                          (d) =>
                            d.workflow === "booking.group" &&
                            d.lifecycle === "active",
                        ),
                      ]);
                      setDraftNext(r.next);
                    }
                  })
                }
              >
                {t.more}
              </Button>
            )}
          </section>
        </>
      )}
    </section>
  );
}
