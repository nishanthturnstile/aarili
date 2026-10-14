import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";

test("0.3.2c F1 server instrumentation is an exact server entry; browser imports remain forbidden", () => {
  const sources = new Map([
    [
      "apps/web/src/instrumentation.ts",
      'export async function register() { await import("@aarili/jobs/runtime"); }',
    ],
    ["packages/jobs/src/runtime.ts", 'export const runtime = "server";'],
  ]);
  expect(checkBoundaries(sources)).toEqual([]);
  sources.set(
    "apps/web/src/app/page.tsx",
    '"use client"; import "@/instrumentation";',
  );
  expect(checkBoundaries(sources)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("browser graph reaches a server entry point"),
    ]),
  );
});

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
      ["apps/web/src/app/page.tsx", '"use client"; import "@/bridge";'],
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
          ["apps/web/src/app/page.tsx", `"use client"; ${code}`],
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
        [
          "apps/web/src/app/page.tsx",
          '"use client"; import "@aarili/api/client";',
        ],
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

test("0.1.1c RSC preview gate is server-only; a client cannot import it to reach environment state", () => {
  const server = [
    "apps/web/src/app/dev/design-system/page.tsx",
    'const enabled = process.env.NODE_ENV === "development";',
  ];
  expect(checkBoundaries(new Map([server]))).toEqual([]);
  expect(
    checkBoundaries(
      new Map([
        server,
        [
          "apps/web/src/client.tsx",
          '/* client directive after a comment */ "use client"; import "@/app/dev/design-system/page";',
        ],
      ]),
    ),
  ).toEqual(
    expect.arrayContaining([expect.stringContaining("server runtime")]),
  );
});

test("0.1.1c only shared UI may consume the approved primitive dependencies", () => {
  expect(
    checkBoundaries(
      new Map([
        [
          "packages/ui/src/components/button.tsx",
          'import "@base-ui/react/button";',
        ],
      ]),
    ),
  ).toEqual([]);
  expect(
    checkBoundaries(
      new Map([["apps/web/src/rogue.tsx", 'import "@base-ui/react/button";']]),
    ),
  ).toEqual(expect.arrayContaining([expect.stringContaining("not approved")]));
  expect(
    checkBoundaries(
      new Map([
        ["packages/ui/src/rogue.tsx", 'import "@radix-ui/react-dialog";'],
      ]),
    ),
  ).toEqual(expect.arrayContaining([expect.stringContaining("not approved")]));
});
