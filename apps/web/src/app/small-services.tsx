import { onOwnerInvalidation } from "@aarili/api/client";
import { readPresentation } from "@aarili/api/service-templates-client";
import {
  listServiceOrders,
  readServiceOrder,
  readServiceProfiles,
  readServiceRepeatSource,
} from "@aarili/api/small-services-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type AcceptedServiceOrder,
  emptyServiceOrder,
  emptyServiceProfile,
  type ServiceProfileRevision,
  serviceIntakeDraftSchema,
  serviceOrderDraftSchema,
  serviceProfileDraftSchema,
  serviceRepeatDraftSchema,
} from "@aarili/contracts/small-services";
import { draftMessages, type Locale, smallServiceMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { v7 } from "uuid";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import { ServiceRepeatPanel } from "./repeat-services";
import { ServiceIntakeAddonsEditor } from "./service-intake-addons";
import {
  ServiceIntakeEditor,
  ServiceOrderDetail,
} from "./small-service-intake";
import {
  ServiceProfileEditor,
  ServiceProfileHistory,
} from "./small-service-profiles";

function address(kind?: "draft" | "serviceOrder", id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.delete("draft");
  u.searchParams.delete("order");
  u.searchParams.delete("serviceOrder");
  u.searchParams.set("services", "1");
  if (kind && id) u.searchParams.set(kind, id);
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}

export function SmallServices({
  shopId,
  guard,
  locale,
  back,
  profilesOnly = false,
  initialDraftId,
  initialOrderId,
  onAccepted,
}: {
  shopId: string;
  guard: OwnerGuard;
  locale: Locale;
  back: () => void;
  profilesOnly?: boolean;
  initialDraftId?: string | undefined;
  initialOrderId?: string | undefined;
  onAccepted?:
    | ((type: "order.accepted" | "booking.revision", id: string) => void)
    | undefined;
}) {
  const t = smallServiceMessages[locale],
    d = draftMessages[locale],
    [scope] = useState(() => createDraftScope(shopId, guard));
  const [controller, setController] = useState<DraftRecovery>(),
    [workflow, setWorkflow] = useState(""),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [next, setNext] = useState<DraftCursor | null>(null),
    [orders, setOrders] = useState<AcceptedServiceOrder[]>([]),
    [orderNext, setOrderNext] = useState<string | null>(null),
    [order, setOrder] = useState<AcceptedServiceOrder>(),
    [profiles, setProfiles] = useState<ServiceProfileRevision[]>([]),
    [profileNext, setProfileNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const active = useRef(true),
    selected = useRef<DraftRecovery | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    const stop = onOwnerInvalidation(() => {
      active.current = false;
      setController(undefined);
      setDrafts([]);
      setOrders([]);
      setOrder(undefined);
      setProfiles([]);
    });
    return () => {
      active.current = false;
      stop();
      queueMicrotask(() => {
        if (!active.current) scope.dispose();
      });
    };
  }, [scope]);
  async function refresh(cursor?: DraftCursor) {
    try {
      const r = await scope.list(cursor);
      if (!active.current) return;
      setDrafts((rows) => {
        const map = new Map((cursor ? rows : []).map((r) => [r.id, r]));
        for (const row of r.drafts)
          if (
            [
              "order.service",
              "order.repeat-service",
              "service.intake-profile",
              "order.services-intake",
            ].includes(row.workflow) &&
            row.lifecycle === "active"
          )
            map.set(row.id, row);
        return [...map.values()];
      });
      setNext(r.next);
    } catch {
      if (active.current) setFailed(true);
    }
  }
  async function refreshOrders(before?: string) {
    try {
      const r = await listServiceOrders(shopId, before);
      if (active.current) {
        setOrders((p) =>
          before
            ? [...p, ...r.orders.filter((o) => !p.some((x) => x.id === o.id))]
            : r.orders,
        );
        setOrderNext(r.next);
      }
    } catch {
      if (active.current) setFailed(true);
    }
  }
  async function refreshProfiles(before?: string) {
    try {
      const r = await readServiceProfiles(shopId, before);
      if (active.current) {
        setProfiles((p) =>
          before
            ? [...p, ...r.profiles.filter((o) => !p.some((x) => x.id === o.id))]
            : r.profiles,
        );
        setProfileNext(r.next);
      }
    } catch {
      if (active.current) setFailed(true);
    }
  }
  function release() {
    if (selected.current) scope.release(selected.current);
    selected.current = undefined;
    setController(undefined);
  }
  function mayLeave() {
    if (!selected.current) return guard.safe();
    return (
      !selected.current ||
      selected.current.confirmLeave(() => window.confirm(d.warning))
    );
  }
  function close(force = false) {
    if (!selected.current && !guard.safe()) return;
    if (!force && !mayLeave()) return;
    release();
    setOrder(undefined);
    address();
    void refresh();
    void refreshOrders();
    void refreshProfiles();
  }
  async function openOrder(id: string) {
    if (!selected.current && !guard.safe()) return;
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceOrder(shopId, id);
      if (active.current) {
        release();
        setOrder(r);
        address("serviceOrder", id);
      }
    } catch {
      if (active.current) setFailed(true);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function committed(record: DraftRecord) {
    if (!active.current) return;
    setDrafts((rows) => [
      ...rows.filter((r) => r.id !== record.id),
      ...(record.lifecycle === "active" ? [record] : []),
    ]);
    address(record.lifecycle === "active" ? "draft" : undefined, record.id);
    if (record.lifecycle === "abandoned") close(true);
    if (record.lifecycle === "promoted") {
      if (record.result?.type === "service-order.accepted")
        void openOrder(record.result.id);
      else if (
        record.result &&
        (record.result.type === "order.accepted" ||
          record.result.type === "booking.revision") &&
        onAccepted
      ) {
        release();
        onAccepted(record.result.type, record.result.id);
      } else close(true);
    }
  }
  function open(
    workflow: string,
    initial: Record<string, unknown>,
    record?: DraftRecord,
  ) {
    release();
    setOrder(undefined);
    const c = scope.open({
      workflow,
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      committed,
    });
    selected.current = c;
    setController(c);
    setWorkflow(workflow);
    address(record ? "draft" : undefined, record?.id);
  }
  async function start() {
    if (!mayLeave()) return;
    setBusy(true);
    setFailed(false);
    try {
      const p = await readPresentation(shopId);
      if (active.current)
        open("order.service", {
          ...emptyServiceOrder(v7()),
          presentation: p.mode,
          presentationRevisionId: p.revision?.id ?? null,
        });
    } catch {
      if (active.current) setFailed(true);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function resume(id: string) {
    setBusy(true);
    setFailed(false);
    try {
      const r = await scope.read(id);
      if (!active.current) return;
      if (
        r.lifecycle === "promoted" &&
        r.result &&
        (r.result.type === "order.accepted" ||
          r.result.type === "booking.revision") &&
        onAccepted
      ) {
        release();
        onAccepted(r.result.type, r.result.id);
        return;
      }
      if (
        r.lifecycle === "promoted" &&
        r.result?.type === "service-order.accepted"
      ) {
        await openOrder(r.result.id);
        return;
      }
      const parsed =
        r.workflow === "order.repeat-service"
          ? serviceRepeatDraftSchema.safeParse(r.payload)
          : r.workflow === "order.service"
            ? serviceOrderDraftSchema.safeParse(r.payload)
            : r.workflow === "service.intake-profile"
              ? serviceProfileDraftSchema.safeParse(r.payload)
              : r.workflow === "order.services-intake"
                ? serviceIntakeDraftSchema.safeParse(r.payload)
                : null;
      if (!parsed?.success || r.lifecycle !== "active" || r.schemaVersion !== 1)
        throw Error("Unsupported draft");
      open(r.workflow, parsed.data, r);
    } catch {
      if (active.current) setFailed(true);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL identity belongs to this scope lifetime
  useEffect(() => {
    if (!initialOrderId && !initialDraftId) address();
    if (initialOrderId) void openOrder(initialOrderId);
    else if (initialDraftId) void resume(initialDraftId);
    void refresh();
    void refreshOrders();
    void refreshProfiles();
  }, [scope]);
  function revise(p: ServiceProfileRevision) {
    if (!mayLeave()) return;
    open("service.intake-profile", {
      entryId: p.entryId,
      baseVersion: p.version,
      baseRevisionId: p.id,
      content: p.content,
      available: p.available,
      reason: "",
    });
  }
  return (
    <div className="order-intake">
      <div className="owner-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!mayLeave()) return;
            release();
            const u = new URL(window.location.href);
            u.searchParams.delete("services");
            u.searchParams.delete("serviceOrder");
            u.searchParams.delete("draft");
            window.history.replaceState(null, "", `${u.pathname}${u.search}`);
            back();
          }}
        >
          {profilesOnly ? t.backToTemplates : t.back}
        </Button>
        {!profilesOnly && (
          <Button disabled={busy || !!controller} onClick={() => void start()}>
            {t.new}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy || !!controller}
          onClick={() =>
            open("service.intake-profile", emptyServiceProfile(v7()))
          }
        >
          {t.newProfile}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !!controller}
          onClick={() => {
            setFailed(false);
            void refresh();
            void refreshOrders();
            void refreshProfiles();
          }}
        >
          {t.reload}
        </Button>
      </div>
      {failed && <p role="alert">{t.error}</p>}
      {busy && <p role="status">{t.loading}</p>}
      {order ? (
        <>
          <ServiceRepeatPanel
            shopId={shopId}
            orderId={order.id}
            key={`repeat-${order.id}`}
            guard={guard}
            locale={locale}
            onDraft={(r) => open(r.workflow, r.payload, r)}
            onUnavailable={() => {
              setOrder(undefined);
              setOrders([]);
              setDrafts([]);
              setFailed(true);
            }}
            onOrder={(id) => {
              void readServiceRepeatSource(shopId, id).then(
                (s) => {
                  if (s.kind === "custom") onAccepted?.("order.accepted", id);
                  else void openOrder(id);
                },
                () => setFailed(true),
              );
            }}
          />
          <ServiceOrderDetail
            guard={guard}
            shopId={shopId}
            key={order.id}
            order={order}
            locale={locale}
            back={() => close(true)}
            reload={() => void openOrder(order.id)}
          />
        </>
      ) : controller ? (
        workflow === "order.service" || workflow === "order.repeat-service" ? (
          <ServiceIntakeEditor
            key={controller.instance}
            shopId={shopId}
            controller={controller}
            guard={guard}
            locale={locale}
            close={() => close()}
          />
        ) : workflow === "order.services-intake" ? (
          <ServiceIntakeAddonsEditor
            key={controller.instance}
            shopId={shopId}
            controller={controller}
            guard={guard}
            locale={locale}
          />
        ) : (
          <ServiceProfileEditor
            key={controller.instance}
            shopId={shopId}
            controller={controller}
            guard={guard}
            locale={locale}
            close={() => close()}
          />
        )
      ) : (
        <>
          {!profilesOnly && (
            <section aria-label={t.accepted}>
              <h2>{t.accepted}</h2>
              {!orders.length && <p>{t.empty}</p>}
              <ul className="order-choices">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void openOrder(o.id)}
                    >
                      {o.code} · {o.customer?.label} · {o.currentPromise.date}
                    </Button>
                  </li>
                ))}
              </ul>
              {orderNext && (
                <Button
                  disabled={busy}
                  onClick={() => void refreshOrders(orderNext)}
                >
                  {t.more}
                </Button>
              )}
            </section>
          )}
          <section aria-label={t.saved}>
            <h2>{t.saved}</h2>
            {!drafts.length && <p>{t.noDrafts}</p>}
            <ul className="order-choices">
              {drafts.map((r) => (
                <li key={r.id}>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void resume(r.id)}
                  >
                    {r.workflow === "order.service"
                      ? t.resume
                      : t.profileDrafts}{" "}
                    · {r.createdAt}
                  </Button>
                </li>
              ))}
            </ul>
            {next && (
              <Button disabled={busy} onClick={() => void refresh(next)}>
                {t.more}
              </Button>
            )}
          </section>
          <section aria-label={t.profiles}>
            <h2>{t.profiles}</h2>
            <p>{t.synthetic}</p>
            <ul className="owner-form">
              {profiles.map((p) => (
                <li key={p.id}>
                  <strong>
                    {locale === "ta" ? p.content.labelTa : p.content.labelEn}
                  </strong>
                  <p>
                    {t.profileVersion}: {p.version} ·{" "}
                    {p.available ? t.available : t.unavailable}
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => revise(p)}
                  >
                    {t.edit}
                  </Button>
                  <ServiceProfileHistory
                    shopId={shopId}
                    profile={p}
                    locale={locale}
                  />
                </li>
              ))}
            </ul>
            {profileNext && (
              <Button
                disabled={busy}
                onClick={() => void refreshProfiles(profileNext)}
              >
                {t.more}
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
