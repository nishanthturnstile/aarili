import type { OwnerEntry } from "@aarili/contracts";
import { Button } from "@aarili/ui/components/button";
import { WorkspaceNavigation } from "@aarili/ui/components/workspace-navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CustomerScreen } from "./customer-screen";
import { OwnerConnections } from "./owner-connections";
import {
  OwnerFeedback,
  type OwnerGuard,
  type OwnerRequest,
} from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";
import { ShopCalendarScreen } from "./shop-calendar-screen";
import { ShopDirectoryScreen } from "./shop-directory-screen";
import { ShopProfileScreen } from "./shop-profile-screen";
export function OwnerWorkspace({
  mode,
  entry,
  queries,
  request,
  leave,
  signOut,
  guard,
  customerId,
  onShopNameChanged,
}: {
  mode:
    | "dashboard"
    | "connections"
    | "settings"
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
  onShopNameChanged: (name: string) => void;
}) {
  const t = useTranslations();
  const [directory, setDirectory] = useState(
    () =>
      typeof window !== "undefined" &&
      new URL(window.location.href).searchParams.get("section") === "directory",
  );
  const [calendar, setCalendar] = useState(
    () =>
      typeof window !== "undefined" &&
      new URL(window.location.href).searchParams.has("draft"),
  );
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
              : mode === "settings"
                ? "settings"
                : "customers"
        }
        shopName={entry.shop.name}
        labels={{
          navigation: t("navigation"),
          workspace: t("workspace"),
          homeShort: t("homeShort"),
          connectionsShort: t("connectionsShort"),
          settingsShort: t("settingsShort"),
          connections: t("connections"),
          customers: t("customers.title"),
          settings: t("settings.title"),
          currentShop: t("currentShop"),
          expandNavigation: t("expandNavigation"),
          collapseNavigation: t("collapseNavigation"),
        }}
      />
      <section className="owner-content workspace-content entry-dashboard">
        <h1 id="owner-content" ref={heading} tabIndex={-1}>
          {mode === "connections"
            ? t("connections")
            : mode === "settings"
              ? t("settings.title")
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
        {mode === "settings" ? (
          <>
            <nav className="calendar-actions" aria-label={t("settings.title")}>
              <Button
                variant="outline"
                aria-pressed={!calendar && !directory}
                onClick={() => {
                  if (guard.safe() || window.confirm(t("calendar.discard"))) {
                    setDirectory(false);
                    setCalendar(false);
                    const url = new URL(window.location.href);
                    url.search = "";
                    window.history.replaceState(null, "", url.pathname);
                  }
                }}
              >
                {t("settings.profile")}
              </Button>
              <Button
                variant="outline"
                aria-pressed={calendar && !directory}
                onClick={() => {
                  if (guard.safe() || window.confirm(t("calendar.discard"))) {
                    setDirectory(false);
                    setCalendar(true);
                    const url = new URL(window.location.href);
                    url.search = "";
                    window.history.replaceState(null, "", url.pathname);
                  }
                }}
              >
                {t("calendar.title")}
              </Button>
              <Button
                variant="outline"
                aria-pressed={directory}
                onClick={() => {
                  if (guard.safe() || window.confirm(t("calendar.discard"))) {
                    setDirectory(true);
                    const u = new URL(window.location.href);
                    u.search = "?section=directory";
                    window.history.replaceState(
                      null,
                      "",
                      `${u.pathname}${u.search}`,
                    );
                  }
                }}
              >
                {t("directory.title")}
              </Button>
            </nav>
            {directory ? (
              <ShopDirectoryScreen
                shopId={entry.shop.shopId}
                queries={queries}
                guard={guard}
              />
            ) : calendar ? (
              <ShopCalendarScreen
                shopId={entry.shop.shopId}
                queries={queries}
                guard={guard}
              />
            ) : (
              <ShopProfileScreen
                shopId={entry.shop.shopId}
                queries={queries}
                guard={guard}
                onSaved={onShopNameChanged}
              />
            )}
          </>
        ) : mode === "customers" ||
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
