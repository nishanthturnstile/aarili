import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3103",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { viewport: { width: 360, height: 800 } } },
    { name: "tablet", use: { viewport: { width: 820, height: 1180 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "pnpm --filter @aarili/web dev --port 3103",
    url: "http://127.0.0.1:3103/sign-in",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
