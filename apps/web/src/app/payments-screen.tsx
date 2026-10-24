import { readCustomer, searchCustomers } from "@aarili/api/customer-client";
import {
  readPaymentHistory,
  readPaymentOptions,
  readPaymentPosition,
  readPaymentReceipt,
  readPayments,
  resolvePaymentReference,
} from "@aarili/api/payments-client";
import type { CustomerSearchPage } from "@aarili/contracts/customers";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  emptyPayment,
  type PaymentDraft,
  type PaymentEvent,
  type PaymentOptions,
  type PaymentReceipt,
  paymentCommandSchema,
  paymentDraftSchema,
} from "@aarili/contracts/payments";
import { formatPaymentPaise, type Locale, paymentMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type CustomerSummary = CustomerSearchPage["customers"][number];
type T = (typeof paymentMessages)[Locale];
function draftAddress(id?: string) {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function PaymentEditor({
  controller,
  options,
  shopId,
  t,
  locale,
  onResult,
  recipientBusiness,
}: {
  controller: DraftRecovery;
  options: PaymentOptions;
  shopId: string;
  t: T;
  locale: Locale;
  onResult: (id: string) => Promise<void>;
  recipientBusiness: string;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const latestResult = useRef(onResult);
  latestResult.current = onResult;
  const resultId = s.committed?.result?.id;
  useEffect(() => {
    if (resultId) void latestResult.current(resultId);
  }, [resultId]);
  const parsed = paymentDraftSchema.safeParse(s.values);
  const [review, setReview] = useState(false),
    [query, setQuery] = useState(""),
    [matches, setMatches] = useState<CustomerSummary[]>([]),
    [labels, setLabels] = useState<Record<string, string>>({}),
    [searchError, setSearchError] = useState(false);
  const customerId = parsed.success ? parsed.data.customerId : null,
    payerId = parsed.success ? parsed.data.payerId : null;
  useEffect(() => {
    let active = true;
    setLabels({});
    void Promise.all(
      [...new Set([customerId, payerId].filter((v): v is string => !!v))].map(
        async (id) => ({
          id,
          name: (await readCustomer(shopId, id)).displayName,
        }),
      ),
    )
      .then((rows) => {
        if (active)
          setLabels(Object.fromEntries(rows.map((r) => [r.id, r.name])));
      })
      .catch(() => {
        if (active) setSearchError(true);
      });
    return () => {
      active = false;
    };
  }, [customerId, payerId, shopId]);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t.denied}</p>;
  const v = parsed.data,
    closed = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || closed;
  const transition = !!v.receiptId,
    immutable = transition && v.action !== "correct",
    confirms = v.action === "cash-received" || v.action === "upi-seen";
  const account = options.accounts.find(
    (a) => a.id === v.accountId && a.revisionId === v.accountRevisionId,
  );
  const valid = paymentCommandSchema.safeParse(v).success;
  const edit = (value: Partial<PaymentDraft>) => {
    setReview(false);
    controller.edit({ ...v, ...value });
  };
  const actionText = confirms
    ? transition
      ? t.confirm
      : t.cashAction
    : v.action === "fail"
      ? t.markFailed
      : v.action === "correct"
        ? t.append
        : t.report;
  return (
    <section className="payment-editor" aria-label={t.new} lang={locale}>
      <h2>{transition ? actionText : t.new}</h2>
      <p role="status" aria-live="polite">
        {t[s.status]}
      </p>
      {s.error && (
        <p role="alert">{s.error === "VERSION_STALE" ? t.compare : t.error}</p>
      )}
      {s.error === "PAYMENT_REFERENCE_DUPLICATE" && v.customerId && (
        <section>
          <p role="alert">{t.duplicate}</p>
          <Button
            variant="outline"
            onClick={() => {
              void resolvePaymentReference(
                shopId,
                v.customerId ?? "",
                v.reference,
              )
                .then((r) => onResult(r.id))
                .catch(() => setSearchError(true));
            }}
          >
            {t.resolveDuplicate}
          </Button>
        </section>
      )}
      {s.status === "conflict" && (
        <section>
          <p>{t.compare}</p>
          <p>
            {t.local}: {String(s.values.amountText ?? "")} · {t.server}:{" "}
            {String(s.conflict?.payload.amountText ?? "")}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              controller.resolveConflict("server");
              setReview(false);
            }}
          >
            {t.useServer}
          </Button>
        </section>
      )}
      {s.work.outcomeUnknown && (
        <Button onClick={() => void controller.retry()}>{t.retry}</Button>
      )}
      <fieldset
        disabled={busy || immutable}
        className="payment-fields"
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        {!transition && (
          <section>
            <Field>
              <FieldLabel htmlFor="payment-search">{t.search}</FieldLabel>
              <Input
                id="payment-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              onClick={() => {
                setSearchError(false);
                void searchCustomers(shopId, { query, limit: 10 })
                  .then((r) => setMatches(r.customers))
                  .catch(() => setSearchError(true));
              }}
            >
              {t.find}
            </Button>
            {searchError && <p role="alert">{t.error}</p>}
            <ul>
              {matches
                .filter((c) => !c.mergedInto)
                .map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.displayName} · {c.code}
                    </span>
                    <div className="calendar-actions">
                      <Button
                        variant="outline"
                        onClick={() =>
                          edit({
                            customerId: c.id,
                            payerId:
                              v.payerId === v.customerId ? c.id : v.payerId,
                          })
                        }
                      >
                        {t.chooseCustomer}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => edit({ payerId: c.id })}
                      >
                        {t.choosePayer}
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        )}
        <dl className="shop-profile-values">
          <div>
            <dt>{t.customer}</dt>
            <dd>{v.customerId ? (labels[v.customerId] ?? "…") : "—"}</dd>
          </div>
          <div>
            <dt>{t.payer}</dt>
            <dd>{v.payerId ? (labels[v.payerId] ?? "…") : "—"}</dd>
          </div>
        </dl>
        {!transition && (
          <label className="payment-check">
            <input
              type="checkbox"
              checked={!!v.customerId && v.payerId === v.customerId}
              onChange={(e) =>
                edit({ payerId: e.target.checked ? v.customerId : null })
              }
            />
            {t.samePayer}
          </label>
        )}
        <div className="payment-pair">
          <Field>
            <FieldLabel htmlFor="payment-amount">{t.amount}</FieldLabel>
            <Input
              id="payment-amount"
              inputMode="decimal"
              autoComplete="off"
              value={v.amountText}
              onChange={(e) => edit({ amountText: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="payment-date">{t.date}</FieldLabel>
            <Input
              id="payment-date"
              type="date"
              value={v.paymentDate}
              onChange={(e) => edit({ paymentDate: e.target.value })}
            />
          </Field>
        </div>
        <p className="text-muted-foreground">{t.dateHelp}</p>
        <Field>
          <FieldLabel htmlFor="payment-method">{t.method}</FieldLabel>
          <select
            id="payment-method"
            value={v.method}
            onChange={(e) =>
              edit({
                method: e.target.value as PaymentDraft["method"],
                accountId: null,
                accountRevisionId: null,
                attested: false,
                action: transition ? "correct" : "report",
              })
            }
          >
            {(["cash", "upi", "bank"] as const).map((m) => (
              <option key={m} value={m} disabled={!options.enabled.includes(m)}>
                {t[m]}
              </option>
            ))}
          </select>
        </Field>
        {v.method !== "cash" && (
          <Field>
            <FieldLabel htmlFor="payment-account">{t.account}</FieldLabel>
            <select
              id="payment-account"
              value={v.accountRevisionId ?? ""}
              onChange={(e) => {
                const a = options.accounts.find(
                  (a) => a.revisionId === e.target.value,
                );
                edit({
                  accountId: a?.id ?? null,
                  accountRevisionId: a?.revisionId ?? null,
                  attested: false,
                });
              }}
            >
              <option value="">{t.chooseAccount}</option>
              {options.accounts
                .filter((a) => a.method === v.method)
                .map((a) => (
                  <option value={a.revisionId} key={a.id}>
                    {a.label} · {a.maskedIdentifier}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="payment-reference">{t.reference}</FieldLabel>
          <Input
            id="payment-reference"
            value={v.reference}
            autoComplete="off"
            onChange={(e) => edit({ reference: e.target.value })}
          />
        </Field>
      </fieldset>
      <p>
        {t.recipient}: {recipientBusiness}
      </p>
      <p>
        {t.reviewed}:{" "}
        {v.method === "cash"
          ? t.cash
          : account
            ? `${account.label} · ${account.maskedIdentifier}`
            : t.configuration}
      </p>
      <Field>
        <FieldLabel htmlFor="payment-reason">{t.reason}</FieldLabel>
        <Input
          id="payment-reason"
          disabled={busy}
          value={v.reason}
          onChange={(e) => edit({ reason: e.target.value })}
        />
      </Field>
      {!transition && v.method === "cash" && (
        <label className="payment-check">
          <input
            disabled={busy || options.frozen}
            type="checkbox"
            checked={v.action === "cash-received"}
            onChange={(e) =>
              edit({
                action: e.target.checked ? "cash-received" : "report",
                attested: false,
              })
            }
          />
          {t.cashAction}
        </label>
      )}
      {confirms && (
        <label className="payment-check">
          <input
            disabled={busy}
            type="checkbox"
            checked={v.attested}
            onChange={(e) => edit({ attested: e.target.checked })}
          />
          {v.method === "cash" ? t.cashAttestation : t.upiAttestation}
        </label>
      )}
      <p className="text-muted-foreground">{t.evidence}</p>
      {v.method === "bank" && <p>{t.bankGate}</p>}
      {options.frozen && <p>{t.frozen}</p>}
      <div className="calendar-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void controller.save()}
        >
          {t.save}
        </Button>
        <Button
          disabled={busy || !valid || (confirms && options.frozen)}
          onClick={() => {
            void controller.save().then(() => {
              const now = controller.snapshot();
              if (now.status === "saved" && !now.work.dirty) setReview(true);
            });
          }}
        >
          {t.review}
        </Button>
        {!!s.error && !s.work.outcomeUnknown && (
          <Button
            variant="outline"
            disabled={s.work.inFlight}
            onClick={() => void controller.retry()}
          >
            {t.retry}
          </Button>
        )}
      </div>
      {review && !closed && (
        <section className="payment-review">
          <h3>{t.review}</h3>
          <p>{t.reviewHelp}</p>
          <dl className="shop-profile-values">
            <div>
              <dt>{t.customer}</dt>
              <dd>{labels[v.customerId ?? ""] ?? "—"}</dd>
            </div>
            <div>
              <dt>{t.payer}</dt>
              <dd>{labels[v.payerId ?? ""] ?? "—"}</dd>
            </div>
            <div>
              <dt>{t.amount}</dt>
              <dd>₹{v.amountText}</dd>
            </div>
            <div>
              <dt>{t.date}</dt>
              <dd>{v.paymentDate}</dd>
            </div>
            <div>
              <dt>{t.method}</dt>
              <dd>{t[v.method]}</dd>
            </div>
            <div>
              <dt>{t.status}</dt>
              <dd>
                {confirms
                  ? t.confirmed
                  : v.action === "fail"
                    ? t.failed
                    : t.pending}
              </dd>
            </div>
          </dl>
          <p>
            {t.reviewed}: {v.method === "cash" ? t.cash : account?.label}{" "}
            {account?.maskedIdentifier}
          </p>
          <Button
            disabled={busy || s.work.dirty}
            onClick={() => void controller.promote()}
          >
            {actionText}
          </Button>
        </section>
      )}
      {closed && s.committed?.result && (
        <Button
          variant="outline"
          onClick={() => void onResult(s.committed?.result?.id ?? "")}
        >
          {t.refresh}
        </Button>
      )}
    </section>
  );
}
export function PaymentsScreen({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const locale = useLocale() as Locale,
    t = paymentMessages[locale];
  const [session, setSession] = useState<{
    scope: ReturnType<typeof createDraftScope>;
    alive: () => boolean;
  }>();
  const [options, setOptions] = useState<PaymentOptions>(),
    [controller, setController] = useState<DraftRecovery>(),
    [receipts, setReceipts] = useState<PaymentReceipt[]>([]),
    [next, setNext] = useState<string | null>(null),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [draftNext, setDraftNext] = useState<DraftCursor | null>(null),
    [selected, setSelected] = useState<PaymentReceipt>(),
    [events, setEvents] = useState<PaymentEvent[]>([]),
    [historyNext, setHistoryNext] = useState<number | null>(null),
    [position, setPosition] =
      useState<Awaited<ReturnType<typeof readPaymentPosition>>>(),
    [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    const generation = queries.version(),
      scope = createDraftScope(shopId, guard),
      alive = () => mounted && queries.isCurrent(generation);
    setSession({ scope, alive });
    setOptions(undefined);
    setReceipts([]);
    setController(undefined);
    setSelected(undefined);
    setEvents([]);
    setPosition(undefined);
    setDrafts([]);
    void Promise.all([
      readPaymentOptions(shopId),
      readPayments(shopId),
      scope.list(),
    ])
      .then(async ([o, r, d]) => {
        if (!alive()) return;
        setOptions(o);
        setReceipts(r.receipts);
        setNext(r.next);
        setDrafts(d.drafts);
        setDraftNext(d.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (record.workflow !== "payment.receipt") throw Error("Wrong draft");
          setController(
            scope.open({
              workflow: "payment.receipt",
              schemaVersion: 1,
              initial: record.payload,
              record,
              committed: (r) => {
                if (alive()) draftAddress(r.id);
              },
            }),
          );
        }
      })
      .catch(() => {
        if (alive()) setError(true);
      });
    return () => {
      mounted = false;
      scope.dispose();
    };
  }, [shopId, queries, guard]);
  const attempt = async (work: () => Promise<void>) => {
    setError(false);
    try {
      await work();
    } catch {
      if (session?.alive()) setError(true);
    }
  };
  const refresh = async () => {
    const [o, r, d] = await Promise.all([
      readPaymentOptions(shopId),
      readPayments(shopId),
      session?.scope.list(),
    ]);
    if (!session?.alive()) return;
    setOptions(o);
    setReceipts(r.receipts);
    setNext(r.next);
    if (d) {
      setDrafts(d.drafts);
      setDraftNext(d.next);
    }
  };
  const show = async (id: string) => {
    await attempt(async () => {
      const r = await readPaymentReceipt(shopId, id);
      const [h, p] = await Promise.all([
        readPaymentHistory(shopId, r.id),
        readPaymentPosition(shopId, r.customerId),
      ]);
      if (!session?.alive()) return;
      setSelected(r);
      setEvents(h.events);
      setHistoryNext(h.next);
      setPosition(p);
      await refresh();
    });
  };
  const open = (initial: PaymentDraft, record?: DraftRecord) => {
    if (!session?.alive() || !options) return;
    if (controller && !controller.confirmLeave(() => window.confirm(t.discard)))
      return;
    if (controller) session.scope.release(controller);
    const c = session.scope.open({
      workflow: "payment.receipt",
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (session.alive()) draftAddress(r.id);
      },
    });
    setController(c);
    draftAddress(c.snapshot().id);
  };
  const start = (r: PaymentReceipt, action: PaymentDraft["action"]) => {
    if (!options) return;
    const e = r.current;
    open({
      ...emptyPayment(e.paymentDate),
      receiptId: r.id,
      expectedVersion: e.version,
      customerId: r.customerId,
      payerId: r.payerId,
      orderId: r.orderId,
      bookingId: r.bookingId,
      amountText: `${BigInt(e.amountPaise) / 100n}.${(BigInt(e.amountPaise) % 100n).toString().padStart(2, "0")}`,
      method: e.method,
      accountId: e.accountId,
      accountRevisionId: e.accountRevisionId,
      profileId: action === "correct" ? options.profileId : e.profileId,
      reference: e.reference,
      restoreEpoch: options.restoreEpoch,
      action,
    });
  };
  return (
    <div className="payment-surface">
      <p className="entry-intro">{t.intro}</p>
      <p className="text-muted-foreground">{t.synthetic}</p>
      {error && <p role="alert">{t.error}</p>}
      <div className="calendar-actions">
        <Button
          disabled={
            !options || !session || controller?.snapshot().work.outcomeUnknown
          }
          onClick={() => {
            if (options)
              open({
                ...emptyPayment(options.today),
                profileId: options.profileId,
                restoreEpoch: options.restoreEpoch,
              });
          }}
        >
          {t.new}
        </Button>
        <Button variant="outline" onClick={() => void attempt(refresh)}>
          {t.refresh}
        </Button>
      </div>
      {options && !options.profileId && (
        <p>
          {t.configuration}{" "}
          <a href="/settings?section=directory">{t.account}</a>
        </p>
      )}
      {controller && options && (
        <PaymentEditor
          key={controller.instance}
          controller={controller}
          options={options}
          shopId={shopId}
          t={t}
          locale={locale}
          onResult={show}
          recipientBusiness={
            selected &&
            selected.current.profileId ===
              controller.snapshot().values.profileId
              ? selected.current.recipientBusiness
              : options.recipientBusiness
          }
        />
      )}
      {selected && (
        <section className="payment-detail">
          <h2>
            {selected.customerLabel} ·{" "}
            {formatPaymentPaise(selected.current.amountPaise, locale)}
          </h2>
          <p>
            {t[selected.current.status]} · {t[selected.current.method]} ·{" "}
            {selected.current.paymentDate}
          </p>
          <p>
            {t.payer}: {selected.payerLabel} · {t.recipient}:{" "}
            {selected.current.recipientBusiness}
          </p>
          {selected.current.accountLabel && (
            <p>
              {t.account}: {selected.current.accountLabel}{" "}
              {selected.current.maskedIdentifier}
            </p>
          )}
          {selected.current.status === "pending" ? (
            <div className="calendar-actions">
              {selected.current.method !== "bank" && (
                <Button
                  disabled={options?.frozen}
                  onClick={() =>
                    start(
                      selected,
                      selected.current.method === "cash"
                        ? "cash-received"
                        : "upi-seen",
                    )
                  }
                >
                  {t.confirm}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => start(selected, "correct")}
              >
                {t.correction}
              </Button>
              <Button variant="outline" onClick={() => start(selected, "fail")}>
                {t.fail}
              </Button>
            </div>
          ) : (
            <p>{t.unchanged}</p>
          )}
          {position && (
            <section>
              <h3>{t.position}</h3>
              <dl className="shop-profile-values">
                {(
                  [
                    [t.pendingAmount, position.pendingPaise],
                    [t.received, position.confirmedPaise],
                    [t.allocated, position.allocatedPaise],
                    [t.unallocated, position.unallocatedPaise],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{formatPaymentPaise(value, locale)}</dd>
                  </div>
                ))}
              </dl>
              <p>{t.noAllocation}</p>
              <p>{t.unknownCharges}</p>
              <p>{t.remaining}</p>
              <p>{t.noRefund}</p>
            </section>
          )}
          <h3>{t.history}</h3>
          <ol>
            {events.map((e) => (
              <li key={e.id}>
                {t[e.status]} · {formatPaymentPaise(e.amountPaise, locale)} ·{" "}
                <time dateTime={e.recordedAt}>
                  {new Intl.DateTimeFormat(
                    locale === "ta" ? "ta-IN" : "en-IN",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    },
                  ).format(new Date(e.recordedAt))}
                </time>
                {e.reason && <p>{e.reason}</p>}
                <details>
                  <summary>
                    {t.history} · {e.version}
                  </summary>
                  <p>
                    {t.method}: {t[e.method]} · {t.date}: {e.paymentDate}
                  </p>
                  <p>
                    {t.recipient}: {e.recipientBusiness}
                  </p>
                  {e.accountLabel && (
                    <p>
                      {t.account}: {e.accountLabel} {e.maskedIdentifier}
                    </p>
                  )}
                  <p className="break-words">
                    {t.reference}: {e.reference || "—"}
                  </p>
                </details>
              </li>
            ))}
          </ol>
          {historyNext && (
            <Button
              variant="outline"
              onClick={() =>
                void attempt(async () => {
                  const h = await readPaymentHistory(
                    shopId,
                    selected.id,
                    historyNext,
                  );
                  if (session?.alive()) {
                    setEvents([...events, ...h.events]);
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
      <section>
        <h2>{t.title}</h2>
        {!receipts.length && <p>{t.none}</p>}
        <ul className="payment-list">
          {[...receipts]
            .sort(
              (a, b) =>
                Number(b.current.status === "pending") -
                Number(a.current.status === "pending"),
            )
            .map((r) => (
              <li key={r.id}>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      !controller ||
                      controller.confirmLeave(() => window.confirm(t.discard))
                    )
                      void show(r.id);
                  }}
                >
                  <span>
                    {r.customerLabel} ·{" "}
                    {formatPaymentPaise(r.current.amountPaise, locale)} ·{" "}
                    {t[r.current.status]}
                  </span>
                </Button>
              </li>
            ))}
        </ul>
        {next && (
          <Button
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const r = await readPayments(shopId, undefined, next);
                if (session?.alive()) {
                  setReceipts([...receipts, ...r.receipts]);
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
        <h2>{t.drafts}</h2>
        <ul>
          {drafts
            .filter((d) => d.workflow === "payment.receipt")
            .map((d) => (
              <li key={d.id}>
                <Button
                  variant="outline"
                  onClick={() => open(paymentDraftSchema.parse(d.payload), d)}
                >
                  {t.resume} · {d.updatedAt}
                </Button>
              </li>
            ))}
        </ul>
        {draftNext && (
          <Button
            variant="outline"
            onClick={() =>
              void attempt(async () => {
                const r = await session?.scope.list(draftNext);
                if (r && session?.alive()) {
                  setDrafts([...drafts, ...r.drafts]);
                  setDraftNext(r.next);
                }
              })
            }
          >
            {t.more}
          </Button>
        )}
      </section>
    </div>
  );
}
