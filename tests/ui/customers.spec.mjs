import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("CW-01/02/07/08/11/12/13 customers save/reopen, bilingual reflow, response-loss replay, conflict and access clearing", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180000);
  const canary = "Synthetic-Private-CW78";
  const correctionResponses = [];
  page.on("response", async (response) => {
    if (
      response.request().method() === "PATCH" &&
      response.url().includes("/customers/")
    ) {
      const body = await response.json().catch(() => ({}));
      correctionResponses.push({
        status: response.status(),
        etag: response.headers().etag,
        code: body.error?.code,
      });
    }
  });
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      for (const path of [
        "/customers",
        "/customers/new",
        "/customers/019a5e55-2222-7000-8000-000000000001",
      ]) {
        const response = await page.request.get(`${origin}${path}`, {
          maxRedirects: 0,
        });
        expect(response.status()).toBe(307);
        expect(new URL(response.headers().location, origin).pathname).toBe(
          "/sign-in",
        );
      }
      const password = "synthetic-customer-owner-password-78";
      expect(
        (
          await post(
            "/owner/setup",
            { name: "Synthetic owner", email: "owner@example.test", password },
            {
              "X-Setup-Token": setupToken,
              "Idempotency-Key": crypto.randomUUID(),
            },
          )
        ).status(),
      ).toBe(200);
      expect(
        (await post("/owner/verify", { code: await code() })).status(),
      ).toBe(200);
      expect(
        (
          await post("/auth/sign-in/email", {
            email: "owner@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      const pending = await page.request.get(`${origin}/customers/new`, {
        maxRedirects: 0,
      });
      expect(new URL(pending.headers().location, origin).pathname).toBe(
        "/onboarding",
      );
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "Synthetic customer shop" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      await page.goto(`${origin}/dashboard`);
      await page.getByRole("link", { name: "Customers", exact: true }).click();
      await expect(page.locator("h2")).toHaveText(
        "Your first customer starts here",
      );
      await page
        .getByRole("link", { name: "Add customer", exact: true })
        .click();
      await page.locator("#customer-name").fill("Cancelled synthetic entry");
      let dialogs = 0;
      const discard = async (dialog) => {
        dialogs++;
        await dialog.accept();
      };
      page.on("dialog", discard);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/customers`);
      page.off("dialog", discard);
      expect(dialogs).toBe(1);
      await page
        .getByRole("link", { name: "Add customer", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save customer", exact: true })
        .click();
      await expect(page.locator("#customer-name")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await page.locator("#customer-name").fill(`மீனா ${canary}`);
      // Explicit language switches preserve original names and all unsaved values.
      for (const locale of ["en", "ta"])
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          await expect(page.locator("#customer-name")).toHaveValue(
            `மீனா ${canary}`,
          );
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          for (const width of [320, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
          // 200% text on a phone, including the three-destination navigation.
          await page.setViewportSize({ width: 320, height: 900 });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "";
          });
          await page.setViewportSize(info.project.use.viewport);
          await page.screenshot({
            path: `.scratch/customer-review/${info.project.name}-${locale}-${dark ? "dark" : "light"}-create.png`,
            fullPage: true,
          });
        }
      await prepareOwnerScreen(page, "en", false);
      await page.locator("#customer-notice-language").selectOption("ta");
      await page.locator("#customer-consent-source").selectOption("in-person");
      await page.locator("#customer-consent").check();
      await expect(page.locator("#customer-notice-language")).toHaveAttribute(
        "aria-invalid",
        "false",
      );
      expect(
        (
          await page
            .getByRole("link", { name: "Back to customers" })
            .boundingBox()
        ).height,
      ).toBeGreaterThanOrEqual(44);
      // Commit then lose the response. Retrying must use the same key/payload.
      const attempts = [];
      let lose = true;
      await page.route(`**/api/shops/${shopId}/customers`, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        attempts.push({
          key: route.request().headers()["idempotency-key"],
          body: route.request().postData(),
        });
        const response = await route.fetch();
        if (lose) {
          lose = false;
          await route.abort("failed");
        } else await route.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "Save customer", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Retry the same save" }),
      ).toBeVisible();
      await expect(page.locator("#customer-name")).toBeDisabled();
      await expect(page.locator(".customer-form")).not.toContainText(
        "Changes are not saved yet",
      );
      await page.getByRole("button", { name: "Retry the same save" }).click();
      await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
      await expect(page.locator(".customer-details h2")).toHaveText(
        `மீனா ${canary}`,
      );
      expect(attempts).toHaveLength(2);
      expect(attempts[0]).toEqual(attempts[1]);
      const customerId = new URL(page.url()).pathname.split("/").at(-1);
      const current = await (
        await page.request.get(
          `${origin}/api/shops/${shopId}/customers/${customerId}`,
        )
      ).json();
      // Real API competitors establish a stale edit; the UI must retain the proposal.
      await page
        .getByRole("button", { name: "Correct details", exact: true })
        .click();
      await page.locator("#customer-phone").fill("+1 (202) 555-0101");
      await page.locator("#customer-aliases").fill("Meenaa\nMeena");
      const updated = {
        displayName: current.displayName,
        phone: "+1 202 555 0101",
        aliases: ["Meenaa", "Meena"],
        notes: "Concurrent saved note",
      };
      expect(
        (
          await page.request.patch(
            `${origin}/api/shops/${shopId}/customers/${customerId}`,
            {
              data: updated,
              headers: {
                Origin: origin,
                "Idempotency-Key": crypto.randomUUID(),
                "If-Match": `"v${current.version}"`,
              },
            },
          )
        ).status(),
      ).toBe(200);
      await page.locator("#customer-notes").fill("Proposed note retained");
      await page
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      await expect(page.locator(".customer-feedback")).toContainText(
        "Someone changed this customer",
      );
      await expect(page.locator(".customer-conflict")).toContainText(
        "Concurrent saved note",
      );
      await expect(page.locator("#customer-notes")).toHaveValue(
        "Proposed note retained",
      );
      await page.getByRole("button", { name: "Reload saved details" }).click();
      await page.locator("#customer-notes").fill("Final private note");
      await context.setOffline(true);
      await page
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      await expect(page.locator("#customer-notes")).toHaveValue(
        "Final private note",
      );
      await expect(page.locator(".customer-feedback")).toContainText("offline");
      await context.setOffline(false);
      await page
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      await expect(page.locator(".customer-details")).toContainText(
        "Final private note",
      );
      await page.getByRole("link", { name: "Back to customers" }).click();
      for (const query of ["மீனா", "Meenaa", "+1 (202) 555-0101", "0101"]) {
        await page.locator("#customer-search").fill(query);
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await expect(page.locator(".customer-list")).toContainText(canary);
        expect(new URL(page.url()).search).toBe("");
      }
      await page.locator("#customer-search").fill("No such invented customer");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.locator(".customer-empty")).toContainText(
        "No matching customers",
      );
      await page
        .getByRole("link", { name: "Add customer", exact: true })
        .click();
      await page.locator("#customer-name").fill("Different synthetic person");
      await page.getByText("Optional details", { exact: true }).click();
      await page.locator("#customer-phone").fill("+1 202 555 0101");
      await page.locator("#customer-notice-language").selectOption("en");
      await page.locator("#customer-consent-source").selectOption("phone");
      await page.locator("#customer-consent").check();
      const secondResponse = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/shops/${shopId}/customers`) &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Save customer", exact: true })
        .click();
      const second = await secondResponse;
      if (second.status() === 429) {
        await expect(page.locator(".customer-feedback")).toContainText(
          "Too many requests",
        );
        await expect(page.locator("#customer-name")).toBeEnabled();
        const seconds = Number(second.headers()["retry-after"]);
        expect(seconds).toBeGreaterThan(0);
        expect(seconds).toBeLessThanOrEqual(60);
        await page.waitForTimeout(seconds * 1000 + 250);
        await page
          .getByRole("button", { name: "Save customer", exact: true })
          .click();
      }
      await expect(page.locator(".customer-details h2")).toHaveText(
        "Different synthetic person",
      );
      for (const locale of ["en", "ta"])
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
      await prepareOwnerScreen(page, "en", false);
      await page.getByRole("link", { name: "Back to customers" }).click();
      await page.locator("#customer-search").fill("0101");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.locator(".customer-list li")).toHaveCount(2);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.scratch/customer-review/${info.project.name}-directory.png`,
        fullPage: true,
      });
      // No personal values in URLs, persistent storage, public output, or diagnostics.
      expect(
        await page.evaluate(() =>
          JSON.stringify({
            local: { ...localStorage },
            session: { ...sessionStorage },
          }),
        ),
      ).not.toContain(canary);
      for (const path of [
        "/sign-in",
        "/offline.html",
        "/manifest.webmanifest",
        "/sw.js",
      ])
        expect(
          await (await page.request.get(`${origin}${path}`)).text(),
        ).not.toContain(canary);
      const pendingSearch = page.waitForRequest((r) =>
        r.url().endsWith(`/api/shops/${shopId}/customers/search`),
      );
      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      await page.route(
        `**/api/shops/${shopId}/customers/search`,
        async (route) => {
          const response = await route.fetch();
          await held;
          await route.fulfill({ response }).catch(() => {});
        },
      );
      await page.locator("#customer-search").fill("0101");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await pendingSearch;
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/sign-in`);
      release();
      await expect(page.locator("body")).not.toContainText(canary);
    },
    {
      secrets: [canary],
      onFailure: async () => {
        console.info(
          "Customer correction diagnostics",
          JSON.stringify(correctionResponses),
        );
        await context.setOffline(false);
        await page.goto("about:blank");
      },
    },
  );
});
