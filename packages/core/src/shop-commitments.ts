import {
  boundCommitmentPreviewInputSchema,
  type CommitmentBindingDraft,
  commitmentBindingCommandSchema,
  commitmentBindingDraftSchema,
  commitmentBindingHistoryQuerySchema,
  commitmentPreviewInputSchema,
  shopCommitmentsCommandSchema,
  shopCommitmentsDraftSchema,
  shopCommitmentsHistoryQuerySchema,
} from "@aarili/contracts/shop-commitments";
import type { ServiceCatalogueRepository } from "@aarili/db/repositories/service-catalogue";
import type { ShopCalendarRepository } from "@aarili/db/repositories/shop-calendar";
import type {
  CommitmentBindingsRepository,
  ShopCommitmentsRepository,
} from "@aarili/db/repositories/shop-commitments";
import {
  type ApprovedCategoryResolver,
  capacityWeek,
  evaluateCommitment,
} from "./commitment-evaluator.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { requestHash } from "./request-binding.js";

export type ShopCommitmentsContext = {
  shopId: string;
  actorId: string;
  repository: ShopCommitmentsRepository;
  calendar: ShopCalendarRepository;
  categories: ApprovedCategoryResolver;
  bindings?: CommitmentBindingsRepository;
  catalogue?: ServiceCatalogueRepository;
};

