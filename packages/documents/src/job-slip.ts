import {
  type JobSlipModel,
  jobSlipModelSchema,
} from "@aarili/contracts/job-slips";
import {
  documentFonts,
  documentTemplates,
  escapeDocumentText as e,
} from "./index.js";

// Trusted template: only the server's allowlisted source projection and bounded,
// hash-pinned image bytes enter it. Never customer HTML or storage URLs.
export async function jobSlipTemplates() {
  const fonts = await documentFonts();
  return documentTemplates([
    {
      id: "job-slip",
      revision: 1,
      fontRevision: fonts.revision,
      validate: (m) => jobSlipModelSchema.safeParse(m).success,
      assetIds: (m) =>
        jobSlipModelSchema.parse(m).assets.map((a) => a.referenceId),
      body: (input) => {
        const m: JobSlipModel = jobSlipModelSchema.parse(input);
        const t = (en: string, ta: string) => e(m.language === "ta" ? ta : en);
        const text = (v: { en: string; ta: string }) => e(v[m.language]);
        const identity = `${e(m.orderCode)}${m.pieceId ? ` / ${e(m.pieceId)}` : ""}`;
        const header = `<strong>${t("Private production slip", "தனிப்பட்ட தயாரிப்புப் பணி விவரம்")}</strong><br>${identity}<br>${t("Revision", "பதிப்பு")} ${m.issued?.revision ?? "—"} · ${text(m.garment)}${m.pieceLabel ? ` / ${text(m.pieceLabel)}` : ""}`;
        const row = (html: string, cls = "") =>
          `<tr class="slip-row ${cls}"><td colspan="3">${html}</td></tr>`;
        // Bounded rows avoid Chromium's spanning-cell/header paint overlap. Split
        // only the presentation, preserving every Unicode character of the model.
        const paragraphs = (v: string, prefix = "", cls = "") => {
          const chars = Array.from(
              new Intl.Segmenter(m.language, {
                granularity: "grapheme",
              }).segment(v),
              (p) => p.segment,
            ),
            rows = [];
          for (let i = 0; i < chars.length; ) {
            let end = Math.min(i + 600, chars.length);
            if (end < chars.length) {
              for (let j = end - 1; j > i + 400; j--)
                if (/\s/u.test(chars[j] ?? "")) {
                  end = j + 1;
                  break;
                }
            }
            rows.push(
              row(`<p>${prefix}${e(chars.slice(i, end).join(""))}</p>`, cls),
            );
            i = end;
          }
          return rows.join("");
        };
        const heading = (en: string, ta: string) =>
          row(`<h2>${t(en, ta)}</h2>`, "slip-heading");
        const measurements = m.measurements
          .map(
            (v) =>
              `<tr class="slip-measure"><td>${text(v.label)}</td><td>${e(v.value)} ${e(v.unit ?? "")}</td><td>${e(v.source)}</td></tr>`,
          )
          .join("");
        const figures = m.assets
          .map((a) => {
            const width = Math.min(160, (140 * a.width) / a.height);
            const anchors = a.annotations
              .map((v, i) => {
                const p = v.anchor;
                return p.kind === "note"
                  ? ""
                  : `<span style="position:absolute;left:${p.x / 100}%;top:${p.y / 100}%;${p.kind === "rectangle" ? `width:${p.width / 100}%;height:${p.height / 100}%;border:1pt solid black;` : ""}font-size:12pt;line-height:1;background:white;color:black">${i + 1}</span>`;
              })
              .join("");
            return (
              row(
                `<div style="position:relative;width:${width}mm;max-width:100%;line-height:0;margin:4mm 0"><img alt="${e(a.caption)}" src="aarili-asset:${a.referenceId}" style="width:100%;height:auto">${anchors}</div>`,
              ) +
              paragraphs(
                a.caption,
                `${t("Reference", "குறிப்பு")}: ${e(a.referenceId)}<br>`,
              ) +
              a.annotations
                .map((v, i) =>
                  paragraphs(v.note, `${e(a.referenceId)} · ${i + 1}. `),
                )
                .join("")
            );
          })
          .join("");
        return `<style>.slip-shell{border:0}.slip-shell>thead>tr>th,.slip-row>td{border:0;padding:0}.slip-shell>thead>tr>th{padding-bottom:5mm;background:white}.slip-row,.slip-measure{break-inside:avoid}.slip-measure>td,.slip-measure>th{padding:2mm;border:0.2mm solid black}.slip-heading{break-after:avoid}h2{font-size:14pt}p{white-space:pre-wrap;margin:2mm 0 4mm}.slip-warning p{border:0.3mm solid black;padding:3mm}</style><table class="slip-shell"><thead><tr><th colspan="3">${header}</th></tr></thead><tbody>${row(`<p>${t("SYNTHETIC — not production approval", "மாதிரி — தயாரிப்புக்கான அனுமதி அல்ல")}</p>`)}${heading("Requested work", "கோரப்பட்ட வேலை")}${m.instructions
          .filter(Boolean)
          .map((v) => paragraphs(v))
          .join(
            "",
          )}${heading("Exact selected references", "தேர்ந்தெடுத்த குறிப்புகள்")}${m.sources.map((s) => row(`<p>${e(s.kind)}: ${e(s.id)}${s.version === null ? "" : ` · v${s.version}`}<br>${e(s.description)}</p>`)).join("")}${measurements ? heading("Production measurements", "தயாரிப்பு அளவுகள்") + `<tr class="slip-measure"><th>${t("Field", "அளவு")}</th><th>${t("Recorded value / unit", "பதிவு செய்த மதிப்பு / அலகு")}</th><th>${t("Source / method", "மூலம் / முறை")}</th></tr>${measurements}` : ""}${m.warnings.map((w) => paragraphs(w[m.language], "", "slip-warning")).join("")}${figures}${row(`<p>${t("Issued", "வெளியிடப்பட்டது")}: ${e(m.issued?.at ?? "")}<br>${identity} · ${t("Revision", "பதிப்பு")} ${m.issued?.revision ?? "—"}</p>`)}</tbody></table>`;
      },
    },
  ]);
}
