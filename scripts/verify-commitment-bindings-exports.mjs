// Scoped clean install gate: #101 additive binding exports, unchanged dependencies.
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
  scratch = mkdtempSync(join(tmpdir(), "aarili issue 101 exports "));
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
    "@aarili/api/service-catalogue-client",
    "@aarili/db/service-catalogue-repository",
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
      `for(const name of ${JSON.stringify(modules)})await import(name); for(const [name, keys] of Object.entries({'@aarili/contracts/shop-commitments':['commitmentBindingCommandSchema','boundCommitmentPreviewSchema'],'@aarili/core/shop-commitments':['commitmentBindingsDraftWorkflow','previewBoundShopCommitments'],'@aarili/db/shop-commitments-repository':['commitmentBindingsRepository'],'@aarili/db/service-catalogue-repository':['approvedCategoryResolver'],'@aarili/api/shop-commitments-client':['readCommitmentBinding','readCommitmentBindingRevision','readCommitmentBindingHistory','previewBoundShopCommitments'],'@aarili/api/service-catalogue-client':['readCatalogueRevision']})){const module=await import(name);for(const key of keys)if(!module[key])throw Error('Missing '+key);} console.info('Issue 101 clean exports imported');`,
    ],
    { cwd: scratch, stdio: "inherit" },
  );
  assert.equal(result.status, 0, "Clean commitment exports failed");
  assert.equal(readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8"), lockfile);
  console.info(
    "Issue 101 frozen clean install/package builds/exports passed; lockfile unchanged.",
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
