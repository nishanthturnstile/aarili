import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import {
  customerHistoryMessages,
  repeatOrderMessages,
  repeatServiceMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceAdditions } from "../../scripts/test-support/service-additions.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("RH-07/08/12/15 bilingual customer/wearer discovery, pagination, source/repeat links and access-change clearing", async ({
  page,
  context,
}, info) => {
  test.setTimeout(300000);
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-history-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC history owner",
              email: "history@example.test",
              password,
            },
            { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      expect(
        (await post("/owner/verify", { code: await code() })).status(),
      ).toBe(200);
      expect(
        (
          await post("/auth/sign-in/email", {
            email: "history@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC history shop" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const entry = await (
          await page.request.get(`${origin}/api/owner/entry`)
        ).json(),
        shopId = entry.shop.shopId;
      const cookies = (await context.cookies(origin))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      async function setup(
        path,
        { method = "POST", body, etag, key = randomUUID() } = {},
      ) {
        const r = await seedCommand(
          new Request(`${origin}/api/shops/${shopId}/${path}`, {
            method,
            headers: {
              Origin: origin,
              Cookie: cookies,
              "Content-Type": "application/json",
              "Idempotency-Key": key,
              ...(etag ? { "If-Match": etag } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
        expect(r.status, `${path}: ${await r.clone().text()}`).toBe(200);
        return r.json();
      }
      const services = await seedServiceAdditions({ setup, runtime, shopId });
      try {
        const value = services.saree.intake,
          r = await setup("small-services/orders/review", { body: value });
        const serviceId = await services.config.publish("order.service", {
          ...value,
          commitmentReview: {
            fingerprint: r.fingerprint,
            acknowledged: true,
            exceptionReason: "SYNTHETIC history",
            waiveRush: false,
            waiverReason: "",
          },
        });
        const customerId = services.seed.customer.customerId;
        const bookingDetail = await setup("orders/bookings/read", {
          body: { id: services.groups[0].revisionId, revision: true },
        });

        const order = await setup(`orders/${services.customId}/read`, {
          body: {},
        });
        let version = order.version;
        for (let i = 0; i < 15; i++) {
          const changed = await setup(`orders/${order.id}/presentation`, {
            body: { mode: i % 2 ? "simple" : "detailed" },
            etag: `"v${version}"`,
          });
          version = changed.version;
        }
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        for (const locale of ["en", "ta"]) {
          const t = customerHistoryMessages[locale];
          await page.goto(`${origin}/customers/${customerId}`);
          await prepareOwnerScreen(page, locale);
          const panel = page.locator(".customer-history");
          await page.locator(".wearer-choices button").first().click();
          await expect(
            panel.getByRole("heading", { name: t.wearerTitle, exact: true }),
          ).toBeVisible();
          await panel
            .getByRole("button", { name: t.open, exact: true })
            .click();
          await expect(
            panel.locator(".customer-history-events > li").first(),
          ).toBeVisible();
          await panel.getByRole("button", { name: t.all, exact: true }).click();
          await expect(
            panel.locator(".customer-history-events > li"),
          ).toHaveCount(0);
          await panel
            .getByRole("button", { name: t.refresh, exact: true })
            .click();

          await expect(
            panel.locator(".customer-history-events > li"),
          ).toHaveCount(15);
          await expect(
            panel.getByText(t.attribution, { exact: true }),
          ).toBeVisible();
          await expect(
            panel.getByText(t.unavailableHelp, { exact: true }),
          ).toBeVisible();
          await panel
            .getByRole("button", { name: t.more, exact: true })
            .click();
          await expect
            .poll(() => panel.locator(".customer-history-events > li").count())
            .toBeGreaterThan(15);
          const ids = await panel
            .locator(".customer-history-events > li details")
            .count();
          expect(ids).toBeGreaterThan(15);
          const input = panel.getByLabel(t.search, { exact: true });
          await input.fill("no-match-history-zzzz");
          await panel
            .getByRole("button", { name: t.find, exact: true })
            .click();
          await expect(
            panel.getByText(t.noMatch, { exact: true }),
          ).toBeVisible();
          await input.fill("மீனா");
          await panel
            .getByRole("button", { name: t.find, exact: true })
            .click();
          await expect(
            panel.locator(".customer-history-events > li").first(),
          ).toBeVisible();
          expect(page.url()).not.toContain(encodeURIComponent("மீனா"));
          // An exact source ID leads to the existing independent repeat flow.
          await input.fill(services.customId);
          await panel
            .getByRole("button", { name: t.find, exact: true })
            .click();
          const source = panel
            .getByRole("link", { name: t.source, exact: true })
            .first();
          await source.click();
          await expect(page).toHaveURL(
            new RegExp(`order=${services.customId}`),
          );
          await prepareOwnerScreen(page, locale);
          await expect(
            page.getByRole("button", {
              name: repeatOrderMessages[locale].inspect,
              exact: true,
            }),
          ).toBeVisible();
          await page.goto(`${origin}/customers/${customerId}`);
          await prepareOwnerScreen(page, locale);
          await panel
            .getByRole("button", { name: t.open, exact: true })
            .click();
          await panel.getByLabel(t.search, { exact: true }).fill(serviceId);
          await panel
            .getByRole("button", { name: t.find, exact: true })
            .click();
          await panel
            .getByRole("link", { name: t.source, exact: true })
            .first()
            .click();
          await expect(page).toHaveURL(new RegExp(`serviceOrder=${serviceId}`));
          await prepareOwnerScreen(page, locale);
          await expect(
            page.getByRole("button", {
              name: repeatServiceMessages[locale].inspect,
              exact: true,
            }),
          ).toBeVisible();
          await page.goto(`${origin}/customers/${customerId}`);
          await prepareOwnerScreen(page, locale);
          await panel
            .getByRole("button", { name: t.open, exact: true })
            .click();
          await panel
            .getByLabel(t.search, { exact: true })
            .fill(bookingDetail.booking.id);
          await panel
            .getByRole("button", { name: t.find, exact: true })
            .click();
          await panel
            .getByRole("link", { name: t.source, exact: true })
            .first()
            .click();
          await prepareOwnerScreen(page, locale);
          await expect(
            page.getByRole("heading", {
              name: new RegExp(bookingDetail.booking.code),
            }),
          ).toBeVisible();
          await page.goto(`${origin}/customers/${customerId}`);
          await prepareOwnerScreen(page, locale);
          await panel
            .getByRole("button", { name: t.open, exact: true })
            .click();
          await expect(
            panel.locator(".customer-history-events > li").first(),
          ).toBeVisible();
          await panel.locator("summary").first().click();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await mkdir(".scratch/customer-history", { recursive: true });
          await page.screenshot({
            path: `.scratch/customer-history/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
          if (info.project.name === "tablet" && locale === "ta") {
            await page.setViewportSize({ width: 1180, height: 820 });
            await page.evaluate(
              () => (document.documentElement.style.fontSize = "200%"),
            );
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            await page.screenshot({
              path: ".scratch/customer-history/tablet-landscape-ta-200.png",
              fullPage: true,
            });
            await page.evaluate(
              () => (document.documentElement.style.fontSize = ""),
            );
          }
          // A 409 from the real contract clears every previously visible label.
          await page.route("**/customer-history", (route) =>
            route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                error: { code: "HISTORY_CHANGED", message: "Refresh" },
              }),
            }),
          );
          await panel
            .getByRole("button", { name: t.more, exact: true })
            .click();
          await expect(
            panel.getByText(t.changed, { exact: true }),
          ).toBeVisible();
          await expect(
            panel.locator(".customer-history-events > li"),
          ).toHaveCount(0);
          await page.unroute("**/customer-history");
        }
        await expectStaticPwaStorage(page);
        expect(errors).toEqual([]);
      } finally {
        await services.close();
      }
    },
  );
});
