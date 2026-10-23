import type { MeasurementFormRevision } from "@aarili/contracts/measurement-forms";
import {
  type MeasurementSessionDraft,
  type MeasurementUseDraft,
  type MeasurementVersion,
  measurementQuerySchema,
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
import type { DesignSpecificationsRepository } from "@aarili/db/repositories/design-specifications";
import type { MeasurementSessionsRepository } from "@aarili/db/repositories/measurement-sessions";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { measurementFormsReferencesEligible } from "./measurement-forms.js";
import {
  type QuickOrderContext,
  readAcceptedOrder,
  readOrderPieces,
} from "./orders.js";

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
async function wearer(
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
}
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
    if (state.selectedId || (await ctx.consequences.governed(v.target.orderId)))
      fail();
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
    // A records the first use only. Contextual cross-garment reuse belongs to B.
    if ((await ctx.repository.used([s.id])).length) fail();
    return null;
  }
  if (!v.form || !v.approvalId) fail(422);
  const f = await config(ctx, v.form),
    a = await ctx.repository.latestApproval(v.form.revisionId);
  if (a?.operation !== "approve" || a.id !== v.approvalId) fail();
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
) {
  const v = await ctx.repository.read(id);
  if (!v) fail(404);
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
    ...q.data,
    ...(await ctx.repository.selection(q.data.orderId, q.data.pieceId)),
    form: t.form,
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
