import { requestMediaRead, requestMediaStatus } from "@aarili/api/media-client";
import {
  readCatalogueDefinition,
  readServiceCatalogue,
} from "@aarili/api/service-catalogue-client";
import type { MeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

type Content = MeasurementFormContent;
type Group = Content["groups"][number];
type FieldValue = Group["fields"][number];
function move<T>(items: T[], i: number, delta: number): T[] {
  const r = [...items],
    a = r[i],
    b = r[i + delta];
  if (a === undefined || b === undefined) return r;
  [r[i], r[i + delta]] = [b, a];
  return r;
}
function Pinned({ shopId, id }: { shopId: string; id: string }) {
  const t = useTranslations("measurementForms"),
    locale = useLocale();
  const [name, setName] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setName(undefined);
    setFailed(false);
    void readCatalogueDefinition(shopId, id)
      .then((r) => {
        if (alive)
          setName(locale === "ta" ? r.content.labelTa : r.content.labelEn);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [shopId, id, locale]);
  return (
    <span>
      {name ?? t(failed ? "error" : "loading")}
      <details className="catalogue-reference">
        <summary>{t("selected")}</summary>
        <span className="shop-actor">{id}</span>
      </details>
    </span>
  );
}
function Illustration({
  shopId,
  value,
  onChange,
}: {
  shopId: string;
  value: FieldValue["illustration"];
  onChange?: (v: FieldValue["illustration"]) => void;
}) {
  const t = useTranslations("measurementForms");
  const [candidate, setCandidate] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState<string>();
  const inputId = useId();
  return (
    <div>
      <p>{t("illustration")}</p>
      {value && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                const r = await requestMediaRead(shopId, value.assetId);
                setUrl(r.url);
              } catch {
                setFailed(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("openIllustration")}
          </Button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer">
              {t("openIllustration")}
            </a>
          )}
          {onChange && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(null)}
            >
              {t("clear")}
            </Button>
          )}
        </>
      )}
      {onChange && (
        <>
          <label htmlFor={inputId}>
            {t("illustrationReference")}
            <Input
              id={inputId}
              value={candidate}
              maxLength={36}
              autoComplete="off"
              onChange={(e) => setCandidate(e.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !/^[0-9a-f-]{36}$/i.test(candidate)}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              try {
                const r = await requestMediaStatus(shopId, candidate);
                if (
                  r.asset.status !== "ready" ||
                  r.asset.purpose !== "manual-pattern" ||
                  !r.asset.contentType.startsWith("image/")
                )
                  throw Error();
                onChange({ assetId: r.asset.id, version: r.asset.version });
                setCandidate("");
              } catch {
                setFailed(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("attachIllustration")}
          </Button>
          <p>{t("illustrationHint")}</p>
        </>
      )}
      {failed && <p role="alert">{t("error")}</p>}
    </div>
  );
}
export function FormContentView({
  content: c,
  shopId,
}: {
  content: Content;
  shopId: string;
}) {
  const t = useTranslations("measurementForms");
  return (
    <div>
      <p>{t("manual")}</p>
      <dl className="shop-profile-values">
        {(["code", "labelEn", "labelTa", "description"] as const).map((k) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd>{c[k] || t("unknown")}</dd>
          </div>
        ))}
        {(["service", "piece"] as const).map((k) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd>
              {c[k] ? (
                <Pinned shopId={shopId} id={c[k].revisionId} />
              ) : (
                t("unknown")
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        {t(c.decision)} — {c.decisionReason}
      </p>
      <ol>
        {c.groups.map((g) => (
          <li key={g.id}>
            <h4>
              {g.labelEn} / {g.labelTa}
            </h4>
            <ol>
              {g.fields.map((f) => (
                <li key={f.id}>
                  <h5>
                    {f.labelEn} / {f.labelTa}
                  </h5>
                  <p>
                    {f.key} — {f.meaning}
                  </p>
                  <p>
                    {f.hintEn} / {f.hintTa}
                  </p>
                  {f.illustration && (
                    <Illustration shopId={shopId} value={f.illustration} />
                  )}
                  <p>
                    {t("units")}: {f.units.map((u) => t(u)).join(", ")};{" "}
                    {t("defaultUnit")}:{" "}
                    {f.defaultUnit ? t(f.defaultUnit) : t("unresolved")};{" "}
                    {f.required === null
                      ? t("unresolved")
                      : t(f.required ? "yes" : "no")}
                  </p>
                  <p>
                    {f.precision
                      ? `${f.precision.increment} ${f.precision.unit ? t(f.precision.unit) : t("unresolved")} — ${f.precision.review}`
                      : t("noPrecision")}
                  </p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
function LinkPicker({
  shopId,
  referenceKind,
  content,
  onChange,
}: {
  shopId: string;
  referenceKind: "service" | "piece";
  content: Content;
  onChange: (c: Content) => void;
}) {
  const t = useTranslations("measurementForms"),
    locale = useLocale();
  const [term, setTerm] = useState(""),
    [rows, setRows] = useState<
      Awaited<ReturnType<typeof readServiceCatalogue>>["entries"]
    >([]),
    [next, setNext] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const search = async (before?: string) => {
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceCatalogue(shopId, before, term);
      setRows((a) => (before ? [...a, ...r.entries] : r.entries));
      setNext(r.next);
      setLoaded(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const choices = rows.filter(
    (r) =>
      r.configurationEligible && r.definition.content.kind === referenceKind,
  );
  return (
    <fieldset>
      <legend>{t(referenceKind)}</legend>
      {content[referenceKind] && (
        <>
          <Pinned shopId={shopId} id={content[referenceKind].revisionId} />
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange({ ...content, [referenceKind]: null })}
          >
            {t("clear")}
          </Button>
        </>
      )}
      <Field>
        <FieldLabel htmlFor={`form-${referenceKind}-search`}>
          {t("find")}
        </FieldLabel>
        <Input
          id={`form-${referenceKind}-search`}
          value={term}
          maxLength={160}
          onChange={(e) => setTerm(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void search()}
      >
        {t("searchReferences")}
      </Button>
      {failed && <p role="alert">{t("error")}</p>}
      {loaded && !choices.length && <p>{t("noResults")}</p>}
      <ul>
        {choices.map((r) => (
          <li key={r.entryId}>
            <span>
              {locale === "ta"
                ? r.definition.content.labelTa
                : r.definition.content.labelEn}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onChange({
                  ...content,
                  [referenceKind]: {
                    entryId: r.entryId,
                    revisionId: r.definition.id,
                  },
                })
              }
            >
              {t("select")}
            </Button>
          </li>
        ))}
      </ul>
      {next && (
        <Button type="button" disabled={busy} onClick={() => void search(next)}>
          {t("more")}
        </Button>
      )}
    </fieldset>
  );
}
export function FormContentEditor({
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
  const t = useTranslations("measurementForms");
  const invalidIds = new Set<string>();
  for (const issue of issues) {
    const p = issue.path;
    const g = c.groups[Number(p[2])];
    if (p[1] !== "groups" || !g) continue;
    const f = p[3] === "fields" ? g.fields[Number(p[4])] : undefined;
    const key = String(p.at(-1));
    if (f) {
      if (key === "precision")
        for (const suffix of [
          "precision-unit",
          "increment",
          "precision-review",
        ])
          invalidIds.add(`${f.id}-${suffix}`);
      else if (key === "units") invalidIds.add(`${f.id}-default`);
      else invalidIds.add(`${f.id}-${key}`);
    } else invalidIds.add(`${g.id}-${key}`);
  }
  const updateGroup = (i: number, g: Group) =>
    onChange({ ...c, groups: c.groups.map((v, n) => (n === i ? g : v)) });
  const text = (
    id: string,
    label: Parameters<typeof t>[0],
    value: string,
    change: (v: string) => void,
    max = 160,
  ) => (
    <Field key={id}>
      <FieldLabel htmlFor={id}>{t(label)}</FieldLabel>
      <Input
        id={id}
        value={value}
        maxLength={max}
        aria-invalid={invalidIds.has(id)}
        aria-describedby={
          invalidIds.has(id) ? "directory-validation" : undefined
        }
        autoComplete="off"
        onChange={(e) => change(e.target.value)}
      />
    </Field>
  );
  const select = (
    id: string,
    label: Parameters<typeof t>[0],
    value: string,
    choices: { value: string; label: string }[],
    change: (v: string) => void,
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{t(label)}</FieldLabel>
      <select
        className="ui-input"
        id={id}
        value={value}
        aria-invalid={invalidIds.has(id)}
        aria-describedby={
          invalidIds.has(id) ? "directory-validation" : undefined
        }
        onChange={(e) => change(e.target.value)}
      >
        {choices.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
  const units = [
    { value: "", label: t("unresolved") },
    ...(["in", "cm"] as const).map((u) => ({ value: u, label: t(u) })),
  ];
  return (
    <>
      <p>{t("manual")}</p>
      <LinkPicker
        shopId={shopId}
        referenceKind="service"
        content={c}
        onChange={onChange}
      />
      <LinkPicker
        shopId={shopId}
        referenceKind="piece"
        content={c}
        onChange={onChange}
      />
      {select(
        "form-decision",
        "decision",
        c.decision,
        (["unresolved", "required", "not-required"] as const).map((v) => ({
          value: v,
          label: t(v),
        })),
        (v) => onChange({ ...c, decision: v as Content["decision"] }),
      )}
      {c.decision === "not-required" &&
        text(
          "form-decision-reason",
          "decisionReason",
          c.decisionReason,
          (v) => onChange({ ...c, decisionReason: v }),
          1000,
        )}
      <ol>
        {c.groups.map((g, i) => (
          <li key={g.id}>
            <fieldset>
              <legend>
                {t("group")} {i + 1}
              </legend>
              {(["labelEn", "labelTa"] as const).map((k) =>
                text(`${g.id}-${k}`, k, g[k], (v) =>
                  updateGroup(i, { ...g, [k]: v }),
                ),
              )}
              <div className="calendar-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={i === 0}
                  onClick={() =>
                    onChange({ ...c, groups: move(c.groups, i, -1) })
                  }
                >
                  {t("up")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={i === c.groups.length - 1}
                  onClick={() =>
                    onChange({ ...c, groups: move(c.groups, i, 1) })
                  }
                >
                  {t("down")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...c,
                      groups: c.groups.filter((x) => x.id !== g.id),
                    })
                  }
                >
                  {t("remove")}
                </Button>
              </div>
              <ol>
                {g.fields.map((f, j) => {
                  const update = (v: FieldValue) =>
                    updateGroup(i, {
                      ...g,
                      fields: g.fields.map((x, n) => (n === j ? v : x)),
                    });
                  const precision = f.precision ?? {
                    unit: null,
                    increment: "",
                    review: "",
                  };
                  return (
                    <li key={f.id}>
                      <fieldset>
                        <legend>
                          {t("field")} {j + 1}
                        </legend>
                        <p>{t("noValues")}</p>
                        <Illustration
                          key={`${f.illustration?.assetId ?? "none"}:${f.illustration?.version ?? 0}`}
                          shopId={shopId}
                          value={f.illustration}
                          onChange={(v) => update({ ...f, illustration: v })}
                        />
                        {(
                          [
                            "key",
                            "meaning",
                            "labelEn",
                            "labelTa",
                            "hintEn",
                            "hintTa",
                          ] as const
                        ).map((k) =>
                          text(
                            `${f.id}-${k}`,
                            k,
                            f[k],
                            (v) => update({ ...f, [k]: v }),
                            k === "meaning"
                              ? 500
                              : k.startsWith("hint")
                                ? 1000
                                : 160,
                          ),
                        )}
                        <fieldset>
                          <legend>{t("units")}</legend>
                          {(["in", "cm"] as const).map((u) => (
                            <label className="directory-check" key={u}>
                              <input
                                type="checkbox"
                                checked={f.units.includes(u)}
                                onChange={(e) =>
                                  update({
                                    ...f,
                                    units: e.target.checked
                                      ? [...f.units, u]
                                      : f.units.filter((x) => x !== u),
                                  })
                                }
                              />
                              {t(u)}
                            </label>
                          ))}
                        </fieldset>
                        {select(
                          `${f.id}-default`,
                          "defaultUnit",
                          f.defaultUnit ?? "",
                          units,
                          (v) =>
                            update({
                              ...f,
                              defaultUnit: v ? (v as "in" | "cm") : null,
                            }),
                        )}
                        {select(
                          `${f.id}-required`,
                          "fieldRequired",
                          f.required === null ? "" : String(f.required),
                          [
                            { value: "", label: t("unresolved") },
                            { value: "true", label: t("yes") },
                            { value: "false", label: t("no") },
                          ],
                          (v) =>
                            update({
                              ...f,
                              required: v === "" ? null : v === "true",
                            }),
                        )}
                        {select(
                          `${f.id}-precision-unit`,
                          "precisionUnit",
                          f.precision?.unit ?? "",
                          units,
                          (v) =>
                            update({
                              ...f,
                              precision: v
                                ? { ...precision, unit: v as "in" | "cm" }
                                : null,
                            }),
                        )}
                        {text(
                          `${f.id}-increment`,
                          "increment",
                          f.precision?.increment ?? "",
                          (v) =>
                            update({
                              ...f,
                              precision: { ...precision, increment: v },
                            }),
                          32,
                        )}
                        {text(
                          `${f.id}-precision-review`,
                          "precisionReview",
                          f.precision?.review ?? "",
                          (v) =>
                            update({
                              ...f,
                              precision: { ...precision, review: v },
                            }),
                          500,
                        )}
                        <div className="calendar-actions">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={j === 0}
                            onClick={() =>
                              updateGroup(i, {
                                ...g,
                                fields: move(g.fields, j, -1),
                              })
                            }
                          >
                            {t("up")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={j === g.fields.length - 1}
                            onClick={() =>
                              updateGroup(i, {
                                ...g,
                                fields: move(g.fields, j, 1),
                              })
                            }
                          >
                            {t("down")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              updateGroup(i, {
                                ...g,
                                fields: g.fields.filter((x) => x.id !== f.id),
                              })
                            }
                          >
                            {t("remove")}
                          </Button>
                        </div>
                      </fieldset>
                    </li>
                  );
                })}
              </ol>
              <Button
                type="button"
                variant="outline"
                disabled={g.fields.length >= 50}
                onClick={() =>
                  updateGroup(i, {
                    ...g,
                    fields: [
                      ...g.fields,
                      {
                        id: crypto.randomUUID(),
                        key: "",
                        meaning: "",
                        kind: "base-length",
                        illustration: null,
                        labelEn: "",
                        labelTa: "",
                        hintEn: "",
                        hintTa: "",
                        units: [],
                        defaultUnit: null,
                        required: null,
                        precision: null,
                      },
                    ],
                  })
                }
              >
                {t("addField")}
              </Button>
            </fieldset>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        disabled={c.groups.length >= 20}
        onClick={() =>
          onChange({
            ...c,
            groups: [
              ...c.groups,
              { id: crypto.randomUUID(), labelEn: "", labelTa: "", fields: [] },
            ],
          })
        }
      >
        {t("addGroup")}
      </Button>
    </>
  );
}
