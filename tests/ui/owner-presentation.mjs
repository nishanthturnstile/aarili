import { expect } from "@playwright/test";

// The only new persistent content allowed by 0.4.1b is the static fallback.
// Keep this an exact allowlist, including the worker scope, rather than merely
// permitting arbitrary Aarili-named caches after sign-out or access loss.
export async function expectStaticPwaStorage(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(
    await page.evaluate(async () => {
      const cachesFound = {};
      for (const name of await caches.keys())
        cachesFound[name] = (await (await caches.open(name)).keys())
          .map((request) => new URL(request.url).pathname)
          .sort();
      return {
        caches: cachesFound,
        workers: (await navigator.serviceWorker.getRegistrations()).map(
          (registration) => ({
            scope: registration.scope,
            script: registration.active?.scriptURL,
          }),
        ),
        databases: await indexedDB.databases(),
      };
    }),
  ).toEqual({
    caches: {
      "aarili-offline-v1": [
        "/offline.html",
        "/pwa/latin.woff2",
        "/pwa/offline.css",
        "/pwa/tamil.woff2",
      ],
    },
    workers: [
      {
        scope: new URL("/", page.url()).href,
        script: new URL("/sw.js", page.url()).href,
      },
    ],
    databases: [],
  });
}

// Exercise real owner flows in English/light and Tamil/dark. No private values.
export async function prepareOwnerScreen(
  page,
  locale,
  desiredDark = locale === "ta",
) {
  await expect(page.locator("main")).toHaveAttribute(
    "data-owner-ready",
    "true",
  );
  if ((await page.locator("main").getAttribute("lang")) !== locale)
    await page
      .getByRole("button", {
        name: locale === "en" ? "English" : "தமிழ்",
        exact: true,
      })
      .click();
  const dark = await page
    .locator("html")
    .evaluate((element) => element.classList.contains("dark"));
  if (dark !== desiredDark)
    await page
      .getByRole("button", {
        name: desiredDark
          ? locale === "en"
            ? "Use dark theme"
            : "இருண்ட தோற்றம்"
          : locale === "en"
            ? "Use light theme"
            : "வெளிர் தோற்றம்",
        exact: true,
      })
      .click();
  await expect(page.locator("main")).toHaveAttribute("lang", locale);
}
