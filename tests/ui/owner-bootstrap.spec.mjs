import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

// No traces of auth request headers/password fields, including synthetic canaries.
test.use({ trace: "off", screenshot: "off" });
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) await page.goto("about:blank");
});
const password = "synthetic-long-passphrase-12";
const longShopName =
  "ஆரிலி Aarili — திருமண ஆடைகள் மற்றும் தனிப்பயன் தையல் நிலையம் Bridal tailoring and alterations";
const names = {
  en: {
    setup: "Create your account",
    create: "Create account",
    resume: "Resume pending verification",
    verify: "Verify email",
    submit: "Sign in",
    shop: "Create shop and continue",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    name: "Owner name",
    shopName: "Shop name",
    token: "Setup ID",
    code: "Verification code",
  },
  ta: {
    setup: "உங்கள் கணக்கை உருவாக்கவும்",
    create: "கணக்கை உருவாக்கு",
    resume: "நிலுவை உறுதிப்படுத்தலைத் தொடர்",
    verify: "மின்னஞ்சலை உறுதிசெய்",
    submit: "உள்நுழை",
    shop: "கடையை உருவாக்கித் தொடரவும்",
    signOut: "வெளியேறு",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    name: "உரிமையாளர் பெயர்",
    shopName: "கடைப் பெயர்",
    token: "அமைப்பு அடையாளம்",
    code: "உறுதிப்படுத்தும் குறியீடு",
  },
};
for (const dark of [false, true])
  for (const locale of ["ta", "en"])
    test(`ACCESS-01/02/03/05/09/10/11 0.2.1a A8 USE-01/02/09 ${locale} ${dark ? "dark" : "light"} owner setup, recoverable error, verification, sign-in and shop; axe/keyboard/no browser storage`, async ({
      page,
      browser,
    }, testInfo) => {
      test.setTimeout(120000);
      await withOwnerWeb(
        async ({ origin, setupToken, code }) => {
          const labels = names[locale];
          if (locale === "ta" && !dark && testInfo.project.name === "phone") {
            const noScript = await browser.newContext({
              javaScriptEnabled: false,
            });
            try {
              const probe = await noScript.newPage();
              await probe.goto(`${origin}/setup`);
              await probe.locator("#name").fill("Synthetic no-script owner");
              await probe.locator("#email").fill("noscript@example.test");
              await probe
                .locator("#password")
                .fill("synthetic-noscript-passphrase");
              await probe
                .locator("#token")
                .fill("aarili-setup-client-probe-only");
              const posted = probe.waitForResponse(
                (r) =>
                  r.request().isNavigationRequest() &&
                  r.request().method() === "POST",
              );
              await probe.locator('form button[type="submit"]').click();
              await posted;
              expect(probe.url()).not.toContain(
                "aarili-setup-client-probe-only",
              );
              expect(probe.url()).not.toContain("password=");
            } finally {
              await noScript.close();
            }
          }
          async function language() {
            await prepareOwnerScreen(page, locale, dark);
          }
          async function axe() {
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
          await page.goto(`${origin}/setup`);
          await language();
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            labels.setup,
          );
          await page.screenshot({
            fullPage: true,
            path: `.scratch/design-cleanup/auth/captures/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}-setup.png`,
          });
          await page
            .getByLabel(labels.name, { exact: true })
            .fill("சோதனை உரிமையாளர்");
          await page
            .getByLabel(labels.email, { exact: true })
            .fill("owner@example.test");
          await page
            .getByLabel(labels.password, { exact: true })
            .fill(password);
          await expect(page.locator("#shopName")).toHaveCount(0);
          await page
            .getByLabel(labels.token, { exact: true })
            .fill("wrong-token");
          await page.getByLabel(labels.name, { exact: true }).fill("   ");
          await page
            .getByRole("button", { name: labels.create, exact: true })
            .click();
          await expect(
            page.getByLabel(labels.name, { exact: true }),
          ).toHaveAttribute("aria-invalid", "true");
          await expect(
            page.getByLabel(labels.name, { exact: true }),
          ).toBeFocused();
          await page
            .getByLabel(labels.name, { exact: true })
            .fill("சோதனை உரிமையாளர்");
          await page
            .getByRole("button", { name: labels.create, exact: true })
            .click();
          await expect(page.locator("main").getByRole("alert")).toBeVisible();
          await expect(page.locator("main").getByRole("alert")).toBeFocused();
          await expect(
            page.getByLabel(labels.email, { exact: true }),
          ).toHaveValue("owner@example.test");
          await axe();
          await page.getByLabel(labels.token, { exact: true }).fill(setupToken);
          await page
            .getByRole("button", { name: labels.create, exact: true })
            .click();
          await expect(
            page.getByLabel(labels.code, { exact: true }),
          ).toBeVisible();
          await axe();
          await page.screenshot({
            fullPage: true,
            path: `.scratch/design-cleanup/auth/captures/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}-verification.png`,
          });
          // Reload requires explicit continuation, never persisted credentials.
          await page.reload();
          await language();
          await expect(page.locator("#password")).toHaveValue("");
          await page
            .getByRole("button", {
              name:
                locale === "en"
                  ? "I have a verification code"
                  : "என்னிடம் உறுதிப்படுத்தும் குறியீடு உள்ளது",
              exact: true,
            })
            .click();
          await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
          await expect(
            page.getByLabel(labels.code, { exact: true }),
          ).toHaveValue("");
          await page.getByLabel(labels.code, { exact: true }).fill("invalid");
          await page
            .getByRole("button", { name: labels.verify, exact: true })
            .last()
            .click();
          await expect(page.locator("main").getByRole("alert")).toBeVisible();
          await page
            .getByLabel(labels.code, { exact: true })
            .fill(await code());
          await page
            .getByRole("button", {
              name:
                locale === "en" ? "Send another code" : "மீண்டும் குறியீடு அனுப்பு",
              exact: true,
            })
            .click();
          await page
            .getByLabel(labels.email, { exact: true })
            .fill("owner@example.test");
          await page
            .getByLabel(labels.password, { exact: true })
            .fill(password);
          await page.getByLabel(labels.token, { exact: true }).fill(setupToken);
          await page.locator('form button[type="submit"]').click();
          await expect(
            page.getByLabel(labels.code, { exact: true }),
          ).toBeVisible();
          await page
            .getByLabel(labels.code, { exact: true })
            .fill(await code());
          await page
            .getByRole("button", { name: labels.verify, exact: true })
            .last()
            .click();
          await expect(page.getByRole("status")).toBeVisible();
          await page.goto(`${origin}/sign-in`);
          await language();
          await page.screenshot({
            fullPage: true,
            path: `.scratch/design-cleanup/auth/captures/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}-sign-in.png`,
          });
          await page
            .getByLabel(labels.email, { exact: true })
            .fill("owner@example.test");
          await page
            .getByLabel(labels.password, { exact: true })
            .fill(password);
          await axe();
          await page.getByLabel(labels.email, { exact: true }).focus();
          await page.keyboard.press("Tab");
          await expect(
            page.getByLabel(labels.password, { exact: true }),
          ).toBeFocused();
          await page
            .getByRole("button", { name: labels.submit, exact: true })
            .click();
          await expect(page).toHaveURL(`${origin}/onboarding`);
          await language();
          await expect(page.locator("#shopName")).toBeVisible();
          await page.screenshot({
            fullPage: true,
            path: `.scratch/design-cleanup/auth/captures/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}-pending-shop.png`,
          });
          await page
            .getByLabel(labels.shopName, { exact: true })
            .fill(longShopName);
          let creationRequests = 0;
          const lostResponse = locale === "en" && !dark;
          if (lostResponse)
            await page.route("**/api/owner/complete", async (route) => {
              creationRequests++;
              await route.fetch();
              await route.abort("failed");
            });
          if (lostResponse)
            await page.locator("form").evaluate((form) => {
              form.requestSubmit();
              form.requestSubmit();
            });
          else
            await page
              .getByRole("button", { name: labels.shop, exact: true })
              .click();
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            longShopName,
          );
          if (lostResponse) expect(creationRequests).toBe(1);
          await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
          await axe();
          await page.reload();
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
          await language();
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            longShopName,
          );
          expect(
            await page.evaluate(() => ({
              local: localStorage.length,
              session: sessionStorage.length,
            })),
          ).toEqual({ local: dark ? 1 : 0, session: 0 });
          expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(
            dark ? ["aarili-appearance"] : [],
          );
          expect(page.url()).not.toContain(setupToken);
          await page.screenshot({
            path: `.scratch/design-cleanup/auth/captures/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}-complete.png`,
          });
          await page
            .getByRole("button", { name: labels.signOut, exact: true })
            .click();
          await expect(page).toHaveURL(`${origin}/sign-in`);
          expect(
            (await page.request.get(`${origin}/api/owner/shop`)).status(),
          ).toBe(401);
        },
        { onFailure: () => page.goto("about:blank"), secrets: [password] },
      );
    });
