import {
  type PatternBinding,
  type PatternComparison,
  type PatternDraft,
  type PatternVersion,
  patternCapabilityCommandSchema,
  patternCapabilityDraftSchema,
  patternCommandSchema,
  patternCompareQuerySchema,
  patternDraftSchema,
  patternPageSchema,
  patternQuerySchema,
} from "@aarili/contracts/manual-patterns";
import type { ManualPatternsRepository } from "@aarili/db/repositories/manual-patterns";
import type { DesignSpecificationsContext } from "./design-specifications.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { authorizeMeasurementIdentity } from "./measurement-access.js";
import {
  type MeasurementSessionsContext,
  readMeasurement,
} from "./measurement-sessions.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import { requestHash } from "./request-binding.js";

export type ManualPatternsContext = {
  actorId: string;
  repository: ManualPatternsRepository;
  specifications: DesignSpecificationsContext;
  measurements: MeasurementSessionsContext;
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
      message:
        "Review the exact pattern reference, inputs and current authority",
    },
  });
}
async function binding(ctx: ManualPatternsContext, b: PatternBinding) {
  const { choices } = ctx.specifications;
  await choices.catalogue.repository.lock();
  await choices.templates.forms.repository.lock();
  await choices.templates.repository.lock();
  const manifest = await choices.templates.repository.definition(
    b.manifest.revisionId,
  );
  if (
    !manifest ||
    manifest.entryId !== b.manifest.entryId ||
    manifest.content.kind !== "service-template" ||
    !manifest.content.service
  )
    fail(404);
  const piece =
    b.pieceKey === null
      ? null
      : manifest.content.pieces.find((p) => p.key === b.pieceKey);
  if (b.pieceKey !== null && piece?.applicability !== "applicable") fail(404);
  const current = await choices.templates.repository.current(manifest.entryId);
  let available = !!current?.available && current.definition.id === manifest.id;
  const refs = [manifest.content.service, ...(piece ? [piece] : [])];
  const seen = new Set<string>();
  for (let ref = refs.shift(); ref; ref = refs.shift()) {
    if (seen.has(ref.entryId)) continue;
    seen.add(ref.entryId);
    const d = await choices.catalogue.repository.definition(ref.revisionId);
    if (!d || d.entryId !== ref.entryId) fail(404);
    const c = await choices.catalogue.repository.current(ref.entryId);
    available = available && !!c?.available && c.definition.id === d.id;
    if (d.content.parent) refs.push(d.content.parent);
  }
  await ctx.repository.lock(b);
  return { manifest, available };
}
async function scope(
  ctx: ManualPatternsContext,
  q: { orderId: string; pieceId: string | null },
) {
  const { orders } = ctx.measurements,
    r = orders.acceptance?.repository;
  if (
    !r ||
    (await ctx.specifications.repository.orderKind(q.orderId)) !== "custom"
  )
    fail(404);
  const member = await r.bookings.membership(q.orderId);
  if (member) await r.bookings.lock(member);
  await r.lockOrder(q.orderId);
  if ((await r.bookings.membership(q.orderId)) !== member) fail();
  const order = await readAcceptedOrder(orders, q.orderId),
    pieces = await readOrderPieces(orders, q.orderId);
  const { customerId, wearerId, manifest } = order.intake;
  if (
    !customerId ||
    !wearerId ||
    !manifest ||
    pieces.state === "unsupported" ||
    !pieces.structure
  )
    fail(404);
  const piece = q.pieceId
    ? pieces.identities.find((p) => p.id === q.pieceId)
    : null;
  if (q.pieceId && !piece) fail(404);
  const wearer = await authorizeMeasurementIdentity(
    {
      wearers: orders.wearers.repository,
      guardians: orders.guardians.repository,
      measurements: ctx.measurements.repository,
      policy: orders.wearers.policy,
    },
    { customerId, wearerId },
  );
  const b: PatternBinding = {
    manifest: { entryId: manifest.entryId, revisionId: manifest.definitionId },
    pieceKey: piece?.key ?? null,
  };
  const config = await binding(ctx, b);
  await ctx.repository.lockScope(q.orderId, q.pieceId);
  const design = await ctx.specifications.repository.state(
    q.orderId,
    q.pieceId,
  );
  const measurement = await ctx.measurements.repository.selection(
    q.orderId,
    q.pieceId,
  );
  return {
    order,
    customerId,
    wearerId,
    wearerVersion: wearer.version,
    binding: b,
    ...config,
    design,
    measurement,
  };
}
type Scope = Awaited<ReturnType<typeof scope>>;
async function authority(ctx: ManualPatternsContext, v: PatternDraft) {
  if (v.erased) fail(404);
  const s = await scope(ctx, v);
  if (s.customerId !== v.customerId || s.wearerId !== v.wearerId) fail(404);
  return s;
}
async function inputs(
  ctx: ManualPatternsContext,
  v: PatternDraft["content"],
  s: Scope,
  q: { orderId: string; pieceId: string | null },
) {
  if (v.design.state === "known") {
    if (!v.design.versionId) fail(422);
    const d = await ctx.specifications.repository.read(v.design.versionId);
    if (
      !d ||
      d.redacted ||
      d.orderId !== q.orderId ||
      d.pieceId !== q.pieceId ||
      d.wearerId !== s.wearerId ||
      d.customerId !== s.customerId
    )
      fail(404);
  } else if (v.design.state === "not-applicable") {
    const d = await ctx.specifications.choices.repository.definition(
      v.design.policy.revisionId,
    );
    if (
      !d ||
      d.entryId !== v.design.policy.entryId ||
      d.content.kind !== "profile" ||
      d.content.decision !== "not-applicable" ||
      d.content.manifest?.revisionId !== s.binding.manifest.revisionId ||
      d.content.pieceKey !== s.binding.pieceKey
    )
      fail();
  }
  if (v.measurement.state === "known") {
    if (!v.measurement.versionId) fail(422);
    const m = await readMeasurement(
      ctx.measurements,
      v.measurement.versionId,
      s,
    );
    const forms = s.manifest.content.forms.filter(
      (f) => f.pieceKey === s.binding.pieceKey,
    );
    if (
      m.redacted ||
      forms.length !== 1 ||
      forms[0]?.revisionId !== m.form.id ||
      forms[0]?.entryId !== m.form.entryId
    )
      fail(404);
  } else if (v.measurement.state === "not-applicable") {
    const f =
      await ctx.specifications.choices.templates.forms.repository.definition(
        v.measurement.policy.revisionId,
      );
    if (
      !f ||
      f.entryId !== v.measurement.policy.entryId ||
      f.content.decision !== "not-required" ||
      !s.manifest.content.forms.some(
        (b) =>
          b.pieceKey === s.binding.pieceKey &&
          b.entryId === f.entryId &&
          b.revisionId === f.id,
      )
    )
      fail();
  }
}
async function comparison(
  ctx: ManualPatternsContext,
  q: { orderId: string; pieceId: string | null },
  v: PatternVersion,
  s: Scope,
) {
  const state = await ctx.repository.state(q),
    cap = await ctx.repository.capability(s.binding),
    review = await ctx.repository.review(v.id);
  if (
    v.orderId !== q.orderId ||
    v.pieceId !== q.pieceId ||
    v.wearerId !== s.wearerId ||
    v.customerId !== s.customerId ||
    !v.content ||
    v.redacted
  )
    fail(404);
  const c = v.content;
  let inputState: PatternComparison["inputState"] = "matched";
  for (const [input, current] of [
    [c.design, s.design.currentId],
    [c.measurement, s.measurement.selectedId],
  ] as const) {
    if (input.state === "known" && input.versionId !== current)
      inputState = "mismatch";
    else if (input.state === "unknown" && inputState !== "mismatch")
      inputState = "unknown";
    else if (input.state === "not-applicable" && current !== null)
      inputState = "mismatch";
  }
  const contextDigest = await requestHash({
    referenceId: v.id,
    designId: s.design.currentId,
    designVersion: s.design.version,
    measurementId: s.measurement.selectedId,
    measurementVersion: s.measurement.version,
    capabilityId: cap?.id ?? null,
    available: s.available,
    wearerVersion: s.wearerVersion,
    orderVersion: s.order.version,
    snapshot: s.order.snapshotDigest,
  });
  const reviewState =
    review &&
    !review.redacted &&
    (review.contextDigest === contextDigest ||
      review.reviewState === "changes-required" ||
      review.reviewState === "withdrawn")
      ? (review.reviewState ?? "unreviewed")
      : "unreviewed";
  const blocked: PatternComparison["blocked"] = [];
  if (!s.available || cap?.[v.method] !== "available")
    blocked.push("path-unavailable");
  if (inputState !== "matched") blocked.push("input-review-needed");
  if (reviewState !== "reviewed") blocked.push("reference-not-reviewed");
  if (await ctx.specifications.repository.governed(q.orderId))
    blocked.push("governed-work");
  return {
    contextDigest,
    comparison: {
      referenceId: v.id,
      digest: await requestHash({
        contextDigest,
        scopeVersion: state.version,
        reviewId: review?.id ?? null,
      }),
      designId: s.design.currentId,
      measurementId: s.measurement.selectedId,
      inputState,
      reviewState,
      blocked,
    } satisfies PatternComparison,
  };
}
async function resolve(ctx: ManualPatternsContext, v: PatternDraft) {
  const s = await authority(ctx, v),
    state = await ctx.repository.state(v);
  if (state.version !== v.baseVersion || state.latestSavedId !== v.baseSavedId)
    fail(412);
  const cap = await ctx.repository.capability(s.binding);
  if (!s.available || !cap || cap[v.method] !== "available") fail();
  if (v.operation === "save") await inputs(ctx, v.content, s, v);
  let contextDigest = await requestHash({
    binding: s.binding,
    capabilityId: cap.id,
  });
  if (v.operation === "review" || v.operation === "select") {
    if (!v.referenceId) fail(422);
    const ref = await ctx.repository.read(v.referenceId);
    if (!ref || ref.method !== v.method || !ref.content) fail(404);
    await inputs(ctx, ref.content, s, v);
    const c = await comparison(ctx, v, ref, s);
    if (c.comparison.digest !== v.digest) fail(412);
    contextDigest = c.contextDigest;
    if (v.operation === "select") {
      const r = c.comparison;
      if (
        r.blocked.includes("governed-work") ||
        ["changes-required", "withdrawn"].includes(
          (await ctx.repository.review(ref.id))?.reviewState ?? "",
        )
      )
        fail();
      if (v.use === "inputs-reviewed" && r.blocked.length) fail();
    }
  }
  if (
    v.operation === "prepare" &&
    state.currentId !== null &&
    state.method !== v.method
  )
    fail();
  return { s, cap, contextDigest };
}
export function patternCapabilityWorkflow(
  ctx: ManualPatternsContext,
): DraftWorkflow {
  const check = async (p: Record<string, unknown>) => {
    const v = patternCapabilityDraftSchema.parse(p);
    const b = await binding(ctx, v.binding);
    if (!b.available) fail();
    return v;
  };
  return {
    schemaVersion: 1,
    draftSchema: patternCapabilityDraftSchema,
    commandSchema: patternCapabilityCommandSchema,
    async authorizeDraft(p) {
      await check(p);
    },
    async authorizePublication(p) {
      await check(p);
    },
    validateEdit(a, b) {
      if (JSON.stringify(a.binding) !== JSON.stringify(b.binding)) fail();
    },
    async revalidate(p) {
      const v = await check(p),
        current = await ctx.repository.capability(v.binding);
      if (v.baseVersion !== (current?.version ?? 0)) fail(412);
    },
    async promote(p, _action, draftId, request) {
      const v = await check(p);
      return {
        type: "pattern.capability",
        id: await ctx.repository.writeCapability({
          ...v,
          ...request,
          draftId,
          actorId: ctx.actorId,
        }),
      };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "pattern.capability" ||
        !(await ctx.repository.origin(r.id, draftId, "capability"))
      )
        fail();
    },
  };
}
export function patternReferenceWorkflow(
  ctx: ManualPatternsContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: patternDraftSchema,
    commandSchema: patternCommandSchema,
    minimalReplay: true,
    validateEdit(a, b) {
      for (const k of ["orderId", "pieceId", "customerId", "wearerId"] as const)
        if (a[k] !== b[k]) fail();
    },
    async authorizeDraft(p) {
      await authority(ctx, patternDraftSchema.parse(p));
    },
    async authorizePublication(p) {
      await authority(ctx, patternDraftSchema.parse(p));
    },
    async replayPayload(id, version) {
      const p = await ctx.repository.replayPayload(id, version);
      await authority(ctx, patternDraftSchema.parse(p));
      return ctx.repository.replayPayload(id, version);
    },
    retainPrivateResponse: (r, a, k) =>
      ctx.repository.retainPrivateResponse(r, a, k),
    async revalidate(p) {
      await resolve(ctx, patternCommandSchema.parse(p));
    },
    async promote(p, _action, draftId, request) {
      const v = patternCommandSchema.parse(p),
        r = await resolve(ctx, v);
      return {
        type: "pattern.reference",
        id: await ctx.repository.write(
          { ...v, ...request, draftId, actorId: ctx.actorId },
          r.cap.id,
          r.contextDigest,
        ),
      };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "pattern.reference" ||
        !(await ctx.repository.origin(r.id, draftId, "reference"))
      )
        fail();
    },
  };
}
export async function comparePattern(
  ctx: ManualPatternsContext,
  input: unknown,
) {
  const q = patternCompareQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const s = await scope(ctx, q.data),
    v = await ctx.repository.read(q.data.referenceId);
  if (!v) fail(404);
  return (await comparison(ctx, q.data, v, s)).comparison;
}
export async function readPatterns(ctx: ManualPatternsContext, input: unknown) {
  const q = patternQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const s = await scope(ctx, q.data),
    state = await ctx.repository.state(q.data),
    capability = await ctx.repository.capability(s.binding),
    capabilities = await ctx.repository.capabilities(
      s.binding,
      q.data.beforeCapability,
    );
  const selected = state.currentId
    ? await ctx.repository.read(state.currentId)
    : null;
  const refs = [...state.versions];
  if (selected && !refs.some((v) => v.id === selected.id)) refs.push(selected);
  const comparisons = [];
  for (const v of refs)
    if (!v.redacted && v.content)
      comparisons.push((await comparison(ctx, q.data, v, s)).comparison);
  return patternPageSchema.parse({
    state,
    selected: selected ?? null,
    binding: s.binding,
    capability: capability ?? null,
    capabilities: capabilities.slice(0, 25),
    nextCapability:
      capabilities.length > 25 ? (capabilities[24]?.version ?? null) : null,
    customerId: s.customerId,
    wearerId: s.wearerId,
    designId: s.design.currentId,
    measurementId: s.measurement.selectedId,
    comparisons,
    available: s.available,
  });
}
