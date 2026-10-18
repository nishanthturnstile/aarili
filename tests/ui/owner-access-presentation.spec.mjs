import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off" });
for (const locale of ["en", "ta"])
  for (const dark of [false, true])
    test(`ACCESS-03/09/10/11 ${locale} ${dark ? "dark" : "light"} all access surfaces, focus, reflow and private inputs`, async ({
      page,
    }, info) => {
      for (const route of [
        "setup",
        "sign-in",
        "recovery",
        "reset-password",
        "reauthenticate",
      ]) {
        await page.goto(`/${route}`);
        await prepareOwnerScreen(page, locale, dark);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(
          page.getByRole("navigation", {
            name: locale === "en" ? "Shop navigation" : "கடை வழிசெலுத்தல்",
          }),
        ).toHaveCount(0);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.evaluate(async () => {
          await document.fonts.ready;
          window.scrollTo(0, 0);
        });
        expect(
          (await page.locator("header").boundingBox()).y,
        ).toBeGreaterThanOrEqual(0);
        await page.screenshot({
          fullPage: true,
          path: `.scratch/access-review/captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}-${route}.png`,
        });
        for (const width of [320, 390, 768, 1024, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${route} ${width}`,
          ).toBe(true);
        }
        await page.setViewportSize(info.project.use.viewport);
      }
      // A visibility toggle neither submits nor stores a password. Changing the
      // language preserves it on screen and does not put it in the URL/storage.
      const password = page.locator("#password");
      await password.fill("synthetic-visibility-only");
      await page
        .getByRole("button", {
          name: locale === "en" ? "Show" : "காட்டு",
          exact: true,
        })
        .click();
      await expect(password).toHaveAttribute("type", "text");
      await page
        .getByRole("button", {
          name: locale === "en" ? "தமிழ்" : "English",
          exact: true,
        })
        .click();
      await expect(password).toHaveValue("synthetic-visibility-only");
      await password.fill("");
      expect(
        await page.evaluate(
          () =>
            Object.keys(localStorage).every(
              (key) => key === "aarili-appearance",
            ) && sessionStorage.length === 0,
        ),
      ).toBe(true);
      await page.goto("/setup");
      await prepareOwnerScreen(page, locale, dark);
      await page.locator('form button[type="submit"]').click();
      await expect(page.locator("#name")).toBeFocused();
      await expect(page.locator("#name")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.goto("about:blank");
    });
