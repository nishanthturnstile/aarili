#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/tsconfig.json",
  ],
  { encoding: "utf8" },
);
const output = result.stdout + result.stderr;
if (
  result.status === 0 ||
  !output.includes("$post") ||
  !output.includes("shopId") ||
  !output.includes('"paid"') ||
  !output.includes('"aarili-worker"')
) {
  console.error(output);
  throw new Error(
    "Negative contracts fixture did not fail for every expected reason",
  );
}
console.info(
  "Negative DTO/client fixture rejected all four invalid uses by TypeScript 7.",
);
