import {
  commitmentPreviewInputSchema,
  shopCommitmentsCommandSchema,
  shopCommitmentsDraftSchema,
  shopCommitmentsHistoryQuerySchema,
} from "@aarili/contracts/shop-commitments";
import type { ShopCalendarRepository } from "@aarili/db/repositories/shop-calendar";
import type { ShopCommitmentsRepository } from "@aarili/db/repositories/shop-commitments";
import {
  type ApprovedCategoryResolver,
  capacityWeek,
  evaluateCommitment,
} from "./commitment-evaluator.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";

export type ShopCommitmentsContext = {
  shopId: string;
  actorId: string;
  repository: ShopCommitmentsRepository;
  calendar: ShopCalendarRepository;
  categories: ApprovedCategoryResolver;
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
