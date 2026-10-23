import { OwnerRequestError } from "@aarili/api/client";
import {
  readMeasurement,
  readMeasurementTarget,
} from "@aarili/api/measurement-sessions-client";
import {
  createRepeatOrder,
  OrderRequestError,
  readOrderPieces,
  readRepeatLinks,
  readRepeatSource,
} from "@aarili/api/orders-client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import type { MeasurementVersion } from "@aarili/contracts/measurement-sessions";
import type { RepeatOrderDraft } from "@aarili/contracts/orders";
import {
  type QuickOrderDraft,
  repeatOrderDraftSchema,
} from "@aarili/contracts/orders";
import {
  formatOrderPaise,
  type Locale,
  repeatOrderMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { v7 } from "uuid";
import type { DraftRecovery } from "./draft-recovery";
import { SavedMeasurement } from "./measurement-sessions";
import type { OwnerGuard } from "./owner-feedback";

type Source = Awaited<ReturnType<typeof readRepeatSource>>;
function Context({ source, locale }: { source: Source; locale: Locale }) {
  const t = repeatOrderMessages[locale],
    o = source.order;
  return (
    <>
      <p>
        <strong>
          {t.source}: {o.code}
        </strong>
      </p>
      <p>
        {o.customer?.label} · {o.customer?.code} · {o.wearer?.label}
      </p>
      <p>
        {locale === "ta"
          ? o.requirements.definition.labelTa
          : o.requirements.definition.labelEn}
      </p>
      {source.currentManifest?.revisionId !== o.intake.manifest?.revisionId && (
        <p role="status">
          {source.currentManifest ? t.manifestChanged : t.manifestUnavailable}
        </p>
      )}
      <dl>
        <div>
          <dt>{t.price}</dt>
          <dd>
            {o.pricePaise === null
              ? t.quoted
              : formatOrderPaise(o.pricePaise, locale)}
          </dd>
        </div>
        <div>
          <dt>{t.delivery}</dt>
          <dd>{o.originalPromise.date}</dd>
        </div>
        <div>
          <dt>{t.current}</dt>
          <dd>{o.version}</dd>
        </div>
        <div>
          <dt>{t.original}</dt>
          <dd>{o.intake.instructions || "—"}</dd>
        </div>
      </dl>
      {source.additions.length > 0 && <p>{t.additions}</p>}
      <p>{t.reset}</p>
    </>
  );
}
export function RepeatOrderPanel({
  shopId,
  orderId,
  locale,
  onDraft,
  onOrder,
  disabled,
  guard,
  onUnavailable,
}: {
  shopId: string;
  orderId: string;
  locale: Locale;
  onDraft: (record: DraftRecord) => void;
  onOrder: (id: string) => void;
  disabled: boolean;
  guard: OwnerGuard;
  onUnavailable: () => void;
}) {
  const t = repeatOrderMessages[locale];
  const [source, setSource] = useState<Source>(),
    [links, setLinks] = useState<Awaited<ReturnType<typeof readRepeatLinks>>>(),
    [reuse, setReuse] = useState(false),
    [measurementOptions, setMeasurementOptions] = useState<
      {
        reference: NonNullable<RepeatOrderDraft["measurementReuse"]>;
        version: MeasurementVersion;
        label: string;
      }[]
    >([]),
    [measurementId, setMeasurementId] = useState(""),
    [measurementReviewed, setMeasurementReviewed] = useState(false),
    [working, setWorking] = useState(false),
    [failed, setFailed] = useState(false);
  const alive = useRef(true),
    pending = useRef<
      | {
          input: Parameters<typeof createRepeatOrder>[2];
          key: string;
          version: number;
        }
      | undefined
    >(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const tracker = guard.track();
    tracker.set({
      dirty: false,
      inFlight: working,
      outcomeUnknown: !!pending.current && failed,
    });
    const leaving = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigation = (event: MouseEvent) => {
      if (
        pending.current &&
        event.target instanceof Element &&
        event.target.closest("a[href]")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", leaving);
    document.addEventListener("click", navigation, true);
    return () => {
      tracker.dispose();
      window.removeEventListener("beforeunload", leaving);
      document.removeEventListener("click", navigation, true);
    };
  }, [guard, working, failed]);
  async function inspect() {
    setWorking(true);
    setFailed(false);
    try {
      const r = await readRepeatSource(shopId, orderId);
      const options: typeof measurementOptions = [];
      const pieces = await readOrderPieces(shopId, orderId);
      for (const piece of [null, ...pieces.identities]) {
        try {
          const scope = await readMeasurementTarget(shopId, {
            orderId,
            pieceId: piece?.id ?? null,
          });
          if (scope.selectedId) {
            const version = await readMeasurement(shopId, scope.selectedId);
            options.push({
              reference: {
                selectedId: version.id,
                sourcePieceId: piece?.id ?? null,
                pieceKey: piece?.key ?? null,
                reviewed: true,
              },
              version,
              label: piece?.key ?? r.order.code,
            });
          }
        } catch (e) {
          // A scope with no supported exact mapping is not a reusable measurement.
          // Other failures must not leave stale/private choices on the screen.
          if (e instanceof OwnerRequestError && e.code === "NOT_FOUND") {
            options.length = 0;
            break;
          }
          if (
            !(e instanceof Error) ||
            !["REQUEST_CONFLICT"].includes(e.message)
          )
            throw e;
        }
      }
      if (alive.current) {
        setSource(r);
        setMeasurementOptions(options);
        setMeasurementId("");
        setMeasurementReviewed(false);
      }
    } catch (e) {
      if (alive.current) {
        setSource(undefined);
        setMeasurementOptions([]);
        setMeasurementId("");
        setMeasurementReviewed(false);
        setFailed(true);
        if (e instanceof OrderRequestError && e.status === 404) onUnavailable();
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  async function loadLinks(before?: string) {
    try {
      const r = await readRepeatLinks(shopId, orderId, before);
      if (alive.current)
        setLinks((prior) =>
          before && prior
            ? { ...r, children: [...prior.children, ...r.children] }
            : r,
        );
    } catch (e) {
      if (alive.current) {
        setLinks(undefined);
        setFailed(true);
        if (e instanceof OrderRequestError && e.status === 404) onUnavailable();
      }
    }
  }
  // Requests and response values belong to this mounted, authorised order scope.
  // biome-ignore lint/correctness/useExhaustiveDependencies: remounted by order identity
  useEffect(() => {
    void loadLinks();
  }, []);
  async function create() {
    if (!source) return;
    setWorking(true);
    setFailed(false);
    pending.current ??= {
      input: {
        draftId: v7(),
        snapshotDigest: source.order.snapshotDigest,
        scopeDigest: source.scopeDigest,
        reuseInstructions: reuse,
        ...(measurementReviewed && measurementId
          ? {
              measurementReuse: measurementOptions.find(
                (o) =>
                  `${o.version.id}:${o.reference.sourcePieceId ?? "order"}` ===
                  measurementId,
              )?.reference,
            }
          : {}),
      },
      key: v7(),
      version: source.order.version,
    };
    try {
      const p = pending.current,
        r = await createRepeatOrder(shopId, orderId, p.input, p.key, p.version);
      if (alive.current) {
        pending.current = undefined;
        onDraft(r.draft);
      }
    } catch (e) {
      if (alive.current) {
        setFailed(true);
        if (e instanceof OrderRequestError && e.status < 500) {
          pending.current = undefined;
          setSource(undefined);
          if (e.status === 404) onUnavailable();
        }
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  return (
    <section aria-label={t.title}>
      <h3>{t.title}</h3>
      {links?.source && (
        <p>
          {t.based}{" "}
          <Button
            variant="outline"
            disabled={disabled || working}
            onClick={() => onOrder(links.source?.id ?? orderId)}
          >
            {links.source.code}
          </Button>
        </p>
      )}
      {links?.children.map((c) => (
        <p key={c.id}>
          {t.repeated}{" "}
          <Button
            variant="outline"
            disabled={disabled || working}
            onClick={() => onOrder(c.id)}
          >
            {c.code}
          </Button>
        </p>
      ))}
      {links?.next && (
        <Button
          disabled={disabled || working}
          onClick={() => void loadLinks(links.next ?? undefined)}
        >
          {t.more}
        </Button>
      )}
      {!source ? (
        <Button disabled={disabled || working} onClick={() => void inspect()}>
          {t.inspect}
        </Button>
      ) : (
        <>
          <Context source={source} locale={locale} />
          {!!measurementOptions.length && (
            <fieldset className="owner-form">
              <legend>{t.measurement}</legend>
              <p>{t.measurementHelp}</p>
              <Field>
                <FieldLabel htmlFor="repeat-measurement">
                  {t.measurement}
                </FieldLabel>
                <select
                  id="repeat-measurement"
                  value={measurementId}
                  disabled={working || !!pending.current}
                  onChange={(e) => {
                    setMeasurementId(e.target.value);
                    setMeasurementReviewed(false);
                  }}
                >
                  <option value="">{t.measurementNone}</option>
                  {measurementOptions.map((o) => (
                    <option
                      key={`${o.version.id}:${o.reference.sourcePieceId}`}
                      value={`${o.version.id}:${o.reference.sourcePieceId ?? "order"}`}
                    >
                      {o.label} · V{o.version.version} · {o.version.source.date}
                    </option>
                  ))}
                </select>
              </Field>
              {measurementId && (
                <>
                  {measurementOptions
                    .filter(
                      (o) =>
                        `${o.version.id}:${o.reference.sourcePieceId ?? "order"}` ===
                        measurementId,
                    )
                    .map((o) => (
                      <SavedMeasurement
                        key={o.version.id}
                        v={o.version}
                        locale={locale}
                        prefix="repeat"
                      />
                    ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={measurementReviewed}
                      disabled={working || !!pending.current}
                      onChange={(e) => setMeasurementReviewed(e.target.checked)}
                    />
                    {t.measurementReview}
                  </label>
                </>
              )}
            </fieldset>
          )}
          <label>
            <input
              type="checkbox"
              checked={reuse}
              disabled={working || !!pending.current}
              onChange={(e) => setReuse(e.target.checked)}
            />
            {t.reuse}
          </label>
          <div className="owner-actions">
            <Button
              disabled={
                working ||
                (disabled && !pending.current) ||
                (!!measurementId && !measurementReviewed)
              }
              onClick={() => void create()}
            >
              {pending.current ? t.retry : t.create}
            </Button>
            <Button
              variant="outline"
              disabled={working || !!pending.current}
              onClick={() => setSource(undefined)}
            >
              {t.title} — {locale === "ta" ? "மூடு" : "Close"}
            </Button>
          </div>
        </>
      )}
      {working && (
        <p role="status">{pending.current ? t.checking : t.loading}</p>
      )}
      {failed && (
        <p role="alert">
          {t.sourceUnavailable}
          {pending.current && (
            <Button onClick={() => void create()} disabled={working}>
              {t.retry}
            </Button>
          )}
        </p>
      )}
    </section>
  );
}
export function RepeatDraftContext({
  controller,
  form,
  shopId,
  locale,
}: {
  controller: DraftRecovery;
  form: UseFormReturn<QuickOrderDraft>;
  shopId: string;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = repeatOrderMessages[locale];
  const v = repeatOrderDraftSchema.parse(s.values),
    [source, setSource] = useState<Source>(),
    [failed, setFailed] = useState(false),
    [working, setWorking] = useState(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function refresh(accept = false) {
    setWorking(true);
    setFailed(false);
    try {
      const r = await readRepeatSource(shopId, v.repeat.sourceId);
      if (!alive.current) return;
      setSource(r);
      if (accept) {
        const current = repeatOrderDraftSchema.parse(
          controller.snapshot().values,
        );
        const next = {
          ...current,
          repeat: {
            ...current.repeat,
            sourceVersion: r.order.version,
            scopeDigest: r.scopeDigest,
          },
          commitmentReview: null,
        };
        form.reset(next);
        controller.edit(next);
      }
    } catch (e) {
      if (alive.current) {
        setSource(undefined);
        setFailed(true);
        if (e instanceof OrderRequestError && e.status === 404)
          controller.invalidate();
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: source identity is immutable for this draft instance
  useEffect(() => {
    void refresh();
  }, []);
  const changed =
    source &&
    (source.order.version !== v.repeat.sourceVersion ||
      source.scopeDigest !== v.repeat.scopeDigest);
  return (
    <section aria-label={t.source}>
      <h3>{t.newOrder}</h3>
      {source ? (
        <Context source={source} locale={locale} />
      ) : (
        <p>{t.loading}</p>
      )}
      {v.measurementReuse && (
        <p>
          {t.measurement}: {v.measurementReuse.selectedId.slice(-8)}.{" "}
          {t.measurementHelp}
        </p>
      )}
      {changed && <p role="alert">{t.changed}</p>}
      <Button
        type="button"
        variant="outline"
        disabled={
          working ||
          s.work.inFlight ||
          s.work.outcomeUnknown ||
          s.status === "conflict" ||
          s.status === "promoted"
        }
        onClick={() => void refresh(true)}
      >
        {t.refresh}
      </Button>
      {failed && <p role="alert">{t.sourceUnavailable}</p>}
      <p>{t.conversion}</p>
    </section>
  );
}
