/** biome-ignore-all lint/suspicious/noArrayIndexKey: Fully controlled peak rows have no local state. */
import { onOwnerInvalidation } from "@aarili/api/client";
import {
  readCatalogueRevision,
  readServiceCatalogue,
} from "@aarili/api/service-catalogue-client";
import { readShopCalendarHistory } from "@aarili/api/shop-calendar-client";
import {
  previewBoundShopCommitments,
  previewShopCommitments,
  readCommitmentBinding,
  readCommitmentBindingHistory,
  readCommitmentBindingRevision,
  readShopCommitments,
  readShopCommitmentsHistory,
  readShopCommitmentsRevision,
} from "@aarili/api/shop-commitments-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type BoundCommitmentPreview,
  type CommitmentBindingDraft,
  type CommitmentBindingRevision,
  type CommitmentConfiguration,
  type CommitmentPreview,
  type CommitmentScenario,
  commitmentBindingCommandSchema,
  commitmentBindingDraftSchema,
  commitmentErrors,
  commitmentPreviewInputSchema,
  initialCommitmentConfiguration,
  initialCommitmentScenario,
  type ShopCommitmentsDraft,
  type ShopCommitmentsRevision,
  shopCommitmentsCommandSchema,
  shopCommitmentsDraftSchema,
  syntheticCommitmentConfiguration,
} from "@aarili/contracts/shop-commitments";
import { Button } from "@aarili/ui/components/button";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type T = ReturnType<typeof useTranslations<"commitments">>;
type State = Awaited<ReturnType<typeof readShopCommitments>>;
function address(id?: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("section", "commitments");
  if (id) u.searchParams.set("draft", id);
  else u.searchParams.delete("draft");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}
