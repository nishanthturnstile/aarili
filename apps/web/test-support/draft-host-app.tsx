"use client";

// Isolated browser fixture: imported only by the disposable Next host, never
// normal app routing. All requests still use production typed module clients.
import { clearOwnerState } from "@aarili/api/client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import { draftMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { DraftForm, ResumeDrafts } from "../src/app/draft-form";
import type { DraftRecovery } from "../src/app/draft-recovery";
import { createDraftScope } from "../src/app/draft-scope";
import { createWorkGuard } from "../src/app/pwa-runtime";

const schema = z.object({
  value: z.string(),
  amountRaw: z.string(),
  measurementRaw: z.string(),
});
export default function DraftHost({ shopId }: { shopId: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const scope = useRef<ReturnType<typeof createDraftScope> | undefined>(
    undefined,
  );
  const [guard] = useState(createWorkGuard);
  const [controller, setController] = useState<DraftRecovery>();
  const [error, setError] = useState(false);
  const [resume, setResume] = useState(false);
  const safe = useSyncExternalStore(guard.subscribe, guard.safe, () => true);
  function open(record?: DraftRecord) {
    if (!scope.current) return;
    if (controller) scope.current.release(controller);
    setController(
      scope.current.open({
        workflow: "fixture.intake",
        schemaVersion: 1,
        initial: { value: "", amountRaw: "", measurementRaw: "" },
        ...(record ? { record } : {}),
        committed: (saved) => {
          const url = new URL(location.href);
          url.searchParams.set("draft", saved.id);
          history.replaceState(null, "", url);
        },
      }),
    );
    setResume(false);
  }
  // Scope lifetime belongs to the effect, including StrictMode's setup replay.
  // biome-ignore lint/correctness/useExhaustiveDependencies: host only opens current effect-owned scope
  useEffect(() => {
    const current = createDraftScope(shopId, guard);
    scope.current = current;
    let active = true;
    const id = new URL(location.href).searchParams.get("draft");
    if (id)
      void current.read(id).then(
        (record) => {
          if (active) open(record);
        },
        () => {
          if (active) setError(true);
        },
      );
    else open();
    return () => {
      active = false;
      current.dispose();
      if (scope.current === current) scope.current = undefined;
    };
  }, [shopId]);
  return (
    <main className="aarili-main" lang={locale}>
      <section className="owner-content">
        <h1>
          {locale === "en" ? "Synthetic draft recovery" : "சோதனை வரைவு மீட்பு"}
        </h1>
        <div className="owner-actions">
          <Button
            type="button"
            onClick={() => setLocale((value) => (value === "en" ? "ta" : "en"))}
          >
            English / தமிழ்
          </Button>
          <Button
            type="button"
            onClick={() => {
              document.documentElement.classList.toggle("dark");
            }}
          >
            Theme
          </Button>
          <Button type="button" onClick={() => clearOwnerState()}>
            End access
          </Button>
          <Button type="button" onClick={() => setResume((value) => !value)}>
            {draftMessages[locale].resume}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (
                controller?.confirmLeave(() =>
                  window.confirm(draftMessages[locale].warning),
                )
              )
                open();
            }}
          >
            New form
          </Button>
        </div>
        <p data-testid="update-guard">
          {safe ? "Update safe" : "Update blocked"}
        </p>
        {error && <p role="alert">Draft unavailable</p>}
        <Link href="/?leave=1">Leave form</Link>
        {resume && scope.current ? (
          <ResumeDrafts scope={scope.current} locale={locale} open={open} />
        ) : (
          controller && (
            <DraftForm
              controller={controller}
              schema={schema}
              locale={locale}
              guard={guard}
            >
              {(form) => (
                <>
                  <Field>
                    <FieldLabel htmlFor="value">
                      {locale === "en" ? "Synthetic value" : "சோதனை மதிப்பு"}
                    </FieldLabel>
                    <Input id="value" {...form.register("value")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="amount">
                      {locale === "en" ? "Synthetic amount" : "சோதனை தொகை"}
                    </FieldLabel>
                    <Input
                      id="amount"
                      inputMode="numeric"
                      {...form.register("amountRaw")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="measurement">
                      {locale === "en" ? "Synthetic measurement" : "சோதனை அளவு"}
                    </FieldLabel>
                    <Input
                      id="measurement"
                      inputMode="decimal"
                      {...form.register("measurementRaw")}
                    />
                  </Field>
                </>
              )}
            </DraftForm>
          )
        )}
      </section>
    </main>
  );
}
