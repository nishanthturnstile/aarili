// Search keys v1 are derived hints, never an identity or replacement text.
export const SEARCH_KEY_VERSION = 1 as const;
const consonants: Readonly<Record<string, string>> = {
  க: "k",
  ங: "ng",
  ச: "c",
  ஞ: "nj",
  ட: "t",
  ண: "n",
  த: "t",
  ந: "n",
  ப: "p",
  ம: "m",
  ய: "y",
  ர: "r",
  ல: "l",
  வ: "v",
  ழ: "zh",
  ள: "l",
  ற: "r",
  ன: "n",
  ஜ: "j",
  ஶ: "s",
  ஷ: "sh",
  ஸ: "s",
  ஹ: "h",
};
const vowels: Readonly<Record<string, string>> = {
  அ: "a",
  ஆ: "aa",
  இ: "i",
  ஈ: "ii",
  உ: "u",
  ஊ: "uu",
  எ: "e",
  ஏ: "e",
  ஐ: "ai",
  ஒ: "o",
  ஓ: "o",
  ஔ: "au",
  ஃ: "h",
};
const signs: Readonly<Record<string, string>> = {
  "ா": "aa",
  "ி": "i",
  "ீ": "ii",
  "ு": "u",
  "ூ": "uu",
  "ெ": "e",
  "ே": "e",
  "ை": "ai",
  "ொ": "o",
  "ோ": "o",
  "ௌ": "au",
  "்": "",
};
export function tamilToLatinV1(input: string): string {
  const chars = Array.from(input.normalize("NFC"));
  let result = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    const consonant = consonants[ch];
    if (consonant !== undefined) {
      const next = chars[i + 1] ?? "";
      result += consonant + (Object.hasOwn(signs, next) ? signs[next] : "a");
      if (Object.hasOwn(signs, next)) i++;
    } else result += vowels[ch] ?? ch;
  }
  return result;
}
const spaces = (input: string) =>
  input
    .replaceAll(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replaceAll(/\s+/g, " ");
export function latinFoldV1(input: string): string {
  return spaces(
    tamilToLatinV1(input)
      .normalize("NFKD")
      .replaceAll(/\p{M}/gu, "")
      .toLowerCase(),
  );
}
export function skeletonV1(input: string): string {
  let value = latinFoldV1(input);
  for (;;) {
    const next = value
      .replaceAll(/aa/g, "a")
      .replaceAll(/ee|ii/g, "i")
      .replaceAll(/oo|uu/g, "u")
      .replaceAll(/zh/g, "l")
      .replaceAll(/kh|gh|g/g, "k")
      .replaceAll(/ch|sh|c/g, "s")
      .replaceAll(/th|dh|d/g, "t")
      .replaceAll(/ph|bh|b/g, "p")
      .replaceAll(/w/g, "v")
      .replaceAll(/([bcdfghjklmnpqrstvwxyz])\1+/g, "$1")
      .replaceAll(/u\b/g, "")
      .trim()
      .replaceAll(/\s+/g, " ");
    if (next === value) return next;
    value = next;
  }
}
export function phoneDigitsV1(input: string): string {
  // Explicit decimal blocks: ASCII, Tamil, Devanagari, Arabic, Persian, fullwidth.
  const starts = [0x30, 0xbe6, 0x966, 0x660, 0x6f0, 0xff10];
  return Array.from(input)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? -1;
      const start = starts.find((first) => code >= first && code < first + 10);
      return start === undefined ? "" : String(code - start);
    })
    .join("");
}
export type SearchKeysV1 = ReturnType<typeof searchKeysV1>;
export function searchKeysV1(name: string, phone = "") {
  const phoneDigits = phoneDigitsV1(phone);
  return {
    algorithmVersion: SEARCH_KEY_VERSION,
    nameTaNorm: spaces(name.normalize("NFC")),
    nameLatinNorm: latinFoldV1(name),
    nameSkel: skeletonV1(name),
    phoneDigits,
    phoneLast4: phoneDigits.length >= 4 ? phoneDigits.slice(-4) : null,
    phoneLast6: phoneDigits.length >= 6 ? phoneDigits.slice(-6) : null,
  };
}
