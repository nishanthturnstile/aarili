import { reauthenticateOwner } from "@aarili/api/client";
import { readCatalogueDefinition } from "@aarili/api/service-catalogue-client";
import {
  readServiceTemplateDefinition,
  readServiceTemplates,
} from "@aarili/api/service-templates-client";
import { readServiceProfileHistory } from "@aarili/api/small-services-client";
import {
  type ServiceProfileDraft,
  type ServiceProfileRevision,
  serviceProfileCommandSchema,
  serviceProfileDraftSchema,
} from "@aarili/contracts/small-services";
import {
  type Locale,
  orderMessages,
  serviceTemplatesMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { v7 } from "uuid";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import type { OwnerGuard } from "./owner-feedback";

function ProfileFields({
  shopId,
  form,
  controller,
  locale,
}: {
  shopId: string;
  form: UseFormReturn<ServiceProfileDraft>;
  controller: DraftRecovery;
  locale: Locale;
}) {
  const t = smallServiceMessages[locale],
    s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    v = serviceProfileDraftSchema.parse(s.values);
  const [templates, setTemplates] =
      useState<Awaited<ReturnType<typeof readServiceTemplates>>>(),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [reviewed, setReviewed] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function load(before?: string) {
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceTemplates(shopId, before);
      if (alive.current)
        setTemplates((p) =>
          before && p ? { ...r, entries: [...p.entries, ...r.entries] } : r,
        );
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: exact initial choices belong to mounted profile
  useEffect(() => {
    void load();
  }, [shopId]);
  const selected = templates?.entries.find(
    (r) => r.id === v.content.manifest?.revisionId,
  );
  const definitionId = v.content.manifest?.definitionId;
  const [source, setSource] = useState<{
    definition: Awaited<ReturnType<typeof readServiceTemplateDefinition>>;
    labels: Record<string, { labelEn: string; labelTa: string }>;
  }>();
  useEffect(() => {
    let active = true;
    setSource(undefined);
    if (definitionId)
      void (async () => {
        try {
          const definition = await readServiceTemplateDefinition(
            shopId,
            definitionId,
          );
          const refs = [
            ...(definition.content.service
              ? [{ key: "$base", ref: definition.content.service }]
              : []),
            ...definition.content.addons.map((a) => ({ key: a.key, ref: a })),
          ];
          const rows = await Promise.all(
            refs.map(async (item) => ({
              key: item.key,
              definition: await readCatalogueDefinition(
                shopId,
                item.ref.revisionId,
              ),
            })),
          );
          if (active)
            setSource({
              definition,
              labels: Object.fromEntries(
                rows.map((r) => [r.key, r.definition.content]),
              ),
            });
        } catch {
          if (active) setFailed(true);
        }
      })();
    return () => {
      active = false;
    };
  }, [shopId, definitionId]);
  const exactSource =
    source?.definition.id === definitionId ? source : undefined;
  const lineLabel = (addonKey: string | null) => {
    const label = exactSource?.labels[addonKey ?? "$base"];
    return label
      ? locale === "ta"
        ? label.labelTa
        : label.labelEn
      : t.sourceChanged;
  };
  const valid =
    reviewed === JSON.stringify(v) &&
    serviceProfileCommandSchema.safeParse(v).success;
  return (
    <>
      <p>{t.synthetic}</p>
      {(["labelEn", "labelTa"] as const).map((key) => (
        <Field key={key}>
          <FieldLabel htmlFor={`sp-${key}`}>{t[key]}</FieldLabel>
          <Input
            id={`sp-${key}`}
            {...form.register(`content.${key}`)}
            maxLength={160}
          />
        </Field>
      ))}
      <Field>
        <FieldLabel htmlFor="sp-manifest">{t.manifest}</FieldLabel>
        <select
          id="sp-manifest"
          value={v.content.manifest?.revisionId ?? ""}
          onChange={(e) => {
            const r = templates?.entries.find((r) => r.id === e.target.value);
            if (r)
              form.setValue(
                "content.manifest",
                {
                  entryId: r.entryId,
                  revisionId: r.id,
                  definitionId: r.definition.id,
                },
                { shouldDirty: true },
              );
          }}
        >
          <option value="">{t.chooseTemplate}</option>
          {v.content.manifest && !selected && (
            <option value={v.content.manifest.revisionId}>
              {v.content.manifest.revisionId}
            </option>
          )}
          {templates?.entries.map((r) => (
            <option
              key={r.id}
              value={r.id}
              disabled={!r.available || !r.configurationEligible}
            >
              {locale === "ta"
                ? r.definition.content.labelTa
                : r.definition.content.labelEn}{" "}
              · {r.version}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void load()}
        >
          {t.reload}
        </Button>
        {templates?.next && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void load(templates.next ?? undefined)}
          >
            {t.more}
          </Button>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor="sp-wearer">{t.wearerRequirement}</FieldLabel>
        <select id="sp-wearer" {...form.register("content.wearerRequirement")}>
          <option value="unresolved">{t.unresolved}</option>
          <option value="required">{t.required}</option>
          <option value="not-required">{t.notRequired}</option>
        </select>
      </Field>
      {v.content.wearerRequirement === "not-required" && (
        <Field>
          <FieldLabel htmlFor="sp-wearer-reason">{t.wearerReason}</FieldLabel>
          <Input
            id="sp-wearer-reason"
            {...form.register("content.wearerReason")}
            maxLength={1000}
          />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="sp-unit">{t.capacityUnit}</FieldLabel>
        <select
          id="sp-unit"
          value={v.content.capacityUnit ?? ""}
          onChange={(e) =>
            form.setValue(
              "content.capacityUnit",
              e.target.value === "garments"
                ? "garments"
                : e.target.value === "effort-points"
                  ? "effort-points"
                  : null,
              { shouldDirty: true },
            )
          }
        >
          <option value="">{t.unresolved}</option>
          <option value="garments">{t.garments}</option>
          <option value="effort-points">{t.effort}</option>
        </select>
      </Field>
      <p>{t.quantityHelp}</p>
      <section className="owner-form" aria-label={t.lines}>
        <h3>{t.lines}</h3>
        {v.content.lines.map((line, i) => (
          <fieldset className="owner-form" key={line.key}>
            <legend>{lineLabel(line.addonKey)}</legend>
            <details>
              <summary>{t.source}</summary>
              <Field>
                <FieldLabel htmlFor={`sp-key-${i}`}>{t.lineKey}</FieldLabel>
                <Input
                  id={`sp-key-${i}`}
                  readOnly
                  {...form.register(`content.lines.${i}.key`)}
                  maxLength={80}
                />
              </Field>
              {line.addonKey && (
                <p className="wrap-anywhere">{line.addonKey}</p>
              )}
            </details>
            <Field>
              <FieldLabel htmlFor={`sp-addon-${i}`}>{t.addon}</FieldLabel>
              <select
                id={`sp-addon-${i}`}
                value={line.addonKey ?? ""}
                onChange={(e) =>
                  form.setValue(
                    `content.lines.${i}.addonKey`,
                    e.target.value || null,
                    { shouldDirty: true },
                  )
                }
              >
                <option value="">
                  {lineLabel(null)} · {t.base}
                </option>
                {line.addonKey &&
                  !exactSource?.definition.content.addons.some(
                    (a) => a.key === line.addonKey,
                  ) && <option value={line.addonKey}>{t.sourceChanged}</option>}
                {exactSource?.definition.content.addons
                  .filter((a) => a.applicability === "applicable")
                  .map((a) => (
                    <option key={a.key} value={a.key}>
                      {lineLabel(a.key)}
                    </option>
                  ))}
              </select>
            </Field>
            <label className="order-check">
              <input
                type="checkbox"
                {...form.register(`content.lines.${i}.optional`)}
              />
              {t.optional}
            </label>
            <Field>
              <FieldLabel htmlFor={`sp-task-${i}`}>{t.task}</FieldLabel>
              <select
                id={`sp-task-${i}`}
                value={line.taskKey ?? ""}
                onChange={(e) =>
                  form.setValue(
                    `content.lines.${i}.taskKey`,
                    e.target.value || null,
                    { shouldDirty: true },
                  )
                }
              >
                <option value="">{t.taskless}</option>
                {line.taskKey &&
                  !selected?.definition.content.tasks.some(
                    (task) => task.key === line.taskKey,
                  ) && <option value={line.taskKey}>{line.taskKey}</option>}
                {selected?.definition.content.tasks
                  .filter((task) => task.applicability === "applicable")
                  .map((task) => (
                    <option key={task.key} value={task.key}>
                      {locale === "ta" ? task.labelTa : task.labelEn}
                    </option>
                  ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`sp-coverage-${i}`}>
                {t.coverageKey}
              </FieldLabel>
              <Input
                id={`sp-coverage-${i}`}
                {...form.register(`content.lines.${i}.coverageKey`)}
                maxLength={80}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`sp-quantity-${i}`}>{t.quantity}</FieldLabel>
              <Input
                id={`sp-quantity-${i}`}
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={line.quantity ?? ""}
                onChange={(e) =>
                  form.setValue(
                    `content.lines.${i}.quantity`,
                    e.target.value === "" ? null : Number(e.target.value),
                    { shouldDirty: true },
                  )
                }
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                form.setValue(
                  "content.lines",
                  v.content.lines.filter((_, index) => index !== i),
                  { shouldDirty: true },
                )
              }
            >
              {t.removeLine}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={v.content.lines.length >= 32}
          onClick={() =>
            form.setValue(
              "content.lines",
              [
                ...v.content.lines,
                {
                  key: `line-${v7()}`,
                  addonKey: null,
                  taskKey: null,
                  optional: false,
                  coverageKey: "",
                  quantity: null,
                },
              ],
              { shouldDirty: true },
            )
          }
        >
          {t.addLine}
        </Button>
      </section>
      <label className="order-check">
        <input type="checkbox" {...form.register("available")} />
        {t.available}
      </label>
      <Field>
        <FieldLabel htmlFor="sp-reason">{t.reason}</FieldLabel>
        <Input id="sp-reason" {...form.register("reason")} maxLength={1000} />
      </Field>
      {(!v.content.capacityUnit ||
        v.content.lines.some((l) => l.quantity === null || !l.coverageKey)) && (
        <p>{t.mappingUnknown}</p>
      )}
      {failed && (
        <p role="alert">
          {serviceProfileCommandSchema.safeParse(v).success
            ? t.error
            : t.reviewError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={
          busy ||
          s.work.inFlight ||
          s.work.outcomeUnknown ||
          s.status === "conflict"
        }
        onClick={() => {
          const v = form.getValues();
          if (!serviceProfileCommandSchema.safeParse(v).success) {
            setFailed(true);
            return;
          }
          setFailed(false);
          setReviewed(JSON.stringify(serviceProfileDraftSchema.parse(v)));
        }}
      >
        {t.reviewProfile}
      </Button>
      {valid && (
        <section className="owner-form" aria-label={t.reviewProfile}>
          <h3>{t.reviewProfile}</h3>
          <p>{t.profileReview}</p>
          <p>
            {v.content.labelEn} / {v.content.labelTa}
          </p>
          <p>
            {t.profileVersion}: {v.baseVersion + 1}
          </p>
          <p>
            {t.manifest}:{" "}
            {selected
              ? locale === "ta"
                ? selected.definition.content.labelTa
                : selected.definition.content.labelEn
              : t.sourceChanged}
            {selected ? ` · ${selected.version}` : ""}
          </p>
          <details>
            <summary>{t.source}</summary>
            <p className="wrap-anywhere">{v.content.manifest?.revisionId}</p>
          </details>
          <p>
            {t.wearerRequirement}:{" "}
            {
              t[
                v.content.wearerRequirement === "required"
                  ? "required"
                  : v.content.wearerRequirement === "not-required"
                    ? "notRequired"
                    : "unresolved"
              ]
            }
          </p>
          <ul>
            {v.content.lines.map((l) => (
              <li key={l.key}>
                {lineLabel(l.addonKey)} · {l.coverageKey || t.unresolved} ·{" "}
                {l.quantity ?? t.unresolved} · {l.taskKey ?? t.taskless}
                {l.optional ? ` · ${t.optional}` : ""}
              </li>
            ))}
          </ul>
          <p>{v.reason}</p>
          <Button
            type="button"
            disabled={
              s.work.inFlight ||
              s.work.outcomeUnknown ||
              s.status === "conflict" ||
              s.status === "promoted"
            }
            onClick={() =>
              void (async () => {
                controller.edit(form.getValues());
                await controller.save();
                if (
                  alive.current &&
                  controller.snapshot().status === "saved" &&
                  !controller.snapshot().work.dirty &&
                  JSON.stringify(
                    serviceProfileDraftSchema.parse(
                      controller.snapshot().values,
                    ),
                  ) === reviewed
                )
                  await controller.promote();
              })()
            }
          >
            {t.publish}
          </Button>
        </section>
      )}
    </>
  );
}

export function ServiceProfileEditor({
  shopId,
  controller,
  locale,
  guard,
  close,
}: {
  shopId: string;
  controller: DraftRecovery;
  locale: Locale;
  guard: OwnerGuard;
  close: () => void;
}) {
  const t = smallServiceMessages[locale],
    o = orderMessages[locale],
    s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    heading = useRef<HTMLHeadingElement>(null);
  const auth = serviceTemplatesMessages[locale],
    password = useRef<HTMLInputElement>(null),
    [authBusy, setAuthBusy] = useState(false),
    [authError, setAuthError] = useState(false);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (s.error === "AUTHENTICATION_STALE") password.current?.focus();
  }, [s.error]);
  return (
    <section className="order-editor">
      <h2 ref={heading} tabIndex={-1}>
        {t.profiles}
      </h2>
      <DraftForm
        controller={controller}
        schema={serviceProfileDraftSchema}
        locale={locale}
        guard={guard}
        canPromote={false}
      >
        {(form) => (
          <ProfileFields
            shopId={shopId}
            form={form}
            controller={controller}
            locale={locale}
          />
        )}
      </DraftForm>
      {s.error === "AUTHENTICATION_STALE" && (
        <form
          className="owner-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (authBusy) return;
            const value = password.current?.value ?? "";
            if (password.current) password.current.value = "";
            setAuthBusy(true);
            setAuthError(false);
            try {
              await reauthenticateOwner(value, true);
              await controller.retry();
            } catch {
              setAuthError(true);
            } finally {
              setAuthBusy(false);
            }
          }}
        >
          <p>{auth.recent}</p>
          <Field>
            <FieldLabel htmlFor="sp-password">{auth.password}</FieldLabel>
            <Input
              ref={password}
              type="password"
              id="sp-password"
              autoComplete="current-password"
              required
              disabled={authBusy}
            />
          </Field>
          {authError && <p role="alert">{auth.authError}</p>}
          <Button type="submit" disabled={authBusy}>
            {auth.reauth}
          </Button>
        </form>
      )}
      <div className="owner-actions">
        <Button
          variant="outline"
          disabled={s.work.inFlight || s.work.outcomeUnknown}
          onClick={close}
        >
          {t.close}
        </Button>
        <Button
          variant="ghost"
          disabled={s.status !== "saved" || s.work.dirty || s.work.inFlight}
          onClick={() => {
            if (window.confirm(o.abandonConfirm)) void controller.abandon();
          }}
        >
          {o.abandon}
        </Button>
      </div>
    </section>
  );
}

export function ServiceProfileHistory({
  shopId,
  profile,
  locale,
}: {
  shopId: string;
  profile: ServiceProfileRevision;
  locale: Locale;
}) {
  const t = smallServiceMessages[locale],
    [history, setHistory] =
      useState<Awaited<ReturnType<typeof readServiceProfileHistory>>>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function load(beforeVersion?: number) {
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceProfileHistory(shopId, {
        entryId: profile.entryId,
        ...(beforeVersion ? { beforeVersion } : {}),
      });
      if (alive.current)
        setHistory((p) =>
          beforeVersion && p
            ? { ...r, revisions: [...p.revisions, ...r.revisions] }
            : r,
        );
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <Button variant="ghost" disabled={busy} onClick={() => void load()}>
        {t.history}
      </Button>
      {failed && <p role="alert">{t.error}</p>}
      {history && (
        <>
          <ul>
            {history.revisions.map((r) => (
              <li key={r.id}>
                {r.version} · {r.effectiveAt} · {r.reason} ·{" "}
                {r.available ? t.available : t.unavailable}
              </li>
            ))}
          </ul>
          {history.next && (
            <Button
              disabled={busy}
              onClick={() => void load(history.next ?? undefined)}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
    </>
  );
}
