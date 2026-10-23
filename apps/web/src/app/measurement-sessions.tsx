import { OwnerRequestError, onOwnerInvalidation } from "@aarili/api/client";
import {
  readMeasurementFormDefinition,
  readMeasurementForms,
} from "@aarili/api/measurement-forms-client";
import {
  readMeasurement,
  readMeasurements,
  readMeasurementTarget,
  readMeasurementUse,
  reviewMeasurementSelection,
} from "@aarili/api/measurement-sessions-client";
import { readOrderPieces } from "@aarili/api/orders-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import type { MeasurementFormRevision } from "@aarili/contracts/measurement-forms";
import {
  type MeasurementSessionDraft,
  type MeasurementUse,
  type MeasurementUseDraft,
  type MeasurementVersion,
  measurementSessionCommandSchema,
  measurementSessionDraftSchema,
  measurementUseCommandSchema,
  measurementUseDraftSchema,
} from "@aarili/contracts/measurement-sessions";
import {
  convertLength,
  displayExactLength,
  exactDecimal,
  matchesIncrement,
  parseLength,
} from "@aarili/contracts/measurement-values";
import type { AcceptedOrder, OrderPieces } from "@aarili/contracts/orders";
import { repeatMeasurementReferenceSchema } from "@aarili/contracts/orders";
import { type Locale, measurementSessionMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import { MeasurementFitImages } from "./measurement-fit";
import type { OwnerGuard } from "./owner-feedback";

type T = (typeof measurementSessionMessages)[Locale];
type Definition = MeasurementFormRevision["definition"];
type ReuseReview = Awaited<ReturnType<typeof reviewMeasurementSelection>>;
const unknown = (): MeasurementSessionDraft["source"] => ({
  kind: "unknown",
  date: "",
  measurer: "",
  method: "",
});
const label = (v: { labelEn: string; labelTa: string }, locale: Locale) =>
  locale === "ta" ? v.labelTa : v.labelEn;
const sourceLabel = (kind: MeasurementSessionDraft["source"]["kind"], t: T) =>
  ({
    unknown: t.unknown,
    body: t.body,
    "sample-garment": t.sample,
    "customer-provided": t.provided,
    other: t.other,
    mixed: t.mixed,
  })[kind];
function SourceFields({
  source,
  change,
  prefix,
  t,
  mixed = true,
  observationLocked = false,
}: {
  source: MeasurementSessionDraft["source"];
  change: (v: MeasurementSessionDraft["source"]) => void;
  prefix: string;
  t: T;
  mixed?: boolean;
  observationLocked?: boolean;
}) {
  return (
    <fieldset className="owner-form">
      <legend>{t.source}</legend>
      <Field>
        <FieldLabel htmlFor={`${prefix}-kind`}>{t.source}</FieldLabel>
        <select
          id={`${prefix}-kind`}
          value={source.kind}
          disabled={observationLocked}
          onChange={(e) =>
            change({ ...source, kind: e.target.value as typeof source.kind })
          }
        >
          {(
            [
              ["unknown", t.unknown],
              ["body", t.body],
              ["sample-garment", t.sample],
              ["customer-provided", t.provided],
              ["other", t.other],
              ...(mixed ? [["mixed", t.mixed]] : []),
            ] as const
          ).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-date`}>
          {source.kind === "mixed" ? t.compiledDate : t.date}
        </FieldLabel>
        <Input
          id={`${prefix}-date`}
          type="date"
          value={source.date}
          readOnly={observationLocked}
          onChange={(e) => change({ ...source, date: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-measurer`}>
          {source.kind === "mixed" ? t.compiledBy : t.measurer}
        </FieldLabel>
        <Input
          id={`${prefix}-measurer`}
          maxLength={160}
          value={source.measurer}
          onChange={(e) => change({ ...source, measurer: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-method`}>{t.method}</FieldLabel>
        <textarea
          id={`${prefix}-method`}
          maxLength={1000}
          value={source.method}
          onChange={(e) => change({ ...source, method: e.target.value })}
        />
      </Field>
    </fieldset>
  );
}
function ValidationPolicy({
  policy,
  definition,
  locale,
}: {
  policy: MeasurementUseDraft["policy"] | undefined;
  definition: Definition | undefined;
  locale: Locale;
}) {
  const t = measurementSessionMessages[locale],
    fields = definition?.content.groups.flatMap((g) => g.fields) ?? [],
    name = (id: string) => {
      const f = fields.find((f) => f.id === id);
      return f ? label(f, locale) : t.unknown;
    };
  return (
    <details>
      <summary>{t.validation}</summary>
      {!policy ? (
        <p>{t.noApproval}</p>
      ) : (
        <>
          <p>{policy.validation.review}</p>
          {policy.validation.mode === "not-configured" ? (
            <p>{t.none}</p>
          ) : (
            <ul>
              {policy.validation.rules.map((r, i) => (
                <li key={String(i)}>
                  {name(r.fieldId)} ·{" "}
                  {r.kind === "minimum"
                    ? t.minimum
                    : r.kind === "maximum"
                      ? t.maximum
                      : t.comparison}{" "}
                  {r.kind === "field-lte"
                    ? `≤ ${name(r.otherFieldId)}`
                    : `${r.value} ${r.unit}`}{" "}
                  ·{" "}
                  {r.severity === "warning" &&
                  policy.validation.mode === "rules" &&
                  policy.validation.allowWarningReason
                    ? t.warningRule
                    : t.errorRule}
                  <p>{r.review}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </details>
  );
}
function MeasurementEditor({
  approval,
  onDenied,
  controller,
  definition,
  locale,
  guard,
  previous,
}: {
  controller: DraftRecovery;
  definition?: Definition;
  approval?: MeasurementUse;
  onDenied: () => void;
  locale: Locale;
  guard: OwnerGuard;
  previous?: MeasurementVersion;
}) {
  const t = measurementSessionMessages[locale],
    state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    parsed = measurementSessionDraftSchema.safeParse(state.values),
    [displayUnit, setDisplayUnit] = useState<"in" | "cm">("in");
  useEffect(() => {
    if (state.error === "NOT_FOUND" || state.status === "denied") onDenied();
  }, [state.error, state.status, onDenied]);
  if (!parsed.success) return null;
  const selecting = parsed.data.operation === "select",
    fields = definition?.content.groups.flatMap((g) => g.fields) ?? [];
  return (
    <div className="directory-editor">
      <h3>{t.draft}</h3>
      <p>{t.saveHint}</p>
      {state.error === "VERSION_STALE" && <p role="alert">{t.conflictHelp}</p>}
      {!selecting && (
        <ValidationPolicy
          policy={approval?.policy}
          definition={definition}
          locale={locale}
        />
      )}
      <DraftForm<MeasurementSessionDraft>
        controller={controller}
        schema={measurementSessionDraftSchema}
        locale={locale}
        guard={guard}
        canPromote={
          measurementSessionCommandSchema.safeParse(state.values).success
        }
        promotionLabel={selecting ? t.select : t.save}
      >
        {(form) => {
          const v = form.watch(),
            change = (patch: Partial<MeasurementSessionDraft>) =>
              form.reset({ ...form.getValues(), ...patch, reviewed: false }),
            setValue = (
              i: number,
              patch: Partial<MeasurementSessionDraft["values"][number]>,
            ) =>
              change({
                values: v.values.map((a, j) =>
                  i === j ? { ...a, ...patch } : a,
                ),
              });
          return (
            <div className="owner-form">
              {previous && !selecting && (
                <section aria-label={t.compare}>
                  <h4>{t.compare}</h4>
                  <p>{t.correctionHelp}</p>
                  <dl>
                    {fields.map((field) => {
                      const old = previous.values.find(
                          (a) => a.fieldId === field.id,
                        ),
                        next = v.values.find((a) => a.fieldId === field.id);
                      return (
                        <div key={field.id}>
                          <dt>{label(field, locale)}</dt>
                          <dd>
                            {t.previous}: {old?.rawText || t.missing}{" "}
                            {old?.unit}
                          </dd>
                          <dd>
                            {t.proposed}: {next?.rawText || t.missing}{" "}
                            {next?.unit}{" "}
                            {old?.rawText === next?.rawText &&
                            old?.unit === next?.unit
                              ? `· ${t.unchanged}`
                              : ""}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              )}
              {!selecting && (
                <>
                  <SourceFields
                    source={v.source}
                    change={(source) => change({ source })}
                    prefix="measurement-session"
                    t={t}
                    observationLocked={!!v.correctionId}
                  />
                  <Field>
                    <FieldLabel htmlFor="measurement-display-unit">
                      {t.display}
                    </FieldLabel>
                    <select
                      id="measurement-display-unit"
                      value={displayUnit}
                      onChange={(e) =>
                        setDisplayUnit(e.target.value as "in" | "cm")
                      }
                    >
                      <option value="in">in</option>
                      <option value="cm">cm</option>
                    </select>
                  </Field>
                  {fields.map((field, i) => {
                    const a = v.values[i];
                    if (!a) return null;
                    const n = parseLength(a.rawText),
                      prefix = `measurement-${field.id}`;
                    const increment = field.precision
                      ? parseLength(field.precision.increment)
                      : null;
                    const invalid =
                      !!a.rawText.trim() &&
                      (!n ||
                        !a.unit ||
                        exactDecimal(n) === null ||
                        !field.precision?.unit ||
                        !increment ||
                        !matchesIncrement(
                          convertLength(n, a.unit, field.precision.unit),
                          increment,
                        ) ||
                        (n.numerator === "0" &&
                          !approval?.policy.fields.find(
                            (f) => f.fieldId === field.id,
                          )?.allowZero));
                    return (
                      <fieldset key={field.id} className="owner-form">
                        <legend>
                          {label(field, locale)} ·{" "}
                          {field.required ? t.required : t.optional}
                        </legend>
                        <p>{locale === "ta" ? field.hintTa : field.hintEn}</p>
                        <Field>
                          <FieldLabel htmlFor={`${prefix}-raw`}>
                            {label(field, locale)} — {t.original}
                          </FieldLabel>
                          <Input
                            id={`${prefix}-raw`}
                            type="text"
                            inputMode="text"
                            maxLength={80}
                            aria-invalid={invalid}
                            aria-describedby={
                              invalid ? `${prefix}-problem` : undefined
                            }
                            value={a.rawText}
                            onChange={(e) =>
                              setValue(i, { rawText: e.target.value })
                            }
                          />
                        </Field>
                        {invalid && (
                          <p id={`${prefix}-problem`} role="alert">
                            {t.invalidEntry}
                          </p>
                        )}
                        <Field>
                          <FieldLabel htmlFor={`${prefix}-unit`}>
                            {t.unit}
                          </FieldLabel>
                          <select
                            id={`${prefix}-unit`}
                            value={a.unit ?? ""}
                            onChange={(e) =>
                              setValue(i, {
                                unit: (e.target.value || null) as typeof a.unit,
                              })
                            }
                          >
                            <option value="">{t.choose}</option>
                            {field.units.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <p>
                          {t.precision}: {field.precision?.increment}{" "}
                          {field.precision?.unit}
                        </p>
                        <output aria-live="polite">
                          {n && a.unit
                            ? `${t.exact}: ${displayExactLength(convertLength(n, a.unit, displayUnit))} ${displayUnit}`
                            : t.missing}
                        </output>
                        <label>
                          <input
                            type="checkbox"
                            checked={a.source !== null}
                            onChange={(e) =>
                              setValue(i, {
                                source: e.target.checked ? unknown() : null,
                              })
                            }
                          />
                          {t.perField}
                        </label>
                        {a.source && (
                          <SourceFields
                            source={a.source}
                            change={(source) => setValue(i, { source })}
                            prefix={`${prefix}-source`}
                            t={t}
                            mixed={false}
                          />
                        )}
                        {approval?.policy.validation.mode === "rules" &&
                          approval.policy.validation.allowWarningReason &&
                          approval.policy.validation.rules.some(
                            (r) =>
                              r.fieldId === field.id &&
                              r.severity === "warning",
                          ) && (
                            <Field>
                              <FieldLabel htmlFor={`${prefix}-warning`}>
                                {t.warning}
                              </FieldLabel>
                              <textarea
                                id={`${prefix}-warning`}
                                maxLength={1000}
                                value={a.warningReason}
                                onChange={(e) =>
                                  setValue(i, { warningReason: e.target.value })
                                }
                              />
                            </Field>
                          )}
                      </fieldset>
                    );
                  })}
                  <Field>
                    <FieldLabel htmlFor="measurement-notes">
                      {t.notes}
                    </FieldLabel>
                    <textarea
                      id="measurement-notes"
                      maxLength={2000}
                      value={v.fitNotes}
                      onChange={(e) => change({ fitNotes: e.target.value })}
                    />
                  </Field>
                </>
              )}
              <Field>
                <FieldLabel htmlFor="measurement-reason">{t.reason}</FieldLabel>
                <textarea
                  id="measurement-reason"
                  maxLength={1000}
                  value={v.reason}
                  onChange={(e) => change({ reason: e.target.value })}
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={v.reviewed}
                  onChange={(e) =>
                    form.setValue("reviewed", e.target.checked, {
                      shouldDirty: true,
                    })
                  }
                />
                {t.review}
              </label>
            </div>
          );
        }}
      </DraftForm>
    </div>
  );
}
function ApprovalEditor({
  controller,
  definition,
  locale,
  guard,
}: {
  controller: DraftRecovery;
  definition: Definition;
  locale: Locale;
  guard: OwnerGuard;
}) {
  const t = measurementSessionMessages[locale],
    state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    );
  return (
    <div className="directory-editor">
      <h3>{t.useTitle}</h3>
      <p>{t.useHelp}</p>
      <DraftForm<MeasurementUseDraft>
        controller={controller}
        schema={measurementUseDraftSchema}
        locale={locale}
        guard={guard}
        canPromote={measurementUseCommandSchema.safeParse(state.values).success}
        promotionLabel={
          state.values.operation === "withdraw" ? t.withdraw : t.approve
        }
      >
        {(form) => {
          const v = form.watch();
          return (
            <div className="owner-form">
              {definition.content.groups
                .flatMap((g) => g.fields)
                .map((field, i) => (
                  <fieldset key={field.id}>
                    <legend>
                      {label(field, locale)} ·{" "}
                      {field.required ? t.required : t.optional}
                    </legend>
                    <p>{field.meaning}</p>
                    <p>
                      {t.precision}: {field.precision?.increment}{" "}
                      {field.precision?.unit} · {field.precision?.review}
                    </p>
                    <Field>
                      <FieldLabel htmlFor={`measurement-zero-${field.id}`}>
                        {t.zero}
                      </FieldLabel>
                      <select
                        id={`measurement-zero-${field.id}`}
                        value={
                          v.policy.fields[i]?.allowZero === null
                            ? ""
                            : String(v.policy.fields[i]?.allowZero)
                        }
                        onChange={(e) => {
                          form.setValue(
                            `policy.fields.${i}.allowZero`,
                            e.target.value === ""
                              ? null
                              : e.target.value === "true",
                            { shouldDirty: true },
                          );
                          form.setValue("reviewed", false);
                        }}
                      >
                        <option value="">{t.choose}</option>
                        <option value="false">{t.no}</option>
                        <option value="true">{t.yes}</option>
                      </select>
                    </Field>
                  </fieldset>
                ))}
              <ValidationPolicy
                policy={v.policy}
                definition={definition}
                locale={locale}
              />
              <p>
                {t.validation}:{" "}
                {v.policy.validation.mode === "not-configured"
                  ? t.none
                  : v.policy.validation.review}
              </p>
              <Field>
                <FieldLabel htmlFor="measurement-policy-review">
                  {t.policyReview}
                </FieldLabel>
                <textarea
                  id="measurement-policy-review"
                  maxLength={1000}
                  value={v.policy.validation.review}
                  onChange={(e) => {
                    form.setValue("policy.validation.review", e.target.value, {
                      shouldDirty: true,
                    });
                    form.setValue("reviewed", false);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="measurement-use-reason">
                  {t.reason}
                </FieldLabel>
                <textarea
                  id="measurement-use-reason"
                  maxLength={1000}
                  {...form.register("reason")}
                />
              </Field>
              <label>
                <input type="checkbox" {...form.register("reviewed")} />
                {t.useReview}
              </label>
            </div>
          );
        }}
      </DraftForm>
    </div>
  );
}
export function SavedMeasurement({
  v,
  locale,
  prefix = "history",
}: {
  v: MeasurementVersion;
  locale: Locale;
  prefix?: string;
}) {
  const t = measurementSessionMessages[locale],
    [unit, setUnit] = useState<"in" | "cm">("in");
  return (
    <>
      <dl>
        <dt>{t.lineage}</dt>
        <dd>{v.sessionId.slice(-8)}</dd>
        <dt>{t.form}</dt>
        <dd>{label(v.form.content, locale)}</dd>
        <dt>{t.version}</dt>
        <dd>
          {v.version} · {v.id.slice(-8)}
        </dd>
        <dt>{v.source.kind === "mixed" ? t.compiledDate : t.date}</dt>
        <dd>{v.source.date}</dd>
        <dt>{t.source}</dt>
        <dd>{sourceLabel(v.source.kind, t)}</dd>
        <dt>{v.source.kind === "mixed" ? t.compiledBy : t.measurer}</dt>
        <dd>{v.source.measurer}</dd>
        <dt>{t.method}</dt>
        <dd>{v.source.method}</dd>
        <dt>{t.recorded}</dt>
        <dd>{v.recordedAt}</dd>
        <dt>{t.actor}</dt>
        <dd>{v.actorId.slice(-8)}</dd>
      </dl>
      <Field>
        <FieldLabel htmlFor={`measurement-saved-display-${prefix}-${v.id}`}>
          {t.display}
        </FieldLabel>
        <select
          id={`measurement-saved-display-${prefix}-${v.id}`}
          value={unit}
          onChange={(e) => setUnit(e.target.value as "in" | "cm")}
        >
          <option value="in">in</option>
          <option value="cm">cm</option>
        </select>
      </Field>
      <dl>
        {v.form.content.groups
          .flatMap((g) => g.fields)
          .map((field) => {
            const a = v.values.find((a) => a.fieldId === field.id);
            return (
              <div key={field.id}>
                <dt>{label(field, locale)}</dt>
                <dd>
                  {a?.exact && a.unit ? (
                    <>
                      {a.rawText} {a.unit} · {t.exact}:{" "}
                      {displayExactLength(convertLength(a.exact, a.unit, unit))}{" "}
                      {unit}
                      {a.source && (
                        <p>
                          {a.source.kind} · {a.source.date} ·{" "}
                          {a.source.measurer} · {a.source.method}
                        </p>
                      )}
                    </>
                  ) : (
                    t.missing
                  )}
                </dd>
              </div>
            );
          })}
      </dl>
      <p>{v.fitNotes}</p>
      <p>{v.reason}</p>
    </>
  );
}
export function MeasurementSessions({
  shopId,
  customerId,
  wearerId,
  locale,
  guard,
  order,
}: {
  shopId: string;
  customerId: string;
  wearerId: string;
  locale: Locale;
  guard: OwnerGuard;
  order?: AcceptedOrder;
}) {
  const t = measurementSessionMessages[locale],
    [opened, setOpened] = useState(false),
    [forms, setForms] = useState<Definition[]>([]),
    [formId, setFormId] = useState(""),
    [approval, setApproval] = useState<MeasurementUse>(),
    [draftUse, setDraftUse] = useState<MeasurementUse>(),
    [versions, setVersions] = useState<MeasurementVersion[]>([]),
    [usedIds, setUsedIds] = useState<string[]>([]),
    [next, setNext] = useState<string | null>(null),
    [pieces, setPieces] = useState<OrderPieces>(),
    [pieceId, setPieceId] = useState<string | null>(null),
    [selection, setSelection] =
      useState<Awaited<ReturnType<typeof readMeasurementTarget>>>(),
    [selectedVersion, setSelectedVersion] = useState<MeasurementVersion>(),
    [candidate, setCandidate] = useState<MeasurementVersion>(),
    [reuseReview, setReuseReview] = useState<ReuseReview>(),
    [impact, setImpact] = useState<{
      physical: "unknown" | "not-started";
      commercial: "unknown" | "none";
    }>({ physical: "unknown", commercial: "unknown" }),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [controller, setController] = useState<DraftRecovery>(),
    [definition, setDefinition] = useState<Definition>(),
    [workflow, setWorkflow] = useState("measurement.session"),
    [failed, setFailed] = useState(false),
    [denied, setDenied] = useState(false),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const scope = useRef<ReturnType<typeof createDraftScope> | undefined>(
      undefined,
    ),
    active = useRef(true),
    generation = useRef(0),
    current = useRef<DraftRecovery | undefined>(undefined);
  const clearPrivate = useCallback(() => {
    generation.current++;
    setBusy(false);
    current.current?.invalidate();
    setController(undefined);
    setVersions([]);
    setUsedIds([]);
    setDrafts([]);
    setSelection(undefined);
    setSelectedVersion(undefined);
    setCandidate(undefined);
    setReuseReview(undefined);
    setImpact({ physical: "unknown", commercial: "unknown" });
    setDefinition(undefined);
    setDraftUse(undefined);
  }, []);
  const endAccess = useCallback(() => {
    clearPrivate();
    setDenied(true);
    setFailed(true);
  }, [clearPrivate]);
  function error(e: unknown) {
    setFailed(true);
    if (
      e instanceof OwnerRequestError &&
      ["NOT_FOUND", "UNAUTHENTICATED", "SHOP_ACCESS_DENIED"].includes(e.code)
    ) {
      clearPrivate();
      setDenied(true);
    }
  }
  async function load() {
    const gen = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const rows = await readMeasurements(shopId, { customerId, wearerId }),
        fs: Definition[] = [],
        ds: DraftRecord[] = [];
      let before: string | undefined;
      do {
        const page = await readMeasurementForms(shopId, before);
        fs.push(
          ...page.entries
            .filter(
              (f) =>
                f.configurationEligible &&
                f.definition.content.decision === "required",
            )
            .map((f) => f.definition),
        );
        before = page.next ?? undefined;
      } while (before);
      let cursor: DraftCursor | undefined;
      do {
        const page = await scope.current?.list(cursor);
        if (!page) return;
        ds.push(...page.drafts);
        cursor = page.next ?? undefined;
      } while (cursor);
      const ps = order ? await readOrderPieces(shopId, order.id) : undefined;
      if (!active.current || gen !== generation.current) return;
      setRefresh((n) => n + 1);
      setVersions(rows.versions);
      setUsedIds(rows.usedIds);
      setNext(rows.next);
      setForms(fs);
      setPieces(ps);
      setDrafts(
        ds.filter(
          (d) =>
            d.workflow === "measurement.session" &&
            d.payload.customerId === customerId &&
            d.payload.wearerId === wearerId,
        ),
      );
      setDenied(false);
    } catch (e) {
      if (active.current && gen === generation.current) error(e);
    } finally {
      if (active.current && gen === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    active.current = true;
    scope.current = createDraftScope(shopId, guard);
    const stop = onOwnerInvalidation(() => {
      active.current = false;
      generation.current++;
      clearPrivate();
      setDenied(true);
    });
    return () => {
      active.current = false;
      generation.current++;
      stop();
      scope.current?.dispose();
    };
  }, [shopId, guard, clearPrivate]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is established before first load; opening is explicit
  useEffect(() => {
    if (opened) void load();
  }, [opened, shopId, customerId, wearerId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh invalidates the exact scope after a committed save or selection
  useEffect(() => {
    let live = true;
    const gen = generation.current;
    setSelection(undefined);
    setSelectedVersion(undefined);
    if (opened && order)
      void (async () => {
        try {
          const target = await readMeasurementTarget(shopId, {
            orderId: order.id,
            pieceId,
          });
          const selected = target.selectedId
            ? await readMeasurement(shopId, target.selectedId)
            : undefined;
          if (live && active.current && gen === generation.current) {
            setSelection(target);
            setSelectedVersion(selected);
          }
        } catch (e) {
          if (
            live &&
            active.current &&
            gen === generation.current &&
            e instanceof OwnerRequestError &&
            ["NOT_FOUND", "UNAUTHENTICATED", "SHOP_ACCESS_DENIED"].includes(
              e.code,
            )
          )
            endAccess();
        }
      })();
    return () => {
      live = false;
    };
  }, [opened, shopId, order, pieceId, refresh, endAccess]);
  useEffect(() => {
    let live = true;
    setApproval(undefined);
    const f = forms.find((f) => f.id === formId);
    if (f)
      void readMeasurementUse(shopId, {
        form: { entryId: f.entryId, revisionId: f.id },
      }).then(
        (r) => {
          if (live) setApproval(r.approval ?? undefined);
        },
        () => {},
      );
    return () => {
      live = false;
    };
  }, [shopId, formId, forms]);
  function open(
    payload: MeasurementSessionDraft | MeasurementUseDraft,
    f: Definition | undefined,
    record?: DraftRecord,
    w = "measurement.session",
    use = approval,
  ) {
    if (current.current) {
      const work = current.current.snapshot().work;
      if (work.dirty || work.inFlight || work.outcomeUnknown) return;
      scope.current?.release(current.current);
    }
    const c = scope.current?.open({
      workflow: w,
      schemaVersion: 1,
      editableTargetConflict: w === "measurement.session",
      initial: payload,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (r.lifecycle === "promoted") {
          void load();
          setFormId("");
        }
      },
    });
    if (c) {
      current.current = c;
      setController(c);
      setDefinition(f);
      setDraftUse(use);
      setWorkflow(w);
    }
  }
  function close() {
    const c = current.current;
    if (!c) return;
    const work = c.snapshot().work;
    if (work.dirty || work.inFlight || work.outcomeUnknown) return;
    scope.current?.release(c);
    current.current = undefined;
    setController(undefined);
    setDefinition(undefined);
    setCandidate(undefined);
    setReuseReview(undefined);
  }
  async function correct(v: MeasurementVersion) {
    const gen = generation.current;
    setBusy(true);
    try {
      const use = (
        await readMeasurementUse(shopId, {
          form: { entryId: v.form.entryId, revisionId: v.form.id },
        })
      ).approval;
      if (use?.operation !== "approve")
        throw new OwnerRequestError("REQUEST_CONFLICT");
      if (!active.current || gen !== generation.current) return;
      setCandidate(v);
      open(
        {
          operation: "save",
          customerId,
          wearerId,
          form: { entryId: v.form.entryId, revisionId: v.form.id },
          approvalId: use.id,
          source: { ...v.source },
          values: v.values.map(({ numeric: _n, exact: _e, ...a }) => ({
            ...a,
          })),
          fitNotes: v.fitNotes,
          selectedId: null,
          target: null,
          baseVersion: 0,
          reviewed: false,
          reason: "",
          erased: false,
          correctionId: v.id,
        },
        v.form,
        undefined,
        "measurement.session",
        use,
      );
    } catch (e) {
      if (active.current && gen === generation.current) error(e);
    } finally {
      if (active.current && gen === generation.current) setBusy(false);
    }
  }
  async function inspectReuse(v: MeasurementVersion) {
    if (!selection) return;
    const gen = generation.current;
    setBusy(true);
    setReuseReview(undefined);
    try {
      const r = await reviewMeasurementSelection(shopId, {
        selectedId: v.id,
        target: { orderId: selection.orderId, pieceId: selection.pieceId },
        impact,
      });
      if (active.current && gen === generation.current) {
        setCandidate(r.version);
        setReuseReview(r);
      }
    } catch (e) {
      if (active.current && gen === generation.current) error(e);
    } finally {
      if (active.current && gen === generation.current) setBusy(false);
    }
  }
  function selectReviewed() {
    if (!reuseReview || reuseReview.blocked.length) return;
    const r = reuseReview;
    open(
      {
        operation: "select",
        customerId,
        wearerId,
        form: null,
        approvalId: null,
        source: unknown(),
        values: [],
        fitNotes: "",
        selectedId: r.version.id,
        target: { orderId: r.target.orderId, pieceId: r.target.pieceId },
        baseVersion: r.target.version,
        reviewed: false,
        reason: "",
        erased: false,
        reuseReview: { digest: r.digest, impact },
      },
      undefined,
    );
  }
  const form = forms.find((f) => f.id === formId),
    eligibleForms = selection?.form
      ? forms.filter((f) => f.id === selection.form?.revisionId)
      : forms;
  const repeatReference = repeatMeasurementReferenceSchema.safeParse(
    order?.snapshot.measurementReuse,
  );
  const currentHead = candidate
    ? versions.find(
        (v) =>
          v.sessionId === candidate.sessionId &&
          v.id === v.headId &&
          v.id !== candidate.id,
      )
    : undefined;
  function start() {
    if (!form || approval?.operation !== "approve") return;
    open(
      {
        operation: "save",
        customerId,
        wearerId,
        form: { entryId: form.entryId, revisionId: form.id },
        approvalId: approval.id,
        source: unknown(),
        values: form.content.groups
          .flatMap((g) => g.fields)
          .map((f) => ({
            fieldId: f.id,
            rawText: "",
            unit: null,
            source: null,
            warningReason: "",
          })),
        fitNotes: "",
        selectedId: null,
        target: null,
        baseVersion: 0,
        reviewed: false,
        reason: "",
        erased: false,
      },
      form,
    );
  }
  function reviewForm(withdraw = false) {
    if (!form) return;
    open(
      {
        form: { entryId: form.entryId, revisionId: form.id },
        baseId: approval?.id ?? null,
        operation: withdraw ? "withdraw" : "approve",
        policy: approval?.policy ?? {
          grammar: "ascii-exact-v1",
          display: "exact",
          fields: form.content.groups
            .flatMap((g) => g.fields)
            .map((f) => ({ fieldId: f.id, allowZero: null })),
          validation: { mode: "not-configured", review: "" },
        },
        reason: "",
        reviewed: false,
      },
      form,
      undefined,
      "measurement.use",
    );
  }
  async function resume(d: DraftRecord) {
    const gen = generation.current;
    setBusy(true);
    try {
      const r = await scope.current?.read(d.id);
      if (!r) return;
      const v = measurementSessionDraftSchema.parse(r.payload),
        f = v.form
          ? await readMeasurementFormDefinition(shopId, v.form.revisionId)
          : undefined;
      const use = v.form
        ? ((await readMeasurementUse(shopId, { form: v.form })).approval ??
          undefined)
        : undefined;
      const predecessor = v.correctionId
        ? await readMeasurement(shopId, v.correctionId)
        : undefined;
      if (active.current && gen === generation.current) {
        setCandidate(predecessor);
        open(
          v,
          f,
          r,
          "measurement.session",
          use?.id === v.approvalId ? use : undefined,
        );
      }
    } catch (e) {
      if (active.current && gen === generation.current) error(e);
    } finally {
      if (active.current && gen === generation.current) setBusy(false);
    }
  }
  return (
    <section
      className="customer-evidence measurement-workspace"
      aria-label={t.title}
    >
      <h3>{t.title}</h3>
      <p>{t.context}</p>
      {!opened ? (
        <Button variant="outline" onClick={() => setOpened(true)}>
          {t.title}
        </Button>
      ) : (
        <>
          {busy && <p role="status">{t.loading}</p>}
          {failed && <p role="alert">{denied ? t.access : t.failed}</p>}
          <Button variant="outline" disabled={busy} onClick={() => void load()}>
            {t.retry}
          </Button>
          {!denied && (
            <>
              {order && (
                <Field>
                  <FieldLabel htmlFor="measurement-piece">{t.piece}</FieldLabel>
                  <select
                    id="measurement-piece"
                    value={pieceId ?? ""}
                    disabled={!!controller || busy}
                    onChange={(e) => setPieceId(e.target.value || null)}
                  >
                    <option value="">{t.whole}</option>
                    {pieces?.identities.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(() => {
                          const definition = pieces.structure?.pieces.find(
                            (piece) => piece.key === p.key,
                          );
                          return definition ? label(definition, locale) : p.key;
                        })()}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {order && !selection && <p>{t.noTarget}</p>}
              {selection && (
                <p>
                  {selection.selectedId
                    ? `${t.selected}: ${selection.selectedId.slice(-8)}`
                    : t.unselected}
                </p>
              )}
              {selectedVersion && (
                <details open>
                  <summary>{t.selected}</summary>
                  <SavedMeasurement
                    v={selectedVersion}
                    locale={locale}
                    prefix="selected"
                  />
                </details>
              )}
              {repeatReference.success && !controller && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const gen = generation.current;
                    setBusy(true);
                    void readMeasurement(
                      shopId,
                      repeatReference.data.selectedId,
                    )
                      .then(
                        (v) => {
                          if (active.current && gen === generation.current) {
                            setCandidate(v);
                            setReuseReview(undefined);
                            setImpact({
                              physical: "unknown",
                              commercial: "unknown",
                            });
                          }
                        },
                        (e) => {
                          if (active.current && gen === generation.current)
                            error(e);
                        },
                      )
                      .finally(() => {
                        if (active.current && gen === generation.current)
                          setBusy(false);
                      });
                  }}
                >
                  {t.reuse} · {repeatReference.data.selectedId.slice(-8)}
                </Button>
              )}
              {!!selection?.history.length && (
                <details>
                  <summary>{t.selectionHistory}</summary>
                  <ol>
                    {selection.history.map((h) => (
                      <li key={h.id}>
                        {t.version} {h.version} · {h.selectedId.slice(-8)} ·{" "}
                        {h.recordedAt} · {h.actorId.slice(-8)}
                        <p>{h.reason}</p>
                      </li>
                    ))}
                  </ol>
                  {selection.nextHistory && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        const gen = generation.current;
                        const beforeVersion = selection.nextHistory;
                        if (!beforeVersion) return;
                        setBusy(true);
                        void readMeasurementTarget(shopId, {
                          orderId: selection.orderId,
                          pieceId: selection.pieceId,
                          beforeVersion,
                        })
                          .then(
                            (r) => {
                              if (active.current && gen === generation.current)
                                setSelection((old) =>
                                  old && old.version === r.version
                                    ? {
                                        ...r,
                                        history: [...old.history, ...r.history],
                                      }
                                    : r,
                                );
                            },
                            (e) => {
                              if (active.current && gen === generation.current)
                                error(e);
                            },
                          )
                          .finally(() => {
                            if (active.current && gen === generation.current)
                              setBusy(false);
                          });
                      }}
                    >
                      {t.moreSelections}
                    </Button>
                  )}
                </details>
              )}
              {candidate &&
                (!controller ||
                  controller.snapshot().values.operation === "select") && (
                  <section aria-label={t.compare} className="owner-form">
                    <h4>{t.compare}</h4>
                    {selectedVersion && (
                      <details>
                        <summary>{t.previous}</summary>
                        <SavedMeasurement
                          v={selectedVersion}
                          locale={locale}
                          prefix="compare-old"
                        />
                      </details>
                    )}
                    <details open>
                      <summary>{t.proposed}</summary>
                      <SavedMeasurement
                        v={candidate}
                        locale={locale}
                        prefix="compare-new"
                      />
                    </details>
                    {controller && candidate && <p>{t.correctionHelp}</p>}
                    {!controller && selection && (
                      <>
                        <p>{t.impactHelp}</p>
                        <Field>
                          <FieldLabel htmlFor="measurement-impact-physical">
                            {t.physical}
                          </FieldLabel>
                          <select
                            id="measurement-impact-physical"
                            value={impact.physical}
                            disabled={busy}
                            onChange={(e) => {
                              setImpact({
                                ...impact,
                                physical: e.target
                                  .value as typeof impact.physical,
                              });
                              setReuseReview(undefined);
                            }}
                          >
                            <option value="unknown">{t.unknown}</option>
                            <option value="not-started">{t.notStarted}</option>
                          </select>
                          {impact.physical === "not-started" && (
                            <p>{t.notStarted}</p>
                          )}
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="measurement-impact-commercial">
                            {t.commercial}
                          </FieldLabel>
                          <select
                            id="measurement-impact-commercial"
                            value={impact.commercial}
                            disabled={busy}
                            onChange={(e) => {
                              setImpact({
                                ...impact,
                                commercial: e.target
                                  .value as typeof impact.commercial,
                              });
                              setReuseReview(undefined);
                            }}
                          >
                            <option value="unknown">{t.unknown}</option>
                            <option value="none">{t.noEffect}</option>
                          </select>
                          {impact.commercial === "none" && <p>{t.noEffect}</p>}
                        </Field>
                        <Button
                          disabled={busy}
                          onClick={() => void inspectReuse(candidate)}
                        >
                          {t.inspect}
                        </Button>
                        {reuseReview && (
                          <>
                            <p>
                              {t.age}: {reuseReview.ageDays ?? t.unknown} ·{" "}
                              {t.asOf}: {reuseReview.asOfDate ?? t.unknown}
                            </p>
                            <h4>{t.sources}</h4>
                            {!reuseReview.sources.length && <p>{t.noSource}</p>}
                            <ul>
                              {reuseReview.sources.map((u) => (
                                <li key={`${u.orderId}:${u.pieceId}`}>
                                  {u.code} · {u.pieceId?.slice(-8) ?? t.whole}
                                </li>
                              ))}
                            </ul>
                            {reuseReview.sourceContextUnavailable && (
                              <p>{t.unavailableSource}</p>
                            )}
                            {reuseReview.blocked.length ? (
                              <>
                                <p role="alert">{t.blockedReuse}</p>
                                <ul>
                                  {reuseReview.blocked.map((reason) => (
                                    <li key={reason}>
                                      {
                                        {
                                          incompatible: t.incompatible,
                                          unavailable: t.unavailable,
                                          "unsupported-impact":
                                            t.unsupportedImpact,
                                          "already-selected": t.alreadySelected,
                                        }[reason]
                                      }
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <Button disabled={busy} onClick={selectReviewed}>
                                {t.select}
                              </Button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </section>
                )}
              {!controller && (
                <>
                  <Field>
                    <FieldLabel htmlFor="measurement-form">{t.form}</FieldLabel>
                    <select
                      id="measurement-form"
                      value={formId}
                      onChange={(e) => setFormId(e.target.value)}
                    >
                      <option value="">{t.choose}</option>
                      {eligibleForms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {label(f.content, locale)} · {f.id.slice(-8)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {form && (
                    <>
                      {approval?.operation !== "approve" && (
                        <p>{t.noApproval}</p>
                      )}
                      <div className="owner-actions">
                        <Button
                          disabled={busy || approval?.operation !== "approve"}
                          onClick={start}
                        >
                          {t.start}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => reviewForm()}
                        >
                          {t.useTitle}
                        </Button>
                        {approval?.operation === "approve" && (
                          <Button
                            variant="outline"
                            onClick={() => reviewForm(true)}
                          >
                            {t.withdraw}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  {drafts.map((d, i) => (
                    <Button
                      variant="outline"
                      key={d.id}
                      disabled={busy}
                      onClick={() => void resume(d)}
                    >
                      {t.resume} {i + 1}
                    </Button>
                  ))}
                </>
              )}
              {controller && (
                <>
                  {currentHead && (
                    <details open>
                      <summary>{t.currentHead}</summary>
                      <SavedMeasurement
                        v={currentHead}
                        locale={locale}
                        prefix="current-head"
                      />
                    </details>
                  )}
                  {workflow === "measurement.use" && definition ? (
                    <ApprovalEditor
                      controller={controller}
                      definition={definition}
                      locale={locale}
                      guard={guard}
                    />
                  ) : (
                    <MeasurementEditor
                      controller={controller}
                      onDenied={endAccess}
                      {...(definition ? { definition } : {})}
                      {...(draftUse ? { approval: draftUse } : {})}
                      {...(candidate ? { previous: candidate } : {})}
                      locale={locale}
                      guard={guard}
                    />
                  )}
                  <Button variant="outline" onClick={close}>
                    {t.close}
                  </Button>
                </>
              )}
              <h4>{t.saved}</h4>
              {!versions.length && !busy && <p>{t.empty}</p>}
              {versions.map((v) => (
                <details key={v.id}>
                  <summary>
                    {t.version} {v.version} · {v.source.date} ·{" "}
                    {label(v.form.content, locale)} · {v.id.slice(-8)}
                  </summary>
                  <SavedMeasurement v={v} locale={locale} />
                  <MeasurementFitImages
                    shopId={shopId}
                    version={v}
                    locale={locale}
                    guard={guard}
                    onAccessChange={() => void load()}
                  />
                  {!controller &&
                    !v.redacted &&
                    (v.headId === v.id ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void correct(v)}
                      >
                        {t.correct}
                      </Button>
                    ) : (
                      <p>{t.head}</p>
                    ))}
                  {usedIds.includes(v.id) && <p>{t.used}</p>}
                  {selection && !controller && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setCandidate(v);
                        setReuseReview(undefined);
                        setImpact({
                          physical: "unknown",
                          commercial: "unknown",
                        });
                      }}
                    >
                      {t.reuse}
                    </Button>
                  )}
                </details>
              ))}
              {next && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const gen = generation.current;
                    setBusy(true);
                    void readMeasurements(shopId, {
                      customerId,
                      wearerId,
                      before: next,
                    })
                      .then(
                        (r) => {
                          if (active.current && gen === generation.current) {
                            setVersions((v) => [...v, ...r.versions]);
                            setUsedIds((ids) => [
                              ...new Set([...ids, ...r.usedIds]),
                            ]);
                            setNext(r.next);
                          }
                        },
                        (e) => {
                          if (active.current && gen === generation.current)
                            error(e);
                        },
                      )
                      .finally(() => {
                        if (active.current && gen === generation.current)
                          setBusy(false);
                      });
                  }}
                >
                  {t.more}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
