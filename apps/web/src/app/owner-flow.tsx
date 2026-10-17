"use client";
import {
  clearOwnerState,
  connectOwnerSessionChanges,
} from "@aarili/api/client";
import {
  customerMessages,
  guardianMessages,
  type Locale,
  ownerMessages,
  shopCalendarMessages,
  shopSettingsMessages,
  wearerMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import { AppearanceControl } from "./appearance-control";
import { type AccessMode, OwnerAccess } from "./owner-access";
import { OwnerEntryScreen } from "./owner-entry";
import { OwnerEntryError } from "./owner-entry-error";
import { createOwnerQueries } from "./owner-query";
import { PwaNotice } from "./pwa";
import { createWorkGuard } from "./pwa-runtime";

type Mode =
  | AccessMode
  | "owner"
  | "connections"
  | "settings"
  | "dashboard"
  | "customers"
  | "customer-new"
  | "customer-profile"
  | "onboarding"
  | "entry-denied"
  | "entry-unavailable";
export function OwnerFlow({
  mode,
  customerId,
}: {
  mode: Mode;
  customerId?: string | undefined;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  const [queries] = useState(createOwnerQueries);
  const [guard] = useState(createWorkGuard);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const disconnect = queries.connect();
    const disconnectChannel = connectOwnerSessionChanges(() => {
      clearOwnerState();
      window.location.replace("/owner");
    });
    const hide = () => {
      document.documentElement.setAttribute("data-owner-suspended", "true");
      for (const form of document.forms) form.reset();
      clearOwnerState();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    return () => {
      disconnectChannel();
      disconnect();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
    };
  }, [queries]);
  return (
    <QueryClientProvider client={queries.client}>
      <NextIntlClientProvider
        locale={locale}
        messages={{
          ...ownerMessages[locale],
          customers: customerMessages[locale],
          wearers: wearerMessages[locale],
          guardians: guardianMessages[locale],
          settings: shopSettingsMessages[locale],
          calendar: shopCalendarMessages[locale],
        }}
        timeZone="Asia/Kolkata"
      >
        <main
          className="aarili-main owner-shell"
          lang={locale}
          data-owner-ready={ready}
        >
          <a className="owner-skip-link" href="#owner-content">
            {ownerMessages[locale].skipToContent}
          </a>
          <header className="owner-heading entry-header">
            <a className="entry-brand" href="/owner">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <rect width="36" height="36" rx="10" />
                <path d="m10 26 8-17 8 17M13 20h10" />
              </svg>
              <span>{locale === "en" ? "Aarili" : "ஆரிலி"}</span>
            </a>
            <div className="owner-actions">
              <AppearanceControl
                lightLabel={ownerMessages[locale].lightTheme}
                darkLabel={ownerMessages[locale].darkTheme}
              />
              <Button
                variant="outline"
                onClick={() => setLocale(locale === "ta" ? "en" : "ta")}
                aria-label={locale === "ta" ? "English" : "தமிழ்"}
                lang={locale === "ta" ? "en" : "ta"}
              >
                {locale === "ta" ? "English" : "தமிழ்"}
              </Button>
            </div>
          </header>
          <PwaNotice locale={locale} guard={guard} />
          {mode === "entry-denied" || mode === "entry-unavailable" ? (
            <OwnerEntryError denied={mode === "entry-denied"} guard={guard} />
          ) : mode === "owner" ||
            mode === "connections" ||
            mode === "settings" ||
            mode === "onboarding" ||
            mode === "customers" ||
            mode === "customer-new" ||
            mode === "customer-profile" ||
            mode === "dashboard" ? (
            <OwnerEntryScreen
              mode={mode === "owner" ? "dashboard" : mode}
              queries={queries}
              guard={guard}
              customerId={customerId}
            />
          ) : (
            <OwnerAccess mode={mode} guard={guard} />
          )}
        </main>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
