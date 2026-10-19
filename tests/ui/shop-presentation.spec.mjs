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

test("ST-06/11 keyboard preference focus, bilingual cancel and preview invalidation", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const password = "synthetic-presentation-focus-password";
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime }) => {
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
              name: "SYNTHETIC focus owner",
              email: "focus@example.test",
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
            email: "focus@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC focus shop" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const seeded = await seedServiceTemplates(runtime, shopId);
      try {
        await page.goto(`${origin}/settings?section=serviceTemplates`);
        for (const locale of ["en", "ta"]) {
          await prepareOwnerScreen(page, locale);
          const t = serviceTemplatesMessages[locale],
            panel = page.getByRole("region", { name: t.shopMode, exact: true });
          const start = panel.getByRole("button", {
            name: t.editPreference,
            exact: true,
          });
          await start.focus();
          await page.keyboard.press("Enter");
          await expect(
            panel.getByRole("heading", { name: t.editPreference, exact: true }),
          ).toBeFocused();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await panel
            .getByLabel(t.reason, { exact: true })
            .fill(`SYNTHETIC unsaved ${locale}`);
          page.once("dialog", (dialog) => dialog.accept());
          await panel
            .getByRole("button", { name: t.cancel, exact: true })
            .focus();
          await page.keyboard.press("Enter");
          await expect(start).toBeFocused();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await mkdir("test-results/shop-presentation", { recursive: true });
          await page.screenshot({
            path: `test-results/shop-presentation/focus-${info.project.name}-${locale}.png`,
          });
        }
        await page.goto(
          `${origin}/settings?section=serviceTemplates&draft=${seeded.draft.id}`,
        );
        const en = serviceTemplatesMessages.en,
          editor = page.locator(".directory-editor"),
          preview = editor.getByRole("region", {
            name: en.previewTitle,
            exact: true,
          });
        const response = page.waitForResponse((r) =>
          r.url().endsWith("/service-templates/preview"),
        );
        await preview
          .getByRole("button", { name: en.preview, exact: true })
          .click();
        const canonical = await (await response).json();
        await expect(preview).toContainText(canonical.fingerprint);
        const label = editor.locator("#serviceTemplates-labelEn");
        // Keep this IME composition uncommitted, then exercise explicit dirty cancel.
        await label.dispatchEvent("compositionstart");
        await label.fill("SYNTHETIC changed definition");
        await expect(
          preview.getByText(en.previewStale, { exact: true }),
        ).toBeVisible();
        await expect(
          preview.getByText(canonical.fingerprint, { exact: true }),
        ).toHaveCount(0);
        page.once("dialog", (dialog) => dialog.accept());
        await page
          .getByRole("button", { name: en.cancel, exact: true })
          .click();
        await expect(editor).toHaveCount(0);
      } finally {
        await seeded.close();
      }
    },
    { secrets: [password] },
  );
});

