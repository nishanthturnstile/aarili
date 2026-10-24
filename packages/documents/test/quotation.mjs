import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { issuedQuotationModelSchema } from "@aarili/contracts/quotation-issues";
import { createDocumentRenderer } from "../dist/index.js";
import { quotationTemplates } from "../dist/quotation.js";

const id = (n) => `019a5e59-1111-7000-8000-${String(n).padStart(12, "0")}`;
export async function quotationProof(root) {
  const registry = await quotationTemplates(),
    entry = await registry.resolve("quotation", 1),
    renderer = createDocumentRenderer(registry),
    evidence = {};
  try {
    for (const language of ["en", "ta"])
      for (const variant of ["single", "package", "long"]) {
        const long = variant === "long",
          packageScope = variant !== "single",
          repetitions = long ? 16 : 1;
        const line = (n, role, amount, parentKey = null) => ({
          key: `q-${n}`,
          sequence: n,
          orderId: id(1),
          pieceId: null,
          labelEn: `SYNTHETIC ${role} ${n} ${long ? "Long customer-facing garment description and supplied-material assumptions. ".repeat(8) : ""}`,
          labelTa: `மாதிரி ஆடை ${n} ஸ்ரீ க்ஷேத்திரம் தையல் ${long ? "வாடிக்கையாளர் வழங்கிய பொருள் மற்றும் வேலை விவரம். ".repeat(8) : ""}`,
          role,
          parentKey,
          grossPaise: amount,
          acceptedPaise: amount,
          estimateRevisionId: null,
          serviceLineId: null,
          additionLineId: null,
          sourceId: null,
          reason: "",
          lineDiscountPaise: 0,
          bookingDiscountPaise: 0,
          netPaise:
            role === "charge" ? amount : role === "complimentary" ? 0 : null,
        });
        const lines = [line(0, "charge", packageScope ? 180000 : 100000)];
        if (packageScope)
          lines.push(
            line(1, "reference", 100000, "q-0"),
            line(2, "reference", 100000, "q-0"),
            line(3, "charge", 10000),
            line(4, "charge", 5000),
            line(5, "complimentary", 0),
          );
        if (long)
          for (let i = 6; i < 22; i++)
            lines.push(line(i, "charge", i === 21 ? 9999999999 : 0));
        lines[0].lineDiscountPaise = 10000;
        lines[0].bookingDiscountPaise = 5001;
        lines[0].netPaise -= 15001;
        const gross = lines
            .filter((l) => l.role === "charge")
            .reduce((s, l) => s + l.grossPaise, 0),
          total = gross - 15001;
        const model = issuedQuotationModelSchema.parse({
          kind: "quotation.v1",
          language,
          number: "QT-000001",
          docId: id(90),
          revision: 1,
          proposalId: id(91),
          previousRevision: null,
          issuedAt: "2026-10-24T10:00:00.000Z",
          issueDate: "2026-10-24",
          expiryDate: "2026-10-31",
          pricingDates: ["2026-10-24"],
          profileId: id(92),
          validityPolicyId: id(93),
          shop: {
            name: "SYNTHETIC quotation shop / ஸ்ரீ தையலகம்",
            address: "SYNTHETIC address",
            phone: "9000000000",
            email: "synthetic@example.test",
          },
          customerLabel: long
            ? "SYNTHETIC ஸ்ரீ க்ஷேத்திரம் வாடிக்கையாளர் ".repeat(4)
            : "SYNTHETIC customer",
          scope: [{ orderId: id(1), code: "SYN-QT-176" }],
          proposal: {
            kind: "quotation-proposal-not-issued",
            familyId: id(90),
            lines,
            grossPaise: gross,
            discountPaise: 15001,
            knownSubtotalPaise: total,
            unknownCount: 0,
            complete: true,
            totalPaise: total,
            assumptions:
              "SYNTHETIC customer-supplied materials; complimentary work has no selling charge.",
            agreementApplication: "unavailable",
            attribution: [],
            unattributedSellingPaise: total,
          },
          estimates:
            variant === "single"
              ? [
                  {
                    kind: "estimate-not-issued",
                    estimateId: id(77),
                    pricingDate: "2026-10-24",
                    lines: [
                      {
                        id: id(78),
                        sequence: 1,
                        subjectId: id(1),
                        sourceKey: "garment",
                        labelEn: "SYNTHETIC handling customer material",
                        labelTa: "SYNTHETIC handling",
                        component: "handling",
                        material: "customer",
                        state: "charge",
                        quantity: 1250,
                        unit: "mm",
                        basisQuantity: 1000,
                        ratePaise: 80000,
                        amountPaise: 100000,
                        coveringLineId: null,
                        assumptions: "SYNTHETIC supplied material is not sold",
                        reason: "",
                        issues: [],
                      },
                    ],
                    knownSubtotalPaise: 100000,
                    unknownCount: 0,
                    complete: true,
                    totalPaise: 100000,
                    assumptions: "",
                  },
                ]
              : [],
          terms: [
            {
              en:
                "SYNTHETIC TERMS-START " +
                "Reviewed terms and assumptions. ".repeat(repetitions) +
                " TERMS-END",
              ta:
                "SYNTHETIC TERMS-START " +
                "ஆய்வு செய்த நிபந்தனைகள் மற்றும் கருதுகோள்கள். ".repeat(repetitions) +
                " TERMS-END",
            },
          ],
        });
        assert.equal(
          issuedQuotationModelSchema.safeParse({
            ...model,
            privateCosts: { sentinel: "PRIVATE-COST-176" },
          }).success,
          false,
        );
        const proof = await renderer.proof({
          docId: model.docId,
          revision: 1,
          template: "quotation",
          templateRevision: 1,
          language,
          paper: "A4",
          fontRevision: entry.fontRevision,
          templateHash: entry.templateHash,
          modelHash: createHash("sha256")
            .update(JSON.stringify(model))
            .digest("hex"),
          model,
        });
        assert.equal(proof.loadedFonts, 4);
        assert.equal(proof.blockedRequests, 0);
        for (const poison of [
          "PRIVATE-COST-176",
          "GSTIN",
          "0% GST",
          "balance due",
          "payment-link",
          "measurements",
        ])
          assert(!proof.html.includes(poison), poison);
        const name = `QT-${language}-${variant}`,
          file = `${root}/${name}.pdf`;
        await writeFile(file, proof.pdf);
        const info = execFileSync("pdfinfo", [file], { encoding: "utf8" }),
          pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
        const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
        assert(
          size &&
            Math.abs(Number(size[1]) - 595.276) < 1 &&
            Math.abs(Number(size[2]) - 841.89) < 1,
        );
        if (long) assert(pages > 1);
        const text = execFileSync("pdftotext", ["-layout", file, "-"], {
          encoding: "utf8",
        });
        assert(text.includes("TERMS-START") && text.includes("TERMS-END"));
        assert(
          text
            .replace(/\s/g, "")
            .includes(
              `${Math.floor(total / 100).toLocaleString("en-IN")}.${String(total % 100).padStart(2, "0")}`,
            ),
        );
        if (variant === "single")
          assert(text.includes("1250") && text.includes("1000"));
        assert.equal(
          text.split("QT-000001").length - 1,
          pages,
          "number/header repeats on every page",
        );
        assert.match(
          execFileSync("pdffonts", [file], { encoding: "utf8" }),
          /NotoSansTamil/,
        );
        execFileSync("pdftoppm", ["-r", "96", "-png", file, `${root}/${name}`]);
        await writeFile(`${root}/${name}.text.txt`, text);
        evidence[name] = {
          pages,
          totalPaise: total,
          sha256: createHash("sha256").update(proof.pdf).digest("hex"),
          loadedFonts: proof.loadedFonts,
        };
      }
  } finally {
    await renderer.close();
  }
  await writeFile(
    `${root}/quotation-evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  return evidence;
}
