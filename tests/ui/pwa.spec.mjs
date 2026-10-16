import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { withPwaHost } from "../../scripts/test-support/pwa-host.mjs";

test.use({ trace: "off", screenshot: "off" });
const safe = { dirty: false, inFlight: false, outcomeUnknown: false };
async function cacheContents(page) {
  return page.evaluate(async () => {
    const result = {};
    for (const name of await caches.keys())
      result[name] = (await (await caches.open(name)).keys())
        .map((r) => new URL(r.url).pathname)
        .sort();
    return result;
  });
}

test("0.4.1b B2–B6 USE-03/04 AC-40 real worker caches, bilingual offline fallback, guarded updates and next launch", async ({
  page,
  context,
}, info) => {
  await mkdir(".scratch/pwa/captures", { recursive: true });
  await withPwaHost(async ({ origin, config }) => {
    await page.goto(`${origin}/setup`);
    expect(await page.evaluate(() => isSecureContext)).toBe(true);
    await expect(page.locator("#state")).toHaveText("ready");
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const allowed = [
      "/offline.html",
      "/pwa/latin.woff2",
      "/pwa/offline.css",
      "/pwa/tamil.woff2",
    ];
    expect(await cacheContents(page)).toEqual({ "aarili-offline-v1": allowed });
    await page.evaluate(async () => {
      for (const path of [
        "/api/owner/shop",
        "/api/auth/get-session",
        "/files/private.pdf",
        "/private/photo.webp",
        "/signed?token=synthetic",
      ])
        await (await fetch(path)).text();
      await caches.open("unrelated-cache");
      await caches.open("aarili-offline-stale");
    });
    await page.locator("#value").fill("ஆரிலி தையல்");
    config.revision = 2;
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration()).update(),
    );
    await expect(page.locator("#state")).toHaveText("waiting");
    await expect(page.locator("#update")).toBeEmpty();
    const other = await context.newPage();
    await other.goto(`${origin}/setup`);
    for (const flag of ["inFlight", "outcomeUnknown"]) {
      await page.evaluate(
        ({ safe, flag }) => window.host.set({ ...safe, [flag]: true }),
        { safe, flag },
      );
      await expect(page.locator("#update")).toBeEmpty();
    }
    for (const lang of ["en", "ta"]) {
      await page.evaluate(
        ({ safe, lang }) => {
          window.host.set(safe);
          window.host.language(lang);
        },
        { safe, lang },
      );
      await expect(page.locator("#update")).not.toBeEmpty();
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme });
        await other.emulateMedia({ colorScheme });
        await context.setOffline(true);
        await expect(page.locator("#value")).toHaveValue("ஆரிலி தையல்");
        expect(
          await page.evaluate(async () => {
            const paths = [
              "/api/owner/shop",
              "/files/private.pdf",
              "/signed?token=synthetic",
            ];
            return Promise.all(
              paths.map((path) =>
                fetch(path).then(
                  () => false,
                  () => true,
                ),
              ),
            );
          }),
        ).toEqual([true, true, true]);
        await other.goto(`${origin}/owner`);
        await expect(
          other.getByRole("heading", { name: "You are offline" }),
        ).toBeVisible();
        await expect(
          other.getByRole("heading", { name: "இணைய இணைப்பு இல்லை" }),
        ).toBeVisible();
        expect(
          (await new AxeBuilder({ page: other }).analyze()).violations,
        ).toEqual([]);
        expect(
          await other.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (lang === "ta")
          await other.screenshot({
            path: `.scratch/pwa/captures/${info.project.name}-fallback-${colorScheme}.png`,
            fullPage: true,
          });
        expect(await other.locator("body").textContent()).not.toContain(
          "must-not-cache",
        );
        await context.setOffline(false);
        await other
          .getByRole("link", { name: "Try connecting again", exact: true })
          .click();
        await expect(other.locator("#state")).toHaveText("waiting");
      }
    }
    expect(await cacheContents(page)).toEqual({
      "aarili-offline-v1": allowed,
      "aarili-offline-v2": allowed,
      "aarili-offline-stale": [],
      "unrelated-cache": [],
    });
    await page.close();
    // Another controlled tab, even a clean one, prevents forced activation.
    expect(
      await other.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration()).waiting),
      ),
    ).toBe(true);
    await other.close();
    const reopened = await context.newPage();
    await reopened.goto(`${origin}/setup`);
    await expect(reopened.locator("#state")).toHaveText("ready");
    await expect
      .poll(() => cacheContents(reopened))
      .toEqual({ "aarili-offline-v2": allowed, "unrelated-cache": [] });
    expect(
      await reopened.evaluate(() => ({
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
      })),
    ).toEqual({ local: [], session: [] });
    expect(await reopened.evaluate(async () => indexedDB.databases())).toEqual(
      [],
    );
    await reopened.close();
  });
});

