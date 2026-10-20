import {
  type AcceptedOrder,
  acceptedOrderSchema,
  materializeOrderPiecesSchema,
  type OrderError,
  type OrderPieces,
  type OrderReview,
  orderHistoryQuerySchema,
  orderListQuerySchema,
  orderModeSchema,
  orderPiecesSchema,
  type QuickOrderDraft,
  type QuickOrderPreview,
  quickOrderCommandSchema,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import { localDateValid } from "@aarili/contracts/shop-calendar";
import type {
  OrderSources,
  OrdersRepository,
} from "@aarili/db/repositories/orders";
import type { ShopPoliciesRepository } from "@aarili/db/repositories/shop-policies";
import type { ShopProfileRepository } from "@aarili/db/repositories/shop-profile";
import { parseRupees } from "@aarili/money";
import { capacityWeek, evaluateCommitment } from "./commitment-evaluator.js";
import type { CustomerContext } from "./customers.js";
import { CustomerFailure, readCustomer } from "./customers.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  type GuardianContext,
  GuardianFailure,
  readGuardians,
} from "./guardians.js";
import { projectOrderPieces } from "./order-pieces.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
import {
  previewServiceRequirements,
  type ServiceTemplatesContext,
  serviceTemplatesReferencesEligible,
} from "./service-templates.js";
import type { ShopCommitmentsContext } from "./shop-commitments.js";
import { readWearer, type WearerContext, WearerFailure } from "./wearers.js";

export { projectOrderPieces, summarizePieceProgress } from "./order-pieces.js";

