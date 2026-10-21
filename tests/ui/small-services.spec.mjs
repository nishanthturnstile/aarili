import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import {
  draftMessages,
  orderAcceptanceMessages,
  orderMessages,
  serviceLineMessages,
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

test("SS-01/02/03/05/06/07/09/10/12 service drafts, independent prices, exact booking and bilingual accessible recovery", async ({
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
      let retryAfter = 0;
      page.on("response", (r) => {
        if (r.status() === 429)
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
      });
      async function saved(locale = "en") {
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
      async function put(intake) {
        const id = serviceDraftId();
        await setup(`drafts/${id}`, {
          method: "PUT",
          body: {
            workflow: "order.service",
            schemaVersion: 1,
            payload: intake,
          },
        });
        return id;
      }
      try {
        const m = services.seed.sources.before;
        const customIntake = {
          ...emptyQuickOrder(),
          customerId: services.seed.customer.customerId,
          wearerId: services.seed.wearer.wearerId,
          manifest: {
            entryId: m.entryId,
            revisionId: m.id,
            definitionId: m.definition.id,
          },
          deliveryDate: services.saree.intake.deliveryDate,
        };
        const cr = await setup("orders/review", { body: customIntake });
        customIntake.commitmentReview = {
          fingerprint: cr.fingerprint,
          acknowledged: true,
          exceptionReason: "",
          waiveRush: false,
          waiverReason: "",
        };
        const customId = await services.config.publish(
          "order.quick",
          customIntake,
        );
        const sourceCustom = await setup(`orders/${customId}/read`);
        const sourcePieces = await setup(`orders/${customId}/pieces/read`);
        const id = await put(services.saree.intake);
        await page.goto(`${origin}/orders?services=1&draft=${id}`);
        await prepareOwnerScreen(page, "en");
        await expect(
          page.getByRole("heading", {
            name: smallServiceMessages.en.new,
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByLabel(orderMessages.en.wearerId, { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText(smallServiceMessages.en.receipt, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByLabel(smallServiceMessages.en.requestedWork, {
            exact: true,
          }),
        ).toHaveCount(2);
        const requestedWork = page
          .getByLabel(smallServiceMessages.en.requestedWork, { exact: true })
          .first();
        const workText =
          "SYNTHETIC finish the existing saree edge, keeping the original border visible and following the customer's requested length.\nசெயற்கை கோரிக்கை — ஓரத்தை மடித்துத் தைக்கவும்.";
        await expect(requestedWork).toHaveJSProperty("tagName", "TEXTAREA");
        await requestedWork.focus();
        await requestedWork.dispatchEvent("compositionstart");
        await requestedWork.fill(workText);
        await requestedWork.dispatchEvent("compositionend");
        await page
          .getByLabel(orderMessages.en.priceState, { exact: true })
          .nth(0)
          .selectOption("quoted");
        await page
          .getByLabel(orderMessages.en.priceText, { exact: true })
          .fill("0");
        const description = page.getByLabel(
          smallServiceMessages.en.subjectDescription,
          { exact: true },
        );
        await description.focus();
        await description.dispatchEvent("compositionstart");
        await description.fill("செயற்கை நீலப் புடவை — SS-12 IME");
        await description.dispatchEvent("compositionend");
        await saved();
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await expect(description).toHaveValue("செயற்கை நீலப் புடவை — SS-12 IME");
        await expect(requestedWork).toHaveValue(workText);
        await page
          .getByText(smallServiceMessages.en.details, { exact: true })
          .click();
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.load,
            exact: true,
          })
          .click();
        await page
          .getByLabel(smallServiceMessages.en.sourceOrderId, { exact: true })
          .selectOption(customId);
        await expect(
          page
            .locator("details")
            .getByText(sourceCustom.wearer.label, { exact: false }),
        ).toBeVisible();
        await page
          .getByLabel(smallServiceMessages.en.sourcePieceId, { exact: true })
          .selectOption(sourcePieces.identities[0].id);
        await saved();
        const linked = await setup(`drafts/${id}`, { method: "GET" });
        expect(linked.payload.wearerId).toBe(sourceCustom.intake.wearerId);
        const prePleatingLabel =
          services.saree.addons[2].definition.content.labelEn;
        await page
          .getByRole("button", {
            name: `${smallServiceMessages.en.addLine}: ${prePleatingLabel}`,
            exact: true,
          })
          .click();
        const prePleating = page.getByRole("group", {
          name: prePleatingLabel,
          exact: true,
        });
        await prePleating
          .getByLabel(smallServiceMessages.en.notRequired, { exact: true })
          .check();
        await prePleating
          .getByLabel(smallServiceMessages.en.notRequiredReason, {
            exact: true,
          })
          .fill("SYNTHETIC pre-pleating not requested for this garment");
        await saved();
        const withAdded = await setup(`drafts/${id}`, { method: "GET" });
        expect(withAdded.payload.lines.slice(0, 2)).toEqual(
          linked.payload.lines,
        );
        expect(withAdded.payload.lines).toHaveLength(3);
        expect(withAdded.payload.lines[2].id).not.toBe(
          withAdded.payload.lines[0].id,
        );
        await page
          .getByText(smallServiceMessages.en.details, { exact: true })
          .click();
        await mkdir(".impeccable/review", { recursive: true });
        for (const locale of ["en", "ta"]) {
          for (const dark of [false, true]) {
            await prepareOwnerScreen(page, locale, dark);
            for (const [width, height] of [
              [360, 800],
              [820, 1180],
              [1440, 900],
              [1180, 820],
            ]) {
              await page.setViewportSize({ width, height });
              await expect(page.locator("body")).toHaveJSProperty(
                "scrollWidth",
                await page.locator("body").evaluate((e) => e.clientWidth),
              );
              const axe = await new AxeBuilder({ page }).analyze();
              expect(axe.violations).toEqual([]);
              await page.evaluate(async () => {
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                await document.fonts.ready;
              });
              await page.screenshot({
                path: `.impeccable/review/small-service-${locale}-${dark ? "dark" : "light"}-${width}.png`,
                fullPage: true,
              });
            }
          }
          await page.setViewportSize({ width: 360, height: 800 });
          const enlarged = await page.addStyleTag({
            content: "html { font-size: 200% !important; }",
          });
          await expect(page.locator("body")).toHaveJSProperty(
            "scrollWidth",
            await page.locator("body").evaluate((e) => e.clientWidth),
          );
          await expect(
            page.getByLabel(smallServiceMessages[locale].subjectDescription, {
              exact: true,
            }),
          ).toBeVisible();
          await enlarged.evaluate((e) => e.remove());
          await page
            .getByLabel(smallServiceMessages[locale].subjectDescription, {
              exact: true,
            })
            .focus();
          await page.keyboard.press("Tab");
          await expect(
            page.getByLabel(smallServiceMessages[locale].propertyReference, {
              exact: true,
            }),
          ).toBeFocused();
        }
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.preview,
            exact: true,
          })
          .click();
        await expect(
          page.getByText(smallServiceMessages.en.unknownTotal).first(),
        ).toBeVisible();
        await page
          .getByLabel(orderAcceptanceMessages.en.acknowledged, { exact: true })
          .check();
        let dropped = false;
        const promotionKeys = [];
        await page.route("**/drafts/*/promote", async (route) => {
          promotionKeys.push(route.request().headers()["idempotency-key"]);
          if (dropped) return route.continue();
          const r = await route.fetch();
          if (r.ok()) {
            dropped = true;
            return route.abort("failed");
          }
          return route.fulfill({ response: r });
        });
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", {
            name: draftMessages.en.retry,
            exact: true,
          }),
        ).toBeVisible();
        for (
          let attempt = 0;
          attempt < 8 && !new URL(page.url()).searchParams.has("serviceOrder");
          attempt++
        ) {
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          const retry = page.getByRole("button", {
            name: draftMessages.en.retry,
            exact: true,
          });
          if (await retry.isVisible()) await retry.click();
          try {
            await expect(page).toHaveURL(/serviceOrder=/, { timeout: 1500 });
            break;
          } catch {}
        }
        await expect(page).toHaveURL(/serviceOrder=/);
        expect(new Set(promotionKeys).size).toBe(1);
        expect(dropped).toBe(true);
        await page.unroute("**/drafts/*/promote");
        await expect(page.getByRole("heading", { name: /QO-/ })).toBeVisible();
        await expect(
          page.getByText(smallServiceMessages.en.pending, { exact: false }),
        ).toHaveCount(2);
        await expect(
          page.getByText(smallServiceMessages.en.unknownTotal, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: /handover|payment/i }),
        ).toHaveCount(0);
        await expect(
          page
            .getByRole("region", {
              name: serviceLineMessages.en.title,
              exact: true,
            })
            .getByRole("button", { name: /^Record completion/ }),
        ).toHaveCount(2);
        await page
          .getByText(smallServiceMessages.en.source, { exact: true })
          .click();
        const excluded = page
          .getByRole("region", {
            name: smallServiceMessages.en.lines,
            exact: true,
          })
          .getByRole("listitem")
          .filter({ has: page.getByText(prePleatingLabel, { exact: true }) });
        await expect(
          excluded.getByText(smallServiceMessages.en.notRequired, {
            exact: true,
          }),
        ).toBeVisible();
        await expect(excluded).toContainText(
          "SYNTHETIC pre-pleating not requested for this garment",
        );
        await expect(excluded).not.toContainText(
          orderAcceptanceMessages.en.toQuote,
        );
        await expect(excluded).not.toContainText("₹0.00");
        for (const locale of ["en", "ta"]) {
          for (const dark of [false, true]) {
            await prepareOwnerScreen(page, locale, dark);
            for (const [width, height] of [
              [360, 800],
              [1440, 900],
            ]) {
              await page.setViewportSize({ width, height });
              expect(
                await page
                  .locator("body")
                  .evaluate((e) => e.scrollWidth <= e.clientWidth),
              ).toBe(true);
              expect(
                (await new AxeBuilder({ page }).analyze()).violations,
              ).toEqual([]);
              await page.evaluate(async () => {
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                await document.fonts.ready;
              });
              await page.screenshot({
                path: `.impeccable/review/small-service-accepted-${locale}-${dark ? "dark" : "light"}-${width}.png`,
                fullPage: true,
              });
            }
          }
        }
        await prepareOwnerScreen(page, "en");
        const orderUrl = page.url();
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await expect(page).toHaveURL(orderUrl);
        await expect(
          page.getByText(smallServiceMessages.en.receipt, { exact: true }),
        ).toBeVisible();
        const unknown = await put(services.unknown.intake);
        await page.goto(`${origin}/orders?services=1&draft=${unknown}`);
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.preview,
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          }),
        ).toBeDisabled();
        const kurti = await put(services.kurti.intake);
        await page.goto(`${origin}/orders?services=1&draft=${kurti}`);
        await prepareOwnerScreen(page, "en");
        await expect(
          page.getByLabel(orderMessages.en.wearerId, { exact: true }),
        ).toHaveValue(services.kurti.intake.wearerId);
        await expect(
          page.getByText(smallServiceMessages.en.permission, { exact: true }),
        ).toBeVisible();
        await page
          .getByLabel(smallServiceMessages.en.subjectDescription, {
            exact: true,
          })
          .fill("SYNTHETIC unsaved draft navigation");
        page.once("dialog", (d) => d.dismiss());
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.close,
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: smallServiceMessages.en.new,
            exact: true,
          }),
        ).toBeVisible();
        await saved();
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.preview,
            exact: true,
          })
          .click();
        await page
          .getByLabel(orderAcceptanceMessages.en.acknowledged, { exact: true })
          .check();
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/serviceOrder=/);
        await expect(page.getByRole("heading", { name: /QO-/ })).toBeVisible();
        const kurtiOrderId = new URL(page.url()).searchParams.get(
          "serviceOrder",
        );
        const kurtiAccepted = await (
          await page.request.get(
            `${origin}/api/shops/${shopId}/small-services/orders/${kurtiOrderId}`,
          )
        ).json();
        expect(kurtiAccepted.wearer.id).toBe(services.kurti.intake.wearerId);
        await expect(
          page.getByText(kurtiAccepted.wearer.label, { exact: false }),
        ).toBeVisible();
        const stale = await put({
          ...services.saree.intake,
          subjectId: randomUUID(),
          lines: services.saree.intake.lines.map((l) => ({
            ...l,
            id: randomUUID(),
          })),
        });
        await page.goto(`${origin}/orders?services=1&draft=${stale}`);
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
        await services.publishProfile({
          entryId: services.saree.profile.entryId,
          baseVersion: services.saree.profile.version,
          baseRevisionId: services.saree.profile.id,
          content: services.saree.profile.content,
          available: true,
          reason: "SYNTHETIC concurrent reviewed profile revision",
        });
        const warningReason = page.getByLabel(
          orderAcceptanceMessages.en.reason,
          { exact: true },
        );
        if (await warningReason.isVisible())
          await warningReason.fill(
            "SYNTHETIC owner reviewed capacity warning for this isolated conflict test",
          );
        await page
          .getByRole("button", {
            name: orderAcceptanceMessages.en.confirm,
            exact: true,
          })
          .click();
        await expect(
          page.getByText(orderAcceptanceMessages.en.changed, { exact: true }),
        ).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`draft=${stale}`));
        await expect(
          page.getByLabel(smallServiceMessages.en.subjectDescription, {
            exact: true,
          }),
        ).toHaveValue(services.saree.intake.subjectDescription);
        await page.goto(`${origin}/settings?section=serviceProfiles`);
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.newProfile,
            exact: true,
          })
          .click();
        await page
          .getByLabel(smallServiceMessages.en.labelEn, { exact: true })
          .fill("SYNTHETIC UI intake profile");
        await page
          .getByLabel(smallServiceMessages.en.labelTa, { exact: true })
          .fill("செயற்கை சேவை விதி");
        await page
          .getByLabel(smallServiceMessages.en.manifest, { exact: true })
          .selectOption(services.saree.manifest.id);
        await page
          .getByLabel(smallServiceMessages.en.wearerRequirement, {
            exact: true,
          })
          .selectOption("not-required");
        await page
          .getByLabel(smallServiceMessages.en.wearerReason, { exact: true })
          .fill("SYNTHETIC no fit or body information for saree finishing");
        await page
          .getByLabel(smallServiceMessages.en.capacityUnit, { exact: true })
          .selectOption("garments");
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.addLine,
            exact: true,
          })
          .click();
        await page
          .getByLabel(smallServiceMessages.en.addon, { exact: true })
          .selectOption("fall");
        await page
          .getByLabel(smallServiceMessages.en.coverageKey, { exact: true })
          .fill("synthetic-garment-once");
        await page
          .getByLabel(smallServiceMessages.en.quantity, { exact: true })
          .fill("1");
        await page
          .getByLabel(smallServiceMessages.en.reason, { exact: true })
          .fill("SYNTHETIC reviewed intake and capacity; no production policy");
        await saved();
        await page.reload();
        await prepareOwnerScreen(page, "en");
        await expect(
          page.getByLabel(smallServiceMessages.en.labelEn, { exact: true }),
        ).toHaveValue("SYNTHETIC UI intake profile");
        for (const locale of ["en", "ta"]) {
          for (const dark of [false, true]) {
            await prepareOwnerScreen(page, locale, dark);
            const fallLabel =
              services.saree.addons[0].definition.content[
                locale === "ta" ? "labelTa" : "labelEn"
              ];
            await expect(page.locator("fieldset legend")).toHaveText([
              fallLabel,
            ]);
            await expect(
              page.locator('#sp-addon-0 option[value="fall"]'),
            ).toHaveText(fallLabel);
            await expect(page.locator("#sp-key-0")).not.toBeVisible();
            for (const [width, height] of [
              [360, 800],
              [820, 1180],
              [1440, 900],
              [1180, 820],
            ]) {
              await page.setViewportSize({ width, height });
              expect(
                await page
                  .locator("body")
                  .evaluate((e) => e.scrollWidth <= e.clientWidth),
              ).toBe(true);
              expect(
                (await new AxeBuilder({ page }).analyze()).violations,
              ).toEqual([]);
              await page.evaluate(async () => {
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                await document.fonts.ready;
              });
              await page.screenshot({
                path: `.impeccable/review/small-service-profile-${locale}-${dark ? "dark" : "light"}-${width}.png`,
                fullPage: true,
              });
            }
          }
        }
        await prepareOwnerScreen(page, "en");
        const savedProfileUrl = page.url();
        await page.route("**/drafts/*", (route) =>
          route.request().method() === "PUT"
            ? route.abort("failed")
            : route.continue(),
        );
        await page
          .getByLabel(smallServiceMessages.en.labelTa, { exact: true })
          .fill("SYNTHETIC unacknowledged local typing");
        expect((await post("/auth/sign-out", {})).status()).toBe(200);
        await page
          .locator("#sp-manifest")
          .locator("..")
          .getByRole("button", {
            name: smallServiceMessages.en.reload,
            exact: true,
          })
          .click();
        await expect(
          page.getByLabel(smallServiceMessages.en.labelEn, { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator("main")).not.toContainText(
          "SYNTHETIC unacknowledged local typing",
        );
        await page.unroute("**/drafts/*");
        expect(
          (
            await post("/auth/sign-in/email", {
              email: "services@example.test",
              password,
            })
          ).status(),
        ).toBe(200);
        await page.goto(savedProfileUrl);
        await prepareOwnerScreen(page, "en");
        await expect(
          page.getByLabel(smallServiceMessages.en.labelEn, { exact: true }),
        ).toHaveValue("SYNTHETIC UI intake profile");
        await expect(
          page.getByLabel(smallServiceMessages.en.labelTa, { exact: true }),
        ).toHaveValue("செயற்கை சேவை விதி");
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.reviewProfile,
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.publish,
            exact: true,
          })
          .click();
        await expect(
          page.getByText("SYNTHETIC UI intake profile", { exact: true }),
        ).toBeVisible();
        const row = page.locator("li").filter({
          has: page.getByText("SYNTHETIC UI intake profile", { exact: true }),
        });
        await row
          .getByRole("button", {
            name: smallServiceMessages.en.history,
            exact: true,
          })
          .click();
        await expect(
          row.getByText(/SYNTHETIC reviewed intake and capacity/),
        ).toBeVisible();
        await row
          .getByRole("button", {
            name: smallServiceMessages.en.edit,
            exact: true,
          })
          .click();
        await page
          .getByLabel(smallServiceMessages.en.available, { exact: true })
          .uncheck();
        await page
          .getByLabel(smallServiceMessages.en.reason, { exact: true })
          .fill("SYNTHETIC retire this profile; preserve history");
        await saved();
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.reviewProfile,
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: smallServiceMessages.en.publish,
            exact: true,
          })
          .click();
        await expect(
          page.getByText("SYNTHETIC UI intake profile", { exact: true }),
        ).toBeVisible();
        await expectStaticPwaStorage(page);
        await info.attach("SS screenshots", {
          body: JSON.stringify({
            widths: [360, 820, 1440],
            locales: ["en", "ta"],
            prefix: ".impeccable/review/small-service",
          }),
          contentType: "application/json",
        });
      } finally {
        await services.close();
      }
    },
  );
});
