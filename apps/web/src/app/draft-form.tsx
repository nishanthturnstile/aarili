"use client";

import { onOwnerInvalidation } from "@aarili/api/client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import { draftMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Status } from "@aarili/ui/components/status";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type FieldValues, type UseFormReturn, useForm } from "react-hook-form";
import type { z } from "zod";
import type { DraftRecovery } from "./draft-recovery.js";
import type { createDraftScope } from "./draft-scope.js";
import type { createWorkGuard } from "./pwa-runtime.js";

type DraftFormProps<T extends FieldValues> = {
  controller: DraftRecovery;
  schema: z.ZodType<T, T>;
  locale: Locale;
  guard: ReturnType<typeof createWorkGuard>;
  children: (form: UseFormReturn<T>) => ReactNode;
};
export function DraftForm<T extends FieldValues>(props: DraftFormProps<T>) {
  // Same draft identity may be reopened under a new owner/controller lifetime.
  // Remount RHF rather than retaining any previous values/defaults.
  return <DraftFormBody key={props.controller.instance} {...props} />;
}
function DraftFormBody<T extends FieldValues>({
  controller,
  schema,
  locale,
  guard,
  children,
}: DraftFormProps<T>) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: state.values as never,
  });
  const t = draftMessages[locale];
  useEffect(() => {
    const subscription = form.watch((values) =>
      controller.edit(values as Record<string, unknown>),
    );
    return () => subscription.unsubscribe();
  }, [controller, form]);
  useEffect(() => {
    if (state.status === "denied") {
      form.unregister();
      form.reset({} as never);
      return;
    }
    if (
      !state.work.dirty &&
      !state.work.inFlight &&
      JSON.stringify(form.getValues()) !== JSON.stringify(state.values)
    )
      form.reset(state.values as never);
  }, [form, state.values, state.status, state.work.dirty, state.work.inFlight]);
  useEffect(() => {
    const tracker = guard.track();
    const update = () => tracker.set(controller.snapshot().work);
    update();
    const stop = controller.subscribe(update);
    return () => {
      stop();
      tracker.dispose();
    };
  }, [controller, guard]);
  useEffect(() => {
    const online = () => {
      void controller.retry();
    };
    const leaving = (event: BeforeUnloadEvent) => {
      const work = controller.snapshot().work;
      if (work.dirty || work.inFlight || work.outcomeUnknown) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const next = new URL(link.href);
      if (
        next.origin !== location.origin ||
        (next.pathname === location.pathname && next.search === location.search)
      )
        return;
      if (!controller.confirmLeave(() => window.confirm(t.warning))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leaving);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leaving);
      document.removeEventListener("click", navigate, true);
    };
  }, [controller, t.warning]);
  const disabled =
    state.pendingPromotion ||
    state.status === "denied" ||
    state.status === "promoted" ||
    state.status === "closed" ||
    state.status === "promoting";
  if (state.status === "denied")
    return (
      <p lang={locale} role="status">
        {t.denied}
      </p>
    );
  return (
    <form
      className="owner-form"
      lang={locale}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(() => controller.promote())(event);
      }}
      onCompositionStart={() => controller.composition(true)}
      onCompositionEnd={() => {
        controller.edit(form.getValues());
        controller.composition(false);
      }}
    >
      <fieldset className="owner-form" disabled={disabled}>
        {children(form)}
      </fieldset>
      <p role="status" aria-live="polite" aria-atomic="true">
        <Status
          tone={
            state.status === "conflict" ||
            state.status === "notSaved" ||
            state.status === "checking"
              ? "warning"
              : "info"
          }
        >
          {t[state.status]}
        </Status>
      </p>
      {state.error && (
        <p role="alert">
          {state.error === "DRAFT_LINK_UNAVAILABLE"
            ? t.linkFailed
            : state.status === "conflict"
              ? t.conflict
              : state.status === "saved"
                ? t.promotionFailed
                : t.saveFailed}
        </p>
      )}
      <p>{t.warning}</p>
      {(state.status === "checking" || state.status === "notSaved") && (
        <Button
          type="button"
          variant="outline"
          disabled={state.work.inFlight}
          onClick={() => {
            void controller.retry();
          }}
        >
          {t.retry}
        </Button>
      )}
      {state.status === "conflict" && !state.conflict && (
        <div>
          <p>{t.unavailable}</p>
          <Button
            type="button"
            variant="outline"
            disabled={state.work.inFlight}
            onClick={() => {
              void controller.refreshConflict();
            }}
          >
            {t.reloadConflict}
          </Button>
        </div>
      )}
      {state.status === "conflict" && state.conflict && (
        <section className="owner-form" aria-label={t.current}>
          <h2>{t.current}</h2>
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(state.conflict.payload, null, 2)}
          </pre>
          <div className="owner-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => controller.resolveConflict("server")}
            >
              {t.server}
            </Button>
            {state.conflict.lifecycle === "active" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => controller.resolveConflict("local")}
              >
                {t.local}
              </Button>
            )}
          </div>
        </section>
      )}
      <Button
        type="submit"
        disabled={
          state.status !== "saved" || state.work.dirty || state.work.inFlight
        }
      >
        {t.promote}
      </Button>
      {state.work.dirty && <p>{t.saveFirst}</p>}
    </form>
  );
}

