import { expect } from "@playwright/test";

// Exercise real owner flows in English/light and Tamil/dark. No private values.
export async function prepareOwnerScreen(page, locale) {
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
  if (dark !== (locale === "ta"))
    await page
      .getByRole("button", {
        name: locale === "en" ? "Use light theme" : "இருண்ட தோற்றம்",
        exact: true,
      })
      .click();
  await expect(page.locator("main")).toHaveAttribute("lang", locale);
}
