import type { DesignChoicesContent } from "@aarili/contracts/design-choices";
import {
  type DesignAnswer,
  type DesignSpecificationDraft,
  type DesignSpecificationVersion,
  designReuseRequestSchema,
  designSpecificationCommandSchema,
  designSpecificationDraftSchema,
  designSpecificationQuerySchema,
} from "@aarili/contracts/design-specifications";
import type { DesignSpecificationsRepository } from "@aarili/db/repositories/design-specifications";
import type { DesignChoicesContext } from "./design-choices.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  type QuickOrderContext,
  readAcceptedOrder,
  readOrderPieces,
} from "./orders.js";
import { requestHash } from "./request-binding.js";

export type DesignSpecificationsContext = {
  orders: QuickOrderContext;
  choices: DesignChoicesContext;
  repository: DesignSpecificationsRepository;
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
      message: "Review the exact garment design scope",
    },
  });
}
async function authority(
  ctx: DesignSpecificationsContext,
  scopes: { orderId: string; pieceId: string | null }[],
) {
  const orders = ctx.orders.acceptance?.repository;
  if (!orders) fail();
  const ids = [...new Set(scopes.map((s) => s.orderId))].sort();
  const members = new Map<string, string | undefined>();
  for (const id of ids) members.set(id, await orders.bookings.membership(id));
  for (const id of [
    ...new Set([...members.values()].filter((v): v is string => !!v)),
  ].sort())
    await orders.bookings.lock(id);
  for (const id of ids) await orders.lockOrder(id);
  const records = [];
  // Discover identities first, then acquire entire sorted authority classes.
  for (const id of ids) {
    if ((await orders.bookings.membership(id)) !== members.get(id)) fail();
    // Lightweight/unsupported service subjects have their own reader. Never parse
    // one as a custom garment or manufacture a wearer/piece for a design scope.
    if ((await ctx.repository.orderKind(id)) !== "custom") fail(404);
    const o = await orders.read(id);
    if (!o) fail(404);
    records.push(o);
  }
  for (const id of [
    ...new Set(
      records.map((o) => o.intake.customerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.orders.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(
      records.map((o) => o.intake.wearerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.orders.wearers.repository.lockWearer(id);
  const result = [];
  for (const s of scopes) {
    const order = await readAcceptedOrder(ctx.orders, s.orderId),
      pieces = await readOrderPieces(ctx.orders, s.orderId);
    if (
      !order.intake.customerId ||
      !order.intake.wearerId ||
      pieces.state === "unsupported" ||
      !pieces.structure
    )
      fail();
    const piece = s.pieceId
      ? pieces.identities.find((p) => p.id === s.pieceId)
      : null;
    if (s.pieceId && !piece) fail(404);
    if (
      s.pieceId &&
      pieces.structure.pieces.find((p) => p.key === piece?.key)
        ?.applicability === "not-applicable"
    )
      fail();
    result.push({ order, pieceKey: piece?.key ?? null });
  }
  return result;
}
async function configLocks(ctx: DesignSpecificationsContext) {
  await ctx.choices.catalogue.repository.lock();
  await ctx.choices.templates.forms.repository.lock();
  await ctx.choices.templates.repository.lock();
  await ctx.choices.repository.lock();
}
async function source(
  ctx: DesignSpecificationsContext,
  v: DesignSpecificationDraft,
) {
  if (!v.reuse) return undefined;
  const r = await ctx.repository.read(v.reuse.versionId);
  if (!r || r.redacted || r.digest !== v.reuse.digest) fail(404);
  return r;
}
async function authorised(
  ctx: DesignSpecificationsContext,
  v: DesignSpecificationDraft,
) {
  const reused = await source(ctx, v);
  const scopes = [v, ...(reused ? [reused] : [])];
  const a = await authority(ctx, scopes);
  const target = a[0];
  if (!target) fail(404);
  // Privacy may have committed while aggregate/authority locks were acquired.
  return { target, reused: reused ? await source(ctx, v) : undefined };
}
const sameRef = (
  a: { entryId: string; revisionId: string } | null,
  b: { entryId: string; revisionId: string } | null,
) => a?.entryId === b?.entryId && a?.revisionId === b?.revisionId;
const unchanged = async (a: DesignAnswer, b: DesignAnswer) =>
  (await requestHash({ ...a, retainedReason: "" })) ===
  (await requestHash({ ...b, retainedReason: "" }));

// Exact positive rational parsing. No conversion, rounding, body values or formulas.
function rational(raw: string): [bigint, bigint] | null {
  const s = raw.trim();
  let m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s);
  if (m?.[1]) {
    const d = 10n ** BigInt(m[2]?.length ?? 0);
    return [BigInt(m[1]) * d + BigInt(m[2] || 0), d];
  }
  m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(s);
  if (!m?.[2] || !m[3] || m.slice(1).some((x) => x && x.length > 9))
    return null;
  const d = BigInt(m[3]);
  return d > 0n ? [BigInt(m[1] || 0) * d + BigInt(m[2]), d] : null;
}
export function validGarmentLength(raw: string, increment: string) {
  const a = rational(raw),
    b = rational(increment);
  return !!a && !!b && b[0] > 0n && (a[0] * b[1]) % (a[1] * b[0]) === 0n;
}
async function resolve(
  ctx: DesignSpecificationsContext,
  v: DesignSpecificationDraft,
) {
  const { target, reused } = await authorised(ctx, v);
  await ctx.repository.lock(v.orderId, v.pieceId);
  const state = await ctx.repository.state(v.orderId, v.pieceId);
  if (state.version !== v.baseVersion || state.latestSavedId !== v.baseSavedId)
    fail(412);
  await configLocks(ctx);
  const base = v.baseSavedId
    ? await ctx.repository.read(v.baseSavedId)
    : undefined;
  if (base && (base.orderId !== v.orderId || base.pieceId !== v.pieceId))
    fail(404);
  if (v.operation === "select") {
    const selected = v.selectedId
      ? await ctx.repository.read(v.selectedId)
      : undefined;
    if (
      !selected ||
      selected.orderId !== v.orderId ||
      selected.pieceId !== v.pieceId ||
      selected.redacted
    )
      fail(404);
    if (await ctx.repository.governed(v.orderId)) fail();
    for (const choice of selected.choices) {
      const current = await ctx.choices.repository.current(choice.entryId);
      if (!current?.available || current.definition.id !== choice.id) fail();
    }
    return {
      target,
      frozen: { profile: selected.profile, choices: selected.choices },
    };
  }
  const profile = v.profile
    ? await ctx.choices.repository.definition(v.profile.revisionId)
    : undefined;
  if (
    !profile ||
    profile.entryId !== v.profile?.entryId ||
    profile.content.kind !== "profile"
  )
    fail(404);
  const p = profile.content;
  const current = await ctx.choices.repository.current(profile.entryId);
  const retainedProfile = base?.profile.id === profile.id && !v.reuse;
  if (
    (!current?.available || current.definition.id !== profile.id) &&
    !retainedProfile
  )
    fail();
  // Accepted category/manifest remain pinned even when their availability changes.
  if (
    p.manifest?.revisionId !== target.order.intake.manifest?.definitionId ||
    p.pieceKey !== target.pieceKey
  )
    fail();
  const accepted = target.order.snapshot.catalogue;
  if (
    !Array.isArray(accepted) ||
    !accepted.some((x: unknown) => {
      const d = x as { id?: string; entryId?: string };
      return (
        d.id === p.category?.revisionId && d.entryId === p.category?.entryId
      );
    })
  )
    fail();
  if (p.decision === "unresolved" || v.answers.length !== p.questions.length)
    fail(422);
  const choices: DesignSpecificationVersion["choices"] = [],
    states = new Map<string, string>();
  const evaluate = (
    q: Extract<DesignChoicesContent, { kind: "profile" }>["questions"][number],
  ): string => {
    const cached = states.get(q.id);
    if (cached) return cached;
    const a = v.answers.find((a) => a.questionId === q.id);
    if (!a) fail(422);
    const unresolved = q.when.some((w) => {
      const parent = p.questions.find((x) => x.id === w.questionId);
      return (
        !parent || !["selected", "not-applicable"].includes(evaluate(parent))
      );
    });
    if (unresolved) {
      if (a.state !== "unknown") fail(422);
      states.set(q.id, "dependency-unresolved");
      return "dependency-unresolved";
    }
    const applicable =
      q.applicability === "applicable" &&
      q.when.every((w) => {
        const parent = p.questions.find((x) => x.id === w.questionId);
        return (
          !!parent &&
          evaluate(parent) === "selected" &&
          sameRef(
            v.answers.find((x) => x.questionId === parent.id)?.choice ?? null,
            w.choice,
          )
        );
      });
    if (!applicable) {
      if (a.state !== "not-applicable" && a.state !== "unknown") fail(422);
      states.set(q.id, "not-applicable");
      return "not-applicable";
    }
    if (a.state === "not-applicable") fail(422);
    states.set(q.id, a.state);
    return a.state;
  };
  for (const q of p.questions) {
    const a = v.answers.find((a) => a.questionId === q.id);
    if (!a) fail(422);
    evaluate(q);
    if (a.state !== "selected") continue;
    if (q.kind === "choice") {
      if (
        !a.choice ||
        a.text ||
        a.unit ||
        !q.choices.some((c) => sameRef(c, a.choice))
      )
        fail(422);
      const d = await ctx.choices.repository.definition(a.choice.revisionId),
        c = await ctx.choices.repository.current(a.choice.entryId);
      if (
        !d ||
        d.entryId !== a.choice.entryId ||
        d.content.kind !== "choice" ||
        d.content.dimension !== q.key ||
        !sameRef(d.content.category, p.category)
      )
        fail();
      const eligible = c?.available && c.definition.id === d.id;
      if (!eligible) {
        const old = base?.answers.find((x) => x.questionId === a.questionId);
        if (
          v.reuse ||
          !old ||
          !(await unchanged(a, old)) ||
          !a.retainedReason.trim() ||
          base?.profile.id !== profile.id
        )
          fail();
      } else if (a.retainedReason) fail(422);
      choices.push(d);
    } else {
      if (a.choice || !a.text.trim() || a.retainedReason) fail(422);
      if (
        q.kind === "text"
          ? a.unit !== null
          : !a.unit ||
            !q.units.includes(a.unit) ||
            q.precision?.unit !== a.unit ||
            !validGarmentLength(a.text, q.precision.increment)
      )
        fail(422);
    }
  }
  if (reused) {
    if (!v.reuse) fail();
    if (
      reused.wearerId !== target.order.intake.wearerId ||
      reused.orderId === v.orderId
    )
      fail(404);
    const sourceCurrent = await ctx.repository.state(
      reused.orderId,
      reused.pieceId,
    );
    if (sourceCurrent.version !== v.reuse.scopeVersion) fail();
    const sourceProfile = await ctx.choices.repository.current(
      reused.profile.entryId,
    );
    if (!sourceProfile?.available) fail();
    const content = reused.profile.content;
    if (content.kind !== "profile" || !content.category || !content.manifest)
      fail();
    const category = await ctx.choices.catalogue.repository.current(
      content.category.entryId,
    );
    const manifest = await ctx.choices.templates.repository.current(
      content.manifest.entryId,
    );
    if (!category?.available || !manifest?.available) fail();
    for (const id of v.reuse.fields) {
      const old = reused.answers.find((a) => a.questionId === id),
        a = v.answers.find((a) => a.questionId === id);
      if (
        !old ||
        !a ||
        old.state !== "selected" ||
        a.intent === "unresolved" ||
        a.retainedReason ||
        !sameRef(a.choice, old.choice) ||
        a.text !== old.text ||
        a.unit !== old.unit
      )
        fail();
    }
  }
  if (v.use && (await ctx.repository.governed(v.orderId))) fail();
  return { target, frozen: { profile, choices } };
}
export function designSpecificationWorkflow(
  ctx: DesignSpecificationsContext,
): DraftWorkflow {
  return {
    minimalReplay: true,
    async replayPayload(id, version) {
      const payload = await ctx.repository.replayPayload(id, version);
      await authorised(ctx, designSpecificationDraftSchema.parse(payload));
      return ctx.repository.replayPayload(id, version);
    },
    retainPrivateResponse: (record, auditId, key) =>
      ctx.repository.retainPrivateResponse(record, auditId, key),
    schemaVersion: 1,
    draftSchema: designSpecificationDraftSchema,
    commandSchema: designSpecificationCommandSchema,
    validateEdit(a, b) {
      const x = designSpecificationDraftSchema.parse(a),
        y = designSpecificationDraftSchema.parse(b);
      if (x.orderId !== y.orderId || x.pieceId !== y.pieceId) fail();
    },
    async authorizeDraft(input) {
      await authorised(ctx, designSpecificationDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await authorised(ctx, designSpecificationDraftSchema.parse(input));
    },
    async revalidate(input) {
      await resolve(ctx, designSpecificationCommandSchema.parse(input));
    },
    async promote(input, _action, draftId, request) {
      const v = designSpecificationCommandSchema.parse(input),
        r = await resolve(ctx, v);
      const { customerId, wearerId } = r.target.order.intake;
      if (!customerId || !wearerId) fail(404);
      const result = await ctx.repository.write({
        ...v,
        ...request,
        draftId,
        actorId: ctx.choices.actorId,
        customerId,
        wearerId,
        snapshotDigest: r.target.order.snapshotDigest,
        frozen: r.frozen,
        digest: await requestHash({
          scope: { orderId: v.orderId, pieceId: v.pieceId },
          frozen: r.frozen,
          answers: v.answers,
          reason: v.reason,
          reuse: v.reuse,
        }),
      });
      return { type: "design.specification", id: result.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "design.specification" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail();
    },
  };
}
export async function readDesignSpecifications(
  ctx: DesignSpecificationsContext,
  input: unknown,
) {
  const q = designSpecificationQuerySchema.safeParse(input);
  if (!q.success) fail(422);
  await authority(ctx, [q.data]);
  return ctx.repository.state(
    q.data.orderId,
    q.data.pieceId,
    q.data.beforeVersion,
    q.data.beforeSelectionVersion,
  );
}
export async function readDesignSpecification(
  ctx: DesignSpecificationsContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404);
  await authority(ctx, [r]);
  const current = await ctx.repository.read(id);
  if (!current) fail(404);
  return current;
}
export async function previewDesignReuse(
  ctx: DesignSpecificationsContext,
  input: unknown,
) {
  const q = designReuseRequestSchema.safeParse(input);
  if (!q.success) fail(422);
  const r = await readDesignSpecification(ctx, q.data.source.versionId);
  const current = await ctx.repository.state(q.data.orderId, q.data.pieceId);
  const p = await ctx.choices.repository.definition(q.data.profile.revisionId);
  if (
    !p ||
    p.entryId !== q.data.profile.entryId ||
    p.content.kind !== "profile"
  )
    fail(404);
  // Mapping is identity-based, never label-based. Selected source fields must all exist.
  const questions = p.content.questions;
  const mapped = questions.map((question) => {
    const old = r.answers.find(
      (a) =>
        a.questionId === question.id &&
        q.data.source.fields.includes(a.questionId),
    );
    return old
      ? { ...old, intent: "inspiration" as const, retainedReason: "" }
      : {
          questionId: question.id,
          state: "unknown" as const,
          choice: null,
          text: "",
          unit: null,
          intent: "unresolved" as const,
          retainedReason: "",
        };
  });
  if (q.data.source.fields.some((id) => !questions.some((x) => x.id === id)))
    fail();
  const candidate: DesignSpecificationDraft = {
    orderId: q.data.orderId,
    pieceId: q.data.pieceId,
    baseVersion: current.version,
    baseSavedId: current.latestSavedId,
    profile: q.data.profile,
    operation: "save",
    selectedId: null,
    answers: mapped,
    reason: "Repeat design review",
    use: false,
    reuse: q.data.source,
  };
  await resolve(ctx, candidate);
  return candidate;
}
