import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { DocumentIssue } from "@aarili/contracts/documents";
import { type Browser, chromium } from "playwright-core";

export function escapeDocumentText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );
}
export type DocumentTemplate = {
  id: string;
  revision: number;
  fontRevision: string;
  validate(model: unknown): boolean;
  body(model: unknown): string;
  assetIds?(model: unknown): string[];
  boundedBoxes?: readonly string[];
};
// Registries are supplied by reviewed server code. No default synthetic or
// business template is registered, and no browser/file supplies executable HTML.
export function documentTemplates(
  definitions: readonly DocumentTemplate[] = [],
) {
  const entries = new Map<
    string,
    DocumentTemplate & { templateHash: string }
  >();
  for (const d of definitions) {
    const key = `${d.id}:${d.revision}`;
    if (entries.has(key)) throw Error("DOCUMENT_TEMPLATE_DUPLICATE");
    const templateHash = digest(
      JSON.stringify({
        protocol: "aarili.static-pdf.v1",
        body: d.body.toString(),
        validate: d.validate.toString(),
        ...(d.assetIds ? { assetIds: d.assetIds.toString() } : {}),
        ...(d.boundedBoxes ? { boundedBoxes: d.boundedBoxes } : {}),
      }),
    );
    entries.set(key, Object.freeze({ ...d, templateHash }));
  }
  return {
    async resolve(id: string, revision: number) {
      return entries.get(`${id}:${revision}`);
    },
  };
}
const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
type FontManifest = { revision: string; files: Record<string, string> };
const fontRoot = new URL("../assets/noto-5.3.0/", import.meta.url);
export async function documentFonts() {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", fontRoot), "utf8"),
  ) as FontManifest;
  const files: Record<string, Buffer> = {};
  for (const [name, hash] of Object.entries(manifest.files)) {
    if (
      !/^noto-sans(?:-tamil)?-(?:latin|tamil)-(?:400|600)-normal\.woff2$/.test(
        name,
      )
    )
      throw Error("DOCUMENT_FONT_MANIFEST_INVALID");
    const bytes = await readFile(new URL(name, fontRoot));
    if (digest(bytes) !== hash) throw Error("DOCUMENT_FONT_HASH_MISMATCH");
    files[name] = bytes;
  }
  if (
    Object.keys(files).length !== 4 ||
    digest(JSON.stringify(manifest.files)) !== manifest.revision
  )
    throw Error("DOCUMENT_FONT_MANIFEST_INVALID");
  return { revision: manifest.revision, files };
}
type Revision = DocumentIssue & {
  fontRevision: string;
  templateHash: string;
  modelHash: string;
};
export type RenderProof = {
  pdf: Uint8Array;
  preview: Uint8Array;
  html: string;
  fontRevision: string;
  loadedFonts: number;
  blockedRequests: number;
};
// Global serialization applies even if two server compositions create separate
// renderer instances. Browser state and contexts never cross a render boundary.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
export function createDocumentRenderer(
  registry: ReturnType<typeof documentTemplates>,
  options: { idleMilliseconds?: number; executablePath?: string } = {},
) {
  let browser: Browser | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    closed = false,
    launches = 0,
    idleEpoch = 0;
  const idle = options.idleMilliseconds ?? 60000;
  if (!Number.isInteger(idle) || idle < 1 || idle > 60000)
    throw Error("DOCUMENT_IDLE_LIMIT_INVALID");
  async function ensureBrowser() {
    idleEpoch++;
    if (closed) throw Error("DOCUMENT_RENDERER_CLOSED");
    if (timer) clearTimeout(timer);
    if (!browser?.isConnected()) {
      browser = await chromium.launch({
        // Windows uses Playwright's pinned headless shell; Linux uses the full
        // pinned Chromium build whose namespace/seccomp sandbox is proved in CI.
        ...(process.platform === "win32" ? {} : { channel: "chromium" }),
        chromiumSandbox: true,
        headless: true,
        timeout: 15000,
        ...(options.executablePath
          ? { executablePath: options.executablePath }
          : {}),
      });
      launches++;
    }
    return browser;
  }
  function idleClose() {
    const expected = idleEpoch;
    timer = setTimeout(() => {
      void serial(async () => {
        if (expected !== idleEpoch) return;
        await browser?.close();
        browser = undefined;
      }).catch(() => {});
    }, idle);
    timer.unref();
  }
  async function perform(
    d: Revision,
    proof: boolean,
    assets: {
      id: string;
      bytes: Uint8Array;
      sha256: string;
      contentType: "image/jpeg" | "image/png" | "image/webp";
    }[] = [],
  ): Promise<RenderProof> {
    const definition = await registry.resolve(d.template, d.templateRevision);
    const fonts = await documentFonts();
    if (
      !definition?.validate(d.model) ||
      definition.templateHash !== d.templateHash ||
      definition.fontRevision !== d.fontRevision ||
      fonts.revision !== d.fontRevision
    )
      throw Error("DOCUMENT_TEMPLATE_UNAVAILABLE");
    const expected = definition.assetIds?.(d.model) ?? [];
    if (
      assets.length !== expected.length ||
      expected.length > 20 ||
      new Set(expected).size !== expected.length
    )
      throw Error("DOCUMENT_ASSETS_UNAVAILABLE");
    const images = new Map<string, string>();
    let assetBytes = 0;
    for (const a of assets) {
      assetBytes += a.bytes.length;
      if (
        !expected.includes(a.id) ||
        images.has(a.id) ||
        !/^[a-f0-9-]{36}$/.test(a.id) ||
        !["image/jpeg", "image/png", "image/webp"].includes(a.contentType) ||
        a.bytes.length > 8 * 1024 * 1024 ||
        assetBytes > 20 * 1024 * 1024 ||
        digest(a.bytes) !== a.sha256
      )
        throw Error("DOCUMENT_ASSET_REJECTED");
      images.set(
        a.id,
        `data:${a.contentType};base64,${Buffer.from(a.bytes).toString("base64")}`,
      );
    }
    let body = definition.body(structuredClone(d.model));
    body = body.replace(
      /src="aarili-asset:([a-f0-9-]{36})"/g,
      (_, id: string) => {
        const image = images.get(id);
        if (!image) throw Error("DOCUMENT_ASSETS_UNAVAILABLE");
        return `src="${image}"`;
      },
    );
    if (body.length > (expected.length ? 30 * 1024 * 1024 : 1000000))
      throw Error("DOCUMENT_TEMPLATE_LIMIT");
    const css = Object.entries(fonts.files)
      .map(
        ([name, bytes]) =>
          `@font-face{font-family:"${name.includes("-tamil-") ? "Noto Sans Tamil" : "Noto Sans"}";font-weight:${name.includes("-600-") ? 600 : 400};src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2");font-display:block}`,
      )
      .join("");
    const html = `<!doctype html><html lang="${d.language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src ${expected.length ? "data:" : "'none'"}; script-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><style>${css}@page{size:${d.paper};margin:15mm}*{box-sizing:border-box}body{margin:0;font:12pt/1.7 "Noto Sans Tamil","Noto Sans",sans-serif;color:black;background:white;overflow-wrap:anywhere}h1,h2{font-weight:600;break-after:avoid}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:2mm;text-align:left;vertical-align:top;border:0.2mm solid black}p{orphans:3;widows:3}a{color:inherit;text-decoration:none}</style></head><body>${body}</body></html>`;
    const b = await ensureBrowser();
    const context = await b.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
      acceptDownloads: false,
      locale: d.language === "ta" ? "ta-IN" : "en-IN",
      timezoneId: "Asia/Kolkata",
      viewport: { width: d.paper === "A3" ? 1123 : 794, height: 1123 },
    });
    let blockedRequests = 0;
    const budget = setTimeout(() => {
      void context.close().catch(() => {});
    }, 45000);
    budget.unref();
    try {
      await context.route("**/*", async (route) => {
        blockedRequests++;
        await route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.setContent(html, { waitUntil: "load", timeout: 15000 });
      await page.emulateMedia({ media: "print" });
      const loadedFonts = await page.evaluate(async () => {
        await Promise.all([
          document.fonts.load('400 12px "Noto Sans Tamil"', "தமிழ்"),
          document.fonts.load('600 12px "Noto Sans Tamil"', "ஸ்ரீ"),
          document.fonts.load('400 12px "Noto Sans"', "English ₹"),
          document.fonts.load('600 12px "Noto Sans"', "Aarili"),
        ]);
        await document.fonts.ready;
        const fonts = Array.from(document.fonts);
        if (fonts.length !== 4 || fonts.some((f) => f.status !== "loaded"))
          throw Error("DOCUMENT_FONTS_NOT_READY");
        return fonts.length;
      });
      if (expected.length)
        await page.evaluate(async () => {
          for (const img of Array.from(document.images)) {
            await img.decode();
            if (!img.complete || !img.naturalWidth || !img.naturalHeight)
              throw Error("DOCUMENT_IMAGE_NOT_READY");
          }
        });
      if (definition.boundedBoxes) {
        const overflow = await page.evaluate(
          (selectors) => {
            for (const selector of selectors)
              for (const box of document.querySelectorAll<HTMLElement>(
                selector,
              )) {
                if (
                  box.scrollHeight > box.clientHeight + 1 ||
                  box.scrollWidth > box.clientWidth + 1
                )
                  return box.dataset.field ?? "label";
              }
            return null;
          },
          [...definition.boundedBoxes],
        );
        if (overflow) throw Error(`DOCUMENT_LAYOUT_OVERFLOW:${overflow}`);
      }
      const pdf = new Uint8Array(
        await page.pdf({
          preferCSSPageSize: true,
          printBackground: true,
          tagged: true,
        }),
      );
      if (pdf.length > 25 * 1024 * 1024) throw Error("DOCUMENT_PDF_LIMIT");
      const preview = proof
        ? new Uint8Array(
            await page.screenshot({ fullPage: true, animations: "disabled" }),
          )
        : new Uint8Array();
      return {
        pdf,
        preview,
        html,
        fontRevision: fonts.revision,
        loadedFonts,
        blockedRequests,
      };
    } finally {
      clearTimeout(budget);
      await context.close();
      idleClose();
    }
  }
  return {
    render: (d: Revision, assets?: Parameters<typeof perform>[2]) =>
      serial(async () => (await perform(d, false, assets)).pdf),
    // Private verification seam; never exposed through an API or browser client.
    proof: (d: Revision, assets?: Parameters<typeof perform>[2]) =>
      serial(() => perform(d, true, assets)),
    observation: () => ({
      launches,
      connected: browser?.isConnected() ?? false,
    }),
    sandboxEvidence: () =>
      serial(async () => {
        if (process.platform !== "linux" || process.getuid?.() === 0)
          throw Error("DOCUMENT_LINUX_NONROOT_REQUIRED");
        const b = await ensureBrowser(),
          context = await b.newContext();
        try {
          const page = await context.newPage();
          await page.goto("chrome://sandbox");
          const report = await page.locator("body").innerText();
          if (
            !/PID namespaces\s+Yes/.test(report) ||
            !/Network namespaces\s+Yes/.test(report) ||
            !/Seccomp-BPF sandbox\s+Yes/.test(report) ||
            !report.includes("adequately sandboxed")
          )
            throw Error("DOCUMENT_SANDBOX_UNPROVEN");
          const renderers = [];
          for (const pid of (await readdir("/proc")).filter((x) =>
            /^\d+$/.test(x),
          )) {
            try {
              const cmd = await readFile(`/proc/${pid}/cmdline`, "utf8");
              if (!cmd.includes("--type=renderer")) continue;
              if (
                cmd.includes("--no-sandbox") ||
                cmd.includes("--disable-seccomp-filter-sandbox")
              )
                throw Error("DOCUMENT_SANDBOX_DISABLED");
              const status = await readFile(`/proc/${pid}/status`, "utf8");
              renderers.push(
                status
                  .split("\n")
                  .filter((x) =>
                    /^(Uid|CapEff|NoNewPrivs|Seccomp|NSpid):/.test(x),
                  )
                  .join(";"),
              );
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.startsWith("DOCUMENT_")
              )
                throw error;
            }
          }
          if (
            !renderers.length ||
            renderers.some(
              (s) =>
                !s.includes("Seccomp:\t2") ||
                !s.includes("CapEff:\t0000000000000000") ||
                /^Uid:\s+0/.test(s),
            )
          )
            throw Error("DOCUMENT_SANDBOX_UNPROVEN");
          return { uid: process.getuid?.(), report, renderers };
        } finally {
          await context.close();
          idleClose();
        }
      }),
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      return serial(async () => {
        await browser?.close();
        browser = undefined;
      });
    },
  };
}
