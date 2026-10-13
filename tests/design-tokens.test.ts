import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { tokenViolations } from "../scripts/check-design-tokens.mjs";

test("USE-01/02/09 token guard rejects raw colours, palette utilities and duplicate ownership", () => {
  expect(
    tokenViolations(
      "apps/web/src/app/other.css",
      "a { color: #751f3d; --radius: 1rem; } ",
    ),
  ).toEqual(expect.arrayContaining(["raw colour", "duplicate token --radius"]));
  expect(
    tokenViolations(
      "packages/ui/src/components/raw.tsx",
      'const theme = "bg-rose-900";',
    ),
  ).toContain("raw Tailwind palette");
  expect(
    tokenViolations("apps/web/src/app/other.css", "a { font-family: Arial; } "),
  ).toContain("nonsemantic visual declaration");
});

test("USE-01 token guard allows semantic colours and legitimate structural layout", () => {
  expect(
    tokenViolations(
      "layout.css",
      ".grid { display: grid; width: 100%; border-width: 1px; gap: 2rem; color: var(--foreground); } ",
    ),
  ).toEqual([]);
  expect(
    tokenViolations(
      "row.tsx",
      'const layout = "grid grid-cols-2 border w-full bg-card text-foreground";',
    ),
  ).toEqual([]);
});

test("0.1.1c duplicate token ownership includes inline styles and imperative JavaScript", () => {
  expect(
    tokenViolations("other.tsx", 'const style = { "--primary": value };'),
  ).toContain("duplicate token --primary");
  expect(
    tokenViolations("other.tsx", 'root.style.setProperty("--radius", value);'),
  ).toContain("duplicate token --radius");
});

test("USE-09 light/dark token pairs have at least 4.5:1 text contrast and 3:1 control/focus contrast", () => {
  const css = readFileSync("packages/ui/src/globals.css", "utf8");
  function declarations(selector: string) {
    const block = css.split(`${selector} {`)[1]?.split("}")[0] ?? "";
    return Object.fromEntries(
      [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
        match[1],
        match[2]?.trim(),
      ]),
    );
  }
  const light = declarations(":root");
  const dark = { ...light, ...declarations(".dark") };
  function resolve(
    values: Record<string, string | undefined>,
    key: string,
  ): string {
    const value = values[`--${key}`];
    if (!value) throw new Error(`Missing token ${key}`);
    return value.startsWith("var(")
      ? resolve(values, value.slice(6, -1))
      : value;
  }
  function luminance(hex: string) {
    const channels = [1, 3, 5].map((start) => {
      const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (
      (channels[0] ?? 0) * 0.2126 +
      (channels[1] ?? 0) * 0.7152 +
      (channels[2] ?? 0) * 0.0722
    );
  }
  function contrast(
    values: Record<string, string | undefined>,
    first: string,
    second: string,
  ) {
    const a = luminance(resolve(values, first));
    const b = luminance(resolve(values, second));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  for (const values of [light, dark]) {
    for (const token of [
      "card",
      "popover",
      "primary",
      "secondary",
      "accent",
      "destructive",
      "success",
      "warning",
      "info",
      "error",
      "sidebar",
      "sidebar-primary",
      "sidebar-accent",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]) {
      expect(
        contrast(values, token, `${token}-foreground`),
        token,
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const surface of ["background", "card", "muted"])
      expect(
        contrast(values, "muted-foreground", surface),
        surface,
      ).toBeGreaterThanOrEqual(4.5);
    for (const surface of ["background", "card"]) {
      expect(contrast(values, "ring", surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(values, "input", surface)).toBeGreaterThanOrEqual(3);
    }
  }
});
