import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  draftMessages,
  measurementFitMessages,
  measurementSessionMessages,
  mediaMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  eraseMeasurementFit,
  fitPhotoConsent,
  withMeasurementFit,
} from "../../scripts/test-support/measurement-fit-fixtures.mjs";
import { withMediaWeb } from "../../scripts/test-support/media-web.mjs";

const sharp = createRequire(
  new URL("../../packages/platform/package.json", import.meta.url),
)("sharp");
test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });

test("MV-C01/02/04/06 optional fitting upload, processing/read failure, exact old/new history, lost response, keyboard/axe and consent/erasure clearing in English/Tamil", async ({
  browser,
}, info) => {
  test.setTimeout(420000);
  await withMediaWeb(
    async (f) => {
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
      await mkdir(".scratch/measurement-fit-captures", { recursive: true });
      const pixels = await sharp({
        create: { width: 320, height: 240, channels: 3, background: "white" },
      })
        .composite([
          {
            input: Buffer.from(
              '<svg width="320" height="240"><text x="18" y="100" fill="black" font-size="18">SYNTHETIC PRIVATE</text><text x="18" y="130" fill="black" font-size="18">RESEARCH FIXTURE</text></svg>',
            ),
          },
        ])
        .png()
        .toBuffer();
      try {
        for (const locale of ["en", "ta"]) {
          const page = await context.newPage();
          try {
            await page.goto(f.origin);
            if (locale === "ta") {
              await page
                .getByRole("button", { name: "English / தமிழ்" })
                .click();
              await page
                .getByRole("button", { name: "Theme", exact: true })
                .click();
            }
            const t = measurementFitMessages[locale],
              m = mediaMessages[locale],
              d = draftMessages[locale],
              s = measurementSessionMessages[locale];
            await page
              .getByRole("button", { name: s.title, exact: true })
              .click();
            const saved = page
              .locator("details")
              .filter({
                has: page
                  .locator("summary")
                  .filter({ hasText: f.version.id.slice(-8) }),
              })
              .first();
            await expect(saved).toBeVisible();
            await saved.locator("summary").first().click();
            await expect(saved).toContainText("12 1/4");
            const fit = saved.locator("details.measurement-fit");
            await fit.locator("summary").first().click();
            await expect(
              fit.getByText(t.optional, { exact: true }),
            ).toBeVisible();
            if (locale === "en") {
              await expect(
                fit.getByText(t.empty, { exact: true }),
              ).toBeVisible();
              await fit
                .getByRole("button", { name: t.prepare, exact: true })
                .click();
              await fit
                .locator("form")
                .getByRole("button", { name: t.prepare, exact: true })
                .click();
              await expect(
                fit.getByLabel(m.choosePhoto, { exact: true }),
              ).toBeVisible();
              await fit
                .getByRole("button", { name: t.close, exact: true })
                .click();
              // A real processing failure uses the same queue retries; text survives.
              f.failRead(true);
              await fit
                .getByLabel(m.choosePhoto, { exact: true })
                .setInputFiles({
                  name: "synthetic-private-research.png",
                  mimeType: "image/png",
                  buffer: pixels,
                });
              await fit
                .getByRole("button", { name: m.upload, exact: true })
                .click();
              await expect(async () => {
                const refresh = fit.getByRole("button", {
                  name: m.refresh,
                  exact: true,
                });
                if (await refresh.isVisible()) await refresh.click();
                await expect(
                  fit.getByText(m.queueFailed, { exact: true }),
                ).toBeVisible();
              }).toPass({ timeout: 20000, intervals: [250, 500] });
              await expect(saved).toContainText("12 1/4");
              f.failRead(false);
            }
            await fit.getByLabel(m.choosePhoto, { exact: true }).setInputFiles({
              name: `synthetic-private-${locale}.png`,
              mimeType: "image/png",
              buffer: pixels,
            });
            await fit
              .getByRole("button", { name: m.upload, exact: true })
              .click();
            await expect(async () => {
              const refresh = fit.getByRole("button", {
                name: m.refresh,
                exact: true,
              });
              if (await refresh.isVisible()) await refresh.click();
              await expect(
                fit.getByText(m.ready, { exact: true }),
              ).toBeVisible();
            }).toPass({ timeout: 20000, intervals: [250, 500] });
            await fit
              .getByRole("button", { name: t.refreshAssets, exact: true })
              .click();
            const asset = (
              await f.admin.query(
                "select id from media_asset where shop_id=$1 and subject_id=$2 and status='ready' order by id desc limit 1",
                [f.a.shop, f.version.sessionId],
              )
            ).rows[0].id;
            await fit
              .getByRole("button", { name: t.attach, exact: true })
              .click();
            const form = fit.locator("form"),
              caption = `SYNTHETIC private ${locale} original`,
              reason = "SYNTHETIC reviewed exact image";
            await form.getByLabel(t.image, { exact: true }).selectOption(asset);
            await form.getByLabel(t.caption, { exact: true }).fill(caption);
            await form.getByLabel(t.reason, { exact: true }).fill(reason);
            let lost = false;
            if (locale === "en")
              await page.route(
                "**/api/shops/*/drafts/*/promote",
                async (route) => {
                  const response = await route.fetch();
                  if (!lost) {
                    lost = true;
                    await route.abort("failed");
                  } else await route.fulfill({ response });
                },
              );
            await form
              .getByRole("button", { name: t.publish, exact: true })
              .click();
            if (locale === "en") {
              await expect(
                form.getByRole("button", { name: d.retry, exact: true }),
              ).toBeVisible();
              await form
                .getByRole("button", { name: d.retry, exact: true })
                .click();
            }
            await expect(
              form.getByText(d.promoted, { exact: true }),
            ).toBeVisible();
            if (locale === "en")
              await page.unroute("**/api/shops/*/drafts/*/promote");
            await fit
              .getByRole("button", { name: t.close, exact: true })
              .click();
            const first = (
              await f.admin.query(
                "select id from measurement_fit_reference where shop_id=$1 order by id desc limit 1",
                [f.a.shop],
              )
            ).rows[0].id;
            const reference = fit
              .locator("details")
              .filter({
                has: page
                  .locator("summary")
                  .filter({ hasText: first.slice(-8) }),
              })
              .first();
            await reference.locator("summary").first().click();
            await expect(reference).toContainText(caption);
            await page.route("**/measurements/fit/read", (route) =>
              route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  error: {
                    code: "DATABASE_UNAVAILABLE",
                    message: "Synthetic read outage",
                  },
                }),
              }),
            );
            await reference
              .getByRole("button", { name: t.view, exact: true })
              .click();
            await expect(
              reference.getByText(t.unavailable, { exact: true }),
            ).toBeVisible();
            await expect(saved).toContainText("12 1/4");
            await page.unroute("**/measurements/fit/read");
            await reference
              .getByRole("button", { name: t.view, exact: true })
              .click();
            await expect(reference.locator("img")).toBeVisible();
            await reference
              .getByRole("button", { name: t.replace, exact: true })
              .click();
            const edit = fit.locator("form");
            await edit
              .getByLabel(t.caption, { exact: true })
              .fill(`SYNTHETIC private ${locale} replacement`);
            await edit
              .getByLabel(t.reason, { exact: true })
              .fill("SYNTHETIC attributable replacement");
            await edit
              .getByRole("button", { name: t.publish, exact: true })
              .click();
            await expect(
              edit.getByText(d.promoted, { exact: true }),
            ).toBeVisible();
            await fit
              .getByRole("button", { name: t.close, exact: true })
              .click();
            await expect(
              fit
                .locator("summary")
                .filter({ hasText: new RegExp(`^${t.version} 2`) })
                .first(),
            ).toBeVisible();
            // Exact old reference still signs; replacement never mutates its caption.
            const old = await context.request.post(
              `${f.origin}/api/shops/${f.a.shop}/measurements/fit/read`,
              {
                data: {
                  measurementVersionId: f.version.id,
                  referenceId: first,
                  variant: "thumbnail",
                },
              },
            );
            expect(old.status()).toBe(200);
            expect((await old.json()).reference.caption).toBe(caption);
            await fit
              .getByRole("button", { name: t.load, exact: true })
              .focus();
            await page.keyboard.press("Tab");
            expect(
              await page.evaluate(() => document.activeElement?.tagName),
            ).not.toBe("BODY");
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            await page.setViewportSize({ width: 320, height: 800 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= 320,
              ),
            ).toBe(true);
            await page.setViewportSize(info.project.use.viewport);
            await page.screenshot({
              path: `.scratch/measurement-fit-captures/${info.project.name}-${locale}.png`,
              fullPage: true,
            });
            if (locale === "ta") {
              await fit
                .getByRole("button", { name: t.attach, exact: true })
                .click();
              await fit
                .locator("form")
                .getByLabel(t.caption, { exact: true })
                .fill("SYNTHETIC pending private caption");
              await fitPhotoConsent(f, "withdrawal");
              await fit
                .getByRole("button", { name: t.load, exact: true })
                .click();
              await expect(
                fit.getByText(t.denied, { exact: true }),
              ).toBeVisible();
              await expect(fit.locator("img")).toHaveCount(0);
              await expect(
                fit.getByLabel(t.caption, { exact: true }),
              ).toHaveCount(0);
              await expect(saved).toContainText("12 1/4");
              await fitPhotoConsent(f, "grant");
              await fit
                .getByRole("button", { name: t.load, exact: true })
                .click();
              await expect(
                fit.getByRole("button", { name: t.attach, exact: true }),
              ).toBeVisible();
              await eraseMeasurementFit(f);
              await fit
                .getByRole("button", { name: t.load, exact: true })
                .click();
              await expect(
                page.getByText(s.access, { exact: true }),
              ).toBeVisible();
              await expect(
                page.getByText("12 1/4 in", { exact: false }),
              ).toHaveCount(0);
            }
          } finally {
            await page.close();
          }
        }
      } finally {
        f.failRead(false);
        await context.close();
      }
    },
    {
      surface: "measurement-fit",
      fixture: (run) =>
        withMeasurementFit(async (f) => {
          const target = await f.sources.accept();
          await run({ ...f, target });
        }),
    },
  );
});
