import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
const occurredAt = new Date(Date.now() - 60000).toISOString();
const statementTime = new Date(occurredAt);
const localOccurredAt = new Date(
  statementTime.getTime() - statementTime.getTimezoneOffset() * 60000,
)
  .toISOString()
  .slice(0, 16);
const preferences = {
  language: "",
  channel: "",
  fit: "",
  style: "",
  delivery: "",
  source: "",
};

// Setup writes may wait for the real admission window. UI writes below always
// surface 429 and require an explicit user retry; no transport retries hide it.
async function fixture(page, origin, setupToken, code) {
  async function send(method, path, data, headers = {}) {
    const options = { data, headers: { Origin: origin, ...headers } };
    let response = await page.request[method](`${origin}/api${path}`, options);
    if (response.status() === 429) {
      const seconds = Number(response.headers()["retry-after"]);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(60);
      await page.waitForTimeout(seconds * 1000 + 100);
      response = await page.request[method](`${origin}/api${path}`, options);
    }
    expect(response.status()).toBe(200);
    return response.json();
  }
  const password = "synthetic-wearer-owner-password-79";
  await send(
    "post",
    "/owner/setup",
    {
      name: "Synthetic owner",
      email: "owner@example.test",
      password,
    },
    { "X-Setup-Token": setupToken, "Idempotency-Key": crypto.randomUUID() },
  );
  await send("post", "/owner/verify", { code: await code() });
  await send("post", "/auth/sign-in/email", {
    email: "owner@example.test",
    password,
  });
  await send(
    "post",
    "/owner/complete",
    { shopName: "Synthetic wearer shop" },
    { "Idempotency-Key": crypto.randomUUID() },
  );
  const { shopId } = await (
    await page.request.get(`${origin}/api/owner/shop`)
  ).json();
  const policy = await (
    await page.request.get(`${origin}/api/shops/${shopId}/customers/policy`)
  ).json();
  const customerPath = `/shops/${shopId}/customers`;
  async function customer(displayName) {
    const result = await send(
      "post",
      customerPath,
      {
        displayName,
        phone: "+1 202 555 0101",
        aliases: [],
        serviceEvidence: {
          noticeId: policy.notice.id,
          language: "en",
          decision: "grant",
          giver: "self",
          noticeExplained: true,
          source: "in-person",
          occurredAt,
        },
      },
      { "Idempotency-Key": crypto.randomUUID() },
    );
    return (
      await page.request.get(
        `${origin}/api${customerPath}/${result.customerId}`,
      )
    ).json();
  }
  function relationship(personId, kind = "self") {
    return {
      kind,
      statementByPersonId: personId,
      authorised: true,
      informed: true,
      source: "in-person",
      occurredAt,
      interaction: "Synthetic tailoring-service interaction",
    };
  }
  async function wearer(customer, mode = "self", displayName) {
    const path = `${customerPath}/${customer.id}/wearers`;
    const result = await send(
      "post",
      path,
      {
        mode,
        ...(displayName ? { displayName } : {}),
        age: "adult",
        preferences,
        relationship: relationship(
          customer.personId,
          mode === "self" ? "self" : "family",
        ),
      },
      { "Idempotency-Key": crypto.randomUUID() },
    );
    return (
      await page.request.get(`${origin}/api${path}/${result.wearerId}`)
    ).json();
  }
  return { shopId, policy, send, customer, wearer, relationship, customerPath };
}

async function apiWearers(page, origin, shopId, customerId) {
  return (
    await (
      await page.request.get(
        `${origin}/api/shops/${shopId}/customers/${customerId}/wearers`,
      )
    ).json()
  ).wearers;
}

// A visible retry is exercised after an actual rate-limit response. The request
// remains under UI ownership, including the original key after response loss.
async function uiWrite(page, button, matches, retry = button) {
  const pending = page.waitForResponse((r) => matches(r) && r.status() !== 0);
  await button.click();
  let response = await pending;
  if (response.status() === 429) {
    const seconds = Number(response.headers()["retry-after"]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /Wait|saved|request/i })
        .first(),
    ).toBeVisible();
    await page.waitForTimeout(seconds * 1000 + 100);
    const repeated = page.waitForResponse(matches);
    await retry.click();
    response = await repeated;
  }
  return response;
}

