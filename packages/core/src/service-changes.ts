import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  bookingDraftSchema,
  groupIntakeDraftSchema,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import {
  emptyServiceOrder,
  type ServiceChangeContent,
  type ServiceChangeDraft,
  type ServiceScope,
  serviceChangeDraftSchema,
  serviceIntakeDraftSchema,
} from "@aarili/contracts/small-services";
import type { DesignReferencesRepository } from "@aarili/db/repositories/design-references";
import type { DesignSpecificationsRepository } from "@aarili/db/repositories/design-specifications";
import { readBooking } from "./bookings.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import { requestHash } from "./request-binding.js";
import {
  resolveServiceSelection,
  type SmallServiceContext,
} from "./small-services.js";

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
      message: "Review the exact added service scope",
    },
  });
}
function orders(ctx: SmallServiceContext) {
  const a = ctx.orders.acceptance;
  if (!a) fail();
  return a.repository;
}
// A mixed recovery page must acquire aggregate classes before any workflow takes
// identity locks. Authorizing each row in page order can invert order/customer
// locks against a simultaneous scope read or mutation.
export async function prepareServiceDraftReads(
  ctx: SmallServiceContext,
  records: Pick<DraftRecord, "workflow" | "payload">[],
  designs?: DesignSpecificationsRepository,
  references?: DesignReferencesRepository,
) {
  if (
    references &&
    records.some(
      (r) =>
        r.workflow === "design.specification" ||
        r.workflow === "design.reference",
    )
  )
    await references.lockSubject("");
  const repo = orders(ctx),
    orderIds = new Set<string>(),
    bookingIds = new Set<string>(),
    customers = new Set<string>(),
    wearers = new Set<string>();
  const addIntake = (v: {
    customerId: string | null;
    wearerId: string | null;
  }) => {
    if (v.customerId) customers.add(v.customerId);
    if (v.wearerId) wearers.add(v.wearerId);
  };
  for (const record of records) {
    const p = record.payload;
    if (
      record.workflow === "design.specification" ||
      record.workflow === "design.reference"
    ) {
      if (typeof p.orderId === "string") orderIds.add(p.orderId);
      if (references && typeof p.orderId === "string")
        for (const id of await references.referenceOrderIds(
          p.orderId,
          typeof p.pieceId === "string" ? p.pieceId : null,
        ))
          orderIds.add(id);
      if (references && Array.isArray(p.referenceItems))
        for (const item of p.referenceItems) {
          if (item && typeof item.assetId === "string") {
            const s = await references.subjectForAsset(item.assetId);
            if (s?.orderId) {
              orderIds.add(s.orderId);
              for (const id of await references.referenceOrderIds(
                s.orderId,
                s.pieceId,
              ))
                orderIds.add(id);
            }
          }
        }
      const reuse = p.reuse as { versionId?: string } | null;
      if (reuse?.versionId && designs) {
        const source = await designs.read(reuse.versionId);
        if (source) {
          orderIds.add(source.orderId);
          if (references)
            for (const id of await references.referenceOrderIds(
              source.orderId,
              source.pieceId,
            ))
              orderIds.add(id);
        }
      }
    }
    if (
      record.workflow === "order.repeat" ||
      record.workflow === "order.repeat-service"
    ) {
      const ref = p.repeat;
      if (
        ref &&
        typeof ref === "object" &&
        "sourceId" in ref &&
        typeof ref.sourceId === "string"
      )
        orderIds.add(ref.sourceId);
      if (typeof p.customerId === "string") customers.add(p.customerId);
      if (typeof p.wearerId === "string") wearers.add(p.wearerId);
    }
    if (record.workflow === "order.service-change") {
      const v = serviceChangeDraftSchema.parse(p);
      orderIds.add(v.orderId);
    }
    if (record.workflow === "order.service") {
      if (typeof p.sourceOrderId === "string") orderIds.add(p.sourceOrderId);
      if (typeof p.customerId === "string") customers.add(p.customerId);
      if (typeof p.wearerId === "string") wearers.add(p.wearerId);
    }
    if (record.workflow === "order.quick") {
      const v = quickOrderDraftSchema.safeParse(p);
      if (v.success) addIntake(v.data);
    }
    if (record.workflow === "order.group") {
      const v = groupIntakeDraftSchema.safeParse(p);
      if (v.success) {
        for (const l of v.data.lines) addIntake(l.intake);
        if (v.data.context.payerId) customers.add(v.data.context.payerId);
      }
    }
    if (record.workflow === "order.services-intake") {
      const v = serviceIntakeDraftSchema.safeParse(p);
      if (v.success) {
        if (v.data.kind === "custom")
          addIntake(quickOrderDraftSchema.parse(v.data.base));
        else {
          const g = groupIntakeDraftSchema.parse(v.data.base);
          for (const l of g.lines) addIntake(l.intake);
          if (g.context.payerId) customers.add(g.context.payerId);
        }
      }
    }
    if (record.workflow === "booking.group") {
      const v = bookingDraftSchema.safeParse(p);
      if (v.success) {
        for (const o of v.data.orders) orderIds.add(o.id);
        if (v.data.target) bookingIds.add(v.data.target.id);
        if (v.data.customerId) customers.add(v.data.customerId);
        if (v.data.context.payerId) customers.add(v.data.context.payerId);
      }
    }
  }
  // Service repeats can point to another service. Collect the immutable ancestor
  // chain before taking any booking/order/identity locks, including mixed lists.
  for (const id of orderIds) {
    const service = await ctx.repository.readOrder(id);
    if (service?.intake.sourceOrderId)
      orderIds.add(service.intake.sourceOrderId);
  }
  const memberships = new Map<string, string | undefined>();
  for (const id of [...orderIds].sort()) {
    const membership = await repo.bookings.membership(id);
    memberships.set(id, membership);
    if (membership) bookingIds.add(membership);
  }
  for (const id of [...bookingIds].sort()) await repo.bookings.lock(id);
  for (const id of bookingIds) {
    const b = await repo.bookings.read(id);
    for (const o of b?.revision.sources ?? []) orderIds.add(o.id);
  }
  for (const id of [...orderIds].sort()) await repo.lockOrder(id);
  for (const [id, member] of memberships)
    if ((await repo.bookings.membership(id)) !== member) fail();
  for (const id of orderIds) {
    const o = await repo.read(id);
    if (o) addIntake(o.intake);
    else {
      const s = await ctx.repository.readOrder(id);
      if (s) addIntake(s.intake);
    }
  }
  for (const id of [...customers].sort())
    await ctx.orders.wearers.repository.lockCustomer(id);
  for (const id of [...wearers].sort())
    await ctx.orders.wearers.repository.lockWearer(id);
}
// Membership changes lock booking -> sorted orders. Recheck the observed membership
// after taking the aggregate lock so a concurrent first membership cannot slip in.
async function authority(ctx: SmallServiceContext, id: string) {
  const r = orders(ctx),
    member = await r.bookings.membership(id);
  if (member) await r.bookings.lock(member);
  await r.lockOrder(id);
  if ((await r.bookings.membership(id)) !== member) fail();
  const order = await readAcceptedOrder(ctx.orders, id);
  await readOrderPieces(ctx.orders, id);
  const commercial = member ? await r.groups.commercial(member) : undefined;
  const booking = member ? await r.bookings.read(member) : undefined;
  return { order, member: member ?? null, commercial, booking };
}
function exactSum(values: (number | string | null)[]) {
  if (values.some((v) => v === null)) return null;
  const sum = values.reduce<bigint>((n, v) => n + BigInt(v ?? 0), 0n);
  return sum.toString();
}
async function scope(
  ctx: SmallServiceContext,
  order: Awaited<ReturnType<typeof readAcceptedOrder>>,
  isPackage: boolean,
): Promise<ServiceScope> {
  const changes = await ctx.repository.changes(order.id);
  const additionsPaise = exactSum(changes.map((c) => c.content.totalPaise));
  const originalPaise = order.pricePaise;
  return {
    orderId: order.id,
    version: order.version,
    originalDigest: order.snapshotDigest,
    scopeDigest: await requestHash({
      original: order.snapshotDigest,
      changes: changes.map((c) => ({
        id: c.id,
        digest: c.digest,
        version: c.version,
      })),
    }),
    originalPaise,
    additionsPaise,
    totalPaise: isPackage ? null : exactSum([originalPaise, additionsPaise]),
    package: isPackage,
    changes,
  };
}
export async function readServiceScope(ctx: SmallServiceContext, id: string) {
  const a = await authority(ctx, id);
  return scope(
    ctx,
    a.order,
    a.commercial?.basis === "package-proposal" || !!a.order.commercial,
  );
}
export async function readBookingServiceScope(
  ctx: SmallServiceContext,
  id: string,
) {
  const repo = orders(ctx);
  await repo.bookings.lock(id);
  const record = await repo.bookings.read(id);
  if (!record) fail(404);
  for (const orderId of record.revision.sources.map((s) => s.id).sort())
    await repo.lockOrder(orderId);
  const detail = await readBooking(ctx.orders, id),
    changes = [];
  for (const order of detail.orders)
    changes.push(...(await ctx.repository.changes(order.id)));
  const lines = changes
    .flatMap((c) => c.content.lines)
    .filter((l) => l.state !== "not-required");
  const originalKnown =
    detail.summary.basis === "garment-prices"
      ? BigInt(detail.summary.knownSubtotalPaise)
      : BigInt(detail.summary.packagePaise ?? "0");
  const originalUnknownCount =
    detail.summary.basis === "garment-prices"
      ? detail.summary.unknownCount
      : detail.summary.packagePaise === null
        ? 1
        : 0;
  const extraKnown = lines.reduce((n, l) => n + BigInt(l.pricePaise ?? 0), 0n),
    extraUnknownCount = lines.filter((l) => l.pricePaise === null).length;
  return {
    bookingId: detail.booking.id,
    bookingVersion: detail.booking.version,
    scopeDigest: await requestHash({
      booking: detail.booking.revision,
      commercial: detail.commercial,
      changes: changes.map((c) => ({ id: c.id, digest: c.digest })),
    }),
    basis: detail.summary.basis,
    hasChanges: changes.length > 0,
    originalKnownPaise: originalKnown.toString(),
    originalUnknownCount,
    extraKnownPaise: extraKnown.toString(),
    extraUnknownCount,
    currentKnownPaise: (originalKnown + extraKnown).toString(),
    currentUnknownCount: originalUnknownCount + extraUnknownCount,
  };
}
async function resolve(ctx: SmallServiceContext, v: ServiceChangeDraft) {
  const a = await authority(ctx, v.orderId),
    o = a.order;
  const s = await scope(
    ctx,
    o,
    a.commercial?.basis === "package-proposal" || !!o.commercial,
  );
  const issues: string[] = [];
  if (
    o.version !== v.version ||
    o.snapshotDigest !== v.originalDigest ||
    s.scopeDigest !== v.scopeDigest
  )
    fail(412);
  if (v.pieceId) {
    const pieces = await readOrderPieces(ctx.orders, o.id);
    if (!pieces.identities.some((p) => p.id === v.pieceId)) fail(404);
  }
  if (!v.reason.trim() || !v.agreement.trim())
    issues.push("newAgreementRequired");
  if (v.commercial !== (s.package ? "outside-package" : "additional-charge"))
    issues.push("commercialBasis");
  if (v.capacity.basis === "unresolved" || !v.capacity.reason.trim())
    issues.push("capacityBasis");
  if (v.capacity.basis === "already-covered" && v.capacity.coveredBy !== o.id)
    issues.push("coveredDemand");
  if (v.capacity.basis === "incremental" && v.capacity.coveredBy !== null)
    issues.push("coveredDemand");
  if (
    v.profile &&
    (await ctx.repository.duplicateChange(
      o.id,
      v.pieceId,
      v.profile.entryId,
      v.lines.map((l) => l.key),
      v.lines.map((l) => l.id),
    ))
  )
    issues.push("duplicateServiceSource");
  const intake = {
    ...emptyServiceOrder(v.lines[0]?.id ?? o.id),
    customerId: o.intake.customerId,
    wearerId: o.intake.wearerId,
    profile: v.profile,
    subjectDescription: "Added work on accepted garment",
    propertyReference: "",
    intakeContext: v.reason,
    sourceOrderId: o.id,
    sourcePieceId: v.pieceId,
    lines: v.lines,
    deliveryDate: o.currentPromise.date,
    deliveryTime: o.currentPromise.time,
    requestedDate: o.intake.requestedDate,
    eventDate: o.intake.eventDate,
    occasion: o.intake.occasion,
    orderDate: o.intake.orderDate,
    historicalReason: o.intake.historicalReason,
    priority: o.intake.priority,
    instructions: v.agreement,
    presentation: o.presentation,
    presentationRevisionId: o.intake.presentationRevisionId,
    commitmentReview: null,
  };
  const selected = await resolveServiceSelection(
    ctx,
    intake,
    v.capacity.basis === "already-covered",
  );
  const original = o.snapshot as { sources?: { categoryId?: string } };
  // The frozen category is obtained from original acceptance review, never a label.
  const originalCategory = original.sources?.categoryId;
  if (
    selected.shared.sources?.categoryId !== originalCategory ||
    selected.review.unit !== o.review.evaluation?.facts.unit
  )
    issues.push("capacityCategoryChanged");
  issues.push(...selected.review.issues);
  const { review: _decision, ...facts } = v;
  const fingerprint = await requestHash({
    facts,
    scope: s.scopeDigest,
    version: o.version,
    membership: a.member,
    membershipRevision: a.booking?.revision.id ?? null,
    membershipVersion: a.booking?.version ?? null,
    commercial: a.commercial ?? null,
    selection: selected.review.fingerprint,
    issues,
  });
  return {
    a,
    scope: s,
    selected,
    review: {
      fingerprint,
      scope: s,
      selection: selected.review,
      issues: [...new Set(issues)],
    },
  };
}
export async function reviewServiceChange(
  ctx: SmallServiceContext,
  input: unknown,
) {
  const v = serviceChangeDraftSchema.safeParse(input);
  if (!v.success) fail(422);
  return (await resolve(ctx, v.data)).review;
}
export function serviceChangeDraftWorkflow(
  ctx: SmallServiceContext,
): DraftWorkflow {
  let resolved: Awaited<ReturnType<typeof resolve>> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: serviceChangeDraftSchema,
    commandSchema: serviceChangeDraftSchema,
    validateEdit(previous, next) {
      if (
        previous.orderId !== next.orderId ||
        previous.originalDigest !== next.originalDigest
      )
        fail();
    },
    async authorizeDraft(input) {
      const v = serviceChangeDraftSchema.parse(input);
      await authority(ctx, v.orderId);
    },
    async authorizePublication(input) {
      const v = serviceChangeDraftSchema.parse(input);
      await authority(ctx, v.orderId);
    },
    async revalidate(input) {
      const v = serviceChangeDraftSchema.parse(input);
      resolved = await resolve(ctx, v);
      const r = resolved.review,
        d = v.review;
      if (
        !d?.acknowledged ||
        d.fingerprint !== r.fingerprint ||
        r.issues.length
      )
        fail();
      if (
        r.selection.commitment?.evaluation?.warnings.some(
          (w) => w === "capacityExceeded" || w === "cutoffPassed",
        ) &&
        !d.exceptionReason.trim()
      )
        fail(422);
      if (d.waiveRush) fail(422);
    },
    async promote(input, _action, draftId, request) {
      const r = resolved;
      if (
        !r?.selected.profile ||
        !r.selected.shared.sources ||
        !r.selected.shared.review.intake.requirements ||
        !r.review.selection.unit ||
        r.review.selection.quantity === null
      )
        fail();
      const v = serviceChangeDraftSchema.parse(input),
        selection = r.review.selection;
      const { unit, quantity } = selection;
      if (!unit || quantity === null) fail();
      const content: ServiceChangeContent = {
        input: v,
        profile: r.selected.profile,
        lines: selection.lines,
        requirements: r.selected.shared.review.intake.requirements,
        originalDigest: v.originalDigest,
        previousScopeDigest: v.scopeDigest,
        originalPromise: r.a.order.currentPromise,
        membershipId: r.a.member,
        membershipVersion: r.a.booking?.version ?? null,
        membershipRevisionId: r.a.booking?.revision.id ?? null,
        commercialDigest: r.a.commercial
          ? await requestHash(r.a.commercial)
          : null,
        categoryId: r.selected.shared.sources.categoryId,
        unit,
        quantity,
        totalPaise: selection.totalPaise,
        fingerprint: r.review.fingerprint,
      };
      const c = await ctx.repository.change({
        orderId: v.orderId,
        version: v.version,
        draftId,
        actorId: ctx.orders.templates.actorId,
        ...request,
        content,
        digest: await requestHash(content),
      });
      return { type: "order.service-change", id: c.id };
    },
    async verifyResult(result, draftId) {
      const c = await ctx.repository.changeOrigin(result.id, draftId);
      if (result.type !== "order.service-change" || !c) fail();
      await authority(ctx, c.orderId);
    },
  };
}
