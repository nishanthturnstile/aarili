import { mkdir } from "node:fs/promises";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { measurementFormsMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("ST-02/07/10/11/12 forms, IME, keyboard order, exact-key recovery and bilingual history", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  const password = "synthetic-service-catalogue-owner-password";
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
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
      const en = measurementFormsMessages.en;
      const publishCatalogue = async (kind, code, extra = {}) => {
        const u = crypto.randomUUID(),
          draftId = `${u.slice(0, 14)}7${u.slice(15)}`,
          entryId = crypto.randomUUID();
        expect(
          (
            await page.request.put(`${origin}/api${api}/drafts/${draftId}`, {
              headers: {
                Origin: origin,
                "Idempotency-Key": crypto.randomUUID(),
              },
              data: {
                workflow: "service.catalogue",
                schemaVersion: 1,
                payload: {
                  entryId,
                  baseVersion: 0,
                  baseRevisionId: null,
                  operation: "definition",
                  available: true,
                  reason: "SYNTHETIC reviewed fixture",
                  content: {
                    ...emptyCatalogueContent(kind),
                    code,
                    labelEn: `SYNTHETIC ${code}`,
                    labelTa: "செயற்கை ஆடை",
                    ...extra,
                  },
                },
              },
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await post(
              `${api}/drafts/${draftId}/promote`,
              {},
              { "Idempotency-Key": crypto.randomUUID(), "If-Match": '"v1"' },
            )
          ).status(),
        ).toBe(200);
        return (
          await (
            await page.request.get(
              `${origin}/api${api}/settings/catalogue/entries/${entryId}`,
            )
          ).json()
        ).revision;
      };
      const category = await publishCatalogue("category", "blouse");
      await publishCatalogue("service", "blouse-stitching", {
        parent: {
          entryId: category.entryId,
          revisionId: category.definition.id,
        },
      });
      await page.goto(`${origin}/settings?section=measurementForms`);
      await expect(
        page.getByRole("heading", { name: en.title, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: en.addKind.replace("{kind}", en["measurement-form"]),
          exact: true,
        })
        .click();
      const editor = () => page.locator(".directory-editor");
      await editor().getByLabel(en.code, { exact: true }).fill("blouse-body");
      await editor()
        .locator("#measurementForms-labelEn")
        .fill("SYNTHETIC blouse form");
      await editor()
        .getByLabel(en.labelTa, { exact: true })
        .fill("செயற்கை ரவிக்கை அளவுகள்");
      const service = editor().getByRole("group", {
        name: en.service,
        exact: true,
      });
      await service
        .getByRole("button", { name: en.searchReferences, exact: true })
        .click();
      await service
        .getByRole("button", { name: en.select, exact: true })
        .click();
      await editor()
        .getByLabel(en.decision, { exact: true })
        .selectOption("required");
      await editor()
        .getByRole("button", { name: en.addGroup, exact: true })
        .click();
      const group = editor().getByRole("group", {
        name: `${en.group} 1`,
        exact: true,
      });
      await group.getByLabel(en.labelEn, { exact: true }).fill("Body");
      await group.getByLabel(en.labelTa, { exact: true }).fill("உடல்");
      await group
        .getByRole("button", { name: en.addField, exact: true })
        .click();
      const field = () =>
        editor().getByRole("group", { name: `${en.field} 1`, exact: true });
      await field().getByLabel(en.key, { exact: true }).fill("length");
      await field()
        .getByLabel(en.meaning, { exact: true })
        .fill("Shoulder to body hem length");
      await field().getByLabel(en.labelEn, { exact: true }).fill("Length");
      await field()
        .getByLabel(en.labelTa, { exact: true })
        .dispatchEvent("compositionstart");
      await field().getByLabel(en.labelTa, { exact: true }).fill("நீளம்");
      await field()
        .getByLabel(en.labelTa, { exact: true })
        .dispatchEvent("compositionend");
      await field().getByLabel(en.in, { exact: true }).check();
      await field()
        .getByLabel(en.defaultUnit, { exact: true })
        .selectOption("in");
      await field()
        .getByLabel(en.fieldRequired, { exact: true })
        .selectOption("true");
      await expect(
        editor().getByRole("button", { name: en.review, exact: true }),
      ).toBeDisabled();
      await field()
        .getByLabel(en.precisionUnit, { exact: true })
        .selectOption("in");
      await field().getByLabel(en.increment, { exact: true }).fill("0.25");
      await field()
        .getByLabel(en.precisionReview, { exact: true })
        .fill("SYNTHETIC explicit precision decision");
      await editor()
        .getByLabel(en.reason, { exact: true })
        .fill("SYNTHETIC form review");
      await editor().getByLabel(en.available, { exact: true }).check();
      // Real committed response loss: retry uses the identical key.
      let lost = false;
      const keys = [];
      await page.route("**/api/shops/*/drafts/*", async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        keys.push(route.request().headers()["idempotency-key"]);
        if (!lost) {
          lost = true;
          expect((await route.fetch()).status()).toBe(200);
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
        editor()
          .getByText(en.saved, { exact: true })
          .or(editor().getByText(en.rateLimited, { exact: true })),
      ).toBeVisible();
      if (
        await editor().getByText(en.rateLimited, { exact: true }).isVisible()
      ) {
        await page.waitForTimeout(60000);
        await editor()
          .getByRole("button", { name: en.retry, exact: true })
          .click();
      }
      await expect(editor().getByText(en.saved, { exact: true })).toBeVisible();
      expect(keys[0]).toBe(keys[1]);
      await page.unroute("**/api/shops/*/drafts/*");
      await page.reload();
      await expect(editor().getByLabel(en.code, { exact: true })).toHaveValue(
        "blouse-body",
      );
      // Reorder groups using the keyboard and keep field identity in the recovered payload.
      await editor()
        .getByRole("button", { name: en.addGroup, exact: true })
        .click();
      const second = editor().getByRole("group", {
        name: `${en.group} 2`,
        exact: true,
      });
      await second.getByRole("button", { name: en.up, exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(
        editor()
          .getByRole("group", { name: `${en.group} 2`, exact: true })
          .getByLabel(en.labelEn, { exact: true })
          .first(),
      ).toHaveValue("Body");
      await editor()
        .getByRole("group", { name: `${en.group} 1`, exact: true })
        .getByRole("button", { name: en.remove, exact: true })
        .click();
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const t = measurementFormsMessages[locale];
        await expect(
          page.getByRole("heading", { name: t.title, exact: true }),
        ).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await mkdir(".scratch/measurement-forms-captures", { recursive: true });
        await page.screenshot({
          path: `.scratch/measurement-forms-captures/${info.project.name}-${locale}.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
      await editor()
        .getByRole("button", { name: en.save, exact: true })
        .click();
      await expect(
        editor()
          .getByText(en.saved, { exact: true })
          .or(editor().getByText(en.rateLimited, { exact: true })),
      ).toBeVisible();
      if (
        await editor().getByText(en.rateLimited, { exact: true }).isVisible()
      ) {
        await page.waitForTimeout(60000);
        await editor()
          .getByRole("button", { name: en.retry, exact: true })
          .click();
      }
      await expect(editor().getByText(en.saved, { exact: true })).toBeVisible();
      await editor()
        .getByRole("button", { name: en.review, exact: true })
        .click();
      await expect(
        editor().getByText(en.manual, { exact: true }).first(),
      ).toBeVisible();
      await editor()
        .getByRole("button", { name: en.publish, exact: true })
        .click();
      await expect(
        editor().getByText(en.readOnly, { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: en.detail, exact: true }).click();
      await page.getByRole("button", { name: en.history, exact: true }).click();
      await expect(page.locator(".shop-profile-history")).toContainText("நீளம்");
      await page.getByRole("button", { name: en.edit, exact: true }).click();
      await editor()
        .locator("#measurementForms-labelEn")
        .fill("SYNTHETIC draft conflict");
      await editor()
        .getByRole("button", { name: en.save, exact: true })
        .click();
      await expect(
        editor()
          .getByText(en.saved, { exact: true })
          .or(editor().getByText(en.rateLimited, { exact: true })),
      ).toBeVisible();
      if (
        await editor().getByText(en.rateLimited, { exact: true }).isVisible()
      ) {
        await page.waitForTimeout(60000);
        await editor()
          .getByRole("button", { name: en.save, exact: true })
          .click();
      }
      await expect(editor().getByText(en.saved, { exact: true })).toBeVisible();
      const draftId = new URL(page.url()).searchParams.get("draft");
      const draft = await (
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
            workflow: "measurement.forms",
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
        .locator("#measurementForms-labelEn")
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
        editor().getByText("SYNTHETIC other session", { exact: true }),
      ).toBeVisible();
      await editor()
        .getByRole("button", { name: en.keepLocal, exact: true })
        .click();
      const cancel = () =>
        page.getByRole("button", { name: en.cancel, exact: true }).click();
      page.once("dialog", (d) => d.dismiss());
      await cancel();
      await expect(editor()).toBeVisible();
      page.once("dialog", (d) => d.accept());
      await cancel();
      await expect(editor()).toHaveCount(0);
      await expectStaticPwaStorage(page);
      expect((await post("/auth/sign-out", {})).status()).toBe(200);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: en.title, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("SYNTHETIC local changes", { exact: true }),
      ).toHaveCount(0);
    },
    { secrets: [password] },
  );
});
