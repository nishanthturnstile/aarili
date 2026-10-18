import {
  type MeasurementFormDraft,
  type MeasurementFormRevision,
  measurementFormsCommandSchema,
  measurementFormsDraftSchema,
  measurementFormsHistoryQuerySchema,
  measurementFormsQuerySchema,
} from "@aarili/contracts/measurement-forms";
import type { MeasurementFormsRepository } from "@aarili/db/repositories/measurement-forms";
import { searchKeysV1 } from "@aarili/i18n/search";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
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
export type MeasurementFormsContext = {
  shopId: string;
  actorId: string;
  repository: MeasurementFormsRepository;
  synthetic: boolean;
  catalogue: ServiceCatalogueContext;
  illustrationAllowed?: (id: string, version: number) => Promise<boolean>;
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
    error: { code, message: "MeasurementForm request rejected" },
  });
}
export async function readMeasurementForms(
  ctx: MeasurementFormsContext,
  input: unknown,
) {
  const q = measurementFormsQuerySchema.safeParse(input);
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
      configurationEligible: await measurementFormsReferencesEligible(ctx, r),
    });
  return {
    entries,
    next: rows.length > 25 ? (rows[24]?.entryId ?? null) : null,
    intake: "templates-pending" as const,
  };
}
export async function readMeasurementFormEntry(
  ctx: MeasurementFormsContext,
  id: string,
) {
  return { revision: (await ctx.repository.current(id)) ?? null };
}
export async function readMeasurementFormRevision(
  ctx: MeasurementFormsContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readMeasurementFormDefinition(
  ctx: MeasurementFormsContext,
  id: string,
) {
  const r = await ctx.repository.definition(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readMeasurementFormHistory(
  ctx: MeasurementFormsContext,
  input: unknown,
) {
  const q = measurementFormsHistoryQuerySchema.safeParse(input);
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
export async function measurementFormsReferencesEligible(
  ctx: MeasurementFormsContext,
  r: MeasurementFormRevision,
) {
  if (!r.available) return false;
  const c = r.definition.content;
  for (const ref of [c.service, c.piece]) {
    if (!ref) continue;
    const t = await ctx.catalogue.repository.current(ref.entryId);
    if (
      !t ||
      t.definition.id !== ref.revisionId ||
      !(await catalogueReferencesEligible(ctx.catalogue, t))
    )
      return false;
  }
  for (const g of c.groups)
    for (const f of g.fields)
      if (
        f.illustration &&
        !(await ctx.illustrationAllowed?.(
          f.illustration.assetId,
          f.illustration.version,
        ))
      )
        return false;
  return true;
}
async function validate(ctx: MeasurementFormsContext, c: MeasurementFormDraft) {
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
  // Preserve identity semantics across *all* earlier revisions, including removed fields.
  const historic = await ctx.repository.fieldSemantics(c.entryId);
  for (const g of c.content.groups)
    for (const f of g.fields) {
      for (const old of historic)
        if (
          (old.id === f.id &&
            (old.key !== f.key ||
              old.meaning !== f.meaning ||
              old.kind !== f.kind)) ||
          (old.key === f.key && old.id !== f.id)
        )
          fail(409, "REQUEST_CONFLICT");
    }
  for (const g of c.content.groups)
    for (const f of g.fields)
      if (
        f.illustration &&
        !(await ctx.illustrationAllowed?.(
          f.illustration.assetId,
          f.illustration.version,
        ))
      )
        fail(409, "REQUEST_CONFLICT");
  const service = c.content.service;
  if (!service) fail(422, "VALIDATION_FAILED");
  const target = await ctx.catalogue.repository.current(service.entryId);
  if (
    !target ||
    target.definition.id !== service.revisionId ||
    target.definition.content.kind !== "service" ||
    !(await catalogueReferencesEligible(ctx.catalogue, target))
  )
    fail(409, "REQUEST_CONFLICT");
  if (
    c.content.decision === "not-required" &&
    target.definition.content.serviceKind !== "small-service"
  )
    fail(409, "REQUEST_CONFLICT");
  if (c.content.piece) {
    const p = c.content.piece;
    const piece = await ctx.catalogue.repository.current(p.entryId);
    if (
      !piece ||
      piece.definition.id !== p.revisionId ||
      piece.definition.content.kind !== "piece" ||
      !(await catalogueReferencesEligible(ctx.catalogue, piece)) ||
      !target.definition.content.pieces.some(
        (x) => x.entryId === p.entryId && x.revisionId === p.revisionId,
      )
    )
      fail(409, "REQUEST_CONFLICT");
  }
}
export function measurementFormsDraftWorkflow(
  ctx: MeasurementFormsContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: measurementFormsDraftSchema,
    commandSchema: measurementFormsCommandSchema,
    async revalidate(input) {
      const c = measurementFormsCommandSchema.parse(input);
      await ctx.catalogue.repository.lock();
      await ctx.repository.lock();
      await validate(ctx, c);
    },
    async promote(input, _action, draftId, request) {
      const c = measurementFormsCommandSchema.parse(input);
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
      return { type: "measurement.forms.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "measurement.forms.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
