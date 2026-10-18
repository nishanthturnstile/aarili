import { mkdir } from "node:fs/promises";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { serviceCatalogueMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("ST-01/07/10/11/12 catalogue authoring, exact recovery, availability/history and bilingual owner flow", async ({
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
      const en = serviceCatalogueMessages.en;
      const capture = async (options) => {
        await mkdir(".scratch/service-catalogue-captures", { recursive: true });
        await page.evaluate(async () => {
          window.scrollTo(0, 0);
          await new Promise(requestAnimationFrame);
        });
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await page.screenshot({ ...options, animations: "disabled" });
      };
      const heading = () => page.locator(".directory-editor > h3");
      const editor = () => page.locator(".directory-editor");
      const save = async (t = en) => {
        await editor()
          .getByRole("button", { name: t.save, exact: true })
          .click();
        const saved = editor().getByText(t.saved, { exact: true }),
          limited = editor().getByText(t.rateLimited, { exact: true });
        await expect(saved.or(limited)).toBeVisible();
        if (await limited.isVisible()) {
          await page.waitForTimeout(60100);
          await editor()
            .getByRole("button", { name: t.save, exact: true })
            .click();
        }
        await expect(saved).toBeVisible();
      };
      const publish = async (t = en) => {
        await save(t);
        await editor()
          .getByRole("button", { name: t.review, exact: true })
          .click();
        await editor()
          .getByRole("button", { name: t.publish, exact: true })
          .click();
        const promoted = editor().getByText(t.promoted, { exact: true }),
          limited = editor().getByText(t.rateLimited, { exact: true });
        await expect(promoted.or(limited)).toBeVisible();
        if (await limited.isVisible()) {
          await page.waitForTimeout(60100);
          await editor()
            .getByRole("button", { name: t.publish, exact: true })
            .click();
        }
        await expect(promoted).toBeVisible();
      };
      const close = async (t = en) => {
        await page.getByRole("button", { name: t.cancel, exact: true }).click();
      };
      const fill = async (code, label) => {
        await page.getByLabel(en.code, { exact: true }).fill(code);
        await page.getByLabel(en.labelEn, { exact: true }).fill(label);
        await page
          .getByLabel(en.labelTa, { exact: true })
          .fill("செயற்கை ரவிக்கை");
        await page
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC owner review");
        await page.getByLabel(en.available, { exact: true }).check();
      };
      await page.goto(`${origin}/settings?section=catalogue`);
      await expect(
        page.getByRole("heading", { name: en.title, exact: true }),
      ).toBeVisible();
      await expect(page.getByText(en.empty, { exact: true })).toBeVisible();
      await page
        .getByRole("button", {
          name: en.addKind.replace("{kind}", en.category),
          exact: true,
        })
        .click();
      await expect(heading()).toBeFocused();
      await fill("blouse", "SYNTHETIC blouse");
      await save();
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        await expect(
          page.getByText(serviceCatalogueMessages[locale].warningHint, {
            exact: true,
          }),
        ).toBeVisible();
        await capture({
          path: `.scratch/service-catalogue-captures/${info.project.name}-${locale}-category.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
      // Lose a real committed save response; retry must preserve the original key.
      let dropped = false;
      const keys = [];
      await page.route("**/api/shops/*/drafts/*", async (route) => {
        const req = route.request();
        if (req.method() !== "PUT") return route.continue();
        keys.push(req.headers()["idempotency-key"]);
        if (!dropped) {
          dropped = true;
          const committed = await route.fetch();
          expect(committed.status()).toBe(200);
          await route.abort("failed");
        } else await route.continue();
      });
      await page
        .getByLabel(en.description, { exact: true })
        .fill("SYNTHETIC edit for committed lost-response recovery");
      await editor()
        .getByRole("button", { name: en.save, exact: true })
        .click();
      await expect(
        editor().getByRole("button", { name: en.retry, exact: true }),
      ).toBeVisible();
      expect(dropped).toBe(true);
      await editor()
        .getByRole("button", { name: en.retry, exact: true })
        .click();
      await expect(editor().getByText(en.saved, { exact: true })).toBeVisible();
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(new Set(keys).size).toBe(1);
      await page.unroute("**/api/shops/*/drafts/*");
      const resumed = page.url();
      expect(resumed).toContain("draft=");
      await page.reload();
      await expect(page.getByLabel(en.labelEn, { exact: true })).toHaveValue(
        "SYNTHETIC blouse",
      );
      await publish();
      await close();
      const list = await (
        await post(`${api}/settings/catalogue/list`, {})
      ).json();
      const category = list.entries.find(
        (r) => r.definition.content.code === "blouse",
      );
      expect(category.configurationEligible).toBe(true);
      // Distinct immutable piece/add-on definitions exercise real relation selectors.
      const seed = async (kind, stableCode) => {
        const draft = crypto.randomUUID();
        const draftId = `${draft.slice(0, 14)}7${draft.slice(15)}`;
        const seedKey = crypto.randomUUID();
        const r = await admitted(() =>
          page.request.put(`${origin}/api${api}/drafts/${draftId}`, {
            data: {
              workflow: "service.catalogue",
              schemaVersion: 1,
              payload: {
                entryId: crypto.randomUUID(),
                baseVersion: 0,
                baseRevisionId: null,
                operation: "definition",
                available: true,
                reason: "SYNTHETIC review",
                content: {
                  ...emptyCatalogueContent(kind),
                  code: stableCode,
                  labelEn: `SYNTHETIC ${stableCode}`,
                  labelTa: "செயற்கை பகுதி",
                },
              },
            },
            headers: { Origin: origin, "Idempotency-Key": seedKey },
          }),
        );
        expect(r.status()).toBe(200);
        expect(
          (
            await post(
              `${api}/drafts/${draftId}/promote`,
              {},
              { "Idempotency-Key": crypto.randomUUID(), "If-Match": '"v1"' },
            )
          ).status(),
        ).toBe(200);
      };
      await seed("piece", "top");
      await seed("addon", "pico");
      await page
        .getByRole("button", {
          name: en.addKind.replace("{kind}", en.service),
          exact: true,
        })
        .click();
      await fill("salwar-stitching", "SYNTHETIC salwar");
      await page.getByLabel(en.labelTa, { exact: true }).fill("செயற்கை சல்வார்");
      for (const [role, term] of [
        ["parent", "blouse"],
        ["pieces", "top"],
        ["addons", "pico"],
      ]) {
        const group = editor().getByRole("group", {
          name: en[role],
          exact: true,
        });
        await group.getByLabel(en.searchReferences, { exact: true }).fill(term);
        await group
          .getByRole("button", { name: en.search, exact: true })
          .click();
        await group
          .getByRole("checkbox", { name: `SYNTHETIC ${term}`, exact: true })
          .check();
      }
      await editor()
        .getByRole("group", { name: en.addons, exact: true })
        .getByLabel(en.optional, { exact: true })
        .check();
      await mkdir(".scratch/service-catalogue-captures", { recursive: true });
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const t = serviceCatalogueMessages[locale];
        await expect(
          editor()
            .getByRole("group", { name: t.parent, exact: true })
            .locator("ol"),
        ).toContainText(
          locale === "ta"
            ? category.definition.content.labelTa
            : category.definition.content.labelEn,
        );
        const parentSelection = editor()
          .getByRole("group", { name: t.parent, exact: true })
          .locator("ol");
        if (
          !(await parentSelection.locator("details").evaluate((el) => el.open))
        )
          await parentSelection.locator("summary").click();
        await expect(
          parentSelection.getByText(category.definition.id, { exact: true }),
        ).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await capture({
          path: `.scratch/service-catalogue-captures/${info.project.name}-${locale}-composition.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
      await publish();
      await close();
      // Reopen category and publish availability only; the underlying definition is exact.
      await page
        .getByRole("button", { name: en.search, exact: true })
        .first()
        .click();
      const categoryRow = () =>
        page.locator(".directory-list > li").filter({
          has: page.getByRole("heading", {
            name: "SYNTHETIC blouse",
            exact: true,
          }),
        });
      await categoryRow()
        .getByRole("button", { name: en.detail, exact: true })
        .click();
      await page
        .getByRole("button", { name: en.availability, exact: true })
        .click();
      await expect(page.getByLabel(en.code, { exact: true })).toBeDisabled();
      await page
        .getByLabel(en.reason, { exact: true })
        .fill("SYNTHETIC temporarily unavailable");
      await publish();
      await close();
      // Read uses the typed endpoint's GET contract.
      const disabled = await (
        await page.request.get(
          `${origin}/api${api}/settings/catalogue/entries/${category.entryId}`,
        )
      ).json();
      expect(disabled.revision.available).toBe(false);
      expect(disabled.revision.definition).toEqual(category.definition);
      for (const locale of ["en", "ta"]) {
        await page.reload();
        const t = serviceCatalogueMessages[locale];
        await prepareOwnerScreen(page, locale);
        await page.getByLabel(t.search, { exact: true }).fill("ravikkai");
        await page
          .getByRole("button", { name: t.search, exact: true })
          .first()
          .click();
        await expect(page.locator(".directory-list > li")).toHaveCount(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await mkdir(".scratch/service-catalogue-captures", { recursive: true });
        await capture({
          path: `.scratch/service-catalogue-captures/${info.project.name}-${locale}-list.png`,
          fullPage: true,
        });
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page
          .locator(".directory-list > li")
          .getByRole("button", { name: t.detail, exact: true })
          .click();
        await page
          .getByRole("button", { name: t.history, exact: true })
          .click();
        const history = page.getByRole("region", {
          name: t.history,
          exact: true,
        });
        await history.locator("details").last().locator("summary").click();
        await expect(history).toContainText("SYNTHETIC blouse");
        await expect(
          history
            .locator("details[open]")
            .getByText(t.noCategoryOverride, { exact: true }),
        ).toBeVisible();
        await capture({
          path: `.scratch/service-catalogue-captures/${info.project.name}-${locale}-history.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
      await page
        .getByRole("button", {
          name: en.addKind.replace("{kind}", en.piece),
          exact: true,
        })
        .click();
      await page
        .getByLabel(en.labelTa, { exact: true })
        .dispatchEvent("compositionstart");
      await page.getByLabel(en.labelTa, { exact: true }).fill("தமிழ் செயற்கை");
      await page
        .getByLabel(en.labelTa, { exact: true })
        .dispatchEvent("compositionend");
      await save();
      await capture({
        path: `.scratch/service-catalogue-captures/${info.project.name}-en-editor.png`,
        fullPage: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await prepareOwnerScreen(page, "ta");
      await expect(
        page.getByLabel(serviceCatalogueMessages.ta.labelTa, { exact: true }),
      ).not.toHaveValue("");
      await capture({
        path: `.scratch/service-catalogue-captures/${info.project.name}-ta-editor.png`,
        fullPage: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await prepareOwnerScreen(page, "en");
      // A second session saves this draft first. No automatic merge of the owner's work.
      const draftId = new URL(page.url()).searchParams.get("draft");
      const server = await (
        await page.request.get(`${origin}/api${api}/drafts/${draftId}`)
      ).json();
      const changed = structuredClone(server.payload);
      changed.content.labelEn = "SYNTHETIC other session";
      changed.available = true;
      changed.reason = "SYNTHETIC other-session reason";
      const changedKey = crypto.randomUUID();
      expect(
        (
          await admitted(() =>
            page.request.put(`${origin}/api${api}/drafts/${draftId}`, {
              data: {
                workflow: "service.catalogue",
                schemaVersion: 1,
                payload: changed,
              },
              headers: {
                Origin: origin,
                "Idempotency-Key": changedKey,
                "If-Match": `"v${server.version}"`,
              },
            }),
          )
        ).status(),
      ).toBe(200);
      await page
        .getByLabel(en.labelEn, { exact: true })
        .fill("SYNTHETIC local changes");
      await editor()
        .getByRole("button", { name: en.save, exact: true })
        .click();
      const conflict = editor().getByRole("heading", {
        name: en.conflict,
        exact: true,
      });
      const limited = editor().getByText(en.rateLimited, { exact: true });
      await expect(conflict.or(limited)).toBeVisible();
      if (await limited.isVisible()) {
        await page.waitForTimeout(60100);
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
      await expect(
        editor().getByText("SYNTHETIC other-session reason", { exact: false }),
      ).toBeVisible();
      await expect(
        editor().getByText(`${en.enabled} - SYNTHETIC other-session reason`, {
          exact: true,
        }),
      ).toBeVisible();
      await capture({
        path: `.scratch/service-catalogue-captures/${info.project.name}-en-conflict.png`,
        fullPage: true,
      });
      await editor()
        .getByRole("button", { name: en.keepLocal, exact: true })
        .click();
      await expect(page.getByLabel(en.labelEn, { exact: true })).toHaveValue(
        "SYNTHETIC local changes",
      );
      page.once("dialog", (dialog) => dialog.dismiss());
      await close();
      await expect(editor()).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await close();
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
