import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";

test("SS-14 service client admits erased route types and rejects transitive server runtime", () => {
  const sources = new Map([
    [
      "apps/web/src/app/page.tsx",
      '"use client"; import "@aarili/api/small-services-client";',
    ],
    [
      "packages/api/src/small-services-client.ts",
      'import type { Routes } from "./small-services.js";',
    ],
    ["packages/api/src/small-services.ts", 'import "@aarili/auth";'],
    ["packages/auth/src/index.ts", "export const privateRuntime = true;"],
  ]);
  expect(checkBoundaries(sources)).toEqual([]);
  sources.set(
    "packages/api/src/small-services-client.ts",
    'import "./small-services.js";',
  );
  expect(checkBoundaries(sources)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("browser graph reaches server package"),
    ]),
  );
});

test("0.4.1b B1 generated JSON theme assets resolve without allowing executable imports", () => {
  const sources = new Map([
    ["apps/web/src/app/manifest.ts", 'import theme from "../pwa-theme.json";'],
    ["apps/web/src/pwa-theme.json", '{"background":"linen"}'],
  ]);
  expect(checkBoundaries(sources)).toEqual([]);
  sources.delete("apps/web/src/pwa-theme.json");
  expect(checkBoundaries(sources)).toEqual([
    expect.stringContaining("unresolved browser import"),
  ]);
});

test("0.4.1a A5 i18n messages are browser-safe but cannot transitively expose server packages", () => {
  const sources = new Map([
    ["apps/web/src/app/page.tsx", '"use client"; import "@aarili/i18n";'],
    ["packages/i18n/src/index.ts", "export const messages = {};"],
  ]);
  expect(checkBoundaries(sources)).toEqual([]);
  sources.set("packages/i18n/src/index.ts", 'export * from "@aarili/db";');
  sources.set(
    "packages/db/src/index.ts",
    'export const privateData = "server";',
  );
  expect(checkBoundaries(sources)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("browser graph reaches server package"),
    ]),
  );
});

test("#48 application graph rejects direct and indirect exemplar imports", () => {
  for (const root of [
    "apps/worker/src/index.ts",
    "apps/web/src/server/runtime.ts",
  ]) {
    const sources = new Map([
      [root, 'import "./bridge.js";'],
      [
        root.replace(/[^/]+$/, "bridge.ts"),
        'import "@aarili/jobs/foundation-runtime";',
      ],
      [
        "packages/jobs/src/foundation-runtime.ts",
        "export const fixture = true;",
      ],
    ]);
    expect(checkBoundaries(sources)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "application graph reaches foundation exemplar",
        ),
      ]),
    );
  }
  expect(
    checkBoundaries(
      new Map([
        [
          "apps/web/src/app/page.tsx",
          '"use client"; import "@aarili/api/command-fixture-client";',
        ],
        [
          "packages/api/src/command-fixture-client.ts",
          "export const fixture = true;",
        ],
      ]),
    ).length,
  ).toBeGreaterThan(0);
  expect(
    checkBoundaries(
      new Map([
        ["packages/api/src/client.ts", 'import "@aarili/contracts/command";'],
        ["packages/contracts/src/command.ts", "export const fixture = true;"],
      ]),
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("browser graph reaches exemplar contracts"),
    ]),
  );
});

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

test("0.1.1c server runtime configuration cannot be imported by client code", () => {
  const server = [
    "apps/web/src/server/runtime-config.ts",
    'const enabled = process.env.NODE_ENV === "development";',
  ];
  expect(checkBoundaries(new Map([server]))).toEqual([]);
  expect(
    checkBoundaries(
      new Map([
        server,
        [
          "apps/web/src/client.tsx",
          '/* client directive after a comment */ "use client"; import "@/server/runtime-config";',
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

test("ENTRY-03/11 Next proxy is a server entry, but a client cannot import its composition graph", () => {
  const sources = new Map([
    ["apps/web/src/proxy.ts", 'import "./server/api";'],
    ["apps/web/src/server/api.ts", 'import "@aarili/auth";'],
    ["packages/auth/src/index.ts", "export const auth = true;"],
  ]);
  expect(checkBoundaries(sources)).toEqual([]);
  sources.set("apps/web/src/app/rogue.tsx", '"use client"; import "../proxy";');
  expect(checkBoundaries(sources)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("server entry point"),
      expect.stringContaining("server package"),
    ]),
  );
});

test("JS-A07 typed job-slip client erases route types and rejects transitive private source runtime", () => {
  const sources = new Map([
    [
      "apps/web/src/app/job-slips.tsx",
      '"use client"; import "@aarili/api/job-slips-client";',
    ],
    [
      "packages/api/src/job-slips-client.ts",
      'import type { Routes } from "./job-slips.js";',
    ],
    ["packages/api/src/job-slips.ts", 'import "@aarili/core/job-slips";'],
    ["packages/core/src/job-slips.ts", "export const privateRuntime = true;"],
  ]);
  expect(checkBoundaries(sources)).toEqual([]);
  sources.set(
    "packages/api/src/job-slips-client.ts",
    'import "./job-slips.js";',
  );
  expect(checkBoundaries(sources)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("browser graph reaches server package"),
    ]),
  );
});
