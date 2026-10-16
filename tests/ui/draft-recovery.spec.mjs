import { draftMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withDraftWeb } from "../../scripts/test-support/draft-web.mjs";

test.use({ trace: "off", screenshot: "off" });
for (const locale of ["en", "ta"])
  for (const theme of ["light", "dark"]) {
    test(`0.4.2b F1-F8 USE-03/04/08/09 AC-40/55 ${locale}/${theme} real draft recovery`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(180000);
      await withDraftWeb(
        async ({
          origin,
          a,
          admin,
          authorize,
          seedDrafts,
          observations,
          stats,
        }) => {
          const context = await browser.newContext({
            viewport: testInfo.project.use.viewport,
          });
          const cookie = a.cookie.split("; ").map((entry) => {
            const i = entry.indexOf("=");
            return {
              name: entry.slice(0, i),
              value: entry.slice(i + 1),
              url: origin,
              httpOnly: true,
            };
          });
          await context.addCookies(cookie);
          let page = await context.newPage();
          const t = draftMessages[locale];
          async function presentation(target) {
            await expect(target.locator("#value")).toBeVisible();
            if (locale === "ta")
              await target
                .getByRole("button", { name: "English / தமிழ்" })
                .click();
            if (theme === "dark")
              await target
                .getByRole("button", { name: "Theme", exact: true })
                .click();
          }
          const requests = [];
          const promotions = [];
          const lists = [];
          context.on("response", (response) => {
            if (
              new URL(response.url()).pathname.endsWith("/drafts") &&
              response.request().method() === "GET"
            ) {
              void response.json().then(
                (body) => {
                  lists.push({
                    status: response.status(),
                    rows: body.drafts?.length,
                    next: body.next ?? null,
                  });
                },
                () => {},
              );
            }
          });
          context.on("request", (request) => {
            if (request.url().endsWith("/promote"))
              promotions.push({
                key: request.headers()["idempotency-key"],
                version: request.headers()["if-match"],
                body: request.postDataJSON(),
              });
            if (request.method() === "PUT")
              requests.push({
                body: request.postDataJSON(),
                key: request.headers()["idempotency-key"],
                version: request.headers()["if-match"],
              });
          });
          try {
            await page.goto(origin);
            await presentation(page);
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            if (testInfo.project.name === "desktop" && locale === "en")
              await page.screenshot({
                path: `.scratch/draft-desktop-en-${theme}-editable.png`,
                fullPage: true,
              });
            await page.locator("#value").dispatchEvent("compositionstart");
            await page.locator("#value").fill("previous-controller-private");
            const replaceWarning = page.waitForEvent("dialog");
            const replacing = page
              .getByRole("button", { name: "New form", exact: true })
              .click();
            await (await replaceWarning).accept();
            await replacing;
            await expect(page.locator("#value")).toHaveValue("");
            expect(new URL(page.url()).searchParams.has("draft")).toBe(false);
            await page.locator("#value").dispatchEvent("compositionstart");
            await page.locator("#value").fill("தமிழ் சோதனை");
            const navigationWarning = page.waitForEvent("dialog");
            const navigation = page
              .getByRole("link", { name: "Leave form" })
              .click();
            const warning = await navigationWarning;
            expect(warning.message()).toBe(t.warning);
            await warning.dismiss();
            await navigation;
            expect(new URL(page.url()).searchParams.has("leave")).toBe(false);
            await page.waitForTimeout(1200);
            expect(requests).toHaveLength(0);
            let loseSave = true;
            await page.route("**/api/shops/*/drafts/*", async (route) => {
              if (route.request().method() === "PUT" && loseSave) {
                loseSave = false;
                await route.fetch();
                await route.abort("failed");
              } else await route.continue();
            });
            await page.locator("#value").dispatchEvent("compositionend");
            await expect(page.getByRole("status")).toHaveText(t.checking);
            expect(new URL(page.url()).searchParams.has("draft")).toBe(false);
            await page.locator("#value").fill("later-தமிழ்");
            await page.getByRole("button", { name: t.retry }).click();
            await expect(page.getByRole("status")).toHaveText(t.saved);
            await expect.poll(() => requests.length).toBe(3);
            expect(requests[1]).toEqual(requests[0]);
            expect(requests[2].key).not.toBe(requests[0].key);
            expect(requests[2].body.payload.value).toBe("later-தமிழ்");
            const savedUrl = page.url();
            const id = new URL(savedUrl).searchParams.get("draft");
            expect(id).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]+$/);
            expect(savedUrl).not.toContain("தமிழ்");
            await expect(page.getByTestId("update-guard")).toHaveText(
              "Update safe",
            );
            await context.setOffline(true);
            await page.locator("#value").fill("unsaved-offline");
            await expect(page.getByRole("status")).toHaveText(t.checking);
            await expect(page.locator("#value")).toHaveValue("unsaved-offline");
            await expect(page.getByTestId("update-guard")).toHaveText(
              "Update blocked",
            );
            // Hold failed edits across reconnect/reload: only already committed
            // values can reappear in a fresh page, never its in-memory pending key.
            await context.route("**/api/shops/*/drafts/*", (route) =>
              route.request().method() === "PUT"
                ? route.abort()
                : route.continue(),
            );
            await context.setOffline(false);
            await page.close();
            page = await context.newPage();
            await page.goto(savedUrl);
            await presentation(page);
            await expect(page.locator("#value")).toHaveValue("later-தமிழ்");
            await seedDrafts(26);
            await page
              .getByRole("button", { name: t.resume, exact: true })
              .click();
            const resume = page.getByRole("region", { name: t.resume });
            try {
              await expect(resume.getByRole("listitem")).toHaveCount(25);
            } catch (error) {
              console.info(
                `Synthetic pagination failure metadata: ${JSON.stringify({ observations, lists, database: await stats() })}`,
              );
              throw error;
            }
            console.info(
              `Synthetic pagination response metadata: ${JSON.stringify({ observations, lists })}`,
            );
            await resume
              .getByRole("button", { name: t.more, exact: true })
              .click();
            await expect(resume.getByRole("listitem")).toHaveCount(27);
            await expect(
              resume.getByRole("button", { name: t.more, exact: true }),
            ).toHaveCount(0);
            await expect(
              resume.getByRole("button", { name: t.open, exact: true }).first(),
            ).toBeVisible();
            await resume
              .getByRole("button", { name: t.open, exact: true })
              .first()
              .focus();
            await expect(
              resume.getByRole("button", { name: t.open, exact: true }).first(),
            ).toBeFocused();
            await page.keyboard.press("Enter");
            await expect(page.locator("#value")).toHaveValue("later-தமிழ்");
            await context.unroute("**/api/shops/*/drafts/*");
            page.on("dialog", (dialog) => dialog.accept());
            await page.reload();
            await presentation(page);
            await expect(page.locator("#value")).toHaveValue("later-தமிழ்");
            // Another browser context sees only server records and advances ETag.
            const second = await browser.newContext({
              viewport: testInfo.project.use.viewport,
            });
            try {
              await second.addCookies(cookie);
              const device = await second.newPage();
              await device.goto(savedUrl);
              await presentation(device);
              await expect(device.locator("#value")).toHaveValue("later-தமிழ்");
              await device.locator("#value").fill("beta");
              await expect(device.getByRole("status")).toHaveText(t.saved);
              await device
                .getByRole("button", { name: "End access", exact: true })
                .click();
              await expect(device.getByRole("status")).toHaveText(t.denied);
              await expect(device.locator("#value")).toHaveCount(0);
            } finally {
              await second.close();
            }
            await page.locator("#value").fill("my-local-input");
            await expect(page.getByRole("status")).toHaveText(t.conflict);
            await expect(page.locator("#value")).toHaveValue("my-local-input");
            await expect(
              page.getByRole("region", { name: t.current }),
            ).toContainText("beta");
            if (testInfo.project.name === "phone" && locale === "ta")
              await page.screenshot({
                path: `.scratch/draft-phone-ta-${theme}-conflict.png`,
                fullPage: true,
              });
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            await page.getByRole("button", { name: t.server }).click();
            await expect(page.locator("#value")).toHaveValue("beta");
            await page.locator("#value").fill("alpha");
            await page.locator("#amount").fill("100");
            await page.locator("#measurement").fill("25");
            await expect(page.getByRole("status")).toHaveText(t.saved);
            await page
              .getByRole("button", { name: t.promote, exact: true })
              .click();
            await expect(page.getByRole("status")).toHaveText(t.saved);
            await expect(page.locator("main").getByRole("alert")).toHaveText(
              t.promotionFailed,
            );
            await authorize(id);
            let lostPromotion = true;
            await page.route("**/promote", async (route) => {
              if (lostPromotion) {
                lostPromotion = false;
                await route.fetch();
                await route.abort();
              } else await route.continue();
            });
            await page
              .getByRole("button", { name: t.promote, exact: true })
              .click();
            await expect(page.getByRole("status")).toHaveText(t.checking);
            await expect(page.locator("#value")).toBeDisabled();
            await page.getByRole("button", { name: t.retry }).click();
            await expect(page.getByRole("status")).toHaveText(t.promoted);
            expect(promotions).toHaveLength(3);
            expect(promotions[2]).toEqual(promotions[1]);
            expect(promotions[1].key).not.toBe(promotions[0].key);
            await expect(
              page.getByRole("button", { name: t.promote, exact: true }),
            ).toBeDisabled();
            expect(
              (
                await admin.query(
                  "select count(*)::int as count from draft_synthetic_result where shop_id=$1 and draft_id=$2",
                  [a.shop, id],
                )
              ).rows[0].count,
            ).toBe(1);
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.screenshot({
              path: `.scratch/draft-${testInfo.project.name}-${locale}-${theme}.png`,
              fullPage: true,
            });
            const storage = await page.evaluate(async () => ({
              local: { ...localStorage },
              session: { ...sessionStorage },
              dbs: await indexedDB.databases(),
              caches: await caches.keys(),
            }));
            expect(storage).toEqual({
              local: {},
              session: {},
              dbs: [],
              caches: [],
            });
            // Actual server denial clears all local and cached values.
            await page.goto(origin);
            await presentation(page);
            await page.locator("#value").fill("access-loss-private");
            await admin.query("delete from auth_session where user_id=$1", [
              a.user,
            ]);
            await expect(page.getByRole("status")).toHaveText(t.denied);
            await expect(page.locator("#value")).toHaveCount(0);
            await expect(page.getByTestId("update-guard")).toHaveText(
              "Update safe",
            );
            await page.goto("about:blank");
          } finally {
            await context.close();
          }
        },
      );
    });
  }
