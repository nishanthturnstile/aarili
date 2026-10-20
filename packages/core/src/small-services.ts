import {
  orderListQuerySchema,
  type QuickOrderDraft,
} from "@aarili/contracts/orders";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  type ServiceRequirementsPreview,
  templateSections,
} from "@aarili/contracts/service-templates";
import {
  type ServiceOrderDraft,
  type ServiceOrderReview,
  type ServiceProfileRevision,
  serviceOrderCommandSchema,
  serviceOrderDraftSchema,
  serviceProfileCommandSchema,
  serviceProfileDraftSchema,
  serviceProfileHistoryQuerySchema,
  serviceProfileQuerySchema,
} from "@aarili/contracts/small-services";
import type { SmallServicesRepository } from "@aarili/db/repositories/small-services";
import { parseRupees } from "@aarili/money";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  orderReferences,
  type QuickOrderContext,
  readAcceptedOrder,
  resolveServiceOrderAcceptance,
} from "./orders.js";
import { requestHash } from "./request-binding.js";
import { serviceTemplatesReferencesEligible } from "./service-templates.js";

export type SmallServiceContext = {
  orders: QuickOrderContext;
  repository: SmallServicesRepository;
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
      message: "Review service intake",
    },
  });
}
function enabled(ctx: SmallServiceContext) {
  if (
    !ctx.orders.templates.synthetic ||
    !ctx.orders.customers.policy.enabled ||
    !ctx.orders.customers.policy.synthetic
  )
    fail();
}
async function lockSources(ctx: SmallServiceContext) {
  await ctx.orders.templates.catalogue.repository.lock();
  await ctx.orders.templates.forms.repository.lock();
  await ctx.orders.templates.repository.lock();
  await ctx.repository.lock();
}
async function profileSources(
  ctx: SmallServiceContext,
  profile:
    | ServiceProfileRevision
    | { content: ServiceProfileRevision["content"] },
) {
  const c = profile.content,
    ref = c.manifest;
  if (!ref) fail(422);
  const template = await ctx.orders.templates.repository.read(ref.revisionId);
  const current = await ctx.orders.templates.repository.current(ref.entryId);
  if (
    !template ||
    template.entryId !== ref.entryId ||
    template.definition.id !== ref.definitionId
  )
    fail(404);
  if (
    !current?.available ||
    current.id !== template.id ||
    !(await serviceTemplatesReferencesEligible(ctx.orders.templates, current))
  )
    fail();
  const serviceRef = template.definition.content.service;
  const service = serviceRef
    ? await ctx.orders.templates.catalogue.repository.definition(
        serviceRef.revisionId,
      )
    : undefined;
  if (
    !service ||
    !["alteration", "small-service"].includes(service.content.serviceKind ?? "")
  )
    fail(422);
  if (c.wearerRequirement === "not-required") {
    if (
      service.content.serviceKind !== "small-service" ||
      !c.wearerReason.trim()
    )
      fail(422);
    for (const formRef of template.definition.content.forms) {
      const form = await ctx.orders.templates.forms.repository.definition(
        formRef.revisionId,
      );
      if (
        form?.content.decision !== "not-required" ||
        form.content.groups.some((g) => g.fields.length)
      )
        fail(422);
    }
  }
  for (const line of c.lines) {
    if (!line.coverageKey.trim()) fail(422);
    const addon = line.addonKey
      ? template.definition.content.addons.find((a) => a.key === line.addonKey)
      : null;
    if (line.addonKey && addon?.applicability !== "applicable") fail(422);
    if (line.optional) {
      const source = service.content.addons.find(
        (a) =>
          a.entryId === addon?.entryId && a.revisionId === addon?.revisionId,
      );
      if (!addon || !source?.optional) fail(422);
    }
    if (
      line.taskKey &&
      !template.definition.content.tasks.some(
        (t) =>
          t.key === line.taskKey &&
          t.scope.addonKey === line.addonKey &&
          t.applicability !== "not-applicable",
      )
    )
      fail(422);
  }
  if (
    new Set(c.lines.map((l) => l.addonKey ?? "$base")).size !== c.lines.length
  )
    fail(422);
  if (
    service.content.serviceKind === "alteration" &&
    !c.lines.some((l) => l.addonKey === null && !l.optional)
  )
    fail(422);
  for (const required of service.content.addons.filter((a) => !a.optional)) {
    const addon = template.definition.content.addons.find(
      (a) =>
        a.entryId === required.entryId && a.revisionId === required.revisionId,
    );
    if (!addon || !c.lines.some((l) => l.addonKey === addon.key && !l.optional))
      fail(422);
  }
  return { template, service };
}
async function eligible(ctx: SmallServiceContext, p: ServiceProfileRevision) {
  if (!p.available) return false;
  try {
    await profileSources(ctx, p);
    return true;
  } catch (e) {
    if (e instanceof DraftFailure) return false;
    throw e;
  }
}
export async function readServiceProfiles(
  ctx: SmallServiceContext,
  input: unknown,
) {
  enabled(ctx);
  const q = serviceProfileQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const rows = await ctx.repository.profiles(q.data.before),
    profiles = [];
  for (const r of rows.slice(0, 25))
    profiles.push({ ...r, eligible: await eligible(ctx, r) });
  return {
    profiles,
    next: rows.length > 25 ? (rows[24]?.entryId ?? null) : null,
  };
}
export async function readServiceProfile(ctx: SmallServiceContext, id: string) {
  enabled(ctx);
  if (!idempotencyHeaderSchema.safeParse(id).success) fail(422);
  const p = await ctx.repository.readProfile(id);
  if (!p) fail(404);
  return p;
}
export async function readServiceProfileHistory(
  ctx: SmallServiceContext,
  input: unknown,
) {
  enabled(ctx);
  const q = serviceProfileHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const rows = await ctx.repository.history(
    q.data.entryId,
    q.data.beforeVersion,
  );
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function serviceProfileDraftWorkflow(
  ctx: SmallServiceContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: serviceProfileDraftSchema,
    commandSchema: serviceProfileCommandSchema,
    async authorizeDraft() {
      enabled(ctx);
    },
    async authorizePublication() {
      enabled(ctx);
    },
    async revalidate(input) {
      enabled(ctx);
      const v = serviceProfileCommandSchema.parse(input);
      await lockSources(ctx);
      const current = await ctx.repository.current(v.entryId);
      if (
        (current?.version ?? 0) !== v.baseVersion ||
        (current?.id ?? null) !== v.baseRevisionId
      )
        fail(412);
      // Disabling preserves its exact historic sources even when those sources changed.
      if (
        !v.available &&
        current &&
        (await requestHash(v.content)) === (await requestHash(current.content))
      )
        return;
      await profileSources(ctx, v);
    },
    async promote(input, _action, draftId, request) {
      const v = serviceProfileCommandSchema.parse(input);
      const revision = await ctx.repository.append({
        ...v,
        ...request,
        actorId: ctx.orders.templates.actorId,
        originDraftId: draftId,
        authority: ctx.orders.templates.synthetic
          ? "synthetic-fixture"
          : "owner-proposal",
        digest: await requestHash(v.content),
      });
      if (!(await ctx.repository.advance(revision, v.baseVersion))) fail(412);
      return { type: "service-profile.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      enabled(ctx);
      if (
        result.type !== "service-profile.revision" ||
        !(await ctx.repository.profileOrigin(result.id, draftId))
      )
        fail();
    },
  };
}
function adapter(
  v: ServiceOrderDraft,
  p: ServiceProfileRevision | null,
): QuickOrderDraft {
  return {
    customerId: v.customerId,
    wearerId: v.wearerId,
    manifest: p?.content.manifest ?? null,
    presentation: v.presentation,
    presentationRevisionId: v.presentationRevisionId,
    deliveryDate: v.deliveryDate,
    deliveryTime: v.deliveryTime,
    orderDate: v.orderDate,
    historicalReason: v.historicalReason,
    requestedDate: v.requestedDate,
    eventDate: v.eventDate,
    occasion: v.occasion,
    priority: v.priority,
    priceState: "to-be-quoted",
    priceText: "",
    instructions: v.instructions,
    commitmentReview: v.commitmentReview,
  };
}
async function identity(
  ctx: SmallServiceContext,
  v: ServiceOrderDraft,
  p: ServiceProfileRevision | null,
  requirePermissions: boolean,
) {
  enabled(ctx);
  // Same order -> customer -> wearer classes as grouped-booking authority.
  if (v.sourceOrderId) {
    if (!ctx.orders.acceptance) fail();
    await ctx.orders.acceptance.repository.lockOrder(v.sourceOrderId);
  }
  const refs = await orderReferences(ctx.orders, adapter(v, p));
  if (
    requirePermissions &&
    refs.issues.some((i) => i === "guardian" || i === "servicePermission")
  )
    fail(404);
  let source = null;
  if (v.sourceOrderId) {
    if (!ctx.orders.acceptance) fail();
    source = await ctx.repository.source(v.sourceOrderId, v.sourcePieceId);
    if (
      !source ||
      source.customerId !== v.customerId ||
      (source.wearerId !== null && source.wearerId !== v.wearerId)
    )
      fail(404);
    // Reauthorise the source, including its minor/guardian authority. A source is
    // contextual provenance only; this creates no correction or custody event.
    if (source.kind === "custom") {
      const sourceOrder = await readAcceptedOrder(ctx.orders, v.sourceOrderId);
      const r = await orderReferences(ctx.orders, sourceOrder.intake);
      if (r.issues.some((i) => i === "guardian" || i === "servicePermission"))
        fail(404);
    } else {
      const sourceOrder = await ctx.repository.readOrder(v.sourceOrderId);
      if (!sourceOrder) fail(404);
      const r = await orderReferences(
        ctx.orders,
        adapter(sourceOrder.intake, sourceOrder.profile),
      );
      if (r.issues.some((i) => i === "guardian" || i === "servicePermission"))
        fail(404);
    }
  } else if (v.sourcePieceId) fail(422);
  return { ...refs, source };
}
// One coverage group contributes once. Its exact quantity is reviewed on the
// profile; incompatible duplicate definitions cannot be silently summed.
export function serviceCapacity(
  profile: ServiceProfileRevision["content"],
  selected: { key: string; notRequired: boolean }[],
) {
  const groups = new Map<string, number | null>();
  for (const s of selected.filter((l) => !l.notRequired)) {
    const mapping = profile.lines.find((l) => l.key === s.key);
    if (!mapping) return null;
    if (
      groups.has(mapping.coverageKey) &&
      groups.get(mapping.coverageKey) !== mapping.quantity
    )
      return null;
    groups.set(mapping.coverageKey, mapping.quantity);
  }
  if (
    !profile.capacityUnit ||
    !groups.size ||
    [...groups.values()].some((q) => q === null)
  )
    return null;
  const total = [...groups.values()].reduce<number>(
    (sum, q) => sum + (q ?? 0),
    0,
  );
  return Number.isSafeInteger(total) && total > 0 && total <= 2147483647
    ? total
    : null;
}
// Project the exact configured checklist onto the accepted line selection. This
// is applicability evidence only: no execution, quality or lifecycle completion.
export async function projectServiceRequirements(
  requirements: ServiceRequirementsPreview,
  profile: ServiceProfileRevision,
  selected: { key: string; notRequired: boolean }[],
): Promise<ServiceRequirementsPreview> {
  const active = new Set(
    profile.content.lines
      .filter((mapping) =>
        selected.some((line) => line.key === mapping.key && !line.notRequired),
      )
      .map((line) => line.addonKey)
      .filter((key): key is string => key !== null),
  );
  const excluded = new Set(
    requirements.definition.addons
      .filter((addon) => !active.has(addon.key))
      .map((addon) => addon.key),
  );
  const items = requirements.items.map((item) => {
    const configured = templateSections
      .flatMap((section) =>
        section === item.section ? requirements.definition[section] : [],
      )
      .find((definition) => definition.key === item.key);
    const addon = configured?.scope.addonKey;
    return addon && excluded.has(addon)
      ? {
          ...item,
          applicability: "not-applicable" as const,
          state: "not-required" as const,
          source: `service-profile:${profile.id}:not-selected:${addon}`,
        }
      : item;
  });
  const milestones = requirements.milestones.map((milestone) => {
    if (milestone.state === "lifecycle") return milestone;
    const tasks = items.filter(
      (item) =>
        item.section === "tasks" && milestone.taskKeys.includes(item.key),
    );
    return {
      ...milestone,
      state:
        tasks.length && tasks.every((task) => task.state === "not-required")
          ? ("not-applicable" as const)
          : milestone.state,
      requiredBlockers: tasks
        .filter(
          (task) => task.required !== false && task.state === "unresolved",
        )
        .map((task) => task.key),
    };
  });
  return {
    ...requirements,
    items,
    milestones,
    fingerprint: await requestHash({
      source: requirements.fingerprint,
      profile: profile.id,
      selected,
      items,
      milestones,
    }),
  };
}
async function resolve(ctx: SmallServiceContext, v: ServiceOrderDraft) {
  // Identity locks precede catalogue/profile/capacity locks on every command.
  let p = v.profile
    ? await ctx.repository.readProfile(v.profile.revisionId)
    : undefined;
  if (v.profile && (!p || p.entryId !== v.profile.entryId)) fail(404);
  const who = await identity(ctx, v, p ?? null, false);
  await lockSources(ctx);
  p = v.profile
    ? await ctx.repository.readProfile(v.profile.revisionId)
    : undefined;
  let sourceState: ServiceOrderReview["sourceState"] = "not-selected";
  if (p) {
    const current = await ctx.repository.current(p.entryId);
    sourceState = !current?.available
      ? "unavailable"
      : current.id !== p.id || !(await eligible(ctx, p))
        ? "changed"
        : "current";
  }
  const issues: string[] = [];
  // The shared profile lock also serializes service acceptance: a copied draft
  // keeps its recovery state and receives a domain conflict before UNIQUE denial.
  if (
    await ctx.repository.identityConflict(
      v.subjectId,
      v.lines.map((line) => line.id),
    )
  )
    issues.push("serviceIdentityConflict");
  if (!serviceOrderCommandSchema.safeParse(v).success)
    issues.push("incompleteIntake");
  if (sourceState !== "current") issues.push("serviceProfile");
  if (p?.authority !== "synthetic-fixture")
    issues.push("productionAuthorityPending");
  if (!v.wearerId && p?.content.wearerRequirement !== "not-required")
    issues.push("wearer");
  const lines: ServiceOrderReview["lines"] = [];
  const template = p?.content.manifest
    ? await ctx.orders.templates.repository.read(p.content.manifest.revisionId)
    : undefined;
  for (const line of v.lines) {
    const m = p?.content.lines.find((l) => l.key === line.key);
    if (!m) {
      issues.push("serviceLineSource");
      continue;
    }
    if (line.notRequired && !m.optional) issues.push("requiredServiceLine");
    let amount: number | null = null;
    if (!line.notRequired && line.priceState === "quoted")
      try {
        amount = parseRupees(line.priceText);
        if (amount === null) issues.push("priceText");
      } catch {
        issues.push("priceText");
      }
    if (
      line.notRequired &&
      (line.priceState !== "to-be-quoted" || line.priceText.trim())
    )
      issues.push("notRequiredPrice");
    const ref = m.addonKey
      ? template?.definition.content.addons.find((a) => a.key === m.addonKey)
      : template?.definition.content.service;
    const definition = ref
      ? await ctx.orders.templates.catalogue.repository.definition(
          ref.revisionId,
        )
      : undefined;
    if (!definition) issues.push("lineDefinition");
    lines.push({
      id: line.id,
      key: line.key,
      labelEn: definition?.content.labelEn ?? "",
      labelTa: definition?.content.labelTa ?? "",
      requestedWork: line.requestedWork,
      addonKey: m.addonKey,
      taskKey: m.taskKey,
      priceState: line.priceState,
      pricePaise: amount,
      state: line.notRequired ? "not-required" : "pending",
      notRequiredReason: line.notRequiredReason,
      sourceRevisionId: p?.id ?? "",
      coverageKey: m.coverageKey,
      quantity: m.quantity,
    });
  }
  if (
    p?.content.lines.some(
      (m) =>
        !m.optional && !v.lines.some((l) => l.key === m.key && !l.notRequired),
    )
  )
    issues.push("requiredServiceLine");
  const quantity = p ? serviceCapacity(p.content, v.lines) : null;
  if (quantity === null) issues.push("serviceCapacityMappingMissing");
  const required = lines.filter((l) => l.state !== "not-required");
  const sum = required.reduce((n, l) => n + BigInt(l.pricePaise ?? 0), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) issues.push("priceOverflow");
  const totalPaise =
    required.some((l) => l.pricePaise === null) ||
    sum > BigInt(Number.MAX_SAFE_INTEGER)
      ? null
      : Number(sum);
  const shared = await resolveServiceOrderAcceptance(
    ctx.orders,
    adapter(v, p ?? null),
    {
      wearerRequired: p?.content.wearerRequirement !== "not-required",
      quantity,
      unit: p?.content.capacityUnit ?? null,
    },
  );
  if (p && shared.review.intake.requirements)
    shared.review.intake.requirements = await projectServiceRequirements(
      shared.review.intake.requirements,
      p,
      v.lines,
    );
  issues.push(...shared.review.unknowns);
  const { commitmentReview: _decision, ...facts } = v;
  const fingerprint = await requestHash({
    intake: facts,
    profile: p ?? null,
    source: who.source,
    commitment: shared.review.fingerprint,
    requirements: shared.review.intake.requirements?.fingerprint ?? null,
    lines,
    quantity,
    totalPaise,
    issues: [...new Set(issues)],
  });
  const review: ServiceOrderReview = {
    fingerprint,
    profile: p ?? null,
    customer: who.customer,
    wearer: who.wearer,
    sourceState,
    lines,
    totalPaise,
    quantity,
    unit: p?.content.capacityUnit ?? null,
    commitment: shared.review,
    issues: [...new Set(issues)],
    effects: "none",
  };
  return { review, shared, profile: p, source: who.source };
}
export async function reviewServiceOrder(
  ctx: SmallServiceContext,
  input: unknown,
): Promise<ServiceOrderReview> {
  const p = serviceOrderDraftSchema.safeParse(input);
  if (!p.success) fail(422);
  return (await resolve(ctx, p.data)).review;
}
export function serviceOrderDraftWorkflow(
  ctx: SmallServiceContext,
): DraftWorkflow {
  let resolved: Awaited<ReturnType<typeof resolve>> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: serviceOrderDraftSchema,
    commandSchema: serviceOrderCommandSchema,
    async authorizeDraft(input) {
      const v = serviceOrderDraftSchema.parse(input);
      const p = v.profile
        ? await readServiceProfile(ctx, v.profile.revisionId)
        : null;
      if (p && p.entryId !== v.profile?.entryId) fail(404);
      await identity(ctx, v, p, true);
    },
    async authorizePublication(input) {
      const v = serviceOrderDraftSchema.parse(input);
      const p = v.profile
        ? await readServiceProfile(ctx, v.profile.revisionId)
        : null;
      if (p && p.entryId !== v.profile?.entryId) fail(404);
      await identity(ctx, v, p, true);
    },
    async revalidate(input) {
      const v = serviceOrderCommandSchema.parse(input);
      resolved = await resolve(ctx, v);
      const r = resolved.review,
        d = v.commitmentReview;
      if (
        r.issues.some(
          (i) =>
            i === "priceText" ||
            i === "priceOverflow" ||
            i === "notRequiredPrice",
        )
      )
        fail(422);
      if (
        !d?.acknowledged ||
        d.fingerprint !== r.fingerprint ||
        r.issues.length ||
        !resolved.profile ||
        !resolved.shared.sources ||
        !r.commitment?.evaluation
      )
        fail();
      if (
        r.commitment.evaluation.warnings.some(
          (w) => w === "capacityExceeded" || w === "cutoffPassed",
        ) &&
        !d.exceptionReason.trim()
      )
        fail(422);
      if (
        d.waiveRush &&
        (!r.commitment.evaluation.facts.rush || !d.waiverReason.trim())
      )
        fail(422);
    },
    async promote(input, _action, draftId, request) {
      if (
        !resolved?.profile ||
        !resolved.shared.sources ||
        !resolved.shared.review.intake.requirements
      )
        fail();
      const v = serviceOrderCommandSchema.parse(input);
      const snapshot = {
        ...resolved.shared.snapshot,
        intake: v,
        serviceProfile: resolved.profile,
        serviceSource: resolved.source,
        serviceLines: resolved.review.lines,
        serviceReview: resolved.review,
        requirements: resolved.shared.review.intake.requirements,
        decision: v.commitmentReview,
      };
      // Labels in snapshots are catalogue data; personal identity labels stay in
      // the authorised identity module and are re-resolved on each read.
      const privateReview = {
        ...resolved.review,
        customer: null,
        wearer: null,
        commitment: resolved.review.commitment
          ? {
              ...resolved.review.commitment,
              intake: {
                ...resolved.review.commitment.intake,
                customer: null,
                wearer: null,
              },
            }
          : null,
      };
      snapshot.serviceReview = privateReview;
      const r = await ctx.repository.accept({
        draftId,
        ...request,
        actorId: ctx.orders.templates.actorId,
        intake: v,
        profile: resolved.profile,
        review: privateReview,
        commitment: {
          ...resolved.shared.review,
          intake: {
            ...resolved.shared.review.intake,
            customer: null,
            wearer: null,
          },
        },
        requirements: resolved.shared.review.intake.requirements,
        sources: resolved.shared.sources,
        snapshot,
        digest: await requestHash(snapshot),
      });
      return { type: "service-order.accepted", id: r.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "service-order.accepted" ||
        !(await ctx.repository.orderOrigin(result.id, draftId))
      )
        fail();
      await readServiceOrder(ctx, result.id);
    },
  };
}
export async function readServiceOrder(ctx: SmallServiceContext, id: string) {
  enabled(ctx);
  if (!idempotencyHeaderSchema.safeParse(id).success) fail(422);
  const r = await ctx.repository.readOrder(id);
  if (!r) fail(404);
  const who = await identity(ctx, r.intake, r.profile, true);
  if (
    !r.intake.wearerId &&
    r.profile.content.wearerRequirement !== "not-required"
  )
    fail(404);
  return { ...r, customer: who.customer, wearer: who.wearer };
}
export async function listServiceOrders(
  ctx: SmallServiceContext,
  input: unknown,
) {
  enabled(ctx);
  const q = orderListQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const rows = await ctx.repository.orders(q.data.before),
    orders = [];
  for (const id of [
    ...new Set(
      rows
        .slice(0, 25)
        .map((r) => r.intake.sourceOrderId)
        .filter((id): id is string => !!id),
    ),
  ].sort())
    await ctx.orders.acceptance?.repository.lockOrder(id);
  for (const id of [
    ...new Set(
      rows
        .slice(0, 25)
        .map((r) => r.intake.customerId)
        .filter((id): id is string => !!id),
    ),
  ].sort())
    await ctx.orders.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(
      rows
        .slice(0, 25)
        .map((r) => r.intake.wearerId)
        .filter((id): id is string => !!id),
    ),
  ].sort())
    await ctx.orders.wearers.repository.lockWearer(id);
  for (const r of rows.slice(0, 25))
    try {
      orders.push(await readServiceOrder(ctx, r.id));
    } catch (e) {
      if (!(e instanceof DraftFailure) || e.status !== 404) throw e;
    }
  return { orders, next: rows.length > 25 ? (rows[24]?.id ?? null) : null };
}
