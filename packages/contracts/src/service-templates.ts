import { z } from "zod";
import { catalogueRefSchema } from "./service-catalogue.js";

const text = (n: number) => z.string().max(n);
const labels = { labelEn: text(160), labelTa: text(160) };
export const templateSections = [
  "materials",
  "tasks",
  "quality",
  "instructions",
  "confirmation",
  "construction",
  "decoration",
  "method",
] as const;
const decision = z.enum(["unresolved", "applicable", "not-applicable"]);
const section = z.strictObject({ decision, reason: text(1000) });
const scope = z.strictObject({
  pieceKey: text(80).nullable(),
  addonKey: text(80).nullable(),
});
const item = z.strictObject({
  key: text(80),
  ...labels,
  required: z.boolean().nullable(),
  applicability: decision,
  applicabilityReason: text(1000),
  scope,
  instructionEn: text(2000),
  instructionTa: text(2000),
});
export const serviceTemplatesContentSchema = z.strictObject({
  kind: z.literal("service-template"),
  code: text(80),
  ...labels,
  description: text(2000),
  aliases: z.array(text(160)).max(20),
  service: catalogueRefSchema.nullable(),
  pieces: z
    .array(
      catalogueRefSchema.extend({
        key: text(80),
        applicability: decision,
        reason: text(1000),
      }),
    )
    .max(32),
  addons: z
    .array(
      catalogueRefSchema.extend({
        key: text(80),
        applicability: decision,
        reason: text(1000),
      }),
    )
    .max(32),
  forms: z
    .array(
      z.strictObject({
        pieceKey: text(80).nullable(),
        entryId: z.uuid(),
        revisionId: z.uuid(),
      }),
    )
    .max(33),
  sections: z.strictObject({
    materials: section,
    tasks: section,
    quality: section,
    instructions: section,
    confirmation: section,
    construction: section,
    decoration: section,
    method: section,
  }),
  materials: z
    .array(
      item.extend({
        kind: z.enum([
          "main-fabric",
          "lining",
          "extra-fabric",
          "trim",
          "craft-consumable",
        ]),
        source: z.enum(["unresolved", "customer", "shop", "artisan"]),
      }),
    )
    .max(100),
  tasks: z
    .array(
      item.extend({
        milestone: z.enum(["cutting", "work", "trial", "ready"]),
        assignee: z.literal("owner"),
        predecessors: z.array(text(80)).max(100),
        prerequisites: z
          .array(
            z.enum([
              "design",
              "measurement",
              "manual-method",
              "material",
              "quality",
            ]),
          )
          .max(5),
      }),
    )
    .max(100),
  quality: z
    .array(
      item.extend({
        kind: z.enum([
          "construction",
          "finishing",
          "closures",
          "visible-defects",
          "dimension-definition",
        ]),
        taskKeys: z.array(text(80)).max(100),
      }),
    )
    .max(100),
  instructions: z
    .array(item.extend({ audience: z.enum(["internal", "customer"]) }))
    .max(100),
  confirmation: z
    .array(
      item.extend({
        topic: z.enum([
          "design-scope",
          "price-basis",
          "date",
          "inclusions",
          "exclusions",
          "supplied-materials",
        ]),
      }),
    )
    .max(100),
  construction: z.array(item).max(100),
  decoration: z.array(item).max(100),
  method: z.array(item).max(100),
});
export type ServiceTemplateContent = z.infer<
  typeof serviceTemplatesContentSchema
