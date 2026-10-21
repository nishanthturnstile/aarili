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

test("GB-B07 IME defers saves and in-flight grouping save retains newer typing across reload", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180000);
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
        const t = bookingMessages.en;
        await page.goto(`${origin}/orders`);
        await prepareOwnerScreen(page, "en");
        await page.getByRole("button", { name: t.title, exact: true }).click();
        await page.getByRole("button", { name: t.new, exact: true }).click();
        const note = page.getByLabel(t.notes, { exact: true }),
          original = "SYNTHETIC குடும்ப வருகை",
          newer = "SYNTHETIC குடும்ப வருகை — புதிய குறிப்பு";
        await note.dispatchEvent("compositionstart");
        for (const o of seeded.orders)
          await page
            .getByRole("button", { name: `${t.add} ${o.code}`, exact: true })
            .click();
        await note.fill(original);
        await page
          .getByLabel(t.reason, { exact: true })
          .fill("SYNTHETIC recovery review");
        const attempts = [];
        let entered, release;
        const ready = new Promise((r) => {
            entered = r;
          }),
          gate = new Promise((r) => {
            release = r;
          });
        await page.route("**/api/shops/*/drafts/*", async (route) => {
          const req = route.request();
          if (req.method() !== "PUT") {
            await route.continue();
            return;
          }
          const body = req.postDataJSON();
          if (body.workflow !== "booking.group") {
            await route.continue();
            return;
          }
          attempts.push({
            body,
            key: req.headers()["idempotency-key"],
            etag: req.headers()["if-match"],
          });
          const response = await route.fetch();
          if (attempts.length === 1) {
            expect(response.status()).toBe(200);
            entered();
            await gate;
          }
          await route.fulfill({ response });
        });
        await page.getByRole("button", { name: t.save, exact: true }).click();
        await page.waitForTimeout(1200);
        expect(attempts).toHaveLength(0);
        await note.dispatchEvent("compositionend");
        await Promise.race([
          ready,
          page.waitForTimeout(15000).then(() => {
            throw Error("Missing save barrier");
          }),
        ]);
        await note.fill(newer);
        release();
        await expect.poll(() => attempts.length, { timeout: 15000 }).toBe(2);
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: draftMessages.en.saved })
            .last(),
        ).toBeVisible();
        expect(attempts[0].body.payload.context.notes).toBe(original);
        expect(attempts[1].body.payload.context.notes).toBe(newer);
        expect(attempts[1].key).not.toBe(attempts[0].key);
        expect(attempts[1].etag).toBe('"v1"');
        expect(attempts[1].body.payload.orders).toEqual(
          attempts[0].body.payload.orders,
        );
        await page.unroute("**/api/shops/*/drafts/*");
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await page.getByRole("button", { name: t.title, exact: true }).click();
        await page
          .getByRole("button", { name: `${t.resume} 1`, exact: true })
          .click();
        await expect(page.getByLabel(t.notes, { exact: true })).toHaveValue(
          newer,
        );
        await expectStaticPwaStorage(page);
        await mkdir(".scratch/grouped-bookings-b/captures", {
          recursive: true,
        });
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            await prepareOwnerScreen(page, locale, theme === "dark");
            const words = bookingMessages[locale];
            await expect(
              page.getByLabel(words.notes, { exact: true }),
            ).toHaveValue(newer);
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page
              .getByRole("heading", { name: words.title, exact: true })
              .first()
              .scrollIntoViewIfNeeded();
            const orientation = page.getByRole("region", {
              name: words.draft,
              exact: true,
            });
            await expect(
              orientation.getByText("SYNTHETIC Kavya காவ்யா", { exact: false }),
            ).toBeVisible();
            await expect(orientation.getByRole("status")).toHaveText(
              draftMessages[locale].saved,
            );
            expect(
              await orientation.evaluate(
                (el) => el.getBoundingClientRect().bottom <= innerHeight,
              ),
            ).toBe(true);
            await page.screenshot({
              path: `.scratch/grouped-bookings-b/captures/${info.project.name}-editor-${locale}-${theme}.png`,
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
      } finally {
        await seeded?.close();
        await seed.close();
      }
    },
  );
});
