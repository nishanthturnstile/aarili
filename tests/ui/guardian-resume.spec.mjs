import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";

const { v7 } = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
)("uuid");
test.use({ trace: "off", screenshot: "off", actionTimeout: 10000 });

test("CW-13 resuming a saved guardian draft restores its opaque reload address without creating authority", async ({
  page,
}) => {
  test.setTimeout(120000);
  const canary = "Synthetic-Private-CW80-Resume";
  await withOwnerWeb(
    async ({ origin, setupToken, code }) => {
      async function post(path, data, extra = {}, method = "post") {
        const response = await page.request[method](`${origin}/api${path}`, {
          data,
          headers: { Origin: origin, ...extra },
        });
        expect(response.status()).toBe(200);
        return response.json();
      }
      const password = "synthetic-guardian-resume-password-80";
      await post(
        "/owner/setup",
        { name: "Synthetic owner", email: "owner@example.test", password },
        { "X-Setup-Token": setupToken, "Idempotency-Key": crypto.randomUUID() },
      );
      await post("/owner/verify", { code: await code() });
      await post("/auth/sign-in/email", {
        email: "owner@example.test",
        password,
      });
      await post(
        "/owner/complete",
        { shopName: "Synthetic guardian recovery shop" },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      const { shopId } = await (
        await page.request.get(`${origin}/api/owner/shop`)
      ).json();
      const occurredAt = new Date(Date.now() - 60000).toISOString();
      const customerPolicy = await (
        await page.request.get(`${origin}/api/shops/${shopId}/customers/policy`)
      ).json();
      const customer = await post(
        `/shops/${shopId}/customers`,
        {
          displayName: `செயற்கை அத்தை ${canary}`,
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
      const childName = `செயற்கை சிறார் ${canary}`;
      const wearer = await post(
        `/shops/${shopId}/customers/${customer.customerId}/wearers`,
        {
          mode: "new",
          displayName: childName,
          age: "minor",
          preferences: {
            language: "",
            channel: "",
            fit: "",
            style: "",
            delivery: "",
            source: "",
          },
          relationship: {
            kind: "family",
            statementByPersonId: customer.personId,
            authorised: false,
            informed: false,
            source: "in-person",
            occurredAt,
            interaction:
              "Synthetic aunt arranging a child's service; guardian evidence pending",
          },
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      const policy = await (
        await page.request.get(`${origin}/api/shops/${shopId}/guardians/policy`)
      ).json();
      const draftId = v7();
      const guardianName = `செயற்கை பெற்றோர் ${canary}`;
      await post(
        `/shops/${shopId}/drafts/${draftId}`,
        {
          workflow: "wearer.guardian",
          schemaVersion: 1,
          payload: {
            synthetic: true,
            noticeId: policy.notice.id,
            customerId: customer.customerId,
            customerVersion: customer.version,
            wearerId: wearer.wearerId,
            wearerVersion: wearer.version,
            claim: {
              guardian: { mode: "new", displayName: guardianName },
              authority: "parent",
              scope: "measurement-and-private-photo",
              source: "in-person",
              occurredAt,
            },
          },
        },
        { "Idempotency-Key": crypto.randomUUID() },
        "put",
      );
      const profileUrl = `${origin}/customers/${customer.customerId}`;
      const readAuthority = async () =>
        (
          await (
            await page.request.get(
              `${origin}/api/shops/${shopId}/customers/${customer.customerId}/wearers/${wearer.wearerId}/guardians`,
            )
          ).json()
        ).authority;
      await page.goto(profileUrl);
      await page
        .getByRole("button", {
          name: `Select wearer: ${childName} (${wearer.wearerId.slice(-8)})`,
          exact: true,
        })
        .click();
      expect(new URL(page.url()).search).toBe("");
      await expect(page.locator("#guardian-heading")).toContainText(childName);
      await expect(page.locator("#wearer-purpose-heading")).toHaveCount(0);
      expect(await readAuthority()).toBeNull();
      await page
        .getByRole("button", { name: /^Resume guardian draft:/ })
        .click();
      await expect(page.locator("#guardian-name")).toHaveValue(guardianName);
      await expect(page).toHaveURL(`${profileUrl}?draft=${draftId}`);
      expect(page.url()).not.toContain(canary);
      await page.reload();
      await expect(page.locator("#guardian-name")).toHaveValue(guardianName);
      await expect(page.locator("#guardian-kind")).toHaveValue("parent");
      await expect(page.locator("#guardian-scope")).toHaveValue(
        "measurement-and-private-photo",
      );
      expect(await readAuthority()).toBeNull();
      await page
        .getByRole("button", { name: "Close guardian form", exact: true })
        .click();
      await expect(page).toHaveURL(profileUrl);
      await page
        .getByRole("button", { name: /^Resume guardian draft:/ })
        .click();
      await expect(page).toHaveURL(`${profileUrl}?draft=${draftId}`);
      await expect(page.locator("#guardian-name")).toHaveValue(guardianName);
      expect(await readAuthority()).toBeNull();
    },
    {
      secrets: [canary],
      onFailure: async () => {
        await page.goto("about:blank");
      },
    },
  );
});