export type QuickOrderContext = {
  customers: CustomerContext;
  wearers: WearerContext;
  guardians: GuardianContext;
  templates: ServiceTemplatesContext;
  acceptance?: {
    repository: OrdersRepository;
    commitments: ShopCommitmentsContext;
    profile: ShopProfileRepository;
    policies: ShopPoliciesRepository;
  };
};
export class OrderFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    public readonly body: OrderError,
  ) {
    super(body.error.code);
  }
}
function fail(
  code: "REQUEST_CONFLICT" | "NOT_FOUND" | "VALIDATION_FAILED",
  status: 404 | 409 | 422 = 409,
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Quick Order unavailable" },
  });
}
// Shared by preview, save, replay and read. No browser permission assertion.
async function readReferences(ctx: QuickOrderContext, v: QuickOrderDraft) {
  if (
    !ctx.customers.policy.enabled ||
    !ctx.customers.policy.synthetic ||
    !ctx.templates.synthetic
  )
    fail("REQUEST_CONFLICT");
  let customer: QuickOrderPreview["customer"] = null;
  let wearer: QuickOrderPreview["wearer"] = null;
  const issues: QuickOrderPreview["issues"] = [];
  if (v.customerId) {
    await ctx.wearers.repository.lockCustomer(v.customerId);
    const c = await readCustomer(ctx.customers, v.customerId);
    customer = { id: c.id, label: c.displayName, code: c.code };
  } else issues.push("customer");
  if (v.wearerId) {
    if (!v.customerId) fail("VALIDATION_FAILED", 422);
    await ctx.wearers.repository.lockWearer(v.wearerId.toLowerCase());
    const w = await readWearer(ctx.wearers, v.customerId, v.wearerId);
    if (
      !w.relationship.authorised ||
      !w.relationship.informed ||
      w.relationship.authorisationDeclined ||
      w.relationship.informedDeclined
    )
      fail("NOT_FOUND", 404);
    const service = w.purposes.find((p) => p.purpose === "service");
    if (service && service.decision !== "grant") fail("NOT_FOUND", 404);
    wearer = { id: w.id, label: w.displayName, kind: w.relationship.kind };
    if (w.age === "minor") {
      const g = await readGuardians(ctx.guardians, v.customerId, w.id);
      if (!g.authorities.some((a) => a.verifiedCurrent))
        issues.push("guardian");
    } else if (!service?.eligible) issues.push("servicePermission");
  } else issues.push("wearer");
  if (
    v.presentationRevisionId &&
    !(await ctx.templates.repository.presentationRead(v.presentationRevisionId))
  )
    fail("NOT_FOUND", 404);
  if (v.manifest) {
    const r = await ctx.templates.repository.read(v.manifest.revisionId);
    if (
      !r ||
      r.entryId !== v.manifest.entryId ||
      r.definition.id !== v.manifest.definitionId
    )
      fail("NOT_FOUND", 404);
  }
  return { customer, wearer, issues };
}
async function references(ctx: QuickOrderContext, v: QuickOrderDraft) {
  try {
    return await readReferences(ctx, v);
  } catch (e) {
    if (
      e instanceof CustomerFailure ||
      e instanceof WearerFailure ||
      e instanceof GuardianFailure
    )
      fail(
        e.status === 404
          ? "NOT_FOUND"
          : e.status === 422
            ? "VALIDATION_FAILED"
            : "REQUEST_CONFLICT",
        e.status === 404 ? 404 : e.status === 422 ? 422 : 409,
      );
    throw e;
  }
}
export async function previewQuickOrder(
  ctx: QuickOrderContext,
  input: unknown,
): Promise<QuickOrderPreview> {
  const p = quickOrderDraftSchema.safeParse(input);
  if (!p.success) fail("VALIDATION_FAILED", 422);
  const v = p.data;
  const identity = await references(ctx, v);
  const result: QuickOrderPreview = {
    ...identity,
    sourceState: "not-selected",
    requirements: null,
    pricePaise: null,
    effects: "none",
    commitment: "unavailable",
  };
  if (v.manifest) {
    // Same lock order as publication. Exact historic content never becomes latest.
    await ctx.templates.catalogue.repository.lock();
    await ctx.templates.forms.repository.lock();
    await ctx.templates.repository.lock();
    const exact = await ctx.templates.repository.read(v.manifest.revisionId);
    if (!exact) fail("NOT_FOUND", 404);
    const current = await ctx.templates.repository.current(v.manifest.entryId);
    result.sourceState = !current?.available
      ? "unavailable"
      : current.id !== exact.id
        ? "changed"
        : (await serviceTemplatesReferencesEligible(ctx.templates, exact))
          ? "current"
          : "changed";
    result.requirements = await previewServiceRequirements(
      ctx.templates,
      exact.definition.content,
      exact.definition.id,
    );
  }
  if (result.sourceState !== "current") result.issues.push("service");
  if (!localDateValid(v.deliveryDate)) result.issues.push("deliveryDate");
  if (
    v.deliveryTime &&
    !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(v.deliveryTime)
  )
    result.issues.push("deliveryTime");
  for (const key of ["orderDate", "requestedDate", "eventDate"] as const)
    if (v[key] && !localDateValid(v[key])) result.issues.push(key);
  if (
    v.orderDate &&
    localDateValid(v.orderDate) &&
    v.deliveryDate &&
    v.deliveryDate < v.orderDate
  )
    result.issues.push("orderDate");
  if (v.priceState === "quoted") {
    try {
      result.pricePaise = parseRupees(v.priceText);
    } catch {
      result.issues.push("priceText");
    }
    if (result.pricePaise === null && !result.issues.includes("priceText"))
      result.issues.push("priceText");
  }
  return result;
}
export function quickOrderDraftWorkflow(ctx: QuickOrderContext): DraftWorkflow {
  let resolved: Awaited<ReturnType<typeof resolveOrderAcceptance>> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: quickOrderDraftSchema,
    commandSchema: quickOrderCommandSchema,
    async authorizeDraft(input) {
      const parsed = quickOrderDraftSchema.safeParse(input);
      if (!parsed.success) fail("VALIDATION_FAILED", 422);
      await references(ctx, parsed.data);
    },
    async authorizePublication(input) {
      const v = quickOrderDraftSchema.parse(input);
      await references(ctx, v);
    },
    async revalidate(input) {
      const v = quickOrderCommandSchema.parse(input);
      resolved = await resolveOrderAcceptance(ctx, v);
      const d = v.commitmentReview,
        r = resolved.review;
      if (r.intake.issues.some((i) => i === "priceText" || i === "orderDate"))
        fail("VALIDATION_FAILED", 422);
      if (
        !d?.acknowledged ||
        d.fingerprint !== r.fingerprint ||
        r.unknowns.length ||
        !r.evaluation ||
        !resolved.sources
      )
        fail("REQUEST_CONFLICT");
      if (
        r.evaluation.warnings.some(
          (w) => w === "capacityExceeded" || w === "cutoffPassed",
        ) &&
        !d.exceptionReason.trim()
      )
        fail("VALIDATION_FAILED", 422);
      if (d.waiveRush && (!r.evaluation.facts.rush || !d.waiverReason.trim()))
        fail("VALIDATION_FAILED", 422);
    },
    async promote(input, _action, draftId, request) {
      if (!resolved?.sources || !resolved.review.intake.requirements)
        fail("REQUEST_CONFLICT");
      const v = quickOrderCommandSchema.parse(input),
        a = acceptance(ctx);
      const snapshot = {
        ...resolved.snapshot,
        intake: v,
        requirements: resolved.review.intake.requirements,
        decision: v.commitmentReview,
      };
      const order = await a.repository.accept({
        draftId,
        actorId: ctx.templates.actorId,
        ...request,
        intake: v,
        review: resolved.review,
        requirements: resolved.review.intake.requirements,
        sources: resolved.sources,
        snapshot,
        digest: await requestHash(snapshot),
      });
      const structure = projectOrderPieces(order);
      if (!structure) fail("REQUEST_CONFLICT");
      await a.repository.pieces.write({
        orderId: order.id,
        orderVersion: order.version,
        snapshotDigest: order.snapshotDigest,
        structure,
        digest: await requestHash(structure),
        actorId: ctx.templates.actorId,
        ...request,
        reason: "Acceptance structure",
        acceptance: true,
      });
      return { type: "order.accepted", id: order.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "order.accepted" ||
        !(await acceptance(ctx).repository.origin(result.id, draftId))
      )
        fail("REQUEST_CONFLICT");
    },
  };
}

