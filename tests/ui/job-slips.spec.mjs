import { mkdir } from "node:fs/promises";
import { jobSlipMessages, sharingMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withJobSlipBrowserHost } from "../../scripts/test-support/job-slip-browser.mjs";

test("JS-A01/02/08/09/10 exact source issue, uncertain replay, stored preview, deliberate sharing and private clearing in English/Tamil", async ({
  browser,
}, info) => {
  test.setTimeout(420000);
  await withJobSlipBrowserHost(async (f) => {
    const context = await browser.newContext({
      viewport: info.project.use.viewport,
    });
    await context.addCookies(
      f.cookie.split("; ").map((v) => {
        const i = v.indexOf("=");
        return {
          name: v.slice(0, i),
          value: v.slice(i + 1),
          url: f.origin,
          httpOnly: true,
        };
      }),
    );
    await context.addInitScript(() => {
      window.__slipShare = [];
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: ({ files }) => {
          window.__slipShare.push({
            active: navigator.userActivation.isActive,
            type: files[0].type,
            size: files[0].size,
          });
          return Promise.reject(
            new DOMException("Synthetic cancel", "AbortError"),
          );
        },
      });
    });
    await mkdir(".scratch/job-slip-captures", { recursive: true });
    try {
      for (const locale of ["en", "ta"]) {
        const page = await context.newPage(),
          t = jobSlipMessages[locale],
          s = sharingMessages[locale],
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        let fileReads = 0;
        page.on("request", (r) => {
          if (r.url().endsWith("/file")) fileReads++;
        });
        await page.goto(f.origin);
        if (locale === "ta") {
          await page
            .getByRole("button", { name: "English / தமிழ்", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Theme", exact: true })
            .click();
        }
        await page.getByRole("button", { name: t.open, exact: true }).click();
        const region = page.getByRole("region", { name: t.title, exact: true });
        await region
          .getByLabel(t.scope, { exact: true })
          .selectOption(f.pieceId);
        await region
          .getByRole("button", { name: t.review, exact: true })
          .click();
        await expect(
          region.getByText(t.sourceReview, { exact: true }),
        ).toBeVisible();
        expect(fileReads).toBe(0);
        await expect(region).not.toContainText("PRIVATE-FITTING-SENTINEL-169");
        await region
          .getByLabel(t.language, { exact: true })
          .selectOption(locale);
        await region
          .getByLabel(t.reason, { exact: true })
          .fill("SYNTHETIC browser source review");
        await region.getByLabel(t.acknowledgement, { exact: true }).check();
        if (locale === "ta") await f.sourceChange();
        let lose = locale === "en";
        await page.route("**/job-slips", async (route) => {
          const response = await route.fetch();
          if (lose) {
            lose = false;
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: '{"error":{"code":"SYNTHETIC_LOST_REPLY","message":"Synthetic lost reply"}}',
            });
          } else await route.fulfill({ response });
        });
        await region
          .getByRole("button", {
            name: locale === "en" ? t.create : t.revise,
            exact: true,
          })
          .click();
        if (locale === "en") {
          await expect(
            region.getByText(t.checking, { exact: true }),
          ).toBeVisible();
          await expect(
            region.getByRole("button", { name: t.review, exact: true }),
          ).toBeDisabled();
          await region
            .getByRole("button", { name: t.reconcile, exact: true })
            .click();
        }
        if (locale === "ta") {
          await expect(
            region.getByText(t.stale, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.review, exact: true })
            .click();
          await expect(
            region.getByRole("heading", {
              name: t.changedSources,
              exact: true,
            }),
          ).toBeVisible();
          await region.getByLabel(t.acknowledgement, { exact: true }).check();
          await region
            .getByRole("button", { name: t.revise, exact: true })
            .click();
        }
        await expect(
          region.getByLabel(t.audience, { exact: true }),
        ).toBeVisible();
        await region
          .getByLabel(t.audience, { exact: true })
          .selectOption("production");
        await expect(
          region.getByRole("button", { name: s.share, exact: true }),
        ).toHaveCount(0);
        await expect(async () => {
          await region
            .getByRole("button", { name: s.prepare, exact: true })
            .click();
          await expect(region.getByText(s.ready, { exact: true })).toBeVisible({
            timeout: 1500,
          });
        }).toPass({ timeout: 30000, intervals: [1000] });
        await expect(page.getByTestId("pdf-preview")).toBeVisible();
        await region.getByLabel(s.reviewPrivate, { exact: true }).check();
        await region
          .getByRole("button", { name: s.share, exact: true })
          .click();
        await expect(
          region.getByText(s.cancelled, { exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => window.__slipShare)).toEqual([
          { active: true, type: "application/pdf", size: expect.any(Number) },
        ]);
        const download = page.waitForEvent("download");
        await region
          .getByRole("button", { name: s.download, exact: true })
          .click();
        expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path: `.scratch/job-slip-captures/${info.project.name}-${locale}.png`,
          fullPage: true,
        });
        await region
          .getByLabel(t.audience, { exact: true })
          .selectOption("print-shop");
        await expect(
          region.getByText(t.printShopHelp, { exact: true }),
        ).toBeVisible();
        await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
        await page
          .getByRole("button", { name: "End access", exact: true })
          .click();
        await expect(
          region.getByText(t.sourceReview, { exact: true }),
        ).toHaveCount(0);
        expect(errors).toEqual([]);
        await page.close();
      }
    } finally {
      await context.close();
    }
  });
});
