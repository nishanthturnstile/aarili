import { existsSync, readdirSync, readFileSync } from "node:fs";
import { posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const normalize = (path) => path.replaceAll("\\", "/");
const browserPackages = new Set(["contracts", "ui", "i18n"]);
const corePackages = new Set(["contracts", "money", "i18n"]);
const apiPackages = new Set(["core", "contracts", "auth", "platform"]);

function imports(code) {
  const result = [];
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    createImportExpressions: true,
  });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
      ].includes(node.type) &&
      node.source
    ) {
      const typeOnly =
        node.importKind === "type" ||
        node.exportKind === "type" ||
        (node.specifiers?.length > 0 &&
          node.specifiers.every((part) => part.importKind === "type"));
      result.push({ specifier: node.source.value, typeOnly });
    }
    if (node.type === "ImportExpression")
      result.push({
        specifier:
          node.source.type === "StringLiteral" ? node.source.value : null,
        typeOnly: false,
      });
    if (node.type === "CallExpression" && node.callee?.name === "require")
      result.push({
        specifier:
          node.arguments[0]?.type === "StringLiteral"
            ? node.arguments[0].value
            : null,
        typeOnly: false,
      });
    if (node.type === "TSImportEqualsDeclaration")
      result.push({
        specifier: node.moduleReference.expression?.value ?? null,
        typeOnly: node.importKind === "type",
      });
    if (node.type === "TSImportType")
      result.push({ specifier: node.source?.value ?? null, typeOnly: true });
    if (node.type === "Identifier" && node.name === "process")
      result.push({ specifier: "node:process", typeOnly: false });
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc") continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(ast.program);
  return result;
}

