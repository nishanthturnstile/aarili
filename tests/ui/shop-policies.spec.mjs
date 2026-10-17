import { mkdir } from "node:fs/promises";
import { shopPoliciesMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("SS-04/07/10 synthetic policies: nullable terms, IME, durable recovery, lost response, history, readiness and owner boundary", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240000);
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    let limitedUntil = 0;
    page.on("response", (response) => {
      if (response.status() === 429)
        limitedUntil =
          Date.now() +
          Number(response.headers()["retry-after"] ?? 60) * 1000 +
          100;
    });
    async function waitLimit() {
      const remaining = limitedUntil - Date.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    }
    async function admitted(run) {
      const response = await run();
      if (response.status() !== 429) return response;
      const seconds = Number(response.headers()["retry-after"]);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(60);
      await page.waitForTimeout(seconds * 1000 + 100);
      return run();
    }
    const post = (path, data, headers = {}) =>
      admitted(() =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        }),
      );
    async function saveDraft() {
      await waitLimit();
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await expect
        .poll(async () =>
          page
            .getByRole("status")
            .allTextContents()
            .then((text) =>
              text.some(
                (v) => v === "Draft saved" || v.includes("Too many requests"),
              ),
            ),
        )
        .toBe(true);
      if (
        (await page.getByRole("status").allTextContents()).some((v) =>
          v.includes("Too many requests"),
        )
      ) {
        await waitLimit();
        await page
          .getByRole("button", { name: "Save draft", exact: true })
          .click();
      }
      await expect(
        page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
      ).toBeVisible();
    }
    async function publish() {
      await waitLimit();
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
      );
      await page
        .getByRole("button", {
          name: "Apply synthetic fixture to new review activity",
          exact: true,
        })
        .click();
      const result = await response;
      if (result.status() === 429) {
        await waitLimit();
        await page
          .getByRole("button", {
            name: "Apply synthetic fixture to new review activity",
            exact: true,
          })
          .click();
      }
    }
    const email = "policies@example.test",
      password = "synthetic-policy-review-87-password";
    expect(
      (
        await post(
          "/owner/setup",
          { name: "Synthetic policy owner", email, password },
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
          { shopName: "Synthetic policy shop" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json(),
      api = `${origin}/api/shops/${shopId}`;
    await page.goto(`${origin}/settings`);
    await page
      .getByRole("button", { name: "Commercial policies", exact: true })
      .click();
    await page
      .getByText("Action readiness and missing decisions", { exact: true })
      .click();
    await expect(
      page.getByText(
        "Receiving-account readiness unresolved until issue #86 is integrated",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByText("Action readiness and missing decisions", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Advance expectations", exact: true })
      .click();
    await page.locator(".calendar-editor").dispatchEvent("compositionstart");
    await page
      .locator("#policy-en")
      .fill("Synthetic advance terms — review only");
    await page.locator("#policy-ta").fill("செயற்கை முன்பண விதிகள் — சோதனை மட்டும்");
    await page.locator(".calendar-editor").dispatchEvent("compositionend");
    await saveDraft();
    expect(await page.locator("#policy-percentageBps").inputValue()).toBe("");
    const draftUrl = page.url();
    expect(draftUrl).toContain("section=policies");
    expect(draftUrl).not.toContain("Synthetic");
    await page.reload();
    await expect(page.locator("#policy-en")).toHaveValue(
      "Synthetic advance terms — review only",
    );
    await expect(
      page.getByRole("button", { name: "Review policy", exact: true }),
    ).toBeDisabled();
    await page.locator(".calendar-editor").dispatchEvent("compositionstart");
    await page.locator("#policy-state").selectOption("reviewed");
    await page.locator("#policy-authority").selectOption("synthetic-fixture");
    await page.locator("#policy-label").fill("Synthetic issue 87 owner review");
    await page.locator("#policy-percentageBps").fill("-1");
    await expect(
      page.getByRole("button", { name: "Review policy", exact: true }),
    ).toBeDisabled();
    await page.locator("#policy-percentageBps").fill("0");
    // The server commits, but the first response is lost. Retry must keep its key.
    const keys = [];
    let lost = true;
    await page.route("**/drafts/*", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      if (lost) {
        lost = false;
        await route.fetch();
        return route.abort("failed");
      }
      return route.continue();
    });
    await page.locator(".calendar-editor").dispatchEvent("compositionend");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Retry original request", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toBeVisible();
    expect(keys.length).toBe(2);
    expect(keys[0]).toBe(keys[1]);
    await page.unroute("**/drafts/*");
    // Second authenticated context reopens the server draft without browser persistence.
    const other = await browser.newContext({
        storageState: await page.context().storageState(),
      }),
      second = await other.newPage();
    await second.goto(page.url());
    await expect(second.locator("#policy-percentageBps")).toHaveValue("0");
    await other.close();
    await page
      .getByRole("button", { name: "Review policy", exact: true })
      .click();
    await publish();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /^Synthetic policy revision published$/ }),
    ).toBeVisible();
    const published = await (
      await page.request.get(`${api}/settings/policies`)
    ).json();
    expect(published.revision.authorityScope).toBe("synthetic-only");
    await page
      .getByRole("button", { name: "Advance expectations", exact: true })
      .click();
    await page.locator("#policy-percentageBps").fill("100");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Shop profile", exact: true })
      .click();
    await expect(page.locator("#policy-percentageBps")).toHaveValue("100");
    // Publish another version through a separate draft, then explicitly compare stale aggregate.
    const id = crypto.randomUUID().replace(/^(........-....-)./, "$17");
    const data = {
      workflow: "shop.policies",
      schemaVersion: 1,
      payload: {
        baseVersion: 1,
        baseRevisionId: published.revision.id,
        policy: { ...published.revision.policies[0], percentageBps: 200 },
      },
    };
    expect(
      (
        await admitted(() =>
          page.request.put(`${api}/drafts/${id}`, {
            data,
            headers: { Origin: origin, "Idempotency-Key": id },
          }),
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(
          `/shops/${shopId}/drafts/${id}/promote`,
          {},
          { "Idempotency-Key": crypto.randomUUID(), "If-Match": '"v1"' },
        )
      ).status(),
    ).toBe(200);
    await saveDraft();
    await page
      .getByRole("button", { name: "Review policy", exact: true })
      .click();
    await publish();
    await expect(
      page.getByRole("heading", {
        name: "Newer changes need review",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Load latest for comparison", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Review my changes as a new draft against latest revision",
        exact: true,
      })
      .click();
    await expect(page.locator("#policy-percentageBps")).toHaveValue("100");
    await saveDraft();
    await page
      .getByRole("button", { name: "Review policy", exact: true })
      .click();
    await publish();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /^Synthetic policy revision published$/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Load policy history", exact: true })
      .click();
    const history = await (
      await page.request.post(`${api}/settings/policies/history`, {
        data: {},
        headers: { Origin: origin },
      })
    ).json();
    expect(history.revisions.length).toBe(3);
    expect(history.revisions[2].policies[0].percentageBps).toBe(0);
    await mkdir(".impeccable/review", { recursive: true });
    for (const locale of ["en", "ta"]) {
      await prepareOwnerScreen(page, locale);
      const t = shopPoliciesMessages[locale];
      await expect(
        page.getByRole("heading", { name: t.title, exact: true }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
      });
      await page.screenshot({
        path: `.impeccable/review/policies-${info.project.name}-${locale}.png`,
        fullPage: true,
      });
    }
    await expectStaticPwaStorage(page);
    await prepareOwnerScreen(page, "en");
    await page.route("**/settings/policies", (route) => route.abort("failed"));
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Retry loading policies and draft",
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute("**/settings/policies");
    await page
      .getByRole("button", {
        name: "Retry loading policies and draft",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Commercial policies", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) =>
          /polic|draft|customer/i.test(k),
        ),
      ),
    ).toEqual([]);
    await page.goto(draftUrl);
    await expect(page.locator("#policy-en")).toHaveValue(
      "Synthetic advance terms — review only",
    );
    await expect(page.locator("#policy-en")).toBeDisabled();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.locator("#policy-en")).toHaveCount(0);
    await page.goBack();
    await expect(page.locator("#policy-en")).toHaveCount(0);
  });
});
