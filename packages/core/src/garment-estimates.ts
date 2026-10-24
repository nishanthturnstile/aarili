import {
  type CustomerEstimate,
  customerEstimateSchema,
  type EstimateDraft,
  type EstimateReview,
  type EstimateSource,
  estimateCommandSchema,
  estimateDraftSchema,
} from "@aarili/contracts/garment-estimates";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { localDateValid } from "@aarili/contracts/shop-calendar";
import type { GarmentEstimatesRepository } from "@aarili/db/repositories/garment-estimates";
import {
  checkedAdd,
  checkedMultiplyDivide,
  checkedSubtract,
  parseRupees,
} from "@aarili/money";
import type { DesignSpecificationsContext } from "./design-specifications.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  orderReferences,
  readAcceptedOrder,
  readOrderPieces,
} from "./orders.js";
import { type QuotationRatesContext, resolveRate } from "./quotation-rates.js";
import { requestHash } from "./request-binding.js";
import {
  prepareServiceDraftReads,
  readServiceRepeatSource,
  type SmallServiceContext,
} from "./small-services.js";

export type GarmentEstimatesContext = {
  actorId: string;
  repository: GarmentEstimatesRepository;
  rates: QuotationRatesContext;
  services: SmallServiceContext;
  specifications: DesignSpecificationsContext;
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
      message: "Review the estimate and its current sources",
    },
  });
}

export async function estimateSource(
  ctx: GarmentEstimatesContext,
  v: EstimateDraft,
): Promise<EstimateSource> {
  const t = v.target,
    orders = ctx.services.orders.acceptance?.repository;
  if (!orders || (t.pieceId && !t.orderId) || (t.wearerId && !t.customerId))
    fail(422);
  let source: Omit<EstimateSource, "fingerprint">;
  if (t.orderId) {
    const native = await readServiceRepeatSource(ctx.services, t.orderId);
    if (t.pieceId && !native.pieces.some((p) => p.id === t.pieceId)) fail(404);
    if (t.pieceId) {
      const pieces = await readOrderPieces(ctx.services.orders, t.orderId),
        identity = pieces.identities.find((p) => p.id === t.pieceId);
      if (
        !identity ||
        pieces.structure?.pieces.find((p) => p.key === identity.key)
          ?.applicability !== "applicable"
      )
        fail(404);
    }
    if (
      t.customerId !== native.customer?.id ||
      t.wearerId !== (native.wearer?.id ?? null)
    )
      fail(404);
    const member = await orders.bookings.membership(t.orderId),
      booking = member ? await orders.bookings.read(member) : undefined;
    const commercial = member
      ? await orders.groups.commercial(member)
      : undefined;
    const specification =
      native.kind === "custom"
        ? await ctx.specifications.repository.state(t.orderId, t.pieceId)
        : undefined;
    const custom =
      native.kind === "custom"
        ? await readAcceptedOrder(ctx.services.orders, t.orderId)
        : undefined;
    const refs = await orderReferences(ctx.services.orders, {
      ...emptyQuickOrder(),
      customerId: t.customerId,
      wearerId: t.wearerId,
    });
    if (
      t.wearerId &&
      refs.issues.some((i) => i === "guardian" || i === "servicePermission")
    )
      fail(404);
    source = {
      ...t,
      kind: native.kind,
      code: native.code,
      acceptedDigest: native.snapshotDigest,
      aggregateVersion: native.version,
      scopeDigest: native.scopeDigest,
      specificationId: specification?.currentId ?? null,
      specificationVersion: specification?.version ?? null,
      bookingId: member ?? null,
      bookingVersion: booking?.version ?? null,
      commercialId: commercial?.id ?? null,
      serviceSubjectId: native.subjectId,
      acceptedPaise: custom?.pricePaise ?? null,
      packageIncluded:
        !!custom?.commercial || commercial?.basis === "package-proposal",
      candidates: [
        ...(native.kind === "custom"
          ? [
              {
                key: "garment",
                labelEn: native.subjectDescription,
                labelTa: native.subjectDescription,
                pieceId: null,
                lineId: null,
              },
            ]
          : []),
        ...native.candidates.map((c) => ({
          key: c.key,
          labelEn: c.labelEn,
          labelTa: c.labelTa,
          pieceId: c.pieceId,
          lineId: c.lineId,
        })),
      ],
    };
  } else {
    const refs = await orderReferences(ctx.services.orders, {
      ...emptyQuickOrder(),
      customerId: t.customerId,
      wearerId: t.wearerId,
    });
    if (
      t.wearerId &&
      refs.issues.some((i) => i === "guardian" || i === "servicePermission")
    )
      fail(404);
    source = {
      ...t,
      kind: "draft",
      code: null,
      acceptedDigest: null,
      aggregateVersion: null,
      scopeDigest: null,
      specificationId: null,
      specificationVersion: null,
      bookingId: null,
      bookingVersion: null,
      commercialId: null,
      serviceSubjectId: null,
      acceptedPaise: null,
      packageIncluded: false,
      candidates: [],
    };
  }
  return { ...source, fingerprint: await requestHash(source) };
}

