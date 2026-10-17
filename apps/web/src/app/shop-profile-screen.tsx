import { OwnerRequestError } from "@aarili/api/client";
import {
  readShopProfile,
  readShopProfileHistory,
  ShopProfileRequestError,
  saveShopProfile,
} from "@aarili/api/shop-profile-client";
import {
  initialShopProfile,
  type ShopProfileInput,
  type ShopProfileRevision,
  type ShopProfileState,
  shopProfileInputSchema,
} from "@aarili/contracts/shop-profile";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldError, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useForm } from "react-hook-form";
import { createPrivateUpload, type PrivateUpload } from "./media-upload";
import { PrivateUploadForm } from "./media-upload-form";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type Attempt = { key: string; profile: ShopProfileInput; etag: string };
const fields = [
  "displayName",
  "legalName",
  "address",
  "phone",
  "email",
  "tagline",
  "footer",
] as const;
function ProfileValues({ profile }: { profile: ShopProfileInput }) {
  const t = useTranslations("settings");
  return (
    <dl className="shop-profile-values">
      {(
        [
          ...fields,
          "datePresentation",
          "timePresentation",
          "presentationLocale",
        ] as const
      ).map((k) => (
        <div key={k}>
          <dt>{t(k)}</dt>
          <dd>
            {k === "datePresentation"
              ? t(profile[k] === "iso" ? "iso" : "dayFirst")
              : k === "timePresentation"
                ? t(profile[k] === "24-hour" ? "hour24" : "hour12")
                : k === "presentationLocale"
                  ? t(profile[k] === "ta-IN" ? "taIN" : "enIN")
                  : profile[k] || t("unknown")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function LogoUpload({
  controller,
  attach,
  disabled,
}: {
  controller: PrivateUpload;
  attach: (id: string) => void;
  disabled: boolean;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = useTranslations("settings"),
    locale = useLocale();
  return (
    <>
      <PrivateUploadForm
        controller={controller}
        locale={locale === "ta" ? "ta" : "en"}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      />
      {s.state === "ready" && s.asset && (
        <Button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (s.asset) attach(s.asset.id);
          }}
        >
          {t("attachLogo")}
        </Button>
      )}
    </>
  );
}
type ProfileProps = {
  shopId: string;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
  onSaved: (name: string) => void;
};
export function ShopProfileScreen(props: ProfileProps) {
  const t = useTranslations("settings");
  const [scope, setScope] = useState<{
    upload: PrivateUpload;
    work: ReturnType<OwnerGuard["track"]>;
  }>();
  useEffect(() => {
    const upload = createPrivateUpload({
      shopId: props.shopId,
      subjectId: props.shopId,
      purpose: "shop-branding",
      guard: props.guard,
    });
    const work = props.guard.track();
    setScope({ upload, work });
    return () => {
      upload.dispose();
      work.dispose();
    };
  }, [props.shopId, props.guard]);
  return scope ? (
    <ProfileEditor key={scope.upload.scopeKey} {...props} {...scope} />
  ) : (
    <p role="status">{t("loading")}</p>
  );
}
function ProfileEditor({
  shopId,
  queries,
  onSaved,
  upload,
  work,
}: ProfileProps & {
  upload: PrivateUpload;
  work: ReturnType<OwnerGuard["track"]>;
}) {
  const t = useTranslations("settings"),
    locale = useLocale();
  const { register, reset, getValues, setValue } = useForm<ShopProfileInput>({
    defaultValues: initialShopProfile(""),
  });
  const [state, setState] = useState<ShopProfileState>(),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [review, setReview] = useState<ShopProfileInput>(),
    [attempt, setAttempt] = useState<Attempt>(),
    [conflict, setConflict] = useState<ShopProfileState>(),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState(""),
    [invalid, setInvalid] = useState<string[]>([]),
    [logo, setLogo] = useState<string | null>(null),
    [history, setHistory] = useState<ShopProfileRevision[]>(),
    [next, setNext] = useState<number | null>(null),
    [historyError, setHistoryError] = useState(false),
    [historyBusy, setHistoryBusy] = useState(false);
  const active = useRef(true),
    epoch = useRef(queries.version()),
    locked = useRef(false),
    feedback = useRef<HTMLDivElement>(null),
    form = useRef<HTMLFormElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  const current = useCallback(
    () => active.current && queries.isCurrent(epoch.current),
    [queries],
  );
  useEffect(() => {
    active.current = true;
    const stop = queries.onInvalidate(() => {
      active.current = false;
      reset(initialShopProfile(""));
      setState(undefined);
      setReview(undefined);
      setAttempt(undefined);
      setHistory(undefined);
      setConflict(undefined);
      setLogo(null);
    });
    return () => {
      active.current = false;
      stop();
    };
  }, [queries, reset]);
  useEffect(() => {
    work.set({ dirty, inFlight: busy, outcomeUnknown: !!attempt });
  }, [work, dirty, busy, attempt]);
  useEffect(() => {
    if (failure || notice) feedback.current?.focus();
  }, [failure, notice]);
  useEffect(() => {
    if (!dirty && !attempt) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const leave = (e: MouseEvent) => {
      const a =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (
        a &&
        !a.getAttribute("href")?.startsWith("#") &&
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
  function accept(s: ShopProfileState) {
    setState(s);
    reset(s.profile);
    setLogo(s.profile.logoAssetId);
    setDirty(false);
    setReview(undefined);
    setConflict(undefined);
    setAttempt(undefined);
    setInvalid([]);
  }
  const load = useCallback(async () => {
    setLoading(true);
    setFailure("");
    try {
      const s = await readShopProfile(shopId);
      if (current()) {
        setState(s);
        reset(s.profile);
        setLogo(s.profile.logoAssetId);
      }
    } catch {
      if (current()) setFailure("loadError");
    } finally {
      if (current()) setLoading(false);
    }
  }, [shopId, current, reset]);
  useEffect(() => {
    void load();
  }, [load]);
  async function historyPage(more = false) {
    if (historyBusy) return;
    setHistoryBusy(true);
    setHistoryError(false);
    try {
      const r = await readShopProfileHistory(
        shopId,
        more ? (next ?? undefined) : undefined,
      );
      if (current()) {
        setHistory((v) =>
          more ? [...(v ?? []), ...r.revisions] : r.revisions,
        );
        setNext(r.next);
      }
    } catch {
      if (current()) setHistoryError(true);
    } finally {
      if (current()) setHistoryBusy(false);
    }
  }
  function prepare() {
    setFailure("");
    setNotice("");
    const parsed = shopProfileInputSchema.safeParse({
      ...getValues(),
      logoAssetId: logo,
    });
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => String(i.path[0]));
      setInvalid(errors);
      form.current
        ?.querySelector<HTMLElement>(`[name="${errors[0]}"]`)
        ?.focus();
      return;
    }
    setInvalid([]);
    setReview(parsed.data);
  }
  async function apply() {
    if (locked.current || !state || (!review && !attempt)) return;
    locked.current = true;
    setBusy(true);
    setFailure("");
    setNotice("");
    const a = attempt ?? {
      key: crypto.randomUUID(),
      profile: review as ShopProfileInput,
      etag: `"v${state.version}"`,
    };
    setAttempt(a);
    try {
      const saved = await saveShopProfile(shopId, a.profile, a.key, a.etag);
      if (!current()) return;
      accept(saved);
      queries.client.removeQueries({ queryKey: ["shop", shopId] });
      onSaved(saved.profile.displayName);
      setHistory(undefined);
      setNotice("saved");
    } catch (e) {
      if (!current()) return;
      if (e instanceof ShopProfileRequestError && e.current) {
        setConflict(e.current);
        setAttempt(undefined);
        setFailure("conflict");
      } else if (
        e instanceof OwnerRequestError &&
        [
          "VALIDATION_FAILED",
          "LOGO_NOT_READY",
          "PRECONDITION_REQUIRED",
          "IDEMPOTENCY_MISMATCH",
          "REVISION_EXHAUSTED",
        ].includes(e.code)
      ) {
        setAttempt(undefined);
        setFailure(e.code === "LOGO_NOT_READY" ? "logoNotReady" : "rejected");
      } else setFailure("saveError");
    } finally {
      locked.current = false;
      if (current()) setBusy(false);
    }
  }
  function cancel() {
    if (attempt || busy) return;
    if (dirty && !window.confirm(t("discard"))) return;
    if (state) accept(state);
    upload.discard();
    setFailure("");
    setNotice("");
  }
  const uploadState = useSyncExternalStore(
    upload.subscribe,
    upload.snapshot,
    upload.snapshot,
  );
  const pendingLogo =
    state?.brandingAvailable &&
    !["empty", "ready", "accessEnded"].includes(uploadState.state);
  if (loading) return <p role="status">{t("loading")}</p>;
  return (
    <div className="shop-settings-layout">
      <aside className="shop-settings-summary">
        <h2>{t("profile")}</h2>
        <p>{t("intro")}</p>
        <p>{t("fixed")}</p>
        <p>{t("fixedHelp")}</p>
        <p>{t("later")}</p>
      </aside>
      <div className="shop-settings-main">
        <div ref={feedback} tabIndex={-1}>
          {failure && <p role="alert">{t(failure)}</p>}
          {notice && <p role="status">{t(notice)}</p>}
        </div>
        {!state ? (
          <Button onClick={() => void load()}>{t("retry")}</Button>
        ) : (
          <>
            {state.missing.length > 0 && (
              <section aria-labelledby="profile-missing">
                <h3 id="profile-missing">{t("missing")}</h3>
                <ul>
                  {state.missing.map((k) => (
                    <li key={k}>{t(k === "contact" ? "missingContact" : k)}</li>
                  ))}
                </ul>
                <p>{t("readiness")}</p>
              </section>
            )}
            {conflict && (
              <section className="shop-conflict" aria-label={t("savedVersion")}>
                <h3>{t("savedVersion")}</h3>
                <ProfileValues profile={conflict.profile} />
                <h3>{t("proposedVersion")}</h3>
                {review && <ProfileValues profile={review} />}
                <Button
                  disabled={busy}
                  onClick={() => {
                    accept(conflict);
                    setFailure("");
                  }}
                >
                  {t("reload")}
                </Button>
              </section>
            )}
            {review ? (
              <section aria-labelledby="profile-review">
                <h3 id="profile-review" ref={reviewHeading} tabIndex={-1}>
                  {t("reviewTitle")}
                </h3>
                <p>{t("reviewHelp")}</p>
                <ProfileValues profile={review} />
                {review.logoAssetId && <p>{t("logoAttached")}</p>}
                <div className="owner-actions">
                  <Button
                    disabled={busy || !!conflict}
                    onClick={() => void apply()}
                  >
                    {t(busy ? "saving" : attempt ? "retry" : "apply")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !!attempt}
                    onClick={() => {
                      setReview(undefined);
                      setFailure("");
                    }}
                  >
                    {t("edit")}
                  </Button>
                </div>
              </section>
            ) : (
              <form
                ref={form}
                className="owner-form shop-profile-form"
                noValidate
                onChange={() => {
                  setDirty(true);
                  setNotice("");
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  prepare();
                }}
              >
                {[
                  ["identity", ["displayName", "legalName"]],
                  ["contact", ["address", "phone", "email"]],
                  ["branding", ["tagline", "footer"]],
                ].map(([group, names]) => (
                  <fieldset
                    key={group as string}
                    disabled={busy || !!attempt || !!conflict}
                  >
                    <legend>{t(group as string)}</legend>
                    {(names as (typeof fields)[number][]).map((name) => (
                      <Field key={name}>
                        <FieldLabel htmlFor={`shop-${name}`}>
                          {t(name)} (
                          {t(name === "displayName" ? "required" : "optional")})
                        </FieldLabel>
                        {name === "address" || name === "footer" ? (
                          <textarea
                            id={`shop-${name}`}
                            className="ui-input"
                            rows={3}
                            {...register(name)}
                            aria-invalid={invalid.includes(name)}
                            aria-describedby={
                              invalid.includes(name)
                                ? `shop-${name}-error`
                                : undefined
                            }
                          />
                        ) : (
                          <Input
                            id={`shop-${name}`}
                            {...register(name)}
                            type={
                              name === "email"
                                ? "email"
                                : name === "phone"
                                  ? "tel"
                                  : "text"
                            }
                            aria-invalid={invalid.includes(name)}
                            aria-describedby={
                              invalid.includes(name)
                                ? `shop-${name}-error`
                                : undefined
                            }
                          />
                        )}{" "}
                        {invalid.includes(name) && (
                          <FieldError id={`shop-${name}-error`}>
                            {t("invalid")}
                          </FieldError>
                        )}
                      </Field>
                    ))}
                  </fieldset>
                ))}
                <fieldset>
                  <legend>{t("presentation")}</legend>
                  {(
                    [
                      [
                        "datePresentation",
                        [
                          ["day-first", "dayFirst"],
                          ["iso", "iso"],
                        ],
                      ],
                      [
                        "timePresentation",
                        [
                          ["12-hour", "hour12"],
                          ["24-hour", "hour24"],
                        ],
                      ],
                      [
                        "presentationLocale",
                        [
                          ["en-IN", "enIN"],
                          ["ta-IN", "taIN"],
                        ],
                      ],
                    ] as const
                  ).map(([name, options]) => (
                    <Field key={name}>
                      <FieldLabel htmlFor={`shop-${name}`}>
                        {t(name)}
                      </FieldLabel>
                      <select
                        id={`shop-${name}`}
                        className="ui-input"
                        {...register(name)}
                      >
                        {options.map(([value, label]) => (
                          <option key={value} value={value}>
                            {t(label)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </fieldset>
                <section aria-labelledby="shop-logo">
                  <h3 id="shop-logo">{t("logo")}</h3>
                  <p>{t("logoHelp")}</p>
                  {logo && (
                    <>
                      <p>{t("logoAttached")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setLogo(null);
                          setValue("logoAssetId", null);
                          setDirty(true);
                        }}
                      >
                        {t("removeLogo")}
                      </Button>
                    </>
                  )}
                  {state.brandingAvailable ? (
                    <LogoUpload
                      controller={upload}
                      disabled={busy || !!attempt}
                      attach={(id) => {
                        setLogo(id);
                        setValue("logoAssetId", id);
                        setDirty(true);
                      }}
                    />
                  ) : (
                    <p>{t("logoUnavailable")}</p>
                  )}
                  {pendingLogo && (
                    <>
                      <p role="status">{t("logoPending")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          uploadState.busy || uploadState.state === "uncertain"
                        }
                        onClick={() => upload.discard()}
                      >
                        {t("discardLogo")}
                      </Button>
                    </>
                  )}
                </section>
                {dirty && <p role="status">{t("unsaved")}</p>}
                <div className="owner-actions">
                  <Button
                    disabled={busy || !!attempt || !!conflict || !!pendingLogo}
                    type="submit"
                  >
                    {t("review")}
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
            )}
            <section
              className="shop-profile-history"
              aria-labelledby="profile-history"
            >
              <h2 id="profile-history">{t("history")}</h2>
              <p>{t("historyHelp")}</p>
              <Button
                variant="outline"
                disabled={historyBusy}
                onClick={() => void historyPage()}
              >
                {t("history")}
              </Button>
              {historyError && <p role="alert">{t("historyError")}</p>}
              {history?.length === 0 && <p>{t("noHistory")}</p>}
              {history?.map((r) => (
                <details key={r.id}>
                  <summary>
                    {t("revision", { version: r.version })} —{" "}
                    {new Intl.DateTimeFormat(
                      locale === "ta" ? "ta-IN" : "en-IN",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      },
                    ).format(new Date(r.effectiveAt))}
                  </summary>
                  <p>{r.baseline ? t("baseline") : t("effective")}</p>
                  <p>
                    {t("author")}:{" "}
                    {r.actorId === state.currentActorId
                      ? t("youOwner")
                      : t("recordedOwner")}
                    <small className="shop-actor">
                      {t("actorReference")}: {r.actorId}
                    </small>
                  </p>
                  <ProfileValues profile={r.profile} />
                  {r.profile.logoAssetId && <p>{t("logoAttached")}</p>}
                </details>
              ))}
              {next && (
                <Button
                  variant="outline"
                  disabled={historyBusy}
                  onClick={() => void historyPage(true)}
                >
                  {t("more")}
                </Button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
