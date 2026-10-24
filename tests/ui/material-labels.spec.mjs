import { mkdir } from "node:fs/promises";
import {
  jobSlipMessages,
  materialLabelMessages,
  sharingMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withJobSlipBrowserHost } from "../../scripts/test-support/job-slip-browser.mjs";

test("JS-B04 bilingual minimal labels, selected output, download/manual sharing and purpose-switch clearing", async ({
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
      window.__labelCalls = [];
      window.__labelCapable = true;
      window.__labelOutcome = "AbortError";
      window.__revoked = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => {
        window.__revoked.push(url);
        revoke(url);
      };
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => window.__labelCapable,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: ({ files }) => {
          window.__labelCalls.push({
            active: navigator.userActivation.isActive,
            type: files[0].type,
          });
          return Promise.reject(
            new DOMException("Synthetic share result", window.__labelOutcome),
          );
        },
      });
    });
    await mkdir(".scratch/material-label-captures", { recursive: true });
    try {
      for (const locale of ["en", "ta"]) {
        const page = await context.newPage(),
          t = materialLabelMessages[locale],
          j = jobSlipMessages[locale],
          s = sharingMessages[locale],
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(f.origin);
        if (locale === "ta") {
          await page
            .getByRole("button", { name: "English / தமிழ்", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Theme", exact: true })
            .click();
        }
        await page.getByRole("button", { name: j.open, exact: true }).click();
        const region = page.getByRole("region", { name: j.title, exact: true });
        await region
          .getByLabel(j.scope, { exact: true })
          .selectOption(f.pieceId);
        await region
          .getByLabel(t.purpose, { exact: true })
          .selectOption("labels");
        await region
          .getByRole("button", { name: t.choose, exact: true })
          .click();
        await region
          .getByLabel(t.order, { exact: true })
          .selectOption(f.orderId);
        await region.getByRole("button", { name: t.add, exact: true }).click();
        await region
          .getByRole("button", { name: t.review, exact: true })
          .click();
        await expect(region.getByLabel(t.ack, { exact: true })).toBeVisible();
        await region
          .getByLabel(t.language, { exact: true })
          .selectOption(locale);
        await region.getByLabel(t.ack, { exact: true }).check();
        await region
          .getByRole("button", {
            name: locale === "en" ? t.create : t.revise,
            exact: true,
          })
          .click();
        await expect(
          region.getByLabel(t.audience, { exact: true }),
        ).toHaveValue("print-shop");
        await expect(async () => {
          await region
            .getByRole("button", { name: s.prepare, exact: true })
            .click();
          await expect(region.getByText(s.ready, { exact: true })).toBeVisible({
            timeout: 1500,
          });
        }).toPass({ timeout: 30000, intervals: [1000] });
        await expect(page.getByTestId("pdf-preview")).toBeVisible();
        await expect(region).not.toContainText("PRIVATE-FITTING-SENTINEL");
        await region.getByLabel(t.previewAck, { exact: true }).check();
        await region
          .getByRole("button", { name: s.share, exact: true })
          .click();
        await expect(
          region.getByText(s.cancelled, { exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => window.__labelCalls)).toEqual([
          { active: true, type: "application/pdf" },
        ]);
        const download = page.waitForEvent("download");
        await region
          .getByRole("button", { name: s.download, exact: true })
          .click();
        expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
        await page.evaluate(() => {
          window.__labelCapable = false;
        });
        await region
          .getByRole("button", { name: s.prepare, exact: true })
          .click();
        await expect(region.getByText(s.ready, { exact: true })).toBeVisible();
        await region.getByLabel(t.previewAck, { exact: true }).check();
        await expect(
          region.getByRole("button", { name: s.share, exact: true }),
        ).toHaveCount(0);
        await expect(region.getByText(s.manual, { exact: true })).toBeVisible();
        await page.evaluate(() => {
          window.__labelCapable = true;
          window.__labelOutcome = "DataError";
        });
        await region
          .getByRole("button", { name: s.prepare, exact: true })
          .click();
        await expect(region.getByText(s.ready, { exact: true })).toBeVisible();
        await region.getByLabel(t.previewAck, { exact: true }).check();
        await region
          .getByRole("button", { name: s.share, exact: true })
          .click();
        await expect(region.getByText(s.failed, { exact: true })).toBeVisible();

        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.scratch/material-label-captures/${info.project.name}-${locale}.png`,
          fullPage: true,
        });
        let release, started, finished;
        const blocked = new Promise((r) => {
            release = r;
          }),
          fileStarted = new Promise((r) => {
            started = r;
          }),
          fileFinished = new Promise((r) => {
            finished = r;
          });
        await page.route("**/file", async (route) => {
          try {
            const response = await route.fetch();
            started();
            await blocked;
            await route.fulfill({ response });
          } catch {
            /* Purpose change can abort the intercepted browser request. */
          } finally {
            finished();
          }
        });
        await region
          .getByRole("button", { name: s.prepare, exact: true })
          .click();
        await fileStarted;
        await region
          .getByLabel(t.purpose, { exact: true })
          .selectOption("job-slip");
        release();
        await fileFinished;
        await page.unroute("**/file");
        await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
        expect(
          await page.evaluate(() => window.__revoked.length),
        ).toBeGreaterThan(0);
        await region
          .getByLabel(t.purpose, { exact: true })
          .selectOption("labels");
        await expect(
          region.getByLabel(t.previewAck, { exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: "End access", exact: true })
          .click();
        await expect(
          region.getByRole("button", { name: t.review, exact: true }),
        ).toBeDisabled();
        expect(errors).toEqual([]);
        await page.close();
      }
    } finally {
      await context.close();
    }
  });
});
