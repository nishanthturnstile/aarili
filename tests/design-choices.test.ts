import { randomUUID } from "node:crypto";
import {
  type DesignChoicesDraft,
  type DesignQuestion,
  designChoicesCommandSchema,
  designChoicesDraftSchema,
  designDimensions,
} from "@aarili/contracts/design-choices";
import fc from "fast-check";
import { expect, test } from "vitest";

const ref = () => ({ entryId: randomUUID(), revisionId: randomUUID() });
const question = (
  key: DesignQuestion["key"] = "neck-type",
): DesignQuestion => ({
  id: randomUUID(),
  key,
  meaning: key,
  labelEn: key,
  labelTa: "செயற்கை",
  kind: "choice",
  required: true,
  applicability: "applicable",
  reason: "",
  choices: [ref()],
  when: [],
  units: [],
  precision: null,
});
function profile(): DesignChoicesDraft {
  return {
    entryId: randomUUID(),
    baseVersion: 0,
    baseRevisionId: null,
    operation: "definition",
    available: true,
    reason: "SYNTHETIC review",
    content: {
      kind: "profile",
      code: "blouse",
      labelEn: "Synthetic blouse",
      labelTa: "செயற்கை ரவிக்கை",
      description: "",
      aliases: [],
      category: ref(),
      manifest: ref(),
      pieceKey: null,
      decision: "applicable",
      decisionReason: "",
      questions: [
        question("neck-type"),
        question("neck-design"),
        question("sleeve-type"),
        question("sleeve-design"),
      ],
      templateKeys: [],
    },
  };
}
test("DS-A1-01/02 strict drafts permit incomplete review; command rejects unknown sources and unreviewed questions", () => {
  const p = profile();
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(true);
  p.content.category = null;
  expect(designChoicesDraftSchema.safeParse(p).success).toBe(true);
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
  expect(
    designChoicesDraftSchema.safeParse({ ...p, customerApproval: true })
      .success,
  ).toBe(false);
});
test("DS-A1-02 neck/sleeve construction and decoration retain four independent dimensions", () => {
  const p = profile();
  expect(
    p.content.kind === "profile" && p.content.questions.map((q) => q.key),
  ).toEqual(designDimensions.slice(0, 4));
  if (p.content.kind !== "profile") throw Error();
  p.content.questions[0] = {
    ...(p.content.questions[0] as DesignQuestion),
    kind: "text",
    choices: [],
  };
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
});
test("DS-A1-03 no-design services require explicit reviewed applicability rather than empty universal fields", () => {
  const p = profile();
  if (p.content.kind !== "profile") throw Error();
  p.content.questions = [];
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
  p.content.decision = "not-applicable";
  p.content.decisionReason =
    "SYNTHETIC fall service has no construction decisions";
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(true);
});
test("DS-A1-03 property rejects duplicate stable questions/dimensions and dependency cycles", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 5 }), (count) => {
      const p = profile();
      if (p.content.kind !== "profile") throw Error();
      const q = question();
      p.content.questions = Array.from({ length: count + 1 }, () =>
        structuredClone(q),
      );
      expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
    }),
  );
  const p = profile();
  if (p.content.kind !== "profile") throw Error();
  const a = p.content.questions[0] as DesignQuestion,
    b = p.content.questions[1] as DesignQuestion;
  a.when = [
    { questionId: b.id, choice: b.choices[0] as ReturnType<typeof ref> },
  ];
  b.when = [
    { questionId: a.id, choice: a.choices[0] as ReturnType<typeof ref> },
  ];
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
});
test("DS-A1-02 intended garment lengths need explicit reviewed unit/precision and no guessed default", () => {
  const p = profile();
  if (p.content.kind !== "profile") throw Error();
  const q: DesignQuestion = {
    ...question("neck-depth"),
    kind: "garment-length" as const,
    choices: [],
  };
  p.content.questions = [q];
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
  q.units = ["in"];
  q.precision = {
    unit: "in",
    increment: "0.25",
    review: "Synthetic owner fixture",
  };
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(true);
  p.content.questions = ["front-neck-depth", "back-neck-depth"].map((key) => ({
    ...structuredClone(q),
    id: randomUUID(),
    key: key as DesignQuestion["key"],
    meaning: key,
  }));
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(true);
});

test("DS-A1-03 bounded malformed shared dependencies reject duplicate dimensions without exponential graph traversal", () => {
  const p = profile();
  if (p.content.kind !== "profile") throw Error();
  const questions: DesignQuestion[] = [];
  for (let i = 0; i < 40; i++) {
    const q = question();
    q.when = questions.slice(-8).map((parent) => ({
      questionId: parent.id,
      choice: parent.choices[0] as ReturnType<typeof ref>,
    }));
    questions.push(q);
  }
  p.content.questions = questions;
  expect(designChoicesCommandSchema.safeParse(p).success).toBe(false);
});