test("0.4.1b B5 denied registration and partial first install fail visibly and retry safely", async ({
  page,
}) => {
  await withPwaHost(async ({ origin, config }) => {
    config.denyWorker = true;
    await page.goto(`${origin}/setup`);
    await expect(page.locator("#state")).toHaveText("unavailable");
    config.denyWorker = false;
    config.failAsset = true;
    await page.locator("#retry").click();
    await expect(page.locator("#state")).toHaveText("unavailable");
    expect(await cacheContents(page)).toEqual({});
    config.failAsset = false;
    await page.locator("#retry").click();
    await expect(page.locator("#state")).toHaveText("ready");
    await page.goto("about:blank");
  });
});

test("0.4.1b B1/B3/B6 installed start remains authorised and live owner forms survive reconnect in both languages/themes", async ({
  page,
  context,
}, info) => {
  await mkdir(".scratch/pwa/captures", { recursive: true });
  test.setTimeout(120000);
  page.on("dialog", (dialog) => dialog.accept());
  await withOwnerWeb(
    async ({ origin }) => {
      const manifest = await (
        await page.request.get(`${origin}/manifest.webmanifest`)
      ).json();
      expect(manifest).toMatchObject({
        start_url: "/owner",
        display: "standalone",
        scope: "/",
      });
      expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(
        true,
      );
      for (const icon of manifest.icons)
        expect((await page.request.get(`${origin}${icon.src}`)).status()).toBe(
          200,
        );
      expect(
        (await page.request.get(`${origin}/sw.js`)).headers()["cache-control"],
      ).toContain("no-store");
      await page.goto(`${origin}${manifest.start_url}`);
      await expect(page.locator(".workspace-navigation")).toHaveCount(0);
      await expect(
        page.locator('.owner-footer a[href="/sign-in"]'),
      ).toBeVisible();
      await page.goto(`${origin}/setup`);
      await page.locator("#shopName").fill("ஆரிலி தையல்");
      for (const lang of ["en", "ta"]) {
        if (lang === "ta")
          await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
        for (const theme of ["light", "dark"]) {
          const isDark = await page
            .locator("html")
            .evaluate((node) => node.classList.contains("dark"));
          if (isDark !== (theme === "dark"))
            await page
              .getByRole("button", {
                name:
                  lang === "en"
                    ? theme === "dark"
                      ? "Use dark theme"
                      : "Use light theme"
                    : theme === "dark"
                      ? "இருண்ட தோற்றம்"
                      : "வெளிர் தோற்றம்",
                exact: true,
              })
              .click();
          await context.setOffline(true);
          await expect(page.locator(".pwa-notice")).toContainText(
            lang === "en" ? "Reconnect to continue" : "தொடர இணையத்தை",
          );
          await expect(page.locator("#shopName")).toHaveValue("ஆரிலி தையல்");
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          if (lang === "ta")
            await page.screenshot({
              path: `.scratch/pwa/captures/${info.project.name}-live-tamil-${theme}.png`,
              fullPage: true,
            });
          await context.setOffline(false);
          await expect(page.locator(".pwa-notice")).toContainText(
            lang === "en" ? "Connection restored" : "இணைய இணைப்பு திரும்பியுள்ளது",
          );
        }
      }
      // Serve the real production React surface through a test-only proxy so
      // worker update/failure bytes can change without adding a runtime route.
      await withPwaHost(
        async ({ origin: proxyOrigin, config }) => {
          config.denyWorker = true;
          await page.goto(`${proxyOrigin}/setup`);
          await expect(page.locator(".pwa-notice")).toContainText(
            "Installation and offline notice are unavailable",
          );
          config.denyWorker = false;
          await page
            .getByRole("button", { name: "Retry installation setup" })
            .click();
          await page.evaluate(() => navigator.serviceWorker.ready);
          await expect(page.locator(".pwa-notice")).toBeEmpty();
          await page.reload();
          await page.locator("#shopName").fill("ஆரிலி தையல்");
          config.revision = 2;
          await page.evaluate(async () =>
            (await navigator.serviceWorker.getRegistration()).update(),
          );
          await page.waitForFunction(async () =>
            Boolean((await navigator.serviceWorker.getRegistration()).waiting),
          );
          await expect(page.locator(".pwa-notice")).toBeEmpty();
          await expect(page.locator("#shopName")).toHaveValue("ஆரிலி தையல்");
          await page.locator("form").evaluate((form) => form.reset());
          await expect(page.locator(".pwa-notice")).toContainText(
            "An update is ready",
          );
          await page.goto("about:blank");
        },
        { upstreamOrigin: origin },
      );
      await page.goto("about:blank");
    },
    { onFailure: () => page.goto("about:blank") },
  );
});
