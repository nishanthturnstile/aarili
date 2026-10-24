import {
  type CustomerQuotation,
  customerQuotationSchema,
  type QuotationDraft,
  type QuotationFact,
  type QuotationPrivate,
  type QuotationReview,
  type QuotationSource,
  quotationCommandSchema,
  quotationDraftSchema,
} from "@aarili/contracts/booking-quotations";
import { emptyEstimate } from "@aarili/contracts/garment-estimates";
import type { BookingQuotationsRepository } from "@aarili/db/repositories/booking-quotations";
import {
  allocateFin05,
  checkedAdd,
  checkedMultiplyDivide,
  checkedSubtract,
  fromPostgresBigint,
  parseRupees,
} from "@aarili/money";
import { readBooking } from "./bookings.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  estimateSource,
  type GarmentEstimatesContext,
  readEstimate,
} from "./garment-estimates.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import { requestHash } from "./request-binding.js";
import {
  prepareServiceDraftReads,
  readServiceRepeatSource,
} from "./small-services.js";

export type BookingQuotationsContext = {
  actorId: string;
  estimates: GarmentEstimatesContext;
  repository: BookingQuotationsRepository;
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
      message: "Review quotation scope, prices and current authority",
    },
  });
}
function money(raw: string) {
  if (raw.trim() && !/^\d+(\.\d{1,2})?$/.test(raw.trim()))
    throw Error("amount");
  return parseRupees(raw);
}
const sum = (values: number[]) => values.reduce((a, b) => checkedAdd(a, b), 0);
const distinct = (v: string[]) => new Set(v).size === v.length;
// FIN-05 accepts opaque ASCII tokens, not our colon-separated commercial keys.
// Position aliases preserve persisted sequence and are mapped back losslessly.
function allocate(amount: number, lines: { key: string; amount: number }[]) {
  return allocateFin05(
    amount,
    lines.map((l, i) => ({ lineId: `q-${i}`, chargePaise: l.amount })),
  ).allocations.map((a, i) => ({
    lineId: lines[i]?.key ?? fail(),
    amountPaise: a.amountPaise,
  }));
}

