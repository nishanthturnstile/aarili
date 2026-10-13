import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const source = resolve(".");
const scratch = mkdtempSync(join(tmpdir(), "aarili issue 2 clean "));
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const packageManager = process.env.npm_execpath;
assert(packageManager, "Run this check through pnpm verify:clean");
const managerIsScript = /\.[cm]?js$/.test(packageManager);
const excluded = new Set([
  "node_modules",
  "dist",
  ".next",
  ".next-ui",
  ".turbo",
]);
const roots = [
  "apps",
  "packages",
  "scripts",
  "tests",
  "patches",
  ...readdirSync(".").filter(
    (name) =>
      name.endsWith(".json") ||
      name.endsWith(".ts") ||
      name.endsWith(".mjs") ||
      [
        ".npmrc",
        ".gitignore",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ].includes(name),
  ),
];
try {
  for (const name of roots)
    cpSync(join(source, name), join(scratch, name), {
      recursive: true,
      filter: (path) => {
        const parts = relative(source, path).split(/[\\/]/);
        const leaf = parts.at(-1);
        return (
          !parts.some((part) => excluded.has(part)) &&
          !(leaf.startsWith(".env") && leaf !== ".env.example") &&
          !leaf.endsWith(".tsbuildinfo") &&
          leaf !== "next-env.d.ts"
        );
      },
    });
  for (const args of [
    ["install", "--frozen-lockfile"],
    ["verify"],
    ["--filter", "@aarili/web", "build"],
  ]) {
    const result = spawnSync(
      managerIsScript ? process.execPath : packageManager,
      managerIsScript ? [packageManager, ...args] : args,
      {
        cwd: scratch,
        stdio: "inherit",
        env: {
          ...process.env,
          AARILI_PRIVATE_PROBE: "aarili-private-probe-issue-2",
        },
      },
    );
    assert.equal(result.status, 0, `Clean native ${args.join(" ")} failed`);
  }
  const artifacts = spawnSync(
    process.execPath,
    ["scripts/check-artifacts.mjs"],
    { cwd: scratch, stdio: "inherit" },
  );
  assert.equal(artifacts.status, 0, "Private canary entered the browser build");
  assert.equal(
    readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8"),
    lockfile,
    "Frozen install modified lockfile",
  );
  console.info(
    "0.1.1a clean native install/verification passed in a path containing spaces.",
  );
} finally {
  // Delete only the exact directory created above, within the intended temp root.
  const withinTemp = relative(resolve(tmpdir()), resolve(scratch));
  assert(withinTemp && !withinTemp.startsWith("..") && !isAbsolute(withinTemp));
  assert(resolve(scratch) !== source);
  rmSync(scratch, { recursive: true, force: true });
}
