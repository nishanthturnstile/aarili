import {
  type PatternBinding,
  type PatternComparison,
  type PatternDraft,
  type PatternReferenceV2Draft,
  type PatternSubject,
  type PatternVersion,
  patternAssetsQuerySchema,
  patternCapabilityCommandSchema,
  patternCapabilityDraftSchema,
  patternCommandSchema,
  patternCompareQuerySchema,
  patternDraftSchema,
  patternPageSchema,
  patternPurgeLocatorSchema,
  patternQuerySchema,
  patternReadQuerySchema,
  patternReferenceV2CommandSchema,
  patternReferenceV2DraftSchema,
  patternReuseQuerySchema,
  patternSubjectDraftSchema,
} from "@aarili/contracts/manual-patterns";
import type { ManualPatternsRepository } from "@aarili/db/repositories/manual-patterns";
import type { MediaRepository } from "@aarili/db/repositories/media";
import type { OrdersRepository } from "@aarili/db/repositories/orders";
import type { DesignSpecificationsContext } from "./design-specifications.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  authorizeMeasurementIdentity,
  type MeasurementAuthority,
} from "./measurement-access.js";
import {
  type MeasurementFitPurgeHost,
  purgePrivateMedia,
} from "./measurement-fit-purge.js";
import {
  type MeasurementSessionsContext,
  readMeasurement,
} from "./measurement-sessions.js";
import {
  type MediaContext,
  MediaFailure,
  type MediaPolicy,
  readMedia,
} from "./media.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import { requestHash } from "./request-binding.js";

