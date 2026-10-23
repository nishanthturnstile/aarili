import type { MeasurementFormRevision } from "@aarili/contracts/measurement-forms";
import {
  type MeasurementSessionDraft,
  type MeasurementUseDraft,
  type MeasurementVersion,
  measurementQuerySchema,
  measurementReviewQuerySchema,
  measurementSessionCommandSchema,
  measurementSessionDraftSchema,
  measurementTargetQuerySchema,
  measurementUseCommandSchema,
  measurementUseDraftSchema,
} from "@aarili/contracts/measurement-sessions";
import {
  compareLengths,
  convertLength,
  exactDecimal,
  matchesIncrement,
  parseLength,
} from "@aarili/contracts/measurement-values";
import type { RepeatOrderDraft } from "@aarili/contracts/orders";
import type { DesignSpecificationsRepository } from "@aarili/db/repositories/design-specifications";
import type { MeasurementSessionsRepository } from "@aarili/db/repositories/measurement-sessions";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { measurementFormsReferencesEligible } from "./measurement-forms.js";
import {
  type QuickOrderContext,
  readAcceptedOrder,
  readOrderPieces,
} from "./orders.js";
import { requestHash } from "./request-binding.js";

export type MeasurementSessionsContext = {
  orders: QuickOrderContext;
  repository: MeasurementSessionsRepository;
  consequences: DesignSpecificationsRepository;
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
      message: "Review measurement access, source, exact form and values",
    },
  });
}
export async function authorizeMeasurementWearer(
  ctx: MeasurementSessionsContext,
  v: { customerId: string; wearerId: string },
) {
  const w = ctx.orders.wearers;
  if (!w.policy.enabled || !w.policy.synthetic || !w.policy.notice) fail();
  await w.repository.lockCustomer(v.customerId);
  await w.repository.lockWearer(v.wearerId);
  if (!(await w.repository.customer(v.customerId))) fail(404);
  const p = await w.repository.read(v.customerId, v.wearerId);
  if (
    !p?.relationship.authorised ||
    !p.relationship.informed ||
    p.relationship.authorisationDeclined ||
    p.relationship.informedDeclined ||
    p.age === "unknown"
  )
    fail(404);
  if (p.age === "adult") {
    if (
      !p.purposes.some(
        (e) => e.purpose === "service" && e.decision === "grant" && e.eligible,
      )
    )
      fail(404);
  } else {
    const g = await ctx.orders.guardians.repository.read(p.id, true);
    if (
      !g.authority?.verifiedCurrent ||
      !g.purposes.some(
        (e) =>
          e.purpose === "measurement" &&
          e.decision === "grant" &&
          e.eligible &&
          e.authorityId === g.authority?.id,
      )
    )
      fail(404);
  }
  if (await ctx.repository.erased(v.wearerId)) fail(404);
  return p;
}
const wearer = authorizeMeasurementWearer;
async function config(
  ctx: MeasurementSessionsContext,
  ref: { entryId: string; revisionId: string },
) {
  const t = ctx.orders.templates;
  await t.catalogue.repository.lock();
  await t.forms.repository.lock();
  await t.repository.lock();
  if (!t.synthetic) fail();
  const f = await t.forms.repository.current(ref.entryId);
  if (
    !f ||
    f.definition.id !== ref.revisionId ||
    !(await measurementFormsReferencesEligible(t.forms, f)) ||
    f.definition.content.decision !== "required"
  )
    fail();
  return f;
}
async function target(
  ctx: MeasurementSessionsContext,
  q: { orderId: string; pieceId: string | null },
) {
  const r = ctx.orders.acceptance?.repository;
  if (!r) fail();
  const booking = await r.bookings.membership(q.orderId);
  if (booking) await r.bookings.lock(booking);
  await r.lockOrder(q.orderId);
  if (
    (await r.bookings.membership(q.orderId)) !== booking ||
    (await ctx.consequences.orderKind(q.orderId)) !== "custom"
  )
    fail(404);
  const order = await r.read(q.orderId);
  if (!order?.intake.customerId || !order.intake.wearerId) fail(404);
  await wearer(ctx, {
    customerId: order.intake.customerId,
    wearerId: order.intake.wearerId,
  });
  const accepted = await readAcceptedOrder(ctx.orders, q.orderId),
    pieces = await readOrderPieces(ctx.orders, q.orderId);
  if (pieces.state === "unsupported" || !pieces.structure) fail();
  const piece = q.pieceId
    ? pieces.identities.find((p) => p.id === q.pieceId)
    : null;
  if (q.pieceId && !piece) fail(404);
  if (
    piece &&
    pieces.structure.pieces.find((p) => p.key === piece.key)?.applicability ===
      "not-applicable"
  )
    fail();
  // Accepted manifest is an immutable definition, never its current replacement.
  const manifest = accepted.intake.manifest
    ? await ctx.orders.templates.repository.definition(
        accepted.intake.manifest.definitionId,
      )
    : undefined;
  if (manifest?.content.kind !== "service-template") fail();
  const bindings = manifest.content.forms.filter(
    (f) => f.pieceKey === (piece?.key ?? null),
  );
  if (bindings.length !== 1) fail(); // Multi-form mapping needs an explicit later contract.
  const form = bindings[0];
  if (!form) fail();
  return {
    customerId: order.intake.customerId,
    wearerId: order.intake.wearerId,
    form: { entryId: form.entryId, revisionId: form.revisionId },
    orderVersion: order.version,
  };
}
async function authorised(
  ctx: MeasurementSessionsContext,
  v: MeasurementSessionDraft,
) {
  if (v.erased) fail(404);
  if (v.target) {
    const t = await target(ctx, v.target);
    if (t.customerId !== v.customerId || t.wearerId !== v.wearerId) fail(404);
  } else await wearer(ctx, v);
  if (v.selectedId) {
    const s = await ctx.repository.read(v.selectedId);
    if (
      !s ||
      s.customerId !== v.customerId ||
      s.wearerId !== v.wearerId ||
      s.redacted
    )
      fail(404);
  }
  if (v.correctionId) {
    const s = await ctx.repository.read(v.correctionId);
    if (
      !s ||
      s.customerId !== v.customerId ||
      s.wearerId !== v.wearerId ||
      s.redacted
    )
      fail(404);
  }
}
function validatePolicy(v: MeasurementUseDraft, f: MeasurementFormRevision) {
  const fields = f.definition.content.groups.flatMap((g) => g.fields);
  if (
    v.policy.fields.length !== fields.length ||
    new Set(v.policy.fields.map((p) => p.fieldId)).size !== fields.length ||
    fields.some(
      (x) =>
        !v.policy.fields.some((p) => p.fieldId === x.id) ||
        x.required === null ||
        !x.precision?.unit ||
        !x.precision.review.trim() ||
        !parseLength(x.precision.increment) ||
        parseLength(x.precision.increment)?.numerator === "0",
    )
  )
    fail(422);
  if (v.policy.validation.mode === "rules")
    for (const r of v.policy.validation.rules) {
      if (
        !r.review.trim() ||
        !fields.some((f) => f.id === r.fieldId) ||
        (r.kind === "field-lte"
          ? !fields.some((f) => f.id === r.otherFieldId) ||
            r.fieldId === r.otherFieldId
          : !parseLength(r.value))
      )
        fail(422);
    }
}
export function validateMeasurementValues(
  v: MeasurementSessionDraft,
  f: MeasurementFormRevision["definition"],
  policy: MeasurementUseDraft["policy"],
): MeasurementVersion["values"] {
  const fields = f.content.groups.flatMap((g) => g.fields);
  if (
    v.values.length !== fields.length ||
    new Set(v.values.map((a) => a.fieldId)).size !== fields.length
  )
    fail(422);
  const result = fields.map((field, index) => {
    const value = v.values[index];
    if (value?.fieldId !== field.id) fail(422);
    if (!value) fail(422);
    const source = value.source ?? v.source;
    if (!value.rawText.trim()) {
      if (field.required || value.unit || value.source || value.warningReason)
        fail(422);
      return { ...value, numeric: null, exact: null };
    }
    if (
      !value.unit ||
      !field.units.includes(value.unit) ||
      !field.precision?.unit ||
      source.kind === "unknown" ||
      source.kind === "mixed" ||
      !source.date ||
      !source.measurer.trim() ||
      !source.method.trim()
    )
      fail(422);
    const parsed = parseLength(value.rawText),
      step = parseLength(field.precision.increment);
    if (
      !parsed ||
      !step ||
      exactDecimal(parsed) === null ||
      !matchesIncrement(
        convertLength(parsed, value.unit, field.precision.unit),
        step,
      ) ||
      (parsed.numerator === "0" &&
        !policy.fields.find((p) => p.fieldId === field.id)?.allowZero)
    )
      fail(422);
    return { ...value, numeric: exactDecimal(parsed), exact: parsed };
  });
  if (policy.validation.mode === "rules")
    for (const r of policy.validation.rules) {
      const a = result.find((a) => a.fieldId === r.fieldId);
      if (!a?.exact || !a.unit) continue;
      const b =
        r.kind === "field-lte"
          ? result.find((a) => a.fieldId === r.otherFieldId)
          : null;
      const limit =
        r.kind === "field-lte"
          ? b?.exact && b.unit
            ? convertLength(b.exact, b.unit, a.unit)
            : null
          : parseLength(r.value);
      if (!limit) continue;
      const cmp = compareLengths(
        a.exact,
        r.kind === "field-lte" ? limit : convertLength(limit, r.unit, a.unit),
      );
      if (
        (r.kind === "minimum" ? cmp < 0 : cmp > 0) &&
        (r.severity === "error" ||
          !policy.validation.allowWarningReason ||
          !a.warningReason.trim())
      )
        fail(422);
    }
  return result;
}
async function resolve(
  ctx: MeasurementSessionsContext,
  v: MeasurementSessionDraft,
) {
  await authorised(ctx, v);
  if (v.operation === "select") {
    if (!v.target || !v.selectedId) fail(422);
    const t = await target(ctx, v.target),
      state = await ctx.repository.selection(
        v.target.orderId,
        v.target.pieceId,
      );
    if (state.version !== v.baseVersion) fail(412);
    if (await ctx.consequences.governed(v.target.orderId)) fail();
    const s = await ctx.repository.read(v.selectedId);
    if (
      !s ||
      s.redacted ||
      s.form.entryId !== t.form.entryId ||
      s.form.id !== t.form.revisionId
    )
      fail();
    await config(ctx, t.form);
    const a = await ctx.repository.latestApproval(t.form.revisionId);
    if (a?.operation !== "approve" || a.id !== s.approval.id) fail();
    if (
      state.selectedId ||
      (await ctx.repository.used([s.id])).length ||
      v.reuseReview
    ) {
      if (!v.reuseReview) fail();
      const review = await reviewMeasurementSelection(ctx, {
        selectedId: s.id,
        target: v.target,
        impact: v.reuseReview.impact,
      });
      if (review.blocked.length) fail();
      if (review.digest !== v.reuseReview.digest) fail(412);
    }
    return null;
  }
  if (!v.form || !v.approvalId) fail(422);
  const f = await config(ctx, v.form),
    a = await ctx.repository.latestApproval(v.form.revisionId);
  if (a?.operation !== "approve" || a.id !== v.approvalId) fail();
  if (v.correctionId) {
    const prior = await ctx.repository.read(v.correctionId);
    if (!prior || prior.redacted) fail(404);
    await ctx.repository.lockSession(prior.sessionId);
    const head = await ctx.repository.read(prior.id);
    if (head?.headId !== prior.id) fail(412);
    // A different observation belongs to a fresh session. Corrections retain
    // the observed date and exact form; neither the actor nor compilation time
    // becomes a newly measured fact.
    if (
      prior.form.id !== f.definition.id ||
      prior.source.date !== v.source.date ||
      prior.source.kind !== v.source.kind ||
      v.values.some(
        (a) =>
          a.source?.date !==
          prior.values.find((b) => b.fieldId === a.fieldId)?.source?.date,
      )
    )
      fail(422);
  }
  return {
    form: f.definition,
    approval: a,
    values: validateMeasurementValues(v, f.definition, a.policy),
  };
}
export function measurementUseWorkflow(
  ctx: MeasurementSessionsContext,
): DraftWorkflow {
  const resolveUse = async (v: MeasurementUseDraft) => {
    const f = await config(ctx, v.form),
      current = await ctx.repository.latestApproval(v.form.revisionId);
    if ((current?.id ?? null) !== v.baseId) fail(412);
    if (v.operation === "withdraw" && current?.operation !== "approve") fail();
    validatePolicy(v, f);
  };
  return {
    schemaVersion: 1,
    draftSchema: measurementUseDraftSchema,
    commandSchema: measurementUseCommandSchema,
    async authorizeDraft() {
      if (!ctx.orders.templates.synthetic) fail();
    },
    async revalidate(input) {
      await resolveUse(measurementUseCommandSchema.parse(input));
    },
    async promote(input, _action, draftId, request) {
      const v = measurementUseCommandSchema.parse(input);
      await resolveUse(v);
      const id = await ctx.repository.writeApproval({
        ...v,
        ...request,
        draftId,
        actorId: ctx.orders.templates.actorId,
      });
      return { type: "measurement.use", id };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "measurement.use" ||
        !(await ctx.repository.origin(r.id, draftId, "use"))
      )
        fail();
    },
  };
}
export function measurementSessionWorkflow(
  ctx: MeasurementSessionsContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: measurementSessionDraftSchema,
    commandSchema: measurementSessionCommandSchema,
    minimalReplay: true,
    async replayPayload(id, version) {
      const p = await ctx.repository.replayPayload(id, version);
      await authorised(ctx, measurementSessionDraftSchema.parse(p));
      return ctx.repository.replayPayload(id, version);
    },
    retainPrivateResponse: (r, a, k) =>
      ctx.repository.retainPrivateResponse(r, a, k),
    validateEdit(a, b) {
      const x = measurementSessionDraftSchema.parse(a),
        y = measurementSessionDraftSchema.parse(b);
      if (
        x.customerId !== y.customerId ||
        x.wearerId !== y.wearerId ||
        x.operation !== y.operation ||
        x.correctionId !== y.correctionId ||
        JSON.stringify(x.target) !== JSON.stringify(y.target) ||
        x.erased
      )
        fail();
    },
    async authorizeDraft(p) {
      await authorised(ctx, measurementSessionDraftSchema.parse(p));
    },
    async authorizePublication(p) {
      await authorised(ctx, measurementSessionDraftSchema.parse(p));
    },
    async revalidate(p) {
      await resolve(ctx, measurementSessionCommandSchema.parse(p));
    },
    async promote(p, _action, draftId, request) {
      const v = measurementSessionCommandSchema.parse(p),
        saved = await resolve(ctx, v);
      const id = await ctx.repository.write(
        { ...v, ...request, draftId, actorId: ctx.orders.templates.actorId },
        saved,
      );
      return { type: "measurement.session", id };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "measurement.session" ||
        !(await ctx.repository.origin(r.id, draftId, "session"))
      )
        fail();
    },
  };
}
export async function readMeasurements(
  ctx: MeasurementSessionsContext,
  input: unknown,
) {
  const q = measurementQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  await wearer(ctx, q.data);
  const rows = await ctx.repository.list(
    q.data.customerId,
    q.data.wearerId,
    q.data.before,
  );
  return {
    versions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.id ?? null) : null,
    usedIds: await ctx.repository.used(rows.slice(0, 25).map((v) => v.id)),
  };
}
export async function readMeasurement(
  ctx: MeasurementSessionsContext,
  id: string,
  expected?: { customerId: string; wearerId: string },
) {
  // Resolve non-personal ownership before hydrating values or taking an authority
  // lock. A rejected foreign source must not invert the target's wearer lock.
  const v = await ctx.repository.identity(id);
  if (!v) fail(404);
  if (
    expected &&
    (v.customerId !== expected.customerId || v.wearerId !== expected.wearerId)
  )
    fail(404);
  await wearer(ctx, v);
  const current = await ctx.repository.read(id);
  if (!current) fail(404);
  return current;
}
export async function readMeasurementTarget(
  ctx: MeasurementSessionsContext,
  input: unknown,
) {
  const q = measurementTargetQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  const t = await target(ctx, q.data);
  return {
    orderId: q.data.orderId,
    pieceId: q.data.pieceId,
    ...(await ctx.repository.selection(
      q.data.orderId,
      q.data.pieceId,
      q.data.beforeVersion,
    )),
    form: t.form,
  };
}

