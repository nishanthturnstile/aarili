import { mkdir } from "node:fs/promises";
import { draftMessages, measurementSessionMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { measurementSources } from "../../scripts/test-support/measurement-session-fixtures.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("MV-A01–10 wearer observation, exact conversion, recovery, save-only and reviewed first selection in both languages", async ({
  page,
}, info) => {
  test.setTimeout(420000);
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
          }),
        password = "synthetic-measurement-review-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC Measurements owner",
              email: "measurements@example.test",
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
            email: "measurements@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC Measurements" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
          await page.request.get(`${origin}/api/owner/shop`)
        ).json(),
        cookie = (await page.context().cookies(origin))
          .map((c) => `${c.name}=${c.value}`)
          .join("; "),
        f = {
          a: { shop: shopId, cookie },
          owner: { origin },
          api: { fetch: seedCommand },
        },
        seed = await seedQuickOrder(runtime, shopId);
      try {
        let blockedUntil = 0;
        page.on("response", (r) => {
          if (r.status() === 429)
            blockedUntil = Math.max(
              blockedUntil,
              Date.now() +
                Number(r.headers()["retry-after"] ?? 60) * 1000 +
                150,
            );
        });
        const admission = async () => {
          while (Date.now() < blockedUntil)
            await page.waitForTimeout(
              Math.min(1000, blockedUntil - Date.now()),
            );
        };
        const continueAdmitted = async (name) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            const scope = region().locator(".directory-editor"),
              button = scope.getByRole("button", { name, exact: true }),
              deadline = Date.now() + 180000;
            // A partial-draft autosave can itself hit admission before promotion.
            // Wait for its real Retry-After, retry the frozen request, then promote.
            while (!(await button.isEnabled())) {
              if (Date.now() >= deadline)
                throw Error("Measurement draft did not settle");
              await admission();
              const retry = scope.getByRole("button", {
                name: draftMessages.en.retry,
                exact: true,
              });
              if ((await retry.isVisible()) && (await retry.isEnabled()))
                await retry.click();
              else await page.waitForTimeout(100);
            }
            await admission();
            const response = page.waitForResponse(
              (r) =>
                r.url().endsWith("/promote") && r.request().method() === "POST",
            );
            await button.click();
            const r = await response;
            if (r.status() === 429) continue;
            expect(r.status(), await r.text()).toBe(200);
            return;
          }
          throw Error("Measurement admission did not recover");
        };
        const identity = {
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          },
          s = await measurementSources(f, identity),
          { order, pieces } = await s.accept(),
          pieceId = pieces.identities.find(
            (p) => p.key === s.top.definition.content.code,
          ).id,
          field = s.forms[0].definition.content.groups[0].fields[0],
          en = measurementSessionMessages.en;
        await page.goto(`${origin}/orders?order=${order.id}`);
        await prepareOwnerScreen(page, "en", false);
        const region = () =>
          page.getByRole("region", { name: en.title, exact: true });
        await region()
          .getByRole("button", { name: en.title, exact: true })
          .click();
        await region()
          .getByLabel(en.piece, { exact: true })
          .selectOption(pieceId);
        await expect(
          region().getByText(en.unselected, { exact: true }),
        ).toBeVisible();
        await region()
          .getByLabel(en.form, { exact: true })
          .selectOption(s.forms[0].definition.id);
        await region()
          .getByRole("button", { name: en.useTitle, exact: true })
          .click();
        await region()
          .getByLabel(en.zero, { exact: true })
          .first()
          .selectOption("false");
        await region()
          .getByLabel(en.zero, { exact: true })
          .nth(1)
          .selectOption("false");
        await region()
          .getByLabel(en.policyReview, { exact: true })
          .fill("SYNTHETIC explicit no plausibility rules configured");
        await region()
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC reviewed exact form and precision");
        await region()
          .getByRole("checkbox", { name: en.useReview, exact: true })
          .check();
        await continueAdmitted(en.approve);
        await expect(
          region().getByText(draftMessages.en.promoted, { exact: true }),
        ).toBeVisible();
        await region()
          .getByRole("button", { name: en.close, exact: true })
          .click();
        await region()
          .getByLabel(en.form, { exact: true })
          .selectOption(s.forms[0].definition.id);
        await region()
          .getByRole("button", { name: en.start, exact: true })
          .click();
        const editor = () => region().locator(".directory-editor");
        await editor()
          .getByLabel(en.source, { exact: true })
          .selectOption("sample-garment");
        await editor().getByLabel(en.date, { exact: true }).fill("2026-10-22");
        await editor()
          .getByLabel(en.measurer, { exact: true })
          .fill("SYNTHETIC provided by person");
        await editor()
          .getByLabel(en.method, { exact: true })
          .fill("SYNTHETIC sample garment, not body");
        await page.context().setOffline(true);
        await editor().locator(`#measurement-${field.id}-raw`).fill("1/0");
        await expect(
          editor().getByText(en.invalidEntry, { exact: true }),
        ).toBeVisible();
        await expect(
          editor().getByText(draftMessages.en.saveFailed, { exact: true }),
        ).toBeVisible();
        await expect(
          editor().locator(`#measurement-${field.id}-raw`),
        ).toHaveValue("1/0");
        await page.context().setOffline(false);
        await admission();
        // Reconnect resumes the frozen request through the incumbent recovery.
        await expect(
          editor().getByText(draftMessages.en.saved, { exact: true }),
        ).toBeVisible();
        await expect(
          editor().locator(`#measurement-${field.id}-raw`),
        ).toHaveValue("1/0");
        await editor().locator(`#measurement-${field.id}-raw`).fill("12 1/4");
        await editor()
          .locator(`#measurement-${field.id}-unit`)
          .selectOption("in");
        await editor()
          .getByLabel(en.display, { exact: true })
          .selectOption("cm");
        await expect(
          editor().getByText("Exact: 31.115 cm", { exact: true }),
        ).toBeVisible();
        await editor()
          .getByLabel(en.display, { exact: true })
          .selectOption("in");
        await expect(
          editor().locator(`#measurement-${field.id}-raw`),
        ).toHaveValue("12 1/4");
        await editor()
          .getByLabel(en.notes, { exact: true })
          .fill("SYNTHETIC private fit note");
        await editor()
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC reviewed observation");
        // A lost response commits once, then incumbent recovery retries the frozen key.
        let lost = false,
          committedCreatedAt;
        const lose = async (route) => {
          if (!lost && route.request().method() === "PUT") {
            const req = route.request(),
              r = await seedCommand(
                new Request(req.url(), {
                  method: req.method(),
                  headers: req.headers(),
                  body: req.postData(),
                }),
              );
            if (r.status === 200) {
              committedCreatedAt = (await r.clone().json()).draft.createdAt;
              lost = true;
              await route.abort("failed");
              return;
            }
          }
          await route.continue();
        };
        await page.route("**/api/shops/*/drafts/*", lose);
        await editor()
          .getByRole("checkbox", { name: en.review, exact: true })
          .check();
        await expect.poll(() => lost).toBe(true);
        await page.unroute("**/api/shops/*/drafts/*", lose);
        const retry = editor().getByRole("button", {
          name: draftMessages.en.retry,
          exact: true,
        });
        if (await retry.isVisible()) {
          await admission();
          await retry.click();
        }
        await expect(
          editor().getByText(draftMessages.en.saved, { exact: true }),
        ).toBeVisible();
        // Disposable DB clock catch-up, as in the incumbent pagination fixture.
        // Do not open a time-bounded list while its clock precedes the saved row.
        await expect
          .poll(
            async () =>
              (
                await runtime.query(
                  "select statement_timestamp() >= $1::timestamptz + interval '1 second' ready",
                  [committedCreatedAt],
                )
              ).rows[0].ready,
            { timeout: 10000 },
          )
          .toBe(true);
        const activeDraftResponse = await page.request.get(
          `${origin}/api/shops/${shopId}/drafts`,
        );
        expect(activeDraftResponse.status()).toBe(200);
        const activeDrafts = await activeDraftResponse.json();
        expect(
          activeDrafts.drafts.some((d) => d.workflow === "measurement.session"),
        ).toBe(true);
        await page.reload();
        await prepareOwnerScreen(page, "en", false);
        await region()
          .getByRole("button", { name: en.title, exact: true })
          .click();
        await region()
          .getByRole("button", { name: `${en.resume} 1`, exact: true })
          .click();
        await expect(
          editor().locator(`#measurement-${field.id}-raw`),
        ).toHaveValue("12 1/4");
        await expect(
          editor().getByLabel(en.measurer, { exact: true }),
        ).toHaveValue("SYNTHETIC provided by person");
        await continueAdmitted(en.save);
        await expect(
          editor().getByText(draftMessages.en.promoted, { exact: true }),
        ).toBeVisible();
        await region()
          .getByRole("button", { name: en.close, exact: true })
          .click();
        await region()
          .getByLabel(en.piece, { exact: true })
          .selectOption(pieceId);
        await expect(
          region().getByText(en.unselected, { exact: true }),
        ).toBeVisible();
        const saved = region()
          .locator("details")
          .filter({ has: page.locator("summary", { hasText: /Version 1/ }) })
          .first();
        await saved.locator("summary").click();
        await saved
          .getByRole("button", { name: en.reuse, exact: true })
          .click();
        const useReview = region().getByRole("region", {
          name: en.compare,
          exact: true,
        });
        await useReview
          .getByLabel(en.physical, { exact: true })
          .selectOption("not-started");
        await useReview
          .getByLabel(en.commercial, { exact: true })
          .selectOption("none");
        await useReview
          .getByRole("button", { name: en.inspect, exact: true })
          .click();
        await useReview
          .getByRole("button", { name: en.select, exact: true })
          .click();
        await expect(
          editor().getByRole("checkbox", { name: en.review, exact: true }),
        ).not.toBeChecked();
        await editor()
          .getByLabel(en.reason, { exact: true })
          .fill("SYNTHETIC explicit suitability review");
        await editor()
          .getByRole("checkbox", { name: en.review, exact: true })
          .check();
        await continueAdmitted(en.select);
        await expect(
          editor().getByText(draftMessages.en.promoted, { exact: true }),
        ).toBeVisible();
        await region()
          .getByRole("button", { name: en.close, exact: true })
          .click();
        await expect(
          region().getByText(en.selected, { exact: true }),
        ).toBeVisible();
        for (const [locale, dark] of [
          ["en", false],
          ["en", true],
          ["ta", false],
          ["ta", true],
        ]) {
          await prepareOwnerScreen(page, locale, dark);
          const t = measurementSessionMessages[locale],
            r = page.getByRole("region", { name: t.title, exact: true });
          await expect(r.getByText(t.selected, { exact: true })).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          expect(
            (
              await new AxeBuilder({ page })
                .include(`section[aria-label="${t.title}"]`)
                .analyze()
            ).violations,
          ).toEqual([]);
          await mkdir(".scratch/measurement-sessions-ui", { recursive: true });
          await r.screenshot({
            path: `.scratch/measurement-sessions-ui/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
          });
        }
        await expectStaticPwaStorage(page);
        expect(
          await page.evaluate(() => ({
            local: Object.keys(localStorage),
            session: sessionStorage.length,
          })),
        ).toEqual({ local: ["aarili-appearance"], session: 0 });
        await prepareOwnerScreen(page, "en", false);
        await region()
          .getByLabel(en.form, { exact: true })
          .selectOption(s.forms[0].definition.id);
        await region()
          .getByRole("button", { name: en.start, exact: true })
          .click();
        await admission();
        let releaseRead;
        const readGate = new Promise((resolve) => {
          releaseRead = resolve;
        });
        let held = false;
        const hold = async (route) => {
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          held = true;
          await readGate;
          await route.fulfill({ response });
        };
        const piecesRead = `**/orders/${order.id}/pieces/read`;
        await page.route(piecesRead, hold);
        const lateResponse = page.waitForResponse((r) =>
          r.url().endsWith(`/orders/${order.id}/pieces/read`),
        );
        await region()
          .getByRole("button", { name: en.retry, exact: true })
          .click();
        await expect.poll(() => held).toBe(true);
        await revokeWearerAuthority(identity.wearerId);
        await editor()
          .getByLabel(en.notes, { exact: true })
          .fill("SYNTHETIC draft cleared after access ended");
        await expect(region().getByRole("alert")).toHaveText(en.access);
        releaseRead();
        await (await lateResponse).finished();
        await page.unroute(piecesRead, hold);
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await expect(region().getByRole("alert")).toHaveText(en.access);
        await expect(
          region().getByText("SYNTHETIC private fit note", { exact: true }),
        ).toHaveCount(0);
      } finally {
        await page.context().setOffline(false);
        await seed.close();
      }
    },
    { secrets: ["synthetic-measurement-review-password"] },
  );
});
