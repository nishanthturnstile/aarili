import type { OwnerEntry } from "@aarili/contracts";
import { Button } from "@aarili/ui/components/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { OwnerFeedback, type OwnerRequest } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";
import { ShopCreation } from "./owner-shop-creation";

export function OwnerOnboarding({
  entry,
  queries,
  request,
  signOut,
}: {
  entry: Extract<OwnerEntry, { state: "needs-onboarding" }>;
  queries: ReturnType<typeof createOwnerQueries>;
  request: OwnerRequest;
  signOut: () => Promise<void>;
}) {
  const t = useTranslations();
  const [name, setName] = useState(entry.suggestedName ?? "");
  return (
    <section className="owner-content entry-onboarding">
      <div>
        <h1 id="owner-content" tabIndex={-1}>
          {t("onboardingTitle")}
        </h1>
        <p className="entry-intro">{t("onboardingHelp")}</p>
        <section className="entry-identity" aria-label={t("ownerAccount")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
          </svg>
          <div>
            <strong>{entry.owner.name}</strong>
            <p>{entry.owner.email}</p>
            <p>{t("verifiedTitle")}</p>
          </div>
        </section>
        <OwnerFeedback request={request} />
        <ShopCreation
          suggestedName={entry.suggestedName}
          queries={queries}
          request={request}
          onNameChange={setName}
          completed={(shop) => {
            if (shop.state === "complete")
              window.location.replace("/dashboard");
          }}
        />
        <Button
          className="entry-signout"
          variant="ghost"
          disabled={request.busy}
          onClick={() => void signOut()}
        >
          {t("signOut")}
        </Button>
      </div>
      <aside className="entry-shop-preview" aria-label={t("shopPreview")}>
        <h2>{t("shopPreview")}</h2>
        <div>
          <span className="entry-monogram" aria-hidden="true">
            A
          </span>
          <h3>{name.trim() || t("shopPlaceholder")}</h3>
          <p>{entry.owner.name}</p>
        </div>
        <footer>
          <span>Aarili</span>
          <span>{t("preview")}</span>
        </footer>
      </aside>
    </section>
  );
}
