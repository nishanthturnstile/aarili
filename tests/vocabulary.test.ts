import { vocabularyInputSchema } from "@aarili/contracts/vocabulary";
import { reviseVocabulary, VocabularyFailure } from "@aarili/core/vocabulary";
import { expect, test } from "vitest";

test("0.4.1c C3 complete vocabulary contract preserves labels and aliases and rejects invalid commands", async () => {
  const original = {
    labelTa: "  ரவிக்கை ",
    labelEn: "Blouse",
    aliases: ["ravikkai"],
    reason: "Synthetic revision",
  };
  expect(vocabularyInputSchema.parse(original)).toEqual(original);
  for (const bad of [
    { ...original, labelTa: "" },
    { ...original, labelEn: "   " },
    { ...original, aliases: [""] },
    { ...original, reason: "" },
    { ...original, extra: true },
  ])
    expect(vocabularyInputSchema.safeParse(bad).success).toBe(false);
  const id = "11111111-1111-4111-8111-111111111111";
  // Invalid complete commands fail before consulting a repository.
  await expect(
    reviseVocabulary(
      { shopId: id, actorId: id, repository: {} as never },
      id,
      original,
      { requestId: id },
    ),
  ).rejects.toMatchObject({ status: 422 });
  await expect(
    reviseVocabulary(
      { shopId: id, actorId: id, repository: {} as never },
      id,
      original,
      { requestId: id, key: id, ifMatch: 'W/"v1"' },
    ),
  ).rejects.toBeInstanceOf(VocabularyFailure);
});
