import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  draftMessages,
  manualPatternMessages,
  mediaMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  patternPage,
  physicalPattern,
  publishPattern,
  publishPatternCapability,
  referenceAction,
} from "../../scripts/test-support/manual-pattern-fixtures.mjs";
import { withPatternWeb } from "../../scripts/test-support/manual-pattern-web.mjs";
import { samplePatternPdf } from "../../scripts/test-support/pattern-output-fixtures.mjs";

const sharp = createRequire(
  new URL("../../packages/platform/package.json", import.meta.url),
)("sharp");
test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });
test("MP-B01–10 optional sketch/PDF, immutable replacement, source review, recovery and private clearing in English/Tamil", async ({
  browser,
}, info) => {
  test.setTimeout(480000);
  await withPatternWeb(
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
      const pixels = await sharp({
        create: { width: 320, height: 240, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      const sourceOrder = await f.sources.accept();
      await mkdir(".scratch/pattern-output-captures", { recursive: true });
      try {
        for (const locale of ["en", "ta"]) {
          const page = await context.newPage(),
            t = manualPatternMessages[locale],
            m = mediaMessages[locale],
            d = draftMessages[locale];
          const key = (locale === "en" ? f.sources.top : f.sources.bottom)
            .definition.content.code;
          const scope = {
            orderId: f.target.order.id,
            pieceId: f.target.pieces.identities.find((p) => p.key === key).id,
          };
          const own = { ...f, scope },
            source = {
              ...f,
              scope: {
                orderId: sourceOrder.order.id,
                pieceId: sourceOrder.pieces.identities.find(
                  (p) => p.key === key,
                ).id,
              },
            };
          await publishPatternCapability(own);
          await publishPattern(own, await physicalPattern(own));
          const physical = (await patternPage(own)).state.latestSavedId;
          await publishPattern(
            own,
            await referenceAction(own, physical, "select"),
          );
          const v = await physicalPattern(source);
          v.content.rights = "private-fulfilment";
          v.content.locator = `SYNTHETIC ${locale} source cabinet`;
          v.content.assumptions = "SYNTHETIC source formula unverified";
          await publishPattern(source, v);
          const sourceId = (await patternPage(source)).state.latestSavedId;
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
            await page
              .getByRole("button", { name: t.open, exact: true })
              .click();
            const region = page.getByRole("region", {
              name: t.title,
              exact: true,
            });
            await region
              .getByLabel(t.scope, { exact: true })
              .selectOption(scope.pieceId);
            const uploads = region.locator(".pattern-uploads"),
              form = region.locator("form");
            await uploads.locator("summary").click();
            await uploads
              .getByRole("button", { name: t.prepareOutput, exact: true })
              .click();
            await form
              .getByRole("button", { name: t.prepareOutput, exact: true })
              .click();
            await expect(
              form.getByText(d.promoted, { exact: true }),
            ).toBeVisible();
            await region
              .getByRole("button", { name: t.cancel, exact: true })
              .click();
            async function upload(buffer, type, name, ready = true) {
              await uploads
                .getByLabel(m.choose, { exact: true })
                .setInputFiles({ name, mimeType: type, buffer });
              await uploads
                .getByRole("button", { name: m.upload, exact: true })
                .click();
              await expect(async () => {
                const refresh = uploads.getByRole("button", {
                  name: m.refresh,
                  exact: true,
                });
                if (await refresh.isVisible()) await refresh.click();
                await expect(
                  uploads.getByText(ready ? m.ready : m.queueFailed, {
                    exact: true,
                  }),
                ).toBeVisible();
              }).toPass({ timeout: 20000, intervals: [250, 500] });
              if (!ready) return null;
              return (
                await f.admin.query(
                  "select a.id from media_asset a join pattern_media_subject s on(s.shop_id,s.id)=(a.shop_id,a.subject_id) where a.shop_id=$1 and s.order_id=$2 and s.piece_id=$3 and a.status='ready' order by a.id desc limit 1",
                  [f.a.shop, scope.orderId, scope.pieceId],
                )
              ).rows[0].id;
            }
            async function finish(reason) {
              await form.getByLabel(t.reason, { exact: true }).fill(reason);
              await form
                .getByRole("button", { name: t.save, exact: true })
                .click();
              await expect(
                form.getByText(d.promoted, { exact: true }),
              ).toBeVisible();
              await region
                .getByRole("button", { name: t.cancel, exact: true })
                .click();
            }
            if (locale === "en") {
              f.failRead(true);
              try {
                await upload(
                  pixels,
                  "image/png",
                  "SYNTHETIC-processing-failure.png",
                  false,
                );
              } finally {
                f.failRead(false);
              }
              expect((await patternPage(own)).state.currentId).toBe(physical);
            }
            const asset = await upload(
              pixels,
              "image/png",
              `SYNTHETIC-${locale}-sketch.png`,
            );
            await region
              .getByRole("button", { name: t.new, exact: true })
              .click();
            const output = form.locator(".pattern-output-fields");
            await output.locator("summary").click();
            await output
              .getByRole("button", { name: t.refreshOutputs, exact: true })
              .click();
            await output
              .getByLabel(t.chooseOutput, { exact: true })
              .selectOption(asset);
            for (const kind of ["design", "measurement"])
              await form
                .getByRole("group", { name: t[kind], exact: true })
                .getByLabel(t.inputReason, { exact: true })
                .fill("SYNTHETIC inputs not supplied");
            await form.locator("summary", { hasText: t.assumptions }).click();
            await form
              .getByLabel(t.declaredScale, { exact: true })
              .fill("Supplier claims 1:1 — unverified");
            await form
              .getByLabel(t.assumptions, { exact: true })
              .fill("SYNTHETIC formula and allowances unverified");
            await form
              .getByLabel(t.reason, { exact: true })
              .fill("SYNTHETIC new sketch reference");
            let lost = false;
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
              .getByRole("button", { name: t.save, exact: true })
              .click();
            await expect(
              form.getByRole("button", { name: d.retry, exact: true }),
            ).toBeVisible();
            await form
              .getByRole("button", { name: d.retry, exact: true })
              .click();
            await expect(
              form.getByText(d.promoted, { exact: true }),
            ).toBeVisible();
            await page.unroute("**/api/shops/*/drafts/*/promote", undefined, {
              behavior: "wait",
            });
            await region
              .getByRole("button", { name: t.cancel, exact: true })
              .click();
            let p = await patternPage(own);
            const imageRef = p.state.versions[0];
            expect(p.state.currentId).toBe(physical);
            const versions = region.locator("details").filter({
              has: page.locator("summary", { hasText: t.recorded }),
            });
            await versions.locator("summary").first().click();
            const imageArticle = versions
              .getByRole("article")
              .filter({ hasText: imageRef.id });
            await expect(imageArticle).toContainText(t.scaleWarning);
            await imageArticle
              .getByRole("button", { name: t.outputView, exact: true })
              .click();
            await expect(
              imageArticle.getByAltText(t.imageAlt, { exact: true }),
            ).toBeVisible();
            await imageArticle
              .getByRole("button", { name: t.select, exact: true })
              .click();
            await expect(form.locator(".pattern-review-context")).toContainText(
              "SYNTHETIC formula and allowances unverified",
            );
            await form.getByLabel(t.acknowledge, { exact: true }).check();
            await finish("SYNTHETIC explicit sketch selection");
            const pdf = await upload(
              samplePatternPdf(),
              "application/pdf",
              `SYNTHETIC-${locale}-SCALE-UNVERIFIED.pdf`,
            );
            await imageArticle
              .getByRole("button", { name: t.revise, exact: true })
              .click();
            await form.locator(".pattern-output-fields > summary").click();
            await form
              .getByRole("button", { name: t.refreshOutputs, exact: true })
              .click();
            await form
              .getByLabel(t.chooseOutput, { exact: true })
              .selectOption(pdf);
            await finish("SYNTHETIC PDF successor, selection preserved");
            p = await patternPage(own);
            const pdfRef = p.state.versions[0];
            expect(p.state.currentId).toBe(imageRef.id);
            const pdfArticle = versions
              .getByRole("article")
              .filter({ hasText: pdfRef.id });
            await pdfArticle
              .getByRole("button", { name: t.outputView, exact: true })
              .click();
            const link = pdfArticle.getByRole("link", {
              name: t.download,
              exact: true,
            });
            await expect(link).toBeVisible();
            const downloadEvent = page.waitForEvent("download");
            await link.click();
            expect((await downloadEvent).suggestedFilename()).toMatch(/\.pdf$/);
            await expect(pdfArticle.locator("iframe,embed,object")).toHaveCount(
              0,
            );
            await pdfArticle
              .getByRole("button", { name: t.select, exact: true })
              .click();
            await form.getByLabel(t.acknowledge, { exact: true }).check();
            await finish("SYNTHETIC explicit PDF selection");
            await region
              .getByRole("button", { name: t.new, exact: true })
              .click();
            const reuseFields = form.locator(".pattern-output-fields");
            await reuseFields.locator("summary").click();
            await reuseFields
              .getByLabel(t.sourceReference, { exact: true })
              .fill(sourceId);
            await reuseFields
              .getByRole("button", { name: t.reviewSource, exact: true })
              .click();
            await expect(reuseFields).toContainText(v.content.assumptions);
            await reuseFields
              .getByRole("button", { name: t.reuseSource, exact: true })
              .click();
            for (const kind of ["design", "measurement"])
              await form
                .getByRole("group", { name: t[kind], exact: true })
                .getByLabel(t.inputReason, { exact: true })
                .fill("SYNTHETIC new target inputs unknown");
            await reuseFields
              .getByLabel(t.reuseEvidence, { exact: true })
              .fill("SYNTHETIC permitted source and new target reviewed");
            await reuseFields.getByLabel(t.reuseHelp, { exact: true }).check();
            await finish("SYNTHETIC deliberate source reuse");
            p = await patternPage(own);
            expect(p.state.currentId).toBe(pdfRef.id);
            expect(p.state.versions[0].source.referenceId).toBe(sourceId);
            expect(
              p.comparisons.find((c) => c.referenceId === p.state.latestSavedId)
                .reviewState,
            ).toBe("unreviewed");
            await page.keyboard.press("Tab");
            expect(
              await page.evaluate(() => document.activeElement?.tagName),
            ).not.toBe("BODY");
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            ).toBe(true);
            await page.screenshot({
              path: `.scratch/pattern-output-captures/${info.project.name}-${locale}.png`,
              fullPage: true,
            });
            await publishPattern(
              source,
              await referenceAction(source, sourceId, "review", {
                reviewState: "withdrawn",
              }),
            );
            await region
              .getByRole("button", { name: t.refresh, exact: true })
              .click();
            await expect(
              region.getByText(t.denied, { exact: true }),
            ).toBeVisible();
            await expect(region.locator("img,a[download]")).toHaveCount(0);
            await page
              .getByRole("button", { name: "End access", exact: true })
              .click();
            expect(
              await page.evaluate(() => ({
                local: Object.keys(localStorage),
                session: Object.keys(sessionStorage),
              })),
            ).toEqual({ local: [], session: [] });
          } catch (e) {
            await page.screenshot({
              path: `.scratch/pattern-output-captures/${info.project.name}-${locale}-failure.png`,
              fullPage: true,
            });
            console.info(await page.locator("main").textContent());
            throw e;
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    },
    { photo: true },
  );
});
