import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mediaMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  silenceM4a,
  silenceMp3,
} from "../../scripts/test-support/media-formats.mjs";
import { withMediaWeb } from "../../scripts/test-support/media-web.mjs";

const sharp = createRequire(
  new URL("../../packages/platform/package.json", import.meta.url),
)("sharp");
test.use({ trace: "off", screenshot: "off" });
test("0.4.3b H1/H4/H6/H8 Chrome-size private preparation, honest retry and bilingual accessible states", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  await withMediaWeb(async (f) => {
    console.info(
      `Media browser: ${browser.browserType().name()} ${browser.version()}; viewport ${JSON.stringify(testInfo.project.use.viewport)}; responsive emulation only`,
    );
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport,
    });
    await context.addCookies(
      f.a.cookie.split("; ").map((entry) => {
        const index = entry.indexOf("=");
        return {
          name: entry.slice(0, index),
          value: entry.slice(index + 1),
          url: f.origin,
          httpOnly: true,
        };
      }),
    );
    try {
      for (const locale of ["en", "ta"])
        for (const theme of ["light", "dark"]) {
          const page = await context.newPage();
          await page.goto(f.origin);
          await expect(page.locator("#private-file")).toBeVisible();
          if (locale === "ta")
            await page.getByRole("button", { name: "English / தமிழ்" }).click();
          if (theme === "dark")
            await page
              .getByRole("button", { name: "Theme", exact: true })
              .click();
          const t = mediaMessages[locale],
            input = page.locator("#private-file");
          await input.setInputFiles({
            name: "synthetic-invalid.heic",
            mimeType: "image/heic",
            buffer: Buffer.from("not a valid HEIC"),
          });
          await expect(
            page.locator("section.owner-content").getByRole("alert"),
          ).toHaveText(t.conversion);
          const pixels = await sharp({
            create: {
              width: 2000,
              height: 1400,
              channels: 3,
              background: "white",
            },
          })
            .png()
            .toBuffer();
          await input.setInputFiles({
            name: "synthetic-page.png",
            mimeType: "image/png",
            buffer: pixels,
          });
          await expect(page.getByRole("status")).toHaveText(t.selected);
          await expect(page.getByTestId("update-safety")).toHaveText(
            "Work active",
          );
          await page.screenshot({
            path: `.scratch/media-${testInfo.project.name}-${locale}-${theme}-prepared.png`,
            fullPage: true,
          });
          const completions = [];
          let loseOnce = true;
          await page.route("**/api/shops/*/files/*/complete", async (route) => {
            const request = route.request();
            completions.push({
              key: request.headers()["idempotency-key"],
              etag: request.headers()["if-match"],
              body: request.postData(),
            });
            if (loseOnce) {
              loseOnce = false;
              const response = await route.fetch();
              await response.body();
              await route.abort("failed");
            } else await route.continue();
          });
          await page
            .getByRole("button", { name: t.upload, exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(t.uncertain);
          await expect(page.getByTestId("update-safety")).toHaveText(
            "Work active",
          );
          await page
            .getByRole("button", { name: t.retry, exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(t.processing);
          expect(completions).toHaveLength(2);
          expect(completions[0]).toEqual(completions[1]);
          await expect
            .poll(async () =>
              Number(
                (
                  await f.admin.query(
                    "select count(*)::int as n from media_asset where shop_id=$1 and status='processing'",
                    [f.a.shop],
                  )
                ).rows[0].n,
              ),
            )
            .toBe(0);
          await page
            .getByRole("button", { name: t.refresh, exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(t.ready);
          await expect(page.getByTestId("update-safety")).toHaveText(
            "Update safe",
          );
          const violations = (await new AxeBuilder({ page }).analyze())
            .violations;
          expect(violations).toEqual([]);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          for (const button of await page.getByRole("button").all()) {
            const box = await button.boundingBox();
            if (box) expect(box.height).toBeGreaterThanOrEqual(44);
          }
          await page.setViewportSize({ width: 320, height: 800 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.setViewportSize(testInfo.project.use.viewport);
          if (testInfo.project.name === "tablet") {
            await page.setViewportSize({ width: 1180, height: 820 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.setViewportSize(testInfo.project.use.viewport);
          }
          await page.screenshot({
            path: `.scratch/media-${testInfo.project.name}-${locale}-${theme}-ready.png`,
            fullPage: true,
          });
          // Native browser decode, without playback, confirms these synthetic
          // compressed-audio positive fixtures are real decodable media.
          if (locale === "en" && theme === "light")
            for (const [name, bytes] of [
              ["MP3", silenceMp3()],
              ["M4A", silenceM4a()],
            ]) {
              const decoded = await page.evaluate(async (values) => {
                const audio = new AudioContext();
                try {
                  const buffer = await audio.decodeAudioData(
                    Uint8Array.from(values).buffer,
                  );
                  return {
                    channels: buffer.numberOfChannels,
                    length: buffer.length,
                    sampleRate: buffer.sampleRate,
                  };
                } catch {
                  return null;
                } finally {
                  await audio.close();
                }
              }, Array.from(bytes));
              if (testInfo.project.use.channel === "chrome" || name === "MP3")
                assert(decoded && decoded.channels > 0 && decoded.length > 0);
              console.info(
                `Synthetic ${name} native decode: ${JSON.stringify(decoded)}`,
              );
            }
          // Quarantine is visible without attempting to execute a PDF script.
          await input.setInputFiles({
            name: "synthetic-invalid.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("%PDF-1.7\nmalformed"),
          });
          await page
            .getByRole("button", { name: t.upload, exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(t.processing);
          await expect
            .poll(async () =>
              Number(
                (
                  await f.admin.query(
                    "select count(*)::int as n from media_asset where shop_id=$1 and status='processing'",
                    [f.a.shop],
                  )
                ).rows[0].n,
              ),
            )
            .toBe(0);
          await page
            .getByRole("button", { name: t.refresh, exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(t.rejected);
          await page
            .getByRole("button", { name: "End access", exact: true })
            .click();
          await expect(page.getByRole("status")).toHaveText(t.accessEnded);
          await expect(input).toBeDisabled();
          const persistence = await page.evaluate(async () => ({
            local: localStorage.length,
            session: sessionStorage.length,
            databases: (await indexedDB.databases()).length,
            caches: await caches.keys(),
          }));
          expect(persistence).toEqual({
            local: 0,
            session: 0,
            databases: 0,
            caches: [],
          });
          await page.close();
        }
      const events = await f.admin.query(
        "select count(*)::int as n from product_event where shop_id=$1 and name='media.stored'",
        [f.a.shop],
      );
      expect(events.rows[0].n).toBe(4);
    } finally {
      await context.close();
    }
  });
});
