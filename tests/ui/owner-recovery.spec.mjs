import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";

test.use({ trace: "off", screenshot: "off" });
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) await page.goto("about:blank");
});
const original = "synthetic-ui-old-password-13";
const replacement = "synthetic-ui-new-password-13";
const email = "owner@example.test";
const words = {
  en: {
    recover: "Recover your password",
    forgot: "Forgot your password?",
    request: "Request reset code",
    have: "I have a reset code",
    reset: "Update password",
    email: "Email",
    password: "Password",
    newPassword: "New password",
    code: "Password reset code",
    signIn: "Sign in",
    signOut: "Sign out",
    recent: "Check recent access",
    confirm: "Confirm recent access",
    confirmPassword: "Confirm password",
    expired: "Your session has ended. Sign in again to continue.",
  },
  ta: {
    recover: "கடவுச்சொல்லை மீட்டெடுக்கவும்",
    forgot: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
    request: "மீட்புக் குறியீட்டைக் கோரு",
    have: "என்னிடம் மீட்புக் குறியீடு உள்ளது",
    reset: "கடவுச்சொல்லை மாற்று",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    newPassword: "புதிய கடவுச்சொல்",
    code: "கடவுச்சொல் மீட்புக் குறியீடு",
    signIn: "உள்நுழை",
    signOut: "வெளியேறு",
    recent: "அண்மைய அணுகலைச் சரிபார்",
    confirm: "அண்மைய அணுகலை உறுதிசெய்",
    confirmPassword: "கடவுச்சொல்லை உறுதிசெய்",
    expired: "உங்கள் அமர்வு முடிந்தது. தொடர மீண்டும் உள்நுழையவும்.",
  },
};
for (const locale of ["ta", "en"])
  test(`0.2.1b B1/B3/B4/B5/B6 ${locale} recovery/reset/session expiry/reauthentication; keyboard, axe and no persistence`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await withOwnerWeb(
      async ({ origin, setupToken, code, runtime }) => {
        const w = words[locale];
        async function post(path, body, headers = {}) {
          return fetch(`${origin}/api${path}`, {
            method: "POST",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify(body),
          });
        }
        const admitted = await post(
          "/owner/setup",
          {
            name: "Synthetic recovery owner",
            email,
            password: original,
            shopName: "சோதனைக் கடை",
          },
          {
            "X-Setup-Token": setupToken,
            "Idempotency-Key": crypto.randomUUID(),
          },
        );
        expect(admitted.status).toBe(200);
        expect(
          (await post("/owner/verify", { code: await code() })).status,
        ).toBe(200);
        const signedIn = await post("/auth/sign-in/email", {
          email,
          password: original,
        });
        const cookie = signedIn.headers
          .getSetCookie()
          .map((s) => s.split(";")[0])
          .join("; ");
        expect(
          (await post("/owner/complete", {}, { Cookie: cookie })).status,
        ).toBe(200);
        const capturedSecrets = [setupToken, original, replacement];
        const thirdParty = [];
        page.on("request", (request) => {
          if (
            !request.url().startsWith(origin) &&
            !request.url().startsWith("data:")
          )
            thirdParty.push(request.url());
        });
        async function language() {
          if (
            locale === "en" &&
            (await page
              .getByRole("button", { name: "English", exact: true })
              .isVisible())
          )
            await page
              .getByRole("button", { name: "English", exact: true })
              .click();
        }
        async function axe() {
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
        async function capture(state) {
          // Only empty forms and cleared statuses, never secrets or entered fields.
          expect(
            await page
              .locator("input")
              .evaluateAll((inputs) =>
                inputs.every((input) => input.value === ""),
              ),
          ).toBe(true);
          const html = await page.content();
          expect(capturedSecrets.some((secret) => html.includes(secret))).toBe(
            false,
          );
          await page.screenshot({
            fullPage: true,
            path: `docs/agents/auth-recovery/captures/${info.project.name}-${locale}-${state}.png`,
          });
        }
        async function login(password) {
          await page.goto(`${origin}/sign-in`);
          await language();
          await page.getByLabel(w.email, { exact: true }).fill(email);
          await page.getByLabel(w.password, { exact: true }).fill(password);
          await page
            .getByRole("button", { name: w.signIn, exact: true })
            .click();
        }
        await page.goto(`${origin}/sign-in`);
        await language();
        await page.getByRole("link", { name: w.forgot, exact: true }).click();
        await language();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          w.recover,
        );
        await page.getByLabel(w.email, { exact: true }).focus();
        await page.keyboard.press("Tab");
        await expect(
          page.getByRole("button", { name: w.request, exact: true }),
        ).toBeFocused();
        await axe();
        await capture("recovery");
        await page.getByLabel(w.email, { exact: true }).fill(email);
        await page
          .getByRole("button", { name: w.request, exact: true })
          .click();
        await expect(page.locator("main").getByRole("status")).toBeFocused();
        await page.getByRole("link", { name: w.have, exact: true }).click();
        await language();
        await axe();
        await capture("reset");
        await page.getByLabel(w.code, { exact: true }).fill("A".repeat(24));
        await page.getByLabel(w.newPassword, { exact: true }).fill(replacement);
        await page.getByRole("button", { name: w.reset, exact: true }).click();
        await expect(page.locator("main").getByRole("alert")).toBeFocused();
        await axe();
        // Clear fields before approved error-state capture, then enter the real code.
        await page.getByLabel(w.newPassword, { exact: true }).fill("");
        await page.getByLabel(w.code, { exact: true }).fill("");
        await capture("reset-error");
        const resetToken = await code("reset");
        capturedSecrets.push(resetToken);
        await page.goto(
          `${origin}/reset-password#token=synthetic-transient-canary`,
        );
        await language();
        await expect(page).toHaveURL(`${origin}/reset-password`);
        await page.getByLabel(w.code, { exact: true }).fill(resetToken);
        await page.getByLabel(w.newPassword, { exact: true }).fill(replacement);
        await page.getByRole("button", { name: w.reset, exact: true }).click();
        await expect(page.locator("main").getByRole("status")).toBeFocused();
        await expect(page.getByLabel(w.code, { exact: true })).toBeEmpty();
        await axe();
        await capture("reset-complete");
        await login(original);
        await expect(page.locator("main").getByRole("alert")).toBeFocused();
        await page.getByLabel(w.password, { exact: true }).fill(replacement);
        await page.getByRole("button", { name: w.signIn, exact: true }).click();
        await expect(page).toHaveURL(`${origin}/owner`);
        await language();
        await expect(page.getByRole("heading", { level: 2 })).toHaveText(
          "சோதனைக் கடை",
        );
        await runtime.query(
          "update auth_session set created_at=now()-interval '10 minutes'",
        );
        await page.getByRole("button", { name: w.recent, exact: true }).click();
        await expect(page.locator("main").getByRole("alert")).toBeFocused();
        await axe();
        await page
          .getByRole("link", { name: w.confirm, exact: true })
          .first()
          .click();
        await language();
        await axe();
        await capture("reauthenticate");
        await page.getByLabel(w.password, { exact: true }).fill("incorrect");
        await page
          .getByRole("button", { name: w.confirmPassword, exact: true })
          .click();
        await expect(page.locator("main").getByRole("alert")).toBeFocused();
        await page.getByLabel(w.password, { exact: true }).fill(replacement);
        await page
          .getByRole("button", { name: w.confirmPassword, exact: true })
          .click();
        await expect(page).toHaveURL(`${origin}/owner`);
        await language();
        await page.getByRole("button", { name: w.recent, exact: true }).click();
        await expect(page.locator("main").getByRole("status")).toBeFocused();
        await runtime.query(
          "update auth_session set expires_at=now()-interval '1 second'",
        );
        await page.getByRole("button", { name: w.recent, exact: true }).click();
        await expect(page.locator("main").getByRole("alert")).toHaveText(
          w.expired,
        );
        await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
        await axe();
        await capture("session-expired");
        await login(replacement);
        await expect(page).toHaveURL(`${origin}/owner`);
        await language();
        await page
          .getByRole("button", { name: w.signOut, exact: true })
          .click();
        await expect(page).toHaveURL(`${origin}/sign-in`);
        await page.goto(`${origin}/owner`);
        await language();
        await expect(page.locator("main").getByRole("alert")).toHaveText(
          w.expired,
        );
        expect(
          await page.evaluate(async () => ({
            local: localStorage.length,
            session: sessionStorage.length,
            caches: await caches.keys(),
            workers: (await navigator.serviceWorker.getRegistrations()).length,
          })),
        ).toEqual({ local: 0, session: 0, caches: [], workers: 0 });
        expect(thirdParty.length).toBe(0);
      },
      {
        onFailure: () => page.goto("about:blank"),
        secrets: [original, replacement],
      },
    );
  });
test("0.2.1b B5 auth failure artifacts discard private assertion snapshots and redact secret canaries", async ({
  page,
}) => {
  test.setTimeout(120000);
  let canary = "";
  let caught;
  try {
    await withOwnerWeb(
      async ({ origin, setupToken }) => {
        canary = setupToken;
        await page.goto(`${origin}/reset-password`);
        await page.locator("#resetCode").fill(setupToken);
        const error = new Error(`Synthetic failure with ${setupToken}`);
        error.matcherResult = { ariaSnapshot: setupToken };
        throw error;
      },
      { onFailure: () => page.goto("about:blank") },
    );
  } catch (error) {
    caught = error;
  }
  expect(caught instanceof Error).toBe(true);
  expect(caught.message.includes(canary)).toBe(false);
  expect(caught.message.includes("[REDACTED]")).toBe(true);
  expect(caught.matcherResult).toBeUndefined();
  expect(page.url()).toBe("about:blank");
});
