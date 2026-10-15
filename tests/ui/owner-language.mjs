import { expect } from "@playwright/test";

export async function setOwnerLanguage(page, locale) {
  const main = page.locator("main[lang]");
  await expect(main).toHaveAttribute("data-owner-ready", "true");
  const current = await main.getAttribute("lang");
  // Do not fill secrets or capture input caret styles before client hydration.
  if (current !== locale) {
    await page
      .getByRole("button", {
        name: locale === "en" ? "English" : "தமிழ்",
        exact: true,
      })
      .click();
    await expect(main).toHaveAttribute("lang", locale);
  }
}
