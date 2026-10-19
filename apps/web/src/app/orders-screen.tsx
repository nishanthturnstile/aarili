import { onOwnerInvalidation } from "@aarili/api/client";
import { searchCustomers } from "@aarili/api/customer-client";
import {
  listAcceptedOrders,
  previewQuickOrder,
  readAcceptedOrder,
} from "@aarili/api/orders-client";
import {
  readPresentation,
  readServiceTemplates,
} from "@aarili/api/service-templates-client";
import { listWearers } from "@aarili/api/wearer-client";
import type { CustomerSearchPage } from "@aarili/contracts/customers";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type AcceptedOrder,
  emptyQuickOrder,
  type QuickOrderDraft,
  type QuickOrderPreview,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import { presentServiceRequirements } from "@aarili/contracts/service-templates";
import type { WearerProfile } from "@aarili/contracts/wearers";
import {
  type Locale,
  orderAcceptanceMessages,
  orderMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import { AcceptedOrderDetail, CommitmentReview } from "./order-acceptance";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type Services = Awaited<ReturnType<typeof readServiceTemplates>>;
type T = (typeof orderMessages)[Locale];
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.delete("order");
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function Fields({
  form,
  controller,
  shopId,
  t,
  locale,
}: {
  form: UseFormReturn<QuickOrderDraft>;
  controller: DraftRecovery;
  shopId: string;
  t: T;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const v = quickOrderDraftSchema.parse(s.values);
  const [customers, setCustomers] = useState<CustomerSearchPage>(),
    [wearers, setWearers] = useState<WearerProfile[]>([]),
    [services, setServices] = useState<Services>();
  const [query, setQuery] = useState(""),
    [serviceQuery, setServiceQuery] = useState("");
  const [preview, setPreview] = useState<QuickOrderPreview>(),
    [failure, setFailure] = useState(false),
    [working, setWorking] = useState(false),
    [previewAttempt, setPreviewAttempt] = useState(0);
  const generation = useRef(0),
    customerGeneration = useRef(0),
    alive = useRef(true);
  const { commitmentReview: _reviewDecision, ...previewInput } = v;
  const canonical = JSON.stringify(previewInput);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      customerGeneration.current++;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: an explicit retry must repeat the same canonical preview
  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    setPreview(undefined);
    setFailure(false);
    const timer = setTimeout(() => {
      void previewQuickOrder(shopId, JSON.parse(canonical), ac.signal).then(
        (p) => {
          if (active) setPreview(p);
        },
        () => {
          if (active) setFailure(true);
        },
      );
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      ac.abort();
    };
  }, [canonical, shopId, previewAttempt]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry also reloads authorised wearer choices
  useEffect(() => {
    const expected = ++customerGeneration.current;
    setWearers([]);
    if (!v.customerId) return;
    const ac = new AbortController();
    void listWearers(shopId, v.customerId, ac.signal).then(
      (r) => {
        if (!alive.current || customerGeneration.current !== expected) return;
        setWearers(r.wearers);
        const current = quickOrderDraftSchema.parse(
          controller.snapshot().values,
        );
        if (current.customerId === v.customerId && !current.wearerId) {
          const self = r.wearers.find(
            (w) =>
              w.relationship.kind === "self" &&
              w.relationship.authorised &&
              w.relationship.informed,
          );
          if (self) form.setValue("wearerId", self.id, { shouldDirty: true });
        }
      },
      () => {
        if (alive.current && customerGeneration.current === expected)
          setFailure(true);
      },
    );
    return () => {
      ac.abort();
      customerGeneration.current++;
    };
  }, [v.customerId, shopId, controller, form, previewAttempt]);
  async function findCustomer(cursor?: CustomerSearchPage["next"]) {
    const expected = ++generation.current;
    setWorking(true);
    setFailure(false);
    try {
      const r = await searchCustomers(shopId, {
        query,
        limit: 25,
        ...(cursor ? { cursor } : {}),
      });
      if (alive.current && expected === generation.current) setCustomers(r);
    } catch {
      if (alive.current) setFailure(true);
    } finally {
      if (alive.current && expected === generation.current) setWorking(false);
    }
  }
  async function findService(before?: string) {
    const expected = ++generation.current;
    setWorking(true);
    setFailure(false);
    try {
      const r = await readServiceTemplates(shopId, before, serviceQuery);
      if (alive.current && expected === generation.current) setServices(r);
    } catch {
      if (alive.current) setFailure(true);
    } finally {
      if (alive.current && expected === generation.current) setWorking(false);
    }
  }
  const rows = preview?.requirements
    ? presentServiceRequirements(preview.requirements, v.presentation)
    : null;
  const input = (
    key:
      | "deliveryDate"
      | "deliveryTime"
      | "orderDate"
      | "historicalReason"
      | "requestedDate"
      | "eventDate"
      | "occasion"
      | "instructions"
      | "priceText",
    type = "text",
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`qo-${key}`}>{t[key]}</FieldLabel>
      <Input
        id={`qo-${key}`}
        {...form.register(key)}
        type={type}
        aria-invalid={
          preview?.issues.includes(
            key as QuickOrderPreview["issues"][number],
          ) || undefined
        }
        maxLength={
          key === "instructions"
            ? 2000
            : key === "historicalReason"
              ? 1000
              : key === "occasion"
                ? 160
                : key === "priceText"
                  ? 40
                  : undefined
        }
      />
    </Field>
  );
  return (
    <>
      <p>{t.draftOnly}</p>
      <Field>
        <FieldLabel htmlFor="qo-query">{t.query}</FieldLabel>
        <Input
          id="qo-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void findCustomer();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={() => void findCustomer()}
        >
          {t.search}
        </Button>
      </Field>
      {customers && (
        <ul className="order-choices">
          {customers.customers.length === 0 && <li>{t.noCustomers}</li>}
          {customers.customers.map((c) => (
            <li key={c.id}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.setValue("customerId", c.id, { shouldDirty: true });
                  form.setValue("wearerId", null, { shouldDirty: true });
                  setCustomers(undefined);
                }}
              >
                {c.displayName} · {c.code}
                {c.phone ? ` · ${c.phone}` : ""}
              </Button>
            </li>
          ))}
          {customers.next && (
            <li>
              <Button
                type="button"
                disabled={working}
                onClick={() => void findCustomer(customers.next)}
              >
                {t.moreResults}
              </Button>
            </li>
          )}
        </ul>
      )}
      <p>
        <strong>{t.customerId}:</strong>{" "}
        {preview?.customer?.label ?? (v.customerId ? t.loading : t.none)}
      </p>
      <Field>
        <FieldLabel htmlFor="qo-wearer">{t.wearerId}</FieldLabel>
        <select
          id="qo-wearer"
          value={v.wearerId ?? ""}
          onChange={(e) =>
            form.setValue("wearerId", e.target.value || null, {
              shouldDirty: true,
            })
          }
        >
          <option value="">{t.none}</option>
          {wearers
            .filter((w) => w.relationship.authorised && w.relationship.informed)
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.displayName}
                {w.relationship.kind === "self"
                  ? ` (${locale === "ta" ? "தானே" : "self"})`
                  : ""}
              </option>
            ))}
          {v.wearerId && !wearers.some((w) => w.id === v.wearerId) && (
            <option value={v.wearerId}>
              {preview?.wearer?.label ?? t.unavailable}
            </option>
          )}
        </select>
      </Field>
      <a href={v.customerId ? `/customers/${v.customerId}` : "/customers/new"}>
        {t.registration}
      </a>
      <Field>
        <FieldLabel htmlFor="qo-service-query">{t.sourceSearch}</FieldLabel>
        <Input
          id="qo-service-query"
          value={serviceQuery}
          onChange={(e) => setServiceQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void findService();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={() => void findService()}
        >
          {t.sourceSearch}
        </Button>
      </Field>
      {services && (
        <>
          <ul className="order-choices">
            {services.entries
              .filter((r) => r.configurationEligible)
              .map((r) => (
                <li key={r.id}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setValue(
                        "manifest",
                        {
                          entryId: r.entryId,
                          revisionId: r.id,
                          definitionId: r.definition.id,
                        },
                        { shouldDirty: true },
                      )
                    }
                  >
                    {locale === "ta"
                      ? r.definition.content.labelTa
                      : r.definition.content.labelEn}
                  </Button>
                </li>
              ))}
          </ul>
          {!services.entries.some((r) => r.configurationEligible) && (
            <p>{t.noServices}</p>
          )}
          {services.next && (
            <Button
              type="button"
              onClick={() => void findService(services.next ?? undefined)}
            >
              {t.moreResults}
            </Button>
          )}
        </>
      )}
      <p>
        <strong>{t.service}:</strong>{" "}
        {preview?.requirements
          ? locale === "ta"
            ? preview.requirements.definition.labelTa
            : preview.requirements.definition.labelEn
          : v.manifest
            ? t.loading
            : t.none}
      </p>
      {preview && preview.sourceState !== "not-selected" && (
        <p role="status">{t[preview.sourceState]}</p>
      )}
      <div className="order-related-fields">
        {input("deliveryDate", "date")}
        <Field>
          <FieldLabel htmlFor="qo-priority">{t.priority}</FieldLabel>
          <select id="qo-priority" {...form.register("priority")}>
            <option value="normal">{t.normal}</option>
            <option value="rush">{t.rush}</option>
          </select>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="qo-price-state">{t.priceState}</FieldLabel>
        <select id="qo-price-state" {...form.register("priceState")}>
          <option value="to-be-quoted">{t.toBeQuoted}</option>
          <option value="quoted">{t.quoted}</option>
        </select>
      </Field>
      {v.priceState === "quoted" && input("priceText")}
      {preview?.issues.includes("priceText") && (
        <p role="alert">{t.priceInvalid}</p>
      )}
      <p>{t.advance}</p>
      <details open={v.presentation === "detailed" || undefined}>
        <summary>{t.optional}</summary>
        <div className="owner-form">
          {input("deliveryTime", "time")}
          {input("orderDate", "date")}
          {input("historicalReason")}
          {input("requestedDate", "date")}
          {input("eventDate", "date")}
          {input("occasion")}
          {input("instructions")}
        </div>
      </details>
      <Field>
        <FieldLabel htmlFor="qo-mode">{t.presentation}</FieldLabel>
        <select id="qo-mode" {...form.register("presentation")}>
          <option value="simple">{t.simple}</option>
          <option value="detailed">{t.detailed}</option>
        </select>
      </Field>
      {failure && (
        <div>
          <p role="alert">{t.error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewAttempt((n) => n + 1)}
          >
            {t.retry}
          </Button>
        </div>
      )}
      {preview && preview.issues.length > 0 && (
        <section aria-label={t.missing}>
          <h3>{t.missing}</h3>
          <ul>
            {preview.issues.map((key) => (
              <li key={key}>
                {
                  t[
                    key === "customer"
                      ? "customerId"
                      : key === "wearer"
                        ? "wearerId"
                        : key
                  ]
                }
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label={t.requirements}>
        <h3>{t.requirements}</h3>
        <p>{t.noMeasurements}</p>
        {rows ? (
          <ul>
            {rows.items.map((r) => (
              <li key={`${r.section}:${r.key}`}>
                <strong>{locale === "ta" ? r.labelTa : r.labelEn}</strong> —{" "}
                {r.state === "not-required" ? t.notRequired : t.unresolved}
                {r.assigneeId && <span> · {t.owner}</span>}
                {r.blockers.length > 0 && <p>{t.blocker}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t.sourceMissing}</p>
        )}
      </section>
      <Button
        type="button"
        disabled={
          s.work.inFlight || s.work.outcomeUnknown || s.status === "conflict"
        }
        onClick={() => void controller.save()}
      >
        {t.save}
      </Button>
      <CommitmentReview
        shopId={shopId}
        controller={controller}
        form={form}
        locale={locale}
      />
    </>
  );
}
function Editor({
  controller,
  shopId,
  guard,
  close,
  openBooked,
}: {
  controller: DraftRecovery;
  shopId: string;
  guard: OwnerGuard;
  close: (force?: boolean) => void;
  openBooked: (id: string) => void;
}) {
  const locale = useLocale() as Locale,
    t = orderMessages[locale];
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (s.status === "closed") close(true);
  }, [s.status, close]);
  const initial = quickOrderDraftSchema.safeParse(s.values);
  if (!initial.success) return null;
  const v = initial.data;
  return (
    <section className="order-editor">
      <h2 tabIndex={-1} ref={heading}>
        {t.newDraft}
      </h2>
      <DraftForm
        controller={controller}
        schema={quickOrderDraftSchema}
        locale={locale}
        guard={guard}
        canPromote={false}
        renderConflict={(record) => {
          const server = quickOrderDraftSchema.safeParse(record.payload);
          return server.success ? (
            <>
              <h3>{t.compare}</h3>
              <dl>
                {(
                  [
                    "customerId",
                    "wearerId",
                    "service",
                    "deliveryDate",
                    "deliveryTime",
                    "priority",
                    "priceState",
                    "priceText",
                    "orderDate",
                    "historicalReason",
                    "requestedDate",
                    "eventDate",
                    "occasion",
                    "instructions",
                    "presentation",
                  ] as const
                ).map((key) => (
                  <div key={key}>
                    <dt>{t[key]}</dt>
                    <dd>
                      {t.your}:{" "}
                      {key === "service"
                        ? (v.manifest?.revisionId ?? t.none)
                        : v[key] || t.none}
                    </dd>
                    <dd>
                      {t.server}:{" "}
                      {key === "service"
                        ? (server.data.manifest?.revisionId ?? t.none)
                        : server.data[key] || t.none}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p>{t.unavailable}</p>
          );
        }}
      >
        {(form) => (
          <Fields
            form={form}
            controller={controller}
            shopId={shopId}
            t={t}
            locale={locale}
          />
        )}
      </DraftForm>
      <div className="owner-actions">
        {s.status === "promoted" &&
          s.committed?.result?.type === "order.accepted" && (
            <Button
              onClick={() => {
                const id = controller.snapshot().committed?.result?.id;
                if (id) openBooked(id);
              }}
            >
              {orderAcceptanceMessages[locale].openBooked}
            </Button>
          )}
        <Button
          variant="outline"
          disabled={s.work.inFlight || s.work.outcomeUnknown}
          onClick={() => close()}
        >
          {t.close}
        </Button>
        <Button
          variant="ghost"
          disabled={s.status !== "saved" || s.work.dirty || s.work.inFlight}
          onClick={() => {
            if (window.confirm(t.abandonConfirm)) void controller.abandon();
          }}
        >
          {t.abandon}
        </Button>
      </div>
    </section>
  );
}
export function OrdersScreen({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const locale = useLocale() as Locale,
    t = orderMessages[locale];
  const [scope] = useState(() => createDraftScope(shopId, guard));
  const safe = useSyncExternalStore(guard.subscribe, guard.safe, () => true);
  const [controller, setController] = useState<DraftRecovery>(),
    [records, setRecords] = useState<DraftRecord[]>([]),
    [next, setNext] = useState<DraftCursor | null>(null),
    [failure, setFailure] = useState(false),
    [working, setWorking] = useState(false);
  const [orders, setOrders] = useState<AcceptedOrder[]>([]),
    [orderNext, setOrderNext] = useState<string | null>(null),
    [accepted, setAccepted] = useState<AcceptedOrder>();
  const a = orderAcceptanceMessages[locale];
  const active = useRef(true),
    selected = useRef<DraftRecovery | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    const stop = onOwnerInvalidation(() => {
      active.current = false;
      setRecords([]);
      setController(undefined);
      setOrders([]);
      setAccepted(undefined);
    });
    return () => {
      active.current = false;
      stop();
      queueMicrotask(() => {
        if (!active.current) scope.dispose();
      });
    };
  }, [scope]);
  function committed(record: DraftRecord) {
    if (!active.current) return;
    setRecords((rows) =>
      [
        ...rows.filter((r) => r.id !== record.id),
        ...(record.lifecycle === "active" ? [record] : []),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    address(record.lifecycle === "active" ? record.id : undefined);
    if (
      record.lifecycle === "promoted" &&
      record.result?.type === "order.accepted"
    )
      void openOrder(record.result.id);
  }
  async function openOrder(id: string) {
    setWorking(true);
    setFailure(false);
    try {
      const r = await readAcceptedOrder(shopId, id);
      if (active.current) {
        if (selected.current) scope.release(selected.current);
        selected.current = undefined;
        setController(undefined);
        setAccepted(r);
        const u = new URL(window.location.href);
        u.searchParams.delete("draft");
        u.searchParams.set("order", id);
        window.history.replaceState(null, "", `${u.pathname}${u.search}`);
      }
    } catch {
      if (active.current) setFailure(true);
    } finally {
      if (active.current) setWorking(false);
    }
  }
  async function refreshOrders(before?: string) {
    try {
      const r = await listAcceptedOrders(shopId, before);
      if (active.current) {
        setOrders((rows) =>
          before
            ? [
                ...rows,
                ...r.orders.filter((o) => !rows.some((x) => x.id === o.id)),
              ]
            : r.orders,
        );
        setOrderNext(r.next);
      }
    } catch {
      if (active.current) setFailure(true);
    }
  }
  function open(initial: QuickOrderDraft, record?: DraftRecord) {
    setAccepted(undefined);
    address(record?.id);
    if (selected.current) scope.release(selected.current);
    const c = scope.open({
      workflow: "order.quick",
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      committed,
    });
    selected.current = c;
    setController(c);
    if (record) address(record.id);
  }
  async function refresh(cursor?: DraftCursor) {
    setWorking(true);
    setFailure(false);
    try {
      const r = await scope.list(cursor);
      if (!active.current) return;
      setRecords((rows) => {
        const map = new Map((cursor ? rows : []).map((row) => [row.id, row]));
        for (const row of r.drafts)
          if (row.workflow === "order.quick" && row.lifecycle === "active")
            map.set(row.id, row);
        return [...map.values()];
      });
      setNext(r.next);
    } catch {
      if (active.current) setFailure(true);
    } finally {
      if (active.current) setWorking(false);
    }
  }
  // Scope identity changes remount this screen. Never persist private draft lists.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial URL read belongs to this scope lifetime
  useEffect(() => {
    void refresh();
    void refreshOrders();
    const orderId = new URL(window.location.href).searchParams.get("order");
    if (orderId) {
      void openOrder(orderId);
      return;
    }
    const id = new URL(window.location.href).searchParams.get("draft");
    if (id) void resume(id);
  }, [scope]);
  async function resume(id: string) {
    setWorking(true);
    setFailure(false);
    try {
      const r = await scope.read(id);
      if (!active.current) return;
      const p = quickOrderDraftSchema.safeParse(r.payload);
      if (
        r.workflow === "order.quick" &&
        r.lifecycle === "promoted" &&
        r.result?.type === "order.accepted"
      ) {
        await openOrder(r.result.id);
        return;
      }
      if (
        r.workflow !== "order.quick" ||
        r.schemaVersion !== 1 ||
        !p.success ||
        r.lifecycle !== "active"
      )
        throw Error("Unavailable draft");
      open(p.data, r);
    } catch {
      if (active.current) setFailure(true);
    } finally {
      if (active.current) setWorking(false);
    }
  }
  async function start() {
    if (accepted && !guard.safe()) return;
    if (
      selected.current &&
      !selected.current.confirmLeave(() =>
        window.confirm(
          locale === "ta"
            ? "சேமிக்காத உள்ளீட்டைக் கைவிட வேண்டுமா?"
            : "Discard unsaved input?",
        ),
      )
    )
      return;
    setWorking(true);
    setFailure(false);
    const epoch = queries.version();
    try {
      const p = await readPresentation(shopId);
      if (active.current && queries.isCurrent(epoch))
        open(emptyQuickOrder(p.mode, p.revision?.id ?? null));
    } catch {
      if (active.current) setFailure(true);
    } finally {
      if (active.current) setWorking(false);
    }
  }
  function close(force = false) {
    const c = selected.current;
    if (
      c &&
      !force &&
      !c.confirmLeave(() =>
        window.confirm(
          locale === "ta"
            ? "சேமிக்காத உள்ளீட்டைக் கைவிட வேண்டுமா?"
            : "Discard unsaved input?",
        ),
      )
    )
      return;
    if (c) scope.release(c);
    selected.current = undefined;
    setController(undefined);
    address();
    setAccepted(undefined);
    const u = new URL(window.location.href);
    u.searchParams.delete("order");
    window.history.replaceState(null, "", `${u.pathname}${u.search}`);
    void refresh();
    void refreshOrders();
  }
  return (
    <div className="order-intake">
      <p>{a.draftNotice}</p>
      <div className="owner-actions">
        <Button
          disabled={working || (!!accepted && !safe)}
          onClick={() => void start()}
        >
          {t.newDraft}
        </Button>
        <Button
          variant="outline"
          disabled={working}
          onClick={() => {
            void refresh();
            void refreshOrders();
          }}
        >
          {t.reload}
        </Button>
      </div>
      {failure && <p role="alert">{t.error}</p>}
      {working && <p role="status">{t.loading}</p>}
      {accepted ? (
        <AcceptedOrderDetail
          guard={guard}
          key={accepted.id}
          order={accepted}
          shopId={shopId}
          locale={locale}
          back={() => close(true)}
        />
      ) : controller ? (
        <Editor
          key={controller.instance}
          controller={controller}
          shopId={shopId}
          guard={guard}
          close={close}
          openBooked={(id) => void openOrder(id)}
        />
      ) : (
        <>
          <section aria-label={a.orders}>
            <h2>{a.orders}</h2>
            {orders.length === 0 && !working && <p>{a.empty}</p>}
            <ul className="order-choices">
              {orders.map((o) => (
                <li key={o.id}>
                  <Button
                    variant="outline"
                    disabled={working}
                    onClick={() => void openOrder(o.id)}
                  >
                    {o.code} · {o.customer?.label} · {o.currentPromise.date}
                  </Button>
                </li>
              ))}
            </ul>
            {orderNext && (
              <Button
                disabled={working}
                onClick={() => void refreshOrders(orderNext)}
              >
                {a.more}
              </Button>
            )}
          </section>
          <section aria-label={t.resume}>
            <h2>{t.resume}</h2>
            {records.length === 0 && !working && <p>{t.empty}</p>}
            <ul className="order-choices">
              {records.map((r, i) => (
                <li key={r.id}>
                  <Button
                    variant="outline"
                    disabled={working}
                    onClick={() => void resume(r.id)}
                  >
                    {t.newDraft} {i + 1} · {t.savedAt}{" "}
                    {new Date(r.updatedAt).toLocaleString(
                      locale === "ta" ? "ta-IN" : "en-IN",
                    )}
                    {r.stale ? ` · ${t.stale}` : ""}
                  </Button>
                </li>
              ))}
            </ul>
            {next && (
              <Button disabled={working} onClick={() => void refresh(next)}>
                {t.more}
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
