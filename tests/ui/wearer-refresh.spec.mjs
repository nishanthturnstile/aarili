import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("CW-13 refreshing drafts cannot silently replace a dirty concurrent wearer correction", async ({
  page,
}) => {
  test.setTimeout(120000);
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      async function send(method, path, data, extra = {}) {
        const response = await page.request[method](`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...extra },
        });
        expect(response.status()).toBe(200);
        return response.json();
      }
      const password = "synthetic-refresh-owner-password-79";
      await send(
        "post",
        "/owner/setup",
        { name: "Synthetic owner", email: "owner@example.test", password },
        { "X-Setup-Token": setupToken, "Idempotency-Key": crypto.randomUUID() },
      );
      await send("post", "/owner/verify", { code: await code() });
      await send("post", "/auth/sign-in/email", {
        email: "owner@example.test",
        password,
      });
      await send(
        "post",
        "/owner/complete",
        { shopName: "Synthetic refresh shop" },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const { notice } = await (
        await page.request.get(`${origin}/api/shops/${shopId}/customers/policy`)
      ).json();
      const occurredAt = new Date(Date.now() - 60000).toISOString();
      const customer = await send(
        "post",
        `/shops/${shopId}/customers`,
        {
          displayName: "Synthetic refresh person",
          serviceEvidence: {
            noticeId: notice.id,
            language: "en",
            decision: "grant",
            giver: "self",
            noticeExplained: true,
            source: "in-person",
            occurredAt,
          },
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      const preferences = {
        language: "",
        channel: "",
        fit: "",
        style: "",
        delivery: "",
        source: "",
      };
      const relationship = {
        kind: "self",
        statementByPersonId: customer.personId,
        authorised: false,
        informed: false,
        source: "in-person",
        occurredAt,
        interaction: "Synthetic refresh interaction",
      };
      const path = `/shops/${shopId}/customers/${customer.customerId}/wearers`;
      const wearer = await send(
        "post",
        path,
        { mode: "self", age: "adult", preferences, relationship },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      await page.goto(`${origin}/customers/${customer.customerId}`);
      await page
        .getByRole("button", {
          name: `Select wearer: Synthetic refresh person (${wearer.wearerId.slice(-8)})`,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Correct age, relationship or preferences",
          exact: true,
        })
        .click();
      await page
        .locator("#wearer-correct-reason")
        .fill("SYNTHETIC wearer correction");
      await page
        .locator("#wearer-correct-pref-fit")
        .fill("Uncommitted proposal");
      await page
        .locator("#wearer-correct-pref-source")
        .fill("Synthetic wearer in person");
      await send(
        "patch",
        `${path}/${wearer.wearerId}`,
        {
          reason: "SYNTHETIC competing correction",
          age: "adult",
          preferences: {
            ...preferences,
            fit: "Other saved correction",
            source: "Synthetic wearer in person",
          },
          relationship,
        },
        { "Idempotency-Key": crypto.randomUUID(), "If-Match": '"v1"' },
      );
      let reads = 0;
      page.on("request", (r) => {
        if (r.method() === "GET" && r.url().endsWith(path)) reads++;
      });
      const dialog = page.waitForEvent("dialog");
      const clicked = page
        .getByRole("button", { name: "Refresh drafts", exact: true })
        .click();
      const confirmation = await dialog;
      expect(confirmation.type()).toBe("confirm");
      await confirmation.dismiss();
      await clicked;
      expect(reads).toBe(0);
      await expect(page.locator("#wearer-correct-pref-fit")).toHaveValue(
        "Uncommitted proposal",
      );
      const stale = page.waitForResponse(
        (r) =>
          r.request().method() === "PATCH" &&
          r.url().endsWith(`${path}/${wearer.wearerId}`),
      );
      await page
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      expect((await stale).status()).toBe(412);
      await expect(
        page.getByRole("alert").filter({ hasText: "The saved record changed" }),
      ).toBeVisible();
      await expect(page.locator("#wearer-correct-pref-fit")).toHaveValue(
        "Uncommitted proposal",
      );
      page.once("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "Reload saved version", exact: true })
        .click();
      await expect(page.locator(".wearer-selected")).toContainText(
        "Other saved correction",
      );
      await expect(page.locator("#wearer-correct-pref-fit")).toHaveCount(0);
      // UI-only admission fault: a first rejected draft save must never claim
      // that a draft exists. Real admission/replay behavior is covered separately.
      await page.route("**/api/shops/*/drafts/*", async (route) => {
        if (route.request().method() === "PUT")
          await route.fulfill({
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "1" },
            body: JSON.stringify({
              error: {
                code: "RATE_LIMITED",
                message: "Synthetic admission rejection",
              },
            }),
          });
        else await route.continue();
      });
      await page
        .getByRole("button", { name: "Add wearer", exact: true })
        .click();
      await page.locator("#wearer-mode").selectOption("new");
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Your latest input is not saved." }),
      ).toBeVisible();
      await expect(
        page.getByRole("alert").filter({ hasText: "Your draft is saved" }),
      ).toHaveCount(0);
      expect(new URL(page.url()).search).toBe("");
      await expect(page.locator("#wearer-mode")).toBeEnabled();
      page.once("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "Close form", exact: true })
        .click();
    },
    {
      onFailure: async () => {
        page.on("dialog", (d) => d.accept());
        await page.goto("about:blank");
      },
    },
  );
});
