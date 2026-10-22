import {
  type DesignChoicesContent,
  type DesignChoicesDraft,
  type DesignChoicesRevision,
  designChoicesCommandSchema,
  designChoicesDraftSchema,
  designChoicesHistoryQuerySchema,
  designChoicesQuerySchema,
  designPreviewRequestSchema,
  designPreviewSchema,
  designQuestionSchema,
} from "@aarili/contracts/design-choices";
import type { DesignChoicesRepository } from "@aarili/db/repositories/design-choices";
import { searchKeysV1 } from "@aarili/i18n/search";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { requestHash } from "./request-binding.js";
import {
  catalogueReferencesEligible,
  type ServiceCatalogueContext,
} from "./service-catalogue.js";
import {
  type ServiceTemplatesContext,
  serviceTemplatesReferencesEligible,
} from "./service-templates.js";

export type DesignChoicesContext = {
  shopId: string;
  actorId: string;
  synthetic: boolean;
  repository: DesignChoicesRepository;
  catalogue: ServiceCatalogueContext;
  templates: ServiceTemplatesContext;
};
function fail(status: 404 | 409 | 412 | 422 = 409): never {
  throw new DraftFailure(status, {
    error: {
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 412
            ? "VERSION_STALE"
            : status === 422
              ? "VALIDATION_FAILED"
              : "REQUEST_CONFLICT",
      message: "Review the design configuration",
    },
  });
}
const keys = (values: string[]) => [
  ...new Set(
    values.flatMap((v) => {
      const k = searchKeysV1(v);
      return [k.nameTaNorm.toLowerCase(), k.nameLatinNorm, k.nameSkel].filter(
        Boolean,
      );
    }),
  ),
];
export async function readDesignChoices(
  ctx: DesignChoicesContext,
  input: unknown,
) {
  const q = designChoicesQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const rows = await ctx.repository.list({
    terms: keys([q.data.query]),
    ...(q.data.before ? { before: q.data.before } : {}),
  });
  const entries = [];
  for (const r of rows.slice(0, 25))
    entries.push({
      ...r,
      configurationEligible: await designChoicesReferencesEligible(ctx, r),
    });
  return {
    entries,
    next: rows.length > 25 ? (rows[24]?.entryId ?? null) : null,
    intake: "activation-unavailable" as const,
  };
}
export async function readDesignChoicesEntry(
  ctx: DesignChoicesContext,
  id: string,
) {
  return { revision: (await ctx.repository.current(id)) ?? null };
}
export async function readDesignChoicesRevision(
  ctx: DesignChoicesContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404);
  return r;
}
export async function readDesignChoicesDefinition(
  ctx: DesignChoicesContext,
  id: string,
) {
  const r = await ctx.repository.definition(id);
  if (!r) fail(404);
  return r;
}
export async function readDesignChoicesHistory(
  ctx: DesignChoicesContext,
  input: unknown,
) {
  const q = designChoicesHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const rows = await ctx.repository.history(
    q.data.entryId,
    q.data.beforeVersion,
  );
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export async function designChoicesReferencesEligible(
  ctx: DesignChoicesContext,
  r: DesignChoicesRevision,
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
  ctx: DesignChoicesContext,
  c: DesignChoicesContent,
) {
  if (!c.category) fail(422);
  const category = await ctx.catalogue.repository.current(c.category.entryId);
  if (
    !category ||
    category.definition.id !== c.category.revisionId ||
    category.definition.content.kind !== "category" ||
    !(await catalogueReferencesEligible(ctx.catalogue, category))
  )
    fail();
  if (c.kind === "choice") return;
  if (!c.manifest) fail(422);
  const manifest = await ctx.templates.repository.current(c.manifest.entryId);
  if (
    !manifest ||
    manifest.definition.id !== c.manifest.revisionId ||
    !(await serviceTemplatesReferencesEligible(ctx.templates, manifest))
  )
    fail();
  const m = manifest.definition.content;
  let parent = m.service
    ? await ctx.catalogue.repository.definition(m.service.revisionId)
    : undefined;
  if (parent?.content.kind !== "service") fail();
  parent = parent.content.parent
    ? await ctx.catalogue.repository.definition(
        parent.content.parent.revisionId,
      )
    : undefined;
  if (parent?.content.kind === "subcategory")
    parent = parent.content.parent
      ? await ctx.catalogue.repository.definition(
          parent.content.parent.revisionId,
        )
      : undefined;
  if (
    parent?.id !== c.category.revisionId ||
    parent.entryId !== c.category.entryId
  )
    fail();
  if (
    c.pieceKey === null
      ? m.pieces.length > 0
      : !m.pieces.some(
          (p) => p.key === c.pieceKey && p.applicability !== "not-applicable",
        )
  )
    fail();
  // The exact manifest pins the form for this scope; no body values are collected.
  if (!m.forms.some((f) => f.pieceKey === c.pieceKey)) fail();
  const all = [
    ...m.construction,
    ...m.decoration,
    ...m.materials,
    ...m.tasks,
    ...m.quality,
    ...m.instructions,
    ...m.method,
    ...m.confirmation,
  ];
  for (const key of c.templateKeys) {
    const item = all.find((x) => x.key === key);
    if (
      !item ||
      item.scope.pieceKey !== c.pieceKey ||
      item.applicability === "not-applicable"
    )
      fail();
  }
  for (const q of c.questions) {
    for (const ref of q.choices) {
      const choice = await ctx.repository.current(ref.entryId);
      const content = choice?.definition.content;
      if (
        !choice?.available ||
        choice.definition.id !== ref.revisionId ||
        content?.kind !== "choice" ||
        content.dimension !== q.key ||
        content.category?.entryId !== c.category.entryId ||
        content.category?.revisionId !== c.category.revisionId
      )
        fail();
    }
  }
}
async function validate(ctx: DesignChoicesContext, c: DesignChoicesDraft) {
  const current = await ctx.repository.current(c.entryId);
  if (
    (current?.version ?? 0) !== c.baseVersion ||
    (current?.id ?? null) !== c.baseRevisionId
  )
    fail(412);
  if (
    current &&
    (current.definition.content.kind !== c.content.kind ||
      current.definition.content.code !== c.content.code)
  )
    fail();
  const owner = await ctx.repository.codeOwner(c.content.kind, c.content.code);
  if (owner && owner !== c.entryId) fail();
  if (c.operation === "availability") {
    if (
      !current ||
      (await requestHash(current.definition.content)) !==
        (await requestHash(c.content)) ||
      current.available === c.available
    )
      fail();
    if (!c.available) return;
  }
  if (
    current?.definition.content.kind === "choice" &&
    c.content.kind === "choice"
  ) {
    const prior = current.definition.content;
    if (
      prior.dimension !== c.content.dimension ||
      prior.meaning !== c.content.meaning ||
      prior.none !== c.content.none ||
      prior.category?.entryId !== c.content.category?.entryId
    )
      fail();
  }
  if (c.content.kind === "profile")
    for (const q of c.content.questions)
      for (const old of await ctx.repository.questionSemantics(q.id)) {
        const p = designQuestionSchema.parse(old);
        if (
          p.key !== q.key ||
          p.meaning !== q.meaning ||
          p.kind !== q.kind ||
          (await requestHash(p.units)) !== (await requestHash(q.units))
        )
          fail();
      }
  await validateReferences(ctx, c.content);
}
export function designChoicesDraftWorkflow(
  ctx: DesignChoicesContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: designChoicesDraftSchema,
    commandSchema: designChoicesCommandSchema,
    async revalidate(input) {
      await ctx.catalogue.repository.lock();
      await ctx.templates.forms.repository.lock();
      await ctx.templates.repository.lock();
      await ctx.repository.lock();
      await validate(ctx, designChoicesCommandSchema.parse(input));
    },
    async promote(input, _action, draftId, request) {
      const c = designChoicesCommandSchema.parse(input);
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
      if (!(await ctx.repository.advance(revision, c.baseVersion))) fail(412);
      return { type: "design.choices.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "design.choices.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail();
    },
  };
}
export async function previewDesignChoices(
  ctx: DesignChoicesContext,
  input: unknown,
) {
  const p = designPreviewRequestSchema.safeParse(input);
  if (!p.success) fail(422);
  const { content: c, selections } = p.data;
  if (
    !designChoicesCommandSchema.safeParse({
      entryId: crypto.randomUUID(),
      baseVersion: 0,
      baseRevisionId: null,
      operation: "definition",
      content: c,
      available: true,
      reason: "Preview only",
    }).success ||
    c.kind !== "profile"
  )
    fail(422);
  await validateReferences(ctx, c);
  if (
    new Set(selections.map((s) => s.questionId)).size !== selections.length ||
    selections.some((s) => !c.questions.some((q) => q.id === s.questionId))
  )
    fail(422);
  const incompatible: string[] = [];
  type PreviewState =
    | "unknown"
    | "not-applicable"
    | "selected"
    | "dependency-unresolved";
  const states = new Map<string, PreviewState>();
  const state = (q: (typeof c.questions)[number]): PreviewState => {
    const cached = states.get(q.id);
    if (cached) return cached;
    const value = evaluate(q);
    states.set(q.id, value);
    return value;
  };
  const evaluate = (q: (typeof c.questions)[number]): PreviewState => {
    if (q.applicability === "not-applicable") return "not-applicable";
    for (const w of q.when) {
      const parent = c.questions.find((x) => x.id === w.questionId);
      const selected = selections.find((s) => s.questionId === w.questionId);
      if (
        !parent ||
        state(parent) !== "selected" ||
        selected?.choice?.entryId !== w.choice.entryId ||
        selected?.choice?.revisionId !== w.choice.revisionId
      )
        return "dependency-unresolved";
    }
    const s = selections.find((x) => x.questionId === q.id);
    if (!s || s.state === "unknown") return "unknown";
    if (
      s.state !== "selected" ||
      !s.choice ||
      q.kind !== "choice" ||
      !q.choices.some(
        (r) =>
          r.entryId === s.choice?.entryId &&
          r.revisionId === s.choice?.revisionId,
      )
    ) {
      incompatible.push(q.id);
      return "unknown";
    }
    return "selected";
  };
  const questions = c.questions.map((q) => {
    const value = state(q);
    if (
      (value === "dependency-unresolved" || value === "not-applicable") &&
      selections.some((s) => s.questionId === q.id && s.state === "selected")
    )
      incompatible.push(q.id);
    return { ...q, state: value };
  });
  return designPreviewSchema.parse({
    questions,
    incompatible: [...new Set(incompatible)],
    effects: "none",
    references: "unavailable",
    pattern: "manual-external",
  });
}
