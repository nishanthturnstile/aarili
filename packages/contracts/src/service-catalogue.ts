import { z } from "zod";

const text = (max: number) => z.string().max(max);
export const catalogueKindSchema = z.enum([
  "category",
  "subcategory",
  "service",
  "piece",
  "addon",
]);
export const catalogueRefSchema = z.strictObject({
  entryId: z.uuid(),
  revisionId: z.uuid(),
});
const component = catalogueRefSchema.extend({ optional: z.boolean() });
export const catalogueContentSchema = z.strictObject({
  kind: catalogueKindSchema,
  code: z.string().max(80),
  labelEn: text(160),
  labelTa: text(160),
  description: text(2000),
  aliases: z.array(text(160)).max(20),
  parent: catalogueRefSchema.nullable(),
  serviceKind: z.enum(["stitching", "alteration", "small-service"]).nullable(),
  warningDays: z.number().nullable(),
  pieces: z.array(component).max(32),
  addons: z.array(component).max(32),
});
export type CatalogueContent = z.infer<typeof catalogueContentSchema>;
export const catalogueDraftSchema = z.strictObject({
  entryId: z.uuid(),
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  operation: z.enum(["definition", "availability"]),
  content: catalogueContentSchema,
  available: z.boolean(),
  reason: text(1000),
});
export type CatalogueDraft = z.infer<typeof catalogueDraftSchema>;
export const catalogueCommandSchema = catalogueDraftSchema.superRefine(
  (v, ctx) => {
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: ["content", field], message });
    if ((v.baseVersion === 0) !== (v.baseRevisionId === null))
      issue("code", "Invalid base revision");
    if (v.operation === "availability" && v.baseVersion === 0)
      issue("code", "Publish a definition first");
    if (!v.reason.trim())
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Enter a review reason",
      });
    const c = v.content;
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(c.code))
      issue("code", "Use a stable lowercase code");
    for (const field of ["labelEn", "labelTa"] as const)
      if (!c[field].trim()) issue(field, "Enter both labels");
    if (
      c.kind === "category" &&
      /bridal|retail|மணப்பெண்|சில்லறை/i.test(`${c.code} ${c.labelEn} ${c.labelTa}`)
    )
      issue("code", "Occasions and retail are not Phase 1 garment categories");
    if (["subcategory", "service"].includes(c.kind) !== (c.parent !== null))
      issue("parent", "Choose the applicable parent");
    if ((c.kind === "service") !== (c.serviceKind !== null))
      issue("serviceKind", "Choose a service kind only for a service");
    if (
      c.warningDays !== null &&
      (c.kind !== "category" ||
        !Number.isSafeInteger(c.warningDays) ||
        c.warningDays < 0 ||
        c.warningDays > 3660)
    )
      issue("warningDays", "Invalid category warning extension");
    if (c.kind !== "service" && (c.pieces.length || c.addons.length))
      issue("pieces", "Only services compose pieces and add-ons");
    const refs = [...(c.parent ? [c.parent] : []), ...c.pieces, ...c.addons];
    if (refs.some((r) => r.entryId.toLowerCase() === v.entryId.toLowerCase()))
      issue("parent", "Self references are not supported");
    if (new Set(refs.map((r) => r.entryId.toLowerCase())).size !== refs.length)
      issue("pieces", "Choose each reference once");
  },
);
export const catalogueDefinitionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  content: catalogueContentSchema,
  authority: z.enum(["owner-proposal", "synthetic-fixture"]),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const catalogueRevisionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  definition: catalogueDefinitionSchema,
  available: z.boolean(),
  reason: z.string(),
  operation: z.enum(["definition", "availability"]),
});
export type CatalogueRevision = z.infer<typeof catalogueRevisionSchema>;
export const catalogueEntrySchema = z.strictObject({
  revision: catalogueRevisionSchema.nullable(),
});
export const catalogueQuerySchema = z.strictObject({
  query: z.string().max(160).default(""),
  before: z.uuid().optional(),
});
export const catalogueListSchema = z.strictObject({
  entries: z
    .array(
      catalogueRevisionSchema.extend({ configurationEligible: z.boolean() }),
    )
    .max(25),
  next: z.uuid().nullable(),
  intake: z.literal("templates-pending"),
});
export const catalogueHistoryQuerySchema = z.strictObject({
  entryId: z.uuid(),
  beforeVersion: z.number().int().positive().optional(),
});
export const catalogueHistorySchema = z.strictObject({
  revisions: z.array(catalogueRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export function emptyCatalogueContent(
  kind: CatalogueContent["kind"],
): CatalogueContent {
  return {
    kind,
    code: "",
    labelEn: "",
    labelTa: "",
    description: "",
    aliases: [],
    parent: null,
    serviceKind: kind === "service" ? "stitching" : null,
    warningDays: null,
    pieces: [],
    addons: [],
  };
}
