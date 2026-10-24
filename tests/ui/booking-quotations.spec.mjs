import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { estimateMessages, quotationMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedBookingQuotation } from "../../scripts/test-support/booking-quotation-fixtures.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });
test("B-01/03/05/06/07/08 package references and extras, exact stacked discounts, private costs, IME/reload and original-key response loss", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const email = "quotation-owner@example.test",
        password = "synthetic-quotation-private-password";
      expect(
        (
          await post(
            "/owner/setup",
            { name: "Synthetic quotation owner", email, password },
            { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      expect(
        (await post("/owner/verify", { code: await code() })).status(),
      ).toBe(200);
      expect(
        (await post("/auth/sign-in/email", { email, password })).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC quotations" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const setup = async (
        path,
        { method = "POST", body, etag, key = randomUUID() } = {},
      ) => {
        const cookies = await page.context().cookies(origin);
        const r = await seedCommand(
          new Request(`${origin}/api/shops/${shopId}/${path}`, {
            method,
            headers: {
              Origin: origin,
              Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
              "Content-Type": "application/json",
              "Idempotency-Key": key,
              ...(etag ? { "If-Match": etag } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
        expect(r.status, `${path}: ${await r.clone().text()}`).toBe(200);
        return r.json();
      };
      const seed = await seedBookingQuotation({ setup, runtime, shopId });
      try {
        let limitedUntil = 0;
        page.on("response", (r) => {
          if (r.status() >= 400 && r.url().includes("/api/"))
            void r
              .json()
              .then((body) =>
                console.info(
                  "Quotation diagnostic",
                  new URL(r.url()).pathname,
                  r.status(),
                  body.error?.code,
                ),
              )
              .catch(() => {});
          if (r.status() === 429)
            limitedUntil =
              Date.now() +
              Number(r.headers()["retry-after"] ?? 60) * 1000 +
              150;
        });
        const waitLimit = async () => {
          const left = limitedUntil - Date.now();
          if (left > 0) await page.waitForTimeout(left);
        };
        const t = quotationMessages.en,
          e = estimateMessages.en;
        await page.goto(`${origin}/orders?section=quotations`);
        await page
          .locator("#quotation-booking")
          .selectOption(seed.detail.booking.id);
        await page.getByRole("button", { name: t.new, exact: true }).click();
        const editor = page.getByRole("region", { name: t.new, exact: true }),
          envelopes = [];
        let lost = false;
        await page.route("**/api/shops/*/drafts/*", async (route) => {
          const r = route.request();
          if (
            r.method() !== "PUT" ||
            r.postDataJSON()?.workflow !== "pricing.quotation"
          )
            return route.continue();
          envelopes.push({
            key: r.headers()["idempotency-key"],
            body: r.postData(),
          });
          if (!lost) {
            lost = true;
            const committed = await route.fetch();
            expect(committed.status()).toBe(200);
            return route.abort("connectionfailed");
          }
          return route.continue();
        });
        await editor
          .locator("fieldset")
          .first()
          .dispatchEvent("compositionstart");
        await page
          .locator("#quotation-reason")
          .fill("SYNTHETIC தமிழ் மாற்று முன்மொழிவு");
        await page.waitForTimeout(1100);
        expect(envelopes).toHaveLength(0);
        await editor
          .locator("fieldset")
          .first()
          .dispatchEvent("compositionend");
        await expect(editor.getByRole("status").first()).toHaveText(e.checking);
        await editor
          .getByRole("button", { name: e.retry, exact: true })
          .click();
        await expect(editor.getByRole("status").first()).toHaveText(e.saved);
        expect(envelopes[1]).toEqual(envelopes[0]);
        await expect
          .poll(() => new URL(page.url()).searchParams.get("quotationDraft"))
          .toBeTruthy();
        await page.reload();
        await expect(page.locator("#quotation-reason")).toHaveValue(
          "SYNTHETIC தமிழ் மாற்று முன்மொழிவு",
        );
        const resumed = page.getByRole("region", { name: t.new, exact: true });
        await page
          .locator("#quotation-estimate-0")
          .selectOption(seed.unknownEstimateId);
        await resumed
          .getByRole("button", { name: e.review, exact: true })
          .click();
        await expect(
          resumed.getByRole("region", { name: t.customer, exact: true }),
        ).toContainText(t.incomplete);
        await expect(
          resumed.getByRole("button", { name: t.saveVersion, exact: true }),
        ).toBeDisabled();
        await page.locator("#quotation-estimate-0").selectOption("");
        await resumed
          .getByRole("button", { name: e.review, exact: true })
          .click();
        await expect(resumed).toContainText(t.stale);
        await expect(resumed).toContainText("1,950.00");
        await expect(
          resumed.getByRole("button", { name: t.saveVersion, exact: true }),
        ).toBeDisabled();
        await resumed
          .getByRole("button", { name: e.apply, exact: true })
          .click();
        await resumed
          .getByRole("button", { name: t.bind, exact: true })
          .click();
        const eligibility = resumed.getByRole("checkbox");
        for (let i = 0; i < (await eligibility.count()); i++)
          await eligibility.nth(i).check();
        await resumed.getByText(t.discounts, { exact: true }).click();
        await resumed
          .getByRole("button", { name: t.addDiscount, exact: true })
          .click();
        const packageKey = `package:${seed.detail.commercial.id}`;
        await page.locator("#quotation-target-0").selectOption(packageKey);
        await page.locator("#quotation-value-0").fill("100");
        await page
          .locator("#quotation-discount-reason-0")
          .fill("SYNTHETIC package line discount");
        await resumed
          .getByRole("button", { name: t.addDiscount, exact: true })
          .click();
        await page.locator("#quotation-value-1").fill("50.01");
        await page
          .locator("#quotation-discount-reason-1")
          .fill("SYNTHETIC booking discount");
        await page
          .locator("#quotation-decision")
          .fill(
            "SYNTHETIC owner reviewed exact eligible scope, stacking and allocation",
          );
        await page.locator("#quotation-stacking").selectOption("true");
        await page.locator("#quotation-manual").selectOption("true");
        await resumed.getByText(t.private, { exact: true }).first().click();
        await page.locator("#quotation-cost").fill("25.01");
        await page
          .locator("#quotation-cost-reason")
          .fill("SYNTHETIC PRIVATE craft cost source");
        async function review() {
          await waitLimit();
          await resumed
            .getByRole("button", { name: e.save, exact: true })
            .click();
          await expect
            .poll(async () => {
              const text = await resumed
                .getByRole("status")
                .first()
                .textContent();
              return text === e.saved || text?.includes(e.rateLimited);
            })
            .toBeTruthy();
          if (
            (await resumed.getByRole("status").first().textContent()).includes(
              e.rateLimited,
            )
          ) {
            await waitLimit();
            await resumed
              .getByRole("button", { name: e.retry, exact: true })
              .click();
          }
          await expect(resumed.getByRole("status").first()).toHaveText(e.saved);
          await resumed
            .getByRole("button", { name: e.review, exact: true })
            .click();
          await expect
            .poll(
              async () =>
                (await resumed
                  .getByRole("button", { name: t.saveVersion, exact: true })
                  .isEnabled()) ||
                (
                  await resumed.getByRole("status").first().textContent()
                ).includes(e.rateLimited),
            )
            .toBeTruthy();
          if (
            (await resumed.getByRole("status").first().textContent()).includes(
              e.rateLimited,
            )
          ) {
            await waitLimit();
            await resumed
              .getByRole("button", { name: e.retry, exact: true })
              .click();
            await expect(resumed.getByRole("status").first()).toHaveText(
              e.saved,
            );
            if (
              !(await resumed
                .getByRole("button", { name: t.saveVersion, exact: true })
                .isEnabled())
            ) {
              await resumed
                .getByRole("button", { name: e.review, exact: true })
                .click();
            }
          }
          await expect(
            resumed.getByRole("button", { name: t.saveVersion, exact: true }),
          ).toBeEnabled();
        }
        await review();
        await expect(resumed).toContainText("1,799.99");
        await resumed
          .getByRole("button", {
            name: `${t.view}: ${t.garmentView}`,
            exact: true,
          })
          .click();
        await expect(resumed).toContainText("1,799.99");
        await resumed
          .getByRole("button", {
            name: `${t.view}: ${t.bookingView}`,
            exact: true,
          })
          .click();
        let promotionLost = false;
        const promotions = [];
        await page.route("**/api/shops/*/drafts/*/promote", async (route) => {
          promotions.push({
            key: route.request().headers()["idempotency-key"],
            body: route.request().postData(),
          });
          if (!promotionLost) {
            const result = await route.fetch();
            if (result.status() === 429)
              return route.fulfill({ response: result });
            expect(result.status()).toBe(200);
            promotionLost = true;
            return route.abort("connectionfailed");
          }
          return route.continue();
        });
        await waitLimit();
        const settlePromotion = () =>
          new Promise((resolve) => {
            const done = async (request) => {
              if (
                request.method() !== "POST" ||
                !request.url().endsWith("/promote")
              )
                return;
              page.off("requestfinished", done);
              page.off("requestfailed", done);
              resolve((await request.response())?.status() ?? null);
            };
            page.on("requestfinished", done);
            page.on("requestfailed", done);
          });
        let settlement = settlePromotion();
        await resumed
          .getByRole("button", { name: t.saveVersion, exact: true })
          .click();
        for (let attempt = 0; attempt < 4; attempt++) {
          const status = await settlement;
          if (status === 200) {
            await expect(resumed.getByRole("status").first()).toHaveText(
              t.savedVersion,
            );
            break;
          }
          if (status === 429)
            await expect(resumed.getByRole("status").first()).toContainText(
              e.rateLimited,
            );
          else
            await expect(resumed.getByRole("status").first()).toContainText(
              e.checking,
            );
          await waitLimit();
          settlement = settlePromotion();
          await resumed
            .getByRole("button", { name: e.retry, exact: true })
            .click();
        }
        await expect(resumed.getByRole("status").first()).toHaveText(
          t.savedVersion,
        );
        expect(promotionLost).toBe(true);
        expect(promotions.length).toBeGreaterThan(1);
        for (const envelope of promotions)
          expect(envelope).toEqual(promotions[0]);
        await page.getByRole("button", { name: e.close, exact: true }).click();
        const version = page.getByRole("region", {
          name: t.savedVersion,
          exact: true,
        });
        await expect(version).toContainText(t.superseded);
        await expect(
          version.getByRole("region", { name: t.customer, exact: true }),
        ).toContainText("1,799.99");
        await expect(
          version.getByRole("region", { name: t.customer, exact: true }),
        ).not.toContainText("25.01");
        await expect(
          version.getByRole("region", { name: t.customer, exact: true }),
        ).not.toContainText("PRIVATE");
        await page.reload();
        await page
          .getByRole("button", { name: new RegExp(t.savedVersion) })
          .first()
          .click();
        await expect(
          page.getByRole("region", { name: t.savedVersion, exact: true }),
        ).toContainText("1,799.99");
        await mkdir(".impeccable/review", { recursive: true });
        for (const locale of ["en", "ta"]) {
          await prepareOwnerScreen(page, locale);
          await expect(
            page.getByRole("heading", {
              name: quotationMessages[locale].title,
              exact: true,
            }),
          ).toBeVisible();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: `.impeccable/review/booking-quotations-${info.project.name}-${locale}.png`,
            fullPage: true,
          });
        }
        await page.setViewportSize({ width: 320, height: 800 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expectStaticPwaStorage(page);
      } finally {
        await seed.close();
      }
    },
  );
});
