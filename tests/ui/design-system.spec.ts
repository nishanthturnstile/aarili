import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["en", "ta"] as const) {
  for (const dark of [false, true]) {
    test(`USE-01/02/09 ${locale} ${dark ? "dark" : "light"}: controls, fonts, contrast, targets and responsive wrapping`, async ({
      page,
    }, testInfo) => {
      const externalRequests: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith("http://127.0.0.1:3103"))
          externalRequests.push(request.url());
      });
      await page.goto("/dev/design-system");
      await page
        .getByRole("button", { name: "Current light", exact: true })
        .click();
      if (locale === "ta")
        await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
      if (dark)
        await page
          .getByRole("button", {
            name: locale === "en" ? "Switch to dark" : "இருண்ட தோற்றம்",
          })
          .click();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() => {
          const face = [...document.fonts];
          return (
            face.some(
              (font) =>
                font.family.includes("Noto Sans Tamil") &&
                font.status === "loaded",
            ) &&
            face.some(
              (font) =>
                font.family.includes("Noto Sans") &&
                !font.family.includes("Tamil") &&
                font.status === "loaded",
            )
          );
        }),
      ).toBe(true);
      expect(externalRequests).toEqual([]);
      for (const target of await page
        .locator("main button, main input")
        .all()) {
        const box = await target.boundingBox();
        expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
        expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.scratch/design-system-baseline/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
        fullPage: true,
      });
      const trigger = page.getByRole("button", {
        name: locale === "en" ? "Open sample dialog" : "மாதிரி உரையாடலைத் திற",
      });
      await page.keyboard.press("Tab");
      await trigger.focus();
      await expect(trigger).toBeFocused();
      const focus = await trigger.evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: style.outlineWidth, style: style.outlineStyle };
      });
      expect(focus.style).toBe("solid");
      expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      for (const target of await dialog.locator("button").all()) {
        const box = await target.boundingBox();
        expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
        expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (let index = 0; index < 4; index++) {
        await page.keyboard.press("Tab");
        await expect
          .poll(() =>
            dialog.evaluate((element) =>
              element.contains(document.activeElement),
            ),
          )
          .toBe(true);
      }
      await page.screenshot({
        path: `.scratch/design-system-baseline/${testInfo.project.name}-${locale}-${dark ? "dark" : "light"}-dialog.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
}

test("USE-02/09 Tamil composition, empty input and reduced motion remain intact", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/design-system");
  await page
    .getByRole("button", { name: "Current light", exact: true })
    .click();
  const input = page.locator("#sample-text");
  await input.focus();
  await input.dispatchEvent("compositionstart", { data: "" });
  await input.fill("தமிழ்");
  await input.dispatchEvent("compositionupdate", { data: "தமிழ்" });
  await input.dispatchEvent("compositionend", { data: "தமிழ்" });
  await expect(input).toHaveValue("தமிழ்");
  await input.fill("");
  await expect(input).toHaveValue("");
  const trigger = page.getByRole("button", { name: "Open sample dialog" });
  await trigger.click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s, 0s");
  await page
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("0.1.1c editing canonical token declarations changes controls and app surfaces without component edits", async ({
  page,
}, testInfo) => {
  await page.goto("/dev/design-system");
  await page
    .getByRole("button", { name: "Current light", exact: true })
    .click();
  const button = page.getByRole("button", { name: "Continue to review" });
  const card = page.locator('[data-slot="card"]').last();
  async function styles() {
    return {
      button: await button.evaluate((element) => {
        const s = getComputedStyle(element);
        return [
          s.backgroundColor,
          s.borderRadius,
          s.paddingLeft,
          s.fontFamily,
          s.fontSize,
        ];
      }),
      card: await card.evaluate((element) => {
        const s = getComputedStyle(element);
        return [s.borderRadius, s.paddingLeft, s.fontFamily, s.fontSize];
      }),
      main: await page
        .locator("main")
        .evaluate((element) => getComputedStyle(element).paddingLeft),
    };
  }
  const before = await styles();
  const source = readFileSync("packages/ui/src/globals.css", "utf8");
  const edited = source
    .replace("--primary: #751f3d", "--primary: #245d45")
    .replace("--radius: 0.75rem", "--radius: 1rem")
    .replace("--spacing: 0.25rem", "--spacing: 0.3rem")
    .replace(
      '--font-body: "Noto Sans", "Noto Sans Tamil", sans-serif',
      '--font-body: "Noto Sans Tamil", "Noto Sans", sans-serif',
    )
    .replace("--type-body: 1rem", "--type-body: 1.125rem");
  // Exercise only the edited canonical declarations through the browser cascade;
  // never overwrite repository source while the test server or another test runs.
  const block = edited.match(/:root \{[\s\S]*?\n\}/)?.[0];
  expect(block).toBeTruthy();
  await page.addStyleTag({ content: block ?? "" });
  await expect
    .poll(async () => (await styles()).button[0])
    .toBe("rgb(36, 93, 69)");
  const after = await styles();
  for (let index = 0; index < before.button.length; index++)
    expect(after.button[index]).not.toBe(before.button[index]);
  for (let index = 0; index < before.card.length; index++)
    expect(after.card[index]).not.toBe(before.card[index]);
  expect(after.main).not.toBe(before.main);
  await page.screenshot({
    path: `.scratch/design-system-baseline/${testInfo.project.name}-token-change.png`,
    fullPage: true,
  });
});