export async function reviewMeasurementSelection(
  ctx: MeasurementSessionsContext,
  input: unknown,
) {
  const parsed = measurementReviewQuerySchema.safeParse(input);
  if (!parsed.success) fail(422);
  const q = parsed.data;
  const t = await target(ctx, q.target),
    version = await readMeasurement(ctx, q.selectedId, t);
  if (
    version.wearerId !== t.wearerId ||
    version.customerId !== t.customerId ||
    version.redacted
  )
    fail(404);
  const authority = await wearer(ctx, version),
    selection = await ctx.repository.selection(
      q.target.orderId,
      q.target.pieceId,
    );
  const sources = [];
  let sourceContextUnavailable = false;
  for (const u of await ctx.repository.usages(version.id)) {
    // Source garment access is independent of access to this personal version.
    // Do not reveal a link when current identity no longer matches its owner.
    if (
      u.customerId !== version.customerId ||
      u.wearerId !== version.wearerId
    ) {
      sourceContextUnavailable = true;
      continue;
    }
    try {
      await readAcceptedOrder(ctx.orders, u.orderId);
      await readOrderPieces(ctx.orders, u.orderId);
      sources.push({ orderId: u.orderId, pieceId: u.pieceId, code: u.code });
    } catch (e) {
      if (e instanceof DraftFailure && e.status === 404)
        sourceContextUnavailable = true;
      else throw e;
    }
  }
  const blocked: (
    | "incompatible"
    | "unavailable"
    | "unsupported-impact"
    | "already-selected"
  )[] = [];
  if (
    t.form.revisionId !== version.form.id ||
    t.form.entryId !== version.form.entryId
  )
    blocked.push("incompatible");
  try {
    await config(ctx, t.form);
    const a = await ctx.repository.latestApproval(t.form.revisionId);
    if (a?.operation !== "approve" || a.id !== version.approval.id)
      blocked.push("unavailable");
  } catch (e) {
    if (e instanceof DraftFailure && e.status === 409)
      blocked.push("unavailable");
    else throw e;
  }
  if (
    (await ctx.consequences.governed(q.target.orderId)) ||
    q.impact.physical !== "not-started" ||
    q.impact.commercial !== "none"
  )
    blocked.push("unsupported-impact");
  if (selection.selectedId === version.id) blocked.push("already-selected");
  const state = { ...q.target, ...selection, form: t.form };
  const profile = await ctx.orders.acceptance?.profile.current();
  const asOfDate = profile
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: profile.profile.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())
    : null;
  const ageDays =
    asOfDate && version.source.date
      ? (Date.parse(`${asOfDate}T00:00:00Z`) -
          Date.parse(`${version.source.date}T00:00:00Z`)) /
        86400000
      : null;
  const digest = await requestHash({
    actor: ctx.orders.templates.actorId,
    shop: ctx.orders.templates.shopId,
    source: version.id,
    head: version.headId,
    authority: authority.version,
    target: state,
    orderVersion: t.orderVersion,
    impact: q.impact,
    asOfDate,
    sources,
    sourceContextUnavailable,
    blocked,
  });
  return {
    version,
    target: state,
    sources,
    sourceContextUnavailable,
    digest,
    asOfDate,
    ageDays,
    blocked,
  };
}
export async function readMeasurementUse(
  ctx: MeasurementSessionsContext,
  form: { entryId: string; revisionId: string },
) {
  await config(ctx, form);
  return {
    approval: (await ctx.repository.latestApproval(form.revisionId)) ?? null,
  };
}

