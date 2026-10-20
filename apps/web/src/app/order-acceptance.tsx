import {
  changeOrderPresentation,
  OrderRequestError,
  readAcceptedOrder,
  readOrderHistory,
  reviewQuickOrder,
} from "@aarili/api/orders-client";
import type {
  AcceptedOrder,
  OrderReview,
  QuickOrderDraft,
} from "@aarili/contracts/orders";
import {
  formatOrderPaise,
  type Locale,
  orderAcceptanceMessages,
  orderMessages,
  shopCommitmentsMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { DraftRecovery } from "./draft-recovery";
import { OrderPiecesDetail } from "./order-pieces";
import type { OwnerGuard } from "./owner-feedback";

function material(v: QuickOrderDraft) {
  const { commitmentReview: _review, ...fields } = v;
  return JSON.stringify(fields);
}
export function CommitmentReview({
  shopId,
  controller,
  form,
  locale,
}: {
  shopId: string;
  controller: DraftRecovery;
  form: UseFormReturn<QuickOrderDraft>;
  locale: Locale;
}) {
  const t = orderAcceptanceMessages[locale];
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [review, setReview] = useState<OrderReview>(),
    [reviewedInput, setReviewedInput] = useState(""),
    [working, setWorking] = useState(false),
    [failed, setFailed] = useState(false);
  const intent = (s.values as QuickOrderDraft).commitmentReview,
    ack = intent?.acknowledged ?? false,
    reason = intent?.exceptionReason ?? "",
    waive = intent?.waiveRush ?? false,
    waiverReason = intent?.waiverReason ?? "";
  function decision(
    values: Partial<NonNullable<QuickOrderDraft["commitmentReview"]>>,
  ) {
    if (!review) return;
    const previous = form.getValues("commitmentReview");
    form.setValue(
      "commitmentReview",
      {
        fingerprint: review.fingerprint,
        acknowledged: previous?.acknowledged ?? false,
        exceptionReason: previous?.exceptionReason ?? "",
        waiveRush: previous?.waiveRush ?? false,
        waiverReason: previous?.waiverReason ?? "",
        ...values,
      },
      { shouldDirty: true },
    );
  }
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const current = material(s.values as QuickOrderDraft),
    valid = !!review && reviewedInput === current;
  async function inspect() {
    setWorking(true);
    setFailed(false);
    setReview(undefined);
    try {
      await controller.save();
      const saved = controller.snapshot();
      if (
        saved.status !== "saved" ||
        saved.work.dirty ||
        saved.work.outcomeUnknown
      )
        throw Error("Resolve save");
      const input = saved.values as QuickOrderDraft,
        m = material(input),
        r = await reviewQuickOrder(shopId, input);
      if (
        alive.current &&
        material(controller.snapshot().values as QuickOrderDraft) === m
      ) {
        setReview(r);
        setReviewedInput(m);
        const previous = form.getValues("commitmentReview");
        form.setValue(
          "commitmentReview",
          {
            fingerprint: r.fingerprint,
            acknowledged: false,
            exceptionReason: previous?.exceptionReason ?? "",
            waiveRush: r.evaluation?.facts.rush
              ? (previous?.waiveRush ?? false)
              : false,
            waiverReason: previous?.waiverReason ?? "",
          },
          { shouldDirty: true },
        );
      }
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  async function confirm() {
    if (!review || !valid || !ack) return;
    setWorking(true);
    setFailed(false);
    const decision = {
      fingerprint: review.fingerprint,
      acknowledged: ack,
      exceptionReason: reason,
      waiveRush: waive,
      waiverReason,
    };
    form.setValue("commitmentReview", decision, { shouldDirty: true });
    controller.edit(form.getValues());
    await controller.save();
    if (alive.current) {
      const saved = controller.snapshot();
      if (
        saved.status === "saved" &&
        !saved.work.dirty &&
        material(saved.values as QuickOrderDraft) === reviewedInput
      ) {
        await controller.promote();
        if (alive.current && controller.snapshot().status === "saved") {
          setFailed(true);
          setReview(undefined);
        }
      }
      setWorking(false);
    }
  }
  const facts = review?.evaluation?.facts,
    warnings = review?.evaluation?.warnings ?? [];
  const needsException = warnings.some(
    (w) => w === "capacityExceeded" || w === "cutoffPassed",
  );
  const blocked =
    working ||
    s.work.inFlight ||
    s.work.outcomeUnknown ||
    s.status === "conflict" ||
    s.status === "promoted";
  const warning = (key: string) =>
    key in t ? t[key as keyof typeof t] : t.unknownFallback;
  const unknown = (key: string) => {
    if (key in t) return t[key as keyof typeof t];
    const shared = shopCommitmentsMessages[locale];
    if (key in shared) return shared[key as keyof typeof shared];
    const fields = orderMessages[locale],
      field =
        key === "customer" ? "customerId" : key === "wearer" ? "wearerId" : key;
    return field in fields
      ? fields[field as keyof typeof fields]
      : t.unknownFallback;
  };
  return (
    <section className="owner-form" aria-label={t.review}>
      <Button
        type="button"
        variant="outline"
        disabled={blocked}
        onClick={() => void inspect()}
      >
        {t.review}
      </Button>
      {failed && <p role="alert">{t.changed}</p>}
      {valid && review && (
        <div className="owner-form">
          <h3>{t.review}</h3>
          <p>{t.synthetic}</p>
          <p>
            {review.intake.customer?.label} · {review.intake.wearer?.label}
          </p>
          <p>
            {locale === "ta"
              ? review.intake.requirements?.definition.labelTa
              : review.intake.requirements?.definition.labelEn}
          </p>
          <p>
            {form.getValues("deliveryDate")} {form.getValues("deliveryTime")}
          </p>
          <p>
            {t.price}:{" "}
            {form.getValues("priceState") === "to-be-quoted"
              ? t.toQuote
              : formatOrderPaise(review.intake.pricePaise, locale)}
          </p>
          {facts && (
            <dl>
              <dt>{t.capacity}</dt>
              <dd>
                {facts.cap ?? "—"} (
                {facts.unit === "garments"
                  ? locale === "ta"
                    ? "ஆடைகள்"
                    : "garments"
                  : "—"}
                )
              </dd>
              <dt>{t.existing}</dt>
              <dd>{facts.existing ?? "—"}</dd>
              <dt>{t.candidate}</dt>
              <dd>{facts.candidate ?? "—"}</dd>
              <dt>{t.total}</dt>
              <dd>{facts.total ?? "—"}</dd>
              <dt>{t.week}</dt>
              <dd>{facts.weekStart}</dd>
              <dt>{t.lead}</dt>
              <dd>
                {facts.leadDays ?? "—"} / {facts.requiredLead ?? "—"}
              </dd>
            </dl>
          )}
          {!!facts?.cutoffs.length && (
            <div>
              <h4>{t.cutoffs}</h4>
              <ul>
                {facts.cutoffs.map((c) => (
                  <li key={`${c.label}:${c.date}`}>
                    {c.label}: {c.date} {c.time}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!warnings.length && (
            <div>
              <h4>{t.warning}</h4>
              <ul>
                {warnings.map((w) => (
                  <li key={w}>{warning(w)}</li>
                ))}
              </ul>
              <Field>
                <FieldLabel htmlFor="qo-exception">{t.reason}</FieldLabel>
                <Input
                  id="qo-exception"
                  value={reason}
                  maxLength={1000}
                  onChange={(e) =>
                    decision({ exceptionReason: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          {!!review.unknowns.length && (
            <div role="status">
              <h4>{t.unknown}</h4>
              <ul>
                {review.unknowns.map((key) => (
                  <li key={key}>{unknown(key)}</li>
                ))}
              </ul>
            </div>
          )}
          {facts?.rush && (
            <div className="owner-form">
              <p>
                {t.suggested}: {formatOrderPaise(facts.rushPaise, locale)}
              </p>
              <label className="order-check">
                <input
                  type="checkbox"
                  checked={waive}
                  onChange={(e) => decision({ waiveRush: e.target.checked })}
                />
                {t.waive}
              </label>
              {waive && (
                <Field>
                  <FieldLabel htmlFor="qo-waiver">{t.waiverReason}</FieldLabel>
                  <Input
                    id="qo-waiver"
                    value={waiverReason}
                    maxLength={1000}
                    onChange={(e) => decision({ waiverReason: e.target.value })}
                  />
                </Field>
              )}
            </div>
          )}
          <label className="order-check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => decision({ acknowledged: e.target.checked })}
            />
            {t.acknowledged}
          </label>
          <div className="owner-actions">
            <Button
              type="button"
              disabled={
                blocked ||
                !ack ||
                !!review.unknowns.length ||
                (needsException && !reason.trim()) ||
                (waive && !waiverReason.trim())
              }
              onClick={() => void confirm()}
            >
              {t.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={blocked}
              onClick={() => setReview(undefined)}
            >
              {t.closeReview}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function AcceptedOrderDetail({
  order: initial,
  shopId,
  locale,
  back,
  guard,
}: {
  order: AcceptedOrder;
  shopId: string;
  locale: Locale;
  back: () => void;
  guard: OwnerGuard;
}) {
  const t = orderAcceptanceMessages[locale],
    [order, setOrder] = useState(initial),
    [working, setWorking] = useState(false),
    [pieceBusy, setPieceBusy] = useState(false),
    [message, setMessage] = useState<"error" | "checking" | "stale">(),
    [conflict, setConflict] = useState<{
      current: AcceptedOrder;
      requestedMode: "simple" | "detailed";
    }>(),
    [history, setHistory] =
      useState<Awaited<ReturnType<typeof readOrderHistory>>>();
  const pending = useRef<
      | {
          mode: "simple" | "detailed";
          key: string;
          version: number;
          unknown: boolean;
        }
      | undefined
    >(undefined),
    alive = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const tracker = guard.track();
    tracker.set({
      dirty: false,
      inFlight: working,
      outcomeUnknown: message === "checking",
    });
    return () => tracker.dispose();
  }, [guard, working, message]);
  useEffect(() => {
    const leaving = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current = undefined;
    };
  }, []);
  async function reload() {
    setWorking(true);
    try {
      const r = await readAcceptedOrder(shopId, order.id);
      if (alive.current) {
        setOrder(r);
        setMessage(undefined);
        setConflict(undefined);
        setHistory(undefined);
      }
    } catch {
      if (alive.current) setMessage("error");
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  async function mode(next?: "simple" | "detailed") {
    if (working) return;
    const command =
      pending.current ??
      (next
        ? {
            mode: next,
            key: crypto.randomUUID(),
            version: order.version,
            unknown: false,
          }
        : undefined);
    if (!command) return;
    pending.current = command;
    setWorking(true);
    try {
      const r = await changeOrderPresentation(
        shopId,
        order.id,
        command.mode,
        command.key,
        command.version,
      );
      if (alive.current) {
        pending.current = undefined;
        setOrder(r);
        setHistory(undefined);
        setMessage(undefined);
        setConflict(undefined);
        if (command.unknown) {
          try {
            const current = await readAcceptedOrder(shopId, order.id);
            if (alive.current) {
              setOrder(current);
              if (current.version !== r.version) {
                setConflict({ current, requestedMode: command.mode });
                setMessage("stale");
              }
            }
          } catch {
            if (alive.current) setMessage("error");
          }
        }
      }
    } catch (e) {
      if (alive.current) {
        if (
          e instanceof OrderRequestError &&
          e.status >= 400 &&
          e.status < 500 &&
          (e.status !== 429 || !command.unknown)
        ) {
          pending.current = undefined;
          if (e.status === 412 && e.body.current)
            setConflict({
              current: e.body.current,
              requestedMode: command.mode,
            });
          setMessage(e.status === 412 ? "stale" : "error");
        } else {
          command.unknown = true;
          setMessage("checking");
        }
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  async function loadHistory(before?: number) {
    setWorking(true);
    try {
      const r = await readOrderHistory(shopId, order.id, before);
      if (alive.current)
        setHistory((h) => ({
          ...r,
          entries: [...(before ? (h?.entries ?? []) : []), ...r.entries],
        }));
    } catch {
      if (alive.current) setMessage("error");
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  return (
    <section className="owner-form" aria-label={order.code}>
      <h2 tabIndex={-1} ref={heading}>
        {t.booked}: {order.code}
      </h2>
      <p>{t.synthetic}</p>
      <p>
        {order.customer?.label} · {order.wearer?.label}
      </p>
      <p>
        {locale === "ta"
          ? order.requirements.definition.labelTa
          : order.requirements.definition.labelEn}
      </p>
      <dl>
        <dt>{t.original}</dt>
        <dd>
          {order.originalPromise.date} {order.originalPromise.time}
        </dd>
        <dt>{t.current}</dt>
        <dd>
          {order.currentPromise.date} {order.currentPromise.time}
        </dd>
        <dt>{t.orderDate}</dt>
        <dd>
          {order.intake.orderDate || order.review.serverDate}
          {order.intake.historicalReason &&
            ` · ${order.intake.historicalReason}`}
        </dd>
        <dt>{t.created}</dt>
        <dd>
          {new Date(order.createdAt).toLocaleString(
            locale === "ta" ? "ta-IN" : "en-IN",
            { timeZone: "Asia/Kolkata" },
          )}
        </dd>
        <dt>{t.intakeStarted}</dt>
        <dd>
          {new Date(order.draftCreatedAt).toLocaleString(
            locale === "ta" ? "ta-IN" : "en-IN",
            { timeZone: "Asia/Kolkata" },
          )}
        </dd>
        <dt>{t.accepted}</dt>
        <dd>
          {new Date(order.acceptedAt).toLocaleString(
            locale === "ta" ? "ta-IN" : "en-IN",
            { timeZone: "Asia/Kolkata" },
          )}
        </dd>
        <dt>{t.requested}</dt>
        <dd>{order.intake.requestedDate || "—"}</dd>
        <dt>{t.event}</dt>
        <dd>{order.intake.eventDate || "—"}</dd>
        <dt>{t.price}</dt>
        <dd>
          {order.commercial
            ? locale === "ta"
              ? "தொகுப்பில் அடங்கும்; ஆடை பங்கீடு தெரியவில்லை"
              : "Included in package; line allocation unknown"
            : order.intake.priceState === "to-be-quoted"
              ? t.toQuote
              : formatOrderPaise(order.pricePaise, locale)}
        </dd>
        <dt>{t.owner}</dt>
        <dd>{locale === "ta" ? "கடை உரிமையாளர்" : "Shop owner"}</dd>
      </dl>
      {order.intake.instructions && <p>{order.intake.instructions}</p>}
      <details>
        <summary>{t.review}</summary>
        <dl>
          <dt>{t.capacity}</dt>
          <dd>{order.review.evaluation?.facts.cap ?? "—"}</dd>
          <dt>{t.existing}</dt>
          <dd>{order.review.evaluation?.facts.existing ?? "—"}</dd>
          <dt>{t.total}</dt>
          <dd>{order.review.evaluation?.facts.total ?? "—"}</dd>
          <dt>{t.reason}</dt>
          <dd>{order.intake.commitmentReview?.exceptionReason || "—"}</dd>
          <dt>{t.waiverReason}</dt>
          <dd>{order.intake.commitmentReview?.waiverReason || "—"}</dd>
        </dl>
      </details>
      <p>{t.next}</p>
      <OrderPiecesDetail
        order={order}
        shopId={shopId}
        locale={locale}
        guard={guard}
        disabled={working || !!pending.current}
        onBusy={setPieceBusy}
      />
      <div className="owner-actions">
        <Button
          disabled={
            working || pieceBusy || !!pending.current || message === "stale"
          }
          onClick={() =>
            void mode(order.presentation === "simple" ? "detailed" : "simple")
          }
        >
          {t.mode}: {order.presentation === "simple" ? t.detailed : t.simple}
        </Button>
        <Button
          variant="outline"
          disabled={working || pieceBusy || !!pending.current}
          onClick={() => void reload()}
        >
          {t.reload}
        </Button>
      </div>
      {message && <p role="alert">{t[message]}</p>}
      {conflict && (
        <dl>
          <dt>{t.requestedMode}</dt>
          <dd>{conflict.requestedMode === "simple" ? t.simple : t.detailed}</dd>
          <dt>{t.serverMode}</dt>
          <dd>
            {conflict.current.presentation === "simple" ? t.simple : t.detailed}{" "}
            · {conflict.current.version}
          </dd>
        </dl>
      )}
      {pending.current && (
        <Button disabled={working} onClick={() => void mode()}>
          {t.retry}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={working || pieceBusy || !!pending.current}
        onClick={() => void loadHistory()}
      >
        {t.history}
      </Button>
      {history && (
        <>
          <ol>
            {history.entries.map((h) => (
              <li key={h.version}>
                {h.version} · {h.mode === "simple" ? t.simple : t.detailed} ·{" "}
                {new Date(h.recordedAt).toLocaleString(
                  locale === "ta" ? "ta-IN" : "en-IN",
                  { timeZone: "Asia/Kolkata" },
                )}
              </li>
            ))}
          </ol>
          {history.next && (
            <Button
              disabled={working}
              onClick={() => void loadHistory(history.next ?? undefined)}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
      <Button
        variant="ghost"
        disabled={working || pieceBusy || !!pending.current}
        onClick={back}
      >
        {t.back}
      </Button>
    </section>
  );
}
