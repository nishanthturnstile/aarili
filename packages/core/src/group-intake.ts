import type { DraftRecord, DraftResult } from "@aarili/contracts/drafts";
import {
  emptyGroupIntake,
  type GroupIntakeDraft,
  type GroupIntakeReview,
  groupIntakeCommandSchema,
  groupIntakeDraftSchema,
  type QuickOrderDraft,
} from "@aarili/contracts/orders";
import type { DraftRepository } from "@aarili/db/repositories/drafts";
import { parseRupees } from "@aarili/money";
import { readCustomer } from "./customers.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { projectOrderPieces } from "./order-pieces.js";
import {
  acceptResolvedOrder,
  orderReferences,
  type QuickOrderContext,
  resolveOrderAcceptance,
} from "./orders.js";
import { canonicalJson, requestHash } from "./request-binding.js";

function fail(status: 404 | 409 | 422 = 409): never {
  throw new DraftFailure(status, {
    error: {
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 422
            ? "VALIDATION_FAILED"
            : "REQUEST_CONFLICT",
      message: "Review complete grouped intake",
    },
  });
}
const repository = (ctx: QuickOrderContext) => {
  if (!ctx.acceptance) fail();
  return ctx.acceptance.repository;
};
// All identity authorities before any publication/capacity locks, including drafts/replays.
export async function authorizeGroupIntake(
  ctx: QuickOrderContext,
  v: GroupIntakeDraft,
) {
  if (
    !ctx.customers.policy.enabled ||
    !ctx.customers.policy.synthetic ||
    !ctx.templates.synthetic
  )
    fail();
  const contacts = [
    ...new Set(
      [...v.lines.map((l) => l.intake.customerId), v.context.payerId]
        .filter((id): id is string => !!id)
        .map((id) => id.toLowerCase()),
    ),
  ].sort();
  for (const id of contacts) await ctx.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(
      v.lines
        .map((l) => l.intake.wearerId)
        .filter((id): id is string => !!id)
        .map((id) => id.toLowerCase()),
    ),
  ].sort())
    await ctx.wearers.repository.lockWearer(id);
  for (const l of v.lines) {
    const r = await orderReferences(ctx, l.intake);
    if (r.issues.some((i) => i === "guardian" || i === "servicePermission"))
      fail(404);
  }
  if (v.context.payerId) await readCustomer(ctx.customers, v.context.payerId);
}
function normalizedIntake(
  v: GroupIntakeDraft,
  order: QuickOrderDraft,
): QuickOrderDraft {
  return {
    ...order,
    ...(v.commercial.basis === "package-proposal"
      ? { priceState: "to-be-quoted" as const, priceText: "" }
      : {}),
    commitmentReview: null,
  };
}
async function resolve(ctx: QuickOrderContext, v: GroupIntakeDraft) {
  await authorizeGroupIntake(ctx, v);
  const repo = repository(ctx),
    a = ctx.acceptance;
  if (!a) fail();
  const c = a.commitments;
  await ctx.templates.catalogue.repository.lock();
  await ctx.templates.forms.repository.lock();
  await ctx.templates.repository.lock();
  await c.repository.lock();
  if (c.bindings) await c.bindings.lock();
  await c.calendar.lock();
  await a.policies.lock();
  await a.profile.lock();
  // Resolve all canonical categories under publication locks, then lock once in sorted order.
  const categories = new Set<string>();
  for (const l of v.lines) {
    const manifest = l.intake.manifest
      ? await ctx.templates.repository.read(l.intake.manifest.revisionId)
      : undefined;
    let parent = manifest?.definition.content.service;
    for (let depth = 0; parent && depth < 4; depth++) {
      const exact = await ctx.templates.catalogue.repository.definition(
        parent.revisionId,
      );
      if (!exact || exact.entryId !== parent.entryId) break;
      if (exact.content.kind === "category") {
        categories.add(exact.entryId);
        break;
      }
      parent = exact.content.parent;
    }
  }
  for (const category of [...categories].sort())
    await repo.lockCapacity(category);
  const clock = await repo.now();
  const pending: {
      id: string;
      categoryId: string;
      quantity: number;
      unit: string;
      deliveryDate: string;
    }[] = [],
    resolved: {
      id: string;
      resolved: Awaited<ReturnType<typeof resolveOrderAcceptance>>;
    }[] = [];
  for (const l of v.lines) {
    const r = await resolveOrderAcceptance(
      ctx,
      normalizedIntake(v, l.intake),
      pending,
      clock,
    );
    resolved.push({ id: l.id, resolved: r });
    const facts = r.review.evaluation?.facts;
    if (r.sources && facts?.unit && facts.candidate !== null)
      pending.push({
        id: l.id,
        categoryId: r.sources.categoryId,
        quantity: facts.candidate,
        unit: facts.unit,
        deliveryDate: l.intake.deliveryDate,
      });
  }
  const unknowns: string[] = [];
  if (v.lines.length < 2) unknowns.push("atLeastTwoGarments");
  const contact = v.lines[0]?.intake.customerId?.toLowerCase();
  if (
    !contact ||
    v.lines.some((l) => l.intake.customerId?.toLowerCase() !== contact)
  )
    unknowns.push("sameContactRequired");
  if (!v.reason.trim()) unknowns.push("reasonRequired");
  let packagePaise: string | null = null;
  if (
    v.commercial.basis === "package-proposal" &&
    v.commercial.packagePriceState === "quoted"
  ) {
    try {
      const amount = parseRupees(v.commercial.packagePriceText);
      if (amount === null) unknowns.push("packageAmountRequired");
      else packagePaise = String(amount);
    } catch {
      unknowns.push("invalidPackageAmount");
    }
  }
  // Validate reference prices even when they are explicitly included, never additive charges.
  for (const l of v.lines)
    if (l.intake.priceState === "quoted") {
      try {
        if (parseRupees(l.intake.priceText) === null)
          unknowns.push("referenceAmountRequired");
      } catch {
        unknowns.push("invalidReferenceAmount");
      }
    }
  const { review: _review, lines: _lines, ...facts } = v;
  const structures = resolved.map((l) =>
    l.resolved.review.intake.requirements
      ? projectOrderPieces({
          requirements: l.resolved.review.intake.requirements,
          snapshot: l.resolved.snapshot,
        })
      : null,
  );
  if (structures.some((s) => !s)) unknowns.push("pieceStructureUnsupported");
  const fingerprint = await requestHash({
    schemaVersion: 2,
    ...facts,
    lines: v.lines.map((l, i) => ({
      id: l.id,
      intake: { ...l.intake, commitmentReview: null },
      review: resolved[i]?.resolved.review.fingerprint,
    })),
    packagePaise,
    pieces: structures,
  });
  const review: GroupIntakeReview = {
    fingerprint,
    lines: resolved.map((l, i) => ({
      id: l.id,
      review: l.resolved.review,
      pieces: structures[i] ?? null,
    })),
    basis: v.commercial.basis,
    packagePaise,
    unknowns,
  };
  return { review, resolved };
}
export async function reviewGroupIntake(
  ctx: QuickOrderContext,
  input: unknown,
) {
  const value = groupIntakeDraftSchema.parse(input);
  if (canonicalJson(value).length > 65536) fail(422);
  return (await resolve(ctx, value)).review;
}
export function groupIntakeWorkflow(ctx: QuickOrderContext): DraftWorkflow {
  let prepared: Awaited<ReturnType<typeof resolve>> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: groupIntakeDraftSchema,
    commandSchema: groupIntakeCommandSchema,
    async authorizeDraft(input) {
      await authorizeGroupIntake(ctx, groupIntakeDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await authorizeGroupIntake(ctx, groupIntakeDraftSchema.parse(input));
    },
    async revalidate(input) {
      const v = groupIntakeCommandSchema.parse(input);
      prepared = await resolve(ctx, v);
      if (
        prepared.review.unknowns.some((i) =>
          [
            "invalidPackageAmount",
            "invalidReferenceAmount",
            "packageAmountRequired",
            "referenceAmountRequired",
          ].includes(i),
        ) ||
        prepared.resolved.some((l) =>
          l.resolved.review.intake.issues.some(
            (i) => i === "priceText" || i === "orderDate",
          ),
        )
      )
        fail(422);
      const d = v.review;
      if (
        !d?.acknowledged ||
        prepared.review.fingerprint !== d.fingerprint ||
        prepared.review.unknowns.length
      )
        fail();
      for (const { resolved: r } of prepared.resolved) {
        if (r.review.unknowns.length || !r.sources || !r.review.evaluation)
          fail();
        if (
          r.review.evaluation.warnings.some(
            (w) => w === "capacityExceeded" || w === "cutoffPassed",
          ) &&
          !d.exceptionReason.trim()
        )
          fail(422);
        if (
          d.waiveRush &&
          (!r.review.evaluation.facts.rush || !d.waiverReason.trim())
        )
          fail(422);
      }
    },
    async promote(input, _action, draftId, request) {
      if (!prepared) fail();
      const v = groupIntakeCommandSchema.parse(input),
        repo = repository(ctx),
        commercialId = await repo.groups.identity(),
        orders = [];
      const decision = v.review;
      if (!decision) fail();
      const scope: { lineId: string; orderId: string }[] = [];
      for (const [i, l] of v.lines.entries()) {
        const r = prepared.resolved[i]?.resolved;
        if (!r) fail();
        // The full group decision is bound by its fingerprint; each persisted line pins its evaluated facts.
        const intake = {
          ...normalizedIntake(v, l.intake),
          commitmentReview: { ...decision, fingerprint: r.review.fingerprint },
        };
        const referencePaise =
          l.intake.priceState === "quoted"
            ? parseRupees(l.intake.priceText)
            : null;
        orders.push(
          await acceptResolvedOrder(ctx, intake, r, draftId, request, {
            originLineId: l.id,
            ...(v.commercial.basis === "package-proposal"
              ? {
                  commercial: {
                    schemaVersion: 2 as const,
                    basis: "package-included" as const,
                    packageVersionId: commercialId,
                    groupDraftId: draftId,
                    lineId: l.id,
                    allocationPaise: null,
                    referencePaise,
                  },
                }
              : {}),
          }),
        );
        const order = orders.at(-1);
        if (!order) fail();
        scope.push({ lineId: l.id, orderId: order.id });
      }
      const sources = orders.map((o) => ({
        id: o.id,
        version: o.version,
        snapshotDigest: o.snapshotDigest,
      }));
      const revision = await repo.bookings.write({
        draft: {
          customerId: v.lines[0]?.intake.customerId ?? null,
          target: null,
          context: v.context,
          reason: v.reason,
          orders: sources,
          reviewFingerprint: prepared.review.fingerprint,
        },
        draftId,
        actorId: ctx.templates.actorId,
        ...request,
        sources,
      });
      await repo.groups.writeCommercial({
        id: commercialId,
        bookingId: revision.bookingId,
        draftId,
        basis: v.commercial.basis,
        packagePaise: prepared.review.packagePaise,
        scope,
        actorId: ctx.templates.actorId,
        reason: v.reason,
        ...request,
      });
      return { type: "booking.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "booking.revision" ||
        !(await repository(ctx).bookings.origin(result.id, draftId))
      )
        fail();
    },
  };
}
export function quickOrderConversion(
  ctx: QuickOrderContext,
  drafts: DraftRepository,
) {
  return {
    async convert(
      input: Record<string, unknown>,
      draftId: string,
      request: { key: string; requestId: string },
    ): Promise<DraftResult> {
      const repo = repository(ctx),
        id = await drafts.actionId(),
        lineId = await drafts.actionId(),
        now = (await drafts.now()).toISOString();
      const payload = groupIntakeDraftSchema.parse({
        ...emptyGroupIntake(),
        lines: [{ id: lineId, intake: { ...input, commitmentReview: null } }],
      });
      await authorizeGroupIntake(ctx, payload);
      const record: DraftRecord = {
        id,
        workflow: "order.group",
        schemaVersion: 1,
        creatorId: ctx.templates.actorId,
        lifecycle: "active",
        version: 1,
        payload,
        createdAt: now,
        updatedAt: now,
        stale: false,
        result: null,
      };
      await drafts.insert(record);
      await drafts.audit({
        id: await drafts.actionId(),
        actor: { type: "user", id: ctx.templates.actorId },
        action: "draft.convert.target",
        draftId: id,
        version: 1,
        lifecycle: "active",
        schemaVersion: 1,
        ...request,
      });
      await repo.groups.convert({
        sourceId: draftId,
        targetId: id,
        lineId,
        actorId: ctx.templates.actorId,
        ...request,
      });
      return { type: "order.group-draft", id };
    },
    async verify(result: DraftResult, draftId: string) {
      return (
        result.type === "order.group-draft" &&
        (await repository(ctx).groups.conversionOrigin(result.id, draftId))
      );
    },
  };
}
