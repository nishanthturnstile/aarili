import { mkdir } from "node:fs/promises";
import {
  shopCalendarMessages,
  shopDirectoryMessages,
  shopPoliciesMessages,
  shopSettingsMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off" });
test("SS-03/04/07/10 combined Settings navigation preserves all sections and local draft routing", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      const email = "settings-integration@example.test";
      const password = "synthetic-settings-integration-password";
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      expect(
        (
          await post(
            "/owner/setup",
            { name: "Synthetic integration owner", email, password },
            {
              "X-Setup-Token": setupToken,
              "Idempotency-Key": crypto.randomUUID(),
            },
          )
        ).status(),
      ).toBe(200);
      expect(
        (await post("/owner/verify", { code: await code() })).status(),
      ).toBe(200);
      expect(
        (await post("/auth/sign-in/email", { email, password })).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "Synthetic combined settings" },
            {
              "Idempotency-Key": crypto.randomUUID(),
            },
          )
        ).status(),
      ).toBe(200);
      await page.goto(`${origin}/settings`);
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const settings = page.getByRole("navigation", {
          name: shopSettingsMessages[locale].title,
          exact: true,
        });
        for (const [section, name] of [
          ["profile", shopSettingsMessages[locale].profile],
          ["calendar", shopCalendarMessages[locale].title],
          ["directory", shopDirectoryMessages[locale].title],
          ["policies", shopPoliciesMessages[locale].title],
        ]) {
          await settings.getByRole("button", { name, exact: true }).click();
          await expect(
            settings.getByRole("button", { name, exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
          await expect
            .poll(() => new URL(page.url()).searchParams.get("section"))
            .toBe(section);
          await page.reload();
          // Locale is intentionally in owner memory, so select it again after reload.
          await prepareOwnerScreen(page, locale);
          await expect(
            page
              .getByRole("navigation", {
                name: shopSettingsMessages[locale].title,
                exact: true,
              })
              .getByRole("button", { name, exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
        }
        await expect(
          page.getByRole("heading", {
            name: shopPoliciesMessages[locale].title,
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator("main")).toHaveAttribute(
          "data-owner-ready",
          "true",
        );
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await mkdir(".scratch/integration-captures", { recursive: true });
        await page.screenshot({
          path: `.scratch/integration-captures/${info.project.name}-${locale}.png`,
        });
      }
    },
    { secrets: ["synthetic-settings-integration-password"] },
  );
});
