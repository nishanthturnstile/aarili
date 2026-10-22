import {
  previewDesignChoices,
  readDesignChoices,
  readDesignChoicesDefinition,
} from "@aarili/api/design-choices-client";
import {
  readCatalogueDefinition,
  readServiceCatalogue,
} from "@aarili/api/service-catalogue-client";
import {
  readServiceTemplateDefinition,
  readServiceTemplates,
} from "@aarili/api/service-templates-client";
import {
  type DesignChoicesContent,
  type DesignChoicesRevision,
  type DesignQuestion,
  designDimensions,
} from "@aarili/contracts/design-choices";
import type { ServiceTemplateRevision } from "@aarili/contracts/service-templates";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { v7 } from "uuid";

type Ref = { entryId: string; revisionId: string };
type T = ReturnType<typeof useTranslations<"designChoices">>;
function Text({
  label,
  value,
  onChange,
  max = 1000,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        maxLength={max}
        aria-invalid={invalid}
        aria-describedby={invalid ? "directory-validation" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        className="ui-input"
        aria-invalid={invalid}
        aria-describedby={invalid ? "directory-validation" : undefined}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
const ref = (r: { entryId: string; definition: { id: string } }) => ({
  entryId: r.entryId,
  revisionId: r.definition.id,
});
const same = (a: Ref, b: Ref) =>
  a.entryId === b.entryId && a.revisionId === b.revisionId;
function SourceName({
  shopId,
  reference,
  kind,
}: {
  shopId: string;
  reference: Ref;
  kind: "category" | "manifest" | "choice";
}) {
  const locale = useLocale(),
    t = useTranslations("designChoices"),
    [label, setLabel] = useState<string>();
  useEffect(() => {
    let alive = true;
    setLabel(undefined);
    const read =
      kind === "category"
        ? readCatalogueDefinition
        : kind === "manifest"
          ? readServiceTemplateDefinition
          : readDesignChoicesDefinition;
    void read(shopId, reference.revisionId).then(
      (r) => {
        if (alive)
          setLabel(locale === "ta" ? r.content.labelTa : r.content.labelEn);
      },
      () => {
        if (alive) setLabel(t("historical"));
      },
    );
    return () => {
      alive = false;
    };
  }, [shopId, reference.revisionId, kind, locale, t]);
  return <span>{label ?? t("loading")}</span>;
}
export function DesignContentView({
  content: c,
  shopId,
}: {
  content: DesignChoicesContent;
  shopId: string;
  t?: unknown;
}) {
  const locale = useLocale(),
    t = useTranslations("designChoices");
  return (
    <div>
      <h4>{locale === "ta" ? c.labelTa : c.labelEn}</h4>
      <p>{c.description}</p>
      <p>
        {t(c.kind)} · {c.code}
      </p>
      {c.category && (
        <p>
          {t("category")}:{" "}
          <SourceName shopId={shopId} reference={c.category} kind="category" />
        </p>
      )}
      {c.kind === "choice" ? (
        <>
          <p>
            {t(c.dimension)} · {c.meaning}
          </p>
          {c.none && <p>{t("none")}</p>}
        </>
      ) : (
        <>
          <p>
            {t("scope")}: {c.pieceKey ?? t("whole")}
          </p>
          {c.manifest && (
            <p>
              {t("manifest")}:{" "}
              <SourceName
                shopId={shopId}
                reference={c.manifest}
                kind="manifest"
              />
            </p>
          )}
          <p>{c.decisionReason}</p>
          <ol>
            {c.questions.map((q) => (
              <li key={q.id}>
                <strong>
                  {t(q.key)}: {locale === "ta" ? q.labelTa : q.labelEn}
                </strong>
                <p>
                  {q.meaning} ·{" "}
                  {t(
                    q.applicability === "not-applicable"
                      ? "notApplicable"
                      : q.applicability,
                  )}{" "}
                  · {t(q.required ? "required" : "optional")}
                </p>
                {q.reason && <p>{q.reason}</p>}
                <ul>
                  {q.choices.map((r) => (
                    <li key={r.entryId}>
                      <SourceName shopId={shopId} reference={r} kind="choice" />
                    </li>
                  ))}
                </ul>
                {q.kind === "garment-length" && (
                  <p>
                    {t("lengthKind")}: {q.units.join(" / ")} ·{" "}
                    {q.precision?.increment} {q.precision?.unit} ·{" "}
                    {q.precision?.review}
                  </p>
                )}
                {q.when.length > 0 && (
                  <p>
                    {t("dependency")}:{" "}
                    {q.when
                      .map((w) =>
                        c.questions.find((p) => p.id === w.questionId),
                      )
                      .filter(Boolean)
                      .map((p) => (locale === "ta" ? p?.labelTa : p?.labelEn))
                      .join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p>
            {t("templateKeys")}: {c.templateKeys.join(", ")}
          </p>
        </>
      )}
      <p>{t("examples")}</p>
    </div>
  );
}

export function DesignContentEditor({
  content: c,
  onChange: edit,
  shopId,
  issues = [],
}: {
  content: DesignChoicesContent;
  onChange: (content: DesignChoicesContent) => void;
  shopId: string;
  issues?: readonly { path: readonly PropertyKey[] }[];
}) {
  const problem = (...path: (string | number)[]) =>
    issues.some((issue) =>
      ["content", ...path].every((part, i) => issue.path[i] === part),
    );
  const t = useTranslations("designChoices"),
    locale = useLocale();
  const [categories, setCategories] = useState<
      Awaited<ReturnType<typeof readServiceCatalogue>>["entries"]
    >([]),
    [manifests, setManifests] = useState<ServiceTemplateRevision[]>([]),
    [choices, setChoices] = useState<DesignChoicesRevision[]>([]),
    [failed, setFailed] = useState(false),
    [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit refresh reloads the exact eligible source inventory.
  useEffect(() => {
    let alive = true;
    setCategories([]);
    setManifests([]);
    setChoices([]);
    setFailed(false);
    void (async () => {
      const cats = [];
      let cursor: string | undefined;
      do {
        const page = await readServiceCatalogue(shopId, cursor);
        cats.push(
          ...page.entries.filter(
            (r) =>
              r.configurationEligible &&
              r.definition.content.kind === "category",
          ),
        );
        cursor = page.next ?? undefined;
      } while (cursor);
      const ms = [];
      cursor = undefined;
      do {
        const page = await readServiceTemplates(shopId, cursor);
        ms.push(...page.entries.filter((r) => r.configurationEligible));
        cursor = page.next ?? undefined;
      } while (cursor);
      const cs = [];
      cursor = undefined;
      do {
        const page = await readDesignChoices(shopId, cursor);
        cs.push(
          ...page.entries.filter(
            (r) =>
              r.configurationEligible && r.definition.content.kind === "choice",
          ),
        );
        cursor = page.next ?? undefined;
      } while (cursor);
      if (alive) {
        setCategories(cats);
        setManifests(ms);
        setChoices(cs);
      }
    })().catch(() => {
      if (alive) setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [shopId, reload]);
  const name = (r: {
    definition: { content: { labelEn: string; labelTa: string } };
  }) =>
    locale === "ta"
      ? r.definition.content.labelTa
      : r.definition.content.labelEn;
  const manifest =
    c.kind === "profile"
      ? manifests.find((r) => c.manifest && same(ref(r), c.manifest))
      : undefined;
  const sourceOptions = (
    rows: {
      entryId: string;
      definition: { id: string; content: { labelEn: string; labelTa: string } };
    }[],
    current: Ref | null,
  ) => [
    { value: "", label: t("choose") },
    ...(current && !rows.some((r) => same(ref(r), current))
      ? [{ value: current.revisionId, label: t("historical") }]
      : []),
    ...rows.map((r) => ({ value: r.definition.id, label: name(r) })),
  ];
  const question = (i: number, value: DesignQuestion) => {
    if (c.kind === "profile")
      edit({
        ...c,
        questions: c.questions.map((q, n) => (n === i ? value : q)),
      });
  };
  const blank = { value: "", label: t("choose") };
  return (
    <div className="service-content-editor">
      <Text
        label={t("code")}
        invalid={problem("code")}
        value={c.code}
        max={80}
        onChange={(code) => edit({ ...c, code })}
      />
      <Text
        label={t("labelEn")}
        invalid={problem("labelEn")}
        value={c.labelEn}
        max={160}
        onChange={(labelEn) => edit({ ...c, labelEn })}
      />
      <Text
        label={t("labelTa")}
        invalid={problem("labelTa")}
        value={c.labelTa}
        max={160}
        onChange={(labelTa) => edit({ ...c, labelTa })}
      />
      <Text
        label={t("description")}
        invalid={problem("description")}
        value={c.description}
        max={2000}
        onChange={(description) => edit({ ...c, description })}
      />
      <Text
        label={t("aliases")}
        value={c.aliases.join(",")}
        max={3200}
        onChange={(value) =>
          edit({ ...c, aliases: value ? value.split(",") : [] })
        }
      />
      {failed && <p role="alert">{t("error")}</p>}
      <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
        {t("refreshSources")}
      </Button>
      <Select
        label={t("category")}
        invalid={problem("category")}
        value={c.category?.revisionId ?? ""}
        options={sourceOptions(categories, c.category)}
        onChange={(id) => {
          const r = categories.find((r) => r.definition.id === id);
          edit({ ...c, category: r ? ref(r) : null });
        }}
      />
      {c.kind === "choice" ? (
        <>
          <Select
            label={t("dimension")}
            invalid={problem("dimension")}
            value={c.dimension}
            options={designDimensions.map((value) => ({
              value,
              label: t(value),
            }))}
            onChange={(value) =>
              edit({ ...c, dimension: value as typeof c.dimension })
            }
          />
          <Text
            label={t("meaning")}
            invalid={problem("meaning")}
            value={c.meaning}
            max={500}
            onChange={(meaning) => edit({ ...c, meaning })}
          />
          <label className="directory-check">
            <input
              type="checkbox"
              checked={c.none}
              onChange={(e) => edit({ ...c, none: e.target.checked })}
            />
            {t("none")}
          </label>
        </>
      ) : (
        <>
          <Select
            label={t("manifest")}
            invalid={problem("manifest")}
            value={c.manifest?.revisionId ?? ""}
            options={sourceOptions(manifests, c.manifest)}
            onChange={(id) => {
              const r = manifests.find((r) => r.definition.id === id);
              edit({ ...c, manifest: r ? ref(r) : null });
            }}
          />
          <Select
            label={t("scope")}
            value={c.pieceKey ?? ""}
            options={[
              { value: "", label: t("whole") },
              ...(manifest?.definition.content.pieces ?? [])
                .filter((p) => p.applicability !== "not-applicable")
                .map((p) => ({ value: p.key, label: p.key })),
            ]}
            onChange={(value) => edit({ ...c, pieceKey: value || null })}
          />
          <Select
            label={t("decision")}
            invalid={problem("decision")}
            value={c.decision}
            options={["unresolved", "applicable", "not-applicable"].map(
              (value) => ({
                value,
                label: t(
                  value === "not-applicable"
                    ? "notApplicable"
                    : (value as "unresolved" | "applicable"),
                ),
              }),
            )}
            onChange={(value) =>
              edit({ ...c, decision: value as typeof c.decision })
            }
          />
          <Text
            label={t("decisionReason")}
            invalid={problem("decisionReason")}
            value={c.decisionReason}
            onChange={(decisionReason) => edit({ ...c, decisionReason })}
          />
          <h4>{t("questions")}</h4>
          {c.questions.map((q, i) => {
            const allowed = choices.filter((r) => {
              const x = r.definition.content;
              return (
                x.kind === "choice" &&
                x.dimension === q.key &&
                x.category?.revisionId === c.category?.revisionId
              );
            });
            return (
              <details key={q.id} className="design-question-editor">
                <summary>
                  {t(q.key)} · {locale === "ta" ? q.labelTa : q.labelEn}
                  {q.applicability === "unresolved"
                    ? ` · ${t("unresolved")}`
                    : ""}
                </summary>
                <fieldset>
                  <legend>{t(q.key)}</legend>
                  <Select
                    label={t("dimension")}
                    value={q.key}
                    options={designDimensions.map((value) => ({
                      value,
                      label: t(value),
                    }))}
                    onChange={(value) =>
                      question(i, { ...q, key: value as typeof q.key })
                    }
                  />
                  <Text
                    label={t("questionLabelEn")}
                    invalid={problem("questions", i, "labelEn")}
                    value={q.labelEn}
                    max={160}
                    onChange={(labelEn) => question(i, { ...q, labelEn })}
                  />
                  <Text
                    label={t("questionLabelTa")}
                    invalid={problem("questions", i, "labelTa")}
                    value={q.labelTa}
                    max={160}
                    onChange={(labelTa) => question(i, { ...q, labelTa })}
                  />
                  <Text
                    label={t("meaning")}
                    invalid={problem("questions", i, "meaning")}
                    value={q.meaning}
                    max={500}
                    onChange={(meaning) => question(i, { ...q, meaning })}
                  />
                  <Select
                    label={t("questionKind")}
                    invalid={problem("questions", i, "kind")}
                    value={q.kind}
                    options={[
                      { value: "choice", label: t("choiceKind") },
                      { value: "text", label: t("textKind") },
                      { value: "garment-length", label: t("lengthKind") },
                    ]}
                    onChange={(kind) =>
                      question(i, { ...q, kind: kind as typeof q.kind })
                    }
                  />
                  <Select
                    label={t("requiredQuestion")}
                    invalid={problem("questions", i, "required")}
                    value={q.required === null ? "" : String(q.required)}
                    options={[
                      blank,
                      { value: "true", label: t("required") },
                      { value: "false", label: t("optional") },
                    ]}
                    onChange={(v) =>
                      question(i, {
                        ...q,
                        required: v === "" ? null : v === "true",
                      })
                    }
                  />
                  <Select
                    label={t("decision")}
                    invalid={problem("questions", i, "applicability")}
                    value={q.applicability}
                    options={[
                      { value: "unresolved", label: t("unresolved") },
                      { value: "applicable", label: t("applicable") },
                      { value: "not-applicable", label: t("notApplicable") },
                    ]}
                    onChange={(v) =>
                      question(i, {
                        ...q,
                        applicability: v as typeof q.applicability,
                      })
                    }
                  />
                  <Text
                    label={t("decisionReason")}
                    invalid={problem("questions", i, "reason")}
                    value={q.reason}
                    onChange={(reason) => question(i, { ...q, reason })}
                  />
                  <p>{t("allowedChoices")}</p>
                  <ul>
                    {q.choices.map((r) => (
                      <li key={r.entryId}>
                        <SourceName
                          shopId={shopId}
                          reference={r}
                          kind="choice"
                        />{" "}
                        <Button
                          variant="ghost"
                          onClick={() =>
                            question(i, {
                              ...q,
                              choices: q.choices.filter((x) => !same(x, r)),
                            })
                          }
                        >
                          {t("removeChoice")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {allowed.length === 0 && <p>{t("noChoices")}</p>}
                  <Select
                    label={t("addChoice")}
                    value=""
                    options={[
                      blank,
                      ...allowed
                        .filter((r) => !q.choices.some((x) => same(ref(r), x)))
                        .map((r) => ({
                          value: r.definition.id,
                          label:
                            name(r) +
                            (r.definition.content.kind === "choice" &&
                            r.definition.content.none
                              ? ` ${t("noneLabel")}`
                              : ""),
                        })),
                    ]}
                    onChange={(id) => {
                      const r = allowed.find((r) => r.definition.id === id);
                      if (r)
                        question(i, { ...q, choices: [...q.choices, ref(r)] });
                    }}
                  />
                  {(q.kind === "garment-length" ||
                    q.units.length > 0 ||
                    q.precision) && (
                    <>
                      <p>{t("units")}</p>
                      {(["in", "cm"] as const).map((unit) => (
                        <label key={unit} className="directory-check">
                          <input
                            type="checkbox"
                            checked={q.units.includes(unit)}
                            onChange={(e) =>
                              question(i, {
                                ...q,
                                units: e.target.checked
                                  ? [...q.units, unit]
                                  : q.units.filter((v) => v !== unit),
                              })
                            }
                          />
                          {unit}
                        </label>
                      ))}
                      <Select
                        label={t("units")}
                        value={q.precision?.unit ?? ""}
                        options={[
                          blank,
                          { value: "in", label: "in" },
                          { value: "cm", label: "cm" },
                        ]}
                        onChange={(unit) => {
                          if (!unit) question(i, { ...q, precision: null });
                          if (unit)
                            question(i, {
                              ...q,
                              precision: {
                                unit: unit as "in" | "cm",
                                increment: q.precision?.increment ?? "",
                                review: q.precision?.review ?? "",
                              },
                            });
                        }}
                      />
                      <Text
                        label={t("increment")}
                        value={q.precision?.increment ?? ""}
                        max={32}
                        onChange={(increment) => {
                          if (q.precision)
                            question(i, {
                              ...q,
                              precision: { ...q.precision, increment },
                            });
                        }}
                      />
                      <Text
                        label={t("precisionReview")}
                        value={q.precision?.review ?? ""}
                        max={500}
                        onChange={(review) => {
                          if (q.precision)
                            question(i, {
                              ...q,
                              precision: { ...q.precision, review },
                            });
                        }}
                      />
                    </>
                  )}
                  {q.when.map((w, j) => {
                    const parent = c.questions.find(
                      (p) => p.id === w.questionId,
                    );
                    return (
                      <div key={w.questionId}>
                        <Select
                          label={t("dependency")}
                          value={w.questionId}
                          options={[
                            blank,
                            ...c.questions
                              .filter(
                                (p) =>
                                  p.id !== q.id &&
                                  p.kind === "choice" &&
                                  !q.when.some(
                                    (x, n) => n !== j && x.questionId === p.id,
                                  ),
                              )
                              .map((p) => ({
                                value: p.id,
                                label: locale === "ta" ? p.labelTa : p.labelEn,
                              })),
                          ]}
                          onChange={(id) =>
                            question(i, {
                              ...q,
                              when: q.when.map((x, n) =>
                                n === j ? { ...x, questionId: id } : x,
                              ),
                            })
                          }
                        />
                        <Select
                          label={t("allowedChoices")}
                          value={w.choice.revisionId}
                          options={[
                            blank,
                            ...(parent?.choices ?? []).map((r) => ({
                              value: r.revisionId,
                              label: choices.find((x) => same(ref(x), r))
                                ? name(
                                    choices.find((x) =>
                                      same(ref(x), r),
                                    ) as DesignChoicesRevision,
                                  )
                                : t("historical"),
                            })),
                          ]}
                          onChange={(id) => {
                            const selected = parent?.choices.find(
                              (r) => r.revisionId === id,
                            );
                            if (selected)
                              question(i, {
                                ...q,
                                when: q.when.map((x, n) =>
                                  n === j ? { ...x, choice: selected } : x,
                                ),
                              });
                          }}
                        />
                        <Button
                          variant="ghost"
                          onClick={() =>
                            question(i, {
                              ...q,
                              when: q.when.filter((_, n) => n !== j),
                            })
                          }
                        >
                          {t("removeDependency")}
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    disabled={
                      q.when.length >= 8 ||
                      !c.questions.some(
                        (p) =>
                          p.id !== q.id &&
                          p.kind === "choice" &&
                          p.choices.length &&
                          !q.when.some((w) => w.questionId === p.id),
                      )
                    }
                    onClick={() => {
                      const parent = c.questions.find(
                        (p) =>
                          p.id !== q.id &&
                          p.kind === "choice" &&
                          !q.when.some((w) => w.questionId === p.id) &&
                          p.choices.length,
                      );
                      if (parent?.choices[0])
                        question(i, {
                          ...q,
                          when: [
                            ...q.when,
                            {
                              questionId: parent.id,
                              choice: parent.choices[0],
                            },
                          ],
                        });
                    }}
                  >
                    {t("addDependency")}
                  </Button>
                  <div className="calendar-actions">
                    <Button
                      variant="outline"
                      disabled={i === 0}
                      onClick={() => {
                        const questions = [...c.questions];
                        [questions[i - 1], questions[i]] = [
                          questions[i] as DesignQuestion,
                          questions[i - 1] as DesignQuestion,
                        ];
                        edit({ ...c, questions });
                      }}
                    >
                      {t("moveUp")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={i === c.questions.length - 1}
                      onClick={() => {
                        const questions = [...c.questions];
                        [questions[i + 1], questions[i]] = [
                          questions[i] as DesignQuestion,
                          questions[i + 1] as DesignQuestion,
                        ];
                        edit({ ...c, questions });
                      }}
                    >
                      {t("moveDown")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        edit({
                          ...c,
                          questions: c.questions.filter((_, n) => n !== i),
                        })
                      }
                    >
                      {t("removeQuestion")}
                    </Button>
                  </div>
                </fieldset>
              </details>
            );
          })}
          <Button
            disabled={c.questions.length >= 40}
            variant="outline"
            onClick={() =>
              edit({
                ...c,
                questions: [
                  ...c.questions,
                  {
                    id: v7(),
                    key: "neck-type",
                    meaning: "",
                    labelEn: "",
                    labelTa: "",
                    kind: "choice",
                    applicability: "unresolved",
                    reason: "",
                    required: null,
                    choices: [],
                    when: [],
                    units: [],
                    precision: null,
                  },
                ],
              })
            }
          >
            {t("addQuestion")}
          </Button>
          <fieldset>
            <legend>{t("templateKeys")}</legend>
            {manifest &&
              [
                ...manifest.definition.content.construction,
                ...manifest.definition.content.decoration,
                ...manifest.definition.content.materials,
                ...manifest.definition.content.tasks,
                ...manifest.definition.content.quality,
                ...manifest.definition.content.instructions,
                ...manifest.definition.content.method,
                ...manifest.definition.content.confirmation,
              ]
                .filter(
                  (item) =>
                    item.scope.pieceKey === c.pieceKey &&
                    item.applicability !== "not-applicable",
                )
                .map((item) => (
                  <label className="directory-check" key={item.key}>
                    <input
                      type="checkbox"
                      checked={c.templateKeys.includes(item.key)}
                      onChange={(e) =>
                        edit({
                          ...c,
                          templateKeys: e.target.checked
                            ? [...c.templateKeys, item.key]
                            : c.templateKeys.filter((k) => k !== item.key),
                        })
                      }
                    />
                    {locale === "ta" ? item.labelTa : item.labelEn}
                  </label>
                ))}
          </fieldset>
          <QuestionPreview
            shopId={shopId}
            content={c}
            choices={choices}
            t={t}
          />
        </>
      )}
    </div>
  );
}
function QuestionPreview({
  shopId,
  content,
  choices,
  t,
}: {
  shopId: string;
  content: DesignChoicesContent;
  choices: DesignChoicesRevision[];
  t: T;
}) {
  const locale = useLocale();
  const generation = useRef(0);
  const [selections, setSelections] = useState<
      { questionId: string; state: "selected"; choice: Ref }[]
    >([]),
    [result, setResult] =
      useState<Awaited<ReturnType<typeof previewDesignChoices>>>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Content edits invalidate in-flight previews and their visible result.
  useEffect(() => {
    generation.current++;
    setResult(undefined);
    setFailed(false);
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [content]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A shop change must discard every illustrative selection.
  useEffect(() => {
    setSelections([]);
    setResult(undefined);
  }, [shopId]);
  return (
    <section>
      <h4>{t("preview")}</h4>
      <p>{t("previewIntro")}</p>
      {content.kind === "profile" &&
        content.questions
          .filter((q) => q.kind === "choice")
          .map((q) => (
            <Select
              key={q.id}
              label={locale === "ta" ? q.labelTa : q.labelEn}
              value={
                selections.find((s) => s.questionId === q.id)?.choice
                  .revisionId ?? ""
              }
              options={[
                { value: "", label: t("unknown") },
                ...q.choices.map((r) => {
                  const choice = choices.find((c) => same(ref(c), r));
                  return {
                    value: r.revisionId,
                    label: choice
                      ? `${locale === "ta" ? choice.definition.content.labelTa : choice.definition.content.labelEn}${choice.definition.content.kind === "choice" && choice.definition.content.none ? ` ${t("noneLabel")}` : ""}`
                      : t("historical"),
                  };
                }),
              ]}
              onChange={(id) => {
                generation.current++;
                setResult(undefined);
                setBusy(false);
                const selected = q.choices.find((r) => r.revisionId === id);
                setSelections((rows) => [
                  ...rows.filter((s) => s.questionId !== q.id),
                  ...(selected
                    ? [
                        {
                          questionId: q.id,
                          state: "selected" as const,
                          choice: selected,
                        },
                      ]
                    : []),
                ]);
              }}
            />
          ))}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setResult(undefined);
          setFailed(false);
          const version = ++generation.current;
          void previewDesignChoices(shopId, { content, selections })
            .then(
              (value) => {
                if (generation.current === version) setResult(value);
              },
              () => {
                if (generation.current === version) setFailed(true);
              },
            )
            .finally(() => {
              if (generation.current === version) setBusy(false);
            });
        }}
      >
        {t("preview")}
      </Button>
      {failed && <p role="alert">{t("error")}</p>}
      {result && (
        <>
          {content.kind === "profile" &&
            content.decision === "not-applicable" && (
              <p role="status">
                {t("notApplicableState")} · {content.decisionReason}
              </p>
            )}
          <ul>
            {result.questions.map((q) => (
              <li key={q.id}>
                {t(q.key)} · {locale === "ta" ? q.labelTa : q.labelEn}:{" "}
                {t(
                  q.state === "not-applicable"
                    ? "notApplicableState"
                    : q.state === "dependency-unresolved"
                      ? "dependencyUnresolved"
                      : q.state,
                )}
              </li>
            ))}
          </ul>
          {result.incompatible.length > 0 && (
            <p role="status">{t("incompatible")}</p>
          )}
        </>
      )}
    </section>
  );
}
