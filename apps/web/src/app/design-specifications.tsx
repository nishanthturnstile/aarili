import { OwnerRequestError, onOwnerInvalidation } from "@aarili/api/client";
import {
  readDesignChoices,
  readDesignChoicesDefinition,
} from "@aarili/api/design-choices-client";
import {
  previewDesignReuse,
  readDesignSpecification,
  readDesignSpecifications,
} from "@aarili/api/design-specifications-client";
import { listAcceptedOrders, readOrderPieces } from "@aarili/api/orders-client";
import type { DesignChoicesRevision } from "@aarili/contracts/design-choices";
import {
  type DesignSpecificationDraft,
  type DesignSpecificationMediaDraft,
  type DesignSpecificationState,
  type DesignSpecificationVersion,
  designSpecificationCommandSchema,
  designSpecificationDraftSchema,
  designSpecificationMediaCommandSchema,
  designSpecificationMediaDraftSchema,
} from "@aarili/contracts/design-specifications";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import type { AcceptedOrder, OrderPieces } from "@aarili/contracts/orders";
import { designSpecificationMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type ReferenceCandidate,
  ReferenceComparison,
  ReferenceFields,
  ReferenceWorkbench,
  SavedReferences,
} from "./design-references";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";

type DesignChoicesDefinition = DesignChoicesRevision["definition"];
type T = (typeof designSpecificationMessages)[Locale];
const label = (d: { labelEn: string; labelTa: string }, locale: Locale) =>
  locale === "ta" ? d.labelTa : d.labelEn;
