import {
  type CatalogueDraft,
  type CatalogueRevision,
  catalogueCommandSchema,
  catalogueDraftSchema,
  catalogueHistoryQuerySchema,
  catalogueQuerySchema,
} from "@aarili/contracts/service-catalogue";
import type { ServiceCatalogueRepository } from "@aarili/db/repositories/service-catalogue";
import { searchKeysV1 } from "@aarili/i18n/search";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { requestHash } from "./request-binding.js";

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
export type ServiceCatalogueContext = {
  shopId: string;
  actorId: string;
  repository: ServiceCatalogueRepository;
  synthetic: boolean;
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
    error: { code, message: "Catalogue request rejected" },
  });
}
export async function readServiceCatalogue(
  ctx: ServiceCatalogueContext,
  input: unknown,
) {
  const q = catalogueQuerySchema.safeParse(input);
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
      configurationEligible: await catalogueReferencesEligible(ctx, r),
    });
  return {
    entries,
    next: rows.length > 25 ? (rows[24]?.entryId ?? null) : null,
    intake: "templates-pending" as const,
  };
}
export async function readCatalogueEntry(
  ctx: ServiceCatalogueContext,
  id: string,
) {
  return { revision: (await ctx.repository.current(id)) ?? null };
}
export async function readCatalogueRevision(
  ctx: ServiceCatalogueContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readCatalogueDefinition(
  ctx: ServiceCatalogueContext,
  id: string,
) {
  const r = await ctx.repository.definition(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readCatalogueHistory(
  ctx: ServiceCatalogueContext,
  input: unknown,
) {
  const q = catalogueHistoryQuerySchema.safeParse(input);
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
// Catalogue configuration eligibility only. Orders/forms and policy authority are later slices.
export async function catalogueReferencesEligible(
  ctx: ServiceCatalogueContext,
  revision: CatalogueRevision,
) {
  if (!revision.available) return false;
  for (const ref of [
    ...(revision.definition.content.parent
      ? [revision.definition.content.parent]
      : []),
    ...revision.definition.content.pieces,
    ...revision.definition.content.addons,
  ]) {
    const target = await ctx.repository.current(ref.entryId);
    if (!target?.available || target.definition.id !== ref.revisionId)
      return false;
    if (!(await catalogueReferencesEligible(ctx, target))) return false;
  }
  return true;
}
async function validate(ctx: ServiceCatalogueContext, c: CatalogueDraft) {
  const current = await ctx.repository.current(c.entryId);
  if (
    (current?.version ?? 0) !== c.baseVersion ||
    (current?.id ?? null) !== c.baseRevisionId
  )
    fail(412, "VERSION_STALE");
  if (
    current &&
    (current.definition.content.kind !== c.content.kind ||
      current.definition.content.code !== c.content.code)
  )
    fail(409, "REQUEST_CONFLICT");
  const owner = await ctx.repository.codeOwner(c.content.kind, c.content.code);
  if (owner && owner !== c.entryId) fail(409, "REQUEST_CONFLICT");
  if (
    c.operation === "availability" &&
    (!current ||
      (await requestHash(current.definition.content)) !==
        (await requestHash(c.content)))
  )
    fail(409, "REQUEST_CONFLICT");
  if (c.operation === "availability" && current?.available === c.available)
    fail(409, "REQUEST_CONFLICT");
  // Disabling must remain possible even after a referenced entry becomes unavailable.
  if (c.operation === "availability" && !c.available) return;
  for (const [role, refs] of [
    ["parent", c.content.parent ? [c.content.parent] : []],
    ["piece", c.content.pieces],
    ["addon", c.content.addons],
  ] as const) {
    for (const ref of refs) {
      const target = await ctx.repository.current(ref.entryId);
      const allowed =
        role === "parent"
          ? c.content.kind === "subcategory"
            ? ["category"]
            : ["category", "subcategory"]
          : [role];
      if (
        !target?.available ||
        target.definition.id !== ref.revisionId ||
        !allowed.includes(target.definition.content.kind) ||
        !(await catalogueReferencesEligible(ctx, target))
      )
        fail(409, "REQUEST_CONFLICT");
    }
  }
}
export function serviceCatalogueDraftWorkflow(
  ctx: ServiceCatalogueContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: catalogueDraftSchema,
    commandSchema: catalogueCommandSchema,
    async revalidate(input) {
      const c = catalogueCommandSchema.parse(input);
      await ctx.repository.lock();
      await validate(ctx, c);
    },
    async promote(input, _action, draftId, request) {
      const c = catalogueCommandSchema.parse(input);
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
      return { type: "service.catalogue.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "service.catalogue.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
