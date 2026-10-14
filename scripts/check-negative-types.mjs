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
  !output.includes('"aarili-worker"') ||
  !output.includes("invalid.ts(5,") ||
  !output.includes('"TIMEOUT"') ||
  !output.includes("complete") ||
  !output.includes("invalid.ts(16,") ||
  (output.match(/error TS/g) ?? []).length !== 8
) {
  console.error(output);
  throw new Error(
    "Negative contracts fixture did not fail for every expected reason",
  );
}
console.info(
  "Negative DTO/client fixture rejected all eight health/owner invalid uses by TypeScript 7.",
);
const command = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/command-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const commandOutput = command.stdout + command.stderr;
if (
  command.status === 0 ||
  (commandOutput.match(/error TS/g) ?? []).length !== 5 ||
  ![4, 5, 6, 7, 8].every((line) =>
    commandOutput.includes(`command-invalid.ts(${line},`),
  )
) {
  console.error(commandOutput);
  throw new Error(
    "Negative command fixture must reject wrong DTO/method/missing reason/finalize fields/version types",
  );
}
console.info(
  "0.2.3 five invalid command DTO/client uses rejected by compiled TypeScript declarations.",
);
const money = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/money-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const moneyOutput = money.stdout + money.stderr;
if (
  money.status === 0 ||
  (moneyOutput.match(/error TS/g) ?? []).length !== 7 ||
  ![4, 5, 6, 7, 8, 9, 10].every((line) =>
    moneyOutput.includes(`money-invalid.ts(${line},`),
  )
) {
  console.error(moneyOutput);
  throw new Error(
    "0.3.1a negative wire/arithmetic/client types must reject all seven invalid uses",
  );
}
console.info(
  "0.3.1a A2/A6 compiled money wire/arithmetic/client types rejected all seven invalid uses.",
);
