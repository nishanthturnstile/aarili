import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  draftMessages,
  serviceAdditionMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceAdditions } from "../../scripts/test-support/service-additions.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test("SS-B AC-55 draft comparison keeps target refresh separate and requires explicit input choice", async ({
  page,
  context,
}, info) => {
  test.setTimeout(240000);
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
      const email = "service-conflicts@example.test",
        password = "synthetic-service-conflict-password";
      expect(
        (
          await post(
            "/owner/setup",
            { name: "SYNTHETIC conflict owner", email, password },
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
            { shopName: "SYNTHETIC service conflicts" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const entry = await (
          await page.request.get(`${origin}/api/owner/entry`)
        ).json(),
        shopId = entry.shop.shopId;
      const cookie = (await context.cookies(origin))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      async function setup(path, { method = "POST", body, etag } = {}) {
        const r = await seedCommand(
          new Request(`${origin}/api/shops/${shopId}/${path}`, {
            method,
            headers: {
              Origin: origin,
              Cookie: cookie,
              "Content-Type": "application/json",
              "Idempotency-Key": randomUUID(),
              ...(etag ? { "If-Match": etag } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
        expect(r.status, `${method} ${path}`).toBe(200);
        return r.json();
      }
      let retryAfter = 0;
      page.on("response", (r) => {
        if (r.status() === 429)
          retryAfter = Math.max(
            retryAfter,
            Number(r.headers()["retry-after"] ?? 1),
          );
      });
      const fixture = await seedServiceAdditions({ setup, runtime, shopId }),
        captures = [];
      try {
        const initial = await (
          await page.request.get(
            `${origin}/api/shops/${shopId}/drafts?limit=25`,
          )
        ).json();
        expect(
          initial.drafts.map((d) => d.id),
          "real HTTP recovery list contains the completed fixture draft",
        ).toContain(fixture.changeDraftId);
        for (const locale of ["en", "ta"]) {
          const t = serviceAdditionMessages[locale],
            d = draftMessages[locale];
          if (locale === "en")
            await page.goto(`${origin}/orders?order=${fixture.customId}`);
          await prepareOwnerScreen(page, locale);
          const section = page.getByRole("region", {
            name: t.title,
            exact: true,
          });
          if (locale === "en")
            await section
              .getByRole("button", {
                name: new RegExp(smallServiceMessages[locale].resume),
              })
              .click();
          const stored = await setup(`drafts/${fixture.changeDraftId}`, {
            method: "GET",
          });
          await setup(`drafts/${fixture.changeDraftId}`, {
            method: "PUT",
            etag: `"v${stored.version}"`,
            body: {
              workflow: "order.service-change",
              schemaVersion: 1,
              payload: {
                ...stored.payload,
                reason: `SYNTHETIC competing saved ${locale}`,
              },
            },
          });
          await section
            .getByLabel(t.reason, { exact: true })
            .fill(`SYNTHETIC explicit local ${locale}`);
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await expect(
                page.getByText(`SYNTHETIC competing saved ${locale}`, {
                  exact: true,
                }),
              ).toBeVisible({ timeout: 5000 });
              break;
            } catch (error) {
              if (!retryAfter || attempt === 2) throw error;
            }
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
            await page
              .getByRole("button", { name: d.retry, exact: true })
              .click();
          }
          await expect(
            section.getByRole("button", { name: t.refresh, exact: true }),
          ).toHaveCount(0);
          await expect(
            section.getByRole("button", { name: t.review, exact: true }),
          ).toBeDisabled();
          for (const dark of [false, true]) {
            await prepareOwnerScreen(page, locale, dark);
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.evaluate(() => document.fonts.ready);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            const path = `.impeccable/review/service-additions-${info.project.name}-${locale}-${dark ? "dark" : "light"}-draft-conflict.png`;
            await mkdir(".impeccable/review", { recursive: true });
            await page.screenshot({
              path,
              fullPage: true,
              animations: "disabled",
            });
            captures.push({
              path,
              state: "draft-conflict",
              locale,
              theme: dark ? "dark" : "light",
              viewport: page.viewportSize(),
              url: "/orders",
            });
          }
          await page
            .getByRole("button", { name: d.local, exact: true })
            .click();
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await expect(
                page.getByRole("status").getByText(d.saved, { exact: true }),
              ).toBeVisible({ timeout: 5000 });
              break;
            } catch (error) {
              if (!retryAfter || attempt === 2) throw error;
            }
            await page.waitForTimeout((retryAfter + 1) * 1000);
            retryAfter = 0;
            await page
              .getByRole("button", { name: d.retry, exact: true })
              .click();
          }
          await expect(
            section.getByRole("button", { name: t.review, exact: true }),
          ).toBeEnabled();
          const saved = await setup(`drafts/${fixture.changeDraftId}`, {
            method: "GET",
          });
          expect(saved.payload.reason).toBe(
            `SYNTHETIC explicit local ${locale}`,
          );
          const scope = await setup(
            `small-services/scope/${fixture.customId}`,
            { method: "GET" },
          );
          expect(scope.changes).toHaveLength(0);
        }
        await writeFile(
          `.impeccable/review/service-additions-${info.project.name}-conflict-manifest.json`,
          JSON.stringify(captures, null, 2),
        );
      } finally {
        await fixture.close();
      }
    },
  );
});
