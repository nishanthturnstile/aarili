import { mkdir } from "node:fs/promises";
import {
  draftMessages,
  measurementSessionMessages,
  repeatOrderMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  designOk,
  designRequest,
} from "../../scripts/test-support/design-choices-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSelectionDraft,
  measurementSources,
  publishMeasurement,
} from "../../scripts/test-support/measurement-session-fixtures.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("MV-B01/03/05/08 correct V1 to V2, preserve O1, compare and explicitly reuse for O2 in English/Tamil with keyboard/axe", async ({
  page,
}, info) => {
  test.setTimeout(480000);
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
      const email = "measurement-history@example.test",
        password = "synthetic-measurement-history-password";
      expect(
        (
          await post(
            "/owner/setup",
            { name: "SYNTHETIC history owner", email, password },
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
        (await post("/auth/sign-in/email", { email, password })).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC measurement history" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const f = {
        a: {
          shop: shopId,
          cookie: (await page.context().cookies(origin))
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        },
        owner: { origin },
        api: { fetch: seedCommand },
      };
      const seed = await seedQuickOrder(runtime, shopId);
      try {
        const identity = {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        };
        const s = await measurementSources(f, identity),
          form = s.forms[0],
          approval = await approveMeasurementForm(f, form),
          input = measurementDraft(identity, form, approval);
        input.values[1] = { ...input.values[1], rawText: "", unit: null };
        const saved = await publishMeasurement(f, input);
        const v1 = await designRequest(
          f,
          `measurements/versions/${saved.result.draft.result.id}`,
        ).then(designOk);
        const o1 = await s.accept(),
          o2 = await s.accept();
        const piece = (a) =>
          a.pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id;
        await publishMeasurement(
          f,
          measurementSelectionDraft(v1, {
            orderId: o1.order.id,
            pieceId: piece(o1),
          }),
        );
        let until = 0;
        page.on("response", (r) => {
          if (r.status() === 429)
            until = Math.max(
              until,
              Date.now() +
                Number(r.headers()["retry-after"] ?? 60) * 1000 +
                150,
            );
        });
        const region = (t) =>
          page.getByRole("region", { name: t.title, exact: true });
        const settle = async (t, name = t.save, locale = "en") => {
          const editor = region(t).locator(".directory-editor"),
            deadline = Date.now() + 180000;
          while (Date.now() < deadline) {
            if (Date.now() < until) {
              await page.waitForTimeout(Math.min(1000, until - Date.now()));
              continue;
            }
            const retry = editor.getByRole("button", {
              name: draftMessages[locale].retry,
              exact: true,
            });
            if ((await retry.isVisible()) && (await retry.isEnabled()))
              await retry.click();
            const button = editor.getByRole("button", {
              name,
              exact: true,
            });
            if (await button.isEnabled()) return button;
            await page.waitForTimeout(100);
          }
          throw Error("Measurement correction did not settle");
        };
        const promoteExpected = async (
          t,
          name,
          expected = 200,
          locale = "en",
        ) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            const button = await settle(t, name, locale);
            while (Date.now() < until)
              await page.waitForTimeout(Math.min(1000, until - Date.now()));
            const response = page.waitForResponse(
              (r) =>
                r.url().endsWith("/promote") && r.request().method() === "POST",
            );
            await button.click();
            const r = await response;
            if (r.status() === 429) continue;
            expect(r.status(), await r.text()).toBe(expected);
            return;
          }
          throw Error("Measurement command admission did not recover");
        };
        const open = async (order, t, locale) => {
          await page.goto(`${origin}/orders?order=${order.order.id}`);
          await prepareOwnerScreen(page, locale, locale === "ta");
          await region(t)
            .getByRole("button", { name: t.title, exact: true })
            .click();
          await region(t)
            .getByLabel(t.piece, { exact: true })
            .selectOption(piece(order));
          await expect(
            region(t).getByText(
              order === o1 ? `${t.selected}: ${v1.id.slice(-8)}` : t.unselected,
              { exact: true },
            ),
          ).toBeVisible();
        };
        const en = measurementSessionMessages.en;
        await open(o1, en, "en");
        const original = region(en)
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: /Version 1/ }) })
          .first();
        await original.locator("summary").click();
        await original
          .getByRole("button", { name: en.correct, exact: true })
          .click();
        const editor = region(en).locator(".directory-editor"),
          field = form.definition.content.groups[0].fields[0];
        await expect(
          editor.getByLabel(en.date, { exact: true }),
        ).toHaveAttribute("readonly", "");
        await editor.locator(`#measurement-${field.id}-raw`).fill("12 1/2");
        await expect(
          editor.getByRole("region", { name: en.compare, exact: true }),
        ).toContainText("12 1/4");
        await editor
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC corrected transcription; source date unchanged");
        await editor
          .getByRole("checkbox", { name: en.review, exact: true })
          .check();
        const button = await settle(en),
          response = page.waitForResponse(
            (r) =>
              r.url().endsWith("/promote") && r.request().method() === "POST",
          );
        await button.click();
        expect((await response).status()).toBe(200);
        await expect(
          editor.getByText(draftMessages.en.promoted, { exact: true }),
        ).toBeVisible();
        await region(en)
          .getByRole("button", { name: en.close, exact: true })
          .click();
        await expect(
          region(en).getByText(`${en.selected}: ${v1.id.slice(-8)}`, {
            exact: true,
          }),
        ).toBeVisible();
        const v2 = (
          await designRequest(f, "measurements/list", {
            method: "POST",
            body: identity,
          }).then(designOk)
        ).versions.find((v) => v.version === 2);
        expect(v2.previousId).toBe(v1.id);
        expect(v2.values[0].rawText).toBe("12 1/2");
        // A competing correction never merges with the entered draft. The owner
        // compares the committed head and can still deliberately reuse V2 later.
        const correction = region(en)
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: /Version 2/ }) })
          .first();
        await correction.locator("summary").click();
        await correction
          .getByRole("button", { name: en.correct, exact: true })
          .click();
        await editor.locator(`#measurement-${field.id}-raw`).fill("12 3/4");
        await editor
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC competing correction draft");
        await editor
          .getByRole("checkbox", { name: en.review, exact: true })
          .check();
        await settle(en);
        await publishMeasurement(f, {
          ...input,
          correctionId: v2.id,
          values: input.values.map((v, i) =>
            i === 0 ? { ...v, rawText: "13" } : v,
          ),
          reason: "SYNTHETIC separately committed correction",
        });
        await promoteExpected(en, en.save, 412);
        await expect(
          editor.locator(`#measurement-${field.id}-raw`),
        ).toHaveValue("12 3/4");
        await expect(
          editor.getByText(en.conflictHelp, { exact: true }),
        ).toBeVisible();
        await region(en)
          .getByRole("button", { name: en.retry, exact: true })
          .click();
        await expect(
          region(en).getByText(en.currentHead, { exact: true }),
        ).toBeVisible();
        await region(en)
          .getByRole("button", { name: en.close, exact: true })
          .click();
        await expect(
          region(en).getByText(`${en.selected}: ${v1.id.slice(-8)}`, {
            exact: true,
          }),
        ).toBeVisible();
        for (const locale of ["en", "ta"]) {
          const t = measurementSessionMessages[locale];
          await open(o2, t, locale);
          const version = region(t)
            .locator("details")
            .filter({
              has: page.locator("summary", {
                hasText: new RegExp(`${t.version} 2`),
              }),
            })
            .first();
          await version.locator("summary").click();
          await version
            .getByRole("button", { name: t.reuse, exact: true })
            .click();
          const comparison = region(t).getByRole("region", {
            name: t.compare,
            exact: true,
          });
          await comparison
            .getByRole("button", { name: t.inspect, exact: true })
            .focus();
          await page.keyboard.press("Enter");
          await expect(
            comparison.getByText(t.blockedReuse, { exact: true }),
          ).toBeVisible();
          await comparison
            .getByLabel(t.physical, { exact: true })
            .selectOption("not-started");
          await comparison
            .getByLabel(t.commercial, { exact: true })
            .selectOption("none");
          await comparison
            .getByRole("button", { name: t.inspect, exact: true })
            .click();
          await expect(
            comparison.getByRole("button", { name: t.select, exact: true }),
          ).toBeVisible();
          await expect(comparison).toContainText("12 1/2");
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
          await mkdir(".scratch/measurement-history-captures", {
            recursive: true,
          });
          await page.screenshot({
            path: `.scratch/measurement-history-captures/${info.project.name}-${locale}.png`,
            fullPage: true,
          });
          await comparison
            .getByRole("button", { name: t.select, exact: true })
            .click();
          const selectionEditor = region(t).locator(".directory-editor");
          await selectionEditor
            .getByLabel(t.reason, { exact: true })
            .fill("SYNTHETIC reviewed new garment suitability");
          await selectionEditor
            .getByRole("checkbox", { name: t.review, exact: true })
            .check();
          await promoteExpected(t, t.select, 200, locale);
          await expect(
            selectionEditor.getByText(draftMessages[locale].promoted, {
              exact: true,
            }),
          ).toBeVisible();
          await region(t)
            .getByRole("button", { name: t.close, exact: true })
            .click();
          const repeat = repeatOrderMessages[locale],
            repeatRegion = page.getByRole("region", {
              name: repeat.title,
              exact: true,
            });
          await repeatRegion
            .getByRole("button", { name: repeat.inspect, exact: true })
            .click();
          await repeatRegion
            .getByLabel(repeat.measurement, { exact: true })
            .selectOption(`${v2.id}:${piece(o2)}`);
          await expect(repeatRegion).toContainText("12 1/2");
          await repeatRegion
            .getByRole("checkbox", {
              name: repeat.measurementReview,
              exact: true,
            })
            .check();
          let draft;
          for (let attempt = 0; attempt < 3; attempt++) {
            while (Date.now() < until)
              await page.waitForTimeout(Math.min(1000, until - Date.now()));
            const result = page.waitForResponse(
              (r) =>
                r.url().endsWith("/repeat/create") &&
                r.request().method() === "POST",
            );
            await repeatRegion
              .getByRole("button", {
                name: attempt ? repeat.retry : repeat.create,
                exact: true,
              })
              .first()
              .click();
            const response = await result;
            if (response.status() === 429) continue;
            expect(response.status(), await response.text()).toBe(200);
            draft = await response.json();
            break;
          }
          expect(draft.draft.schemaVersion).toBe(2);
          expect(draft.draft.payload.measurementReuse.selectedId).toBe(v2.id);
          await expect(
            page.getByRole("heading", { name: repeat.newOrder, exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText(
              `${repeat.measurement}: ${v2.id.slice(-8)}. ${repeat.measurementHelp}`,
              { exact: true },
            ),
          ).toBeVisible();
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          const next = await s.accept();
          o2.order = next.order;
          o2.pieces = next.pieces;
        }
        await revokeWearerAuthority(identity.wearerId);
        await page.reload();
        const ta = measurementSessionMessages.ta;
        await prepareOwnerScreen(page, "ta", true);
        const measurements = region(ta);
        if (await measurements.isVisible()) {
          await measurements
            .getByRole("button", { name: ta.title, exact: true })
            .click();
          await expect(
            measurements.getByText(ta.access, { exact: true }),
          ).toBeVisible();
          await expect(measurements).not.toContainText("12 1/2");
        }
        await expect(page.locator("body")).not.toContainText("12 1/2");
        await expectStaticPwaStorage(page);
      } finally {
        await seed.close();
      }
    },
  );
});
