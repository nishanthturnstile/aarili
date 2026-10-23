import { OwnerRequestError, onOwnerInvalidation } from "@aarili/api/client";
import {
  comparePattern,
  readPatterns,
} from "@aarili/api/manual-patterns-client";
import { readOrderPieces } from "@aarili/api/orders-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  emptyPatternDraft,
  type PatternCapabilityDraft,
  type PatternDraft,
  type PatternPage,
  type PatternReferenceV2Draft,
  type PatternVersion,
  patternCapabilityCommandSchema,
  patternCapabilityDraftSchema,
  patternCommandSchema,
  patternDraftSchema,
  patternReferenceV2CommandSchema,
  patternReferenceV2DraftSchema,
  patternSubjectDraftSchema,
} from "@aarili/contracts/manual-patterns";
import type { AcceptedOrder, OrderPieces } from "@aarili/contracts/orders";
import { type Locale, manualPatternMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Input } from "@aarili/ui/components/input";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import {
  PatternOutputFields,
  PatternOutputView,
  PatternUploads,
} from "./pattern-outputs";

type T = (typeof manualPatternMessages)[Locale];
const denied = (e: unknown) =>
  e instanceof OwnerRequestError &&
  ["NOT_FOUND", "UNAUTHENTICATED", "SHOP_ACCESS_DENIED"].includes(e.code);
const when = (v: string, locale: Locale) =>
  new Date(v).toLocaleString(locale === "ta" ? "ta-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
  });