async function fillRegistration(page, mode, name) {
  const form = page.locator(
    "section[aria-labelledby='wearer-form-heading'] form",
  );
  await form.dispatchEvent("compositionstart");
  await page.locator("#wearer-mode").selectOption(mode);
  if (mode === "new") await page.locator("#wearer-name").fill(name);
  if (mode !== "existing")
    await page.locator("#wearer-age").selectOption("adult");
  await page
    .locator("#wearer-interaction")
    .fill("Synthetic current interaction");
  await form.getByRole("checkbox").nth(0).check();
  await form.getByRole("checkbox").nth(1).check();
  await page.locator("#wearer-source").selectOption("in-person");
  await page.locator("#wearer-occurred").fill(localOccurredAt);
  await form.dispatchEvent("compositionend");
}

async function saveDraft(page, shopId) {
  const response = await page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      r.url().includes(`/api/shops/${shopId}/drafts/`),
  );
  if (response.status() === 429) {
    await page.waitForTimeout(
      Number(response.headers()["retry-after"]) * 1000 + 100,
    );
    const retried = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().includes(`/api/shops/${shopId}/drafts/`),
    );
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    expect((await retried).status()).toBe(200);
  } else expect(response.status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Register wearer", exact: true }),
  ).toBeEnabled();
}

