"use client";

import {
  completeOwnerShop,
  disconnectOwnerGoogle,
  OwnerRequestError,
  onOwnerInvalidation,
  ownerSession,
  probeRecentOwner,
  readGoogleConnection,
  readOwnerShop,
  reauthenticateOwner,
  requestOwnerRecovery,
  resendOwnerVerification,
  resetOwnerPassword,
  setupOwner,
  startOwnerGoogle,
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

type Mode =
  | "setup"
  | "sign-in"
  | "owner"
  | "recovery"
  | "reset"
  | "reauthenticate"
  | "connections";
// Google is a focused extension of the existing owner access surface.
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
  const [connection, setConnection] =
    useState<Awaited<ReturnType<typeof readGoogleConnection>>>();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [shop, setShop] = useState<Awaited<ReturnType<typeof readOwnerShop>>>();
  const [loading, setLoading] = useState(
    mode === "owner" || mode === "connections",
  );
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const disconnectRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const key = useRef<string | undefined>(undefined);
  const lastInput = useRef("");
  useEffect(() => {
    (confirmDisconnect ? confirmRef : disconnectRef).current?.focus();
  }, [confirmDisconnect]);
  useEffect(() => {
    if (mode !== "connections" && mode !== "sign-in") return;
    const result = window.location.hash;
    window.history.replaceState(null, "", window.location.pathname);
    if (result === "#google-linked" && mode === "connections")
      setNotice("googleLinked");
    if (result === "#google-denied") setFailure("googleDenied");
    if (result === "#google-disconnected") setNotice("googleDisconnected");
  }, [mode]);
  useEffect(() => {
    if (mode !== "connections") return;
    let active = true;
    const unsubscribe = onOwnerInvalidation(() => {
      if (active) {
        setConnection(undefined);
        setFailure("expired");
      }
    });
    readGoogleConnection()
      .then((data) => {
        if (active) setConnection(data);
      })
      .catch(() => {
        if (active) setFailure("expired");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [mode]);
  useEffect(() => {
    // Recovery uses pasted codes, never URL tokens or redirect parameters. Strip
    // accidental transient parameters immediately, including on failed resets.
    if (mode !== "reset" && mode !== "recovery") return;
    const strip = () =>
      window.history.replaceState(null, "", window.location.pathname);
    strip();
    window.addEventListener("hashchange", strip);
    window.addEventListener("popstate", strip);
    return () => {
      window.removeEventListener("hashchange", strip);
      window.removeEventListener("popstate", strip);
    };
  }, [mode]);
  useEffect(() => {
    if (mode !== "owner") return;
    let active = true;
    const unsubscribe = onOwnerInvalidation(() => {
      if (active) {
        setShop(undefined);
        setFailure("expired");
      }
    });
    readOwnerShop()
      .then((result) => {
        if (active) setShop(result);
      })
      .catch(() => {
        if (active) setFailure("expired");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
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
        code === "GOOGLE_DENIED"
          ? "googleDenied"
          : code === "GOOGLE_UNAVAILABLE"
            ? "googleUnavailable"
            : code === "VALIDATION_FAILED"
              ? "validation"
              : code === "SETUP_CLOSED" || code === "REQUEST_CONFLICT"
                ? "closed"
                : code === "UNAUTHENTICATED"
                  ? "expired"
                  : code === "AUTHENTICATION_STALE"
                    ? "stale"
                    : code === "INVALID_RESET"
                      ? "badReset"
                      : code === "INVALID_CREDENTIALS"
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
            id === "password" || id === "newPassword"
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
            id === "newPassword" ||
            (id === "password" && mode === "setup" && step === "initial")
              ? 15
              : 1
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
      if (mode === "recovery") {
        await requestOwnerRecovery(value("email"));
        form.reset();
        setNotice("recoveryRequested");
        return;
      }
      if (mode === "reset") {
        await resetOwnerPassword({
          token: value("resetCode"),
          newPassword: value("newPassword"),
        });
        form.reset();
        setNotice("passwordReset");
        return;
      }
      if (mode === "reauthenticate") {
        await reauthenticateOwner(value("password"));
        form.reset();
        window.location.replace("/owner");
        return;
      }
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
          : t(
              mode === "owner" ? "owner" : mode === "sign-in" ? "signIn" : mode,
            )}
      </h1>
      {mode === "recovery" && <p>{t("recoveryHelp")}</p>}
      {mode === "reset" && <p>{t("resetHelp")}</p>}
      {mode === "reauthenticate" && <p>{t("reauthenticateHelp")}</p>}
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
      {mode !== "owner" && mode !== "connections" && (
        <form key={step} method="post" className="owner-form" onSubmit={submit}>
          {mode === "recovery" ? (
            field("email", "email", "username")
          ) : mode === "reset" ? (
            <>
              {field("resetCode", "text", "off")}
              {field("newPassword", "password", "new-password", "passwordHelp")}
            </>
          ) : mode === "reauthenticate" ? (
            field("password", "password", "current-password")
          ) : step === "verify" && mode === "setup" ? (
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
              : mode === "recovery"
                ? t("requestReset")
                : mode === "reset"
                  ? t("resetPassword")
                  : mode === "reauthenticate"
                    ? t("confirmPassword")
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
      {mode === "sign-in" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              window.location.assign(await startOwnerGoogle(false));
            })
          }
        >
          {busy ? t("working") : t("googleSignIn")}
        </Button>
      )}
      {mode === "connections" && (
        <>
          <p>{t("googleHelp")}</p>
          {loading && <p role="status">{t("loading")}</p>}
          {connection && (
            <section aria-labelledby="google-heading" className="owner-form">
              <h2 id="google-heading">Google</h2>
              <p>
                {t(
                  connection.linked ? "googleConnected" : "googleNotConnected",
                )}
              </p>
              {!connection.enabled && <p>{t("googleUnavailable")}</p>}
              {!connection.linked && connection.enabled && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      window.location.assign(await startOwnerGoogle(true));
                    })
                  }
                >
                  {busy ? t("working") : t("googleLink")}
                </Button>
              )}
              {connection.linked &&
                (!confirmDisconnect ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmDisconnect(true)}
                    ref={disconnectRef}
                  >
                    {t("googleDisconnect")}
                  </Button>
                ) : (
                  <div className="owner-form">
                    <p>{t("googleDisconnectHelp")}</p>
                    <Button
                      ref={confirmRef}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await disconnectOwnerGoogle();
                          window.location.replace(
                            "/sign-in#google-disconnected",
                          );
                        })
                      }
                    >
                      {busy ? t("working") : t("googleConfirmDisconnect")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmDisconnect(false)}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                ))}
              <a href="/reauthenticate">{t("reauthenticateLink")}</a>
            </section>
          )}
          <p>
            <a href="/owner">{t("backToOwner")}</a>
          </p>
        </>
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
              <p>
                <a href="/connections">{t("connections")}</a>
              </p>
              <p>{t("probeHelp")}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await probeRecentOwner();
                    setNotice("recentAccepted");
                  })
                }
              >
                {t("checkRecent")}
              </Button>
              <p>
                <a href="/reauthenticate">{t("reauthenticateLink")}</a>
              </p>
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
        {mode === "sign-in" && (
          <p>
            <a href="/recovery">{t("forgotPassword")}</a>
          </p>
        )}
        {mode === "recovery" && (
          <p>
            <a href="/reset-password">{t("haveResetCode")}</a>
          </p>
        )}
        {mode === "reset" && (
          <p>
            <a href="/recovery">{t("requestAnotherReset")}</a>
          </p>
        )}
        {failure === "stale" && (
          <p>
            <a href="/reauthenticate">{t("reauthenticateLink")}</a>
          </p>
        )}
      </footer>
    </section>
  );
}
