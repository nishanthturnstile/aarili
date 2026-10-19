import { randomUUID } from "node:crypto";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { orderMessages } from "@aarili/i18n";
import { expect, test } from "@playwright/test";
import { withOwnerWeb } from "../../scripts/test-support/owner-web.mjs";
import { seedQuickOrder } from "../../scripts/test-support/seed-quick-order.mjs";
import { prepareOwnerScreen } from "./owner-presentation.mjs";

test("QO-09 active private Quick Order clears in every open tab on sign-out and cannot return through browser history", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await withOwnerWeb(async ({ origin, setupToken, code, runtime }) => {
    const post = (path, data, headers = {}) =>
      page.request.post(`${origin}/api${path}`, {
        data,
        headers: { Origin: origin, ...headers },
      });
    const email = "quick-order-access@example.test",
      password = "synthetic-access-password";
    expect(
      (
        await post(
          "/owner/setup",
          { name: "SYNTHETIC access owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        )
      ).status(),
    ).toBe(200);
    expect((await post("/owner/verify", { code: await code() })).status()).toBe(
      200,
    );
    expect(
      (await post("/auth/sign-in/email", { email, password })).status(),
    ).toBe(200);
    expect(
      (
        await post(
          "/owner/complete",
          { shopName: "SYNTHETIC access shop" },
          { "Idempotency-Key": randomUUID() },
        )
      ).status(),
    ).toBe(200);
    const { shop } = await (
      await page.request.get(`${origin}/api/owner/entry`)
    ).json();
    const seeded = await seedQuickOrder(runtime, shop.shopId);
    try {
      const raw = randomUUID(),
        id = `${raw.slice(0, 14)}7${raw.slice(15)}`;
      const payload = {
        ...emptyQuickOrder(),
        customerId: seeded.customer.customerId,
        wearerId: seeded.wearer.wearerId,
        presentation: "detailed",
        instructions: "SYNTHETIC private intake still open",
      };
      const save = await page.request.put(
        `${origin}/api/shops/${shop.shopId}/drafts/${id}`,
        {
          headers: { Origin: origin, "Idempotency-Key": randomUUID() },
          data: { workflow: "order.quick", schemaVersion: 1, payload },
        },
      );
      expect(save.status()).toBe(200);
      await page.goto(`${origin}/orders?draft=${id}`);
      await prepareOwnerScreen(page, "en");
      await expect(
        page.getByLabel(orderMessages.en.instructions, { exact: true }),
      ).toHaveValue(payload.instructions);
      const other = await page.context().newPage();
      await other.goto(page.url());
      await expect(
        other.getByLabel(orderMessages.en.instructions, { exact: true }),
      ).toHaveValue(payload.instructions);
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      for (const tab of [page, other]) {
        await expect(tab).toHaveURL(`${origin}/sign-in`);
        await expect(tab.locator("main")).not.toContainText(
          payload.instructions,
        );
        await expect(
          tab.getByLabel(orderMessages.en.instructions, { exact: true }),
        ).toHaveCount(0);
      }
      await page.goBack();
      await expect(page).toHaveURL(`${origin}/sign-in`);
      await expect(page.locator("main")).not.toContainText(
        payload.instructions,
      );
      await other.close();
    } finally {
      await seeded.close();
    }
  });
});
