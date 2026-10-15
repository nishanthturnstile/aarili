import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function contrast(a: string, b: string) {
  const luminance = (value: string) => {
    const channels = (value.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map((channel) => {
        const n = Number(channel) / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    const [red, green, blue] = channels;
    if (red === undefined || green === undefined || blue === undefined)
      throw new Error(`Unsupported computed color: ${value}`);
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

for (const locale of ["en", "ta"] as const) {
  test(`0.1.1c trial USE-01/02/09 ${locale}: fonts, states, synthetic booking and seven responsive widths`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const external: string[] = [];
    const fontBytes = new Map<string, number>();
    page.on("request", (request) => {
      if (!request.url().startsWith("http://127.0.0.1:3103"))
        external.push(request.url());
    });
    page.on("response", async (response) => {
      if (/\.woff2(?:\?|$)/.test(response.url())) {
        const body = await response.body().catch(() => null);
        if (body) fontBytes.set(response.url(), body.byteLength);
      }
    });
    await page.goto("/dev/design-system");
    const baseline = await page.getByRole("button", {
      name: "Current light",
      exact: true,
    });
    await baseline.click();
    await page.evaluate(() => document.fonts.ready);
    const baselineBytes = [...fontBytes.values()].reduce((a, b) => a + b, 0);
    await page
      .getByRole("button", { name: "Candidate light", exact: true })
      .click();
    if (locale === "ta")
      await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-aarili-theme",
      "grounded-editorial",
    );
    await page.evaluate(() => document.fonts.ready);
    const face = await page.evaluate(() =>
      [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family.replaceAll('"', "")),
    );
    expect(face).toContain("Newsreader Variable");
    expect(face).toContain("Plus Jakarta Sans Variable");
    expect(
      await page
        .getByTestId("editorial-specimen")
        .locator('[lang="ta"]')
        .evaluate((node) => getComputedStyle(node).fontFamily),
    ).toMatch(/^"?Noto Serif Tamil/);
    if (locale === "ta") {
      expect(face).toContain("Noto Serif Tamil");
      expect(
        await page
          .getByTestId("editorial-specimen")
          .evaluate((node) => getComputedStyle(node).fontFamily),
      ).toMatch(/^"?Noto Serif Tamil/);
    }
    expect(external).toEqual([]);
    const primary = page.getByRole("button", {
      name: locale === "en" ? "Continue to review" : "சரிபார்க்கத் தொடரவும்",
      exact: true,
    });
    await expect(primary).toHaveCSS("background-color", "rgb(20, 41, 32)");
    await primary.hover();
    await expect(primary).toHaveCSS("background-color", "rgb(14, 29, 22)");
    await primary.evaluate((node) =>
      node.getAnimations().forEach((animation) => {
        animation.finish();
      }),
    );
    await page.mouse.down();
    await expect(primary).toHaveCSS("background-color", "rgb(10, 23, 17)");
    await page.mouse.up();
    await primary.focus();
    await expect(primary).toHaveCSS("outline-width", "3px");
    const pair = await primary.evaluate((node) => {
      const s = getComputedStyle(node);
      return [s.color, s.backgroundColor] as const;
    });
    expect(contrast(pair[0], pair[1])).toBeGreaterThanOrEqual(4.5);
    await page.locator("#sample-text").focus();
    await expect(page.locator("#sample-text")).toHaveCSS(
      "outline-width",
      "3px",
    );
    const boundary = await page.locator("#sample-text").evaluate((node) => {
      const s = getComputedStyle(node);
      return [s.borderColor, s.backgroundColor, s.outlineColor] as const;
    });
    expect(contrast(boundary[0], boundary[1])).toBeGreaterThanOrEqual(3);
    expect(contrast(boundary[2], boundary[1])).toBeGreaterThanOrEqual(3);
    const disabled = page.getByRole("button", {
      name: locale === "en" ? "Unavailable action" : "செயல் கிடைக்கவில்லை",
      exact: true,
    });
    await expect(disabled).toBeDisabled();
    await expect(disabled).toHaveCSS("opacity", "1");
    const selected = page.getByRole("button", {
      name: locale === "en" ? "Selected sample" : "தேர்ந்தெடுத்த மாதிரி",
      exact: true,
    });
    await selected.click();
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect(selected).toHaveCSS("text-decoration-line", "underline");
    await expect(page.locator("#reference-readonly")).toHaveAttribute(
      "readonly",
      "",
    );
    await expect(page.locator("#reference-readonly")).toHaveCSS(
      "color",
      "rgb(25, 27, 26)",
    );

    const workspace = page.getByTestId("sample-workspace");
    const open =
      locale === "en" ? "Open Meera's garment order" : "மீராவின் ஆடை ஆர்டரைக் காட்டு";
    const back =
      locale === "en"
        ? "Back to sample Today"
        : "மாதிரி இன்றைய பணிகளுக்குத் திரும்பு";
    for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Today overflow at ${width}`,
      ).toBe(true);
      await workspace.getByRole("button", { name: open, exact: true }).click();
      await expect(page.getByTestId("composition-heading")).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Detail overflow at ${width}`,
      ).toBe(true);
      await expect(page.getByTestId("booking-finance")).toContainText(
        locale === "en"
          ? "Booking-wide payment summary"
          : "முன்பதிவு முழுவதற்குமான பணச் சுருக்கம்",
      );
      await expect(page.locator("#sample-measurement-2")).toHaveText(
        locale === "en" ? "Not recorded" : "பதிவு செய்யப்படவில்லை",
      );
      await expect(workspace).toContainText("ORD-SAMPLE-0142");
      await expect(workspace).toContainText("ORD-SAMPLE-0143");
      await expect(workspace).toContainText("ND-BL-014");
      if (width === 320 || width === 390 || width === 768 || width === 1280) {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
      await workspace.getByRole("button", { name: back, exact: true }).click();
    }
    await page.setViewportSize(
      info.project.use.viewport ?? { width: 390, height: 844 },
    );
    await workspace.screenshot({
      path: `docs/agents/design-trial/captures/${info.project.name}-${locale}-today.png`,
    });
    await workspace.getByRole("button", { name: open, exact: true }).click();
    await workspace.screenshot({
      path: `docs/agents/design-trial/captures/${info.project.name}-${locale}-detail.png`,
    });
    for (const control of await page.locator("main button, main input").all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const trigger = page.getByRole("button", {
      name: locale === "en" ? "Open sample dialog" : "மாதிரி உரையாடலைத் திற",
      exact: true,
    });
    await trigger.click();
    await expect(page.getByRole("dialog")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.addStyleTag({
      content:
        "html { font-size: 200%; } p { margin-bottom: 2em; } *:not(:lang(ta)) { letter-spacing: .12em; word-spacing: .16em; }",
    });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((node) => node.getBoundingClientRect().right > innerWidth + 1)
        .map(
          (node) =>
            `${node.tagName}.${node.className}: ${Math.round(node.getBoundingClientRect().right)}`,
        )
        .slice(0, 20),
    );
    expect(overflow).toEqual([]);
    const textOverflow = await page.evaluate(() => ({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      nodes: [...document.querySelectorAll("main *")]
        .filter(
          (node) =>
            node instanceof HTMLElement &&
            node.scrollWidth > node.clientWidth + 1 &&
            !["INPUT", "SVG"].includes(node.tagName),
        )
        .map(
          (node) =>
            `${node.tagName}.${node.className}: ${node.clientWidth}/${node.scrollWidth}`,
        )
        .slice(0, 20),
    }));
    expect(
      textOverflow.documentWidth,
      JSON.stringify(textOverflow),
    ).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      workspace.getByRole("button", { name: back, exact: true }),
    ).toBeVisible();
    const bytes = [...fontBytes.values()].reduce((a, b) => a + b, 0);
    await info.attach(`font-payload-${locale}`, {
      body: JSON.stringify({
        baselineWoff2Bytes: baselineBytes,
        totalWoff2Bytes: bytes,
        additionalBytes: bytes - baselineBytes,
        files: fontBytes.size,
      }),
      contentType: "application/json",
    });
  });
}

test("0.1.1c trial: canonical candidate tokens propagate without editing components", async ({
  page,
}) => {
  await page.goto("/dev/design-system");
  await page
    .getByRole("button", { name: "Candidate light", exact: true })
    .click();
  const primary = page.getByRole("button", {
    name: "Continue to review",
    exact: true,
  });
  const card = page.locator('[data-slot="card"]').last();
  const snapshot = async () => ({
    primary: await primary.evaluate((node) => {
      const s = getComputedStyle(node);
      return [s.backgroundColor, s.borderRadius, s.fontFamily];
    }),
    card: await card.evaluate((node) => {
      const s = getComputedStyle(node);
      return [s.borderRadius, s.paddingLeft];
    }),
    page: await page
      .locator("main")
      .evaluate((node) => getComputedStyle(node).paddingLeft),
  });
  const before = await snapshot();
  const source = readFileSync("packages/ui/src/globals.css", "utf8");
  const candidate = source.match(
    /:root\[data-aarili-theme="grounded-editorial"\]:not\(\.dark\) \{[\s\S]*?\n\}/,
  )?.[0];
  expect(candidate).toBeTruthy();
  let edited = candidate ?? "";
  for (const [name, value] of [
    ["--primary", "#245d45"],
    ["--radius-control", "1rem"],
    ["--radius-card", "1.25rem"],
    ["--space-page", "2rem"],
    ["--font-body", '"Noto Sans", "Noto Sans Tamil", sans-serif'],
  ]) {
    const pattern = new RegExp(`(${name}:\\s*)[^;]+;`);
    expect(edited).toMatch(pattern);
    edited = edited.replace(pattern, `$1${value};`);
  }
  await page.addStyleTag({ content: edited });
  await expect(primary).toHaveCSS("background-color", "rgb(36, 93, 69)");
  const after = await snapshot();
  for (let i = 0; i < before.primary.length; i++)
    expect(after.primary[i]).not.toBe(before.primary[i]);
  for (let i = 0; i < before.card.length; i++)
    expect(after.card[i]).not.toBe(before.card[i]);
  expect(after.page).not.toBe(before.page);
});

test("0.1.1c trial USE-02/09 fallback fonts, reduced motion, theme reset and local retry are honest", async ({
  page,
}) => {
  await page.route(/\.woff2?(?:\?|$)/, (route) => route.abort());
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/dev/design-system");
  const previousTheme = await page
    .locator("html")
    .getAttribute("data-aarili-theme");
  await page
    .getByRole("button", { name: "Candidate light", exact: true })
    .click();
  await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
  await expect(page.getByTestId("editorial-specimen")).toBeVisible();
  await page
    .getByRole("button", { name: "மாதிரி உரையாடலைத் திற", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCSS(
    "transition-duration",
    "0s, 0s",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Current dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("html")).not.toHaveAttribute("data-aarili-theme");
  await page
    .getByRole("button", { name: "Current light", exact: true })
    .click();
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page
    .getByRole("button", { name: "மாதிரியை மீண்டும் காட்டு", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("எதுவும் சேமிக்கப்படவில்லை");
  await page.getByRole("link", { name: "Review sign-in screen" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  if (previousTheme)
    await expect(page.locator("html")).toHaveAttribute(
      "data-aarili-theme",
      previousTheme,
    );
  else
    await expect(page.locator("html")).not.toHaveAttribute("data-aarili-theme");
});
