import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import {
  draftMessages,
  orderAcceptanceMessages,
  orderMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedOrderAcceptance } from "../../scripts/test-support/order-acceptance.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("QO-01/03/05-11 bilingual current commitment → atomic booking → exact reopen, lost responses, modes and sign-out", async ({
  page,
  context,
}, info) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-acceptance-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC order owner",
              email: "acceptance@example.test",
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
            email: "acceptance@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC acceptance shop" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const entry = await (
          await page.request.get(`${origin}/api/owner/entry`)
        ).json(),
        shopId = entry.shop.shopId;
      const seed = await seedQuickOrder(runtime, shopId);
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
        expect(r.status).toBe(200);
        return r.json();
      }
      const date = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      let retryAfter = 0;
      page.on("response", (r) => {
        if (r.status() === 429)
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
      });
      async function waitSaved(locale = "en") {
        for (let i = 0; i < 8; i++) {
          try {
            await expect(
              page
                .getByRole("status")
                .getByText(draftMessages[locale].saved, { exact: true }),
            ).toBeVisible({ timeout: 1500 });
            return;
          } catch {}
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          const retry = page.getByRole("button", {
            name: draftMessages[locale].retry,
            exact: true,
          });
          if (await retry.isVisible()) await retry.click();
        }
        await expect(
          page
            .getByRole("status")
            .getByText(draftMessages[locale].saved, { exact: true }),
        ).toBeVisible();
      }
      async function retryExactUntil(locator, name) {
        for (let i = 0; i < 5; i++) {
          try {
            await expect(locator).toBeVisible({ timeout: 1500 });
            return;
          } catch {}
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          const retry = page.getByRole("button", { name, exact: true });
          if (await retry.isVisible()) await retry.click();
        }
        await expect(locator).toBeVisible();
      }
      try {
        await seedOrderAcceptance(setup, seed.sources);
        await page.goto(`${origin}/orders`);
        await prepareOwnerScreen(page, "en");
        const start = Date.now();
        await page
          .getByRole("button", { name: orderMessages.en.newDraft, exact: true })
          .click();
        await page
          .getByLabel(orderMessages.en.query, { exact: true })
          .fill("Meena");
        await page
          .getByRole("button", { name: orderMessages.en.search, exact: true })
          .click();
        await page.getByRole("button", { name: /SYNTHETIC Meena/ }).click();
        await expect(
          page.getByLabel(orderMessages.en.wearerId, { exact: true }),
        ).toHaveValue(seed.wearer.wearerId);
        await page
          .getByRole("button", {
            name: orderMessages.en.sourceSearch,
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: seed.sources.before.definition.content.labelEn,
            exact: true,
          })
          .click();
        await page
          .getByLabel(orderMessages.en.deliveryDate, { exact: true })
          .fill(date);
        await page
          .getByLabel(orderMessages.en.priceState, { exact: true })
          .selectOption("quoted");
        await page
          .getByLabel(orderMessages.en.priceText, { exact: true })
          .fill("0");
        await page
          .getByRole("button", { name: orderMessages.en.save, exact: true })
          .click();
        await waitSaved();
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.review,
            exact: true,
          })
          .click();
        await page
          .getByLabel(orderAcceptanceMessages.en.acknowledged, { exact: true })
          .check();
        const draftUrl = page.url();
        let dropped = false,
          acceptedResponse;
        await page.route("**/drafts/*/promote", async (route) => {
          if (dropped) return route.continue();
          const r = await route.fetch();
          if (r.status() === 200) {
            acceptedResponse = await r.json();
            dropped = true;
            await route.abort("failed");
          } else await route.fulfill({ response: r });
        });
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          })
          .click();
        for (let i = 0; i < 4 && !dropped; i++) {
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          const reviewButton = page.getByRole("button", {
            name: orderAcceptanceMessages.en.review,
            exact: true,
          });
          if (await reviewButton.isEnabled()) {
            await reviewButton.click();
            await page
              .getByLabel(orderAcceptanceMessages.en.acknowledged, {
                exact: true,
              })
              .check();
            await page
              .getByRole("button", {
                name: orderAcceptanceMessages.en.confirm,
                exact: true,
              })
              .click();
          }
          await page.waitForTimeout(250);
        }
        await expect(
          page
            .getByRole("status")
            .getByText(draftMessages.en.checking, { exact: true }),
        ).toBeVisible();
        expect(dropped).toBe(true);
        await retryExactUntil(
          page.getByRole("heading", { name: /Order booked: QO-000001/ }),
          draftMessages.en.retry,
        );
        console.info(
          `QO-01 accepted intake elapsed ${Date.now() - start}ms (${info.project.name}); includes transport retry/admission waits; automation excludes owner reading, not physical target proof`,
        );
        const orderId = acceptedResponse.draft.result.id;
        const first = await setup(`orders/${orderId}/read`);
        expect(first.pricePaise).toBe(0);
        expect(first.version).toBe(1);
        const secondContext = await context
          .browser()
          .newContext({ viewport: page.viewportSize() });
        try {
          await secondContext.addCookies(await context.cookies());
          const second = await secondContext.newPage();
          await second.goto(draftUrl);
          await expect(
            second.getByRole("heading", { name: /Order booked: QO-000001/ }),
          ).toBeVisible();
        } finally {
          await secondContext.close();
        }
        await page.reload();
        await expect(
          page.getByRole("heading", { name: /Order booked: QO-000001/ }),
        ).toBeVisible();
        for (const locale of ["en", "ta"])
          for (const dark of [false, true]) {
            await prepareOwnerScreen(page, locale, dark);
            const a = orderAcceptanceMessages[locale];
            await expect(
              page.getByRole("heading", {
                name: new RegExp(`${a.booked}: QO-000001`),
              }),
            ).toBeVisible();
            const scan = await new AxeBuilder({ page }).analyze();
            expect(scan.violations).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            ).toBe(true);
            await mkdir(".scratch/quick-order-b-captures", { recursive: true });
            await page.screenshot({
              path: `.scratch/quick-order-b-captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
              fullPage: true,
            });
          }
        const viewport = page.viewportSize();
        await page.setViewportSize({ width: 1180, height: 820 });
        await page.evaluate(() => {
          document.documentElement.style.zoom = "2";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          document.documentElement.style.zoom = "";
        });
        await page.setViewportSize(viewport);
        await prepareOwnerScreen(page, "en");
        let modeDropped = false,
          modeAttemptResolved;
        await page.route("**/orders/*/presentation", async (route) => {
          if (modeDropped) return route.continue();
          const r = await route.fetch();
          if (r.status() === 200) {
            modeDropped = true;
            await route.abort("failed");
          } else await route.fulfill({ response: r });
          modeAttemptResolved(r.status());
        });
        for (let i = 0; i < 4 && !modeDropped; i++) {
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          const choose = page.getByRole("button", {
            name: /Change order presentation:/,
          });
          // A known 429 rejects this attempt. Wait for the actual response,
          // rather than racing React state with an arbitrary short delay.
          const responded = new Promise((resolve) => {
            modeAttemptResolved = resolve;
          });
          await choose.click();
          expect([200, 429]).toContain(await responded);
          if (!modeDropped) {
            await expect(choose).toBeEnabled();
          }
        }
        expect(modeDropped).toBe(true);
        await expect(
          page.getByText(orderAcceptanceMessages.en.checking, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: orderMessages.en.newDraft,
            exact: true,
          }),
        ).toBeDisabled();
        await retryExactUntil(
          page.getByRole("button", {
            name: "Change order presentation: Simple",
            exact: true,
          }),
          orderAcceptanceMessages.en.retry,
        );
        const mode = await setup(`orders/${orderId}/read`);
        await expect(
          page.getByRole("button", {
            name: orderMessages.en.newDraft,
            exact: true,
          }),
        ).toBeEnabled();
        expect(mode.version).toBe(2);
        expect(mode.requirements).toEqual(first.requirements);
        expect(mode.snapshotDigest).toBe(first.snapshotDigest);
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.history,
            exact: true,
          })
          .click();
        await expect(page.getByText(/2 · Detailed/)).toBeVisible();
        await setup(`orders/${orderId}/presentation`, {
          body: { mode: "simple" },
          etag: '"v2"',
        });
        await page
          .getByRole("button", {
            name: "Change order presentation: Simple",
            exact: true,
          })
          .click();
        for (let i = 0; i < 4; i++) {
          try {
            await expect(
              page.getByText(orderAcceptanceMessages.en.stale, { exact: true }),
            ).toBeVisible({ timeout: 1500 });
            break;
          } catch {}
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          await page
            .getByRole("button", {
              name: "Change order presentation: Simple",
              exact: true,
            })
            .click();
        }
        await expect(
          page.getByText(orderAcceptanceMessages.en.serverMode, {
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.reload,
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", {
            name: "Change order presentation: Detailed",
            exact: true,
          }),
        ).toBeVisible();
        // A second real server draft sees the first order's committed capacity.
        const d = randomUUID().replace(/^(........-....-)./, "$17"),
          value = {
            ...emptyQuickOrder(),
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
            manifest: {
              entryId: seed.sources.before.entryId,
              revisionId: seed.sources.before.id,
              definitionId: seed.sources.before.definition.id,
            },
            deliveryDate: date,
          };
        await setup(`drafts/${d}`, {
          method: "PUT",
          body: { workflow: "order.quick", schemaVersion: 1, payload: value },
        });
        await page.goto(`${origin}/orders?draft=${d}`);
        await prepareOwnerScreen(page, "ta");
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.ta.review,
            exact: true,
          })
          .click();
        await expect(
          page.getByText(orderAcceptanceMessages.ta.capacityExceeded, {
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByLabel(orderAcceptanceMessages.ta.acknowledged, { exact: true })
          .check();
        await expect(
          page.getByRole("button", {
            name: orderAcceptanceMessages.ta.confirm,
            exact: true,
          }),
        ).toBeDisabled();
        await page
          .getByLabel(orderAcceptanceMessages.ta.reason, { exact: true })
          .fill("SYNTHETIC reviewed extra slot");
        await page
          .getByRole("button", { name: orderMessages.ta.save, exact: true })
          .click();
        await waitSaved("ta");
        expect(
          (await setup(`drafts/${d}`, { method: "GET" })).payload
            .commitmentReview.exceptionReason,
        ).toBe("SYNTHETIC reviewed extra slot");
        await page.reload();
        await prepareOwnerScreen(page, "ta");
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.ta.review,
            exact: true,
          })
          .click();
        await expect(
          page.getByLabel(orderAcceptanceMessages.ta.reason, { exact: true }),
        ).toHaveValue("SYNTHETIC reviewed extra slot");
        await expect(
          page.getByRole("button", {
            name: orderAcceptanceMessages.ta.confirm,
            exact: true,
          }),
        ).toBeDisabled();
        await page
          .getByLabel(orderAcceptanceMessages.ta.acknowledged, { exact: true })
          .check();
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.ta.confirm,
            exact: true,
          })
          .click();
        for (let i = 0; i < 5; i++) {
          try {
            await expect(
              page.getByRole("heading", {
                name: new RegExp(
                  `${orderAcceptanceMessages.ta.booked}: QO-000002`,
                ),
              }),
            ).toBeVisible({ timeout: 1500 });
            break;
          } catch {}
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          await page
            .getByRole("button", {
              name: orderAcceptanceMessages.ta.review,
              exact: true,
            })
            .click();
          await page
            .getByLabel(orderAcceptanceMessages.ta.acknowledged, {
              exact: true,
            })
            .check();
          await page
            .getByLabel(orderAcceptanceMessages.ta.reason, { exact: true })
            .fill("SYNTHETIC reviewed extra slot");
          await page
            .getByRole("button", {
              name: orderAcceptanceMessages.ta.confirm,
              exact: true,
            })
            .click();
        }
        await expect(
          page.getByRole("heading", {
            name: new RegExp(`${orderAcceptanceMessages.ta.booked}: QO-000002`),
          }),
        ).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        const list = await setup("orders/list", { body: {} });
        expect(list.orders).toHaveLength(2);
        expect(list.orders[0].review.evaluation.facts.existing).toBe(1);
        await prepareOwnerScreen(page, "en");
        await expectStaticPwaStorage(page);
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Sign in to Aarili", exact: true }),
        ).toBeVisible();
        expect(await page.locator("body").innerText()).not.toContain(
          "QO-000001",
        );
      } finally {
        await seed.close();
      }
    },
  );
});
