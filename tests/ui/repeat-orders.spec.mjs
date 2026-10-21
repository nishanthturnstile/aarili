import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import {
  draftMessages,
  orderAcceptanceMessages,
  orderMessages,
  repeatOrderMessages,
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

test("RH-01/02/03/04/06/09 repeat draft recovery, fresh commitment and bilingual resume", async ({
  page,
  context,
}, info) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  let retryAfter = 0;
  page.on("response", (response) => {
    if (response.status() === 429)
      retryAfter = Math.max(
        retryAfter,
        Number(response.headers()["retry-after"] ?? 1),
      );
  });
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
      try {
        await seedOrderAcceptance(setup, seed.sources);
        let intake = {
          ...emptyQuickOrder(),
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
          manifest: {
            entryId: seed.sources.before.entryId,
            revisionId: seed.sources.before.id,
            definitionId: seed.sources.before.definition.id,
          },
          deliveryDate: date,
          priceState: "quoted",
          priceText: "125.50",
          instructions: "SYNTHETIC repeat requested instructions",
        };
        const review = await setup("orders/review", { body: intake });
        intake = {
          ...intake,
          commitmentReview: {
            fingerprint: review.fingerprint,
            acknowledged: true,
            exceptionReason: "SYNTHETIC",
            waiveRush: false,
            waiverReason: "",
          },
        };
        const id = randomUUID().replace(/^(........-....-)./, "$17");
        await setup(`drafts/${id}`, {
          method: "PUT",
          body: { workflow: "order.quick", schemaVersion: 1, payload: intake },
        });
        const result = await setup(`drafts/${id}/promote`, {
            body: {},
            etag: '"v1"',
          }),
          sourceId = result.draft.result.id;
        const original = await setup(`orders/${sourceId}/read`);
        await page.goto(`${origin}/orders?order=${sourceId}`);
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: repeatOrderMessages.en.inspect,
            exact: true,
          })
          .click();
        await expect(
          page.getByText(repeatOrderMessages.en.reset, { exact: true }),
        ).toBeVisible();
        const choice = page.getByLabel(repeatOrderMessages.en.reuse, {
          exact: true,
        });
        await expect(choice).not.toBeChecked();
        await choice.focus();
        await choice.press("Space");
        await expect(choice).toBeChecked();
        let dropped = false,
          created;
        await page.route("**/repeat/create", async (route) => {
          if (dropped) return route.continue();
          let r;
          try {
            r = await route.fetch();
          } catch {
            await route.abort("failed");
            return;
          }
          console.info(`Repeat creation response: ${r.status()}`);
          if (r.status() === 200) {
            created = await r.json();
            dropped = true;
            await route.abort("failed");
          } else await route.fulfill({ response: r });
        });
        await page
          .getByRole("button", {
            name: repeatOrderMessages.en.create,
            exact: true,
          })
          .click();
        await expect(
          page
            .getByRole("button", {
              name: repeatOrderMessages.en.retry,
              exact: true,
            })
            .first(),
        ).toBeVisible();
        await expect.poll(() => dropped, { timeout: 30000 }).toBe(true);
        await page
          .getByRole("button", {
            name: repeatOrderMessages.en.retry,
            exact: true,
          })
          .first()
          .click();
        await expect(
          page.getByLabel(orderMessages.en.deliveryDate, { exact: true }),
        ).toHaveValue("");
        await expect(
          page.getByLabel(orderMessages.en.priceState, { exact: true }),
        ).toHaveValue("to-be-quoted");
        await expect(
          page.getByLabel(orderMessages.en.wearerId, { exact: true }),
        ).toBeDisabled();
        const draftUrl = page.url();
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
          .getByText(orderMessages.en.optional, { exact: true })
          .click();
        const instructions = page.getByLabel(orderMessages.en.instructions, {
          exact: true,
        });
        await instructions.dispatchEvent("compositionstart");
        await instructions.fill(intake.instructions);
        await instructions.dispatchEvent("compositionend");
        page.once("dialog", (dialog) => dialog.dismiss());
        await page
          .getByRole("link", { name: "Customers", exact: true })
          .click();
        expect(page.url()).toBe(draftUrl);
        await page
          .getByRole("button", { name: orderMessages.en.save, exact: true })
          .click();
        await expect(
          page
            .getByRole("status")
            .getByText(draftMessages.en.saved, { exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(
          page.getByLabel(orderMessages.en.priceText, { exact: true }),
        ).toHaveValue("0");
        for (const locale of ["en", "ta"]) {
          await prepareOwnerScreen(page, locale);
          await expect(
            page.getByText(repeatOrderMessages[locale].reset, { exact: true }),
          ).toBeVisible();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
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
          if (info.project.name === "phone") {
            await page.setViewportSize({ width: 800, height: 360 });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.setViewportSize({ width: 360, height: 800 });
          }
          await mkdir(`.scratch/repeat-orders/ui/${info.project.name}`, {
            recursive: true,
          });
          await page.screenshot({
            path: `.scratch/repeat-orders/ui/${info.project.name}/${locale}.png`,
            fullPage: true,
          });
        }
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.review,
            exact: true,
          })
          .click();
        const reason = page.getByLabel(orderAcceptanceMessages.en.reason, {
          exact: true,
        });
        await expect(reason).toBeVisible();
        await reason.fill("SYNTHETIC repeat capacity confirmation");
        await page
          .getByLabel(orderAcceptanceMessages.en.acknowledged, { exact: true })
          .check();
        let lostAcceptance = false;
        if (info.project.name === "phone")
          await page.route("**/drafts/*/promote", async (route) => {
            if (lostAcceptance) return route.continue();
            let response;
            try {
              response = await route.fetch();
            } catch {
              await route.abort("failed");
              return;
            }
            if (response.status() === 200) {
              lostAcceptance = true;
              await route.abort("failed");
            } else await route.fulfill({ response });
          });
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          })
          .click();
        if (info.project.name === "phone") {
          await expect
            .poll(() => lostAcceptance, { timeout: 30000 })
            .toBe(true);
          await page
            .getByRole("button", { name: draftMessages.en.retry, exact: true })
            .click();
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              await expect(
                page.getByRole("heading", { name: /Order booked: QO-000002/ }),
              ).toBeVisible({ timeout: 1500 });
              break;
            } catch {}
            if (retryAfter) {
              await page.waitForTimeout((retryAfter + 1) * 1000);
              retryAfter = 0;
            }
            const retry = page.getByRole("button", {
              name: draftMessages.en.retry,
              exact: true,
            });
            if (await retry.isVisible()) await retry.click();
          }
        }
        await expect(
          page.getByRole("heading", { name: /Order booked: QO-000002/ }),
        ).toBeVisible({ timeout: 30000 });
        expect(await setup(`orders/${sourceId}/read`)).toEqual(original);
        const links = await setup(`orders/${sourceId}/repeat/links`, {
          body: {},
        });
        expect(links.children).toHaveLength(1);
        const target = await setup(`orders/${links.children[0].id}/read`);
        expect(target.pricePaise).toBe(0);
        expect(target.intake.instructions).toBe(intake.instructions);
        expect(target.id).not.toBe(sourceId);
        expect(created.draft.id).toBe(
          new URL(draftUrl).searchParams.get("draft"),
        );
        await expectStaticPwaStorage(page);
        await expect(
          page.getByRole("button", {
            name: repeatOrderMessages.en.inspect,
            exact: true,
          }),
        ).toBeVisible();
        const wearerPath = `customers/${intake.customerId}/wearers/${intake.wearerId}`;
        const wearer = await setup(wearerPath, { method: "GET" });
        await setup(`${wearerPath}/consent-events`, {
          etag: `"v${wearer.version}"`,
          body: {
            purpose: "service",
            decision: "withdrawal",
            noticeId: syntheticWearerPolicy.notice.id,
            noticeExplained: true,
            language: "en",
            giverPersonId: wearer.personId,
            source: "in-person",
            occurredAt: new Date().toISOString(),
          },
        });
        await page
          .getByRole("button", {
            name: repeatOrderMessages.en.inspect,
            exact: true,
          })
          .click();
        await expect(page.getByText(/SYNTHETIC Meena/)).toHaveCount(0);
        expect(pageErrors).toEqual([]);
      } finally {
        await seed.close();
      }
    },
  );
});
