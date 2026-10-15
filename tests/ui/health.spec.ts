import { expect, test } from "@playwright/test";

test("USE-08/09 operational readiness remains available without a demo page", async ({
  request,
  page,
}) => {
  const response = await request.get("/api/healthz");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    status: "ok",
    service: "aarili-web",
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.locator("main")).not.toContainText("Service status");
  await expect(page.locator("main")).not.toContainText("development workspace");
  expect((await request.get("/dev/design-system")).status()).toBe(404);
});
