/** biome-ignore-all lint/suspicious/noArrayIndexKey: Rows are fully controlled and hold no component-local data; draft ordering is preserved. */
import {
  previewShopCalendar,
  readShopCalendar,
  readShopCalendarHistory,
} from "@aarili/api/shop-calendar-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type CalendarDay,
  type CalendarDefinition,
  type CalendarDomain,
  type CalendarPreview,
  type CalendarRange,
  calendarDayErrors,
  calendarIntervals,
  emptyCalendarDay,
  emptyCalendarDefinition,
  localDateValid,
  type ShopCalendarDraft,
  type ShopCalendarRevision,
  type ShopCalendarState,
  shopCalendarCommandSchema,
  shopCalendarDraftSchema,
} from "@aarili/contracts/shop-calendar";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type T = ReturnType<typeof useTranslations<"calendar">>;
const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
function address(id?: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("draft", id);
  else url.searchParams.delete("draft");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
function Ranges({
  value,
  change,
  label,
  id,
  t,
  invalid,
  errorId,
  error,
}: {
  value: CalendarRange[];
  change: (v: CalendarRange[]) => void;
  label: string;
  id: string;
  t: T;
  invalid: boolean;
  errorId: string;
  error: string;
}) {
  return (
    <fieldset
      className="calendar-ranges"
      aria-describedby={invalid ? errorId : undefined}
    >
      <legend>{label}</legend>
      {invalid && (
        <p
          id={errorId}
          className="field-error"
          data-calendar-error
          tabIndex={-1}
        >
          {error}
        </p>
      )}
      {value.map((range, i) => (
        <div className="calendar-range" key={`${id}-${i}`}>
          <Field>
            <FieldLabel htmlFor={`${id}-${i}-start`}>
              {t("start", { number: i + 1 })}
            </FieldLabel>
            <Input
              id={`${id}-${i}-start`}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              inputMode="numeric"
              placeholder="HH:MM"
              maxLength={5}
              value={range.start}
              onChange={(e) =>
                change(
                  value.map((r, n) =>
                    n === i ? { ...r, start: e.target.value } : r,
                  ),
                )
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-${i}-end`}>
              {t("end", { number: i + 1 })}
            </FieldLabel>
            <Input
              id={`${id}-${i}-end`}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              inputMode="numeric"
              placeholder="HH:MM"
              maxLength={5}
              value={range.end}
              onChange={(e) =>
                change(
                  value.map((r, n) =>
                    n === i ? { ...r, end: e.target.value } : r,
                  ),
                )
              }
            />
          </Field>
          <Button
            type="button"
            variant="ghost"
            onClick={() => change(value.filter((_, n) => n !== i))}
          >
            {t("removeRange", { number: i + 1 })}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={value.length >= 32}
        onClick={() => change([...value, { start: "", end: "" }])}
      >
        {t("addRange")}
      </Button>
    </fieldset>
  );
}
function DayEditor({
  day,
  change,
  domain,
  id,
  title,
  t,
}: {
  day: CalendarDay;
  change: (v: CalendarDay) => void;
  domain: CalendarDomain;
  id: string;
  title: string;
  t: T;
}) {
  const errors = calendarDayErrors(day, domain);
  const errorId = `${id}-errors`;
  const invalidCollection = (key: "breaks" | "slots") =>
    (day[key].state === "defined") !== day[key].ranges.length > 0 ||
    calendarIntervals(day[key].ranges) === null ||
    errors.includes(key === "breaks" ? "breakOutside" : "slotOutside") ||
    (key === "slots" && errors.includes("productionSlots"));
  return (
    <fieldset
      className="calendar-day"
      aria-describedby={errors.length ? errorId : undefined}
    >
      <legend>{title}</legend>
      <Field>
        <FieldLabel htmlFor={`${id}-state`}>{t("dayState")}</FieldLabel>
        <select
          className="ui-input"
          id={`${id}-state`}
          aria-invalid={errors.includes("inactiveRanges")}
          aria-describedby={
            errors.includes("inactiveRanges") ? errorId : undefined
          }
          value={day.state}
          onChange={(e) =>
            change(
              e.target.value === "open"
                ? {
                    ...emptyCalendarDay(),
                    state: "open",
                    breaks: { state: "unconfigured", ranges: [] },
                    slots: {
                      state: domain === "customer" ? "unconfigured" : "none",
                      ranges: [],
                    },
                  }
                : emptyCalendarDay(
                    e.target.value === "closed" ? "closed" : "unconfigured",
                  ),
            )
          }
        >
          {(["unconfigured", "closed", "open"] as const).map((v) => (
            <option key={v} value={v}>
              {t(v)}
            </option>
          ))}
        </select>
      </Field>
      {day.state === "open" && (
        <>
          <Ranges
            id={`${id}-hours`}
            label={t("hours")}
            value={day.ranges}
            change={(ranges) => change({ ...day, ranges })}
            t={t}
            invalid={!calendarIntervals(day.ranges)?.length}
            errorId={`${id}-hours-error`}
            error={t("invalidRanges")}
          />
          {(
            [
              "breaks",
              ...(domain === "customer" ? ["slots" as const] : []),
            ] as const
          ).map((key) => (
            <div key={key}>
              <Field>
                <FieldLabel htmlFor={`${id}-${key}-state`}>{t(key)}</FieldLabel>
                <select
                  className="ui-input"
                  id={`${id}-${key}-state`}
                  aria-invalid={invalidCollection(key)}
                  aria-describedby={
                    invalidCollection(key)
                      ? day[key].state === "defined"
                        ? `${id}-${key}-error`
                        : errorId
                      : undefined
                  }
                  value={day[key].state}
                  onChange={(e) =>
                    change({
                      ...day,
                      [key]: { state: e.target.value, ranges: [] },
                    })
                  }
                >
                  {(["unconfigured", "none", "defined"] as const).map((v) => (
                    <option value={v} key={v}>
                      {t(v)}
                    </option>
                  ))}
                </select>
              </Field>
              {day[key].state === "defined" && (
                <Ranges
                  id={`${id}-${key}`}
                  label={t(key)}
                  value={day[key].ranges}
                  change={(ranges) =>
                    change({ ...day, [key]: { state: "defined", ranges } })
                  }
                  t={t}
                  invalid={invalidCollection(key)}
                  errorId={`${id}-${key}-error`}
                  error={t(
                    errors.includes(
                      key === "breaks" ? "breakOutside" : "slotOutside",
                    )
                      ? key === "breaks"
                        ? "breakOutside"
                        : "slotOutside"
                      : "invalidRanges",
                  )}
                />
              )}
            </div>
          ))}
        </>
      )}
      {errors.length > 0 && (
        <div id={errorId} data-calendar-error tabIndex={-1}>
          {errors.map((code) => (
            <p className="field-error" key={code}>
              {t(code as "invalidRanges")}
            </p>
          ))}
        </div>
      )}
    </fieldset>
  );
}
function DefinitionView({
  definition,
  t,
}: {
  definition: CalendarDefinition;
  t: T;
}) {
  const dayText = (day: CalendarDay) =>
    `${t(day.state)}${day.state === "open" ? ` · ${day.ranges.map((r) => `${r.start}–${r.end}`).join(", ")} · ${t("breaks")}: ${day.breaks.state === "defined" ? day.breaks.ranges.map((r) => `${r.start}–${r.end}`).join(", ") : t(day.breaks.state)} · ${t("slots")}: ${day.slots.state === "defined" ? day.slots.ranges.map((r) => `${r.start}–${r.end}`).join(", ") : t(day.slots.state)}` : ""}`;
  return (
    <dl className="shop-profile-values">
      {definition.week.map((day, i) => (
        <div key={weekdays[i]}>
          <dt>{t(weekdays[i] ?? "monday")}</dt>
          <dd>{dayText(day)}</dd>
        </div>
      ))}
      {definition.exceptions.map((e, i) => (
        <div key={`${e.date}-${i}`}>
          <dt>
            {e.date || t("invalidDate")} · {t("replacement")}
          </dt>
          <dd>{dayText(e.day)}</dd>
        </div>
      ))}
    </dl>
  );
}
function Preview({
  shopId,
  draft,
  t,
}: {
  shopId: string;
  draft: ShopCalendarDraft;
  t: T;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ date: string }>({ defaultValues: { date: "" } });
  const [result, setResult] = useState<{
    fingerprint: string;
    value: CalendarPreview;
  }>();
  const [failed, setFailed] = useState(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const fingerprint = JSON.stringify(draft);
  const time = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return (
    <section className="calendar-preview">
      <h4>{t("preview")}</h4>
      <form
        onSubmit={handleSubmit(async ({ date }) => {
          setFailed(false);
          try {
            const value = await previewShopCalendar(shopId, draft, date);
            if (alive.current) setResult({ fingerprint, value });
          } catch {
            if (alive.current) setFailed(true);
          }
        })}
      >
        <Field>
          <FieldLabel htmlFor="calendar-preview-date">
            {t("previewDate")}
          </FieldLabel>
          <Input
            id="calendar-preview-date"
            type="date"
            aria-invalid={!!errors.date}
            {...register("date", { validate: localDateValid })}
          />
        </Field>
        <Button
          type="submit"
          disabled={
            isSubmitting || !shopCalendarCommandSchema.safeParse(draft).success
          }
        >
          {t("previewAction")}
        </Button>
        {(failed || errors.date) && <p role="alert">{t("previewError")}</p>}
      </form>
      {result?.fingerprint === fingerprint && (
        <dl className="shop-profile-values">
          {result.value.days.map((day) => (
            <div key={day.date}>
              <dt>
                {day.date} ·{" "}
                {day.source
                  ? t(day.source === "week" ? "sourceWeek" : "sourceException")
                  : t("unknown")}
              </dt>
              <dd>
                {day.state === "unknown"
                  ? t("unknown")
                  : day.intervals.length
                    ? day.intervals
                        .map(([a, b]) => `${time(a)}–${time(b)}`)
                        .join(", ")
                    : t("noWorkingDay")}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
function Editor({
  shopId,
  controller,
  published,
  compare,
  rebase,
  t,
}: {
  shopId: string;
  controller: DraftRecovery;
  published: ShopCalendarState;
  compare: () => Promise<void>;
  rebase: (v: ShopCalendarDraft) => void;
  t: T;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [review, setReview] = useState(false),
    [compared, setCompared] = useState(false);
  const [comparisonFailed, setComparisonFailed] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const parsed = shopCalendarDraftSchema.safeParse(s.values);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("incompatible")}</p>;
  const v = parsed.data,
    def = v.definition;
  const edit = (definition: CalendarDefinition) => {
    setReview(false);
    controller.edit({ ...v, definition });
  };
  const validation = shopCalendarCommandSchema.safeParse(v);
  const valid = validation.success;
  const dateErrors = new Set<number>();
  if (!validation.success)
    for (const issue of validation.error.issues) {
      if (
        issue.path[0] === "definition" &&
        issue.path[1] === "exceptions" &&
        typeof issue.path[2] === "number" &&
        issue.path[3] === "date"
      )
        dateErrors.add(issue.path[2]);
    }
  const inactive = !!s.committed && s.committed.lifecycle !== "active";
  const busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  return (
    <section ref={editorRef} aria-label={t("editor")}>
      <h3>{t(v.domain)}</h3>
      <p>{t("rangeHelp")}</p>
      <p role="status" aria-live="polite">
        {t(s.status)}
        {s.error
          ? ` · ${t(s.error === "RATE_LIMITED" ? "rateLimited" : "saveError")}`
          : ""}
      </p>
      {inactive && (
        <div>
          <p>{t("readOnlyDraft")}</p>
          <Button
            onClick={() =>
              rebase({
                ...v,
                baseVersion: published.version,
                baseRevisionId: published.revision?.id ?? null,
              })
            }
          >
            {t("newDraft")}
          </Button>
        </div>
      )}
      {s.status === "checking" && (
        <Button onClick={() => void controller.retry()}>{t("retry")}</Button>
      )}
      {s.status === "conflict" && (
        <section className="shop-conflict" aria-label={t("conflict")}>
          <h4>{t("conflict")}</h4>
          <p>{t("conflictHelp")}</p>
          <Button
            disabled={s.work.inFlight}
            onClick={() => {
              setCompared(false);
              setComparisonFailed(false);
              void Promise.all([controller.refreshConflict(), compare()])
                .then(() => setCompared(true))
                .catch(() => setComparisonFailed(true));
            }}
          >
            {t("compare")}
          </Button>
          {comparisonFailed && <p role="alert">{t("loadError")}</p>}
          {compared && (
            <>
              <h4>{t("published")}</h4>
              <DefinitionView
                definition={
                  published.revision?.calendar[v.domain] ??
                  emptyCalendarDefinition()
                }
                t={t}
              />
              {s.conflict && (
                <>
                  <h4>{t("serverDraft")}</h4>
                  {shopCalendarDraftSchema.safeParse(s.conflict.payload)
                    .success && (
                    <DefinitionView
                      definition={
                        shopCalendarDraftSchema.parse(s.conflict.payload)
                          .definition
                      }
                      t={t}
                    />
                  )}
                </>
              )}
              <h4>{t("yourChanges")}</h4>
              <DefinitionView definition={def} t={t} />
              {s.conflict?.lifecycle === "active" &&
                published.version === v.baseVersion && (
                  <Button
                    onClick={() => {
                      controller.resolveConflict("local");
                      setCompared(false);
                    }}
                  >
                    {t("keepLocal")}
                  </Button>
                )}
              {s.conflict && (
                <Button
                  variant="outline"
                  onClick={() => {
                    controller.resolveConflict("server");
                    setCompared(false);
                  }}
                >
                  {t("useServer")}
                </Button>
              )}
              <Button
                onClick={() =>
                  rebase({
                    ...v,
                    baseVersion: published.version,
                    baseRevisionId: published.revision?.id ?? null,
                  })
                }
              >
                {t("rebase")}
              </Button>
            </>
          )}
        </section>
      )}
      <fieldset
        disabled={busy || s.status === "conflict"}
        className="calendar-editor"
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <legend>{t("weekly")}</legend>
        {def.week.map((day, i) => (
          <DayEditor
            key={weekdays[i]}
            id={`week-${i}`}
            title={t(weekdays[i] ?? "monday")}
            day={day}
            domain={v.domain}
            t={t}
            change={(next) =>
              edit({
                ...def,
                week: def.week.map((d, n) => (n === i ? next : d)),
              })
            }
          />
        ))}
        <h4>{t("exceptions")}</h4>
        <p>{t("exceptionHelp")}</p>
        {def.exceptions.map((e, i) => (
          <section key={`exception-${i}`} className="calendar-exception">
            <Field>
              <FieldLabel htmlFor={`exception-${i}-date`}>
                {t("date")}
              </FieldLabel>
              <Input
                id={`exception-${i}-date`}
                aria-invalid={dateErrors.has(i)}
                aria-describedby={
                  dateErrors.has(i) ? `exception-${i}-date-error` : undefined
                }
                type="date"
                value={e.date}
                onChange={(event) =>
                  edit({
                    ...def,
                    exceptions: def.exceptions.map((x, n) =>
                      n === i ? { ...x, date: event.target.value } : x,
                    ),
                  })
                }
              />
              {dateErrors.has(i) && (
                <p className="field-error" id={`exception-${i}-date-error`}>
                  {t("invalidDate")}
                </p>
              )}
            </Field>
            <DayEditor
              id={`exception-${i}`}
              title={t("replacement")}
              day={e.day}
              domain={v.domain}
              t={t}
              change={(day) =>
                edit({
                  ...def,
                  exceptions: def.exceptions.map((x, n) =>
                    n === i ? { ...x, day } : x,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              onClick={() =>
                edit({
                  ...def,
                  exceptions: def.exceptions.filter((_, n) => n !== i),
                })
              }
            >
              {t("removeException")}
            </Button>
          </section>
        ))}
        <Button
          variant="outline"
          disabled={def.exceptions.length >= 366}
          onClick={() =>
            edit({
              ...def,
              exceptions: [
                ...def.exceptions,
                { date: "", day: emptyCalendarDay("closed") },
              ],
            })
          }
        >
          {t("addException")}
        </Button>
      </fieldset>
      {!inactive && (
        <div className="calendar-actions">
          <Button
            variant="outline"
            disabled={busy || s.status === "conflict"}
            onClick={() => void controller.save()}
          >
            {t("saveDraft")}
          </Button>
          <Button
            disabled={!valid || s.status !== "saved" || s.work.dirty}
            onClick={() => setReview(true)}
          >
            {t("review")}
          </Button>
        </div>
      )}
      {!valid && (
        <div>
          <p role="status" data-calendar-error tabIndex={-1}>
            {t("validationHelp")}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              const target =
                editorRef.current?.querySelector<HTMLElement>(
                  'input[aria-invalid="true"],select[aria-invalid="true"]',
                ) ??
                editorRef.current?.querySelector<HTMLElement>(
                  "[data-calendar-error]",
                );
              target?.focus();
              target?.scrollIntoView({ block: "center" });
            }}
          >
            {t("firstError")}
          </Button>
        </div>
      )}
      <Preview shopId={shopId} draft={v} t={t} />
      {review && valid && s.status !== "conflict" && !inactive && (
        <section className="calendar-review" aria-label={t("review")}>
          <h4>{t("review")}</h4>
          <p>{t("publishHelp")}</p>
          <h5>{t("published")}</h5>
          <DefinitionView
            definition={
              published.revision?.calendar[v.domain] ??
              emptyCalendarDefinition()
            }
            t={t}
          />
          <h5>{t("yourChanges")}</h5>
          <DefinitionView definition={def} t={t} />
          <Button
            disabled={s.status !== "saved" || s.work.dirty}
            onClick={() => void controller.promote()}
          >
            {t("publish")}
          </Button>
          <Button variant="ghost" onClick={() => setReview(false)}>
            {t("back")}
          </Button>
        </section>
      )}
    </section>
  );
}

type Props = {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
};
export function ShopCalendarScreen({ shopId, queries, guard }: Props) {
  const t = useTranslations("calendar"),
    locale = useLocale();
  const [session, setSession] = useState<{
    scope: ReturnType<typeof createDraftScope>;
    alive: () => boolean;
  }>();
  const [state, setState] = useState<ShopCalendarState>();
  const [controller, setController] = useState<DraftRecovery>();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<DraftCursor | null>(null);
  const [history, setHistory] = useState<ShopCalendarRevision[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [initialFailed, setInitialFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retrying recreates the scope and repeats both initial reads while retaining the draft URL.
  useEffect(() => {
    setFailed(false);
    setInitialFailed(false);
    setState(undefined);
    setController(undefined);
    setDrafts([]);
    setHistory([]);
    setCursor(null);
    setNext(null);
    let mounted = true;
    const version = queries.version(),
      scope = createDraftScope(shopId, guard);
    const alive = () => mounted && queries.isCurrent(version);
    const current = { scope, alive };
    setSession(current);
    const load = async () => {
      try {
        const [published, list] = await Promise.all([
          readShopCalendar(shopId),
          scope.list(),
        ]);
        if (!alive()) return;
        setState(published);
        setDrafts(list.drafts);
        setCursor(list.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (
            record.workflow !== "shop.calendar" ||
            record.schemaVersion !== 1 ||
            !shopCalendarDraftSchema.safeParse(record.payload).success
          ) {
            setFailed(true);
            setInitialFailed(true);
            return;
          }
          setController(
            scope.open({
              workflow: "shop.calendar",
              schemaVersion: 1,
              initial: record.payload,
              record,
              committed: (r) => {
                if (alive() && r.lifecycle === "promoted") {
                  address();
                  void readShopCalendar(shopId).then((s) => {
                    if (alive()) setState(s);
                  });
                }
              },
            }),
          );
        }
      } catch {
        if (alive()) {
          setFailed(true);
          setInitialFailed(true);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
      scope.dispose();
    };
  }, [shopId, queries, guard, loadAttempt]);
  const attempt = async (run: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await run();
    } catch {
      if (session?.alive()) setFailed(true);
    } finally {
      if (session?.alive()) setBusy(false);
    }
  };
  const refresh = async () => {
    const fresh = await readShopCalendar(shopId);
    if (!session?.alive()) throw Error("Access ended");
    setState(fresh);
  };
  const open = (
    v: ShopCalendarDraft,
    record?: DraftRecord,
    preservingChanges = false,
  ) => {
    if (
      !session?.alive() ||
      (controller &&
        !preservingChanges &&
        !controller.confirmLeave(() => window.confirm(t("discard"))))
    )
      return;
    if (controller) session.scope.release(controller);
    const active = session.scope.open({
      workflow: "shop.calendar",
      schemaVersion: 1,
      initial: v,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!session.alive()) return;
        if (r.lifecycle === "active") address(r.id);
        if (r.lifecycle === "promoted") {
          address();
          void attempt(refresh);
        }
      },
    });
    setController(active);
    if (!record) {
      address();
      active.edit(v);
    } else address(record.id);
  };
  if (!state || !session)
    return (
      <div>
        <p role="status">{t(failed ? "loadError" : "loading")}</p>
        {initialFailed && (
          <Button onClick={() => setLoadAttempt((n) => n + 1)}>
            {t("retryLoad")}
          </Button>
        )}
      </div>
    );
  return (
    <section className="shop-settings-main" aria-label={t("title")}>
      <h2>{t("title")}</h2>
      <p>{t("intro")}</p>
      <p>{t("timezone")}</p>
      {failed && <p role="alert">{t("loadError")}</p>}
      {initialFailed && (
        <Button onClick={() => setLoadAttempt((n) => n + 1)}>
          {t("retryLoad")}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void attempt(refresh)}
      >
        {t("refresh")}
      </Button>
      <p>
        {state.revision
          ? t("version", { version: state.version })
          : t("unconfigured")}
      </p>
      <div className="calendar-actions">
        {(["customer", "production"] as const).map((domain) => (
          <Button
            key={domain}
            variant="outline"
            disabled={busy}
            onClick={() =>
              open({
                domain,
                baseVersion: state.version,
                baseRevisionId: state.revision?.id ?? null,
                definition:
                  state.revision?.calendar[domain] ?? emptyCalendarDefinition(),
              })
            }
          >
            {t(domain)}
          </Button>
        ))}
      </div>
      {controller && (
        <Editor
          shopId={shopId}
          key={controller.instance}
          controller={controller}
          published={state}
          compare={refresh}
          rebase={(v) => open(v, undefined, true)}
          t={t}
        />
      )}
      {!controller &&
        (["customer", "production"] as const).map((domain) => (
          <details key={domain}>
            <summary>{t(domain)}</summary>
            <DefinitionView
              definition={
                state.revision?.calendar[domain] ?? emptyCalendarDefinition()
              }
              t={t}
            />
          </details>
        ))}
      <section className="shop-profile-history">
        <h3>{t("resume")}</h3>
        {drafts
          .filter(
            (d) => d.workflow === "shop.calendar" && d.lifecycle === "active",
          )
          .map((d) => (
            <Button
              key={d.id}
              variant="outline"
              disabled={busy}
              onClick={() => {
                const parsed = shopCalendarDraftSchema.safeParse(d.payload);
                if (d.schemaVersion !== 1 || !parsed.success) {
                  setFailed(true);
                  return;
                }
                open(parsed.data, d);
              }}
            >
              {t("draft")} ·{" "}
              {new Date(d.updatedAt).toLocaleString(
                locale === "ta" ? "ta-IN" : "en-IN",
                { timeZone: "Asia/Kolkata" },
              )}
            </Button>
          ))}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              const list = await session.scope.list();
              if (session.alive()) {
                setDrafts(list.drafts);
                setCursor(list.next);
              }
            })
          }
        >
          {t("refreshDrafts")}
        </Button>
        {cursor && (
          <Button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const list = await session.scope.list(cursor);
                if (session.alive()) {
                  setDrafts((d) => [...d, ...list.drafts]);
                  setCursor(list.next);
                }
              })
            }
          >
            {t("more")}
          </Button>
        )}
      </section>
      <section className="shop-profile-history">
        <h3>{t("history")}</h3>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void attempt(async () => {
              const h = await readShopCalendarHistory(shopId);
              if (session.alive()) {
                setHistory(h.revisions);
                setNext(h.next);
              }
            })
          }
        >
          {t("loadHistory")}
        </Button>
        {history.map((r) => (
          <details key={r.id}>
            <summary>
              {t("version", { version: r.version })} ·{" "}
              {new Date(r.effectiveAt).toLocaleString(
                locale === "ta" ? "ta-IN" : "en-IN",
                { timeZone: "Asia/Kolkata" },
              )}
            </summary>
            <p className="shop-actor">
              {t("author")}: {r.actorId}
            </p>
            {(["customer", "production"] as const).map((domain) => (
              <section key={domain}>
                <h4>{t(domain)}</h4>
                <DefinitionView definition={r.calendar[domain]} t={t} />
              </section>
            ))}
          </details>
        ))}
        {next && (
          <Button
            disabled={busy}
            onClick={() =>
              void attempt(async () => {
                const h = await readShopCalendarHistory(shopId, next);
                if (session.alive()) {
                  setHistory((rows) => [...rows, ...h.revisions]);
                  setNext(h.next);
                }
              })
            }
          >
            {t("more")}
          </Button>
        )}
      </section>
    </section>
  );
}
