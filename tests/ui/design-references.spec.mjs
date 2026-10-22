import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  designReferenceMessages,
  designSpecificationMessages,
  draftMessages,
  mediaMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  designOk,
  promoteDesign,
} from "../../scripts/test-support/design-choices-fixtures.mjs";
import {
  admitReference,
  processReference,
  publishSource,
  referenceItem,
  saveReferenceSpecification,
  withDesignReferences,
} from "../../scripts/test-support/design-reference-fixtures.mjs";
import { publishSpecification } from "../../scripts/test-support/design-specification-fixtures.mjs";
import {
  blankPdf,
  silenceMp3,
} from "../../scripts/test-support/media-formats.mjs";
import { withMediaWeb } from "../../scripts/test-support/media-web.mjs";

const sharp = createRequire(
  new URL("../../packages/platform/package.json", import.meta.url),
)("sharp");
test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });
test("DS-B-08/09 real private source/upload/worker, component notes, exact history, bilingual themes and owner invalidation", async ({
  browser,
}, info) => {
  test.setTimeout(420000);
  await withMediaWeb(
    async (f) => {
      await publishSpecification(
        f,
        Object.fromEntries(
          Object.entries(f.value).filter(([k]) => k !== "referenceItems"),
        ),
      );
      const { subject } = await publishSource(f),
        context = await browser.newContext({
          viewport: info.project.use.viewport,
        });
      await context.addCookies(
        f.a.cookie.split("; ").map((entry) => {
          const i = entry.indexOf("=");
          return {
            name: entry.slice(0, i),
            value: entry.slice(i + 1),
            url: f.origin,
            httpOnly: true,
          };
        }),
      );
      try {
        await mkdir(".scratch/design-references-ui", { recursive: true });
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            const page = await context.newPage();
            await page.goto(f.origin);
            if (locale === "ta")
              await page
                .getByRole("button", { name: "English / தமிழ்" })
                .click();
            if (theme === "dark")
              await page
                .getByRole("button", { name: "Theme", exact: true })
                .click();
            const t = designSpecificationMessages[locale],
              r = designReferenceMessages[locale],
              d = draftMessages[locale],
              screen = page.getByRole("region", { name: t.title, exact: true });
            await screen
              .getByLabel(t.scope, { exact: true })
              .selectOption(f.pieceId);
            const saved = screen
              .locator("details")
              .filter({ has: page.locator("summary", { hasText: /^v\d/ }) })
              .first();
            const previousVersion = Number(
              (await saved.locator("summary").first().innerText()).match(
                /^v(\d+)/,
              )[1],
            );
            await saved.locator("summary").first().click();
            await saved
              .getByRole("button", { name: t.revise, exact: true })
              .click();
            await screen
              .getByRole("button", { name: r.refresh, exact: true })
              .click();
            await screen
              .getByRole("button", { name: new RegExp(subject.sourceText) })
              .click();
            const file = page.locator("#private-file"),
              pixels = await sharp({
                create: {
                  width: 240,
                  height: 180,
                  channels: 3,
                  background: "white",
                },
              })
                .png()
                .toBuffer();
            await file.setInputFiles({
              name: "synthetic-sketch.png",
              mimeType: "image/png",
              buffer: pixels,
            });
            await page
              .getByRole("button", {
                name: mediaMessages[locale].upload,
                exact: true,
              })
              .click();
            // Wait for the real worker, then let the refreshed UI settle. A
            // polling click would keep its own candidate button busy forever.
            await expect(
              page.locator("section.owner-content").getByRole("status"),
            ).toHaveText(mediaMessages[locale].processing);
            await expect
              .poll(
                async () =>
                  Number(
                    (
                      await f.admin.query(
                        "select count(*) n from media_asset where shop_id=$1 and subject_id=$2 and status in ('pending_upload','processing')",
                        [f.a.shop, subject.id],
                      )
                    ).rows[0].n,
                  ),
                { timeout: 30000 },
              )
              .toBe(0);
            await screen
              .getByRole("button", { name: r.refresh, exact: true })
              .last()
              .click();
            await expect(
              screen
                .getByRole("button", { name: r.candidate, exact: true })
                .last(),
            ).toBeEnabled();
            await screen
              .getByRole("button", { name: r.candidate, exact: true })
              .last()
              .click();
            await screen
              .getByRole("button", { name: r.add, exact: true })
              .click();
            const fields = screen.getByRole("group", {
                name: r.title,
                exact: true,
              }),
              last = fields.locator("details").last();
            const caption = `SYNTHETIC ${info.project.name} ${locale} ${theme}`;
            await last.getByLabel(r.caption, { exact: true }).fill(caption);
            await last
              .getByRole("button", { name: r.addNote, exact: true })
              .click();
            await last
              .getByLabel(r.note, { exact: true })
              .fill("SYNTHETIC neckline placement");
            await last
              .getByLabel(r.anchor, { exact: true })
              .selectOption("point");
            await last
              .getByLabel(r.component, { exact: true })
              .selectOption(f.value.answers[0].questionId);
            await screen
              .getByLabel(t.reason, { exact: true })
              .fill("SYNTHETIC reviewed new file");
            await expect(
              last.getByRole("button", {
                name: r.reviewAttachment,
                exact: true,
              }),
            ).toBeEnabled();
            await last
              .getByRole("button", { name: r.reviewAttachment, exact: true })
              .click();
            await expect(
              last.getByRole("link", { name: r.download, exact: true }),
            ).toBeVisible();
            await last
              .getByRole("button", { name: r.view, exact: true })
              .click();
            await expect(last.locator("img")).toBeVisible();
            await fields.screenshot({
              path: `.scratch/design-references-ui/${info.project.name}-${locale}-${theme}-draft.png`,
            });
            await screen
              .getByLabel(t.saveOnly, { exact: true })
              .selectOption("use");
            await screen
              .getByRole("button", { name: t.use, exact: true })
              .click();
            await expect(
              screen.getByText(d.promoted, { exact: true }),
            ).toBeVisible();
            await screen
              .getByRole("button", { name: t.close, exact: true })
              .click();
            const newest = screen
              .locator("details")
              .filter({ has: page.locator("summary", { hasText: /^v\d/ }) })
              .first();
            await expect(newest.locator("summary").first()).toContainText(
              `v${previousVersion + 1}`,
            );
            if ((await newest.getAttribute("open")) === null)
              await newest.locator("summary").first().click();
            await expect(
              newest.getByRole("heading", { name: caption, exact: true }),
            ).toBeVisible();
            await newest
              .getByRole("button", { name: r.view, exact: true })
              .last()
              .click();
            await expect(newest.locator("img").last()).toBeVisible();
            await page.screenshot({
              path: `.scratch/design-references-ui/${info.project.name}-${locale}-${theme}.png`,
              fullPage: true,
            });
            expect(
              (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                  .analyze()
              ).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.setViewportSize({ width: 320, height: 800 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.setViewportSize(info.project.use.viewport);
            await page
              .getByRole("button", { name: "End access", exact: true })
              .click();
            await expect(screen.locator("img")).toHaveCount(0);
            await page.close();
          }
      } finally {
        await context.close();
      }
    },
    { surface: "design-references", fixture: withDesignReferences },
  );
});

test("DS-B-09 320px Tamil source recording, IME deferral, keyboard and core editing with image/PDF/voice access unavailable", async ({
  browser,
}, info) => {
  test.setTimeout(240000);
  await withMediaWeb(
    async (f) => {
      const context = await browser.newContext({
        viewport: { width: 320, height: 800 },
      });
      await context.addCookies(
        f.a.cookie.split("; ").map((entry) => {
          const i = entry.indexOf("=");
          return {
            name: entry.slice(0, i),
            value: entry.slice(i + 1),
            url: f.origin,
            httpOnly: true,
          };
        }),
      );
      try {
        const page = await context.newPage();
        await page.goto(f.origin);
        await page.getByRole("button", { name: "English / தமிழ்" }).click();
        const t = designSpecificationMessages.ta,
          r = designReferenceMessages.ta,
          d = draftMessages.ta,
          screen = page.getByRole("region", { name: t.title, exact: true });
        await screen
          .getByLabel(t.scope, { exact: true })
          .selectOption(f.pieceId);
        const saved = screen
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: /^v1/ }) })
          .first();
        await saved.locator("summary").first().click();
        await page.route("**/design-references/read", (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "MEDIA_UNAVAILABLE",
                message: "Synthetic unavailable bytes",
              },
            }),
          }),
        );
        await saved.getByRole("button", { name: r.view, exact: true }).click();
        await expect(saved.getByText(new RegExp(r.failed))).toBeVisible();
        await expect(
          saved.getByRole("button", { name: r.download, exact: true }),
        ).toHaveCount(3);
        for (const button of await saved
          .getByRole("button", { name: r.download, exact: true })
          .all()) {
          await button.click();
        }
        await expect(saved.getByText(new RegExp(r.failed))).toHaveCount(3);
        await saved
          .getByRole("button", { name: t.revise, exact: true })
          .click();
        await mkdir(".scratch/design-references-ui", { recursive: true });
        await page.setViewportSize(info.project.use.viewport);
        await page.screenshot({
          path: `.scratch/design-references-ui/${info.project.name}-ta-unavailable.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 320, height: 800 });
        const workbench = screen.getByRole("region", {
          name: r.source,
          exact: true,
        });
        await workbench
          .getByRole("button", { name: r.create, exact: true })
          .click();
        const sourceForm = workbench.locator("form");
        await sourceForm
          .getByLabel(r.sourceText, { exact: true })
          .fill("SYNTHETIC source before composition");
        await sourceForm
          .getByLabel(r.reason, { exact: true })
          .fill("SYNTHETIC new private inspiration source");
        await expect(
          sourceForm.getByText(d.saved, { exact: true }),
        ).toBeVisible();
        let writes = 0;
        page.on("request", (request) => {
          if (
            request.method() === "PUT" &&
            request.url().includes("/drafts/") &&
            request.postDataJSON()?.workflow === "design.reference"
          )
            writes++;
        });
        const input = sourceForm.getByLabel(r.sourceText, { exact: true }),
          baseline = writes;
        await input.dispatchEvent("compositionstart");
        await input.fill("SYNTHETIC தமிழ் மூல ஆதாரம் 148");
        await new Promise((resolve) => setTimeout(resolve, 900));
        expect(writes).toBe(baseline);
        const updated = page.waitForResponse(
          (response) =>
            response.request().method() === "PUT" &&
            response.url().includes("/drafts/") &&
            response.request().postDataJSON()?.payload?.sourceText ===
              "SYNTHETIC தமிழ் மூல ஆதாரம் 148",
        );
        await input.dispatchEvent("compositionend");
        expect((await updated).status()).toBe(200);
        await input.press("Tab");
        await expect(sourceForm.locator('input[type="date"]')).toBeFocused();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await workbench.screenshot({
          path: `.scratch/design-references-ui/${info.project.name}-ta-source-draft.png`,
        });
        await sourceForm
          .getByRole("button", { name: r.create, exact: true })
          .click();
        await expect(
          sourceForm.getByText(d.promoted, { exact: true }),
        ).toBeVisible();
        await workbench
          .getByRole("button", { name: r.close, exact: true })
          .click();
        await workbench
          .getByRole("button", { name: r.refresh, exact: true })
          .click();
        await expect(
          workbench.getByRole("button", {
            name: /SYNTHETIC தமிழ் மூல ஆதாரம் 148/,
          }),
        ).toBeVisible();
        await screen
          .getByLabel(t.reason, { exact: true })
          .fill("SYNTHETIC core revision with unavailable historical media");
        await screen
          .getByRole("button", { name: t.saveOnly, exact: true })
          .click();
        await expect(
          screen.getByText(d.promoted, { exact: true }),
        ).toBeVisible();
      } finally {
        await context.close();
      }
    },
    {
      surface: "design-references",
      fixture: (run) =>
        withDesignReferences(async (f) => {
          const { subject } = await publishSource(f),
            refs = [];
          for (const [type, bytes] of [
            [
              "image/jpeg",
              await sharp({
                create: {
                  width: 120,
                  height: 80,
                  channels: 3,
                  background: "white",
                },
              })
                .jpeg()
                .toBuffer(),
            ],
            ["application/pdf", blankPdf()],
            ["audio/mpeg", silenceMp3()],
          ]) {
            const grant = await admitReference(f, subject, bytes, type);
            await processReference(f, grant);
            refs.push(
              referenceItem(grant.asset.id, null, {
                caption: `SYNTHETIC ${type}`,
              }),
            );
          }
          await promoteDesign(
            f,
            await saveReferenceSpecification(f, {
              ...f.value,
              referenceItems: refs,
            }),
          ).then(designOk);
          await run(f);
        }),
    },
  );
});
