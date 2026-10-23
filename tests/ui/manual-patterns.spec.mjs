import { mkdir } from "node:fs/promises";
import { draftMessages, manualPatternMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  designOk,
  designRequest,
} from "../../scripts/test-support/design-choices-fixtures.mjs";
import { withPatternWeb } from "../../scripts/test-support/manual-pattern-web.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSelectionDraft,
  publishMeasurement,
} from "../../scripts/test-support/measurement-session-fixtures.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });
test("PAT-01/03 MP-A01–12 fileless reference, reviewed versus cutting, revision/history, recoverable failures and private clearing in English/Tamil", async ({
  browser,
}, info) => {
  test.setTimeout(420000);
  await withPatternWeb(async (f) => {
    const context = await browser.newContext({
      viewport: info.project.use.viewport,
    });
    await context.addCookies(
      f.a.cookie.split("; ").map((v) => {
        const i = v.indexOf("=");
        return {
          name: v.slice(0, i),
          value: v.slice(i + 1),
          url: f.origin,
          httpOnly: true,
        };
      }),
    );
    await mkdir(".scratch/manual-pattern-captures", { recursive: true });
    try {
      for (const locale of ["en", "ta"]) {
        const page = await context.newPage(),
          t = manualPatternMessages[locale],
          d = draftMessages[locale];
        const formDefinition = f.sources.forms[locale === "en" ? 0 : 1],
          piece = f.target.pieces.identities.find(
            (p) =>
              p.key ===
              (locale === "en" ? f.sources.top : f.sources.bottom).definition
                .content.code,
          ),
          target = { orderId: f.target.order.id, pieceId: piece.id },
          approval =
            locale === "en"
              ? f.approval
              : await approveMeasurementForm(f, formDefinition);
        const saveMeasurement = async () => {
          const saved = await publishMeasurement(
            f,
            measurementDraft(f.identity, formDefinition, approval),
          );
          return designRequest(
            f,
            `measurements/versions/${saved.result.draft.result.id}`,
          ).then(designOk);
        };
        const originalMeasurement =
          locale === "en" ? f.version : await saveMeasurement();
        await publishMeasurement(
          f,
          measurementSelectionDraft(originalMeasurement, target),
        );
        try {
          await page.goto(f.origin);
          if (locale === "ta") {
            await page.getByRole("button", { name: "English / தமிழ்" }).click();
            await page
              .getByRole("button", { name: "Theme", exact: true })
              .click();
          }
          await page.getByRole("button", { name: t.open, exact: true }).click();
          const region = page.getByRole("region", {
            name: t.title,
            exact: true,
          });
          await region
            .getByLabel(t.scope, { exact: true })
            .selectOption(piece.id);
          await expect(
            region.getByText(t.unconfigured, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.configure, exact: true })
            .click();
          const form = region.locator("form");
          await form
            .getByLabel(t.manual, { exact: true })
            .selectOption("available");
          await form
            .getByLabel(t.external, { exact: true })
            .selectOption("available");
          await form
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC availability review");
          await form.getByLabel(t.capabilityReview, { exact: true }).check();
          await form
            .getByRole("button", { name: t.saveCapability, exact: true })
            .click();
          await expect(
            form.getByText(d.promoted, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          await region
            .getByRole("button", { name: t.new, exact: true })
            .click();
          await form
            .getByLabel(t.locator, { exact: true })
            .fill(`SYNTHETIC ${locale} Cabinet B / folder 12`);
          await form
            .getByRole("group", { name: t.design, exact: true })
            .getByLabel(t.inputReason, { exact: true })
            .fill("SYNTHETIC design not supplied");
          const measurement = form.getByRole("group", {
            name: t.measurement,
            exact: true,
          });
          await measurement
            .getByLabel(t.measurement, { exact: true })
            .selectOption("known");
          await measurement
            .getByRole("button", { name: t.useCurrent, exact: true })
            .click();
          await expect(
            measurement.getByLabel(t.exactId, { exact: true }),
          ).toHaveValue(originalMeasurement.id);
          await form
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC physical reference");
          let failed = true;
          await page.route("**/api/shops/*/drafts/*/promote", (route) => {
            if (failed) {
              failed = false;
              return route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  error: {
                    code: "DATABASE_UNAVAILABLE",
                    message: "Synthetic transient failure",
                  },
                }),
              });
            }
            return route.continue();
          });
          await form.getByRole("button", { name: t.save, exact: true }).click();
          await expect(form.getByLabel(t.locator, { exact: true })).toHaveValue(
            `SYNTHETIC ${locale} Cabinet B / folder 12`,
          );
          await page.unroute("**/api/shops/*/drafts/*/promote");
          const retry = form.getByRole("button", {
            name: d.retry,
            exact: true,
          });
          if (await retry.isVisible()) await retry.click();
          else
            await form
              .getByRole("button", { name: t.save, exact: true })
              .click();
          await expect(
            form.getByText(d.promoted, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          const versions = region
            .locator("details")
            .filter({ has: page.locator("summary", { hasText: t.recorded }) });
          await versions.locator("summary").first().click();
          const first = versions.getByRole("article").first();
          await expect(first).toContainText(
            `SYNTHETIC ${locale} Cabinet B / folder 12`,
          );
          await expect(
            first.getByText(t.cuttingWarning, { exact: true }),
          ).toBeVisible();
          await first
            .getByRole("button", { name: t.review, exact: true })
            .click();
          await form
            .getByLabel(t.evidence, { exact: true })
            .fill(
              "SYNTHETIC reference reviewed; all scale assumptions unverified",
            );
          await form
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC reference review");
          await form.getByLabel(t.acknowledge, { exact: true }).check();
          await form.getByRole("button", { name: t.save, exact: true }).click();
          await expect(
            form.getByText(d.promoted, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          await first
            .getByRole("button", { name: t.select, exact: true })
            .click();
          await form
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC reference-only selection");
          await form.getByLabel(t.acknowledge, { exact: true }).check();
          await form.getByRole("button", { name: t.save, exact: true }).click();
          await expect(
            form.getByText(d.promoted, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          await first
            .getByRole("button", { name: t.revise, exact: true })
            .click();
          await form
            .getByLabel(t.locator, { exact: true })
            .fill(`SYNTHETIC ${locale} Cabinet B / folder 13`);
          await form
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC reasoned locator revision");
          await form.getByRole("button", { name: t.save, exact: true }).click();
          await expect(
            form.getByText(d.promoted, { exact: true }),
          ).toBeVisible();
          await region
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          await expect(region.getByRole("article").first()).toContainText(
            `SYNTHETIC ${locale} Cabinet B / folder 12`,
          );
          await expect(versions.getByRole("article").first()).toContainText(
            `SYNTHETIC ${locale} Cabinet B / folder 13`,
          );
          await versions
            .getByRole("article")
            .first()
            .getByRole("button", { name: t.select, exact: true })
            .click();
          await form
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC stale comparison decision");
          await form.getByLabel(t.acknowledge, { exact: true }).check();
          const replacementMeasurement = await saveMeasurement();
          const impact = { physical: "not-started", commercial: "none" };
          const reuse = await designRequest(f, "measurements/review", {
            method: "POST",
            body: { selectedId: replacementMeasurement.id, target, impact },
          }).then(designOk);
          expect(reuse.blocked).toEqual([]);
          await publishMeasurement(f, {
            ...measurementSelectionDraft(replacementMeasurement, target),
            baseVersion: reuse.target.version,
            reuseReview: { digest: reuse.digest, impact },
          });
          await form.getByRole("button", { name: t.save, exact: true }).click();
          await expect(
            region.getByText(t.conflict, { exact: true }),
          ).toBeVisible();
          await expect(form.getByLabel(t.reason, { exact: true })).toHaveValue(
            "SYNTHETIC stale comparison decision",
          );
          await region
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          await region
            .getByRole("button", { name: t.refresh, exact: true })
            .click();
          await expect(
            versions
              .getByRole("article")
              .first()
              .getByText(t.mismatch, { exact: true }),
          ).toBeVisible();
          await expect(versions.getByRole("article").first()).toContainText(
            originalMeasurement.id,
          );
          await expect(page.locator('input[type="file"]')).toHaveCount(0);
          await page.keyboard.press("Tab");
          expect(
            await page.evaluate(() => document.activeElement?.tagName),
          ).not.toBe("BODY");
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: `.scratch/manual-pattern-captures/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
          await page
            .getByRole("button", { name: "End access", exact: true })
            .click();
          await expect(
            page.getByText(`SYNTHETIC ${locale} Cabinet B / folder 12`, {
              exact: true,
            }),
          ).toHaveCount(0);
          expect(
            await page.evaluate(() => ({
              local: Object.keys(localStorage),
              session: Object.keys(sessionStorage),
            })),
          ).toEqual({ local: [], session: [] });
        } catch (error) {
          await page.screenshot({
            path: `.scratch/manual-pattern-captures/${info.project.name}-${locale}-failure.png`,
            fullPage: true,
          });
          console.info(await page.locator("main").textContent());
          throw error;
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  });
});
