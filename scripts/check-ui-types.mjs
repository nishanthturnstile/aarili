import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/ui/tsconfig.json",
  ],
  { encoding: "utf8" },
);
const output = result.stdout + result.stderr;
if (
  result.status === 0 ||
  !["burgundy", "tiny", "cramped", "paid"].every((value) =>
    output.includes(`"${value}"`),
  ) ||
  (output.match(/error TS/g) ?? []).length !== 4
) {
  console.error(output);
  throw new Error("Expected exactly four invalid UI variant diagnostics");
}
console.info("0.1.1c: TypeScript rejects all four invalid component variants.");
