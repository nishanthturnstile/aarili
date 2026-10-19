import { onOwnerInvalidation, reauthenticateOwner } from "@aarili/api/client";
import { readPresentation } from "@aarili/api/service-templates-client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  presentationCommandSchema,
  presentationDraftSchema,
} from "@aarili/contracts/service-templates";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import type { OwnerGuard } from "./owner-feedback";

type State = Awaited<ReturnType<typeof readPresentation>>;
const Mode = createContext<"simple" | "detailed">("simple");
export const usePresentationMode = () => useContext(Mode);
function locator(id?: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("presentationDraft", id);
  else url.searchParams.delete("presentationDraft");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
function PreferenceEditor({
  controller,
  refresh,
  restart,
}: {
  controller: DraftRecovery;
  refresh: () => Promise<void>;
  restart: () => void;
}) {
  const t = useTranslations("serviceTemplates");
  const s = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const [review, setReview] = useState(false),
    [authBusy, setAuthBusy] = useState(false),
    [authFailed, setAuthFailed] = useState(false);
  const password = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    (review ? reviewHeading.current : heading.current)?.focus();
  }, [review]);
  useEffect(() => {
    if (s.error === "AUTHENTICATION_STALE") password.current?.focus();
  }, [s.error]);
  const v = presentationDraftSchema.parse(s.values);
  const valid = presentationCommandSchema.safeParse(v).success;
  const busy =
    s.work.inFlight ||
    s.work.outcomeUnknown ||
    s.status === "denied" ||
    s.status === "promoted" ||
    s.status === "conflict";
  return (
    <div>
      <h3 ref={heading} tabIndex={-1}>
        {t("editPreference")}
      </h3>
      <p role="status">{t(s.status)}</p>
      {s.error && (
        <p role="alert">
          {t(
            s.error === "VERSION_STALE"
              ? "conflict"
              : s.error === "RATE_LIMITED"
                ? "rateLimited"
                : "error",
          )}
        </p>
      )}
      {s.error === "AUTHENTICATION_STALE" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (authBusy) return;
            const value = password.current?.value ?? "";
            if (password.current) password.current.value = "";
            setAuthBusy(true);
            setAuthFailed(false);
            try {
              await reauthenticateOwner(value, true);
              await controller.retry();
            } catch {
              setAuthFailed(true);
            } finally {
              setAuthBusy(false);
            }
          }}
        >
          <Field>
            <FieldLabel htmlFor="presentation-password">
              {t("password")}
            </FieldLabel>
            <Input
              id="presentation-password"
              ref={password}
              type="password"
              autoComplete="current-password"
              required
              disabled={authBusy}
            />
          </Field>
          {authFailed && <p role="alert">{t("authError")}</p>}
          <Button type="submit" disabled={authBusy}>
            {t("reauth")}
          </Button>
        </form>
      )}
      <fieldset
        disabled={busy}
        onCompositionStart={() => controller.composition(true)}
        onCompositionEnd={() => controller.composition(false)}
      >
        <legend>{t("shopMode")}</legend>
        {(["simple", "detailed"] as const).map((mode) => (
          <label key={mode} className="directory-check">
            <input
              type="radio"
              name={`preference-${s.id}`}
              checked={v.mode === mode}
              onChange={() => {
                setReview(false);
                controller.edit({ ...v, mode });
              }}
            />
            {t(mode)}
          </label>
        ))}
        <Field>
          <FieldLabel htmlFor="presentation-reason">{t("reason")}</FieldLabel>
          <Input
            id="presentation-reason"
            value={v.reason}
            maxLength={1000}
            aria-invalid={!valid}
            onChange={(e) => {
              setReview(false);
              controller.edit({ ...v, reason: e.target.value });
            }}
          />
        </Field>
      </fieldset>
      <div className="calendar-actions">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void controller.save()}
        >
          {t("save")}
        </Button>
        <Button
          disabled={!valid || s.status !== "saved" || s.work.dirty}
          onClick={() => setReview(true)}
        >
          {t("review")}
        </Button>
        {s.status === "checking" && (
          <Button
            disabled={s.work.inFlight}
            onClick={() => void controller.retry()}
          >
            {t("retry")}
          </Button>
        )}
        {s.status === "conflict" && (
          <Button
            onClick={() => {
              void refresh();
              void controller.refreshConflict();
            }}
          >
            {t("compare")}
          </Button>
        )}
        {s.conflict && (
          <Button onClick={() => controller.resolveConflict("server")}>
            {t("useServer")}
          </Button>
        )}
        {!s.work.outcomeUnknown && !s.work.inFlight && (
          <Button variant="ghost" onClick={restart}>
            {t("cancel")}
          </Button>
        )}
      </div>
      {review && s.status === "saved" && !s.work.dirty && (
        <div>
          <h4 ref={reviewHeading} tabIndex={-1}>
            {t("review")}
          </h4>
          <p>{t("preferenceReview", { mode: t(v.mode) })}</p>
          <p>{v.reason}</p>
          <Button onClick={() => void controller.promote()}>
            {t("publish")}
          </Button>
          <Button variant="ghost" onClick={() => setReview(false)}>
            {t("back")}
          </Button>
        </div>
      )}
    </div>
  );
}
export function PresentationProvider({
  shopId,
  guard,
  children,
}: {
  shopId: string;
  guard: OwnerGuard;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>();
  return (
    <Mode.Provider value={state?.mode ?? "simple"}>
      <PresentationPreference
        key={shopId}
        shopId={shopId}
        guard={guard}
        state={state}
        onState={setState}
      />
      {children}
    </Mode.Provider>
  );
}
function PresentationPreference({
  shopId,
  guard,
  state,
  onState,
}: {
  shopId: string;
  guard: OwnerGuard;
  state: State | undefined;
  onState: (state: State | undefined) => void;
}) {
  const t = useTranslations("serviceTemplates");
  const startButton = useRef<HTMLButtonElement>(null);
  const [session, setSession] = useState<{
    scope: ReturnType<typeof createDraftScope>;
    alive: () => boolean;
  }>();
  const [controller, setController] = useState<DraftRecovery>(),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const open = (
    scope: ReturnType<typeof createDraftScope>,
    initial: Record<string, unknown>,
    alive: () => boolean,
    record?: DraftRecord,
  ) => {
    const c = scope.open({
      workflow: "shop.presentation",
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      committed: (r) => {
        if (!alive()) return;
        if (r.lifecycle === "active") locator(r.id);
        if (r.lifecycle === "promoted") {
          locator();
          void readPresentation(shopId)
            .then((v) => {
              if (alive()) onState(v);
            })
            .catch(() => {
              if (alive()) setFailed(true);
            });
        }
      },
    });
    setController(c);
    if (record) locator(record.id);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scope owns the controller and cancels pending updates on unmount.
  useEffect(() => {
    let alive = true;
    const scope = createDraftScope(shopId, guard);
    const unsubscribe = onOwnerInvalidation(() => {
      alive = false;
      onState(undefined);
      setController(undefined);
      setDrafts([]);
    });
    const current = () => alive;
    setSession({ scope, alive: current });
    setFailed(false);
    setController(undefined);
    void (async () => {
      try {
        const value = await readPresentation(shopId);
        const list = await scope.list();
        if (!alive) return;
        onState(value);
        setDrafts(
          list.drafts.filter(
            (d) =>
              d.workflow === "shop.presentation" && d.lifecycle === "active",
          ),
        );
        const id = new URL(window.location.href).searchParams.get(
          "presentationDraft",
        );
        if (id) {
          const record = await scope.read(id);
          if (!alive) return;
          if (
            record.workflow !== "shop.presentation" ||
            !presentationDraftSchema.safeParse(record.payload).success
          )
            throw Error("Incompatible draft");
          open(scope, record.payload, current, record);
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      unsubscribe();
      scope.dispose();
    };
  }, [shopId, guard, attempt]);
  const refresh = async () => {
    try {
      const value = await readPresentation(shopId);
      if (session?.alive()) {
        onState(value);
        setFailed(false);
      }
    } catch {
      if (session?.alive()) setFailed(true);
    }
  };
  const cancel = () => {
    if (
      controller &&
      !controller.confirmLeave(() => window.confirm(t("discard")))
    )
      return;
    if (controller) session?.scope.release(controller);
    setController(undefined);
    locator();
    requestAnimationFrame(() => startButton.current?.focus());
  };
  return (
    <section className="shop-settings-main" aria-label={t("shopMode")}>
      <h2>{t("shopMode")}</h2>
      <p>{t("preferenceIntro")}</p>
      {state && <p>{t("currentMode", { mode: t(state.mode) })}</p>}
      {failed && <p role="alert">{t("previewUnavailable")}</p>}
      <Button
        variant="outline"
        onClick={() => setAttempt((a) => a + 1)}
        disabled={!!controller}
      >
        {t("refreshPreference")}
      </Button>
      {!controller && state && session && (
        <Button
          ref={startButton}
          onClick={() =>
            open(
              session.scope,
              {
                baseVersion: state.revision?.version ?? 0,
                baseRevisionId: state.revision?.id ?? null,
                mode: state.mode,
                reason: "",
              },
              session.alive,
            )
          }
        >
          {t("editPreference")}
        </Button>
      )}
      {!controller &&
        drafts.map((d) => (
          <Button
            key={d.id}
            variant="outline"
            onClick={() => {
              if (session) open(session.scope, d.payload, session.alive, d);
            }}
          >
            {t("resumePreference")} · {d.id}
          </Button>
        ))}
      {controller && (
        <PreferenceEditor
          key={controller.snapshot().id}
          controller={controller}
          refresh={refresh}
          restart={cancel}
        />
      )}
      {state && (
        <details>
          <summary>{t("preferenceHistory")}</summary>
          {state.history.map((r) => (
            <p className="shop-actor" key={r.id}>
              {t(r.mode)} · {r.version} · {r.id} · {r.actorId} · {r.effectiveAt}{" "}
              · {r.reason}
            </p>
          ))}
          {state.next && (
            <Button
              variant="outline"
              onClick={() => {
                void readPresentation(shopId, state.next ?? undefined)
                  .then((v) => {
                    if (session?.alive())
                      onState({
                        ...v,
                        history: [...state.history, ...v.history],
                      });
                  })
                  .catch(() => {
                    if (session?.alive()) setFailed(true);
                  });
              }}
            >
              {t("more")}
            </Button>
          )}
        </details>
      )}
    </section>
  );
}
