import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readEntryRedirect } from "../../scripts/test-support/entry-redirect.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("ENTRY-01–12 authoritative entry, interrupted onboarding, direct links, cross-tab sign-out and responsive preview", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  const password = "synthetic-entry-owner-password-17";
  await withOwnerWeb(
    async ({
      origin,
      setupToken,
      code,
      revokeOwnerMembership,
      stopDatabase,
    }) => {
      const redirect = async (path, destination) => {
        const response = await readEntryRedirect(
          page.request,
          `${origin}${path}`,
        );
        expect(response.status()).toBe(307);
        expect(new URL(response.headers().location, origin).pathname).toBe(
          destination,
        );
        expect(response.headers()["cache-control"]).toContain("no-store");
        expect(await response.text()).not.toContain("workspace-navigation");
      };
      for (const path of [
        "/",
        "/owner",
        "/dashboard",
        "/onboarding",
        "/connections",
      ])
        await redirect(path, "/sign-in");
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      expect(
        (
          await post(
            "/owner/setup",
            { name: "Meena", email: "owner@example.test", password },
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
      // Verification alone has no session and cannot bypass the page boundary.
      await redirect("/dashboard", "/sign-in");
      expect(
        (
          await post("/auth/sign-in/email", {
            email: "owner@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      for (const path of [
        "/",
        "/owner",
        "/dashboard",
        "/connections",
        "/sign-in",
        "/setup",
      ])
        await redirect(path, "/onboarding");
      await page.goto(`${origin}/dashboard`);
      await expect(page).toHaveURL(`${origin}/onboarding`);
      await expect(page.locator(".workspace-navigation")).toHaveCount(0);
      await expect(page.locator(".entry-identity")).toContainText("Meena");
      await expect(page.locator("#token")).toHaveCount(0);
      await page.locator("#shopName").fill("Unsubmitted shop");
      const returning = await context.newPage();
      await page.close();
      page = returning;
      await page.goto(`${origin}/dashboard`);
      await expect(page).toHaveURL(`${origin}/onboarding`);
      await expect(page.locator("#shopName")).toHaveValue("");
      await page.locator("#shopName").fill("Meena தையல் நிலையம்");
      for (const locale of ["en", "ta"])
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          await expect(page.locator("#shopName")).toHaveValue(
            "Meena தையல் நிலையம்",
          );
          await expect(page.locator(".entry-shop-preview h3")).toHaveText(
            "Meena தையல் நிலையம்",
          );
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          for (const width of [320, 390, 768, 1024, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `${locale} ${dark} ${width}`,
            ).toBe(true);
          }
          await page.setViewportSize(info.project.use.viewport);
          await page.evaluate(async () => {
            await document.fonts.ready;
            window.scrollTo(0, 0);
          });
          expect(
            (await page.locator("header").boundingBox()).y,
          ).toBeGreaterThanOrEqual(0);
          await page.screenshot({
            path: `.scratch/owner-entry-preview/captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}-onboarding.png`,
            fullPage: true,
          });
        }
      await prepareOwnerScreen(page, "en", false);
      const another = await context.newPage();
      await another.goto(`${origin}/onboarding`);
      await expect(another.locator("#shopName")).toBeVisible();
      await page.locator('form button[type="submit"]').click();
      await expect(page).toHaveURL(`${origin}/dashboard`);
      await expect(page.locator("h1")).toHaveText("Meena தையல் நிலையம்");
      for (const locale of ["en", "ta"])
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          for (const width of [320, 390, 768, 1024, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `dashboard ${locale} ${dark} ${width}`,
            ).toBe(true);
          }
          await page.setViewportSize(info.project.use.viewport);
          await page.evaluate(async () => {
            await document.fonts.ready;
            window.scrollTo(0, 0);
          });
          expect(
            (await page.locator("header").boundingBox()).y,
          ).toBeGreaterThanOrEqual(0);
          await page.screenshot({
            path: `.scratch/owner-entry-preview/captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}-dashboard.png`,
            fullPage: true,
          });
        }
      await prepareOwnerScreen(page, "en", false);
      await another.reload();
      await expect(another).toHaveURL(`${origin}/dashboard`);
      for (const path of ["/", "/owner", "/sign-in", "/setup", "/onboarding"])
        await redirect(path, "/dashboard");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/sign-in`);
      await expect(another).toHaveURL(`${origin}/sign-in`);
      await expect(another.locator("main")).not.toContainText(
        "Meena தையல் நிலையம்",
      );
      await page.goBack();
      await expect(page).toHaveURL(`${origin}/sign-in`);
      await expect(page.locator("main")).not.toContainText("Meena தையல் நிலையம்");
      await another.close();
      expect(
        (
          await post("/auth/sign-in/email", {
            email: "owner@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      await revokeOwnerMembership();
      expect(
        (await page.request.get(`${origin}/api/owner/entry`)).status(),
      ).toBe(403);
      await redirect("/dashboard", "/entry-denied");
      await page.goto(`${origin}/dashboard`);
      await expect(page).toHaveURL(`${origin}/entry-denied`);
      await expect(page.locator("h1")).toHaveText("Shop access is unavailable");
      await expect(page.locator(".workspace-navigation")).toHaveCount(0);
      await expect(page.locator("#shopName")).toHaveCount(0);
      await stopDatabase();
      expect(
        (await page.request.get(`${origin}/api/owner/entry`)).status(),
      ).toBe(503);
      await redirect("/dashboard", "/entry-unavailable");
      await page.goto(`${origin}/dashboard`);
      await expect(page).toHaveURL(`${origin}/entry-unavailable`);
      await expect(page.locator("h1")).toHaveText(
        "We couldn’t check your access",
      );
      await expect(page.locator("#shopName")).toHaveCount(0);
      await page.goto("about:blank");
    },
    {
      secrets: [password],
      onFailure: () => (page.isClosed() ? undefined : page.goto("about:blank")),
    },
  );
});
