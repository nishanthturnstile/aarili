import { mkdir } from "node:fs/promises";
import {
  designReferenceMessages,
  designSpecificationMessages,
  draftMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  designOk,
  designRequest,
  publishDesign,
  revisedDesign,
} from "../../scripts/test-support/design-choices-fixtures.mjs";
import {
  publishSpecification,
  specificationDraft,
  specificationSources,
} from "../../scripts/test-support/design-specification-fixtures.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("DS-A2-01–08 owner exact piece versions, save-only, selection, recovery, IME and bilingual theme/axe matrix", async ({
  page,
}, info) => {
  test.setTimeout(420000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  await withOwnerWeb(
    async ({
      origin,
      setupToken,
      code,
      seedCommand,
      runtime,
      revokeWearerAuthority,
    }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-design-specification-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC Design owner",
              email: "design-spec@example.test",
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
            email: "design-spec@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC Design specifications" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const cookie = (await page.context().cookies(origin))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      const fixture = {
        a: { shop: shopId, cookie },
        owner: { origin },
        api: { fetch: seedCommand },
      };
      const seed = await seedQuickOrder(runtime, shopId);
      try {
        const s = await specificationSources(fixture, {
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          }),
          { order, pieces } = await s.accept(),
          pieceId = pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id;
        const v = specificationDraft(order.id, pieceId, s.profile);
        await publishSpecification(fixture, v);
        const source = await s.accept(),
          sourcePiece = source.pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id;
        await publishSpecification(
          fixture,
          specificationDraft(source.order.id, sourcePiece, s.profile),
        );
        await page.goto(`${origin}/orders?order=${order.id}`);
        await prepareOwnerScreen(page, "en", false);
        const en = designSpecificationMessages.en;
        const screen = () =>
          page.getByRole("region", { name: en.title, exact: true });
        await screen()
          .getByLabel(en.scope, { exact: true })
          .selectOption(pieceId);
        await expect(
          screen().getByText(`${en.scopeRevision} 1`, { exact: false }),
        ).toBeVisible();
        const saved = () =>
          screen()
            .locator("details")
            .filter({ has: page.locator("summary", { hasText: /^v1/ }) })
            .first();
        await saved().locator("summary").click();
        await saved()
          .getByRole("button", { name: en.revise, exact: true })
          .click();
        const editor = () => screen().locator(".directory-editor");
        for (const key of [
          "neck-type",
          "neck-design",
          "sleeve-type",
          "sleeve-design",
        ])
          await expect(
            editor().getByRole("group", {
              name: `SYNTHETIC ${key}`,
              exact: true,
            }),
          ).toBeVisible();
        const reason = editor().getByLabel(en.reason, { exact: true });
        await reason.dispatchEvent("compositionstart");
        await reason.fill("SYNTHETIC தமிழ் பதிப்பு 2");
        await reason.dispatchEvent("compositionend");
        await reason.press("Tab");
        await expect(editor().locator("#design-save-mode")).toBeFocused();
        await page.keyboard.press("End");
        await page.keyboard.press("Home");
        let dropped = false;
        const lost = async (route) => {
          if (!dropped) {
            const r = route.request();
            const response = await seedCommand(
              new Request(r.url(), {
                method: r.method(),
                headers: r.headers(),
                body: r.postData(),
              }),
            );
            if (response.status === 200) {
              dropped = true;
              await route.abort("failed");
              return;
            }
            throw Error(
              `Synthetic committed promotion failed (${response.status})`,
            );
          }
          await route.continue();
        };
        await page.route("**/drafts/*/promote", lost);
        await editor()
          .getByRole("button", { name: en.saveOnly, exact: true })
          .click();
        await expect(
          editor().getByRole("button", {
            name: draftMessages.en.retry,
            exact: true,
          }),
        ).toBeVisible();
        await editor()
          .getByRole("button", { name: draftMessages.en.retry, exact: true })
          .click();
        await page.unroute("**/drafts/*/promote", lost);
        expect(dropped).toBe(true);
        await expect(
          screen().locator("summary").filter({ hasText: /^v2/ }),
        ).toBeVisible();
        await expect(
          screen().getByText(`${en.current}: v1`, { exact: false }),
        ).toBeVisible();
        await screen()
          .getByRole("button", { name: en.close, exact: true })
          .click();
        const v2 = screen()
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: /^v2/ }) })
          .first();
        await v2.locator("summary").click();
        await v2.getByRole("button", { name: en.select, exact: true }).click();
        await editor()
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC deliberately use v2");
        await editor()
          .getByRole("button", { name: en.select, exact: true })
          .click();
        await expect(
          screen().getByText(`${en.current}: v2`, { exact: false }),
        ).toBeVisible();
        await screen()
          .getByRole("button", { name: en.close, exact: true })
          .click();
        // A reload reopens exact saved versions, while a new unfinished draft recovers separately.
        await v2.getByRole("button", { name: en.revise, exact: true }).click();
        await editor()
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC recoverable draft");
        await expect(
          editor().getByRole("button", { name: en.saveOnly, exact: true }),
        ).toBeEnabled();
        page.once("dialog", (d) => d.accept());
        await page.reload();
        await prepareOwnerScreen(page, "en", false);
        await screen()
          .getByLabel(en.scope, { exact: true })
          .selectOption(pieceId);
        await screen()
          .getByRole("button", { name: new RegExp(`^${en.resume}`) })
          .click();
        await expect(
          editor().getByLabel(en.reason, { exact: true }),
        ).toHaveValue("SYNTHETIC recoverable draft");
        const current = await designRequest(
          fixture,
          "design-specifications/list",
          { method: "POST", body: { orderId: order.id, pieceId } },
        ).then(designOk);
        await publishSpecification(fixture, {
          ...v,
          baseVersion: current.version,
          baseSavedId: current.latestSavedId,
          use: false,
          reason: "SYNTHETIC concurrent version",
        });
        await editor()
          .getByRole("button", { name: en.saveOnly, exact: true })
          .click();
        await expect(editor().getByRole("alert")).toBeVisible();
        await expect(
          editor().getByLabel(en.reason, { exact: true }),
        ).toHaveValue("SYNTHETIC recoverable draft");
        for (const [locale, dark] of [
          ["en", false],
          ["en", true],
          ["ta", false],
          ["ta", true],
        ]) {
          await prepareOwnerScreen(page, locale, dark);
          const t = designSpecificationMessages[locale],
            region = page.getByRole("region", { name: t.title, exact: true });
          await expect(
            region.getByText(t.approval, { exact: true }).first(),
          ).toBeVisible();
          await expect(
            region.getByRole("region", {
              name: designReferenceMessages[locale].source,
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          const axe = await new AxeBuilder({ page })
            .include(`section[aria-label="${t.title}"]`)
            .analyze();
          expect(axe.violations).toEqual([]);
          await mkdir(".scratch/design-specifications-ui", { recursive: true });
          await region.screenshot({
            path: `.scratch/design-specifications-ui/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
          });
        }
        await prepareOwnerScreen(page, "en", false);
        await screen()
          .getByRole("button", { name: en.close, exact: true })
          .click();
        await publishDesign(
          fixture,
          revisedDesign(s.choices[0], {
            operation: "availability",
            available: false,
          }),
        );
        await screen()
          .getByRole("button", { name: en.refresh, exact: true })
          .click();
        await screen()
          .getByLabel(en.profile, { exact: true })
          .selectOption(s.profile.definition.id);
        const reuse = screen()
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: en.reused }) });
        await reuse.locator("summary").click();
        await reuse
          .getByRole("button", { name: en.source, exact: true })
          .click();
        await reuse
          .getByLabel(en.source, { exact: true })
          .selectOption(source.order.id);
        const originalSource = await designRequest(
          fixture,
          "design-specifications/list",
          {
            method: "POST",
            body: { orderId: source.order.id, pieceId: sourcePiece },
          },
        ).then(designOk);
        await reuse
          .getByLabel(en.sourceVersion, { exact: true })
          .selectOption(originalSource.latestSavedId);
        await reuse
          .getByRole("checkbox", { name: "SYNTHETIC neck-type", exact: true })
          .check();
        await reuse
          .getByRole("button", { name: en.reuse, exact: true })
          .click();
        await expect(screen().getByRole("alert")).toHaveText(en.unavailable);
        expect(new URL(page.url()).searchParams.has("design")).toBe(false);
        expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual(
          [],
        );
        expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
          "aarili-appearance",
        ]);
        await expectStaticPwaStorage(page);
        await revokeWearerAuthority(seed.wearer.wearerId);
        await screen()
          .getByRole("button", { name: en.refresh, exact: true })
          .click();
        await expect(
          page.getByText("SYNTHETIC instruction", { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator(".directory-editor")).toHaveCount(0);
      } finally {
        await seed.close();
      }
    },
  );
});
