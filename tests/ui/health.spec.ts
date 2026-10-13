import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("USE-08/09 0.1.2a actual Next/Hono/PostgreSQL readiness and accessible themed client", async ({
  page,
  request,
}, testInfo) => {
  const response = await request.get("/api/healthz");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    status: "ok",
    service: "aarili-web",
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText(
    "Application and database are ready",
  );
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Application and database are ready",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/health-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("USE-08/09 0.1.2a checking, unavailable, malformed wire, connection failure and retry states", async ({
  page,
}) => {
  let mode: "pending" | "unavailable" | "invalid" | "network" | "ready" =
    "pending";
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/healthz", async (route) => {
    if (mode === "pending") await pending;
    if (mode === "network") return route.abort();
    await route.fulfill({
      status: mode === "unavailable" ? 503 : 200,
      json:
        mode === "unavailable"
          ? {
              error: {
                code: "DATABASE_UNAVAILABLE",
                message: "Database is unavailable",
              },
            }
          : mode === "invalid"
            ? { status: "ok", service: "secret" }
            : { status: "ok", service: "aarili-web" },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Checking service status…");
  await expect(
    page.getByRole("button", { name: "Check again" }),
  ).toBeDisabled();
  mode = "unavailable";
  release?.();
  await expect(page.getByRole("status")).toHaveText("Database is unavailable");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const failure of ["invalid", "network"] as const) {
    mode = failure;
    await page.getByRole("button", { name: "Check again" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Service status could not be checked",
    );
    await expect(page.locator("main")).not.toContainText("secret");
  }
  mode = "ready";
  await page.getByRole("button", { name: "Check again" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "Application and database are ready",
  );
});
