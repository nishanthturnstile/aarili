import { documentMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withDocumentStatusHost } from "../../scripts/test-support/component-host.mjs";

test("0.4.4a I8 PDF status component states, bilingual reflow and explicit retry controls", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  await withDocumentStatusHost(async (origin) => {
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport,
    });
    try {
      for (const locale of ["en", "ta"])
        for (const theme of ["light", "dark"]) {
          const page = await context.newPage();
          await page.goto(origin);
          if (locale === "ta")
            await page.getByRole("button", { name: "English / தமிழ்" }).click();
          if (theme === "dark")
            await page
              .getByRole("button", { name: "Theme", exact: true })
              .click();
          const t = documentMessages[locale];
          for (const state of ["pending", "rendering", "failed", "ready"]) {
            await page.locator("#synthetic-pdf-state").selectOption(state);
            await expect(page.getByRole("status")).toHaveText(t[state]);
            if (state === "failed") {
              await expect(
                page.getByRole("button", { name: t.retry, exact: true }),
              ).toBeEnabled();
              await page
                .getByRole("button", { name: t.retry, exact: true })
                .click();
              await expect(page.getByRole("status")).toHaveText(t.pending);
              await expect(page.getByTestId("pdf-requests")).toHaveText("1");
              await page.locator("#synthetic-pdf-state").selectOption("failed");
            } else
              await expect(
                page.getByRole("button", { name: t.retry, exact: true }),
              ).toHaveCount(0);
          }
          await page
            .getByRole("button", { name: t.check, exact: true })
            .click();
          await expect(page.getByTestId("pdf-requests")).toHaveText("2");
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          for (const b of await page.getByRole("button").all()) {
            const box = await b.boundingBox();
            if (box) expect(box.height).toBeGreaterThanOrEqual(44);
          }
          await page.screenshot({
            path: `.scratch/pdf-status-${testInfo.project.name}-${locale}-${theme}.png`,
            fullPage: true,
          });
          await page.setViewportSize({ width: 320, height: 800 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (testInfo.project.name === "tablet") {
            await page.setViewportSize({ width: 1180, height: 820 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
          expect(
            await page.evaluate(() => ({
              local: localStorage.length,
              session: sessionStorage.length,
            })),
          ).toEqual({ local: 0, session: 0 });
          await page.close();
        }
    } finally {
      await context.close();
    }
  });
});
