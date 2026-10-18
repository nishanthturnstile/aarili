import { OwnerRequestError, ownerSession } from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import { useTranslations } from "next-intl";
import {
  OwnerFeedback,
  type OwnerGuard,
  useOwnerRequest,
} from "./owner-feedback";

export function OwnerEntryError({
  denied,
  guard,
}: {
  denied: boolean;
  guard: OwnerGuard;
}) {
  const t = useTranslations();
  const request = useOwnerRequest(guard);
  return (
    <section className="owner-content access-content entry-auth">
      <h1 id="owner-content" tabIndex={-1}>
        {t(denied ? "entryDenied" : "entryUnavailable")}
      </h1>
      <p className="entry-intro">
        {t(denied ? "entryDeniedHelp" : "entryUnavailableHelp")}
      </p>
      <OwnerFeedback request={request} />
      <div className="owner-form">
        <Button onClick={() => window.location.replace("/owner")}>
          {t("retry")}
        </Button>
        <Button
          variant="outline"
          disabled={request.busy}
          onClick={() =>
            void request.run(async () => {
              try {
                await ownerSession("sign-out");
              } catch {
                throw new OwnerRequestError("SIGN_OUT_UNCONFIRMED");
              }
              window.location.replace("/sign-in");
            })
          }
        >
          {t("signOut")}
        </Button>
      </div>
    </section>
  );
}
