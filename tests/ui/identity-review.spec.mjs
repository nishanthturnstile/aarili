import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { identityReviewMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceAdditions } from "../../scripts/test-support/service-additions.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("RH-07/08/12/13/15 bilingual duplicate review, retained identities, response-loss retry and corrections", async ({
  page,
  context,
}, info) => {
  test.setTimeout(300000);
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-history-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC history owner",
              email: "history@example.test",
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
            email: "history@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC history shop" },
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
        expect(r.status, `${path}: ${await r.clone().text()}`).toBe(200);
        return r.json();
      }
      const services = await seedServiceAdditions({ setup, runtime, shopId });
      try {
        const customerId = services.seed.customer.customerId;
        const c = await setup(`customers/${customerId}`, { method: "GET" });
        const policy = await setup("customers/policy", { method: "GET" });
        await setup(`customers/${c.id}`, {
          method: "PATCH",
          etag: `"v${c.version}"`,
          body: {
            displayName: c.displayName,
            phone: "9000000737",
            aliases: c.aliases,
            reason: "SYNTHETIC shared phone",
          },
        });
        const other = await setup("customers", {
          body: {
            displayName: "SYNTHETIC distinct contact",
            phone: "9000000737",
            aliases: [],
            serviceEvidence: {
              noticeId: policy.notice.id,
              language: "en",
              decision: "grant",
              giver: "self",
              noticeExplained: true,
              source: "in-person",
              occurredAt: new Date().toISOString(),
            },
          },
        });
        for (const locale of ["en", "ta"]) {
          const t = identityReviewMessages[locale];
          await page.goto(`${origin}/customers/${customerId}`);
          await prepareOwnerScreen(page, locale, locale === "ta");
          const panel = page.getByRole("region", { name: t.title });
          await panel
            .getByRole("button", { name: t.browse, exact: true })
            .click();
          await expect(panel.getByText(t.phone, { exact: true })).toBeVisible();
          await panel
            .getByRole("button", { name: new RegExp(`^${t.review}:`) })
            .click();
          await expect(
            panel.getByRole("heading", { name: t.review, exact: true }),
          ).toBeFocused();
          await expect(
            panel.getByRole("heading", { name: /SYNTHETIC distinct contact/ }),
          ).toBeVisible();
          await expect(
            panel.getByText(t.wearers, { exact: true }).first(),
          ).toBeVisible();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await mkdir(".scratch/identity-review", { recursive: true });
          await page.screenshot({
            path: `.scratch/identity-review/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
          if (info.project.name === "tablet") {
            await page.setViewportSize({ width: 1180, height: 820 });
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
            await page.setViewportSize(info.project.use.viewport);
          }
          const textarea = panel.getByRole("textbox", { name: t.reason });
          await textarea.fill(`SYNTHETIC ${locale} different people`);
          const attempts = [];
          let lose = true;
          await page.route("**/customer-history/decision", async (route) => {
            attempts.push({
              body: route.request().postData(),
              headers: {
                key: route.request().headers()["idempotency-key"],
                etag: route.request().headers()["if-match"],
              },
            });
            const response = await route.fetch();
            if (lose) {
              lose = false;
              await route.abort("failed");
            } else await route.fulfill({ response });
          });
          await panel
            .getByRole("button", { name: t.save, exact: true })
            .click();
          await expect(panel.getByText(t.error, { exact: true })).toBeVisible();
          await panel
            .getByRole("button", { name: t.retry, exact: true })
            .click();
          await expect(panel.getByText(t.saved, { exact: true })).toBeVisible();
          expect(attempts).toHaveLength(2);
          expect(attempts[0]).toEqual(attempts[1]);
          await page.unroute("**/customer-history/decision");
          await panel
            .getByRole("button", { name: t.browse, exact: true })
            .click();
          await panel
            .getByRole("button", { name: new RegExp(`^${t.review}:`) })
            .click();
          await expect(
            panel.getByText(`SYNTHETIC ${locale} different people`, {
              exact: true,
            }),
          ).toBeVisible();
          expect(
            (await setup(`customers/${other.customerId}`, { method: "GET" }))
              .id,
          ).toBe(other.customerId);
          // A concurrent contact correction invalidates the preview, with no automatic merge.
          const now = await setup(`customers/${c.id}`, { method: "GET" });
          await setup(`customers/${c.id}`, {
            method: "PATCH",
            etag: `"v${now.version}"`,
            body: {
              displayName: now.displayName,
              phone: now.phone,
              aliases: now.aliases,
              notes: `SYNTHETIC changed ${locale}`,
              reason: "SYNTHETIC stale preview",
            },
          });
          await panel
            .getByRole("textbox", { name: t.reason })
            .fill("SYNTHETIC stale decision");
          const pendingStale = page.waitForResponse((r) =>
            r.url().endsWith("/customer-history/decision"),
          );
          await panel
            .getByRole("button", { name: t.save, exact: true })
            .click();
          let staleResponse = await pendingStale;
          if (staleResponse.status() === 429) {
            const limitedRequest = staleResponse.request();
            await expect(panel.getByRole("alert")).toContainText(t.limited);
            const seconds = Number(staleResponse.headers()["retry-after"]);
            expect(seconds).toBeGreaterThan(0);
            expect(seconds).toBeLessThanOrEqual(60);
            await page.waitForTimeout(seconds * 1000 + 100);
            const retried = page.waitForResponse((r) =>
              r.url().endsWith("/customer-history/decision"),
            );
            await panel
              .getByRole("button", { name: t.retry, exact: true })
              .click();
            staleResponse = await retried;
            expect(staleResponse.request().postData()).toBe(
              limitedRequest.postData(),
            );
            expect(staleResponse.request().headers()["idempotency-key"]).toBe(
              limitedRequest.headers()["idempotency-key"],
            );
            expect(staleResponse.request().headers()["if-match"]).toBe(
              limitedRequest.headers()["if-match"],
            );
          }
          expect(staleResponse.status()).toBe(412);
          await expect(
            panel.getByText(t.changed, { exact: true }),
          ).toBeVisible();
          await expect(
            panel.getByRole("heading", { name: /SYNTHETIC distinct contact/ }),
          ).toHaveCount(0);
        }
        await expectStaticPwaStorage(page);
      } finally {
        await services.close();
      }
    },
  );
});
