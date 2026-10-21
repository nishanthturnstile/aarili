import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { contactMergeMessages, identityReviewMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceAdditions } from "../../scripts/test-support/service-additions.mjs";
import { serviceDraftId } from "../../scripts/test-support/small-services.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("RH-07/08/12/13/15 contact merge preview, cancel, stale review, lost response and restore in both languages", async ({
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
        const intake = services.saree.intake;
        const serviceReview = await setup("small-services/orders/review", {
          body: intake,
        });
        const draftId = serviceDraftId();
        await setup(`drafts/${draftId}`, {
          method: "PUT",
          body: {
            workflow: "order.service",
            schemaVersion: 1,
            payload: {
              ...intake,
              commitmentReview: {
                fingerprint: serviceReview.fingerprint,
                acknowledged: true,
                exceptionReason: "SYNTHETIC merge review",
                waiveRush: false,
                waiverReason: "",
              },
            },
          },
        });
        const accepted = await setup(`drafts/${draftId}/promote`, {
          body: {},
          etag: '"v1"',
        });
        const service = await setup(
          `small-services/orders/${accepted.draft.result.id}`,
          { method: "GET" },
        );
        for (const locale of ["en", "ta"]) {
          const t = contactMergeMessages[locale],
            d = identityReviewMessages[locale];
          await page.goto(`${origin}/customers/${customerId}`);
          await prepareOwnerScreen(page, locale, locale === "ta");
          const duplicates = page.getByRole("region", { name: d.title });
          await duplicates
            .getByRole("button", { name: d.browse, exact: true })
            .click();
          await duplicates
            .getByRole("button", { name: new RegExp(`^${d.review}:`) })
            .click();
          let panel = page.getByRole("region", { name: t.title, exact: true });
          await panel
            .getByLabel(t.source, { exact: true })
            .selectOption(customerId);
          await panel
            .getByRole("button", { name: t.preview, exact: true })
            .click();
          await expect(
            panel.getByRole("heading", { name: t.fields, exact: true }),
          ).toBeFocused();
          await expect(
            panel.getByText(t.retained, { exact: true }).first(),
          ).toBeVisible();
          await expect(
            panel.getByRole("button", { name: t.apply, exact: true }),
          ).toBeDisabled();
          // Canceling a read-only preview creates no merge.
          await panel
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          expect(
            (
              await setup("customer-history", {
                body: { customerId, limit: 25 },
              })
            ).events.filter((e) =>
              ["customer.merge", "customer.restore"].includes(e.action),
            ).length,
          ).toBe(locale === "en" ? 0 : 2);
          await panel
            .getByRole("button", { name: t.preview, exact: true })
            .click();
          for (const field of [
            "displayName",
            "phone",
            "email",
            "aliases",
            "notes",
          ])
            await panel
              .getByLabel(t[field], { exact: true })
              .selectOption("survivor");
          await panel
            .getByRole("checkbox", { name: service.code, exact: true })
            .check();
          await panel
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC owner review of a mistaken duplicate");
          await panel.getByLabel(t.confirm, { exact: true }).check();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
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
          await mkdir(".scratch/contact-merge", { recursive: true });
          await page.screenshot({
            path: `.scratch/contact-merge/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
          if (locale === "en") {
            const changed = await setup(`customers/${other.customerId}`, {
              method: "GET",
            });
            await setup(`customers/${other.customerId}`, {
              method: "PATCH",
              etag: `"v${changed.version}"`,
              body: {
                displayName: changed.displayName,
                phone: changed.phone,
                aliases: changed.aliases,
                reason: "SYNTHETIC intervening correction",
              },
            });
            await panel
              .getByRole("button", { name: t.apply, exact: true })
              .click();
            await expect(
              panel.getByText(t.changed, { exact: true }),
            ).toBeVisible();
            await panel
              .getByRole("button", { name: t.refresh, exact: true })
              .click();
            for (const field of [
              "displayName",
              "phone",
              "email",
              "aliases",
              "notes",
            ])
              await panel
                .getByLabel(t[field], { exact: true })
                .selectOption("survivor");
            await panel
              .getByRole("checkbox", { name: service.code, exact: true })
              .check();
            await panel
              .getByLabel(t.reason, { exact: true })
              .fill("SYNTHETIC refreshed owner review");
            await panel.getByLabel(t.confirm, { exact: true }).check();
          }
          // First send commits but loses the response; explicit retry is exact.
          let first, second;
          await page.route(
            "**/customer-history/merge",
            async (route) => {
              first = {
                body: route.request().postData(),
                key: route.request().headers()["idempotency-key"],
                etag: route.request().headers()["if-match"],
              };
              await route.fetch();
              await route.abort("failed");
            },
            { times: 1 },
          );
          await panel
            .getByRole("button", { name: t.apply, exact: true })
            .click();
          await expect(panel.getByText(t.error, { exact: true })).toBeVisible();
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          await expect(
            panel.getByRole("button", { name: t.retry, exact: true }),
          ).toBeVisible();
          await expect(panel.getByLabel(t.source, { exact: true })).toHaveCount(
            0,
          );
          await expect(
            duplicates.getByRole("heading", { name: d.review, exact: true }),
          ).toHaveCount(0);

          await page.route(
            "**/customer-history/merge",
            async (route) => {
              second = {
                body: route.request().postData(),
                key: route.request().headers()["idempotency-key"],
                etag: route.request().headers()["if-match"],
              };
              await route.continue();
            },
            { times: 1 },
          );
          const retrying = page.waitForResponse(
            (r) =>
              r.url().endsWith("/customer-history/merge") &&
              r.request().method() === "POST",
          );
          await panel
            .getByRole("button", { name: t.retry, exact: true })
            .click();
          const retried = await retrying;
          if (retried.status() === 429) {
            await expect(
              panel.getByText(t.limited, { exact: true }),
            ).toBeVisible();
            await page.waitForTimeout(
              Number(retried.headers()["retry-after"]) * 1000 + 100,
            );
            await panel
              .getByRole("button", { name: t.retry, exact: true })
              .click();
          }
          await expect(panel.getByText(t.saved, { exact: true })).toBeVisible();
          expect(second).toEqual(first);
          const projected = await setup(`small-services/orders/${service.id}`, {
            method: "GET",
          });
          expect(projected.intake.customerId).toBe(customerId);
          expect(projected.currentAttribution.customerId).toBe(
            other.customerId,
          );
          await page.reload();
          await prepareOwnerScreen(page, locale, locale === "ta");
          await expect(
            page.getByText(t.merged, { exact: false }),
          ).toBeVisible();
          const fresh = page.getByRole("region", { name: d.title });
          await fresh
            .getByRole("button", { name: d.review, exact: true })
            .click();
          panel = page.getByRole("region", { name: t.restore, exact: true });
          await panel
            .getByRole("button", { name: t.restorePreview, exact: true })
            .click();
          await expect(
            panel.getByRole("heading", { name: t.restorePreview, exact: true }),
          ).toBeFocused();
          await panel
            .getByRole("checkbox", { name: service.code, exact: true })
            .check();
          await panel
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC reviewed restoration");
          await panel.getByLabel(t.confirm, { exact: true }).check();
          const restoring = page.waitForResponse(
            (r) =>
              r.url().endsWith("/customer-history/merge") &&
              r.request().method() === "POST",
          );
          await panel
            .getByRole("button", { name: t.restore, exact: true })
            .click();
          const response = await restoring;
          if (response.status() === 429) {
            await expect(
              panel.getByText(t.limited, { exact: true }),
            ).toBeVisible();
            await page.waitForTimeout(
              Number(response.headers()["retry-after"]) * 1000 + 100,
            );
            await panel
              .getByRole("button", { name: t.retry, exact: true })
              .click();
          }
          await expect(panel.getByText(t.saved, { exact: true })).toBeVisible();
          expect(
            (
              await setup("customer-history", {
                body: { customerId, limit: 25 },
              })
            ).events.filter((e) =>
              ["customer.merge", "customer.restore"].includes(e.action),
            ).length,
          ).toBe(locale === "en" ? 2 : 4);
        }
        await expectStaticPwaStorage(page);
      } finally {
        await services.close();
      }
    },
  );
});