function Warnings({ t }: { t: T }) {
  return (
    <div role="note" aria-label={t.warnings}>
      <p>{t.scaleWarning}</p>
      <p>{t.formulaWarning}</p>
      <p>{t.cuttingWarning}</p>
    </div>
  );
}
function InputProvenance({
  kind,
  value,
  onChange,
  current,
  t,
}: {
  kind: "design" | "measurement";
  value: PatternDraft["content"]["design"];
  onChange: (value: PatternDraft["content"]["design"]) => void;
  current: string | null;
  t: T;
}) {
  const prefix = useId();
  const v = value;
  return (
    <fieldset className="owner-form">
      <legend>{t[kind]}</legend>
      <label>
        {t[kind]}
        <select
          className="ui-input"
          aria-label={t[kind]}
          value={v.state}
          onChange={(e) =>
            onChange(
              e.target.value === "known"
                ? { state: "known", versionId: null }
                : e.target.value === "not-applicable"
                  ? {
                      state: "not-applicable",
                      reason: "",
                      policy: { entryId: "", revisionId: "" },
                    }
                  : { state: "unknown", reason: "" },
            )
          }
        >
          <option value="unknown">{t.unknown}</option>
          <option value="known">{t.known}</option>
          <option value="not-applicable">{t.notApplicable}</option>
        </select>
      </label>
      {v.state === "known" ? (
        <>
          <label htmlFor={`${prefix}-field-1`}>
            {t.exactId}
            <Input
              id={`${prefix}-field-1`}
              value={v.versionId ?? ""}
              maxLength={36}
              onChange={(e) =>
                onChange({ ...v, versionId: e.target.value || null })
              }
            />
          </label>
          {current ? (
            <>
              <p>
                {t.currentInputs}: {current}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange({ state: "known", versionId: current })}
              >
                {t.useCurrent}
              </Button>
            </>
          ) : (
            <p>{t.noCurrent}</p>
          )}
        </>
      ) : (
        <>
          <label>
            {t.inputReason}
            <textarea
              className="ui-input"
              maxLength={1000}
              value={v.reason}
              onChange={(e) => onChange({ ...v, reason: e.target.value })}
            />
          </label>
          {v.state === "not-applicable" && (
            <>
              <label htmlFor={`${prefix}-field-2`}>
                {t.policyEntry}
                <Input
                  id={`${prefix}-field-2`}
                  value={v.policy.entryId}
                  maxLength={36}
                  onChange={(e) =>
                    onChange({
                      ...v,
                      policy: { ...v.policy, entryId: e.target.value },
                    })
                  }
                />
              </label>
              <label htmlFor={`${prefix}-field-3`}>
                {t.policyVersion}
                <Input
                  id={`${prefix}-field-3`}
                  value={v.policy.revisionId}
                  maxLength={36}
                  onChange={(e) =>
                    onChange({
                      ...v,
                      policy: { ...v.policy, revisionId: e.target.value },
                    })
                  }
                />
              </label>
            </>
          )}
        </>
      )}
    </fieldset>
  );
}
function ReferenceEditor({
  shopId,
  controller,
  page,
  locale,
  guard,
  onDenied,
}: {
  shopId: string;
  controller: DraftRecovery;
  page: PatternPage;
  locale: Locale;
  guard: OwnerGuard;
  onDenied: () => void;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = manualPatternMessages[locale];
  const prefix = useId();
  const output = "assetId" in s.values;
  const schema = output ? patternReferenceV2DraftSchema : patternDraftSchema;
  const command = output
    ? patternReferenceV2CommandSchema
    : patternCommandSchema;
  const parsed = schema.safeParse(s.values);
  const reference = parsed.success
    ? (page.state.versions.find((v) => v.id === parsed.data.referenceId) ??
      (page.selected?.id === parsed.data.referenceId
        ? page.selected
        : undefined))
    : undefined;
  useEffect(() => {
    if (s.status === "denied" || s.error === "NOT_FOUND") onDenied();
  }, [s.status, s.error, onDenied]);
  const op = parsed.success ? parsed.data.operation : "save";
  return (
    <>
      <Warnings t={t} />
      {s.error === "VERSION_STALE" && <p role="alert">{t.conflict}</p>}
      <DraftForm<PatternDraft | PatternReferenceV2Draft>
        controller={controller}
        schema={schema}
        locale={locale}
        guard={guard}
        canPromote={
          command.safeParse(s.values).success &&
          page.available &&
          parsed.success &&
          page.capability?.[parsed.data.method] === "available"
        }
        promotionLabel={t.save}
      >
        {(form) => (
          <div className="owner-form">
            <label>
              {t.method}
              <select
                className="ui-input"
                aria-label={t.method}
                {...form.register("method")}
                disabled={op === "review" || op === "select"}
              >
                <option
                  value="manual"
                  disabled={page.capability?.manual !== "available"}
                >
                  {t.manual}
                </option>
                <option
                  value="external"
                  disabled={page.capability?.external !== "available"}
                >
                  {t.external}
                </option>
              </select>
            </label>
            {op === "prepare" && <p>{t.preparation}</p>}
            {(op === "review" || op === "select") && reference?.content && (
              <div className="pattern-review-context">
                <dl>
                  <dt>{t.sourceReference}</dt>
                  <dd>{reference.id}</dd>
                  <dt>{t.sourceVersion}</dt>
                  <dd>{reference.content.sourceVersion || t.unknown}</dd>
                  <dt>{t.declaredScale}</dt>
                  <dd>{reference.content.declaredScale || t.unknown}</dd>
                  <dt>{t.assumptions}</dt>
                  <dd>{reference.content.assumptions || t.unknown}</dd>
                  <dt>{t.checks}</dt>
                  <dd>{reference.content.checks || t.unknown}</dd>
                  <dt>{t.sourceInputs}</dt>
                  <dd>
                    {reference.content.design.state === "known"
                      ? reference.content.design.versionId
                      : t.unknown}{" "}
                    ·{" "}
                    {reference.content.measurement.state === "known"
                      ? reference.content.measurement.versionId
                      : t.unknown}
                  </dd>
                  <dt>{t.currentInputs}</dt>
                  <dd>
                    {page.designId ?? t.unknown} ·{" "}
                    {page.measurementId ?? t.unknown}
                  </dd>
                </dl>
              </div>
            )}
            {op === "save" && (
              <>
                {output && (
                  <PatternOutputFields
                    shopId={shopId}
                    page={page}
                    locale={locale}
                    onDenied={onDenied}
                    value={patternReferenceV2DraftSchema.parse(form.watch())}
                    onChange={(p) => {
                      if (p.assetId !== undefined)
                        form.setValue("assetId", p.assetId, {
                          shouldDirty: true,
                        });
                      if (p.reuse !== undefined)
                        form.setValue("reuse", p.reuse, { shouldDirty: true });
                      if (p.method !== undefined)
                        form.setValue("method", p.method, {
                          shouldDirty: true,
                        });
                      if (p.evidence !== undefined)
                        form.setValue("evidence", p.evidence, {
                          shouldDirty: true,
                        });
                      if (p.content !== undefined)
                        form.setValue("content", p.content, {
                          shouldDirty: true,
                        });
                      if (p.acknowledged !== undefined)
                        form.setValue("acknowledged", p.acknowledged, {
                          shouldDirty: true,
                        });
                    }}
                  />
                )}
                <label htmlFor={`${prefix}-field-4`}>
                  {t.locator}
                  <Input
                    id={`${prefix}-field-4`}
                    maxLength={1000}
                    {...form.register("content.locator")}
                  />
                </label>
                <details>
                  <summary>
                    {t.source} · {t.sourceVersion}
                  </summary>
                  <div className="owner-form">
                    <label>
                      {t.sourceKind}
                      <select
                        className="ui-input"
                        aria-label={t.sourceKind}
                        {...form.register("content.sourceKind")}
                      >
                        <option value="unknown">{t.unknown}</option>
                        <option value="shop-created">{t.shopCreated}</option>
                        <option value="customer-provided">{t.provided}</option>
                        <option value="external-supplier">{t.supplier}</option>
                        <option value="other">{t.other}</option>
                      </select>
                    </label>
                    <label htmlFor={`${prefix}-field-5`}>
                      {t.source}
                      <Input
                        id={`${prefix}-field-5`}
                        maxLength={1000}
                        {...form.register("content.source")}
                      />
                    </label>
                    <label htmlFor={`${prefix}-field-6`}>
                      {t.sourceDate}
                      <Input
                        id={`${prefix}-field-6`}
                        type="date"
                        value={form.watch("content.sourceDate") ?? ""}
                        onChange={(e) =>
                          form.setValue(
                            "content.sourceDate",
                            e.target.value || null,
                            { shouldDirty: true },
                          )
                        }
                      />
                    </label>
                    <label htmlFor={`${prefix}-field-7`}>
                      {t.sourceVersion}
                      <Input
                        id={`${prefix}-field-7`}
                        maxLength={160}
                        {...form.register("content.sourceVersion")}
                      />
                    </label>
                    <label>
                      {t.rights}
                      <select
                        className="ui-input"
                        aria-label={t.rights}
                        {...form.register("content.rights")}
                      >
                        <option value="unknown">{t.unknown}</option>
                        <option value="private-fulfilment">{t.private}</option>
                        <option value="shop-owned">{t.owned}</option>
                        <option value="licensed-reuse">{t.licensed}</option>
                      </select>
                    </label>
                    <label>
                      {t.rightsEvidence}
                      <textarea
                        className="ui-input"
                        maxLength={1000}
                        {...form.register("content.rightsEvidence")}
                      />
                    </label>
                  </div>
                </details>
                <InputProvenance
                  kind="design"
                  value={form.watch("content.design")}
                  onChange={(v) =>
                    form.setValue("content.design", v, { shouldDirty: true })
                  }
                  current={page.designId}
                  t={t}
                />
                <InputProvenance
                  kind="measurement"
                  value={form.watch("content.measurement")}
                  onChange={(v) =>
                    form.setValue("content.measurement", v, {
                      shouldDirty: true,
                    })
                  }
                  current={page.measurementId}
                  t={t}
                />
                <label>
                  {t.notes}
                  <textarea
                    className="ui-input"
                    maxLength={2000}
                    {...form.register("content.notes")}
                  />
                </label>
                <details>
                  <summary>{t.assumptions}</summary>
                  <div className="owner-form">
                    <label>
                      {t.units}
                      <select
                        className="ui-input"
                        aria-label={t.units}
                        {...form.register("content.declaredUnits")}
                      >
                        <option value="unknown">{t.unknown}</option>
                        <option value="in">in</option>
                        <option value="cm">cm</option>
                        <option value="mm">mm</option>
                        <option value="mixed">in / cm / mm</option>
                        <option value="other">{t.other}</option>
                      </select>
                    </label>
                    <label htmlFor={`${prefix}-field-8`}>
                      {t.declaredScale}
                      <Input
                        id={`${prefix}-field-8`}
                        maxLength={160}
                        {...form.register("content.declaredScale")}
                      />
                    </label>
                    <label>
                      {t.assumptions}
                      <textarea
                        className="ui-input"
                        maxLength={2000}
                        {...form.register("content.assumptions")}
                      />
                    </label>
                    <label>
                      {t.checks}
                      <textarea
                        className="ui-input"
                        maxLength={2000}
                        {...form.register("content.checks")}
                      />
                    </label>
                  </div>
                </details>
              </>
            )}
            {op === "review" && (
              <>
                <label>
                  {t.reviewState}
                  <select
                    className="ui-input"
                    aria-label={t.reviewState}
                    {...form.register("reviewState")}
                  >
                    <option value="reviewed">{t.reviewed}</option>
                    <option value="changes-required">
                      {t.changesRequired}
                    </option>
                    <option value="withdrawn">{t.withdrawn}</option>
                  </select>
                </label>
                <label>
                  {t.evidence}
                  <textarea
                    className="ui-input"
                    maxLength={2000}
                    {...form.register("evidence")}
                  />
                </label>
              </>
            )}
            {op === "select" && (
              <label>
                {t.use}
                <select
                  className="ui-input"
                  aria-label={t.use}
                  {...form.register("use")}
                >
                  <option value="reference-only">{t.referenceOnly}</option>
                  <option value="inputs-reviewed">{t.inputsReviewed}</option>
                </select>
              </label>
            )}
            <label>
              {t.reason}
              <textarea
                className="ui-input"
                maxLength={1000}
                {...form.register("reason")}
              />
            </label>
            {(op === "review" || op === "select") && (
              <label className="owner-check">
                <input type="checkbox" {...form.register("acknowledged")} />
                {t.acknowledge}
              </label>
            )}
          </div>
        )}
      </DraftForm>
    </>
  );
}
function CapabilityEditor({
  controller,
  locale,
  guard,
}: {
  controller: DraftRecovery;
  locale: Locale;
  guard: OwnerGuard;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = manualPatternMessages[locale];
  return (
    <DraftForm
      controller={controller}
      schema={patternCapabilityDraftSchema}
      locale={locale}
      guard={guard}
      canPromote={patternCapabilityCommandSchema.safeParse(s.values).success}
      promotionLabel={t.saveCapability}
    >
      {(form) => (
        <div className="owner-form">
          {(["manual", "external"] as const).map((k) => (
            <label key={k}>
              {t[k]}
              <select
                className="ui-input"
                aria-label={t[k]}
                {...form.register(k)}
              >
                <option value="not-recorded">{t.notRecorded}</option>
                <option value="available">{t.available}</option>
                <option value="unavailable">{t.unavailable}</option>
              </select>
            </label>
          ))}
          <label>
            {t.reason}
            <textarea
              className="ui-input"
              maxLength={1000}
              {...form.register("reason")}
            />
          </label>
          <label className="owner-check">
            <input type="checkbox" {...form.register("reviewed")} />
            {t.capabilityReview}
          </label>
          <p>{t.automated}</p>
        </div>
      )}
    </DraftForm>
  );
}
function SavedReference({
  shopId,
  onDenied,
  v,
  page,
  locale,
  onAction,
  disabled,
}: {
  shopId: string;
  onDenied: () => void;
  v: PatternVersion;
  page: PatternPage;
  locale: Locale;
  onAction: (v: PatternVersion, op: "save" | "review" | "select") => void;
  disabled: boolean;
}) {
  const t = manualPatternMessages[locale],
    c = page.comparisons.find((c) => c.referenceId === v.id);
  return (
    <article
      className="pattern-reference"
      aria-label={`${t.version} ${v.version}`}
    >
      <h4>
        {t.version} {v.version} · {v.id.slice(-8)}
      </h4>
      <p>
        {v.method === "manual" ? t.manual : t.external} ·{" "}
        {when(v.recordedAt, locale)}
      </p>
      {v.content ? (
        <>
          <dl>
            <dt>{t.locator}</dt>
            <dd>{v.content.locator}</dd>
            <dt>{t.source}</dt>
            <dd>{v.content.source || t.sourceUnknown}</dd>
            <dt>{t.sourceVersion}</dt>
            <dd>{v.content.sourceVersion || t.revisionUnknown}</dd>
            <dt>{t.sourceDate}</dt>
            <dd>{v.content.sourceDate || t.unknown}</dd>
            <dt>{t.rights}</dt>
            <dd>
              {v.content.rights === "licensed-reuse"
                ? t.licensed
                : v.content.rights === "shop-owned"
                  ? t.owned
                  : v.content.rights === "private-fulfilment"
                    ? t.private
                    : t.unknown}
            </dd>
            <dt>{t.rightsEvidence}</dt>
            <dd>{v.content.rightsEvidence || t.notRecorded}</dd>
            <dt>{t.units}</dt>
            <dd>
              {v.content.declaredUnits === "unknown"
                ? t.unknown
                : v.content.declaredUnits}
            </dd>
            <dt>{t.declaredScale}</dt>
            <dd>{v.content.declaredScale || t.unknown}</dd>
            {(["design", "measurement"] as const).map((k) => (
              <div key={k}>
                <dt>{t[k]}</dt>
                <dd>
                  {v.content?.[k].state === "known"
                    ? v.content[k].versionId
                    : v.content?.[k].state === "not-applicable"
                      ? t.notApplicable
                      : t.unknown}
                </dd>
              </div>
            ))}
            <dt>{t.notes}</dt>
            <dd>{v.content.notes || t.notRecorded}</dd>
            <dt>{t.assumptions}</dt>
            <dd>{v.content.assumptions || t.unknown}</dd>
            <dt>{t.checks}</dt>
            <dd>{v.content.checks || t.unknown}</dd>
            <dt>{t.reason}</dt>
            <dd>{v.reason}</dd>
            <dt>{t.by}</dt>
            <dd>{v.actorId}</dd>
          </dl>
          <p>
            {c?.reviewState === "reviewed"
              ? t.reviewed
              : c?.reviewState === "changes-required"
                ? t.changesRequired
                : c?.reviewState === "withdrawn"
                  ? t.withdrawn
                  : t.unreviewed}
          </p>
          <p>
            {c?.inputState === "matched"
              ? t.matched
              : c?.inputState === "mismatch"
                ? t.mismatch
                : t.inputUnknown}
          </p>
          <Warnings t={t} />
          <p>
            {t.sourceReference}: {v.id}
          </p>
          {v.source && (
            <p>
              {t.sourceLineage}: {v.source.referenceId} · {t.sourceInputs}:{" "}
              {v.source.designId ?? t.unknown} ·{" "}
              {v.source.measurementId ?? t.unknown}
            </p>
          )}
          <PatternOutputView
            key={v.id}
            shopId={shopId}
            reference={v}
            locale={locale}
            onDenied={onDenied}
          />
          <div className="owner-actions">
            <Button
              type="button"
              variant="outline"
              disabled={
                disabled || !page.available || v.id !== page.state.latestSavedId
              }
              onClick={() => onAction(v, "save")}
            >
              {t.revise}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || !page.available}
              onClick={() => onAction(v, "review")}
            >
              {t.review}
            </Button>
            <Button
              type="button"
              disabled={
                disabled ||
                !page.available ||
                c?.blocked.includes("path-unavailable") ||
                c?.blocked.includes("governed-work") ||
                ["withdrawn", "changes-required"].includes(c?.reviewState ?? "")
              }
              onClick={() => onAction(v, "select")}
            >
              {t.select}
            </Button>
          </div>
        </>
      ) : (
        <p>{t.denied}</p>
      )}
    </article>
  );
}
function PatternScope({
  shopId,
  orderId,
  pieceId,
  locale,
  guard,
  onEditing,
}: {
  shopId: string;
  orderId: string;
  pieceId: string | null;
  locale: Locale;
  guard: OwnerGuard;
  onEditing: (v: boolean) => void;
}) {
  const t = manualPatternMessages[locale],
    generation = useRef(0),
    scope = useRef<ReturnType<typeof createDraftScope> | undefined>(undefined),
    current = useRef<DraftRecovery | undefined>(undefined);
  const [page, setPage] = useState<PatternPage>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [editor, setEditor] = useState<DraftRecovery>(),
    [workflow, setWorkflow] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [ended, setEnded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadWorking, setUploadWorking] = useState(false);
  useEffect(
    () => onEditing(!!editor || uploadWorking),
    [editor, uploadWorking, onEditing],
  );
  const endAccess = useCallback(() => {
    generation.current++;
    current.current?.invalidate();
    setEditor(undefined);
    setPage(undefined);
    setDrafts([]);
    setEnded(true);
    onEditing(false);
  }, [onEditing]);
  useEffect(() => {
    const own = createDraftScope(shopId, guard);
    scope.current = own;
    const unsubscribe = onOwnerInvalidation(endAccess);
    return () => {
      generation.current++;
      unsubscribe();
      own.dispose();
      scope.current = undefined;
    };
  }, [shopId, guard, endAccess]);
  const load = useCallback(
    async (
      extra: {
        beforeVersion?: number;
        beforeEvent?: number;
        beforeCapability?: number;
      } = {},
    ) => {
      const g = ++generation.current;
      setBusy(true);
      setFailed(false);
      try {
        const p = await readPatterns(shopId, { orderId, pieceId, ...extra }),
          records: DraftRecord[] = [];
        let cursor: DraftCursor | undefined;
        do {
          const d = await scope.current?.list(cursor);
          if (!d) return;
          records.push(...d.drafts);
          cursor = d.next ?? undefined;
        } while (cursor);
        if (g !== generation.current) return;
        setPage((old) => ({
          ...p,
          state: {
            ...p.state,
            versions: extra.beforeVersion
              ? [...(old?.state.versions ?? []), ...p.state.versions]
              : p.state.versions,
            events: extra.beforeEvent
              ? [...(old?.state.events ?? []), ...p.state.events]
              : p.state.events,
          },
          comparisons: extra.beforeVersion
            ? [...(old?.comparisons ?? []), ...p.comparisons]
            : p.comparisons,
          capabilities: extra.beforeCapability
            ? [...(old?.capabilities ?? []), ...p.capabilities]
            : p.capabilities,
        }));
        setDrafts(
          records.filter(
            (d) =>
              d.lifecycle === "active" &&
              [
                "pattern.reference",
                "pattern.capability",
                "pattern.subject",
              ].includes(d.workflow) &&
              (d.workflow !== "pattern.capability"
                ? d.payload.orderId === orderId && d.payload.pieceId === pieceId
                : JSON.stringify(d.payload.binding) ===
                  JSON.stringify(p.binding)),
          ),
        );
      } catch (e) {
        if (g === generation.current) {
          if (denied(e)) endAccess();
          else setFailed(true);
        }
      } finally {
        if (g === generation.current) setBusy(false);
      }
    },
    [shopId, orderId, pieceId, endAccess],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !ended) void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, ended]);
  function open(
    initial: Record<string, unknown>,
    kind: string,
    record?: DraftRecord,
  ) {
    if (
      current.current &&
      !current.current.confirmLeave(() => window.confirm(t.cancel))
    )
      return;
    if (current.current) scope.current?.release(current.current);
    const c = scope.current?.open({
      workflow: kind,
      schemaVersion:
        record?.schemaVersion ?? (kind === "pattern.reference" ? 2 : 1),
      initial,
      ...(record ? { record } : {}),
      editableTargetConflict: true,
      committed: (r) => {
        if (r.lifecycle === "promoted") {
          setRefreshKey((n) => n + 1);
          void load();
        }
      },
    });
    current.current = c;
    setEditor(c);
    setWorkflow(kind);
    onEditing(!!c);
    if (c && kind === "pattern.subject" && !record) void c.save();
  }
  function close() {
    if (
      current.current &&
      !current.current.confirmLeave(() => window.confirm(t.cancel))
    )
      return;
    if (current.current) scope.current?.release(current.current);
    current.current = undefined;
    setEditor(undefined);
    onEditing(false);
    void load();
  }
  function start(
    v?: PatternVersion,
    operation: PatternDraft["operation"] = "save",
  ) {
    if (!page) return;
    const initial: PatternReferenceV2Draft = {
      ...emptyPatternDraft(
        { orderId, pieceId },
        page.customerId,
        page.wearerId,
      ),
      assetId:
        v?.output && !v.source && operation === "save"
          ? v.output.assetId
          : null,
      reuse: null,
    };
    Object.assign(initial, {
      baseVersion: page.state.version,
      baseSavedId: page.state.latestSavedId,
      operation,
      method:
        v?.method ??
        page.state.method ??
        (page.capability?.manual === "available" ? "manual" : "external"),
    });
    if (v?.content && operation === "save")
      initial.content = structuredClone(v.content);
    if (v && (operation === "review" || operation === "select")) {
      setBusy(true);
      const g = generation.current;
      void comparePattern(shopId, { orderId, pieceId, referenceId: v.id })
        .then((c) => {
          if (g !== generation.current) return;
          setPage((old) =>
            old
              ? {
                  ...old,
                  designId: c.designId,
                  measurementId: c.measurementId,
                  comparisons: [
                    ...old.comparisons.filter(
                      (r) => r.referenceId !== c.referenceId,
                    ),
                    c,
                  ],
                }
              : old,
          );
          open(
            { ...initial, referenceId: v.id, digest: c.digest },
            "pattern.reference",
          );
        })
        .catch((e) => {
          if (g === generation.current) {
            if (denied(e)) endAccess();
            else setFailed(true);
          }
        })
        .finally(() => {
          if (g === generation.current) setBusy(false);
        });
    } else open(initial, "pattern.reference");
  }
  return (
    <div className="owner-form">
      <Button
        type="button"
        variant="outline"
        disabled={busy || ended}
        onClick={() => void load()}
      >
        {t.refresh}
      </Button>
      {busy && <p role="status">{t.loading}</p>}
      {failed && <p role="alert">{t.failed}</p>}
      {ended && <p role="alert">{t.denied}</p>}
      {page && !ended && (
        <>
          <h3>{t.capability}</h3>
          <p>{t.automated}</p>
          {!page.available && <p role="status">{t.warningAvailability}</p>}
          {page.capability ? (
            <dl>
              <dt>{t.manual}</dt>
              <dd>
                {page.capability.manual === "available"
                  ? t.available
                  : page.capability.manual === "unavailable"
                    ? t.unavailable
                    : t.notRecorded}
              </dd>
              <dt>{t.external}</dt>
              <dd>
                {page.capability.external === "available"
                  ? t.available
                  : page.capability.external === "unavailable"
                    ? t.unavailable
                    : t.notRecorded}
              </dd>
            </dl>
          ) : (
            <p>{t.unconfigured}</p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy || !!editor || !page.available}
            onClick={() => {
              const v: PatternCapabilityDraft = {
                binding: page.binding,
                baseVersion: page.capability?.version ?? 0,
                manual: page.capability?.manual ?? "not-recorded",
                external: page.capability?.external ?? "not-recorded",
                reason: "",
                reviewed: false,
              };
              open(v, "pattern.capability");
            }}
          >
            {t.configure}
          </Button>
          {!page.state.latestSavedId && (
            <p>{page.state.version ? t.pending : t.empty}</p>
          )}
          <Warnings t={t} />
          <PatternUploads
            onWorking={setUploadWorking}
            shopId={shopId}
            scope={{ orderId, pieceId }}
            locale={locale}
            guard={guard}
            refreshKey={refreshKey}
            onDenied={endAccess}
            disabled={busy || !!editor}
            onPrepare={() =>
              open(
                {
                  orderId,
                  pieceId,
                  customerId: page.customerId,
                  wearerId: page.wearerId,
                  erased: false,
                },
                "pattern.subject",
              )
            }
          />
          {!editor && (
            <div className="owner-actions">
              <Button
                type="button"
                disabled={
                  busy ||
                  !page.available ||
                  (page.capability?.manual !== "available" &&
                    page.capability?.external !== "available")
                }
                onClick={() => start()}
              >
                {t.new}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy ||
                  !page.available ||
                  (page.capability?.manual !== "available" &&
                    page.capability?.external !== "available")
                }
                onClick={() => start(undefined, "prepare")}
              >
                {t.prepare}
              </Button>
            </div>
          )}
          {editor && (
            <>
              <h3>
                {workflow === "pattern.capability" ? t.capability : t.title}
              </h3>
              {workflow === "pattern.capability" ? (
                <CapabilityEditor
                  controller={editor}
                  locale={locale}
                  guard={guard}
                />
              ) : workflow === "pattern.subject" ? (
                <DraftForm
                  controller={editor}
                  schema={patternSubjectDraftSchema}
                  locale={locale}
                  guard={guard}
                  promotionLabel={t.prepareOutput}
                >
                  {() => <p>{t.prepareOutputHelp}</p>}
                </DraftForm>
              ) : (
                <ReferenceEditor
                  shopId={shopId}
                  controller={editor}
                  page={page}
                  locale={locale}
                  guard={guard}
                  onDenied={endAccess}
                />
              )}
              <Button type="button" variant="outline" onClick={close}>
                {t.cancel}
              </Button>
            </>
          )}
          {!editor && drafts.length > 0 && (
            <details>
              <summary>{t.drafts}</summary>
              {drafts.map((d) => (
                <Button
                  key={d.id}
                  type="button"
                  variant="outline"
                  onClick={() => open(d.payload, d.workflow, d)}
                >
                  {t.resume} · {when(d.updatedAt, locale)}
                </Button>
              ))}
            </details>
          )}
          <h3>{t.selected}</h3>
          {page.selected ? (
            <SavedReference
              shopId={shopId}
              onDenied={endAccess}
              v={page.selected}
              page={page}
              locale={locale}
              onAction={start}
              disabled={busy || !!editor}
            />
          ) : (
            <p>{t.notRecorded}</p>
          )}
          <details>
            <summary>{t.recorded}</summary>
            {page.state.versions.map((v) => (
              <SavedReference
                shopId={shopId}
                onDenied={endAccess}
                key={v.id}
                v={v}
                page={page}
                locale={locale}
                onAction={start}
                disabled={busy || !!editor}
              />
            ))}
            {page.state.nextVersion !== null && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void load({
                    beforeVersion: page.state.nextVersion ?? 0,
                  })
                }
              >
                {t.moreVersions}
              </Button>
            )}
          </details>
          <details>
            <summary>{t.history}</summary>
            <ol>
              {page.state.events.map((e) => (
                <li key={e.id}>
                  <p>
                    {e.operation === "prepare"
                      ? t.operationPrepare
                      : e.operation === "save"
                        ? t.operationSave
                        : e.operation === "review"
                          ? t.operationReview
                          : t.operationSelect}{" "}
                    · {when(e.recordedAt, locale)}
                  </p>
                  <p>
                    {e.reason} {e.evidence}
                  </p>
                  {e.referenceId && <p>{e.referenceId}</p>}
                  <p>{e.actorId}</p>
                  {e.operation === "review" && (
                    <p>
                      {e.reviewState === "reviewed"
                        ? t.reviewed
                        : e.reviewState === "changes-required"
                          ? t.changesRequired
                          : t.withdrawn}
                    </p>
                  )}
                  {e.operation === "select" && (
                    <p>
                      {e.use === "reference-only"
                        ? t.referenceOnly
                        : t.inputsReviewed}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {page.state.nextEvent !== null && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void load({ beforeEvent: page.state.nextEvent ?? 0 })
                }
              >
                {t.moreEvents}
              </Button>
            )}
          </details>
          <details>
            <summary>{t.capability}</summary>
            <ol>
              {page.capabilities.map((c) => (
                <li key={c.id}>
                  {when(c.recordedAt, locale)} · {c.reason}
                  <p>
                    {t.manual}:{" "}
                    {c.manual === "available"
                      ? t.available
                      : c.manual === "unavailable"
                        ? t.unavailable
                        : t.notRecorded}{" "}
                    · {t.external}:{" "}
                    {c.external === "available"
                      ? t.available
                      : c.external === "unavailable"
                        ? t.unavailable
                        : t.notRecorded}
                  </p>
                </li>
              ))}
            </ol>
            {page.nextCapability !== null && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void load({ beforeCapability: page.nextCapability ?? 0 })
                }
              >
                {t.moreCapabilities}
              </Button>
            )}
          </details>
        </>
      )}
    </div>
  );
}
export function ManualPatterns({
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
  const t = manualPatternMessages[locale],
    prefix = useId();
  const [opened, setOpened] = useState(false),
    [pieces, setPieces] = useState<OrderPieces>(),
    [pieceId, setPieceId] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!opened) return;
    let active = true;
    void readOrderPieces(shopId, order.id)
      .then((p) => {
        if (active) setPieces(p);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    const unsubscribe = onOwnerInvalidation(() => {
      active = false;
      setPieces(undefined);
      setOpened(false);
      setEditing(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [opened, shopId, order.id]);
  return (
    <section aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`}>{t.title}</h2>
      <Button
        type="button"
        variant="outline"
        disabled={editing}
        aria-expanded={opened}
        onClick={() => setOpened((v) => !v)}
      >
        {opened ? t.close : t.open}
      </Button>
      {opened && (
        <>
          <label>
            {t.scope}
            <select
              className="ui-input"
              aria-label={t.scope}
              disabled={editing || !pieces}
              value={pieceId ?? ""}
              onChange={(e) => setPieceId(e.target.value || null)}
            >
              <option value="">{t.whole}</option>
              {pieces?.identities.map((p) => (
                <option key={p.id} value={p.id}>
                  {(() => {
                    const d = pieces.structure?.pieces.find(
                      (d) => d.key === p.key,
                    );
                    return d
                      ? locale === "ta"
                        ? d.labelTa
                        : d.labelEn
                      : p.key;
                  })()}
                </option>
              ))}
            </select>
          </label>
          {failed && <p role="alert">{t.failed}</p>}
          <PatternScope
            key={`${shopId}:${order.id}:${pieceId}`}
            shopId={shopId}
            orderId={order.id}
            pieceId={pieceId}
            locale={locale}
            guard={guard}
            onEditing={setEditing}
          />
        </>
      )}
    </section>
  );
}
