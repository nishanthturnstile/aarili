import { OwnerRequestError } from "@aarili/api/client";
import { readOrderPieces } from "@aarili/api/orders-client";
import { readCatalogueDefinition } from "@aarili/api/service-catalogue-client";
import { readServiceTemplateDefinition } from "@aarili/api/service-templates-client";
import {
  readBookingServiceScope,
  readServiceProfile,
  readServiceProfiles,
  readServiceScope,
  reviewServiceChange,
} from "@aarili/api/small-services-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import type { AcceptedOrder, OrderReview } from "@aarili/contracts/orders";
import {
  type ServiceChangeDraft,
  type ServiceChangeReview,
  type ServiceIntakeDraft,
  type ServiceProfileRevision,
  type ServiceScope,
  serviceChangeDraftSchema,
} from "@aarili/contracts/small-services";
import {
  formatBookingPaise,
  formatOrderPaise,
  type Locale,
  orderAcceptanceMessages,
  orderMessages,
  serviceAdditionMessages,
  shopCommitmentsMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import { v7 } from "uuid";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import { ServiceDraftConflict } from "./service-draft-conflict";
import { ServiceLineCompletion } from "./service-line-completion";
import { serviceIssue } from "./small-service-intake";

export function formatServicePrice(
  value: number | string | null,
  locale: Locale,
) {
  return value === null
    ? serviceAdditionMessages[locale].unknown
    : formatOrderPaise(value, locale);
}
type Selection = ServiceIntakeDraft["selections"][number];
export function ServiceSelection({
  shopId,
  locale,
  value,
  onChange,
  coveredBy = null,
}: {
  shopId: string;
  locale: Locale;
  value: Omit<Selection, "lineId">;
  onChange: (v: Omit<Selection, "lineId">) => void;
  coveredBy?: string | null;
}) {
  const t = serviceAdditionMessages[locale],
    s = smallServiceMessages[locale],
    id = useId();
  const [profiles, setProfiles] =
      useState<Awaited<ReturnType<typeof readServiceProfiles>>>(),
    [profile, setProfile] = useState<ServiceProfileRevision>(),
    [labels, setLabels] = useState<
      Record<string, { labelEn: string; labelTa: string }>
    >({}),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    void readServiceProfiles(shopId, undefined, ac.signal).then(
      (r) => {
        if (!ac.signal.aborted) setProfiles(r);
      },
      () => {
        if (!ac.signal.aborted) setFailed(true);
      },
    );
    return () => ac.abort();
  }, [shopId]);
  const profileRevisionId = value.profile?.revisionId;
  useEffect(() => {
    const ac = new AbortController();
    setProfile(undefined);
    setLabels({});
    if (profileRevisionId)
      void (async () => {
        try {
          const p = await readServiceProfile(
            shopId,
            profileRevisionId,
            ac.signal,
          );
          if (ac.signal.aborted) return;
          setProfile(p);
          const ref = p.content.manifest;
          if (!ref) return;
          const template = await readServiceTemplateDefinition(
            shopId,
            ref.definitionId,
          );
          const refs = [
            ...(template.content.service
              ? [{ key: "$base", ref: template.content.service }]
              : []),
            ...template.content.addons.map((a) => ({ key: a.key, ref: a })),
          ];
          const rows = await Promise.all(
            refs.map(
              async (a) =>
                [
                  a.key,
                  (await readCatalogueDefinition(shopId, a.ref.revisionId))
                    .content,
                ] as const,
            ),
          );
          if (!ac.signal.aborted) setLabels(Object.fromEntries(rows));
        } catch {
          if (!ac.signal.aborted) setFailed(true);
        }
      })();
    return () => ac.abort();
  }, [shopId, profileRevisionId]);
  const change = (patch: Partial<typeof value>) =>
    onChange({ ...value, ...patch });
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-profile`}>{s.profile}</FieldLabel>
        <select
          id={`${id}-profile`}
          value={value.profile?.revisionId ?? ""}
          onChange={(e) => {
            const p = profiles?.profiles.find((p) => p.id === e.target.value);
            if (!p) return;
            if (value.lines.length && !window.confirm(t.profileChange)) return;
            change({
              profile: { entryId: p.entryId, revisionId: p.id },
              lines: p.content.lines.map((l) => ({
                id: v7(),
                key: l.key,
                requestedWork: "",
                priceState: "to-be-quoted",
                priceText: "",
                notRequired: false,
                notRequiredReason: "",
              })),
            });
          }}
        >
          <option value="">{t.choose}</option>
          {value.profile &&
            !profiles?.profiles.some(
              (p) => p.id === value.profile?.revisionId,
            ) && (
              <option value={value.profile.revisionId}>
                {profile
                  ? locale === "ta"
                    ? profile.content.labelTa
                    : profile.content.labelEn
                  : s.sourceChanged}
              </option>
            )}
          {profiles?.profiles.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.eligible}>
              {locale === "ta" ? p.content.labelTa : p.content.labelEn}
            </option>
          ))}
        </select>
        {profiles?.next && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void readServiceProfiles(shopId, profiles.next ?? undefined).then(
                (r) =>
                  setProfiles({
                    profiles: [...profiles.profiles, ...r.profiles],
                    next: r.next,
                  }),
                () => setFailed(true),
              )
            }
          >
            {s.more}
          </Button>
        )}
      </Field>
      {value.lines.map((line, i) => {
        const spec = profile?.content.lines.find((l) => l.key === line.key),
          label = labels[spec?.addonKey ?? "$base"],
          name = label
            ? locale === "ta"
              ? label.labelTa
              : label.labelEn
            : `${t.work} ${i + 1}`;
        const update = (patch: Partial<typeof line>) =>
          change({
            lines: value.lines.map((l) =>
              l.id === line.id ? { ...l, ...patch } : l,
            ),
          });
        return (
          <fieldset key={line.id} className="owner-form">
            <legend>{name}</legend>
            <Field>
              <FieldLabel htmlFor={`${id}-${line.id}-work`}>
                {t.work}
              </FieldLabel>
              <textarea
                id={`${id}-${line.id}-work`}
                value={line.requestedWork}
                maxLength={2000}
                onChange={(e) => update({ requestedWork: e.target.value })}
              />
            </Field>
            <div className="order-fields">
              <Field>
                <FieldLabel htmlFor={`${id}-${line.id}-state`}>
                  {orderMessages[locale].priceState}
                </FieldLabel>
                <select
                  id={`${id}-${line.id}-state`}
                  value={line.priceState}
                  disabled={line.notRequired}
                  onChange={(e) =>
                    update({
                      priceState: e.target.value as typeof line.priceState,
                      priceText:
                        e.target.value === "to-be-quoted" ? "" : line.priceText,
                    })
                  }
                >
                  <option value="to-be-quoted">{t.unknown}</option>
                  <option value="quoted">{t.quoted}</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-${line.id}-price`}>
                  {t.price}
                </FieldLabel>
                <Input
                  id={`${id}-${line.id}-price`}
                  value={line.priceText}
                  inputMode="decimal"
                  maxLength={40}
                  disabled={line.priceState !== "quoted" || line.notRequired}
                  onChange={(e) => update({ priceText: e.target.value })}
                />
              </Field>
            </div>
            {spec?.optional && (
              <>
                <label className="order-check">
                  <input
                    type="checkbox"
                    checked={line.notRequired}
                    onChange={(e) =>
                      update({
                        notRequired: e.target.checked,
                        priceState: "to-be-quoted",
                        priceText: "",
                      })
                    }
                  />
                  {t.notRequired}
                </label>
                {line.notRequired && (
                  <Field>
                    <FieldLabel htmlFor={`${id}-${line.id}-nr`}>
                      {t.notRequiredReason}
                    </FieldLabel>
                    <Input
                      id={`${id}-${line.id}-nr`}
                      value={line.notRequiredReason}
                      maxLength={1000}
                      onChange={(e) =>
                        update({ notRequiredReason: e.target.value })
                      }
                    />
                  </Field>
                )}
              </>
            )}
          </fieldset>
        );
      })}
      <Field>
        <FieldLabel htmlFor={`${id}-commercial`}>{t.commercial}</FieldLabel>
        <select
          id={`${id}-commercial`}
          value={value.commercial}
          onChange={(e) =>
            change({ commercial: e.target.value as Selection["commercial"] })
          }
        >
          <option value="unresolved">{t.unresolved}</option>
          <option value="additional-charge">{t.charge}</option>
          <option value="outside-package">{t.outside}</option>
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-capacity`}>{t.capacity}</FieldLabel>
        <select
          id={`${id}-capacity`}
          value={value.capacity.basis}
          onChange={(e) => {
            const basis = e.target.value as Selection["capacity"]["basis"];
            change({
              capacity: {
                ...value.capacity,
                basis,
                coveredBy: basis === "already-covered" ? coveredBy : null,
              },
            });
          }}
        >
          <option value="unresolved">{t.unresolved}</option>
          <option value="incremental">{t.incremental}</option>
          <option value="already-covered">{t.covered}</option>
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-evidence`}>{t.capacityReason}</FieldLabel>
        <textarea
          id={`${id}-evidence`}
          value={value.capacity.reason}
          maxLength={1000}
          onChange={(e) =>
            change({ capacity: { ...value.capacity, reason: e.target.value } })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-reason`}>{t.reason}</FieldLabel>
        <textarea
          id={`${id}-reason`}
          value={value.reason}
          maxLength={1000}
          onChange={(e) => change({ reason: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-agreement`}>{t.agreement}</FieldLabel>
        <textarea
          id={`${id}-agreement`}
          value={value.agreement}
          maxLength={2000}
          onChange={(e) => change({ agreement: e.target.value })}
        />
      </Field>
      {failed && <p role="alert">{t.error}</p>}
    </>
  );
}
export function ServiceLineReview({
  lines,
  locale,
}: {
  lines: ServiceChangeReview["selection"]["lines"];
  locale: Locale;
}) {
  const t = serviceAdditionMessages[locale];
  return (
    <ul className="order-choices">
      {lines.map((l) => (
        <li key={l.id}>
          <strong>{locale === "ta" ? l.labelTa : l.labelEn}</strong>
          <p className="preserve-text">{l.requestedWork}</p>
          <p>
            {l.state === "not-required"
              ? t.notRequired
              : `${t.pending} · ${formatServicePrice(l.pricePaise, locale)}`}
            {l.notRequiredReason ? ` · ${l.notRequiredReason}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
export function ServiceScopeSummary({
  orderId,
  shopId,
  locale,
}: {
  orderId: string;
  shopId: string;
  locale: Locale;
}) {
  const [scope, setScope] = useState<ServiceScope>(),
    [failed, setFailed] = useState(false),
    t = serviceAdditionMessages[locale];
  useEffect(() => {
    const ac = new AbortController();
    void readServiceScope(shopId, orderId, ac.signal).then(
      (s) => {
        if (!ac.signal.aborted) setScope(s);
      },
      () => {
        if (!ac.signal.aborted) setFailed(true);
      },
    );
    return () => ac.abort();
  }, [shopId, orderId]);
  if (failed) return <p role="alert">{t.error}</p>;
  if (!scope?.changes.length) return null;
  return (
    <section className="order-editor service-additions" aria-label={t.current}>
      <ServiceLineCompletion
        key={`${shopId}:${orderId}:${scope.version}`}
        shopId={shopId}
        orderId={orderId}
        locale={locale}
      />
      <h4>{t.current}</h4>
      <p>
        {scope.package ? t.outside : t.extras}:{" "}
        {formatServicePrice(scope.additionsPaise, locale)}
      </p>
      {!scope.package && (
        <p>
          {t.total}: {formatServicePrice(scope.totalPaise, locale)}
        </p>
      )}
      <details>
        <summary>{t.history}</summary>
        {scope.changes.map((c) => (
          <article key={c.id}>
            <p className="preserve-text">{c.content.input.reason}</p>
            <ServiceLineReview lines={c.content.lines} locale={locale} />
          </article>
        ))}
      </details>
    </section>
  );
}
export function BookingServiceScopeSummary({
  bookingId,
  shopId,
  locale,
}: {
  bookingId: string;
  shopId: string;
  locale: Locale;
}) {
  const [scope, setScope] =
      useState<Awaited<ReturnType<typeof readBookingServiceScope>>>(),
    [failed, setFailed] = useState(false),
    t = serviceAdditionMessages[locale];
  useEffect(() => {
    const ac = new AbortController();
    void readBookingServiceScope(shopId, bookingId, ac.signal).then(
      (r) => {
        if (!ac.signal.aborted) setScope(r);
      },
      () => {
        if (!ac.signal.aborted) setFailed(true);
      },
    );
    return () => ac.abort();
  }, [bookingId, shopId]);
  if (failed) return <p role="alert">{t.error}</p>;
  if (!scope?.hasChanges) return null;
  return (
    <section className="order-editor service-additions" aria-label={t.current}>
      <h4>{t.current}</h4>
      <dl>
        <dt>{scope.basis === "package-proposal" ? t.outside : t.extras}</dt>
        <dd>
          {formatBookingPaise(scope.extraKnownPaise, locale)} ·{" "}
          {t.unknownAmounts}: {scope.extraUnknownCount}
        </dd>
        <dt>{t.knownTotal}</dt>
        <dd>
          {formatBookingPaise(scope.currentKnownPaise, locale)} ·{" "}
          {t.unknownAmounts}: {scope.currentUnknownCount}
        </dd>
      </dl>
    </section>
  );
}
export function ServiceCapacityReview({
  evaluation,
  locale,
}: {
  evaluation: OrderReview["evaluation"] | undefined;
  locale: Locale;
}) {
  if (!evaluation) return null;
  const t = orderAcceptanceMessages[locale],
    c = shopCommitmentsMessages[locale],
    f = evaluation.facts;
  return (
    <>
      <dl>
        <dt>{t.capacity}</dt>
        <dd>
          {f.cap ?? c.unresolved} · {f.unit ? c[f.unit] : c.unresolved}
        </dd>
        <dt>{t.existing}</dt>
        <dd>{f.existing ?? c.unresolved}</dd>
        <dt>{t.candidate}</dt>
        <dd>{f.candidate ?? c.unresolved}</dd>
        <dt>{t.total}</dt>
        <dd>{f.total ?? c.unresolved}</dd>
        <dt>{t.week}</dt>
        <dd>{f.weekStart}</dd>
      </dl>
      {evaluation.warnings.map((w) => (
        <p key={w} role="status">
          {w in c ? c[w as keyof typeof c] : c.unresolved}
        </p>
      ))}
    </>
  );
}
const material = (v: ServiceChangeDraft) =>
  JSON.stringify({ ...v, review: null });
function ChangeFields({
  form,
  controller,
  shopId,
  locale,
  onRefresh,
}: {
  form: UseFormReturn<ServiceChangeDraft>;
  controller: DraftRecovery;
  shopId: string;
  locale: Locale;
  onRefresh: () => Promise<ServiceScope>;
}) {
  const state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = serviceChangeDraftSchema.parse(state.values),
    t = serviceAdditionMessages[locale];
  const [review, setReview] = useState<ServiceChangeReview>(),
    [facts, setFacts] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [targetStale, setTargetStale] = useState(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const valid = !!review && facts === material(v);
  const decision = {
    fingerprint: review?.fingerprint ?? "",
    acknowledged: false,
    exceptionReason: "",
    waiveRush: false,
    waiverReason: "",
    ...v.review,
  };
  const [pieces, setPieces] =
    useState<Awaited<ReturnType<typeof readOrderPieces>>>();
  useEffect(() => {
    let current = true;
    void readOrderPieces(shopId, v.orderId).then(
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
  }, [shopId, v.orderId]);
  async function inspect() {
    setBusy(true);
    setFailed(false);
    setTargetStale(false);
    setReview(undefined);
    try {
      await controller.save();
      const s = controller.snapshot();
      if (s.status !== "saved" || s.work.dirty || s.work.outcomeUnknown)
        throw Error();
      const input = serviceChangeDraftSchema.parse(s.values),
        r = await reviewServiceChange(shopId, input);
      if (
        alive.current &&
        material(
          serviceChangeDraftSchema.parse(controller.snapshot().values),
        ) === material(input)
      ) {
        setReview(r);
        setFacts(material(input));
        form.setValue(
          "review",
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
    } catch (error) {
      if (alive.current) {
        if (
          error instanceof OwnerRequestError &&
          error.code === "VERSION_STALE"
        )
          setTargetStale(true);
        else setFailed(true);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function refreshTarget() {
    setBusy(true);
    setFailed(false);
    try {
      const s = await onRefresh();
      if (!alive.current) return;
      form.setValue("version", s.version, { shouldDirty: true });
      form.setValue("scopeDigest", s.scopeDigest, { shouldDirty: true });
      form.setValue("originalDigest", s.originalDigest, { shouldDirty: true });
      form.setValue("review", null, { shouldDirty: true });
      setReview(undefined);
      setTargetStale(false);
      await controller.save();
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <Field>
        <FieldLabel htmlFor="service-change-piece">{t.piece}</FieldLabel>
        <select
          id="service-change-piece"
          value={v.pieceId ?? ""}
          onChange={(e) => {
            form.setValue("pieceId", e.target.value || null, {
              shouldDirty: true,
            });
            form.setValue("review", null, { shouldDirty: true });
          }}
        >
          <option value="">{t.property}</option>
          {pieces?.identities.map((piece) => {
            const definition = pieces.structure?.pieces.find(
              (p) => p.key === piece.key,
            );
            return (
              <option key={piece.id} value={piece.id}>
                {definition
                  ? locale === "ta"
                    ? definition.labelTa
                    : definition.labelEn
                  : t.piece}
              </option>
            );
          })}
        </select>
      </Field>
      {busy && <p role="status">{smallServiceMessages[locale].loading}</p>}
      <ServiceSelection
        shopId={shopId}
        locale={locale}
        value={v}
        coveredBy={v.orderId}
        onChange={(selection) => {
          for (const key of [
            "profile",
            "lines",
            "capacity",
            "commercial",
            "reason",
            "agreement",
          ] as const)
            form.setValue(key, selection[key] as never, { shouldDirty: true });
          form.setValue("review", null, { shouldDirty: true });
        }}
      />
      <Button
        type="button"
        disabled={
          busy ||
          state.work.inFlight ||
          state.work.outcomeUnknown ||
          state.status === "conflict"
        }
        onClick={() => void inspect()}
      >
        {t.review}
      </Button>
      {failed && <p role="alert">{t.error}</p>}
      {state.error === "RATE_LIMITED" && <p role="alert">{t.rateLimited}</p>}
      {state.status !== "conflict" &&
        (targetStale ||
          state.error === "VERSION_STALE" ||
          state.error === "REQUEST_CONFLICT") && (
          <>
            <p role="alert">{t.scopeChanged}</p>
            <Button
              type="button"
              variant="outline"
              disabled={
                busy || state.work.inFlight || state.work.outcomeUnknown
              }
              onClick={() => void refreshTarget()}
            >
              {t.refresh}
            </Button>
          </>
        )}
      {review && valid && (
        <section aria-label={t.review}>
          <h3>{t.newScope}</h3>
          <ServiceLineReview lines={review.selection.lines} locale={locale} />
          <p>
            {t.extras}:{" "}
            {formatServicePrice(review.selection.totalPaise, locale)}
          </p>
          <p>{t.promise}</p>
          <ServiceCapacityReview
            evaluation={review.selection.commitment?.evaluation}
            locale={locale}
          />
          {review.issues.map((i) => (
            <p key={i} role="alert">
              {serviceIssue(i, locale)}
            </p>
          ))}
          <Field>
            <FieldLabel htmlFor="added-exception">{t.exception}</FieldLabel>
            <textarea
              id="added-exception"
              value={v.review?.exceptionReason ?? ""}
              maxLength={1000}
              onChange={(e) =>
                form.setValue(
                  "review",
                  { ...decision, exceptionReason: e.target.value },
                  { shouldDirty: true },
                )
              }
            />
          </Field>
          <label className="order-check">
            <input
              type="checkbox"
              checked={v.review?.acknowledged ?? false}
              onChange={(e) =>
                form.setValue(
                  "review",
                  { ...decision, acknowledged: e.target.checked },
                  { shouldDirty: true },
                )
              }
            />
            {t.ack}
          </label>
          <Button
            type="button"
            disabled={
              busy ||
              review.issues.length > 0 ||
              !v.review?.acknowledged ||
              state.status === "conflict"
            }
            onClick={() =>
              void (async () => {
                await controller.save();
                await controller.promote();
              })()
            }
          >
            {t.confirm}
          </Button>
        </section>
      )}
    </>
  );
}
export function ServiceChangeEditor({
  controller,
  shopId,
  locale,
  guard,
  onRefresh,
}: {
  controller: DraftRecovery;
  shopId: string;
  locale: Locale;
  guard: OwnerGuard;
  onRefresh: () => Promise<ServiceScope>;
}) {
  return (
    <DraftForm
      controller={controller}
      schema={serviceChangeDraftSchema}
      locale={locale}
      guard={guard}
      canPromote={false}
      renderConflict={(record) => (
        <ServiceDraftConflict record={record} shopId={shopId} locale={locale} />
      )}
    >
      {(form) => (
        <ChangeFields
          form={form}
          controller={controller}
          shopId={shopId}
          locale={locale}
          onRefresh={onRefresh}
        />
      )}
    </DraftForm>
  );
}
export function OrderServiceAdditions({
  order,
  shopId,
  locale,
  guard,
  onChanged,
}: {
  order: AcceptedOrder;
  shopId: string;
  locale: Locale;
  guard: OwnerGuard;
  onChanged?: () => void;
}) {
  const t = serviceAdditionMessages[locale],
    [scope] = useState(() => createDraftScope(shopId, guard)),
    [current, setCurrent] = useState<ServiceScope>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [draftNext, setDraftNext] = useState<DraftCursor | null>(null),
    [controller, setController] = useState<DraftRecovery>(),
    [failed, setFailed] = useState(false),
    active = useRef(true),
    selected = useRef<DraftRecovery | undefined>(undefined);
  async function refresh() {
    const s = await readServiceScope(shopId, order.id);
    if (active.current) setCurrent(s);
    return s;
  }
  async function loadDrafts(cursor?: DraftCursor) {
    const r = await scope.list(cursor);
    if (!active.current) return;
    setDraftNext(r.next);
    setDrafts((previous) => {
      const map = new Map((cursor ? previous : []).map((d) => [d.id, d]));
      for (const d of r.drafts)
        if (
          d.workflow === "order.service-change" &&
          d.payload.orderId === order.id &&
          d.lifecycle === "active"
        )
          map.set(d.id, d);
      return [...map.values()];
    });
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: the order identity owns this mounted draft scope.
  useEffect(() => {
    active.current = true;
    void refresh().catch(() => {
      if (active.current) setFailed(true);
    });
    void loadDrafts().catch(() => {
      if (active.current) setFailed(true);
    });
    return () => {
      active.current = false;
      queueMicrotask(() => {
        if (!active.current) scope.dispose();
      });
    };
  }, [scope, order.id]);
  function open(record?: DraftRecord) {
    if (!current) return;
    if (selected.current) {
      if (!selected.current.confirmLeave(() => window.confirm(t.close))) return;
      scope.release(selected.current);
    }
    const initial: ServiceChangeDraft = {
      orderId: order.id,
      version: current.version,
      originalDigest: current.originalDigest,
      scopeDigest: current.scopeDigest,
      pieceId: null,
      profile: null,
      lines: [],
      capacity: { basis: "unresolved", coveredBy: null, reason: "" },
      commercial: "unresolved",
      reason: "",
      agreement: "",
      review: null,
    };
    const c = scope.open({
      workflow: "order.service-change",
      editableTargetConflict: true,
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!active.current) return;
        if (r.lifecycle === "active")
          setDrafts((rows) => [...rows.filter((d) => d.id !== r.id), r]);
        if (r.lifecycle === "promoted") {
          scope.release(c);
          selected.current = undefined;
          setController(undefined);
          setDrafts((d) => d.filter((x) => x.id !== r.id));
          void refresh().then(
            () => onChanged?.(),
            () => setFailed(true),
          );
        }
      },
    });
    selected.current = c;
    setController(c);
  }
  return (
    <section className="order-editor service-additions" aria-label={t.title}>
      <h2>{t.title}</h2>
      <ServiceLineCompletion
        key={`${shopId}:${order.id}:${current?.version ?? order.version}`}
        shopId={shopId}
        orderId={order.id}
        locale={locale}
      />
      {failed && <p role="alert">{t.error}</p>}
      {current && (
        <>
          <dl>
            <dt>{t.original}</dt>
            <dd>{formatServicePrice(current.originalPaise, locale)}</dd>
            <dt>{current.package ? t.outside : t.extras}</dt>
            <dd>{formatServicePrice(current.additionsPaise, locale)}</dd>
            {!current.package && (
              <>
                <dt>{t.total}</dt>
                <dd>{formatServicePrice(current.totalPaise, locale)}</dd>
              </>
            )}
          </dl>
          <p>
            {t.promise}: {order.currentPromise.date} {order.currentPromise.time}
          </p>
          <details>
            <summary>{t.history}</summary>
            {current.changes.length ? (
              current.changes.map((c) => (
                <article key={c.id}>
                  <h3>
                    {new Date(c.recordedAt).toLocaleString(
                      locale === "ta" ? "ta-IN" : "en-IN",
                    )}
                  </h3>
                  <p className="preserve-text">{c.content.input.reason}</p>
                  <p className="preserve-text">{c.content.input.agreement}</p>
                  <ServiceLineReview lines={c.content.lines} locale={locale} />
                  <details>
                    <summary>{t.newScope}</summary>
                    <p>
                      {c.originDraftId} · {c.digest}
                    </p>
                    <p>
                      {locale === "ta"
                        ? c.content.profile.content.labelTa
                        : c.content.profile.content.labelEn}{" "}
                      · {c.content.profile.version}
                    </p>
                  </details>
                </article>
              ))
            ) : (
              <p>{t.historyEmpty}</p>
            )}
          </details>
          <Button type="button" onClick={() => open()}>
            {t.add}
          </Button>
          {drafts.map((d) => (
            <Button
              key={d.id}
              type="button"
              variant="outline"
              onClick={() => open(d)}
            >
              {smallServiceMessages[locale].resume} ·{" "}
              {new Date(d.updatedAt).toLocaleString()}
            </Button>
          ))}
        </>
      )}
      {draftNext && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void loadDrafts(draftNext).catch(() => setFailed(true))
          }
        >
          {smallServiceMessages[locale].more}
        </Button>
      )}
      {controller && (
        <>
          <ServiceChangeEditor
            key={controller.instance}
            controller={controller}
            shopId={shopId}
            locale={locale}
            guard={guard}
            onRefresh={refresh}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!controller.confirmLeave(() => window.confirm(t.close)))
                return;
              scope.release(controller);
              selected.current = undefined;
              setController(undefined);
            }}
          >
            {t.close}
          </Button>
        </>
      )}
    </section>
  );
}
