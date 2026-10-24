import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { createDocumentRenderer } from "../dist/index.js";
import { jobSlipTemplates } from "../dist/job-slip.js";

const id = (n) => `019a5e59-1111-7000-8000-${String(n).padStart(12, "0")}`;
const label = (en, ta = en) => ({ en, ta });
const hash = (b) => createHash("sha256").update(b).digest("hex");
// Deterministic synthetic diagram. Never a customer or fitting image.
function diagram() {
  function crc(b) {
    let c = 0xffffffff;
    for (const x of b) {
      c ^= x;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(t, b) {
    const type = Buffer.from(t),
      length = Buffer.alloc(4),
      check = Buffer.alloc(4);
    length.writeUInt32BE(b.length);
    check.writeUInt32BE(crc(Buffer.concat([type, b])));
    return Buffer.concat([length, type, b, check]);
  }
  const w = 600,
    h = 400,
    pixels = Buffer.alloc((w * 3 + 1) * h, 255);
  for (let y = 0; y < h; y++) {
    pixels[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const edge =
        (x > 120 &&
          x < 480 &&
          (Math.abs(y - 80) < 3 || Math.abs(y - 330) < 3)) ||
        (y > 80 && y < 330 && (Math.abs(x - 120) < 3 || Math.abs(x - 480) < 3));
      if (edge)
        pixels.fill(
          20,
          y * (w * 3 + 1) + 1 + x * 3,
          y * (w * 3 + 1) + 4 + x * 3,
        );
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export async function jobSlipProof(root) {
  const registry = await jobSlipTemplates(),
    entry = await registry.resolve("job-slip", 1),
    renderer = createDocumentRenderer(registry),
    image = diagram();
  const evidence = {};
  try {
    for (const language of ["en", "ta"]) {
      const long = language === "ta";
      const model = {
        kind: "job-slip.v1",
        audience: "private-production",
        orderId: id(1),
        pieceId: id(2),
        language,
        issued: {
          docId: id(3),
          revision: 2,
          at: "2026-10-24T04:00:00.000Z",
          reason: "SYNTHETIC reviewed sources",
        },
        orderCode: "SYN-JS-169",
        pieceLabel: label("Blouse", "ரவிக்கை"),
        garment: label("Garment set", "ஆடைத் தொகுப்பு"),
        instructions: Array.from(
          { length: long ? 14 : 1 },
          (_, i) =>
            `WORK-${i + 1} Exact instruction / சரியான வேலைக் குறிப்பு. ${"கழுத்து வடிவம், தையல் குறிப்பு; 1/4 in, ½ cm. ".repeat(long ? 5 : 1)}`,
        ),
        sources: ["design", "measurement", "form", "pattern"].map(
          (kind, i) => ({
            kind,
            id: id(10 + i),
            version: kind === "form" ? null : 3,
            description: `${kind} exact selected source / தேர்ந்தெடுத்த மூலம்`,
          }),
        ),
        measurements: [
          {
            fieldId: id(20),
            label: label("Length", "நீளம்"),
            value: "10 1/4",
            unit: "in",
            source: "direct; tape; 2026-10-24",
          },
          {
            fieldId: id(21),
            label: label("Unknown", "தெரியவில்லை"),
            value: "Unknown / தெரியவில்லை",
            unit: null,
            source: "unknown",
          },
        ],
        warnings: [
          label(
            "Reference only. Scale/formula unverified. Not permission to cut.",
            "குறிப்பு மட்டுமே. அளவுத்திட்டம் சரிபார்க்கப்படவில்லை. வெட்ட அனுமதி அல்ல.",
          ),
        ],
        assets: [
          {
            referenceId: id(30),
            assetId: id(31),
            subjectId: id(32),
            kind: "design",
            purpose: "manual-pattern",
            originalSha256: hash(image),
            displaySha256: hash(image),
            width: 600,
            height: 400,
            caption: "SYNTHETIC diagram / செயற்கை வடிவம்",
            annotations: [
              {
                anchor: {
                  kind: "rectangle",
                  x: 2000,
                  y: 2000,
                  width: 6000,
                  height: 6250,
                },
                note: "ANNOTATION-START சரியான ஏற்றுக்கொண்ட இடம்; position unchanged.",
              },
              ...Array.from({ length: long ? 5 : 0 }, (_, i) => ({
                anchor: { kind: "note" },
                note: `NOTE-${i + 1} ${"தமிழ் விளக்கக் குறிப்பு. ".repeat(25)}`,
              })),
              {
                anchor: { kind: "point", x: 5000, y: 5000 },
                note: "ANNOTATION-END குறிப்பின் முடிவு",
              },
            ],
          },
        ],
        omittedAssetIds: [],
      };
      const revision = {
        docId: id(3),
        revision: 2,
        template: "job-slip",
        templateRevision: 1,
        language,
        paper: "A4",
        fontRevision: entry.fontRevision,
        templateHash: entry.templateHash,
        modelHash: hash(JSON.stringify(model)),
        model,
      };
      const assets = [
        {
          id: id(30),
          bytes: image,
          sha256: hash(image),
          contentType: "image/png",
        },
      ];
      const proof = await renderer.proof(revision, assets),
        name = `JS-${language}`,
        file = `${root}/${name}.pdf`;
      assert.equal(proof.loadedFonts, 4);
      assert.equal(proof.blockedRequests, 0);
      await writeFile(file, proof.pdf);
      const info = execFileSync("pdfinfo", [file], { encoding: "utf8" }),
        pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
      const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
      assert(
        size &&
          Math.abs(Number(size[1]) - 595.276) < 1 &&
          Math.abs(Number(size[2]) - 841.89) < 1,
      );
      const text = execFileSync("pdftotext", ["-layout", file, "-"], {
        encoding: "utf8",
      });
      assert.equal(
        text.split("SYN-JS-169").length - 1,
        pages + 1,
        "scope repeats on every page plus final provenance",
      );
      for (const marker of [
        "ANNOTATION-START",
        "ANNOTATION-END",
        "10 1/4",
        ...model.instructions.map((_, i) => `WORK-${i + 1} `),
      ])
        assert(text.includes(marker), marker);
      for (const s of model.sources)
        assert(text.replace(/\s/g, "").includes(s.id), `exact ${s.kind} ID`);
      assert(!text.includes("PRIVATE-FITTING"));
      assert.match(
        execFileSync("pdffonts", [file], { encoding: "utf8" }),
        /NotoSansTamil/,
      );
      execFileSync("pdftoppm", ["-r", "96", "-png", file, `${root}/${name}`]);
      await writeFile(`${root}/${name}.text.txt`, text);
      evidence[language] = {
        pages,
        sha256: hash(proof.pdf),
        bytes: proof.pdf.length,
        fonts: proof.loadedFonts,
        blockedRequests: proof.blockedRequests,
      };
      await assert.rejects(
        () => renderer.render(revision),
        /DOCUMENT_ASSETS_UNAVAILABLE/,
      );
      await assert.rejects(
        () =>
          renderer.render(revision, [{ ...assets[0], sha256: "0".repeat(64) }]),
        /DOCUMENT_ASSET_REJECTED/,
      );
    }
    assert(evidence.ta.pages > evidence.en.pages);
    await writeFile(
      `${root}/job-slips-evidence.json`,
      JSON.stringify(evidence, null, 2),
    );
    console.info(
      "JS-A03/08 real A4 job-slip font/asset/continuation checks",
      evidence,
    );
  } finally {
    await renderer.close();
  }
}