function integer(raw: string, positive = false): number | null {
  if (!raw.trim()) return null;
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    (positive && Number(raw) === 0)
  )
    throw Error("integer");
  return Number(raw);
}
function price(raw: string) {
  if (raw.trim() && !/^\d+(\.\d{1,2})?$/.test(raw.trim())) throw Error("price");
  return parseRupees(raw);
}
export function calculateEstimate(v: EstimateDraft) {
  const invalid: string[] = [],
    blockers: string[] = [],
    ids = new Set<string>(),
    keys = new Set<string>();
  let subtotal = 0,
    unknownCount = 0;
  const lines: CustomerEstimate["lines"] = v.lines.map((l, i) => {
    const issues: string[] = [];
    let quantity: number | null = null,
      basisQuantity: number | null = null,
      ratePaise: number | null = null,
      amountPaise: number | null = null;
    if (ids.has(l.id)) {
      invalid.push("duplicate-line");
      issues.push("duplicate-line");
    }
    ids.add(l.id);
    if (l.sourceKey) {
      const key = `${l.sourceKey}:${l.component}`;
      if (keys.has(key)) {
        invalid.push("duplicate-source");
        issues.push("duplicate-source");
      }
      keys.add(key);
    }
    try {
      quantity = integer(l.quantityText);
      basisQuantity = integer(l.basisText, true);
      ratePaise = price(l.rateText);
      if (l.unit === "item" && basisQuantity !== null && basisQuantity !== 1)
        throw Error("basis");
      if (l.state === "charge")
        amountPaise =
          l.mode === "fixed"
            ? price(l.fixedText)
            : quantity === null || ratePaise === null || basisQuantity === null
              ? null
              : checkedMultiplyDivide(ratePaise, quantity, basisQuantity);
      if (l.state === "charge" && quantity === null) amountPaise = null;
      if (l.state === "complimentary") {
        amountPaise = 0;
        if (!l.reason.trim()) throw Error("reason");
      }
      if (l.state === "excluded" && !l.reason.trim()) throw Error("reason");
      if (l.state === "included") {
        const cover = v.lines.find((x) => x.id === l.coveringLineId);
        if (!cover || cover.id === l.id || cover.state !== "charge")
          throw Error("cover");
      }
      if (["fabric", "lining", "trims"].includes(l.component)) {
        if (
          l.material === "customer" &&
          !["unknown", "excluded"].includes(l.state)
        )
          throw Error("customer-material");
        if (l.material === "none" || l.material === "unknown")
          issues.push("material-source-unknown");
      }
      if (l.state === "charge" && amountPaise === 0 && !l.reason.trim())
        throw Error("zero-reason");
      if (l.mode === "fixed" && l.state === "charge" && !l.reason.trim())
        throw Error("override-reason");
    } catch {
      issues.push("invalid-price-quantity-or-provenance");
      invalid.push(l.id);
      amountPaise = null;
    }
    if (!["unknown", "excluded"].includes(l.state) && quantity === null)
      issues.push("unknown-quantity");
    if (l.state === "unknown" || (l.state === "charge" && amountPaise === null))
      issues.push("unknown-price");
    if (issues.length) {
      unknownCount++;
      blockers.push(...issues.map((s) => `${l.id}:${s}`));
    }
    if (amountPaise !== null && !issues.length) {
      try {
        subtotal = checkedAdd(subtotal, amountPaise);
      } catch {
        invalid.push("subtotal-overflow");
      }
    }
    return {
      id: l.id,
      sequence: i + 1,
      subjectId: l.subjectId,
      sourceKey: l.sourceKey,
      labelEn: l.labelEn,
      labelTa: l.labelTa,
      component: l.component,
      material: l.material,
      state: l.state,
      quantity,
      unit: l.unit,
      basisQuantity,
      ratePaise,
      amountPaise,
      coveringLineId: l.coveringLineId,
      assumptions: l.assumptions,
      reason: l.reason,
      issues,
    };
  });
  if (!lines.length) {
    unknownCount++;
    blockers.push("empty-estimate");
  }
  const priceComplete = unknownCount === 0 && invalid.length === 0;
  const sellingErrors = invalid.length;
  const costs = v.lines.map((l) => {
    const c = v.privateCosts.find((x) => x.lineId === l.id);
    let amountPaise: number | null = null;
    try {
      amountPaise = price(c?.amountText ?? "");
      if (amountPaise !== null && !c?.reason.trim()) throw Error("cost-reason");
    } catch {
      invalid.push(`cost:${l.id}`);
    }
    return { lineId: l.id, amountPaise, reason: c?.reason ?? "" };
  });
  let costSubtotalPaise = 0;
  for (const c of costs)
    try {
      costSubtotalPaise = checkedAdd(costSubtotalPaise, c.amountPaise ?? 0);
    } catch {
      invalid.push("cost-overflow");
    }
  const unknownCostCount = costs.filter((c) => c.amountPaise === null).length;
  const complete = priceComplete;
  return {
    customer: customerEstimateSchema.parse({
      kind: "estimate-not-issued",
      estimateId: v.estimateId,
      pricingDate: v.pricingDate,
      lines,
      knownSubtotalPaise: subtotal,
      unknownCount,
      complete,
      totalPaise: complete ? subtotal : null,
      assumptions: v.assumptions,
    }),
    costs,
    costSubtotalPaise,
    unknownCostCount,
    estimatedMarginPaise:
      complete && unknownCostCount === 0 && invalid.length === sellingErrors
        ? checkedSubtract(subtotal, costSubtotalPaise)
        : null,
    actualCost: "unavailable" as const,
    invalid,
    blockers,
  };
}

