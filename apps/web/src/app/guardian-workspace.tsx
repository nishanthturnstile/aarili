import {
  GuardianRequestError,
  readGuardianPolicy,
  readGuardians,
  recordGuardianPurpose,
  searchGuardianPeople,
  verifyGuardian,
} from "@aarili/api/wearer-client";
import type {
  CustomerPolicy,
  CustomerProfile,
} from "@aarili/contracts/customers";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  type GuardianDraft,
  type GuardianProfile,
  type GuardianPurposeEvent,
  type GuardianVerification,
  guardianDraftCommandSchema,
  guardianDraftSchema,
  guardianPurposeEventSchema,
  guardianVerificationSchema,
  type WearerProfile,
} from "@aarili/contracts/wearers";
import { draftMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { Status } from "@aarili/ui/components/status";
import { useLocale, useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useForm } from "react-hook-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type Queries = ReturnType<typeof createOwnerQueries>;
type Translate = ReturnType<typeof useTranslations<"guardians">>;
type Props = {
  customer: CustomerProfile;
  wearer: WearerProfile;
  shopId: string;
  queries: Queries;
  guard: OwnerGuard;
  updated: () => void;
};
const scopeLabels = {
  measurement: "measurement",
  "private-photo": "privatePhoto",
  "measurement-and-private-photo": "both",
} as const;
function iso(value: string) {
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toISOString() : "";
}
function address(id?: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("draft", id);
  else url.searchParams.delete("draft");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
function FieldInput({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
    </Field>
  );
}
function Choice({
  id,
  label,
  value,
  change,
  children,
}: {
  id: string;
  label: string;
  value: string;
  change: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <FieldInput id={id} label={label}>
      <select
        id={id}
        className="ui-input"
        value={value}
        onChange={(e) => change(e.target.value)}
      >
        {children}
      </select>
    </FieldInput>
  );
}
function ScopeOptions({ t }: { t: Translate }) {
  return (
    <>
      <option value="">{t("choose")}</option>
      {Object.entries(scopeLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {t(label)}
        </option>
      ))}
    </>
  );
}
function SourceOptions({ t }: { t: Translate }) {
  return (
    <>
      <option value="">{t("choose")}</option>
      <option value="in-person">{t("inPerson")}</option>
      <option value="phone">{t("phone")}</option>
    </>
  );
}

// One subject-mounted scope owns drafts, ephemeral form values and reads. The
// owner/shop generation rejects late results; no private value is a query key.
export function GuardianWorkspace(props: Props) {
  const { customer, wearer, shopId, queries, guard } = props;
  const t = useTranslations("guardians");
  const [scope] = useState(() => createDraftScope(shopId, guard));
  const [profile, setProfile] = useState<GuardianProfile>();
  const [policy, setPolicy] = useState<CustomerPolicy>();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [controller, setController] = useState<DraftRecovery>();
  const [form, setForm] = useState<"review" | "purpose" | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const alive = useRef(true),
    generation = useRef(queries.version()),
    sequence = useRef(0);
  const updated = useRef(props.updated);
  updated.current = props.updated;
  const openRef = useRef<(record?: DraftRecord) => Promise<void>>(
    async () => {},
  );
  const current = useCallback(
    () => alive.current && queries.isCurrent(generation.current),
    [queries],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const n = ++sequence.current;
      const [result, config] = await queries.client.fetchQuery({
        queryKey: [
          "shop",
          shopId,
          "guardian",
          wearer.id,
          generation.current,
          n,
        ],
        gcTime: 0,
        queryFn: () =>
          Promise.all([
            readGuardians(shopId, customer.id, wearer.id),
            readGuardianPolicy(shopId),
          ]),
      });
      if (!current() || n !== sequence.current) return;
      // Do not display evidence against an older age/relationship snapshot.
      if (result.version !== wearer.version) {
        updated.current();
        return;
      }
      setProfile(result);
      setPolicy(config);
      const records: DraftRecord[] = [];
      let page = await scope.list();
      records.push(...page.drafts);
      while (page.next) {
        page = await scope.list(page.next);
        records.push(...page.drafts);
      }
      if (current() && n === sequence.current)
        setDrafts(
          records.filter(
            (d) =>
              d.workflow === "wearer.guardian" &&
              d.lifecycle === "active" &&
              d.payload.customerId === customer.id &&
              d.payload.wearerId === wearer.id,
          ),
        );
    } catch {
      if (current()) setFailed(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [queries, shopId, customer.id, wearer.id, wearer.version, scope, current]);
  useEffect(() => {
    const stop = queries.onInvalidate(() => {
      alive.current = false;
      setProfile(undefined);
      setPolicy(undefined);
      setDrafts([]);
      setController(undefined);
      setForm(null);
    });
    void refresh().then(async () => {
      const id = new URL(window.location.href).searchParams.get("draft");
      if (!id || !current()) return;
      try {
        const record = await scope.read(id);
        if (record.workflow === "wearer.guardian")
          await openRef.current(record);
      } catch {
        if (current()) setFailed(true);
      }
    });
    return () => {
      alive.current = false;
      stop();
      scope.dispose();
    };
  }, [queries, refresh, scope, current]);
  const mayLeave = () => guard.safe() || window.confirm(t("discard"));
  async function open(record?: DraftRecord) {
    if (opening || !mayLeave()) return;
    setOpening(true);
    setFailed(false);
    try {
      const saved = record ? await scope.read(record.id) : undefined;
      if (!current()) return;
      if (
        saved &&
        (saved.workflow !== "wearer.guardian" ||
          saved.payload.customerId !== customer.id ||
          saved.payload.wearerId !== wearer.id)
      )
        throw Error("Unavailable");
      if (controller) scope.release(controller);
      setForm(null);
      address(saved?.id);
      setController(
        scope.open({
          workflow: "wearer.guardian",
          schemaVersion: 1,
          initial: {
            synthetic: true,
            noticeId: policy?.notice?.id,
            customerId: customer.id,
            customerVersion: customer.version,
            wearerId: wearer.id,
            wearerVersion: wearer.version,
            claim: {},
          },
          ...(saved ? { record: saved } : {}),
          committed: (record) => {
            if (!current()) return;
            address(record.lifecycle === "active" ? record.id : undefined);
            if (record.lifecycle === "promoted") {
              setController(undefined);
              updated.current();
            }
          },
        }),
      );
    } catch {
      if (current()) setFailed(true);
    } finally {
      if (current()) setOpening(false);
    }
  }
  openRef.current = open;
  function closeDraft() {
    if (!mayLeave()) return;
    if (controller) scope.release(controller);
    setController(undefined);
    address();
    void refresh();
  }
  function changeForm(next: "review" | "purpose" | null) {
    if (mayLeave()) setForm(next);
  }
  if (
    !loading &&
    !profile?.authorities.length &&
    wearer.age === "adult" &&
    !controller &&
    !failed
  )
    return null;
  return (
    <section
      className="customer-evidence guardian-workspace"
      aria-labelledby="guardian-heading"
      data-guardian-version={profile?.version}
    >
      <h4 id="guardian-heading">
        {t("title")}: {wearer.displayName}
      </h4>
      <p>{t("boundary")}</p>
      <p>{t("separate")}</p>
      <Status tone="warning">{t("draftOnly")}</Status>
      {wearer.age !== "minor" && <p role="status">{t("agePending")}</p>}
      {loading && <p role="status">{t("loading")}</p>}
      {failed && (
        <div role="alert">
          <p>{t("loadError")}</p>
          <Button
            onClick={() => {
              if (mayLeave()) void refresh();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {policy && !policy.enabled && <p>{t("blocked")}</p>}
      {profile && (
        <GuardianEvidence
          profile={profile}
          t={t}
          summaryId="guardian-current-state"
        />
      )}
      {controller ? (
        <GuardianDraftEditor
          key={controller.instance}
          controller={controller}
          customer={customer}
          wearer={wearer}
          shopId={shopId}
          queries={queries}
          close={closeDraft}
        />
      ) : (
        <>
          <div className="customer-actions">
            <Button
              id="guardian-add"
              variant="outline"
              disabled={
                wearer.age !== "minor" ||
                !policy?.enabled ||
                opening ||
                failed ||
                loading
              }
              onClick={() => void open()}
            >
              {t("add")}
            </Button>
            {!form && profile?.authority && policy?.enabled && (
              <>
                <Button variant="outline" onClick={() => changeForm("review")}>
                  {t("review")}
                </Button>
                <Button variant="outline" onClick={() => changeForm("purpose")}>
                  {t("recordPurpose")}
                </Button>
              </>
            )}
          </div>
          {form && profile?.authority && policy && (
            <GuardianDecisionForm
              key={`${profile.version}:${form}`}
              {...props}
              profile={profile}
              policy={policy}
              mode={form}
              close={() => changeForm(null)}
              reload={() => {
                if (mayLeave()) updated.current();
              }}
            />
          )}
          <section aria-labelledby="guardian-drafts-heading">
            <h5 id="guardian-drafts-heading">{t("drafts")}</h5>
            <p>{t("draftHelp")}</p>
            {!loading && !failed && !drafts.length && <p>{t("noDrafts")}</p>}
            <ul className="wearer-choices">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Button
                    variant="outline"
                    disabled={opening}
                    onClick={() => void open(d)}
                  >
                    {t("resume")}:{" "}
                    <time dateTime={d.updatedAt}>
                      {new Date(d.updatedAt).toLocaleString()}
                    </time>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <Button
        variant="ghost"
        disabled={loading}
        onClick={() => {
          if (mayLeave()) void refresh();
        }}
      >
        {t("refresh")}
      </Button>
    </section>
  );
}

function GuardianEvidence({
  profile,
  t,
  summaryId,
}: {
  profile: GuardianProfile;
  t: Translate;
  summaryId?: string;
}) {
  const locale = useLocale(),
    a = profile.authority;
  return (
    <>
      <div id={summaryId} role="status">
        {a ? (
          <dl>
            <dt>{t("guardian")}</dt>
            <dd>
              {a.displayName} ({a.personId.slice(-8)})
            </dd>
            <dt>{t("kind")}</dt>
            <dd>{t(a.authority === "parent" ? "parent" : "legalGuardian")}</dd>
            <dt>{t("scope")}</dt>
            <dd>{t(scopeLabels[a.scope])}</dd>
            <dt>{t("status")}</dt>
            <dd>
              {t(a.status)}
              {a.status === "confirmed" && !a.verifiedCurrent
                ? ` — ${t("reviewRequired")}`
                : ""}
            </dd>
            <dt>{t("source")}</dt>
            <dd>{t(a.source === "phone" ? "phone" : "inPerson")}</dd>
            <dt>{t("occurred")}</dt>
            <dd>{new Date(a.occurredAt).toLocaleString(locale)}</dd>
          </dl>
        ) : (
          <p>{t("empty")}</p>
        )}
      </div>
      <h5>{t("purposes")}</h5>
      <p>{t("purposeHelp")}</p>
      {!profile.purposes.length && <p>{t("notRecorded")}</p>}
      <ul className="wearer-history">
        {profile.purposes.map((p) => (
          <li key={p.id}>
            <strong>
              {t(
                p.purpose === "measurement"
                  ? "measurement"
                  : p.purpose === "private-photo"
                    ? "privatePhoto"
                    : p.purpose,
              )}
              : {t(p.decision)}
            </strong>
            <p>{p.eligible ? t("eligible") : t("ineligible")}</p>
            <p>
              {t("giver")}:{" "}
              {profile.authorities.find((a) => a.personId === p.giverPersonId)
                ?.displayName ?? p.giverPersonId}
              ; {t("authorityReference")}: {p.authorityId.slice(-8)}
            </p>
            <p>
              {t("notice")}: {p.noticeVersion}; {t("language")}: {t(p.language)}
              ; {t("source")}: {t(p.source === "phone" ? "phone" : "inPerson")}
            </p>
            <p>
              {t("occurred")}: {new Date(p.occurredAt).toLocaleString(locale)};{" "}
              {t("recorded")}: {new Date(p.recordedAt).toLocaleString(locale)};{" "}
              {t("recorder")}: {p.recordedBy}
            </p>
            {p.previousId && (
              <p>
                {t("prior")}: {p.previousId.slice(-8)}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!!profile.authorities.length && (
        <details>
          <summary>{t("history")}</summary>
          <ul className="wearer-history">
            {profile.authorities.map((a) => (
              <li key={a.id}>
                <strong>
                  {a.displayName} — {t(a.status)}
                </strong>
                <p>
                  {t("authorityReference")}: {a.id.slice(-8)}; {t("scope")}:{" "}
                  {t(scopeLabels[a.scope])}
                </p>
                <p>
                  {t("recorded")}:{" "}
                  {new Date(a.recordedAt).toLocaleString(locale)};{" "}
                  {t("recorder")}: {a.recordedBy}
                </p>
                <ul>
                  {a.verifications.map((v) => (
                    <li key={v.id}>
                      <p>
                        {t(v.status)}; {t("method")}:{" "}
                        {t(
                          v.method === "synthetic-review-v1"
                            ? "syntheticMethod"
                            : "notVerified",
                        )}
                        ; {t("evidence")}:{" "}
                        <span className="customer-preserve">
                          {v.evidenceRef}
                        </span>
                      </p>
                      <p>
                        {t("scope")}: {t(scopeLabels[v.scope])}; {t("source")}:{" "}
                        {t(v.source === "phone" ? "phone" : "inPerson")};{" "}
                        {t("occurred")}:{" "}
                        {new Date(v.occurredAt).toLocaleString(locale)};{" "}
                        {t("recorded")}:{" "}
                        {new Date(v.recordedAt).toLocaleString(locale)};{" "}
                        {t("recorder")}: {v.recordedBy}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function GuardianDraftEditor({
  controller,
  customer,
  wearer,
  shopId,
  queries,
  close,
}: Omit<Props, "guard" | "updated"> & {
  controller: DraftRecovery;
  close: () => void;
}) {
  const t = useTranslations("guardians"),
    locale = useLocale() as Locale,
    dt = draftMessages[locale];
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const parsed = guardianDraftSchema.safeParse(state.values),
    values = parsed.success ? parsed.data : undefined,
    claim = values?.claim ?? {};
  const { register, reset } = useForm<{ displayName: string }>({
    defaultValues: { displayName: claim.guardian?.displayName ?? "" },
  });
  const [query, setQuery] = useState(""),
    [name, setName] = useState("");
  const [people, setPeople] =
    useState<Awaited<ReturnType<typeof searchGuardianPeople>>>();
  const [finding, setFinding] = useState(false),
    [failure, setFailure] = useState("");
  const alive = useRef(true),
    generation = useRef(queries.version()),
    heading = useRef<HTMLHeadingElement>(null),
    feedback = useRef<HTMLDivElement>(null),
    searchSequence = useRef(0);
  useEffect(() => {
    heading.current?.focus();
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (failure || state.error) feedback.current?.focus();
  }, [failure, state.error]);
  useEffect(() => {
    if (state.status === "saved" && !state.work.dirty)
      reset({ displayName: claim.guardian?.displayName ?? "" });
    if (state.status === "denied") {
      reset({ displayName: "" });
      setPeople(undefined);
      setName("");
      setQuery("");
    }
  }, [state.status, state.work.dirty, claim.guardian?.displayName, reset]);
  useEffect(() => {
    if (claim.guardian?.mode !== "existing" || !claim.guardian.personId) return;
    const personId = claim.guardian.personId;
    let active = true;
    void (async () => {
      let page = await searchGuardianPeople(shopId, { query: "", limit: 50 });
      let match = page.people.find((person) => person.personId === personId);
      while (!match && page.next) {
        page = await searchGuardianPeople(shopId, {
          query: "",
          limit: 50,
          cursor: page.next,
        });
        match = page.people.find((person) => person.personId === personId);
      }
      if (active && alive.current && queries.isCurrent(generation.current)) {
        setName(match?.displayName ?? "");
        if (!match) setFailure("loadError");
      }
    })().catch(() => {
      if (active && alive.current && queries.isCurrent(generation.current))
        setFailure("loadError");
    });
    return () => {
      active = false;
    };
  }, [claim.guardian?.mode, claim.guardian?.personId, shopId, queries]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      const s = controller.snapshot();
      if (s.work.dirty || s.work.inFlight || s.work.outcomeUnknown)
        e.preventDefault();
    };
    const leave = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest("a[href]") &&
        !controller.confirmLeave(() => window.confirm(t("discard")))
      )
        e.preventDefault();
    };
    const online = () => void controller.retry();
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
      window.removeEventListener("online", online);
    };
  }, [controller, t]);
  const locked =
    state.work.inFlight ||
    state.work.outcomeUnknown ||
    ["conflict", "promoted", "closed", "denied"].includes(state.status);
  function edit(next: GuardianDraft["claim"]) {
    if (!values) return;
    const candidate = guardianDraftSchema.safeParse({ ...values, claim: next });
    if (candidate.success) {
      setFailure("");
      controller.edit(candidate.data);
    }
  }
  async function find(more = false) {
    setFinding(true);
    setFailure("");
    const n = ++searchSequence.current;
    try {
      const result = await searchGuardianPeople(shopId, {
        query,
        limit: 25,
        ...(more && people?.next ? { cursor: people.next } : {}),
      });
      if (
        alive.current &&
        queries.isCurrent(generation.current) &&
        n === searchSequence.current
      )
        setPeople(
          more && people
            ? { ...result, people: [...people.people, ...result.people] }
            : result,
        );
    } catch {
      if (alive.current && queries.isCurrent(generation.current))
        setFailure("loadError");
    } finally {
      if (alive.current && queries.isCurrent(generation.current))
        setFinding(false);
    }
  }
  const conflict = guardianDraftSchema.safeParse(state.conflict?.payload);
  if (state.status === "denied") return null;
  return (
    <section
      className="customer-evidence"
      aria-labelledby="guardian-form-heading"
    >
      <h5 id="guardian-form-heading" ref={heading} tabIndex={-1}>
        {t("formTitle")}
      </h5>
      <p>
        <strong>{t("subject")}:</strong> {wearer.displayName};{" "}
        <strong>{t("contact")}:</strong> {customer.displayName}
      </p>
      <p>{t("claimHelp")}</p>
      <div
        ref={feedback}
        tabIndex={-1}
        role={failure || state.error ? "alert" : "status"}
      >
        <Status tone={failure || state.error ? "warning" : "info"}>
          {failure ? t(failure) : dt[state.status]}
        </Status>
        {state.error && !state.work.outcomeUnknown && (
          <p>
            {state.status === "conflict"
              ? dt.conflict
              : state.status === "saved"
                ? dt.promotionFailed
                : dt.saveFailed}
          </p>
        )}
      </div>
      <form
        className="customer-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!guardianDraftCommandSchema.safeParse(state.values).success) {
            setFailure("validation");
            return;
          }
          void controller.promote();
        }}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <fieldset disabled={locked}>
          <legend className="sr-only">{t("formTitle")}</legend>
          <Choice
            id="guardian-mode"
            label={t("mode")}
            value={claim.guardian?.mode ?? ""}
            change={(mode) => {
              reset({ displayName: "" });
              setName("");
              setPeople(undefined);
              setQuery("");
              edit({
                ...claim,
                guardian: mode ? { mode: mode as "new" | "existing" } : {},
              });
            }}
          >
            <option value="">{t("choose")}</option>
            <option value="new">{t("newPerson")}</option>
            <option value="existing">{t("existingPerson")}</option>
          </Choice>
          {claim.guardian?.mode === "new" && (
            <FieldInput id="guardian-name" label={t("name")}>
              <Input
                id="guardian-name"
                maxLength={120}
                autoComplete="off"
                {...register("displayName", {
                  onChange: (e) =>
                    edit({
                      ...claim,
                      guardian: { mode: "new", displayName: e.target.value },
                    }),
                })}
              />
            </FieldInput>
          )}
          {claim.guardian?.mode === "existing" && (
            <>
              <FieldInput id="guardian-search" label={t("search")}>
                <Input
                  id="guardian-search"
                  value={query}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                />
              </FieldInput>
              <Button
                type="button"
                variant="outline"
                disabled={finding}
                onClick={() => void find()}
              >
                {t("find")}
              </Button>
              <p>
                {t("selected")}:{" "}
                {name || claim.guardian.personId?.slice(-8) || t("choose")}
              </p>
              {people && !people.people.length && <p>{t("noPeople")}</p>}
              <ul className="wearer-choices">
                {people?.people.map((p) => (
                  <li key={p.personId}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setName(p.displayName);
                        edit({
                          ...claim,
                          guardian: { mode: "existing", personId: p.personId },
                        });
                      }}
                    >
                      {p.displayName} ({p.personId.slice(-8)})
                    </Button>
                  </li>
                ))}
              </ul>
              {people?.next && (
                <Button
                  type="button"
                  disabled={finding}
                  onClick={() => void find(true)}
                >
                  {t("more")}
                </Button>
              )}
            </>
          )}
          <Choice
            id="guardian-kind"
            label={t("kind")}
            value={claim.authority ?? ""}
            change={(authority) =>
              edit({
                ...claim,
                authority: authority
                  ? (authority as "parent" | "legal-guardian")
                  : undefined,
              })
            }
          >
            <option value="">{t("choose")}</option>
            <option value="parent">{t("parent")}</option>
            <option value="legal-guardian">{t("legalGuardian")}</option>
          </Choice>
          <Choice
            id="guardian-scope"
            label={t("scope")}
            value={claim.scope ?? ""}
            change={(scope) =>
              edit({
                ...claim,
                scope: scope
                  ? (scope as NonNullable<typeof claim.scope>)
                  : undefined,
              })
            }
          >
            <ScopeOptions t={t} />
          </Choice>
          <Choice
            id="guardian-source"
            label={t("source")}
            value={claim.source ?? ""}
            change={(source) =>
              edit({
                ...claim,
                source: source ? (source as "phone" | "in-person") : undefined,
              })
            }
          >
            <SourceOptions t={t} />
          </Choice>
          <FieldInput id="guardian-occurred" label={t("occurred")}>
            <Input
              id="guardian-occurred"
              type="datetime-local"
              value={
                claim.occurredAt
                  ? new Date(
                      new Date(claim.occurredAt).getTime() -
                        new Date(claim.occurredAt).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                edit({
                  ...claim,
                  occurredAt: e.target.value ? iso(e.target.value) : undefined,
                })
              }
            />
          </FieldInput>
        </fieldset>
        <div className="customer-actions">
          <Button
            id="guardian-save-draft"
            variant="outline"
            type="button"
            disabled={locked || !state.work.dirty}
            onClick={() => void controller.save()}
          >
            {t("saveDraft")}
          </Button>
          <Button
            id="guardian-promote"
            type="submit"
            disabled={
              locked ||
              state.work.dirty ||
              state.status !== "saved" ||
              (claim.guardian?.mode === "existing" && !name)
            }
          >
            {t("promote")}
          </Button>
        </div>
      </form>
      {(state.error || state.work.outcomeUnknown) && (
        <Button
          variant="outline"
          disabled={state.work.inFlight}
          onClick={() => void controller.retry()}
        >
          {t("retry")}
        </Button>
      )}
      {conflict.success && (
        <div>
          <h5>{t("savedState")}</h5>
          <p>
            {t("name")}:{" "}
            {conflict.data.claim.guardian?.displayName ??
              conflict.data.claim.guardian?.personId?.slice(-8) ??
              t("choose")}
          </p>
          <p>
            {t("scope")}:{" "}
            {conflict.data.claim.scope
              ? t(scopeLabels[conflict.data.claim.scope])
              : t("choose")}
          </p>
          <Button
            variant="outline"
            onClick={() => controller.resolveConflict("server")}
          >
            {t("reload")}
          </Button>
        </div>
      )}
      <Button variant="ghost" onClick={close}>
        {t("close")}
      </Button>
    </section>
  );
}

// Direct event retries retain the original input, key AND ETag, even after an
// unknown response followed by throttling. A 412 never rebases the proposal.
function GuardianDecisionForm(
  props: Props & {
    profile: GuardianProfile;
    policy: CustomerPolicy;
    mode: "review" | "purpose";
    close: () => void;
    reload: () => void;
  },
) {
  const { customer, wearer, shopId, queries, guard, profile, policy, mode } =
    props;
  const t = useTranslations("guardians");
  const [values, setValues] = useState({
    status: "",
    method: "",
    evidenceRef: "",
    scope: "",
    authorityId: "",
    purpose: "",
    decision: "",
    giverPersonId: "",
    language: "",
    source: "",
    occurredAt: "",
    explained: false,
  });
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState<{
    input: GuardianVerification | GuardianPurposeEvent;
    key: string;
    etag: string;
  }>();
  const [stale, setStale] = useState<GuardianProfile>();
  const alive = useRef(true),
    generation = useRef(queries.version()),
    lock = useRef(false),
    feedback = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [work] = useState(() => guard.track());
  useEffect(() => {
    heading.current?.focus();
    const stop = queries.onInvalidate(() => {
      alive.current = false;
      setValues({
        status: "",
        method: "",
        evidenceRef: "",
        scope: "",
        authorityId: "",
        purpose: "",
        decision: "",
        giverPersonId: "",
        language: "",
        source: "",
        occurredAt: "",
        explained: false,
      });
      setAttempt(undefined);
      setStale(undefined);
    });
    return () => {
      alive.current = false;
      stop();
      work.dispose();
    };
  }, [queries, work]);
  useEffect(
    () => work.set({ dirty, inFlight: busy, outcomeUnknown: !!attempt }),
    [work, dirty, busy, attempt],
  );
  useEffect(() => {
    if (error) feedback.current?.focus();
  }, [error]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || attempt) e.preventDefault();
    };
    const leave = (e: MouseEvent) => {
      if (
        (dirty || attempt) &&
        e.target instanceof Element &&
        e.target.closest("a[href]") &&
        !window.confirm(t("discard"))
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty, attempt, t]);
  const a = profile.authority;
  if (!a) return null;
  const withdrawalTarget = profile.purposes.find(
    (p) =>
      p.authorityId === values.authorityId &&
      p.purpose === values.purpose &&
      p.decision === "grant",
  );
  const locked = busy || !!attempt || !!stale || completed;
  function change(next: Partial<typeof values>) {
    setDirty(true);
    setError("");
    setValues((old) => ({ ...old, ...next }));
  }
  async function save() {
    if (lock.current || stale || completed) return;
    if (!navigator.onLine) {
      setError(attempt ? "unknown" : "offline");
      return;
    }
    const input =
      mode === "review"
        ? guardianVerificationSchema.safeParse({
            authorityId: a?.id,
            status: values.status,
            method: values.method,
            evidenceRef: values.evidenceRef,
            scope: values.scope,
            source: values.source,
            occurredAt: iso(values.occurredAt),
          })
        : guardianPurposeEventSchema.safeParse({
            authorityId: values.authorityId,
            purpose: values.purpose,
            decision: values.decision,
            noticeId:
              values.decision === "withdrawal"
                ? withdrawalTarget?.noticeId
                : policy.notice?.id,
            noticeExplained: values.explained,
            language: values.language,
            giverPersonId: values.giverPersonId,
            source: values.source,
            occurredAt: iso(values.occurredAt),
          });
    if (!input.success && !attempt) {
      setError("validation");
      return;
    }
    const next = attempt ?? {
      input: structuredClone(
        input.success ? input.data : ({} as GuardianVerification),
      ),
      key: crypto.randomUUID(),
      etag: `"v${profile.version}"`,
    };
    lock.current = true;
    setBusy(true);
    setError("");
    setAttempt(next);
    try {
      if (mode === "review")
        await verifyGuardian(
          shopId,
          customer.id,
          wearer.id,
          next.input as GuardianVerification,
          next.key,
          next.etag,
        );
      else
        await recordGuardianPurpose(
          shopId,
          customer.id,
          wearer.id,
          next.input as GuardianPurposeEvent,
          next.key,
          next.etag,
        );
      if (!alive.current || !queries.isCurrent(generation.current)) return;
      setAttempt(undefined);
      setDirty(false);
      setCompleted(true);
      work.set({ dirty: false, inFlight: false, outcomeUnknown: false });
      props.updated();
    } catch (e) {
      if (!alive.current || !queries.isCurrent(generation.current)) return;
      if (e instanceof GuardianRequestError && e.status === 429 && attempt)
        setError("unknown");
      else if (
        e instanceof GuardianRequestError &&
        e.status >= 400 &&
        e.status < 500
      ) {
        setAttempt(undefined);
        setError(
          e.status === 412
            ? "conflict"
            : e.status === 429
              ? "limited"
              : "failed",
        );
        if (e.status === 412) {
          if (e.current) setStale(e.current);
          else {
            try {
              const result = await readGuardians(
                shopId,
                customer.id,
                wearer.id,
              );
              if (alive.current && queries.isCurrent(generation.current))
                setStale(result);
            } catch {
              if (alive.current && queries.isCurrent(generation.current))
                setStale(profile);
            }
          }
        }
      } else setError("unknown");
    } finally {
      lock.current = false;
      if (alive.current && queries.isCurrent(generation.current))
        setBusy(false);
    }
  }
  return (
    <section
      className="customer-evidence"
      aria-labelledby="guardian-decision-heading"
    >
      <h5 ref={heading} id="guardian-decision-heading" tabIndex={-1}>
        {t(mode === "review" ? "review" : "purposes")}: {wearer.displayName}
      </h5>
      <p>
        {t("guardian")}: {a.displayName} ({a.personId.slice(-8)});{" "}
        {t("contact")}: {customer.displayName}
      </p>
      <p>{t(mode === "review" ? "reviewHelp" : "purposeHelp")}</p>
      {error && (
        <div ref={feedback} tabIndex={-1} role="alert">
          <Status tone="warning">{t(error)}</Status>
        </div>
      )}
      {completed && <p role="status">{t("saved")}</p>}
      {mode === "purpose" && policy.notice && (
        <details open>
          <summary>
            {t("notice")}: {policy.notice.version}
          </summary>
          <p lang="en" className="customer-preserve">
            {policy.notice.titleEn}
            {"\n"}
            {policy.notice.textEn}
          </p>
          <p lang="ta" className="customer-preserve">
            {policy.notice.titleTa}
            {"\n"}
            {policy.notice.textTa}
          </p>
        </details>
      )}
      {mode === "purpose" &&
        values.decision === "withdrawal" &&
        withdrawalTarget && (
          <p>
            {t("withdrawalTarget")}:{" "}
            <strong>{withdrawalTarget.noticeVersion}</strong>;{" "}
            {t("authorityReference")}: {withdrawalTarget.authorityId.slice(-8)}.
          </p>
        )}
      <form
        className="customer-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={locked}>
          <legend className="sr-only">
            {t(mode === "review" ? "review" : "purposes")}
          </legend>
          {mode === "review" ? (
            <>
              <Choice
                id="guardian-verification-status"
                label={t("reviewStatus")}
                value={values.status}
                change={(status) => change({ status })}
              >
                <option value="">{t("choose")}</option>
                {(
                  ["pending", "confirmed", "rejected", "withdrawn"] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </Choice>
              <Choice
                id="guardian-verification-method"
                label={t("method")}
                value={values.method}
                change={(method) => change({ method })}
              >
                <option value="">{t("choose")}</option>
                <option value="not-verified">{t("notVerified")}</option>
                <option value="synthetic-review-v1">
                  {t("syntheticMethod")}
                </option>
              </Choice>
              <FieldInput
                id="guardian-verification-evidence"
                label={t("evidence")}
              >
                <Input
                  id="guardian-verification-evidence"
                  value={values.evidenceRef}
                  maxLength={500}
                  autoComplete="off"
                  onChange={(e) => change({ evidenceRef: e.target.value })}
                />
              </FieldInput>
              <p>{t("evidenceHelp")}</p>
              <Choice
                id="guardian-verification-scope"
                label={t("scope")}
                value={values.scope}
                change={(scope) => change({ scope })}
              >
                <ScopeOptions t={t} />
              </Choice>
            </>
          ) : (
            <>
              <Choice
                id="guardian-purpose-authority"
                label={t("authorityReference")}
                value={values.authorityId}
                change={(authorityId) =>
                  change({
                    authorityId,
                    decision: "",
                    giverPersonId: "",
                    explained: false,
                  })
                }
              >
                <option value="">{t("choose")}</option>
                {profile.authorities.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.displayName} ({record.id.slice(-8)}) —{" "}
                    {t(record.status)}
                  </option>
                ))}
              </Choice>
              <Choice
                id="guardian-purpose"
                label={t("purpose")}
                value={values.purpose}
                change={(purpose) =>
                  change({
                    purpose,
                    decision: "",
                    giverPersonId: "",
                    language: "",
                    source: "",
                    occurredAt: "",
                    explained: false,
                  })
                }
              >
                <option value="">{t("choose")}</option>
                <option value="measurement">{t("measurement")}</option>
                <option value="private-photo">{t("privatePhoto")}</option>
              </Choice>
              <Choice
                id="guardian-decision"
                label={t("decision")}
                value={values.decision}
                change={(decision) => change({ decision, explained: false })}
              >
                <option value="">{t("choose")}</option>
                <option
                  value="grant"
                  disabled={
                    wearer.age !== "minor" ||
                    !a.verifiedCurrent ||
                    values.authorityId !== a.id
                  }
                >
                  {t("grant")}
                </option>
                <option value="refusal">{t("refusal")}</option>
                <option value="withdrawal">{t("withdrawal")}</option>
              </Choice>
              <Choice
                id="guardian-giver"
                label={t("giver")}
                value={values.giverPersonId}
                change={(giverPersonId) => change({ giverPersonId })}
              >
                <option value="">{t("choose")}</option>
                {[
                  ...new Map([
                    [customer.personId, customer.displayName],
                    ...profile.authorities.map(
                      (a) => [a.personId, a.displayName] as const,
                    ),
                  ]).entries(),
                ].map(([id, name]) => (
                  <option key={id} value={id}>
                    {name} ({id.slice(-8)})
                  </option>
                ))}
              </Choice>
              <Choice
                id="guardian-language"
                label={t("language")}
                value={values.language}
                change={(language) => change({ language, explained: false })}
              >
                <option value="">{t("choose")}</option>
                <option value="en">{t("en")}</option>
                <option value="ta">{t("ta")}</option>
              </Choice>
            </>
          )}
          <Choice
            id={
              mode === "review"
                ? "guardian-verification-source"
                : "guardian-purpose-source"
            }
            label={t("source")}
            value={values.source}
            change={(source) => change({ source })}
          >
            <SourceOptions t={t} />
          </Choice>
          <FieldInput
            id={
              mode === "review"
                ? "guardian-verification-occurred"
                : "guardian-purpose-occurred"
            }
            label={t("occurred")}
          >
            <Input
              id={
                mode === "review"
                  ? "guardian-verification-occurred"
                  : "guardian-purpose-occurred"
              }
              type="datetime-local"
              value={values.occurredAt}
              onChange={(e) => change({ occurredAt: e.target.value })}
            />
          </FieldInput>
          {mode === "purpose" && (
            <label className="customer-consent">
              <input
                id="guardian-explained"
                type="checkbox"
                checked={values.explained}
                onChange={(e) => change({ explained: e.target.checked })}
              />
              <span>{t("explained")}</span>
            </label>
          )}
        </fieldset>
        <Button type="submit" disabled={busy || !!stale || completed}>
          {t(
            attempt ? "retry" : mode === "review" ? "review" : "recordPurpose",
          )}
        </Button>
      </form>
      {stale && (
        <section className="customer-evidence">
          <h5>{t("savedState")}</h5>
          <GuardianEvidence profile={stale} t={t} />
          <Button variant="outline" onClick={props.reload}>
            {t("reload")}
          </Button>
        </section>
      )}
      <Button variant="ghost" disabled={busy} onClick={props.close}>
        {t("cancel")}
      </Button>
    </section>
  );
}
