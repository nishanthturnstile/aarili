import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const authority = "packages/ui/src/globals.css";
const canonical = readFileSync(authority, "utf8");
const ownedTokens = new Set(
  [...canonical.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
);

export function tokenViolations(file, source) {
  if (file === authority) return [];
  const problems = [];
  if (
    /#(?:[\da-f]{3,8})\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\s*\(/i.test(
      source,
    )
  )
    problems.push("raw colour");
  if (
    /\b(?:bg|text|border|ring|fill|stroke)-(?:black|white|(?:red|rose|pink|purple|violet|indigo|blue|cyan|teal|green|emerald|lime|yellow|amber|orange|stone|neutral|zinc|gray|slate)-\d+)\b/.test(
      source,
    )
  )
    problems.push("raw Tailwind palette");
  for (const match of source.matchAll(/(--[\w-]+)["']?\s*:/g)) {
    if (ownedTokens.has(match[1])) problems.push(`duplicate token ${match[1]}`);
  }
  for (const match of source.matchAll(/setProperty\(["'](--[\w-]+)["']/g)) {
    if (ownedTokens.has(match[1])) problems.push(`duplicate token ${match[1]}`);
  }
  if (file.endsWith(".css")) {
    for (const match of source.matchAll(
      /(?:^|[;{])\s*(?:color|background|font-family|font-size|border-radius|box-shadow)\s*:\s*([^;{}]+)/gi,
    )) {
      if (
        !/^(?:var\(|inherit\b|transparent\b|currentColor\b)/i.test(
          match[1].trim(),
        )
      )
        problems.push("nonsemantic visual declaration");
    }
  }
  return problems;
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return files(path);
    return /\.(?:tsx?|css)$/.test(path) ? [path] : [];
  });
}

export function checkDesignTokens() {
  const sources = [...files("apps/web/src"), ...files("packages/ui/src")];
  const errors = sources.flatMap((file) =>
    tokenViolations(file, readFileSync(file, "utf8")).map(
      (problem) => `${file}: ${problem}`,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  for (const config of [
    "apps/web/components.json",
    "packages/ui/components.json",
  ]) {
    const value = JSON.parse(readFileSync(config, "utf8"));
    if (
      resolve(config, "..", value.tailwind.css) !== resolve(authority) ||
      value.style !== "base-nova"
    )
      throw new Error(
        `${config}: generator must target the canonical CSS and Base UI Nova`,
      );
  }
  const appCss = readFileSync("apps/web/src/app/globals.css", "utf8").trim();
  if (appCss !== '@import "@aarili/ui/globals.css";')
    throw new Error("App globals must only import the authority");
  const manifests = [
    "package.json",
    "apps/web/package.json",
    "packages/ui/package.json",
  ];
  for (const manifest of manifests) {
    if (/@radix-ui|"vaul"/.test(readFileSync(manifest, "utf8")))
      throw new Error(`Forbidden primitive: ${manifest}`);
  }
  console.info(
    `0.1.1c: ${sources.length} UI sources use one CSS authority and Base UI only.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  checkDesignTokens();