async function authorizeEstimate(
  ctx: GarmentEstimatesContext,
  v: EstimateDraft,
) {
  const previous = v.baseRevisionId
    ? await ctx.repository.read(v.baseRevisionId)
    : undefined;
  await prepareServiceDraftReads(
    ctx.services,
    [v, ...(previous ? [previous.input] : [])].map((input) => ({
      workflow: "pricing.estimate",
      payload: input,
    })),
  );
  if (previous) {
    if (previous.estimateId !== v.estimateId) fail(404);
    await estimateSource(ctx, previous.input);
  }
  return estimateSource(ctx, v);
}
export async function reviewEstimate(
  ctx: GarmentEstimatesContext,
  input: unknown,
): Promise<EstimateReview> {
  const v = estimateDraftSchema.parse(input);
  const source = await authorizeEstimate(ctx, v);
  await ctx.rates.catalogue.repository.lock();
  await ctx.rates.profile.lock();
  await ctx.rates.repository.lock();
  const calculated = calculateEstimate(v),
    suggested = structuredClone(v);
  suggested.review = null;
  suggested.sourceFingerprint = source.fingerprint;
  let stale = v.sourceFingerprint !== source.fingerprint;
  for (const l of v.lines) {
    if (
      l.sourceKey &&
      !source.candidates.some(
        (c) =>
          c.key === l.sourceKey &&
          (!v.target.pieceId ||
            c.pieceId === null ||
            c.pieceId === v.target.pieceId),
      )
    )
      fail(404);
    if (l.mode !== "rate" || !l.rateId || !localDateValid(v.pricingDate))
      continue;
    const now = await resolveRate(ctx.rates, {
      rateId: l.rateId,
      date: v.pricingDate,
    });
    const next = suggested.lines.find((x) => x.id === l.id);
    if (!next) fail();
    if (
      now.state === "known" &&
      now.revision &&
      now.entry &&
      now.revision.component === l.component &&
      now.revision.unit === l.unit
    ) {
      next.rate = {
        rateId: l.rateId,
        revisionId: now.revision.id,
        entryId: now.entry.entryId,
      };
      next.basisText = String(now.revision.basisQuantity);
      const p = BigInt(now.entry.ratePaise);
      next.rateText = `${p / 100n}.${(p % 100n).toString().padStart(2, "0")}`;
      let entered: number | null = null;
      try {
        entered = price(l.rateText);
      } catch {
        calculated.invalid.push(l.id);
      }
      if (
        JSON.stringify(next.rate) !== JSON.stringify(l.rate) ||
        l.basisText !== next.basisText ||
        entered !== now.entry.ratePaise
      )
        stale = true;
    } else {
      calculated.blockers.push(`${l.id}:rate-unavailable`);
      stale = true;
      next.rate = null;
    }
  }
  for (const l of v.lines)
    if (l.mode === "rate" && l.state === "charge" && (!l.rateId || !l.rate)) {
      stale = true;
      calculated.blockers.push(`${l.id}:rate-unselected`);
    }
  if (stale) calculated.blockers.push("source-changed-review-refresh");
  if (!localDateValid(v.pricingDate)) calculated.invalid.push("pricing-date");
  const body = { ...calculated, source, stale };
  return {
    ...body,
    suggested,
    fingerprint: await requestHash({ input: { ...v, review: null }, ...body }),
  };
}
export function estimateDraftWorkflow(
  ctx: GarmentEstimatesContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: estimateDraftSchema,
    commandSchema: estimateCommandSchema,
    validateEdit(previous, next) {
      if (
        JSON.stringify(estimateDraftSchema.parse(previous).target) !==
        JSON.stringify(estimateDraftSchema.parse(next).target)
      )
        fail();
    },
    async authorizeDraft(input) {
      await authorizeEstimate(ctx, estimateDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await authorizeEstimate(ctx, estimateDraftSchema.parse(input));
    },
    async revalidate(input) {
      const v = estimateCommandSchema.parse(input),
        r = await reviewEstimate(ctx, v);
      if (r.invalid.length) fail(422);
      if (r.stale || v.review !== r.fingerprint) fail();
    },
    async promote(input, _action, draftId, request) {
      const v = estimateCommandSchema.parse(input),
        r = await reviewEstimate(ctx, v);
      await ctx.repository.lock(v.estimateId);
      const prior = await ctx.repository.current(v.estimateId);
      if (
        (prior?.version ?? 0) !== v.baseVersion ||
        (prior?.id ?? null) !== v.baseRevisionId
      )
        fail(412);
      if (prior) await estimateSource(ctx, prior.input);
      if (r.invalid.length) fail(422);
      if (r.stale || r.fingerprint !== v.review) fail();
      const result = await ctx.repository.append({
        ...request,
        estimateId: v.estimateId,
        version: v.baseVersion + 1,
        previousId: v.baseRevisionId,
        originDraftId: draftId,
        actorId: ctx.actorId,
        input: v,
        customer: r.customer,
        source: r.source,
        costs: r.costs,
        costSubtotalPaise: r.costSubtotalPaise,
        unknownCostCount: r.unknownCostCount,
        estimatedMarginPaise: r.estimatedMarginPaise,
        actualCost: "unavailable",
        blockers: r.blockers,
      });
      return { type: "pricing.estimate", id: result.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "pricing.estimate" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail();
      const r = await ctx.repository.read(result.id);
      if (!r) fail(404);
      await estimateSource(ctx, r.input);
    },
  };
}
export async function readEstimate(ctx: GarmentEstimatesContext, id: string) {
  const version = await ctx.repository.read(id);
  if (!version) fail(404);
  const review = await reviewEstimate(ctx, version.input);
  return {
    version,
    sourceChanged: review.stale,
  };
}
export async function estimateHistory(
  ctx: GarmentEstimatesContext,
  id: string,
  before?: number,
) {
  const rows = await ctx.repository.history(id, before),
    versions = [];
  await prepareServiceDraftReads(
    ctx.services,
    rows
      .slice(0, 25)
      .map((r) => ({ workflow: "pricing.estimate", payload: r.input })),
  );
  for (const r of rows.slice(0, 25)) {
    await estimateSource(ctx, r.input);
    versions.push(r);
  }
  return {
    versions,
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
