import { mkdir } from "node:fs/promises";
import { shopCommitmentsMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("SET-06/11 SS-05/06/07/10 AC-60 unbound preview, unknowns, reasons, IME recovery, replay, history and access", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(420000);
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    let limitedUntil = 0;
    page.on("response", (r) => {
      if (r.status() === 429)
        limitedUntil =
          Date.now() + Number(r.headers()["retry-after"] ?? 60) * 1000 + 150;
    });
    async function waitLimit() {
      const remaining = limitedUntil - Date.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    }
    async function admitted(run) {
      const r = await run();
      if (r.status() !== 429) return r;
      const seconds = Number(r.headers()["retry-after"]);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(60);
      await page.waitForTimeout(seconds * 1000 + 150);
      return run();
    }
    const post = (path, data, headers = {}) =>
      admitted(() =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        }),
      );
    const en = shopCommitmentsMessages.en;
    const button = (name) => page.getByRole("button", { name, exact: true });
    async function command(name, method, suffix) {
      await waitLimit();
      const run = async () => {
        const response = page.waitForResponse(
          (r) => r.request().method() === method && r.url().endsWith(suffix),
        );
        await button(name).click();
        return response;
      };
      let r = await run();
      if (r.status() === 429) {
        await waitLimit();
        r = await run();
      }
      expect(r.status(), await r.text()).toBe(200);
      return r;
    }
    const email = "commitments@example.test",
      password = "synthetic-commitment-review-88-password";
    expect(
      (
        await post(
          "/owner/setup",
          { name: "Synthetic commitment owner", email, password },
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
      (await post("/auth/sign-in/email", { email, password })).status(),
    ).toBe(200);
    expect(
      (
        await post(
          "/owner/complete",
          { shopName: "Synthetic commitment shop" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const { shopId } = await (
      await page.request.get(`${origin}/api/owner/shop`)
    ).json();
    const api = `/shops/${shopId}`;
    await page.goto(`${origin}/settings?section=commitments`);
    await expect(
      page.getByRole("heading", { name: en.title, exact: true }),
    ).toBeVisible();
    // Empty configuration is an explicit unknown, never a clear risk result.
    let result = await (
      await command(en.preview, "POST", "/settings/commitments/preview")
    ).json();
    expect(result.unknowns).toContain("capacityCapMissing");
    expect(result.binding).toBe("unbound");
    expect(result.effects).toBe("none");
    await button(en.edit).click();
    await expect(
      page.getByRole("heading", { name: en.edit, exact: true }),
    ).toBeFocused();
    const editor = page.locator(".commitment-editor");
    await editor.dispatchEvent("compositionstart");
    await button(en.fixture).click();
    await page
      .locator("#commit-ruleLabel")
      .fill("SYNTHETIC விதி — review only");
    await page.locator("#commit-cap").fill("-1");
    await expect(button(en.reviewConfig)).toBeDisabled();
    await page.locator("#commit-cap").fill("10");
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toHaveCount(0);
    await editor.dispatchEvent("compositionend");
    // A real committed response is discarded. The retry retains the original key.
    const keys = [];
    let lost = true;
    await page.route("**/drafts/*", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      if (lost) {
        lost = false;
        const r = await route.fetch();
        expect(r.status()).toBe(200);
        return route.abort("failed");
      }
      return route.continue();
    });
    await button(en.saveDraft).click();
    await expect(button(en.retry)).toBeVisible();
    await button(en.retry).click();
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await page.unroute("**/drafts/*");
    const draftUrl = page.url();
    expect(draftUrl).toContain("section=commitments&draft=");
    expect(draftUrl).not.toContain("SYNTHETIC");
    await page.reload();
    await expect(page.locator("#commit-ruleLabel")).toHaveValue(
      "SYNTHETIC விதி — review only",
    );
    const other = await browser.newContext({
      storageState: await page.context().storageState(),
    });
    const second = await other.newPage();
    await second.goto(draftUrl);
    await expect(second.locator("#commit-cap")).toHaveValue("10");
    await other.close();
    result = await (
      await command(en.preview, "POST", "/settings/commitments/preview")
    ).json();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "deliveryWindow",
        "capacityExceeded",
        "cutoffPassed",
        "rush",
      ]),
    );
    expect(result.unknowns).toEqual([]);
    await page.getByLabel(en.review, { exact: true }).check();
    await page.getByLabel(en.waiver, { exact: true }).check();
    result = await (
      await command(en.preview, "POST", "/settings/commitments/preview")
    ).json();
    expect(result.decisions.errors).toEqual(
      expect.arrayContaining([
        "exceptionReasonRequired",
        "waiverReasonRequired",
      ]),
    );
    await page
      .locator("#preview-exceptionReason")
      .fill("Synthetic owner exception");
    await page.locator("#preview-waiverReason").fill("Synthetic waiver only");
    await page.getByLabel(en.acknowledge, { exact: true }).check();
    result = await (
      await command(en.preview, "POST", "/settings/commitments/preview")
    ).json();
    expect(result.decisions.state).toBe("recorded-preview");
    expect(result.warnings).toContain("capacityExceeded");
    expect(result.facts.rushPaise).toBe("50000");
    await mkdir(".impeccable/review", { recursive: true });
    async function capture(state) {
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const t = shopCommitmentsMessages[locale];
        const facts = page.locator(".commitment-preview dl").first();
        await expect(
          facts
            .locator("dt")
            .filter({ hasText: new RegExp(`^${t.availableLead}$`) })
            .locator("+ dd"),
        ).toHaveText("2");
        await expect(
          facts
            .locator("dt")
            .filter({ hasText: t.capacityWeekStart })
            .locator("+ dd"),
        ).toHaveText("2026-10-19");
        await expect(
          facts
            .locator("dd")
            .filter({ hasText: new RegExp(`^${t.garments}$`) }),
        ).toHaveCount(1);
        await expect(
          page.getByRole("heading", { name: t.title, exact: true }),
        ).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        const overflow = await page.evaluate(() =>
          [...document.querySelectorAll("main *")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .map((e) => ({
              tag: e.tagName,
              id: e.id,
              class: e.className,
              right: Math.round(e.getBoundingClientRect().right),
            }))
            .slice(0, 15),
        );
        expect(
          overflow,
          `Horizontal overflow ${JSON.stringify(overflow)}`,
        ).toEqual([]);
        await page.evaluate(async () => {
          await document.fonts.ready;
          window.scrollTo(0, 0);
          await new Promise(requestAnimationFrame);
        });
        await page.screenshot({
          path: `.impeccable/review/commitments-${info.project.name}-${locale}-${state}.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
    }
    await capture("warnings");
    await page.locator("#preview-fixture").selectOption("missing-load");
    await expect(page.getByText(en.changed, { exact: true })).toBeVisible();
    result = await (
      await command(en.preview, "POST", "/settings/commitments/preview")
    ).json();
    expect(result.unknowns).toContain("loadMissing");
    expect(result.warnings).toContain("rush");
    expect(result.stale).toBe(true);
    await page.locator("#preview-mode").selectOption("production");
    result = await (
      await command(en.preview, "POST", "/settings/commitments/preview")
    ).json();
    expect(result.unknowns).toEqual(
      expect.arrayContaining([
        "categoryUnresolved",
        "productionAuthorityPending",
        "loadMissing",
      ]),
    );
    expect(result.activation).toBe("unavailable");
    await capture("unknowns");
    // Navigation preserves a dirty editor when the owner declines leaving.
    await editor.dispatchEvent("compositionstart");
    await page.locator("#commit-ruleLabel").fill("SYNTHETIC dirty review");
    page.once("dialog", (d) => d.dismiss());
    await button("Shop profile").click();
    await expect(page.locator("#commit-ruleLabel")).toHaveValue(
      "SYNTHETIC dirty review",
    );
    await page
      .locator("#commit-ruleLabel")
      .fill("SYNTHETIC விதி — review only");
    await editor.dispatchEvent("compositionend");
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toBeVisible();
    await button(en.reviewConfig).click();
    await expect(
      page.getByRole("heading", { name: en.reviewConfig, exact: true }),
    ).toBeFocused();
    await command(en.publish, "POST", "/promote");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: new RegExp(`^${en.promoted}$`) }),
    ).toBeVisible();
    const state = await (
      await page.request.get(`${origin}/api${api}/settings/commitments`)
    ).json();
    expect(state.revision.authorityScope).toBe("unbound-preview");
    await button(en.loadHistory).click();
    await expect(
      page
        .locator(".shop-settings-main details")
        .filter({ hasText: "SYNTHETIC" }),
    ).toHaveCount(1);
    await capture("history");
    // Reopen the exact server draft in Tamil; the published revision is read-only.
    await prepareOwnerScreen(page, "ta");
    await page.goto(draftUrl);
    await expect(page.locator("#commit-ruleLabel")).toHaveValue(
      "SYNTHETIC விதி — review only",
    );
    await expect(page.locator("#commit-ruleLabel")).toBeDisabled();
    await expectStaticPwaStorage(page);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) =>
          /commitment|draft|customer/i.test(k),
        ),
      ),
    ).toEqual([]);
    await prepareOwnerScreen(page, "en");
    await page.route("**/settings/commitments", (route) =>
      route.abort("failed"),
    );
    await page.reload();
    await expect(button(en.retryLoad)).toBeVisible();
    await page.unroute("**/settings/commitments");
    await button(en.retryLoad).click();
    await expect(page.locator("#commit-ruleLabel")).toHaveValue(
      "SYNTHETIC விதி — review only",
    );
    await button("Sign out").click();
    await expect(page.locator("#commit-ruleLabel")).toHaveCount(0);
    await page.goBack();
    await expect(page.locator("#commit-ruleLabel")).toHaveCount(0);
  });
});
