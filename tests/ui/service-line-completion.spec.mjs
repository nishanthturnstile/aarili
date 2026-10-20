import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { serviceLineMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedSmallServices } from "../../scripts/test-support/small-services.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test("SS-C independent completion, lost-response retry, correction, conflict and bilingual accessible layouts", async ({
  page,
  context,
}, info) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  await withOwnerWeb(
    async ({ origin, setupToken, code, runtime, seedCommand }) => {
      const post = (path, data, headers = {}) =>
        page.request.post(`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...headers },
        });
      const password = "synthetic-small-service-password";
      expect(
        (
          await post(
            "/owner/setup",
            {
              name: "SYNTHETIC service owner",
              email: "services@example.test",
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
            email: "services@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC service shop" },
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
        expect(r.status, `${method} ${path}: ${await r.clone().text()}`).toBe(
          200,
        );
        return r.json();
      }
      const services = await seedSmallServices({
        setup,
        runtime,
        shopId,
        taskLinked: true,
      });
      const captures = [];
      try {
        const value = structuredClone(services.saree.intake);
        value.lines.push({
          id: randomUUID(),
          key: "pre-pleating",
          requestedWork: "",
          priceState: "to-be-quoted",
          priceText: "",
          notRequired: true,
          notRequiredReason: "SYNTHETIC pre-pleating not requested",
        });
        async function accept(payload) {
          const r = await setup("small-services/orders/review", {
            body: payload,
          });
          expect(r.issues).toEqual([]);
          return services.config.publish("order.service", {
            ...payload,
            commitmentReview: {
              fingerprint: r.fingerprint,
              acknowledged: true,
              exceptionReason: "SYNTHETIC completion verification",
              waiveRush: false,
              waiverReason: "",
            },
          });
        }
        const orderId = await accept(value),
          taskId = await accept(services.kurti.intake);
        await page.goto(`${origin}/orders?services=1&serviceOrder=${orderId}`);
        await prepareOwnerScreen(page, "en");
        const section = () =>
          page.getByRole("region", {
            name: serviceLineMessages.en.title,
            exact: true,
          });
        await expect(section()).toContainText("Outstanding service lines: 2");
        async function retrySameCommand() {
          for (let attempt = 0; attempt < 3; attempt++) {
            const response = page.waitForResponse(
              (r) =>
                r.request().method() === "POST" &&
                r.url().includes("/small-services/progress/") &&
                r.url().includes("/lines/"),
            );
            await section()
              .getByRole("button", {
                name: serviceLineMessages.en.retry,
                exact: true,
              })
              .click();
            const r = await response;
            if (r.status() !== 429) {
              expect(r.status()).toBe(200);
              return;
            }
            await page.waitForTimeout(
              (Number(r.headers()["retry-after"] ?? 1) + 1) * 1000,
            );
          }
          throw Error("Synthetic line retry admission did not recover");
        }
        async function capture(state) {
          await mkdir(".impeccable/review/service-completion", {
            recursive: true,
          });
          for (const locale of ["en", "ta"])
            for (const [device, width, height] of [
              ["phone", 360, 800],
              ["tablet", 820, 1180],
              ["desktop", 1440, 900],
              ["tablet-landscape", 1180, 820],
            ])
              for (const dark of [false, true]) {
                await page.setViewportSize({ width, height });
                await prepareOwnerScreen(page, locale, dark);
                await page.evaluate(() => document.fonts.ready);
                const region = page.getByRole("region", {
                  name: serviceLineMessages[locale].title,
                  exact: true,
                });
                await region.scrollIntoViewIfNeeded();
                expect(
                  await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                  ),
                ).toBe(true);
                expect(
                  (await new AxeBuilder({ page }).analyze()).violations,
                ).toEqual([]);
                const path = `.impeccable/review/service-completion/${state}-${locale}-${device}-${dark ? "dark" : "light"}.png`;
                await page.screenshot({ path, fullPage: true });
                captures.push(path);
              }
          await prepareOwnerScreen(page, "en");
        }
        await capture("pending");
        await section()
          .getByRole("button", { name: /^Record completion/ })
          .first()
          .click();
        const note = section().getByLabel(serviceLineMessages.en.note);
        await expect(note).toBeFocused();
        await note.dispatchEvent("compositionstart");
        await note.fill("SYNTHETIC உரிமையாளர் சரிபார்த்த வேலை");
        await note.dispatchEvent("compositionend");
        await section().getByRole("checkbox").check();
        await capture("attestation");
        let lost = false;
        await page.route(
          "**/small-services/progress/*/lines/*",
          async (route) => {
            if (!lost && route.request().method() === "POST") {
              lost = true;
              const committed = await route.fetch();
              expect(committed.status(), await committed.text()).toBe(200);
              await route.abort("failed");
            } else await route.continue();
          },
        );
        await section()
          .getByRole("button", {
            name: serviceLineMessages.en.save,
            exact: true,
          })
          .click();
        await expect(section().getByRole("alert")).toHaveText(
          serviceLineMessages.en.error,
        );
        await expect(note).toHaveValue("SYNTHETIC உரிமையாளர் சரிபார்த்த வேலை");
        await retrySameCommand();
        await expect(section()).toContainText("Completed: 1");
        await expect(section()).toContainText("Outstanding service lines: 1");
        await expect(section().getByRole("heading").first()).toBeFocused();
        await section()
          .getByText(/Line history/)
          .click();
        await capture("completed");
        await section()
          .getByRole("button", { name: /^Correct completion/ })
          .click();
        await section()
          .getByLabel(serviceLineMessages.en.note)
          .fill("SYNTHETIC correction entered against wrong line");
        await section()
          .getByRole("button", {
            name: serviceLineMessages.en.save,
            exact: true,
          })
          .click();
        await expect(section()).toContainText("Outstanding service lines: 2");
        await expect(section()).toContainText("Correction of");
        await section()
          .getByRole("button", { name: /^Record completion/ })
          .first()
          .click();
        await section()
          .getByLabel(serviceLineMessages.en.note)
          .fill("SYNTHETIC preserve my conflict note");
        await section().getByRole("checkbox").check();
        const current = await setup(`small-services/progress/${orderId}`, {
            method: "GET",
          }),
          line = current.lines.find((l) => l.history.length);
        await setup(
          `small-services/progress/${orderId}/lines/${line.line.id}`,
          {
            etag: `"v${line.version}"`,
            body: {
              commandId: randomUUID(),
              action: "complete",
              orderVersion: current.orderVersion,
              scopeDigest: current.scopeDigest,
              sourceId: line.sourceId,
              sourceDigest: line.sourceDigest,
              attested: true,
              note: "SYNTHETIC another tab checked this line",
            },
          },
        );
        await section()
          .getByRole("button", {
            name: serviceLineMessages.en.save,
            exact: true,
          })
          .click();
        await expect(section().getByRole("alert")).toHaveText(
          serviceLineMessages.en.conflict,
        );
        await section()
          .getByRole("button", {
            name: serviceLineMessages.en.reload,
            exact: true,
          })
          .click();
        await expect(section()).toContainText("Completed: 1");
        await section()
          .getByRole("button", { name: /^Correct completion/ })
          .click();
        await expect(
          section().getByLabel(serviceLineMessages.en.note),
        ).toHaveValue("SYNTHETIC preserve my conflict note");
        let refreshFailure = true;
        await page.route("**/small-services/progress/*", async (route) => {
          if (refreshFailure && route.request().method() === "GET") {
            refreshFailure = false;
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                error: {
                  code: "DATABASE_UNAVAILABLE",
                  message: "SYNTHETIC refresh interruption",
                },
              }),
            });
          } else await route.fallback();
        });
        await section()
          .getByRole("button", {
            name: serviceLineMessages.en.save,
            exact: true,
          })
          .click();
        await expect(section().getByRole("alert")).toHaveText(
          serviceLineMessages.en.error,
        );
        await expect(
          section().getByLabel(serviceLineMessages.en.note),
        ).toHaveValue("SYNTHETIC preserve my conflict note");
        await retrySameCommand();
        await expect(section()).toContainText("Outstanding service lines: 2");
        await section()
          .getByRole("button", { name: /^Record completion/ })
          .first()
          .click();
        await section()
          .getByLabel(serviceLineMessages.en.note)
          .fill("SYNTHETIC access denial clears local evidence");
        await section().getByRole("checkbox").check();
        await page.route(
          "**/small-services/progress/*/lines/*",
          async (route) => {
            if (route.request().method() === "POST")
              await route.fulfill({
                status: 404,
                contentType: "application/json",
                body: JSON.stringify({
                  error: {
                    code: "NOT_FOUND",
                    message: "Service source unavailable",
                  },
                }),
              });
            else await route.fallback();
          },
        );
        await section()
          .getByRole("button", {
            name: serviceLineMessages.en.save,
            exact: true,
          })
          .click();
        await expect(section().getByRole("alert")).toHaveText(
          serviceLineMessages.en.unavailable,
        );
        await expect(
          section().getByLabel(serviceLineMessages.en.note),
        ).toHaveCount(0);
        await expect(section().getByText(/Line history/)).toHaveCount(0);
        await page.goto(`${origin}/orders?services=1&serviceOrder=${taskId}`);
        await prepareOwnerScreen(page, "en");
        await expect(section()).toContainText(serviceLineMessages.en.task);
        await expect(section()).toContainText(
          "Task reference: alteration-work",
        );
        await expect(
          section().getByRole("button", { name: /Record completion/ }),
        ).toHaveCount(0);
        await expectStaticPwaStorage(page);
        await info.attach("SS-C captures", {
          body: JSON.stringify(captures),
          contentType: "application/json",
        });
      } finally {
        await services.close();
      }
    },
  );
});
