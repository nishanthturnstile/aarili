import { mkdir } from "node:fs/promises";
import { designChoicesMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  designScenarios,
  designSources,
  publishDesign,
} from "../../scripts/test-support/design-choices-fixtures.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("DS-A1-01–06 controlled choice create/save/reload/publish, profile preview/history, bilingual responsive keyboard and axe", async ({
  page,
}, info) => {
  test.setTimeout(420000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  await withOwnerWeb(async ({ origin, setupToken, code, seedCommand }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    const password = "synthetic-design-choice-verification-password";
    expect(
      (
        await post(
          "/owner/setup",
          {
            name: "SYNTHETIC design owner",
            email: "design-choice@example.test",
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
          email: "design-choice@example.test",
          password,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(
          "/owner/complete",
          { shopName: "SYNTHETIC design shop" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const { shopId } = await (
      await page.request.get(`${origin}/api/owner/shop`)
    ).json();
    const cookie = (await page.context().cookies(origin))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const fixture = {
      a: { shop: shopId, cookie },
      owner: { origin },
      api: { fetch: seedCommand },
    };
    const sources = await designSources(fixture);
    const published = await publishDesign(fixture, sources.profile);
    await designScenarios(fixture, sources);
    const en = designChoicesMessages.en,
      ta = designChoicesMessages.ta;
    await page.goto(`${origin}/settings?section=design-choices`);
    await prepareOwnerScreen(page, "en", false);
    const screen = page.getByRole("region", { name: en.title, exact: true });
    await expect(
      screen.getByRole("heading", { name: en.title, exact: true }),
    ).toBeVisible();
    await screen
      .getByRole("button", {
        name: en.addKind.replace("{kind}", en.choice),
        exact: true,
      })
      .click();
    const editor = () => page.locator(".directory-editor");
    await editor().getByLabel(en.code, { exact: true }).fill("lining-new");
    await editor()
      .getByLabel(en.labelEn, { exact: true })
      .fill("SYNTHETIC cotton lining");
    await editor()
      .getByLabel(en.labelTa, { exact: true })
      .dispatchEvent("compositionstart");
    await editor()
      .getByLabel(en.labelTa, { exact: true })
      .fill("செயற்கை பருத்தி உள்துணி");
    await editor()
      .getByLabel(en.labelTa, { exact: true })
      .dispatchEvent("compositionend");
    await editor()
      .getByLabel(en.category, { exact: true })
      .selectOption(sources.category.definition.id);
    await editor()
      .getByLabel(en.dimension, { exact: true })
      .selectOption("lining");
    await editor()
      .getByLabel(en.meaning, { exact: true })
      .fill("SYNTHETIC cotton lining option");
    await editor()
      .getByLabel(en.reason, { exact: true })
      .fill("SYNTHETIC owner review");
    await editor().getByLabel(en.available, { exact: true }).check();
    let dropped = false;
    const requestKeys = [];
    await page.route("**/api/shops/*/drafts/*", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      requestKeys.push(route.request().headers()["idempotency-key"]);
      if (!dropped) {
        dropped = true;
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await editor().getByRole("button", { name: en.save, exact: true }).click();
    await expect(
      editor().getByRole("button", { name: en.retry, exact: true }),
    ).toBeVisible();
    await editor().getByRole("button", { name: en.retry, exact: true }).click();
    await expect(editor().getByText(en.saved, { exact: true })).toBeVisible();
    expect(requestKeys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(requestKeys).size).toBe(1);
    await page.unroute("**/api/shops/*/drafts/*");
    const resumeUrl = page.url();
    await editor()
      .getByLabel(en.description, { exact: true })
      .fill("SYNTHETIC unsaved cancellation");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: en.cancel, exact: true }).click();
    await expect(editor()).toHaveCount(0);
    await page.goto(resumeUrl);
    await expect(
      editor().getByLabel(en.description, { exact: true }),
    ).toHaveValue("");
    await page.reload();
    await expect(editor().getByLabel(en.labelEn, { exact: true })).toHaveValue(
      "SYNTHETIC cotton lining",
    );
    await editor()
      .getByRole("button", { name: en.review, exact: true })
      .click();
    await editor()
      .getByRole("button", { name: en.publish, exact: true })
      .click();
    await expect(
      editor().getByText(en.promoted, { exact: true }),
    ).toBeVisible();
    await page.goto(`${origin}/settings?section=design-choices`);
    // Open exact profile from its directory row, then edit its recoverable draft.
    const row = page
      .locator("li")
      .filter({ hasText: "SYNTHETIC blouse questions" });
    await row.getByRole("button", { name: en.detail, exact: true }).click();
    await page.getByRole("button", { name: en.edit, exact: true }).click();
    await editor()
      .getByRole("button", { name: en.preview, exact: true })
      .click();
    await expect(
      editor().getByText(
        `${en["neck-type"]} · SYNTHETIC neck-type: ${en.unknown}`,
        { exact: true },
      ),
    ).toBeVisible();
    await prepareOwnerScreen(page, "ta", true);
    await expect(
      editor().getByRole("heading", { name: ta.profile, exact: true }),
    ).toBeVisible();
    await expect(editor().getByLabel(ta.labelEn, { exact: true })).toHaveValue(
      "SYNTHETIC blouse questions",
    );
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await mkdir(".scratch/design-choices-captures", { recursive: true });
    for (const [locale, dark] of [
      ["en", false],
      ["en", true],
      ["ta", false],
      ["ta", true],
    ]) {
      await prepareOwnerScreen(page, locale, dark);
      await page.screenshot({
        path: `.scratch/design-choices-captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    if (info.project.name === "tablet") {
      await page.setViewportSize({ width: 1180, height: 820 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto(`${origin}/settings?section=design-choices`);
    await prepareOwnerScreen(page, "en", false);
    const historical = page
      .locator("li")
      .filter({ hasText: "SYNTHETIC blouse questions" });
    await historical
      .getByRole("button", { name: en.detail, exact: true })
      .click();
    await page.getByRole("button", { name: en.history, exact: true }).click();
    await expect(
      page.getByText(published.reason, { exact: true }).first(),
    ).toBeVisible();
    await expectStaticPwaStorage(page);
    const state = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(state.session).toEqual([]);
    expect(state.local.every((k) => k === "aarili-appearance")).toBe(true);
  });
});
