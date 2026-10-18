import {
  ownerSession,
  reauthenticateOwner,
  requestOwnerRecovery,
  resendOwnerVerification,
  resetOwnerPassword,
  setupOwner,
  startOwnerGoogle,
  verifyOwner,
} from "@aarili/api/client";
import {
  reauthenticationSchema,
  recoveryRequestSchema,
  recoveryResetSchema,
  resendCommandSchema,
  setupCommandSchema,
  signInCommandSchema,
  verificationCommandSchema,
} from "@aarili/contracts";
import { Button } from "@aarili/ui/components/button";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  OwnerFeedback,
  type OwnerGuard,
  useOwnerRequest,
} from "./owner-feedback";
import { focusInvalid, OwnerField, validationErrors } from "./owner-fields";

export type AccessMode =
  | "setup"
  | "sign-in"
  | "recovery"
  | "reset"
  | "reauthenticate";
export function OwnerAccess({
  mode,
  guard,
}: {
  mode: AccessMode;
  guard: OwnerGuard;
}) {
  const t = useTranslations();
  const request = useOwnerRequest(guard);
  const [step, setStep] = useState<"initial" | "resume" | "verify">("initial");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const admission = useRef({ payload: "", key: "" });
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step && !request.notice)
      heading.current?.focus();
    previousStep.current = step;
  }, [step, request.notice]);
  useEffect(() => {
    const result = window.location.hash;
    if (mode === "sign-in" && result === "#google-denied")
      request.setFailure("googleDenied");
    if (mode === "sign-in" && result === "#google-disconnected")
      request.setNotice("googleDisconnected");
    window.history.replaceState(null, "", window.location.pathname);
    if (mode !== "reset" && mode !== "recovery") return;
    const strip = () =>
      window.history.replaceState(null, "", window.location.pathname);
    window.addEventListener("hashchange", strip);
    window.addEventListener("popstate", strip);
    return () => {
      window.removeEventListener("hashchange", strip);
      window.removeEventListener("popstate", strip);
    };
  }, [mode, request.setFailure, request.setNotice]);
  const success =
    request.notice === "verified" || request.notice === "passwordReset";
  const recovered = request.notice === "recoveryRequested";
  const title = success
    ? request.notice === "verified"
      ? "verifiedTitle"
      : "resetCompleteTitle"
    : recovered
      ? "recoveryCompleteTitle"
      : mode === "setup"
        ? step === "verify"
          ? "verification"
          : step === "resume"
            ? "resume"
            : "setup"
        : mode === "sign-in"
          ? "signIn"
          : mode;
  function changeStep(next: typeof step) {
    setStep(next);
    setErrors({});
    request.setFailure("");
    request.setNotice("");
    request.cleared();
    // No password or request hash survives leaving the admission form.
    admission.current = { payload: "", key: "" };
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (id: string) => String(data.get(id) ?? "");
    const body =
      mode === "recovery"
        ? { email: value("email") }
        : mode === "reset"
          ? { token: value("resetCode"), newPassword: value("newPassword") }
          : mode === "reauthenticate"
            ? { password: value("password") }
            : mode === "setup" && step === "verify"
              ? { code: value("code") }
              : mode === "setup" && step === "initial"
                ? {
                    name: value("name"),
                    email: value("email"),
                    password: value("password"),
                  }
                : { email: value("email"), password: value("password") };
    const schema =
      mode === "recovery"
        ? recoveryRequestSchema
        : mode === "reset"
          ? recoveryResetSchema
          : mode === "reauthenticate"
            ? reauthenticationSchema
            : mode === "sign-in"
              ? signInCommandSchema
              : step === "verify"
                ? verificationCommandSchema
                : step === "resume"
                  ? resendCommandSchema
                  : setupCommandSchema;
    const parsed = schema.safeParse(body);
    const invalid = parsed.success
      ? {}
      : validationErrors(
          parsed.error.issues.map((issue) => ({
            path: issue.path[0] === "token" ? ["resetCode"] : issue.path,
          })),
        );
    if (mode === "setup" && step !== "verify" && !value("token"))
      invalid.token = "tokenHelp";
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      focusInvalid(form, invalid);
      return;
    }
    void request.run(async () => {
      if (mode === "recovery") {
        await requestOwnerRecovery(value("email"));
        form.reset();
        request.setNotice("recoveryRequested");
        return;
      }
      if (mode === "reset") {
        await resetOwnerPassword({
          token: value("resetCode"),
          newPassword: value("newPassword"),
        });
        form.reset();
        request.setNotice("passwordReset");
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
        request.setNotice("verified");
        return;
      }
      if (step === "resume")
        await resendOwnerVerification(
          { email: value("email"), password: value("password") },
          value("token"),
        );
      else {
        const input = setupCommandSchema.parse(body);
        const payload = JSON.stringify(input);
        if (payload !== admission.current.payload)
          admission.current = { payload, key: crypto.randomUUID() };
        await setupOwner(input, value("token"), admission.current.key);
      }
      form.reset();
      admission.current = { payload: "", key: "" };
      setStep("verify");
      request.setNotice("delivered");
    });
  }
  return (
    <section className="owner-content access-content entry-auth">
      <div className="access-introduction">
        <h1 ref={heading} id="owner-content" tabIndex={-1}>
          {t(title)}
        </h1>
        <p>
          {t(
            success
              ? request.notice === "verified"
                ? "verifiedHelp"
                : "resetCompleteHelp"
              : recovered
                ? "recoveryCompleteHelp"
                : mode === "setup"
                  ? step === "verify"
                    ? "verificationHelp"
                    : step === "resume"
                      ? "resumeHelp"
                      : "intro"
                  : mode === "sign-in"
                    ? "signInHelp"
                    : `${mode}Help`,
          )}
        </p>
      </div>
      <OwnerFeedback request={request} />
      {success ? (
        <a className="access-primary-link" href="/sign-in">
          {t("continueSignIn")}
        </a>
      ) : recovered ? (
        <a className="access-primary-link" href="/reset-password">
          {t("haveResetCode")}
        </a>
      ) : (
        <>
          <form
            key={`${mode}-${step}`}
            method="post"
            noValidate
            className="owner-form access-form"
            onSubmit={submit}
            onInput={(event) => {
              request.changed();
              request.setFailure("");
              const id = (event.target as HTMLInputElement).name;
              setErrors((old) => {
                const next = { ...old };
                delete next[id];
                return next;
              });
            }}
            onReset={request.cleared}
          >
            {mode === "reset" ? (
              <>
                <OwnerField id="resetCode" error={errors.resetCode} />
                <OwnerField
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  hint="passwordHelp"
                  error={errors.newPassword}
                />
              </>
            ) : mode === "reauthenticate" ? (
              <OwnerField
                id="password"
                type="password"
                autoComplete="current-password"
                error={errors.password}
              />
            ) : mode === "setup" && step === "verify" ? (
              <OwnerField id="code" error={errors.code} />
            ) : (
              <>
                {mode === "setup" && step === "initial" && (
                  <OwnerField
                    id="name"
                    autoComplete="name"
                    error={errors.name}
                  />
                )}
                <OwnerField
                  id="email"
                  type="email"
                  autoComplete="username"
                  error={errors.email}
                />
                {mode !== "recovery" && (
                  <OwnerField
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "setup" && step === "initial"
                        ? "new-password"
                        : "current-password"
                    }
                    hint={
                      mode === "setup" && step === "initial"
                        ? "passwordHelp"
                        : undefined
                    }
                    error={errors.password}
                  />
                )}
                {mode === "setup" && (
                  <OwnerField
                    id="token"
                    type="password"
                    hint="tokenHelp"
                    error={errors.token}
                  />
                )}
              </>
            )}
            {mode === "sign-in" && (
              <a className="access-forgot" href="/recovery">
                {t("forgotPassword")}
              </a>
            )}
            <Button type="submit" disabled={request.busy}>
              {t(
                request.busy
                  ? "working"
                  : mode === "recovery"
                    ? "requestReset"
                    : mode === "reset"
                      ? "resetPassword"
                      : mode === "reauthenticate"
                        ? "confirmPassword"
                        : mode === "sign-in"
                          ? "submit"
                          : step === "verify"
                            ? "verify"
                            : step === "resume"
                              ? "resend"
                              : "create",
              )}
            </Button>
          </form>
          {mode === "sign-in" && (
            <div className="access-provider">
              <div className="access-divider">
                <span>{t("or")}</span>
              </div>
              <Button
                variant="outline"
                disabled={request.busy}
                onClick={() =>
                  void request.run(async () => {
                    window.location.assign(await startOwnerGoogle(false));
                  })
                }
              >
                {t(request.busy ? "working" : "googleSignIn")}
              </Button>
              <p className="access-help">{t("googleEligibility")}</p>
            </div>
          )}
        </>
      )}
      <footer className="owner-footer access-footer">
        {mode === "setup" && !success && (
          <>
            {step !== "verify" && (
              <Button
                variant="ghost"
                disabled={request.busy}
                onClick={() => changeStep("verify")}
              >
                {t("haveVerificationCode")}
              </Button>
            )}
            {step !== "resume" && (
              <Button
                variant="ghost"
                disabled={request.busy}
                onClick={() => changeStep("resume")}
              >
                {t(step === "verify" ? "sendAnotherCode" : "resume")}
              </Button>
            )}
            {step !== "initial" && (
              <Button
                variant="ghost"
                disabled={request.busy}
                onClick={() => changeStep("initial")}
              >
                {t("initial")}
              </Button>
            )}
          </>
        )}
        {mode === "sign-in" ? (
          <>
            <p>{t("restrictedSetup")}</p>
            <a href="/setup">{t("setupLink")}</a>
          </>
        ) : (
          !success && <a href="/sign-in">{t("back")}</a>
        )}
        {mode === "recovery" && !recovered && (
          <a
            className={request.notice ? "access-primary-link" : undefined}
            href="/reset-password"
          >
            {t("haveResetCode")}
          </a>
        )}
        {mode === "reset" && !success && (
          <a href="/recovery">{t("requestAnotherReset")}</a>
        )}
      </footer>
    </section>
  );
}