function bindingRepositories(ctx: ShopCommitmentsContext) {
  if (!ctx.bindings || !ctx.catalogue) fail(409, "REQUEST_CONFLICT");
  return { bindings: ctx.bindings, catalogue: ctx.catalogue };
}
async function bindingSources(
  ctx: ShopCommitmentsContext,
  c: CommitmentBindingDraft,
) {
  const { catalogue } = bindingRepositories(ctx);
  const category = await catalogue.current(c.categoryId);
  const rule = await ctx.repository.current();
  if (
    !category?.available ||
    category.definition.content.kind !== "category" ||
    category.id !== c.availabilityId ||
    category.definition.id !== c.categoryRevisionId ||
    !rule ||
    rule.id !== c.ruleRevisionId
  )
    fail(409, "REQUEST_CONFLICT");
  return { category, rule };
}
export async function readCommitmentBinding(
  ctx: ShopCommitmentsContext,
  categoryId: string,
) {
  const { bindings } = bindingRepositories(ctx);
  const revision = await bindings.current(categoryId);
  let currentEligible = false;
  if (revision) {
    try {
      await bindingSources(ctx, revision);
      currentEligible = true;
    } catch (e) {
      if (!(e instanceof DraftFailure)) throw e;
    }
  }
  return {
    version: revision?.version ?? 0,
    revision: revision ?? null,
    currentEligible,
    activation: "unavailable" as const,
  };
}
export async function readCommitmentBindingRevision(
  ctx: ShopCommitmentsContext,
  id: string,
) {
  const r = await bindingRepositories(ctx).bindings.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readCommitmentBindingHistory(
  ctx: ShopCommitmentsContext,
  input: unknown,
) {
  const q = commitmentBindingHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await bindingRepositories(ctx).bindings.history(
    q.data.categoryId,
    q.data.beforeVersion,
  );
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function commitmentBindingsDraftWorkflow(
  ctx: ShopCommitmentsContext,
): DraftWorkflow {
  const { bindings, catalogue } = bindingRepositories(ctx);
  async function validate(c: CommitmentBindingDraft) {
    const r = await bindings.current(c.categoryId);
    if (
      (r?.version ?? 0) !== c.baseVersion ||
      (r?.id ?? null) !== c.baseRevisionId
    )
      fail(412, "VERSION_STALE");
    return bindingSources(ctx, c);
  }
  return {
    schemaVersion: 1,
    draftSchema: commitmentBindingDraftSchema,
    commandSchema: commitmentBindingCommandSchema,
    async revalidate(input) {
      // Same lock identities as source publication, held until the outer draft commit.
      await catalogue.lock();
      await ctx.repository.lock();
      await bindings.lock();
      await validate(commitmentBindingCommandSchema.parse(input));
    },
    async promote(input, _action, draftId, request) {
      const c = commitmentBindingCommandSchema.parse(input);
      const { category, rule } = await validate(c);
      const synthetic =
        category.definition.authority === "synthetic-fixture" ||
        rule.configuration.authority === "synthetic-fixture";
      const authority = synthetic
        ? "synthetic-fixture"
        : c.review === "reviewed"
          ? "owner-reviewed"
          : "owner-proposal";
      const digest = await requestHash({
        contract: "commitment-binding-v1",
        category,
        rule,
        review: c.review,
      });
      const r = await bindings.append({
        ...c,
        actorId: ctx.actorId,
        originDraftId: draftId,
        key: request.key,
        requestId: request.requestId,
        authority,
        digest,
      });
      if (!(await bindings.advance(r, c.baseVersion)))
        fail(412, "VERSION_STALE");
      return { type: "service.commitment-binding.revision", id: r.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "service.commitment-binding.revision" ||
        !(await bindings.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
export async function previewBoundShopCommitments(
  ctx: ShopCommitmentsContext,
  input: unknown,
) {
  const p = boundCommitmentPreviewInputSchema.safeParse(input);
  if (!p.success) fail(422, "VALIDATION_FAILED");
  const v = p.data,
    r = await readCommitmentBindingRevision(ctx, v.bindingId);
  if (
    v.scenario.mode !== "production" ||
    (v.scenario.categoryId !== null &&
      v.scenario.categoryId !== r.categoryId) ||
    (v.categoryRevisionId !== undefined &&
      v.categoryRevisionId !== r.categoryRevisionId) ||
    (v.ruleRevisionId !== undefined && v.ruleRevisionId !== r.ruleRevisionId)
  )
    fail(409, "REQUEST_CONFLICT");
  const { bindings } = bindingRepositories(ctx);
  if ((await bindings.current(r.categoryId))?.id !== r.id)
    fail(409, "REQUEST_CONFLICT");
  const { category, rule } = await bindingSources(ctx, r);
  const calendar = v.calendarRevisionId
    ? await ctx.calendar.read(v.calendarRevisionId)
    : await ctx.calendar.current();
  if (v.calendarRevisionId && !calendar) fail(404, "NOT_FOUND");
  const sources = {
    binding: `${r.id}:v${r.version}`,
    categoryRevision: r.categoryRevisionId,
    availability: r.availabilityId,
    ruleRevision: r.ruleRevisionId,
    digest: r.digest,
  };
  const reviewed =
    r.authority === "owner-reviewed" &&
    category.definition.authority !== "synthetic-fixture" &&
    rule.configuration.authority !== "synthetic-fixture";
  const result = await evaluateCommitment({
    shopId: ctx.shopId,
    configuration: rule.configuration,
    configurationSource: `${rule.id}:v${rule.version}`,
    calendar: calendar ?? null,
    category: await ctx.categories.resolve(r.categoryId),
    load: null,
    scenario: {
      ...v.scenario,
      categoryId: r.categoryId,
      quantity: null,
      unit: null,
    },
    previousFingerprint: v.previousFingerprint,
    boundAuthority: { reviewed, sources },
  });
  return {
    ...result,
    contractVersion: 2 as const,
    binding: "reviewed-binding-preview" as const,
    authority: reviewed ? ("owner-reviewed" as const) : ("pending" as const),
    sources: { ...result.sources, ...sources },
  };
}
function fail(
  status: 404 | 409 | 412 | 422,
  code:
    | "NOT_FOUND"
    | "REQUEST_CONFLICT"
    | "VERSION_STALE"
    | "VALIDATION_FAILED",
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Commitment request rejected" },
  });
}
export async function readShopCommitments(ctx: ShopCommitmentsContext) {
  const revision = await ctx.repository.current();
  return { version: revision?.version ?? 0, revision: revision ?? null };
}
export async function readShopCommitmentsRevision(
  ctx: ShopCommitmentsContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readShopCommitmentsHistory(
  ctx: ShopCommitmentsContext,
  input: unknown,
) {
  const q = shopCommitmentsHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.history(q.data.beforeVersion);
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function shopCommitmentsDraftWorkflow(
  ctx: ShopCommitmentsContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: shopCommitmentsDraftSchema,
    commandSchema: shopCommitmentsCommandSchema,
    async revalidate(command) {
      const c = shopCommitmentsCommandSchema.parse(command);
      await ctx.repository.lock();
      const current = await readShopCommitments(ctx);
      if (
        current.version !== c.baseVersion ||
        (current.revision?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
    },
    async promote(command, _actionId, draftId, request) {
      const c = shopCommitmentsCommandSchema.parse(command),
        current = await readShopCommitments(ctx);
      if (
        current.version !== c.baseVersion ||
        (current.revision?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
      const configuration = c.configuration;
      const revision = await ctx.repository.append({
        configuration,
        version: current.version + 1,
        previousId: current.revision?.id ?? null,
        actorId: ctx.actorId,
        originDraftId: draftId,
        key: request.key,
        requestId: request.requestId,
      });
      if (!(await ctx.repository.advance(revision, current.version)))
        fail(412, "VERSION_STALE");
      return { type: "shop.commitments.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "shop.commitments.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}

export async function previewShopCommitments(
  ctx: ShopCommitmentsContext,
  input: unknown,
) {
  const parsed = commitmentPreviewInputSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const p = parsed.data;
  const revision =
    p.source.kind === "revision"
      ? await ctx.repository.read(p.source.revisionId)
      : null;
  if (p.source.kind === "revision" && !revision) fail(404, "NOT_FOUND");
  const configuration =
    p.source.kind === "draft"
      ? p.source.draft.configuration
      : revision?.configuration;
  if (!configuration) fail(404, "NOT_FOUND");
  const calendar = p.calendarRevisionId
    ? await ctx.calendar.read(p.calendarRevisionId)
    : await ctx.calendar.current();
  if (p.calendarRevisionId && !calendar) fail(404, "NOT_FOUND");
  const synthetic = p.scenario.mode === "synthetic";
  // This fixture is server-owned; the request cannot inject an approved category/load.
  const category = synthetic
    ? {
        shopId: ctx.shopId,
        id: "SYNTHETIC-category",
        version: "fixture-v1",
        warningDays: 7,
        eligible: true,
        synthetic: true,
      }
    : p.scenario.categoryId
      ? await ctx.categories.resolve(p.scenario.categoryId)
      : null;
  const week =
    configuration.weekStart !== null &&
    Number.isInteger(configuration.weekStart) &&
    configuration.weekStart >= 0 &&
    configuration.weekStart <= 6
      ? capacityWeek(p.scenario.deliveryDate, configuration.weekStart)
      : null;
  const load =
    synthetic && p.scenario.fixture === "peak-cap-rush" && week
      ? {
          quantity: 10,
          unit: "garments" as const,
          weekStart: week.start,
          source: "SYNTHETIC-load-v1",
          asOf: `${p.scenario.today}T00:00:00+05:30`,
        }
      : null;
  return evaluateCommitment({
    shopId: ctx.shopId,
    configuration,
    configurationSource: revision
      ? `${revision.id}:v${revision.version}`
      : `draft:v${p.source.kind === "draft" ? p.source.draft.baseVersion : 0}`,
    calendar: calendar ?? null,
    category,
    load,
    scenario: p.scenario,
    previousFingerprint: p.previousFingerprint,
  });
}