function emptyAnswer(questionId: string) {
  return {
    questionId,
    state: "unknown" as const,
    choice: null,
    text: "",
    unit: null,
    intent: "unresolved" as const,
    retainedReason: "",
  };
}
function DraftFields({
  v,
  changeValues,
  profile,
  choices,
  historical,
  locale,
  t,
}: {
  v: DesignSpecificationDraft;
  changeValues: (patch: Partial<DesignSpecificationDraft>) => void;
  profile: DesignChoicesDefinition | undefined;
  choices: DesignChoicesRevision[];
  historical: DesignChoicesDefinition[];
  locale: Locale;
  t: T;
}) {
  const p = profile?.content.kind === "profile" ? profile.content : null;
  const change = (
    i: number,
    value: Partial<DesignSpecificationDraft["answers"][number]>,
  ) => {
    const previous = v.answers[i];
    if (!previous) return;
    changeValues({
      answers: v.answers.map((a, index) =>
        index === i ? { ...previous, ...value } : a,
      ),
    });
  };
  const states = new Map<
    string,
    "applicable" | "not-applicable" | "unresolved"
  >();
  const applicable = (
    id: string,
  ): "applicable" | "not-applicable" | "unresolved" => {
    const cached = states.get(id);
    if (cached !== undefined) return cached;
    const q = p?.questions.find((q) => q.id === id);
    if (!q) return "unresolved";
    if (q.applicability === "not-applicable") {
      states.set(id, "not-applicable");
      return "not-applicable";
    }
    if (
      q.when.some(
        (w) =>
          applicable(w.questionId) === "unresolved" ||
          v.answers.find((a) => a.questionId === w.questionId)?.state ===
            "unknown",
      )
    ) {
      states.set(id, "unresolved");
      return "unresolved";
    }
    const result = q.when.every(
      (w) =>
        applicable(w.questionId) === "applicable" &&
        v.answers.some(
          (a) =>
            a.questionId === w.questionId &&
            a.state === "selected" &&
            a.choice?.revisionId === w.choice.revisionId,
        ),
    )
      ? "applicable"
      : "not-applicable";
    states.set(id, result);
    return result;
  };
  return (
    <>
      <p>{t.approval}</p>
      {v.operation === "save" &&
        p?.questions.map((q, i) => {
          const a = v.answers.find((a) => a.questionId === q.id);
          if (!a) return null;
          const index = v.answers.indexOf(a),
            prefix = `design-${q.id}`,
            applicability = applicable(q.id),
            isApplicable = applicability === "applicable";
          const chosen = a.choice
            ? choices.find((c) => c.entryId === a.choice?.entryId)
            : undefined;
          const inactive =
            !!a.choice &&
            (!chosen?.available ||
              chosen.definition.id !== a.choice.revisionId);
          return (
            <details key={q.id} open={i < 4}>
              <summary>
                {label(q, locale)} ·{" "}
                {a.state === "unknown"
                  ? t.unknown
                  : a.state === "not-applicable"
                    ? t.notApplicable
                    : t.selected}
              </summary>
              <fieldset className="owner-form">
                <legend>{label(q, locale)}</legend>
                <Field>
                  <FieldLabel htmlFor={`${prefix}-state`}>{t.state}</FieldLabel>
                  <select
                    id={`${prefix}-state`}
                    value={a.state}
                    onChange={(e) =>
                      change(index, {
                        ...emptyAnswer(q.id),
                        state: e.target.value as typeof a.state,
                      })
                    }
                  >
                    <option value="unknown">{t.unknown}</option>
                    {applicability === "not-applicable" && (
                      <option value="not-applicable">{t.notApplicable}</option>
                    )}
                    <option value="selected" disabled={!isApplicable}>
                      {t.selected}
                    </option>
                  </select>
                </Field>
                {!isApplicable && (
                  <p>
                    {applicability === "unresolved"
                      ? t.unknown
                      : q.reason || t.notApplicable}
                  </p>
                )}
                {a.state === "selected" && (
                  <>
                    {q.kind === "choice" ? (
                      <Field>
                        <FieldLabel htmlFor={`${prefix}-choice`}>
                          {label(q, locale)}
                        </FieldLabel>
                        <select
                          id={`${prefix}-choice`}
                          value={a.choice?.revisionId ?? ""}
                          onChange={(e) => {
                            const ref = q.choices.find(
                              (c) => c.revisionId === e.target.value,
                            );
                            change(index, {
                              choice: ref ?? null,
                              intent:
                                a.intent === "unresolved"
                                  ? "inspiration"
                                  : a.intent,
                              retainedReason: "",
                            });
                          }}
                        >
                          <option value="">{t.unknown}</option>
                          {q.choices.map((ref) => {
                            const c = choices.find(
                                (c) => c.entryId === ref.entryId,
                              ),
                              active =
                                c?.available &&
                                c.definition.id === ref.revisionId;
                            const exact =
                              c?.definition.id === ref.revisionId
                                ? c.definition
                                : historical.find(
                                    (d) => d.id === ref.revisionId,
                                  );
                            if (
                              !active &&
                              a.choice?.revisionId !== ref.revisionId
                            )
                              return null;
                            return (
                              <option
                                key={ref.revisionId}
                                value={ref.revisionId}
                                disabled={!active}
                              >
                                {exact
                                  ? label(exact.content, locale)
                                  : ref.revisionId}
                                {exact?.content.kind === "choice" &&
                                exact.content.none
                                  ? ` (${t.explicitNone})`
                                  : ""}
                                {!active ? ` · ${t.retainedFlag}` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel htmlFor={`${prefix}-text`}>
                          {q.kind === "garment-length"
                            ? t.dimensionValue
                            : t.value}
                        </FieldLabel>
                        <Input
                          id={`${prefix}-text`}
                          maxLength={2000}
                          value={a.text}
                          onChange={(e) =>
                            change(index, {
                              text: e.target.value,
                              intent:
                                a.intent === "unresolved"
                                  ? "inspiration"
                                  : a.intent,
                            })
                          }
                        />
                      </Field>
                    )}
                    {q.kind === "garment-length" && (
                      <Field>
                        <FieldLabel htmlFor={`${prefix}-unit`}>
                          {t.unit}
                        </FieldLabel>
                        <select
                          id={`${prefix}-unit`}
                          value={a.unit ?? ""}
                          onChange={(e) =>
                            change(index, {
                              unit: (e.target.value || null) as
                                | "in"
                                | "cm"
                                | null,
                            })
                          }
                        >
                          <option value="">{t.unknown}</option>
                          {q.units.map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field>
                      <FieldLabel htmlFor={`${prefix}-intent`}>
                        {t.intent}
                      </FieldLabel>
                      <select
                        id={`${prefix}-intent`}
                        value={a.intent}
                        onChange={(e) =>
                          change(index, {
                            intent: e.target.value as typeof a.intent,
                          })
                        }
                      >
                        <option value="unresolved">{t.unknown}</option>
                        <option value="inspiration">{t.inspiration}</option>
                        <option value="instruction">{t.instruction}</option>
                      </select>
                    </Field>
                    {inactive && (
                      <Field>
                        <FieldLabel htmlFor={`${prefix}-retained`}>
                          {t.retained}
                        </FieldLabel>
                        <Input
                          id={`${prefix}-retained`}
                          maxLength={1000}
                          value={a.retainedReason}
                          onChange={(e) =>
                            change(index, { retainedReason: e.target.value })
                          }
                        />
                      </Field>
                    )}
                  </>
                )}
              </fieldset>
            </details>
          );
        })}
      <Field>
        <FieldLabel htmlFor="design-reason">{t.reason}</FieldLabel>
        <Input
          id="design-reason"
          maxLength={1000}
          value={v.reason}
          onChange={(e) => changeValues({ reason: e.target.value })}
          aria-invalid={!v.reason.trim()}
          aria-describedby={
            !v.reason.trim() ? "design-reason-error" : undefined
          }
        />
        {!v.reason.trim() && <p id="design-reason-error">{t.reasonRequired}</p>}
      </Field>
      {v.operation === "save" && (
        <Field>
          <FieldLabel htmlFor="design-save-mode">{t.saveOnly}</FieldLabel>
          <select
            id="design-save-mode"
            value={v.use ? "use" : "save"}
            onChange={(e) => changeValues({ use: e.target.value === "use" })}
          >
            <option value="save">{t.saveOnly}</option>
            <option value="use">{t.use}</option>
          </select>
        </Field>
      )}
      <p>{t.saveHint}</p>
    </>
  );
}
function Editor({
  controller,
  current,
  savedVersions,
  profile,
  choices,
  historical,
  locale,
  guard,
  t,
  schemaVersion,
  shopId,
  orderId,
  pieceId,
}: {
  controller: DraftRecovery;
  current: DesignSpecificationVersion | undefined;
  savedVersions: DesignSpecificationVersion[];
  profile: DesignChoicesDefinition | undefined;
  choices: DesignChoicesRevision[];
  historical: DesignChoicesDefinition[];
  locale: Locale;
  guard: OwnerGuard;
  t: T;
  schemaVersion: number;
  shopId: string;
  orderId: string;
  pieceId: string | null;
}) {
  const [candidate, setCandidate] = useState<ReferenceCandidate>();
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = (
      schemaVersion === 2
        ? designSpecificationMediaDraftSchema
        : designSpecificationDraftSchema
    ).safeParse(s.values);
  const reviewing = s.status !== "promoted";
  return (
    <div className="directory-editor">
      <h3>{t.draft}</h3>
      {v.success && (
        <p>
          {t.based}:{" "}
          {v.data.baseSavedId
            ? savedVersions.some((s) => s.id === v.data.baseSavedId)
              ? `v${savedVersions.find((s) => s.id === v.data.baseSavedId)?.version}`
              : t.earlier
            : t.none}{" "}
          · {t.scopeRevision} {v.data.baseVersion}
        </p>
      )}
      {schemaVersion === 2 ? (
        <>
          <DraftForm
            controller={controller}
            schema={designSpecificationMediaDraftSchema}
            locale={locale}
            guard={guard}
            canPromote={
              designSpecificationMediaCommandSchema.safeParse(s.values).success
            }
            promotionLabel={
              v.success && v.data.operation === "select"
                ? t.select
                : v.success && v.data.use
                  ? t.use
                  : t.saveOnly
            }
            renderConflict={() => <p>{t.conflict}</p>}
          >
            {(form) => (
              <div
                className={
                  form.watch("operation") === "save" && reviewing
                    ? "design-reference-edit-layout"
                    : "owner-form"
                }
              >
                <div className="owner-form design-reference-fields">
                  <DraftFields
                    v={form.watch()}
                    changeValues={(patch) => {
                      for (const [key, value] of Object.entries(patch)) {
                        if (key === "answers")
                          form.setValue(
                            "answers",
                            value as DesignSpecificationDraft["answers"],
                            { shouldDirty: true },
                          );
                        else if (key === "reason")
                          form.setValue("reason", String(value), {
                            shouldDirty: true,
                          });
                        else if (key === "use")
                          form.setValue("use", Boolean(value), {
                            shouldDirty: true,
                          });
                      }
                    }}
                    profile={profile}
                    choices={choices}
                    historical={historical}
                    locale={locale}
                    t={t}
                  />
                  {form.watch("operation") === "save" && (
                    <ReferenceFields
                      values={form.watch("referenceItems")}
                      change={(items) =>
                        form.setValue("referenceItems", items, {
                          shouldDirty: true,
                        })
                      }
                      profile={profile}
                      locale={locale}
                      candidate={candidate}
                      shopId={shopId}
                      draftId={s.id}
                      savedItems={
                        designSpecificationMediaDraftSchema.safeParse(
                          s.committed?.payload,
                        ).data?.referenceItems ?? []
                      }
                      knownReferences={savedVersions.flatMap(
                        (v) => v.referenceItems,
                      )}
                      images={
                        new Set([
                          ...draftImages,
                          ...savedVersions.flatMap((v) =>
                            v.referenceItems
                              .filter((r) => r.display)
                              .map((r) => r.assetId),
                          ),
                          ...(candidate?.asset.contentType.startsWith("image/")
                            ? [candidate.asset.id]
                            : []),
                        ])
                      }
                    />
                  )}
                </div>
                {form.watch("operation") === "save" && reviewing && (
                  <ReferenceComparison
                    current={current}
                    proposed={form.watch("referenceItems")}
                    profile={profile}
                    locale={locale}
                  />
                )}
              </div>
            )}
          </DraftForm>
          <ReferenceWorkbench
            shopId={shopId}
            orderId={orderId}
            pieceId={pieceId}
            locale={locale}
            guard={guard}
            profile={profile}
            onCandidate={(c) => {
              setCandidate(c);
              if (c?.asset.contentType.startsWith("image/"))
                setDraftImages((ids) => [...new Set([...ids, c.asset.id])]);
            }}
          />
        </>
      ) : (
        <DraftForm
          controller={controller}
          schema={designSpecificationDraftSchema}
          locale={locale}
          guard={guard}
          canPromote={
            designSpecificationCommandSchema.safeParse(s.values).success
          }
          promotionLabel={
            v.success && v.data.operation === "select"
              ? t.select
              : v.success && v.data.use
                ? t.use
                : t.saveOnly
          }
          renderConflict={() => <p>{t.conflict}</p>}
        >
          {(form) => (
            <DraftFields
              v={form.watch()}
              changeValues={(patch) => {
                if (patch.answers)
                  form.setValue("answers", patch.answers, {
                    shouldDirty: true,
                  });
                if (patch.reason !== undefined)
                  form.setValue("reason", patch.reason, { shouldDirty: true });
                if (patch.use !== undefined)
                  form.setValue("use", patch.use, { shouldDirty: true });
              }}
              profile={profile}
              choices={choices}
              historical={historical}
              locale={locale}
              t={t}
            />
          )}
        </DraftForm>
      )}
    </div>
  );
}
function Saved({
  v,
  t,
  locale,
  shopId,
}: {
  v: DesignSpecificationVersion;
  t: T;
  locale: Locale;
  shopId: string;
}) {
  return (
    <>
      <p>
        {t.author}: {v.actorId} ·{" "}
        {new Date(v.recordedAt).toLocaleString(
          locale === "ta" ? "ta-IN" : "en-IN",
        )}
      </p>
      <p>{v.redacted ? t.redacted : v.reason}</p>
      <dl>
        {v.answers.map((a) => {
          const q =
              v.profile.content.kind === "profile"
                ? v.profile.content.questions.find((q) => q.id === a.questionId)
                : undefined,
            c = v.choices.find((c) => c.id === a.choice?.revisionId);
          return (
            <div key={a.questionId}>
              <dt>{q ? label(q, locale) : a.questionId}</dt>
              <dd>
                {a.state === "unknown"
                  ? t.unknown
                  : a.state === "not-applicable"
                    ? t.notApplicable
                    : c
                      ? `${label(c.content, locale)}${c.content.kind === "choice" && c.content.none ? ` (${t.explicitNone})` : ""}`
                      : `${a.text} ${a.unit ?? ""}`}
                {a.state === "selected"
                  ? ` · ${a.intent === "instruction" ? t.instruction : t.inspiration}`
                  : ""}
                {a.retainedReason
                  ? ` · ${t.retainedFlag}: ${a.retainedReason}`
                  : ""}
              </dd>
            </div>
          );
        })}
      </dl>
      <SavedReferences version={v} shopId={shopId} locale={locale} />
    </>
  );
}
export function DesignSpecifications({
  order,
  shopId,
  locale,
  guard,
}: {
  order: AcceptedOrder;
  shopId: string;
  locale: Locale;
  guard: OwnerGuard;
}) {
  const t = designSpecificationMessages[locale];
  const [pieces, setPieces] = useState<OrderPieces>(),
    [pieceId, setPieceId] = useState<string | null>(null),
    [state, setState] = useState<DesignSpecificationState>(),
    [currentSaved, setCurrentSaved] = useState<DesignSpecificationVersion>(),
    [historyMore, setHistoryMore] = useState(false),
    [selectionMore, setSelectionMore] = useState(false),
    [ordersNext, setOrdersNext] = useState<string | null>(null),
    [ordersLoaded, setOrdersLoaded] = useState(false),
    [choices, setChoices] = useState<DesignChoicesRevision[]>([]),
    [profileId, setProfileId] = useState(""),
    [controller, setController] = useState<DraftRecovery>(),
    [draftSchemaVersion, setDraftSchemaVersion] = useState(2),
    [draftProfile, setDraftProfile] = useState<DesignChoicesDefinition>(),
    [draftHistorical, setDraftHistorical] = useState<DesignChoicesDefinition[]>(
      [],
    ),
    [sourcePieces, setSourcePieces] = useState<OrderPieces>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [sourceOrder, setSourceOrder] = useState(""),
    [sourceVersions, setSourceVersions] = useState<
      (DesignSpecificationVersion & { scopeVersion: number })[]
    >([]),
    [sourceId, setSourceId] = useState(""),
    [fields, setFields] = useState<string[]>([]),
    [orders, setOrders] = useState<AcceptedOrder[]>([]);
  const scope = useRef<ReturnType<typeof createDraftScope> | undefined>(
      undefined,
    ),
    generation = useRef(0),
    sourceGeneration = useRef(0),
    active = useRef(true),
    currentController = useRef<DraftRecovery | undefined>(undefined);
  async function load() {
    const gen = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const [s, p] = await Promise.all([
        readDesignSpecifications(shopId, { orderId: order.id, pieceId }),
        readOrderPieces(shopId, order.id),
      ]);
      const current =
        s.currentId && !s.versions.some((v) => v.id === s.currentId)
          ? await readDesignSpecification(shopId, s.currentId)
          : s.versions.find((v) => v.id === s.currentId);
      const entries: DesignChoicesRevision[] = [];
      let before: string | undefined;
      do {
        const page = await readDesignChoices(shopId, before);
        entries.push(...page.entries);
        before = page.next ?? undefined;
      } while (before);
      const records: DraftRecord[] = [];
      let cursor: DraftCursor | undefined;
      do {
        const mountedScope = scope.current;
        if (!mountedScope) return;
        const page = await mountedScope.list(cursor);
        records.push(...page.drafts);
        cursor = page.next ?? undefined;
      } while (cursor);
      if (!active.current || gen !== generation.current) return;
      setState(s);
      setCurrentSaved(current);
      setHistoryMore(s.versions.length === 25);
      setSelectionMore(s.selections.length === 25);
      setPieces(p);
      setChoices(entries);
      setDrafts(
        records.filter(
          (r) =>
            r.workflow === "design.specification" &&
            r.payload.orderId === order.id &&
            r.payload.pieceId === pieceId,
        ),
      );
    } catch (error) {
      if (active.current && gen === generation.current) {
        setFailed(true);
        if (
          error instanceof OwnerRequestError &&
          ["NOT_FOUND", "UNAUTHENTICATED", "SHOP_ACCESS_DENIED"].includes(
            error.code,
          )
        ) {
          const c = currentController.current;
          if (c) {
            c.invalidate();
            scope.current?.release(c);
          }
          currentController.current = undefined;
          setController(undefined);
          setState(undefined);
          setCurrentSaved(undefined);
          setChoices([]);
          setDrafts([]);
          setPieces(undefined);
          setDraftProfile(undefined);
          setDraftHistorical([]);
          setSourceVersions([]);
          setSourcePieces(undefined);
          setOrders([]);
          setSourceOrder("");
          setSourceId("");
          setFields([]);
          setOrdersLoaded(false);
          setOrdersNext(null);
        }
      }
    } finally {
      if (active.current && gen === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    active.current = true;
    scope.current = createDraftScope(shopId, guard);
    const stop = onOwnerInvalidation(() => {
      generation.current++;
      active.current = false;
      setState(undefined);
      setCurrentSaved(undefined);
      setPieces(undefined);
      setSourceOrder("");
      setSourceId("");
      setFields([]);
      setChoices([]);
      setDrafts([]);
      setSourceVersions([]);
      setOrders([]);
      setOrdersLoaded(false);
      setOrdersNext(null);
      setDraftProfile(undefined);
      setDraftHistorical([]);
      setSourcePieces(undefined);
      setController(undefined);
    });
    return () => {
      active.current = false;
      generation.current++;
      stop();
      scope.current?.dispose();
    };
  }, [shopId, guard]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is created by the preceding lifecycle effect
  useEffect(() => {
    void load();
  }, [shopId, order.id, pieceId]);
  function open(
    v: DesignSpecificationDraft | DesignSpecificationMediaDraft,
    profile: DesignChoicesDefinition | undefined,
    record?: DraftRecord,
    exactChoices: DesignChoicesDefinition[] = [],
  ) {
    if (currentController.current)
      scope.current?.release(currentController.current);
    const mountedScope = scope.current;
    if (!mountedScope) return;
    const c = mountedScope.open({
      workflow: "design.specification",
      schemaVersion: record?.schemaVersion ?? 2,
      initial:
        record?.schemaVersion === 1
          ? v
          : {
              ...v,
              referenceItems: "referenceItems" in v ? v.referenceItems : [],
            },
      ...(record ? { record } : {}),
      editableTargetConflict: true,
      committed: (r) => {
        if (r.lifecycle === "promoted") void load();
      },
    });
    currentController.current = c;
    setController(c);
    setDraftSchemaVersion(record?.schemaVersion ?? 2);
    setDraftProfile(profile);
    setDraftHistorical(exactChoices);
  }
  function start(saved?: DesignSpecificationVersion, select = false) {
    if (!state) return;
    const profile =
      saved?.profile ??
      choices.find((c) => c.definition.id === profileId)?.definition;
    if (profile?.content.kind !== "profile") return;
    open(
      {
        orderId: order.id,
        pieceId,
        baseVersion: state.version,
        baseSavedId: state.latestSavedId,
        operation: select ? "select" : "save",
        selectedId: select ? (saved?.id ?? null) : null,
        profile: { entryId: profile.entryId, revisionId: profile.id },
        answers: select
          ? []
          : (saved?.answers.map((a) => ({ ...a, retainedReason: "" })) ??
            profile.content.questions.map((q) => emptyAnswer(q.id))),
        reason: "",
        use: select,
        reuse: null,
        referenceItems: select
          ? []
          : (saved?.referenceItems
              .filter((r) => !r.redacted)
              .map((r) => ({
                id: crypto.randomUUID(),
                assetId: r.assetId,
                questionId: r.questionId,
                intent: r.intent,
                caption: r.caption,
                annotations: r.annotations,
                replacesId: saved.id === state.latestSavedId ? r.id : null,
                geometryReviewed: false,
              })) ?? []),
      },
      profile,
      undefined,
      saved?.choices ?? [],
    );
  }
  function close() {
    const c = currentController.current;
    if (c && !c.confirmLeave(() => window.confirm(t.cancelWarning))) return;
    if (c) scope.current?.release(c);
    currentController.current = undefined;
    setController(undefined);
    setDraftProfile(undefined);
    setDraftHistorical([]);
    void load();
  }
  const key = pieceId
    ? pieces?.identities.find((p) => p.id === pieceId)?.key
    : null;
  const profiles = choices.filter(
    (c) =>
      c.available &&
      c.definition.content.kind === "profile" &&
      c.definition.content.manifest?.revisionId ===
        order.intake.manifest?.definitionId &&
      c.definition.content.pieceKey === (key ?? null),
  );
  return (
    <section
      className="owner-form order-editor"
      aria-label={t.title}
      lang={locale}
    >
      <h2>{t.title}</h2>
      <p>{t.approval}</p>
      <Field>
        <FieldLabel htmlFor="design-scope">{t.scope}</FieldLabel>
        <select
          id="design-scope"
          value={pieceId ?? ""}
          disabled={!!controller || busy}
          onChange={(e) => {
            setPieceId(e.target.value || null);
            setProfileId("");
            setSourceVersions([]);
            setFields([]);
          }}
        >
          <option value="">{t.whole}</option>
          {pieces?.identities.map((p) => {
            const d = pieces.structure?.pieces.find((x) => x.key === p.key);
            return (
              <option key={p.id} value={p.id}>
                {d ? label(d, locale) : p.key}
              </option>
            );
          })}
        </select>
      </Field>
      {failed && <p role="alert">{t.unavailable}</p>}
      <Button variant="outline" disabled={busy} onClick={() => void load()}>
        {t.refresh}
      </Button>
      {state && (
        <>
          <p>
            {t.current}:{" "}
            {state.currentId ? `v${currentSaved?.version ?? "…"}` : t.none} ·{" "}
            {t.scopeRevision} {state.version}
          </p>
          {!controller && (
            <>
              <Field>
                <FieldLabel htmlFor="design-profile">{t.profile}</FieldLabel>
                <select
                  id="design-profile"
                  disabled={busy}
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                >
                  <option value="">{t.choose}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.definition.id}>
                      {label(p.definition.content, locale)}
                    </option>
                  ))}
                </select>
              </Field>
              {profiles.length === 0 && <p>{t.noProfile}</p>}
              <Button disabled={!profileId || busy} onClick={() => start()}>
                {t.new}
              </Button>
              {drafts.map((d, i) => (
                <Button
                  variant="outline"
                  key={d.id}
                  onClick={() => {
                    const v = (
                        d.schemaVersion === 2
                          ? designSpecificationMediaDraftSchema
                          : designSpecificationDraftSchema
                      ).parse(d.payload),
                      gen = ++generation.current;
                    setBusy(true);
                    void Promise.all([
                      v.profile
                        ? readDesignChoicesDefinition(
                            shopId,
                            v.profile.revisionId,
                          )
                        : Promise.resolve(undefined),
                      Promise.all(
                        v.answers
                          .flatMap((a) => (a.choice ? [a.choice] : []))
                          .map((ref) =>
                            readDesignChoicesDefinition(shopId, ref.revisionId),
                          ),
                      ),
                    ])
                      .then(([p, defs]) => {
                        if (active.current && gen === generation.current)
                          open(v, p, d, defs);
                      })
                      .catch(() => {
                        if (active.current && gen === generation.current)
                          setFailed(true);
                      })
                      .finally(() => {
                        if (active.current && gen === generation.current)
                          setBusy(false);
                      });
                  }}
                >
                  {t.resume} {i + 1}
                </Button>
              ))}
            </>
          )}
          {controller && (
            <>
              <Editor
                controller={controller}
                current={currentSaved}
                savedVersions={state.versions}
                profile={draftProfile}
                choices={choices}
                historical={draftHistorical}
                locale={locale}
                guard={guard}
                t={t}
                schemaVersion={draftSchemaVersion}
                shopId={shopId}
                orderId={order.id}
                pieceId={pieceId}
              />
              <Button variant="outline" onClick={close}>
                {t.close}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  close();
                }}
              >
                {t.newBase}
              </Button>
            </>
          )}
          <h3>{t.history}</h3>
          {!state.versions.length && <p>{t.empty}</p>}
          {state.versions.map((v) => (
            <details key={v.id}>
              <summary>
                v{v.version}
                {state.currentId === v.id ? ` · ${t.current}` : ""}
              </summary>
              <Saved v={v} t={t} locale={locale} shopId={shopId} />
              <div className="owner-actions">
                <Button
                  variant="outline"
                  disabled={!!controller || v.redacted}
                  onClick={() => start(v)}
                >
                  {t.revise}
                </Button>
                <Button
                  disabled={
                    !!controller || v.redacted || state.currentId === v.id
                  }
                  onClick={() => start(v, true)}
                >
                  {t.select}
                </Button>
              </div>
            </details>
          ))}
          {historyMore && (
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => {
                const gen = generation.current;
                void readDesignSpecifications(shopId, {
                  orderId: order.id,
                  pieceId,
                  beforeVersion: state.versions.at(-1)?.version,
                })
                  .then((s) => {
                    if (active.current && gen === generation.current) {
                      setHistoryMore(s.versions.length === 25);
                      setState({
                        ...s,
                        versions: [...state.versions, ...s.versions],
                      });
                    }
                  })
                  .catch(() => setFailed(true));
              }}
            >
              {t.loadMore}
            </Button>
          )}
          {currentSaved &&
            !state.versions.some((v) => v.id === currentSaved.id) && (
              <details>
                <summary>
                  v{currentSaved.version} / {t.current}
                </summary>
                <Saved v={currentSaved} t={t} locale={locale} shopId={shopId} />
              </details>
            )}
          <details>
            <summary>{t.selections}</summary>
            <ol>
              {state.selections.map((e) => (
                <li key={e.id}>
                  v
                  {state.versions.find((v) => v.id === e.versionId)?.version ??
                    "..."}{" "}
                  /{" "}
                  {new Date(e.recordedAt).toLocaleString(
                    locale === "ta" ? "ta-IN" : "en-IN",
                  )}{" "}
                  / {e.actorId}
                  <p>{e.redacted ? t.redacted : e.reason}</p>
                </li>
              ))}
            </ol>
            {selectionMore && (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => {
                  const last = state.selections.at(-1);
                  if (!last) return;
                  const gen = generation.current;
                  void readDesignSpecifications(shopId, {
                    orderId: order.id,
                    pieceId,
                    beforeSelectionVersion: last.scopeVersion,
                  })
                    .then((s) => {
                      if (active.current && gen === generation.current) {
                        setState({
                          ...state,
                          selections: [...state.selections, ...s.selections],
                        });
                        setSelectionMore(s.selections.length === 25);
                      }
                    })
                    .catch(() => setFailed(true));
                }}
              >
                {t.moreSelections}
              </Button>
            )}
          </details>
          <details>
            <summary>{t.reused}</summary>
            <p>{t.repeatNote}</p>
            <Button
              variant="outline"
              disabled={busy || (ordersLoaded && !ordersNext)}
              onClick={() => {
                const gen = generation.current;
                void listAcceptedOrders(
                  shopId,
                  ordersLoaded ? (ordersNext ?? undefined) : undefined,
                )
                  .then((r) => {
                    if (active.current && gen === generation.current) {
                      setOrdersLoaded(true);
                      setOrdersNext(r.next);
                      setOrders((previous) => [
                        ...previous,
                        ...r.orders.filter(
                          (o) =>
                            o.id !== order.id &&
                            o.intake.wearerId === order.intake.wearerId,
                        ),
                      ]);
                    }
                  })
                  .catch(() => setFailed(true));
              }}
            >
              {ordersLoaded ? t.moreSources : t.source}
            </Button>
            <Field>
              <FieldLabel htmlFor="design-source-order">{t.source}</FieldLabel>
              <select
                id="design-source-order"
                disabled={busy}
                value={sourceOrder}
                onChange={(e) => {
                  const request = ++sourceGeneration.current;
                  const id = e.target.value;
                  setSourceOrder(id);
                  setSourceId("");
                  setFields([]);
                  setSourceVersions([]);
                  const gen = generation.current;
                  if (id)
                    void readOrderPieces(shopId, id)
                      .then(async (p) => {
                        const rows = await Promise.all(
                          [null, ...p.identities.map((p) => p.id)].map(
                            (pieceId) =>
                              readDesignSpecifications(shopId, {
                                orderId: id,
                                pieceId,
                              }),
                          ),
                        );
                        if (
                          active.current &&
                          gen === generation.current &&
                          request === sourceGeneration.current
                        ) {
                          setSourceVersions(
                            rows.flatMap((r) =>
                              r.versions.map((v) => ({
                                ...v,
                                scopeVersion: r.version,
                              })),
                            ),
                          );
                          setSourcePieces(p);
                        }
                      })
                      .catch(() => setFailed(true));
                }}
              >
                <option value="">{t.unknown}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="design-source-version">
                {t.sourceVersion}
              </FieldLabel>
              <select
                id="design-source-version"
                disabled={busy}
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setFields([]);
                }}
              >
                <option value="">{t.unknown}</option>
                {sourceVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} ·{" "}
                    {v.pieceId
                      ? (() => {
                          const piece = sourcePieces?.structure?.pieces.find(
                            (d) =>
                              d.key ===
                              sourcePieces.identities.find(
                                (p) => p.id === v.pieceId,
                              )?.key,
                          );
                          return piece ? label(piece, locale) : t.scope;
                        })()
                      : t.whole}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend>{t.fields}</legend>
              {sourceVersions
                .find((v) => v.id === sourceId)
                ?.answers.filter((a) => a.state === "selected")
                .map((a) => {
                  const source = sourceVersions.find((v) => v.id === sourceId);
                  if (!source) return null;
                  const q =
                    source.profile.content.kind === "profile"
                      ? source.profile.content.questions.find(
                          (q) => q.id === a.questionId,
                        )
                      : undefined;
                  return (
                    <label key={a.questionId} className="order-check">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={fields.includes(a.questionId)}
                        onChange={(e) =>
                          setFields(
                            e.target.checked
                              ? [...fields, a.questionId]
                              : fields.filter((id) => id !== a.questionId),
                          )
                        }
                      />
                      {q ? label(q, locale) : a.questionId}
                    </label>
                  );
                })}
            </fieldset>
            <Button
              disabled={!!controller || !profileId || !fields.length || busy}
              onClick={() => {
                const source = sourceVersions.find((v) => v.id === sourceId),
                  profile = choices.find((c) => c.definition.id === profileId);
                if (!source || !profile) return;
                const gen = generation.current;
                setBusy(true);
                void previewDesignReuse(shopId, {
                  orderId: order.id,
                  pieceId,
                  profile: {
                    entryId: profile.entryId,
                    revisionId: profile.definition.id,
                  },
                  source: {
                    versionId: source.id,
                    scopeVersion: source.scopeVersion,
                    digest: source.digest,
                    fields,
                  },
                })
                  .then((v) => {
                    if (active.current && gen === generation.current)
                      open(v, profile.definition);
                  })
                  .catch(() => {
                    if (active.current && gen === generation.current)
                      setFailed(true);
                  })
                  .finally(() => {
                    if (active.current && gen === generation.current)
                      setBusy(false);
                  });
              }}
            >
              {t.reuse}
            </Button>
          </details>
        </>
      )}
    </section>
  );
}
