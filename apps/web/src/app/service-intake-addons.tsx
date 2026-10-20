import { reviewServiceIntake } from "@aarili/api/small-services-client";
import {
  emptyQuickOrder,
  groupIntakeDraftSchema,
  type QuickOrderDraft,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import {
  type ServiceIntakeDraft,
  serviceIntakeDraftSchema,
} from "@aarili/contracts/small-services";
import {
  bookingMessages,
  formatBookingPaise,
  groupIntakeMessages,
  type Locale,
  orderAcceptanceMessages,
  orderMessages,
  serviceAdditionMessages,
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
import { DraftForm } from "./draft-form";
import type { DraftRecovery, DraftState } from "./draft-recovery";
import { GroupPayerPicker } from "./group-intake";
import { QuickOrderFields } from "./orders-screen";
import type { OwnerGuard } from "./owner-feedback";
import {
  formatServicePrice,
  ServiceCapacityReview,
  ServiceLineReview,
  ServiceSelection,
} from "./service-additions";
import { ServiceDraftConflict } from "./service-draft-conflict";
import { serviceIssue } from "./small-service-intake";

function BaseEditor({
  controller,
  intake,
  lineId,
  form,
  shopId,
  locale,
}: {
  controller: DraftRecovery;
  intake: QuickOrderDraft;
  lineId: string | null;
  form: UseFormReturn<ServiceIntakeDraft>;
  shopId: string;
  locale: Locale;
}) {
  const local = useForm<QuickOrderDraft>({ defaultValues: intake });
  const projection = useMemo(() => {
    let last: DraftState | undefined, result: DraftState;
    return {
      ...controller,
      snapshot() {
        const s = controller.snapshot();
        if (s !== last) {
          last = s;
          const v = serviceIntakeDraftSchema.parse(s.values);
          result = {
            ...s,
            values:
              v.kind === "custom"
                ? quickOrderDraftSchema.parse(v.base)
                : (groupIntakeDraftSchema
                    .parse(v.base)
                    .lines.find((l) => l.id === lineId)?.intake ??
                  emptyQuickOrder()),
          };
        }
        return result;
      },
    };
  }, [controller, lineId]);
  useEffect(() => {
    const sub = local.watch((value) => {
      const v = form.getValues();
      form.setValue(
        "base",
        v.kind === "custom"
          ? (value as QuickOrderDraft)
          : {
              ...groupIntakeDraftSchema.parse(v.base),
              lines: groupIntakeDraftSchema
                .parse(v.base)
                .lines.map((l) =>
                  l.id === lineId
                    ? { ...l, intake: value as QuickOrderDraft }
                    : l,
                ),
            },
        { shouldDirty: true },
      );
      form.setValue("review", null, { shouldDirty: true });
    });
    return () => sub.unsubscribe();
  }, [local, form, lineId]);
  return (
    <QuickOrderFields
      controller={projection}
      form={local}
      shopId={shopId}
      locale={locale}
      t={orderMessages[locale]}
      grouped
    />
  );
}
const facts = (v: ServiceIntakeDraft) => JSON.stringify({ ...v, review: null });
function Fields({
  controller,
  form,
  shopId,
  locale,
}: {
  controller: DraftRecovery;
  form: UseFormReturn<ServiceIntakeDraft>;
  shopId: string;
  locale: Locale;
}) {
  const state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = serviceIntakeDraftSchema.parse(state.values),
    t = serviceAdditionMessages[locale];
  const rows =
    v.kind === "custom"
      ? [{ id: null, intake: quickOrderDraftSchema.parse(v.base) }]
      : groupIntakeDraftSchema.parse(v.base).lines;
  const [selected, setSelected] = useState(0),
    [review, setReview] =
      useState<Awaited<ReturnType<typeof reviewServiceIntake>>>(),
    [reviewed, setReviewed] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const row = rows[selected] ?? rows[0],
    selection = v.selections.find((s) => s.lineId === row?.id),
    valid = !!review && facts(v) === reviewed;
  const group =
      v.kind === "group" ? groupIntakeDraftSchema.parse(v.base) : null,
    b = bookingMessages[locale],
    g = groupIntakeMessages[locale];
  const [conflictEpoch, setConflictEpoch] = useState(0),
    previousConflict = useRef(state.conflict);
  useEffect(() => {
    if (previousConflict.current && !state.conflict)
      setConflictEpoch((n) => n + 1);
    previousConflict.current = state.conflict;
  }, [state.conflict]);
  const decision = {
    fingerprint: review?.fingerprint ?? "",
    acknowledged: false,
    exceptionReason: "",
    waiveRush: false,
    waiverReason: "",
    ...v.review,
  };
  async function inspect() {
    setBusy(true);
    setFailed(false);
    setReview(undefined);
    try {
      await controller.save();
      const s = controller.snapshot();
      if (s.status !== "saved" || s.work.dirty || s.work.outcomeUnknown)
        throw Error();
      const input = serviceIntakeDraftSchema.parse(s.values),
        r = await reviewServiceIntake(shopId, input);
      if (
        alive.current &&
        facts(serviceIntakeDraftSchema.parse(controller.snapshot().values)) ===
          facts(input)
      ) {
        setReview(r);
        setReviewed(facts(input));
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
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <p>{t.convertNote}</p>
      {group && (
        <details>
          <summary>{b.occasion}</summary>
          <div className="owner-form">
            <Field>
              <FieldLabel htmlFor="services-group-occasion">
                {b.occasion}
              </FieldLabel>
              <select
                id="services-group-occasion"
                {...form.register("base.context.occasion")}
              >
                <option value="visit">{b.visit}</option>
                <option value="bridal">{b.bridal}</option>
                <option value="other">{b.other}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="services-group-event">{b.event}</FieldLabel>
              <Input
                id="services-group-event"
                className="ui-input"
                type="date"
                {...form.register("base.context.eventDate")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="services-group-notes">{b.notes}</FieldLabel>
              <textarea
                id="services-group-notes"
                maxLength={2000}
                {...form.register("base.context.notes")}
              />
            </Field>
            <GroupPayerPicker
              shopId={shopId}
              locale={locale}
              value={group.context.payerId}
              onChange={(id) =>
                form.setValue("base.context.payerId", id, { shouldDirty: true })
              }
            />
            <Field>
              <FieldLabel htmlFor="services-group-basis">{g.basis}</FieldLabel>
              <select
                id="services-group-basis"
                {...form.register("base.commercial.basis")}
              >
                <option value="garment-prices">{g.aggregate}</option>
                <option value="package-proposal">{g.package}</option>
              </select>
            </Field>
            {group.commercial.basis === "package-proposal" && (
              <>
                <Field>
                  <FieldLabel htmlFor="services-group-price-state">
                    {g.packageState}
                  </FieldLabel>
                  <select
                    id="services-group-price-state"
                    {...form.register("base.commercial.packagePriceState")}
                  >
                    <option value="to-be-quoted">{g.packageUnknown}</option>
                    <option value="quoted">
                      {orderAcceptanceMessages[locale].price}
                    </option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="services-group-price">
                    {g.packageAmount}
                  </FieldLabel>
                  <Input
                    id="services-group-price"
                    className="ui-input"
                    inputMode="decimal"
                    maxLength={40}
                    {...form.register("base.commercial.packagePriceText")}
                  />
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor="services-group-reason">
                {g.reason}
              </FieldLabel>
              <textarea
                id="services-group-reason"
                maxLength={1000}
                {...form.register("base.reason")}
              />
            </Field>
          </div>
        </details>
      )}
      {rows.length > 1 && (
        <Field>
          <FieldLabel htmlFor="service-intake-garment">{t.base}</FieldLabel>
          <select
            id="service-intake-garment"
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {rows.map((l, i) => (
              <option key={l.id} value={i}>
                {i + 1} · {l.intake.deliveryDate}
              </option>
            ))}
          </select>
        </Field>
      )}
      {row && (
        <>
          <details>
            <summary>{t.base}</summary>
            <BaseEditor
              key={`${row.id ?? "custom"}:${conflictEpoch}`}
              controller={controller}
              intake={row.intake}
              lineId={row.id}
              form={form}
              shopId={shopId}
              locale={locale}
            />
          </details>
          <p>
            {t.promise}: {row.intake.deliveryDate} {row.intake.deliveryTime}
          </p>
          {selection ? (
            <ServiceSelection
              shopId={shopId}
              locale={locale}
              value={selection}
              onChange={(value) => {
                form.setValue(
                  "selections",
                  v.selections.map((s) =>
                    s.lineId === row.id ? { ...value, lineId: row.id } : s,
                  ),
                  { shouldDirty: true },
                );
                form.setValue("review", null, { shouldDirty: true });
              }}
            />
          ) : (
            <Button
              type="button"
              onClick={() => {
                form.setValue(
                  "selections",
                  [
                    ...v.selections,
                    {
                      lineId: row.id,
                      profile: null,
                      lines: [],
                      capacity: {
                        basis: "unresolved",
                        coveredBy: null,
                        reason: "",
                      },
                      commercial: "unresolved",
                      reason: "",
                      agreement: "",
                    },
                  ],
                  { shouldDirty: true },
                );
                form.setValue("review", null, { shouldDirty: true });
              }}
            >
              {t.select}
            </Button>
          )}
        </>
      )}
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
        {t.intakeReview}
      </Button>
      {failed && <p role="alert">{t.error}</p>}
      {review && valid && (
        <section aria-label={t.intakeReview}>
          <h3>{t.newScope}</h3>
          {"packagePaise" in review.base &&
            group?.commercial.basis === "package-proposal" && (
              <p>
                {g.packagePrice}:{" "}
                {review.base.packagePaise === null
                  ? g.packageUnknown
                  : formatBookingPaise(review.base.packagePaise, locale)}{" "}
                · {g.allocation}
              </p>
            )}
          {rows.map((l, i) => (
            <p key={l.id ?? "custom"}>
              {t.base} {i + 1} · {l.intake.deliveryDate} {l.intake.deliveryTime}{" "}
              ·{" "}
              {group?.commercial.basis === "package-proposal"
                ? g.included
                : formatServicePrice(
                    "lines" in review.base
                      ? (review.base.lines[i]?.review.intake.pricePaise ?? null)
                      : review.base.intake.pricePaise,
                    locale,
                  )}
            </p>
          ))}
          {review.selections.map((s, i) => (
            <article key={v.selections[i]?.lineId ?? "custom"}>
              <ServiceLineReview lines={s.lines} locale={locale} />
              <p>
                {t.extras}: {formatServicePrice(s.totalPaise, locale)}
              </p>
              <ServiceCapacityReview
                evaluation={s.commitment?.evaluation}
                locale={locale}
              />
            </article>
          ))}
          {review.issues.map((i) => (
            <p key={i} role="alert">
              {serviceIssue(i, locale)}
            </p>
          ))}
          <Field>
            <FieldLabel htmlFor="intake-service-exception">
              {t.exception}
            </FieldLabel>
            <textarea
              id="intake-service-exception"
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
            {t.intakeConfirm}
          </Button>
        </section>
      )}
    </>
  );
}
export function ServiceIntakeAddonsEditor({
  controller,
  shopId,
  locale,
  guard,
}: {
  controller: DraftRecovery;
  shopId: string;
  locale: Locale;
  guard: OwnerGuard;
}) {
  return (
    <section className="order-editor service-additions">
      <h2>{serviceAdditionMessages[locale].title}</h2>
      <DraftForm
        controller={controller}
        schema={serviceIntakeDraftSchema}
        locale={locale}
        guard={guard}
        canPromote={false}
        renderConflict={(record) => (
          <ServiceDraftConflict
            record={record}
            shopId={shopId}
            locale={locale}
          />
        )}
      >
        {(form) => (
          <Fields
            controller={controller}
            form={form}
            shopId={shopId}
            locale={locale}
          />
        )}
      </DraftForm>
    </section>
  );
}
