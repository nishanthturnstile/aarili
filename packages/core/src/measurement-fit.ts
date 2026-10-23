import {
  type MeasurementFitReferenceDraft,
  type MeasurementFitSubjectDraft,
  measurementFitQuerySchema,
  measurementFitReferenceCommandSchema,
  measurementFitReferenceDraftSchema,
  measurementFitSubjectDraftSchema,
} from "@aarili/contracts/measurement-fit";
import type { MediaVariant } from "@aarili/contracts/media";
import type { MeasurementFitRepository } from "@aarili/db/repositories/measurement-fit";
import type { MediaRepository } from "@aarili/db/repositories/media";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { authorizeMeasurementIdentity } from "./measurement-access.js";
import {
  type MeasurementSessionsContext,
  readMeasurement,
} from "./measurement-sessions.js";
import { type MediaContext, readMedia } from "./media.js";

export type MeasurementFitContext = {
  sessions: MeasurementSessionsContext;
  repository: MeasurementFitRepository;
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
        "Review current photo authority, exact measurement version and ready image",
    },
  });
}
async function authorize(
  ctx: MeasurementFitContext,
  v: MeasurementFitSubjectDraft,
) {
  if (v.erased) fail(404);
  const version = await readMeasurement(
    ctx.sessions,
    v.measurementVersionId,
    v,
  );
  const orders = ctx.sessions.orders;
  await authorizeMeasurementIdentity(
    {
      wearers: orders.wearers.repository,
      guardians: orders.guardians.repository,
      measurements: ctx.sessions.repository,
      policy: orders.wearers.policy,
    },
    v,
    true,
  );
  await ctx.repository.lockSession(version.sessionId);
  return version;
}
async function authorizeReference(
  ctx: MeasurementFitContext,
  v: MeasurementFitReferenceDraft,
  ready = false,
) {
  const version = await authorize(ctx, v),
    subject = await ctx.repository.forSession(version.sessionId);
  if (!subject) fail();
  if (v.previousId) {
    const prior = await ctx.repository.reference(v.previousId, version.id);
    if (!prior || prior.redacted) fail(404);
    if (ready && (prior.headId !== prior.id || prior.version !== v.baseVersion))
      fail(412);
  } else if (v.baseVersion !== 0) fail();
  if (v.assetId) {
    // Reject foreign ownership before a media policy can take another wearer lock.
    const source = await ctx.repository.subjectForAsset(v.assetId);
    if (
      source?.id !== subject.id ||
      source.wearerId !== version.wearerId ||
      source.customerId !== version.customerId
    )
      fail(404);
    await ctx.media.lock(v.assetId);
    const asset = await ctx.media.read(v.assetId);
    if (
      asset?.purpose !== "private-fitting" ||
      !["image/jpeg", "image/png", "image/webp"].includes(asset.contentType) ||
      ["expired", "deleted", "quarantined"].includes(asset.status)
    )
      fail(404);
    if (ready) {
      const derivatives = await ctx.media.derivatives(asset.id);
      if (
        asset.status !== "ready" ||
        !asset.sha256 ||
        !derivatives.some((d) => d.variant === "display") ||
        !derivatives.some((d) => d.variant === "thumbnail")
      )
        fail();
    }
  } else if (ready) fail();
  return subject;
}
export function measurementFitSubjectWorkflow(
  ctx: MeasurementFitContext,
): DraftWorkflow {
  const check = (p: Record<string, unknown>) =>
    authorize(ctx, measurementFitSubjectDraftSchema.parse(p));
  return {
    schemaVersion: 1,
    draftSchema: measurementFitSubjectDraftSchema,
    commandSchema: measurementFitSubjectDraftSchema,
    minimalReplay: true,
    authorizeDraft: async (p) => {
      await check(p);
    },
    authorizePublication: async (p) => {
      await check(p);
    },
    validateEdit(a, b) {
      if (
        JSON.stringify(measurementFitSubjectDraftSchema.parse(a)) !==
        JSON.stringify(measurementFitSubjectDraftSchema.parse(b))
      )
        fail();
    },
    async revalidate(p) {
      const v = await check(p);
      if (await ctx.repository.forSession(v.sessionId)) fail();
    },
    async promote(p, _action, draftId, request) {
      const v = measurementFitSubjectDraftSchema.parse(p),
        version = await authorize(ctx, v);
      if (await ctx.repository.forSession(version.sessionId)) fail();
      return {
        type: "measurement.fit-subject",
        id: await ctx.repository.writeSubject(
          {
            ...v,
            ...request,
            draftId,
            actorId: ctx.sessions.orders.templates.actorId,
          },
          version.sessionId,
        ),
      };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "measurement.fit-subject" ||
        !(await ctx.repository.origin(r.id, draftId, "subject"))
      )
        fail();
    },
    async replayPayload(id, version) {
      const p = await ctx.repository.replayDraft(id, version);
      await check(p);
      return ctx.repository.replayDraft(id, version);
    },
    retainPrivateResponse: (r, a, k) => ctx.repository.retainDraft(r, a, k),
  };
}
export function measurementFitReferenceWorkflow(
  ctx: MeasurementFitContext,
): DraftWorkflow {
  const check = (p: Record<string, unknown>) =>
    authorizeReference(ctx, measurementFitReferenceDraftSchema.parse(p));
  return {
    schemaVersion: 1,
    draftSchema: measurementFitReferenceDraftSchema,
    commandSchema: measurementFitReferenceCommandSchema,
    minimalReplay: true,
    authorizeDraft: async (p) => {
      await check(p);
    },
    authorizePublication: async (p) => {
      await check(p);
    },
    validateEdit(a, b) {
      const x = measurementFitReferenceDraftSchema.parse(a),
        y = measurementFitReferenceDraftSchema.parse(b);
      if (
        x.customerId !== y.customerId ||
        x.wearerId !== y.wearerId ||
        x.measurementVersionId !== y.measurementVersionId ||
        x.previousId !== y.previousId ||
        x.baseVersion !== y.baseVersion ||
        x.erased
      )
        fail();
    },
    async revalidate(p) {
      await authorizeReference(
        ctx,
        measurementFitReferenceCommandSchema.parse(p),
        true,
      );
    },
    async promote(p, _action, draftId, request) {
      const v = measurementFitReferenceCommandSchema.parse(p),
        subject = await authorizeReference(ctx, v, true);
      return {
        type: "measurement.fit-reference",
        id: await ctx.repository.writeReference(
          {
            ...v,
            ...request,
            draftId,
            actorId: ctx.sessions.orders.templates.actorId,
          },
          subject,
        ),
      };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "measurement.fit-reference" ||
        !(await ctx.repository.origin(r.id, draftId, "reference"))
      )
        fail();
    },
    async replayPayload(id, version) {
      const p = await ctx.repository.replayDraft(id, version);
      await check(p);
      return ctx.repository.replayDraft(id, version);
    },
    retainPrivateResponse: (r, a, k) => ctx.repository.retainDraft(r, a, k),
  };
}
export async function readMeasurementFit(
  ctx: MeasurementFitContext,
  input: unknown,
) {
  const parsed = measurementFitQuerySchema.safeParse(input);
  if (!parsed.success) fail(422);
  const v = await readMeasurement(
    ctx.sessions,
    parsed.data.measurementVersionId,
  );
  await authorize(ctx, {
    customerId: v.customerId,
    wearerId: v.wearerId,
    measurementVersionId: v.id,
    erased: false,
  });
  return {
    subject: (await ctx.repository.forSession(v.sessionId)) ?? null,
    ...(await ctx.repository.references(v.id, parsed.data.before)),
  };
}
export async function readMeasurementFitAssets(
  ctx: MeasurementFitContext,
  input: unknown,
) {
  const parsed = measurementFitQuerySchema.safeParse(input);
  if (!parsed.success) fail(422);
  const state = await readMeasurementFit(ctx, {
    measurementVersionId: parsed.data.measurementVersionId,
  });
  if (!state.subject) fail(404);
  return ctx.repository.assets(state.subject.id, parsed.data.before);
}
export async function readMeasurementFitBytes(
  ctx: MeasurementFitContext,
  media: MediaContext,
  versionId: string,
  referenceId: string,
  variant: MediaVariant = "display",
) {
  const version = await readMeasurement(ctx.sessions, versionId);
  await authorize(ctx, {
    customerId: version.customerId,
    wearerId: version.wearerId,
    measurementVersionId: version.id,
    erased: false,
  });
  const ref = await ctx.repository.reference(referenceId, versionId);
  if (!ref || ref.redacted) fail(404);
  const source = await ctx.repository.subjectForAsset(ref.assetId);
  if (
    source?.sessionId !== version.sessionId ||
    source.wearerId !== version.wearerId
  )
    fail(404);
  await ctx.media.lock(ref.assetId);
  const a = await ctx.media.read(ref.assetId),
    derivatives = await ctx.media.derivatives(ref.assetId);
  const d = derivatives.find((x) => x.variant === "display"),
    t = derivatives.find((x) => x.variant === "thumbnail");
  if (
    a?.status !== "ready" ||
    a.sha256 !== ref.originalSha256 ||
    d?.sha256 !== ref.display.sha256 ||
    d.width !== ref.display.width ||
    d.height !== ref.display.height ||
    t?.sha256 !== ref.thumbnailSha256
  )
    fail(404);
  return {
    reference: ref,
    access: await readMedia(
      {
        ...media,
        policy: {
          ...media.policy,
          authorizeRead: async (id) => {
            if (id !== ref.assetId) fail(404);
          },
        },
      },
      ref.assetId,
      variant,
    ),
  };
}