// This is a projection of one persisted commercial graph, independent of UI sort.
export function calculateQuotation(
  v: QuotationDraft,
  source: QuotationSource,
  privateInput: QuotationPrivate,
) {
  const blockers: string[] = [],
    facts = source.facts,
    keys = facts.map((f) => f.key);
  if (!distinct(keys) || !distinct(facts.map((f) => String(f.sequence))))
    blockers.push("duplicate-charge-or-sequence");
  if (
    !distinct(v.discounts.map((d) => d.id)) ||
    !distinct(v.discounts.map((d) => d.target ?? "booking"))
  )
    blockers.push("duplicate-discount");
  if (
    !distinct(v.orderIds) ||
    !distinct(v.estimates.map((e) => e.orderId)) ||
    !distinct(v.estimates.map((e) => e.revisionId))
  )
    blockers.push("duplicate-scope");
  for (const f of facts) {
    const seen = new Set([f.key]);
    let parent = f.parentKey;
    while (parent) {
      if (seen.has(parent)) {
        blockers.push("inclusion-cycle");
        break;
      }
      seen.add(parent);
      const p = facts.find((x) => x.key === parent);
      if (!p) {
        blockers.push("missing-covering-charge");
        break;
      }
      if (!["charge", "reference"].includes(p.role))
        blockers.push("covering-not-charge");
      parent = p.parentKey;
    }
    if (f.role === "charge" && f.parentKey)
      blockers.push("multiple-charging-parents");
    if (f.role === "reference" && !f.parentKey)
      blockers.push("unnamed-inclusion");
  }
  const policy = source.policy?.policy;
  const authorized =
    !!source.policy?.sourceCurrent &&
    policy?.kind === "discount" &&
    policy.state === "reviewed" &&
    policy.approval === "owner" &&
    v.discountDecision.policyId === source.policy.id;
  const manualAuthorized =
    authorized &&
    v.discountDecision.manual === true &&
    !!v.discountDecision.reason.trim();
  const eligible = new Set(v.discountDecision.eligibleKeys);
  if (
    !distinct(v.discountDecision.eligibleKeys) ||
    [...eligible].some(
      (k) =>
        !facts.some(
          (f) =>
            f.key === k &&
            f.role === "charge" &&
            f.grossPaise !== null &&
            f.grossPaise > 0,
        ),
    )
  )
    blockers.push("discount-eligibility");
  const lines: CustomerQuotation["lines"] = facts.map((f) => ({
    ...f,
    lineDiscountPaise: 0,
    bookingDiscountPaise: 0,
    netPaise:
      f.role === "charge"
        ? f.grossPaise
        : f.role === "complimentary"
          ? 0
          : null,
  }));
  const charges = lines
    .filter((l) => l.role === "charge")
    .sort((a, b) => a.sequence - b.sequence);
  const unknownCount = facts.filter(
    (f) =>
      f.role === "unknown" || (f.role === "charge" && f.grossPaise === null),
  ).length;
  let grossPaise = 0,
    discountPaise = 0,
    bookingAmount = 0;
  function amount(d: QuotationDraft["discounts"][number], base: number) {
    if (!d.valueText.trim()) throw Error("unknown-discount");
    let value: number;
    if (d.mode === "fixed") value = money(d.valueText) ?? 0;
    else {
      if (
        !/^\d+$/.test(d.valueText) ||
        !Number.isSafeInteger(Number(d.valueText)) ||
        Number(d.valueText) > 10000
      )
        throw Error("bps");
      value = checkedMultiplyDivide(base, Number(d.valueText), 10000);
    }
    if (value > base) throw Error("discount-over-base");
    if (
      value > 0 &&
      (!authorized ||
        !d.reason.trim() ||
        !v.discountDecision.reason.trim() ||
        v.discountDecision.stacking === null ||
        v.discountDecision.manual === null)
    )
      throw Error("discount-authority");
    if (
      value > 0 &&
      policy?.kind === "discount" &&
      BigInt(value) * 10000n > BigInt(base) * BigInt(policy.maximumBps ?? 0)
    )
      throw Error("discount-policy-cap");
    return value;
  }
  try {
    grossPaise = sum(charges.map((l) => l.grossPaise ?? 0));
    for (const d of v.discounts.filter((d) => d.target !== null)) {
      const line = charges.find((l) => l.key === d.target);
      if (!line || line.grossPaise === null || !eligible.has(line.key))
        throw Error("discount-ineligible-line");
      line.lineDiscountPaise = amount(d, line.grossPaise);
      line.netPaise = checkedSubtract(line.grossPaise, line.lineDiscountPaise);
    }
    const booking = v.discounts.find((d) => d.target === null),
      pool = charges.filter((l) => eligible.has(l.key) && l.netPaise !== null);
    const base = sum(pool.map((l) => l.netPaise ?? 0));
    if (booking) {
      bookingAmount = amount(booking, base);
      if (
        bookingAmount > 0 &&
        v.discountDecision.stacking !== true &&
        pool.some((l) => l.lineDiscountPaise > 0)
      )
        throw Error("stacking-not-approved");
      if (bookingAmount > 0 && base === 0) throw Error("zero-discount-base");
    }
    let shares: { lineId: string; amountPaise: number }[] = [];
    if (v.manual.length) {
      if (
        !manualAuthorized ||
        !v.manualReason.trim() ||
        !distinct(v.manual.map((m) => m.key)) ||
        v.manual.length !== pool.length
      )
        throw Error("manual-authority");
      shares = v.manual.map((m) => ({
        lineId: m.key,
        amountPaise: money(m.amountText) ?? NaN,
      }));
      if (
        shares.some((s) => !pool.some((l) => l.key === s.lineId)) ||
        sum(shares.map((s) => s.amountPaise)) !== bookingAmount
      )
        throw Error("manual-reconciliation");
    } else if (pool.length) {
      shares = allocate(
        bookingAmount,
        pool.map((l) => ({ key: l.key, amount: l.netPaise ?? 0 })),
      );
    }
    for (const s of shares) {
      const l = pool.find((l) => l.key === s.lineId);
      if (!l || s.amountPaise > (l.netPaise ?? 0))
        throw Error("fin05-over-cap");
      l.bookingDiscountPaise = s.amountPaise;
      l.netPaise = checkedSubtract(l.netPaise ?? 0, s.amountPaise);
    }
    discountPaise = sum(
      charges.map((l) =>
        checkedAdd(l.lineDiscountPaise, l.bookingDiscountPaise),
      ),
    );
    if (
      discountPaise > 0 &&
      policy?.kind === "discount" &&
      BigInt(discountPaise) * 10000n >
        BigInt(grossPaise) * BigInt(policy.maximumBps ?? 0)
    )
      throw Error("combined-policy-cap");
  } catch {
    blockers.push("discount-arithmetic-authority-or-cap");
  }
  let knownSubtotalPaise = 0;
  try {
    knownSubtotalPaise = sum(charges.map((l) => l.netPaise ?? 0));
  } catch {
    blockers.push("total-overflow");
  }
  const attribution: CustomerQuotation["attribution"] = [];
  let unattributedSellingPaise = 0;
  try {
    for (const l of charges) {
      if (l.orderId) {
        let row = attribution.find((a) => a.orderId === l.orderId);
        if (!row) {
          row = { orderId: l.orderId, amountPaise: 0 };
          attribution.push(row);
        }
        row.amountPaise = checkedAdd(row.amountPaise, l.netPaise ?? 0);
      } else if (l.key.startsWith("package:")) {
        if (v.packageSplits.length) {
          if (
            !manualAuthorized ||
            !v.manualReason.trim() ||
            !distinct(v.packageSplits.map((s) => s.orderId)) ||
            v.packageSplits.length !== source.packageOrderIds.length
          )
            throw Error("package-split");
          const splits = v.packageSplits.map((s) => ({
            orderId: s.orderId,
            amountPaise: money(s.amountText) ?? NaN,
          }));
          if (
            splits.some((s) => !source.packageOrderIds.includes(s.orderId)) ||
            sum(splits.map((s) => s.amountPaise)) !== l.netPaise
          )
            throw Error("package-split-sum");
          for (const s of splits) {
            const row = attribution.find((a) => a.orderId === s.orderId);
            if (row)
              row.amountPaise = checkedAdd(row.amountPaise, s.amountPaise);
            else attribution.push(s);
          }
        } else
          unattributedSellingPaise = checkedAdd(
            unattributedSellingPaise,
            l.netPaise ?? 0,
          );
      }
    }
    if (v.packageSplits.length && !source.commercialId)
      throw Error("no-package");
    if (
      sum(attribution.map((a) => a.amountPaise)) + unattributedSellingPaise !==
      knownSubtotalPaise
    )
      throw Error("attribution-sum");
  } catch {
    blockers.push("selling-attribution");
  }
  const privateCosts = structuredClone(privateInput);
  try {
    const shared = money(v.sharedCost.amountText);
    privateCosts.shared = { amountPaise: shared, reason: v.sharedCost.reason };
    if (shared !== null && !v.sharedCost.reason.trim())
      throw Error("private-cost-reason");
    if (shared !== null && shared > 0) {
      const bases = charges.map((l) => ({
        lineId: l.key,
        chargePaise: l.netPaise ?? 0,
      }));
      if (unknownCount || sum(bases.map((b) => b.chargePaise)) === 0) {
        privateCosts.unattributedPaise = shared;
      } else
        privateCosts.allocations = allocate(
          shared,
          bases.map((b) => ({ key: b.lineId, amount: b.chargePaise })),
        ).map((a) => ({ key: a.lineId, amountPaise: a.amountPaise }));
      if (
        sum(privateCosts.allocations.map((a) => a.amountPaise)) +
          privateCosts.unattributedPaise !==
        shared
      )
        throw Error("private-cost-sum");
    }
  } catch {
    blockers.push("private-cost-invalid");
  }
  const complete = unknownCount === 0 && blockers.length === 0;
  const customer = customerQuotationSchema.parse({
    kind: "quotation-proposal-not-issued",
    familyId: v.familyId,
    lines,
    grossPaise,
    discountPaise,
    knownSubtotalPaise,
    unknownCount,
    complete,
    totalPaise: complete ? knownSubtotalPaise : null,
    assumptions: v.assumptions,
    agreementApplication: "unavailable",
    attribution,
    unattributedSellingPaise,
  });
  return { customer, privateCosts, blockers };
}

