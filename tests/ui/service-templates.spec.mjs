import { mkdir } from "node:fs/promises";
import { serviceTemplatesMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedServiceTemplates } from "../../scripts/test-support/seed-service-templates.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
for (const uiLocale of ["en", "ta"])
  test(`${uiLocale === "ta" ? "Tamil " : ""}ST-03/04/07/10/11/12 templates, exact-key recovery, bilingual preview, history and private clearing`, async ({
    page,
  }, info) => {
    test.setTimeout(480000);
    if (info.project.name === "desktop")
      await page.setViewportSize({ width: 1440, height: 900 });
    const password = "synthetic-service-catalogue-owner-password";
    await withOwnerWeb(
      async ({ origin, setupToken, code, runtime }) => {
        const admitted = async (run) => {
          let response = await run();
          for (let retry = 0; response.status() === 429 && retry < 3; retry++) {
            await page.waitForTimeout(
              Number(response.headers()["retry-after"] ?? 60) * 1000 + 100,
            );
            response = await run();
          }
          return response;
        };
        const post = (path, data, headers = {}) =>
          admitted(() =>
            page.request.post(`${origin}/api${path}`, {
              data,
              headers: { Origin: origin, ...headers },
            }),
          );
        expect(
          (
            await post(
              "/owner/setup",
              {
                name: "SYNTHETIC catalogue owner",
                email: "catalogue@example.test",
                password,
              },
              {
                "X-Setup-Token": setupToken,
                "Idempotency-Key": crypto.randomUUID(),
              },
            )
          ).status(),
        ).toBe(200);
        expect(
          (await post("/owner/verify", { code: await code() })).status(),
        ).toBe(200);
        expect(
          (
            await post("/auth/sign-in/email", {
              email: "catalogue@example.test",
              password,
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await post(
              "/owner/complete",
              { shopName: "SYNTHETIC catalogue shop" },
              { "Idempotency-Key": crypto.randomUUID() },
            )
          ).status(),
        ).toBe(200);
        const { shopId } = await (
            await page.request.get(`${origin}/api/owner/shop`)
          ).json(),
          api = `/shops/${shopId}`;
        const seeded = await seedServiceTemplates(runtime, shopId);
        try {
          const en = serviceTemplatesMessages[uiLocale],
            editor = () => page.locator(".directory-editor");
          await page.goto(`${origin}/settings?section=serviceTemplates`);
          if (uiLocale === "ta") await prepareOwnerScreen(page, uiLocale);
          await expect(
            page.getByRole("heading", { name: en.title, exact: true }),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: en.addKind.replace("{kind}", en["service-template"]),
              exact: true,
            })
            .click();
          await expect(
            editor().getByRole("button", { name: en.review, exact: true }),
          ).toBeDisabled();
          await editor()
            .locator("#serviceTemplates-labelEn")
            .fill("SYNTHETIC incomplete new manifest");
          const sources = editor().getByRole("region", {
            name: en.sources,
            exact: true,
          });
          await sources
            .getByRole("button", { name: en.search, exact: true })
            .click();
          await sources
            .getByRole("button", { name: en.select, exact: true })
            .click();
          await expect(sources).toContainText(seeded.service.definition.id);
          await sources
            .getByLabel(en.decision, { exact: true })
            .selectOption("applicable");
          await sources
            .getByRole("button", { name: en.chooseForm, exact: true })
            .click();
          await sources
            .getByLabel(`${en.form} · body`, { exact: true })
            .selectOption(seeded.form.definition.id);
          await expect(sources).toContainText(seeded.form.definition.id);
          await sources
            .getByRole("button", { name: en.remove, exact: true })
            .click();
          await expect(
            sources.getByLabel(`${en.form} · body`, { exact: true }),
          ).toHaveValue("");
          page.once("dialog", (d) => d.accept());
          await page
            .getByRole("button", { name: en.cancel, exact: true })
            .click();
          await page.goto(
            `${origin}/settings?section=serviceTemplates&draft=${seeded.draft.id}`,
          );
          if (uiLocale === "ta") await prepareOwnerScreen(page, uiLocale);
          await expect(editor().locator("#serviceTemplates-code")).toHaveValue(
            "owner-draft",
          );
          if (uiLocale === "ta")
            await editor()
              .locator("#serviceTemplates-labelTa")
              .fill("\u0b9a\u0bc6\u0baf\u0bb1\u0bcd\u0b95\u0bc8 owner-draft");
          const preview = () =>
            editor().getByRole("region", {
              name: en.previewTitle,
              exact: true,
            });
          await preview()
            .getByRole("button", { name: en.preview, exact: true })
            .click();
          await expect(
            preview().getByText(en.tokens, { exact: false }),
          ).toContainText("price_basis");
          await expect(preview()).toContainText(
            uiLocale === "ta"
              ? "\u0b89\u0b9f\u0bb2\u0bcd \u0ba8\u0bc0\u0bb3\u0bae\u0bcd"
              : "Body length",
          );
          const confirmSection = editor()
            .locator("details")
            .filter({
              has: page.locator("summary", { hasText: en.confirmation }),
            });
          await confirmSection.locator("summary").click();
          const wording = confirmSection.getByLabel(en.instructionEn, {
            exact: true,
          });
          await wording.fill("{{unsupported}}");
          await expect(
            editor().getByRole("button", { name: en.review, exact: true }),
          ).toBeDisabled();
          await expect(
            preview().getByText(en.previewStale, { exact: true }),
          ).toBeVisible();
          await wording.fill(
            "Price basis {{price_basis}}; ready {{ready_date}}",
          );
          await confirmSection.locator("summary").click();
          const tasks = editor()
            .locator("details")
            .filter({ has: page.locator("summary", { hasText: en.tasks }) });
          await tasks.locator("summary").click();
          const first = tasks.getByRole("group", {
            name: `${en.tasks} · 1`,
            exact: true,
          });
          await first
            .getByLabel(en.labelTa, { exact: true })
            .dispatchEvent("compositionstart");
          await first
            .getByLabel(en.labelTa, { exact: true })
            .fill("திருத்திய கைவினை");
          await first
            .getByLabel(en.labelTa, { exact: true })
            .dispatchEvent("compositionend");
          await first
            .getByRole("button", { name: en.down, exact: true })
            .focus();
          await page.keyboard.press("Enter");
          await expect(
            tasks
              .getByRole("group", { name: `${en.tasks} · 2`, exact: true })
              .getByLabel(en.key, { exact: true }),
          ).toHaveValue("craft");
          const stitchKeys = tasks
            .getByRole("group", { name: `${en.tasks} · 4`, exact: true })
            .getByLabel(en.predecessors, { exact: true });
          await stitchKeys.fill("cut");
          await stitchKeys.press("End");
          await stitchKeys.pressSequentially(", parallel-trim");
          await expect(stitchKeys).toHaveValue("cut, parallel-trim");
          let lost = false;
          const keys = [];
          await page.route("**/api/shops/*/drafts/*", async (route) => {
            if (route.request().method() !== "PUT") return route.continue();
            keys.push(route.request().headers()["idempotency-key"]);
            if (!lost) {
              lost = true;
              expect((await admitted(() => route.fetch())).status()).toBe(200);
              await route.abort("failed");
            } else await route.continue();
          });
          await editor()
            .getByRole("button", { name: en.save, exact: true })
            .click();
          await expect(
            editor().getByRole("button", { name: en.retry, exact: true }),
          ).toBeVisible();
          await editor()
            .getByRole("button", { name: en.retry, exact: true })
            .click();
          await expect(
            editor().getByText(en.saved, { exact: true }),
          ).toBeVisible();
          expect(keys[0]).toBe(keys[1]);
          await page.unroute("**/api/shops/*/drafts/*");
          await page.reload();
          if (uiLocale === "ta") await prepareOwnerScreen(page, uiLocale);
          await expect(editor().locator("#serviceTemplates-code")).toHaveValue(
            "owner-draft",
          );
          for (const locale of ["en", "ta"]) {
            await prepareOwnerScreen(page, locale);
            const t = serviceTemplatesMessages[locale];
            await expect(
              page.getByRole("heading", { name: t.title, exact: true }),
            ).toBeVisible();
            const taskDetails = editor()
              .locator("details")
              .filter({ has: page.locator("summary", { hasText: t.tasks }) });
            if (!(await taskDetails.evaluate((e) => e.open)))
              await taskDetails.locator("summary").click();
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            ).toBe(true);
            await mkdir(".scratch/service-templates-captures", {
              recursive: true,
            });
            await page.screenshot({
              path: `.scratch/service-templates-captures/${info.project.name}-${locale}.png`,
              fullPage: true,
            });
            await page.addStyleTag({
              content: "html { font-size: 200% !important; }",
            });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            ).toBe(true);
            await page
              .locator("style")
              .filter({ hasText: "font-size: 200% !important" })
              .evaluateAll((nodes) => {
                for (const n of nodes) n.remove();
              });
          }
          await prepareOwnerScreen(page, uiLocale);
          await editor()
            .getByRole("button", { name: en.review, exact: true })
            .click();
          const publishKeys = [];
          let lostPublish = false;
          await page.route("**/api/shops/*/drafts/*/promote", async (route) => {
            publishKeys.push(route.request().headers()["idempotency-key"]);
            if (!lostPublish) {
              lostPublish = true;
              expect((await admitted(() => route.fetch())).status()).toBe(200);
              await route.abort("failed");
            } else await route.continue();
          });
          await editor()
            .getByRole("button", { name: en.publish, exact: true })
            .click();
          await expect(
            editor().getByRole("button", { name: en.retry, exact: true }),
          ).toBeVisible();
          await editor()
            .getByRole("button", { name: en.retry, exact: true })
            .click();
          await expect(
            editor().getByText(en.readOnly, { exact: true }),
          ).toBeVisible();
          expect(publishKeys[0]).toBe(publishKeys[1]);
          await page.unroute("**/api/shops/*/drafts/*/promote");
          const listRow = page.locator(".directory-list > li").filter({
            has: page.getByRole("heading", {
              name:
                uiLocale === "ta"
                  ? "\u0b9a\u0bc6\u0baf\u0bb1\u0bcd\u0b95\u0bc8 owner-draft"
                  : "SYNTHETIC owner-draft",
              exact: true,
            }),
          });
          await listRow
            .getByRole("button", { name: en.detail, exact: true })
            .click();
          await page
            .getByRole("button", { name: en.history, exact: true })
            .click();
          await page.locator(".shop-profile-history summary").click();
          await expect(page.locator(".shop-profile-history")).toContainText(
            "திருத்திய கைவினை",
          );
          await page
            .getByRole("button", { name: en.edit, exact: true })
            .click();
          await editor()
            .locator("#serviceTemplates-labelEn")
            .fill("SYNTHETIC conflict draft");
          await editor()
            .getByRole("button", { name: en.save, exact: true })
            .click();
          await expect(
            editor().getByText(en.saved, { exact: true }),
          ).toBeVisible();
          const draftId = new URL(page.url()).searchParams.get("draft"),
            draft = await (
              await page.request.get(`${origin}/api${api}/drafts/${draftId}`)
            ).json();
          const response = await admitted(() =>
            page.request.put(`${origin}/api${api}/drafts/${draftId}`, {
              headers: {
                Origin: origin,
                "Idempotency-Key": crypto.randomUUID(),
                "If-Match": `"v${draft.version}"`,
              },
              data: {
                workflow: "service.templates",
                schemaVersion: 1,
                payload: {
                  ...draft.payload,
                  content: {
                    ...draft.payload.content,
                    labelEn: "SYNTHETIC other session",
                  },
                },
              },
            }),
          );
          expect(response.status()).toBe(200);
          await editor()
            .locator("#serviceTemplates-labelEn")
            .fill("SYNTHETIC local changes");
          await editor()
            .getByRole("button", { name: en.save, exact: true })
            .click();
          const conflict = editor().getByRole("heading", {
              name: en.conflict,
              exact: true,
            }),
            limited = editor().getByText(en.rateLimited, { exact: true });
          await expect(conflict.or(limited)).toBeVisible();
          if (await limited.isVisible()) {
            await page.waitForTimeout(60000);
            await editor()
              .getByRole("button", { name: en.save, exact: true })
              .click();
          }
          await expect(conflict).toBeVisible();
          await editor()
            .getByRole("button", { name: en.compare, exact: true })
            .click();
          await expect(
            editor()
              .getByText("SYNTHETIC other session", { exact: false })
              .first(),
          ).toBeVisible();
          await editor()
            .getByRole("button", { name: en.keepLocal, exact: true })
            .click();
          page.once("dialog", (d) => d.dismiss());
          await page
            .getByRole("button", { name: en.cancel, exact: true })
            .click();
          await expect(editor()).toBeVisible();
          page.once("dialog", (d) => d.accept());
          await page
            .getByRole("button", { name: en.cancel, exact: true })
            .click();
          await expect(editor()).toHaveCount(0);
          await expect(
            page.getByRole("button", {
              name: en.addKind.replace("{kind}", en["service-template"]),
              exact: true,
            }),
          ).toBeFocused();
          // Current selection becomes unavailable without altering exact history.
          const source = seeded.piece;
          await seeded.command("service.catalogue", {
            entryId: source.entryId,
            baseVersion: source.version,
            baseRevisionId: source.id,
            operation: "availability",
            available: false,
            reason: "SYNTHETIC disabled source",
            content: source.definition.content,
          });
          await page.reload();
          if (uiLocale === "ta") await prepareOwnerScreen(page, uiLocale);
          await expect(
            page.getByText(en.referencesUnavailable, { exact: false }).first(),
          ).toBeVisible();
          const historyRow = page.locator(".directory-list > li").filter({
            has: page.getByRole("heading", {
              name:
                uiLocale === "ta"
                  ? "\u0b9a\u0bc6\u0baf\u0bb1\u0bcd\u0b95\u0bc8 owner-draft"
                  : "SYNTHETIC owner-draft",
              exact: true,
            }),
          });
          await historyRow
            .getByRole("button", { name: en.detail, exact: true })
            .click();
          await page
            .getByRole("button", { name: en.history, exact: true })
            .click();
          await expect(page.locator(".shop-profile-history")).toBeVisible();
          await page.route(
            "**/api/shops/*/settings/service-templates/list",
            (route) =>
              route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  error: {
                    code: "DATABASE_UNAVAILABLE",
                    message: "Synthetic unavailable",
                  },
                }),
              }),
          );
          await page.reload();
          if (uiLocale === "ta") await prepareOwnerScreen(page, uiLocale);
          await expect(page.getByText(en.error, { exact: true })).toBeVisible();
          await page.unroute("**/api/shops/*/settings/service-templates/list");
          await page
            .getByRole("button", { name: en.refresh, exact: true })
            .click();
          await expect(
            page.getByRole("heading", { name: en.title, exact: true }),
          ).toBeVisible();
          await expectStaticPwaStorage(page);
          expect((await post("/auth/sign-out", {})).status()).toBe(200);
          await page.reload();
          await expect(
            page.getByRole("heading", { name: en.title, exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("SYNTHETIC local changes", { exact: true }),
          ).toHaveCount(0);
        } finally {
          await seeded.close();
        }
      },
      { secrets: [password] },
    );
  });
