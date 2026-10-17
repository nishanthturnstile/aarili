import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { mediaMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withMediaWeb } from "../../scripts/test-support/media-web.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("SS-01/07/10 configured private logo preparation, processing, attach and historical retention", async ({
  browser,
}, info) => {
  test.setTimeout(240000);
  await withMediaWeb(
    async (f) => {
      const context = await browser.newContext({
        viewport: info.project.use.viewport,
      });
      await context.addCookies(
        f.a.cookie.split("; ").map((c) => {
          const i = c.indexOf("=");
          return {
            name: c.slice(0, i),
            value: c.slice(i + 1),
            url: f.origin,
            httpOnly: true,
          };
        }),
      );
      try {
        const page = await context.newPage();
        await page.goto(`${f.origin}/settings`);
        await expect(page.locator("#private-file")).toBeVisible();
        const sharp = createRequire(
          new URL("../../packages/platform/package.json", import.meta.url),
        )("sharp");
        const pixels = await sharp({
          create: { width: 90, height: 90, channels: 3, background: "white" },
        })
          .png()
          .toBuffer();
        await page.locator("#private-file").setInputFiles({
          name: "synthetic-logo.png",
          mimeType: "image/png",
          buffer: pixels,
        });
        await expect(
          page.getByRole("button", { name: "Review changes", exact: true }),
        ).toBeDisabled();
        await page
          .getByRole("button", { name: mediaMessages.en.upload, exact: true })
          .click();
        await expect
          .poll(
            async () => {
              const attach = page.getByRole("button", {
                name: "Use validated logo",
                exact: true,
              });
              if (await attach.isVisible()) return true;
              const refresh = page.getByRole("button", {
                name: mediaMessages.en.refresh,
                exact: true,
              });
              if (await refresh.isVisible()) await refresh.click();
              return false;
            },
            { timeout: 20000 },
          )
          .toBe(true);
        await page
          .getByRole("button", { name: "Use validated logo", exact: true })
          .click();
        await prepareOwnerScreen(page, "ta", true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await prepareOwnerScreen(page, "en", false);
        await page
          .getByRole("button", { name: "Review changes", exact: true })
          .click();
        await expect(
          page.locator("#profile-review").locator(".."),
        ).toContainText("validated private logo");
        await page
          .getByRole("button", { name: "Apply to new activity", exact: true })
          .click();
        await expect(
          page
            .locator(".shop-settings-main [role=status]")
            .filter({ hasText: "Profile saved" }),
        ).toBeVisible();
        const api = `${f.origin}/api/shops/${f.a.shop}/settings/profile`,
          saved = await (await page.request.get(api)).json();
        expect(saved.profile.logoAssetId).toBeTruthy();
        await page
          .getByRole("button", {
            name: "Remove logo from the new profile",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Review changes", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Apply to new activity", exact: true })
          .click();
        await expect
          .poll(
            async () =>
              (await (await page.request.get(api)).json()).profile.logoAssetId,
          )
          .toBeNull();
        const old = await page.request.get(
          `${api}/revisions/${saved.revision.id}`,
        );
        expect((await old.json()).profile.logoAssetId).toBe(
          saved.profile.logoAssetId,
        );
      } finally {
        await context.close();
      }
    },
    { surface: "shop-profile" },
  );
});
test("SS-01/07/08/10 profile review, lost-response replay, history, bilingual reflow, conflict and private-memory clearing", async ({
  page,
  context,
}, info) => {
  test.setTimeout(240000);
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    expect(
      (
        await page.request.get(`${origin}/settings`, { maxRedirects: 0 })
      ).headers().location,
    ).toContain("/sign-in");
    const password = "synthetic-profile-84-owner-password";
    expect(
      (
        await post(
          "/owner/setup",
          {
            name: "Synthetic profile owner",
            email: "profile@example.test",
            password,
          },
          {
            "X-Setup-Token": setupToken,
            "Idempotency-Key": crypto.randomUUID(),
          },
        )
      ).status(),
    ).toBe(200);
    expect((await post("/owner/verify", { code: await code() })).status()).toBe(
      200,
    );
    expect(
      (
        await post("/auth/sign-in/email", {
          email: "profile@example.test",
          password,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.get(`${origin}/settings`, { maxRedirects: 0 })
      ).headers().location,
    ).toContain("/onboarding");
    expect(
      (
        await post(
          "/owner/complete",
          { shopName: "Synthetic starting shop" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const { shopId } = await (
      await page.request.get(`${origin}/api/owner/shop`)
    ).json();
    const api = `${origin}/api/shops/${shopId}/settings/profile`;
    await page.goto(`${origin}/dashboard`);
    await page
      .getByRole("link", { name: "Shop settings", exact: true })
      .click();
    await expect(page.locator("#shop-displayName")).toHaveValue(
      "Synthetic starting shop",
    );
    await page.locator("#shop-displayName").fill("");
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await expect(page.locator("#shop-displayName")).toBeFocused();
    await expect(page.locator("#shop-displayName")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const name = "Synthetic profile தமிழ் 84";
    await page.locator("#shop-displayName").fill(name);
    await page
      .locator("#shop-tagline")
      .fill("Synthetic-private-profile-canary");
    for (const locale of ["ta", "en"]) {
      await prepareOwnerScreen(page, locale);
      await expect(page.locator("#shop-displayName")).toHaveValue(name);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await prepareOwnerScreen(page, "en", false);
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#profile-review")).toBeFocused();
    let drop = true;
    const keys = [];
    await page.route(api, async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      if (drop) {
        drop = false;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        return route.abort("failed");
      }
      return route.continue();
    });
    await page
      .getByRole("button", { name: "Apply to new activity", exact: true })
      .click();
    await expect(
      page.locator(".shop-settings-main [role=alert]"),
    ).toContainText("Save is unconfirmed");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Profile saved");
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await page.unroute(api);
    await expect(page.locator(".workspace-current-shop strong")).toHaveText(
      name,
    );
    await page.reload();
    await expect(page.locator("#shop-displayName")).toHaveValue(name);
    await page
      .getByRole("button", { name: "Profile history", exact: true })
      .click();
    await expect(page.locator(".shop-profile-history details")).toHaveCount(2);
    await page.locator(".shop-profile-history summary").last().click();
    await expect(
      page.locator(".shop-profile-history details").last(),
    ).toContainText("Synthetic starting shop");
    const saved = await (await page.request.get(api)).json();
    expect(
      (
        await page.request.put(api, {
          data: {
            ...saved.profile,
            tagline: "Synthetic competing saved change",
          },
          headers: {
            Origin: origin,
            "Idempotency-Key": crypto.randomUUID(),
            "If-Match": `"v${saved.version}"`,
          },
        })
      ).status(),
    ).toBe(200);
    await page
      .locator("#shop-tagline")
      .fill("Synthetic proposal kept for comparison");
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply to new activity", exact: true })
      .click();
    await expect(
      page.locator(".shop-settings-main [role=alert]"),
    ).toContainText("saved profile changed");
    await expect(page.locator(".shop-conflict")).toContainText(
      "Synthetic competing saved change",
    );
    await expect(page.locator(".shop-conflict")).toContainText(
      "Synthetic proposal kept for comparison",
    );
    await page
      .getByRole("button", { name: "Load saved version", exact: true })
      .click();
    await expect(page.locator("#shop-tagline")).toHaveValue(
      "Synthetic competing saved change",
    );
    await page.locator("#shop-tagline").fill("Synthetic cancelled draft");
    const dismiss = (dialog) => dialog.accept();
    page.on("dialog", dismiss);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    page.off("dialog", dismiss);
    await expect(page.locator("#shop-tagline")).toHaveValue(
      "Synthetic competing saved change",
    );
    await page
      .getByRole("button", { name: "Profile history", exact: true })
      .click();
    await prepareOwnerScreen(page, "ta", true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await mkdir("test-results/shop-profile", { recursive: true });
    await page.screenshot({
      path: `test-results/shop-profile/${info.project.name}-ta.png`,
      fullPage: true,
    });
    await prepareOwnerScreen(page, "en", false);
    await page.screenshot({
      path: `test-results/shop-profile/${info.project.name}-en.png`,
      fullPage: true,
    });
    await expectStaticPwaStorage(page);
    const storage = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    );
    expect(storage).not.toContain("Synthetic");
    await context.clearCookies();
    await page.reload();
    await expect(page).toHaveURL(`${origin}/sign-in`);
    await expect(page.locator("body")).not.toContainText(name);
  });
});
