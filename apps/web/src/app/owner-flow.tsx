"use client";

import {
  completeOwnerShop,
  OwnerRequestError,
  ownerSession,
  readOwnerShop,
  resendOwnerVerification,
  setupOwner,
  verifyOwner,
} from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ownerMessages } from "./owner-messages";

type Mode = "setup" | "sign-in" | "owner";
export function OwnerFlow({ mode }: { mode: Mode }) {
  const [locale, setLocale] = useState<"ta" | "en">("ta");
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={ownerMessages[locale]}
      timeZone="Asia/Kolkata"
    >
      <main className="aarili-main owner-shell" lang={locale}>
        <header className="preview-header owner-heading">
          <a href="/sign-in">Aarili · ஆரிலி</a>
          <Button
            variant="outline"
            onClick={() => setLocale(locale === "ta" ? "en" : "ta")}
            aria-label={locale === "ta" ? "English" : "தமிழ்"}
          >
            {locale === "ta" ? "English" : "தமிழ்"}
          </Button>
        </header>
        <Flow mode={mode} />
      </main>
    </NextIntlClientProvider>
  );
}
function Flow({ mode }: { mode: Mode }) {
  const t = useTranslations();
  const [step, setStep] = useState<"initial" | "resume" | "verify">("initial");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [shop, setShop] = useState<Awaited<ReturnType<typeof readOwnerShop>>>();
  const [loading, setLoading] = useState(mode === "owner");
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const key = useRef<string | undefined>(undefined);
  const lastInput = useRef("");
  useEffect(() => {
    if (mode !== "owner") return;
    let active = true;
    readOwnerShop()
      .then((result) => {
        if (active) setShop(result);
      })
      .catch(() => {
        if (active) setFailure("invalid");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode]);
  useEffect(() => {
    if (notice || failure) noticeRef.current?.focus();
  }, [notice, failure]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      const code = error instanceof OwnerRequestError ? error.code : "";
      setFailure(
        code === "VALIDATION_FAILED"
          ? "validation"
          : code === "SETUP_CLOSED" || code === "REQUEST_CONFLICT"
            ? "closed"
            : code === "INVALID_CREDENTIALS" || code === "UNAUTHENTICATED"
              ? "invalid"
              : code === "INVALID_VERIFICATION"
                ? "badCode"
                : code === "MAIL_UNAVAILABLE"
                  ? "mailError"
                  : code === "RATE_LIMITED"
                    ? "limited"
                    : code === "NOT_FOUND"
                      ? "unavailable"
                      : "error",
      );
    } finally {
      setBusy(false);
    }
  }
  function field(
    id: string,
    type = "text",
    autoComplete = "off",
    hint?: string,
  ) {
    return (
      <Field key={id}>
        <FieldLabel htmlFor={id}>{t(id)}</FieldLabel>
        <Input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          required
          maxLength={
            id === "password"
              ? 128
              : id === "email"
                ? 254
                : id === "token"
                  ? 512
                  : id === "code"
                    ? 256
                    : 120
          }
          minLength={
            id === "password" && mode === "setup" && step === "initial" ? 15 : 1
          }
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {hint && (
          <FieldDescription id={`${id}-hint`}>{t(hint)}</FieldDescription>
        )}
      </Field>
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "");
    void run(async () => {
      if (mode === "sign-in") {
        await ownerSession("sign-in/email", {
          email: value("email"),
          password: value("password"),
        });
        form.reset();
        window.location.assign("/owner");
        return;
      }
      if (step === "verify") {
        await verifyOwner(value("code"));
        form.reset();
        setNotice("verified");
        return;
      }
      if (step === "resume")
        await resendOwnerVerification(
          { email: value("email"), password: value("password") },
          value("token"),
        );
      else {
        const input = {
          name: value("name"),
          email: value("email"),
          password: value("password"),
          shopName: value("shopName"),
        };
        const serial = JSON.stringify(input);
        if (serial !== lastInput.current) {
          key.current = crypto.randomUUID();
          lastInput.current = serial;
        }
        await setupOwner(
          input,
          value("token"),
          key.current ?? crypto.randomUUID(),
        );
      }
      form.reset();
      lastInput.current = "";
      key.current = undefined;
      setStep("verify");
      setNotice("delivered");
    });
  }
  return (
    <section className="owner-content">
      <h1>
        {mode === "setup"
          ? t(step === "verify" ? "verification" : "setup")
          : t(mode === "owner" ? "owner" : "signIn")}
      </h1>
      {mode === "setup" && (
        <>
          <p>{t(step === "verify" ? "verificationHelp" : "intro")}</p>
          <p className="text-sm text-muted-foreground">{t("synthetic")}</p>
          <nav className="preview-controls" aria-label={t("setup")}>
            {(["initial", "resume", "verify"] as const).map((item) => (
              <Button
                key={item}
                variant={step === item ? "secondary" : "ghost"}
                disabled={busy}
                aria-pressed={step === item}
                onClick={() => {
                  setStep(item);
                  setNotice("");
                  setFailure("");
                }}
              >
                {t(item)}
              </Button>
            ))}
          </nav>
        </>
      )}
      {(notice || failure) && (
        <p
          className={failure ? "text-destructive" : "text-success-foreground"}
          ref={noticeRef}
          tabIndex={-1}
          role={failure ? "alert" : "status"}
        >
          {t(failure || notice)}
        </p>
      )}
      {mode !== "owner" && (
        <form key={step} method="post" className="owner-form" onSubmit={submit}>
          {step === "verify" && mode === "setup" ? (
            field("code", "text", "off")
          ) : (
            <>
              {mode === "setup" &&
                step === "initial" &&
                field("name", "text", "name")}
              {field("email", "email", "username")}
              {field(
                "password",
                "password",
                mode === "setup" && step === "initial"
                  ? "new-password"
                  : "current-password",
                mode === "setup" && step === "initial"
                  ? "passwordHelp"
                  : undefined,
              )}
              {mode === "setup" && step === "initial" && field("shopName")}
              {mode === "setup" &&
                field("token", "password", "off", "tokenHelp")}
            </>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? t("working")
              : mode === "sign-in"
                ? t("submit")
                : step === "initial"
                  ? t("create")
                  : step === "resume"
                    ? t("resend")
                    : t("verify")}
          </Button>
        </form>
      )}
      {mode === "owner" && (
        <>
          {loading && <p role="status">{t("loading")}</p>}
          {shop?.state === "pending-shop" && (
            <>
              <p>{t("pendingShop")}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await completeOwnerShop();
                    setShop(await readOwnerShop());
                    setNotice("complete");
                  })
                }
              >
                {busy ? t("working") : t("openShop")}
              </Button>
            </>
          )}
          {shop?.state === "complete" && (
            <>
              <h2>{shop.name}</h2>
              <p>{t("complete")}</p>
            </>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await ownerSession("sign-out");
                setShop(undefined);
                window.location.replace("/sign-in");
              })
            }
          >
            {t("signOut")}
          </Button>
        </>
      )}
      <footer className="owner-footer">
        {mode !== "sign-in" ? (
          <a href="/sign-in">{t("signInLink")}</a>
        ) : (
          <a href="/setup">{t("setupLink")}</a>
        )}
      </footer>
    </section>
  );
}