export function ResumeDrafts({
  scope,
  locale,
  open,
}: {
  scope: ReturnType<typeof createDraftScope>;
  locale: Locale;
  open: (record: DraftRecord) => void;
}) {
  const [records, setRecords] = useState<DraftRecord[]>([]);
  const [next, setNext] = useState<DraftCursor | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const loadedScope = useRef(scope);
  const t = draftMessages[locale];
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh reloads accumulated rows and cursor
  useEffect(() => {
    let current = true;
    const expected = ++generation.current;
    loadedScope.current = scope;
    setRecords([]);
    setNext(null);
    setOpening(false);
    setLoadingMore(false);
    setStatus("loading");
    void scope.list().then(
      (result) => {
        if (current) {
          setRecords(result.drafts);
          setNext(result.next);
          setStatus("ready");
        }
      },
      () => {
        if (current) setStatus("failed");
      },
    );
    const stop = onOwnerInvalidation(() => {
      current = false;
      generation.current++;
      setRecords([]);
      setNext(null);
      setLoadingMore(false);
      setStatus("failed");
    });
    return () => {
      current = false;
      if (generation.current === expected) generation.current++;
      stop();
    };
  }, [scope, attempt]);
  const visible = loadedScope.current === scope ? records : [];
  return (
    <section className="owner-form" lang={locale} aria-label={t.resume}>
      <h2>{t.resume}</h2>
      {status !== "ready" && <p role="status">{t[status]}</p>}
      {loadingMore && <p role="status">{t.loading}</p>}
      {status === "ready" && visible.length === 0 && <p>{t.empty}</p>}
      <ul className="owner-form">
        {visible.map((record) => (
          <li className="owner-actions" key={record.id}>
            <time dateTime={record.updatedAt}>{record.updatedAt}</time>{" "}
            {record.stale && t.stale}
            <Button
              type="button"
              variant="outline"
              disabled={opening || loadingMore}
              onClick={() => {
                const expected = generation.current;
                setOpening(true);
                void scope
                  .read(record.id)
                  .then(
                    (current) => {
                      if (expected === generation.current) open(current);
                    },
                    () => {
                      if (expected === generation.current) setStatus("failed");
                    },
                  )
                  .finally(() => {
                    if (expected === generation.current) setOpening(false);
                  });
              }}
            >
              {t.open}
            </Button>
          </li>
        ))}
      </ul>
      <div className="owner-actions">
        {next && loadedScope.current === scope && (
          <Button
            type="button"
            variant="outline"
            disabled={opening || loadingMore || status === "loading"}
            onClick={() => {
              const expected = generation.current;
              setLoadingMore(true);
              void scope
                .list(next)
                .then(
                  (result) => {
                    if (expected !== generation.current) return;
                    setRecords((previous) => [
                      ...new Map(
                        [...previous, ...result.drafts].map((record) => [
                          record.id,
                          record,
                        ]),
                      ).values(),
                    ]);
                    setNext(result.next);
                    setStatus("ready");
                  },
                  () => {
                    if (expected === generation.current) setStatus("failed");
                  },
                )
                .finally(() => {
                  if (expected === generation.current) setLoadingMore(false);
                });
            }}
          >
            {t.more}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={opening || loadingMore || status === "loading"}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t.refresh}
        </Button>
      </div>
    </section>
  );
}
