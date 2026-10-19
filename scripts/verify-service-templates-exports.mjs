// Scoped clean install gate: #99 manifest and exact-form export integration, unchanged dependencies.
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
  scratch = mkdtempSync(join(tmpdir(), "aarili issue 99 exports "));
const manager = process.env.npm_execpath;
assert(
  manager,
  "Run through pnpm exec node scripts/verify-shop-commitments-exports.mjs",
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
    "@aarili/contracts/service-templates",
    "@aarili/core/service-templates",
    "@aarili/db/service-templates-repository",
    "@aarili/db/repositories/service-templates",
    "@aarili/db/service-templates-schema",
    "@aarili/api/service-templates",
    "@aarili/api/service-templates-client",
    "@aarili/contracts/measurement-forms",
    "@aarili/core/measurement-forms",
    "@aarili/db/measurement-forms-repository",
    "@aarili/db/repositories/measurement-forms",
    "@aarili/db/measurement-forms-schema",
    "@aarili/api/measurement-forms",
    "@aarili/api/measurement-forms-client",
    "@aarili/api/media-client",
    "@aarili/contracts/service-catalogue",
    "@aarili/core/service-catalogue",
    "@aarili/db/service-catalogue-repository",
    "@aarili/db/repositories/service-catalogue",
    "@aarili/db/service-catalogue-schema",
    "@aarili/api/service-catalogue",
    "@aarili/api/service-catalogue-client",
    "@aarili/contracts/shop-commitments",
    "@aarili/core/shop-commitments",
    "@aarili/core/commitment-evaluator",
    "@aarili/db/shop-commitments-repository",
    "@aarili/db/repositories/shop-commitments",
    "@aarili/db/shop-commitments-schema",
    "@aarili/api/shop-commitments",
    "@aarili/api/shop-commitments-client",
    "@aarili/api",
    "@aarili/contracts/shop-policies",
    "@aarili/core/shop-policies",
    "@aarili/db/shop-policies-repository",
    "@aarili/db/repositories/shop-policies",
    "@aarili/db/shop-policies-schema",
    "@aarili/api/shop-policies-client",
    "@aarili/contracts/shop-directory",
    "@aarili/core/shop-directory",
    "@aarili/db/shop-directory-repository",
    "@aarili/db/repositories/shop-directory",
    "@aarili/db/shop-directory-schema",
    "@aarili/api/shop-directory",
    "@aarili/api/shop-directory-client",
    "@aarili/auth",
    "@aarili/i18n",
  ];
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `for(const name of ${JSON.stringify(modules)})await import(name); console.info('Issue 99 clean exports imported');`,
    ],
    { cwd: scratch, stdio: "inherit" },
  );
  assert.equal(result.status, 0, "Clean catalogue exports failed");
  assert.equal(readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8"), lockfile);
  console.info(
    "Issue 99 frozen clean install/package builds/exports passed; lockfile unchanged.",
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