export type ManualPatternsContext = {
  actorId: string;
  repository: ManualPatternsRepository;
  specifications: DesignSpecificationsContext;
  measurements: MeasurementSessionsContext;
  media: MediaRepository;
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
// Discover source aggregates before target identity/catalogue/reference locks.
async function chain(ctx: ManualPatternsContext, v: PatternVersion) {
  const rows = [v],
    seen = new Set([v.id]);
  while (rows.at(-1)?.source) {
    const id = rows.at(-1)?.source?.referenceId;
    if (!id || seen.has(id) || rows.length >= 16) fail();
    const source = await ctx.repository.read(id);
    if (!source) fail(404);
    rows.push(source);
    seen.add(id);
  }
  return rows;
}
async function prepareReferences(
  ctx: ManualPatternsContext,
  target: { orderId: string },
  refs: PatternVersion[],
  recheck?: () => Promise<boolean>,
) {
  const rows: PatternVersion[] = [];
  for (const ref of refs) rows.push(...(await chain(ctx, ref)));
  const r = ctx.measurements.orders.acceptance?.repository;
  if (!r) fail();
  const ids = [
    ...new Set([target.orderId, ...rows.map((v) => v.orderId)]),
  ].sort();
  const members = new Map<string, string | undefined>();
  for (const id of ids) members.set(id, await r.bookings.membership(id));
  for (const id of [
    ...new Set([...members.values()].filter((v): v is string => !!v)),
  ].sort())
    await r.bookings.lock(id);
  for (const id of ids) await r.lockOrder(id);
  if (recheck && !(await recheck())) fail(412);
  const orders = [];
  for (const id of ids) {
    if ((await r.bookings.membership(id)) !== members.get(id)) fail();
    const o = await r.read(id);
    if (!o) fail(404);
    orders.push(o);
  }
  for (const id of [
    ...new Set(
      orders.map((o) => o.intake.customerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.measurements.orders.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(
      orders.map((o) => o.intake.wearerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.measurements.orders.wearers.repository.lockWearer(id);
}
async function photoAuthority(
  ctx: ManualPatternsContext,
  identity: { customerId: string; wearerId: string },
) {
  const o = ctx.measurements.orders;
  return authorizeMeasurementIdentity(
    {
      wearers: o.wearers.repository,
      guardians: o.guardians.repository,
      measurements: ctx.measurements.repository,
      policy: o.wearers.policy,
    },
    identity,
    true,
  );
}
async function outputAuthority(
  ctx: ManualPatternsContext,
  ref: PatternVersion,
) {
  if (!ref.output) return;
  await photoAuthority(ctx, ref);
  const own = await ctx.repository.subjectForAsset(ref.output.assetId);
  if (!own || own.id !== ref.output.subjectId) fail(404);
  await photoAuthority(ctx, own);
  await ctx.media.lock(ref.output.assetId);
  const a = await ctx.media.read(ref.output.assetId),
    ds = await ctx.media.derivatives(ref.output.assetId);
  if (
    a?.status !== "ready" ||
    a.purpose !== "manual-pattern" ||
    a.subjectId !== own.id ||
    a.contentType !== ref.output.contentType ||
    a.sha256 !== ref.output.originalSha256
  )
    fail(404);
  if (a.contentType !== "application/pdf") {
    const d = ds.find((d) => d.variant === "display"),
      t = ds.find((d) => d.variant === "thumbnail");
    if (
      !d ||
      !t ||
      d.sha256 !== ref.output.display?.sha256 ||
      d.width !== ref.output.display.width ||
      d.height !== ref.output.display.height ||
      t.sha256 !== ref.output.thumbnailSha256
    )
      fail(404);
  }
}
async function sourceAuthority(
  ctx: ManualPatternsContext,
  ref: PatternVersion,
  target?: Scope,
  requireAvailable = false,
) {
  const refs = await chain(ctx, ref),
    facts = [];
  let available = true;
  if (ref.output && target) await photoAuthority(ctx, target);
  for (const v of [...refs].reverse()) {
    if (v.redacted || !v.content) fail(404);
    const s = await scope(ctx, v);
    if (v.customerId !== s.customerId || v.wearerId !== s.wearerId) fail(404);
    await inputs(ctx, v.content, s, v);
    const review = await ctx.repository.review(v.id),
      cap = await ctx.repository.capability(s.binding);
    available = available && s.available && cap?.[v.method] === "available";
    if (["withdrawn", "changes-required"].includes(review?.reviewState ?? ""))
      fail(404);
    if (requireAvailable && !available) fail();
    if (
      target &&
      target.wearerId !== v.wearerId &&
      (!["shop-owned", "licensed-reuse"].includes(v.content.rights) ||
        !v.content.rightsEvidence.trim())
    )
      fail(404);
    if (
      target &&
      !["private-fulfilment", "shop-owned", "licensed-reuse"].includes(
        v.content.rights,
      )
    )
      fail();
    await outputAuthority(ctx, v);
    facts.push({
      id: v.id,
      scopeVersion: (await ctx.repository.state(v)).version,
      reviewId: review?.id ?? null,
      capabilityId: cap?.id ?? null,
      available: s.available && cap?.[v.method] === "available",
      wearerVersion: s.wearerVersion,
      orderVersion: s.order.version,
      design: s.design,
      measurement: s.measurement,
    });
  }
  return { digest: await requestHash(facts), available };
}
async function prepareDraftReferences(
  ctx: ManualPatternsContext,
  v: PatternDraft | PatternReferenceV2Draft,
) {
  const id = "reuse" in v && v.reuse ? v.reuse.referenceId : v.referenceId;
  const ref = id ? await ctx.repository.read(id) : undefined;
  if (id && !ref) fail(404);
  await prepareReferences(ctx, v, ref ? [ref] : []);
  if ("reuse" in v && v.reuse && ref)
    await sourceAuthority(ctx, ref, await scope(ctx, v));
  else if (ref?.source) {
    const source = await ctx.repository.read(ref.source.referenceId);
    if (!source) fail(404);
    await sourceAuthority(ctx, source);
  }
  if (ref?.output) await outputAuthority(ctx, ref);
  if ("assetId" in v && v.assetId) {
    const own = await ctx.repository.subjectForAsset(v.assetId);
    if (
      !own ||
      own.orderId !== v.orderId ||
      own.pieceId !== v.pieceId ||
      own.customerId !== v.customerId ||
      own.wearerId !== v.wearerId
    )
      fail(404);
    await photoAuthority(ctx, own);
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
  await inputs(ctx, c, s, q);
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
  const original = v.source
    ? await ctx.repository.read(v.source.referenceId)
    : null;
  if (v.source && !original) fail(404);
  const lineage = original ? await sourceAuthority(ctx, original) : null;
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
    ...(lineage ? { source: lineage.digest } : {}),
    ...(v.output ? { output: v.output } : {}),
  });
  if (v.output) await outputAuthority(ctx, v);
  const reviewState =
    review &&
    !review.redacted &&
    (review.contextDigest === contextDigest ||
      review.reviewState === "changes-required" ||
      review.reviewState === "withdrawn")
      ? (review.reviewState ?? "unreviewed")
      : "unreviewed";
  const blocked: PatternComparison["blocked"] = [];
  if (lineage && !lineage.available) blocked.push("source-unavailable");
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
async function resolve(
  ctx: ManualPatternsContext,
  v: PatternDraft | PatternReferenceV2Draft,
) {
  await prepareDraftReferences(ctx, v);
  const s = await authority(ctx, v),
    state = await ctx.repository.state(v);
  if (state.version !== v.baseVersion || state.latestSavedId !== v.baseSavedId)
    fail(412);
  const cap = await ctx.repository.capability(s.binding);
  if (!s.available || !cap || cap[v.method] !== "available") fail();
  if (v.operation === "save") await inputs(ctx, v.content, s, v);
  if (v.operation === "save" && "assetId" in v) {
    if (v.assetId) {
      await ctx.media.lock(v.assetId);
      const a = await ctx.media.read(v.assetId),
        ds = await ctx.media.derivatives(v.assetId);
      if (
        a?.status !== "ready" ||
        a.purpose !== "manual-pattern" ||
        !a.sha256 ||
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          a.contentType,
        ) ||
        (a.contentType !== "application/pdf" &&
          (!ds.some((d) => d.variant === "display") ||
            !ds.some((d) => d.variant === "thumbnail")))
      )
        fail();
    }
    if (v.reuse) {
      const r = await reviewPatternReuse(ctx, {
        orderId: v.orderId,
        pieceId: v.pieceId,
        referenceId: v.reuse.referenceId,
      });
      if (r.digest !== v.reuse.digest) fail(412);
      if (v.method !== r.source.method) fail();
    }
  }
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
        r.blocked.includes("source-unavailable") ||
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
  schemaVersion = 1,
): DraftWorkflow {
  const draftSchema =
    schemaVersion === 1 ? patternDraftSchema : patternReferenceV2DraftSchema;
  const commandSchema =
    schemaVersion === 1
      ? patternCommandSchema
      : patternReferenceV2CommandSchema;
  const check = async (p: Record<string, unknown>) => {
    const v = draftSchema.parse(p);
    await prepareDraftReferences(ctx, v);
    await authority(ctx, v);
    if (schemaVersion === 1 && v.referenceId) {
      const ref = await ctx.repository.read(v.referenceId);
      if (ref?.output || ref?.source) fail();
    }
  };
  return {
    schemaVersion,
    draftSchema,
    commandSchema,
    minimalReplay: true,
    validateEdit(a, b) {
      for (const k of ["orderId", "pieceId", "customerId", "wearerId"] as const)
        if (a[k] !== b[k]) fail();
    },
    async authorizeDraft(p) {
      await check(p);
    },
    async authorizePublication(p) {
      await check(p);
    },
    async replayPayload(id, version) {
      const p = await ctx.repository.replayPayload(id, version);
      await check(p);
      return ctx.repository.replayPayload(id, version);
    },
    retainPrivateResponse: (r, a, k) =>
      ctx.repository.retainPrivateResponse(r, a, k),
    async revalidate(p) {
      await resolve(ctx, commandSchema.parse(p));
    },
    async promote(p, _action, draftId, request) {
      const v = commandSchema.parse(p),
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
  const v = await ctx.repository.read(q.data.referenceId);
  if (!v) fail(404);
  if (!q.data.readerVersion && (v.output || v.source)) fail();
  await prepareReferences(ctx, q.data, [v]);
  const s = await scope(ctx, q.data);
  return (await comparison(ctx, q.data, v, s)).comparison;
}
export async function readPatterns(ctx: ManualPatternsContext, input: unknown) {
  const q = patternQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const initial = await ctx.repository.state(q.data),
    selectedInitial = initial.currentId
      ? await ctx.repository.read(initial.currentId)
      : null;
  await prepareReferences(
    ctx,
    q.data,
    [...initial.versions, ...(selectedInitial ? [selectedInitial] : [])],
    async () =>
      (await ctx.repository.state(q.data)).version === initial.version,
  );
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

export async function preparePatternRepeatContext(
  ctx: ManualPatternsContext,
  orderId: string,
) {
  const selected = await ctx.repository.selected(orderId),
    expected = selected
      .map((v) => v.id)
      .sort()
      .join();
  await prepareReferences(
    ctx,
    { orderId },
    selected,
    async () =>
      (await ctx.repository.selected(orderId))
        .map((v) => v.id)
        .sort()
        .join() === expected,
  );
}
export async function readPatternRepeatContext(
  ctx: ManualPatternsContext,
  orderId: string,
) {
  const references = [];
  for (const ref of await ctx.repository.selected(orderId)) {
    try {
      await sourceAuthority(ctx, ref);
      references.push({
        referenceId: ref.id,
        pieceId: ref.pieceId,
        version: ref.version,
        method: ref.method,
      });
    } catch (e) {
      if (!(e instanceof DraftFailure)) throw e;
    }
  }
  return { adapterVersion: 1 as const, references };
}
export function patternSubjectWorkflow(
  ctx: ManualPatternsContext,
): DraftWorkflow {
  const check = async (p: Record<string, unknown>) => {
    const v = patternSubjectDraftSchema.parse(p);
    if (v.erased) fail(404);
    await prepareReferences(ctx, v, []);
    const s = await scope(ctx, v);
    if (s.customerId !== v.customerId || s.wearerId !== v.wearerId) fail(404);
    await photoAuthority(ctx, v);
    return v;
  };
  return {
    schemaVersion: 1,
    draftSchema: patternSubjectDraftSchema,
    commandSchema: patternSubjectDraftSchema,
    minimalReplay: true,
    validateEdit(a, b) {
      if (JSON.stringify(a) !== JSON.stringify(b)) fail();
    },
    authorizeDraft: async (p) => {
      await check(p);
    },
    authorizePublication: async (p) => {
      await check(p);
    },
    async revalidate(p) {
      if (await ctx.repository.subjectForScope(await check(p))) fail();
    },
    async promote(p, _action, draftId, request) {
      const v = await check(p);
      if (await ctx.repository.subjectForScope(v)) fail();
      return {
        type: "pattern.subject",
        id: await ctx.repository.writeSubject({
          ...v,
          ...request,
          draftId,
          actorId: ctx.actorId,
        }),
      };
    },
    async verifyResult(r, d) {
      if (
        r.type !== "pattern.subject" ||
        !(await ctx.repository.origin(r.id, d, "subject"))
      )
        fail();
    },
    async replayPayload(id, version) {
      const p = await ctx.repository.replayPayload(id, version);
      await check(p);
      return ctx.repository.replayPayload(id, version);
    },
    retainPrivateResponse: (r, a, k) =>
      ctx.repository.retainPrivateResponse(r, a, k),
  };
}
export async function readPatternAssets(
  ctx: ManualPatternsContext,
  input: unknown,
) {
  const q = patternAssetsQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  await prepareReferences(ctx, q.data, []);
  const s = await scope(ctx, q.data);
  await photoAuthority(ctx, s);
  const subject = await ctx.repository.subjectForScope(q.data);
  return {
    subject: subject ?? null,
    ...(subject
      ? await ctx.repository.assets(subject.id, q.data.before)
      : { assets: [], next: null }),
  };
}
export async function reviewPatternReuse(
  ctx: ManualPatternsContext,
  input: unknown,
) {
  const q = patternReuseQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const ref = await ctx.repository.read(q.data.referenceId);
  if (!ref) fail(404);
  if (ref.orderId === q.data.orderId && ref.pieceId === q.data.pieceId) fail();
  await prepareReferences(ctx, q.data, [ref]);
  const s = await scope(ctx, q.data),
    cap = await ctx.repository.capability(s.binding);
  if (
    !s.available ||
    cap?.[ref.method] !== "available" ||
    (await ctx.specifications.repository.governed(q.data.orderId))
  )
    fail();
  const sourceDigest = await sourceAuthority(ctx, ref, s, true);
  return {
    source: ref,
    digest: await requestHash({
      sourceDigest,
      target: {
        ...q.data,
        wearerId: s.wearerId,
        wearerVersion: s.wearerVersion,
        version: s.order.version,
        snapshot: s.order.snapshotDigest,
        design: s.design,
        measurement: s.measurement,
        pattern: (await ctx.repository.state(q.data)).version,
        capabilityId: cap.id,
      },
    }),
    targetDesignId: s.design.currentId,
    targetMeasurementId: s.measurement.selectedId,
  };
}
export async function readPatternBytes(
  ctx: ManualPatternsContext,
  media: MediaContext,
  input: unknown,
) {
  const q = patternReadQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const ref = await ctx.repository.read(q.data.referenceId);
  if (
    !ref?.output ||
    !ref.content ||
    ref.redacted ||
    ref.orderId !== q.data.orderId ||
    ref.pieceId !== q.data.pieceId
  )
    fail(404);
  await prepareReferences(ctx, q.data, [ref]);
  await scope(ctx, q.data);
  await sourceAuthority(ctx, ref);
  const output = ref.output;
  return {
    output,
    access: await readMedia(
      {
        ...media,
        policy: {
          ...media.policy,
          authorizeRead: async (id) => {
            if (id !== output.assetId) fail(404);
          },
        },
      },
      output.assetId,
      output.contentType === "application/pdf" ? undefined : q.data.variant,
    ),
  };
}
export type PatternMediaAuthority = MeasurementAuthority & {
  repository: ManualPatternsRepository;
  orders: OrdersRepository;
};
export async function purgePatternOutputs(
  host: MeasurementFitPurgeHost,
  input: unknown,
  beforeCommit: () => Promise<void> = async () => {},
) {
  const parsed = patternPurgeLocatorSchema.safeParse(input);
  if (!parsed.success) return "ignored" as const;
  return purgePrivateMedia(host, parsed.data, beforeCommit);
}
export function patternMediaPolicy(
  ctx: PatternMediaAuthority,
  fallback: MediaPolicy,
): MediaPolicy {
  const prepare = async (s: PatternSubject) => {
    const member = await ctx.orders.bookings.membership(s.orderId);
    if (member) await ctx.orders.bookings.lock(member);
    await ctx.orders.lockOrder(s.orderId);
    if ((await ctx.orders.bookings.membership(s.orderId)) !== member)
      throw new MediaFailure(404, "NOT_FOUND");
    const o = await ctx.orders.read(s.orderId);
    if (
      o?.intake.customerId !== s.customerId ||
      o.intake.wearerId !== s.wearerId
    )
      throw new MediaFailure(404, "NOT_FOUND");
    return authorizeMeasurementIdentity(ctx, s, true);
  };
  return {
    async protectAcceptedWrites(id) {
      return (
        !!(await ctx.repository.subject(id)) ||
        !!(await fallback.protectAcceptedWrites?.(id))
      );
    },
    async prepare(id) {
      const s = await ctx.repository.subject(id);
      if (s) {
        try {
          await prepare(s);
        } catch (e) {
          if (e instanceof DraftFailure)
            throw new MediaFailure(404, "NOT_FOUND");
          throw e;
        }
      } else await fallback.prepare?.(id);
    },
    async authorize(input) {
      const s = await ctx.repository.subject(input.subjectId);
      if (!s) return fallback.authorize(input);
      if (
        input.purpose !== "manual-pattern" ||
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          input.contentType,
        )
      )
        return null;
      try {
        const w = await prepare(s);
        return { minor: w.age === "minor", guardianConsent: w.age === "minor" };
      } catch (e) {
        if (e instanceof DraftFailure || e instanceof MediaFailure) return null;
        throw e;
      }
    },
    async authorizeRead(id) {
      if (await ctx.repository.subjectForAsset(id))
        throw new MediaFailure(404, "NOT_FOUND");
      return fallback.authorizeRead?.(id);
    },
  };
}
