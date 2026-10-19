import { mkdir } from "node:fs/promises";
import { draftMessages, orderMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("QO-01-06/11/12 bilingual Quick Order draft: exact service, lossless modes, reload, lost response, offline and abandonment", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);
  const password = "synthetic-quick-order-password";
  await withOwnerWeb(async ({ origin, setupToken, code, runtime }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    expect(
      (
        await post(
          "/owner/setup",
          {
            name: "SYNTHETIC intake owner",
            email: "quick-order@example.test",
            password,
          },
          {
            "X-Setup-Token": setupToken,
            "Idempotency-Key": crypto.randomUUID(),
          },
        )
      ).status(),
    ).toBe(200);
    expect((await post("/owner/verify", { code: await code() })).status()).toBe(
      200,
    );
    expect(
      (
        await post("/auth/sign-in/email", {
          email: "quick-order@example.test",
          password,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(
          "/owner/complete",
          { shopName: "SYNTHETIC intake shop" },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const entry = await (
        await page.request.get(`${origin}/api/owner/entry`)
      ).json(),
      shopId = entry.shop.shopId;
    const seeded = await seedQuickOrder(runtime, shopId);
    let retryAfter = 0;
    page.on("response", (r) => {
      if (r.status() === 429)
        retryAfter = Math.max(
          retryAfter,
          Number(r.headers()["retry-after"] ?? 1),
        );
    });
    async function saved(locale = "en", state = "saved") {
      const label = draftMessages[locale][state];
      for (let i = 0; i < 6; i++) {
        try {
          await expect(
            page.getByRole("status").getByText(label, { exact: true }),
          ).toBeVisible({
            timeout: 2000,
          });
          retryAfter = 0;
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
        page.getByRole("status").getByText(label, { exact: true }),
      ).toBeVisible();
    }
    const server = async () => {
      const id = new URL(page.url()).searchParams.get("draft");
      expect(id).toMatch(/^[0-9a-f-]+$/);
      const r = await page.request.get(
        `${origin}/api/shops/${shopId}/drafts/${id}`,
      );
      expect(r.status()).toBe(200);
      return r.json();
    };
    try {
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
      ).toHaveValue(seeded.wearer.wearerId);
      await page
        .getByRole("button", {
          name: orderMessages.en.sourceSearch,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: seeded.sources.before.definition.content.labelEn,
          exact: true,
        })
        .click();
      await page
        .getByLabel(orderMessages.en.deliveryDate, { exact: true })
        .fill("2026-11-20");
      await page
        .getByLabel(orderMessages.en.priceState, { exact: true })
        .selectOption("quoted");
      await page
        .getByLabel(orderMessages.en.priceText, { exact: true })
        .fill("0");
      await page
        .getByRole("button", { name: orderMessages.en.save, exact: true })
        .click();
      await saved();
      console.info(
        `QO-01 automated intake elapsed ${Date.now() - start}ms; emulation only, not physical-owner target acceptance`,
      );
      const first = await server();
      expect(first.payload.priceText).toBe("0");
      expect(first.payload.manifest.definitionId).toBe(
        seeded.sources.before.definition.id,
      );
      await expect(
        page.getByText(orderMessages.en.current, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: draftMessages.en.promote,
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByLabel(orderMessages.en.presentation, { exact: true })
        .selectOption("detailed");
      await page
        .getByLabel(orderMessages.en.instructions, { exact: true })
        .fill("SYNTHETIC நீல நிறம்; அளவு பின்னர்");
      await saved();
      const detailed = await server();
      await page
        .getByLabel(orderMessages.en.presentation, { exact: true })
        .selectOption("simple");
      await saved();
      expect((await server()).payload).toEqual({
        ...detailed.payload,
        presentation: "simple",
      });
      await page
        .getByRole("button", { name: orderMessages.en.close, exact: true })
        .click();
      await page
        .getByRole("button", { name: new RegExp(orderMessages.en.savedAt) })
        .click();
      await expect(
        page.getByLabel(orderMessages.en.deliveryDate, { exact: true }),
      ).toHaveValue("2026-11-20");
      const draftUrl = page.url();
      await page.reload();
      await prepareOwnerScreen(page, "en");
      await expect(
        page.getByLabel(orderMessages.en.wearerId, { exact: true }),
      ).toHaveValue(seeded.wearer.wearerId);
      const another = await page
        .context()
        .browser()
        .newContext({ storageState: await page.context().storageState() });
      const second = await another.newPage();
      await second.goto(draftUrl);
      await expect(
        second.getByLabel(orderMessages.en.deliveryDate, { exact: true }),
      ).toHaveValue("2026-11-20");
      await another.close();
      let drop = true;
      let droppedVersion;
      const frozen = [];
      await page.route(`**/api/shops/${shopId}/drafts/*`, async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        if (drop) {
          const response = await route.fetch();
          if (response.status() !== 200) return route.fulfill({ response });
          droppedVersion = (await response.json()).draft.version;
          drop = false;
          frozen.push({
            headers: route.request().headers(),
            body: route.request().postData(),
          });
          return route.abort("failed");
        }
        frozen.push({
          headers: route.request().headers(),
          body: route.request().postData(),
        });
        return route.continue();
      });
      await page
        .getByLabel(orderMessages.en.presentation, { exact: true })
        .selectOption("detailed");
      await expect(
        page.getByText(draftMessages.en.checking, { exact: true }),
      ).toBeVisible();
      await saved();
      expect((await server()).version).toBe(droppedVersion);
      expect(frozen[0].body).toBe(frozen[1].body);
      expect(frozen[0].headers["idempotency-key"]).toBe(
        frozen[1].headers["idempotency-key"],
      );
      await page.unroute(`**/api/shops/${shopId}/drafts/*`);
      await page.context().setOffline(true);
      await page
        .getByLabel(orderMessages.en.instructions, { exact: true })
        .fill("SYNTHETIC offline retained");
      await expect(
        page.getByText(draftMessages.en.checking, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel(orderMessages.en.instructions, { exact: true }),
      ).toHaveValue("SYNTHETIC offline retained");
      await page.context().setOffline(false);
      await saved();
      // IME must suppress autosave; a known validation rejection retains input.
      let rejected = 0;
      await page.route(`**/api/shops/${shopId}/drafts/*`, async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        rejected++;
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "VALIDATION_FAILED",
              message: "Synthetic field rejection",
            },
          }),
        });
      });
      const instructions = page.getByLabel(orderMessages.en.instructions, {
        exact: true,
      });
      await instructions.dispatchEvent("compositionstart");
      await instructions.fill("SYNTHETIC தமிழ் composition retained");
      await page.waitForTimeout(1200);
      expect(rejected).toBe(0);
      await instructions.dispatchEvent("compositionend");
      await expect(
        page.getByText(draftMessages.en.saveFailed, { exact: true }),
      ).toBeVisible();
      expect(rejected).toBe(1);
      await expect(instructions).toHaveValue(
        "SYNTHETIC தமிழ் composition retained",
      );
      await page.unroute(`**/api/shops/${shopId}/drafts/*`);
      await page
        .getByRole("button", { name: draftMessages.en.retry, exact: true })
        .click();
      await saved();
      // Another authenticated edit commits a real version before this page saves.
      const current = await server();
      const latest = {
        ...current.payload,
        instructions: "SYNTHETIC newer saved edit",
      };
      const updateKey = crypto.randomUUID();
      for (let n = 0; n < 3; n++) {
        const r = await page.request.put(
          `${origin}/api/shops/${shopId}/drafts/${current.id}`,
          {
            headers: {
              Origin: origin,
              "Idempotency-Key": updateKey,
              "If-Match": `"v${current.version}"`,
            },
            data: {
              workflow: "order.quick",
              schemaVersion: 1,
              payload: latest,
            },
          },
        );
        if (r.status() === 429) {
          await page.waitForTimeout(
            (Number(r.headers()["retry-after"] ?? 60) + 1) * 1000,
          );
          continue;
        }
        expect(r.status()).toBe(200);
        break;
      }
      await instructions.fill("SYNTHETIC stale local edit");
      await saved("en", "conflict");
      await expect(
        page.getByText(orderMessages.en.compare, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          `${orderMessages.en.server}: SYNTHETIC newer saved edit`,
          { exact: true },
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: draftMessages.en.server, exact: true })
        .click();
      await saved();
      await expect(instructions).toHaveValue(latest.instructions);
      await mkdir(".scratch/quick-order-captures", { recursive: true });
      const canonical = (await server()).payload;
      for (const locale of ["en", "ta"]) {
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          const t = orderMessages[locale];
          await expect(
            page.getByLabel(t.instructions, { exact: true }),
          ).toHaveValue(latest.instructions);
          expect((await server()).payload).toEqual(canonical);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (page.viewportSize().width >= 768) {
            const nav = await page
              .locator(".workspace-navigation")
              .boundingBox();
            const content = await page
              .locator(".workspace-content")
              .boundingBox();
            expect(content.x).toBeGreaterThanOrEqual(nav.x + nav.width);
            expect(content.width).toBeGreaterThan(
              page.viewportSize().width / 2,
            );
          }
          await page.screenshot({
            path: `.scratch/quick-order-captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
            fullPage: true,
          });
        }
      }
      const viewport = page.viewportSize();
      await page.setViewportSize({ width: 1180, height: 820 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.zoom = "";
      });
      await page.setViewportSize(viewport);
      await prepareOwnerScreen(page, "en");
      await page
        .getByLabel(orderMessages.en.presentation, { exact: true })
        .selectOption("simple");
      await saved();
      for (let attempt = 0; attempt < 3; attempt++) {
        page.once("dialog", (d) => d.accept());
        await page
          .getByRole("button", { name: orderMessages.en.abandon, exact: true })
          .click();
        try {
          await expect(
            page.getByRole("heading", {
              name: orderMessages.en.resume,
              exact: true,
            }),
          ).toBeVisible({ timeout: 2000 });
          break;
        } catch (error) {
          if (!retryAfter) throw error;
          // A known admission rejection leaves the saved draft intact. Wait for
          // the existing server bucket rather than weakening runtime limits.
          await page.waitForTimeout((retryAfter + 1) * 1000);
          retryAfter = 0;
        }
      }
      await expect(
        page.getByRole("heading", {
          name: orderMessages.en.resume,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: new RegExp(orderMessages.en.savedAt),
        }),
      ).toHaveCount(0);
      await expectStaticPwaStorage(page);
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Sign in to Aarili", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          Object.keys(localStorage).filter((k) => k !== "aarili-appearance"),
        ),
      ).toEqual([]);
    } finally {
      await seeded.close();
    }
  });
});
