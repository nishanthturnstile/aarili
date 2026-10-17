import type { OwnerEntry } from "@aarili/contracts";
import { Button } from "@aarili/ui/components/button";
import { WorkspaceNavigation } from "@aarili/ui/components/workspace-navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { CustomerScreen } from "./customer-screen";
import { OwnerConnections } from "./owner-connections";
import {
  OwnerFeedback,
  type OwnerGuard,
  type OwnerRequest,
} from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";
export function OwnerWorkspace({
  mode,
  entry,
  queries,
  request,
  leave,
  signOut,
  guard,
  customerId,
}: {
  mode:
    | "dashboard"
    | "connections"
    | "customers"
    | "customer-new"
    | "customer-profile";
  entry: Extract<OwnerEntry, { state: "ready" }>;
  queries: ReturnType<typeof createOwnerQueries>;
  request: OwnerRequest;
  leave: (action: () => Promise<string>) => Promise<void>;
  signOut: () => Promise<void>;
  guard: OwnerGuard;
  customerId?: string | undefined;
}) {
  const t = useTranslations();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus();
  }, []);
  return (
    <>
      <WorkspaceNavigation
        current={
          mode === "dashboard"
            ? "owner"
            : mode === "connections"
              ? "connections"
              : "customers"
        }
        shopName={entry.shop.name}
        labels={{
          navigation: t("navigation"),
          workspace: t("workspace"),
          connections: t("connections"),
          customers: t("customers.title"),
          currentShop: t("currentShop"),
          expandNavigation: t("expandNavigation"),
          collapseNavigation: t("collapseNavigation"),
        }}
      />
      <section className="owner-content workspace-content entry-dashboard">
        <h1 id="owner-content" ref={heading} tabIndex={-1}>
          {mode === "connections"
            ? t("connections")
            : mode === "dashboard"
              ? entry.shop.name
              : t(
                  mode === "customer-new"
                    ? "customers.newTitle"
                    : mode === "customer-profile"
                      ? "customers.profileTitle"
                      : "customers.title",
                )}
        </h1>
        {mode === "customers" ||
        mode === "customer-new" ||
        mode === "customer-profile" ? (
          <CustomerScreen
            key={`${entry.shop.shopId}:${mode}:${customerId ?? ""}`}
            shopId={entry.shop.shopId}
            mode={mode}
            customerId={customerId}
            queries={queries}
            guard={guard}
          />
        ) : mode === "connections" ? (
          <OwnerConnections queries={queries} request={request} leave={leave} />
        ) : (
          <>
            <p className="entry-intro">{t("dashboardWelcome")}</p>
            <OwnerFeedback request={request} />
            <section
              className="entry-business-status"
              aria-labelledby="next-heading"
            >
              <h2 id="next-heading">{t("nextSetup")}</h2>
              <p>{t("nextSetupHelp")}</p>
            </section>
            <section
              className="entry-account"
              aria-labelledby="account-heading"
            >
              <div>
                <h2 id="account-heading">{t("ownerAccount")}</h2>
                <p>{t("accountHelp")}</p>
              </div>
              <a className="access-secondary-link" href="/connections">
                {t("manageConnections")}
              </a>
            </section>
          </>
        )}
        {mode === "dashboard" && (
          <a href="/reauthenticate">{t("reauthenticateLink")}</a>
        )}
        <Button
          className="entry-signout"
          variant="ghost"
          disabled={request.busy}
          onClick={() => void signOut()}
        >
          {t("signOut")}
        </Button>
      </section>
    </>
  );
}
