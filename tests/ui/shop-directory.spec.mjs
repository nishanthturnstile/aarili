import { mkdir } from "node:fs/promises";
import { shopDirectoryMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("SS-03/07/08/10/11 receiving and vendor owner flows, draft recovery, stale comparison and bilingual accessibility", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const password = "synthetic-directory-86-owner-password";
  await withOwnerWeb(
    async ({ origin, setupToken, code, expireAuthentication }) => {
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
              name: "SYNTHETIC directory owner",
              email: "directory@example.test",
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
            email: "directory@example.test",
            password,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await post(
            "/owner/complete",
            { shopName: "SYNTHETIC directory shop" },
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status(),
      ).toBe(200);
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const api = `${origin}/api/shops/${shopId}`;
      const arrived = async (target) => {
        await expect(target).toBeFocused();
        expect(
          await target.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const navigation = document.querySelector(".workspace-navigation");
            const bottom =
              navigation && getComputedStyle(navigation).position === "fixed"
                ? navigation.getBoundingClientRect().top
                : window.innerHeight;
            return box.top >= 0 && box.bottom <= bottom;
          }),
        ).toBe(true);
      };
      const editorHeading = (locale = "en") =>
        page
          .locator(".directory-editor > h3")
          .filter({ hasText: shopDirectoryMessages[locale].account });
      await page.goto(`${origin}/settings?section=directory`);
      await expect(
        page.getByText(shopDirectoryMessages.en.missingMethods, {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.newAccount,
          exact: true,
        })
        .click();
      await arrived(editorHeading());
      await page
        .locator(".directory-editor fieldset")
        .dispatchEvent("compositionstart");
      await page.locator("#directory-label").fill("SYNTHETIC family UPI தமிழ்");
      await page.locator("#directory-method").selectOption("upi");
      await page.locator("#directory-recipient").selectOption("family");
      await page.locator("#directory-upiId").fill("synthetic@invalid");
      let guarded = false;
      page.once("dialog", async (dialog) => {
        guarded = true;
        await dialog.dismiss();
      });
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.cancel,
          exact: true,
        })
        .click();
      expect(guarded).toBe(true);
      await expect(page.locator("#directory-upiId")).toHaveValue(
        "synthetic@invalid",
      );
      await page
        .locator(".directory-editor fieldset")
        .dispatchEvent("compositionend");
      await expect(
        page.getByText("Draft saved", { exact: true }),
      ).toBeVisible();
      const draftUrl = page.url();
      expect(draftUrl).toContain("draft=");
      expect(draftUrl).not.toContain("synthetic");
      await page.reload();
      await expect(page.locator("#directory-upiId")).toHaveValue(
        "synthetic@invalid",
      );
      await arrived(editorHeading());
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.cancel,
          exact: true,
        })
        .click();
      await page
        .getByRole("region", {
          name: shopDirectoryMessages.en.drafts,
          exact: true,
        })
        .getByRole("button", { name: /^Resume draft/ })
        .click();
      await arrived(editorHeading());
      const waitAdmission = async (response) => {
        const seconds = Math.min(
          60,
          Math.max(1, Number(response.headers()["retry-after"] ?? 60)),
        );
        await page.waitForTimeout(seconds * 1000 + 100);
      };
      const admitted = async (run) => {
        let response = await run();
        if (response.status() === 429) {
          await waitAdmission(response);
          response = await run();
        }
        return response;
      };
      const saved = async (t = shopDirectoryMessages.en) => {
        const saved = page.getByText(t.saved, { exact: true }),
          limited = page.getByText(t.rateLimited, {
            exact: true,
          });
        await expect(saved.or(limited)).toBeVisible();
        if (await limited.isVisible()) {
          await page.waitForTimeout(60100);
          await page
            .getByRole("button", {
              name: t.save,
              exact: true,
            })
            .click();
          await expect(saved).toBeVisible();
        }
      };
      const publish = async (t) => {
        await page.getByRole("button", { name: t.review, exact: true }).click();
        await arrived(
          page.getByRole("heading", { name: t.review, exact: true }),
        );
        const run = async () => {
          const reply = page.waitForResponse(
            (r) =>
              r.url().endsWith("/promote") && r.request().method() === "POST",
          );
          await page
            .getByRole("button", { name: t.publish, exact: true })
            .click();
          return reply;
        };
        const response = await admitted(run);
        if (response.status() !== 200) {
          const body = await response.json();
          throw Error(
            `Synthetic directory publication ${response.status()} ${body.error?.code}`,
          );
        }
        await expect(page.getByText(t.promoted, { exact: true })).toBeVisible();
      };
      const keys = [];
      let drop = true;
      let lostStatus = 0;
      await page.route("**/drafts/*/promote", async (route) => {
        keys.push(route.request().headers()["idempotency-key"]);
        if (drop) {
          drop = false;
          lostStatus = (await route.fetch()).status();
          await route.abort("failed");
        } else await route.continue();
      });
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.review,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.publish,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: shopDirectoryMessages.en.retry,
          exact: true,
        }),
      ).toBeVisible();
      await expireAuthentication();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.retry,
          exact: true,
        })
        .click();
      await expect(page.locator("#directory-password")).toBeVisible();
      await arrived(page.locator("#directory-password"));
      await page
        .locator("#directory-password")
        .fill("synthetic-wrong-password");
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.reauth,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(shopDirectoryMessages.en.authError, { exact: true }),
      ).toBeVisible();
      await expect(page.locator("#directory-password")).toHaveValue("");
      await arrived(page.locator("#directory-password"));
      await expect(page.locator("#directory-label")).toBeDisabled();
      expect(keys.length).toBe(2);
      await page.locator("#directory-password").fill(password);
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.reauth,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(shopDirectoryMessages.en.promoted, { exact: true }),
      ).toBeVisible();
      expect(lostStatus).toBe(200);
      expect(new Set(keys).size).toBe(1);
      expect(keys.length).toBe(3);
      await page.unroute("**/drafts/*/promote");

      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.cancel,
          exact: true,
        })
        .click();
      await expect(page.locator(".directory-list")).not.toContainText(
        "synthetic@invalid",
      );
      await expect(page.locator(".directory-list")).toContainText(
        "••••@invalid",
      );
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.editMethods,
          exact: true,
        })
        .click();
      await page.getByLabel("UPI", { exact: true }).check();
      await saved();
      await publish(shopDirectoryMessages.en);
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.cancel,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(shopDirectoryMessages.en.configured, { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.newVendor,
          exact: true,
        })
        .click();
      await page.locator("#directory-label").fill("SYNTHETIC artisan supplier");
      await page.getByLabel("External artisan", { exact: true }).check();
      await page.getByLabel("Supplier", { exact: true }).check();
      await saved();
      await publish(shopDirectoryMessages.en);
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.cancel,
          exact: true,
        })
        .click();
      const accountRow = page
        .locator(".directory-list > li")
        .filter({ hasText: "SYNTHETIC family UPI" });
      await accountRow
        .getByRole("button", {
          name: shopDirectoryMessages.en.detail,
          exact: true,
        })
        .click();
      await arrived(
        page
          .getByRole("region", {
            name: shopDirectoryMessages.en.detail,
            exact: true,
          })
          .getByRole("heading"),
      );
      await expect(
        page.getByText("synthetic@invalid", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.edit,
          exact: true,
        })
        .click();
      await page.locator("#directory-label").fill("SYNTHETIC my stale changes");
      await page
        .getByLabel(shopDirectoryMessages.en.active, { exact: true })
        .uncheck();
      await saved();
      const list = await (
        await page.request.post(`${api}/settings/directory/list`, {
          data: {},
          headers: { Origin: origin },
        })
      ).json();
      const summary = list.entries.find((e) => e.kind === "account");
      const { revision: r } = await (
        await page.request.get(
          `${api}/settings/directory/entries/${summary.entryId}`,
        )
      ).json();
      const rawId = crypto.randomUUID();
      const id = `${rawId.slice(0, 14)}7${rawId.slice(15)}`;
      const save = await admitted(() =>
        page.request.put(`${api}/drafts/${id}`, {
          data: {
            workflow: "shop.directory",
            schemaVersion: 1,
            payload: {
              entryId: r.entryId,
              baseVersion: r.version,
              baseRevisionId: r.id,
              content: {
                ...r.content,
                label: "SYNTHETIC concurrent",
                active: false,
              },
            },
          },
          headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
        }),
      );
      expect(save.status()).toBe(200);
      expect(
        (
          await admitted(() =>
            page.request.post(`${api}/drafts/${id}/promote`, {
              data: {},
              headers: {
                Origin: origin,
                "Idempotency-Key": crypto.randomUUID(),
                "If-Match": '"v1"',
              },
            }),
          )
        ).status(),
      ).toBe(200);
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.review,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.publish,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", { name: shopDirectoryMessages.en.conflict }),
      ).toBeVisible();
      await arrived(
        page.getByRole("heading", {
          name: shopDirectoryMessages.en.conflict,
          exact: true,
        }),
      );
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.compare,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: shopDirectoryMessages.en.yours,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("SYNTHETIC concurrent", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.rebase,
          exact: true,
        })
        .click();
      await arrived(editorHeading());
      await saved();
      await publish(shopDirectoryMessages.en);
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.cancel,
          exact: true,
        })
        .click();
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const t = shopDirectoryMessages[locale];
        await page
          .getByRole("button", { name: t.refresh, exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: t.title, exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        await mkdir(".scratch/shop-directory-captures", { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `.scratch/shop-directory-captures/${info.project.name}-${locale}.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
      await page
        .locator(".directory-list > li")
        .filter({ hasText: "SYNTHETIC my stale changes" })
        .getByRole("button", {
          name: shopDirectoryMessages.en.detail,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.history,
          exact: true,
        })
        .click();
      const historyRegion = page.getByRole("region", {
        name: shopDirectoryMessages.en.history,
        exact: true,
      });
      await arrived(historyRegion.getByRole("heading"));
      await expect(historyRegion.locator("details")).toHaveCount(3);
      await expect(historyRegion.locator("details[open]")).toHaveCount(0);
      await historyRegion.locator("summary").first().click();
      await expect(historyRegion.locator("details[open]")).toHaveCount(1);
      await expect(
        page.getByRole("region", {
          name: shopDirectoryMessages.en.history,
          exact: true,
        }),
      ).toContainText("synthetic@invalid");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.scratch/shop-directory-captures/${info.project.name}-en-history.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", {
          name: shopDirectoryMessages.en.edit,
          exact: true,
        })
        .click();
      await arrived(editorHeading());
      await expect(historyRegion).toHaveCount(0);
      await page.screenshot({
        path: `.scratch/shop-directory-captures/${info.project.name}-en-arrival.png`,
      });
      await saved();
      for (const locale of ["en", "ta"]) {
        if (locale === "ta") {
          const savedId = new URL(page.url()).searchParams.get("draft");
          await page.reload();
          await expect(page.locator("#directory-upiId")).toHaveValue(
            "synthetic@invalid",
          );
          await prepareOwnerScreen(page, locale);
          const t = shopDirectoryMessages.ta;
          await page
            .getByRole("button", { name: t.cancel, exact: true })
            .click();
          await page
            .locator(".directory-list > li")
            .filter({ hasText: "SYNTHETIC my stale changes" })
            .getByRole("button", { name: t.detail, exact: true })
            .click();
          await arrived(
            page
              .getByRole("region", { name: t.detail, exact: true })
              .getByRole("heading"),
          );
          await page
            .getByRole("region", { name: t.drafts, exact: true })
            .getByRole("button", { name: new RegExp(`^${t.resume}`) })
            .last()
            .click();
          await arrived(editorHeading(locale));
          expect(new URL(page.url()).searchParams.get("draft")).toBe(savedId);
          await expect(page.locator("#directory-label")).toHaveValue(
            "SYNTHETIC my stale changes",
          );
          await expect(page.locator("#directory-upiId")).toHaveValue(
            "synthetic@invalid",
          );
          await page.screenshot({
            path: `.scratch/shop-directory-captures/${info.project.name}-${locale}-arrival.png`,
          });
          await saved(t);
        } else await prepareOwnerScreen(page, locale);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `.scratch/shop-directory-captures/${info.project.name}-${locale}-editor.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page.locator("#directory-label")).toHaveCount(0);
      await expectStaticPwaStorage(page);
    },
    {
      secrets: [password, "synthetic-wrong-password"],
      onFailure: () => page.goto("about:blank"),
    },
  );
});
