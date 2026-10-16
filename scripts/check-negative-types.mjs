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
const allocation = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/allocation-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const allocationOutput = allocation.stdout + allocation.stderr;
if (
  allocation.status === 0 ||
  (allocationOutput.match(/error TS/g) ?? []).length !== 6 ||
  ![2, 3, 4, 5, 6, 7].every((line) =>
    allocationOutput.includes(`allocation-invalid.ts(${line},`),
  )
) {
  console.error(allocationOutput);
  throw new Error(
    "0.3.1b B5/B6 allocation declarations must reject all six invalid uses",
  );
}
console.info(
  "0.3.1b B5/B6 compiled FIN-05 allocation types rejected all six invalid uses.",
);
const journal = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/journal-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const journalOutput = journal.stdout + journal.stderr;
if (
  journal.status === 0 ||
  (journalOutput.match(/error TS/g) ?? []).length !== 5 ||
  ![4, 5, 6, 7, 8].every((line) =>
    journalOutput.includes(`journal-invalid.ts(${line},`),
  )
) {
  console.error(journalOutput);
  throw new Error(
    "0.3.1c journal declarations must reject five invalid amount/account/batch/balance/query uses",
  );
}
console.info(
  "0.3.1c C1/C2 compiled journal declarations rejected all five invalid uses, including setBalance.",
);
const jobs = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/jobs-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const jobsOutput = jobs.stdout + jobs.stderr;
if (
  jobs.status === 0 ||
  (jobsOutput.match(/error TS/g) ?? []).length !== 4 ||
  ![4, 5, 6, 8].every((line) => jobsOutput.includes(`jobs-invalid.ts(${line},`))
) {
  console.error(jobsOutput);
  throw Error(
    "0.3.2a queue declarations must reject content/snapshot/version/vendor-boundary misuse",
  );
}
console.info(
  "0.3.2a D3/D7 compiled queue declarations rejected all four invalid payload/write uses.",
);

const drafts = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/drafts-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const draftsOutput = drafts.stdout + drafts.stderr;
if (
  drafts.status === 0 ||
  (draftsOutput.match(/error TS/g) ?? []).length !== 5 ||
  ![3, 4, 5, 6, 7].every((line) =>
    draftsOutput.includes(`drafts-invalid.ts(${line},`),
  )
) {
  console.error(draftsOutput);
  throw Error(
    "0.4.2a draft DTO/client types must reject five schema/lifecycle/method/body/header misuses",
  );
}
console.info(
  "0.4.2a E8 five invalid draft contract/client uses rejected by compiled declarations.",
);

const media = spawnSync(
  process.execPath,
  [
    resolve("node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    "tests/fixtures/types/media-tsconfig.json",
  ],
  { encoding: "utf8" },
);
const mediaOutput = media.stdout + media.stderr;
if (
  media.status === 0 ||
  (mediaOutput.match(/error TS/g) ?? []).length !== 6 ||
  ![2, 3, 4, 5, 6, 7].every((line) =>
    mediaOutput.includes(`media-invalid.ts(${line},`),
  )
) {
  console.error(mediaOutput);
  throw Error(
    "Private media DTO/client negative contracts did not reject every invalid use",
  );
}
console.info(
  "0.4.3a/b six invalid media DTO/client/status/variant uses rejected by compiled declarations.",
);
