import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import {
  orderAcceptanceMessages,
  orderMessages,
  orderPieceMessages,
} from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedOrderAcceptance } from "../../scripts/test-support/order-acceptance.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("GB-02/06/08/09 legacy outfit review, exact lost-response recovery, stale conflict, bilingual pieces and access clearing", async ({
  page,
  context,
}, info) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  await withOwnerWeb(
    async ({
      origin,
      setupToken,
      code,
      runtime,
      seedCommand,
      seedHistoricalPieces,
    }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-pieces-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC pieces owner",
              email: "pieces@example.test",
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
            email: "pieces@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC pieces review" },
            { "Idempotency-Key": randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const entry = await (
          await page.request.get(`${origin}/api/owner/entry`)
        ).json(),
        shopId = entry.shop.shopId;
      const seed = await seedQuickOrder(runtime, shopId, { outfit: true });
      const cookies = (await context.cookies(origin))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      const setup = async (
        path,
        { method = "POST", body, etag, key = randomUUID() } = {},
      ) => {
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
        expect(r.status).toBe(200);
        return r.json();
      };
      try {
        await seedOrderAcceptance(setup, seed.sources);
        const value = {
          ...emptyQuickOrder(),
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
          manifest: {
            entryId: seed.sources.before.entryId,
            revisionId: seed.sources.before.id,
            definitionId: seed.sources.before.definition.id,
          },
          deliveryDate: new Date(Date.now() + 30 * 86400000)
            .toISOString()
            .slice(0, 10),
          instructions:
            "SYNTHETIC preserved Tamil note — கீழ் பகுதி இன்னும் தீர்க்கப்படவில்லை",
        };
        async function accept() {
          const review = await setup("orders/review", { body: value });
          const id = randomUUID().replace(/^(........-....-)./, "$17");
          await setup(`drafts/${id}`, {
            method: "PUT",
            body: {
              workflow: "order.quick",
              schemaVersion: 1,
              payload: {
                ...value,
                commitmentReview: {
                  fingerprint: review.fingerprint,
                  acknowledged: true,
                  exceptionReason: review.evaluation.warnings.length
                    ? "SYNTHETIC test exception"
                    : "",
                  waiveRush: false,
                  waiverReason: "",
                },
              },
            },
          });
          const p = await setup(`drafts/${id}/promote`, {
            body: {},
            etag: '"v1"',
          });
          const o = await setup(`orders/${p.draft.result.id}/read`);
          await seedHistoricalPieces(o.id);
          return o;
        }
        const first = await accept(),
          second = await accept();
        await page.goto(`${origin}/orders?order=${first.id}`);
        await prepareOwnerScreen(page, "en");
        let section = page.getByRole("region", {
          name: orderPieceMessages.en.title,
          exact: true,
        });
        await expect(
          section.getByText(orderPieceMessages.en.legacy, { exact: true }),
        ).toBeVisible();
        await expect(section.getByRole("article")).toHaveCount(3);
        await expect(
          section.getByRole("article", {
            name: "SYNTHETIC bottom",
            exact: true,
          }),
        ).toContainText("SYNTHETIC stitch");
        await section
          .getByRole("button", {
            name: orderPieceMessages.en.prepare,
            exact: true,
          })
          .focus();
        await page.keyboard.press("Enter");
        await section
          .getByLabel(orderPieceMessages.en.reason, { exact: true })
          .fill("SYNTHETIC reviewed legacy pieces — அளவு பின்னர்");
        await expect(
          page.getByRole("button", {
            name: orderMessages.en.newDraft,
            exact: true,
          }),
        ).toBeDisabled();
        let dropped = false,
          envelope;
        await page.route("**/pieces/materialize", async (route) => {
          const r = await route.fetch();
          if (r.status() === 200 && !dropped) {
            envelope = {
              key: route.request().headers()["idempotency-key"],
              body: route.request().postData(),
              etag: route.request().headers()["if-match"],
            };
            dropped = true;
            await route.abort("failed");
          } else {
            if (dropped)
              expect({
                key: route.request().headers()["idempotency-key"],
                body: route.request().postData(),
                etag: route.request().headers()["if-match"],
              }).toEqual(envelope);
            await route.fulfill({ response: r });
          }
        });
        await section
          .getByRole("button", {
            name: orderPieceMessages.en.confirm,
            exact: true,
          })
          .click();
        await expect(section.getByRole("alert")).toHaveText(
          orderPieceMessages.en.checking,
        );
        await expect(
          page.getByRole("button", {
            name: orderMessages.en.newDraft,
            exact: true,
          }),
        ).toBeDisabled();
        await section
          .getByRole("button", {
            name: orderPieceMessages.en.retry,
            exact: true,
          })
          .click();
        await expect(
          section.getByText(orderPieceMessages.en.legacy, { exact: true }),
        ).toHaveCount(0);
        expect(dropped).toBe(true);
        await page.unroute("**/pieces/materialize");
        const pieces = await setup(`orders/${first.id}/pieces/read`);
        expect(pieces.identities).toHaveLength(3);
        expect(pieces.execution).toBe("unavailable");
        await page.reload();
        await prepareOwnerScreen(page, "en");
        section = page.getByRole("region", {
          name: orderPieceMessages.en.title,
          exact: true,
        });
        await expect(section.getByRole("article")).toHaveCount(3);
        const original = await setup(`orders/${first.id}/read`);
        await page
          .getByRole("region", { name: first.code, exact: true })
          .getByRole("button", {
            name: `${orderAcceptanceMessages.en.mode}: ${orderAcceptanceMessages.en.detailed}`,
            exact: true,
          })
          .click();
        await expect
          .poll(
            async () => (await setup(`orders/${first.id}/read`)).presentation,
          )
          .toBe("detailed");
        await mkdir(".scratch/grouped-bookings/captures", { recursive: true });
        for (const locale of ["en", "ta"])
          for (const dark of [false, true]) {
            await prepareOwnerScreen(page, locale, dark);
            const t = orderPieceMessages[locale];
            section = page.getByRole("region", { name: t.title, exact: true });
            await expect(section.getByRole("article")).toHaveCount(3);
            const bottom = seed.sources.pieces.find(
              (p) => p.definition.content.code === "bottom",
            ).definition.content;
            const bottomArticle = section.getByRole("article", {
              name: locale === "ta" ? bottom.labelTa : bottom.labelEn,
              exact: true,
            });
            await expect(bottomArticle).toContainText(t.unresolved);
            await expect(
              section.getByText(t.unavailable, { exact: true }),
            ).toBeVisible();
            expect(
              (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            ).toBe(true);
            await section.screenshot({
              path: `.scratch/grouped-bookings/captures/${info.project.name}-${locale}-${dark ? "dark" : "light"}.png`,
            });
          }
        const size = page.viewportSize();
        await page.setViewportSize({ width: 1180, height: 820 });
        await page.evaluate(() => {
          document.documentElement.style.zoom = "2";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          document.documentElement.style.zoom = "";
        });
        await page.setViewportSize(size);
        await prepareOwnerScreen(page, "en");
        await page
          .getByRole("region", { name: first.code, exact: true })
          .getByRole("button", {
            name: `${orderAcceptanceMessages.en.mode}: ${orderAcceptanceMessages.en.simple}`,
            exact: true,
          })
          .click();
        await expect
          .poll(
            async () => (await setup(`orders/${first.id}/read`)).presentation,
          )
          .toBe("simple");
        const after = await setup(`orders/${first.id}/read`);
        expect(after.requirements).toEqual(original.requirements);
        expect(after.snapshotDigest).toBe(original.snapshotDigest);
        expect(
          (await setup(`orders/${first.id}/pieces/read`)).identities,
        ).toEqual(pieces.identities);
        // A second legacy order demonstrates explicit stale review and no automatic merge.
        await page.goto(`${origin}/orders?order=${second.id}`);
        await prepareOwnerScreen(page, "en");
        section = page.getByRole("region", {
          name: orderPieceMessages.en.title,
          exact: true,
        });
        await section
          .getByRole("button", {
            name: orderPieceMessages.en.prepare,
            exact: true,
          })
          .click();
        await section
          .getByLabel(orderPieceMessages.en.reason, { exact: true })
          .fill("SYNTHETIC stale review");
        await setup(`orders/${second.id}/presentation`, {
          body: { mode: "detailed" },
          etag: '"v1"',
        });
        await section
          .getByRole("button", {
            name: orderPieceMessages.en.confirm,
            exact: true,
          })
          .click();
        await expect(section.getByRole("alert")).toHaveText(
          orderPieceMessages.en.stale,
        );
        await section
          .getByRole("button", {
            name: orderPieceMessages.en.cancel,
            exact: true,
          })
          .click();
        await page
          .getByRole("region", { name: second.code, exact: true })
          .getByRole("button", {
            name: orderAcceptanceMessages.en.reload,
            exact: true,
          })
          .click();
        await expect(
          section.getByText(orderPieceMessages.en.legacy, { exact: true }),
        ).toBeVisible();
        expect((await setup(`orders/${second.id}/pieces/read`)).state).toBe(
          "historical-preview",
        );
        expect(
          (
            await runtime.query(
              "select count(*)::int n from order_capacity_demand",
            )
          ).rows[0].n,
        ).toBe(0); // runtime SQL without tenant context fails closed
        expect((await setup("orders/list", { body: {} })).orders).toHaveLength(
          2,
        );
        await expectStaticPwaStorage(page);
        const other = await context.newPage();
        await other.goto(page.url());
        await expect(
          other.getByRole("heading", {
            name: orderPieceMessages.en.title,
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Sign in to Aarili", exact: true }),
        ).toBeVisible();
        await expect(
          other.getByRole("heading", {
            name: "Sign in to Aarili",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          other.getByText("SYNTHETIC bottom", { exact: true }),
        ).toHaveCount(0);
        await other.close();
        expect(
          await page.evaluate(() =>
            Object.keys(localStorage).filter((k) => k !== "aarili-appearance"),
          ),
        ).toEqual([]);
      } finally {
        await seed.close();
      }
    },
  );
});
