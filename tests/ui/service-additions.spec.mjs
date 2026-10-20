import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { emptyGroupIntake } from "@aarili/contracts/orders";
import {
  bookingMessages,
  draftMessages,
  groupIntakeMessages,
  serviceAdditionMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceAdditions } from "../../scripts/test-support/service-additions.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("SS-B accepted service drafts, exact supplemental history, conversion and bilingual accessible recovery", async ({
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
      const services = await seedServiceAdditions({ setup, runtime, shopId });
      const captures = [];
      let retryAfter = 0;
      page.on("response", (r) => {
        if (r.status() === 429)
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
      });
      async function saved(locale) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await expect(
              page
                .getByRole("status")
                .getByText(draftMessages[locale].saved, { exact: true }),
            ).toBeVisible({ timeout: 8000 });
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
      async function admittedClick(button, ready) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (retryAfter) {
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
          }
          await button.click();
          try {
            await ready();
            return;
          } catch (error) {
            if (!retryAfter || attempt === 2) throw error;
          }
        }
      }
      async function capture(name, locale, dark) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        const path = `.impeccable/review/service-additions-${info.project.name}-${locale}-${dark ? "dark" : "light"}-${name}.png`;
        await mkdir(".impeccable/review", { recursive: true });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({ path, fullPage: true, animations: "disabled" });
        captures.push({
          path,
          state: name,
          locale,
          theme: dark ? "dark" : "light",
          viewport: page.viewportSize(),
          url: new URL(page.url()).pathname,
        });
      }
      async function captureBothThemes(name, locale) {
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          await capture(name, locale, dark);
        }
        await prepareOwnerScreen(page, locale, locale === "ta");
      }
      try {
        for (const locale of ["en", "ta"]) {
          const dark = locale === "ta";
          const t = serviceAdditionMessages[locale],
            d = draftMessages[locale];
          const qr = await setup("orders/review", { body: services.base });
          const orderId = await services.config.publish("order.quick", {
            ...services.base,
            commitmentReview: {
              fingerprint: qr.fingerprint,
              acknowledged: true,
              exceptionReason: "SYNTHETIC review",
              waiveRush: false,
              waiverReason: "",
            },
          });
          const original = await setup(`orders/${orderId}/read`, {
              body: {},
            }),
            scope = await setup(`small-services/scope/${orderId}`, {
              method: "GET",
            });
          const id = randomUUID().replace(/^(........-....-)./, "$17");
          const value = {
            ...services.change,
            orderId,
            version: scope.version,
            originalDigest: scope.originalDigest,
            scopeDigest: scope.scopeDigest,
            lines: services.change.lines.map((l) => ({
              ...l,
              id: randomUUID(),
            })),
            review: null,
          };
          await setup(`drafts/${id}`, {
            method: "PUT",
            body: {
              workflow: "order.service-change",
              schemaVersion: 1,
              payload: value,
            },
          });
          await page.goto(`${origin}/orders?order=${orderId}`);
          await prepareOwnerScreen(page, locale, dark);
          const section = page.getByRole("region", {
            name: t.title,
            exact: true,
          });
          await section
            .getByRole("button", {
              name: new RegExp(smallServiceMessages[locale].resume),
            })
            .click();
          const work = section.getByLabel(t.work, { exact: true }).first();
          const text =
            "SYNTHETIC retain original border.\nசெயற்கை திருத்தக் கோரிக்கை";
          await work.focus();
          await work.dispatchEvent("compositionstart");
          await work.fill(text);
          await work.dispatchEvent("compositionend");
          await saved(locale);
          await page.reload();
          await prepareOwnerScreen(page, locale, dark);
          await section
            .getByRole("button", {
              name: new RegExp(smallServiceMessages[locale].resume),
            })
            .click();
          await expect(work).toHaveValue(text);
          if (locale === "en") {
            const stored = await setup(`drafts/${id}`, { method: "GET" });
            await setup(`drafts/${id}`, {
              method: "PUT",
              etag: `"v${stored.version}"`,
              body: {
                workflow: "order.service-change",
                schemaVersion: 1,
                payload: {
                  ...stored.payload,
                  reason: "SYNTHETIC concurrent saved reason",
                },
              },
            });
            await section
              .getByLabel(t.reason, { exact: true })
              .fill("SYNTHETIC explicit local conflict choice");
            await expect(
              page.getByText("SYNTHETIC concurrent saved reason", {
                exact: true,
              }),
            ).toBeVisible();
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            await captureBothThemes("draft-conflict", locale);
            await page
              .getByRole("button", { name: d.local, exact: true })
              .click();
            await saved(locale);
          }
          await admittedClick(
            section.getByRole("button", { name: t.review, exact: true }),
            () =>
              expect(
                section.getByRole("heading", { name: t.newScope, exact: true }),
              ).toBeVisible({ timeout: 5000 }),
          );
          await section
            .getByLabel(t.exception, { exact: true })
            .fill("SYNTHETIC expressly reviewed exception");
          await section.getByLabel(t.ack, { exact: true }).check();
          await saved(locale);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await captureBothThemes("review", locale);
          if (locale === "en") {
            await setup(`orders/${orderId}/presentation`, {
              body: {
                mode:
                  original.presentation === "simple" ? "detailed" : "simple",
              },
              etag: `"v${original.version}"`,
            });
            await section
              .getByRole("button", { name: t.confirm, exact: true })
              .click();
            await expect(
              section.getByText(t.scopeChanged, { exact: true }),
            ).toBeVisible();
            await expect(work).toHaveValue(text);
            await captureBothThemes("conflict", locale);
            await section
              .getByRole("button", { name: t.refresh, exact: true })
              .click();
            await saved(locale);
            await admittedClick(
              section.getByRole("button", { name: t.review, exact: true }),
              () =>
                expect(
                  section.getByLabel(t.ack, { exact: true }),
                ).not.toBeChecked({ timeout: 5000 }),
            );
            await section
              .getByLabel(t.exception, { exact: true })
              .fill("SYNTHETIC new review after presentation conflict");
            await section.getByLabel(t.ack, { exact: true }).check();
            await saved(locale);
          }
          if (locale === "en" && !dark) {
            let dropped = false;
            await page.route(
              "**/api/shops/*/drafts/*/promote",
              async (route) => {
                if (dropped) {
                  await route.continue();
                  return;
                }
                const response = await route.fetch();
                if (response.status() === 429) {
                  retryAfter = Math.max(
                    retryAfter,
                    Number(response.headers()["retry-after"] ?? 1),
                  );
                  await route.fulfill({ response });
                  return;
                }
                expect(response.status()).toBe(200);
                dropped = true;
                await route.abort("failed");
              },
            );
          }
          await section
            .getByRole("button", { name: t.confirm, exact: true })
            .click();
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await expect(
                section.getByRole("button", { name: t.review, exact: true }),
              ).toHaveCount(0, { timeout: 3000 });
              break;
            } catch {}
            const retry = page.getByRole("button", {
              name: d.retry,
              exact: true,
            });
            if (retryAfter) {
              await page.waitForTimeout((retryAfter + 1) * 1000);
              retryAfter = 0;
            }
            if (await retry.isVisible()) await retry.click();
            else
              await section
                .getByRole("button", { name: t.confirm, exact: true })
                .click();
          }
          if (locale === "en" && !dark)
            await page.unroute("**/api/shops/*/drafts/*/promote");
          await expect(
            section.getByRole("button", { name: t.review, exact: true }),
          ).toHaveCount(0, { timeout: 15000 });
          await section.getByText(t.history, { exact: true }).click();
          await expect(section.getByText(text, { exact: true })).toBeVisible();
          const after = await setup(`orders/${orderId}/read`, { body: {} }),
            current = await setup(`small-services/scope/${orderId}`, {
              method: "GET",
            });
          expect(after.snapshot).toEqual(original.snapshot);
          expect(after.snapshotDigest).toBe(original.snapshotDigest);
          expect(after.currentPromise).toEqual(original.currentPromise);
          expect(current.changes).toHaveLength(1);
          expect(current.additionsPaise).toBe("15000");
          expect(current.changes[0].content.lines.map((l) => l.state)).toEqual([
            "pending",
            "pending",
          ]);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await captureBothThemes("history", locale);
          if (info.project.name === "tablet") {
            await page.setViewportSize({ width: 1180, height: 820 });
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            await captureBothThemes("history-landscape", locale);
            await page.setViewportSize({ width: 820, height: 1180 });
          }
          const source = randomUUID().replace(/^(........-....-)./, "$17");
          await setup(`drafts/${source}`, {
            method: "PUT",
            body: {
              workflow: "order.quick",
              schemaVersion: 1,
              payload: { ...services.base, commitmentReview: null },
            },
          });
          await page.goto(`${origin}/orders?draft=${source}`);
          await prepareOwnerScreen(page, locale, dark);
          const convert = page.getByRole("button", {
            name: t.convert,
            exact: true,
          });
          await convert.focus();
          await admittedClick(
            { click: () => page.keyboard.press("Enter") },
            () =>
              expect(
                page.getByRole("button", { name: t.intakeReview, exact: true }),
              ).toBeVisible({ timeout: 5000 }),
          );
          await page
            .getByRole("button", { name: t.select, exact: true })
            .click();
          await page
            .getByLabel(smallServiceMessages[locale].profile, { exact: true })
            .selectOption(services.saree.profile.id);
          await expect(page.getByLabel(t.work, { exact: true })).toHaveCount(3);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await captureBothThemes("conversion", locale);
          await page
            .getByLabel(t.work, { exact: true })
            .first()
            .fill("SYNTHETIC resumed converted draft");
          await saved(locale);
          await page.reload();
          await prepareOwnerScreen(page, locale, dark);
          await expect(
            page.getByLabel(t.work, { exact: true }).first(),
          ).toHaveValue("SYNTHETIC resumed converted draft");
          const groupSource = randomUUID().replace(/^(........-....-)./, "$17");
          await setup(`drafts/${groupSource}`, {
            method: "PUT",
            body: {
              workflow: "order.group",
              schemaVersion: 1,
              payload: {
                ...emptyGroupIntake(),
                lines: [
                  { id: randomUUID(), intake: services.base },
                  { id: randomUUID(), intake: services.base },
                ],
                commercial: {
                  basis: "package-proposal",
                  packagePriceState: "quoted",
                  packagePriceText: "1800",
                },
              },
            },
          });
          await page.goto(`${origin}/orders?draft=${groupSource}`);
          await prepareOwnerScreen(page, locale, dark);
          await expect(
            page.getByRole("button", { name: t.convert, exact: true }),
          ).toBeVisible();
          for (let attempt = 0; attempt < 3; attempt++) {
            const button = page.getByRole("button", {
              name: t.convert,
              exact: true,
            });
            if (!(await button.isVisible())) break;
            if (retryAfter) {
              await page.waitForTimeout((retryAfter + 1) * 1000);
              retryAfter = 0;
            }
            await button.click();
            try {
              await expect(
                page.getByRole("button", { name: t.intakeReview, exact: true }),
              ).toBeVisible({ timeout: 5000 });
              break;
            } catch {}
          }
          await expect(
            page.getByRole("button", { name: t.intakeReview, exact: true }),
          ).toBeVisible();
          await page
            .locator("summary")
            .filter({ hasText: bookingMessages[locale].occasion })
            .click();
          await page
            .getByLabel(groupIntakeMessages[locale].reason, { exact: true })
            .fill("SYNTHETIC reason completed after group conversion");
          await page
            .getByLabel(bookingMessages[locale].notes, { exact: true })
            .fill("SYNTHETIC preserved group context edited independently");
          await expect(
            page.getByLabel(groupIntakeMessages[locale].packageAmount, {
              exact: true,
            }),
          ).toHaveValue("1800");
          await saved(locale);
          await page.reload();
          await prepareOwnerScreen(page, locale, dark);
          await page
            .locator("summary")
            .filter({ hasText: bookingMessages[locale].occasion })
            .click();
          await expect(
            page.getByLabel(groupIntakeMessages[locale].reason, {
              exact: true,
            }),
          ).toHaveValue("SYNTHETIC reason completed after group conversion");
          await expect(
            page.getByLabel(bookingMessages[locale].notes, { exact: true }),
          ).toHaveValue(
            "SYNTHETIC preserved group context edited independently",
          );
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await captureBothThemes("group-conversion", locale);
        }
        await expectStaticPwaStorage(page);
        const { writeFile } = await import("node:fs/promises");
        await writeFile(
          `.impeccable/review/service-additions-${info.project.name}-manifest.json`,
          JSON.stringify(captures, null, 2),
        );
      } finally {
        await services.close();
      }
    },
  );
});
