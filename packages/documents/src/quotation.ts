import { issuedQuotationModelSchema } from "@aarili/contracts/quotation-issues";
import {
  documentFonts,
  documentTemplates,
  escapeDocumentText as e,
} from "./index.js";

export async function quotationTemplates() {
  const fonts = await documentFonts();
  return documentTemplates([
    {
      id: "quotation",
      revision: 1,
      fontRevision: fonts.revision,
      validate: (m) => issuedQuotationModelSchema.safeParse(m).success,
      body: (input) => {
        const m = issuedQuotationModelSchema.parse(input),
          t = (en: string, ta: string) => e(m.language === "ta" ? ta : en);
        const amount = (v: number | null) =>
          v === null
            ? t("Unknown", "தெரியவில்லை")
            : `₹${Math.floor(v / 100).toLocaleString("en-IN")}.${String(v % 100).padStart(2, "0")}`;
        const row = (html: string, cls = "") =>
          `<tr class="${cls}"><td colspan="3">${html}</td></tr>`;
        // Bound presentation chunks by graphemes, preserving every character.
        // A single long Tamil paragraph must never become an unbreakable page row.
        const paragraphs = (s: string, prefix = "") => {
          const chars = Array.from(
              new Intl.Segmenter(m.language, {
                granularity: "grapheme",
              }).segment(s),
              (p) => p.segment,
            ),
            out: string[] = [];
          for (let i = 0; i < chars.length; ) {
            let end = Math.min(i + 400, chars.length);
            if (end < chars.length)
              for (let j = end - 1; j > i + 250; j--)
                if (/\s/u.test(chars[j] ?? "")) {
                  end = j + 1;
                  break;
                }
            out.push(
              row(
                `<p>${i === 0 ? prefix : ""}${e(chars.slice(i, end).join(""))}</p>`,
              ),
            );
            i = end;
          }
          return out.join("");
        };
        const header = `<h1>${t("Quotation — not a bill", "விலைப்புள்ளி — கட்டணப் பட்டியல் அல்ல")}</h1><strong>${e(m.number)} · ${t("Revision", "பதிப்பு")} ${m.revision}</strong><br>${e(m.shop.name)}<br>${t("Issued", "வெளியிட்ட நாள்")}: ${e(m.issueDate)} · ${t("Valid through (inclusive)", "செல்லுபடியாகும் இறுதி நாள் (உட்பட)")}: ${e(m.expiryDate)}<br>${e(m.scope[0]?.code ?? "")} · ${t("Orders in scope", "இந்த ஆவணத்தில் உள்ள ஆர்டர்கள்")}: ${m.scope.length}`;
        const roles = {
          charge: t("Charge", "கட்டணம்"),
          reference: t(
            "Included reference — not added",
            "உள்ளடங்கிய குறிப்பு — கூடுதல் கட்டணம் இல்லை",
          ),
          excluded: t("Excluded", "சேர்க்கப்படவில்லை"),
          complimentary: t("Complimentary", "இலவசம்"),
          unknown: t("Unknown", "தெரியவில்லை"),
        };
        const lines = m.proposal.lines
          .map(
            (l) =>
              paragraphs(m.language === "ta" ? l.labelTa : l.labelEn) +
              `<tr class="money"><td>${roles[l.role]}${l.parentKey ? `<br>${t("Included in", "இதில் உள்ளடங்கும்")}: ${e(l.parentKey)}` : ""}${!l.estimateRevisionId && l.role === "charge" ? `<br>${t("Quantity: 1 agreed scope; rate equals the gross amount", "அளவு: ஒப்புக்கொண்ட ஒரு வேலை; விலை மொத்தத் தொகைக்கு சமம்")}` : ""}</td><td>${t("Gross", "மொத்தம்")}: ${amount(l.grossPaise)}<br>${t("Line discount", "வரிசைத் தள்ளுபடி")}: ${amount(l.lineDiscountPaise)}<br>${t("Booking discount", "முன்பதிவுத் தள்ளுபடி")}: ${amount(l.bookingDiscountPaise)}</td><td>${t("Selling amount", "விற்பனைத் தொகை")}: ${l.netPaise === null ? roles[l.role] : amount(l.netPaise)}</td></tr>`,
          )
          .join("");
        const details = m.estimates
          .map(
            (estimate) =>
              row(
                `<h2>${t("Quantity and rate basis", "அளவு மற்றும் விலை அடிப்படை")} · ${e(estimate.pricingDate)}</h2>`,
              ) +
              estimate.lines
                .map(
                  (l) =>
                    paragraphs(m.language === "ta" ? l.labelTa : l.labelEn) +
                    row(
                      `<p>${t("Quantity / basis / unit", "அளவு / அடிப்படை / அலகு")}: ${e(String(l.quantity ?? "—"))} / ${e(String(l.basisQuantity ?? "—"))} / ${l.unit === "mm" ? t("mm", "மிமீ") : t("item", "எண்ணிக்கை")}<br>${t("Rate", "விலை")}: ${l.ratePaise === null ? t("Fixed amount", "நிலையான தொகை") : amount(l.ratePaise)} · ${t("Amount", "தொகை")}: ${amount(l.amountPaise)}<br>${t("Material ownership", "பொருள் உரிமை")}: ${{ none: t("None", "இல்லை"), unknown: t("Unknown", "தெரியவில்லை"), shop: t("Shop", "கடை"), customer: t("Customer", "வாடிக்கையாளர்") }[l.material]}</p>`,
                    ) +
                    paragraphs(l.assumptions),
                )
                .join(""),
          )
          .join("");
        return `<style>h1{font-size:17pt;margin:0 0 2mm}h2{font-size:14pt}.quote{border:0}.quote>thead>tr>th,.quote>tbody>tr>td{border:0;padding:1mm 0}.quote>thead>tr>th{background:white;padding-bottom:5mm}.quote .money>td{border:0.2mm solid black;padding:2mm;width:33%}.quote p{white-space:pre-wrap;margin:1mm 0 3mm}.total{break-inside:avoid}.total td{font-weight:600}</style><table class="quote"><thead><tr><th colspan="3">${header}</th></tr><tr><th>${t("Scope / inclusion", "வேலை / உள்ளடக்கம்")}</th><th>${t("Price / discount", "விலை / தள்ளுபடி")}</th><th>${t("Selling amount", "விற்பனைத் தொகை")}</th></tr></thead><tbody>${paragraphs(m.shop.address)}${row(`<p>${e(m.shop.phone)} ${e(m.shop.email)}</p>`)}${paragraphs(m.customerLabel)}${m.scope.map((s) => row(`<p>${t("Order", "ஆர்டர்")}: ${e(s.code)}</p>`)).join("")}${row(`<p>${t("Customer-supplied material is not sold as shop stock. Only separately disclosed handling services may be charged. Included reference amounts are not added to the total.", "வாடிக்கையாளர் வழங்கிய பொருள் கடை இருப்பாக விற்கப்படாது. தனியாகக் குறிப்பிடப்பட்ட சேவைக்கே கட்டணம். உள்ளடங்கிய குறிப்புத் தொகைகள் மொத்தத்தில் சேர்க்கப்படாது.")}</p>`)}${lines}${row(`<p>${t("Gross", "மொத்தம்")}: ${amount(m.proposal.grossPaise)}<br>${t("Total discount", "மொத்தத் தள்ளுபடி")}: ${amount(m.proposal.discountPaise)}<br>${t("Quotation total", "விலைப்புள்ளியின் மொத்தம்")}: ${amount(m.proposal.totalPaise)}</p>`, "total")}${details}${row(`<h2>${t("Assumptions", "கருதுகோள்கள்")}</h2>`)}${paragraphs(m.proposal.assumptions)}${row(`<h2>${t("Reviewed terms", "ஆய்வு செய்த நிபந்தனைகள்")}</h2>`)}${m.terms.map((v) => paragraphs(v[m.language])).join("")}${row(`<p>${t("Owner-recorded responses refer to this revision only. This document does not confirm an agreement, payment or receipt.", "உரிமையாளர் பதிவு செய்யும் பதில் இந்தப் பதிப்பிற்கே பொருந்தும். இது ஒப்பந்தம், பணம் செலுத்தல் அல்லது ரசீது உறுதி அல்ல.")}</p>`)}</tbody></table>`;
      },
    },
  ]);
}
