import {
  type AcceptedOrder,
  createRepeatOrderSchema,
  emptyQuickOrder,
  type RepeatOrderDraft,
  type RepeatSourceRef,
  repeatIntake,
  repeatOrderDraftSchema,
} from "@aarili/contracts/orders";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import { DraftFailure, type DraftWorkflow, mutateDraft } from "./drafts.js";
import type { QuickOrderContext } from "./orders.js";
import {
  acceptResolvedOrder,
  orderReferences,
  readAcceptedOrder,
  readOrderPieces,
  resolveOrderAcceptance,
} from "./orders.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

function fail(status: 404 | 409 | 412 | 422 | 428 = 409): never {
  throw new DraftFailure(status, {
    error: {
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 412
            ? "VERSION_STALE"
            : status === 428
              ? "PRECONDITION_REQUIRED"
              : status === 422
                ? "VALIDATION_FAILED"
                : "REQUEST_CONFLICT",
      message: "Review repeat source",
    },
  });
}
function repositories(ctx: QuickOrderContext) {
  if (!ctx.acceptance?.repository.repeats) fail();
  return {
    orders: ctx.acceptance.repository,
    repeats: ctx.acceptance.repository.repeats,
  };
}
export function initialRepeatOrder(
  source: Pick<AcceptedOrder, "intake">,
  ref: RepeatSourceRef,
): RepeatOrderDraft {
  return {
    ...emptyQuickOrder(),
    customerId: source.intake.customerId,
    wearerId: source.intake.wearerId,
    manifest: source.intake.manifest ? { ...source.intake.manifest } : null,
    instructions: ref.reuseInstructions ? source.intake.instructions : "",
    repeat: { ...ref },
  };
}
export async function readRepeatSource(ctx: QuickOrderContext, id: string) {
  const { orders, repeats } = repositories(ctx);
  // Membership publishers use booking -> order -> identity. Recheck first membership.
  const member = await orders.bookings.membership(id);
  if (member) await orders.bookings.lock(member);
  await orders.lockOrder(id);
  if ((await orders.bookings.membership(id)) !== member) fail();
  const order = await readAcceptedOrder(ctx, id);
  await readOrderPieces(ctx, id); // guardian/permission and supported immutable snapshot
  if ((await requestHash(order.snapshot)) !== order.snapshotDigest) fail();
  const scope = await repeats.scope(id);
  const current = order.intake.manifest
    ? await ctx.templates.repository.current(order.intake.manifest.entryId)
    : undefined;
  return {
    order,
    scopeDigest: await requestHash({
      version: order.version,
      snapshot: order.snapshotDigest,
      ...scope,
    }),
    additions: scope.additions,
    currentManifest: current?.available
      ? {
          entryId: current.entryId,
          revisionId: current.id,
          definitionId: current.definition.id,
        }
      : null,
  };
}
async function authorise(ctx: QuickOrderContext, v: RepeatOrderDraft) {
  const source = await readRepeatSource(ctx, v.repeat.sourceId);
  if (
    source.order.snapshotDigest !== v.repeat.snapshotDigest ||
    v.customerId !== source.order.intake.customerId ||
    v.wearerId !== source.order.intake.wearerId
  )
    fail(404);
  await orderReferences(ctx, repeatIntake(v));
  return source;
}
async function resolve(ctx: QuickOrderContext, v: RepeatOrderDraft) {
  const source = await authorise(ctx, v);
  if (source.order.version !== v.repeat.sourceVersion) fail(412);
  if (source.scopeDigest !== v.repeat.scopeDigest) fail();
  const resolved = await resolveOrderAcceptance(ctx, repeatIntake(v));
  resolved.review.fingerprint = await requestHash({
    base: resolved.review.fingerprint,
    repeat: v.repeat,
  });
  return { ...resolved, snapshot: { ...resolved.snapshot, repeat: v.repeat } };
}
export async function reviewRepeatOrder(
  ctx: QuickOrderContext,
  input: unknown,
) {
  const parsed = repeatOrderDraftSchema.safeParse(input);
  if (!parsed.success) fail(422);
  return (await resolve(ctx, parsed.data)).review;
}
export function repeatOrderWorkflow(ctx: QuickOrderContext): DraftWorkflow {
  let resolved: Awaited<ReturnType<typeof resolve>> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: repeatOrderDraftSchema,
    commandSchema: repeatOrderDraftSchema,
    validateEdit(before, after) {
      const a = repeatOrderDraftSchema.parse(before).repeat,
        b = repeatOrderDraftSchema.parse(after).repeat;
      if (
        a.sourceId !== b.sourceId ||
        a.snapshotDigest !== b.snapshotDigest ||
        a.reuseInstructions !== b.reuseInstructions
      )
        fail();
    },
    async authorizeDraft(input) {
      await authorise(ctx, repeatOrderDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await authorise(ctx, repeatOrderDraftSchema.parse(input));
    },
    async revalidate(input, draftId) {
      const v = repeatOrderDraftSchema.parse(input),
        origin = await repositories(ctx).repeats.origin(draftId);
      if (
        !origin ||
        origin.sourceId !== v.repeat.sourceId ||
        origin.snapshotDigest !== v.repeat.snapshotDigest
      )
        fail();
      resolved = await resolve(ctx, v);
      const d = v.commitmentReview,
        r = resolved.review;
      if (
        !d?.acknowledged ||
        d.fingerprint !== r.fingerprint ||
        r.unknowns.length ||
        r.intake.issues.length ||
        !r.evaluation ||
        !resolved.sources
      )
        fail();
      if (
        (r.evaluation.warnings.some(
          (w) => w === "capacityExceeded" || w === "cutoffPassed",
        ) &&
          !d.exceptionReason.trim()) ||
        (d.waiveRush && (!r.evaluation.facts.rush || !d.waiverReason.trim()))
      )
        fail(422);
    },
    async promote(input, _action, draftId, request) {
      if (!resolved) fail();
      const order = await acceptResolvedOrder(
        ctx,
        repeatIntake(repeatOrderDraftSchema.parse(input)),
        resolved,
        draftId,
        request,
      );
      await repositories(ctx).repeats.link(draftId, order.id);
      return { type: "order.accepted", id: order.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "order.accepted" ||
        !(await repositories(ctx).orders.origin(result.id, draftId))
      )
        fail();
    },
  };
}
export async function createRepeatOrder(
  ctx: QuickOrderContext,
  sourceId: string,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const parsed = createRepeatOrderSchema.safeParse(input),
    expected = parseExpectedVersion(headers.ifMatch);
  if (!parsed.success) fail(422);
  if (!expected.ok) fail(expected.status);
  const { repeats } = repositories(ctx),
    v = parsed.data;
  // Same class order as ordinary draft commands, including the absent-row lock.
  if (
    !idempotencyHeaderSchema.safeParse(headers.key).success ||
    !idempotencyHeaderSchema.safeParse(headers.requestId).success ||
    !headers.key
  )
    fail(422);
  await repeats.drafts.lockKey(headers.key);
  await repeats.drafts.lockDraft(v.draftId);
  const source = await readRepeatSource(ctx, sourceId);
  const ref: RepeatSourceRef = {
    sourceId: source.order.id,
    sourceVersion: expected.version,
    snapshotDigest: v.snapshotDigest,
    scopeDigest: v.scopeDigest,
    reuseInstructions: v.reuseInstructions,
  };
  const origin = await repeats.origin(v.draftId);
  if (origin && (await requestHash(origin)) !== (await requestHash(ref)))
    fail(422);
  if (!origin && source.order.version !== expected.version) fail(412);
  if (source.order.snapshotDigest !== v.snapshotDigest) fail();
  if (!origin && source.scopeDigest !== v.scopeDigest) fail();
  const initial = initialRepeatOrder(source.order, ref);
  const result = await mutateDraft(
    {
      shopId: ctx.templates.shopId,
      actor: { type: "user", id: ctx.templates.actorId },
      repository: repeats.drafts,
      workflows: new Map([["order.repeat", repeatOrderWorkflow(ctx)]]),
    },
    v.draftId,
    "save",
    { workflow: "order.repeat", schemaVersion: 1, payload: initial },
    { key: headers.key, requestId: headers.requestId },
  );
  if (!origin)
    await repeats.insertOrigin(
      v.draftId,
      ref,
      headers.key,
      ctx.templates.actorId,
    );
  return result;
}
export async function readRepeatLinks(
  ctx: QuickOrderContext,
  id: string,
  before?: string,
) {
  await readAcceptedOrder(ctx, id);
  await readOrderPieces(ctx, id);
  const rows = await repositories(ctx).repeats.links(id, before);
  const safe = async (target: string) => {
    try {
      const o = await readAcceptedOrder(ctx, target);
      await readOrderPieces(ctx, target);
      return { id: o.id, code: o.code };
    } catch (e) {
      if (e instanceof DraftFailure && e.status === 404) return null;
      throw e;
    }
  };
  const children = [];
  for (const child of rows.children.slice(0, 25)) {
    const r = await safe(child);
    if (r) children.push(r);
  }
  return {
    source: rows.sourceId ? await safe(rows.sourceId) : null,
    children,
    next: rows.children.length > 25 ? (rows.children[24] ?? null) : null,
  };
}
