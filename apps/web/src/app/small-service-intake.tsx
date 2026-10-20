import { readCustomer, searchCustomers } from "@aarili/api/customer-client";
import {
  listAcceptedOrders,
  readAcceptedOrder,
  readOrderPieces,
} from "@aarili/api/orders-client";
import { readCatalogueDefinition } from "@aarili/api/service-catalogue-client";
import { readServiceTemplateDefinition } from "@aarili/api/service-templates-client";
import {
  readServiceProfile,
  readServiceProfiles,
  reviewServiceOrder,
} from "@aarili/api/small-services-client";
import { listWearers } from "@aarili/api/wearer-client";
import type { CustomerSearchPage } from "@aarili/contracts/customers";
import {
  type AcceptedServiceOrder,
  type ServiceOrderDraft,
  type ServiceOrderReview,
  type ServiceProfileRevision,
  serviceOrderDraftSchema,
} from "@aarili/contracts/small-services";
import type { WearerProfile } from "@aarili/contracts/wearers";
import {
  formatOrderPaise,
  type Locale,
  orderAcceptanceMessages,
  orderMessages,
  serviceAdditionMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { v7 } from "uuid";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import type { OwnerGuard } from "./owner-feedback";

function SourceOrder({
  shopId,
  form,
  customerId,
  orderId,
  pieceId,
  locale,
  wearerRequired,
}: {
  shopId: string;
  form: UseFormReturn<ServiceOrderDraft>;
  customerId: string | null;
  orderId: string | null;
  pieceId: string | null;
  locale: Locale;
  wearerRequired: boolean;
}) {
  const t = smallServiceMessages[locale],
    o = orderMessages[locale];
  const [orders, setOrders] = useState<
      Awaited<ReturnType<typeof listAcceptedOrders>>["orders"]
    >([]),
    [next, setNext] = useState<string | null>(null),
    [pieces, setPieces] =
      useState<Awaited<ReturnType<typeof readOrderPieces>>>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const [source, setSource] =
    useState<Awaited<ReturnType<typeof readAcceptedOrder>>>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setSource(undefined);
    if (orderId)
      void readAcceptedOrder(shopId, orderId).then(
        (r) => {
          if (current && r.intake.customerId === customerId) setSource(r);
        },
        () => {
          if (current) setFailed(true);
        },
      );
    setPieces(undefined);
    if (orderId)
      void readOrderPieces(shopId, orderId).then(
        (r) => {
          if (current) setPieces(r);
        },
        () => {
          if (current) setFailed(true);
        },
      );
    return () => {
      current = false;
    };
  }, [shopId, orderId, customerId]);
  async function load(before?: string) {
    setBusy(true);
    setFailed(false);
    try {
      const r = await listAcceptedOrders(shopId, before);
      if (alive.current) {
        setOrders((p) => (before ? [...p, ...r.orders] : r.orders));
        setNext(r.next);
      }
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const choices = orders.filter((r) => r.intake.customerId === customerId);
  return (
    <>
      <Field>
        <FieldLabel htmlFor="ss-source-order">{t.sourceOrderId}</FieldLabel>
        <select
          id="ss-source-order"
          value={orderId ?? ""}
          onChange={(e) => {
            form.setValue("sourceOrderId", e.target.value || null, {
              shouldDirty: true,
            });
            form.setValue("sourcePieceId", null, { shouldDirty: true });
            const selected = choices.find((r) => r.id === e.target.value);
            if (selected)
              form.setValue("wearerId", selected.intake.wearerId, {
                shouldDirty: true,
              });
            else if (!wearerRequired)
              form.setValue("wearerId", null, { shouldDirty: true });
          }}
        >
          <option value="">{o.none}</option>
          {orderId && !choices.some((r) => r.id === orderId) && (
            <option value={orderId}>{source?.code ?? t.sourceChanged}</option>
          )}
          {choices.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} ·{" "}
              {locale === "ta"
                ? r.requirements.definition.labelTa
                : r.requirements.definition.labelEn}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !customerId}
          onClick={() => void load()}
        >
          {t.load}
        </Button>
        {next && (
          <Button type="button" disabled={busy} onClick={() => void load(next)}>
            {t.more}
          </Button>
        )}
      </Field>
      {source?.wearer && (
        <p>
          {o.wearerId}: {source.wearer.label}. {t.permission}
        </p>
      )}
      {orderId && (
        <Field>
          <FieldLabel htmlFor="ss-source-piece">{t.sourcePieceId}</FieldLabel>
          <select
            id="ss-source-piece"
            value={pieceId ?? ""}
            onChange={(e) =>
              form.setValue("sourcePieceId", e.target.value || null, {
                shouldDirty: true,
              })
            }
          >
            <option value="">{o.none}</option>
            {pieces?.identities.map((piece) => {
              const label = pieces.structure?.pieces.find(
                (p) => p.key === piece.key,
              );
              return (
                <option key={piece.id} value={piece.id}>
                  {label
                    ? locale === "ta"
                      ? label.labelTa
                      : label.labelEn
                    : t.unavailable}
                </option>
              );
            })}
          </select>
        </Field>
      )}
      {failed && <p role="alert">{t.error}</p>}
    </>
  );
}

