import { ownerMessages } from "@aarili/i18n";
import { expect, test } from "vitest";

test("0.4.1a A2 USE-02 shared Tamil/English catalogues have matching nonempty keys", () => {
  expect(Object.keys(ownerMessages.en).sort()).toEqual(
    Object.keys(ownerMessages.ta).sort(),
  );
  for (const messages of Object.values(ownerMessages))
    expect(
      Object.values(messages).every((value) => value.trim().length > 0),
    ).toBe(true);
  expect(ownerMessages.en.workspace).toBe("Dashboard");
  expect(ownerMessages.ta.workspace).toBe("முகப்பு");
});
