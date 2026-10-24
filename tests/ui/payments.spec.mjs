import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  paymentOk,
  paymentPublish,
  paymentRequest,
} from "../../scripts/test-support/payment-fixtures.mjs";
import { withPaymentWeb } from "../../scripts/test-support/payment-web.mjs";

test("1.4.2a A1–A6 English/Tamil explicit receipt, pending UPI, lost response and credit with keyboard/axe", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  await withPaymentWeb(async (f) => {
    await context.addCookies(
      f.a.cookie.split("; ").map((c) => {
        const i = c.indexOf("=");
        return {
          name: c.slice(0, i),
          value: c.slice(i + 1),
          url: f.origin,
          httpOnly: true,
        };
      }),
    );
    await page.goto(`${f.origin}/payments`);
    await expect(
      page.getByRole("button", { name: "Record payment", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await page
      .getByRole("button", { name: "Record payment", exact: true })
      .click();
    const editor = page.locator(".payment-editor");
    await editor
      .getByLabel("Find customer or payer", { exact: true })
      .fill("SYNTHETIC payments A");
    await editor.getByRole("button", { name: "Search", exact: true }).click();
    await editor
      .getByRole("button", { name: "Use as customer", exact: true })
      .first()
      .click();
    await editor.getByLabel("Amount (INR)", { exact: true }).fill("500.01");
    // Choosing cash does not attest receipt; pending remains the default.
    await expect(
      editor.getByLabel("Cash received — record and confirm", { exact: true }),
    ).not.toBeChecked();
    await editor
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Record as pending", exact: true })
      .click();
    const detail = page.locator(".payment-detail");
    await expect(detail.locator("p").first()).toContainText("Pending", {
      timeout: 20000,
    });
    await expect(detail).toContainText("₹500.01");
    await expect(detail).toContainText("Agreed charges not established");
    assert.equal(
      (await f.admin.query("select count(*)::int n from journal_batch")).rows[0]
        .n,
      0,
    );
    await detail
      .getByRole("button", { name: "Confirm received payment", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "Review payment", exact: true }),
    ).toBeDisabled();
    await editor.getByLabel("I received this cash.", { exact: true }).check();
    await editor
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
    const promotions = [];
    let dropped = false;
    await page.route("**/drafts/*/promote", async (route) => {
      promotions.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      });
      if (!dropped) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await editor
      .getByRole("button", { name: "Confirm received payment", exact: true })
      .click();
    await expect(
      editor
        .getByRole("button", { name: "Resolve existing request", exact: true })
        .first(),
    ).toBeVisible();
    await editor
      .getByRole("button", { name: "Resolve existing request", exact: true })
      .first()
      .click();
    await expect(detail.locator("p").first()).toContainText("Confirmed", {
      timeout: 20000,
    });
    assert.equal(promotions.length, 2);
    assert.deepEqual(promotions[1], promotions[0]);
    assert.equal(
      (await f.admin.query("select count(*)::int n from journal_batch")).rows[0]
        .n,
      1,
    );
    await page.unroute("**/drafts/*/promote");
    const en = await new AxeBuilder({ page }).analyze();
    expect(en.violations).toEqual([]);
    await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
    await expect(detail).toContainText("உறுதிசெய்யப்பட்டது");
    await expect(detail).toContainText("₹500.01");
    const ta = await new AxeBuilder({ page }).analyze();
    expect(ta.violations).toEqual([]);
    await page.getByRole("button", { name: "பணம் பதிவு", exact: true }).click();
    await editor
      .getByLabel("வாடிக்கையாளர் அல்லது செலுத்தியவரைத் தேடுக", { exact: true })
      .fill("SYNTHETIC payments A");
    await editor.getByRole("button", { name: "தேடு", exact: true }).click();
    await editor
      .getByRole("button", { name: "வாடிக்கையாளராகத் தேர்வு", exact: true })
      .first()
      .click();
    await editor.getByLabel("தொகை (INR)", { exact: true }).fill("700.03");
    await editor.getByLabel("முறை", { exact: true }).selectOption("upi");
    await editor
      .getByLabel("பெறும் கணக்கு", { exact: true })
      .selectOption(f.account.revisionId);
    await editor
      .getByLabel("குறிப்பு / UPI UTR (விருப்பம்)", { exact: true })
      .fill("SYNTHETIC-BROWSER-UTR");
    await editor
      .getByRole("button", { name: "வரைவைச் சேமி", exact: true })
      .click();
    await expect(editor.getByRole("status")).toHaveText("வரைவு சேமிக்கப்பட்டது");
    const url = page.url();
    expect(url).not.toContain("UTR");
    expect(url).not.toContain("700");
    await page.reload(); // server draft recovery, interface starts English again
    await expect(
      editor.getByLabel("Amount (INR)", { exact: true }),
    ).toHaveValue("700.03", { timeout: 30000 });
    await expect(
      editor.getByLabel("Reference / UPI UTR (optional)", { exact: true }),
    ).toHaveValue("SYNTHETIC-BROWSER-UTR");
    await editor
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Record as pending", exact: true })
      .click();
    await expect(detail.locator("p").first()).toContainText("Pending");
    await detail
      .getByRole("button", { name: "Confirm received payment", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "Review payment", exact: true }),
    ).toBeDisabled();
    await editor
      .getByLabel("I saw this payment in the configured UPI/bank account.", {
        exact: true,
      })
      .focus();
    await page.keyboard.press("Space");
    await editor
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Confirm received payment", exact: true })
      .click();
    await expect(detail.locator("p").first()).toContainText("Confirmed");
    assert.equal(
      (await f.admin.query("select count(*)::int n from journal_batch")).rows[0]
        .n,
      2,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const stores = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(JSON.stringify(stores)).not.toMatch(/UTR|700\.03|500\.01/);
    const older = await paymentPublish(f, { ...f.value, amountText: "6.01" });
    const profile = await paymentOk(
      await paymentRequest(f, "settings/profile", { method: "GET" }),
    );
    const revised = await paymentOk(
      await paymentRequest(f, "settings/profile", {
        method: "PUT",
        etag: `"v${profile.version}"`,
        body: {
          ...profile.profile,
          displayName: "SYNTHETIC revised recipient",
        },
      }),
    );
    await page.goto(`${f.origin}/payments`);
    await expect(
      page.getByRole("button", { name: "Record payment", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await page.getByRole("button", { name: /₹6\.01/ }).click();
    await detail
      .getByRole("button", { name: "Correct pending report", exact: true })
      .click();
    await expect(editor).toContainText("SYNTHETIC revised recipient");
    await editor
      .getByLabel("Reason / note", { exact: true })
      .fill("SYNTHETIC correction after recipient profile revision");
    await editor
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Append correction", exact: true })
      .click();
    await expect(detail).toContainText("SYNTHETIC revised recipient");
    const corrected = await paymentOk(
      await paymentRequest(f, "payments/read", { body: { id: older.id } }),
    );
    assert.equal(corrected.current.version, 2);
    assert.equal(corrected.current.profileId, revised.revision.id);
    assert.equal(
      (await f.admin.query("select count(*)::int n from journal_batch")).rows[0]
        .n,
      2,
    );
  });
});
