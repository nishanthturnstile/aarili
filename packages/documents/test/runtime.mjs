import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import {
  createDocumentRenderer,
  documentFonts,
  documentTemplates,
} from "../dist/index.js";
import { jobSlipProof } from "./job-slip.mjs";
import { syntheticDocumentTemplates, tamilGoldenStrings } from "./template.mjs";

const fonts = await documentFonts(),
  registry = await syntheticDocumentTemplates();
const renderer = createDocumentRenderer(registry);
const templateHash = (await registry.resolve("synthetic.document", 1))
  .templateHash;
async function stdin() {
  let text = "";
  for await (const b of process.stdin) {
    text += b;
    if (Buffer.byteLength(text) > 200000) throw Error("SYNTHETIC_INPUT_LIMIT");
  }
  return JSON.parse(text);
}
const make = (paper) => ({
  docId: "019a5e59-1111-7000-8000-000000000001",
  revision: 1,
  template: "synthetic.document",
  templateRevision: 1,
  language: "ta",
  paper,
  fontRevision: fonts.revision,
  templateHash,
  modelHash: "0".repeat(64),
  model: {
    title: "தமிழ் செயற்கைச் சோதனை / Synthetic",
    lines: tamilGoldenStrings.map(
      (x, i) => `GOLDEN-${String(i + 1).padStart(2, "0")} ${x}`,
    ),
  },
});
try {
  if (process.argv.includes("--one")) {
    const bytes = await renderer.render(await stdin());
    process.stdout.write(Buffer.from(bytes).toString("base64"));
  } else {
    const root = "/proof";
    await mkdir(root, { recursive: true });
    assert.equal(renderer.observation().launches, 0);
    const sandbox = await renderer.sandboxEvidence();
    assert.equal(sandbox.uid, 1000);
    const observations = {
      sandbox,
      fontRevision: fonts.revision,
      pages: {},
      fontPrograms: {},
      versions: {
        node: process.version,
        poppler: execFileSync("pdfinfo", ["-v"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim(),
      },
    };
    assert.equal(tamilGoldenStrings.length, 50);
    for (const paper of ["A4", "A3"]) {
      const p = await renderer.proof(make(paper));
      assert.equal(p.loadedFonts, 4);
      assert.equal(p.blockedRequests, 0);
      const file = `${root}/${paper}.pdf`;
      await writeFile(file, p.pdf);
      const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
      const pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
      assert(pages > 1);
      const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
      const expected = paper === "A4" ? [595.276, 841.89] : [841.89, 1190.55];
      assert(
        size &&
          Math.abs(Number(size[1]) - expected[0]) < 1 &&
          Math.abs(Number(size[2]) - expected[1]) < 1,
      );
      const text = execFileSync("pdftotext", ["-layout", file, "-"], {
        encoding: "utf8",
      });
      for (let i = 1; i <= 50; i++)
        assert.equal(
          text.split(`GOLDEN-${String(i).padStart(2, "0")}`).length - 1,
          1,
        );
      assert.equal(
        text.split("Synthetic").length - 1,
        pages + 1,
        "table header repeats on every PDF page",
      );
      const fontReport = execFileSync("pdffonts", [file], { encoding: "utf8" });
      const lines = fontReport.trim().split("\n").slice(2);
      assert(lines.length >= 4);
      for (const line of lines) {
        assert.match(line, /NotoSans/);
        assert.match(line, /yes\s+yes\s+yes/);
      }
      await writeFile(`${root}/${paper}.fonts.txt`, fontReport);
      await writeFile(`${root}/${paper}.text.txt`, text);
      execFileSync("pdftoppm", ["-r", "96", "-png", file, `${root}/${paper}`]);
      // Inspect font programs actually embedded in Chromium's output, in
      // addition to Poppler's independent embedded/subset/Unicode report.
      const bytes = Buffer.from(p.pdf),
        source = bytes.toString("latin1");
      const fontHashes = [];
      for (const id of new Set(
        Array.from(source.matchAll(/\/FontFile2\s+(\d+) 0 R/g), (m) => m[1]),
      )) {
        const match = new RegExp(
          `(?:^|\\n)${id} 0 obj\\s*([\\s\\S]*?)stream\\r?\\n`,
        ).exec(source);
        assert(match);
        const length = Number(match[1].match(/\/Length\s+(\d+)/)?.[1]);
        assert(length > 0 && length < 1000000);
        const encoded = bytes.subarray(
          match.index + match[0].length,
          match.index + match[0].length + length,
        );
        const program = match[1].includes("/FlateDecode")
          ? inflateSync(encoded)
          : encoded;
        assert(program.length > 1000);
        fontHashes.push(createHash("sha256").update(program).digest("hex"));
      }
      assert.equal(fontHashes.length, 4);
      observations.pages[paper] = {
        count: pages,
        widthPoints: Number(size[1]),
        heightPoints: Number(size[2]),
        pdfBytes: p.pdf.length,
        pdfSha256: createHash("sha256").update(p.pdf).digest("hex"),
      };
      observations.fontPrograms[paper] = {
        report: fontReport,
        sha256: fontHashes,
      };
    }
    assert(observations.pages.A4.count > observations.pages.A3.count);
    assert.equal(renderer.observation().launches, 1);
    // Malicious values are text; a deliberately hostile test-only template
    // additionally probes defense in depth without supplying an arbitrary URL.
    const hostile = make("A4");
    hostile.model = {
      title: '<script>document.body.textContent="EXECUTED"</script>',
      lines: [
        '<img src="file:///etc/passwd">',
        '<iframe src="https://example.invalid/private"></iframe>',
      ],
    };
    const escaped = await renderer.proof(hostile);
    assert(escaped.html.includes("&lt;script&gt;"));
    assert(!escaped.html.includes("<script>"));
    const boundaryRegistry = documentTemplates([
      {
        id: "synthetic.boundary",
        revision: 1,
        fontRevision: fonts.revision,
        validate: () => true,
        body: () =>
          '<script>document.body.textContent="EXECUTED"</script><img src="file:///etc/passwd"><iframe src="https://example.invalid/private"></iframe><style>@import url("https://example.invalid/fonts");</style><p>Safe boundary fixture</p>',
      },
    ]);
    const boundary = createDocumentRenderer(boundaryRegistry);
    try {
      const entry = await boundaryRegistry.resolve("synthetic.boundary", 1);
      const proof = await boundary.proof({
        ...make("A4"),
        template: "synthetic.boundary",
        templateHash: entry.templateHash,
      });
      await writeFile(`${root}/boundary.pdf`, proof.pdf);
      const text = execFileSync("pdftotext", [`${root}/boundary.pdf`, "-"], {
        encoding: "utf8",
      });
      assert(text.includes("Safe boundary fixture"));
      assert(!text.includes("EXECUTED"));
      assert(!text.includes("root:"));
    } finally {
      await boundary.close();
    }
    await renderer.close();
    const idle = createDocumentRenderer(registry, { idleMilliseconds: 40 });
    try {
      await Promise.all([idle.render(make("A4")), idle.render(make("A3"))]);
      assert.equal(idle.observation().launches, 1);
      // Closing a real sandboxed browser can take longer than a fixed sleep on
      // a CPU-limited host. Observe actual disconnection within a bounded budget.
      const idleDeadline = Date.now() + 5000;
      while (idle.observation().connected && Date.now() < idleDeadline)
        await new Promise((r) => setTimeout(r, 50));
      assert.equal(idle.observation().connected, false);
      await idle.render(make("A4"));
      assert.equal(idle.observation().launches, 2);
    } finally {
      await idle.close();
    }
    await jobSlipProof(root);
    observations.nodePeakRssKiB = process.resourceUsage().maxRSS;
    await writeFile(
      `${root}/evidence.json`,
      JSON.stringify(observations, null, 2),
    );
    console.log(
      JSON.stringify({
        sandbox: "namespace+seccomp",
        uid: sandbox.uid,
        fonts: 4,
        strings: 50,
        pages: observations.pages,
        contexts: "fresh; serial; idle close and relaunch verified",
      }),
    );
  }
} finally {
  await renderer.close();
}
