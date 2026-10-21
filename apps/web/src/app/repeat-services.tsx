import { OwnerRequestError } from "@aarili/api/client";
import {
  createServiceRepeat,
  readServiceProfiles,
  readServiceRepeatLinks,
  readServiceRepeatSource,
} from "@aarili/api/small-services-client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  type ServiceOrderDraft,
  type ServiceRepeatSource,
  serviceRepeatDraftSchema,
} from "@aarili/contracts/small-services";
import {
  formatOrderPaise,
  type Locale,
  repeatServiceMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { UseFormReturn } from "react-hook-form";
import { v7 } from "uuid";
import type { DraftRecovery } from "./draft-recovery";
import type { OwnerGuard } from "./owner-feedback";

export function ServiceRepeatPanel({
  shopId,
  orderId,
  locale,
  guard,
  onDraft,
  onOrder,
  onUnavailable,
}: {
  shopId: string;
  orderId: string;
  locale: Locale;
  guard: OwnerGuard;
  onDraft: (draft: DraftRecord) => void;
  onOrder: (id: string) => void;
  onUnavailable: () => void;
}) {
  const t = repeatServiceMessages[locale];
  const [source, setSource] = useState<ServiceRepeatSource>(),
    [links, setLinks] =
      useState<Awaited<ReturnType<typeof readServiceRepeatLinks>>>(),
    [profiles, setProfiles] =
      useState<Awaited<ReturnType<typeof readServiceProfiles>>>(),
    [profile, setProfile] = useState(""),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [reuse, setReuse] = useState(false),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const alive = useRef(true),
    pending = useRef<
      | {
          input: Parameters<typeof createServiceRepeat>[2];
          key: string;
          version: number;
        }
      | undefined
    >(undefined);
  const safe = useSyncExternalStore(guard.subscribe, guard.safe, guard.safe);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const track = guard.track();
    track.set({
      dirty: false,
      inFlight: busy,
      outcomeUnknown: !!pending.current && failed,
    });
    return () => track.dispose();
  }, [guard, busy, failed]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigate = (e: MouseEvent) => {
      if (
        pending.current &&
        e.target instanceof Element &&
        e.target.closest("a[href]")
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", navigate, true);
    };
  }, []);
  function failure(e: unknown) {
    if (!alive.current) return;
    setFailed(true);
    if (
      e instanceof OwnerRequestError &&
      ["NOT_FOUND", "SHOP_ACCESS_DENIED", "UNAUTHENTICATED"].includes(e.code)
    ) {
      setSource(undefined);
      setLinks(undefined);
      onUnavailable();
    }
  }
  async function loadLinks(before?: string) {
    try {
      const r = await readServiceRepeatLinks(shopId, orderId, before);
      if (alive.current)
        setLinks((p) =>
          before && p ? { ...r, children: [...p.children, ...r.children] } : r,
        );
    } catch (e) {
      failure(e);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: remounted by order identity
  useEffect(() => {
    void loadLinks();
  }, []);
  async function inspect() {
    setBusy(true);
    setFailed(false);
    try {
      const [s, p] = await Promise.all([
        readServiceRepeatSource(shopId, orderId),
        readServiceProfiles(shopId),
      ]);
      if (alive.current) {
        setSource(s);
        setProfiles(p);
        setSelected({});
        setProfile("");
        setReuse(false);
      }
    } catch (e) {
      failure(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function moreProfiles() {
    try {
      const r = await readServiceProfiles(shopId, profiles?.next ?? undefined);
      if (alive.current)
        setProfiles((p) => ({
          ...r,
          profiles: [...(p?.profiles ?? []), ...r.profiles],
        }));
    } catch (e) {
      failure(e);
    }
  }
  async function create() {
    if (!source || busy) return;
    const recovering = !!pending.current;
    setBusy(true);
    setFailed(false);
    const p = profiles?.profiles.find((p) => p.id === profile);
    pending.current ??= {
      key: v7(),
      version: source.version,
      input: {
        draftId: v7(),
        subjectId: v7(),
        snapshotDigest: source.snapshotDigest,
        scopeDigest: source.scopeDigest,
        reuseInstructions: reuse,
        profile: p ? { entryId: p.entryId, revisionId: p.id } : null,
        selections: Object.entries(selected).map(([key, targetKey]) => ({
          key,
          targetKey,
          targetLineId: v7(),
        })),
      },
    };
    try {
      const command = pending.current,
        r = await createServiceRepeat(
          shopId,
          orderId,
          command.input,
          command.key,
          command.version,
        );
      if (alive.current) {
        pending.current = undefined;
        onDraft(r.draft);
      }
    } catch (e) {
      failure(e);
      if (
        !recovering &&
        e instanceof OwnerRequestError &&
        !["REQUEST_FAILED", "DATABASE_UNAVAILABLE"].includes(e.code)
      )
        pending.current = undefined;
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="order-intake order-editor service-additions"
      aria-label={t.title}
    >
      <h2>{t.title}</h2>
      {links?.source && (
        <p>
          {t.based}{" "}
          <Button
            disabled={busy || !safe}
            onClick={() => onOrder(links.source?.id ?? orderId)}
          >
            {links.source.code}
          </Button>
        </p>
      )}
      {links?.children.map((c) => (
        <p key={c.id}>
          {t.repeated}{" "}
          <Button disabled={busy || !safe} onClick={() => onOrder(c.id)}>
            {c.code}
          </Button>
        </p>
      ))}
      {links?.next && (
        <Button
          disabled={busy || !safe}
          onClick={() => void loadLinks(links.next ?? undefined)}
        >
          {t.more}
        </Button>
      )}
      {!source ? (
        <Button disabled={busy || !safe} onClick={() => void inspect()}>
          {t.inspect}
        </Button>
      ) : (
        <>
          <p>
            <strong>
              {t.source}: {source.code}
            </strong>{" "}
            · {source.customer?.label} · {source.customer?.code} ·{" "}
            {source.wearer?.label}
          </p>
          <p>{source.subjectDescription}</p>
          <p>{source.originalPromise.date}</p>
          <p>{t.reset}</p>
          <fieldset className="owner-form" disabled={busy || !!pending.current}>
            <legend>{t.select}</legend>
            {source.candidates.length === 0 && <p>{t.empty}</p>}
            <Field>
              <FieldLabel htmlFor={`sr-profile-${orderId}`}>
                {t.profile}
              </FieldLabel>
              <select
                id={`sr-profile-${orderId}`}
                aria-label={t.profile}
                value={profile}
                onChange={(e) => {
                  setProfile(e.target.value);
                  setSelected((p) =>
                    Object.fromEntries(Object.keys(p).map((k) => [k, ""])),
                  );
                }}
              >
                <option value="">{t.chooseProfile}</option>
                {profiles?.profiles.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.eligible}>
                    {locale === "ta" ? p.content.labelTa : p.content.labelEn}
                  </option>
                ))}
              </select>
            </Field>
            {profiles?.next && (
              <Button type="button" onClick={() => void moreProfiles()}>
                {t.moreProfiles}
              </Button>
            )}
            {source.candidates.map((c) => (
              <div className="owner-form" key={c.key}>
                <label className="order-check">
                  <input
                    type="checkbox"
                    checked={c.key in selected}
                    onChange={(e) =>
                      setSelected((p) => {
                        const next = { ...p };
                        if (e.target.checked) next[c.key] = "";
                        else delete next[c.key];
                        return next;
                      })
                    }
                  />
                  {locale === "ta" ? c.labelTa : c.labelEn} · {c.requestedWork}
                  {c.pieceId &&
                    ` · ${source.pieces.find((p) => p.id === c.pieceId)?.[locale === "ta" ? "labelTa" : "labelEn"] ?? ""}`}
                </label>
                <p>
                  {t.state}:{" "}
                  {c.state === "not-required" ? t.notRequired : t[c.state]} ·{" "}
                  {t.previousPrice}:{" "}
                  {c.previousPaise === null
                    ? t.unknown
                    : formatOrderPaise(c.previousPaise, locale)}
                </p>
                {c.key in selected && (
                  <Field>
                    <FieldLabel htmlFor={`sr-mapping-${c.key}`}>
                      {t.mapping}
                    </FieldLabel>
                    <select
                      id={`sr-mapping-${c.key}`}
                      aria-label={t.mapping}
                      value={selected[c.key]}
                      onChange={(e) =>
                        setSelected((p) => ({ ...p, [c.key]: e.target.value }))
                      }
                    >
                      <option value="">{t.choose}</option>
                      {profiles?.profiles
                        .find((p) => p.id === profile)
                        ?.content.lines.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.key}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
              </div>
            ))}
            <label className="order-check">
              <input
                type="checkbox"
                checked={reuse}
                onChange={(e) => setReuse(e.target.checked)}
              />
              {t.reuse}
            </label>
            {reuse && <p>{source.instructions}</p>}
          </fieldset>
          <p>{t.missing}</p>
          <div className="owner-actions">
            <Button
              disabled={
                busy ||
                (!safe && !pending.current) ||
                !Object.keys(selected).length
              }
              onClick={() => void create()}
            >
              {pending.current ? t.retry : t.create}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !!pending.current}
              onClick={() => setSource(undefined)}
            >
              {t.close}
            </Button>
          </div>
        </>
      )}
      {busy && <p role="status">{pending.current ? t.checking : t.inspect}</p>}
      {failed && <p role="alert">{t.error}</p>}
    </section>
  );
}

export function ServiceRepeatContext({
  controller,
  form,
  shopId,
  locale,
}: {
  controller: DraftRecovery;
  form: UseFormReturn<ServiceOrderDraft>;
  shopId: string;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = repeatServiceMessages[locale],
    v = serviceRepeatDraftSchema.parse(s.values);
  const [source, setSource] = useState<ServiceRepeatSource>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function refresh(accept = false) {
    setBusy(true);
    setFailed(false);
    try {
      const r = await readServiceRepeatSource(shopId, v.repeat.sourceId);
      if (!alive.current) return;
      setSource(r);
      if (accept) {
        const current = serviceRepeatDraftSchema.parse(
          controller.snapshot().values,
        );
        const next = {
          ...current,
          repeat: {
            ...current.repeat,
            sourceVersion: r.version,
            scopeDigest: r.scopeDigest,
            selections: current.repeat.selections.map((s) => ({
              ...s,
              lineVersion:
                r.candidates.find((c) => c.key === s.key)?.lineVersion ??
                s.lineVersion,
            })),
          },
          commitmentReview: null,
        };
        form.reset(next);
        controller.edit(next);
      }
    } catch (e) {
      if (alive.current) {
        setSource(undefined);
        setFailed(true);
        if (e instanceof OwnerRequestError && e.code === "NOT_FOUND")
          controller.invalidate();
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: immutable source and controller instance
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <section className="owner-form" aria-label={t.source}>
      <h3>{t.new}</h3>
      {source && (
        <p>
          {t.source}: {source.code} · {source.customer?.label} ·{" "}
          {source.wearer?.label}
        </p>
      )}
      <p>{t.reset}</p>
      <p>{t.subject}</p>
      <p>{t.fixed}</p>
      {source &&
        (source.version !== v.repeat.sourceVersion ||
          source.scopeDigest !== v.repeat.scopeDigest) && (
          <p role="alert">{t.changed}</p>
        )}
      <Button
        type="button"
        disabled={
          busy ||
          s.work.inFlight ||
          s.work.outcomeUnknown ||
          s.status === "conflict" ||
          s.status === "promoted"
        }
        onClick={() => void refresh(true)}
      >
        {t.refresh}
      </Button>
      {failed && <p role="alert">{t.error}</p>}
    </section>
  );
}
