import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("SS-04/10 malformed nullable paise stays editable within the durable draft bound", async ({
  page,
}) => {
  test.setTimeout(120000);
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    const email = "policy-values@example.test",
      password = "synthetic-values-review-password-87";
    expect(
      (
        await post(
          "/owner/setup",
          { name: "Synthetic policy values", email, password },
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
          { shopName: "Synthetic value review" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    await page.goto(`${origin}/settings?section=policies`);
    await page
      .getByRole("button", { name: "Cancellation treatment", exact: true })
      .click();
    await page.locator(".calendar-editor").dispatchEvent("compositionstart");
    const amount = page.locator("#policy-amountPaise");
    await amount.fill("9".repeat(48));
    await expect(amount).toHaveValue("9".repeat(32));
    await amount.fill("invalid paise");
    await expect(amount).toHaveValue("invalid paise");
    await amount.fill("");
    await expect(amount).toHaveValue("");
    await amount.fill("0");
    await expect(amount).toHaveValue("0");
    await page.locator(".calendar-editor").dispatchEvent("compositionend");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("#policy-amountPaise")).toHaveValue("0");
    await expect(
      page.getByRole("button", { name: "Review policy", exact: true }),
    ).toBeDisabled();
  });
});
