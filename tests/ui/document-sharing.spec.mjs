import { sharingMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withDocumentSharingBrowserHost } from "../../scripts/test-support/document-sharing-browser.mjs";

test("0.4.4b J1–J6 prepared-before-gesture PDF, explicit history, cancel/fallback, access loss and bilingual responsive accessibility", async ({
  browser,
}, info) => {
  test.setTimeout(600000);
  await withDocumentSharingBrowserHost(
    async ({
      origin,
      countMarked,
      input,
      loseNextReply,
      storageUnavailable,
      delayFile,
    }) => {
      const context = await browser.newContext({
        viewport: info.project.use.viewport,
      });
      await context.addInitScript(() => {
        const state = {
          calls: [],
          outcome: "cancel",
          opened: [],
          revoked: [],
          created: [],
          capable: true,
        };
        window.__pdfTest = state;
        Object.defineProperty(navigator, "canShare", {
          value: ({ files }) =>
            state.capable && files?.length === 1 && files[0] instanceof File,
          configurable: true,
        });
        Object.defineProperty(navigator, "share", {
          value: ({ files }) => {
            state.calls.push({
              active: navigator.userActivation.isActive,
              name: files[0].name,
              type: files[0].type,
              size: files[0].size,
            });
            return state.outcome === "success"
              ? Promise.resolve()
              : Promise.reject(
                  new DOMException(
                    "Synthetic result",
                    state.outcome === "cancel" ? "AbortError" : "DataError",
                  ),
                );
          },
          configurable: true,
        });
        window.open = (url) => {
          state.opened.push(String(url));
          return null;
        };
        const create = URL.createObjectURL.bind(URL),
          revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (file) => {
          const u = create(file);
          state.created.push(u);
          return u;
        };
        URL.revokeObjectURL = (url) => {
          state.revoked.push(url);
          return revoke(url);
        };
      });
      try {
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (e) => errors.push(e.message));
            await page.goto(origin);
            if (locale === "ta")
              await page
                .getByRole("button", { name: "English / தமிழ்" })
                .click();
            if (theme === "dark")
              await page
                .getByRole("button", { name: "Theme", exact: true })
                .click();
            const t = sharingMessages[locale];
            await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
            // Loading a page or selecting a document must not load private PDF bytes.
            expect(
              await page.evaluate(() => window.__pdfTest.created.length),
            ).toBe(0);
            await loseNextReply();
            await page
              .getByRole("button", { name: t.prepare, exact: true })
              .click();
            await expect(
              page.getByText(t.unknown, { exact: true }),
            ).toBeVisible();
            await page
              .getByRole("button", { name: t.retry, exact: true })
              .click();
            await expect(page.getByTestId("pdf-preview")).toBeVisible();
            if (await page.evaluate(() => navigator.pdfViewerEnabled))
              await expect(page.getByTitle(t.preview)).toHaveAttribute(
                "src",
                /#view=FitH&navpanes=0$/,
              );
            const before = await countMarked();
            await page
              .getByRole("button", { name: t.share, exact: true })
              .click();
            await expect(
              page.getByText(t.cancelled, { exact: true }),
            ).toBeVisible();
            expect(await countMarked()).toBe(before);
            const calls = await page.evaluate(() => window.__pdfTest.calls);
            expect(calls).toHaveLength(1);
            expect(calls[0].active).toBe(true);
            expect(calls[0].size).toBeGreaterThan(1000);
            await page.evaluate(() => {
              window.__pdfTest.outcome = "failure";
            });
            await page
              .getByRole("button", { name: t.share, exact: true })
              .click();
            await expect(
              page.getByText(t.failed, { exact: true }),
            ).toBeVisible();
            const download = page.waitForEvent("download");
            await page
              .getByRole("button", { name: t.download, exact: true })
              .click();
            expect((await download).suggestedFilename()).toBe(
              `document-${input.docId}-1.pdf`,
            );
            await page
              .getByRole("button", { name: t.text, exact: true })
              .click();
            const opened = await page.evaluate(() => window.__pdfTest.opened);
            expect(opened).toHaveLength(1);
            const link = new URL(opened[0]);
            expect(link.origin).toBe("https://wa.me");
            expect(link.pathname).toBe("/919999999999");
            expect(link.searchParams.get("text")).toBe(t.message);
            expect(link.searchParams.get("text")).not.toMatch(
              /https?:|blob:|shops\//,
            );
            await page.evaluate(() => {
              window.__pdfTest.outcome = "success";
            });
            await page
              .getByRole("button", { name: t.share, exact: true })
              .click();
            await expect(
              page.getByRole("button", { name: t.mark, exact: true }),
            ).toBeEnabled();
            expect(await countMarked()).toBe(before);
            await loseNextReply();
            await page
              .getByRole("button", { name: t.mark, exact: true })
              .click();
            await expect(
              page.getByText(t.unknown, { exact: true }),
            ).toBeVisible();
            await page
              .getByRole("button", { name: t.retry, exact: true })
              .click();
            await expect(page.getByText(t.sent, { exact: true })).toBeVisible();
            expect(await countMarked()).toBe(before + 1);
            await page
              .getByRole("button", { name: t.history, exact: true })
              .click();
            await expect(
              page.getByRole("heading", { name: t.recent }),
            ).toBeVisible();
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            for (const b of await page.getByRole("button").all()) {
              const box = await b.boundingBox();
              if (box) expect(box.height).toBeGreaterThanOrEqual(44);
            }
            await page
              .getByRole("button", { name: t.download, exact: true })
              .focus();
            await expect(
              page.getByRole("button", { name: t.download, exact: true }),
            ).toBeFocused();
            const keyboardDownload = page.waitForEvent("download");
            await page.keyboard.press("Enter");
            expect((await keyboardDownload).suggestedFilename()).toBe(
              `document-${input.docId}-1.pdf`,
            );
            // Native PDF compositing only paints the visible iframe; scrolling
            // it into view avoids a misleading blank full-page capture.
            await page.getByTestId("pdf-preview").scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `.scratch/pdf-sharing-${info.project.name}-${locale}-${theme}.png`,
              fullPage: true,
            });
            for (const viewport of [
              { width: 320, height: 800 },
              ...(info.project.name === "tablet"
                ? [{ width: 1180, height: 820 }]
                : []),
            ]) {
              await page.setViewportSize(viewport);
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth,
                ),
              ).toBe(true);
            }
            await page
              .getByRole("button", { name: "Sign out / switch shop" })
              .click();
            await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
            await expect(
              page.getByText(t.denied, { exact: true }),
            ).toBeVisible();
            expect(await page.evaluate(() => window.__pdfTest.revoked)).toEqual(
              await page.evaluate(() => window.__pdfTest.created),
            );
            expect(
              await page.evaluate(() => ({
                local: localStorage.length,
                session: sessionStorage.length,
              })),
            ).toEqual({ local: 0, session: 0 });
            expect(errors).toEqual([]);
            await page.close();
          }
        const page = await context.newPage();
        await page.clock.install();
        await page.goto(origin);
        const t = sharingMessages.en;
        await page.evaluate(() => {
          window.__pdfTest.capable = false;
        });
        await storageUnavailable(true);
        await page
          .getByRole("button", { name: t.prepare, exact: true })
          .click();
        await expect(page.getByText(t.error, { exact: true })).toBeVisible();
        await storageUnavailable(false);
        await page
          .getByRole("button", { name: t.prepare, exact: true })
          .click();
        await expect(page.getByTestId("pdf-preview")).toBeVisible();
        await expect(
          page.getByRole("button", { name: t.share, exact: true }),
        ).toHaveCount(0);
        await page.clock.fastForward(120001);
        await expect(page.getByText(t.expired, { exact: true })).toBeVisible();
        await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
        await page.clock.resume();
        await delayFile(true);
        const waiting = page.waitForRequest((r) => r.url().endsWith("/file"));
        await page
          .getByRole("button", { name: t.prepare, exact: true })
          .click();
        await waiting;
        await page
          .getByRole("button", { name: "Sign out / switch shop" })
          .click();
        await delayFile(false);
        await expect(page.getByTestId("pdf-preview")).toHaveCount(0);
        await expect(page.getByText(t.denied, { exact: true })).toBeVisible();
        expect(await page.evaluate(() => window.__pdfTest.created.length)).toBe(
          1,
        );
        await page.close();
      } finally {
        await context.close();
      }
    },
  );
});
