import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  googleTransportServer,
  syntheticGoogle,
} from "../../scripts/test-support/google-provider.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { setOwnerLanguage } from "./owner-language.mjs";

test.use({ trace: "off", screenshot: "off" });
const password = "synthetic-ui-google-password-14";
const captureRoot =
  process.env.AARILI_OWNER_UI_TRIAL === "true"
    ? "docs/agents/design-trial"
    : "docs/agents";
const words = {
  en: {
    signIn: "Sign in",
    googleSignIn: "Sign in with Google",
    email: "Email",
    password: "Password",
    open: "Create my shop",
    connections: "Sign-in connections",
    link: "Link Google account",
    connected: "Google is connected.",
    disconnected:
      "Google disconnected. Email and password sign-in remain available.",
    disconnect: "Disconnect Google",
    confirm: "Confirm disconnect",
    cancel: "Cancel",
    reauth: "Confirm recent access",
    confirmPassword: "Confirm password",
  },
  ta: {
    signIn: "உள்நுழை",
    googleSignIn: "Google மூலம் உள்நுழை",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    open: "என் கடையை உருவாக்கு",
    connections: "உள்நுழைவு இணைப்புகள்",
    link: "Google கணக்கை இணை",
    connected: "Google இணைக்கப்பட்டுள்ளது.",
    disconnected:
      "Google இணைப்பு நீக்கப்பட்டது. மின்னஞ்சல், கடவுச்சொல் உள்நுழைவு தொடர்ந்து பயன்படும்.",
    disconnect: "Google இணைப்பை நீக்கு",
    confirm: "நீக்குவதை உறுதிசெய்",
    cancel: "ரத்து செய்",
    reauth: "அண்மைய அணுகலை உறுதிசெய்",
    confirmPassword: "கடவுச்சொல்லை உறுதிசெய்",
  },
};
for (const locale of ["ta", "en"])
  test(`0.2.1c C1/C3/C5/C6/C7 USE-01/02/09 ${locale} Google rejection/link/sign-in/disconnect: real callbacks, keyboard/focus/axe and private captures`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const provider = syntheticGoogle();
    const transport = await googleTransportServer(provider);
    let nextProfile = {};
    const privateValues = [password, "synthetic-google-secret-14"];
    try {
      await withOwnerWeb(
        async ({ origin, setupToken, code, runtime }) => {
          const w = words[locale];
          const callbackDiagnostics = [];
          page.on("request", async (request) => {
            if (
              new URL(request.url()).pathname === "/api/auth/callback/google"
            ) {
              const headers = await request.allHeaders();
              callbackDiagnostics.push({
                origin: headers.origin ?? "absent",
                method: request.method(),
                cookies: (headers.cookie ?? "")
                  .split(";")
                  .map((s) => s.trim().split("=")[0]),
              });
            }
          });
          privateValues.push(setupToken);
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
          expect(
            (
              await post(
                "/owner/setup",
                {
                  name: "Synthetic Google owner",
                  email: "owner@example.test",
                  password,
                  shopName: "சோதனைக் கடை",
                },
                {
                  "X-Setup-Token": setupToken,
                  "Idempotency-Key": crypto.randomUUID(),
                },
              )
            ).status,
          ).toBe(200);
          const verificationCode = await code();
          privateValues.push(verificationCode);
          expect(
            (await post("/owner/verify", { code: verificationCode })).status,
          ).toBe(200);
          await page.route("https://accounts.google.com/**", async (route) => {
            const callback = provider.issue(route.request().url(), nextProfile);
            privateValues.push(
              ...provider.tokens,
              new URL(callback).searchParams.get("code"),
            );
            nextProfile = {};
            await route.fulfill({
              status: 302,
              headers: { Location: callback },
            });
          });
          async function language() {
            await setOwnerLanguage(page, locale);
          }
          async function googleReturn(path, activate) {
            // OAuth can return to the same URL. An alert/focus assertion or
            // waitForURL(path) can otherwise match the outgoing document and
            // switch its language just before the callback replaces it.
            const returned = page.waitForEvent("framenavigated", {
              predicate: (frame) => {
                if (frame !== page.mainFrame()) return false;
                const url = new URL(frame.url());
                return url.origin === origin && url.pathname === path;
              },
            });
            await activate();
            await returned;
            await page.waitForLoadState("domcontentloaded");
          }
          async function capture(name) {
            await expect(page.locator("main[lang]")).toHaveAttribute(
              "lang",
              locale,
            );
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            expect(
              await page.evaluate(() => [
                localStorage.length,
                sessionStorage.length,
              ]),
            ).toEqual([0, 0]);
            expect(await page.evaluate(() => caches.keys())).toEqual([]);
            expect(
              await page.evaluate(() =>
                navigator.serviceWorker
                  .getRegistrations()
                  .then((r) => r.length),
              ),
            ).toBe(0);
            for (const value of privateValues)
              expect((await page.content()).includes(value)).toBe(false);
            await page.screenshot({
              path: `${captureRoot}/auth-google/captures/${info.project.name}-${locale}-${name}.png`,
              fullPage: true,
            });
          }
          async function passwordSignIn() {
            await language();
            await page
              .getByLabel(w.email, { exact: true })
              .fill("owner@example.test");
            await page.getByLabel(w.password, { exact: true }).fill(password);
            await page
              .getByRole("button", { name: w.signIn, exact: true })
              .click();
            await page.waitForURL(`${origin}/owner`);
            await language();
          }
          await page.goto(`${origin}/sign-in`);
          await language();
          const googleButton = page.getByRole("button", {
            name: w.googleSignIn,
            exact: true,
          });
          await googleButton.focus();
          await googleReturn("/sign-in", () => page.keyboard.press("Enter"));
          await expect(
            page.locator('p[role="alert"][tabindex="-1"]'),
          ).toBeFocused();
          expect(new URL(page.url()).search).toBe("");
          await language();
          await capture("sign-in-denied");
          await passwordSignIn();
          await page.getByRole("button", { name: w.open, exact: true }).click();
          await page
            .getByRole("link", { name: w.connections, exact: true })
            .click();
          await page.waitForURL(`${origin}/connections`);
          await language();
          await expect(
            page.getByRole("button", { name: w.link, exact: true }),
          ).toBeVisible();
          await capture("connection");
          await runtime.query(
            "update auth_session set created_at=now()-interval '6 minutes'",
          );
          await page.getByRole("button", { name: w.link, exact: true }).click();
          await expect(
            page.locator('p[role="alert"][tabindex="-1"]'),
          ).toBeFocused();
          await capture("stale");
          await page
            .getByRole("link", { name: w.reauth, exact: true })
            .first()
            .click();
          await page.waitForURL(`${origin}/reauthenticate`);
          await language();
          await page.getByLabel(w.password, { exact: true }).fill(password);
          await page
            .getByRole("button", { name: w.confirmPassword, exact: true })
            .click();
          await page.waitForURL(`${origin}/owner`);
          await language();
          await page
            .getByRole("link", { name: w.connections, exact: true })
            .click();
          await page.waitForURL(`${origin}/connections`);
          await language();
          nextProfile = { email_verified: false };
          await googleReturn("/connections", () =>
            page.getByRole("button", { name: w.link, exact: true }).click(),
          );
          await expect(
            page.locator('p[role="alert"][tabindex="-1"]'),
          ).toBeFocused();
          await language();
          await capture("link-denied");
          expect(
            new URL(page.url()).pathname,
            JSON.stringify({
              provider: provider.diagnostics,
              callback: callbackDiagnostics,
            }),
          ).toBe("/connections");
          const link = page.getByRole("button", { name: w.link, exact: true });
          await link.focus();
          await googleReturn("/connections", () =>
            page.keyboard.press("Enter"),
          );
          await expect(
            page.locator('p[role="status"][tabindex="-1"]'),
          ).toBeFocused();
          await language();
          await expect(
            page.getByText(w.connected, { exact: true }),
          ).toBeVisible();
          await capture("linked");
          await page.goto(`${origin}/sign-in`);
          await language();
          await googleReturn("/owner", () =>
            page
              .getByRole("button", { name: w.googleSignIn, exact: true })
              .click(),
          );
          await page.waitForURL(`${origin}/owner`);
          await language();
          await expect(
            page.getByRole("heading", { name: "சோதனைக் கடை" }),
          ).toBeVisible();
          await capture("google-signed-in");
          await page
            .getByRole("link", { name: w.connections, exact: true })
            .click();
          await page.waitForURL(`${origin}/connections`);
          await language();
          await page
            .getByRole("button", { name: w.disconnect, exact: true })
            .click();
          await page
            .getByRole("button", { name: w.cancel, exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: w.disconnect, exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: w.disconnect, exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: w.confirm, exact: true }),
          ).toBeFocused();
          await capture("disconnect-review");
          await page
            .getByRole("button", { name: w.confirm, exact: true })
            .click();
          await expect(
            page.locator('p[role="status"][tabindex="-1"]'),
          ).toBeFocused();
          await language();
          await expect(
            page.locator('p[role="status"][tabindex="-1"]'),
          ).toHaveText(w.disconnected);
          await capture("disconnected");
          expect(
            (await runtime.query("select count(*)::int as n from auth_session"))
              .rows[0].n,
          ).toBe(0);
          await googleReturn("/sign-in", () =>
            page
              .getByRole("button", { name: w.googleSignIn, exact: true })
              .click(),
          );
          await expect(
            page.locator('p[role="alert"][tabindex="-1"]'),
          ).toBeFocused();
          await passwordSignIn();
          await expect(
            page.getByRole("heading", { name: "சோதனைக் கடை" }),
          ).toBeVisible();
          expect(
            (
              await runtime.query(
                "select access_token, refresh_token, id_token from auth_account where provider_id='google'",
              )
            ).rowCount,
          ).toBe(0);
          expect(
            (
              await runtime.query(
                "select count(*)::int as n from auth_connection_event",
              )
            ).rows[0].n,
          ).toBe(2);
        },
        {
          google: transport,
          secrets: privateValues,
          onFailure: async () => {
            await page.goto("about:blank");
          },
        },
      );
    } finally {
      await transport.close();
      await page.goto("about:blank");
    }
  });
