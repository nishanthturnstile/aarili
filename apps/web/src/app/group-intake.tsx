import { onOwnerInvalidation } from "@aarili/api/client";
import { readCustomer, searchCustomers } from "@aarili/api/customer-client";
import {
  OrderRequestError,
  previewQuickOrder,
  reviewGroupIntake,
} from "@aarili/api/orders-client";
import type { CustomerSearchPage } from "@aarili/contracts/customers";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  emptyGroupIntake,
  emptyQuickOrder,
  type GroupIntakeDraft,
  type GroupIntakeReview,
  groupIntakeDraftSchema,
  type QuickOrderDraft,
} from "@aarili/contracts/orders";
import {
  bookingMessages,
  draftMessages,
  formatBookingPaise,
  formatOrderPaise,
  groupIntakeMessages,
  type Locale,
  orderAcceptanceMessages,
  orderMessages,
  orderPieceMessages,
  shopCommitmentsMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { v7 } from "uuid";
import { DraftForm } from "./draft-form";
import type { DraftRecovery, DraftState } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import { QuickOrderFields } from "./orders-screen";
import type { OwnerGuard } from "./owner-feedback";

function LineEditor({
  controller,
  line,
  form,
  shopId,
  locale,
}: {
  controller: DraftRecovery;
  line: GroupIntakeDraft["lines"][number];
  form: UseFormReturn<GroupIntakeDraft>;
  shopId: string;
  locale: Locale;
}) {
  const local = useForm<QuickOrderDraft>({ defaultValues: line.intake });
  const projection = useMemo(() => {
    let last: DraftState | undefined, result: DraftState;
    return {
      ...controller,
      snapshot: () => {
        const s = controller.snapshot();
        if (s !== last) {
          last = s;
          const p = groupIntakeDraftSchema.safeParse(s.values);
          result = {
            ...s,
            values: p.success
              ? (p.data.lines.find((l) => l.id === line.id)?.intake ??
                emptyQuickOrder())
              : emptyQuickOrder(),
          };
        }
        return result;
      },
    };
  }, [controller, line.id]);
  useEffect(() => {
    const watch = local.watch((value) => {
      const lines = form.getValues("lines");
      form.setValue(
        "lines",
        lines.map((l) =>
          l.id === line.id ? { ...l, intake: value as QuickOrderDraft } : l,
        ),
        { shouldDirty: true },
      );
      form.setValue("review", null, { shouldDirty: true });
    });
    return () => watch.unsubscribe();
  }, [local, form, line.id]);
  return (
    <>
      <div className="owner-actions">
        <Button
          type="button"
          variant="outline"
          aria-pressed={line.intake.presentation === "simple"}
          onClick={() =>
            local.setValue("presentation", "simple", { shouldDirty: true })
          }
        >
          {orderMessages[locale].simple}
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={line.intake.presentation === "detailed"}
          onClick={() =>
            local.setValue("presentation", "detailed", { shouldDirty: true })
          }
        >
          {orderMessages[locale].detailed}
        </Button>
      </div>
      <QuickOrderFields
        controller={projection}
        form={local}
        shopId={shopId}
        locale={locale}
        t={orderMessages[locale]}
        grouped
      />
    </>
  );
}
const facts = (v: GroupIntakeDraft) =>
  JSON.stringify({
    ...v,
    review: null,
    lines: v.lines.map((l) => ({
      ...l,
      intake: { ...l.intake, commitmentReview: null },
    })),
  });
function PayerPicker({
  form,
  shopId,
  locale,
  value,
}: {
  form: UseFormReturn<GroupIntakeDraft>;
  shopId: string;
  locale: Locale;
  value: string | null;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<CustomerSearchPage>(),
    [label, setLabel] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    epoch = useRef(0),
    b = bookingMessages[locale],
    o = orderMessages[locale];
  useEffect(() => {
    let active = true;
    setLabel("");
    if (value)
      void readCustomer(shopId, value).then(
        (r) => {
          if (active) setLabel(r.displayName);
        },
        () => {
          if (active) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [shopId, value]);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  async function search(cursor?: CustomerSearchPage["next"]) {
    const n = ++epoch.current;
    setBusy(true);
    setFailed(false);
    try {
      const r = await searchCustomers(shopId, {
        query,
        limit: 10,
        ...(cursor ? { cursor } : {}),
      });
      if (epoch.current === n) setResults(r);
    } catch {
      if (epoch.current === n) setFailed(true);
    } finally {
      if (epoch.current === n) setBusy(false);
    }
  }
  return (
    <section aria-label={b.payer}>
      <Field>
        <FieldLabel htmlFor="group-payer-query">
          {b.payer} · {o.query}
        </FieldLabel>
        <Input
          id="group-payer-query"
          maxLength={200}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void search()}
        >
          {o.search}
        </Button>
      </Field>
      <p>{value ? label || b.existingPayer : b.none}</p>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          form.setValue("context.payerId", null, { shouldDirty: true });
          setResults(undefined);
        }}
      >
        {b.none}
      </Button>
      {results && (
        <ul className="order-choices">
          {results.customers.map((c) => (
            <li key={c.id}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.setValue("context.payerId", c.id, { shouldDirty: true });
                  setResults(undefined);
                }}
              >
                {c.displayName} · {c.code}
              </Button>
            </li>
          ))}
          {results.next && (
            <li>
              <Button
                type="button"
                variant="outline"
                onClick={() => void search(results.next)}
              >
                {b.more}
              </Button>
            </li>
          )}
        </ul>
      )}
      {failed && <p role="alert">{b.error}</p>}
    </section>
  );
}
function Editor({
  controller,
  shopId,
  guard,
  locale,
}: {
  controller: DraftRecovery;
  shopId: string;
  guard: OwnerGuard;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    parsed = groupIntakeDraftSchema.safeParse(s.values),
    v = parsed.success ? parsed.data : emptyGroupIntake(),
    t = groupIntakeMessages[locale],
    b = bookingMessages[locale],
    a = orderAcceptanceMessages[locale];
  const issueLabel = (key: string) => {
    const field =
      key === "customer" ? "customerId" : key === "wearer" ? "wearerId" : key;
    for (const dictionary of [
      t,
      a,
      shopCommitmentsMessages[locale],
      orderMessages[locale],
    ] as Readonly<Record<string, string>>[]) {
      const label = dictionary[field];
      if (label) return label;
    }
    return a.unknownFallback;
  };
  const [active, setActive] = useState(v.lines[0]?.id),
    [review, setReview] = useState<GroupIntakeReview>(),
    [reviewFacts, setReviewFacts] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [names, setNames] = useState<Record<string, string>>({}),
    [services, setServices] = useState<
      Record<string, { en: string; ta: string }>
    >({}),
    [lineEpoch, setLineEpoch] = useState(0);
  const previousConflict = useRef(s.conflict);
  useEffect(() => {
    if (previousConflict.current && !s.conflict) setLineEpoch((n) => n + 1);
    previousConflict.current = s.conflict;
  }, [s.conflict]);
  const identities = JSON.stringify(
    v.lines.map((l) => ({
      id: l.id,
      customerId: l.intake.customerId,
      wearerId: l.intake.wearerId,
      manifest: l.intake.manifest,
    })),
  );
  useEffect(() => {
    let current = true;
    setNames({});
    setServices({});
    const ac = new AbortController();
    const timer = setTimeout(() => {
      void Promise.all(
        (
          JSON.parse(identities) as {
            id: string;
            customerId: string | null;
            wearerId: string | null;
            manifest: QuickOrderDraft["manifest"];
          }[]
        ).map(async (l) => ({
          id: l.id,
          preview: await previewQuickOrder(
            shopId,
            {
              ...emptyQuickOrder(),
              customerId: l.customerId,
              wearerId: l.wearerId,
              manifest: l.manifest,
            },
            ac.signal,
          ),
        })),
      ).then(
        (rows) => {
          if (current) {
            setNames(
              Object.fromEntries(
                rows.map((r) => [
                  r.id,
                  r.preview.wearer?.label ?? b.identityUnavailable,
                ]),
              ),
            );
            setServices(
              Object.fromEntries(
                rows.map((r) => [
                  r.id,
                  {
                    en:
                      r.preview.requirements?.definition.labelEn ??
                      b.identityUnavailable,
                    ta:
                      r.preview.requirements?.definition.labelTa ??
                      b.identityUnavailable,
                  },
                ]),
              ),
            );
          }
        },
        () => {
          if (current) setFailed(true);
        },
      );
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
      ac.abort();
    };
  }, [identities, shopId, b.identityUnavailable]);
  const alive = useRef(true);
  useEffect(() => {
    if (s.error === "NOT_FOUND") {
      setNames({});
      setServices({});
      controller.invalidate();
    }
  }, [controller, s.error]);
  useEffect(() => {
    if (s.status === "conflict" || s.status === "denied") {
      setReview(undefined);
      setReviewFacts("");
    }
  }, [s.status]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const line = v.lines.find((l) => l.id === active) ?? v.lines[0];
  async function inspect() {
    setBusy(true);
    setFailed(false);
    setReview(undefined);
    try {
      await controller.save();
      const current = controller.snapshot();
      if (
        current.status !== "saved" ||
        current.work.dirty ||
        current.work.outcomeUnknown
      )
        throw Error("Save first");
      const input = groupIntakeDraftSchema.parse(current.values),
        r = await reviewGroupIntake(shopId, input);
      if (
        alive.current &&
        facts(groupIntakeDraftSchema.parse(controller.snapshot().values)) ===
          facts(input)
      ) {
        setReview(r);
        setReviewFacts(facts(input));
      }
    } catch (error) {
      if (
        alive.current &&
        error instanceof OrderRequestError &&
        [403, 404].includes(error.status)
      ) {
        setNames({});
        setServices({});
        controller.invalidate();
      }
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const valid =
    !!review &&
    reviewFacts === facts(v) &&
    !review.unknowns.length &&
    review.lines.every(
      (l) => !l.review.unknowns.length && !!l.review.evaluation,
    ) &&
    v.review?.fingerprint === review.fingerprint &&
    v.review.acknowledged &&
    s.status === "saved" &&
    !s.work.dirty &&
    !s.work.inFlight;
  return (
    <div className="order-editor booking-editor">
      <section className="booking-orientation" aria-label={t.draft}>
        <h3>{t.draft}</h3>
        <p role="status">{draftMessages[locale][s.status]}</p>
        <p>
          {b.selected}:{" "}
          {v.lines
            .map(
              (l, i) =>
                `${t.line} ${i + 1} · ${names[l.id] ?? b.identityUnavailable} · ${l.intake.deliveryDate || "—"}`,
            )
            .join("; ")}
        </p>
      </section>
      <DraftForm
        controller={controller}
        schema={groupIntakeDraftSchema}
        guard={guard}
        locale={locale}
        canPromote={false}
        renderConflict={(r) => (
          <section>
            <p>{groupIntakeDraftSchema.parse(r.payload).context.notes}</p>
            <p>{groupIntakeDraftSchema.parse(r.payload).commercial.basis}</p>
            {groupIntakeDraftSchema.parse(r.payload).lines.map((l) => (
              <article key={l.id}>
                <p>{l.intake.instructions}</p>
                <p>
                  {l.intake.deliveryDate} {l.intake.deliveryTime}
                </p>
                <p>
                  {l.intake.priceState} {l.intake.priceText}
                </p>
              </article>
            ))}
          </section>
        )}
      >
        {(form) => (
          <>
            <div className="owner-actions">
              <Button
                type="button"
                disabled={v.lines.length >= 20 || busy}
                onClick={() => {
                  const id = v7();
                  form.setValue(
                    "lines",
                    [...v.lines, { id, intake: emptyQuickOrder() }],
                    { shouldDirty: true },
                  );
                  form.setValue("review", null);
                  setLineEpoch((n) => n + 1);
                  setActive(id);
                }}
              >
                {t.add}
              </Button>
            </div>
            {!v.lines.length && <p>{t.empty}</p>}
            <div className="booking-garments">
              <ol className="order-choices">
                {v.lines.map((l, i) => (
                  <li key={l.id}>
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={line?.id === l.id}
                      onClick={() => setActive(l.id)}
                    >
                      {t.edit} {i + 1}
                    </Button>
                    <p>
                      <strong>{names[l.id] ?? b.identityUnavailable}</strong>
                    </p>
                    <p>{services[l.id]?.[locale] ?? b.identityUnavailable}</p>
                    <p>
                      {v.commercial.basis === "package-proposal"
                        ? `${t.reference}: `
                        : ""}
                      {l.intake.priceState === "quoted"
                        ? `${orderMessages[locale].quoted}: ₹${l.intake.priceText}`
                        : orderMessages[locale].toBeQuoted}
                    </p>
                    <p>
                      {l.intake.instructions || t.line} ·{" "}
                      {l.intake.deliveryDate || "—"}
                    </p>
                    <div className="owner-actions">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!i}
                        onClick={() => {
                          const next = [...v.lines];
                          [next[i - 1], next[i]] = [
                            next[i] as typeof l,
                            next[i - 1] as typeof l,
                          ];
                          form.setValue("lines", next, { shouldDirty: true });
                          form.setValue("review", null);
                        }}
                      >
                        {t.up} {i + 1}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={i === v.lines.length - 1}
                        onClick={() => {
                          const next = [...v.lines];
                          [next[i], next[i + 1]] = [
                            next[i + 1] as typeof l,
                            next[i] as typeof l,
                          ];
                          form.setValue("lines", next, { shouldDirty: true });
                          form.setValue("review", null);
                        }}
                      >
                        {t.down} {i + 1}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          form.setValue(
                            "lines",
                            v.lines.filter((x) => x.id !== l.id),
                            { shouldDirty: true },
                          );
                          form.setValue("review", null);
                        }}
                      >
                        {t.remove} {i + 1}
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              {line && (
                <section aria-label={`${t.line} ${v.lines.indexOf(line) + 1}`}>
                  <h3>
                    {t.line} {v.lines.indexOf(line) + 1}
                  </h3>
                  {line.id !== v.lines[0]?.id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const first = v.lines[0];
                        if (!first) return;
                        form.setValue(
                          "lines",
                          v.lines.map((l) =>
                            l.id === line.id
                              ? {
                                  ...l,
                                  intake: {
                                    ...l.intake,
                                    customerId: first.intake.customerId,
                                    occasion: first.intake.occasion,
                                    eventDate: first.intake.eventDate,
                                    commitmentReview: null,
                                  },
                                }
                              : l,
                          ),
                          { shouldDirty: true },
                        );
                        form.setValue("review", null);
                        setLineEpoch((n) => n + 1);
                      }}
                    >
                      {t.copy}
                    </Button>
                  )}
                  {v.commercial.basis === "package-proposal" && (
                    <p>
                      {t.included} {t.reference}
                    </p>
                  )}
                  <LineEditor
                    key={`${line.id}:${lineEpoch}`}
                    controller={controller}
                    line={line}
                    form={form}
                    shopId={shopId}
                    locale={locale}
                  />
                </section>
              )}
            </div>
            <h3>{b.occasion}</h3>
            <Field>
              <FieldLabel htmlFor="group-occasion">{b.occasion}</FieldLabel>
              <select
                id="group-occasion"
                {...form.register("context.occasion")}
              >
                <option value="visit">{b.visit}</option>
                <option value="bridal">{b.bridal}</option>
                <option value="other">{b.other}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="group-event">{b.event}</FieldLabel>
              <Input
                id="group-event"
                type="date"
                {...form.register("context.eventDate")}
              />
            </Field>
            <p>{b.independent}</p>
            <Field>
              <FieldLabel htmlFor="group-notes">{b.notes}</FieldLabel>
              <textarea
                id="group-notes"
                maxLength={2000}
                {...form.register("context.notes")}
              />
            </Field>
            <PayerPicker
              form={form}
              shopId={shopId}
              locale={locale}
              value={v.context.payerId}
            />
            <Field>
              <FieldLabel htmlFor="group-basis">{t.basis}</FieldLabel>
              <select id="group-basis" {...form.register("commercial.basis")}>
                <option value="garment-prices">{t.aggregate}</option>
                <option value="package-proposal">{t.package}</option>
              </select>
            </Field>
            {v.commercial.basis === "package-proposal" && (
              <>
                <p>{t.included}</p>
                <Field>
                  <FieldLabel htmlFor="group-price-state">
                    {t.packageState}
                  </FieldLabel>
                  <select
                    id="group-price-state"
                    {...form.register("commercial.packagePriceState")}
                  >
                    <option value="to-be-quoted">{t.packageUnknown}</option>
                    <option value="quoted">{a.price}</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="group-price">
                    {t.packageAmount}
                  </FieldLabel>
                  <Input
                    id="group-price"
                    inputMode="decimal"
                    maxLength={40}
                    {...form.register("commercial.packagePriceText")}
                  />
                </Field>
              </>
            )}
            <p>{t.noPayment}</p>
            <Field>
              <FieldLabel htmlFor="group-reason">{t.reason}</FieldLabel>
              <Input
                id="group-reason"
                maxLength={1000}
                {...form.register("reason")}
              />
            </Field>
            <div className="owner-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy || s.work.inFlight || s.work.outcomeUnknown}
                onClick={() => void controller.save()}
              >
                {b.save}
              </Button>
              <Button
                type="button"
                disabled={busy || s.work.inFlight || s.work.outcomeUnknown}
                onClick={() => void inspect()}
              >
                {t.review}
              </Button>
            </div>
            {(failed || s.error) && <p role="alert">{t.error}</p>}
            {review && reviewFacts === facts(v) && (
              <section aria-label={t.review}>
                <h3>{t.review}</h3>
                <p>{a.synthetic}</p>
                <p>{t.allOrNothing}</p>
                <p>
                  {v.context.notes} · {v.context.eventDate}
                </p>
                <p>{v.reason}</p>
                <p>
                  {review.basis === "package-proposal"
                    ? `${t.packagePrice}: ${review.packagePaise === null ? t.packageUnknown : formatBookingPaise(review.packagePaise, locale)} · ${t.allocation}`
                    : b.prices}
                </p>
                {review.unknowns.length > 0 && (
                  <p role="alert">
                    {t.unknowns}: {review.unknowns.map(issueLabel).join("; ")}
                  </p>
                )}
                {review.lines.map((l, i) => (
                  <article className="owner-form" key={l.id}>
                    <h4>
                      {t.line} {i + 1} ·{" "}
                      {l.review.intake.wearer?.label ?? b.identityUnavailable}
                    </h4>
                    <p>
                      {l.review.intake.customer?.label} ·{" "}
                      {locale === "ta"
                        ? l.review.intake.requirements?.definition.labelTa
                        : l.review.intake.requirements?.definition.labelEn}
                    </p>
                    <p>
                      {a.current}: {v.lines[i]?.intake.deliveryDate}{" "}
                      {v.lines[i]?.intake.deliveryTime}
                    </p>
                    <p>{v.lines[i]?.intake.instructions}</p>
                    <p>
                      {review.basis === "package-proposal"
                        ? t.reference
                        : a.price}
                      :{" "}
                      {review.basis === "package-proposal"
                        ? v.lines[i]?.intake.priceState === "quoted"
                          ? v.lines[i]?.intake.priceText
                          : a.toQuote
                        : formatOrderPaise(l.review.intake.pricePaise, locale)}
                    </p>
                    <p>{b.booked}</p>
                    <section
                      aria-label={`${orderPieceMessages[locale].title} ${i + 1}`}
                    >
                      <h5>{orderPieceMessages[locale].title}</h5>
                      {l.pieces?.pieces.map((p) => (
                        <div key={p.key}>
                          <h6>{locale === "ta" ? p.labelTa : p.labelEn}</h6>
                          <p>
                            {p.applicability === "not-applicable"
                              ? orderMessages[locale].notRequired
                              : b.booked}
                          </p>
                          <p>{p.reason}</p>
                          {p.form && (
                            <p>
                              {locale === "ta"
                                ? p.form.labelTa
                                : p.form.labelEn}
                            </p>
                          )}
                          <ul>
                            {l.pieces?.requirements
                              .filter((r) => r.pieceKey === p.key)
                              .map((r) => {
                                const requirement =
                                  l.review.intake.requirements?.items[
                                    r.position
                                  ];
                                return requirement ? (
                                  <li key={r.position}>
                                    {locale === "ta"
                                      ? requirement.labelTa
                                      : requirement.labelEn}{" "}
                                    ·{" "}
                                    {requirement.state === "not-required"
                                      ? orderMessages[locale].notRequired
                                      : orderMessages[locale].unresolved}
                                  </li>
                                ) : null;
                              })}
                          </ul>
                        </div>
                      ))}
                    </section>
                    <ul>
                      {l.review.intake.requirements?.items
                        .filter((_, position) =>
                          l.pieces?.requirements.some(
                            (r) =>
                              r.position === position && r.pieceKey === null,
                          ),
                        )
                        .map((r) => (
                          <li key={`${r.section}:${r.key}`}>
                            {locale === "ta" ? r.labelTa : r.labelEn} ·{" "}
                            {r.state === "not-required"
                              ? orderMessages[locale].notRequired
                              : orderMessages[locale].unresolved}
                          </li>
                        ))}
                    </ul>
                    <p>
                      {t.unknowns}:{" "}
                      {l.review.unknowns.map(issueLabel).join("; ") || "—"}
                    </p>
                    <dl>
                      <dt>{a.capacity}</dt>
                      <dd>
                        {l.review.evaluation?.facts.existing ?? "—"} /{" "}
                        {l.review.evaluation?.facts.cap ?? "—"}
                      </dd>
                    </dl>
                    <p>
                      {l.review.evaluation?.warnings.map(issueLabel).join("; ")}
                    </p>
                  </article>
                ))}
                <Field>
                  <FieldLabel htmlFor="group-exception">
                    {t.exception}
                  </FieldLabel>
                  <Input
                    id="group-exception"
                    maxLength={1000}
                    value={v.review?.exceptionReason ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        "review",
                        {
                          fingerprint: review.fingerprint,
                          acknowledged: false,
                          exceptionReason: e.target.value,
                          waiveRush: false,
                          waiverReason: "",
                        },
                        { shouldDirty: true },
                      )
                    }
                  />
                </Field>
                <label className="order-check">
                  <input
                    type="checkbox"
                    checked={!!v.review?.acknowledged}
                    onChange={(e) =>
                      form.setValue(
                        "review",
                        {
                          fingerprint: review.fingerprint,
                          acknowledged: e.target.checked,
                          exceptionReason: v.review?.exceptionReason ?? "",
                          waiveRush: false,
                          waiverReason: "",
                        },
                        { shouldDirty: true },
                      )
                    }
                  />
                  {t.ack}
                </label>
                <Button
                  type="button"
                  disabled={!valid || busy}
                  onClick={() => void controller.promote()}
                >
                  {t.confirm}
                </Button>
              </section>
            )}
          </>
        )}
      </DraftForm>
    </div>
  );
}
export function GroupIntake({
  shopId,
  guard,
  locale,
  back,
  initialDraftId,
  onBooked,
}: {
  shopId: string;
  guard: OwnerGuard;
  locale: Locale;
  back: () => void;
  initialDraftId?: string | undefined;
  onBooked: (id: string) => void;
}) {
  const t = groupIntakeMessages[locale],
    [scope] = useState(() => createDraftScope(shopId, guard)),
    [controller, setController] = useState<DraftRecovery>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [next, setNext] = useState<DraftCursor | null>(null),
    [failed, setFailed] = useState(false),
    alive = useRef(true),
    current = useRef<DraftRecovery | undefined>(undefined);
  function open(record?: DraftRecord) {
    if (record) {
      if (record.workflow !== "order.group" || record.schemaVersion !== 1) {
        setFailed(true);
        return;
      }
      if (
        record.lifecycle === "promoted" &&
        record.result?.type === "booking.revision"
      ) {
        onBooked(record.result.id);
        return;
      }
      if (record.lifecycle !== "active") {
        setFailed(true);
        return;
      }
    }
    if (current.current) {
      if (!current.current.confirmLeave(() => window.confirm(t.close))) return;
      scope.release(current.current);
    }
    const c = scope.open({
      workflow: "order.group",
      schemaVersion: 1,
      initial: emptyGroupIntake(),
      ...(record ? { record } : {}),
      committed: (r) => {
        if (
          alive.current &&
          r.lifecycle === "promoted" &&
          r.result?.type === "booking.revision"
        )
          onBooked(r.result.id);
      },
    });
    current.current = c;
    setController(c);
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial draft loading captures the initial open callback; locale changes must not reopen/replace unsaved work.
  useEffect(() => {
    alive.current = true;
    let active = true;
    const stop = onOwnerInvalidation(() => {
      alive.current = false;
      setController(undefined);
      setDrafts([]);
    });
    void (
      initialDraftId
        ? scope.read(initialDraftId).then((r) => {
            if (active && alive.current) open(r);
          })
        : scope.list().then((r) => {
            if (active && alive.current) {
              setDrafts(r.drafts.filter((d) => d.workflow === "order.group"));
              setNext(r.next);
            }
          })
    ).catch(() => {
      if (alive.current) setFailed(true);
    });
    return () => {
      active = false;
      alive.current = false;
      stop();
      queueMicrotask(() => {
        if (!alive.current) scope.dispose();
      });
    };
  }, [scope, initialDraftId]);
  return (
    <section className="owner-form order-intake" aria-label={t.title}>
      <h2>{t.title}</h2>
      <div className="owner-actions">
        <Button
          variant="outline"
          onClick={() => {
            if (
              current.current &&
              !current.current.confirmLeave(() => window.confirm(t.close))
            )
              return;
            back();
          }}
        >
          {t.back}
        </Button>
        {!controller && <Button onClick={() => open()}>{t.new}</Button>}
      </div>
      {failed && <p role="alert">{t.error}</p>}
      {controller ? (
        <Editor
          controller={controller}
          shopId={shopId}
          guard={guard}
          locale={locale}
        />
      ) : (
        <ul className="order-choices">
          {drafts.map((d, i) => (
            <li key={d.id}>
              <Button
                variant="outline"
                onClick={() =>
                  void scope.read(d.id).then(
                    (r) => {
                      if (alive.current) open(r);
                    },
                    () => setFailed(true),
                  )
                }
              >
                {t.resume} {i + 1}
              </Button>
              <p>{groupIntakeDraftSchema.parse(d.payload).context.notes}</p>
            </li>
          ))}
          {next && (
            <li>
              <Button
                variant="outline"
                onClick={() =>
                  void scope.list(next).then(
                    (r) => {
                      if (alive.current) {
                        setDrafts((rows) => [
                          ...rows,
                          ...r.drafts.filter(
                            (d) => d.workflow === "order.group",
                          ),
                        ]);
                        setNext(r.next);
                      }
                    },
                    () => {
                      if (alive.current) setFailed(true);
                    },
                  )
                }
              >
                {bookingMessages[locale].more}
              </Button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
