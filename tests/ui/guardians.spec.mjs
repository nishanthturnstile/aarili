import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import {
  expectStaticPwaStorage,
  prepareOwnerScreen,
} from "./owner-presentation.mjs";

test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });
const occurredAt = new Date(Date.now() - 60000).toISOString();
const stamp = new Date(occurredAt);
const localTime = new Date(stamp.getTime() - stamp.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16);
const scope = "measurement-and-private-photo";
const workspace = (page) =>
  page.locator("section[aria-labelledby='guardian-heading']");

async function seed(page, origin, setupToken, code, canary, confirmed = false) {
  async function send(method, path, data, extra = {}) {
    const options = { data, headers: { Origin: origin, ...extra } };
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
  const password = "synthetic-guardian-owner-password-80";
  await send(
    "post",
    "/owner/setup",
    { name: "Synthetic owner", email: "owner@example.test", password },
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
    { shopName: "Synthetic guardian shop" },
    { "Idempotency-Key": crypto.randomUUID() },
  );
  const { shopId } = await (
    await page.request.get(`${origin}/api/owner/shop`)
  ).json();
  const customerPath = `/shops/${shopId}/customers`;
  const customerPolicy = await (
    await page.request.get(`${origin}/api${customerPath}/policy`)
  ).json();
  const aunt = await send(
    "post",
    customerPath,
    {
      displayName: `செயற்கை அத்தை மீனா ${canary}`,
      phone: "+1 202 555 0101",
      serviceEvidence: {
        noticeId: customerPolicy.notice.id,
        language: "ta",
        decision: "grant",
        giver: "self",
        noticeExplained: true,
        source: "in-person",
        occurredAt,
      },
    },
    { "Idempotency-Key": crypto.randomUUID() },
  );
  const wearerPath = `${customerPath}/${aunt.customerId}/wearers`;
  const childName = `செயற்கை சிறார் காவியா ${canary}`;
  const relationship = {
    kind: "family",
    statementByPersonId: aunt.personId,
    authorised: true,
    informed: true,
    source: "in-person",
    occurredAt,
    interaction:
      "Synthetic aunt arranging tailoring; aunt is not the child's guardian",
  };
  const preferences = {
    language: "",
    channel: "",
    fit: "",
    style: "",
    delivery: "",
    source: "",
  };
  const child = await send(
    "post",
    wearerPath,
    {
      mode: "new",
      displayName: childName,
      age: "minor",
      preferences,
      relationship,
    },
    { "Idempotency-Key": crypto.randomUUID() },
  );
  const guardianPath = `${wearerPath}/${child.wearerId}/guardians`;
  const read = async () =>
    (await page.request.get(`${origin}/api${guardianPath}`)).json();
  const policy = await (
    await page.request.get(`${origin}/api/shops/${shopId}/guardians/policy`)
  ).json();
  if (confirmed) {
    await send(
      "post",
      guardianPath,
      {
        guardian: { mode: "new", displayName: `செயற்கை பெற்றோர் லதா ${canary}` },
        authority: "parent",
        scope,
        source: "in-person",
        occurredAt,
      },
      {
        "Idempotency-Key": crypto.randomUUID(),
        "If-Match": `"v${child.version}"`,
      },
    );
    const pending = await read();
    await send(
      "post",
      `${guardianPath}/verification-events`,
      {
        authorityId: pending.authority.id,
        status: "confirmed",
        method: "synthetic-review-v1",
        evidenceRef: "SYNTHETIC-ONLY-VERIFICATION-80",
        scope,
        source: "in-person",
        occurredAt,
      },
      {
        "Idempotency-Key": crypto.randomUUID(),
        "If-Match": `"v${pending.version}"`,
      },
    );
  }
  return {
    shopId,
    aunt,
    child,
    childName,
    guardianPath,
    wearerPath,
    relationship,
    preferences,
    policy,
    read,
    send,
  };
}

async function openChild(page, origin, f) {
  await page.goto(`${origin}/customers/${f.aunt.customerId}`);
  await page
    .getByRole("button", {
      name: `Select wearer: ${f.childName} (${f.child.wearerId.slice(-8)})`,
      exact: true,
    })
    .click();
  await expect(page.locator("#guardian-heading")).toBeVisible();
}

async function uiWrite(page, button, predicate, retry = button) {
  const pending = page.waitForResponse(predicate);
  await button.click();
  let response = await pending;
  if (response.status() === 429) {
    await expect(workspace(page).getByRole("alert").first()).toBeVisible();
    const seconds = Number(response.headers()["retry-after"]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
    await page.waitForTimeout(seconds * 1000 + 100);
    const again = page.waitForResponse(predicate);
    await retry.click();
    response = await again;
  }
  return response;
}

async function review(page, status) {
  if (!(await page.locator("#guardian-verification-status").isVisible()))
    await page
      .getByRole("button", { name: "Record authority review", exact: true })
      .click();
  await page.locator("#guardian-verification-status").selectOption(status);
  await page
    .locator("#guardian-verification-method")
    .selectOption(
      status === "confirmed" ? "synthetic-review-v1" : "not-verified",
    );
  await page
    .locator("#guardian-verification-evidence")
    .fill(status === "confirmed" ? "SYNTHETIC-ONLY-VERIFICATION-80" : "");
  await page.locator("#guardian-verification-scope").selectOption(scope);
  await page.locator("#guardian-verification-source").selectOption("in-person");
  await page.locator("#guardian-verification-occurred").fill(localTime);
}

async function purpose(page, kind, decision, giver, authorityId) {
  if (!(await page.locator("#guardian-purpose").isVisible()))
    await page
      .getByRole("button", { name: "Record guardian decision", exact: true })
      .click();
  await page.locator("#guardian-purpose-authority").selectOption(authorityId);
  await page.locator("#guardian-purpose").selectOption(kind);
  await page.locator("#guardian-decision").selectOption(decision);
  await page.locator("#guardian-giver").selectOption(giver);
  await page.locator("#guardian-language").selectOption("ta");
  await page.locator("#guardian-purpose-source").selectOption("in-person");
  await page.locator("#guardian-purpose-occurred").fill(localTime);
  await page.locator("#guardian-explained").check();
}

async function expectCurrent(page, f) {
  const current = await f.read();
  await expect(workspace(page)).toHaveAttribute(
    "data-guardian-version",
    String(current.version),
  );
  return current;
}

test("CW-08/09/11/12/13 aunt, child and separate parent; pending guardian draft recovery, explicit synthetic authority and separate purpose refusal/withdrawal", async ({
  page,
  context,
}, info) => {
  test.setTimeout(300000);
  const canary = "Synthetic-Private-CW80-Family";
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      const f = await seed(page, origin, setupToken, code, canary);
      await openChild(page, origin, f);
      await expect(workspace(page)).toContainText(
        "No guardian authority recorded",
      );
      await expect(
        workspace(page).locator("input[type='file'], input[type='date']"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: /take photo|upload|send message|record measurement/i,
        }),
      ).toHaveCount(0);
      await page.locator("#guardian-add").click();
      await expect(page.locator("#guardian-form-heading")).toBeFocused();
      const form = page.locator(
        "section[aria-labelledby='guardian-form-heading'] form",
      );
      await form.dispatchEvent("compositionstart");
      await page.locator("#guardian-mode").selectOption("new");
      await page.locator("#guardian-name").fill(`செயற்கை பெற்றோர் லதா ${canary}`);
      await page.waitForTimeout(1100);
      expect((await f.read()).authority).toBeNull();
      expect(new URL(page.url()).search).toBe("");
      await page.locator("#guardian-kind").selectOption("parent");
      await page.locator("#guardian-scope").selectOption(scope);
      await form.locator("#guardian-source").selectOption("in-person");
      await form.locator("#guardian-occurred").fill(localTime);
      const draftSaved = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.url().includes(`/api/shops/${f.shopId}/drafts/`),
      );
      await form.dispatchEvent("compositionend");
      expect((await draftSaved).status()).toBe(200);
      await expect(page.locator("#guardian-promote")).toBeEnabled();
      expect((await f.read()).authority).toBeNull();
      const draftUrl = page.url();
      expect(new URL(draftUrl).search).not.toContain(canary);
      expect(new URL(draftUrl).searchParams.size).toBeGreaterThan(0);
      await page.reload();
      await expect(page.locator("#guardian-name")).toHaveValue(
        `செயற்கை பெற்றோர் லதா ${canary}`,
      );
      await page
        .getByRole("button", { name: "Close guardian form", exact: true })
        .click();
      await page
        .getByRole("button", { name: /^Resume guardian draft:/ })
        .click();
      await expect(page.locator("#guardian-kind")).toHaveValue("parent");
      for (const locale of ["en", "ta"])
        for (const dark of [false, true]) {
          await prepareOwnerScreen(page, locale, dark);
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
            path: `.scratch/guardian-review/${info.project.name}-${locale}-${dark ? "dark" : "light"}-claim.png`,
            fullPage: true,
          });
        }
      await prepareOwnerScreen(page, "en", false);
      expect(
        (
          await uiWrite(page, page.locator("#guardian-promote"), (r) =>
            r.url().endsWith("/promote"),
          )
        ).status(),
      ).toBe(200);
      let current = await expectCurrent(page, f);
      expect(current.authority.status).toBe("pending");
      expect(current.authority.personId).not.toBe(f.aunt.personId);
      expect(current.authority.personId).not.toBe(f.child.personId);
      await review(page, "rejected");
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record authority review",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/verification-events`),
          )
        ).status(),
      ).toBe(200);
      current = await expectCurrent(page, f);
      expect(current.authority.status).toBe("rejected");
      await review(page, "confirmed");
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record authority review",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/verification-events`),
          )
        ).status(),
      ).toBe(200);
      current = await expectCurrent(page, f);
      expect(current.authority.status).toBe("confirmed");
      expect(
        current.authority.verifications.some((v) => v.status === "rejected"),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Record guardian decision", exact: true })
        .click();
      await expect(page.locator("#guardian-purpose")).toHaveValue("");
      await expect(page.locator("#guardian-purpose-authority")).toHaveValue("");
      await expect(page.locator("#guardian-decision")).toHaveValue("");
      await expect(page.locator("#guardian-explained")).not.toBeChecked();
      const choices = await page
        .locator("#guardian-purpose option")
        .evaluateAll((options) => options.map((option) => option.value));
      expect(choices).not.toContain("marketing");
      expect(choices).not.toContain("publication");
      await purpose(
        page,
        "measurement",
        "grant",
        f.aunt.personId,
        current.authority.id,
      );
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record guardian decision",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/consent-events`),
          )
        ).status(),
      ).toBe(409);
      expect((await f.read()).purposes).toEqual([]);
      await page
        .locator("#guardian-giver")
        .selectOption(current.authority.personId);
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record guardian decision",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/consent-events`),
          )
        ).status(),
      ).toBe(200);
      current = await expectCurrent(page, f);
      expect(
        current.purposes.find((p) => p.purpose === "measurement").eligible,
      ).toBe(true);
      await purpose(
        page,
        "private-photo",
        "refusal",
        current.authority.personId,
        current.authority.id,
      );
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record guardian decision",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/consent-events`),
          )
        ).status(),
      ).toBe(200);
      current = await expectCurrent(page, f);
      expect(
        current.purposes.find((p) => p.purpose === "private-photo"),
      ).toMatchObject({ decision: "refusal", eligible: false });
      expect(
        current.purposes.find((p) => p.purpose === "measurement").eligible,
      ).toBe(true);
      await purpose(
        page,
        "measurement",
        "withdrawal",
        current.authority.personId,
        current.authority.id,
      );
      expect(
        (
          await uiWrite(
            page,
            page.getByRole("button", {
              name: "Record guardian decision",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/consent-events`),
          )
        ).status(),
      ).toBe(200);
      current = await expectCurrent(page, f);
      expect(
        current.purposes.find((p) => p.purpose === "measurement"),
      ).toMatchObject({ decision: "withdrawal", eligible: false });
      expect(
        current.purposes.find((p) => p.purpose === "measurement").previousId,
      ).not.toBeNull();
      await page.reload();
      await page
        .getByRole("button", {
          name: `Select wearer: ${f.childName} (${f.child.wearerId.slice(-8)})`,
          exact: true,
        })
        .click();
      await expect(workspace(page)).toContainText("Withdraw the earlier grant");
      await expect(
        workspace(page).locator("input[type='file'], input[type='date']"),
      ).toHaveCount(0);
      await f.send(
        "patch",
        `${f.wearerPath}/${f.child.wearerId}`,
        {
          reason: "SYNTHETIC age correction for guardian eligibility",
          age: "unknown",
          preferences: f.preferences,
          relationship: f.relationship,
        },
        {
          "Idempotency-Key": crypto.randomUUID(),
          "If-Match": `"v${current.version}"`,
        },
      );
      const ageUnresolved = await f.read();
      expect(ageUnresolved.authority.status).toBe("confirmed");
      expect(ageUnresolved.authority.verifiedCurrent).toBe(false);
      expect(ageUnresolved.purposes.every((p) => !p.eligible)).toBe(true);
      await page.reload();
      await page
        .getByRole("button", {
          name: `Select wearer: ${f.childName} (${f.child.wearerId.slice(-8)})`,
          exact: true,
        })
        .click();
      await expect(workspace(page)).toContainText(
        "Age is not recorded as under 18",
      );
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

test("CW-06/09/11/13 lost guardian decision response replays one event; stale authority remains reviewable and private memory clears on sign-out", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  const canary = "Synthetic-Private-CW80-Recovery";
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      const f = await seed(page, origin, setupToken, code, canary, true);
      await openChild(page, origin, f);
      let current = await expectCurrent(page, f);
      await purpose(
        page,
        "measurement",
        "grant",
        current.authority.personId,
        current.authority.id,
      );
      const attempts = [];
      let lose = true;
      await page.route(
        `**/api${f.guardianPath}/consent-events`,
        async (route) => {
          attempts.push({
            key: route.request().headers()["idempotency-key"],
            etag: route.request().headers()["if-match"],
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
        .getByRole("button", { name: "Record guardian decision", exact: true })
        .click();
      await expect(workspace(page)).toContainText(
        "Checking whether this was saved",
      );
      await expect(page.locator("#guardian-purpose")).toBeDisabled();
      const committed = await f.read();
      expect(committed.version).toBe(current.version + 1);
      await uiWrite(
        page,
        workspace(page).getByRole("button", { name: "Try again", exact: true }),
        (r) => r.url().endsWith(`${f.guardianPath}/consent-events`),
      );
      current = await expectCurrent(page, f);
      expect(current.version).toBe(committed.version);
      expect(current.purposes).toHaveLength(1);
      expect(
        attempts.every(
          (attempt) => JSON.stringify(attempt) === JSON.stringify(attempts[0]),
        ),
      ).toBe(true);
      // Keep an uncommitted review on screen while another owner request withdraws.
      await review(page, "rejected");
      await f.send(
        "post",
        `${f.guardianPath}/verification-events`,
        {
          authorityId: current.authority.id,
          status: "withdrawn",
          method: "not-verified",
          evidenceRef: "",
          scope,
          source: "phone",
          occurredAt,
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
            page.getByRole("button", {
              name: "Record authority review",
              exact: true,
            }),
            (r) => r.url().endsWith(`${f.guardianPath}/verification-events`),
          )
        ).status(),
      ).toBe(412);
      await expect(page.locator("#guardian-verification-status")).toHaveValue(
        "rejected",
      );
      await expect(workspace(page)).toContainText(
        "Your proposal is still shown",
      );
      page.on("dialog", (dialog) => dialog.accept());
      await workspace(page)
        .getByRole("button", {
          name: "Reload saved guardian state",
          exact: true,
        })
        .click();
      current = await expectCurrent(page, f);
      expect(current.authority.status).toBe("withdrawn");
      expect(current.purposes[0].eligible).toBe(false);
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
      expect(page.url()).not.toContain(canary);
      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      await page.route(`**/api${f.guardianPath}`, async (route) => {
        const response = await route.fetch();
        await held;
        await route.fulfill({ response }).catch(() => {});
      });
      const late = page.waitForRequest((r) => r.url().endsWith(f.guardianPath));
      await page
        .getByRole("button", { name: "Refresh guardian evidence", exact: true })
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
