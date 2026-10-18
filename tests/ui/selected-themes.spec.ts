import { readFileSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function open(page: Page, locale: "en" | "ta", dark: boolean) {
  await page.goto("/sign-in");
  await expect(page.locator("main")).toHaveAttribute(
    "data-owner-ready",
    "true",
  );
  if (locale === "ta")
    await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
  if (dark)
    await page
      .getByRole("button", {
        name: locale === "en" ? "Use dark theme" : "இருண்ட தோற்றம்",
        exact: true,
      })
      .click();
  await page.evaluate(() => document.fonts.ready);
}

async function settled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

test.describe("USE-02 English startup and explicit Tamil selection", () => {
  test.use({ locale: "ta-IN" });
  test("every current route, reload and navigation starts in English despite a Tamil browser locale", async ({
    page,
  }) => {
    for (const [route, heading] of [
      ["/setup", "Create your account"],
      ["/sign-in", "Sign in to Aarili"],
      ["/recovery", "Recover your password"],
      ["/reset-password", "Set a new password"],
      ["/reauthenticate", "Confirm your password"],
      ["/owner", "Sign in to Aarili"],
      ["/onboarding", "Sign in to Aarili"],
      ["/dashboard", "Sign in to Aarili"],
      ["/connections", "Sign in to Aarili"],
    ]) {
      const response = await page.goto(route ?? "/");
      expect(await response?.text()).toMatch(/<main[^>]*lang="en"/);
      await expect(page.locator("main")).toHaveAttribute(
        "data-owner-ready",
        "true",
      );
      await expect(page.locator("main")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        heading ?? "",
      );
      await expect(page.locator("header a")).toHaveText("Aarili");
    }
    await page.goto("/sign-in");
    await expect(page.locator("main")).toHaveAttribute(
      "data-owner-ready",
      "true",
    );
    await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
    await expect(page.locator("main")).toHaveAttribute("lang", "ta");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "ஆரிலி",
    );
    await expect(page.locator("header a")).toHaveText("ஆரிலி");
    expect(
      await page.evaluate(() => [localStorage.length, sessionStorage.length]),
    ).toEqual([0, 0]);
    await page.reload();
    await expect(page.locator("main")).toHaveAttribute(
      "data-owner-ready",
      "true",
    );
    await expect(page.locator("main")).toHaveAttribute("lang", "en");
    await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
    await page.locator('a[href="/setup"]').click();
    await expect(page.locator("main")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Create your account",
    );
  });
});

function contrast(first: string, second: string) {
  function luminance(color: string) {
    const values = (color.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return (
      (values[0] ?? 0) * 0.2126 +
      (values[1] ?? 0) * 0.7152 +
      (values[2] ?? 0) * 0.0722
    );
  }
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const locale of ["en", "ta"] as const)
  for (const dark of [false, true]) {
    test(
      "USE-01/02/09 selected " +
        locale +
        " " +
        (dark ? "dark" : "light") +
        " owner controls, fonts, states and reflow",
      async ({ page }, info) => {
        const external: string[] = [];
        const errors: string[] = [];
        page.on("request", (request) => {
          if (
            !request.url().startsWith("http://127.0.0.1:3103") &&
            !request.url().startsWith("data:")
          )
            external.push(request.url());
        });
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (/hydration|did not match/i.test(message.text()))
            errors.push(message.text());
        });
        await open(page, locale, dark);
        await expect(page.locator("main")).toHaveAttribute("lang", locale);
        expect(
          await page
            .locator("html")
            .evaluate((element) => element.classList.contains("dark")),
        ).toBe(dark);
        expect(
          await page.evaluate(() => {
            const faces = [...document.fonts].filter(
              (font) => font.status === "loaded",
            );
            return [
              faces.some((font) => font.family.includes("Noto Sans Tamil")),
              faces.some(
                (font) =>
                  font.family.includes("Noto Sans") &&
                  !font.family.includes("Tamil"),
              ),
            ];
          }),
        ).toEqual([true, true]);
        const fontResources = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .filter((resource) => /\.woff2(?:\?|$)/.test(resource.name))
            .map((resource) => {
              const entry = resource as PerformanceResourceTiming;
              return { name: entry.name, bytes: entry.encodedBodySize };
            }),
        );
        expect(fontResources.length).toBeGreaterThan(0);
        await info.attach("self-hosted-font-payload", {
          body: JSON.stringify(fontResources),
          contentType: "application/json",
        });
        const submit = page.locator('button[type="submit"]');
        const input = page.locator("#email");
        for (const state of ["normal", "hover", "pressed"]) {
          if (state !== "normal") await submit.hover();
          if (state === "pressed") await page.mouse.down();
          await settled(page);
          const colors = await submit.evaluate((element) => {
            const style = getComputedStyle(element);
            return [style.color, style.backgroundColor];
          });
          expect(
            contrast(colors[0] ?? "", colors[1] ?? ""),
            state,
          ).toBeGreaterThanOrEqual(4.5);
          if (state === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
        }
        await input.focus();
        const focus = await input.evaluate((element) => {
          const s = getComputedStyle(element);
          return {
            width: s.outlineWidth,
            style: s.outlineStyle,
            ring: s.outlineColor,
            background: getComputedStyle(document.body).backgroundColor,
            boundary: s.borderColor,
          };
        });
        expect(focus.style).toBe("solid");
        expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(3);
        expect(contrast(focus.ring, focus.background)).toBeGreaterThanOrEqual(
          3,
        );
        expect(
          contrast(focus.boundary, focus.background),
        ).toBeGreaterThanOrEqual(3);
        await input.evaluate((element) =>
          element.setAttribute("aria-invalid", "true"),
        );
        expect(
          await input.evaluate(
            (element) => getComputedStyle(element).borderColor,
          ),
        ).not.toBe(focus.boundary);
        await input.evaluate((element) => {
          element.removeAttribute("aria-invalid");
          (element as HTMLInputElement).readOnly = true;
        });
        const readonly = await input.evaluate((element) => {
          (element as HTMLInputElement).value = "மீனா Meena";
          const s = getComputedStyle(element);
          return [s.color, s.backgroundColor, s.opacity];
        });
        expect(
          contrast(readonly[0] ?? "", readonly[1] ?? ""),
        ).toBeGreaterThanOrEqual(4.5);
        expect(readonly[2]).toBe("1");
        await input.evaluate((element) => {
          (element as HTMLInputElement).readOnly = false;
          (element as HTMLInputElement).value = "";
          (element as HTMLInputElement).disabled = true;
        });
        await submit.evaluate((element) => {
          (element as HTMLButtonElement).disabled = true;
        });
        for (const control of [submit, input]) {
          const disabled = await control.evaluate((element) => {
            const s = getComputedStyle(element);
            return [s.color, s.backgroundColor, s.opacity];
          });
          expect(
            contrast(disabled[0] ?? "", disabled[1] ?? ""),
          ).toBeGreaterThanOrEqual(4.5);
          expect(disabled[2]).toBe("1");
        }
        await input.evaluate((element) => {
          (element as HTMLInputElement).disabled = false;
        });
        await submit.evaluate((element) => {
          (element as HTMLButtonElement).disabled = false;
        });
        for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `width ${width}`,
          ).toBe(true);
          for (const control of await page
            .locator("main button, main input")
            .all()) {
            const box = await control.boundingBox();
            expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
            expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
          }
        }
        await page.setViewportSize(
          info.project.use.viewport ?? { width: 360, height: 800 },
        );
        await settled(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path:
            ".scratch/design-cleanup/captures/" +
            info.project.name +
            "-" +
            locale +
            "-" +
            (dark ? "dark" : "light") +
            ".png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 320, height: 800 });
        await page.addStyleTag({
          content:
            "html { font-size: 200%; } * { letter-spacing: .12em !important; word-spacing: .16em !important; line-height: 1.5 !important; }",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(external).toEqual([]);
        expect(errors).toEqual([]);
      },
    );
  }

