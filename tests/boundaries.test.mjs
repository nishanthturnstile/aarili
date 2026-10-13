import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";

test("0.1.1a / architecture §6.2 rejects framework and vendor imports in core", () => {
  for (const code of [
    'import { Hono } from "hono";',
    'export * from "next";',
    'const vendor = await import("@aws-sdk/client-s3");',
  ]) {
    expect(
      checkBoundaries(new Map([["packages/core/src/invalid.ts", code]])),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("core only consumes")]),
    );
  }
});
test("0.1.1a browser graph rejects indirect exports, aliases, require and relative bypass", () => {
  for (const code of [
    'export * from "@aarili/platform";',
    'const env = require("@aarili/platform");',
    'await import("@aarili/platform");',
    'import "../../../../packages/platform/src/index.js";',
  ]) {
    const sources = new Map([
      ["apps/web/src/app/page.tsx", 'import "@/bridge";'],
      ["apps/web/src/bridge.ts", code],
      ["packages/platform/src/index.ts", 'export const secret = "synthetic";'],
    ]);
    expect(checkBoundaries(sources).length).toBeGreaterThan(0);
  }
});
test("0.1.1a rejects computed imports and API framework coupling", () => {
  expect(
    checkBoundaries(
      new Map([["packages/core/src/invalid.ts", "import(variable);"]]),
    ),
  ).toEqual(
    expect.arrayContaining([expect.stringContaining("computed imports")]),
  );
  expect(
    checkBoundaries(
      new Map([["packages/api/src/index.ts", 'import "next/server";']]),
    ),
  ).toEqual(
    expect.arrayContaining([expect.stringContaining("web frameworks")]),
  );
});
test("0.1.1a rejects server types, server aliases and direct environment access in browser code", () => {
  for (const code of [
    'import type { Secret } from "@aarili/db";',
    'type Secret = import("@aarili/db").Secret;',
    'import "@/server/env";',
    "const secret = process.env.DATABASE_URL;",
    'const secret = process["env"].DATABASE_URL;',
  ]) {
    expect(
      checkBoundaries(
        new Map([
          ["apps/web/src/app/page.tsx", code],
          ["apps/web/src/server/env.ts", 'export const secret = "synthetic";'],
        ]),
      ).length,
    ).toBeGreaterThan(0);
  }
});
test("0.1.1a allows browser typed clients without traversing erased server types", () => {
  expect(
    checkBoundaries(
      new Map([
        ["apps/web/src/app/page.tsx", 'import "@aarili/api/client";'],
        [
          "packages/api/src/client.ts",
          'import type { App } from "./index.js"; import { hc } from "hono/client";',
        ],
        [
          "packages/api/src/index.ts",
          'import { OpenAPIHono } from "@hono/zod-openapi";',
        ],
      ]),
    ),
  ).toEqual([]);
});
