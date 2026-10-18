import { z } from "zod";
import { catalogueRefSchema } from "./service-catalogue.js";

const text = (max: number) => z.string().max(max);
const label = { labelEn: text(160), labelTa: text(160) };
export const measurementFieldSchema = z.strictObject({
  id: z.uuid().transform((id) => id.toLowerCase()),
  key: text(80),
  meaning: text(500),
  kind: z.literal("base-length"),
  ...label,
  illustration: z
    .strictObject({ assetId: z.uuid(), version: z.number().int().positive() })
    .nullable()
    .default(null),
  hintEn: text(1000),
  hintTa: text(1000),
  units: z.array(z.enum(["in", "cm"])).max(2),
  defaultUnit: z.enum(["in", "cm"]).nullable(),
  required: z.boolean().nullable(),
  precision: z
    .strictObject({
      unit: z.enum(["in", "cm"]).nullable(),
      increment: text(32),
      review: text(500),
    })
    .nullable(),
});
export const measurementGroupSchema = z.strictObject({
  id: z.uuid().transform((id) => id.toLowerCase()),
  ...label,
  fields: z.array(measurementFieldSchema).max(50),
});
export const measurementFormsContentSchema = z.strictObject({
  kind: z.literal("measurement-form"),
  code: text(80),
  ...label,
  description: text(2000),
  aliases: z.array(text(160)).max(20),
  service: catalogueRefSchema.nullable(),
  piece: catalogueRefSchema.nullable(),
  decision: z.enum(["unresolved", "required", "not-required"]),
  decisionReason: text(1000),
  groups: z.array(measurementGroupSchema).max(20),
});
export type MeasurementFormContent = z.infer<
  typeof measurementFormsContentSchema
>;
export const measurementFormsDraftSchema = z.strictObject({
  entryId: z.uuid(),
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  operation: z.enum(["definition", "availability"]),
  content: measurementFormsContentSchema,
  available: z.boolean(),
  reason: text(1000),
});
export type MeasurementFormDraft = z.infer<typeof measurementFormsDraftSchema>;
export const measurementFormsCommandSchema =
  measurementFormsDraftSchema.superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (
      (v.baseVersion === 0) !== (v.baseRevisionId === null) ||
      (v.operation === "availability" && v.baseVersion === 0)
    )
      issue(["baseVersion"], "Invalid base revision");
    if (!v.reason.trim()) issue(["reason"], "Enter a review reason");
    const c = v.content;
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(c.code))
      issue(["content", "code"], "Use a stable lowercase code");
    for (const k of ["labelEn", "labelTa"] as const)
      if (!c[k].trim()) issue(["content", k], "Enter both labels");
    if (!c.service)
      issue(["content", "service"], "Choose an exact service revision");
    if (c.decision === "unresolved")
      issue(["content", "decision"], "Review measurement applicability");
    if (
      c.decision === "not-required" &&
      (!c.decisionReason.trim() || c.groups.length)
    )
      issue(
        ["content", "decisionReason"],
        "Explain why measurements are not required; remove measurement groups",
      );
    if (
      c.decision === "required" &&
      (!c.groups.length || !c.groups.some((g) => g.fields.length))
    )
      issue(["content", "groups"], "Define measurement fields");
    const ids = new Set<string>(),
      keys = new Set<string>();
    c.groups.forEach((g, i) => {
      const p = ["content", "groups", i];
      if (ids.has(g.id.toLowerCase()))
        issue([...p, "id"], "Duplicate identity");
      ids.add(g.id.toLowerCase());
      for (const k of ["labelEn", "labelTa"] as const)
        if (!g[k].trim()) issue([...p, k], "Enter both group labels");
      if (!g.fields.length) issue([...p, "fields"], "Group needs a field");
      g.fields.forEach((f, j) => {
        const p = ["content", "groups", i, "fields", j];
        if (ids.has(f.id.toLowerCase()) || keys.has(f.key))
          issue([...p, "key"], "Duplicate field identity or key");
        ids.add(f.id.toLowerCase());
        keys.add(f.key);
        if (!/^[a-z][a-z0-9-]{0,79}$/.test(f.key))
          issue([...p, "key"], "Use a stable field key");
        for (const k of ["labelEn", "labelTa", "meaning"] as const)
          if (!f[k].trim())
            issue([...p, k], "Review the field label and meaning");
        if (
          !f.units.length ||
          new Set(f.units).size !== f.units.length ||
          !f.defaultUnit ||
          !f.units.includes(f.defaultUnit)
        )
          issue([...p, "units"], "Choose supported units and a default");
        if (f.required === null)
          issue([...p, "required"], "Decide required or optional");
        if (
          !f.precision?.unit ||
          !f.units.includes(f.precision.unit) ||
          !f.precision.review.trim() ||
          !/^(?:[1-9][0-9]{0,5}(?:\.[0-9]{1,6})?|0\.[0-9]{1,6})$/.test(
            f.precision.increment,
          ) ||
          Number(f.precision.increment) <= 0
        )
          issue(
            [...p, "precision"],
            "Review an explicit positive entry precision; no tolerance is inferred",
          );
      });
    });
  });
export const measurementFormsDefinitionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  content: measurementFormsContentSchema,
  authority: z.enum(["owner-proposal", "synthetic-fixture"]),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const measurementFormsRevisionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  definition: measurementFormsDefinitionSchema,
  available: z.boolean(),
  reason: z.string(),
  operation: z.enum(["definition", "availability"]),
});
export type MeasurementFormRevision = z.infer<
  typeof measurementFormsRevisionSchema
>;
export const measurementFormsEntrySchema = z.strictObject({
  revision: measurementFormsRevisionSchema.nullable(),
});
export const measurementFormsQuerySchema = z.strictObject({
  query: z.string().max(160).default(""),
  before: z.uuid().optional(),
});
export const measurementFormsListSchema = z.strictObject({
  entries: z
    .array(
      measurementFormsRevisionSchema.extend({
        configurationEligible: z.boolean(),
      }),
    )
    .max(25),
  next: z.uuid().nullable(),
  intake: z.literal("templates-pending"),
});
export const measurementFormsHistoryQuerySchema = z.strictObject({
  entryId: z.uuid(),
  beforeVersion: z.number().int().positive().optional(),
});
export const measurementFormsHistorySchema = z.strictObject({
  revisions: z.array(measurementFormsRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export function emptyMeasurementFormContent(
  _kind: "measurement-form" = "measurement-form",
): MeasurementFormContent {
  return {
    kind: "measurement-form",
    code: "",
    labelEn: "",
    labelTa: "",
    description: "",
    aliases: [],
    service: null,
    piece: null,
    decision: "unresolved",
    decisionReason: "",
    groups: [],
  };
}
