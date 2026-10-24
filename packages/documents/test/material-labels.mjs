import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { materialLabelModelSchema } from "@aarili/contracts/material-labels";
import { createDocumentRenderer } from "../dist/index.js";
import { materialLabelTemplates } from "../dist/material-labels.js";

const id = (n) => `019a5e59-1111-7000-8000-${String(n).padStart(12, "0")}`;
const hash = (b) => createHash("sha256").update(b).digest("hex");
export async function materialLabelProof(root) {
  const templates = await materialLabelTemplates(),
    entry = await templates.resolve("material-labels", 1),
    renderer = createDocumentRenderer(templates),
    evidence = {};
  try {
    for (const language of ["en", "ta"])
      for (const count of [1, 8, 9]) {
        const model = {
          kind: "material-labels.v1",
          audience: "minimal-label",
          language,
          issued: {
            docId: id(100),
            revision: 2,
            at: "2026-10-24T05:00:00.000Z",
          },
          labels: Array.from({ length: count }, (_, i) => ({
            orderId: id(1),
            orderCode: `SYN-LBL-${i + 1}`,
            pieceId: i % 2 ? id(2) : null,
            pieceName:
              i % 2
                ? { en: "Accepted upper piece", ta: "ஏற்றுக்கொண்ட மேல் ஆடை" }
                : null,
            garment: {
              en: "Accepted garment / service",
              ta: "ஏற்றுக்கொண்ட ஆடை / சேவை",
            },
            quantity: i % 2 ? 1 : null,
            copy: 1,
            copies: 1,
          })),
        };
        for (const field of [
          "customerName",
          "phone",
          "measurements",
          "fitNotes",
          "assets",
          "pattern",
          "margin",
          "instructions",
          "bookingId",
        ])
          assert.equal(
            materialLabelModelSchema.safeParse({
              ...model,
              [field]: "POISON-PRIVATE-170",
            }).success,
            false,
            field,
          );
        const revision = {
          docId: id(100),
          revision: 2,
          template: "material-labels",
          templateRevision: 1,
          language,
          paper: "A4",
          fontRevision: entry.fontRevision,
          templateHash: entry.templateHash,
          modelHash: hash(JSON.stringify(model)),
          model,
        };
        const proof = await renderer.proof(revision),
          name = `LBL-${language}-${count}`,
          file = `${root}/${name}.pdf`;
        await writeFile(file, proof.pdf);
        assert(
          !/\/Subtype\s*\/Link|\/URI|\/EmbeddedFile|\/JavaScript/.test(
            Buffer.from(proof.pdf).toString("latin1"),
          ),
          "no annotations, attachments or active content",
        );
        assert.equal(proof.loadedFonts, 4);
        assert.equal(proof.blockedRequests, 0);
        const info = execFileSync("pdfinfo", [file], { encoding: "utf8" }),
          pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]),
          size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
        assert.equal(pages, Math.ceil(count / 8));
        assert(
          Math.abs(Number(size[1]) - 595.276) < 1 &&
            Math.abs(Number(size[2]) - 841.89) < 1,
        );
        const text = execFileSync("pdftotext", ["-layout", file, "-"], {
          encoding: "utf8",
        });
        for (let i = 1; i <= count; i++) assert(text.includes(`SYN-LBL-${i}`));
        assert.equal(text.split("2026-10-24T05:00:00.000Z").length - 1, pages);
        assert(!text.includes("POISON-PRIVATE"));
        assert.match(
          execFileSync("pdffonts", [file], { encoding: "utf8" }),
          /NotoSansTamil/,
        );
        const images = execFileSync("pdfimages", ["-list", file], {
          encoding: "utf8",
        });
        assert.equal(images.trim().split("\n").length, 2, "no image objects");
        const xml = execFileSync("pdftotext", ["-bbox-layout", file, "-"], {
          encoding: "utf8",
        });
        const words = [
          ...xml.matchAll(
            /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">SYN-LBL-(\d+)<\/word>/g,
          ),
        ];
        assert.equal(words.length, count);
        if (count >= 8) {
          const mm = 72 / 25.4;
          assert(
            Math.abs(Number(words[1][1]) - Number(words[0][1]) - 93 * mm) < 1,
            "93mm column pitch",
          );
          assert(
            Math.abs(Number(words[2][2]) - Number(words[0][2]) - 68 * mm) < 1,
            "68mm row pitch",
          );
        }
        execFileSync("pdftoppm", ["-r", "96", "-png", file, `${root}/${name}`]);
        await writeFile(`${root}/${name}.text.txt`, text);
        evidence[name] = {
          pages,
          bytes: proof.pdf.length,
          sha256: hash(proof.pdf),
          fonts: proof.loadedFonts,
          images: 0,
        };
        const overflow = {
          ...model,
          labels: [
            {
              ...model.labels[0],
              garment: { en: "Long ".repeat(39), ta: "நீளம் ".repeat(30) },
            },
          ],
        };
        await assert.rejects(
          () =>
            renderer.render({
              ...revision,
              model: overflow,
              modelHash: hash(JSON.stringify(overflow)),
            }),
          /DOCUMENT_LAYOUT_OVERFLOW:label-/,
        );
      }
    await writeFile(
      `${root}/material-labels-evidence.json`,
      JSON.stringify(evidence, null, 2),
    );
    console.info(
      "JS-B01/02/03 minimal A4 label geometry, fonts, pagination and overflow checks",
      evidence,
    );
  } finally {
    await renderer.close();
  }
}
