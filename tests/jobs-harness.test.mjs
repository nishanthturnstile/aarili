import { expect, test } from "vitest";
import { validateJobsHarness } from "../scripts/foundation-jobs.mjs";

test("0.3.2a D8 disposable jobs harness refuses retained/live targets and outbound activation", () => {
  for (const mode of ["--demo", "--interactive"])
    expect(validateJobsHarness([mode], {})).toBe(mode);
  for (const env of [
    { DATABASE_URL: "fixture" },
    { MIGRATION_DATABASE_URL: "fixture" },
    { PGHOST: "fixture" },
    { database_url: "fixture" },
    { NODE_ENV: "production" },
    { OUTBOUND_EFFECTS: "enabled" },
    { RESTORE_OPERATOR_DATABASE_URL: "fixture" },
    { RESEND_API_KEY: "fixture" },
    { AWS_ACCESS_KEY_ID: "fixture" },
  ])
    expect(() => validateJobsHarness(["--interactive"], env)).toThrow();
  for (const args of [
    [],
    ["--interactive", "--url"],
    ["--reset"],
    ["--target=fixture"],
  ])
    expect(() => validateJobsHarness(args, {})).toThrow();
});