async function prepare(ctx: BookingQuotationsContext, v: QuotationDraft) {
  const old = v.baseRevisionId
    ? await ctx.repository.read(v.baseRevisionId)
    : undefined;
  if (old && old.familyId !== v.familyId) fail(404);
  const inputs = [v, ...(old ? [old.input] : [])],
    services = ctx.estimates.services,
    repo = services.orders.acceptance?.repository;
  if (!repo) fail();
  // Booking and actual member locks precede identity/configuration locks for all readers.
  const bookings = new Set(
    inputs.flatMap((i) => (i.bookingId ? [i.bookingId] : [])),
  );
  for (const input of inputs)
    for (const id of input.orderIds) {
      const b = await repo.bookings.membership(id);
      if (b) bookings.add(b);
    }
  for (const id of [...bookings].sort()) await repo.bookings.lock(id);
  await prepareServiceDraftReads(
    services,
    inputs.flatMap((i) =>
      i.orderIds.map((id) => ({
        workflow: "order.service",
        payload: { sourceOrderId: id },
      })),
    ),
  );
  if (old) await authorizeFrozen(ctx, old.input);
}
async function authorizeFrozen(
  ctx: BookingQuotationsContext,
  v: QuotationDraft,
) {
  for (const id of v.orderIds)
    await readServiceRepeatSource(ctx.estimates.services, id);
  for (const e of v.estimates) await readEstimate(ctx.estimates, e.revisionId);
}
async function authoritySources(
  ctx: BookingQuotationsContext,
  v: QuotationDraft,
  includePolicy = true,
) {
  const services = ctx.estimates.services,
    orders = services.orders.acceptance?.repository;
  if (!orders) fail();
  if (!v.bookingId && v.orderIds.length > 1) fail(422);
  const bookingId =
    v.bookingId ??
    (v.orderIds.length === 1
      ? await orders.bookings.membership(v.orderIds[0] ?? "")
      : null) ??
    null;
  const source: QuotationSource = {
    bookingId,
    bookingRevisionId: null,
    bookingVersion: null,
    commercialId: null,
    packagePaise: null,
    packageOrderIds: [],
    orders: [],
    estimates: [],
    estimateStale: false,
    policy: null,
    facts: [],
    current: [],
    fingerprint: "",
  };
  const costs: QuotationPrivate = {
    estimates: [],
    shared: { amountPaise: null, reason: "" },
    allocations: [],
    unattributedPaise: 0,
    unknownCount: 0,
    actualCost: "unavailable",
  };
  if (bookingId) {
    const b = await readBooking(services.orders, bookingId);
    source.bookingRevisionId = b.booking.revision.id;
    source.bookingVersion = b.booking.version;
    if (v.orderIds.some((id) => !b.orders.some((o) => o.id === id))) fail(404);
    if (b.commercial?.basis === "package-proposal") {
      source.commercialId = b.commercial.id;
      source.packageOrderIds = b.commercial.scope.map((s) => s.orderId);
      source.packagePaise =
        b.commercial.packagePaise === null
          ? null
          : fromPostgresBigint(b.commercial.packagePaise);
    }
  }
  const add = (f: Omit<QuotationFact, "sequence">) =>
    source.facts.push({ ...f, sequence: source.facts.length });
  const fact = (
    key: string,
    orderId: string | null,
    labelEn: string,
    labelTa: string,
    price: number | null,
    role: QuotationFact["role"] = "charge",
    parentKey: string | null = null,
  ): Omit<QuotationFact, "sequence"> => ({
    key,
    orderId,
    pieceId: null,
    labelEn,
    labelTa,
    role,
    parentKey,
    grossPaise: price,
    acceptedPaise: price,
    estimateRevisionId: null,
    serviceLineId: null,
    additionLineId: null,
    sourceId: null,
    reason: "",
  });
  const packageKey = source.commercialId
    ? `package:${source.commercialId}`
    : null;
  if (packageKey)
    add({
      ...fact(packageKey, null, "Package", "தொகுப்பு", source.packagePaise),
      sourceId: source.commercialId,
    });
  for (const orderId of v.orderIds) {
    const native = await readServiceRepeatSource(services, orderId),
      member = await orders.bookings.membership(orderId);
    if ((member ?? null) !== source.bookingId) {
      // A garment view of a grouped member still names its booking; this closes package bypasses.
      fail();
    }
    const t = {
      ...emptyEstimate(v.familyId),
      target: {
        orderId,
        pieceId: null,
        customerId: native.customer?.id ?? null,
        wearerId: native.wearer?.id ?? null,
      },
    };
    const sourceOrder = await estimateSource(ctx.estimates, t);
    source.orders.push(sourceOrder);
    const selected = v.estimates.filter((e) => e.orderId === orderId);
    if (selected.length > 1) fail(422);
    const estimated = selected[0]
      ? await readEstimate(ctx.estimates, selected[0].revisionId)
      : undefined;
    if (estimated) {
      if (
        estimated.version.source.orderId !== orderId ||
        estimated.version.source.pieceId
      )
        fail(404);
      if (estimated.sourceChanged) source.estimateStale = true;
      source.estimates.push(estimated.version.id);
      costs.estimates.push(
        ...estimated.version.costs.map((c) => ({
          ...c,
          revisionId: estimated.version.id,
        })),
      );
      costs.unknownCount += estimated.version.unknownCostCount;
    }
    const estimate = estimated?.version,
      root = `garment:${orderId}`,
      coveringPackage = source.packageOrderIds.includes(orderId)
        ? packageKey
        : null;
    const extraKeys = new Set(
      native.candidates.filter((c) => c.kind === "addition").map((c) => c.key),
    );
    if (native.kind === "custom") {
      const accepted = await readAcceptedOrder(services.orders, orderId);
      const acceptedReference =
        accepted.commercial?.referencePaise ?? sourceOrder.acceptedPaise;
      const components = estimate?.customer.lines.filter(
        (l) => !extraKeys.has(l.sourceKey ?? ""),
      );
      const amount = components
        ? components.some((l) => l.issues.length || l.state === "unknown")
          ? null
          : sum(components.map((l) => l.amountPaise ?? 0))
        : acceptedReference;
      add({
        ...fact(
          root,
          orderId,
          native.subjectDescription,
          native.subjectDescription,
          amount,
          coveringPackage ? "reference" : "charge",
          coveringPackage,
        ),
        acceptedPaise: acceptedReference,
        estimateRevisionId: estimate?.id ?? null,
        sourceId: orderId,
      });
      if (components)
        for (const l of components)
          add({
            ...fact(
              `estimate:${l.id}`,
              orderId,
              l.labelEn,
              l.labelTa,
              l.amountPaise,
              "reference",
              root,
            ),
            estimateRevisionId: estimate?.id ?? null,
            reason: l.reason,
          });
      const pieces = await readOrderPieces(services.orders, orderId),
        splits = v.pieceSplits.filter((s) => s.orderId === orderId);
      if (splits.length && includePolicy) {
        let partition: number;
        try {
          partition = sum(splits.map((s) => money(s.amountText) ?? NaN));
        } catch {
          fail(422);
        }
        if (
          !distinct(splits.map((s) => s.pieceId)) ||
          splits.some(
            (s) => !pieces.identities.some((p) => p.id === s.pieceId),
          ) ||
          partition !== amount
        )
          fail(422);
        for (const s of splits) {
          const p = pieces.identities.find((p) => p.id === s.pieceId);
          const d = pieces.structure?.pieces.find((d) => d.key === p?.key);
          if (d?.applicability !== "applicable") fail(404);
          add({
            ...fact(
              `piece:${s.pieceId}`,
              orderId,
              d.labelEn,
              d.labelTa,
              money(s.amountText),
              "reference",
              root,
            ),
            pieceId: s.pieceId,
            sourceId: s.pieceId,
          });
        }
      }
    }
    for (const c of native.candidates.filter(
      (c) => c.kind !== "original-addon",
    )) {
      const matching = estimate?.customer.lines.filter(
        (l) => l.sourceKey === c.key,
      );
      const amount = matching?.length
        ? matching.some((l) => l.issues.length || l.state === "unknown")
          ? null
          : sum(matching.map((l) => l.amountPaise ?? 0))
        : c.previousPaise;
      add({
        ...fact(
          c.key,
          orderId,
          c.labelEn,
          c.labelTa,
          amount,
          c.state === "not-required" ? "excluded" : "charge",
        ),
        pieceId: c.pieceId,
        sourceId: c.sourceId,
        serviceLineId: c.kind === "standalone" ? c.lineId : null,
        additionLineId: c.kind === "addition" ? c.lineId : null,
        acceptedPaise: c.previousPaise,
        estimateRevisionId: matching?.length ? (estimate?.id ?? null) : null,
        reason:
          c.state === "not-required"
            ? "Accepted exclusion"
            : (matching?.map((l) => l.reason).join("; ") ?? ""),
      });
    }
    if (native.kind === "service" && estimate) {
      for (const l of estimate.customer.lines.filter((l) => !l.sourceKey))
        add({
          ...fact(
            `estimate:${l.id}`,
            orderId,
            l.labelEn,
            l.labelTa,
            l.amountPaise,
            l.state === "included"
              ? "reference"
              : l.state === "excluded"
                ? "excluded"
                : l.state === "complimentary"
                  ? "complimentary"
                  : l.state === "unknown"
                    ? "unknown"
                    : "charge",
            l.coveringLineId ? `estimate:${l.coveringLineId}` : null,
          ),
          estimateRevisionId: estimate.id,
          reason: l.reason,
        });
    }
  }
  if (
    v.estimates.some((e) => !v.orderIds.includes(e.orderId)) ||
    v.pieceSplits.some((s) => !v.orderIds.includes(s.orderId))
  )
    fail(422);
  if (includePolicy) {
    await ctx.estimates.rates.repository.lock();
    source.policy =
      (await ctx.estimates.rates.repository.policyCurrent("discount")) ?? null;
    if (
      source.policy &&
      !ctx.estimates.rates.synthetic &&
      source.policy.authority !== "owner-reviewed"
    )
      source.policy = null;
  }
  source.current = await ctx.repository.selected(v.orderIds);
  source.fingerprint = await requestHash({ ...source, fingerprint: "" });
  return { source, costs };
}
export async function reviewQuotation(
  ctx: BookingQuotationsContext,
  input: unknown,
): Promise<QuotationReview> {
  const v = quotationDraftSchema.parse(input);
  await prepare(ctx, v);
  const { source, costs } = await authoritySources(ctx, v),
    r = calculateQuotation(v, source, costs);
  if (source.estimateStale)
    r.blockers.push("estimate-source-changed-revise-estimate");
  if (source.packageOrderIds.some((id) => !v.orderIds.includes(id)))
    r.blockers.push("partial-indivisible-package");
  if (!v.orderIds.length) r.blockers.push("empty-scope");
  if (v.selection === "current") {
    const expected = [
      ...new Set(source.current.map((c) => c.revisionId)),
    ].sort();
    if (JSON.stringify([...v.predecessors].sort()) !== JSON.stringify(expected))
      r.blockers.push("selection-predecessors-changed");
    for (const id of expected) {
      if (
        (await ctx.repository.scopes(id)).some((o) => !v.orderIds.includes(o))
      )
        r.blockers.push("partial-supersession");
    }
  } else if (v.predecessors.length)
    r.blockers.push("alternative-cannot-supersede");
  const stale = v.sourceFingerprint !== source.fingerprint;
  if (stale) r.blockers.push("sources-changed");
  if (r.blockers.length) {
    r.customer.complete = false;
    r.customer.totalPaise = null;
  }
  const suggested = structuredClone(v);
  suggested.sourceFingerprint = source.fingerprint;
  suggested.review = null;
  if (v.selection === "current")
    suggested.predecessors = [
      ...new Set(source.current.map((c) => c.revisionId)),
    ];
  return {
    ...r,
    source,
    stale,
    suggested,
    fingerprint: await requestHash({
      input: { ...v, review: null },
      source,
      ...r,
    }),
  };
}
export function quotationDraftWorkflow(
  ctx: BookingQuotationsContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: quotationDraftSchema,
    commandSchema: quotationCommandSchema,
    validateEdit(previous, next) {
      const a = quotationDraftSchema.parse(previous),
        b = quotationDraftSchema.parse(next);
      if (
        a.familyId !== b.familyId ||
        a.bookingId !== b.bookingId ||
        JSON.stringify(a.orderIds) !== JSON.stringify(b.orderIds)
      )
        fail();
    },
    async authorizeDraft(input) {
      await prepare(ctx, quotationDraftSchema.parse(input));
      await authoritySources(ctx, quotationDraftSchema.parse(input), false);
    },
    async authorizePublication(input) {
      await prepare(ctx, quotationDraftSchema.parse(input));
      await authoritySources(ctx, quotationDraftSchema.parse(input), false);
    },
    async revalidate(input) {
      const v = quotationCommandSchema.parse(input),
        r = await reviewQuotation(ctx, v);
      if (
        r.blockers.length ||
        !r.customer.complete ||
        v.review !== r.fingerprint
      )
        fail();
    },
    async promote(input, _action, draftId, request) {
      const v = quotationCommandSchema.parse(input),
        r = await reviewQuotation(ctx, v);
      await ctx.repository.lock(v.familyId);
      const old = await ctx.repository.current(v.familyId);
      if (
        (old?.version ?? 0) !== v.baseVersion ||
        (old?.id ?? null) !== v.baseRevisionId
      )
        fail(412);
      if (
        r.blockers.length ||
        !r.customer.complete ||
        v.review !== r.fingerprint
      )
        fail();
      const version = await ctx.repository.append({
        ...request,
        familyId: v.familyId,
        version: v.baseVersion + 1,
        previousId: v.baseRevisionId,
        originDraftId: draftId,
        actorId: ctx.actorId,
        input: v,
        source: r.source,
        customer: r.customer,
        privateCosts: r.privateCosts,
      });
      return { type: "pricing.quotation", id: version.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "pricing.quotation" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail();
      const row = await ctx.repository.read(result.id);
      if (!row) fail(404);
      await prepare(ctx, row.input);
      await authorizeFrozen(ctx, row.input);
    },
  };
}
export async function readQuotation(ctx: BookingQuotationsContext, id: string) {
  const version = await ctx.repository.read(id);
  if (!version) fail(404);
  await prepare(ctx, version.input);
  await authorizeFrozen(ctx, version.input);
  let sourceChanged = true;
  try {
    const r = await reviewQuotation(ctx, version.input);
    const normalize = (s: QuotationSource) => ({
      ...s,
      current: [],
      fingerprint: "",
    });
    sourceChanged =
      (await requestHash(normalize(r.source))) !==
      (await requestHash(normalize(version.source)));
  } catch (error) {
    // Current subject authority was checked under the same locks above. A changed
    // commercial membership must not rewrite or hide this authorized frozen version.
    if (
      !(error instanceof DraftFailure) ||
      ![404, 409, 422].includes(error.status)
    )
      throw error;
  }
  const current = await ctx.repository.selected(version.input.orderIds);
  return {
    version,
    sourceChanged,
    selected:
      current.length === version.input.orderIds.length &&
      current.every((c) => c.revisionId === id),
  };
}
export async function currentQuotation(
  ctx: BookingQuotationsContext,
  familyId: string,
) {
  const current = await ctx.repository.current(familyId);
  if (!current) fail(404);
  return readQuotation(ctx, current.id);
}
export async function quotationEstimateOptions(
  ctx: BookingQuotationsContext,
  id: string,
) {
  const native = await readServiceRepeatSource(ctx.estimates.services, id);
  return {
    estimates: await ctx.repository.estimates(id),
    pieces: native.pieces.map(({ id, labelEn, labelTa }) => ({
      id,
      labelEn,
      labelTa,
    })),
  };
}
export async function quotationHistory(
  ctx: BookingQuotationsContext,
  familyId: string,
  before?: number,
) {
  const rows = await ctx.repository.history(familyId, before);
  await prepareServiceDraftReads(
    ctx.estimates.services,
    rows
      .slice(0, 25)
      .map((r) => ({ workflow: "pricing.quotation", payload: r.input })),
  );
  for (const row of rows.slice(0, 25)) {
    await authorizeFrozen(ctx, row.input);
  }
  return {
    versions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export async function listQuotations(
  ctx: BookingQuotationsContext,
  before?: string,
) {
  const rows = await ctx.repository.list(before);
  await prepareServiceDraftReads(
    ctx.estimates.services,
    rows
      .slice(0, 25)
      .map((r) => ({ workflow: "pricing.quotation", payload: r.input })),
  );
  for (const row of rows.slice(0, 25)) await authorizeFrozen(ctx, row.input);
  return {
    versions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.id ?? null) : null,
  };
}
