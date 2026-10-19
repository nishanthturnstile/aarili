import { readMeasurementForms } from "@aarili/api/measurement-forms-client";
import {
  readCatalogueDefinition,
  readServiceCatalogue,
} from "@aarili/api/service-catalogue-client";
import { previewServiceRequirements } from "@aarili/api/service-templates-client";
import type { ServiceTemplateContent } from "@aarili/contracts/service-templates";
import {
  presentServiceRequirements,
  templateSections,
} from "@aarili/contracts/service-templates";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { v7 } from "uuid";
import { usePresentationMode } from "./shop-presentation";

type Content = ServiceTemplateContent;
type Section = (typeof templateSections)[number];
type T = ReturnType<typeof useTranslations<"serviceTemplates">>;
type Key = Parameters<T>[0];
type Row = Content[Section][number];
const decisions = ["unresolved", "applicable", "not-applicable"];
const split = (value: string) =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function PlainField({
  id,
  label,
  value,
  change,
  invalid = false,
  max = 160,
}: {
  id: string;
  label: string;
  value: string;
  change: (v: string) => void;
  invalid?: boolean;
  max?: number;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        maxLength={max}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={invalid ? "directory-validation" : undefined}
        onChange={(e) => change(e.target.value)}
      />
    </Field>
  );
}
function KeyListField({
  id,
  label,
  values,
  change,
}: {
  id: string;
  label: string;
  values: string[];
  change: (keys: string[]) => void;
}) {
  const canonical = JSON.stringify(values);
  const [entry, setEntry] = useState({ canonical, text: values.join(", ") });
  useEffect(() => {
    setEntry((old) =>
      old.canonical === canonical
        ? old
        : { canonical, text: (JSON.parse(canonical) as string[]).join(", ") },
    );
  }, [canonical]);
  return (
    <PlainField
      id={id}
      label={label}
      value={entry.text}
      max={8098}
      change={(text) => {
        const keys = split(text);
        setEntry({ text, canonical: JSON.stringify(keys) });
        change(keys);
      }}
    />
  );
}
function Choice({
  id,
  label,
  value,
  choices,
  change,
  invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  choices: { value: string; label: string }[];
  change: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        className="ui-input"
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? "directory-validation" : undefined}
        onChange={(e) => change(e.target.value)}
      >
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
function Sources({
  shopId,
  content: c,
  onChange,
}: {
  shopId: string;
  content: Content;
  onChange: (c: Content) => void;
}) {
  const t = useTranslations("serviceTemplates"),
    locale = useLocale(),
    uid = useId();
  const [query, setQuery] = useState(""),
    [services, setServices] =
      useState<Awaited<ReturnType<typeof readServiceCatalogue>>>(),
    [forms, setForms] =
      useState<Awaited<ReturnType<typeof readMeasurementForms>>>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const current = useRef(c),
    mounted = useRef(true);
  current.current = c;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await f();
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const formsFor = (key: string | null) =>
    forms?.entries.filter(
      (r) =>
        r.configurationEligible &&
        r.definition.content.service?.entryId === c.service?.entryId &&
        r.definition.content.service?.revisionId === c.service?.revisionId &&
        (r.definition.content.piece?.entryId ?? null) ===
          (c.pieces.find((p) => p.key === key)?.entryId ?? null),
    ) ?? [];
  const chooseForm = (key: string | null) => (
    <Choice
      id={`${uid}-form-${key ?? "service"}`}
      label={`${t("form")} · ${key ?? t("whole")}`}
      value={c.forms.find((f) => f.pieceKey === key)?.revisionId ?? ""}
      choices={[
        { value: "", label: t("unresolved") },
        ...formsFor(key).map((r) => ({
          value: r.definition.id,
          label: `${locale === "ta" ? r.definition.content.labelTa : r.definition.content.labelEn} · ${r.definition.id}`,
        })),
      ]}
      change={(id) => {
        const r = formsFor(key).find((r) => r.definition.id === id);
        onChange({
          ...c,
          forms: [
            ...c.forms.filter((f) => f.pieceKey !== key),
            ...(r
              ? [
                  {
                    pieceKey: key,
                    entryId: r.entryId,
                    revisionId: r.definition.id,
                  },
                ]
              : []),
          ],
        });
      }}
    />
  );
  return (
    <section aria-label={t("sources")}>
      <h4>{t("sources")}</h4>
      {c.service && (
        <p className="shop-actor">
          {t("service")}: {c.service.entryId} · {c.service.revisionId}
        </p>
      )}
      <PlainField
        id={`${uid}-query`}
        label={t("find")}
        value={query}
        max={160}
        change={setQuery}
      />
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const list = await readServiceCatalogue(shopId, undefined, query);
            if (mounted.current) setServices(list);
          })
        }
      >
        {t("search")}
      </Button>
      {failed && <p role="alert">{t("error")}</p>}
      {services && (
        <ul className="directory-list">
          {services.entries
            .filter(
              (r) =>
                r.definition.content.kind === "service" &&
                r.configurationEligible,
            )
            .map((r) => (
              <li key={r.id}>
                <span>
                  {locale === "ta"
                    ? r.definition.content.labelTa
                    : r.definition.content.labelEn}
                </span>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const selected = current.current;
                      const pieces = [],
                        addons = [];
                      for (const ref of r.definition.content.pieces) {
                        const d = await readCatalogueDefinition(
                          shopId,
                          ref.revisionId,
                        );
                        pieces.push({
                          ...ref,
                          key: d.content.code,
                          applicability: "unresolved" as const,
                          reason: "",
                        });
                      }
                      for (const ref of r.definition.content.addons) {
                        const d = await readCatalogueDefinition(
                          shopId,
                          ref.revisionId,
                        );
                        addons.push({
                          ...ref,
                          key: d.content.code,
                          applicability: "unresolved" as const,
                          reason: "",
                        });
                      }
                      if (mounted.current && current.current === selected) {
                        onChange({
                          ...selected,
                          service: {
                            entryId: r.entryId,
                            revisionId: r.definition.id,
                          },
                          pieces: pieces.map(({ optional: _, ...p }) => p),
                          addons: addons.map(({ optional: _, ...p }) => p),
                          forms: [],
                        });
                        setForms(undefined);
                      }
                    })
                  }
                >
                  {t("select")}
                </Button>
              </li>
            ))}
        </ul>
      )}
      {services?.next && (
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const next = await readServiceCatalogue(
                shopId,
                services.next ?? undefined,
                query,
              );
              if (mounted.current)
                setServices({
                  ...next,
                  entries: [...services.entries, ...next.entries],
                });
            })
          }
        >
          {t("more")}
        </Button>
      )}
      {(["pieces", "addons"] as const).map((kind) => (
        <div key={kind}>
          {c[kind].map((p, i) => (
            <fieldset key={p.entryId}>
              <legend>
                {t(kind)} · {p.key}
              </legend>
              <p className="shop-actor">
                {p.entryId} · {p.revisionId}
              </p>
              <Choice
                id={`${uid}-${kind}-${i}-decision`}
                label={t("decision")}
                value={p.applicability}
                choices={decisions.map((value) => ({
                  value,
                  label: t(value as Key),
                }))}
                change={(v) =>
                  onChange({
                    ...c,
                    [kind]: c[kind].map((x, n) =>
                      n === i ? { ...x, applicability: v } : x,
                    ),
                  })
                }
              />
              <PlainField
                id={`${uid}-${kind}-${i}-reason`}
                label={t("decisionReason")}
                value={p.reason}
                max={1000}
                change={(v) =>
                  onChange({
                    ...c,
                    [kind]: c[kind].map((x, n) =>
                      n === i ? { ...x, reason: v } : x,
                    ),
                  })
                }
              />
            </fieldset>
          ))}
        </div>
      ))}
      <Button
        variant="outline"
        disabled={!c.service || busy}
        onClick={() =>
          void run(async () => {
            const list = await readMeasurementForms(shopId);
            if (mounted.current) setForms(list);
          })
        }
      >
        {t("chooseForm")}
      </Button>
      {forms &&
        (c.pieces.length
          ? c.pieces
              .filter((p) => p.applicability !== "not-applicable")
              .map((p) => <div key={p.key}>{chooseForm(p.key)}</div>)
          : chooseForm(null))}
      {forms?.next && (
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const next = await readMeasurementForms(
                shopId,
                forms.next ?? undefined,
              );
              if (mounted.current)
                setForms({
                  ...next,
                  entries: [...forms.entries, ...next.entries],
                });
            })
          }
        >
          {t("more")}
        </Button>
      )}
      {c.forms.map((f) => (
        <div key={f.revisionId}>
          <p className="shop-actor">
            {t("selected")} · {f.pieceKey ?? t("whole")} · {f.entryId} ·{" "}
            {f.revisionId}
          </p>
          <Button
            variant="ghost"
            onClick={() =>
              onChange({ ...c, forms: c.forms.filter((x) => x !== f) })
            }
          >
            {t("remove")}
          </Button>
        </div>
      ))}
    </section>
  );
}
function newRow(name: Section): Row {
  const common = {
    key: `item-${v7().replaceAll("-", "")}`,
    labelEn: "",
    labelTa: "",
    required: null,
    applicability: "unresolved" as const,
    applicabilityReason: "",
    scope: { pieceKey: null, addonKey: null },
    instructionEn: "",
    instructionTa: "",
  };
  if (name === "materials")
    return { ...common, kind: "main-fabric", source: "unresolved" };
  if (name === "tasks")
    return {
      ...common,
      milestone: "work",
      assignee: "owner",
      predecessors: [],
      prerequisites: [],
    };
  if (name === "quality")
    return { ...common, kind: "construction", taskKeys: [] };
  if (name === "instructions") return { ...common, audience: "internal" };
  if (name === "confirmation") return { ...common, topic: "design-scope" };
  return common;
}
export function TemplateContentEditor({
  content: c,
  shopId,
  onChange,
  issues,
}: {
  content: Content;
  shopId: string;
  onChange: (c: Content) => void;
  issues: readonly { path: PropertyKey[] }[];
}) {
  const t = useTranslations("serviceTemplates"),
    uid = useId();
  const choices = (values: string[]) =>
    values.map((value) => ({ value, label: t(value as Key) }));
  return (
    <>
      <Sources shopId={shopId} content={c} onChange={onChange} />
      <p>{t("tokensHint")}</p>
      {templateSections.map((name) => (
        <details key={name} className="directory-task">
          <summary>
            {t(name)} · {t(c.sections[name].decision)}
          </summary>
          <Choice
            id={`${uid}-${name}-decision`}
            label={t("decision")}
            value={c.sections[name].decision}
            choices={choices(decisions)}
            invalid={issues.some(
              (i) => i.path[1] === "sections" && i.path[2] === name,
            )}
            change={(v) =>
              onChange({
                ...c,
                sections: {
                  ...c.sections,
                  [name]: { ...c.sections[name], decision: v },
                },
              })
            }
          />
          <PlainField
            id={`${uid}-${name}-reason`}
            label={t("decisionReason")}
            value={c.sections[name].reason}
            max={1000}
            change={(v) =>
              onChange({
                ...c,
                sections: {
                  ...c.sections,
                  [name]: { ...c.sections[name], reason: v },
                },
              })
            }
          />
          {c[name].map((r, i) => {
            const id = `${uid}-${name}-${i}`;
            const invalid = issues.some(
              (issue) =>
                issue.path[1] === name &&
                (issue.path[2] === i || issue.path.length === 2),
            );
            const update = (patch: Partial<Row>) =>
              onChange({
                ...c,
                [name]: c[name].map((x, n) =>
                  n === i ? { ...x, ...patch } : x,
                ),
              });
            const field = (
              key:
                | "key"
                | "labelEn"
                | "labelTa"
                | "instructionEn"
                | "instructionTa"
                | "applicabilityReason",
              label: Key,
              max = 160,
            ) => (
              <PlainField
                id={`${id}-${key}`}
                label={t(label)}
                value={r[key]}
                max={max}
                invalid={invalid}
                change={(v) => update({ [key]: v })}
              />
            );
            const choice = (
              key: string,
              label: Key,
              value: string,
              values: string[],
              change: (v: string) => void,
            ) => (
              <Choice
                id={`${id}-${key}`}
                label={t(label)}
                value={value}
                choices={choices(values)}
                invalid={invalid}
                change={change}
              />
            );
            return (
              <fieldset key={id}>
                <legend>
                  {t(name)} · {i + 1}
                </legend>
                {field("key", "key", 80)}
                {field("labelEn", "labelEn")}
                {field("labelTa", "labelTa")}
                {choice(
                  "required",
                  "requirement",
                  r.required === null
                    ? "unresolved"
                    : r.required
                      ? "required"
                      : "optional",
                  ["unresolved", "required", "optional"],
                  (v) =>
                    update({
                      required: v === "unresolved" ? null : v === "required",
                    }),
                )}
                {choice(
                  "applicability",
                  "itemApplicability",
                  r.applicability,
                  decisions,
                  (v) => update({ applicability: v as Row["applicability"] }),
                )}
                {field("applicabilityReason", "decisionReason", 1000)}
                <Choice
                  id={`${id}-piece`}
                  label={t("scopePiece")}
                  value={r.scope.pieceKey ?? ""}
                  choices={[
                    { value: "", label: t("whole") },
                    ...c.pieces.map((p) => ({ value: p.key, label: p.key })),
                  ]}
                  change={(v) =>
                    update({ scope: { ...r.scope, pieceKey: v || null } })
                  }
                />
                <Choice
                  id={`${id}-addon`}
                  label={t("scopeAddon")}
                  value={r.scope.addonKey ?? ""}
                  choices={[
                    { value: "", label: t("whole") },
                    ...c.addons.map((p) => ({ value: p.key, label: p.key })),
                  ]}
                  change={(v) =>
                    update({ scope: { ...r.scope, addonKey: v || null } })
                  }
                />
                {field("instructionEn", "instructionEn", 2000)}
                {field("instructionTa", "instructionTa", 2000)}
                {"source" in r && (
                  <>
                    {choice(
                      "kind",
                      "kind",
                      r.kind,
                      [
                        "main-fabric",
                        "lining",
                        "extra-fabric",
                        "trim",
                        "craft-consumable",
                      ],
                      (v) =>
                        update({
                          kind: v as Content["materials"][number]["kind"],
                        }),
                    )}
                    {choice(
                      "source",
                      "source",
                      r.source,
                      ["unresolved", "customer", "shop", "artisan"],
                      (v) =>
                        update({
                          source: v as Content["materials"][number]["source"],
                        }),
                    )}
                  </>
                )}
                {"predecessors" in r && (
                  <>
                    {choice(
                      "milestone",
                      "milestone",
                      r.milestone,
                      ["cutting", "work", "trial", "ready"],
                      (v) =>
                        update({
                          milestone: v as Content["tasks"][number]["milestone"],
                        }),
                    )}
                    <KeyListField
                      id={`${id}-predecessors`}
                      label={t("predecessors")}
                      values={r.predecessors}
                      change={(predecessors) => update({ predecessors })}
                    />
                    <fieldset>
                      <legend>{t("prerequisites")}</legend>
                      {(
                        [
                          "design",
                          "measurement",
                          "manual-method",
                          "material",
                          "quality",
                        ] as const
                      ).map((key) => (
                        <label key={key} className="directory-check">
                          <input
                            type="checkbox"
                            checked={r.prerequisites.includes(key)}
                            onChange={(e) =>
                              update({
                                prerequisites: e.target.checked
                                  ? [...r.prerequisites, key]
                                  : r.prerequisites.filter((x) => x !== key),
                              })
                            }
                          />
                          {t(key)}
                        </label>
                      ))}
                    </fieldset>
                  </>
                )}
                {"taskKeys" in r && (
                  <>
                    {choice(
                      "kind",
                      "kind",
                      r.kind,
                      [
                        "construction",
                        "finishing",
                        "closures",
                        "visible-defects",
                        "dimension-definition",
                      ],
                      (v) =>
                        update({
                          kind: v as Content["quality"][number]["kind"],
                        }),
                    )}
                    <KeyListField
                      id={`${id}-taskKeys`}
                      label={t("taskKeys")}
                      values={r.taskKeys}
                      change={(taskKeys) => update({ taskKeys })}
                    />
                  </>
                )}
                {"audience" in r &&
                  choice(
                    "audience",
                    "audience",
                    r.audience,
                    ["internal", "customer"],
                    (v) =>
                      update({
                        audience:
                          v as Content["instructions"][number]["audience"],
                      }),
                  )}
                {"topic" in r &&
                  choice(
                    "topic",
                    "topic",
                    r.topic,
                    [
                      "design-scope",
                      "price-basis",
                      "date",
                      "inclusions",
                      "exclusions",
                      "supplied-materials",
                    ],
                    (v) =>
                      update({
                        topic: v as Content["confirmation"][number]["topic"],
                      }),
                  )}
                <div className="calendar-actions">
                  {([-1, 1] as const).map((offset) => (
                    <Button
                      key={offset}
                      variant="outline"
                      disabled={i + offset < 0 || i + offset >= c[name].length}
                      onClick={() => {
                        const rows = [...c[name]],
                          row = rows.splice(i, 1)[0];
                        if (row) rows.splice(i + offset, 0, row);
                        onChange({ ...c, [name]: rows });
                      }}
                    >
                      {t(offset < 0 ? "up" : "down")}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      onChange({
                        ...c,
                        [name]: c[name].filter((_, n) => n !== i),
                      })
                    }
                  >
                    {t("removeItem")}
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <Button
            variant="outline"
            disabled={c[name].length >= 100}
            onClick={() =>
              onChange({ ...c, [name]: [...c[name], newRow(name)] })
            }
          >
            {t("addItem")}
          </Button>
        </details>
      ))}
      <RequirementsPreview shopId={shopId} content={c} />
    </>
  );
}
function RequirementsPreview({
  shopId,
  content,
  templateRevisionId,
  landmark = true,
}: {
  shopId: string;
  content: Content;
  templateRevisionId?: string | undefined;
  landmark?: boolean;
}) {
  const t = useTranslations("serviceTemplates"),
    locale = useLocale();
  const shopMode = usePresentationMode();
  const modeId = useId();
  const [override, setOverride] = useState<"simple" | "detailed">();
  const mode = override ?? shopMode;
  const [preview, setPreview] = useState<{
      source: Content;
      value: Awaited<ReturnType<typeof previewServiceRequirements>>;
    }>(),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const latest = useRef(content),
    alive = useRef(true);
  latest.current = content;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const fresh =
    preview &&
    JSON.stringify(preview.source) === JSON.stringify(content) &&
    preview.value.templateRevisionId === (templateRevisionId ?? null);
  const projection = fresh
    ? presentServiceRequirements(preview.value, mode)
    : null;
  return (
    <section aria-label={landmark ? t("previewTitle") : undefined}>
      <h4>{t("previewTitle")}</h4>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          const source = content;
          setBusy(true);
          setFailed(false);
          try {
            const value = await previewServiceRequirements(
              shopId,
              source,
              templateRevisionId,
            );
            if (
              alive.current &&
              JSON.stringify(latest.current) === JSON.stringify(source)
            )
              setPreview({ source, value });
          } catch {
            if (alive.current) setFailed(true);
          } finally {
            if (alive.current) setBusy(false);
          }
        }}
      >
        {t("preview")}
      </Button>
      {failed && <p role="alert">{t("previewUnavailable")}</p>}
      {preview && !fresh && <p role="status">{t("previewStale")}</p>}
      {fresh && (
        <>
          <p>{t("manual")}</p>
          {preview.value.unavailableSources.length > 0 && (
            <p role="alert">
              {t("referencesUnavailable")}:{" "}
              {preview.value.unavailableSources.join(", ")}
            </p>
          )}
          <fieldset>
            <legend>{t("sampleMode")}</legend>
            {(["simple", "detailed"] as const).map((value) => (
              <label className="directory-check" key={value}>
                <input
                  type="radio"
                  name={`mode-${modeId}`}
                  checked={mode === value}
                  onChange={() => setOverride(value)}
                />
                {t(value)}
              </label>
            ))}
            <Button variant="ghost" onClick={() => setOverride(undefined)}>
              {t("useShopMode")}
            </Button>
          </fieldset>
          <p>{t("illustrativeMilestones")}</p>
          <ol>
            {preview.value.milestones.map((m) => (
              <li key={m.key}>
                <strong>{t(m.key)}</strong> · {t(m.state)}
                {m.requiredBlockers.length > 0 && (
                  <p>
                    {t("blockers")}: {m.requiredBlockers.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="shop-actor">{preview.value.fingerprint}</p>
          {preview.value.sections.map((s) => (
            <p key={s.key}>
              {t(s.key as Key)} · {t(s.decision)} · {s.reason}
            </p>
          ))}
          <ul>
            {projection?.items.map((r) => (
              <li key={`${r.section}:${r.key}`}>
                <strong>{locale === "ta" ? r.labelTa : r.labelEn}</strong> ·{" "}
                {t(
                  r.required === null
                    ? "unresolved"
                    : r.required
                      ? "required"
                      : "optional",
                )}{" "}
                · {t(r.applicability)} · {t(r.state)}
                {mode === "detailed" && <p>{r.source}</p>}
                {r.blockers.length > 0 && (
                  <p>
                    {t("blockers")}: {r.blockers.join(", ")}
                  </p>
                )}
                {r.unresolvedTokens.length > 0 && (
                  <p>
                    {t("tokens")}: {r.unresolvedTokens.join(", ")}
                  </p>
                )}
                {r.assigneeId && (
                  <p className="shop-actor">
                    {t("assignee")}: {r.assigneeId}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {mode === "detailed" && (
            <details>
              <summary>{t("canonicalDetail")}</summary>
              {(["pieces", "addons"] as const).map((kind) =>
                preview.value.definition[kind].map((r) => (
                  <p key={r.key}>
                    {t(kind)} · {r.key} · {r.revisionId} · {t(r.applicability)}{" "}
                    · {r.reason}
                  </p>
                )),
              )}
              {templateSections.map((section) =>
                preview.value.definition[section].map((r) => (
                  <div key={`${section}:${r.key}`}>
                    <p>
                      {t(section)} · {r.key} · {r.scope.pieceKey ?? t("whole")}{" "}
                      · {r.scope.addonKey ?? t("whole")}
                    </p>
                    <p>{locale === "ta" ? r.instructionTa : r.instructionEn}</p>
                    <p>{r.applicabilityReason}</p>
                  </div>
                )),
              )}
            </details>
          )}
          <h5>{t("sources")}</h5>
          {preview.value.sources.map((s) => (
            <p className="shop-actor" key={s}>
              {s}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
export function TemplateContentView({
  content: c,
  shopId,
  templateRevisionId,
}: {
  content: Content;
  shopId: string;
  templateRevisionId?: string | undefined;
}) {
  const t = useTranslations("serviceTemplates");
  return (
    <>
      <p>
        {c.labelEn} / {c.labelTa} · {c.code}
      </p>
      <p>{c.description}</p>
      {c.aliases.length > 0 && (
        <p>
          {t("aliases")}: {c.aliases.join(", ")}
        </p>
      )}
      {c.service && (
        <p className="shop-actor">
          {t("service")} · {c.service.entryId} · {c.service.revisionId}
        </p>
      )}
      {(["pieces", "addons"] as const).map((kind) =>
        c[kind].map((r) => (
          <div key={r.entryId}>
            <p>
              {t(kind)} · {r.key} · {t(r.applicability)} · {r.reason}
            </p>
            <p className="shop-actor">
              {r.entryId} · {r.revisionId}
            </p>
          </div>
        )),
      )}
      {c.forms.map((r) => (
        <p className="shop-actor" key={r.revisionId}>
          {t("form")} · {r.pieceKey ?? t("whole")} · {r.entryId} ·{" "}
          {r.revisionId}
        </p>
      ))}
      {templateSections.map((name) => (
        <section key={name}>
          <h4>
            {t(name)} · {t(c.sections[name].decision)}
          </h4>
          <p>{c.sections[name].reason}</p>
          <ul>
            {c[name].map((r) => (
              <li key={r.key}>
                <strong>
                  {r.labelEn} / {r.labelTa}
                </strong>{" "}
                · {r.key} ·{" "}
                {t(
                  r.required === null
                    ? "unresolved"
                    : r.required
                      ? "required"
                      : "optional",
                )}{" "}
                · {t(r.applicability)}
                <p>{r.applicabilityReason}</p>
                <p>
                  {r.instructionEn} / {r.instructionTa}
                </p>
                <p>
                  {r.scope.pieceKey ?? t("whole")} ·{" "}
                  {r.scope.addonKey ?? t("whole")}
                </p>
                {"predecessors" in r && (
                  <p>
                    {t("predecessors")}: {r.predecessors.join(", ")} ·{" "}
                    {t("prerequisites")}:{" "}
                    {r.prerequisites.map((x) => t(x)).join(", ")} ·{" "}
                    {t(r.milestone)}
                  </p>
                )}
                {"source" in r && (
                  <p>
                    {t(r.kind)} · {t(r.source)}
                  </p>
                )}
                {"taskKeys" in r && (
                  <p>
                    {t(r.kind)} · {r.taskKeys.join(", ")}
                  </p>
                )}
                {"audience" in r && <p>{t(r.audience)}</p>}
                {"topic" in r && <p>{t(r.topic)}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <RequirementsPreview
        shopId={shopId}
        content={c}
        templateRevisionId={templateRevisionId}
        landmark={false}
      />
    </>
  );
}