test("USE-02/09 Tamil IME, missing fonts, reduced motion and storage failure", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*.woff2", (route) => route.abort());
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw Error("blocked");
    };
  });
  await open(page, "ta", false);
  const input = page.locator("#email");
  await input.dispatchEvent("compositionstart", { data: "" });
  await input.fill("தமிழ்");
  await input.dispatchEvent("compositionupdate", { data: "தமிழ்" });
  await input.dispatchEvent("compositionend", { data: "தமிழ்" });
  await expect(input).toHaveValue("தமிழ்");
  await input.fill("");
  await expect(input).toHaveValue("");
  await page.getByRole("button", { name: "இருண்ட தோற்றம்", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  expect(
    await page
      .locator("button")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("USE-01/09 remembered appearance precedes hydration and survives navigation without private storage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (/hydration|did not match/i.test(message.text()))
      errors.push(message.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem("aarili-appearance", "dark"),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("main")).toHaveAttribute(
    "data-owner-ready",
    "true",
  );
  await page.locator('a[href="/setup"]').click();
  await expect(page.locator("html")).toHaveClass("dark");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    "aarili-appearance",
  ]);
  expect(errors).toEqual([]);
});

test("0.1.1c canonical tokens propagate through actual owner inputs/actions/layout", async ({
  page,
}) => {
  await open(page, "en", false);
  const submit = page.locator('button[type="submit"]');
  const input = page.locator("#email");
  async function styles() {
    return {
      button: await submit.evaluate((element) => {
        const s = getComputedStyle(element);
        return [
          s.backgroundColor,
          s.borderRadius,
          s.paddingLeft,
          s.fontFamily,
          s.fontSize,
        ];
      }),
      input: await input.evaluate((element) => {
        const s = getComputedStyle(element);
        return [s.borderRadius, s.paddingLeft, s.fontFamily, s.fontSize];
      }),
      main: await page
        .locator("main")
        .evaluate((element) => getComputedStyle(element).paddingLeft),
    };
  }
  const before = await styles();
  const source = readFileSync("packages/ui/src/globals.css", "utf8");
  const edited = source
    .replace("--primary: #751f3d", "--primary: #245d45")
    .replace("--radius: 0.75rem", "--radius: 1rem")
    .replace("--spacing: 0.25rem", "--spacing: 0.3rem")
    .replace(
      '--font-body: "Noto Sans", "Noto Sans Tamil", sans-serif',
      '--font-body: "Noto Sans Tamil", "Noto Sans", sans-serif',
    )
    .replace("--type-body: 1rem", "--type-body: 1.125rem");
  const block = edited.match(/:root \{[\s\S]*?\n\}/)?.[0];
  expect(block).toBeTruthy();
  await page.addStyleTag({ content: block ?? "" });
  await expect
    .poll(async () => (await styles()).button[0])
    .toBe("rgb(36, 93, 69)");
  const after = await styles();
  for (let i = 0; i < before.button.length; i++)
    expect(after.button[i]).not.toBe(before.button[i]);
  for (let i = 0; i < before.input.length; i++)
    expect(after.input[i]).not.toBe(before.input[i]);
  expect(after.main).not.toBe(before.main);
});