function acceptance(ctx: QuickOrderContext) {
  if (!ctx.acceptance) fail("REQUEST_CONFLICT");
  return ctx.acceptance;
}
// Shared authoritative consumer of the existing evaluator; v1/v2 preview DTOs remain unchanged.
async function resolveOrderAcceptance(
  ctx: QuickOrderContext,
  v: QuickOrderDraft,
) {
  const a = acceptance(ctx),
    c = a.commitments;
  const intake = await previewQuickOrder(ctx, v); // identity -> catalogue -> forms -> templates
  await c.repository.lock();
  if (c.bindings) await c.bindings.lock();
  await c.calendar.lock();
  await a.policies.lock();
  await a.profile.lock();
  const unknowns = [...intake.issues] as string[];
  if (!quickOrderCommandSchema.safeParse(v).success)
    unknowns.push("incompleteIntake");
  const rule = await c.repository.current(),
    calendar = await c.calendar.current(),
    profile = await a.profile.current(),
    policies = await a.policies.current();
  if (!rule) unknowns.push("rulesMissing");
  if (!calendar) unknowns.push("calendarMissing");
  if (!profile) unknowns.push("profileMissing");
  if (!policies) unknowns.push("policiesMissing");
  let categoryId: string | null = null;
  const manifest = v.manifest
    ? await ctx.templates.repository.read(v.manifest.revisionId)
    : undefined;
  let parent = manifest?.definition.content.service;
  const catalogueSources = [];
  for (let depth = 0; parent && depth < 4; depth++) {
    const exact = await ctx.templates.catalogue.repository.definition(
      parent.revisionId,
    );
    if (!exact || exact.entryId !== parent.entryId) break;
    catalogueSources.push(exact);
    if (exact.content.kind === "category") {
      categoryId = exact.entryId;
      break;
    }
    parent = exact.content.parent;
  }
  const binding =
    categoryId && c.bindings ? await c.bindings.current(categoryId) : undefined;
  const category = categoryId
    ? await ctx.templates.catalogue.repository.current(categoryId)
    : undefined;
  const approvedCategory = categoryId
    ? await c.categories.resolve(categoryId)
    : null;
  if (!categoryId || !category || !approvedCategory)
    unknowns.push("categoryMissing");
  if (
    !binding ||
    !category ||
    binding.review !== "reviewed" ||
    binding.availabilityId !== category.id ||
    binding.categoryRevisionId !== category.definition.id ||
    binding.ruleRevisionId !== rule?.id
  )
    unknowns.push("bindingUnresolved");
  // No production activation is introduced. All synthetic source labels are retained.
  const synthetic =
    ctx.templates.synthetic &&
    manifest?.definition.authority === "synthetic-fixture" &&
    category?.definition.authority === "synthetic-fixture" &&
    rule?.configuration.authority === "synthetic-fixture" &&
    binding?.authority === "synthetic-fixture";
  if (!synthetic) unknowns.push("productionAuthorityPending");
  const cfg = rule?.configuration;
  const week =
    cfg?.weekStart !== null && cfg?.weekStart !== undefined
      ? capacityWeek(v.deliveryDate, cfg.weekStart)
      : null;
  if (categoryId) await a.repository.lockCapacity(categoryId);
  const now = await a.repository.now();
  const timezone = profile?.profile.timezone;
  const parts = timezone
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now)
    : [];
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const today = timezone
    ? `${part("year")}-${part("month")}-${part("day")}`
    : "";
  const time = timezone ? `${part("hour")}:${part("minute")}` : "";
  if (v.orderDate && v.orderDate !== today && !v.historicalReason.trim())
    unknowns.push("historicalReasonRequired");
  if (v.orderDate && v.orderDate > today) unknowns.push("futureOrderDate");
  if (today && v.deliveryDate < today)
    unknowns.push("deliveryBeforeAcceptance");
  let load = null;
  if (categoryId && week) {
    const rows = await a.repository.demand(categoryId, week.start, week.end);
    if (!cfg?.unit) unknowns.push("capacityUnitMissing");
    else if (rows.some((r) => r.unit !== cfg.unit))
      unknowns.push("incomparableDemand");
    else
      load = {
        quantity: rows.reduce((sum, r) => sum + r.quantity, 0),
        unit: cfg.unit,
        weekStart: week.start,
        source: await requestHash(rows),
        asOf: now.toISOString(),
      };
  }
  if (cfg?.unit !== "garments") unknowns.push("effortMappingMissing");
  const evaluation =
    rule && localDateValid(today) && localDateValid(v.deliveryDate)
      ? await evaluateCommitment({
          shopId: ctx.templates.shopId,
          configuration: rule.configuration,
          configurationSource: `${rule.id}:v${rule.version}`,
          calendar: calendar ?? null,
          category: approvedCategory,
          load,
          scenario: {
            mode: "synthetic",
            fixture: "missing-load",
            categoryId,
            today,
            nowTime: time,
            bookingDate: today,
            bookingTime: time,
            deliveryDate: v.deliveryDate,
            deliveryTime: v.deliveryTime || null,
            quantity: cfg?.unit === "garments" ? 1 : null,
            unit: cfg?.unit ?? null,
            priority: v.priority,
            occasion: v.occasion,
            acknowledge: false,
            review: false,
            exceptionReason: "",
            waiver: false,
            waiverReason: "",
          },
          previousFingerprint: null,
        })
      : null;
  if (evaluation) unknowns.push(...evaluation.unknowns);
  const sources: OrderSources | null =
    manifest && categoryId && binding && rule && calendar && profile && policies
      ? {
          manifestId: manifest.id,
          definitionId: manifest.definition.id,
          categoryId,
          bindingId: binding.id,
          ruleId: rule.id,
          calendarId: calendar.id,
          profileId: profile.id,
          policiesId: policies.id,
          presentationId: v.presentationRevisionId,
        }
      : null;
  const forms = [];
  const wearerAuthority =
    v.customerId && v.wearerId
      ? await readWearer(ctx.wearers, v.customerId, v.wearerId)
      : null;
  const guardianAuthority =
    wearerAuthority?.age === "minor" && v.customerId && v.wearerId
      ? await readGuardians(ctx.guardians, v.customerId, v.wearerId)
      : null;
  const authority = wearerAuthority
    ? {
        wearerId: wearerAuthority.id,
        version: wearerAuthority.version,
        relationshipId: wearerAuthority.relationship.id,
        servicePurposes: wearerAuthority.purposes
          .filter((p) => p.purpose === "service")
          .map((p) => ({
            id: p.id,
            noticeId: p.noticeId,
            noticeVersion: p.noticeVersion,
            decision: p.decision,
            eligible: p.eligible,
          })),
        guardians:
          guardianAuthority?.authorities
            .filter((a) => a.verifiedCurrent)
            .map((a) => ({
              id: a.id,
              verifications: a.verifications.map((v) => v.id),
            })) ?? [],
      }
    : null;
  for (const ref of [
    ...(manifest?.definition.content.pieces ?? []),
    ...(manifest?.definition.content.addons ?? []),
  ]) {
    if (catalogueSources.some((s) => s.id === ref.revisionId)) continue;
    const exact = await ctx.templates.catalogue.repository.definition(
      ref.revisionId,
    );
    if (exact) catalogueSources.push(exact);
  }
  for (const ref of manifest?.definition.content.forms ?? []) {
    const f = await ctx.templates.forms.repository.definition(ref.revisionId);
    if (f) forms.push(f);
  }
  const { commitmentReview: _decision, ...intakeFacts } = v;
  const snapshot = {
    authority,
    sources,
    manifest,
    catalogue: catalogueSources,
    forms,
    presentation: v.presentationRevisionId
      ? await ctx.templates.repository.presentationRead(
          v.presentationRevisionId,
        )
      : null,
    rule,
    calendar,
    profile,
    policies,
    evaluation,
    load,
    model: "accepted-delivery-week-v1",
  };
  // Material review facts exclude volatile clock minutes and the decision itself.
  // Today, cut-off/rush warnings and authoritative load/source changes still invalidate it.
  const fingerprint = await requestHash({
    authority,
    intake: intakeFacts,
    requirements: intake.requirements?.fingerprint ?? null,
    sourceState: intake.sourceState,
    issues: intake.issues,
    price: intake.pricePaise,
    sources,
    load: load
      ? {
          quantity: load.quantity,
          unit: load.unit,
          weekStart: load.weekStart,
          source: load.source,
        }
      : null,
    unknowns,
    today,
    facts: evaluation?.facts ?? null,
    warnings: evaluation?.warnings ?? null,
  });
  const review: OrderReview = {
    fingerprint,
    intake,
    evaluation,
    unknowns: [...new Set(unknowns)],
    synthetic: !!synthetic,
    serverDate: today,
  };
  return { review, sources, snapshot };
}
export async function reviewQuickOrder(
  ctx: QuickOrderContext,
  input: unknown,
): Promise<OrderReview> {
  const p = quickOrderDraftSchema.safeParse(input);
  if (!p.success) fail("VALIDATION_FAILED", 422);
  return (await resolveOrderAcceptance(ctx, p.data)).review;
}
export async function readAcceptedOrder(
  ctx: QuickOrderContext,
  id: string,
): Promise<AcceptedOrder> {
  if (!idempotencyHeaderSchema.safeParse(id).success)
    fail("VALIDATION_FAILED", 422);
  const r = await acceptance(ctx).repository.read(id);
  if (!r) fail("NOT_FOUND", 404);
  const identity = await references(ctx, r.intake);
  return { ...r, customer: identity.customer, wearer: identity.wearer };
}
export async function listAcceptedOrders(
  ctx: QuickOrderContext,
  input: unknown,
) {
  const q = orderListQuerySchema.safeParse(input);
  if (!q.success) fail("VALIDATION_FAILED", 422);
  const rows = await acceptance(ctx).repository.list(q.data.before),
    orders = [];
  for (const r of rows.slice(0, 25))
    try {
      orders.push(await readAcceptedOrder(ctx, r.id));
    } catch (e) {
      if (!(e instanceof DraftFailure) || e.status !== 404) throw e;
    }
  return { orders, next: rows.length > 25 ? (rows[24]?.id ?? null) : null };
}
export async function readOrderHistory(
  ctx: QuickOrderContext,
  id: string,
  input: unknown,
) {
  const q = orderHistoryQuerySchema.safeParse(input);
  if (!q.success) fail("VALIDATION_FAILED", 422);
  await readAcceptedOrder(ctx, id);
  const rows = await acceptance(ctx).repository.history(
    id,
    q.data.beforeVersion,
  );
  return {
    entries: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}

export async function readOrderPieces(
  ctx: QuickOrderContext,
  id: string,
): Promise<OrderPieces> {
  const order = await readAcceptedOrder(ctx, id);
  const identity = await references(ctx, order.intake);
  if (
    identity.issues.some((i) => i === "guardian" || i === "servicePermission")
  )
    fail("NOT_FOUND", 404);
  const structure = projectOrderPieces(order);
  const supported =
    structure && (await requestHash(order.snapshot)) === order.snapshotDigest;
  const stored = await acceptance(ctx).repository.pieces.read(order.id);
  if (supported && stored) {
    if (
      stored.snapshotDigest !== order.snapshotDigest ||
      stored.provenance?.digest !== (await requestHash(structure)) ||
      (await requestHash(stored.structure)) !== (await requestHash(structure))
    )
      fail("REQUEST_CONFLICT");
    return stored;
  }
  return orderPiecesSchema.parse({
    schemaVersion: 1,
    orderId: order.id,
    orderVersion: order.version,
    snapshotDigest: order.snapshotDigest,
    state: supported ? "historical-preview" : "unsupported",
    structure: supported ? structure : null,
    identities: [],
    provenance: null,
    execution: "unavailable",
  });
}

export async function materializeOrderPieces(
  ctx: QuickOrderContext,
  id: string,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const p = materializeOrderPiecesSchema.safeParse(input),
    expected = parseExpectedVersion(headers.ifMatch);
  if (
    !p.success ||
    ![id, headers.key, headers.requestId].every(
      (v) => idempotencyHeaderSchema.safeParse(v).success,
    )
  )
    fail("VALIDATION_FAILED", 422);
  if (!expected.ok)
    throw new DraftFailure(expected.status, {
      error: { code: expected.code, message: "Check order version" },
    });
  const orders = acceptance(ctx).repository,
    repo = orders.pieces,
    key = (headers.key as string).toLowerCase();
  const actor = { type: "user" as const, id: ctx.templates.actorId };
  const binding = {
    actor,
    action: "order.pieces.materialize",
    hash: await requestHash({
      id: id.toLowerCase(),
      input: p.data,
      expected: expected.version,
      actor,
    }),
  };
  await repo.lockKey(key);
  const prior = await repo.replay(key);
  // Reauthorise before returning any structural content, including replay/conflict.
  if (prior) {
    await readOrderPieces(ctx, id);
    if (
      prior.actor.id !== actor.id ||
      prior.actor.type !== actor.type ||
      prior.action !== binding.action ||
      prior.hash !== binding.hash
    )
      throw new DraftFailure(422, {
        error: { code: "IDEMPOTENCY_MISMATCH", message: "Request changed" },
      });
    return orderPiecesSchema.parse(prior.response);
  }
  await orders.lockOrder(id);
  const current = await readOrderPieces(ctx, id);
  if (current.orderVersion !== expected.version)
    throw new OrderFailure(412, {
      error: {
        code: "VERSION_STALE",
        message: "Reload order before preparing pieces",
      },
      current: await readAcceptedOrder(ctx, id),
    });
  if (
    current.state !== "historical-preview" ||
    !current.structure ||
    p.data.snapshotDigest !== current.snapshotDigest
  )
    fail("REQUEST_CONFLICT");
  await repo.write({
    orderId: current.orderId,
    orderVersion: current.orderVersion,
    snapshotDigest: current.snapshotDigest,
    structure: current.structure,
    digest: await requestHash(current.structure),
    actorId: actor.id,
    key,
    requestId: headers.requestId,
    reason: p.data.reason,
    acceptance: false,
  });
  const result = await readOrderPieces(ctx, id);
  await repo.persist(key, binding, result);
  return result;
}
export async function changeOrderPresentation(
  ctx: QuickOrderContext,
  id: string,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const p = orderModeSchema.safeParse(input),
    expected = parseExpectedVersion(headers.ifMatch);
  if (
    !p.success ||
    ![id, headers.key, headers.requestId].every(
      (v) => idempotencyHeaderSchema.safeParse(v).success,
    )
  )
    fail("VALIDATION_FAILED", 422);
  if (!expected.ok)
    throw new DraftFailure(expected.status, {
      error: { code: expected.code, message: "Check order version" },
    });
  const repo = acceptance(ctx).repository,
    key = (headers.key as string).toLowerCase(),
    actor = { type: "user" as const, id: ctx.templates.actorId };
  const binding = {
    actor,
    action: "order.presentation",
    hash: await requestHash({
      shopId: ctx.templates.shopId,
      id: id.toLowerCase(),
      input: p.data,
      expected: expected.version,
      actor,
    }),
  };
  await repo.lockKey(key);
  const prior = await repo.replay(key);
  if (prior) {
    if (
      prior.actor.id !== actor.id ||
      prior.actor.type !== actor.type ||
      prior.action !== binding.action ||
      prior.hash !== binding.hash
    )
      throw new DraftFailure(422, {
        error: { code: "IDEMPOTENCY_MISMATCH", message: "Request changed" },
      });
    await readAcceptedOrder(ctx, id);
    return acceptedOrderSchema.parse(prior.response);
  }
  await repo.lockOrder(id);
  const current = await readAcceptedOrder(ctx, id);
  if (current.version !== expected.version)
    throw new OrderFailure(412, {
      error: {
        code: "VERSION_STALE",
        message: "Reload order before changing presentation",
      },
      current,
    });
  if (current.version === 2147483647) fail("REQUEST_CONFLICT");
  await repo.mode(id, p.data.mode, actor.id, key, headers.requestId);
  const result = await readAcceptedOrder(ctx, id);
  await repo.persist(key, binding, result);
  return result;
}
