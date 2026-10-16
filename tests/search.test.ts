import {
  latinFoldV1,
  phoneDigitsV1,
  searchKeysV1,
  skeletonV1,
  tamilToLatinV1,
} from "@aarili/i18n/search";
import fc from "fast-check";
import { expect, test } from "vitest";

test("0.4.1c C1 USE-02 shared v1 stored/query keys preserve input and NFC Tamil", () => {
  const input = { name: "  கௌரி / Gowri! ", notes: "Original: அளவு மாற்ற வேண்டாம்" };
  const before = structuredClone(input);
  expect(searchKeysV1(input.name)).toEqual(
    searchKeysV1(input.name.normalize("NFD")),
  );
  expect(input).toEqual(before);
  expect(tamilToLatinV1("ரவிக்கை")).toBe("ravikkai");
  expect(skeletonV1("ரவிக்கை")).toBe(skeletonV1("ravikkai"));
  expect(skeletonV1("ஆரி")).toBe(skeletonV1("Aari"));
  for (const [tamil, latin] of [
    ["கோபி", "Gopi"],
    ["தேவி", "Devi"],
    ["மீனா", "Meena"],
    ["தோழி", "thozhi"],
  ])
    expect(skeletonV1(tamil ?? "")).toBe(skeletonV1(latin ?? ""));
  expect(searchKeysV1("கௌரி Gowri!").nameLatinNorm).toBe("kauri gowri");
  expect(latinFoldV1("ṬĀMĪḶ")).toBe("tamil");
});
test("0.4.1c C2 phonetic fixtures cover long vowels consonants voiced aspirated dental retroflex v/w and final u", () => {
  for (const [a, b] of [
    ["aa", "a"],
    ["ee", "ii"],
    ["oo", "uu"],
    ["akkam", "akam"],
    ["g", "k"],
    ["kh", "k"],
    ["gh", "k"],
    ["ch", "s"],
    ["c", "s"],
    ["th", "d"],
    ["dh", "t"],
    ["b", "p"],
    ["bh", "ph"],
    ["ṭ", "t"],
    ["ṇ", "n"],
    ["ḷ", "zh"],
    ["ḻ", "l"],
    ["ṟ", "r"],
    ["v", "w"],
    ["kumar", "kumaru"],
    ["கண்ணு", "kannu"],
  ])
    expect(skeletonV1(a ?? "")).toBe(skeletonV1(b ?? ""));
  expect(skeletonV1("u u")).toBe("");
  expect(skeletonV1("abu u")).toBe("ap");
  expect(skeletonV1("  ஆா Aari,  வாணி / Vaani! ")).not.toContain("!");
  expect(searchKeysV1("  ")).toMatchObject({
    nameTaNorm: "",
    nameLatinNorm: "",
    nameSkel: "",
    phoneDigits: "",
    phoneLast4: null,
    phoneLast6: null,
  });
});
test("0.4.1c C2 phone normalized digits and explicit short last4/last6", () => {
  expect(phoneDigitsV1("+௯௧ (９８) ٧٦-५४")).toBe("91987654");
  for (const digits of ["", "1", "12", "123", "1234", "12345", "123456"]) {
    const keys = searchKeysV1("", digits);
    expect(keys.phoneLast4).toBe(digits.length >= 4 ? digits.slice(-4) : null);
    expect(keys.phoneLast6).toBe(digits.length >= 6 ? digits.slice(-6) : null);
  }
});
test("0.4.1c C2 AC-02 deterministic and applicable idempotent hints imply no identity equivalence", () => {
  const text = fc
    .array(
      fc.constantFrom(
        ...Array.from(
          "அஆஇஈஉஊஎஏஐஒஓஔகஙசஞடணதநபமயரலவழளறனாிீுூெேைொோௌ் abcdefghijklmnopqrstuvwxyz ṭṇḷḻṟ.!௧௨123",
        ),
      ),
      { maxLength: 100 },
    )
    .map((chars) => chars.join(""));
  fc.assert(
    fc.property(text, (value) => {
      expect(searchKeysV1(value)).toEqual(searchKeysV1(value));
      expect(latinFoldV1(latinFoldV1(value))).toBe(latinFoldV1(value));
      expect(skeletonV1(skeletonV1(value))).toBe(skeletonV1(value));
      expect(phoneDigitsV1(phoneDigitsV1(value))).toBe(phoneDigitsV1(value));
      expect(searchKeysV1(value.normalize("NFC"))).toEqual(searchKeysV1(value));
    }),
    { numRuns: 500 },
  );
});
