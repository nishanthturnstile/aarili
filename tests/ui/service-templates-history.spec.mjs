import { mkdir } from "node:fs/promises";
import { serviceTemplatesMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceTemplates } from "../../scripts/test-support/seed-service-templates.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test("ST-07/11 bilingual exact history accessibility and reflow", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  const password = "synthetic-template-history-owner-password";
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC history owner",
              email: "history@example.test",
              password,
            },
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
        (
          await post("/auth/sign-in/email", {
            email: "history@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC history shop" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const seeded = await seedServiceTemplates(runtime, shopId);
      try {
        await page.goto(`${origin}/settings?section=serviceTemplates`);
        const en = serviceTemplatesMessages.en;
        await page
          .locator(".directory-list > li")
          .filter({
            has: page.getByRole("heading", {
              name: "SYNTHETIC before-craft",
              exact: true,
            }),
          })
          .getByRole("button", { name: en.detail, exact: true })
          .click();
        await page
          .getByRole("button", { name: en.history, exact: true })
          .click();
        const history = page.locator(".shop-profile-history");
        await history.locator("summary").click();
        for (const locale of ["en", "ta"]) {
          await prepareOwnerScreen(page, locale);
          const t = serviceTemplatesMessages[locale];
          await history
            .getByRole("button", { name: t.preview, exact: true })
            .click();
          await expect(history).toContainText(
            `template:${seeded.before.definition.id}`,
          );
          await expect(history).toContainText(seeded.form.definition.id);
          await expect(history).toContainText("SYNTHETIC selected piece");
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await page.addStyleTag({
            content: "html { font-size: 200% !important; }",
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await page
            .locator("style")
            .filter({ hasText: "font-size: 200% !important" })
            .evaluateAll((nodes) => {
              for (const n of nodes) n.remove();
            });
          await mkdir(".scratch/service-templates-history-captures", {
            recursive: true,
          });
          await page.screenshot({
            path: `.scratch/service-templates-history-captures/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
        }
      } finally {
        await seeded.close();
      }
    },
    { secrets: [password] },
  );
});
