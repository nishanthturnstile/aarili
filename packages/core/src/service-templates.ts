import {
  presentationCommandSchema,
  presentationDraftSchema,
  type ServiceRequirementsPreview,
  type ServiceTemplateContent,
  type ServiceTemplateDraft,
  type ServiceTemplateRevision,
  serviceTemplatesCommandSchema,
  serviceTemplatesContentSchema,
  serviceTemplatesDraftSchema,
  serviceTemplatesHistoryQuerySchema,
  serviceTemplatesQuerySchema,
  templateSections,
} from "@aarili/contracts/service-templates";
import type { ServiceTemplatesRepository } from "@aarili/db/repositories/service-templates";
import { searchKeysV1 } from "@aarili/i18n/search";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  type MeasurementFormsContext,
  measurementFormsReferencesEligible,
} from "./measurement-forms.js";
import { requestHash } from "./request-binding.js";
import {
  catalogueReferencesEligible,
  type ServiceCatalogueContext,
} from "./service-catalogue.js";

function keys(values: string[]) {
  return [
    ...new Set(
      values.flatMap((value) => {
        const k = searchKeysV1(value);
        return [k.nameTaNorm.toLowerCase(), k.nameLatinNorm, k.nameSkel].filter(
          Boolean,
        );
      }),
    ),
  ];
}
export type ServiceTemplatesContext = {
  shopId: string;
  actorId: string;
  repository: ServiceTemplatesRepository;
  synthetic: boolean;
  catalogue: ServiceCatalogueContext;
  forms: MeasurementFormsContext;
};
function fail(
  status: 404 | 409 | 412 | 422,
  code:
    | "NOT_FOUND"
    | "REQUEST_CONFLICT"
    | "VERSION_STALE"
    | "VALIDATION_FAILED",
): never {
  throw new DraftFailure(status, {
    error: { code, message: "ServiceTemplate request rejected" },
  });
}
export async function readServiceTemplates(
  ctx: ServiceTemplatesContext,
  input: unknown,
) {
  const q = serviceTemplatesQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.list({
    terms: keys([q.data.query.trim()]),
    ...(q.data.before ? { before: q.data.before } : {}),
  });
  // A pg transaction owns one client; keep that client's queries sequential.
  const entries = [];
  for (const r of rows.slice(0, 25))
    entries.push({
      ...r,
      configurationEligible: await serviceTemplatesReferencesEligible(ctx, r),
    });
  return {
    entries,
    next: rows.length > 25 ? (rows[24]?.entryId ?? null) : null,
    intake: "activation-unavailable" as const,
  };
}
export async function readServiceTemplateEntry(
  ctx: ServiceTemplatesContext,
  id: string,
) {
  return { revision: (await ctx.repository.current(id)) ?? null };
}
export async function readServiceTemplateRevision(
  ctx: ServiceTemplatesContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readServiceTemplateDefinition(
  ctx: ServiceTemplatesContext,
  id: string,
) {
  const r = await ctx.repository.definition(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readServiceTemplateHistory(
  ctx: ServiceTemplatesContext,
  input: unknown,
) {
  const q = serviceTemplatesHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.history(
    q.data.entryId,
    q.data.beforeVersion,
  );
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
// Configuration only; production authority and measurement sessions remain gated.
export async function serviceTemplatesReferencesEligible(
  ctx: ServiceTemplatesContext,
  r: ServiceTemplateRevision,
) {
  if (!r.available) return false;
  try {
    await validateReferences(ctx, r.definition.content);
    return true;
  } catch (e) {
    if (e instanceof DraftFailure) return false;
    throw e;
  }
}
async function validateReferences(
  ctx: ServiceTemplatesContext,
  c: ServiceTemplateContent,
) {
  if (!c.service) fail(422, "VALIDATION_FAILED");
  const target = await ctx.catalogue.repository.current(c.service.entryId);
  if (
    !target ||
    target.definition.id !== c.service.revisionId ||
    target.definition.content.kind !== "service" ||
    !(await catalogueReferencesEligible(ctx.catalogue, target))
  )
    fail(409, "REQUEST_CONFLICT");
  for (const [kind, refs] of [
    ["piece", c.pieces],
    ["addon", c.addons],
  ] as const) {
    const expected =
      kind === "piece"
        ? target.definition.content.pieces
        : target.definition.content.addons;
    if (
      expected.length !== refs.length ||
      expected.some(
        (e) =>
          !refs.some(
            (r) => r.entryId === e.entryId && r.revisionId === e.revisionId,
          ),
      )
    )
      fail(409, "REQUEST_CONFLICT");
    for (const r of refs) {
      const t = await ctx.catalogue.repository.current(r.entryId);
      const source = expected.find((e) => e.entryId === r.entryId);
      if (
        !t ||
        t.definition.id !== r.revisionId ||
        t.definition.content.kind !== kind ||
        !(await catalogueReferencesEligible(ctx.catalogue, t)) ||
        (!source?.optional && r.applicability !== "applicable")
      )
        fail(409, "REQUEST_CONFLICT");
    }
  }
  const scopes: (string | null)[] = c.pieces
    .filter((p) => p.applicability !== "not-applicable")
    .map((p) => p.key);
  if (!c.pieces.length) scopes.push(null);
  if (
    c.forms.length !== scopes.length ||
    scopes.some((key) => !c.forms.some((f) => f.pieceKey === key))
  )
    fail(409, "REQUEST_CONFLICT");
  for (const ref of c.forms) {
    const f = await ctx.forms.repository.current(ref.entryId);
    const piece = c.pieces.find((p) => p.key === ref.pieceKey);
    if (
      !f ||
      f.definition.id !== ref.revisionId ||
      !(await measurementFormsReferencesEligible(ctx.forms, f)) ||
      f.definition.content.service?.entryId !== c.service.entryId ||
      f.definition.content.service?.revisionId !== c.service.revisionId ||
      (f.definition.content.piece?.entryId ?? null) !==
        (piece?.entryId ?? null) ||
      (f.definition.content.piece?.revisionId ?? null) !==
        (piece?.revisionId ?? null)
    )
      fail(409, "REQUEST_CONFLICT");
  }
}
async function validate(ctx: ServiceTemplatesContext, c: ServiceTemplateDraft) {
  const current = await ctx.repository.current(c.entryId);
  if (
    (current?.version ?? 0) !== c.baseVersion ||
    (current?.id ?? null) !== c.baseRevisionId
  )
    fail(412, "VERSION_STALE");
  if (current && current.definition.content.code !== c.content.code)
    fail(409, "REQUEST_CONFLICT");
  const owner = await ctx.repository.codeOwner(c.content.kind, c.content.code);
  if (owner && owner !== c.entryId) fail(409, "REQUEST_CONFLICT");
  if (c.operation === "availability") {
    if (
      !current ||
      (await requestHash(current.definition.content)) !==
        (await requestHash(c.content)) ||
      current.available === c.available
    )
      fail(409, "REQUEST_CONFLICT");
    if (!c.available) return;
  }
  await validateReferences(ctx, c.content);
  // Stable task keys retain identity across all revisions; edits never resolve history by position.
}
export function serviceTemplatesDraftWorkflow(
  ctx: ServiceTemplatesContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: serviceTemplatesDraftSchema,
    commandSchema: serviceTemplatesCommandSchema,
    async revalidate(input) {
      const c = serviceTemplatesCommandSchema.parse(input);
      await ctx.catalogue.repository.lock();
      await ctx.forms.repository.lock();
      await ctx.repository.lock();
      await validate(ctx, c);
    },
    async promote(input, _action, draftId, request) {
      const c = serviceTemplatesCommandSchema.parse(input);
      const revision = await ctx.repository.append({
        ...c,
        actorId: ctx.actorId,
        originDraftId: draftId,
        key: request.key,
        requestId: request.requestId,
        authority: ctx.synthetic ? "synthetic-fixture" : "owner-proposal",
        contentHash: await requestHash(c.content),
        searchKeys: keys([
          c.content.labelEn,
          c.content.labelTa,
          ...c.content.aliases,
        ]),
      });
      if (!(await ctx.repository.advance(revision, c.baseVersion)))
        fail(412, "VERSION_STALE");
      return { type: "service.templates.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "service.templates.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}

// Configuration projection only: no execution, approvals, receipts or booking writes.
export async function previewServiceRequirements(
  ctx: {
    actorId: string;
    repository: Pick<ServiceTemplatesRepository, "definition">;
    catalogue: {
      repository: Pick<ServiceCatalogueContext["repository"], "definition">;
    };
    forms: {
      repository: Pick<MeasurementFormsContext["repository"], "definition">;
    };
  },
  input: unknown,
  templateRevisionId?: string,
) {
  const parsed = serviceTemplatesContentSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const c = parsed.data;
  if (templateRevisionId) {
    const exact = await ctx.repository.definition(templateRevisionId);
    if (!exact) fail(404, "NOT_FOUND");
    if ((await requestHash(exact.content)) !== (await requestHash(c)))
      fail(409, "REQUEST_CONFLICT");
  }
  const sources = [c.service, ...c.pieces, ...c.addons, ...c.forms]
    .filter((x) => x !== null)
    .map((x) => `${x.entryId}:${x.revisionId}`);
  if (templateRevisionId) sources.unshift(`template:${templateRevisionId}`);
  const unavailableSources: string[] = [];
  for (const ref of [c.service, ...c.pieces, ...c.addons]) {
    if (!ref) continue;
    const exact = await ctx.catalogue.repository.definition(ref.revisionId);
    if (!exact || exact.entryId !== ref.entryId)
      unavailableSources.push(`${ref.entryId}:${ref.revisionId}`);
  }
  const items: ServiceRequirementsPreview["items"] = templateSections.flatMap(
    (name) =>
      c[name].map((item) => {
        const scope = [
          c.pieces.find((p) => p.key === item.scope.pieceKey),
          c.addons.find((p) => p.key === item.scope.addonKey),
        ].filter((x) => x !== undefined);
        const excluded =
          (item.applicability === "not-applicable" &&
            !!item.applicabilityReason.trim()) ||
          scope.some(
            (x) => x.applicability === "not-applicable" && !!x.reason.trim(),
          );
        const pendingScope = scope.some(
          (x) => x.applicability === "unresolved",
        );
        const tokens = [
          ...`${item.labelEn} ${item.labelTa} ${item.instructionEn} ${item.instructionTa}`.matchAll(
            /\{\{([a-z_]+)\}\}/g,
          ),
        ].map((x) => x[1] ?? "");
        const predecessors = "predecessors" in item ? item.predecessors : [];
        const prerequisites = "prerequisites" in item ? item.prerequisites : [];
        return {
          section: name,
          key: item.key,
          labelEn: item.labelEn,
          labelTa: item.labelTa,
          required: item.required,
          applicability: excluded
            ? ("not-applicable" as const)
            : pendingScope
              ? ("unresolved" as const)
              : item.applicability,
          state: excluded ? ("not-required" as const) : ("unresolved" as const),
          source: excluded
            ? item.applicabilityReason ||
              scope.find((x) => x.applicability === "not-applicable")?.reason ||
              ""
            : name,
          blockers: [...predecessors, ...prerequisites],
          assigneeId: name === "tasks" ? ctx.actorId : null,
          unresolvedTokens: [...new Set(tokens)],
        };
      }),
  );
  for (const ref of c.forms) {
    const form = await ctx.forms.repository.definition(ref.revisionId);
    if (!form || form.entryId !== ref.entryId) {
      unavailableSources.push(`${ref.entryId}:${ref.revisionId}`);
      items.push({
        section: "measurement",
        key: ref.revisionId,
        labelEn: "Measurement form unavailable",
        labelTa: "அளவுப் படிவம் கிடைக்கவில்லை",
        required: true,
        applicability: "unresolved",
        state: "unresolved",
        source: ref.revisionId,
        blockers: ["measurement-form-missing"],
        assigneeId: null,
        unresolvedTokens: [],
      });
      continue;
    }
    if (form.content.decision === "not-required")
      items.push({
        section: "measurement",
        key: ref.revisionId,
        labelEn: form.content.labelEn,
        labelTa: form.content.labelTa,
        required: false,
        applicability: "not-applicable",
        state: "not-required",
        source: `${ref.revisionId}: ${form.content.decisionReason}`,
        blockers: [],
        assigneeId: null,
        unresolvedTokens: [],
      });
    for (const group of form.content.groups)
      for (const field of group.fields)
        items.push({
          section: "measurement",
          key: `${ref.revisionId}:${field.key}`,
          labelEn: field.labelEn,
          labelTa: field.labelTa,
          required: field.required,
          applicability: "applicable",
          state: "unresolved",
          source: `${ref.revisionId}:${field.id}`,
          blockers: [],
          assigneeId: null,
          unresolvedTokens: [],
        });
  }
  return {
    fingerprint: await requestHash({
      content: c,
      actor: ctx.actorId,
      sources,
      items,
      unavailableSources,
    }),
    definition: c,
    templateRevisionId: templateRevisionId ?? null,
    unavailableSources,
    milestones: (
      ["booked", "cutting", "work", "trial", "ready", "handed-over"] as const
    ).map((key) => {
      const tasks = c.tasks.filter((t) => t.milestone === key);
      const generated = tasks
        .map((t) => items.find((i) => i.section === "tasks" && i.key === t.key))
        .filter((i) => i !== undefined);
      return {
        key,
        state:
          key === "booked" || key === "handed-over"
            ? ("lifecycle" as const)
            : c.sections.tasks.decision === "unresolved" ||
                (c.sections.tasks.decision === "applicable" &&
                  !c.tasks.length) ||
                (c.sections.tasks.decision === "not-applicable" &&
                  !c.sections.tasks.reason.trim()) ||
                generated.some((t) => t.state !== "not-required")
              ? ("unresolved" as const)
              : ("not-applicable" as const),
        taskKeys: tasks.map((t) => t.key),
        requiredBlockers: generated
          .filter((t) => t.required !== false && t.state === "unresolved")
          .map((t) => t.key),
      };
    }),
    effects: "none" as const,
    activation: "unavailable" as const,
    sections: templateSections.map((key) => ({ key, ...c.sections[key] })),
    items,
    sources,
  };
}

export async function readPresentation(
  ctx: ServiceTemplatesContext,
  before?: number,
) {
  await ctx.repository.lock();
  const revision = (await ctx.repository.presentationCurrent()) ?? null;
  const rows = await ctx.repository.presentationHistory(before);
  return {
    mode: revision?.mode ?? ("simple" as const),
    revision,
    history: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function presentationDraftWorkflow(
  ctx: ServiceTemplatesContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: presentationDraftSchema,
    commandSchema: presentationCommandSchema,
    async revalidate(input) {
      const c = presentationCommandSchema.parse(input);
      await ctx.repository.lock();
      const current = await ctx.repository.presentationCurrent();
      if (
        (current?.version ?? 0) !== c.baseVersion ||
        (current?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
      if (current?.mode === c.mode) fail(409, "REQUEST_CONFLICT");
    },
    async promote(input, _action, draftId, request) {
      const c = presentationCommandSchema.parse(input);
      const revision = await ctx.repository.presentationAppend({
        ...c,
        actorId: ctx.actorId,
        originDraftId: draftId,
        ...request,
      });
      if (!(await ctx.repository.presentationAdvance(revision, c.baseVersion)))
        fail(412, "VERSION_STALE");
      return { type: "shop.presentation.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "shop.presentation.revision" ||
        (await ctx.repository.presentationRead(result.id))?.originDraftId !==
          draftId
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
