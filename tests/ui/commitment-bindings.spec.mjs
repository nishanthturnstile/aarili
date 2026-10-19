import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { shopCommitmentsMessages } from "@aarili/i18n";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedCommitmentBindingReview } from "../../scripts/test-support/commitment-bindings.mjs";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
test("ST-07–12 binding review, bilingual warnings/unknowns, exact-key loss, reload, conflict, cancel, history and unavailable sources", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(360000);
  // ST-11's reviewed desktop acceptance height; retain the incumbent shared config.
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 900 });
  console.info(
    "#101 acceptance viewport",
    info.project.name,
    JSON.stringify(page.viewportSize()),
  );
  await withOwnerWeb(async ({ origin, setupToken, code }) => {
    let limitedUntil = 0;
    page.on("response", async (r) => {
      if (r.status() === 429)
        limitedUntil =
          Date.now() + Number(r.headers()["retry-after"] ?? 60) * 1000 + 150;
      if (
        r.request().method() === "PUT" &&
        r.url().includes("/drafts/") &&
        r.status() >= 400
      ) {
        const b = await r.json().catch(() => null);
        console.info("#101 draft failure", r.status(), b?.error?.code);
      }
    });
    const waitLimit = async () => {
      const remaining = limitedUntil - Date.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
    };
    const en = shopCommitmentsMessages.en;
    async function request(
      path,
      body,
      extra = {},
      method = body ? "POST" : "GET",
    ) {
      const run = () =>
        page.request.fetch(`${origin}/api${path}`, {
          method,
          headers: { Origin: origin, ...extra },
          ...(body ? { data: body } : {}),
        });
      let r = await run();
      if (r.status() === 429) {
        await page.waitForTimeout(
          Number(r.headers()["retry-after"]) * 1000 + 150,
        );
        r = await run();
      }
      expect(r.status(), await r.text()).toBe(200);
      return r.json();
    }
    const email = "bindings@example.test",
      password = "synthetic-bindings-101-review-password";
    await request(
      "/owner/setup",
      { name: "SYNTHETIC binding owner", email, password },
      { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
    );
    await request("/owner/verify", { code: await code() });
    await request("/auth/sign-in/email", { email, password });
    await request(
      "/owner/complete",
      { shopName: "SYNTHETIC binding review" },
      { "Idempotency-Key": randomUUID() },
    );
    const { shopId } = await request("/owner/shop"),
      seed = await seedCommitmentBindingReview(request, shopId),
      api = `/shops/${shopId}`;
    const url = `${origin}/settings?section=commitments&draft=${seed.draftId}`;
    const panel = () =>
      page.getByRole("region", { name: en.bindingTitle, exact: true });
    const button = (name) => panel().getByRole("button", { name, exact: true });
    const editor = () =>
      panel().getByRole("region", { name: en.bindingEditor, exact: true });
    await page.route("**/settings/commitments/revisions/*", (route) =>
      route.abort("failed"),
    );
    await page.goto(url);
    await expect(
      editor().getByRole("button", { name: en.retryLoad, exact: true }),
    ).toBeVisible();
    await expect(button(en.bindingReview)).toBeDisabled();
    await page.unroute("**/settings/commitments/revisions/*");
    await editor()
      .getByRole("button", { name: en.retryLoad, exact: true })
      .click();
    await expect(button(en.bindingReview)).toBeEnabled();
    await expect(page.locator("#binding-reason")).toHaveValue(
      "SYNTHETIC second binding review",
    );
    await editor().locator("form").dispatchEvent("compositionstart");
    await page.locator("#binding-reason").fill("");
    await expect(button(en.bindingReview)).toBeDisabled();
    await page.locator("#binding-reason").fill("SYNTHETIC தமிழ் review");
    await page.getByLabel(en.bindingReviewValues, { exact: true }).check();
    await page.waitForTimeout(1100);
    const draftBefore = await request(`${api}/drafts/${seed.draftId}`);
    expect(draftBefore.payload.reason).toBe("SYNTHETIC second binding review");
    let lost = true;
    const keys = [];
    await page.route("**/drafts/*", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      if (lost) {
        lost = false;
        const r = await route.fetch();
        expect(r.status()).toBe(200);
        return route.abort("failed");
      }
      return route.continue();
    });
    await editor().locator("form").dispatchEvent("compositionend");
    await expect(button(en.retry)).toBeVisible();
    await button(en.retry).click();
    await expect(
      editor()
        .getByRole("status")
        .filter({ hasText: new RegExp(`^${en.saved}$`) }),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await page.unroute("**/drafts/*");
    await page.reload();
    await expect(page.locator("#binding-reason")).toHaveValue(
      "SYNTHETIC தமிழ் review",
    );
    const other = await browser.newContext({
        storageState: await page.context().storageState(),
      }),
      second = await other.newPage();
    await second.goto(url);
    await expect(second.locator("#binding-reason")).toHaveValue(
      "SYNTHETIC தமிழ் review",
    );
    await other.close();
    // Dirty cancel preserves memory when dismissed, then returns to the saved values.
    await editor().locator("form").dispatchEvent("compositionstart");
    await page.locator("#binding-reason").fill("SYNTHETIC unsaved");
    page.once("dialog", (d) => d.dismiss());
    await button(en.cancelEditing).click();
    await expect(page.locator("#binding-reason")).toHaveValue(
      "SYNTHETIC unsaved",
    );
    // A second command changes the durable draft while local IME composition is paused.
    const saved = await request(`${api}/drafts/${seed.draftId}`);
    await request(
      `${api}/drafts/${seed.draftId}`,
      {
        workflow: saved.workflow,
        schemaVersion: 1,
        payload: { ...saved.payload, reason: "SYNTHETIC concurrent review" },
      },
      { "Idempotency-Key": randomUUID(), "If-Match": `"v${saved.version}"` },
      "PUT",
    );
    let saveConflict = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().endsWith(`/drafts/${seed.draftId}`),
    );
    await editor().locator("form").dispatchEvent("compositionend");
    let conflictResponse = await saveConflict;
    if (conflictResponse.status() === 429) {
      await waitLimit();
      saveConflict = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.url().endsWith(`/drafts/${seed.draftId}`),
      );
      await button(en.saveDraft).click();
      conflictResponse = await saveConflict;
    }
    expect(conflictResponse.status(), await conflictResponse.text()).toBe(412);
    await expect(
      editor().getByRole("heading", { name: en.conflict, exact: true }),
    ).toBeVisible();
    await button(en.compare).click();
    await expect(button(en.useServer)).toBeVisible();
    await button(en.useServer).click();
    await expect(page.locator("#binding-reason")).toHaveValue(
      "SYNTHETIC concurrent review",
    );
    async function capture(state) {
      await mkdir(".impeccable/review", { recursive: true });
      for (const locale of ["en", "ta"]) {
        await prepareOwnerScreen(page, locale);
        const t = shopCommitmentsMessages[locale];
        const region = page.getByRole("region", {
          name: t.bindingTitle,
          exact: true,
        });
        await expect(region).toBeVisible();
        await expect(page.getByText(t.boundary, { exact: true })).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.impeccable/review/bindings-${info.project.name}-${locale}-${state}.png`,
          fullPage: true,
        });
      }
      await prepareOwnerScreen(page, "en");
    }
    await button(en.bindingReview).click();
    await waitLimit();
    let publication = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
    );
    await button(en.bindingPublish).click();
    let publicationResponse = await publication;
    if (publicationResponse.status() === 429) {
      await waitLimit();
      publication = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith("/promote"),
      );
      await button(en.bindingPublish).click();
      publicationResponse = await publication;
    }
    expect(publicationResponse.status(), await publicationResponse.text()).toBe(
      200,
    );
    await expect(
      editor()
        .getByRole("status")
        .filter({ hasText: new RegExp(`^${en.promoted}$`) }),
    ).toBeVisible();
    await expect(page.locator("#binding-reason")).toBeDisabled();
    const binding = (
      await request(
        `${api}/settings/commitments/bindings/${seed.category.entryId}`,
      )
    ).revision;
    expect(binding.authority).toBe("synthetic-fixture");
    const preview = panel().locator(".commitment-preview");
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/bound-preview"),
    );
    await preview
      .getByRole("button", { name: en.preview, exact: true })
      .click();
    const p = await (await response).json();
    expect(p.warnings).toContain("rush");
    expect(p.unknowns).toContain("loadMissing");
    expect(p.unknowns).toContain("candidateDemandMissing");
    expect(p.authority).toBe("pending");
    expect(p.facts.warningWindow).toBe(7);
    expect(p.activation).toBe("unavailable");
    expect(p.effects).toBe("none");
    await capture("warnings-unknowns");
    // Acknowledged saves immediately populate the list; closing never needs a
    // page reload to resume, and promoted drafts leave the active list.
    await button(en.cancelEditing).click();
    await expect(
      panel().getByRole("button", { name: new RegExp(`^${en.bindingResume}`) }),
    ).toHaveCount(0);
    await button(en.bindingNew).click();
    await page.locator("#binding-reason").fill("SYNTHETIC same-session resume");
    let freshSave = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" && r.url().includes(`${api}/drafts/`),
    );
    await button(en.saveDraft).click();
    let freshResponse = await freshSave;
    if (freshResponse.status() === 429) {
      await waitLimit();
      freshSave = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" && r.url().includes(`${api}/drafts/`),
      );
      await button(en.saveDraft).click();
      freshResponse = await freshSave;
    }
    expect(freshResponse.status(), await freshResponse.text()).toBe(200);
    await expect(
      editor()
        .getByRole("status")
        .filter({ hasText: new RegExp(`^${en.saved}$`) }),
    ).toBeVisible();
    const savedBindingUrl = page.url();
    await button(en.cancelEditing).click();
    await expect(page.locator("#binding-reason")).toHaveCount(0);
    const resume = panel().getByRole("button", {
      name: new RegExp(`^${en.bindingResume}`),
    });
    await expect(resume).toHaveCount(1);
    await resume.click();
    await expect(page.locator("#binding-reason")).toHaveValue(
      "SYNTHETIC same-session resume",
    );
    expect(page.url()).toBe(savedBindingUrl);
    await button(en.cancelEditing).click();
    await button(en.bindingHistory).click();
    await panel()
      .getByRole("button")
      .filter({
        hasText: new RegExp(`^${en.version.replace("{version}", "1")}`),
      })
      .first()
      .click();
    await expect(
      panel().getByRole("region", { name: en.bindingHistorical, exact: true }),
    ).toBeVisible();
    await capture("history");
    // Disable canonical new selection. Bound preview fails stale and history remains readable.
    const v = randomUUID(),
      retireId = `${v.slice(0, 14)}7${v.slice(15)}`;
    await request(
      `${api}/drafts/${retireId}`,
      {
        workflow: "service.catalogue",
        schemaVersion: 1,
        payload: {
          entryId: seed.category.entryId,
          baseVersion: seed.category.version,
          baseRevisionId: seed.category.id,
          operation: "availability",
          available: false,
          reason: "SYNTHETIC unavailable review",
          content: seed.category.definition.content,
        },
      },
      { "Idempotency-Key": randomUUID() },
      "PUT",
    );
    await request(
      `${api}/drafts/${retireId}/promote`,
      {},
      { "Idempotency-Key": randomUUID(), "If-Match": '"v1"' },
    );
    const staleResponse = page.waitForResponse((r) =>
      r.url().endsWith("/bound-preview"),
    );
    await preview
      .getByRole("button", { name: en.preview, exact: true })
      .click();
    expect((await staleResponse).status()).toBe(409);
    await expect(preview.getByRole("alert")).toBeVisible();
    await button(en.bindingSearch).click();
    await panel()
      .getByRole("button", {
        name: new RegExp(`SYNTHETIC blouse.*${en.bindingUnavailable}`),
      })
      .click();
    await expect(button(en.bindingNew)).toBeDisabled();
    await button(en.bindingHistory).click();
    await panel()
      .getByRole("button")
      .filter({
        hasText: new RegExp(`^${en.version.replace("{version}", "1")}`),
      })
      .first()
      .click();
    await expect(
      panel().getByRole("region", { name: en.bindingHistorical, exact: true }),
    ).toBeVisible();
    await capture("unavailable");
    await expectStaticPwaStorage(page);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) =>
          /binding|commitment|draft/i.test(k),
        ),
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/sign-in/);
    await page.goBack();
    await expect(page.locator("#binding-reason")).toHaveCount(0);
  });
});
