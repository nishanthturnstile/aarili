import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let checked = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else {
      const output = readFileSync(path, "utf8");
      assert(
        !output.includes("aarili-private-probe-issue-2"),
        "Server canary entered browser output",
      );
      assert(
        !output.includes("aarili-setup-probe-issue-12"),
        "Setup token canary entered browser output",
      );
      assert(
        !output.includes("ownerAuthFromEnvironment"),
        "Server auth entered browser output",
      );
      assert(
        !output.includes("@t3-oss/env-core"),
        "Server environment package entered browser output",
      );
      assert(
        !output.includes("Invalid server environment configuration"),
        "Server validation code entered browser output",
      );
      checked++;
    }
  }
}
inspect("apps/web/.next/static");
assert(checked > 0, "No browser build output found");
console.info(
  `0.1.1a checked ${checked} browser artifacts for synthetic private configuration leakage.`,
);
