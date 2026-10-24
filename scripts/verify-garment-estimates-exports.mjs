// Scoped clean install gate: #174 export integration, unchanged dependencies.
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

const source = resolve("."),
  scratch = mkdtempSync(join(tmpdir(), "aarili issue 174 exports "));
const manager = process.env.npm_execpath;
assert(
  manager,
  "Run through pnpm exec node scripts/verify-garment-estimates-exports.mjs",
);
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const excluded = new Set([
  "node_modules",
  "dist",
  ".next",
  ".next-ui",
  ".turbo",
]);
try {
  const roots = [
    "apps",
    "packages",
    "scripts",
    "tests",
    "patches",
    ...readdirSync(".").filter(
      (n) =>
        /\.(json|ts|mjs)$/.test(n) ||
        [".npmrc", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(n),
    ),
  ];
  for (const name of roots)
    cpSync(join(source, name), join(scratch, name), {
      recursive: true,
      filter: (path) => {
        const parts = relative(source, path).split(/[\\/]/),
          leaf = parts.at(-1);
        return (
          !parts.some((p) => excluded.has(p)) &&
          !(leaf.startsWith(".env") && leaf !== ".env.example") &&
          !leaf.endsWith(".tsbuildinfo") &&
          leaf !== "next-env.d.ts"
        );
      },
    });
  for (const args of [["install", "--frozen-lockfile"], ["build:packages"]]) {
    const script = /\.[cm]?js$/.test(manager),
      r = spawnSync(
        script ? process.execPath : manager,
        script ? [manager, ...args] : args,
        {
          cwd: scratch,
          stdio: "inherit",
          env: process.env,
        },
      );
    assert.equal(r.status, 0, `Clean ${args.join(" ")} failed`);
  }
  const modules = [
    "@aarili/api",
    "@aarili/contracts/garment-estimates",
    "@aarili/core/garment-estimates",
    "@aarili/db/garment-estimates-repository",
    "@aarili/api/garment-estimates-client",
    "@aarili/auth",
    "@aarili/i18n",
  ];
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `for(const name of ${JSON.stringify(modules)})await import(name); console.info('Issue 174 clean exports imported');`,
    ],
    { cwd: scratch, stdio: "inherit" },
  );
  assert.equal(result.status, 0, "Clean quotation exports failed");
  assert.equal(readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8"), lockfile);
  console.info(
    "Issue 174 frozen clean install/package builds/exports passed; lockfile unchanged.",
  );
} finally {
  const within = relative(resolve(tmpdir()), resolve(scratch));
  assert(
    within &&
      !within.startsWith("..") &&
      !isAbsolute(within) &&
      resolve(scratch) !== source,
  );
  rmSync(scratch, { recursive: true, force: true });
}
