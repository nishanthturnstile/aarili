import { materialLabelModelSchema } from "@aarili/contracts/material-labels";
import {
  documentFonts,
  documentTemplates,
  escapeDocumentText as e,
} from "./index.js";
export async function materialLabelTemplates() {
  const fonts = await documentFonts();
  return documentTemplates([
    {
      id: "material-labels",
      revision: 1,
      fontRevision: fonts.revision,
      validate: (m) => materialLabelModelSchema.safeParse(m).success,
      boundedBoxes: [".label-content"],
      body: (input) => {
        const m = materialLabelModelSchema.parse(input),
          t = (en: string, ta: string) => e(m.language === "ta" ? ta : en),
          pages = [];
        for (let start = 0; start < m.labels.length; start += 8) {
          const cells = m.labels
            .slice(start, start + 8)
            .map(
              (v, index) =>
                `<article class="label-cell"><div class="label-content" data-field="label-${start + index + 1}"><strong>${e(v.orderCode)}</strong><p>${e(v.garment[m.language])}</p>${v.pieceId ? `<p>${e(v.pieceName?.[m.language] ?? "")}<br><span>${e(v.pieceId)}</span></p>` : ""}<p>${t("Quantity", "எண்ணிக்கை")}: ${v.quantity ?? t("Unknown — order level", "தெரியவில்லை — ஆர்டர் அளவில்")}</p><p>${t("Copy", "நகல்")} ${v.copy} / ${v.copies}</p></div></article>`,
            );
          while (cells.length < 8)
            cells.push(
              '<div class="label-cell blank" aria-hidden="true"></div>',
            );
          pages.push(`<section class="label-page">${cells.join("")}</section>`);
        }
        return `<style>@page{size:A4;margin:15mm;@bottom-center{content:"${e(m.issued?.at ?? "")} · ${t("Revision", "பதிப்பு")} ${m.issued?.revision ?? 0} · " counter(page) " / " counter(pages);font-family:"Noto Sans Tamil","Noto Sans";font-size:12pt}}.label-page{display:grid;grid-template-columns:87mm 87mm;grid-template-rows:repeat(4,63mm);column-gap:6mm;row-gap:5mm;width:180mm;height:267mm;break-after:page;break-inside:avoid}.label-page:last-child{break-after:auto}.label-cell{box-sizing:border-box;width:87mm;height:63mm;border:.2mm solid black;padding:3mm;break-inside:avoid}.label-cell.blank{border:0}.label-content{height:100%;width:100%;font-size:12pt;line-height:1.35;overflow:visible;overflow-wrap:anywhere}.label-content p{margin:1.5mm 0}.label-content strong{font-size:14pt}.label-content span{font-size:12pt}</style>${pages.join("")}`;
      },
    },
  ]);
}
