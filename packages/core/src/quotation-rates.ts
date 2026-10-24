import {
  policyBindingQuerySchema,
  type QuotePolicyReviewDraft,
  quotePolicyReviewCommandSchema,
  quotePolicyReviewDraftSchema,
  type RateDraft,
  type RateRevision,
  rateCommandSchema,
  rateDraftSchema,
  rateHistoryQuerySchema,
  rateResolveQuerySchema,
  ratesListQuerySchema,
} from "@aarili/contracts/quotation-rates";
import {
  policyErrors,
  shopPoliciesDraftSchema,
} from "@aarili/contracts/shop-policies";
import type { DraftRepository } from "@aarili/db/repositories/drafts";
import type { QuotationRatesRepository } from "@aarili/db/repositories/quotation-rates";
import type { ShopProfileRepository } from "@aarili/db/repositories/shop-profile";
import { parseRupees } from "@aarili/money";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  catalogueReferencesEligible,
  type ServiceCatalogueContext,
} from "./service-catalogue.js";
export type QuotationRatesContext = {
  shopId: string;
  actorId: string;
  repository: QuotationRatesRepository;
  drafts: DraftRepository;
  profile: ShopProfileRepository;
  catalogue: ServiceCatalogueContext;
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
    error: { code, message: "Review the rate or policy source" },
  });
}
export function shopDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function scheduleEntries(
  v: RateDraft,
  previous: RateRevision | undefined,
  today: string,
): RateRevision["entries"] {
  const entries = v.entries.map((e) => {
    let ratePaise: number | null;
    try {
      ratePaise = parseRupees(e.rateText);
    } catch {
      fail(422, "VALIDATION_FAILED");
    }
    if (ratePaise === null) fail(422, "VALIDATION_FAILED");
    return {
      entryId: e.entryId.toLowerCase(),
      from: e.from,
      until: e.until || null,
      ratePaise,
    };
  });
  const ordered = [...entries].sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 0; i < ordered.length; i++) {
    const e = ordered[i];
    if (!e) continue;
    const next = ordered[i + 1];
    if (next && (!e.until || e.until > next.from))
      fail(409, "REQUEST_CONFLICT");
    if (e.from < today) {
      const old = previous?.entries.find((p) => p.entryId === e.entryId);
      if (
        !old ||
        old.from !== e.from ||
        old.ratePaise !== e.ratePaise ||
        (e.until !== old.until &&
          (!e.until ||
            e.until < today ||
            (old.until !== null && old.until < today)))
      )
        fail(409, "REQUEST_CONFLICT");
    }
  }
  for (const old of previous?.entries ?? [])
    if (
      old.from < today &&
      !entries.some(
        (e) =>
          e.entryId === old.entryId &&
          e.from === old.from &&
          e.ratePaise === old.ratePaise,
      )
    )
      fail(409, "REQUEST_CONFLICT");
  return entries;
}
async function validateRate(ctx: QuotationRatesContext, v: RateDraft) {
  // Same global catalogue lock as its publishers, then profile, then rates.
  await ctx.catalogue.repository.lock();
  await ctx.profile.lock();
  await ctx.repository.lock();
  const prior = await ctx.repository.current(v.rateId);
  if (
    (prior?.version ?? 0) !== v.baseVersion ||
    (prior?.id ?? null) !== v.baseRevisionId
  )
    fail(412, "VERSION_STALE");
  if (!v.source || !v.component || !v.unit) fail(422, "VALIDATION_FAILED");
  const owner = await ctx.repository.owner(
    v.source.entryId,
    v.component,
    v.unit,
  );
  if (owner && owner !== v.rateId.toLowerCase()) fail(409, "REQUEST_CONFLICT");
  if (
    prior &&
    (prior.source.entryId !== v.source.entryId.toLowerCase() ||
      prior.component !== v.component ||
      prior.unit !== v.unit ||
      String(prior.basisQuantity) !== v.basisText)
  )
    fail(409, "REQUEST_CONFLICT");
  const source = await ctx.catalogue.repository.current(v.source.entryId);
  const retiring =
    !!prior &&
    !v.available &&
    prior.source.revisionId === v.source.revisionId.toLowerCase();
  if (
    !retiring &&
    (!source ||
      source.id !== v.source.revisionId.toLowerCase() ||
      !(await catalogueReferencesEligible(ctx.catalogue, source)))
  )
    fail(409, "REQUEST_CONFLICT");
  const exact = retiring
    ? await ctx.catalogue.repository.read(v.source.revisionId)
    : source;
  const profile = await ctx.profile.current();
  if (!exact || !profile) fail(409, "REQUEST_CONFLICT");
  if (exact.definition.authority === "synthetic-fixture" && !ctx.synthetic)
    fail(409, "REQUEST_CONFLICT");
  const entries = scheduleEntries(
    v,
    prior,
    shopDate(await ctx.repository.now()),
  );
  return { prior, source: exact, profile, entries };
}
export function rateDraftWorkflow(ctx: QuotationRatesContext): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: rateDraftSchema,
    commandSchema: rateCommandSchema,
    async revalidate(input) {
      await validateRate(ctx, rateCommandSchema.parse(input));
    },
    async promote(input, _action, draftId, request) {
      const v = rateCommandSchema.parse(input),
        r = await validateRate(ctx, v);
      if (!v.component || !v.unit) fail(422, "VALIDATION_FAILED");
      const revision = await ctx.repository.append({
        rateId: v.rateId.toLowerCase(),
        version: v.baseVersion + 1,
        previousId: v.baseRevisionId,
        originDraftId: draftId,
        actorId: ctx.actorId,
        source: { entryId: r.source.entryId, revisionId: r.source.id },
        definitionId: r.source.definition.id,
        profileRevisionId: r.profile.id,
        labelEn: r.source.definition.content.labelEn,
        labelTa: r.source.definition.content.labelTa,
        component: v.component,
        unit: v.unit,
        basisQuantity: Number(v.basisText),
        available: v.available,
        reason: v.reason,
        authority: ctx.synthetic ? "synthetic-only" : "owner-reviewed",
        entries: r.entries,
        ...request,
      });
      if (!(await ctx.repository.advance(revision, v.baseVersion)))
        fail(412, "VERSION_STALE");
      return { type: "pricing.rate.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "pricing.rate.revision" ||
        !(await ctx.repository.origin(result.id, draftId, "rate"))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
async function validatePolicy(
  ctx: QuotationRatesContext,
  v: QuotePolicyReviewDraft,
) {
  if (!v.sourceDraftId) fail(422, "VALIDATION_FAILED");
  await ctx.drafts.lockDraft(v.sourceDraftId);
  await ctx.repository.lock();
  const prior = await ctx.repository.policyCurrent(v.kind);
  if (
    (prior?.version ?? 0) !== v.baseVersion ||
    (prior?.id ?? null) !== v.baseRevisionId
  )
    fail(412, "VERSION_STALE");
  const source = await ctx.repository.sourceDraft(v.sourceDraftId);
  if (
    !source ||
    source.draft.version !== v.sourceDraftVersion ||
    source.draft.workflow !== "shop.policies" ||
    source.draft.schemaVersion !== 1 ||
    source.draft.lifecycle !== "active"
  )
    fail(409, "REQUEST_CONFLICT");
  const parsed = shopPoliciesDraftSchema.safeParse(source.draft.payload);
  if (!parsed.success || parsed.data.policy.kind !== v.kind)
    fail(409, "REQUEST_CONFLICT");
  const p = parsed.data.policy;
  // Reuse numerical/terms validation without changing the old fixture-only publisher.
  if (
    policyErrors({
      ...p,
      authority: { kind: "synthetic-fixture", label: "validation" },
    }).length ||
    (!ctx.synthetic && p.authority.kind !== "owner-proposal") ||
    !p.authority.label.trim() ||
    (["quoteValidity", "discount"].includes(v.kind) && p.state !== "reviewed")
  )
    fail(422, "VALIDATION_FAILED");
  return { source, policy: p };
}
export function quotePolicyReviewWorkflow(
  ctx: QuotationRatesContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: quotePolicyReviewDraftSchema,
    commandSchema: quotePolicyReviewCommandSchema,
    async revalidate(input) {
      await validatePolicy(ctx, quotePolicyReviewCommandSchema.parse(input));
    },
    async promote(input, _action, draftId, request) {
      const v = quotePolicyReviewCommandSchema.parse(input),
        r = await validatePolicy(ctx, v);
      if (!v.sourceDraftId) fail(422, "VALIDATION_FAILED");
      const b = await ctx.repository.bind({
        kind: v.kind,
        version: v.baseVersion + 1,
        previousId: v.baseRevisionId,
        originDraftId: draftId,
        actorId: ctx.actorId,
        sourceDraftId: v.sourceDraftId,
        sourceDraftVersion: v.sourceDraftVersion,
        sourceHash: r.source.hash,
        policy: r.policy,
        reason: v.reason,
        authority:
          ctx.synthetic || r.policy.authority.kind === "synthetic-fixture"
            ? "synthetic-only"
            : "owner-reviewed",
        ...request,
      });
      return { type: "pricing.policy.binding", id: b.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "pricing.policy.binding" ||
        !(await ctx.repository.origin(result.id, draftId, "policy"))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
export async function listRates(ctx: QuotationRatesContext, input: unknown) {
  const q = ratesListQuerySchema.parse(input),
    rows = await ctx.repository.list(q.before);
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.rateId ?? null) : null,
    today: shopDate(await ctx.repository.now()),
    effects: "none" as const,
  };
}
export async function rateHistory(ctx: QuotationRatesContext, input: unknown) {
  const q = rateHistoryQuerySchema.parse(input),
    rows = await ctx.repository.history(q.rateId, q.beforeVersion);
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export async function rateRevision(ctx: QuotationRatesContext, id: string) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function policyHistory(
  ctx: QuotationRatesContext,
  input: unknown,
) {
  const q = policyBindingQuerySchema.parse(input),
    rows = await ctx.repository.policyHistory(q.kind, q.beforeVersion);
  return {
    bindings: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export async function resolveRate(ctx: QuotationRatesContext, input: unknown) {
  const q = rateResolveQuerySchema.parse(input),
    r = await ctx.repository.current(q.rateId);
  const result = (
    state: "known" | "missing" | "unavailable" | "ambiguous",
    entry: RateRevision["entries"][number] | null = null,
  ) => ({ state, revision: r ?? null, entry, effects: "none" as const });
  if (!r) return result("missing");
  const source = await ctx.catalogue.repository.current(r.source.entryId);
  if (
    !r.available ||
    !source ||
    source.id !== r.source.revisionId ||
    !(await catalogueReferencesEligible(ctx.catalogue, source))
  )
    return result("unavailable");
  const entries = r.entries.filter(
    (e) => e.from <= q.date && (!e.until || q.date < e.until),
  );
  return entries.length === 1
    ? result("known", entries[0])
    : result(entries.length ? "ambiguous" : "missing");
}
