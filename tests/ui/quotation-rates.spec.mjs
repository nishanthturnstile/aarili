import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { quotationRateMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  draftUuid,
  seedQuotationSources,
} from "../../scripts/test-support/quotation-rate-fixtures.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 15000 });
test("A1-01/03/04/05/06 Q-01/07/13 rates and policy review: IME, unknown, uncertain save, reload, exact publication and bilingual accessibility", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      async function publish(button) {
        const response = page.waitForResponse(
          (r) =>
            r.request().method() === "POST" && r.url().endsWith("/promote"),
        );
        await button.click();
        const result = await response;
        if (result.status() === 429) {
          const seconds = Number(result.headers()["retry-after"]);
          expect(seconds).toBeGreaterThan(0);
          expect(seconds).toBeLessThanOrEqual(60);
          const key = result.request().headers()["idempotency-key"];
          await page.waitForTimeout(seconds * 1000 + 100);
          const retry = page.waitForResponse(
            (r) =>
              r.request().method() === "POST" && r.url().endsWith("/promote"),
          );
          await button.click();
          const retried = await retry;
          expect(retried.request().headers()["idempotency-key"]).toBe(key);
          expect(retried.status(), await retried.text()).toBe(200);
        } else expect(result.status(), await result.text()).toBe(200);
      }
      const email = "quotation-rates@example.test",
        password = "synthetic-quotation-review-password";
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
            { shopName: "SYNTHETIC quotation shop" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const { source } = await seedQuotationSources(runtime, shopId),
        today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      const cookie = (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      const seed = async (id, workflow, payload) => {
        const r = await seedCommand(
          new Request(`${origin}/api/shops/${shopId}/drafts/${id}`, {
            method: "PUT",
            headers: {
              Origin: origin,
              Cookie: cookie,
              "Content-Type": "application/json",
              "Idempotency-Key": randomUUID(),
            },
            body: JSON.stringify({ workflow, schemaVersion: 1, payload }),
          }),
        );
        expect(r.status, await r.clone().text()).toBe(200);
        return (await r.json()).draft;
      };
      const policyId = draftUuid();
      await seed(policyId, "shop.policies", {
        baseVersion: 0,
        baseRevisionId: null,
        policy: {
          kind: "quoteValidity",
          state: "reviewed",
          terms: {
            en: "SYNTHETIC seven day quote terms",
            ta: "செயற்கை ஏழு நாள் விலைப்புள்ளி விதிகள்",
          },
          reason: "Synthetic review",
          authority: {
            kind: "owner-proposal",
            label: "SYNTHETIC owner proposal",
          },
          calendarDays: 7,
        },
      });
      await page.goto(`${origin}/settings?section=rates`);
      const t = quotationRateMessages.en;
      await expect(
        page.getByRole("heading", { name: t.title, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: t.newRate, exact: true }).click();
      const editor = page.getByRole("region", { name: t.newRate, exact: true }),
        state = editor.getByRole("status");
      let lost = false;
      const envelopes = [];
      await page.route("**/api/shops/*/drafts/*", async (route) => {
        const request = route.request();
        if (
          request.method() !== "PUT" ||
          !request.postDataJSON()?.workflow?.startsWith("pricing.")
        )
          return route.continue();
        envelopes.push({
          key: request.headers()["idempotency-key"],
          body: request.postData(),
        });
        if (!lost) {
          lost = true;
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          await route.abort("connectionfailed");
        } else await route.continue();
      });
      await editor
        .locator("fieldset")
        .first()
        .dispatchEvent("compositionstart");
      await page.locator("#rate-source").selectOption(source.id);
      await page.locator("#rate-component").selectOption("labour");
      await page.locator("#rate-unit").selectOption("item");
      await page.locator("#rate-basis").fill("1");
      await editor.getByRole("button", { name: t.add, exact: true }).click();
      await editor.getByLabel(t.from, { exact: true }).fill(today);
      await page
        .locator("#rate-reason")
        .fill("SYNTHETIC Tamil keyboard வரைவு — zero is deliberate only");
      await page.waitForTimeout(1100);
      expect(envelopes).toHaveLength(0);
      await editor.locator("fieldset").first().dispatchEvent("compositionend");
      await expect(state).toContainText(t.checking);
      await editor.getByRole("button", { name: t.retry, exact: true }).click();
      await expect(state).toHaveText(t.saved);
      expect(envelopes.length).toBeGreaterThanOrEqual(2);
      expect(envelopes[1]).toEqual(envelopes[0]);
      await expect(
        editor.getByRole("button", { name: t.review, exact: true }),
      ).toBeDisabled();
      const url = page.url();
      expect(new URL(url).searchParams.get("draft")).toBeTruthy();
      await page.reload();
      await expect(page.locator("#rate-reason")).toHaveValue(
        "SYNTHETIC Tamil keyboard வரைவு — zero is deliberate only",
      );
      const resumed = page.getByRole("region", {
        name: t.newRate,
        exact: true,
      });
      await resumed.getByLabel(t.price, { exact: true }).fill("100.01");
      await resumed.getByRole("button", { name: t.save, exact: true }).click();
      await expect(resumed.getByRole("status")).toHaveText(t.saved);
      await resumed
        .getByRole("button", { name: t.review, exact: true })
        .click();
      await publish(
        resumed.getByRole("button", { name: t.publish, exact: true }),
      );
      await expect(resumed.getByRole("status")).toHaveText(t.promoted);
      const list = await (
        await post(`/shops/${shopId}/settings/rates/list`, {})
      ).json();
      expect(list.revisions).toHaveLength(1);
      expect(list.revisions[0].entries[0].ratePaise).toBe(10001);
      await page.getByRole("button", { name: t.close, exact: true }).click();
      await page.getByRole("button", { name: t.history, exact: true }).click();
      await expect(
        page.getByRole("region", { name: t.history, exact: true }),
      ).toContainText("100.01");
      await page
        .getByRole("button", { name: new RegExp(`^${t.proposal}`) })
        .click();
      await page.getByRole("checkbox", { name: t.ack, exact: true }).check();
      await page
        .locator("#rate-reason")
        .fill("SYNTHETIC exact quotation-only approval");
      const policyEditor = page.getByRole("region", {
        name: t.policies,
        exact: true,
      });
      await policyEditor
        .getByRole("button", { name: t.save, exact: true })
        .click();
      await expect(policyEditor.getByRole("status")).toHaveText(t.saved);
      await policyEditor
        .getByRole("button", { name: t.review, exact: true })
        .click();
      await publish(
        policyEditor.getByRole("button", { name: t.bind, exact: true }),
      );
      await expect(policyEditor.getByRole("status")).toHaveText(t.promoted);
      await page.getByRole("button", { name: t.close, exact: true }).click();
      await page
        .getByRole("button", {
          name: `${t.bindingHistory} · Advance expectations`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("region", { name: t.bindingHistory, exact: true }),
      ).toContainText(t.unconfigured);
      await page
        .getByRole("button", {
          name: `${t.bindingHistory} · Quote validity`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("region", { name: t.bindingHistory, exact: true }),
      ).toContainText("SYNTHETIC exact quotation-only approval");
      await mkdir(".impeccable/review", { recursive: true });
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const m = quotationRateMessages[locale];
        await expect(
          page.getByRole("heading", { name: m.title, exact: true }),
        ).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(async () => {
          await document.fonts.ready;
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: `.impeccable/review/quotation-rates-${info.project.name}-${locale}.png`,
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
    },
  );
});