test("CW-03/04/05/12/13 explicit self, separate adult and existing wearer; connected drafts, IME, reload, resume and lost promotion replay", async ({
  page,
  context,
}, info) => {
  test.setTimeout(240000);
  const canary = "Synthetic-Private-CW79-Registration";
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      const f = await fixture(page, origin, setupToken, code);
      const contact = await f.customer(`மீனா ${canary}`);
      const secondContact = await f.customer("Synthetic second contact");
      await page.goto(`${origin}/customers/${contact.id}`);
      await page
        .getByRole("button", { name: "Add wearer", exact: true })
        .click();
      await expect(page.locator("#wearer-form-heading")).toBeFocused();
      await expect(page.locator("#wearer-mode")).toHaveValue("");
      await page.locator("#wearer-mode").selectOption("new");
      await expect(page.locator("#wearer-age")).toHaveValue("");
      const form = page.locator(
        "section[aria-labelledby='wearer-form-heading'] form",
      );
      await form.dispatchEvent("compositionstart");
      await page.locator("#wearer-name").fill(`மீனா ${canary}`);
      await page.waitForTimeout(1100);
      // IME composition never commits a half-composed name.
      expect(new URL(page.url()).search).toBe("");
      expect(await apiWearers(page, origin, f.shopId, contact.id)).toEqual([]);
      await form.getByRole("checkbox").nth(0).check();
      await form.getByRole("checkbox").nth(1).check();
      await form.getByRole("checkbox").nth(2).check();
      await form.getByRole("checkbox").nth(3).check();
      await expect(form.getByRole("checkbox").nth(0)).not.toBeChecked();
      await expect(form.getByRole("checkbox").nth(1)).not.toBeChecked();
      await page.locator("#wearer-mode").selectOption("self");
      await expect(form.getByRole("checkbox").nth(0)).not.toBeChecked();
      await expect(form.getByRole("checkbox").nth(1)).not.toBeChecked();
      await expect(form.getByRole("checkbox").nth(2)).not.toBeChecked();
      await expect(form.getByRole("checkbox").nth(3)).not.toBeChecked();
      const firstSave = saveDraft(page, f.shopId);
      await fillRegistration(page, "self");
      await firstSave;
      const draftId = new URL(page.url()).searchParams.get("draft");
      expect(draftId).toMatch(/^[0-9a-f-]{36}$/);
      expect(await apiWearers(page, origin, f.shopId, contact.id)).toEqual([]);
      await page.reload();
      await expect(page.locator("#wearer-mode")).toHaveValue("self");
      await expect(page.locator("#wearer-interaction")).toHaveValue(
        "Synthetic current interaction",
      );
      await page
        .getByRole("button", { name: "Close form", exact: true })
        .click();
      expect(new URL(page.url()).search).toBe("");
      await page.getByRole("button", { name: /^Resume draft:/ }).click();
      await expect(page.locator("#wearer-mode")).toHaveValue("self");
      const attempts = [];
      let lose = true;
      await page.route(
        `**/api/shops/${f.shopId}/drafts/${draftId}/promote`,
        async (route) => {
          attempts.push({
            key: route.request().headers()["idempotency-key"],
            body: route.request().postData(),
          });
          const response = await route.fetch();
          if (lose && response.status() === 200) {
            lose = false;
            await route.abort("failed");
          } else await route.fulfill({ response });
        },
      );
      await page
        .getByRole("button", { name: "Register wearer", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Try again", exact: true }),
      ).toBeVisible();
      await expect(page.locator("#wearer-mode")).toBeDisabled();
      expect(await apiWearers(page, origin, f.shopId, contact.id)).toHaveLength(
        1,
      );
      await uiWrite(
        page,
        page.getByRole("button", { name: "Try again", exact: true }),
        (r) => r.url().endsWith(`/drafts/${draftId}/promote`),
      );
      const [self] = await apiWearers(page, origin, f.shopId, contact.id);
      await expect(
        page.getByRole("button", {
          name: `Select wearer: ${contact.displayName} (${self.id.slice(-8)})`,
          exact: true,
        }),
      ).toBeVisible();
      expect(attempts[0]).toEqual(attempts[1]);
      expect(self.personId).toBe(contact.personId);
      expect(self.purposes).toEqual([]);
      await page
        .getByRole("button", { name: "Close form", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Add wearer", exact: true })
        .click();
      const nextSave = saveDraft(page, f.shopId);
      await fillRegistration(page, "new", contact.displayName);
      await nextSave;
      await page
        .getByText("Expressed preferences (optional)", { exact: true })
        .click();
      for (const locale of ["en", "ta"])
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
          await expect(page.locator("#wearer-name")).toHaveValue(
            contact.displayName,
          );
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          await page.setViewportSize({ width: 320, height: 900 });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "";
          });
          await page.setViewportSize(info.project.use.viewport);
          await page.screenshot({
            path: `.scratch/wearer-review/${info.project.name}-${locale}-${dark ? "dark" : "light"}-draft.png`,
            fullPage: true,
          });
        }
      await prepareOwnerScreen(page, "en", false);
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", { name: "Register wearer", exact: true }),
            (r) => r.url().endsWith("/promote"),
            page.getByRole("button", { name: "Register wearer", exact: true }),
          )
        ).status(),
      ).toBe(200);
      await expect(
        page.locator(".wearer-workspace > .wearer-choices > li"),
      ).toHaveCount(2);
      const pair = await apiWearers(page, origin, f.shopId, contact.id);
      expect(new Set(pair.map((p) => p.personId)).size).toBe(2);
      expect(pair.map((p) => p.displayName)).toEqual([
        contact.displayName,
        contact.displayName,
      ]);
      const separate = pair.find((p) => p.personId !== contact.personId);
      await page
        .getByRole("button", { name: "Close form", exact: true })
        .click();
      await page.goto(`${origin}/customers/${secondContact.id}`);
      await page
        .getByRole("button", { name: "Add wearer", exact: true })
        .click();
      const existingForm = page.locator(
        "section[aria-labelledby='wearer-form-heading'] form",
      );
      await existingForm.dispatchEvent("compositionstart");
      await page.locator("#wearer-mode").selectOption("existing");
      await page.locator("#wearer-search").fill(contact.displayName);
      await existingForm
        .getByRole("button", { name: "Search", exact: true })
        .click();
      await expect(existingForm.locator(".wearer-choices li")).toHaveCount(2);
      // Both identical names remain explicit choices; choose the separate identity.
      const index = pair.findIndex((p) => p.id === separate.id);
      await existingForm.locator(".wearer-choices button").nth(index).click();
      await expect(existingForm.getByRole("checkbox").nth(0)).not.toBeChecked();
      await expect(existingForm.getByRole("checkbox").nth(1)).not.toBeChecked();
      await page
        .locator("#wearer-interaction")
        .fill("Explicit existing wearer link");
      await page.locator("#wearer-source").selectOption("phone");
      await page.locator("#wearer-occurred").fill(localOccurredAt);
      const linkSave = saveDraft(page, f.shopId);
      await existingForm.dispatchEvent("compositionend");
      await linkSave;
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", { name: "Register wearer", exact: true }),
            (r) => r.url().endsWith("/promote"),
          )
        ).status(),
      ).toBe(200);
      const [linked] = await apiWearers(
        page,
        origin,
        f.shopId,
        secondContact.id,
      );
      expect(linked.id).toBe(separate.id);
      expect(linked.personId).toBe(separate.personId);
      expect(linked.relationship.authorised).toBe(false);
      expect(linked.relationship.informed).toBe(false);
      expect(linked.purposes).toEqual([]);
      expect(new URL(page.url()).href).not.toContain(canary);
      await context.setOffline(false);
    },
    {
      secrets: [canary],
      onFailure: async () => {
        await context.setOffline(false);
        await page.goto("about:blank");
      },
    },
  );
});

