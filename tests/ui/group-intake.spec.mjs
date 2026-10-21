import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import {
  bookingMessages,
  draftMessages,
  groupIntakeMessages,
  orderMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedBookingOrders } from "../../scripts/test-support/booking-orders.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("GB-C01/03/04/06/07/08/09 convert and recover multi-garment intake, accept atomically and distinguish package proposal", async ({
  page,
  context,
}, info) => {
  test.setTimeout(900000);
  page.setDefaultTimeout(15000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-booking-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC pieces owner",
              email: "pieces@example.test",
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
            email: "pieces@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC pieces review" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const entry = await (
          await page.request.get(`${origin}/api/owner/entry`)
        ).json(),
        shopId = entry.shop.shopId;
      const seed = await seedQuickOrder(runtime, shopId, { outfit: true });
      let retryAfter = 0,
        promotionLimited = false;
      page.on("response", (r) => {
        if (r.status() === 429) {
          if (new URL(r.url()).pathname.endsWith("/promote"))
            promotionLimited = true;
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
        }
      });
      const cookies = (await context.cookies(origin))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      const setup = async (
        path,
        { method = "POST", body, etag, key = randomUUID() } = {},
      ) => {
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
        expect(r.status).toBe(200);
        return r.json();
      };

      let seeded;
      try {
        seeded = await seedBookingOrders({
          setup,
          runtime,
          shopId,
          seed,
          acceptOrders: false,
        });
        const [blouse, salwar] = seeded.intakes,
          t = groupIntakeMessages.en,
          b = bookingMessages.en,
          o = orderMessages.en,
          d = draftMessages.en,
          sourceId = randomUUID().replace(/^(........-....-)./, "$17");
        await setup(`drafts/${sourceId}`, {
          method: "PUT",
          body: { workflow: "order.quick", schemaVersion: 1, payload: blouse },
        });
        const packageId = randomUUID().replace(/^(........-....-)./, "$17");
        await setup(`drafts/${packageId}`, {
          method: "PUT",
          body: {
            workflow: "order.group",
            schemaVersion: 1,
            payload: {
              context: {
                occasion: "bridal",
                eventDate: "2026-12-01",
                notes: "SYNTHETIC package scope",
                payerId: null,
              },
              reason: "SYNTHETIC package proposal",
              lines: seeded.intakes.map((intake) => ({
                id: randomUUID(),
                intake,
              })),
              commercial: {
                basis: "package-proposal",
                packagePriceState: "quoted",
                packagePriceText: "2000",
              },
              review: null,
            },
          },
        });
        const waitAdmission = async () => {
          if (retryAfter) {
            const seconds = retryAfter;
            retryAfter = 0;
            await page.waitForTimeout((seconds + 1) * 1000);
          }
        };
        async function saved() {
          for (let i = 0; i < 5; i++) {
            await waitAdmission();
            const retry = page.getByRole("button", {
              name: d.retry,
              exact: true,
            });
            if (await retry.isVisible()) await retry.click();
            else
              await page
                .getByRole("button", { name: b.save, exact: true })
                .click();
            try {
              await expect(
                page
                  .getByRole("status")
                  .filter({ hasText: new RegExp(`^${d.saved}$`) })
                  .last(),
              ).toBeVisible({ timeout: 2500 });
              return;
            } catch (e) {
              if (!retryAfter) throw e;
            }
          }
          throw Error("Save admission not recovered");
        }
        async function resume(p = page, packageCase = false) {
          const row = p.getByRole("listitem").filter({
            has: p.getByText(
              packageCase
                ? "SYNTHETIC package scope"
                : "SYNTHETIC குடும்ப வருகை",
              { exact: true },
            ),
          });
          const button = row.getByRole("button", {
            name: new RegExp(`^${t.resume} `),
          });
          for (let i = 0; i < 6 && !(await button.isVisible()); i++) {
            const more = p.getByRole("button", { name: b.more, exact: true });
            await expect(button.or(more)).toBeVisible();
            if (await button.isVisible()) break;
            await more.click();
            await p.waitForTimeout(100);
          }
          await button.click();
        }
        async function inspect() {
          await saved();
          await page
            .getByRole("button", { name: t.review, exact: true })
            .click();
          await expect(
            page.getByRole("region", { name: t.review, exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", {
              name: "SYNTHETIC bottom",
              exact: true,
            }),
          ).toBeVisible();
        }
        async function accept() {
          await inspect();
          await page
            .getByLabel(t.exception, { exact: true })
            .fill("SYNTHETIC explicit reviewed exception");
          await page.getByLabel(t.ack, { exact: true }).check();
          await saved();
          await expect(
            page.getByRole("button", { name: t.confirm, exact: true }),
          ).toBeEnabled();
          await waitAdmission();
          await page
            .getByRole("button", { name: t.confirm, exact: true })
            .click();
        }
        const conversions = [];
        let conversionDropped = false;
        await page.route(
          `**/api/shops/*/drafts/${sourceId}/convert`,
          async (route) => {
            const req = route.request();
            conversions.push({
              key: req.headers()["idempotency-key"],
              etag: req.headers()["if-match"],
              body: req.postData(),
            });
            if (!conversionDropped) {
              conversionDropped = true;
              const r = await route.fetch();
              expect(r.status()).toBe(200);
              await route.abort("failed");
            } else await route.continue();
          },
        );
        await page.goto(`${origin}/orders?draft=${sourceId}`);
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", { name: t.convert, exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: d.retry, exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: d.retry, exact: true }).click();
        await expect(
          page.getByRole("heading", { name: t.title, exact: true }),
        ).toBeVisible();
        expect(conversions).toHaveLength(2);
        expect(conversions[0]).toEqual(conversions[1]);
        await page.unroute(`**/api/shops/*/drafts/${sourceId}/convert`);
        await page.getByRole("button", { name: t.add, exact: true }).click();
        await page.getByRole("button", { name: t.copy, exact: true }).click();
        await page
          .getByLabel(o.wearerId, { exact: true })
          .selectOption({ label: "SYNTHETIC Kavya காவ்யா" });
        await page
          .getByLabel(o.sourceSearch, { exact: true })
          .fill("before-craft");
        await page
          .getByRole("button", { name: o.sourceSearch, exact: true })
          .click();
        await page
          .getByRole("button", {
            name: seed.sources.before.definition.content.labelEn,
            exact: true,
          })
          .click();
        await page
          .getByLabel(o.deliveryDate, { exact: true })
          .fill(salwar.deliveryDate);
        await page
          .getByRole("button", { name: o.detailed, exact: true })
          .click();
        await page
          .getByLabel(o.requestedDate, { exact: true })
          .fill(salwar.deliveryDate);
        await page
          .getByLabel(o.instructions, { exact: true })
          .fill("SYNTHETIC bottom unresolved — கீழ் பகுதி நிலுவை");
        await page.getByRole("button", { name: o.simple, exact: true }).click();
        await page
          .getByRole("button", { name: o.detailed, exact: true })
          .click();
        await expect(
          page.getByLabel(o.requestedDate, { exact: true }),
        ).toHaveValue(salwar.deliveryDate);
        const notes = page.getByLabel(b.notes, { exact: true });
        await notes.dispatchEvent("compositionstart");
        await notes.fill("SYNTHETIC குடும்ப வருகை");
        await notes.dispatchEvent("compositionend");
        await page
          .getByLabel(t.reason, { exact: true })
          .fill("SYNTHETIC atomic owner review");
        const stay = (dialog) => dialog.dismiss();
        page.on("dialog", stay);
        await page
          .getByRole("link", { name: "Customers", exact: true })
          .click();
        page.off("dialog", stay);
        await expect(notes).toHaveValue("SYNTHETIC குடும்ப வருகை");
        await saved();
        const converted = await setup(`drafts/${sourceId}`, { method: "GET" });
        const group = await setup(`drafts/${converted.result.id}`, {
          method: "GET",
        });
        expect(group.payload.lines).toHaveLength(2);
        expect(group.payload.lines[1].intake.wearerId).toBe(salwar.wearerId);
        const lineIds = group.payload.lines.map((l) => l.id);
        expect(new Set(lineIds).size).toBe(2);
        await page
          .getByRole("button", { name: `${t.up} 2`, exact: true })
          .click();
        await saved();
        await page
          .getByRole("button", { name: `${t.down} 1`, exact: true })
          .click();
        await saved();
        const tab = await context.newPage();
        await tab.goto(`${origin}/orders`);
        await prepareOwnerScreen(tab, "en");
        await tab.getByRole("button", { name: t.new, exact: true }).click();
        await resume(tab);
        await expect(tab.getByLabel(b.notes, { exact: true })).toHaveValue(
          "SYNTHETIC குடும்ப வருகை",
        );
        await tab.close();
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await page.getByRole("button", { name: t.new, exact: true }).click();
        await resume();
        await expect(page.getByLabel(b.notes, { exact: true })).toHaveValue(
          "SYNTHETIC குடும்ப வருகை",
        );
        const directory = page
          .locator(".booking-garments > .order-choices")
          .first();
        await expect(
          directory.getByText("SYNTHETIC Meena மீனா", { exact: true }),
        ).toBeVisible();
        await expect(
          directory.getByText("SYNTHETIC Kavya காவ்யா", { exact: true }),
        ).toBeVisible();
        await expect(
          directory.getByText("SYNTHETIC booking-blouse-before-craft", {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          directory.getByText(o.toBeQuoted, { exact: true }),
        ).toBeVisible();
        if (info.project.name === "desktop") {
          const listBox = await directory.boundingBox();
          const editorBox = await page
            .locator(".booking-garments > section")
            .first()
            .boundingBox();
          expect(editorBox.x).toBeGreaterThanOrEqual(listBox.x + listBox.width);
        }
        await mkdir(".scratch/grouped-bookings-c/captures", {
          recursive: true,
        });
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            await prepareOwnerScreen(page, locale, theme === "dark");
            const words = groupIntakeMessages[locale];
            await page
              .getByRole("heading", { name: words.title, exact: true })
              .scrollIntoViewIfNeeded();
            await expect(
              page
                .getByRole("region", { name: words.draft, exact: true })
                .getByText("SYNTHETIC Kavya காவ்யா", { exact: false }),
            ).toBeVisible();
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
              path: `.scratch/grouped-bookings-c/captures/${info.project.name}-editor-${locale}-${theme}.png`,
            });
          }
        await prepareOwnerScreen(page, "en");
        const promotions = [];
        let dropped = false,
          frozenPromotion;
        await page.route("**/api/shops/*/drafts/*/promote", async (route) => {
          const req = route.request();
          promotions.push({
            key: req.headers()["idempotency-key"],
            etag: req.headers()["if-match"],
            body: req.postData(),
          });
          if (!dropped) {
            const r = await route.fetch();
            if (r.status() === 200) {
              dropped = true;
              frozenPromotion = promotions.at(-1);
              await route.abort("failed");
            } else await route.fulfill({ response: r });
          } else await route.continue();
        });
        await accept();
        for (
          let i = 0;
          i < 6 &&
          !(await page.getByRole("heading", { name: /BK-000001/ }).isVisible());
          i++
        ) {
          await waitAdmission();
          const completed = page.getByRole("heading", { name: /BK-000001/ }),
            retry = page.getByRole("button", { name: d.retry, exact: true });
          await expect(completed.or(retry)).toBeVisible();
          if (await completed.isVisible()) break;
          await page
            .getByRole("button", { name: d.retry, exact: true })
            .click();
          try {
            await expect(
              page.getByRole("heading", { name: /BK-000001/ }),
            ).toBeVisible({ timeout: 2000 });
          } catch (error) {
            if (!retryAfter && !dropped) throw error;
          }
        }
        await expect(
          page.getByRole("heading", { name: /BK-000001/ }),
        ).toBeVisible();
        expect(promotions.length).toBeGreaterThanOrEqual(2);
        expect(dropped).toBe(true);
        expect(promotions.at(-1)).toEqual(frozenPromotion);
        await page.unroute("**/api/shops/*/drafts/*/promote");
        await page.goto(`${origin}/orders?draft=${sourceId}`);
        await prepareOwnerScreen(page, "en");
        await expect(
          page.getByRole("heading", { name: /BK-000001/ }),
        ).toBeVisible();
        await expect(
          page.getByText("SYNTHETIC Kavya காவ்யா", { exact: false }).first(),
        ).toBeVisible();
        await expect(
          page.getByText(/Known garment subtotal:.*1,200/),
        ).toBeVisible();
        await expect(page.getByText(/Unquoted garments: 1/)).toBeVisible();
        const accepted = await setup("orders/list", { body: {} });
        expect(accepted.orders).toHaveLength(2);
        expect(new Set(accepted.orders.map((x) => x.id)).size).toBe(2);
        expect(accepted.orders.map((x) => x.intake.instructions)).toContain(
          "SYNTHETIC bottom unresolved — கீழ் பகுதி நிலுவை",
        );
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            await prepareOwnerScreen(page, locale, theme === "dark");
            const words = bookingMessages[locale];
            await page.getByLabel(words.detail, { exact: true }).check();
            await page.getByLabel(words.detail, { exact: true }).uncheck();
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
              path: `.scratch/grouped-bookings-c/captures/${info.project.name}-booked-${locale}-${theme}.png`,
            });
          }
        if (info.project.name === "tablet") {
          await page.setViewportSize({ width: 1180, height: 820 });
          await page.evaluate(
            () => (document.documentElement.style.zoom = "200%"),
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.evaluate(() => (document.documentElement.style.zoom = ""));
        }
        await expectStaticPwaStorage(page);
        await prepareOwnerScreen(page, "en");
        await page.getByRole("button", { name: b.back, exact: true }).click();
        // Reopen through the real list rather than retaining fixture payload in browser storage.
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await page.getByRole("button", { name: t.new, exact: true }).click();
        await resume(page, true);
        await expect(
          page.getByLabel(t.packageAmount, { exact: true }),
        ).toHaveValue("2000");
        let packageAdmissionInjected = false;
        await page.route(
          `**/api/shops/*/drafts/${packageId}/promote`,
          async (route) => {
            if (packageAdmissionInjected) return route.continue();
            packageAdmissionInjected = true;
            return route.fulfill({
              status: 429,
              contentType: "application/json",
              headers: { "Retry-After": "0" },
              body: JSON.stringify({
                error: {
                  code: "RATE_LIMITED",
                  message: "SYNTHETIC known package admission refusal",
                },
              }),
            });
          },
        );
        await accept();
        for (
          let i = 0;
          i < 3 &&
          !(await page.getByRole("heading", { name: /BK-000002/ }).isVisible());
          i++
        ) {
          await waitAdmission();
          const completed = page.getByRole("heading", { name: /BK-000002/ }),
            rejected = page.getByText(d.promotionFailed, { exact: true }),
            retry = page.getByRole("button", {
              name: d.retry,
              exact: true,
            });
          await expect(completed.or(retry).or(rejected)).toBeVisible();
          if (await completed.isVisible()) break;
          if (await retry.isVisible()) await retry.click();
          else {
            expect(promotionLimited).toBe(true);
            await waitAdmission();
            promotionLimited = false;
            await page
              .getByRole("button", { name: t.confirm, exact: true })
              .click();
          }
        }
        expect(packageAdmissionInjected).toBe(true);
        await page.unroute(`**/api/shops/*/drafts/${packageId}/promote`);
        await expect(
          page.getByRole("heading", { name: /BK-000002/ }),
        ).toBeVisible();
        await expect(page.getByText(/Package proposal:.*2,000/)).toBeVisible();
        await page.goto(`${origin}/orders?draft=${packageId}`);
        await prepareOwnerScreen(page, "en");
        await expect(
          page.getByRole("heading", { name: /BK-000002/ }),
        ).toBeVisible();
        await expect(
          page.getByText(t.allocation, { exact: false }).first(),
        ).toBeVisible();
        await expect(page.getByText(/Known garment subtotal/)).toHaveCount(0);
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await page.getByRole("button", { name: b.title, exact: true }).click();
        await page
          .getByRole("button", { name: `${b.open} BK-000002`, exact: true })
          .click();
        await expect(page.getByText(/Package proposal:.*2,000/)).toBeVisible();
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Sign in to Aarili", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("SYNTHETIC package scope", { exact: true }),
        ).toHaveCount(0);
      } finally {
        await seeded?.close();
        await seed.close();
      }
    },
  );
});
