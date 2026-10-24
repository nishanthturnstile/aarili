import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { estimateMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });
test("A2-01/02/03/04/07/08 Q-02/04/13 recover unknown estimates, IME and original-key response loss; complimentary costs and strict customer view", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    const email = "estimate-owner@example.test",
      password = "synthetic-estimate-private-password";
    expect(
      (
        await post(
          "/owner/setup",
          { name: "Synthetic estimate owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
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
          { shopName: "SYNTHETIC estimate shop" },
          { "Idempotency-Key": randomUUID() },
        )
      ).status(),
    ).toBe(200);
    let limitedUntil = 0;
    page.on("response", (r) => {
      if (r.status() === 429)
        limitedUntil =
          Date.now() + Number(r.headers()["retry-after"] ?? 60) * 1000 + 150;
    });
    const waitLimit = async () => {
      const left = limitedUntil - Date.now();
      if (left > 0) await page.waitForTimeout(left);
    };
    const t = estimateMessages.en;
    await page.goto(`${origin}/orders?section=estimates`);
    await page.getByRole("button", { name: t.new, exact: true }).click();
    const editor = page.getByRole("region", { name: t.new, exact: true });
    await editor.getByRole("button", { name: t.add, exact: true }).click();
    let lost = false;
    const envelopes = [];
    await page.route("**/api/shops/*/drafts/*", async (route) => {
      const request = route.request();
      if (
        request.method() !== "PUT" ||
        request.postDataJSON()?.workflow !== "pricing.estimate"
      )
        return route.continue();
      envelopes.push({
        key: request.headers()["idempotency-key"],
        body: request.postData(),
      });
      if (!lost) {
        lost = true;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        return route.abort("connectionfailed");
      }
      return route.continue();
    });
    await editor.locator("fieldset").first().dispatchEvent("compositionstart");
    await page.locator("#estimate-labelEn").fill("SYNTHETIC blouse labour");
    await page.locator("#estimate-labelTa").fill("செயற்கை ரவிக்கை வேலை");
    await page.locator("#estimate-quantityText").fill("1");
    await page
      .locator("#estimate-review-reason")
      .fill("SYNTHETIC Tamil வரைவு — prices not yet known");
    await page.waitForTimeout(1100);
    expect(envelopes).toHaveLength(0);
    await editor.locator("fieldset").first().dispatchEvent("compositionend");
    await expect(editor.getByRole("status").first()).toHaveText(t.checking);
    await editor.getByRole("button", { name: t.retry, exact: true }).click();
    await expect(editor.getByRole("status").first()).toHaveText(t.saved);
    expect(envelopes[1]).toEqual(envelopes[0]);
    expect(new URL(page.url()).searchParams.get("estimateDraft")).toBeTruthy();
    await page.reload();
    await expect(page.locator("#estimate-review-reason")).toHaveValue(
      "SYNTHETIC Tamil வரைவு — prices not yet known",
    );
    const resumed = page.getByRole("region", { name: t.new, exact: true });
    await waitLimit();
    await resumed.getByRole("button", { name: t.review, exact: true }).click();
    await expect(
      resumed.getByRole("region", { name: t.customerView }),
    ).toContainText(t.incomplete);
    await expect(
      resumed.getByRole("button", { name: t.version, exact: true }),
    ).toBeDisabled();
    await expect(resumed).toContainText(t.sourceVersion);
    await expect(resumed).toContainText(t.specificationVersion);
    await expect(resumed).toContainText(t.bookingVersion);
    await resumed.getByRole("button", { name: t.apply, exact: true }).click();
    await page.locator("#estimate-state").selectOption("complimentary");
    await page
      .locator("#estimate-reason")
      .fill("SYNTHETIC owner approved complimentary hooks");
    await resumed.getByText(t.private, { exact: true }).first().click();
    await page.locator("#estimate-cost").fill("25.01");
    await page
      .locator("#estimate-cost-reason")
      .fill("SYNTHETIC PRIVATE COST BASIS — never customer text");
    async function saveAndReview() {
      await waitLimit();
      await resumed.getByRole("button", { name: t.save, exact: true }).click();
      await expect
        .poll(async () => {
          const text = await resumed.getByRole("status").first().textContent();
          return text === t.saved || text?.includes(t.rateLimited);
        })
        .toBeTruthy();
      if (
        (await resumed.getByRole("status").first().textContent()).includes(
          t.rateLimited,
        )
      ) {
        await waitLimit();
        await resumed
          .getByRole("button", { name: t.retry, exact: true })
          .click();
      }
      await expect(resumed.getByRole("status").first()).toHaveText(t.saved);
      await waitLimit();
      await resumed
        .getByRole("button", { name: t.review, exact: true })
        .click();
      await expect
        .poll(async () => {
          const status = await resumed
            .getByRole("status")
            .first()
            .textContent();
          const button = resumed.getByRole("button", {
            name: t.version,
            exact: true,
          });
          return (
            ((await button.count()) > 0 && (await button.isEnabled())) ||
            status?.includes(t.rateLimited)
          );
        })
        .toBeTruthy();
      if (
        (await resumed.getByRole("status").first().textContent()).includes(
          t.rateLimited,
        )
      ) {
        await waitLimit();
        await resumed
          .getByRole("button", { name: t.retry, exact: true })
          .click();
        await resumed
          .getByRole("button", { name: t.review, exact: true })
          .click();
      }
      await expect(
        resumed.getByRole("button", { name: t.version, exact: true }),
      ).toBeEnabled();
    }
    await saveAndReview();
    await expect(
      resumed.getByRole("region", { name: t.private, exact: true }),
    ).toContainText("25.01");
    const publish = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
    );
    await resumed.getByRole("button", { name: t.version, exact: true }).click();
    const result = await publish;
    if (result.status() === 429) {
      const key = result.request().headers()["idempotency-key"];
      await waitLimit();
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
      );
      await resumed
        .getByRole("button", { name: t.version, exact: true })
        .click();
      const retry = await response;
      expect(retry.request().headers()["idempotency-key"]).toBe(key);
      expect(retry.status(), await retry.text()).toBe(200);
    } else expect(result.status(), await result.text()).toBe(200);
    await expect(resumed.getByRole("status").first()).toHaveText(t.promoted);
    await page.getByRole("button", { name: t.close, exact: true }).click();
    const version = page.getByRole("region", {
      name: t.savedVersion,
      exact: true,
    });
    await expect(version).toContainText(t.savedVersion);
    await version
      .getByRole("button", { name: t.customerView, exact: true })
      .click();
    const customer = page.getByRole("region", {
      name: t.customerView,
      exact: true,
    });
    await expect(customer).toContainText(t.notIssued);
    await expect(customer).toContainText("0.00");
    await expect(customer).not.toContainText("25.01");
    await expect(customer).not.toContainText("PRIVATE COST");
    await version.getByRole("button", { name: t.history, exact: true }).click();
    await expect(
      page.getByRole("region", { name: t.history, exact: true }),
    ).toContainText(t.savedVersion);
    await mkdir(".impeccable/review", { recursive: true });
    for (const locale of ["en", "ta"]) {
      await prepareOwnerScreen(page, locale);
      await expect(
        page.getByRole("heading", {
          name: estimateMessages[locale].title,
          exact: true,
        }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.impeccable/review/garment-estimates-${info.project.name}-${locale}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expectStaticPwaStorage(page);
  });
});