function material(v: ServiceOrderDraft) {
  const { commitmentReview: _decision, ...input } = v;
  return JSON.stringify(input);
}

function ServiceCommitment({
  shopId,
  controller,
  form,
  locale,
}: {
  shopId: string;
  controller: DraftRecovery;
  form: UseFormReturn<ServiceOrderDraft>;
  locale: Locale;
}) {
  const t = smallServiceMessages[locale],
    a = orderAcceptanceMessages[locale];
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const v = serviceOrderDraftSchema.parse(s.values);
  const [review, setReview] = useState<ServiceOrderReview>(),
    [reviewed, setReviewed] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const valid = !!review && material(v) === reviewed,
    d = v.commitmentReview;
  function decision(
    patch: Partial<NonNullable<ServiceOrderDraft["commitmentReview"]>>,
  ) {
    if (!review) return;
    form.setValue(
      "commitmentReview",
      {
        fingerprint: review.fingerprint,
        acknowledged: d?.acknowledged ?? false,
        exceptionReason: d?.exceptionReason ?? "",
        waiveRush: d?.waiveRush ?? false,
        waiverReason: d?.waiverReason ?? "",
        ...patch,
      },
      { shouldDirty: true },
    );
  }
  async function inspect() {
    setBusy(true);
    setFailed(false);
    setReview(undefined);
    try {
      await controller.save();
      const s = controller.snapshot();
      if (s.status !== "saved" || s.work.dirty || s.work.outcomeUnknown)
        throw Error("Save unresolved");
      const input = serviceOrderDraftSchema.parse(s.values),
        m = material(input),
        r = await reviewServiceOrder(shopId, input);
      if (
        alive.current &&
        material(
          serviceOrderDraftSchema.parse(controller.snapshot().values),
        ) === m
      ) {
        setReview(r);
        setReviewed(m);
        form.setValue(
          "commitmentReview",
          {
            fingerprint: r.fingerprint,
            acknowledged: false,
            exceptionReason: "",
            waiveRush: false,
            waiverReason: "",
          },
          { shouldDirty: true },
        );
      }
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function confirm() {
    if (!valid || !d?.acknowledged) return;
    setBusy(true);
    controller.edit(form.getValues());
    await controller.save();
    if (alive.current) {
      const s = controller.snapshot();
      if (
        s.status === "saved" &&
        !s.work.dirty &&
        material(serviceOrderDraftSchema.parse(s.values)) === reviewed
      ) {
        await controller.promote();
        if (alive.current && controller.snapshot().status === "saved") {
          setReview(undefined);
          setFailed(true);
        }
      }
      if (alive.current) setBusy(false);
    }
  }
  const facts = review?.commitment?.evaluation?.facts,
    warnings = review?.commitment?.evaluation?.warnings ?? [],
    unknowns = review?.commitment?.unknowns ?? [];
  const blocked =
    busy ||
    s.work.inFlight ||
    s.work.outcomeUnknown ||
    ["conflict", "promoted", "denied"].includes(s.status);
  const warning = (key: string) =>
    key in a ? a[key as keyof typeof a] : a.unknownFallback;
  return (
    <section className="owner-form" aria-label={t.preview}>
      <Button
        type="button"
        variant="outline"
        disabled={blocked}
        onClick={() => void inspect()}
      >
        {t.preview}
      </Button>
      {failed && <p role="alert">{a.changed}</p>}
      {valid && review && (
        <div className="owner-form">
          <h3>{t.preview}</h3>
          <p>{t.synthetic}</p>
          <p>
            {review.customer?.label}
            {review.wearer ? ` · ${review.wearer.label}` : ""}
          </p>
          <p>
            {v.deliveryDate} {v.deliveryTime}
          </p>
          <p>
            {t.total}:{" "}
            {review.totalPaise === null
              ? t.unknownTotal
              : formatOrderPaise(review.totalPaise, locale)}
          </p>
          <p>
            {t.mapping}: {review.quantity ?? "—"}{" "}
            {review.unit
              ? t[review.unit === "garments" ? "garments" : "effort"]
              : "—"}
          </p>
          <p>
            {t.sourceState}: {t[review.sourceState]}
          </p>
          {facts && (
            <dl>
              <dt>{a.capacity}</dt>
              <dd>{facts.cap ?? "—"}</dd>
              <dt>{a.existing}</dt>
              <dd>{facts.existing ?? "—"}</dd>
              <dt>{a.candidate}</dt>
              <dd>{facts.candidate ?? "—"}</dd>
              <dt>{a.total}</dt>
              <dd>{facts.total ?? "—"}</dd>
              <dt>{a.week}</dt>
              <dd>{facts.weekStart}</dd>
              <dt>{a.lead}</dt>
              <dd>
                {facts.leadDays ?? "—"} / {facts.requiredLead ?? "—"}
              </dd>
            </dl>
          )}
          {!!facts?.cutoffs.length && (
            <ul>
              {facts.cutoffs.map((c) => (
                <li key={`${c.label}:${c.date}`}>
                  {c.label}: {c.date} {c.time}
                </li>
              ))}
            </ul>
          )}
          {!!review.issues.length && (
            <div role="status">
              <h4>{t.blocked}</h4>
              <ul>
                {review.issues.map((issue) => (
                  <li key={issue}>{serviceIssue(issue, locale)}</li>
                ))}
              </ul>
            </div>
          )}
          {!!unknowns.length && (
            <div role="status">
              <h4>{a.unknown}</h4>
              <ul>
                {unknowns.map((key) => (
                  <li key={key}>{warning(key)}</li>
                ))}
              </ul>
            </div>
          )}
          {!!warnings.length && (
            <>
              <h4>{a.warning}</h4>
              <ul>
                {warnings.map((key) => (
                  <li key={key}>{warning(key)}</li>
                ))}
              </ul>
              <Field>
                <FieldLabel htmlFor="ss-exception">{a.reason}</FieldLabel>
                <Input
                  id="ss-exception"
                  value={d?.exceptionReason ?? ""}
                  maxLength={1000}
                  onChange={(e) =>
                    decision({ exceptionReason: e.target.value })
                  }
                />
              </Field>
            </>
          )}
          {facts?.rush && (
            <>
              <p>
                {a.suggested}: {formatOrderPaise(facts.rushPaise, locale)}
              </p>
              <label className="order-check">
                <input
                  type="checkbox"
                  checked={d?.waiveRush ?? false}
                  onChange={(e) => decision({ waiveRush: e.target.checked })}
                />
                {a.waive}
              </label>
              {d?.waiveRush && (
                <Field>
                  <FieldLabel htmlFor="ss-waiver">{a.waiverReason}</FieldLabel>
                  <Input
                    id="ss-waiver"
                    value={d.waiverReason}
                    maxLength={1000}
                    onChange={(e) => decision({ waiverReason: e.target.value })}
                  />
                </Field>
              )}
            </>
          )}
          <label className="order-check">
            <input
              type="checkbox"
              checked={d?.acknowledged ?? false}
              onChange={(e) => decision({ acknowledged: e.target.checked })}
            />
            {a.acknowledged}
          </label>
          <div className="owner-actions">
            <Button
              type="button"
              disabled={
                blocked ||
                !d?.acknowledged ||
                !review.commitment ||
                !!review.issues.length ||
                !!unknowns.length ||
                (warnings.some(
                  (w) => w === "capacityExceeded" || w === "cutoffPassed",
                ) &&
                  !d?.exceptionReason.trim()) ||
                (!!d?.waiveRush && !d.waiverReason.trim())
              }
              onClick={() => void confirm()}
            >
              {a.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={blocked}
              onClick={() => setReview(undefined)}
            >
              {t.cancelReview}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function serviceIssue(key: string, locale: Locale) {
  const t = smallServiceMessages[locale],
    o = orderMessages[locale];
  const addition = serviceAdditionMessages[locale];
  if (key === "commercialBasis") return addition.commercialUnknown;
  if (key === "newAgreementRequired") return addition.agreement;
  if (key === "selectServiceScope") return addition.select;
  if (key in t) return t[key as keyof typeof t];
  if (key in o) return o[key as keyof typeof o];
  if (/wearer|guardian|permission/i.test(key)) return t.permission;
  if (/profile|source|manifest/i.test(key)) return t.sourceChanged;
  if (/mapping|capacity|quantity|coverage|unit/i.test(key))
    return t.mappingUnknown;
  return t.blocked;
}

function Fields({
  shopId,
  controller,
  form,
  locale,
}: {
  shopId: string;
  controller: DraftRecovery;
  form: UseFormReturn<ServiceOrderDraft>;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = serviceOrderDraftSchema.parse(s.values),
    t = smallServiceMessages[locale],
    o = orderMessages[locale],
    a = orderAcceptanceMessages[locale];
  const [profiles, setProfiles] =
      useState<Awaited<ReturnType<typeof readServiceProfiles>>>(),
    [profile, setProfile] = useState<ServiceProfileRevision>(),
    [customers, setCustomers] = useState<CustomerSearchPage>(),
    [wearers, setWearers] = useState<WearerProfile[]>([]),
    [query, setQuery] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const profileRevisionId = v.profile?.revisionId;
  const [customer, setCustomer] =
    useState<Awaited<ReturnType<typeof readCustomer>>>();
  useEffect(() => {
    const ac = new AbortController();
    setCustomer(undefined);
    if (v.customerId)
      void readCustomer(shopId, v.customerId, ac.signal).then(
        (r) => {
          if (!ac.signal.aborted) setCustomer(r);
        },
        () => {
          if (!ac.signal.aborted) setFailed(true);
        },
      );
    return () => ac.abort();
  }, [shopId, v.customerId]);
  const [labels, setLabels] = useState<
    Record<string, { labelEn: string; labelTa: string }>
  >({});
  const definitionId = profile?.content.manifest?.definitionId;
  useEffect(() => {
    let active = true;
    setLabels({});
    if (definitionId)
      void (async () => {
        try {
          const template = await readServiceTemplateDefinition(
            shopId,
            definitionId,
          );
          const refs = [
            ...(template.content.service
              ? [{ key: "$base", ref: template.content.service }]
              : []),
            ...template.content.addons.map((a) => ({ key: a.key, ref: a })),
          ];
          const rows = await Promise.all(
            refs.map(async (item) => ({
              key: item.key,
              definition: await readCatalogueDefinition(
                shopId,
                item.ref.revisionId,
              ),
            })),
          );
          if (active)
            setLabels(
              Object.fromEntries(
                rows.map((r) => [r.key, r.definition.content]),
              ),
            );
        } catch {
          if (active) setFailed(true);
        }
      })();
    return () => {
      active = false;
    };
  }, [shopId, definitionId]);
  const alive = useRef(true),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    const ac = new AbortController();
    setProfile(undefined);
    if (profileRevisionId)
      void readServiceProfile(shopId, profileRevisionId, ac.signal).then(
        (r) => {
          if (!ac.signal.aborted) setProfile(r);
        },
        () => {
          if (!ac.signal.aborted) setFailed(true);
        },
      );
    return () => ac.abort();
  }, [shopId, profileRevisionId]);
  useEffect(() => {
    const ac = new AbortController();
    setWearers([]);
    if (v.customerId)
      void listWearers(shopId, v.customerId, ac.signal).then(
        (r) => {
          if (!ac.signal.aborted) setWearers(r.wearers);
        },
        () => {
          if (!ac.signal.aborted) setFailed(true);
        },
      );
    return () => ac.abort();
  }, [shopId, v.customerId]);
  async function load(before?: string) {
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceProfiles(shopId, before);
      if (alive.current)
        setProfiles((p) =>
          before && p ? { ...r, profiles: [...p.profiles, ...r.profiles] } : r,
        );
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function find(cursor?: CustomerSearchPage["next"]) {
    const gen = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const r = await searchCustomers(shopId, {
        query,
        limit: 25,
        ...(cursor ? { cursor } : {}),
      });
      if (alive.current && generation.current === gen) setCustomers(r);
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current && generation.current === gen) setBusy(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial catalogue belongs to this mounted draft lifetime
  useEffect(() => {
    void load();
  }, [shopId]);
  const input = (
    key:
      | "subjectDescription"
      | "propertyReference"
      | "intakeContext"
      | "instructions"
      | "deliveryDate"
      | "deliveryTime"
      | "orderDate"
      | "historicalReason"
      | "requestedDate"
      | "eventDate"
      | "occasion",
    type = "text",
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`ss-${key}`}>
        {key in t ? t[key as keyof typeof t] : o[key as keyof typeof o]}
      </FieldLabel>
      <Input
        id={`ss-${key}`}
        type={type}
        {...form.register(key)}
        maxLength={
          type === "date" || type === "time"
            ? undefined
            : key === "instructions"
              ? 2000
              : key === "occasion" || key === "propertyReference"
                ? 160
                : 1000
        }
      />
    </Field>
  );
  return (
    <>
      <p>{t.noEffects}</p>
      {customer && (
        <p>
          {o.customerId}: {customer.displayName} · {customer.code}
        </p>
      )}
      <Field>
        <FieldLabel htmlFor="ss-query">{o.query}</FieldLabel>
        <Input
          id="ss-query"
          value={query}
          maxLength={160}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void find();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void find()}
        >
          {o.search}
        </Button>
      </Field>
      {customers && (
        <>
          <ul className="order-choices">
            {customers.customers.map((c) => (
              <li key={c.id}>
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={v.customerId === c.id}
                  onClick={() => {
                    form.setValue("customerId", c.id, { shouldDirty: true });
                    form.setValue("wearerId", null, { shouldDirty: true });
                    form.setValue("sourceOrderId", null, { shouldDirty: true });
                    form.setValue("sourcePieceId", null, { shouldDirty: true });
                  }}
                >
                  {c.displayName}
                </Button>
              </li>
            ))}
          </ul>
          {customers.next && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void find(customers.next)}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
      <Field>
        <FieldLabel htmlFor="ss-profile">{t.profile}</FieldLabel>
        <select
          id="ss-profile"
          value={v.profile?.revisionId ?? ""}
          onChange={(e) => {
            const p = profiles?.profiles.find((p) => p.id === e.target.value);
            if (!p) return;
            if (
              v.profile &&
              v.profile.revisionId !== p.id &&
              v.lines.length &&
              !window.confirm(t.changeProfileConfirm)
            )
              return;
            form.setValue(
              "profile",
              { entryId: p.entryId, revisionId: p.id },
              { shouldDirty: true },
            );
            form.setValue(
              "lines",
              p.content.lines.map((spec) => ({
                id: v7(),
                key: spec.key,
                requestedWork: "",
                priceState: "to-be-quoted",
                priceText: "",
                notRequired: false,
                notRequiredReason: "",
              })),
              { shouldDirty: true },
            );
            if (
              p.content.wearerRequirement === "not-required" &&
              !form.getValues("sourceOrderId")
            )
              form.setValue("wearerId", null, { shouldDirty: true });
          }}
        >
          <option value="">{t.choose}</option>
          {v.profile &&
            !profiles?.profiles.some((p) => p.id === v.profile?.revisionId) && (
              <option value={v.profile.revisionId}>
                {profile
                  ? locale === "ta"
                    ? profile.content.labelTa
                    : profile.content.labelEn
                  : t.sourceChanged}
              </option>
            )}
          {profiles?.profiles.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.eligible}>
              {locale === "ta" ? p.content.labelTa : p.content.labelEn} ·{" "}
              {p.version}
              {!p.eligible ? ` · ${t.unavailable}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
        >
          {t.reload}
        </Button>
        {profiles?.next && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void load(profiles.next ?? undefined)}
          >
            {t.more}
          </Button>
        )}
      </Field>
      {profiles?.profiles.length === 0 && <p>{t.noProfile}</p>}
      {profile?.content.wearerRequirement === "not-required" ? (
        <p>
          {v.sourceOrderId && v.wearerId ? t.permission : t.noWearer}{" "}
          {profile.content.wearerReason}
        </p>
      ) : (
        <Field>
          <FieldLabel htmlFor="ss-wearer">{o.wearerId}</FieldLabel>
          <p>{t.permission}</p>
          <select
            id="ss-wearer"
            value={v.wearerId ?? ""}
            onChange={(e) =>
              form.setValue("wearerId", e.target.value || null, {
                shouldDirty: true,
              })
            }
          >
            <option value="">{o.none}</option>
            {wearers.map((w) => (
              <option
                key={w.id}
                value={w.id}
                disabled={
                  !w.relationship.authorised || !w.relationship.informed
                }
              >
                {w.displayName}
              </option>
            ))}
          </select>
        </Field>
      )}
      <section className="owner-form" aria-label={t.property}>
        <h3>{t.property}</h3>
        {input("subjectDescription")}
        {input("propertyReference")}
        <p>{t.receipt}</p>
      </section>
      <section className="owner-form" aria-label={t.lines}>
        <h3>{t.lines}</h3>
        {v.lines.map((line, i) => (
          <fieldset className="owner-form" key={line.id}>
            <legend>
              {(() => {
                const spec = profile?.content.lines.find(
                    (s) => s.key === line.key,
                  ),
                  label = labels[spec?.addonKey ?? "$base"];
                return label
                  ? locale === "ta"
                    ? label.labelTa
                    : label.labelEn
                  : t.lines;
              })()}
            </legend>
            <Field>
              <FieldLabel htmlFor={`ss-work-${line.id}`}>
                {t.requestedWork}
              </FieldLabel>
              <textarea
                id={`ss-work-${line.id}`}
                className="ui-input"
                rows={4}
                {...form.register(`lines.${i}.requestedWork`)}
                maxLength={2000}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`ss-price-state-${line.id}`}>
                {o.priceState}
              </FieldLabel>
              <select
                id={`ss-price-state-${line.id}`}
                {...form.register(`lines.${i}.priceState`)}
                disabled={line.notRequired}
              >
                <option value="to-be-quoted">{a.toQuote}</option>
                <option value="quoted">{o.quoted}</option>
              </select>
            </Field>
            {!line.notRequired && line.priceState === "quoted" && (
              <Field>
                <FieldLabel htmlFor={`ss-price-${line.id}`}>
                  {o.priceText}
                </FieldLabel>
                <Input
                  id={`ss-price-${line.id}`}
                  inputMode="decimal"
                  {...form.register(`lines.${i}.priceText`)}
                  maxLength={40}
                />
              </Field>
            )}
            <p>{line.notRequired ? t.notRequired : t.pending}</p>
            {profile?.content.lines.find((spec) => spec.key === line.key)
              ?.optional && (
              <>
                <label className="order-check">
                  <input
                    type="checkbox"
                    checked={line.notRequired}
                    onChange={(e) => {
                      form.setValue(
                        `lines.${i}.notRequired`,
                        e.target.checked,
                        { shouldDirty: true },
                      );
                      if (e.target.checked) {
                        form.setValue(`lines.${i}.priceState`, "to-be-quoted", {
                          shouldDirty: true,
                        });
                        form.setValue(`lines.${i}.priceText`, "", {
                          shouldDirty: true,
                        });
                      }
                    }}
                  />
                  {t.notRequired}
                </label>
                {line.notRequired && (
                  <Field>
                    <FieldLabel htmlFor={`ss-reason-${line.id}`}>
                      {t.notRequiredReason}
                    </FieldLabel>
                    <Input
                      id={`ss-reason-${line.id}`}
                      {...form.register(`lines.${i}.notRequiredReason`)}
                      maxLength={1000}
                    />
                  </Field>
                )}
              </>
            )}
          </fieldset>
        ))}
        {profile?.content.lines
          .filter((spec) => !v.lines.some((line) => line.key === spec.key))
          .map((spec) => {
            const label = labels[spec.addonKey ?? "$base"];
            return (
              <Button
                key={spec.key}
                type="button"
                variant="outline"
                disabled={!label || v.lines.length >= 32}
                onClick={() => {
                  const current = form.getValues("lines");
                  if (current.some((line) => line.key === spec.key)) return;
                  form.setValue(
                    "lines",
                    [
                      ...current,
                      {
                        id: v7(),
                        key: spec.key,
                        requestedWork: "",
                        priceState: "to-be-quoted",
                        priceText: "",
                        notRequired: false,
                        notRequiredReason: "",
                      },
                    ],
                    { shouldDirty: true },
                  );
                }}
              >
                {t.addLine}:{" "}
                {label
                  ? locale === "ta"
                    ? label.labelTa
                    : label.labelEn
                  : t.sourceChanged}
              </Button>
            );
          })}
      </section>
      {input("deliveryDate", "date")}
      {input("deliveryTime", "time")}
      <Field>
        <FieldLabel htmlFor="ss-priority">{o.priority}</FieldLabel>
        <select id="ss-priority" {...form.register("priority")}>
          <option value="normal">{o.normal}</option>
          <option value="rush">{o.rush}</option>
        </select>
      </Field>
      <details>
        <summary>{t.details}</summary>
        <div className="owner-form">
          {input("intakeContext")}
          {input("instructions")}
          {input("requestedDate", "date")}
          {input("eventDate", "date")}
          {input("occasion")}
          {input("orderDate", "date")}
          {input("historicalReason")}
          <SourceOrder
            wearerRequired={
              profile?.content.wearerRequirement !== "not-required"
            }
            key={v.customerId ?? "none"}
            shopId={shopId}
            form={form}
            customerId={v.customerId}
            orderId={v.sourceOrderId}
            pieceId={v.sourcePieceId}
            locale={locale}
          />
          <Field>
            <FieldLabel htmlFor="ss-presentation">{o.presentation}</FieldLabel>
            <select id="ss-presentation" {...form.register("presentation")}>
              <option value="simple">{o.simple}</option>
              <option value="detailed">{o.detailed}</option>
            </select>
          </Field>
        </div>
      </details>
      {failed && <p role="alert">{t.error}</p>}
      <Button
        type="button"
        disabled={
          s.work.inFlight || s.work.outcomeUnknown || s.status === "conflict"
        }
        onClick={() => void controller.save()}
      >
        {o.save}
      </Button>
      <ServiceCommitment
        shopId={shopId}
        controller={controller}
        form={form}
        locale={locale}
      />
    </>
  );
}

export function ServiceIntakeEditor({
  shopId,
  controller,
  guard,
  locale,
  close,
}: {
  shopId: string;
  controller: DraftRecovery;
  guard: OwnerGuard;
  locale: Locale;
  close: () => void;
}) {
  const t = smallServiceMessages[locale],
    o = orderMessages[locale],
    s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="order-editor">
      <h2 ref={heading} tabIndex={-1}>
        {t.new}
      </h2>
      <DraftForm
        controller={controller}
        schema={serviceOrderDraftSchema}
        guard={guard}
        locale={locale}
        canPromote={false}
        renderConflict={(record) => (
          <>
            <p>{t.draftConflict}</p>
            <pre className="whitespace-pre-wrap wrap-anywhere">
              {JSON.stringify(record.payload, null, 2)}
            </pre>
          </>
        )}
      >
        {(form) => (
          <Fields
            shopId={shopId}
            controller={controller}
            form={form}
            locale={locale}
          />
        )}
      </DraftForm>
      <div className="owner-actions">
        <Button
          variant="outline"
          disabled={s.work.inFlight || s.work.outcomeUnknown}
          onClick={close}
        >
          {t.close}
        </Button>
        <Button
          variant="ghost"
          disabled={s.status !== "saved" || s.work.dirty || s.work.inFlight}
          onClick={() => {
            if (window.confirm(o.abandonConfirm)) void controller.abandon();
          }}
        >
          {o.abandon}
        </Button>
      </div>
    </section>
  );
}

export function ServiceOrderDetail({
  order,
  locale,
  back,
  reload,
}: {
  order: AcceptedServiceOrder;
  locale: Locale;
  back: () => void;
  reload: () => void;
}) {
  const t = smallServiceMessages[locale],
    a = orderAcceptanceMessages[locale],
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="owner-form">
      <h2 ref={heading} tabIndex={-1}>
        {order.code}
      </h2>
      <p>{t.synthetic}</p>
      <p>
        {order.customer?.label}
        {order.wearer ? ` · ${order.wearer.label}` : ""}
      </p>
      <h3>{t.property}</h3>
      <p>{order.intake.subjectDescription}</p>
      {order.intake.propertyReference && (
        <p>{order.intake.propertyReference}</p>
      )}
      <p>{t.receipt}</p>
      <dl>
        <dt>{a.original}</dt>
        <dd>
          {order.originalPromise.date} {order.originalPromise.time}
        </dd>
        <dt>{a.current}</dt>
        <dd>
          {order.currentPromise.date} {order.currentPromise.time}
        </dd>
        <dt>{t.total}</dt>
        <dd>
          {order.totalPaise === null
            ? t.unknownTotal
            : formatOrderPaise(order.totalPaise, locale)}
        </dd>
      </dl>
      <section aria-label={t.lines}>
        <h3>{t.lines}</h3>
        <ul className="owner-form">
          {order.lines.map((line) => (
            <li key={line.id}>
              <strong>{locale === "ta" ? line.labelTa : line.labelEn}</strong>
              <p>{line.requestedWork}</p>
              <p>
                {line.state === "not-required" ? (
                  t.notRequired
                ) : (
                  <>
                    {line.priceState === "to-be-quoted"
                      ? a.toQuote
                      : formatOrderPaise(line.pricePaise, locale)}{" "}
                    · {t.pending}
                  </>
                )}
              </p>
              {line.notRequiredReason && <p>{line.notRequiredReason}</p>}
            </li>
          ))}
        </ul>
      </section>
      <details open={order.intake.presentation === "detailed"}>
        <summary>{t.source}</summary>
        <dl className="wrap-anywhere">
          <dt>{t.profile}</dt>
          <dd>
            {locale === "ta"
              ? order.profile.content.labelTa
              : order.profile.content.labelEn}
          </dd>
          <dt>{t.profileVersion}</dt>
          <dd>
            {order.profile.version} · {order.profile.id}
          </dd>
          <dt>{t.propertyId}</dt>
          <dd>{order.intake.subjectId}</dd>
          <dt>{t.manifest}</dt>
          <dd>{order.profile.content.manifest?.revisionId}</dd>
          <dt>{t.snapshot}</dt>
          <dd>{order.snapshotDigest}</dd>
        </dl>
      </details>
      <p>{t.noEffects}</p>
      <div className="owner-actions">
        <Button variant="outline" onClick={back}>
          {t.backToServices}
        </Button>
        <Button variant="outline" onClick={reload}>
          {t.reload}
        </Button>
      </div>
    </section>
  );
}
