import { OwnerRequestError, ownerSession } from "@aarili/api/client";
import type { OwnerEntry } from "@aarili/contracts";
import { Button } from "@aarili/ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ownerDestination } from "./owner-entry-policy";
import {
  OwnerFeedback,
  type OwnerGuard,
  useOwnerRequest,
} from "./owner-feedback";
import { OwnerOnboarding } from "./owner-onboarding";
import type { createOwnerQueries } from "./owner-query";
import { OwnerWorkspace } from "./owner-workspace";

export type EntryMode =
  | "onboarding"
  | "dashboard"
  | "connections"
  | "settings"
  | "payments"
  | "orders"
  | "customers"
  | "customer-new"
  | "customer-profile";
export function OwnerEntryScreen({
  mode,
  queries,
  guard,
  customerId,
}: {
  mode: EntryMode;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
  customerId?: string | undefined;
}) {
  const t = useTranslations();
  const request = useOwnerRequest(guard);
  const { setFailure, setNotice, cleared } = request;
  const [entry, setEntry] = useState<OwnerEntry>();
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const leaving = useRef(false);
  useEffect(
    () =>
      queries.onInvalidate(() => {
        setEntry(undefined);
        setNotice("");
        cleared();
        if (
          !leaving.current &&
          !document.documentElement.hasAttribute("data-owner-suspended")
        )
          window.location.replace("/owner");
      }),
    [queries, setNotice, cleared],
  );
  useEffect(() => {
    if (reload > 0) setFailure("");
    let active = true;
    const unsubscribe = queries.onInvalidate(() => {
      active = false;
    });
    let checking = false;
    async function check() {
      if (checking || leaving.current) return;
      checking = true;
      try {
        const current = await queries.entry();
        if (!active) return;
        const destination = ownerDestination(
          current.state,
          mode.startsWith("customer")
            ? "/customers"
            : (`/${mode}` as
                | "/onboarding"
                | "/dashboard"
                | "/connections"
                | "/settings"
                | "/orders"),
        );
        if (destination) {
          window.location.replace(destination);
          return;
        }
        setEntry(current);
        setFailure("");
      } catch (error) {
        if (!active) return;
        setEntry(undefined);
        if (
          error instanceof OwnerRequestError &&
          error.code === "UNAUTHENTICATED"
        )
          window.location.replace("/sign-in");
        else
          setFailure(
            error instanceof OwnerRequestError &&
              error.code === "SHOP_ACCESS_DENIED"
              ? "entryDeniedHelp"
              : "loadError",
          );
      } finally {
        checking = false;
        if (active) setLoading(false);
      }
    }
    void check();
    const focus = () => {
      void check();
    };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", focus);
    };
  }, [mode, queries, reload, setFailure]);
  async function leave(action: () => Promise<string>) {
    await request.run(async () => {
      leaving.current = true;
      try {
        window.location.assign(await action());
      } finally {
        leaving.current = false;
      }
    });
  }
  const signOut = () =>
    leave(async () => {
      try {
        await ownerSession("sign-out");
      } catch {
        throw new OwnerRequestError("SIGN_OUT_UNCONFIRMED");
      }
      return "/sign-in";
    });
  if (!entry)
    return (
      <section className="owner-content access-content entry-auth">
        <h1 id="owner-content" tabIndex={-1}>
          {t(loading ? "loading" : "entryUnavailable")}
        </h1>
        <OwnerFeedback request={request} />
        {!loading && (
          <div className="owner-form">
            <Button
              onClick={() => {
                setLoading(true);
                setReload((value) => value + 1);
              }}
            >
              {t("retry")}
            </Button>
            <Button
              variant="outline"
              disabled={request.busy}
              onClick={() => void signOut()}
            >
              {t("signOut")}
            </Button>
            <a href="/sign-in">{t("back")}</a>
          </div>
        )}
      </section>
    );
  if (entry.state === "needs-onboarding")
    return (
      <OwnerOnboarding
        entry={entry}
        queries={queries}
        request={request}
        signOut={signOut}
      />
    );
  return (
    <OwnerWorkspace
      mode={mode === "onboarding" ? "dashboard" : mode}
      entry={entry}
      queries={queries}
      request={request}
      leave={leave}
      signOut={signOut}
      guard={guard}
      customerId={customerId}
      onShopNameChanged={(name) =>
        setEntry((current) =>
          current?.state === "ready"
            ? { ...current, shop: { ...current.shop, name } }
            : current,
        )
      }
    />
  );
}
