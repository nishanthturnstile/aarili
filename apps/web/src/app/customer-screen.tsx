import { OwnerRequestError } from "@aarili/api/client";
import {
  CustomerRequestError,
  correctCustomer,
  registerCustomer,
} from "@aarili/api/customer-client";
import {
  type CustomerCorrection,
  type CustomerCreate,
  type CustomerPolicy,
  type CustomerProfile,
  type CustomerSearchPage,
  customerContactSchema,
} from "@aarili/contracts/customers";
import {
  contactMergeMessages,
  identityReviewMessages,
  type Locale,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { Status } from "@aarili/ui/components/status";
import { useLocale, useTranslations } from "next-intl";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { CustomerDuplicates } from "./customer-duplicates";
import { createCustomerQueries } from "./customer-query";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";
import { WearerWorkspace } from "./wearer-workspace";

type CustomerMode = "customers" | "customer-new" | "customer-profile";
type Attempt = {
  key: string;
  input: CustomerCorrection | CustomerCreate;
  etag?: string;
};
const blank = {
  displayName: "",
  phone: "",
  email: "",
  notes: "",
  aliases: "",
  reason: "",
};
type Values = typeof blank;
function valuesFor(p: CustomerProfile): Values {
  return {
    displayName: p.displayName,
    phone: p.phone ?? "",
    email: p.email ?? "",
    notes: p.notes ?? "",
    aliases: p.aliases.join("\n"),
    reason: "",
  };
}

export function CustomerScreen({
  shopId,
  mode,
  customerId,
  queries,
  guard,
}: {
  shopId: string;
  mode: CustomerMode;
  customerId?: string | undefined;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const [customerQueries] = useState(() =>
    createCustomerQueries(queries, shopId),
  );
  const [policy, setPolicy] = useState<CustomerPolicy>();
  const [profile, setProfile] = useState<CustomerProfile>();
  const [page, setPage] = useState<CustomerSearchPage>();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const { register, getValues, reset } = useForm<Values>({
    defaultValues: blank,
  });
  const [language, setLanguage] = useState<"en" | "ta" | "">("");
  const [source, setSource] = useState<"in-person" | "phone" | "">("");
  const [consentAt, setConsentAt] = useState("");
  const [editing, setEditing] = useState(mode === "customer-new");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [attempt, setAttempt] = useState<Attempt>();
  const [conflict, setConflict] = useState<CustomerProfile>();
  const [reload, setReload] = useState(0);
  const alive = useRef(true);
  const confirmedLeave = useRef(false);
  const locked = useRef(false);
  const generation = useRef(queries.version());
  const requestNumber = useRef(0);
  const feedback = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [work] = useState(() => guard.track());
  // Focus the mounted correction form before it becomes interactive. A queued
  // timer can otherwise steal focus while the owner is entering the reason.
  useLayoutEffect(() => {
    if (editing && !loading && mode === "customer-profile")
      nameInput.current?.focus();
  }, [editing, loading, mode]);
  const current = useCallback(
    () => alive.current && queries.isCurrent(generation.current),
    [queries],
  );
  useEffect(() => {
    alive.current = true;
    const unsubscribe = queries.onInvalidate(() => {
      alive.current = false;
      reset(blank);
      setProfile(undefined);
      setPage(undefined);
      setAttempt(undefined);
      setQuery("");
      setSearched("");
      setConflict(undefined);
      setConsentAt("");
    });
    return () => {
      alive.current = false;
      unsubscribe();
      work.dispose();
    };
  }, [queries, work, reset]);
  useEffect(() => {
    work.set({ dirty, inFlight: busy, outcomeUnknown: !!attempt });
  }, [dirty, busy, attempt, work]);
  useEffect(() => {
    if (!dirty && !attempt) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!confirmedLeave.current) event.preventDefault();
    };
    const leave = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (target && !target.getAttribute("href")?.startsWith("#")) {
        if (window.confirm(t(attempt ? "leaveUnknown" : "discard")))
          confirmedLeave.current = true;
        else event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, attempt, t]);
  useEffect(() => {
    if (failure || notice) feedback.current?.focus();
  }, [failure, notice]);
  useEffect(() => {
    const controller = new AbortController();
    if (reload > 0) setNotice("");
    let active = true;
    setLoading(true);
    setFailure("");
    async function load() {
      try {
        const p = await customerQueries.policy(controller.signal);
        if (!active || !current()) return;
        setPolicy(p);
        if (mode === "customer-profile" && customerId) {
          const record = await customerQueries.profile(
            customerId,
            controller.signal,
          );
          if (!active || !current()) return;
          setProfile(record);
          reset(valuesFor(record));
        } else if (mode === "customers") {
          const result = await customerQueries.search(
            { query: "", limit: 25 },
            controller.signal,
          );
          if (!active || !current()) return;
          setPage(result);
        }
      } catch (error) {
        if (active && current() && !controller.signal.aborted)
          setFailure(
            error instanceof OwnerRequestError && error.code === "NOT_FOUND"
              ? "unavailable"
              : "loadError",
          );
      } finally {
        if (active && current()) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [mode, customerId, reload, reset, current, customerQueries]);
  async function find(more = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFailure("");
    const n = ++requestNumber.current;
    const text = more ? searched : query;
    try {
      const result = await customerQueries.search({
        query: text,
        limit: 25,
        ...(more && page?.next ? { cursor: page.next } : {}),
      });
      if (!current() || n !== requestNumber.current) return;
      setPage(
        more && page
          ? { ...result, customers: [...page.customers, ...result.customers] }
          : result,
      );
      setSearched(text);
    } catch {
      if (current()) setFailure("loadError");
    } finally {
      locked.current = false;
      if (current()) setBusy(false);
    }
  }
  function changed(key: keyof Values) {
    confirmedLeave.current = false;
    setDirty(true);
    setNotice("");
    setErrors((old) => ({ ...old, [key]: false }));
  }
  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (locked.current || conflict) return;
    if (!navigator.onLine) {
      setFailure(attempt ? "unknown" : "offline");
      return;
    }
    let next = attempt;
    if (!next) {
      const values = getValues();
      const parsed = customerContactSchema.safeParse({
        displayName: values.displayName,
        ...(values.phone.trim() ? { phone: values.phone } : {}),
        ...(values.email.trim() ? { email: values.email } : {}),
        ...(values.notes.trim() ? { notes: values.notes } : {}),
        aliases: values.aliases.split("\n").filter((s) => s.trim()),
      });
      const invalid: Record<string, boolean> = {};
      if (mode !== "customer-new" && !values.reason.trim())
        invalid.reason = true;
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          invalid[String(issue.path[0])] = true;
      if (
        mode === "customer-new" &&
        (!language ||
          !source ||
          !consentAt ||
          !policy?.enabled ||
          !policy.notice)
      )
        invalid.permission = true;
      if (!parsed.success || Object.keys(invalid).length) {
        setErrors(invalid);
        setFailure("validation");
        if (invalid.displayName) nameInput.current?.focus();
        return;
      }
      const contact = parsed.data;
      setErrors({});
      next = {
        key: crypto.randomUUID(),
        input:
          mode === "customer-new" && policy?.notice && language && source
            ? {
                ...contact,
                serviceEvidence: {
                  noticeId: policy.notice.id,
                  language,
                  source,
                  giver: "self",
                  decision: "grant",
                  noticeExplained: true,
                  occurredAt: consentAt,
                },
              }
            : { ...contact, reason: values.reason.trim() },
        ...(profile ? { etag: `"v${profile.version}"` } : {}),
      };
      setAttempt(next);
    }
    locked.current = true;
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      const result =
        mode === "customer-new"
          ? await registerCustomer(
              shopId,
              next.input as CustomerCreate,
              next.key,
            )
          : await correctCustomer(
              shopId,
              customerId ?? "",
              next.input as CustomerCorrection,
              next.key,
              next.etag ?? "",
            );
      if (!current()) return;
      setAttempt(undefined);
      setDirty(false);
      setEditing(false);
      // Confirmed identity only enters the route; names/search never do.
      if (mode === "customer-new") {
        confirmedLeave.current = true;
        window.location.assign(`/customers/${result.customerId}`);
        return;
      }
      try {
        const record = await customerQueries.profile(result.customerId);
        if (!current()) return;
        setProfile(record);
        reset(valuesFor(record));
        setNotice("corrected");
      } catch {
        if (current()) {
          setProfile(undefined);
          setFailure("readError");
        }
      }
    } catch (error) {
      if (!current()) return;
      if (error instanceof CustomerRequestError && error.current) {
        setConflict(error.current);
        setAttempt(undefined);
        setFailure("stale");
      } else if (
        error instanceof OwnerRequestError &&
        error.code === "RATE_LIMITED" &&
        attempt
      ) {
        setFailure("retryLimited");
      } else if (
        error instanceof OwnerRequestError &&
        [
          "VALIDATION_FAILED",
          "REQUEST_CONFLICT",
          "IDEMPOTENCY_MISMATCH",
          "PRECONDITION_REQUIRED",
          "NOT_FOUND",
          "CUSTOMER_POLICY_PENDING",
          "RATE_LIMITED",
        ].includes(error.code)
      ) {
        setAttempt(undefined);
        setFailure(
          error.code === "NOT_FOUND"
            ? "unavailable"
            : error.code === "CUSTOMER_POLICY_PENDING"
              ? "blocked"
              : error.code === "RATE_LIMITED"
                ? "limited"
                : "rejected",
        );
      } else setFailure("unknown");
    } finally {
      locked.current = false;
      if (current()) setBusy(false);
    }
  }
  function cancel() {
    if (attempt || busy) return;
    if (dirty && !window.confirm(t("discard"))) return;
    setDirty(false);
    setFailure("");
    setErrors({});
    if (profile) {
      const saved = conflict ?? profile;
      setProfile(saved);
      reset(valuesFor(saved));
      setConflict(undefined);
      setEditing(false);
    } else {
      confirmedLeave.current = true;
      window.location.assign("/customers");
    }
  }
  const frozen = busy || !!attempt || !!conflict;
  const noticeData = policy?.notice;
  return (
    <div className="customer-screen">
      <div className="customer-toolbar">
        {mode === "customers" ? (
          <p className="entry-intro">{t("intro")}</p>
        ) : (
          <a href="/customers">{t("back")}</a>
        )}
        {mode === "customers" && (
          <a className="customer-primary-link" href="/customers/new">
            {t("add")}
          </a>
        )}
      </div>
      <div
        ref={feedback}
        tabIndex={-1}
        className="customer-feedback"
        role={failure ? "alert" : "status"}
      >
        {(failure || notice) && (
          <Status tone={failure ? "error" : "success"}>
            {t(failure || notice)}
          </Status>
        )}
      </div>
      {loading ? (
        <p role="status">{t("loading")}</p>
      ) : !policy || (mode === "customer-profile" && !profile) ? (
        <Button onClick={() => setReload((n) => n + 1)}>{t("retry")}</Button>
      ) : (
        <>
          {mode === "customers" && (
            <>
              <form
                method="post"
                className="customer-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  void find();
                }}
              >
                <Field>
                  <FieldLabel htmlFor="customer-search">
                    {t("search")}
                  </FieldLabel>
                  <Input
                    id="customer-search"
                    type="search"
                    autoComplete="off"
                    maxLength={160}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-describedby="customer-search-help"
                  />
                  <FieldDescription id="customer-search-help">
                    {t("searchHelp")}
                  </FieldDescription>
                </Field>
                <Button type="submit" disabled={busy}>
                  {t(busy ? "searchPending" : "find")}
                </Button>
              </form>
              {page &&
                (page.customers.length ? (
                  <>
                    <p role="status" className="customer-muted">
                      {t("resultCount", { count: page.customers.length })}
                    </p>
                    <ul className="customer-list">
                      {page.customers.map((p) => (
                        <li key={p.id}>
                          <a href={`/customers/${p.id}`}>
                            <span>
                              <strong>{p.displayName}</strong>
                              <span className="customer-muted">{p.code}</span>
                            </span>
                            <span>{p.phone || t("none")}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    {page.next && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void find(true)}
                      >
                        {t("more")}
                      </Button>
                    )}
                  </>
                ) : (
                  <section className="customer-empty">
                    <h2>{t(searched ? "noMatch" : "empty")}</h2>
                    <p>{t(searched ? "noMatchHelp" : "emptyHelp")}</p>
                  </section>
                ))}
              {failure && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void find()}
                >
                  {t("retry")}
                </Button>
              )}
            </>
          )}
          {mode !== "customers" && (
            <>
              {(policy.synthetic || profile?.synthetic) && (
                <Status tone="warning">
                  <span>
                    <strong>{t("draft")}</strong>
                    <br />
                    {t("draftHelp")}
                  </span>
                </Status>
              )}
              {!policy.enabled && (
                <Status tone="warning">{t("blocked")}</Status>
              )}
              {profile && !editing && (
                <>
                  <CustomerDetails profile={profile} />
                  <CustomerDuplicates
                    key={`${profile.id}:${profile.version}`}
                    shopId={shopId}
                    customerId={profile.id}
                    mergedIntoId={profile.mergedInto?.id}
                    queries={queries}
                    guard={guard}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!guard.safe() && !window.confirm(t("discard")))
                        return;
                      confirmedLeave.current = false;
                      setEditing(true);
                      setNotice("");
                    }}
                    disabled={!policy.enabled}
                  >
                    {t("edit")}
                  </Button>
                  <section className="customer-evidence">
                    <h2>{t("evidence")}</h2>
                    <p>{t("permission")}</p>
                    <p>{t("noMarketing")}</p>
                    <dl>
                      <dt>{t("givenBy")}</dt>
                      <dd>{profile.displayName}</dd>
                      <dt>{t("version")}</dt>
                      <dd>{profile.serviceEvidence.noticeVersion}</dd>
                      <dt>{t("noticeLanguage")}</dt>
                      <dd>
                        {profile.serviceEvidence.language === "ta"
                          ? "தமிழ்"
                          : "English"}
                      </dd>
                      <dt>{t("source")}</dt>
                      <dd>
                        {t(
                          profile.serviceEvidence.source === "phone"
                            ? "phoneSource"
                            : "inPerson",
                        )}
                      </dd>
                      <dt>{t("occurred")}</dt>
                      <dd>
                        {new Date(
                          profile.serviceEvidence.occurredAt,
                        ).toLocaleString(locale)}
                      </dd>
                      <dt>{t("recorded")}</dt>
                      <dd>
                        {new Date(
                          profile.serviceEvidence.recordedAt,
                        ).toLocaleString(locale)}
                      </dd>
                      <dt>{t("recordedBy")}</dt>
                      <dd>{t("recordedOwnerHelp")}</dd>
                    </dl>
                  </section>
                  <WearerWorkspace
                    customer={profile}
                    shopId={shopId}
                    queries={queries}
                    guard={guard}
                  />
                </>
              )}
              {editing && (
                <>
                  {conflict && (
                    <section className="customer-conflict">
                      <h2>{t("current")}</h2>
                      <CustomerDetails profile={conflict} />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setProfile(conflict);
                          reset(valuesFor(conflict));
                          setConflict(undefined);
                          setDirty(false);
                          setFailure("");
                        }}
                      >
                        {t("reload")}
                      </Button>
                    </section>
                  )}
                  <form
                    method="post"
                    className="customer-form"
                    noValidate
                    onSubmit={(e) => void save(e)}
                  >
                    <fieldset disabled={frozen || !policy.enabled}>
                      <legend
                        className={
                          mode === "customer-new" ? "sr-only" : undefined
                        }
                      >
                        {t(mode === "customer-new" ? "newTitle" : "editTitle")}
                      </legend>
                      <p className="customer-muted">{t("nameOnly")}</p>
                      {mode !== "customer-new" && (
                        <Field>
                          <FieldLabel htmlFor="customer-correction-reason">
                            {
                              identityReviewMessages[locale as "en" | "ta"]
                                .reason
                            }
                          </FieldLabel>
                          <textarea
                            id="customer-correction-reason"
                            className="ui-input"
                            maxLength={1000}
                            required
                            {...register("reason", {
                              onChange: () => changed("reason"),
                            })}
                            aria-invalid={!!errors.reason}
                          />
                        </Field>
                      )}
                      <Field>
                        <FieldLabel htmlFor="customer-name">
                          {t("name")}
                        </FieldLabel>
                        <Input
                          {...register("displayName", {
                            onChange: () => changed("displayName"),
                          })}
                          ref={(node) => {
                            register("displayName").ref(node);
                            nameInput.current = node;
                          }}
                          id="customer-name"
                          autoComplete="off"
                          maxLength={120}
                          required
                          aria-invalid={!!errors.displayName}
                          aria-describedby={`customer-name-help${errors.displayName ? " customer-name-error" : ""}`}
                        />
                        <FieldDescription id="customer-name-help">
                          {t("nameHelp")}
                        </FieldDescription>
                        {errors.displayName && (
                          <FieldError id="customer-name-error">
                            {t("nameInvalid")}
                          </FieldError>
                        )}
                      </Field>
                      <details
                        open={
                          !!profile ||
                          !!errors.phone ||
                          !!errors.email ||
                          !!errors.aliases ||
                          !!errors.notes
                        }
                      >
                        <summary>{t("optional")}</summary>
                        <div className="customer-optional">
                          <Field>
                            <FieldLabel htmlFor="customer-phone">
                              {t("phone")}
                            </FieldLabel>
                            <Input
                              id="customer-phone"
                              type="tel"
                              autoComplete="off"
                              {...register("phone", {
                                onChange: () => changed("phone"),
                              })}
                              maxLength={40}
                              aria-invalid={!!errors.phone}
                              aria-describedby={
                                errors.phone
                                  ? "customer-phone-error"
                                  : undefined
                              }
                            />
                            {errors.phone && (
                              <FieldError id="customer-phone-error">
                                {t("detailInvalid")}
                              </FieldError>
                            )}
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="customer-email">
                              {t("email")}
                            </FieldLabel>
                            <Input
                              id="customer-email"
                              type="email"
                              autoComplete="off"
                              {...register("email", {
                                onChange: () => changed("email"),
                              })}
                              maxLength={254}
                              aria-invalid={!!errors.email}
                              aria-describedby={
                                errors.email
                                  ? "customer-email-error"
                                  : undefined
                              }
                            />
                            {errors.email && (
                              <FieldError id="customer-email-error">
                                {t("emailInvalid")}
                              </FieldError>
                            )}
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="customer-aliases">
                              {t("aliases")}
                            </FieldLabel>
                            <textarea
                              className="ui-input"
                              id="customer-aliases"
                              autoComplete="off"
                              {...register("aliases", {
                                onChange: () => changed("aliases"),
                              })}
                              rows={3}
                              maxLength={1600}
                              aria-invalid={!!errors.aliases}
                              aria-describedby={`customer-aliases-help${errors.aliases ? " customer-aliases-error" : ""}`}
                            />
                            <FieldDescription id="customer-aliases-help">
                              {t("aliasesHelp")}
                            </FieldDescription>
                            {errors.aliases && (
                              <FieldError id="customer-aliases-error">
                                {t("detailInvalid")}
                              </FieldError>
                            )}
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="customer-notes">
                              {t("notes")}
                            </FieldLabel>
                            <textarea
                              className="ui-input"
                              id="customer-notes"
                              autoComplete="off"
                              {...register("notes", {
                                onChange: () => changed("notes"),
                              })}
                              rows={3}
                              maxLength={2000}
                              aria-invalid={!!errors.notes}
                              aria-describedby={
                                errors.notes
                                  ? "customer-notes-error"
                                  : undefined
                              }
                            />
                            {errors.notes && (
                              <FieldError id="customer-notes-error">
                                {t("detailInvalid")}
                              </FieldError>
                            )}
                          </Field>
                        </div>
                      </details>
                      {mode === "customer-new" && noticeData && (
                        <section
                          className="customer-notice"
                          aria-labelledby="customer-notice-heading"
                        >
                          <h2 id="customer-notice-heading">{t("notice")}</h2>
                          <Field>
                            <FieldLabel htmlFor="customer-notice-language">
                              {t("noticeLanguage")}
                            </FieldLabel>
                            <select
                              className="ui-input"
                              id="customer-notice-language"
                              value={language}
                              onChange={(e) => {
                                setLanguage(e.target.value as typeof language);
                                setErrors((old) => ({
                                  ...old,
                                  permission: false,
                                }));
                                setConsentAt("");
                                setDirty(true);
                              }}
                              aria-invalid={!!errors.permission}
                            >
                              <option value="">{t("choose")}</option>
                              <option value="en">English</option>
                              <option value="ta">தமிழ்</option>
                            </select>
                          </Field>
                          <details className="customer-notice-text">
                            <summary>
                              {language === "ta"
                                ? noticeData.titleTa
                                : noticeData.titleEn}
                            </summary>
                            <p lang={language || "en"}>
                              {language === "ta"
                                ? noticeData.textTa
                                : noticeData.textEn}
                            </p>
                          </details>
                          <p className="customer-muted">{noticeData.version}</p>
                          <Field>
                            <FieldLabel htmlFor="customer-consent-source">
                              {t("source")}
                            </FieldLabel>
                            <select
                              className="ui-input"
                              id="customer-consent-source"
                              value={source}
                              onChange={(e) => {
                                setSource(e.target.value as typeof source);
                                setErrors((old) => ({
                                  ...old,
                                  permission: false,
                                }));
                                setConsentAt("");
                                setDirty(true);
                              }}
                              aria-invalid={!!errors.permission}
                            >
                              <option value="">{t("choose")}</option>
                              <option value="in-person">{t("inPerson")}</option>
                              <option value="phone">{t("phoneSource")}</option>
                            </select>
                          </Field>
                          <label
                            className="customer-consent"
                            htmlFor="customer-consent"
                          >
                            <input
                              id="customer-consent"
                              type="checkbox"
                              checked={!!consentAt}
                              onChange={(e) => {
                                setConsentAt(
                                  e.target.checked
                                    ? new Date().toISOString()
                                    : "",
                                );
                                setDirty(true);
                              }}
                              aria-invalid={!!errors.permission}
                              aria-describedby="customer-consent-help"
                            />
                            <span>{t("consent")}</span>
                          </label>
                          <p
                            id="customer-consent-help"
                            className="customer-muted"
                          >
                            {t("consentHelp")}
                          </p>
                          {errors.permission && (
                            <FieldError>{t("permissionInvalid")}</FieldError>
                          )}
                        </section>
                      )}
                    </fieldset>
                    {dirty && !attempt && (
                      <p className="customer-muted" role="status">
                        {t("unsaved")}
                      </p>
                    )}
                    <div className="customer-actions">
                      <Button
                        type="submit"
                        disabled={busy || !!conflict || !policy.enabled}
                      >
                        {t(
                          busy
                            ? "saving"
                            : attempt
                              ? "retrySave"
                              : mode === "customer-new"
                                ? "save"
                                : "correct",
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || !!attempt}
                        onClick={cancel}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
function CustomerDetails({ profile }: { profile: CustomerProfile }) {
  const t = useTranslations("customers");
  const locale = useLocale() as Locale;
  return (
    <section className="customer-details">
      <h2>{profile.displayName}</h2>
      {profile.mergedInto && (
        <p>
          {contactMergeMessages[locale].merged}{" "}
          <a href={`/customers/${profile.mergedInto.id}`}>
            {profile.mergedInto.code} · {profile.mergedInto.displayName}
          </a>
        </p>
      )}

      <p className="customer-muted">
        {t("currentVersion", { version: profile.version })}
      </p>
      <dl>
        <dt>{t("code")}</dt>
        <dd>{profile.code}</dd>
        <dt>{t("phone")}</dt>
        <dd>{profile.phone || t("none")}</dd>
        <dt>{t("email")}</dt>
        <dd>{profile.email || t("none")}</dd>
        <dt>{t("aliases")}</dt>
        <dd>{profile.aliases.join(", ") || t("none")}</dd>
        <dt>{t("notes")}</dt>
        <dd className="customer-preserve">{profile.notes || t("none")}</dd>
      </dl>
    </section>
  );
}
