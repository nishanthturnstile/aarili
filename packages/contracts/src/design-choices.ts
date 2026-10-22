import { z } from "zod";
import {
  catalogueHistoryQuerySchema,
  catalogueQuerySchema,
  catalogueRefSchema,
} from "./service-catalogue.js";

const text = (max: number) => z.string().max(max);
const labels = { labelEn: text(160), labelTa: text(160) };
export const designDimensions = [
  "neck-type",
  "neck-design",
  "sleeve-type",
  "sleeve-design",
  "fit",
  "fastening",
  "lining",
  "placement",
  "finishing",
  "restrictions",
  "neck-depth",
  "front-neck-depth",
  "back-neck-depth",
  "sleeve-length",
] as const;
export const designDimensionSchema = z.enum(designDimensions);
export const designQuestionSchema = z.strictObject({
  id: z.uuid(),
  key: designDimensionSchema,
  meaning: text(500),
  ...labels,
  kind: z.enum(["choice", "text", "garment-length"]),
  applicability: z.enum(["unresolved", "applicable", "not-applicable"]),
  reason: text(1000),
  required: z.boolean().nullable(),
  choices: z.array(catalogueRefSchema).max(30),
  when: z
    .array(z.strictObject({ questionId: z.uuid(), choice: catalogueRefSchema }))
    .max(8),
  units: z.array(z.enum(["in", "cm"])).max(2),
  precision: z
    .strictObject({
      unit: z.enum(["in", "cm"]),
      increment: text(32),
      review: text(500),
    })
    .nullable(),
});
const common = {
  code: text(80),
  ...labels,
  description: text(2000),
  aliases: z.array(text(160)).max(20),
  category: catalogueRefSchema.nullable(),
};
export const designChoicesContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("choice"),
    dimension: designDimensionSchema,
    meaning: text(500),
    none: z.boolean(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("profile"),
    manifest: catalogueRefSchema.nullable(),
    pieceKey: text(80).nullable(),
    decision: z.enum(["unresolved", "applicable", "not-applicable"]),
    decisionReason: text(1000),
    questions: z.array(designQuestionSchema).max(40),
    templateKeys: z.array(text(80)).max(60),
  }),
]);
export type DesignChoicesContent = z.infer<typeof designChoicesContentSchema>;
export type DesignQuestion = z.infer<typeof designQuestionSchema>;
export const designChoicesDraftSchema = z.strictObject({
  entryId: z.uuid(),
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  operation: z.enum(["definition", "availability"]),
  content: designChoicesContentSchema,
  available: z.boolean(),
  reason: text(1000),
});
export type DesignChoicesDraft = z.infer<typeof designChoicesDraftSchema>;
export const designChoicesCommandSchema = designChoicesDraftSchema.superRefine(
  (v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (
      (v.baseVersion === 0) !== (v.baseRevisionId === null) ||
      (v.operation === "availability" && !v.baseVersion)
    )
      issue(["baseVersion"], "Review the base revision");
    if (!v.reason.trim()) issue(["reason"], "Enter a review reason");
    const c = v.content;
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(c.code))
      issue(["content", "code"], "Use a stable lowercase code");
    for (const k of ["labelEn", "labelTa"] as const)
      if (!c[k].trim()) issue(["content", k], "Enter both labels");
    if (!c.category) issue(["content", "category"], "Choose an exact category");
    if (c.kind === "choice") {
      if (!c.meaning.trim())
        issue(["content", "meaning"], "Define the meaning");
      return;
    }
    if (!c.manifest || c.decision === "unresolved")
      issue(
        ["content", "manifest"],
        "Review the exact manifest and applicability",
      );
    if (
      c.decision === "not-applicable" &&
      (!c.decisionReason.trim() || c.questions.length)
    )
      issue(
        ["content", "decisionReason"],
        "Explain no design and remove questions",
      );
    if (c.decision === "applicable" && !c.questions.length)
      issue(["content", "questions"], "Define applicable questions");
    if (new Set(c.templateKeys).size !== c.templateKeys.length)
      issue(["content", "templateKeys"], "Duplicate template key");
    const ids = new Set<string>(),
      keys = new Set<string>();
    for (const [i, q] of c.questions.entries()) {
      const p = ["content", "questions", i];
      if (ids.has(q.id.toLowerCase()) || keys.has(q.key))
        issue(p, "Duplicate question identity or dimension");
      ids.add(q.id.toLowerCase());
      keys.add(q.key);
      if (
        !q.labelEn.trim() ||
        !q.labelTa.trim() ||
        !q.meaning.trim() ||
        q.required === null ||
        q.applicability === "unresolved"
      )
        issue(p, "Review question labels, meaning and applicability");
      if (
        q.applicability === "not-applicable" &&
        (!q.reason.trim() || q.choices.length || q.when.length)
      )
        issue(p, "Explain not applicable and remove choices/dependencies");
      if (q.key.includes("type") || q.key.endsWith("design")) {
        if (q.kind !== "choice")
          issue(
            p,
            "Construction and decoration use separate controlled choices",
          );
      }
      if (
        q.kind === "choice" &&
        q.applicability === "applicable" &&
        !q.choices.length
      )
        issue(p, "Select supported choices");
      if (q.kind !== "choice" && q.choices.length)
        issue(p, "Choices belong to a choice question");
      if (
        new Set(q.choices.map((r) => r.entryId.toLowerCase())).size !==
        q.choices.length
      )
        issue(p, "Duplicate choice");
      if (q.kind === "garment-length") {
        if (
          !q.units.length ||
          new Set(q.units).size !== q.units.length ||
          !q.precision ||
          !q.units.includes(q.precision.unit) ||
          !q.precision.review.trim() ||
          !/^(?:[1-9][0-9]{0,5}(?:\.[0-9]{1,6})?|0\.[0-9]{1,6})$/.test(
            q.precision.increment,
          ) ||
          Number(q.precision.increment) <= 0
        )
          issue(p, "Review intended garment units and precision");
      } else if (q.units.length || q.precision !== null)
        issue(p, "Only intended garment lengths have units/precision");
      if (q.when.length && q.applicability !== "applicable")
        issue(p, "Only applicable questions have dependencies");
      if (new Set(q.when.map((w) => w.questionId)).size !== q.when.length)
        issue(p, "Duplicate dependency");
      for (const w of q.when) {
        const parent = c.questions.find((x) => x.id === w.questionId);
        if (
          !parent ||
          parent.id === q.id ||
          parent.kind !== "choice" ||
          parent.applicability !== "applicable" ||
          !parent.choices.some(
            (r) =>
              r.entryId === w.choice.entryId &&
              r.revisionId === w.choice.revisionId,
          )
        )
          issue(p, "Unsupported dependency choice");
      }
    }
    const visit = (id: string, trail: Set<string>): boolean => {
      if (trail.has(id)) return false;
      const next = new Set(trail).add(id);
      return (c.questions.find((q) => q.id === id)?.when ?? []).every((w) =>
        visit(w.questionId, next),
      );
    };
    for (const q of c.questions)
      if (!visit(q.id, new Set())) {
        issue(["content", "questions"], "Question dependency cycle");
        break;
      }
  },
);
export const designChoicesDefinitionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  content: designChoicesContentSchema,
  authority: z.enum(["owner-proposal", "synthetic-fixture"]),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const designChoicesRevisionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  definition: designChoicesDefinitionSchema,
  available: z.boolean(),
  reason: z.string(),
  operation: z.enum(["definition", "availability"]),
});
export type DesignChoicesRevision = z.infer<typeof designChoicesRevisionSchema>;
export const designChoicesEntrySchema = z.strictObject({
  revision: designChoicesRevisionSchema.nullable(),
});
export const designChoicesQuerySchema = catalogueQuerySchema;
export const designChoicesHistoryQuerySchema = catalogueHistoryQuerySchema;
export const designChoicesListSchema = z.strictObject({
  entries: z
    .array(
      designChoicesRevisionSchema.extend({
        configurationEligible: z.boolean(),
      }),
    )
    .max(25),
  next: z.uuid().nullable(),
  intake: z.literal("activation-unavailable"),
});
export const designChoicesHistorySchema = z.strictObject({
  revisions: z.array(designChoicesRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const designPreviewRequestSchema = z.strictObject({
  content: designChoicesContentSchema,
  selections: z
    .array(
      z.strictObject({
        questionId: z.uuid(),
        state: z.enum(["unknown", "not-applicable", "selected"]),
        choice: catalogueRefSchema.nullable(),
      }),
    )
    .max(40),
});
export const designPreviewSchema = z.strictObject({
  questions: z.array(
    designQuestionSchema.extend({
      state: z.enum([
        "unknown",
        "not-applicable",
        "selected",
        "dependency-unresolved",
      ]),
    }),
  ),
  incompatible: z.array(z.uuid()),
  effects: z.literal("none"),
  references: z.literal("unavailable"),
  pattern: z.literal("manual-external"),
});
export function emptyDesignChoicesContent(
  kind: DesignChoicesContent["kind"],
): DesignChoicesContent {
  const c = {
    code: "",
    labelEn: "",
    labelTa: "",
    description: "",
    aliases: [],
    category: null,
  };
  return kind === "choice"
    ? { ...c, kind, dimension: "neck-type", meaning: "", none: false }
    : {
        ...c,
        kind,
        manifest: null,
        pieceKey: null,
        decision: "unresolved",
        decisionReason: "",
        questions: [],
        templateKeys: [],
      };
}