function packageOf(file) {
  return file.match(/^packages\/([^/]+)\//)?.[1];
}
function workspaceImport(specifier) {
  return specifier.match(/^@aarili\/([^/]+)(.*)$/);
}
function isClientModule(code) {
  return parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  }).program.directives.some(
    (directive) => directive.value.value === "use client",
  );
}
function resolveImport(file, specifier, sources) {
  const match = workspaceImport(specifier);
  let base;
  if (match)
    base = `packages/${match[1]}/src/${match[2] ? match[2].slice(1) : "index"}`;
  else if (specifier.startsWith("@/"))
    base = `apps/web/src/${specifier.slice(2)}`;
  else if (specifier.startsWith("."))
    base = posix.normalize(posix.join(posix.dirname(file), specifier));
  else return undefined;
  const stem = base.replace(/\.(m?js|jsx)$/, "");
  return [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.mjs`,
    `${stem}.js`,
    `${stem}/index.ts`,
    `${stem}/index.tsx`,
  ].find((candidate) => sources.has(candidate));
}

export function checkBoundaries(sources) {
  const errors = [];
  const graph = new Map();
  for (const [file, code] of sources) {
    const layer = packageOf(file);
    const dependencies = imports(code);
    graph.set(file, dependencies);
    for (const { specifier, typeOnly } of dependencies) {
      const fail = (reason) =>
        errors.push(`${file}: ${reason}: ${specifier ?? "computed import"}`);
      if (!specifier) {
        fail("computed imports cannot be checked");
        continue;
      }
      const workspace = workspaceImport(specifier);
      if (/^pg-boss(\/|$)/.test(specifier) && layer !== "jobs")
        fail("pg-boss is accessed only through jobs");
      const target = resolveImport(file, specifier, sources);
      const targetLayer = target && packageOf(target);
      if (
        specifier.startsWith(".") &&
        target &&
        ((layer && !target.startsWith(`packages/${layer}/`)) ||
          (targetLayer && targetLayer !== layer))
      )
        fail("cross-package relative imports bypass public exports");
      if (layer === "core" && !specifier.startsWith(".")) {
        if (
          !workspace ||
          (!corePackages.has(workspace[1]) &&
            !(
              workspace[1] === "db" &&
              workspace[2].startsWith("/repositories") &&
              typeOnly
            ))
        )
          fail(
            "core only consumes framework-free contracts and repository types",
          );
      }
      if (layer === "api" && file !== "packages/api/src/client.ts") {
        if (workspace && !apiPackages.has(workspace[1]))
          fail("API dependency is outside its boundary");
        if (/^(next|react|react-dom)(\/|$)/.test(specifier))
          fail("API must not depend on web frameworks");
      }
      if (layer === "contracts" && workspace)
        fail("contracts must be independent of implementation packages");
      if (layer === "money" && !specifier.startsWith("."))
        fail("money primitives must be framework and vendor free");
    }
  }
  const roots = [...sources.keys()].filter(
    (file) =>
      (file.startsWith("apps/web/src/") &&
        !file.startsWith("apps/web/src/app/api/") &&
        !file.startsWith("apps/web/src/server/") &&
        file !== "apps/web/src/instrumentation.ts" &&
        // App Router server entry points can import client components; the
        // browser graph starts at their explicit client boundary instead.
        (!/\/(page|layout)\.tsx$/.test(file) ||
          isClientModule(sources.get(file)))) ||
      file.startsWith("packages/ui/") ||
      file === "packages/api/src/client.ts",
  );
  const visited = new Set();
  const exemplars = new Set([
    "packages/api/src/commands.ts",
    "packages/api/src/command-fixture-client.ts",
    "packages/api/src/money-fixture-client.ts",
    "packages/jobs/src/foundation-runtime.ts",
    "packages/jobs/src/index.ts",
  ]);
  // Application composition cannot reach fixtures, including through a helper.
  const appVisited = new Set();
  function visitApplication(file) {
    if (appVisited.has(file)) return;
    appVisited.add(file);
    for (const { specifier, typeOnly } of graph.get(file) ?? []) {
      if (!specifier || typeOnly) continue;
      const target = resolveImport(file, specifier, sources);
      if (target && exemplars.has(target))
        errors.push(
          `${file}: application graph reaches foundation exemplar: ${specifier}`,
        );
      if (target) visitApplication(target);
    }
  }
  [...sources.keys()]
    .filter((file) => file.startsWith("apps/"))
    .forEach(visitApplication);
  function visitBrowser(file) {
    if (visited.has(file)) return;
    visited.add(file);
    for (const { specifier, typeOnly } of graph.get(file) ?? []) {
      if (!specifier) continue;
      const workspace = workspaceImport(specifier);
      if (
        workspace?.[1] === "contracts" &&
        ["/command", "/jobs"].includes(workspace[2])
      )
        errors.push(
          `${file}: browser graph reaches exemplar contracts: ${specifier}`,
        );
      if (
        workspace &&
        !browserPackages.has(workspace[1]) &&
        !(workspace[1] === "api" && workspace[2] === "/client")
      )
        errors.push(
          `${file}: browser graph reaches server package: ${specifier}`,
        );
      if (typeOnly) continue;
      if (/^(node:|server-only$|next\/(headers|server)$)/.test(specifier))
        errors.push(
          `${file}: browser graph reaches server runtime: ${specifier}`,
        );
      if (
        !workspace &&
        !specifier.startsWith(".") &&
        !specifier.startsWith("@/") &&
        !/^(react|react-dom|next|next-intl|zod|hono\/client|@tanstack\/react-query)(\/|$)/.test(
          specifier,
        ) &&
        !(
          file.startsWith("packages/ui/") &&
          /^(?:@base-ui\/react\/(?:button|input|dialog)|class-variance-authority|clsx|tailwind-merge|lucide-react)$/.test(
            specifier,
          )
        )
      )
        errors.push(
          `${file}: browser vendor import is not approved: ${specifier}`,
        );
      const target = resolveImport(file, specifier, sources);
      if (
        target?.startsWith("apps/web/src/server/") ||
        target?.startsWith("apps/web/src/app/api/") ||
        target === "apps/web/src/instrumentation.ts"
      )
        errors.push(
          `${file}: browser graph reaches a server entry point: ${specifier}`,
        );
      if (target) visitBrowser(target);
      else if (
        (specifier.startsWith(".") ||
          specifier.startsWith("@/") ||
          workspace) &&
        !specifier.endsWith(".css")
      )
        errors.push(`${file}: unresolved browser import: ${specifier}`);
    }
  }
  roots.forEach(visitBrowser);
  return [...new Set(errors)];
}

function collect(dir, sources, root) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      ["node_modules", "dist", ".next", ".next-ui", ".turbo"].includes(
        entry.name,
      )
    )
      continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) collect(path, sources, root);
    else if (/\.(ts|tsx|js|mjs)$/.test(path) && !path.endsWith(".d.ts"))
      sources.set(normalize(relative(root, path)), readFileSync(path, "utf8"));
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const root = resolve(".");
  const sources = new Map();
  collect(resolve("apps"), sources, root);
  collect(resolve("packages"), sources, root);
  const errors = checkBoundaries(sources);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.info(
      `Architecture §§6.2–6.4 boundaries checked across ${sources.size} source files.`,
    );
}
