import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { bookingMessages, draftMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedBookingOrders } from "../../scripts/test-support/booking-orders.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("GB-B01/03/04/06/07/08/09 recover grouping draft, retry lost success, retain independent garments and bilingual accessible history", async ({
  page,
  context,
}, info) => {
  test.setTimeout(600000);
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
      let retryAfter = 0;
      page.on("response", (r) => {
        if (r.status() === 429)
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
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
        seeded = await seedBookingOrders({ setup, runtime, shopId, seed });
        const [blouse, salwar] = seeded.orders;
        await page.goto(`${origin}/orders`);
        await prepareOwnerScreen(page, "en");
        const t = bookingMessages.en;
        const waitAdmission = async () => {
          if (retryAfter) {
            const seconds = retryAfter;
            retryAfter = 0;
            await page.waitForTimeout((seconds + 1) * 1000);
          }
        };
        async function saveUntil() {
          const status = page
            .getByRole("status")
            .filter({
              hasText: new RegExp(`^${draftMessages.en.saved}$`),
            })
            .last();
          for (let attempt = 0; attempt < 4; attempt++) {
            await waitAdmission();
            const retry = page.getByRole("button", {
              name: draftMessages.en.retry,
              exact: true,
            });
            if (await retry.isVisible()) await retry.click();
            else
              await page
                .getByRole("button", { name: t.save, exact: true })
                .click();
            try {
              await expect(status).toBeVisible({ timeout: 2500 });
              return;
            } catch (error) {
              if (!retryAfter) throw error;
            }
          }
          throw Error("Save admission did not recover");
        }
        async function inspectUntil() {
          const review = page.getByRole("button", {
            name: t.review,
            exact: true,
          });
          for (let attempt = 0; attempt < 4; attempt++) {
            await waitAdmission();
            await review.click();
            // Review persists the fingerprint after the HTTP review. Wait for
            // both operations before checking confirmation or admission failure.
            await expect(review).toBeEnabled({ timeout: 15000 });
            try {
              await expect(
                page.getByRole("button", { name: t.confirm, exact: true }),
              ).toBeVisible({ timeout: 2000 });
              return;
            } catch (e) {
              if (!retryAfter) throw e;
            }
          }
          throw Error("Review admission did not recover");
        }

        async function confirmUntil(expected) {
          for (let attempt = 0; attempt < 6; attempt++) {
            await waitAdmission();
            const retry = page.getByRole("button", {
              name: draftMessages.en.retry,
              exact: true,
            });
            if (await retry.isVisible()) await retry.click();
            else
              await page
                .getByRole("button", { name: t.confirm, exact: true })
                .click();
            try {
              await expect(expected).toBeVisible({ timeout: 2000 });
              return;
            } catch (e) {
              if (!retryAfter && !(await retry.isVisible())) throw e;
            }
          }
          throw Error("Confirmation did not recover");
        }
        const open = async (p = page) => {
          await p.getByRole("button", { name: t.title, exact: true }).click();
          await expect(
            p.getByRole("heading", { name: t.title, exact: true }).first(),
          ).toBeVisible();
        };
        await open();
        await page.getByRole("button", { name: t.new, exact: true }).click();
        await expect(
          page
            .getByRole("region", { name: t.choose })
            .getByText("SYNTHETIC Kavya காவ்யா", { exact: false }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: `${t.add} ${blouse.code}`, exact: true })
          .click();
        await page
          .getByRole("button", { name: `${t.add} ${salwar.code}`, exact: true })
          .click();
        await page
          .getByLabel(t.occasion, { exact: true })
          .selectOption("bridal");
        await page.getByLabel(t.event, { exact: true }).fill("2026-12-01");
        const note = page.getByLabel(t.notes, { exact: true });
        await note.dispatchEvent("compositionstart");
        await note.fill("SYNTHETIC family — குடும்ப வருகை");
        const stay = (dialog) => dialog.dismiss();
        page.on("dialog", stay);
        await page.getByRole("button", { name: t.back, exact: true }).click();
        page.off("dialog", stay);
        await expect(page.getByLabel(t.notes, { exact: true })).toHaveValue(
          "SYNTHETIC family — குடும்ப வருகை",
        );
        await note.dispatchEvent("compositionend");
        await page
          .getByLabel(t.reason, { exact: true })
          .fill("SYNTHETIC initial grouping");
        await saveUntil();
        const resumeTab = await context.newPage();
        await resumeTab.goto(`${origin}/orders`);
        await open(resumeTab);
        await resumeTab
          .getByRole("button", { name: `${t.resume} 1`, exact: true })
          .click();
        await expect(
          resumeTab.getByLabel(t.notes, { exact: true }),
        ).toHaveValue("SYNTHETIC family — குடும்ப வருகை");
        await resumeTab.close();
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await open();
        await page
          .getByRole("button", { name: `${t.resume} 1`, exact: true })
          .click();
        await expect(page.getByLabel(t.notes, { exact: true })).toHaveValue(
          "SYNTHETIC family — குடும்ப வருகை",
        );
        await expect(
          page.getByText("SYNTHETIC Kavya காவ்யா", { exact: false }).first(),
        ).toBeVisible();
        await inspectUntil();
        await expect(
          page.getByRole("button", { name: t.confirm, exact: true }),
        ).toBeVisible();
        const attempts = [];
        let dropped = false;
        await page.route("**/api/shops/*/drafts/*/promote", async (route) => {
          const req = route.request();
          attempts.push({
            body: req.postData(),
            key: req.headers()["idempotency-key"],
            etag: req.headers()["if-match"],
          });
          const response = await route.fetch();
          if (!dropped && response.status() === 200) {
            dropped = true;
            await route.abort("failed");
          } else await route.fulfill({ response });
        });
        await confirmUntil(
          page.getByRole("heading", {
            name: "BK-000001 · Version 1",
            exact: true,
          }),
        );
        expect(dropped).toBe(true);
        expect(attempts.length).toBeGreaterThanOrEqual(2);
        for (const attempt of attempts.slice(1))
          expect(attempt).toEqual(attempts[0]);
        await page.unroute("**/api/shops/*/drafts/*/promote");
        await expect(
          page.getByText(`${t.subtotal}: ₹1,200.00 · ${t.unknown}: 1`, {
            exact: true,
          }),
        ).toBeVisible();
        expect(await setup(`orders/${blouse.id}/read`)).toEqual(blouse);
        expect(await setup(`orders/${salwar.id}/read`)).toEqual(salwar);
        await page.getByRole("button", { name: t.edit, exact: true }).click();
        await page.getByLabel(t.event, { exact: true }).fill("2026-12-09");
        await page
          .getByLabel(t.reason, { exact: true })
          .fill("SYNTHETIC changed occasion date");
        await inspectUntil();
        await expect(
          page.getByRole("button", { name: t.confirm, exact: true }),
        ).toBeVisible();
        const current = (await setup("orders/bookings/list", { body: {} }))
          .bookings[0];
        const competing = {
          customerId: blouse.intake.customerId,
          target: { id: current.id, version: current.version },
          context: {
            ...current.revision.context,
            notes: "SYNTHETIC competing context",
          },
          orders: [],
          reason: "SYNTHETIC second session edit",
          reviewFingerprint: null,
        };
        competing.reviewFingerprint = (
          await setup("orders/bookings/review", { body: competing })
        ).fingerprint;
        const competingId = randomUUID().replace(/^(........-....-)./, "$17");
        await setup(`drafts/${competingId}`, {
          method: "PUT",
          body: {
            workflow: "booking.group",
            schemaVersion: 1,
            payload: competing,
          },
        });
        await setup(`drafts/${competingId}/promote`, {
          body: {},
          etag: '"v1"',
        });
        await confirmUntil(
          page.getByRole("button", { name: t.reload, exact: true }),
        );
        await expect(
          page.getByRole("button", { name: t.reload, exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: t.reload, exact: true }).click();
        await expect(
          page.getByText("2026-12-01 · SYNTHETIC competing context", {
            exact: true,
          }),
        ).toBeVisible();
        await page.getByRole("button", { name: t.rebase, exact: true }).click();
        await inspectUntil();
        await confirmUntil(
          page.getByRole("heading", {
            name: "BK-000001 · Version 3",
            exact: true,
          }),
        );
        await expect(
          page.getByRole("heading", {
            name: "BK-000001 · Version 3",
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: t.history, exact: true })
          .click();
        await expect(
          page
            .getByRole("region", { name: t.history, exact: true })
            .getByText("2026-12-01 · SYNTHETIC family — குடும்ப வருகை", {
              exact: true,
            }),
        ).toBeVisible();
        await mkdir(".scratch/grouped-bookings-b/captures", {
          recursive: true,
        });
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            await prepareOwnerScreen(page, locale, theme === "dark");
            const words = bookingMessages[locale];
            await expect(
              page
                .getByRole("heading", { name: words.title, exact: true })
                .first(),
            ).toBeVisible();
            await page.getByLabel(words.detail, { exact: true }).check();
            await page.getByLabel(words.detail, { exact: true }).uncheck();
            for (const o of seeded.orders)
              await expect(
                page.getByRole("heading", {
                  name: `${o.code} · ${o.wearer.label}`,
                  exact: true,
                }),
              ).toBeVisible();
            expect(
              await page
                .getByLabel(words.detail, { exact: true })
                .evaluate(
                  (el) => el.closest("label").getBoundingClientRect().height,
                ),
            ).toBeGreaterThanOrEqual(44);
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.screenshot({
              path: `.scratch/grouped-bookings-b/captures/${info.project.name}-${locale}-${theme}.png`,
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
        await prepareOwnerScreen(page, "en");
        await expectStaticPwaStorage(page);
        const other = await context.newPage();
        await other.goto(`${origin}/orders`);
        await open(other);
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(
          other.getByRole("heading", {
            name: "Sign in to Aarili",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          other.getByText("SYNTHETIC family — குடும்ப வருகை", { exact: true }),
        ).toHaveCount(0);
        await other.close();
      } finally {
        await seeded?.close();
        await seed.close();
      }
    },
  );
});
