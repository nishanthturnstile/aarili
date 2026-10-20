import { randomUUID } from "node:crypto";
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

test("GB-C07/08/09 grouped IME and in-flight line typing survive reload and explicit server conflict recovery", async ({
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
        seeded = await seedBookingOrders({
          setup,
          runtime,
          shopId,
          seed,
          acceptOrders: false,
        });
        const t = groupIntakeMessages.en,
          b = bookingMessages.en,
          o = orderMessages.en,
          d = draftMessages.en,
          id = randomUUID().replace(/^(........-....-)./, "$17"),
          original = "SYNTHETIC குடும்ப வரைவு",
          newer = "SYNTHETIC புதிய ஆடை வழிமுறை",
          lines = seeded.intakes.map((intake) => ({
            id: randomUUID(),
            intake,
          }));
        await setup(`drafts/${id}`, {
          method: "PUT",
          body: {
            workflow: "order.group",
            schemaVersion: 1,
            payload: {
              context: {
                occasion: "visit",
                eventDate: "",
                notes: "",
                payerId: null,
              },
              reason: "SYNTHETIC recovery",
              lines,
              commercial: {
                basis: "garment-prices",
                packagePriceState: "to-be-quoted",
                packagePriceText: "",
              },
              review: null,
            },
          },
        });
        const open = async () => {
          await page.getByRole("button", { name: t.new, exact: true }).click();
          const resume = page.getByRole("button", {
              name: `${t.resume} 1`,
              exact: true,
            }),
            more = page.getByRole("button", { name: b.more, exact: true });
          for (let i = 0; i < 6; i++) {
            await expect(resume.or(more)).toBeVisible();
            if (await resume.isVisible()) {
              await resume.click();
              return;
            }
            await more.click();
            await page.waitForTimeout(100);
          }
          throw Error("Grouped draft missing");
        };
        await page.goto(`${origin}/orders`);
        await prepareOwnerScreen(page, "en");
        await open();
        await page
          .getByRole("button", { name: o.detailed, exact: true })
          .click();
        const notes = page.getByLabel(b.notes, { exact: true });
        await notes.dispatchEvent("compositionstart");
        await notes.fill(original);
        let entered, release;
        const ready = new Promise((r) => (entered = r)),
          gate = new Promise((r) => (release = r)),
          attempts = [];
        await page.route(`**/api/shops/*/drafts/${id}`, async (route) => {
          const req = route.request();
          if (req.method() !== "PUT") {
            await route.continue();
            return;
          }
          const body = req.postDataJSON();
          attempts.push({
            key: req.headers()["idempotency-key"],
            etag: req.headers()["if-match"],
            body,
          });
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          if (attempts.length === 1) {
            entered();
            await gate;
          }
          await route.fulfill({ response });
        });
        await page.getByRole("button", { name: b.save, exact: true }).click();
        await page.waitForTimeout(150);
        expect(attempts).toHaveLength(0);
        await notes.dispatchEvent("compositionend");
        await page.getByRole("button", { name: b.save, exact: true }).click();
        await ready;
        await page.getByLabel(o.instructions, { exact: true }).fill(newer);
        expect(attempts[0].body.payload.lines[0].intake.instructions).toBe(
          seeded.intakes[0].instructions,
        );
        release();
        await expect.poll(() => attempts.length).toBe(2);
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: /^Saved$/ })
            .last(),
        ).toBeVisible();
        expect(attempts[1].key).not.toBe(attempts[0].key);
        expect(attempts[0].etag).toBe('"v1"');
        expect(attempts[1].etag).toBe('"v2"');
        expect(attempts[1].body.payload.lines[0].intake.instructions).toBe(
          newer,
        );
        expect(attempts[1].body.payload.lines.map((l) => l.id)).toEqual(
          lines.map((l) => l.id),
        );
        expect(attempts[1].body.payload.lines[1]).toEqual(
          attempts[0].body.payload.lines[1],
        );
        await page.unroute(`**/api/shops/*/drafts/${id}`);
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await open();
        await expect(
          page.getByLabel(o.instructions, { exact: true }),
        ).toHaveValue(newer);
        await expect(page.getByLabel(b.notes, { exact: true })).toHaveValue(
          original,
        );
        const current = await setup(`drafts/${id}`, { method: "GET" });
        await setup(`drafts/${id}`, {
          method: "PUT",
          etag: `"v${current.version}"`,
          body: {
            workflow: "order.group",
            schemaVersion: 1,
            payload: {
              ...current.payload,
              context: {
                ...current.payload.context,
                notes: "SYNTHETIC server comparison",
              },
            },
          },
        });
        await page
          .getByLabel(o.instructions, { exact: true })
          .fill("SYNTHETIC local conflict edit");
        await page.getByRole("button", { name: b.save, exact: true }).click();
        await expect(
          page.getByText("SYNTHETIC server comparison", { exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: d.server, exact: true }).click();
        await expect(
          page.getByLabel(o.instructions, { exact: true }),
        ).toHaveValue(newer);
        await expect(page.getByLabel(b.notes, { exact: true })).toHaveValue(
          "SYNTHETIC server comparison",
        );
        await expect(
          page.getByRole("button", { name: t.confirm, exact: true }),
        ).toHaveCount(0);
        for (const locale of ["en", "ta"])
          for (const theme of ["light", "dark"]) {
            await prepareOwnerScreen(page, locale, theme === "dark");
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await expect(
              page.getByLabel(orderMessages[locale].instructions, {
                exact: true,
              }),
            ).toHaveValue(newer);
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
      } finally {
        await seeded?.close();
        await seed.close();
      }
    },
  );
});