export async function validateRepeatMeasurement(
  orders: QuickOrderContext,
  draft: RepeatOrderDraft,
) {
  const ref = draft.measurementReuse;
  if (!ref || !orders.measurements || !draft.manifest) fail();
  const ctx: MeasurementSessionsContext = { orders, ...orders.measurements };
  const source = await target(ctx, {
    orderId: draft.repeat.sourceId,
    pieceId: ref.sourcePieceId,
  });
  const state = await ctx.repository.selection(
    draft.repeat.sourceId,
    ref.sourcePieceId,
  );
  if (state.selectedId !== ref.selectedId) fail(404);
  const v = await readMeasurement(ctx, ref.selectedId, {
    customerId: source.customerId,
    wearerId: source.wearerId,
  });
  if (
    state.selectedId !== v.id ||
    v.redacted ||
    v.customerId !== draft.customerId ||
    v.wearerId !== draft.wearerId
  )
    fail(404);
  const pieces = await readOrderPieces(orders, draft.repeat.sourceId);
  const piece = pieces.identities.find((p) => p.id === ref.sourcePieceId);
  if ((piece?.key ?? null) !== ref.pieceKey) fail();
  const manifest = await orders.templates.repository.definition(
    draft.manifest.definitionId,
  );
  if (manifest?.content.kind !== "service-template") fail();
  const bindings = manifest.content.forms.filter(
    (f) => f.pieceKey === ref.pieceKey,
  );
  if (
    bindings.length !== 1 ||
    bindings[0]?.revisionId !== v.form.id ||
    source.form.revisionId !== v.form.id
  )
    fail();
  await config(ctx, { entryId: v.form.entryId, revisionId: v.form.id });
  const a = await ctx.repository.latestApproval(v.form.id);
  if (a?.operation !== "approve" || a.id !== v.approval.id) fail();
}