test("CW-04/05/07/08/11/13 subject-bound purpose refusal/withdrawal, corrections, offline retention, stale drafts and private access clearing", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  const canary = "Synthetic-Private-CW79-Permissions";
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      const f = await fixture(page, origin, setupToken, code);
      const contact = await f.customer(`Synthetic contact ${canary}`);
      const self = await f.wearer(contact);
      const other = await f.wearer(
        contact,
        "new",
        `Synthetic second ${canary}`,
      );
      const wearerPath = `${f.customerPath}/${contact.id}/wearers`;
      await page.goto(`${origin}/customers/${contact.id}`);
      await page
        .getByRole("button", {
          name: `Select wearer: ${self.displayName} (${self.id.slice(-8)})`,
          exact: true,
        })
        .click();
      await expect(page.locator("#selected-wearer-heading")).toHaveText(
        `Selected wearer: ${self.displayName}`,
      );
      await expect(page.locator("#wearer-purpose")).toHaveValue("");
      await expect(page.locator("#wearer-decision")).toHaveValue("");
      async function purpose(kind, decision) {
        const saved = (
          await apiWearers(page, origin, f.shopId, contact.id)
        ).find((p) => p.id === self.id);
        await expect(
          page.locator(".wearer-selected > dl").first().locator("dd").nth(1),
        ).toHaveText(String(saved.version));
        await page.locator("#wearer-purpose").selectOption(kind);
        await page.locator("#wearer-decision").selectOption(decision);
        await page.locator("#wearer-notice-language").selectOption("ta");
        await page.locator("#wearer-choice-source").selectOption("in-person");
        await page.locator("#wearer-choice-at").fill(localOccurredAt);
        await page
          .locator(
            "section[aria-labelledby='wearer-purpose-heading'] input[type='checkbox']",
          )
          .check();
      }
      await purpose("marketing", "grant");
      page.on("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", {
          name: `Select wearer: ${other.displayName} (${other.id.slice(-8)})`,
          exact: true,
        })
        .click();
      await expect(page.locator("#wearer-purpose")).toHaveValue("");
      await expect(
        page.locator(
          "section[aria-labelledby='wearer-purpose-heading'] input[type='checkbox']",
        ),
      ).not.toBeChecked();
      expect(
        (await apiWearers(page, origin, f.shopId, contact.id)).every(
          (p) => p.purposes.length === 0,
        ),
      ).toBe(true);
      await page
        .getByRole("button", {
          name: `Select wearer: ${self.displayName} (${self.id.slice(-8)})`,
          exact: true,
        })
        .click();
      await purpose("marketing", "refusal");
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record purpose choice",
              exact: true,
            }),
            (r) => r.url().endsWith(`/wearers/${self.id}/consent-events`),
          )
        ).status(),
      ).toBe(200);
      await expect(page.locator("#wearer-purpose")).toHaveValue("");
      let current = (await apiWearers(page, origin, f.shopId, contact.id)).find(
        (p) => p.id === self.id,
      );
      expect(
        current.purposes.find((p) => p.purpose === "marketing").decision,
      ).toBe("refusal");
      await purpose("service", "grant");
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record purpose choice",
              exact: true,
            }),
            (r) => r.url().endsWith(`/wearers/${self.id}/consent-events`),
          )
        ).status(),
      ).toBe(200);
      await expect(page.locator("#wearer-purpose")).toHaveValue("");
      await purpose("service", "withdrawal");
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record purpose choice",
              exact: true,
            }),
            (r) => r.url().endsWith(`/wearers/${self.id}/consent-events`),
          )
        ).status(),
      ).toBe(200);
      await expect(page.locator("#wearer-purpose")).toHaveValue("");
      current = (await apiWearers(page, origin, f.shopId, contact.id)).find(
        (p) => p.id === self.id,
      );
      expect(
        current.purposes.find((p) => p.purpose === "service").decision,
      ).toBe("withdrawal");
      expect(
        current.purposes.find((p) => p.purpose === "service").giverPersonId,
      ).toBe(self.personId);
      expect(
        current.purposes.find((p) => p.purpose === "service").previousId,
      ).not.toBeNull();
      expect(
        (await apiWearers(page, origin, f.shopId, contact.id)).find(
          (p) => p.id === other.id,
        ).purposes,
      ).toEqual([]);
      await page
        .getByRole("button", {
          name: "Correct age, relationship or preferences",
          exact: true,
        })
        .click();
      await page
        .locator("#wearer-correct-reason")
        .fill("SYNTHETIC preference correction");
      await page
        .locator("#wearer-correct-pref-fit")
        .fill("Original expressed preference retained");
      await page
        .locator("#wearer-correct-pref-source")
        .fill("Wearer in person");
      await context.setOffline(true);
      await page
        .getByRole("button", { name: "Save correction", exact: true })
        .click();
      await expect(page.locator(".wearer-selected")).toContainText("offline");
      await expect(page.locator("#wearer-correct-pref-fit")).toHaveValue(
        "Original expressed preference retained",
      );
      await context.setOffline(false);
      // A real competing correction makes the open proposal stale.
      const {
        id: _relationshipId,
        customerId: _customerId,
        ...statement
      } = current.relationship;
      await f.send(
        "patch",
        `${wearerPath}/${self.id}`,
        {
          age: current.age,
          reason: "SYNTHETIC competing preference correction",
          preferences: {
            ...current.preferences,
            fit: "Concurrent saved preference",
            source: "Wearer by phone",
          },
          relationship: statement,
        },
        {
          "Idempotency-Key": crypto.randomUUID(),
          "If-Match": `"v${current.version}"`,
        },
      );
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", { name: "Save correction", exact: true }),
            (r) =>
              r.request().method() === "PATCH" &&
              r.url().endsWith(`/wearers/${self.id}`),
          )
        ).status(),
      ).toBe(412);
      await expect(page.locator("#wearer-correct-pref-fit")).toHaveValue(
        "Original expressed preference retained",
      );
      await page
        .getByRole("button", { name: "Reload saved version", exact: true })
        .click();
      await expect(page.locator(".wearer-selected")).toContainText(
        "Concurrent saved preference",
      );
      await page
        .getByRole("button", { name: "Add wearer", exact: true })
        .click();
      const draftSave = saveDraft(page, f.shopId);
      await fillRegistration(page, "new", "Synthetic stale draft person");
      await draftSave;
      // Stale customer context must be checked again at authoritative promotion.
      await f.send(
        "patch",
        `${f.customerPath}/${contact.id}`,
        {
          displayName: contact.displayName,
          phone: contact.phone,
          aliases: [],
          notes: "Concurrent customer correction",
          reason: "SYNTHETIC stale contact context",
        },
        {
          "Idempotency-Key": crypto.randomUUID(),
          "If-Match": `"v${contact.version}"`,
        },
      );
      const rejected = await uiWrite(
        page,
        page.getByRole("button", { name: "Register wearer", exact: true }),
        (r) => r.url().endsWith("/promote"),
      );
      expect([409, 412]).toContain(rejected.status());
      expect(await apiWearers(page, origin, f.shopId, contact.id)).toHaveLength(
        2,
      );
      await expect(page.locator("#wearer-name")).toHaveValue(
        "Synthetic stale draft person",
      );
      await page
        .getByRole("button", { name: "Close form", exact: true })
        .click();
      await expectStaticPwaStorage(page);
      expect(
        await page.evaluate(() =>
          JSON.stringify({
            local: { ...localStorage },
            session: { ...sessionStorage },
          }),
        ),
      ).not.toContain(canary);
      for (const path of [
        "/sign-in",
        "/offline.html",
        "/manifest.webmanifest",
        "/sw.js",
      ])
        expect(
          await (await page.request.get(`${origin}${path}`)).text(),
        ).not.toContain(canary);
      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      await page.route(
        `**/api/shops/${f.shopId}/customers/${contact.id}/wearers`,
        async (route) => {
          const response = await route.fetch();
          await held;
          await route.fulfill({ response }).catch(() => {});
        },
      );
      const late = page.waitForRequest((r) =>
        r.url().endsWith(`/customers/${contact.id}/wearers`),
      );
      await page
        .getByRole("button", { name: "Refresh drafts", exact: true })
        .click();
      await late;
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/sign-in`);
      release();
      await expect(page.locator("body")).not.toContainText(canary);
    },
    {
      secrets: [canary],
      onFailure: async () => {
        await context.setOffline(false);
        await page.goto("about:blank");
      },
    },
  );
});
