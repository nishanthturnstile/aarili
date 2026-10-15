import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) await page.goto("about:blank");
});
const password = "synthetic-owner-shell-password-51";
const shopName = "ஆரிலி திருமண ஆடைகள் மற்றும் தனிப்பயன் தையல் நிலையம்";

for (const locale of ["en", "ta"])
  test(`0.4.1a A1–A7 USE-01/02/09 TRU-01 ${locale} responsive owner navigation and failed-logout clearing`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await withOwnerWeb(
      async ({ origin, setupToken, code }) => {
        const post = (path, data, headers = {}) =>
          page.request.post(`${origin}/api${path}`, {
            headers: { Origin: origin, ...headers },
            data,
          });
        expect(
          (
            await post(
              "/owner/setup",
              {
                name: "Synthetic shell owner",
                email: "owner@example.test",
                password,
                shopName,
              },
              {
                "X-Setup-Token": setupToken,
                "Idempotency-Key": crypto.randomUUID(),
              },
            )
          ).status(),
        ).toBe(200);
        expect(
          (await post("/owner/verify", { code: await code() })).status(),
        ).toBe(200);
        expect(
          (
            await post("/auth/sign-in/email", {
              email: "owner@example.test",
              password,
            })
          ).status(),
        ).toBe(200);
        expect((await post("/owner/complete", {})).status()).toBe(200);

        const start = performance.now();
        await page.goto(`${origin}/owner`);
        const nav = page.locator(".workspace-navigation");
        await expect(nav).toBeVisible();
        const firstUsableMilliseconds = Math.round(performance.now() - start);
        async function presentation(dark) {
          await expect(page.locator("main")).toHaveAttribute(
            "data-owner-ready",
            "true",
          );
          if (
            locale === "ta" &&
            (await page.locator("main").getAttribute("lang")) !== "ta"
          )
            await page
              .getByRole("button", { name: "தமிழ்", exact: true })
              .click();
          const isDark = await page
            .locator("html")
            .evaluate((node) => node.classList.contains("dark"));
          if (isDark !== dark)
            await page
              .getByRole("button", {
                name:
                  locale === "en"
                    ? dark
                      ? "Use dark theme"
                      : "Use light theme"
                    : dark
                      ? "இருண்ட தோற்றம்"
                      : "வெளிர் தோற்றம்",
                exact: true,
              })
              .click();
          await page.evaluate(() => document.fonts.ready);
        }
        const captures = ".scratch/phase-0.4-shell/captures";
        await mkdir(captures, { recursive: true });
        for (const dark of [false, true]) {
          await presentation(dark);
          await expect(nav.locator("a")).toHaveCount(2);
          await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute(
            "href",
            "/owner",
          );
          for (const link of await nav.locator("a").all()) {
            const box = await link.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
          }
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (info.project.name === "phone") {
            await expect(nav.getByRole("button")).toBeHidden();
            expect(
              await nav.evaluate((node) => getComputedStyle(node).position),
            ).toBe("fixed");
          } else if (info.project.name === "tablet") {
            const toggle = nav.getByRole("button");
            await toggle.click();
            await expect(toggle).toHaveAttribute("aria-expanded", "true");
            await expect(nav.locator("strong")).toHaveText(shopName);
            await page.setViewportSize({ width: 1180, height: 820 });
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.screenshot({
              path: `${captures}/tablet-landscape-${locale}-${dark ? "dark" : "light"}.png`,
              fullPage: true,
            });
            await page.setViewportSize({ width: 820, height: 1180 });
            await toggle.click();
            await expect(toggle).toHaveAttribute("aria-expanded", "false");
          } else {
            await expect(nav.locator("strong")).toHaveText(shopName);
            await expect(nav.getByRole("button")).toBeHidden();
          }
          await page.screenshot({
            path: `${captures}/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
            fullPage: true,
          });
          if (info.project.name === "phone") {
            // A full-page screenshot stitches fixed navigation at the original
            // viewport bottom. Verify the actual scrolled footer stays usable.
            const footer = page.locator(".owner-footer");
            await page.evaluate(() =>
              window.scrollTo(0, document.documentElement.scrollHeight),
            );
            const footerBox = await footer.boundingBox();
            const navBox = await nav.boundingBox();
            expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
              navBox.y,
            );
            await page.screenshot({
              path: `${captures}/phone-${locale}-${dark ? "dark" : "light"}-bottom.png`,
              fullPage: false,
            });
            await page.evaluate(() => window.scrollTo(0, 0));
          }
        }

        // Skip navigation has real keyboard behavior, including phone bottom nav.
        await page.keyboard.press("Control+Home");
        await page.locator(".owner-skip-link").focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("h1")).toBeFocused();
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          document.documentElement.style.removeProperty("font-size");
        });

        const warmStart = performance.now();
        await nav.locator('a[href="/connections"]').click();
        await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute(
          "href",
          "/connections",
        );
        await expect(page.locator("main")).toHaveAttribute("lang", "en");
        const warmNavigationMilliseconds = Math.round(
          performance.now() - warmStart,
        );
        await presentation(false);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          locale === "en" ? "Sign-in connections" : "உள்நுழைவு இணைப்புகள்",
        );
        await nav.locator('a[href="/owner"]').click();
        await expect(nav).toBeVisible();
        await expect(page.locator("main")).toHaveAttribute("lang", "en");

        // A rejected sign-out still clears private state before the response.
        await page.route("**/api/auth/sign-out", (route) =>
          route.abort("failed"),
        );
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(nav).toHaveCount(0);
        await expect(page.locator("main")).not.toContainText(shopName);
        await expect(page.locator("main").getByRole("alert")).toBeVisible();
        expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
          "aarili-appearance",
        ]);
        expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
        expect(await page.evaluate(() => caches.keys())).toEqual([]);
        expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
        await writeFile(
          `.scratch/phase-0.4-shell/${info.project.name}-${locale}-timings.json`,
          JSON.stringify(
            {
              profile:
                "desktop Chromium emulation; not a physical-device result",
              firstUsableMilliseconds,
              warmNavigationMilliseconds,
            },
            null,
            2,
          ),
        );
      },
      { secrets: [password], onFailure: () => page.goto("about:blank") },
    );
  });