function ConfigurationView({
  value,
  t,
}: {
  value: CommitmentConfiguration;
  t: T;
}) {
  return (
    <dl className="shop-profile-values">
      {Object.entries(value)
        .filter(([k]) => k !== "peaks")
        .map(([k, v]) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd>
              {v === null || v === ""
                ? t("unresolved")
                : typeof v === "string" &&
                    [
                      "calendar",
                      "production",
                      "owner-proposal",
                      "synthetic-fixture",
                      "none",
                      "manual-owner-review",
                      "unconfigured",
                      "garments",
                      "effort-points",
                      "delivery-date",
                      "closed-capacity",
                      "all-matching-delivery-ranges",
                      "after-cutoff",
                    ].includes(v)
                  ? t(v)
                  : String(v)}
            </dd>
          </div>
        ))}
      {value.peaks.map((p, i) => (
        <div key={i}>
          <dt>
            {t("peaks")}: {p.label}
          </dt>
          <dd>
            {p.start} — {p.end}; {t("cutoffDate")}: {p.cutoffDate}{" "}
            {p.cutoffTime}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function Editor({
  controller,
  published,
  compare,
  rebase,
  t,
}: {
  controller: DraftRecovery;
  published: State;
  compare: () => Promise<void>;
  rebase: (v: ShopCommitmentsDraft) => void;
  t: T;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [review, setReview] = useState(false),
    [compared, setCompared] = useState(false),
    [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) {
      reviewHeading.current?.focus();
      reviewHeading.current?.scrollIntoView({ block: "start" });
    }
  }, [review]);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "start" });
  }, []);
  const parsed = shopCommitmentsDraftSchema.safeParse(s.values);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("incompatible")}</p>;
  const v = parsed.data,
    c = v.configuration;
  const inactive = !!s.committed && s.committed.lifecycle !== "active";
  const busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  const errors = commitmentErrors(c);
  const edit = (configuration: CommitmentConfiguration) => {
    setReview(false);
    setCompared(false);
    controller.edit({ ...v, configuration });
  };
  const change = <K extends keyof CommitmentConfiguration>(
    key: K,
    value: CommitmentConfiguration[K],
  ) => edit({ ...c, [key]: value });
  const numeric = (key: "warningDays" | "leadDays" | "cap" | "weekStart") => (
    <label className="commitment-field" key={key} htmlFor={`commit-${key}`}>
      {t(key)}
      <Input
        id={`commit-${key}`}
        type="number"
        value={c[key] ?? ""}
        aria-invalid={errors.includes(key)}
        aria-describedby={errors.includes(key) ? `error-${key}` : undefined}
        onChange={(e) =>
          change(key, e.target.value === "" ? null : Number(e.target.value))
        }
      />
      {errors.includes(key) && (
        <span id={`error-${key}`}>{t("validationHelp")}</span>
      )}
    </label>
  );
  const select = <K extends keyof CommitmentConfiguration>(
    key: K,
    options: string[],
  ) => (
    <label className="commitment-field" key={key} htmlFor={`commit-${key}`}>
      {t(String(key))}
      <select
        className="ui-input"
        id={`commit-${key}`}
        value={String(c[key] ?? "")}
        onChange={(e) =>
          change(key, (e.target.value || null) as CommitmentConfiguration[K])
        }
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(o || "unresolved")}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section
      className="shop-profile-form commitment-editor"
      aria-label={t("editor")}
    >
      <h3 ref={heading} tabIndex={-1}>
        {t("edit")}
      </h3>
      <p role="status">
        {t(s.status)}
        {s.error
          ? ` · ${t(s.error === "RATE_LIMITED" ? "rateLimited" : "saveError")}`
          : ""}
      </p>
      {inactive && (
        <>
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
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void controller.save();
        }}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <fieldset disabled={busy}>
          <legend>{t("configuration")}</legend>
          <label className="commitment-field" htmlFor="commit-ruleLabel">
            {t("ruleLabel")}
            <Input
              id="commit-ruleLabel"
              value={c.ruleLabel}
              maxLength={200}
              onChange={(e) => change("ruleLabel", e.target.value)}
            />
          </label>
          {select("authority", ["owner-proposal", "synthetic-fixture"])}
          {numeric("warningDays")}
          {select("warningBasis", ["calendar", "production"])}
          {select("escalation", [
            "unconfigured",
            "manual-owner-review",
            "none",
          ])}
          {numeric("leadDays")}
          {select("leadBasis", ["", "calendar", "production"])}
          {numeric("cap")}
          {select("unit", ["", "garments", "effort-points"])}
          {numeric("weekStart")}
          {select("allocation", ["", "delivery-date"])}
          {select("zeroCap", ["", "closed-capacity"])}
          {select("peakConvention", ["", "all-matching-delivery-ranges"])}
          {select("cutoffBoundary", ["", "after-cutoff"])}
          <label className="commitment-field" htmlFor="commit-rushPaise">
            {t("rushPaise")}
            <Input
              id="commit-rushPaise"
              inputMode="numeric"
              maxLength={32}
              value={c.rushPaise ?? ""}
              aria-invalid={errors.includes("rushPaise")}
              aria-describedby={
                errors.includes("rushPaise") ? "rush-error" : undefined
              }
              onChange={(e) => change("rushPaise", e.target.value || null)}
            />
            {errors.includes("rushPaise") && (
              <span id="rush-error">{t("validationHelp")}</span>
            )}
          </label>
          <fieldset>
            <legend>{t("peaks")}</legend>
            {c.peaks.map((p, i) => (
              <fieldset key={i}>
                <legend>{p.label || t("peaks")}</legend>
                {(
                  ["label", "start", "end", "cutoffDate", "cutoffTime"] as const
                ).map((key) => (
                  <label
                    className="commitment-field"
                    key={key}
                    htmlFor={`peak-${i}-${key}`}
                  >
                    {t(key)}
                    <Input
                      id={`peak-${i}-${key}`}
                      type={
                        key === "label"
                          ? "text"
                          : key === "cutoffTime"
                            ? "time"
                            : "date"
                      }
                      value={p[key]}
                      onChange={(e) =>
                        change(
                          "peaks",
                          c.peaks.map((r, n) =>
                            n === i ? { ...r, [key]: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    change(
                      "peaks",
                      c.peaks.filter((_, n) => n !== i),
                    )
                  }
                >
                  {t("removePeak")}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={c.peaks.length >= 32}
              onClick={() =>
                change("peaks", [
                  ...c.peaks,
                  {
                    label: "",
                    start: "",
                    end: "",
                    cutoffDate: "",
                    cutoffTime: "",
                  },
                ])
              }
            >
              {t("addPeak")}
            </Button>
            {errors.includes("peaks") && <p role="alert">{t("invalidDate")}</p>}
          </fieldset>
          <Button
            type="button"
            variant="outline"
            onClick={() => edit(syntheticCommitmentConfiguration())}
          >
            {t("fixture")}
          </Button>
          <p>{t("fixtureHelp")}</p>
        </fieldset>
        {!inactive && (
          <div className="calendar-actions">
            <Button type="submit" variant="outline" disabled={busy}>
              {t("saveDraft")}
            </Button>
            <Button
              type="button"
              disabled={busy || errors.length > 0}
              onClick={() => setReview(true)}
            >
              {t("reviewConfig")}
            </Button>
          </div>
        )}
      </form>
      {s.work.outcomeUnknown && (
        <Button
          onClick={() => void controller.retry()}
          disabled={s.work.inFlight}
        >
          {t("retry")}
        </Button>
      )}
      {s.status === "conflict" && (
        <section className="shop-profile-history">
          <h4>{t("conflict")}</h4>
          <p>{t("conflictHelp")}</p>
          <Button
            onClick={() =>
              void (async () => {
                try {
                  await compare();
                  await controller.refreshConflict();
                  setCompared(true);
                } catch {
                  setFailed(true);
                }
              })()
            }
          >
            {t("compare")}
          </Button>
          <h5>{t("yourChanges")}</h5>
          <ConfigurationView value={c} t={t} />
          {s.conflict && (
            <>
              <h5>{t("serverDraft")}</h5>
              {shopCommitmentsDraftSchema.safeParse(s.conflict.payload)
                .success && (
                <ConfigurationView
                  value={
                    shopCommitmentsDraftSchema.parse(s.conflict.payload)
                      .configuration
                  }
                  t={t}
                />
              )}
              <Button onClick={() => controller.resolveConflict("server")}>
                {t("useServer")}
              </Button>
              <Button
                disabled={s.conflict.lifecycle !== "active"}
                onClick={() => controller.resolveConflict("local")}
              >
                {t("keepLocal")}
              </Button>
            </>
          )}
          {compared && (
            <>
              <h5>{t("published")}</h5>
              {published.revision && (
                <ConfigurationView
                  value={published.revision.configuration}
                  t={t}
                />
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
      {failed && <p role="alert">{t("loadError")}</p>}
      {review && (
        <section
          className="shop-profile-history"
          aria-label={t("reviewConfig")}
        >
          <h4 ref={reviewHeading} tabIndex={-1}>
            {t("reviewConfig")}
          </h4>
          <p>{t("reviewScope")}</p>
          <ConfigurationView value={c} t={t} />
          <Button
            disabled={
              busy ||
              s.work.dirty ||
              s.status !== "saved" ||
              !shopCommitmentsCommandSchema.safeParse(v).success
            }
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
function Preview({
  shopId,
  draft,
  revisions,
  t,
  bindingId,
}: {
  shopId: string;
  draft: ShopCommitmentsDraft;
  revisions: ShopCommitmentsRevision[];
  t: T;
  bindingId?: string;
}) {
  const [s, setS] = useState<CommitmentScenario>(() => ({
      ...initialCommitmentScenario(),
      ...(bindingId
        ? { mode: "production" as const, quantity: null, unit: null }
        : {}),
    })),
    [source, setSource] = useState("draft"),
    [calendarId, setCalendarId] = useState("");
  const [calendars, setCalendars] = useState<{ id: string; version: number }[]>(
      [],
    ),
    [result, setResult] = useState<
      CommitmentPreview | BoundCommitmentPreview
    >(),
    [evaluated, setEvaluated] = useState("");
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [calendarFailed, setCalendarFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void readShopCalendarHistory(shopId)
      .then((r) => {
        if (mounted.current) setCalendars(r.revisions);
      })
      .catch(() => {
        if (mounted.current) setCalendarFailed(true);
      });
    return () => {
      mounted.current = false;
    };
  }, [shopId]);
  const input = {
    source:
      source === "draft"
        ? { kind: "draft" as const, draft }
        : { kind: "revision" as const, revisionId: source },
    calendarRevisionId: calendarId || null,
    scenario: s,
    previousFingerprint: result?.fingerprint ?? null,
  };
  const fingerprint = JSON.stringify({ ...input, previousFingerprint: null });
  const parsed = commitmentPreviewInputSchema.safeParse(input);
  const change = <K extends keyof CommitmentScenario>(
    key: K,
    value: CommitmentScenario[K],
  ) => setS((v) => ({ ...v, [key]: value }));
  return (
    <section className="shop-profile-history commitment-preview">
      <h3>{t("previewTitle")}</h3>
      <p>{t(bindingId ? "bindingBoundary" : "boundary")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed.success || busy) {
            setFailed(true);
            return;
          }
          setBusy(true);
          setFailed(false);
          const tested = fingerprint;
          void (
            bindingId
              ? previewBoundShopCommitments(shopId, {
                  contractVersion: 2,
                  bindingId,
                  calendarRevisionId: calendarId || null,
                  scenario: s,
                  previousFingerprint: result?.fingerprint ?? null,
                })
              : previewShopCommitments(shopId, parsed.data)
          )
            .then((r) => {
              if (mounted.current) {
                setResult(r);
                setEvaluated(tested);
              }
            })
            .catch(() => {
              if (mounted.current) {
                setFailed(true);
                if (bindingId) setResult(undefined);
              }
            })
            .finally(() => {
              if (mounted.current) setBusy(false);
            });
        }}
      >
        {!bindingId && (
          <label
            className="commitment-field"
            htmlFor={`${bindingId ? "bound-" : ""}preview-source`}
          >
            {t("previewSource")}
            <select
              className="ui-input"
              id={`${bindingId ? "bound-" : ""}preview-source`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="draft">{t("proposed")}</option>
              {revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {t("version", { version: r.version })}
                </option>
              ))}
            </select>
          </label>
        )}
        <label
          className="commitment-field"
          htmlFor={`${bindingId ? "bound-" : ""}preview-calendar`}
        >
          {t("calendarVersion")}
          <select
            className="ui-input"
            id={`${bindingId ? "bound-" : ""}preview-calendar`}
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
          >
            <option value="">{t("currentCalendar")}</option>
            {calendars.map((r) => (
              <option key={r.id} value={r.id}>
                {t("version", { version: r.version })}
              </option>
            ))}
          </select>
        </label>
        {calendarFailed && <p role="alert">{t("loadError")}</p>}
        {!bindingId && (
          <>
            <label
              className="commitment-field"
              htmlFor={`${bindingId ? "bound-" : ""}preview-mode`}
            >
              {t("mode")}
              <select
                className="ui-input"
                id={`${bindingId ? "bound-" : ""}preview-mode`}
                value={s.mode}
                onChange={(e) =>
                  change(
                    "mode",
                    e.target.value === "synthetic" ? "synthetic" : "production",
                  )
                }
              >
                <option value="synthetic">{t("synthetic")}</option>
                <option value="production">{t("productionMode")}</option>
              </select>
            </label>
            <label
              className="commitment-field"
              htmlFor={`${bindingId ? "bound-" : ""}preview-fixture`}
            >
              {t("fixtureKind")}
              <select
                className="ui-input"
                id={`${bindingId ? "bound-" : ""}preview-fixture`}
                value={s.fixture}
                onChange={(e) =>
                  change(
                    "fixture",
                    e.target.value === "peak-cap-rush"
                      ? "peak-cap-rush"
                      : "missing-load",
                  )
                }
              >
                <option value="peak-cap-rush">{t("peak-cap-rush")}</option>
                <option value="missing-load">{t("missing-load")}</option>
              </select>
            </label>
          </>
        )}
        {(
          [
            "today",
            "nowTime",
            "bookingDate",
            "bookingTime",
            "deliveryDate",
            "deliveryTime",
          ] as const
        ).map((key) => (
          <label
            className="commitment-field"
            key={key}
            htmlFor={`${bindingId ? "bound-" : ""}preview-${key}`}
          >
            {t(key)}
            <Input
              id={`${bindingId ? "bound-" : ""}preview-${key}`}
              type={key.endsWith("Time") ? "time" : "date"}
              value={s[key] ?? ""}
              aria-invalid={
                !parsed.success &&
                parsed.error.issues.some((i) => i.path.includes(key))
              }
              onChange={(e) =>
                change(
                  key,
                  e.target.value || (key === "deliveryTime" ? null : ""),
                )
              }
            />
          </label>
        ))}
        {!bindingId && (
          <>
            <label
              className="commitment-field"
              htmlFor={`${bindingId ? "bound-" : ""}preview-quantity`}
            >
              {t("quantity")}
              <Input
                id={`${bindingId ? "bound-" : ""}preview-quantity`}
                type="number"
                value={s.quantity ?? ""}
                onChange={(e) =>
                  change(
                    "quantity",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label
              className="commitment-field"
              htmlFor={`${bindingId ? "bound-" : ""}preview-unit`}
            >
              {t("unit")}
              <select
                className="ui-input"
                id={`${bindingId ? "bound-" : ""}preview-unit`}
                value={s.unit ?? ""}
                onChange={(e) =>
                  change(
                    "unit",
                    e.target.value === "garments"
                      ? "garments"
                      : e.target.value === "effort-points"
                        ? "effort-points"
                        : null,
                  )
                }
              >
                {["", "garments", "effort-points"].map((v) => (
                  <option key={v} value={v}>
                    {t(v || "unresolved")}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label
          className="commitment-field"
          htmlFor={`${bindingId ? "bound-" : ""}preview-priority`}
        >
          {t("priority")}
          <select
            className="ui-input"
            id={`${bindingId ? "bound-" : ""}preview-priority`}
            value={s.priority}
            onChange={(e) =>
              change("priority", e.target.value === "rush" ? "rush" : "normal")
            }
          >
            <option value="normal">{t("normal")}</option>
            <option value="rush">{t("rush")}</option>
          </select>
        </label>
        <label
          className="commitment-field"
          htmlFor={`${bindingId ? "bound-" : ""}preview-occasion`}
        >
          {t("occasion")}
          <Input
            id={`${bindingId ? "bound-" : ""}preview-occasion`}
            maxLength={160}
            value={s.occasion}
            onChange={(e) => change("occasion", e.target.value)}
          />
        </label>
        {(["acknowledge", "review", "waiver"] as const).map((key) => (
          <label key={key} className="directory-check">
            <input
              type="checkbox"
              checked={s[key]}
              onChange={(e) => change(key, e.target.checked)}
            />
            {t(key)}
          </label>
        ))}
        {(["exceptionReason", "waiverReason"] as const).map((key) => (
          <label
            className="commitment-field"
            key={key}
            htmlFor={`${bindingId ? "bound-" : ""}preview-${key}`}
          >
            {t(key)}
            <Input
              id={`${bindingId ? "bound-" : ""}preview-${key}`}
              maxLength={1000}
              value={s[key]}
              onChange={(e) => change(key, e.target.value)}
            />
          </label>
        ))}
        {!parsed.success && <p role="alert">{t("validationHelp")}</p>}
        {failed && <p role="alert">{t("previewError")}</p>}
        <Button type="submit" disabled={busy || !parsed.success}>
          {t("preview")}
        </Button>
      </form>
      {result && (
        <section aria-live="polite" className="shop-profile-history">
          <h4>{t(result.state)}</h4>
          {evaluated !== fingerprint && <p role="status">{t("changed")}</p>}
          {result.stale && <p>{t("stale")}</p>}
          <h5>{t("warnings")}</h5>
          <ul>
            {result.warnings.map((w) => (
              <li key={w}>{t(w)}</li>
            ))}
          </ul>
          <h5>{t("unknowns")}</h5>
          <ul>
            {result.unknowns.map((w) => (
              <li key={w}>{t(w)}</li>
            ))}
          </ul>
          <h5>{t("facts")}</h5>
          <dl className="shop-profile-values">
            {Object.entries(result.facts)
              .filter(([k]) => k !== "cutoffs")
              .map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {t(
                      k === "leadDays"
                        ? "availableLead"
                        : k === "weekStart"
                          ? "capacityWeekStart"
                          : k,
                    )}
                  </dt>
                  <dd>
                    {v === null
                      ? t("unresolved")
                      : typeof v === "boolean"
                        ? t(v ? "rush" : "normal")
                        : k === "unit"
                          ? t(String(v))
                          : String(v)}
                  </dd>
                </div>
              ))}
            {result.facts.cutoffs.map((p) => (
              <div key={`${p.label}-${p.date}-${p.time}`}>
                <dt>
                  {t("cutoffs")}: {p.label}
                </dt>
                <dd>
                  {p.date} {p.time}
                </dd>
              </div>
            ))}
          </dl>
          <h5>{t("decisions")}</h5>
          <p>{t(result.decisions.state)}</p>
          <ul>
            {result.decisions.errors.map((e) => (
              <li key={e}>{t(e)}</li>
            ))}
          </ul>
          <p>{t("effects")}</p>
          {"authority" in result && (
            <p>
              {t(
                result.authority === "owner-reviewed"
                  ? "bindingReviewed"
                  : "bindingPending",
              )}
            </p>
          )}
          <details>
            <summary>{t("versions")}</summary>
            <dl className="shop-profile-values">
              {Object.entries(result.sources)
                .filter(([k]) => k !== "synthetic")
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      {t(k === "configuration" ? "configurationSource" : k)}
                    </dt>
                    <dd>{v ?? t("unresolved")}</dd>
                  </div>
                ))}
            </dl>
          </details>
        </section>
      )}
    </section>
  );
}
export function ShopCommitmentsScreen({
  shopId,
  queries,
  guard,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const t = useTranslations("commitments"),
    locale = useLocale();
  const [session, setSession] = useState<{
    scope: ReturnType<typeof createDraftScope>;
    alive: () => boolean;
  }>();
  const [state, setState] = useState<State>(),
    [controller, setController] = useState<DraftRecovery>();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<DraftCursor | null>(null);
  const [history, setHistory] = useState<ShopCommitmentsRevision[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false),
    [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry recreates the complete effect-owned draft scope and initial reads.
  useEffect(() => {
    setState(undefined);
    setController(undefined);
    setDrafts([]);
    setHistory([]);
    setFailed(false);
    setDenied(false);
    let mounted = true;
    const version = queries.version(),
      scope = createDraftScope(shopId, guard);
    const alive = () => mounted && queries.isCurrent(version);
    setSession({ scope, alive });
    const committed = (r: DraftRecord) => {
      if (!alive()) return;
      if (r.lifecycle === "active") address(r.id);
      else if (r.lifecycle === "promoted") {
        address();
        void readShopCommitments(shopId)
          .then((v) => {
            if (alive()) setState(v);
          })
          .catch(() => {
            if (alive()) setFailed(true);
          });
      }
    };
    void (async () => {
      try {
        const [current, list] = await Promise.all([
          readShopCommitments(shopId),
          scope.list(),
        ]);
        if (!alive()) return;
        setState(current);
        setDrafts(list.drafts);
        setCursor(list.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive()) return;
          if (record.workflow === "service.commitment-bindings") return;
          if (
            record.workflow !== "shop.commitments" ||
            record.schemaVersion !== 1 ||
            !shopCommitmentsDraftSchema.safeParse(record.payload).success
          ) {
            setFailed(true);
            return;
          }
          setController(
            scope.open({
              workflow: "shop.commitments",
              schemaVersion: 1,
              initial: record.payload,
              record,
              committed,
            }),
          );
        }
      } catch {
        if (alive()) setFailed(true);
      }
    })();
    const invalidate = onOwnerInvalidation(() => {
      setDenied(true);
      setState(undefined);
      setDrafts([]);
      setHistory([]);
      setController(undefined);
    });
    return () => {
      mounted = false;
      invalidate();
      scope.dispose();
    };
  }, [shopId, queries, guard, attempt]);
  const refresh = async () => {
    const v = await readShopCommitments(shopId);
    if (session?.alive()) setState(v);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      if (session?.alive()) setFailed(true);
    } finally {
      if (session?.alive()) setBusy(false);
    }
  };
  const open = (
    v: ShopCommitmentsDraft,
    record?: DraftRecord,
    preserving = false,
  ) => {
    if (
      !session?.alive() ||
      (controller &&
        !preserving &&
        !controller.confirmLeave(() => window.confirm(t("discard"))))
    )
      return;
    if (controller) session.scope.release(controller);
    const c = session.scope.open({
      workflow: "shop.commitments",
      schemaVersion: 1,
      initial: v,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!session.alive()) return;
        if (r.lifecycle === "active") address(r.id);
        if (r.lifecycle === "promoted") {
          address();
          void run(refresh);
        }
      },
    });
    setController(c);
    if (record) address(record.id);
    else {
      address();
      c.edit(v);
    }
  };
  const retryLoad = () => {
    if (
      !controller ||
      controller.confirmLeave(() => window.confirm(t("discard")))
    )
      setAttempt((v) => v + 1);
  };
  if (denied) return <p role="alert">{t("denied")}</p>;
  if (!state || !session)
    return (
      <div>
        <p role="status">{t(failed ? "loadError" : "loading")}</p>
        {failed && <Button onClick={retryLoad}>{t("retryLoad")}</Button>}
      </div>
    );
  const currentDraft: ShopCommitmentsDraft = {
    baseVersion: state.version,
    baseRevisionId: state.revision?.id ?? null,
    configuration:
      state.revision?.configuration ?? initialCommitmentConfiguration(),
  };
  return (
    <section className="shop-settings-main">
      <h2>{t("title")}</h2>
      <p>{t("intro")}</p>
      <p>{t("bindingBoundary")}</p>
      <p>{t("timezone")}</p>
      <CommitmentBindingsPanel
        shopId={shopId}
        queries={queries}
        guard={guard}
        rule={state.revision}
        t={t}
      />
      {failed && (
        <>
          <p role="alert">{t("loadError")}</p>
          <Button onClick={retryLoad}>{t("retryLoad")}</Button>
        </>
      )}
      <p>
        {state.revision
          ? t("version", { version: state.version })
          : t("unconfigured")}
      </p>
      <div className="calendar-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          {t("refresh")}
        </Button>
        <Button onClick={() => open(currentDraft)}>{t("edit")}</Button>
      </div>
      {controller && (
        <Editor
          key={controller.instance}
          controller={controller}
          published={state}
          compare={refresh}
          rebase={(v) => open(v, undefined, true)}
          t={t}
        />
      )}
      {controller && (
        <Button
          variant="ghost"
          onClick={() => {
            if (controller.confirmLeave(() => window.confirm(t("discard")))) {
              session.scope.release(controller);
              setController(undefined);
              address();
            }
          }}
        >
          {t("cancelEditing")}
        </Button>
      )}
      <LivePreview
        shopId={shopId}
        controller={controller}
        fallback={currentDraft}
        revisions={[
          ...(state.revision ? [state.revision] : []),
          ...history.filter((r) => r.id !== state.revision?.id),
        ]}
        t={t}
      />
      <section className="shop-profile-history">
        <h3>{t("resume")}</h3>
        {drafts
          .filter(
            (d) =>
              d.workflow === "shop.commitments" && d.lifecycle === "active",
          )
          .map((d) => (
            <Button
              key={d.id}
              variant="outline"
              onClick={() => {
                const p = shopCommitmentsDraftSchema.safeParse(d.payload);
                if (d.schemaVersion !== 1 || !p.success) setFailed(true);
                else open(p.data, d);
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
            void run(async () => {
              const r = await session.scope.list();
              if (session.alive()) {
                setDrafts(r.drafts);
                setCursor(r.next);
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
              void run(async () => {
                const r = await session.scope.list(cursor);
                if (session.alive()) {
                  setDrafts((d) => [...d, ...r.drafts]);
                  setCursor(r.next);
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
            void run(async () => {
              const r = await readShopCommitmentsHistory(shopId);
              if (session.alive()) {
                setHistory(r.revisions);
                setNext(r.next);
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
            <p>
              {t("author")}: {r.actorId}
            </p>
            <p>{t("unbound-preview")}</p>
            <ConfigurationView value={r.configuration} t={t} />
          </details>
        ))}
        {next && (
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await readShopCommitmentsHistory(shopId, next);
                if (session.alive()) {
                  setHistory((h) => [...h, ...r.revisions]);
                  setNext(r.next);
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
function LivePreview({
  controller,
  fallback,
  ...props
}: {
  controller: DraftRecovery | undefined;
  fallback: ShopCommitmentsDraft;
  shopId: string;
  revisions: ShopCommitmentsRevision[];
  t: T;
}) {
  if (!controller) return <Preview {...props} draft={fallback} />;
  return (
    <ControllerPreview {...props} controller={controller} fallback={fallback} />
  );
}
function ControllerPreview({
  controller,
  fallback,
  ...props
}: {
  controller: DraftRecovery;
  fallback: ShopCommitmentsDraft;
  shopId: string;
  revisions: ShopCommitmentsRevision[];
  t: T;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const parsed = shopCommitmentsDraftSchema.safeParse(s.values);
  return <Preview {...props} draft={parsed.success ? parsed.data : fallback} />;
}

function BindingSources({
  shopId,
  value,
  t,
  onReady,
}: {
  shopId: string;
  value: CommitmentBindingDraft;
  t: T;
  onReady?: (ready: boolean) => void;
}) {
  const locale = useLocale();
  const [sources, setSources] = useState<{
    category: Awaited<ReturnType<typeof readCatalogueRevision>>;
    rule: ShopCommitmentsRevision;
  }>();
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry must refetch the same immutable source IDs after an outage.
  useEffect(() => {
    let alive = true;
    setSources(undefined);
    setFailed(false);
    onReady?.(false);
    void Promise.all([
      readCatalogueRevision(shopId, value.availabilityId),
      readShopCommitmentsRevision(shopId, value.ruleRevisionId),
    ]).then(
      ([category, rule]) => {
        if (alive) {
          setSources({ category, rule });
          onReady?.(true);
        }
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [shopId, value.availabilityId, value.ruleRevisionId, attempt, onReady]);
  return (
    <div className="shop-profile-history">
      <h5>{t("bindingSources")}</h5>
      <p className="shop-actor">
        {t("categoryRevision")}: {value.categoryRevisionId}
      </p>
      <p className="shop-actor">
        {t("availability")}: {value.availabilityId}
      </p>
      <p className="shop-actor">
        {t("ruleRevision")}: {value.ruleRevisionId}
      </p>
      {!sources ? (
        <>
          <p role="status">{t(failed ? "loadError" : "loading")}</p>
          {failed && (
            <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
              {t("retryLoad")}
            </Button>
          )}
        </>
      ) : (
        <>
          <p>
            {locale === "ta"
              ? sources.category.definition.content.labelTa
              : sources.category.definition.content.labelEn}
          </p>
          <p>
            {t("warningDays")}:{" "}
            {sources.category.definition.content.warningDays ??
              t("noBindingExtension")}
          </p>
          <p>
            {t("bindingWindow")}:{" "}
            {sources.rule.configuration.warningDays === null
              ? t("unresolved")
              : Math.max(
                  sources.rule.configuration.warningDays,
                  sources.category.definition.content.warningDays ?? 0,
                )}
          </p>
          <ConfigurationView value={sources.rule.configuration} t={t} />
        </>
      )}
      <p>{t("bindingReviewScope")}</p>
    </div>
  );
}
function BindingEditor({
  shopId,
  controller,
  t,
}: {
  shopId: string;
  controller: DraftRecovery;
  t: T;
}) {
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const parsed = commitmentBindingDraftSchema.safeParse(s.values);
  const [review, setReview] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  if (!parsed.success || s.status === "denied")
    return <p role="alert">{t("incompatible")}</p>;
  const v = parsed.data,
    inactive = !!s.committed && s.committed.lifecycle !== "active",
    busy = s.work.inFlight || s.work.outcomeUnknown || inactive;
  const edit = (patch: Partial<CommitmentBindingDraft>) => {
    setReview(false);
    controller.edit({ ...v, ...patch });
  };
  return (
    <section className="shop-profile-editor" aria-label={t("bindingEditor")}>
      <h4 tabIndex={-1} ref={heading}>
        {t("bindingEditor")}
      </h4>
      <p role="status">{t(s.status)}</p>
      <BindingSources
        shopId={shopId}
        value={v}
        t={t}
        onReady={setSourceReady}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void controller.save();
        }}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <fieldset disabled={busy}>
          <label className="commitment-field" htmlFor="binding-reason">
            {t("bindingReason")}
            <Input
              id="binding-reason"
              value={v.reason}
              maxLength={1000}
              aria-invalid={!v.reason.trim()}
              aria-describedby="binding-reason-help"
              onChange={(e) => edit({ reason: e.target.value })}
            />
          </label>
          <p id="binding-reason-help">{t("bindingReasonHelp")}</p>
          <label className="directory-check">
            <input
              type="checkbox"
              checked={v.review === "reviewed"}
              onChange={(e) =>
                edit({ review: e.target.checked ? "reviewed" : "pending" })
              }
            />
            {t("bindingReviewValues")}
          </label>
          <p>{t("bindingPendingHelp")}</p>
        </fieldset>
        {!inactive && (
          <div className="calendar-actions">
            <Button type="submit" variant="outline" disabled={busy}>
              {t("saveDraft")}
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                !sourceReady ||
                !commitmentBindingCommandSchema.safeParse(v).success
              }
              onClick={() => setReview(true)}
            >
              {t("bindingReview")}
            </Button>
          </div>
        )}
      </form>
      {s.work.outcomeUnknown && (
        <Button
          disabled={s.work.inFlight}
          onClick={() => void controller.retry()}
        >
          {t("retry")}
        </Button>
      )}
      {s.status === "conflict" && (
        <section>
          <h5>{t("conflict")}</h5>
          <p>{t("bindingStale")}</p>
          <Button onClick={() => void controller.refreshConflict()}>
            {t("compare")}
          </Button>
          {s.conflict && (
            <>
              <BindingSources
                shopId={shopId}
                value={commitmentBindingDraftSchema.parse(s.conflict.payload)}
                t={t}
              />
              <Button onClick={() => controller.resolveConflict("server")}>
                {t("useServer")}
              </Button>
              <Button
                disabled={s.conflict.lifecycle !== "active"}
                onClick={() => controller.resolveConflict("local")}
              >
                {t("keepLocal")}
              </Button>
            </>
          )}
        </section>
      )}
      {s.error && (
        <p role="alert">
          {t(
            s.error === "VERSION_STALE" || s.error === "REQUEST_CONFLICT"
              ? "bindingStale"
              : "loadError",
          )}
        </p>
      )}
      {review && (
        <section
          className="shop-profile-history"
          aria-label={t("bindingReview")}
        >
          <h5 ref={reviewHeading} tabIndex={-1}>
            {t("bindingReview")}
          </h5>
          <p>{t("bindingReviewScope")}</p>
          <p>{v.reason}</p>
          <p>
            {t(v.review === "reviewed" ? "bindingReviewed" : "bindingPending")}
          </p>
          <Button
            disabled={
              busy || !sourceReady || s.work.dirty || s.status !== "saved"
            }
            onClick={() => void controller.promote()}
          >
            {t("bindingPublish")}
          </Button>
          <Button variant="ghost" onClick={() => setReview(false)}>
            {t("back")}
          </Button>
        </section>
      )}
    </section>
  );
}
function mergeBindingDrafts(rows: DraftRecord[], updates: DraftRecord[]) {
  const records = new Map(rows.map((r) => [r.id, r]));
  for (const record of updates) {
    if ((records.get(record.id)?.version ?? 0) > record.version) continue;
    if (record.lifecycle === "active") records.set(record.id, record);
    else records.delete(record.id);
  }
  return [...records.values()];
}
function CommitmentBindingsPanel({
  shopId,
  queries,
  guard,
  rule,
  t,
}: {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
  rule: ShopCommitmentsRevision | null;
  t: T;
}) {
  const locale = useLocale();
  const [session, setSession] = useState<{
    scope: ReturnType<typeof createDraftScope>;
    alive: () => boolean;
  }>();
  const [controller, setController] = useState<DraftRecovery>();
  const [rows, setRows] =
    useState<Awaited<ReturnType<typeof readServiceCatalogue>>>();
  const [term, setTerm] = useState("");
  const [selected, setSelected] =
    useState<Awaited<ReturnType<typeof readCatalogueRevision>>>();
  const [state, setState] =
    useState<Awaited<ReturnType<typeof readCommitmentBinding>>>();
  const [history, setHistory] = useState<CommitmentBindingRevision[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [cursor, setCursor] = useState<DraftCursor | null>(null);
  const [inspected, setInspected] = useState<CommitmentBindingRevision>();
  const [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false),
    [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry recreates the complete effect-owned scope.
  useEffect(() => {
    let mounted = true;
    const version = queries.version(),
      scope = createDraftScope(shopId, guard),
      alive = () => mounted && queries.isCurrent(version);
    setSession({ scope, alive });
    setDenied(false);
    setController(undefined);
    setSelected(undefined);
    setState(undefined);
    setHistory([]);
    setInspected(undefined);
    setRows(undefined);
    setDrafts([]);
    setFailed(false);
    void (async () => {
      try {
        const [list, saved] = await Promise.all([
          readServiceCatalogue(shopId),
          scope.list(),
        ]);
        if (!alive()) return;
        setRows(list);
        setDrafts(saved.drafts);
        setCursor(saved.next);
        const id = new URL(window.location.href).searchParams.get("draft");
        if (id) {
          const record = await scope.read(id);
          if (!alive() || record.workflow !== "service.commitment-bindings")
            return;
          const value = commitmentBindingDraftSchema.parse(record.payload);
          const [category, current] = await Promise.all([
            readCatalogueRevision(shopId, value.availabilityId),
            readCommitmentBinding(shopId, value.categoryId),
          ]);
          if (!alive()) return;
          setSelected(category);
          setState(current);
          setDrafts((rows) => mergeBindingDrafts(rows, [record]));
          setController(
            scope.open({
              workflow: "service.commitment-bindings",
              schemaVersion: 1,
              initial: value,
              record,
              committed: (r) => {
                if (alive()) {
                  setDrafts((rows) => mergeBindingDrafts(rows, [r]));
                  if (r.lifecycle === "active") address(r.id);
                  else {
                    address();
                    void readCommitmentBinding(shopId, value.categoryId).then(
                      (v) => {
                        if (alive()) setState(v);
                      },
                      () => {
                        if (alive()) setFailed(true);
                      },
                    );
                  }
                }
              },
            }),
          );
        }
      } catch {
        if (alive()) setFailed(true);
      }
    })();
    const invalidate = onOwnerInvalidation(() => {
      setDenied(true);
      setController(undefined);
      setRows(undefined);
      setDrafts([]);
      setHistory([]);
      setInspected(undefined);
      setSelected(undefined);
      setState(undefined);
      setTerm("");
    });
    return () => {
      mounted = false;
      invalidate();
      scope.dispose();
    };
  }, [shopId, queries, guard, attempt]);
  const run = async (action: () => Promise<void>) => {
    if (busy || !session?.alive()) return;
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      if (session.alive()) setFailed(true);
    } finally {
      if (session.alive()) setBusy(false);
    }
  };
  const leave = () =>
    !controller || controller.confirmLeave(() => window.confirm(t("discard")));
  const open = (
    v: CommitmentBindingDraft,
    record?: DraftRecord,
    confirmed = false,
  ) => {
    if (!session?.alive() || (!confirmed && !leave())) return;
    if (controller) session.scope.release(controller);
    setInspected(undefined);
    const c = session.scope.open({
      workflow: "service.commitment-bindings",
      schemaVersion: 1,
      initial: v,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!session.alive()) return;
        setDrafts((rows) => mergeBindingDrafts(rows, [r]));
        if (r.lifecycle === "active") address(r.id);
        else if (r.lifecycle === "promoted") {
          address();
          void run(async () => {
            const current = await readCommitmentBinding(shopId, v.categoryId);
            if (session.alive()) setState(current);
          });
        }
      },
    });
    setController(c);
    if (record) {
      address(record.id);
      setDrafts((rows) => mergeBindingDrafts(rows, [record]));
    } else {
      address();
      c.edit(v);
    }
  };
  if (denied) return null;
  return (
    <section className="shop-profile-history" aria-label={t("bindingTitle")}>
      <h3>{t("bindingTitle")}</h3>
      <p>{t("bindingIntro")}</p>
      {failed && <p role="alert">{t("loadError")}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await readServiceCatalogue(shopId, undefined, term);
            if (session?.alive()) setRows(r);
          });
        }}
      >
        <label className="commitment-field" htmlFor="binding-search">
          {t("bindingSearch")}
          <Input
            id="binding-search"
            value={term}
            maxLength={160}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <Button type="submit" variant="outline" disabled={busy}>
          {t("bindingSearch")}
        </Button>
      </form>
      {!rows ? (
        <Button
          disabled={busy}
          onClick={() => {
            if (leave()) setAttempt((v) => v + 1);
          }}
        >
          {t("retryLoad")}
        </Button>
      ) : (
        <>
          <ul>
            {rows.entries
              .filter((r) => r.definition.content.kind === "category")
              .map((r) => (
                <li key={r.id}>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (!leave()) return;
                      void run(async () => {
                        const current = await readCommitmentBinding(
                          shopId,
                          r.entryId,
                        );
                        if (!session?.alive()) return;
                        if (controller) session.scope.release(controller);
                        setController(undefined);
                        address();
                        setSelected(r);
                        setState(current);
                        setHistory([]);
                        setInspected(undefined);
                      });
                    }}
                  >
                    {locale === "ta"
                      ? r.definition.content.labelTa
                      : r.definition.content.labelEn}{" "}
                    —{" "}
                    {t(r.available ? "bindingAvailable" : "bindingUnavailable")}
                  </Button>
                </li>
              ))}
          </ul>
          {rows.next && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await readServiceCatalogue(
                    shopId,
                    rows.next ?? undefined,
                    term,
                  );
                  if (session?.alive())
                    setRows({ ...r, entries: [...rows.entries, ...r.entries] });
                })
              }
            >
              {t("bindingMore")}
            </Button>
          )}
        </>
      )}
      {selected && state && (
        <>
          <h4>
            {locale === "ta"
              ? selected.definition.content.labelTa
              : selected.definition.content.labelEn}
          </h4>
          <p>{t(state.currentEligible ? "bindingCurrent" : "bindingStale")}</p>
          <p>
            {t(
              state.revision?.authority === "owner-reviewed"
                ? "bindingReviewed"
                : "bindingPending",
            )}
          </p>
          <Button
            disabled={busy || !selected.available || !rule}
            onClick={() => {
              if (rule)
                open({
                  categoryId: selected.entryId,
                  categoryRevisionId: selected.definition.id,
                  availabilityId: selected.id,
                  ruleRevisionId: rule.id,
                  baseVersion: state.version,
                  baseRevisionId: state.revision?.id ?? null,
                  review: "pending",
                  reason: "",
                });
            }}
          >
            {t("bindingNew")}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await readCommitmentBindingHistory(
                  shopId,
                  selected.entryId,
                );
                if (session?.alive()) {
                  setHistory(r.revisions);
                  setNext(r.next);
                }
              })
            }
          >
            {t("bindingHistory")}
          </Button>
          {history.map((r) => (
            <Button
              key={r.id}
              variant="ghost"
              onClick={() =>
                void run(async () => {
                  const v = await readCommitmentBindingRevision(shopId, r.id);
                  if (session?.alive()) setInspected(v);
                })
              }
            >
              {t("version", { version: r.version })} —{" "}
              {new Date(r.effectiveAt).toLocaleString(locale)}
            </Button>
          ))}
          {next && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await readCommitmentBindingHistory(
                    shopId,
                    selected.entryId,
                    next,
                  );
                  if (session?.alive()) {
                    setHistory((v) => [...v, ...r.revisions]);
                    setNext(r.next);
                  }
                })
              }
            >
              {t("bindingMore")}
            </Button>
          )}
          {inspected && (
            <section aria-label={t("bindingHistorical")}>
              <h4>{t("bindingHistorical")}</h4>
              <p className="shop-actor">
                {inspected.actorId} —{" "}
                {new Date(inspected.effectiveAt).toLocaleString(locale)}
              </p>
              <p>{inspected.reason}</p>
              <BindingSources shopId={shopId} value={inspected} t={t} />
              <p className="shop-actor">
                {t("digest")}: {inspected.digest}
              </p>
            </section>
          )}
          {state.currentEligible && state.revision && rule && (
            <Preview
              key={state.revision.id}
              shopId={shopId}
              draft={{
                baseVersion: rule.version,
                baseRevisionId: rule.id,
                configuration: rule.configuration,
              }}
              revisions={[]}
              bindingId={state.revision.id}
              t={t}
            />
          )}
        </>
      )}
      {controller && (
        <>
          <BindingEditor
            key={controller.instance}
            shopId={shopId}
            controller={controller}
            t={t}
          />
          <Button
            variant="ghost"
            onClick={() => {
              if (leave() && session) {
                session.scope.release(controller);
                setController(undefined);
                address();
              }
            }}
          >
            {t("cancelEditing")}
          </Button>
        </>
      )}
      <h4>{t("bindingDrafts")}</h4>
      {drafts
        .filter((d) => d.workflow === "service.commitment-bindings")
        .map((d) => (
          <Button
            key={d.id}
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!leave()) return;
                const record = await session?.scope.read(d.id);
                if (!record || !session?.alive()) return;
                const value = commitmentBindingDraftSchema.parse(
                  record.payload,
                );
                const [category, current] = await Promise.all([
                  readCatalogueRevision(shopId, value.availabilityId),
                  readCommitmentBinding(shopId, value.categoryId),
                ]);
                if (!session?.alive()) return;
                open(value, record, true);
                setSelected(category);
                setState(current);
                setHistory([]);
              })
            }
          >
            {t("bindingResume")} —{" "}
            {new Date(d.updatedAt).toLocaleString(locale)}
          </Button>
        ))}
      {cursor && (
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await session?.scope.list(cursor);
              if (r && session?.alive()) {
                setDrafts((v) => mergeBindingDrafts(v, r.drafts));
                setCursor(r.next);
              }
            })
          }
        >
          {t("bindingMore")}
        </Button>
      )}
    </section>
  );
}
