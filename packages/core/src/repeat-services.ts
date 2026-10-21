import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  createServiceRepeatSchema,
  emptyServiceOrder,
  type ServiceRepeatDraft,
  type ServiceRepeatRef,
  type ServiceRepeatSource,
  serviceRepeatDraftSchema,
  serviceRepeatIntake,
  serviceRepeatSourceSchema,
} from "@aarili/contracts/small-services";
import { DraftFailure, type DraftWorkflow, mutateDraft } from "./drafts.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
import { prepareServiceDraftReads } from "./service-changes.js";
import {
  readServiceLineProgress,
  readServiceOrder,
  resolveServiceSelection,
  type SmallServiceContext,
  serviceOrderDraftWorkflow,
} from "./small-services.js";

function fail(status: 404 | 409 | 412 | 422 | 428 = 409): never {
  throw new DraftFailure(status, {
    error: {
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 412
            ? "VERSION_STALE"
            : status === 422
              ? "VALIDATION_FAILED"
              : status === 428
                ? "PRECONDITION_REQUIRED"
                : "REQUEST_CONFLICT",
      message: "Review selected service work and its current mapping",
    },
  });
}
function repository(ctx: SmallServiceContext) {
  const r = ctx.repository.repeats;
  if (!r) fail();
  return r;
}
function immutableRef(ref: ServiceRepeatRef) {
  const { sourceVersion: _version, scopeDigest: _scope, ...rest } = ref;
  return {
    ...rest,
    selections: rest.selections.map(
      ({ lineVersion: _line, ...selection }) => selection,
    ),
  };
}
export async function readServiceRepeatLinks(
  ctx: SmallServiceContext,
  id: string,
  before?: string,
) {
  id = id.toLowerCase();
  const rows = await repository(ctx).links(id, before);
  const ids = [
    id,
    ...rows.children.slice(0, 25),
    ...(rows.sourceId ? [rows.sourceId] : []),
  ];
  await prepareServiceDraftReads(
    ctx,
    ids.map((id) => ({
      workflow: "order.service",
      payload: { sourceOrderId: id },
    })),
  );
  await readServiceRepeatSource(ctx, id);
  const safe = async (id: string) => {
    try {
      const source = await readServiceRepeatSource(ctx, id);
      return { id: source.id, code: source.code };
    } catch (e) {
      if (e instanceof DraftFailure && e.status === 404) return null;
      throw e;
    }
  };
  const children = [];
  for (const child of rows.children.slice(0, 25)) {
    const row = await safe(child);
    if (row) children.push(row);
  }
  return {
    source: rows.sourceId ? await safe(rows.sourceId) : null,
    children,
    next: rows.children.length > 25 ? (rows.children[24] ?? null) : null,
  };
}
export async function readServiceRepeatSource(
  ctx: SmallServiceContext,
  id: string,
): Promise<ServiceRepeatSource> {
  id = id.toLowerCase();
  await prepareServiceDraftReads(ctx, [
    { workflow: "order.service", payload: { sourceOrderId: id } },
  ]);
  const progress = await readServiceLineProgress(ctx, id);
  const service = await ctx.repository.readOrder(id);
  const custom = service ? undefined : await readAcceptedOrder(ctx.orders, id);
  const order = service ? await readServiceOrder(ctx, id) : custom;
  if (!order) fail(404);
  const pieces = custom ? await readOrderPieces(ctx.orders, id) : undefined;
  if ((await requestHash(order.snapshot)) !== order.snapshotDigest) fail();
  const candidates: ServiceRepeatSource["candidates"] = [];
  for (const row of progress.lines) {
    const profile = await ctx.repository.readProfile(row.line.sourceRevisionId);
    const manifest = profile?.content.manifest
      ? await ctx.orders.templates.repository.read(
          profile.content.manifest.revisionId,
        )
      : undefined;
    const ref = row.line.addonKey
      ? manifest?.definition.content.addons.find(
          (a) => a.key === row.line.addonKey,
        )
      : manifest?.definition.content.service;
    if (!ref) fail();
    const kind = service ? ("standalone" as const) : ("addition" as const);
    candidates.push({
      key: `${kind}:${row.line.id}`,
      kind,
      sourceId: row.sourceId,
      sourceDigest: row.sourceDigest,
      lineId: row.line.id,
      addonKey: null,
      pieceId: row.pieceId,
      lineVersion: row.version,
      catalogueEntryId: ref.entryId,
      catalogueRevisionId: ref.revisionId,
      labelEn: row.line.labelEn,
      labelTa: row.line.labelTa,
      requestedWork: row.line.requestedWork,
      state: row.state,
      previousPaise: row.line.pricePaise,
    });
  }
  if (pieces && custom) {
    for (const addon of custom.requirements.definition.addons) {
      const definition =
        await ctx.orders.templates.catalogue.repository.definition(
          addon.revisionId,
        );
      if (!definition || definition.entryId !== addon.entryId) fail();
      const scopes = [
        ...new Set(
          pieces.structure?.requirements
            .filter((r) => r.addonKey === addon.key)
            .map((r) => r.pieceKey) ?? [null],
        ),
      ];
      if (!scopes.length) scopes.push(null);
      for (const key of scopes) {
        const pieceId = key
          ? pieces.identities.find((p) => p.key === key)?.id
          : null;
        if (key && !pieceId) continue; // Never invent a relational piece for legacy preview.
        candidates.push({
          key: `original:${addon.key}:${pieceId ?? "order"}`,
          kind: "original-addon",
          sourceId: order.id,
          sourceDigest: order.snapshotDigest,
          lineId: null,
          addonKey: addon.key,
          pieceId: pieceId ?? null,
          lineVersion: 1,
          catalogueEntryId: addon.entryId,
          catalogueRevisionId: addon.revisionId,
          labelEn: definition.content.labelEn,
          labelTa: definition.content.labelTa,
          requestedWork: definition.content.labelEn,
          state:
            addon.applicability === "not-applicable"
              ? "not-required"
              : "unresolved",
          previousPaise: null,
        });
      }
    }
  }
  return serviceRepeatSourceSchema.parse({
    pieces:
      pieces?.identities.map((p) => {
        const def = pieces.structure?.pieces.find((d) => d.key === p.key);
        return {
          id: p.id,
          entryId: def?.entryId ?? fail(),
          labelEn: def?.labelEn ?? p.key,
          labelTa: def?.labelTa ?? p.key,
        };
      }) ?? [],
    id: order.id,
    code: order.code,
    version: order.version,
    kind: service ? "service" : "custom",
    snapshotDigest: order.snapshotDigest,
    scopeDigest: await requestHash({
      scope: progress.scopeDigest,
      lines: progress.lines.map((r) => ({
        id: r.line.id,
        version: r.version,
        state: r.state,
        sourceId: r.sourceId,
        sourceDigest: r.sourceDigest,
      })),
      snapshot: order.snapshotDigest,
    }),
    customer: order.customer,
    wearer: order.wearer,
    subjectDescription: service
      ? service.intake.subjectDescription
      : (await readAcceptedOrder(ctx.orders, id)).requirements.definition
          .labelEn,
    subjectId: service?.intake.subjectId ?? null,
    instructions: order.intake.instructions,
    originalPromise: order.originalPromise,
    candidates,
  });
}
async function authorise(ctx: SmallServiceContext, v: ServiceRepeatDraft) {
  const source = await readServiceRepeatSource(ctx, v.repeat.sourceId);
  if (
    v.customerId !== source.customer?.id ||
    v.wearerId !== (source.wearer?.id ?? null) ||
    v.sourceOrderId !== source.id ||
    v.subjectId === source.subjectId ||
    v.repeat.subjectId !== source.subjectId ||
    v.repeat.snapshotDigest !== source.snapshotDigest
  )
    fail(404);
  const ids = v.repeat.selections.map((s) => s.targetLineId);
  if (
    new Set(ids).size !== ids.length ||
    v.lines.length !== ids.length ||
    v.lines.some((l) => !ids.includes(l.id)) ||
    new Set(v.repeat.selections.map((s) => s.key)).size !== ids.length
  )
    fail(422);
  for (const selected of v.repeat.selections) {
    const candidate = source.candidates.find((c) => c.key === selected.key);
    if (!candidate) fail(404);
    const {
      labelEn: _e,
      labelTa: _t,
      requestedWork: _w,
      state: _s,
      previousPaise: _p,
      lineVersion: _v,
      ...ref
    } = candidate;
    const { targetLineId: _id, lineVersion: _version, ...stored } = selected;
    if ((await requestHash(ref)) !== (await requestHash(stored))) fail(404);
  }
  const pieces = [...new Set(v.repeat.selections.map((s) => s.pieceId))];
  if (v.sourcePieceId !== (pieces.length === 1 ? (pieces[0] ?? null) : null))
    fail(404);
  return source;
}
async function resolve(ctx: SmallServiceContext, v: ServiceRepeatDraft) {
  const source = await authorise(ctx, v);
  if (source.version !== v.repeat.sourceVersion) fail(412);
  if (
    source.scopeDigest !== v.repeat.scopeDigest ||
    v.repeat.selections.some(
      (s) =>
        source.candidates.find((c) => c.key === s.key)?.lineVersion !==
        s.lineVersion,
    )
  )
    fail();
  const resolved = await resolveServiceSelection(ctx, serviceRepeatIntake(v));
  const manifest = resolved.profile?.content.manifest
    ? await ctx.orders.templates.repository.read(
        resolved.profile.content.manifest.revisionId,
      )
    : undefined;
  for (const selection of v.repeat.selections) {
    const line = v.lines.find((l) => l.id === selection.targetLineId);
    const mapping = resolved.profile?.content.lines.find(
      (m) => m.key === line?.key,
    );
    const ref = mapping?.addonKey
      ? manifest?.definition.content.addons.find(
          (a) => a.key === mapping.addonKey,
        )
      : manifest?.definition.content.service;
    if (
      !mapping ||
      mapping.taskKey !== null ||
      !ref ||
      ref.entryId !== selection.catalogueEntryId
    )
      resolved.review.issues.push("repeatMapping");
    if (selection.pieceId) {
      const piece = source.pieces.find((p) => p.id === selection.pieceId);
      if (
        !piece ||
        !manifest?.definition.content.pieces.some(
          (p) => p.entryId === piece.entryId,
        )
      )
        resolved.review.issues.push("repeatPieceMapping");
    }
  }
  const fingerprint = await requestHash({
    base: resolved.review.fingerprint,
    repeat: v.repeat,
  });
  return { ...resolved, repeatFingerprint: fingerprint };
}
export async function reviewServiceRepeat(
  ctx: SmallServiceContext,
  input: unknown,
) {
  const p = serviceRepeatDraftSchema.safeParse(input);
  if (!p.success) fail(422);
  const r = await resolve(ctx, p.data);
  return { ...r.review, fingerprint: r.repeatFingerprint };
}
export function serviceRepeatWorkflow(ctx: SmallServiceContext): DraftWorkflow {
  let base: DraftWorkflow | undefined,
    projected: ReturnType<typeof serviceRepeatIntake> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: serviceRepeatDraftSchema,
    commandSchema: serviceRepeatDraftSchema,
    validateEdit(before, after) {
      const a = serviceRepeatDraftSchema.parse(before),
        b = serviceRepeatDraftSchema.parse(after);
      if (
        a.subjectId !== b.subjectId ||
        JSON.stringify(immutableRef(a.repeat)) !==
          JSON.stringify(immutableRef(b.repeat))
      )
        fail();
    },
    async authorizeDraft(input) {
      await authorise(ctx, serviceRepeatDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await authorise(ctx, serviceRepeatDraftSchema.parse(input));
    },
    async revalidate(input, draftId) {
      const v = serviceRepeatDraftSchema.parse(input),
        origin = await repository(ctx).origin(draftId);
      if (
        !origin ||
        (await requestHash(immutableRef(origin))) !==
          (await requestHash(immutableRef(v.repeat)))
      )
        fail();
      const r = await resolve(ctx, v),
        decision = v.commitmentReview;
      if (
        !decision?.acknowledged ||
        decision.fingerprint !== r.repeatFingerprint ||
        r.review.issues.length
      )
        fail();
      projected = {
        ...serviceRepeatIntake(v),
        commitmentReview: { ...decision, fingerprint: r.review.fingerprint },
      };
      base = serviceOrderDraftWorkflow(
        ctx,
        { repeatService: v.repeat },
        r.repeatFingerprint,
      );
      await base.revalidate(projected, draftId);
    },
    async promote(input, action, draftId, request) {
      if (!base || !projected) fail();
      const result = await base.promote(
        serviceRepeatIntake(serviceRepeatDraftSchema.parse(input)),
        action,
        draftId,
        request,
      );
      await repository(ctx).link(draftId, result.id);
      return result;
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
export async function createServiceRepeat(
  ctx: SmallServiceContext,
  id: string,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const parsed = createServiceRepeatSchema.safeParse(input),
    expected = parseExpectedVersion(headers.ifMatch);
  if (
    !parsed.success ||
    !headers.key ||
    !idempotencyHeaderSchema.safeParse(headers.key).success
  )
    fail(422);
  if (!expected.ok) fail(expected.status);
  const r = repository(ctx),
    v = {
      ...parsed.data,
      draftId: parsed.data.draftId.toLowerCase(),
      subjectId: parsed.data.subjectId.toLowerCase(),
      profile: parsed.data.profile
        ? {
            entryId: parsed.data.profile.entryId.toLowerCase(),
            revisionId: parsed.data.profile.revisionId.toLowerCase(),
          }
        : null,
      selections: parsed.data.selections.map((s) => ({
        ...s,
        targetLineId: s.targetLineId.toLowerCase(),
      })),
    },
    key = headers.key.toLowerCase();
  await r.drafts.lockKey(key);
  await r.drafts.lockDraft(v.draftId);
  const source = await readServiceRepeatSource(ctx, id),
    origin = await r.origin(v.draftId);
  if (!origin && source.version !== expected.version) fail(412);
  if (
    source.snapshotDigest !== v.snapshotDigest ||
    (!origin && source.scopeDigest !== v.scopeDigest)
  )
    fail();
  const selections = v.selections.map((s) => {
    const c = source.candidates.find((c) => c.key === s.key);
    if (!c) fail(404);
    const {
      labelEn: _e,
      labelTa: _t,
      requestedWork: _w,
      state: _s,
      previousPaise: _p,
      ...ref
    } = c;
    return {
      ...ref,
      lineVersion:
        origin?.selections.find((x) => x.key === s.key)?.lineVersion ??
        ref.lineVersion,
      targetLineId: s.targetLineId,
    };
  });
  const ref: ServiceRepeatRef = {
    sourceId: source.id,
    sourceVersion: expected.version,
    snapshotDigest: v.snapshotDigest,
    scopeDigest: v.scopeDigest,
    subjectId: source.subjectId,
    reuseInstructions: v.reuseInstructions,
    selections,
  };
  if (origin && (await requestHash(origin)) !== (await requestHash(ref)))
    fail(422);
  const pieces = [...new Set(selections.map((s) => s.pieceId))];
  const initial: ServiceRepeatDraft = {
    ...emptyServiceOrder(v.subjectId),
    customerId: source.customer?.id ?? null,
    wearerId: source.wearer?.id ?? null,
    sourceOrderId: source.id,
    sourcePieceId: pieces.length === 1 ? (pieces[0] ?? null) : null,
    subjectDescription: source.subjectDescription,
    profile: v.profile,
    instructions: v.reuseInstructions ? source.instructions : "",
    lines: selections.map((s, i) => ({
      id: s.targetLineId,
      key: v.selections[i]?.targetKey ?? "",
      requestedWork:
        source.candidates.find((c) => c.key === s.key)?.requestedWork ?? "",
      priceState: "to-be-quoted",
      priceText: "",
      notRequired: false,
      notRequiredReason: "",
    })),
    repeat: ref,
  };
  const result = await mutateDraft(
    {
      shopId: ctx.orders.templates.shopId,
      actor: { type: "user", id: ctx.orders.templates.actorId },
      repository: r.drafts,
      workflows: new Map([
        ["order.repeat-service", serviceRepeatWorkflow(ctx)],
      ]),
    },
    v.draftId,
    "save",
    { workflow: "order.repeat-service", schemaVersion: 1, payload: initial },
    { key, requestId: headers.requestId },
  );
  if (!origin)
    await r.insertOrigin(
      v.draftId,
      ref,
      initial,
      key,
      ctx.orders.templates.actorId,
    );
  return result;
}
