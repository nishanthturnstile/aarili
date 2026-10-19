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

// A clean native workspace checks the new public exports without broadening this
// feature gate into another full promotion run. No existing dist/cache is copied.
const source = resolve("."),
  scratch = mkdtempSync(join(tmpdir(), "aarili quick order exports "));
const manager = process.env.npm_execpath;
const managerIsScript = /\.[cm]?js$/.test(manager ?? "");
assert(
  manager,
  "Run through pnpm exec node scripts/verify-quick-order-exports.mjs",
);
const lock = readFileSync("pnpm-lock.yaml", "utf8");
try {
  const exclude = new Set([
    "node_modules",
    "dist",
    ".next",
    ".next-ui",
    ".turbo",
  ]);
  for (const root of [
    "apps",
    "packages",
    "scripts",
    "tests",
    "patches",
    ...readdirSync(".").filter(
      (n) =>
        n.endsWith(".json") ||
        n.endsWith(".ts") ||
        n.endsWith(".mjs") ||
        [
          ".npmrc",
          ".gitignore",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
        ].includes(n),
    ),
  ])
    cpSync(join(source, root), join(scratch, root), {
      recursive: true,
      filter: (path) => {
        const parts = relative(source, path).split(/[\\/]/),
          leaf = parts.at(-1);
        return (
          !parts.some((p) => exclude.has(p)) &&
          !(leaf.startsWith(".env") && leaf !== ".env.example") &&
          !leaf.endsWith(".tsbuildinfo")
        );
      },
    });
  for (const args of [["install", "--frozen-lockfile"], ["build:packages"]]) {
    const r = spawnSync(
      managerIsScript ? process.execPath : manager,
      managerIsScript ? [manager, ...args] : args,
      {
        cwd: scratch,
        stdio: "inherit",
        env: process.env,
      },
    );
    assert.equal(r.status, 0, `Clean ${args.join(" ")}`);
  }
  const probe = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'for(const p of ["@aarili/contracts/orders","@aarili/core/orders","@aarili/api/orders","@aarili/api/orders-client"]) await import(p);',
    ],
    { cwd: scratch, stdio: "inherit" },
  );
  assert.equal(probe.status, 0, "Clean Quick Order public imports");
  assert.equal(readFileSync(join(scratch, "pnpm-lock.yaml"), "utf8"), lock);
  console.info(
    "Quick Order clean native frozen install/build/public exports passed in a path containing spaces.",
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
