import type { DraftRecord, DraftResult } from "@aarili/contracts/drafts";
import {
  groupIntakeDraftSchema,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import {
  emptyServiceOrder,
  type ServiceChangeContent,
  type ServiceIntakeDraft,
  serviceIntakeDraftSchema,
} from "@aarili/contracts/small-services";
import type { DraftRepository } from "@aarili/db/repositories/drafts";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  authorizeGroupIntake,
  groupIntakeWorkflow,
  resolveGroupIntake,
} from "./group-intake.js";
import {
  orderReferences,
  quickOrderDraftWorkflow,
  readAcceptedOrder,
  resolveOrderAcceptance,
} from "./orders.js";
import { requestHash } from "./request-binding.js";
import {
  lockServiceSources,
  resolveServiceSelection,
  type SmallServiceContext,
} from "./small-services.js";

function fail(status: 404 | 409 | 422 = 409): never {
  throw new DraftFailure(status, {
    error: {
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 422
            ? "VALIDATION_FAILED"
            : "REQUEST_CONFLICT",
      message: "Review all garments and selected services",
    },
  });
}
async function authorize(ctx: SmallServiceContext, v: ServiceIntakeDraft) {
  if (v.kind === "group")
    await authorizeGroupIntake(
      ctx.orders,
      groupIntakeDraftSchema.parse(v.base),
    );
  else {
    const r = await orderReferences(
      ctx.orders,
      quickOrderDraftSchema.parse(v.base),
    );
    if (r.issues.some((i) => i === "guardian" || i === "servicePermission"))
      fail(404);
  }
}
async function resolve(ctx: SmallServiceContext, v: ServiceIntakeDraft) {
  await authorize(ctx, v);
  await lockServiceSources(ctx);
  const custom =
    v.kind === "custom"
      ? await resolveOrderAcceptance(
          ctx.orders,
          quickOrderDraftSchema.parse(v.base),
        )
      : null;
  const group =
    v.kind === "group"
      ? await resolveGroupIntake(
          ctx.orders,
          groupIntakeDraftSchema.parse(v.base),
        )
      : null;
  const base = custom?.review ?? group?.review;
  if (!base) fail();
  const rows: {
    id: string | null;
    intake: ReturnType<typeof quickOrderDraftSchema.parse>;
    resolved: Awaited<ReturnType<typeof resolveOrderAcceptance>>;
  }[] = [];
  if (group) {
    const parsed = groupIntakeDraftSchema.parse(v.base);
    for (const l of group.resolved) {
      const source = parsed.lines.find((x) => x.id === l.id);
      if (!source) fail();
      rows.push({ id: l.id, intake: source.intake, resolved: l.resolved });
    }
  } else if (custom)
    rows.push({
      id: null,
      intake: quickOrderDraftSchema.parse(v.base),
      resolved: custom,
    });
  else fail();
  const pending = rows.flatMap((l) => {
    const f = l.resolved.review.evaluation?.facts,
      s = l.resolved.sources;
    return s && f?.unit && f.candidate !== null
      ? [
          {
            id: l.id ?? "custom",
            categoryId: s.categoryId,
            deliveryDate: l.intake.deliveryDate,
            quantity: f.candidate,
            unit: f.unit,
          },
        ]
      : [];
  });
  const issues: string[] = [
    ...(custom?.review.unknowns ?? group?.review.unknowns ?? []),
  ];
  if (
    !v.selections.length ||
    new Set(v.selections.map((s) => s.lineId)).size !== v.selections.length
  )
    issues.push("selectServiceScope");
  const lineIds = v.selections.flatMap((s) => s.lines.map((l) => l.id));
  if (new Set(lineIds).size !== lineIds.length)
    issues.push("serviceIdentityConflict");
  const selections = [];
  for (const selection of v.selections) {
    const subjectId = selection.lines[0]?.id;
    if (!subjectId) fail(422);
    const row = rows.find((l) => l.id === selection.lineId);
    if (!row) fail(422);
    if (!selection.reason.trim() || !selection.agreement.trim())
      issues.push("newAgreementRequired");
    const isPackage =
      group &&
      groupIntakeDraftSchema.parse(v.base).commercial.basis ===
        "package-proposal";
    if (
      selection.commercial !==
      (isPackage ? "outside-package" : "additional-charge")
    )
      issues.push("commercialBasis");
    // At intake, the base garment is the explicit covered demand. It has no accepted ID yet.
    if (
      selection.capacity.basis === "unresolved" ||
      !selection.capacity.reason.trim() ||
      selection.capacity.coveredBy !== null
    )
      issues.push("capacityBasis");
    const acceptance = ctx.orders.acceptance;
    if (!acceptance) fail();
    const overlay: SmallServiceContext = {
      ...ctx,
      orders: {
        ...ctx.orders,
        acceptance: {
          ...acceptance,
          repository: {
            ...acceptance.repository,
            async demand(category, start, end) {
              const existing = await acceptance.repository.demand(
                category,
                start,
                end,
              );
              return [
                ...existing,
                ...pending.filter(
                  (p) =>
                    p.categoryId === category &&
                    p.deliveryDate >= start &&
                    p.deliveryDate < end,
                ),
              ];
            },
          },
        },
      },
    };
    const {
      manifest: _manifest,
      priceState: _priceState,
      priceText: _priceText,
      ...garmentFacts
    } = row.intake;
    const intake = {
      ...emptyServiceOrder(subjectId),
      ...garmentFacts,
      subjectId,
      subjectDescription: "Selected service on this new garment",
      profile: selection.profile,
      lines: selection.lines,
      sourceOrderId: null,
      sourcePieceId: null,
      commitmentReview: null,
    };
    const r = await resolveServiceSelection(
      overlay,
      intake,
      selection.capacity.basis === "already-covered",
    );
    if (
      r.shared.sources?.categoryId !== row.resolved.sources?.categoryId ||
      r.review.unit !== row.resolved.review.evaluation?.facts.unit
    )
      issues.push("capacityCategoryChanged");
    issues.push(...r.review.issues);
    if (
      r.shared.sources &&
      r.review.quantity !== null &&
      r.review.unit &&
      r.review.quantity > 0
    )
      pending.push({
        id: subjectId,
        categoryId: r.shared.sources.categoryId,
        deliveryDate: row.intake.deliveryDate,
        quantity: r.review.quantity,
        unit: r.review.unit,
      });
    selections.push({ selection, row, resolved: r });
  }
  const { review: _review, ...facts } = v;
  const fingerprint = await requestHash({
    facts,
    base: base.fingerprint,
    selections: selections.map((s) => s.resolved.review.fingerprint),
    issues,
  });
  return {
    rows,
    custom,
    group,
    selections,
    review: {
      fingerprint,
      base,
      selections: selections.map((s) => s.resolved.review),
      issues: [...new Set(issues)],
    },
  };
}
export async function reviewServiceIntake(
  ctx: SmallServiceContext,
  input: unknown,
) {
  const v = serviceIntakeDraftSchema.safeParse(input);
  if (!v.success) fail(422);
  return (await resolve(ctx, v.data)).review;
}
export function serviceIntakeWorkflow(ctx: SmallServiceContext): DraftWorkflow {
  let prepared: Awaited<ReturnType<typeof resolve>> | undefined;
  let baseWorkflow: DraftWorkflow | undefined;
  let baseCommand: Record<string, unknown> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: serviceIntakeDraftSchema,
    commandSchema: serviceIntakeDraftSchema,
    async authorizeDraft(input) {
      await authorize(ctx, serviceIntakeDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await authorize(ctx, serviceIntakeDraftSchema.parse(input));
    },
    async revalidate(input, draftId) {
      const v = serviceIntakeDraftSchema.parse(input);
      prepared = await resolve(ctx, v);
      const r = prepared.review,
        d = v.review;
      if (
        !d?.acknowledged ||
        d.fingerprint !== r.fingerprint ||
        r.issues.length ||
        d.waiveRush
      )
        fail();
      const warnings = prepared.selections.flatMap(
        (s) => s.resolved.review.commitment?.evaluation?.warnings ?? [],
      );
      if (
        warnings.some(
          (w) => w === "capacityExceeded" || w === "cutoffPassed",
        ) &&
        !d.exceptionReason.trim()
      )
        fail(422);
      baseWorkflow =
        v.kind === "custom"
          ? quickOrderDraftWorkflow(ctx.orders)
          : groupIntakeWorkflow(ctx.orders);
      const baseFingerprint =
        prepared.custom?.review.fingerprint ??
        prepared.group?.review.fingerprint;
      if (!baseFingerprint) fail();
      baseCommand =
        v.kind === "custom"
          ? {
              ...quickOrderDraftSchema.parse(v.base),
              commitmentReview: {
                ...d,
                fingerprint: baseFingerprint,
              },
            }
          : {
              ...groupIntakeDraftSchema.parse(v.base),
              review: { ...d, fingerprint: baseFingerprint },
            };
      await baseWorkflow.revalidate(baseCommand, draftId);
    },
    async promote(input, action, draftId, request) {
      if (!prepared || !baseWorkflow || !baseCommand) fail();
      const v = serviceIntakeDraftSchema.parse(input),
        accepted = await baseWorkflow.promote(
          baseCommand,
          action,
          draftId,
          request,
        );
      const repo = ctx.orders.acceptance?.repository;
      if (!repo) fail();
      const booking =
        v.kind === "group"
          ? await repo.bookings.read(accepted.id, true)
          : undefined;
      for (const chosen of prepared.selections) {
        const target =
          v.kind === "custom"
            ? accepted.id
            : await ctx.repository.intakeOrder(
                draftId,
                chosen.selection.lineId,
              );
        if (!target) fail();
        const order = await readAcceptedOrder(ctx.orders, target),
          s = chosen.resolved,
          p = s.profile,
          source = s.shared.sources,
          requirements = s.shared.review.intake.requirements;
        if (
          !p ||
          !source ||
          !requirements ||
          !s.review.unit ||
          s.review.quantity === null ||
          !v.review
        )
          fail();
        const prior = await requestHash({
          original: order.snapshotDigest,
          changes: [],
        });
        const changeInput = {
          ...chosen.selection,
          orderId: order.id,
          version: order.version,
          originalDigest: order.snapshotDigest,
          scopeDigest: prior,
          pieceId: null,
          capacity: {
            ...chosen.selection.capacity,
            coveredBy:
              chosen.selection.capacity.basis === "already-covered"
                ? order.id
                : null,
          },
          review: v.review,
        };
        const { lineId: _line, ...inputChange } = changeInput;
        const commercial = booking
          ? await repo.groups.commercial(booking.id)
          : undefined;
        const content: ServiceChangeContent = {
          input: inputChange,
          profile: p,
          lines: s.review.lines,
          requirements,
          originalDigest: order.snapshotDigest,
          previousScopeDigest: prior,
          originalPromise: order.currentPromise,
          membershipId: booking?.id ?? null,
          membershipVersion: booking?.version ?? null,
          membershipRevisionId: booking?.revision.id ?? null,
          commercialDigest: commercial ? await requestHash(commercial) : null,
          categoryId: source.categoryId,
          unit: s.review.unit,
          quantity: s.review.quantity,
          totalPaise: s.review.totalPaise,
          fingerprint: v.review.fingerprint,
        };
        await ctx.repository.change({
          orderId: order.id,
          version: order.version,
          draftId,
          actorId: ctx.orders.templates.actorId,
          ...request,
          content,
          digest: await requestHash(content),
        });
      }
      return accepted;
    },
    async verifyResult(result, draftId) {
      const r = ctx.orders.acceptance?.repository;
      if (!r) fail();
      if (result.type === "order.accepted") {
        if (!(await r.origin(result.id, draftId))) fail();
        await readAcceptedOrder(ctx.orders, result.id);
      } else if (result.type === "booking.revision") {
        if (!(await r.bookings.origin(result.id, draftId))) fail();
      } else fail();
    },
  };
}
export function serviceIntakeConversion(
  ctx: SmallServiceContext,
  drafts: DraftRepository,
  kind: "custom" | "group",
) {
  return {
    async convert(
      input: Record<string, unknown>,
      sourceId: string,
      request: { key: string; requestId: string },
    ): Promise<DraftResult> {
      const raw =
        kind === "custom"
          ? quickOrderDraftSchema.parse(input)
          : groupIntakeDraftSchema.parse(input);
      const base =
        kind === "custom"
          ? { ...raw, commitmentReview: null }
          : {
              ...groupIntakeDraftSchema.parse(raw),
              review: null,
              lines: groupIntakeDraftSchema.parse(raw).lines.map((l) => ({
                ...l,
                intake: { ...l.intake, commitmentReview: null },
              })),
            };
      const payload = serviceIntakeDraftSchema.parse({
        kind,
        base,
        selections: [],
        review: null,
      });
      await authorize(ctx, payload);
      const id = await drafts.actionId(),
        now = (await drafts.now()).toISOString();
      const record: DraftRecord = {
        id,
        workflow: "order.services-intake",
        schemaVersion: 1,
        creatorId: ctx.orders.templates.actorId,
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
        actor: { type: "user", id: ctx.orders.templates.actorId },
        action: "draft.convert.target",
        draftId: id,
        version: 1,
        lifecycle: "active",
        schemaVersion: 1,
        ...request,
      });
      await ctx.repository.conversion({
        sourceId,
        targetId: id,
        actorId: ctx.orders.templates.actorId,
        ...request,
      });
      return { type: "order.services-intake-draft", id };
    },
    async verify(result: DraftResult, sourceId: string) {
      return (
        result.type === "order.services-intake-draft" &&
        (await ctx.repository.converted(result.id, sourceId))
      );
    },
  };
}
