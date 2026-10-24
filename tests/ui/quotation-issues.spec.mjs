import { mkdir } from "node:fs/promises";
import {
  documentMessages,
  quotationIssueMessages,
  sharingMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withQuotationIssueBrowserHost } from "../../scripts/test-support/quotation-issue-browser.mjs";

test("C-01/02/03/05/08/10 bilingual exact issue, original-key recovery, stored preview, cancelled manual share and owner response", async ({
  browser,
}, info) => {
  test.setTimeout(480000);
  await withQuotationIssueBrowserHost(async (f) => {
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
      window.__quoteShares = [];
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async ({ files }) => {
          window.__quoteShares.push({
            name: files[0].name,
            size: files[0].size,
          });
          throw new DOMException("cancelled", "AbortError");
        },
      });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (/quotation-issues|documents/.test(r.url()))
        console.info(
          "Quotation browser HTTP",
          r.status(),
          new URL(r.url()).pathname,
        );
    });
    try {
      await page.goto(f.origin);
      const en = quotationIssueMessages.en;
      await page.getByLabel(en.language, { exact: true }).selectOption("ta");
      await page
        .getByLabel(en.customer, { exact: true })
        .fill("SYNTHETIC ஸ்ரீ customer");
      const reason = page.getByLabel(en.reason, { exact: true });
      await reason.fill("SYNTHETIC தமிழ் quotation");
      page.once("dialog", (d) => d.dismiss());
      await page
        .getByRole("button", { name: "Leave proposal", exact: true })
        .click();
      await expect(reason).toBeVisible();
      await page.getByRole("button", { name: en.review, exact: true }).click();
      await expect(page.getByText(en.reviewed, { exact: true })).toBeVisible();
      await f.sourceChange();
      await page.getByLabel(en.ack, { exact: true }).check();
      await page.getByRole("button", { name: en.issue, exact: true }).click();
      await expect(page.getByText(en.stale, { exact: true })).toBeVisible();
      await expect(reason).toHaveValue("SYNTHETIC தமிழ் quotation");
      await page.getByRole("button", { name: en.review, exact: true }).click();
      await expect(page.getByText(en.reviewed, { exact: true })).toBeVisible();
      await page.getByLabel(en.ack, { exact: true }).check();
      const requests = [];
      let lose = true;
      await page.route("**/quotation-issues", async (route) => {
        requests.push({
          key: route.request().headers()["idempotency-key"],
          body: route.request().postData(),
          etag: route.request().headers()["if-match"],
        });
        const r = await route.fetch();
        if (lose && r.ok()) {
          lose = false;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":{"code":"SYNTHETIC_LOST_REPLY"}}',
          });
        } else await route.fulfill({ response: r });
      });
      await reason.dispatchEvent("compositionstart");
      await page.getByRole("button", { name: en.issue, exact: true }).click();
      expect(requests).toHaveLength(0);
      await reason.dispatchEvent("compositionend");
      await page.getByRole("button", { name: en.issue, exact: true }).click();
      await expect(page.getByText(en.checking, { exact: true })).toBeVisible();
      await expect(reason).toBeDisabled();
      await page
        .getByRole("button", { name: "Leave proposal", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: en.retry, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: en.retry, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: /QT-000001/ }),
      ).toBeVisible({ timeout: 30000 });
      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual(requests[1]);
      const s = sharingMessages.en,
        d = documentMessages.en;
      await expect(async () => {
        await page.getByRole("button", { name: d.check, exact: true }).click();
        await expect(page.getByText(d.ready, { exact: true })).toBeVisible();
      }).toPass({ timeout: 60000 });
      const sharingRequests = [];
      let losePrepared = true;
      await page.route("**/documents/**/history", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        sharingRequests.push({
          key: route.request().headers()["idempotency-key"],
          body: route.request().postData(),
        });
        const r = await route.fetch();
        if (losePrepared && r.ok()) {
          losePrepared = false;
          await route.abort("failed");
        } else await route.fulfill({ response: r });
      });
      await page.getByRole("button", { name: s.prepare, exact: true }).click();
      await expect(page.getByText(s.unknown, { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await page
        .getByRole("button", { name: "Leave proposal", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: s.retry, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: s.retry, exact: true }).click();

      await expect(page.getByText(s.ready, { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByTestId("pdf-preview")).toBeVisible();
      expect(sharingRequests).toHaveLength(2);
      expect(sharingRequests[0]).toEqual(sharingRequests[1]);
      await page.getByLabel(en.ack, { exact: true }).last().check();
      await page.getByRole("button", { name: s.share, exact: true }).click();
      await expect(page.getByText(s.cancelled, { exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => window.__quoteShares[0].size),
      ).toBeGreaterThan(1000);
      await page.getByRole("button", { name: s.history, exact: true }).click();
      await expect(page.getByText(s.marked, { exact: true })).toHaveCount(0);
      const responseRequests = [];
      let loseResponse = true;
      await page.route("**/quotation-issues/response", async (route) => {
        responseRequests.push({
          key: route.request().headers()["idempotency-key"],
          body: route.request().postData(),
        });
        const r = await route.fetch();
        if (loseResponse && r.ok()) {
          loseResponse = false;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":{"code":"SYNTHETIC_LOST_REPLY"}}',
          });
        } else await route.fulfill({ response: r });
      });
      await page
        .getByLabel(en.respondent, { exact: true })
        .selectOption({ index: 1 });
      await page
        .getByLabel(en.reported, { exact: true })
        .fill("2026-10-24T10:00");
      await page
        .getByLabel(en.evidence, { exact: true })
        .fill("SYNTHETIC verbal review");
      await page
        .getByLabel(en.responseReason, { exact: true })
        .fill("SYNTHETIC rejection");
      await page.getByLabel(en.attest, { exact: true }).check();
      await page.getByRole("button", { name: en.record, exact: true }).click();
      await expect(page.getByText(en.checking, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: en.retry, exact: true }).click();
      await expect(
        page.locator("li").filter({ hasText: "SYNTHETIC rejection" }),
      ).toHaveCount(1, { timeout: 30000 });
      expect(responseRequests).toHaveLength(2);
      expect(responseRequests[0]).toEqual(responseRequests[1]);
      await mkdir(".impeccable/review", { recursive: true });
      for (const locale of ["en", "ta"]) {
        if (locale === "ta") {
          await page
            .getByRole("button", { name: "English / தமிழ்", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Theme", exact: true })
            .click();
        }
        await page.evaluate(() => document.fonts.ready);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path: `.impeccable/review/quotation-issues-${info.project.name}-${locale}.png`,
          fullPage: true,
        });
      }
      await page.reload();
      await page.getByRole("button", { name: en.review, exact: true }).click();
      await page.getByRole("button", { name: /Open issued quotation/ }).click();
      await expect(
        page.getByRole("heading", { name: /QT-000001/ }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        page.locator("li").filter({ hasText: "SYNTHETIC rejection" }),
      ).toHaveCount(1, { timeout: 30000 });
      await page.setViewportSize({ width: 320, height: 800 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() => ({
          local: Object.keys(localStorage),
          session: Object.keys(sessionStorage),
        })),
      ).toEqual({ local: [], session: [] });
      await page
        .getByRole("button", { name: "End access", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: /QT-000001/ }),
      ).toHaveCount(0);
      await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
