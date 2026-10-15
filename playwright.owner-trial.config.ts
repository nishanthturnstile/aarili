import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

if (process.env.AARILI_DESIGN_TRIAL !== "grounded-editorial") {
  throw new Error(
    "Owner trial tests require AARILI_DESIGN_TRIAL=grounded-editorial",
  );
}
process.env.AARILI_OWNER_UI_TRIAL = "true";

// Owner fixtures start one development server at a time. Do not also start the
// gallery server: Next dev instances rewrite the same generated next-env file.
export default defineConfig({
  ...base,
  webServer: [],
  testMatch: "**/owner-*.spec.mjs",
});
