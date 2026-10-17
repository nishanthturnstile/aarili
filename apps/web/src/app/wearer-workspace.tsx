import { OwnerRequestError } from "@aarili/api/client";
import {
  correctWearer,
  listWearers,
  readWearerPolicy,
  recordWearerPurpose,
  searchWearers,
  WearerRequestError,
} from "@aarili/api/wearer-client";
import type {
  CustomerPolicy,
  CustomerProfile,
} from "@aarili/contracts/customers";
import { type DraftRecord, draftIdSchema } from "@aarili/contracts/drafts";
import {
  type WearerDraft,
  type WearerProfile,
  type WearerPurposeEvent,
  type WearerUpdate,
  wearerDraftCommandSchema,
  wearerDraftSchema,
  wearerPurposeEventSchema,
  wearerUpdateSchema,
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
import { GuardianWorkspace } from "./guardian-workspace";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type OwnerQueries = ReturnType<typeof createOwnerQueries>;
type Translate = ReturnType<typeof useTranslations<"wearers">>;
type Registration = WearerDraft["registration"];
const blankPreferences = {
  language: "",
  channel: "",
  fit: "",
  style: "",
  delivery: "",
  source: "",
};
const preferenceFields = [
  "language",
  "channel",
  "fit",
  "style",
  "delivery",
  "source",
] as const;
function draftDefaults(registration: Registration) {
  const p = registration.preferences;
  return {
    displayName: registration.displayName ?? "",
    interaction: registration.relationship?.interaction ?? "",
    language: p?.language ?? "",
    channel: p?.channel ?? "",
    fit: p?.fit ?? "",
    style: p?.style ?? "",
    delivery: p?.delivery ?? "",
    source: p?.source ?? "",
  };
}
const purposeLabels = {
  service: "service",
  marketing: "marketing",
  publication: "publication",
  "private-media": "privateMedia",
} as const;

// The surrounding owner scope aborts/clears all queries on access changes. Search
// text and personal form values never become query keys or browser persistence.
export function WearerWorkspace({
  customer,
  shopId,
  queries,
  guard,
}: {
  customer: CustomerProfile;
  shopId: string;
  queries: OwnerQueries;
  guard: OwnerGuard;
}) {
  const t = useTranslations("wearers");
  const [scope] = useState(() => createDraftScope(shopId, guard));
  const [profiles, setProfiles] = useState<WearerProfile[]>([]);
  const [policy, setPolicy] = useState<CustomerPolicy>();
  const [selected, setSelected] = useState("");
  const [controller, setController] = useState<DraftRecovery>();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [failure, setFailure] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const epoch = useRef(queries.version());
  const sequence = useRef(0);
  const openRef = useRef<(record?: DraftRecord) => Promise<void>>(
    async () => {},
  );
  const current = useCallback(
    () => alive.current && queries.isCurrent(epoch.current),
    [queries],
  );
  const query = useCallback(
    async <T,>(kind: string, run: () => Promise<T>) => {
      const result = await queries.client.fetchQuery({
        queryKey: [
          "shop",
          shopId,
          "wearers",
          epoch.current,
          kind,
          ++sequence.current,
        ],
        queryFn: run,
        gcTime: 0,
      });
      if (!current()) throw new OwnerRequestError("UNAUTHENTICATED");
      return result;
    },
    [queries, shopId, current],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    setFailure(false);
    try {
      const [list, configuration] = await Promise.all([
        query("list", () => listWearers(shopId, customer.id)),
        query("policy", () => readWearerPolicy(shopId)),
      ]);
      if (!current()) return;
      setProfiles(list.wearers);
      setPolicy(configuration);
      // Walk the bounded server pages; render only this workflow/customer's
      // drafts. A failed page remains an error, never a false empty result.
      const records: DraftRecord[] = [];
      let page = await scope.list();
      records.push(...page.drafts);
      while (page.next) {
        page = await scope.list(page.next);
        records.push(...page.drafts);
      }
      if (!current()) return;
      setDrafts(
        records.filter(
          (d) =>
            d.workflow === "customer.wearer" &&
            d.lifecycle === "active" &&
            d.payload.customerId === customer.id,
        ),
      );
    } catch {
      if (current()) setFailure(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [customer.id, shopId, query, scope, current]);
  useEffect(() => {
    alive.current = true;
    const stop = queries.onInvalidate(() => {
      alive.current = false;
      setProfiles([]);
      setDrafts([]);
      setSelected("");
      setController(undefined);
      setPolicy(undefined);
    });
    void refresh().then(async () => {
      const id = new URL(window.location.href).searchParams.get("draft");
      if (!id || !current()) return;
      if (!draftIdSchema.safeParse(id).success) {
        setFailure(true);
        return;
      }
      try {
        const record = await scope.read(id);
        if (
          record.workflow === "wearer.guardian" &&
          record.payload.customerId === customer.id &&
          typeof record.payload.wearerId === "string"
        ) {
          setSelected(record.payload.wearerId);
          return;
        }
        await openRef.current(record);
      } catch {
        if (current()) setFailure(true);
      }
    });
    return () => {
      alive.current = false;
      stop();
      scope.dispose();
    };
  }, [queries, scope, refresh, current, customer.id]);
  function mayLeave() {
    return guard.safe() || window.confirm(t("discard"));
  }
  function close() {
    if (!mayLeave()) return;
    if (controller) scope.release(controller);
    draftAddress();
    setController(undefined);
    void refresh();
  }
  async function open(record?: DraftRecord) {
    if (!mayLeave() || opening) return;
    setOpening(true);
    setFailure(false);
    setNotice("");
    try {
      const saved = record ? await scope.read(record.id) : undefined;
      if (!current()) return;
      if (
        saved &&
        (saved.workflow !== "customer.wearer" ||
          saved.payload.customerId !== customer.id)
      )
        throw Error("Draft unavailable");
      if (controller) scope.release(controller);
      const next = scope.open({
        workflow: "customer.wearer",
        schemaVersion: 1,
        initial: {
          synthetic: true,
          customerId: customer.id,
          customerVersion: customer.version,
          noticeId: policy?.notice?.id,
          registration: {},
        },
        ...(saved ? { record: saved } : {}),
        committed: (result) => {
          if (!current()) return;
          draftAddress(result.lifecycle === "active" ? result.id : undefined);
          if (result.lifecycle === "promoted" && current()) {
            setNotice("saved");
            void refresh().then(() => {
              if (current()) setSelected("");
            });
          }
        },
      });
      setSelected("");
      setController(next);
    } catch {
      if (current()) setFailure(true);
    } finally {
      if (current()) setOpening(false);
    }
  }
  openRef.current = open;
  const active = profiles.find((p) => p.id === selected);
  return (
    <section className="wearer-workspace" aria-labelledby="wearers-heading">
      <div className="customer-toolbar">
        <h2 id="wearers-heading">{t("title")}</h2>
        <Button
          variant="outline"
          disabled={!policy?.enabled || opening || !!controller}
          onClick={() => void open()}
        >
          {t("add")}
        </Button>
      </div>
      <p>{t("intro")}</p>
      {notice && <Status tone="success">{t(notice)}</Status>}
      {loading && <p role="status">{t("loading")}</p>}
      {failure && (
        <div role="alert">
          <p>{t("loadError")}</p>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              if (mayLeave()) void refresh();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {policy && !policy.enabled && (
        <Status tone="warning">{t("policyHeld")}</Status>
      )}
      {!loading && !failure && profiles.length === 0 && <p>{t("empty")}</p>}
      <ul className="wearer-choices">
        {profiles.map((p) => (
          <li key={p.id}>
            <Button
              variant={p.id === selected ? "default" : "outline"}
              aria-pressed={p.id === selected}
              onClick={() => {
                if (!mayLeave()) return;
                if (controller) scope.release(controller);
                draftAddress();
                setController(undefined);
                setSelected(p.id);
                setNotice("");
              }}
            >
              {t("select")}: {p.displayName} ({p.id.slice(-8)})
            </Button>
          </li>
        ))}
      </ul>
      {active && policy && !controller && (
        <WearerDetails
          key={`${active.id}:${active.version}`}
          wearer={active}
          customer={customer}
          policy={policy}
          shopId={shopId}
          queries={queries}
          guard={guard}
          updated={() => void refresh()}
        />
      )}
      {controller && (
        <WearerDraftEditor
          key={controller.instance}
          controller={controller}
          customer={customer}
          shopId={shopId}
          queries={queries}
          close={close}
        />
      )}
      {!controller && (
        <section
          className="customer-evidence"
          aria-labelledby="wearer-drafts-heading"
        >
          <h3 id="wearer-drafts-heading">{t("drafts")}</h3>
          <p>{t("draftHelp")}</p>
          {drafts.length === 0 && !loading && !failure && (
            <p>{t("noDrafts")}</p>
          )}
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
                  {d.stale ? ` — ${t("stale")}` : ""}
                </Button>
              </li>
            ))}
          </ul>
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
      )}
    </section>
  );
}

function Labeled({
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
function Select({
  id,
  label,
  value,
  onChange,
  children,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <Labeled id={id} label={label}>
      <select
        id={id}
        className="ui-input"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </Labeled>
  );
}
function AgeOptions({ t }: { t: Translate }) {
  return (
    <>
      <option value="">{t("choose")}</option>
      <option value="unknown">{t("unknown")}</option>
      <option value="adult">{t("adult")}</option>
      <option value="minor">{t("minor")}</option>
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

function WearerDraftEditor({
  controller,
  customer,
  shopId,
  queries,
  close,
}: {
  controller: DraftRecovery;
  customer: CustomerProfile;
  shopId: string;
  queries: OwnerQueries;
  close: () => void;
}) {
  const t = useTranslations("wearers");
  const locale = useLocale() as Locale;
  const dt = draftMessages[locale];
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const parsed = wearerDraftSchema.safeParse(state.values);
  const values = parsed.success ? parsed.data : undefined;
  const registration = values?.registration ?? {};
  const { register, reset, getValues } = useForm<{
    displayName: string;
    language: string;
    channel: string;
    fit: string;
    style: string;
    delivery: string;
    source: string;
    interaction: string;
  }>({
    defaultValues: draftDefaults(registration),
  });
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] =
    useState<Awaited<ReturnType<typeof searchWearers>>>();
  const [finding, setFinding] = useState(false);
  const [failure, setFailure] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const version = useRef(queries.version());
  const alive = useRef(true);
  const sequence = useRef(0);
  const feedback = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (state.status === "denied") {
      reset({ displayName: "", ...blankPreferences, interaction: "" });
      setSearch("");
      setCandidates(undefined);
      setSelectedName("");
    }
  }, [state.status, reset]);
  // Explicit server conflict resolution must reset the visible uncontrolled
  // fields as well as the recovery controller's private payload.
  useEffect(() => {
    if (state.status === "saved" && !state.work.dirty) {
      const result = wearerDraftSchema.safeParse(controller.snapshot().values);
      if (result.success) reset(draftDefaults(result.data.registration));
    }
  }, [state.status, state.work.dirty, controller, reset]);
  useEffect(() => {
    if (failure || state.error) feedback.current?.focus();
  }, [failure, state.error]);
  useEffect(() => {
    if (registration.mode !== "existing" || !registration.wearerId) return;
    let active = true;
    const target = registration.wearerId;
    void (async () => {
      let page = await searchWearers(shopId, { query: "", limit: 50 });
      let match = page.wearers.find((p) => p.id === target);
      while (!match && page.next) {
        page = await searchWearers(shopId, {
          query: "",
          limit: 50,
          cursor: page.next,
        });
        match = page.wearers.find((p) => p.id === target);
      }
      if (active && alive.current && queries.isCurrent(version.current)) {
        setSelectedName(match?.displayName ?? "");
        if (!match) setFailure("loadError");
      }
    })().catch(() => {
      if (active && alive.current && queries.isCurrent(version.current))
        setFailure("loadError");
    });
    return () => {
      active = false;
    };
  }, [registration.mode, registration.wearerId, shopId, queries]);
  useEffect(() => {
    const online = () => void controller.retry();
    const unload = (e: BeforeUnloadEvent) => {
      const s = controller.snapshot();
      if (s.work.dirty || s.work.inFlight || s.work.outcomeUnknown)
        e.preventDefault();
    };
    const leave = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest("a[href]") &&
        !controller.confirmLeave(() =>
          window.confirm(
            t(state.work.outcomeUnknown ? "leaveUnknown" : "discard"),
          ),
        )
      )
        e.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [controller, t, state.work.outcomeUnknown]);
  const disabled =
    state.work.inFlight ||
    state.work.outcomeUnknown ||
    state.status === "conflict" ||
    ["promoted", "closed", "denied"].includes(state.status);
  function edit(next: Registration) {
    if (!values) return;
    setFailure("");
    const candidate = { ...values, registration: next };
    const normalized = wearerDraftSchema.safeParse(candidate);
    controller.edit(normalized.success ? normalized.data : candidate);
  }
  function relationship(
    next: Partial<NonNullable<Registration["relationship"]>>,
  ) {
    edit({
      ...registration,
      relationship: {
        ...registration.relationship,
        ...next,
        statementByPersonId: customer.personId,
      },
    });
  }
  function chooseMode(mode: string) {
    // Every subject switch starts fresh evidence and preferences. No checkbox,
    // source, timestamp or authority statement migrates to the new subject.
    reset({ displayName: "", ...blankPreferences, interaction: "" });
    setCandidates(undefined);
    setSelectedName("");
    setSearch("");
    edit(
      mode
        ? {
            mode: mode as Registration["mode"],
            ...(mode !== "existing"
              ? { preferences: { ...blankPreferences } }
              : {}),
            relationship: {
              kind: mode === "self" ? "self" : "other",
              statementByPersonId: customer.personId,
              authorised: false,
              informed: false,
            },
          }
        : {},
    );
  }
  async function find(more = false) {
    if (finding) return;
    setFinding(true);
    setFailure("");
    const n = ++sequence.current;
    try {
      const result = await searchWearers(shopId, {
        query: search,
        limit: 25,
        ...(more && candidates?.next ? { cursor: candidates.next } : {}),
      });
      if (
        alive.current &&
        queries.isCurrent(version.current) &&
        n === sequence.current
      )
        setCandidates(
          more && candidates
            ? { ...result, wearers: [...candidates.wearers, ...result.wearers] }
            : result,
        );
    } catch {
      if (alive.current && queries.isCurrent(version.current))
        setFailure("loadError");
    } finally {
      if (alive.current && queries.isCurrent(version.current))
        setFinding(false);
    }
  }
  async function promote() {
    setFailure("");
    if (!wearerDraftCommandSchema.safeParse(state.values).success) {
      setFailure("validation");
      const first = !registration.mode
        ? "wearer-mode"
        : registration.mode === "new" && !registration.displayName?.trim()
          ? "wearer-name"
          : registration.mode !== "existing" && !registration.age
            ? "wearer-age"
            : registration.mode === "existing" && !registration.wearerId
              ? "wearer-search"
              : !registration.relationship?.interaction?.trim()
                ? "wearer-interaction"
                : !registration.relationship?.source
                  ? "wearer-source"
                  : "wearer-occurred";
      setTimeout(() => document.getElementById(first)?.focus(), 0);
      return;
    }
    await controller.promote();
  }
  if (state.status === "denied") return null;
  return (
    <section
      className="customer-evidence"
      aria-labelledby="wearer-form-heading"
    >
      <h3 ref={heading} tabIndex={-1} id="wearer-form-heading">
        {t("formTitle")}
      </h3>
      <p>
        <strong>{t("contact")}:</strong> {customer.displayName}
      </p>
      <p>{t("draftHelp")}</p>
      <div
        ref={feedback}
        tabIndex={-1}
        role={failure || state.error ? "alert" : "status"}
      >
        <Status tone={state.error || failure ? "warning" : "info"}>
          {failure ? t(failure) : dt[state.status]}
        </Status>
        {state.error && !state.work.outcomeUnknown && (
          <p>
            {state.status === "conflict"
              ? dt.conflict
              : state.error === "CUSTOMER_POLICY_PENDING"
                ? t("policyHeld")
                : state.status === "saved"
                  ? dt.promotionFailed
                  : dt.saveFailed}
          </p>
        )}
      </div>
      {state.committed?.stale && <Status tone="warning">{t("stale")}</Status>}
      <form
        className="customer-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void promote();
        }}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <fieldset disabled={disabled}>
          <legend className="sr-only">{t("formTitle")}</legend>
          <Select
            id="wearer-mode"
            label={t("person")}
            value={registration.mode ?? ""}
            onChange={chooseMode}
            required
          >
            <option value="">{t("choose")}</option>
            <option value="self">{t("self")}</option>
            <option value="new">{t("new")}</option>
            <option value="existing">{t("existing")}</option>
          </Select>
          {registration.mode === "new" && (
            <Labeled id="wearer-name" label={t("name")}>
              <Input
                id="wearer-name"
                autoComplete="off"
                maxLength={120}
                {...register("displayName", {
                  onChange: () =>
                    edit({
                      ...registration,
                      displayName: getValues("displayName"),
                    }),
                })}
              />
            </Labeled>
          )}
          {registration.mode === "self" && (
            <p>
              <strong>{t("active")}:</strong> {customer.displayName}
            </p>
          )}
          {registration.mode === "existing" && (
            <>
              <p>{t("existingHelp")}</p>
              <Labeled id="wearer-search" label={t("search")}>
                <Input
                  id="wearer-search"
                  value={search}
                  autoComplete="off"
                  maxLength={120}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCandidates(undefined);
                  }}
                />
              </Labeled>
              <p>{t("searchHelp")}</p>
              <Button
                type="button"
                variant="outline"
                disabled={finding}
                onClick={() => void find()}
              >
                {t("find")}
              </Button>
              {candidates && (
                <ul className="wearer-choices">
                  {candidates.wearers.map((p) => (
                    <li key={p.id}>
                      <Button
                        type="button"
                        variant={
                          registration.wearerId === p.id ? "default" : "outline"
                        }
                        aria-pressed={registration.wearerId === p.id}
                        onClick={() => {
                          reset({
                            displayName: "",
                            ...blankPreferences,
                            interaction: "",
                          });
                          setSelectedName(p.displayName);
                          edit({
                            mode: "existing",
                            wearerId: p.id,
                            expectedVersion: p.version,
                            relationship: {
                              kind: "other",
                              statementByPersonId: customer.personId,
                              authorised: false,
                              informed: false,
                            },
                          });
                        }}
                      >
                        {p.displayName} — {t(p.age)} ({p.id.slice(-8)})
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {candidates && candidates.wearers.length === 0 && (
                <p>{t("noMatch")}</p>
              )}
              {candidates?.next && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={finding}
                  onClick={() => void find(true)}
                >
                  {dt.more}
                </Button>
              )}
              {registration.wearerId && (
                <p>
                  <strong>{t("active")}:</strong> {selectedName || t("loading")}
                </p>
              )}
            </>
          )}
          {registration.mode && registration.mode !== "existing" && (
            <>
              <Select
                id="wearer-age"
                label={t("age")}
                value={registration.age ?? ""}
                onChange={(age) =>
                  edit({
                    ...registration,
                    age: age
                      ? (age as "adult" | "minor" | "unknown")
                      : undefined,
                  })
                }
                required
              >
                <AgeOptions t={t} />
              </Select>
              <p className="customer-muted">{t("ageHelp")}</p>
              {registration.age && registration.age !== "adult" && (
                <Status tone="warning">{t("unresolved")}</Status>
              )}
              <details>
                <summary>{t("preferences")}</summary>
                <p>{t("preferenceHelp")}</p>
                <div className="customer-optional">
                  {preferenceFields.map((key) => (
                    <Labeled
                      key={key}
                      id={`wearer-pref-${key}`}
                      label={t(key === "source" ? "preferenceSource" : key)}
                    >
                      <Input
                        id={`wearer-pref-${key}`}
                        maxLength={1000}
                        autoComplete="off"
                        {...register(key, {
                          onChange: () => {
                            const all = getValues();
                            edit({
                              ...registration,
                              preferences: Object.fromEntries(
                                preferenceFields.map((k) => [k, all[k]]),
                              ),
                            });
                          },
                        })}
                      />
                    </Labeled>
                  ))}
                </div>
              </details>
            </>
          )}
          {registration.mode && (
            <>
              <h4>{t("authority")}</h4>
              <p>
                <strong>{t("statementBy")}:</strong> {customer.displayName}
              </p>
              {registration.mode !== "self" && (
                <Select
                  id="wearer-relationship"
                  label={t("relationship")}
                  value={registration.relationship?.kind ?? "other"}
                  onChange={(kind) =>
                    relationship({ kind: kind as "family" | "other" })
                  }
                >
                  <option value="family">{t("family")}</option>
                  <option value="other">{t("other")}</option>
                </Select>
              )}
              <Labeled id="wearer-interaction" label={t("interaction")}>
                <Input
                  id="wearer-interaction"
                  maxLength={500}
                  autoComplete="off"
                  {...register("interaction", {
                    onChange: () =>
                      relationship({ interaction: getValues("interaction") }),
                  })}
                />
              </Labeled>
              <p className="customer-muted">{t("interactionHelp")}</p>
              <label className="customer-consent">
                <input
                  type="checkbox"
                  checked={registration.relationship?.authorised ?? false}
                  onChange={(e) =>
                    relationship({
                      authorised: e.target.checked,
                      ...(e.target.checked
                        ? { authorisationDeclined: false }
                        : {}),
                    })
                  }
                />
                <span>{t("authorised")}</span>
              </label>
              <label className="customer-consent">
                <input
                  type="checkbox"
                  checked={registration.relationship?.informed ?? false}
                  onChange={(e) =>
                    relationship({
                      informed: e.target.checked,
                      ...(e.target.checked ? { informedDeclined: false } : {}),
                    })
                  }
                />
                <span>{t("informed")}</span>
              </label>
              <label className="customer-consent">
                <input
                  type="checkbox"
                  checked={
                    registration.relationship?.authorisationDeclined ?? false
                  }
                  onChange={(e) =>
                    relationship({
                      authorisationDeclined: e.target.checked,
                      ...(e.target.checked ? { authorised: false } : {}),
                    })
                  }
                />
                <span>{t("authorisationDeclined")}</span>
              </label>
              <label className="customer-consent">
                <input
                  type="checkbox"
                  checked={registration.relationship?.informedDeclined ?? false}
                  onChange={(e) =>
                    relationship({
                      informedDeclined: e.target.checked,
                      ...(e.target.checked ? { informed: false } : {}),
                    })
                  }
                />
                <span>{t("informedDeclined")}</span>
              </label>
              <p className="customer-muted">{t("pending")}</p>
              <Select
                id="wearer-source"
                label={t("source")}
                value={registration.relationship?.source ?? ""}
                onChange={(source) =>
                  relationship({
                    source: source
                      ? (source as "in-person" | "phone")
                      : undefined,
                  })
                }
              >
                <SourceOptions t={t} />
              </Select>
              <Labeled id="wearer-occurred" label={t("occurred")}>
                <Input
                  id="wearer-occurred"
                  type="datetime-local"
                  value={
                    registration.relationship?.occurredAt
                      ? localTime(registration.relationship.occurredAt)
                      : ""
                  }
                  onChange={(e) =>
                    relationship({
                      occurredAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : undefined,
                    })
                  }
                />
              </Labeled>
            </>
          )}
        </fieldset>
        <div className="customer-actions">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !state.work.dirty}
            onClick={() => void controller.save()}
          >
            {t("saveDraft")}
          </Button>
          <Button
            type="submit"
            disabled={disabled || state.status !== "saved" || state.work.dirty}
          >
            {t("register")}
          </Button>
        </div>
      </form>
      {(state.work.outcomeUnknown || state.error) &&
        state.status !== "conflict" && (
          <Button
            variant="outline"
            disabled={state.work.inFlight}
            onClick={() => void controller.retry()}
          >
            {t("retry")}
          </Button>
        )}
      {state.status === "conflict" && (
        <div className="customer-conflict">
          <h4>{dt.current}</h4>
          <p>{dt.conflict}</p>
          {state.conflict ? (
            <>
              <p>
                {state.conflict.lifecycle === "active"
                  ? t("draftHelp")
                  : dt.closed}
              </p>
              <Button
                variant="outline"
                onClick={() => controller.resolveConflict("server")}
              >
                {t("reload")}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              disabled={state.work.inFlight}
              onClick={() => void controller.refreshConflict()}
            >
              {t("reload")}
            </Button>
          )}
        </div>
      )}
      <Button variant="ghost" onClick={close}>
        {t("close")}
      </Button>
    </section>
  );
}

function localTime(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function draftAddress(id?: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("draft", id);
  else url.searchParams.delete("draft");
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function WearerDetails({
  wearer,
  customer,
  policy,
  shopId,
  queries,
  guard,
  updated,
}: {
  wearer: WearerProfile;
  customer: CustomerProfile;
  policy: CustomerPolicy;
  shopId: string;
  queries: OwnerQueries;
  guard: OwnerGuard;
  updated: () => void;
}) {
  const t = useTranslations("wearers");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  return (
    <section
      className="wearer-selected"
      aria-labelledby="selected-wearer-heading"
    >
      <h3 id="selected-wearer-heading">
        {t("active")}: {wearer.displayName}
      </h3>
      <p className="customer-muted">
        {t("reference")}: {wearer.id.slice(-8)}
      </p>
      <dl>
        <dt>{t("age")}</dt>
        <dd>{t(wearer.age)}</dd>
        <dt>{t("recordVersion")}</dt>
        <dd>{wearer.version}</dd>
      </dl>
      {wearer.age !== "adult" && (
        <Status tone="warning">{t("unresolved")}</Status>
      )}
      <h4>{t("authority")}</h4>
      <dl>
        <dt>{t("relationship")}</dt>
        <dd>{t(wearer.relationship.kind)}</dd>
        <dt>{t("statementBy")}</dt>
        <dd>{customer.displayName}</dd>
        <dt>{t("interaction")}</dt>
        <dd>{wearer.relationship.interaction}</dd>
        <dt>{t("authorised")}</dt>
        <dd>
          {t(
            wearer.relationship.authorised
              ? "confirmed"
              : wearer.relationship.authorisationDeclined
                ? "declined"
                : "unconfirmed",
          )}
        </dd>
        <dt>{t("informed")}</dt>
        <dd>
          {t(
            wearer.relationship.informed
              ? "confirmed"
              : wearer.relationship.informedDeclined
                ? "declined"
                : "unconfirmed",
          )}
        </dd>
        <dt>{t("source")}</dt>
        <dd>
          {t(wearer.relationship.source === "phone" ? "phone" : "inPerson")}
        </dd>
        <dt>{t("occurred")}</dt>
        <dd>
          {new Date(wearer.relationship.occurredAt).toLocaleString(locale)}
        </dd>
      </dl>
      <h4>{t("preferences")}</h4>
      <p>{t("preferenceHelp")}</p>
      <dl>
        {preferenceFields.map((key) => (
          <div className="wearer-definition" key={key}>
            <dt>{t(key === "source" ? "preferenceSource" : key)}</dt>
            <dd className="customer-preserve">
              {wearer.preferences[key] || t("notProvided")}
            </dd>
          </div>
        ))}
      </dl>
      {!editing && (
        <Button
          variant="outline"
          disabled={!policy.enabled}
          onClick={() => {
            if (guard.safe() || window.confirm(t("discard"))) setEditing(true);
          }}
        >
          {t("edit")}
        </Button>
      )}
      {editing && (
        <WearerCorrection
          wearer={wearer}
          customer={customer}
          shopId={shopId}
          queries={queries}
          guard={guard}
          close={() => setEditing(false)}
          updated={updated}
        />
      )}
      {!editing && (wearer.age === "adult" || wearer.purposes.length > 0) && (
        <PurposeChoices
          key={wearer.id}
          wearer={wearer}
          policy={policy}
          customerId={customer.id}
          shopId={shopId}
          queries={queries}
          guard={guard}
          updated={updated}
        />
      )}
      {!editing && (
        <GuardianWorkspace
          customer={customer}
          wearer={wearer}
          shopId={shopId}
          queries={queries}
          guard={guard}
          updated={updated}
        />
      )}
    </section>
  );
}

// Each correction/purpose form owns its retry snapshot and access epoch. A
// selected-subject remount clears uncommitted choices, including every checkbox.
function useWearerMutation<T>(options: {
  queries: OwnerQueries;
  guard: OwnerGuard;
  run: (input: T, key: string) => Promise<unknown>;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [attempt, setAttempt] = useState<{ input: T; key: string }>();
  const [stale, setStale] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const version = useRef(options.queries.version());
  const [work] = useState(() => options.guard.track());
  const feedback = useRef<HTMLDivElement>(null);
  const t = useTranslations("wearers");
  useEffect(() => {
    const stop = options.queries.onInvalidate(() => {
      alive.current = false;
      setAttempt(undefined);
      setDirty(false);
    });
    return () => {
      alive.current = false;
      stop();
      work.dispose();
    };
  }, [options.queries, work]);
  useEffect(
    () => work.set({ dirty, inFlight: busy, outcomeUnknown: !!attempt }),
    [dirty, busy, attempt, work],
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
        !window.confirm(t(attempt ? "leaveUnknown" : "discard"))
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
  async function save(input: T) {
    if (lock.current || stale) return;
    if (!navigator.onLine) {
      setError(attempt ? "unknownSave" : "offline");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const next = attempt ?? {
      input: structuredClone(input),
      key: crypto.randomUUID(),
    };
    setAttempt(next);
    try {
      await options.run(next.input, next.key);
      if (!alive.current || !options.queries.isCurrent(version.current)) return;
      setAttempt(undefined);
      setDirty(false);
      options.done();
    } catch (err) {
      if (!alive.current || !options.queries.isCurrent(version.current)) return;
      if (err instanceof WearerRequestError && err.status === 429 && attempt) {
        setError("unknownSave");
      } else if (
        err instanceof WearerRequestError &&
        err.status >= 400 &&
        err.status < 500
      ) {
        setAttempt(undefined);
        setStale(err.status === 412);
        setError(
          err.status === 412
            ? "conflict"
            : err.status === 429
              ? "limited"
              : "failed",
        );
      } else setError("unknownSave");
    } finally {
      lock.current = false;
      if (alive.current && options.queries.isCurrent(version.current))
        setBusy(false);
    }
  }
  return {
    busy,
    error,
    dirty,
    attempt,
    stale,
    feedback,
    save,
    changed: () => {
      setDirty(true);
      setError("");
    },
    setError,
  };
}

function PurposeChoices({
  wearer,
  policy,
  customerId,
  shopId,
  queries,
  guard,
  updated,
}: {
  wearer: WearerProfile;
  policy: CustomerPolicy;
  customerId: string;
  shopId: string;
  queries: OwnerQueries;
  guard: OwnerGuard;
  updated: () => void;
}) {
  const t = useTranslations("wearers");
  const locale = useLocale();
  const [values, setValues] = useState({
    purpose: "",
    decision: "",
    language: "",
    source: "",
    occurredAt: "",
    explained: false,
  });
  const [saved, setSaved] = useState(false);
  const mutation = useWearerMutation<WearerPurposeEvent>({
    queries,
    guard,
    run: (input, key) =>
      recordWearerPurpose(
        shopId,
        customerId,
        wearer.id,
        input,
        key,
        `"v${wearer.version}"`,
      ),
    done: () => {
      setValues({
        purpose: "",
        decision: "",
        language: "",
        source: "",
        occurredAt: "",
        explained: false,
      });
      setSaved(true);
      updated();
    },
  });
  function change(next: Partial<typeof values>) {
    mutation.changed();
    setSaved(false);
    setValues((old) => ({ ...old, ...next }));
  }
  const latest = Object.fromEntries(
    [...wearer.purposes].map((p) => [p.purpose, p]),
  );
  async function save() {
    const input = wearerPurposeEventSchema.safeParse({
      purpose: values.purpose,
      decision: values.decision,
      noticeId: policy.notice?.id,
      noticeExplained: values.explained,
      language: values.language,
      giverPersonId: wearer.personId,
      source: values.source,
      occurredAt: values.occurredAt
        ? new Date(values.occurredAt).toISOString()
        : "",
    });
    if (!input.success && !mutation.attempt) {
      mutation.setError("choiceInvalid");
      return;
    }
    if (mutation.attempt || input.success)
      await mutation.save(
        mutation.attempt?.input ??
          (input.success ? input.data : ({} as WearerPurposeEvent)),
      );
  }
  return (
    <section
      className="customer-evidence"
      aria-labelledby="wearer-purpose-heading"
    >
      <h4 id="wearer-purpose-heading">
        {t("permissionTitle")}: {wearer.displayName}
      </h4>
      <p>{t(wearer.age === "adult" ? "permissionHelp" : "adultHistoryHelp")}</p>
      <p>{t("purposeBoundary")}</p>
      <dl>
        {Object.entries(purposeLabels).map(([purpose, label]) => (
          <div className="wearer-definition" key={purpose}>
            <dt>{t(label)}</dt>
            <dd>
              {latest[purpose]
                ? latest[purpose].decision === "grant" &&
                  !latest[purpose].eligible
                  ? t("ineligible")
                  : t(latest[purpose].decision)
                : t("noPermission")}
            </dd>
          </div>
        ))}
      </dl>
      <div
        ref={mutation.feedback}
        tabIndex={-1}
        role={mutation.error ? "alert" : "status"}
      >
        {mutation.error ? (
          <Status tone="warning">{t(mutation.error)}</Status>
        ) : saved ? (
          t("choiceSaved")
        ) : null}
      </div>
      {mutation.stale && (
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm(t("discard"))) updated();
          }}
        >
          {t("reload")}
        </Button>
      )}
      {wearer.age === "adult" && policy.enabled && (
        <form
          className="customer-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset
            disabled={mutation.busy || !!mutation.attempt || mutation.stale}
          >
            <legend className="sr-only">{t("permissionTitle")}</legend>
            <p>
              <strong>{t("givenBy")}:</strong> {wearer.displayName}
            </p>
            {policy.notice && (
              <details>
                <summary>{t("notice")}</summary>
                <p>{policy.notice.version}</p>
                <div className="customer-preserve" lang={locale}>
                  {locale === "ta"
                    ? policy.notice.textTa
                    : policy.notice.textEn}
                </div>
              </details>
            )}
            <Select
              id="wearer-purpose"
              label={t("purpose")}
              value={values.purpose}
              onChange={(purpose) =>
                change({ purpose, decision: "", explained: false })
              }
            >
              <option value="">{t("choose")}</option>
              {Object.entries(purposeLabels).map(([purpose, label]) => (
                <option key={purpose} value={purpose}>
                  {t(label)}
                </option>
              ))}
            </Select>
            <Select
              id="wearer-decision"
              label={t("decision")}
              value={values.decision}
              onChange={(decision) => change({ decision })}
            >
              <option value="">{t("choose")}</option>
              {(["grant", "refusal", "withdrawal"] as const).map((decision) => (
                <option key={decision} value={decision}>
                  {t(decision)}
                </option>
              ))}
            </Select>
            <Select
              id="wearer-notice-language"
              label={t("noticeLanguage")}
              value={values.language}
              onChange={(language) => change({ language, explained: false })}
            >
              <option value="">{t("choose")}</option>
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
            </Select>
            <Select
              id="wearer-choice-source"
              label={t("source")}
              value={values.source}
              onChange={(source) => change({ source })}
            >
              <SourceOptions t={t} />
            </Select>
            <Labeled id="wearer-choice-at" label={t("occurred")}>
              <Input
                id="wearer-choice-at"
                type="datetime-local"
                value={values.occurredAt}
                onChange={(e) => change({ occurredAt: e.target.value })}
              />
            </Labeled>
            <label className="customer-consent">
              <input
                type="checkbox"
                checked={values.explained}
                onChange={(e) => change({ explained: e.target.checked })}
              />
              <span>{t("explained")}</span>
            </label>
          </fieldset>
          <Button type="submit" disabled={mutation.busy || mutation.stale}>
            {t(
              mutation.busy
                ? "busy"
                : mutation.attempt
                  ? "retry"
                  : "recordChoice",
            )}
          </Button>
        </form>
      )}
      {wearer.purposes.length > 0 && (
        <details>
          <summary>{t("history")}</summary>
          <ul className="wearer-history">
            {wearer.purposes.map((p) => (
              <li key={p.id}>
                <strong>
                  {t(purposeLabels[p.purpose])}: {t(p.decision)}
                </strong>
                <p>
                  {t("givenBy")}: {wearer.displayName}; {p.noticeVersion};{" "}
                  {p.language === "ta" ? "தமிழ்" : "English"}
                </p>
                <p>
                  {t("occurred")}:{" "}
                  {new Date(p.occurredAt).toLocaleString(locale)};{" "}
                  {t("recorded")}:{" "}
                  {new Date(p.recordedAt).toLocaleString(locale)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function WearerCorrection({
  wearer,
  customer,
  shopId,
  queries,
  guard,
  close,
  updated,
}: {
  wearer: WearerProfile;
  customer: CustomerProfile;
  shopId: string;
  queries: OwnerQueries;
  guard: OwnerGuard;
  close: () => void;
  updated: () => void;
}) {
  const t = useTranslations("wearers");
  const { register, getValues, reset, setValue } = useForm<WearerUpdate>({
    defaultValues: {
      age: wearer.age,
      preferences: wearer.preferences,
      relationship: wearer.relationship,
    },
  });
  const mutation = useWearerMutation<WearerUpdate>({
    queries,
    guard,
    run: (input, key) =>
      correctWearer(
        shopId,
        customer.id,
        wearer.id,
        input,
        key,
        `"v${wearer.version}"`,
      ),
    done: () => {
      close();
      updated();
    },
  });
  async function save() {
    const raw = getValues();
    const input = wearerUpdateSchema.safeParse({
      age: raw.age,
      preferences: raw.preferences,
      relationship: {
        kind: raw.relationship.kind,
        statementByPersonId: customer.personId,
        authorised: raw.relationship.authorised,
        informed: raw.relationship.informed,
        authorisationDeclined: raw.relationship.authorisationDeclined,
        informedDeclined: raw.relationship.informedDeclined,
        source: raw.relationship.source,
        occurredAt: raw.relationship.occurredAt
          ? new Date(raw.relationship.occurredAt).toISOString()
          : "",
        interaction: raw.relationship.interaction,
      },
    });
    if (!input.success && !mutation.attempt) {
      mutation.setError("validation");
      return;
    }
    await mutation.save(
      mutation.attempt?.input ??
        (input.success ? input.data : ({} as WearerUpdate)),
    );
  }
  useEffect(() => {
    reset({
      age: wearer.age,
      preferences: wearer.preferences,
      relationship: {
        ...wearer.relationship,
        occurredAt: localTime(wearer.relationship.occurredAt),
      },
    });
  }, [wearer, reset]);
  return (
    <form
      className="customer-form"
      noValidate
      onChange={mutation.changed}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h4>
        {t("edit")}: {wearer.displayName}
      </h4>
      <div ref={mutation.feedback} tabIndex={-1} role="alert">
        {mutation.error && <Status tone="warning">{t(mutation.error)}</Status>}
      </div>
      {mutation.stale && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (window.confirm(t("discard"))) {
              close();
              updated();
            }
          }}
        >
          {t("reload")}
        </Button>
      )}
      <fieldset
        disabled={mutation.busy || !!mutation.attempt || mutation.stale}
      >
        <legend className="sr-only">{t("edit")}</legend>
        <Labeled id="wearer-correct-age" label={t("age")}>
          <select
            id="wearer-correct-age"
            className="ui-input"
            {...register("age")}
          >
            <AgeOptions t={t} />
          </select>
        </Labeled>
        <p className="customer-muted">{t("ageHelp")}</p>
        {preferenceFields.map((key) => (
          <Labeled
            key={key}
            id={`wearer-correct-pref-${key}`}
            label={t(key === "source" ? "preferenceSource" : key)}
          >
            <Input
              id={`wearer-correct-pref-${key}`}
              autoComplete="off"
              maxLength={1000}
              {...register(`preferences.${key}`)}
            />
          </Labeled>
        ))}
        {wearer.relationship.kind !== "self" && (
          <Labeled id="wearer-correct-kind" label={t("relationship")}>
            <select
              id="wearer-correct-kind"
              className="ui-input"
              {...register("relationship.kind")}
            >
              <option value="family">{t("family")}</option>
              <option value="other">{t("other")}</option>
            </select>
          </Labeled>
        )}
        <Labeled id="wearer-correct-interaction" label={t("interaction")}>
          <Input
            id="wearer-correct-interaction"
            maxLength={500}
            autoComplete="off"
            {...register("relationship.interaction")}
          />
        </Labeled>
        <p>
          {t("statementBy")}: {customer.displayName}
        </p>
        <label className="customer-consent">
          <input
            type="checkbox"
            {...register("relationship.authorised", {
              onChange: (e) => {
                if (e.target.checked)
                  setValue("relationship.authorisationDeclined", false);
              },
            })}
          />
          <span>{t("authorised")}</span>
        </label>
        <label className="customer-consent">
          <input
            type="checkbox"
            {...register("relationship.informed", {
              onChange: (e) => {
                if (e.target.checked)
                  setValue("relationship.informedDeclined", false);
              },
            })}
          />
          <span>{t("informed")}</span>
        </label>
        <label className="customer-consent">
          <input
            type="checkbox"
            {...register("relationship.authorisationDeclined", {
              onChange: (e) => {
                if (e.target.checked)
                  setValue("relationship.authorised", false);
              },
            })}
          />
          <span>{t("authorisationDeclined")}</span>
        </label>
        <label className="customer-consent">
          <input
            type="checkbox"
            {...register("relationship.informedDeclined", {
              onChange: (e) => {
                if (e.target.checked) setValue("relationship.informed", false);
              },
            })}
          />
          <span>{t("informedDeclined")}</span>
        </label>
        <Labeled id="wearer-correct-source" label={t("source")}>
          <select
            id="wearer-correct-source"
            className="ui-input"
            {...register("relationship.source")}
          >
            <SourceOptions t={t} />
          </select>
        </Labeled>
        <Labeled id="wearer-correct-at" label={t("occurred")}>
          <Input
            id="wearer-correct-at"
            type="datetime-local"
            {...register("relationship.occurredAt")}
          />
        </Labeled>
      </fieldset>
      <div className="customer-actions">
        <Button type="submit" disabled={mutation.busy || mutation.stale}>
          {t(
            mutation.busy ? "busy" : mutation.attempt ? "retry" : "correction",
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (
              (!mutation.dirty && !mutation.attempt) ||
              window.confirm(t(mutation.attempt ? "leaveUnknown" : "discard"))
            )
              close();
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
