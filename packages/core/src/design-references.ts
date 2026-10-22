import {
  type DesignMediaSubject,
  designMediaSubjectCommandSchema,
  designMediaSubjectDraftSchema,
} from "@aarili/contracts/design-references";
import {
  type DesignSpecificationMediaDraft,
  type DesignSpecificationVersion,
  designSpecificationMediaCommandSchema,
  designSpecificationMediaDraftSchema,
} from "@aarili/contracts/design-specifications";
import type { MediaVariant } from "@aarili/contracts/media";
import type { DesignReferencesRepository } from "@aarili/db/repositories/design-references";
import type { DraftRepository } from "@aarili/db/repositories/drafts";
import type { MediaRepository } from "@aarili/db/repositories/media";
import {
  authorizeDesignSubject,
  type DesignMediaAuthority,
  prepareDesignMediaOrders,
} from "./design-media-policy.js";
import {
  type DesignSpecificationsContext,
  designSpecificationWorkflow,
} from "./design-specifications.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { type MediaContext, MediaFailure, readMedia } from "./media.js";
import { requestHash } from "./request-binding.js";

export type DesignReferencesContext = {
  specifications: DesignSpecificationsContext;
  repository: DesignReferencesRepository;
  authority: DesignMediaAuthority;
  media: MediaRepository;
  actorId: string;
  drafts: Pick<DraftRepository, "lockDraft" | "read">;
};
export async function prepareDesignReferenceScopes(
  ctx: DesignReferencesContext,
  scopes: { orderId: string; pieceId: string | null }[],
) {
  await ctx.repository.lockSubject("");
  const ids = scopes.map((s) => s.orderId);
  for (const s of scopes)
    ids.push(...(await ctx.repository.referenceOrderIds(s.orderId, s.pieceId)));
  try {
    await prepareDesignMediaOrders(ctx.authority, ids);
  } catch (error) {
    if (error instanceof MediaFailure) fail(404);
    throw error;
  }
  // A short owner-only barrier precedes every aggregate class, stabilizing all
  // reference sources before discovery; old business writers never take it.
}
export async function sanitizeDesignReferenceVersion(
  ctx: DesignReferencesContext,
  v: DesignSpecificationVersion,
) {
  const referenceItems = [];
  for (const r of v.referenceItems) {
    try {
      const current = await ctx.repository.subject(r.subject.id);
      if (!current) fail(404);
      await ctx.repository.lockSubject(current.id);
      await authorizeDesignSubject(
        ctx.authority,
        current,
        r.contentType.startsWith("image/") || r.purpose === "private-fitting",
      );
      referenceItems.push(r);
    } catch (e) {
      if (!(e instanceof MediaFailure) && !(e instanceof DraftFailure)) throw e;
      referenceItems.push({
        ...r,
        caption: "",
        annotations: [],
        redacted: true,
        subject: {
          ...r.subject,
          sourceText: "",
          sourceDate: null,
          rightsEvidence: "",
          reason: "",
          redacted: true,
        },
      });
    }
  }
  return { ...v, referenceItems };
}
function fail(status: 404 | 409 | 422 = 409): never {
  throw new DraftFailure(status, {
    error: {
      code:
        status === 404
          ? "NOT_FOUND"
          : status === 422
            ? "VALIDATION_FAILED"
            : "REQUEST_CONFLICT",
      message: "Review the exact private design reference",
    },
  });
}
const plain = (v: DesignSpecificationMediaDraft) => {
  const { referenceItems: _refs, ...base } = v;
  return base;
};
async function discover(
  ctx: DesignReferencesContext,
  v: DesignSpecificationMediaDraft,
) {
  const subjects = [];
  for (const r of v.referenceItems) {
    const s = await ctx.repository.subjectForAsset(r.assetId);
    if (!s) fail(404);
    subjects.push(s);
  }
  // Include an A2 repeat source before any identity class is locked.
  const source = v.reuse
    ? await ctx.specifications.repository.read(v.reuse.versionId)
    : undefined;
  await prepareDesignReferenceScopes(ctx, [
    { orderId: v.orderId, pieceId: v.pieceId },
    ...subjects.flatMap((s) =>
      s.orderId ? [{ orderId: s.orderId, pieceId: s.pieceId }] : [],
    ),
    ...(source ? [{ orderId: source.orderId, pieceId: source.pieceId }] : []),
  ]);
  for (const id of [...new Set(subjects.map((s) => s.id))].sort())
    await ctx.repository.lockSubject(id);
}
async function prepare(
  ctx: DesignReferencesContext,
  v: DesignSpecificationMediaDraft,
) {
  await discover(ctx, v);
  for (const r of v.referenceItems) {
    const s = await ctx.repository.subjectForAsset(r.assetId),
      a = await ctx.media.read(r.assetId);
    if (!s || !a || s.redacted) fail(404);
    const target = await ctx.repository.scope(v.orderId);
    const origin = s.orderId
      ? await ctx.repository.scope(s.orderId)
      : undefined;
    if (
      s.kind === "private" &&
      (!origin || origin.wearerId !== target?.wearerId)
    )
      fail(404);
    try {
      await authorizeDesignSubject(
        ctx.authority,
        s,
        a.contentType.startsWith("image/") || a.purpose === "private-fitting",
      );
    } catch (e) {
      if (e instanceof MediaFailure) fail(404);
      throw e;
    }
  }
}
async function validate(
  ctx: DesignReferencesContext,
  v: DesignSpecificationMediaDraft,
  selection = false,
) {
  await prepare(ctx, v);
  for (const id of [...new Set(v.referenceItems.map((r) => r.assetId))].sort())
    await ctx.media.lock(id);
  const base = v.baseSavedId
    ? await ctx.specifications.repository.read(v.baseSavedId)
    : undefined;
  const profile = v.profile
    ? await ctx.specifications.choices.repository.definition(
        v.profile.revisionId,
      )
    : undefined;
  for (const r of v.referenceItems) {
    const a = await ctx.media.read(r.assetId),
      s = await ctx.repository.subjectForAsset(r.assetId);
    if (
      !a ||
      !s ||
      s.redacted ||
      a.status !== "ready" ||
      !a.sha256 ||
      !a.acceptedKey
    )
      fail();
    if (
      r.questionId &&
      (profile?.content.kind !== "profile" ||
        !profile.content.questions.some((q) => q.id === r.questionId))
    )
      fail(422);
    if (s.rightsBasis === "unknown" && r.intent !== "inspiration") fail();
    if (
      s.kind === "library" &&
      (profile?.content.kind !== "profile" ||
        s.category?.entryId !== profile.content.category?.entryId ||
        s.category?.revisionId !== profile.content.category?.revisionId)
    )
      fail();
    const previous = r.replacesId
      ? base?.referenceItems.find((p) => p.id === r.replacesId)
      : undefined;
    if (!selection && r.replacesId && !previous) fail();
    if (
      !selection &&
      s.kind === "library" &&
      (!previous || previous.assetId !== r.assetId) &&
      (await ctx.repository.latest(s.id)) !== s.id
    )
      fail();
    if (r.annotations.some((n) => n.anchor.kind !== "note")) {
      if (
        !a.contentType.startsWith("image/") ||
        !(await ctx.media.derivatives(a.id)).some(
          (d) => d.variant === "display",
        )
      )
        fail(422);
      if (
        !selection &&
        previous &&
        previous.assetId !== r.assetId &&
        !r.geometryReviewed
      )
        fail();
    }
  }
}
export async function validateSelectedDesignReferences(
  ctx: DesignReferencesContext,
  v: DesignSpecificationVersion,
) {
  if (v.referenceItems.some((r) => r.redacted)) fail();
  if (!v.referenceItems.length) return;
  await validate(
    ctx,
    {
      orderId: v.orderId,
      pieceId: v.pieceId,
      baseVersion: 0,
      baseSavedId: v.id,
      operation: "save",
      selectedId: null,
      profile: { entryId: v.profile.entryId, revisionId: v.profile.id },
      answers: v.answers,
      reason: "Exact selection authorization",
      use: false,
      reuse: null,
      referenceItems: v.referenceItems.map(
        ({
          id,
          assetId,
          questionId,
          intent,
          caption,
          annotations,
          replacesId,
          geometryReviewed,
        }) => ({
          id,
          assetId,
          questionId,
          intent,
          caption,
          annotations,
          replacesId,
          geometryReviewed,
        }),
      ),
    },
    true,
  );
}
export function designSpecificationMediaWorkflow(
  ctx: DesignReferencesContext,
): DraftWorkflow {
  let active: DesignSpecificationMediaDraft | undefined;
  const spec = {
    ...ctx.specifications,
    allowReferenceEdit: true,
    repository: {
      ...ctx.specifications.repository,
      async write(
        v: Parameters<DesignSpecificationsContext["repository"]["write"]>[0],
      ) {
        if (!active) fail();
        const result = await ctx.specifications.repository.write({
          ...v,
          digest: await requestHash({
            specificationDigest: v.digest,
            referenceItems: active.referenceItems,
          }),
        });
        if (v.operation === "save") {
          const state = await ctx.specifications.repository.state(
            v.orderId,
            v.pieceId,
          );
          if (!state.latestSavedId) fail();
          await ctx.repository.writeReferences(
            state.latestSavedId,
            active.referenceItems,
          );
        }
        return result;
      },
    },
  };
  const base = designSpecificationWorkflow(spec);
  const authorize = async (input: Record<string, unknown>) => {
    const v = designSpecificationMediaDraftSchema.parse(input);
    await prepare(ctx, v);
    await base.authorizeDraft?.(plain(v));
  };
  return {
    ...base,
    schemaVersion: 2,
    draftSchema: designSpecificationMediaDraftSchema,
    commandSchema: designSpecificationMediaCommandSchema,
    prepareDraftRead: (record) =>
      discover(ctx, designSpecificationMediaDraftSchema.parse(record.payload)),
    validateEdit(a, b) {
      base.validateEdit?.(
        plain(designSpecificationMediaDraftSchema.parse(a)),
        plain(designSpecificationMediaDraftSchema.parse(b)),
      );
    },
    authorizeDraft: authorize,
    authorizePublication: authorize,
    async replayPayload(id, version) {
      const v = await ctx.specifications.repository.replayPayload(id, version);
      await discover(ctx, designSpecificationMediaDraftSchema.parse(v));
      await authorize(
        await ctx.specifications.repository.replayPayload(id, version),
      );
      return ctx.specifications.repository.replayPayload(id, version);
    },
    async revalidate(input, draftId) {
      const v = designSpecificationMediaCommandSchema.parse(input);
      await prepare(ctx, v);
      await base.revalidate(plain(v), draftId);
      if (v.operation === "save") await validate(ctx, v);
    },
    async promote(input, action, draftId, request) {
      const v = designSpecificationMediaCommandSchema.parse(input);
      await prepare(ctx, v);
      if (v.operation === "save") await validate(ctx, v);
      active = v;
      try {
        return await base.promote(plain(v), action, draftId, request);
      } finally {
        active = undefined;
      }
    },
  };
}
async function authorizeSubjectDraft(
  ctx: DesignReferencesContext,
  input: Record<string, unknown>,
) {
  const v = designMediaSubjectDraftSchema.parse(input);
  if (v.kind === "private") {
    if (!v.orderId) fail(404);
    await prepareDesignReferenceScopes(ctx, [
      { orderId: v.orderId, pieceId: v.pieceId },
    ]);
    // Existing A2 scope authorization verifies native pieces, current identity and
    // accepted category/manifest. No fictitious wearer is supplied by this draft.
    await designSpecificationWorkflow(ctx.specifications).authorizeDraft?.({
      orderId: v.orderId,
      pieceId: v.pieceId,
      baseVersion: 0,
      baseSavedId: null,
      operation: "save",
      selectedId: null,
      profile: null,
      answers: [],
      reason: "",
      use: false,
      reuse: null,
    });
  }
  await ctx.repository.lockSubject("");
  if (v.previousId) {
    await ctx.repository.lockSubject(v.previousId);
    const old = await ctx.repository.subject(v.previousId);
    if (
      old?.kind !== "library" ||
      old.redacted ||
      (await ctx.repository.latest(old.id)) !== old.id
    )
      fail();
  }
}
export function designMediaSubjectWorkflow(
  ctx: DesignReferencesContext,
): DraftWorkflow {
  const authorize = (v: Record<string, unknown>) =>
    authorizeSubjectDraft(ctx, v);
  return {
    schemaVersion: 1,
    draftSchema: designMediaSubjectDraftSchema,
    commandSchema: designMediaSubjectCommandSchema,
    minimalReplay: true,
    authorizeDraft: authorize,
    authorizePublication: authorize,
    validateEdit(a, b) {
      const x = designMediaSubjectDraftSchema.parse(a),
        y = designMediaSubjectDraftSchema.parse(b);
      if (
        x.kind !== y.kind ||
        x.orderId !== y.orderId ||
        x.pieceId !== y.pieceId ||
        x.previousId !== y.previousId
      )
        fail();
    },
    async replayPayload(id, version) {
      const v = await ctx.repository.replayDraft(id, version);
      await authorize(v);
      return ctx.repository.replayDraft(id, version);
    },
    retainPrivateResponse: (r, a, k) => ctx.repository.retainDraft(r, a, k),
    async revalidate(input) {
      await authorize(input);
      const v = designMediaSubjectCommandSchema.parse(input);
      if (v.kind === "library") {
        await ctx.specifications.choices.catalogue.repository.lock();
        const c = v.category
          ? await ctx.specifications.choices.catalogue.repository.current(
              v.category.entryId,
            )
          : undefined;
        if (!c?.available || c.definition.id !== v.category?.revisionId) fail();
      }
    },
    async promote(input, _action, draftId, request) {
      const v = designMediaSubjectCommandSchema.parse(input);
      await authorize(input);
      return {
        type: "design.media-subject",
        id: await ctx.repository.writeSubject(
          v,
          draftId,
          ctx.actorId,
          request.key,
          request.requestId,
        ),
      };
    },
    async verifyResult(r, draftId) {
      if (
        r.type !== "design.media-subject" ||
        !(await ctx.repository.subjectOrigin(r.id, draftId))
      )
        fail();
    },
  };
}
export async function readDesignMediaSubject(
  ctx: DesignReferencesContext,
  id: string,
) {
  const initial = await ctx.repository.subject(id);
  if (!initial) fail(404);
  await ctx.repository.lockSubject(id);
  if (initial.orderId)
    await prepareDesignMediaOrders(ctx.authority, [initial.orderId]);
  const s = await ctx.repository.subject(id);
  if (!s) fail(404);
  if (!s.redacted) {
    try {
      await authorizeDesignSubject(ctx.authority, s, false);
    } catch (e) {
      if (e instanceof MediaFailure) fail(404);
      throw e;
    }
  } else if (s.kind === "private") fail(404);
  return s;
}
export async function readDesignReferenceLibrary(
  ctx: DesignReferencesContext,
  before?: string,
) {
  const p = await ctx.repository.library(before);
  const subjects: DesignMediaSubject[] = [];
  for (const s of p.subjects)
    subjects.push(await readDesignMediaSubject(ctx, s.id));
  return { ...p, subjects };
}
export async function readPrivateDesignSubjects(
  ctx: DesignReferencesContext,
  orderId: string,
  pieceId: string | null,
  before?: string,
) {
  await prepareDesignReferenceScopes(ctx, [{ orderId, pieceId }]);
  await designSpecificationWorkflow(ctx.specifications).authorizeDraft?.({
    orderId,
    pieceId,
    baseVersion: 0,
    baseSavedId: null,
    operation: "save",
    selectedId: null,
    profile: null,
    answers: [],
    reason: "",
    use: false,
    reuse: null,
  });
  const p = await ctx.repository.privateSubjects(orderId, pieceId, before);
  const subjects = [];
  for (const s of p.subjects) {
    if (s.redacted)
      subjects.push({
        ...s,
        sourceText: "",
        rightsEvidence: "",
        sourceDate: null,
        reason: "",
      });
    else subjects.push(await readDesignMediaSubject(ctx, s.id));
  }
  return { ...p, subjects };
}
export async function readDesignSubjectAssets(
  ctx: DesignReferencesContext,
  subjectId: string,
  before?: string,
) {
  const subject = await readDesignMediaSubject(ctx, subjectId);
  if (subject.redacted) fail(404);
  return ctx.repository.assets(subjectId, before);
}
// A saved durable draft is an explicit, authorised association too. Preview
// neither creates a specification version nor relaxes current media authority.
export async function readDesignDraftReferenceBytes(
  ctx: DesignReferencesContext,
  media: MediaContext,
  draftId: string,
  referenceId: string,
  variant?: MediaVariant,
) {
  await ctx.drafts.lockDraft(draftId);
  let draft = await ctx.drafts.read(draftId);
  if (
    draft?.workflow !== "design.specification" ||
    draft.schemaVersion !== 2 ||
    draft.lifecycle !== "active"
  )
    fail(404);
  let value = designSpecificationMediaDraftSchema.parse(draft.payload);
  await prepare(ctx, value);
  draft = await ctx.drafts.read(draftId);
  if (draft?.lifecycle !== "active") fail(404);
  value = designSpecificationMediaDraftSchema.parse(draft.payload);
  const reference = value.referenceItems.find((r) => r.id === referenceId);
  if (!reference) fail(404);
  await designSpecificationWorkflow(ctx.specifications).authorizeDraft?.(
    plain(value),
  );
  await validate(ctx, { ...value, referenceItems: [reference] });
  const asset = await ctx.media.read(reference.assetId),
    subject = await ctx.repository.subjectForAsset(reference.assetId);
  if (!asset?.sha256 || !subject || subject.redacted) fail(404);
  const display = (await ctx.media.derivatives(asset.id)).find(
    (d) => d.variant === "display",
  );
  const access = await readMedia(
    {
      ...media,
      policy: {
        ...media.policy,
        authorizeRead: async (id) => {
          if (id !== reference.assetId) fail(404);
        },
      },
    },
    reference.assetId,
    variant,
  );
  return {
    reference: {
      ...reference,
      subject,
      contentType: asset.contentType,
      purpose: asset.purpose,
      sha256: asset.sha256,
      uploaderId: asset.creatorId,
      uploadedAt: asset.createdAt,
      display: display
        ? {
            sha256: display.sha256,
            width: display.width,
            height: display.height,
          }
        : null,
      redacted: false,
    },
    access,
  };
}
export async function readDesignReferenceBytes(
  ctx: DesignReferencesContext,
  media: MediaContext,
  versionId: string,
  referenceId: string,
  variant?: MediaVariant,
) {
  const v = await ctx.specifications.repository.read(versionId);
  if (!v) fail(404);
  const ref = v.referenceItems.find((r) => r.id === referenceId);
  if (!ref) fail(404);
  try {
    await validateSelectedDesignReferences(ctx, v);
  } catch (error) {
    if (
      error instanceof DraftFailure &&
      (error.status === 404 || error.status === 409)
    )
      fail(404);
    throw error;
  }
  const current = await ctx.specifications.repository.read(versionId);
  if (
    !current ||
    current.redacted ||
    !current.referenceItems.some((r) => r.id === referenceId && !r.redacted)
  )
    fail(404);
  return readMedia(
    {
      ...media,
      policy: {
        ...media.policy,
        authorizeRead: async (id) => {
          if (
            id !== ref.assetId ||
            !(await ctx.repository.hasReadableAssociation(id))
          )
            fail(404);
        },
      },
    },
    ref.assetId,
    variant,
  );
}
