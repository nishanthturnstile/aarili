import {
  documentFonts,
  documentTemplates,
  escapeDocumentText,
} from "@aarili/documents";
// Synthetic-only template/model. No default production registry imports this.
export async function syntheticDocumentTemplates(revision = 1) {
  const fonts = await documentFonts();
  return documentTemplates([
    {
      id: "synthetic.document",
      revision,
      fontRevision: fonts.revision,
      validate(model) {
        return (
          !!model &&
          typeof model === "object" &&
          Object.keys(model).every((k) => ["title", "lines"].includes(k)) &&
          typeof model.title === "string" &&
          model.title.length <= 500 &&
          Array.isArray(model.lines) &&
          model.lines.length <= 200 &&
          model.lines.every((x) => typeof x === "string" && x.length <= 2000)
        );
      },
      body(model) {
        return `<h1>${escapeDocumentText(model.title)}</h1><table><thead><tr><th>சோதனை / Synthetic</th></tr></thead><tbody>${model.lines.map((x) => `<tr><td>${escapeDocumentText(x)}</td></tr>`).join("")}</tbody></table>`;
      },
    },
  ]);
}
export const tamilGoldenStrings = [
  "அக்கா தங்கை சோதனை",
  "பட்டுப் பாவாடை",
  "தையல் பணிப்பட்டியல்",
  "மென்மையான துணி",
  "கட்டுப்பாடு மற்றும் பொறுப்பு",
  "பொத்தான் பொருத்தம்",
  "வெட்டும் முன் சரிபார்க்கவும்",
  "மாற்றமற்ற பதிவுகள்",
  "ஸ்ரீ சோதனை",
  "ஸ்ரீமதி சோதனை",
  "ஸ்ரீதேவி மாதிரி",
  "ஸ்ரீரங்கம் மாதிரி",
  "க்ஷ சோதனை",
  "க்ஷேத்திரம் மாதிரி",
  "க்ஷமா மாதிரி",
  "ஸ்ரீ க்ஷ இணைப்பு",
  "கி கீ கு கூ",
  "கெ கே கை",
  "கொ கோ கௌ",
  "சி சீ செ சே",
  "தி தீ து தூ",
  "பெ பே பை",
  "மொ மோ மௌ",
  "றி றீ றெ றே",
  "சோதனைப் பெயர் நீளமானதாக இருந்தாலும் முழுமையாகக் காட்டப்பட வேண்டும்",
  "இது உண்மையான வாடிக்கையாளர் பெயர் அல்ல; நீளச் சோதனை மட்டும்",
  "தையல் குறிப்புகள் பல வரிகளில் தெளிவாக மடங்க வேண்டும்",
  "சோதனைச் சேவை விவரமும் திருத்தக் குறிப்பும் ஒன்றாகப் பொருந்த வேண்டும்",
  "நீளமானசெயற்கைப்பெயர்சோதனைநீளமானசெயற்கைப்பெயர்சோதனை",
  "பட்டியல் வரி மற்றும் தலைப்பு அடுத்த பக்கத்திலும் படிக்கப்பட வேண்டும்",
  "சோதனை Blouse ₹1,250.50",
  "முன்பணம் Test ₹0.00",
  "Sample A3 — சோதனை ₹12,34,567.89",
  "வரிசை SYN-001 / Tamil-English",
  "அளவு 10 mm; ₹25.75 மாதிரி",
  "₹1 ₹10 ₹100 — கணக்கு அல்ல, வடிவச் சோதனை",
  "வணக்கம்! சோதனை?",
  'மேற்கோள்: ‘தமிழ்’ மற்றும் "English"',
  "அடைப்புக்குறி (சோதனை) [மாதிரி]",
  "எண்: ௧ ௨ ௩ / 1 2 3",
  "இணைப்பு — இடைவெளி; நிறுத்தம்.",
  "& < > பாதுகாப்பான உரை",
  "க் க் க்",
  "ஸ்ரீ ஸ்ரீ ஸ்ரீ",
  "கொ / கொ வடிவச் சோதனை",
  "கோ / கோ வடிவச் சோதனை",
  "பக்கம் மாறும்போது இந்த அட்டவணை வரி பிரியக்கூடாது",
  "மீண்டும் வரும் தலைப்பு: சோதனை",
  "உள்ளடக்கம் நெடுவரிசையை மீறக்கூடாது — wrapping test",
  "இறுதி வரி: செயற்கைத் தரவு மட்டும்",
];