test("ST-05/06/07/10-12 lossless bilingual preview and durable preference recovery", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const password = "synthetic-presentation-owner-password";
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime }) => {
      const admitted = async (run) => {
        let response = await run();
        for (let retry = 0; response.status() === 429 && retry < 2; retry++) {
          await page.waitForTimeout(
            Math.min(60, Number(response.headers()["retry-after"]) || 60) *
              1000 +
              100,
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
              name: "SYNTHETIC presentation owner",
              email: "presentation@example.test",
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
            email: "presentation@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC presentation shop" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const seeded = await seedServiceTemplates(runtime, shopId);
      const snapshot = async () => {
        const client = await runtime.connect();
        try {
          await client.query("BEGIN");
          const actor = (
            await client.query(
              "select user_id from owner_bootstrap where singleton",
            )
          ).rows[0].user_id;
          await client.query(
            "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
            [actor, shopId],
          );
          const rows = await client.query(
            "select tablename from pg_tables t where schemaname='public' and rowsecurity and has_table_privilege(current_user,quote_ident(t.tablename),'SELECT') order by tablename",
          );
          const counts = {};
          // Fixture runtime owns the connection only for verification; no values leave it.
          for (const { tablename } of rows.rows) {
            if (!/^[a-z_]+$/.test(tablename))
              throw Error("Unexpected table name");
            counts[tablename] = (
              await client.query(`select count(*)::int n from "${tablename}"`)
            ).rows[0].n;
          }
          counts.jobs = (
            await client.query("select count(*)::int n from pgboss.job")
          ).rows[0].n;
          return counts;
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
      };
      try {
        await page.goto(`${origin}/settings?section=serviceTemplates`);
        const en = serviceTemplatesMessages.en;
        let preference = page.getByRole("region", {
          name: en.shopMode,
          exact: true,
        });
        await expect(preference).toContainText(
          en.currentMode.replace("{mode}", en.simple),
        );
        await page
          .locator(".directory-list > li")
          .filter({
            has: page.getByRole("heading", {
              name: "SYNTHETIC before-craft",
              exact: true,
            }),
          })
          .getByRole("button", { name: en.detail, exact: true })
          .click();
        let preview = page
          .getByRole("heading", {
            name: en.previewTitle,
            exact: true,
          })
          .locator("..");
        const before = await snapshot();
        let canonical;
        const commands = [];
        const capture = (request) => {
          if (
            /\/drafts\/|\/customers|\/documents|\/files/.test(request.url()) &&
            request.method() !== "GET"
          )
            commands.push(request.url());
        };
        page.on("request", capture);
        for (const locale of ["en", "ta"]) {
          await prepareOwnerScreen(page, locale);
          const t = serviceTemplatesMessages[locale];
          preview = page
            .getByRole("heading", {
              name: t.previewTitle,
              exact: true,
            })
            .locator("..");
          const response = page.waitForResponse((r) =>
            r.url().endsWith("/service-templates/preview"),
          );
          await preview
            .getByRole("button", { name: t.preview, exact: true })
            .click();
          const body = await (await response).json();
          if (canonical) expect(body).toEqual(canonical);
          else canonical = body;
          expect(body.definition).toEqual(seeded.before.definition.content);
          expect(
            body.items
              .filter((r) => r.section === "tasks")
              .every((r) => r.assigneeId),
          ).toBe(true);
          for (const mode of ["detailed", "simple", "detailed", "simple"]) {
            await preview
              .getByRole("radio", { name: t[mode], exact: true })
              .check();
            await expect(preview).toContainText(body.fingerprint);
            await expect(preview).toContainText(t.illustrativeMilestones);
            await expect(preview).toContainText(t.lifecycle);
            await expect(preview).toContainText("craft");
          }
          const initialViewport = page.viewportSize();
          for (const size of [
            { width: 360, height: 800 },
            { width: 820, height: 1180 },
            { width: 1440, height: 900 },
          ]) {
            await page.setViewportSize(size);
            await expect(preview).toContainText(body.fingerprint);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
          await page.setViewportSize(initialViewport);
          await preview
            .getByRole("radio", { name: t.detailed, exact: true })
            .check();
          await preview.getByText(t.canonicalDetail, { exact: true }).click();
          await expect(preview).toContainText(seeded.form.definition.id);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await mkdir("test-results/shop-presentation", { recursive: true });
          await page.screenshot({
            path: `test-results/shop-presentation/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
        }
        page.off("request", capture);
        expect(commands).toEqual([]);
        expect(await snapshot()).toEqual(before);
        await prepareOwnerScreen(page, "en");
        preference = page.getByRole("region", {
          name: en.shopMode,
          exact: true,
        });
        await preference
          .getByRole("button", { name: en.editPreference, exact: true })
          .click();
        await expect(
          preference.getByRole("button", { name: en.review, exact: true }),
        ).toBeDisabled();
        await preference
          .getByRole("radio", { name: en.detailed, exact: true })
          .check();
        await preference
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC தமிழ் presentation preference");
        await preference
          .getByRole("button", { name: en.save, exact: true })
          .click();
        await expect(
          preference.getByRole("button", { name: en.review, exact: true }),
        ).toBeEnabled();
        await page.reload();
        preference = page.getByRole("region", {
          name: en.shopMode,
          exact: true,
        });
        await expect(
          preference.getByLabel(en.reason, { exact: true }),
        ).toHaveValue("SYNTHETIC தமிழ் presentation preference");
        await preference
          .getByRole("button", { name: en.review, exact: true })
          .click();
        const replayKeys = [];
        let lost = false;
        await page.route("**/drafts/*/promote", async (route) => {
          replayKeys.push(route.request().headers()["idempotency-key"]);
          if (!lost) {
            lost = true;
            await route.fetch();
            await route.abort("failed");
          } else await route.continue();
        });
        await preference
          .getByRole("button", { name: en.publish, exact: true })
          .click();
        await expect(
          preference.getByRole("button", { name: en.retry, exact: true }),
        ).toBeVisible();
        await preference
          .getByRole("button", { name: en.retry, exact: true })
          .click();
        await expect(preference).toContainText(
          en.currentMode.replace("{mode}", en.detailed),
        );
        await page
          .locator(".directory-list > li")
          .filter({
            has: page.getByRole("heading", {
              name: "SYNTHETIC before-craft",
              exact: true,
            }),
          })
          .getByRole("button", { name: en.detail, exact: true })
          .click();
        preview = page
          .getByRole("heading", { name: en.previewTitle, exact: true })
          .locator("..");
        const regenerated = page.waitForResponse((r) =>
          r.url().endsWith("/service-templates/preview"),
        );
        await preview
          .getByRole("button", { name: en.preview, exact: true })
          .click();
        expect(await (await regenerated).json()).toEqual(canonical);
        await expect(
          preview.getByRole("radio", { name: en.detailed, exact: true }),
        ).toBeChecked();
        expect(replayKeys.length).toBe(2);
        expect(replayKeys[0]).toBe(replayKeys[1]);
        await page.unroute("**/drafts/*/promote");
        const state = await (
          await post(
            `/shops/${shopId}/settings/service-templates/presentation`,
            {},
          )
        ).json();
        expect(state.history).toHaveLength(1);
        await page.reload();
        preference = page.getByRole("region", {
          name: en.shopMode,
          exact: true,
        });
        await expect(preference).toContainText(
          en.currentMode.replace("{mode}", en.detailed),
        );
        await preference
          .getByRole("button", { name: en.editPreference, exact: true })
          .click();
        await preference
          .getByRole("radio", { name: en.simple, exact: true })
          .check();
        await preference
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC conflicting view");
        await preference
          .getByRole("button", { name: en.save, exact: true })
          .click();
        await expect(
          preference.getByRole("button", { name: en.review, exact: true }),
        ).toBeEnabled();
        const uuid = crypto.randomUUID(),
          otherKey = crypto.randomUUID(),
          otherId = `${uuid.slice(0, 14)}7${uuid.slice(15)}`;
        const putOther = () =>
          page.request.put(`${origin}/api/shops/${shopId}/drafts/${otherId}`, {
            data: {
              workflow: "shop.presentation",
              schemaVersion: 1,
              payload: {
                baseVersion: state.revision.version,
                baseRevisionId: state.revision.id,
                mode: "simple",
                reason: "SYNTHETIC other tab",
              },
            },
            headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
          });
        const other = await admitted(putOther);
        expect(other.status()).toBe(200);
        const { draft } = await other.json();
        expect(
          (
            await post(
              `/shops/${shopId}/drafts/${otherId}/promote`,
              {},
              {
                "Idempotency-Key": otherKey,
                "If-Match": `"v${draft.version}"`,
              },
            )
          ).status(),
        ).toBe(200);
        await preference
          .getByRole("button", { name: en.review, exact: true })
          .click();
        await preference
          .getByRole("button", { name: en.publish, exact: true })
          .click();
        await expect(preference.getByRole("alert")).toBeVisible();
        await preference
          .getByRole("button", { name: en.compare, exact: true })
          .click();
        await expect(preference).toContainText(
          en.currentMode.replace("{mode}", en.simple),
        );
        page.once("dialog", (dialog) => dialog.dismiss());
        await preference
          .getByRole("button", { name: en.cancel, exact: true })
          .click();
        await expect(
          preference.getByLabel(en.reason, { exact: true }),
        ).toBeVisible();
        page.once("dialog", (dialog) => dialog.accept());
        await preference
          .getByRole("button", { name: en.cancel, exact: true })
          .click();
        await expect(
          preference.getByLabel(en.reason, { exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(page).toHaveURL(/sign-in/);
        await expectStaticPwaStorage(page);
      } finally {
        await seeded.close();
      }
    },
    { secrets: [password] },
  );
});
