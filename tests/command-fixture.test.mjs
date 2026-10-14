import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "vitest";

test("0.2.3 E10 fixture CLI denies production/remote/malformed configuration before connecting and redacts diagnostics", () => {
  const canary = "synthetic-private-configuration-16";
  for (const [environment, url] of [
    ["production", `postgresql://app_owner:${canary}@127.0.0.1:1/synthetic`],
    ["test", `postgresql://app_owner:${canary}@remote.example.test/synthetic`],
    ["development", canary],
    [undefined, `postgresql://app_owner:${canary}@127.0.0.1:1/synthetic`],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/install-command-fixture.mjs"],
      {
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...(environment ? { NODE_ENV: environment } : {}),
          MIGRATION_DATABASE_URL: url,
        },
      },
    );
    assert.equal(result.status, 1, result.error?.message);
    assert(!`${result.stdout}${result.stderr}`.includes(canary));
    assert.match(result.stderr, /installation denied or failed/);
  }
});
