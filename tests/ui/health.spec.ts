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
  for (const path of [
    "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records",
    "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records/019a5e55-2222-7000-8000-000000000002",
    "/api/owner/sensitive-probe",
    "/api/docs",
    "/api/openapi.json",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
    expect((await request.post(path)).status()).toBe(404);
    expect((await request.patch(path)).status()).toBe(404);
  }
});
