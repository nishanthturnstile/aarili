import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";

// No traces of auth request headers/password fields, including synthetic canaries.
test.use({ trace: "off", screenshot: "off" });
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) await page.goto("about:blank");
});
const password = "synthetic-long-passphrase-12";
const names = {
  en: {
    setup: "Set up your owner account",
    create: "Create owner account",
    resume: "Resume pending verification",
    verify: "Verify email",
    submit: "Sign in",
    shop: "Create my shop",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    name: "Owner name",
    shopName: "Shop name",
    token: "Setup token",
    code: "Verification code",
  },
  ta: {
    setup: "உரிமையாளர் கணக்கை அமைக்கவும்",
    create: "உரிமையாளர் கணக்கை உருவாக்கு",
    resume: "நிலுவை உறுதிப்படுத்தலைத் தொடர்",
    verify: "மின்னஞ்சலை உறுதிசெய்",
    submit: "உள்நுழை",
    shop: "என் கடையை உருவாக்கு",
    signOut: "வெளியேறு",
    email: "மின்னஞ்சல்",
    password: "கடவுச்சொல்",
    name: "உரிமையாளர் பெயர்",
    shopName: "கடைப் பெயர்",
    token: "அமைப்புக் குறியீடு",
    code: "உறுதிப்படுத்தும் குறியீடு",
  },
};
for (const locale of ["ta", "en"])
  test(`0.2.1a A8 USE-01/02/09 ${locale} owner setup, recoverable error, verification, sign-in and shop; axe/keyboard/no browser storage`, async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(120000);
    await withOwnerWeb(async ({ origin, setupToken, code }) => {
      const labels = names[locale];
      if (locale === "ta" && testInfo.project.name === "phone") {
        const noScript = await browser.newContext({ javaScriptEnabled: false });
        try {
          const probe = await noScript.newPage();
          await probe.goto(`${origin}/setup`);
          await probe.locator("#name").fill("Synthetic no-script owner");
          await probe.locator("#email").fill("noscript@example.test");
          await probe
            .locator("#password")
            .fill("synthetic-noscript-passphrase");
          await probe.locator("#shopName").fill("Synthetic no-script shop");
          await probe.locator("#token").fill("aarili-setup-client-probe-only");
          const posted = probe.waitForResponse(
            (r) =>
              r.request().isNavigationRequest() &&
              r.request().method() === "POST",
          );
          await probe.locator('form button[type="submit"]').click();
          await posted;
          expect(probe.url()).not.toContain("aarili-setup-client-probe-only");
          expect(probe.url()).not.toContain("password=");
        } finally {
          await noScript.close();
        }
      }
      async function language() {
        if (locale === "en")
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
      await page.goto(`${origin}/setup`);
      await language();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        labels.setup,
      );
      await page.screenshot({
        fullPage: true,
        path: `docs/agents/auth/captures/${testInfo.project.name}-${locale}-setup.png`,
      });
      await page
        .getByLabel(labels.name, { exact: true })
        .fill("சோதனை உரிமையாளர்");
      await page
        .getByLabel(labels.email, { exact: true })
        .fill("owner@example.test");
      await page.getByLabel(labels.password, { exact: true }).fill(password);
      await page
        .getByLabel(labels.shopName, { exact: true })
        .fill("சோதனைக் கடை");
      await page.getByLabel(labels.token, { exact: true }).fill("wrong-token");
      await page.getByLabel(labels.name, { exact: true }).fill("   ");
      await page
        .getByRole("button", { name: labels.create, exact: true })
        .click();
      await expect(page.locator("main").getByRole("alert")).toHaveText(
        locale === "en"
          ? "Check the required fields and follow the hints, then try again."
          : "தேவையான புலங்களையும் குறிப்புகளையும் சரிபார்த்து மீண்டும் முயற்சி செய்யவும்.",
      );
      await page
        .getByLabel(labels.name, { exact: true })
        .fill("சோதனை உரிமையாளர்");
      await page
        .getByRole("button", { name: labels.create, exact: true })
        .click();
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      await expect(page.locator("main").getByRole("alert")).toBeFocused();
      await expect(page.getByLabel(labels.email, { exact: true })).toHaveValue(
        "owner@example.test",
      );
      await axe();
      await page.getByLabel(labels.token, { exact: true }).fill(setupToken);
      await page
        .getByRole("button", { name: labels.create, exact: true })
        .click();
      await expect(page.getByLabel(labels.code, { exact: true })).toBeVisible();
      await axe();
      await page.screenshot({
        fullPage: true,
        path: `docs/agents/auth/captures/${testInfo.project.name}-${locale}-verification.png`,
      });
      await page.getByLabel(labels.code, { exact: true }).fill("invalid");
      await page
        .getByRole("button", { name: labels.verify, exact: true })
        .last()
        .click();
      await expect(page.locator("main").getByRole("alert")).toBeVisible();
      await page.getByLabel(labels.code, { exact: true }).fill(await code());
      await page
        .getByRole("button", { name: labels.resume, exact: true })
        .click();
      await page
        .getByLabel(labels.email, { exact: true })
        .fill("owner@example.test");
      await page.getByLabel(labels.password, { exact: true }).fill(password);
      await page.getByLabel(labels.token, { exact: true }).fill(setupToken);
      await page.locator('form button[type="submit"]').click();
      await expect(page.getByLabel(labels.code, { exact: true })).toBeVisible();
      await page.getByLabel(labels.code, { exact: true }).fill(await code());
      await page
        .getByRole("button", { name: labels.verify, exact: true })
        .last()
        .click();
      await expect(page.getByRole("status")).toBeVisible();
      await page.goto(`${origin}/sign-in`);
      await language();
      await page.screenshot({
        fullPage: true,
        path: `docs/agents/auth/captures/${testInfo.project.name}-${locale}-sign-in.png`,
      });
      await page
        .getByLabel(labels.email, { exact: true })
        .fill("owner@example.test");
      await page.getByLabel(labels.password, { exact: true }).fill(password);
      await axe();
      await page.getByLabel(labels.email, { exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByLabel(labels.password, { exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: labels.submit, exact: true })
        .click();
      await expect(page).toHaveURL(`${origin}/owner`);
      await language();
      await page
        .getByRole("button", { name: labels.shop, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        "சோதனைக் கடை",
      );
      await axe();
      await page.reload();
      await language();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        "சோதனைக் கடை",
      );
      expect(
        await page.evaluate(() => ({
          local: localStorage.length,
          session: sessionStorage.length,
        })),
      ).toEqual({ local: 0, session: 0 });
      expect(page.url()).not.toContain(setupToken);
      await page.screenshot({
        path: `docs/agents/auth/captures/${testInfo.project.name}-${locale}-complete.png`,
      });
      await page
        .getByRole("button", { name: labels.signOut, exact: true })
        .click();
      await expect(page).toHaveURL(`${origin}/sign-in`);
      expect(
        (await page.request.get(`${origin}/api/owner/shop`)).status(),
      ).toBe(401);
    });
  });