>;
export const serviceRequirementsPreviewRequestSchema = z.strictObject({
  content: serviceTemplatesContentSchema,
  templateRevisionId: z.uuid().nullable(),
});
export const serviceTemplatesDraftSchema = z.strictObject({
  entryId: z.uuid(),
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  operation: z.enum(["definition", "availability"]),
  content: serviceTemplatesContentSchema,
  available: z.boolean(),
  reason: text(1000),
});
export type ServiceTemplateDraft = z.infer<typeof serviceTemplatesDraftSchema>;
export const confirmationTokens = [
  "service",
  "scope",
  "price_basis",
  "ready_date",
  "collection_date",
  "supplied_materials",
] as const;
const keyPattern = /^[a-z][a-z0-9-]{0,79}$/;
const unsafe =
  /[<>]|javascript\s*:|\b(?:eval|function)\s*\(|<script|\bon\w+\s*=/i;
export const serviceTemplatesCommandSchema =
  serviceTemplatesDraftSchema.superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const c = v.content;
    if (
      (v.baseVersion === 0) !== (v.baseRevisionId === null) ||
      (v.operation === "availability" && !v.baseVersion)
    )
      issue(["baseVersion"], "Invalid base revision");
    if (!v.reason.trim()) issue(["reason"], "Enter a review reason");
    if (!keyPattern.test(c.code))
      issue(["content", "code"], "Use a stable lowercase code");
    if (!c.labelEn.trim() || !c.labelTa.trim())
      issue(["content", "labelEn"], "Enter both labels");
    if (!c.service)
      issue(["content", "service"], "Choose an exact service revision");
    const components = [...c.pieces, ...c.addons];
    if (
      new Set(components.map((x) => x.entryId.toLowerCase())).size !==
        components.length ||
      new Set(components.map((x) => x.key)).size !== components.length
    )
      issue(["content", "pieces"], "Duplicate component identity or key");
    for (const [i, x] of components.entries())
      if (
        !keyPattern.test(x.key) ||
        x.applicability === "unresolved" ||
        (x.applicability === "not-applicable" && !x.reason.trim())
      )
        issue(
          ["content", "pieces", i],
          "Review component applicability and reason",
        );
    if (new Set(c.forms.map((f) => f.pieceKey)).size !== c.forms.length)
      issue(["content", "forms"], "Choose one exact form per scope");
    const allKeys = new Set<string>();
    const byTask = new Map(c.tasks.map((t) => [t.key, t]));
    for (const name of templateSections) {
      const s = c.sections[name],
        rows = c[name];
      if (
        s.decision === "unresolved" ||
        (s.decision === "not-applicable" &&
          (!s.reason.trim() || rows.length)) ||
        (s.decision === "applicable" && !rows.length)
      )
        issue(
          ["content", "sections", name],
          "Review section; applicable needs items, not applicable needs a scoped reason and no items",
        );
      rows.forEach((r, i) => {
        const p = ["content", name, i];
        if (!keyPattern.test(r.key) || allKeys.has(r.key))
          issue([...p, "key"], "Duplicate or invalid stable key");
        allKeys.add(r.key);
        if (!r.labelEn.trim() || !r.labelTa.trim() || r.required === null)
          issue(p, "Review bilingual labels and required/optional");
        for (const value of [
          r.labelEn,
          r.labelTa,
          r.instructionEn,
          r.instructionTa,
        ])
          if (unsafe.test(value))
            issue(p, "Only bounded plain text is supported");
        const targets = [
          r.scope.pieceKey
            ? c.pieces.find((x) => x.key === r.scope.pieceKey)
            : null,
          r.scope.addonKey
            ? c.addons.find((x) => x.key === r.scope.addonKey)
            : null,
        ];
        if (
          (r.scope.pieceKey && !targets[0]) ||
          (r.scope.addonKey && !targets[1])
        )
          issue([...p, "scope"], "Missing piece/work scope");
        if (
          r.applicability === "not-applicable" &&
          !r.applicabilityReason.trim()
        )
          issue(p, "Explain item not-applicability");
        if (
          r.applicability === "applicable" &&
          targets.some((x) => x && x.applicability !== "applicable")
        )
          issue(p, "Item applicability conflicts with its piece/work");
      });
    }
    for (const [i, t] of c.tasks.entries()) {
      if (
        new Set(t.predecessors).size !== t.predecessors.length ||
        new Set(t.prerequisites).size !== t.prerequisites.length
      )
        issue(["content", "tasks", i], "Duplicate prerequisite");
      for (const k of t.predecessors) {
        const prev = byTask.get(k);
        if (!prev || k === t.key)
          issue(
            ["content", "tasks", i, "predecessors"],
            "Missing or self predecessor",
          );
        if (
          t.required &&
          t.applicability !== "not-applicable" &&
          prev &&
          (!prev.required ||
            prev.applicability === "not-applicable" ||
            c.pieces.some(
              (p) =>
                p.key === prev.scope.pieceKey &&
                p.applicability === "not-applicable",
            ) ||
            c.addons.some(
              (a) =>
                a.key === prev.scope.addonKey &&
                a.applicability === "not-applicable",
            ))
        )
          issue(
            ["content", "tasks", i, "predecessors"],
            "Required task cannot bypass an optional/inapplicable predecessor",
          );
      }
    }
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (key: string): boolean => {
      if (visiting.has(key)) return true;
      if (visited.has(key)) return false;
      visiting.add(key);
      if ((byTask.get(key)?.predecessors ?? []).some(visit)) return true;
      visiting.delete(key);
      visited.add(key);
      return false;
    };
    if (c.tasks.some((t) => visit(t.key)))
      issue(["content", "tasks"], "Task dependency cycle");
    c.quality.forEach((q, i) => {
      if (
        new Set(q.taskKeys).size !== q.taskKeys.length ||
        q.taskKeys.some((k) => !byTask.has(k))
      )
        issue(
          ["content", "quality", i],
          "Missing or duplicate quality task reference",
        );
    });
    const privateTexts = c.instructions
      .filter((x) => x.audience === "internal")
      .flatMap((x) => [x.labelEn, x.labelTa, x.instructionEn, x.instructionTa])
      .filter((x) => x.trim().length > 0);
    for (const [i, r] of [
      ...c.confirmation,
      ...c.instructions.filter((x) => x.audience === "customer"),
    ].entries()) {
      for (const value of [
        r.labelEn,
        r.labelTa,
        r.instructionEn,
        r.instructionTa,
      ]) {
        const stripped = value.replace(
          /\{\{([a-z_]+)\}\}/g,
          (_match, token: string) => {
            if (!(confirmationTokens as readonly string[]).includes(token))
              issue(
                ["content", "confirmation", i],
                "Unsupported customer placeholder",
              );
            return "";
          },
        );
        if (
          /[{}]/.test(stripped) ||
          /internal|margin|profit|private|உள்\s*குறிப்பு|லாபம்/i.test(value) ||
          privateTexts.some((s) =>
            value.toLowerCase().includes(s.toLowerCase()),
          )
        )
          issue(
            ["content", "confirmation", i],
            "Private internal content or unsupported customer token",
          );
      }
    }
  });
export const serviceTemplatesDefinitionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  content: serviceTemplatesContentSchema,
  authority: z.enum(["owner-proposal", "synthetic-fixture"]),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const serviceTemplatesRevisionSchema = z.strictObject({
  id: z.uuid(),
  entryId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  schemaVersion: z.literal(1),
  definition: serviceTemplatesDefinitionSchema,
  available: z.boolean(),
  reason: z.string(),
  operation: z.enum(["definition", "availability"]),
});
export type ServiceTemplateRevision = z.infer<
  typeof serviceTemplatesRevisionSchema
>;
export const serviceTemplatesEntrySchema = z.strictObject({
  revision: serviceTemplatesRevisionSchema.nullable(),
});
export const serviceTemplatesQuerySchema = z.strictObject({
  query: text(160).default(""),
  before: z.uuid().optional(),
});
export const serviceTemplatesListSchema = z.strictObject({
  entries: z
    .array(
      serviceTemplatesRevisionSchema.extend({
        configurationEligible: z.boolean(),
      }),
    )
    .max(25),
  next: z.uuid().nullable(),
  intake: z.literal("activation-unavailable"),
});
export const serviceTemplatesHistoryQuerySchema = z.strictObject({
  entryId: z.uuid(),
  beforeVersion: z.number().int().positive().optional(),
});
export const serviceTemplatesHistorySchema = z.strictObject({
  revisions: z.array(serviceTemplatesRevisionSchema).max(25),
  next: z.number().int().positive().nullable(),
});
export const serviceRequirementsPreviewSchema = z.strictObject({
  fingerprint: z.string(),
  effects: z.literal("none"),
  activation: z.literal("unavailable"),
  sections: z.array(
    z.strictObject({ key: z.string(), decision, reason: z.string() }),
  ),
  items: z.array(
    z.strictObject({
      section: z.string(),
      key: z.string(),
      ...labels,
      required: z.boolean().nullable(),
      applicability: decision,
      state: z.enum(["unresolved", "not-required"]),
      source: z.string(),
      blockers: z.array(z.string()),
      assigneeId: z.string().nullable(),
      unresolvedTokens: z.array(z.string()),
    }),
  ),
  sources: z.array(z.string()),
});
export function emptyServiceTemplateContent(
  _kind: "service-template" = "service-template",
): ServiceTemplateContent {
  const undecided = () => ({ decision: "unresolved" as const, reason: "" });
  return {
    kind: "service-template",
    code: "",
    labelEn: "",
    labelTa: "",
    description: "",
    aliases: [],
    service: null,
    pieces: [],
    addons: [],
    forms: [],
    sections: {
      materials: undecided(),
      tasks: undecided(),
      quality: undecided(),
      instructions: undecided(),
      confirmation: undecided(),
      construction: undecided(),
      decoration: undecided(),
      method: undecided(),
    },
    materials: [],
    tasks: [],
    quality: [],
    instructions: [],
    confirmation: [],
    construction: [],
    decoration: [],
    method: [],
  };
}

export type ServiceRequirementsPreview = z.infer<
  typeof serviceRequirementsPreviewSchema
>;
