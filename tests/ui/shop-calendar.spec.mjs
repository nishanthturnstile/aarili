import { mkdir } from "node:fs/promises";
import {
  emptyCalendarDay,
  emptyCalendarDefinition,
} from "@aarili/contracts/shop-calendar";
import { shopCalendarMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("SS-02/07/10 calendar drafts, split hours, independent exceptions, stale review and bilingual history", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240000);
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    const password = "synthetic-calendar-85-owner-password";
    expect(
      (
        await post(
          "/owner/setup",
          {
            name: "Synthetic calendar owner",
            email: "calendar@example.test",
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
          email: "calendar@example.test",
          password,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(
          "/owner/complete",
          { shopName: "Synthetic calendar shop" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const { shopId } = await (
      await page.request.get(`${origin}/api/owner/shop`)
    ).json();
    const api = `${origin}/api/shops/${shopId}`;
    await page.goto(`${origin}/settings`);
    await page
      .getByRole("button", { name: "Working calendar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Customer hours", exact: true })
      .click();
    // Exercise IME-safe batching, as the existing wearer recovery workflows do.
    await page.locator(".calendar-editor").dispatchEvent("compositionstart");
    await page.locator("#week-0-state").selectOption("open");
    const hours = page
      .locator("fieldset.calendar-day")
      .first()
      .locator("fieldset.calendar-ranges")
      .first();
    await hours.getByRole("button", { name: "Add range", exact: true }).click();
    await page.locator("#week-0-hours-0-start").fill("09:00");
    await page.locator("#week-0-hours-0-end").fill("17:00");
    await page.locator("#week-0-breaks-state").selectOption("defined");
    const day = page.locator("fieldset.calendar-day").first();
    await day
      .locator("fieldset.calendar-ranges")
      .nth(1)
      .getByRole("button", { name: "Add range", exact: true })
      .click();
    await page.locator("#week-0-breaks-0-start").fill("12:00");
    await page.locator("#week-0-breaks-0-end").fill("13:00");
    await page.locator("#week-0-slots-state").selectOption("defined");
    await day
      .locator("fieldset.calendar-ranges")
      .nth(2)
      .getByRole("button", { name: "Add range", exact: true })
      .click();
    await page.locator("#week-0-slots-0-start").fill("13:00");
    await page.locator("#week-0-slots-0-end").fill("13:20");
    await page
      .getByRole("button", { name: "Add dated replacement", exact: true })
      .click();
    await page.locator("#exception-0-date").fill("2026-10-19");
    await page
      .getByRole("button", { name: "Add dated replacement", exact: true })
      .click();
    await page.locator("#exception-1-date").fill("2026-10-19");
    await expect(page.locator("#exception-1-date")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#exception-1-date-error")).toBeVisible();
    await page
      .getByRole("button", { name: "Go to the first error", exact: true })
      .click();
    await expect(page.locator("#exception-1-date")).toBeFocused();
    await page
      .getByRole("button", { name: "Remove replacement", exact: true })
      .last()
      .click();
    await page.locator(".calendar-editor").dispatchEvent("compositionend");
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/draft=/);
    const draftUrl = page.url();
    await page.reload();
    await expect(page.locator("#week-0-hours-0-start")).toHaveValue("09:00");
    const second = await browser.newContext({
      storageState: await page.context().storageState(),
      viewport: info.project.use.viewport,
    });
    try {
      const other = await second.newPage();
      await other.goto(draftUrl);
      await expect(other.locator("#week-0-hours-0-end")).toHaveValue("17:00");
    } finally {
      await second.close();
    }
    await page.locator("#calendar-preview-date").fill("2026-10-19");
    await page
      .getByRole("button", { name: "Preview availability", exact: true })
      .click();
    await expect(page.locator(".calendar-preview")).toContainText(
      "Dated replacement",
    );
    await expect(page.locator(".calendar-preview")).toContainText(
      "No working hours",
    );
    // Another domain publishes after this customer draft was based on version 0.
    const definition = emptyCalendarDefinition();
    definition.week[0] = {
      ...emptyCalendarDay(),
      state: "open",
      ranges: [{ start: "18:00", end: "24:00" }],
    };
    const id = crypto.randomUUID().replace(/^(........-....-)./, "$17");
    expect(
      (
        await page.request.put(`${api}/drafts/${id}`, {
          data: {
            workflow: "shop.calendar",
            schemaVersion: 1,
            payload: {
              domain: "production",
              baseVersion: 0,
              baseRevisionId: null,
              definition,
            },
          },
          headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
        })
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
    await page
      .getByRole("button", { name: "Review calendar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Publish calendar", exact: true })
      .click();
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
        name: "Create a new draft from my changes and latest calendar",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: /^Draft saved$/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Review calendar", exact: true })
      .click();
    const finalResponse = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
    );
    await page
      .getByRole("button", { name: "Publish calendar", exact: true })
      .click();
    let finalResult = await finalResponse;
    if (finalResult.status() === 429) {
      const seconds = Number(finalResult.headers()["retry-after"]);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(60);
      await expect(
        page.getByRole("status").filter({ hasText: /Too many requests/ }),
      ).toBeVisible();
      // Honour the real server admission window; do not weaken its policy for tests.
      await page.waitForTimeout(seconds * 1000 + 100);
      const retry = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
      );
      await page
        .getByRole("button", { name: "Publish calendar", exact: true })
        .click();
      finalResult = await retry;
    }
    expect(finalResult.status(), await finalResult.text()).toBe(200);
    await expect(
      page.getByRole("status").filter({ hasText: /^Calendar published$/ }),
    ).toBeVisible();
    const published = await (
      await page.request.get(`${api}/settings/calendar`)
    ).json();
    expect(published.version).toBe(2);
    expect(published.revision.calendar.production.week[0].ranges[0].end).toBe(
      "24:00",
    );
    expect(published.revision.calendar.customer.exceptions[0].day.state).toBe(
      "closed",
    );
    await page
      .getByRole("button", { name: "Load calendar history", exact: true })
      .click();
    await expect(
      page.getByRole("group").filter({ hasText: /Version 1/ }),
    ).toBeVisible();
    await mkdir(".scratch/calendar-captures", { recursive: true });
    for (const locale of ["en", "ta"]) {
      await prepareOwnerScreen(page, locale);
      const t = shopCalendarMessages[locale];
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
        path: `.scratch/calendar-captures/${info.project.name}-${locale}.png`,
        fullPage: true,
      });
    }
    await expectStaticPwaStorage(page);
    const abandonedId = crypto
      .randomUUID()
      .replace(/^(........-....-)./, "$17");
    expect(
      (
        await page.request.put(`${api}/drafts/${abandonedId}`, {
          data: {
            workflow: "shop.calendar",
            schemaVersion: 1,
            payload: {
              domain: "customer",
              baseVersion: published.version,
              baseRevisionId: published.revision.id,
              definition: published.revision.calendar.customer,
            },
          },
          headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(
          `/shops/${shopId}/drafts/${abandonedId}/abandon`,
          {},
          { "Idempotency-Key": crypto.randomUUID(), "If-Match": '"v1"' },
        )
      ).status(),
    ).toBe(200);
    await page.goto(`${origin}/settings?draft=${abandonedId}`);
    await expect(page.locator("#week-0-hours-0-start")).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Start a new draft using these values",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Save draft", exact: true }),
    ).toHaveCount(0);
    await page.route("**/settings/calendar", (route) => route.abort("failed"));
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Retry loading calendar and draft",
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute("**/settings/calendar");
    await page
      .getByRole("button", {
        name: "Retry loading calendar and draft",
        exact: true,
      })
      .click();
    await expect(page.locator("#week-0-hours-0-start")).toHaveValue("09:00");
    await expect(page.locator("#week-0-hours-0-start")).toBeDisabled();
    await expect(page).toHaveURL(new RegExp(`draft=${abandonedId}`));
  });
});
