import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import {
  draftMessages,
  orderAcceptanceMessages,
  orderMessages,
  repeatServiceMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  seedSmallServices,
  serviceDraftId,
} from "../../scripts/test-support/small-services.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("RH-01/02/03/06/07/10/11 selected service repeat, fresh price, bilingual recovery and source preservation", async ({
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
      const password = "synthetic-small-service-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC service owner",
              email: "services@example.test",
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
            email: "services@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC service shop" },
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
        expect(r.status, `${method} ${path}: ${await r.clone().text()}`).toBe(
          200,
        );
        return r.json();
      }
      const services = await seedSmallServices({ setup, runtime, shopId });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let retryAfter = 0;
      page.on("response", (r) => {
        if (r.status() === 429)
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
      });
      async function saved() {
        for (let i = 0; i < 6; i++) {
          try {
            await expect(
              page
                .getByRole("status")
                .getByText(draftMessages.en.saved, { exact: true }),
            ).toBeVisible({ timeout: 1500 });
            return;
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
        await expect(
          page
            .getByRole("status")
            .getByText(draftMessages.en.saved, { exact: true }),
        ).toBeVisible();
      }
      try {
        const intake = services.saree.intake,
          r = await setup("small-services/orders/review", { body: intake }),
          draftId = serviceDraftId();
        await setup(`drafts/${draftId}`, {
          method: "PUT",
          body: {
            workflow: "order.service",
            schemaVersion: 1,
            payload: {
              ...intake,
              commitmentReview: {
                fingerprint: r.fingerprint,
                acknowledged: true,
                exceptionReason: "SYNTHETIC",
                waiveRush: false,
                waiverReason: "",
              },
            },
          },
        });
        const accepted = await setup(`drafts/${draftId}/promote`, {
            body: {},
            etag: '"v1"',
          }),
          id = accepted.draft.result.id;
        const original = await setup(`small-services/orders/${id}`, {
            method: "GET",
          }),
          source = await setup(`service-repeats/${id}/source`),
          candidate = source.candidates[0],
          key = original.lines.find((l) => l.id === candidate.lineId).key;
        await page.goto(`${origin}/orders?services=1&serviceOrder=${id}`);
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: repeatServiceMessages.en.inspect,
            exact: true,
          })
          .click();
        const panel = page.getByRole("region", {
          name: repeatServiceMessages.en.title,
          exact: true,
        });
        await panel
          .getByLabel(repeatServiceMessages.en.profile, { exact: true })
          .selectOption(services.saree.profile.id);
        await panel.getByRole("checkbox").first().focus();
        await page.keyboard.press("Space");
        await panel
          .getByLabel(repeatServiceMessages.en.mapping, { exact: true })
          .selectOption(key);
        let dropped = false,
          created;
        const creationKeys = [];
        await page.route("**/service-repeats/*/create", async (route) => {
          creationKeys.push(route.request().headers()["idempotency-key"]);
          if (dropped && creationKeys.length === 2)
            return route.fulfill({
              status: 429,
              contentType: "application/json",
              headers: { "Retry-After": "0" },
              body: JSON.stringify({
                error: {
                  code: "RATE_LIMITED",
                  message: "SYNTHETIC retry admission",
                },
              }),
            });
          if (dropped) return route.continue();
          let response;
          try {
            response = await route.fetch();
          } catch {
            await route.abort("failed");
            return;
          }
          if (response.status() === 200) {
            created = await response.json();
            dropped = true;
            await route.abort("failed");
          } else await route.fulfill({ response });
        });
        await panel
          .getByRole("button", {
            name: repeatServiceMessages.en.create,
            exact: true,
          })
          .click();
        await expect.poll(() => dropped, { timeout: 30000 }).toBe(true);
        await panel
          .getByRole("button", {
            name: repeatServiceMessages.en.retry,
            exact: true,
          })
          .click();
        await expect.poll(() => creationKeys.length).toBe(2);
        await expect(panel.getByRole("alert")).toBeVisible();
        await panel
          .getByRole("button", {
            name: repeatServiceMessages.en.retry,
            exact: true,
          })
          .click();
        await expect(
          page.getByLabel(orderMessages.en.deliveryDate, { exact: true }),
        ).toHaveValue("");
        expect(new Set(creationKeys).size).toBe(1);
        await expect(
          page.getByLabel(orderMessages.en.priceState, { exact: true }),
        ).toHaveCount(1);
        await expect(
          page.getByLabel(orderMessages.en.priceState, { exact: true }),
        ).toHaveValue("to-be-quoted");
        const url = page.url();
        await page
          .getByLabel(orderMessages.en.deliveryDate, { exact: true })
          .fill(intake.deliveryDate);
        await page
          .getByLabel(orderMessages.en.priceState, { exact: true })
          .selectOption("quoted");
        await page
          .getByLabel(orderMessages.en.priceText, { exact: true })
          .fill("0");
        page.once("dialog", (dialog) => dialog.dismiss());
        await page
          .getByRole("link", { name: "Customers", exact: true })
          .click();
        expect(page.url()).toBe(url);
        await page
          .getByRole("button", {
            name: orderMessages.en.save,
            exact: true,
          })
          .click();
        await saved();
        await page.reload();
        await expect(
          page.getByLabel(orderMessages.en.priceText, { exact: true }),
        ).toHaveValue("0");
        for (const locale of ["en", "ta"]) {
          await prepareOwnerScreen(page, locale);
          await expect(
            page.getByText(repeatServiceMessages[locale].reset, {
              exact: true,
            }),
          ).toBeVisible();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
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
          await mkdir(`.scratch/repeat-services/ui/${info.project.name}`, {
            recursive: true,
          });
          await page.screenshot({
            path: `.scratch/repeat-services/ui/${info.project.name}/${locale}.png`,
            fullPage: true,
          });
        }
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.preview,
            exact: true,
          })
          .click();
        await page
          .getByLabel(orderAcceptanceMessages.en.acknowledged, { exact: true })
          .check();
        const reason = page.getByLabel(orderAcceptanceMessages.en.reason, {
          exact: true,
        });
        if (await reason.isVisible())
          await reason.fill("SYNTHETIC fresh repeat capacity review");
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", { name: /QO-000002/ }),
        ).toBeVisible({ timeout: 30000 });
        const targetDraft = await setup(`drafts/${created.draft.id}`, {
          method: "GET",
        });
        const target = await setup(
          `small-services/orders/${targetDraft.result.id}`,
          { method: "GET" },
        );
        expect(target.lines).toHaveLength(1);
        expect(target.totalPaise).toBe(0);
        expect(target.lines[0].state).toBe("pending");
        expect(
          await setup(`small-services/orders/${id}`, { method: "GET" }),
        ).toEqual(original);
        expect(
          (await setup(`service-repeats/${id}/links`, { body: {} })).children,
        ).toHaveLength(1);
        await expectStaticPwaStorage(page);
        expect(errors).toEqual([]);
      } finally {
        await services.close();
      }
    },
  );
});
