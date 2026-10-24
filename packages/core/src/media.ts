import {
  type MediaAdmission,
  type MediaRecord,
  type MediaType,
  type MediaVariant,
  mediaAdmissionSchema,
  mediaCompletionSchema,
  mediaDerivativeSchema,
  mediaSuccessSchema,
} from "@aarili/contracts/media";
import {
  type Actor,
  actorSchema,
  idempotencyHeaderSchema,
} from "@aarili/contracts/request";
import type {
  MediaAsset,
  MediaAttempt,
  MediaRepository,
  StoredMediaDerivative,
} from "@aarili/db/repositories/media";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
export type MediaPolicy = {
  prepare?(subjectId: string): Promise<void>;
  protectAcceptedWrites?(subjectId: string): Promise<boolean>;
  authorizeRead?(assetId: string): Promise<void>;
  authorize(input: {
    action: "upload" | "complete" | "read" | "process";
    subjectId: string;
    purpose: MediaAdmission["purpose"];
    contentType: MediaType;
  }): Promise<{ minor: boolean; guardianConsent: boolean } | null>;
};
export const deniedMediaPolicy: MediaPolicy = { authorize: async () => null };
async function lockAsset(ctx: MediaContext, id: string) {
  if (ctx.policy.prepare) {
    const a = await ctx.repository.read(id);
    if (a) await ctx.policy.prepare(a.subjectId);
  }
  await ctx.repository.lock(id);
}
export type MediaStorage = {
  signPut(
    key: string,
    type: MediaType,
    expires: number,
    now: Date,
  ): Promise<string>;
  signGet(
    key: string,
    type: MediaType,
    filename: string,
    expires: number,
    now: Date,
  ): Promise<string>;
  snapshot(key: string, maxBytes: number): Promise<Uint8Array>;
  snapshotPrivate?(key: string, maxBytes: number): Promise<Uint8Array>;
  seal(prefix: string, bytes: Uint8Array, type: MediaType): Promise<string>;
  removeStaging(key: string): Promise<void>;
};
export type MediaJobs = {
  enqueue(attempt: MediaAttempt): Promise<void>;
  status?(
    attempt: MediaAttempt,
  ): Promise<"queued" | "running" | "retrying" | "failed" | "unavailable">;
};
export type MediaContext = {
  shopId: string;
  actor: Actor;
  repository: MediaRepository;
  policy: MediaPolicy;
  storage: MediaStorage;
  jobs: MediaJobs;
  instrumentation?: {
    stored(actionId: string, assetId: string, bytes: number): Promise<void>;
  };
};
export class MediaFailure extends Error {
  constructor(
    public readonly status: 403 | 404 | 409 | 412 | 422 | 428 | 503,
    public readonly code: string,
  ) {
    super(code);
  }
}
function fail(status: MediaFailure["status"], code: string): never {
  throw new MediaFailure(status, code);
}
export function publicMedia(a: MediaAsset): MediaRecord {
  return {
    id: a.id,
    subjectId: a.subjectId,
    purpose: a.purpose,
    contentType: a.contentType,
    size: a.size,
    status: a.status,
    version: a.version,
    createdAt: a.createdAt,
  };
}
async function authority(
  ctx: MediaContext,
  a: Pick<MediaAsset, "subjectId" | "purpose" | "contentType">,
  action: "upload" | "complete" | "read" | "process",
) {
  const p = await ctx.policy.authorize({
    action,
    subjectId: a.subjectId,
    purpose: a.purpose,
    contentType: a.contentType,
  });
  if (!p) fail(action === "read" ? 404 : 403, "MEDIA_ACCESS_DENIED");
  if (
    p.minor &&
    (a.contentType.startsWith("image/") || a.purpose === "private-fitting") &&
    !p.guardianConsent
  )
    fail(action === "read" ? 404 : 403, "MEDIA_ACCESS_DENIED");
  return p;
}
function requireId(id: string) {
  if (!idempotencyHeaderSchema.safeParse(id).success)
    fail(422, "VALIDATION_FAILED");
}
async function binding(
  ctx: MediaContext,
  action: string,
  input: unknown,
  key: string,
) {
  requireId(key);
  key = key.toLowerCase();
  actorSchema.parse(ctx.actor);
  if (ctx.actor.type !== "user") fail(403, "MEDIA_ACCESS_DENIED");
  const b = {
    actor: ctx.actor,
    action,
    hash: await requestHash({
      shopId: ctx.shopId.toLowerCase(),
      actor: ctx.actor,
      action,
      input,
    }),
  };
  await ctx.repository.lockKey(key);
  const old = await ctx.repository.replay(key);
  if (
    old &&
    (old.hash !== b.hash ||
      old.action !== b.action ||
      old.actor.id !== b.actor.id ||
      old.actor.type !== b.actor.type)
  )
    fail(422, "IDEMPOTENCY_MISMATCH");
  return { b, old };
}
export async function admitMedia(
  ctx: MediaContext,
  input: unknown,
  headers: { key: string; requestId: string },
) {
  ctx = { ...ctx, shopId: ctx.shopId.toLowerCase() };
  headers = { ...headers, key: headers.key.toLowerCase() };
  requireId(headers.requestId);
  const parsed = mediaAdmissionSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const p = parsed.data;
  if (p.contentType.startsWith("image/") && p.size > 20 * 1024 * 1024)
    fail(422, "VALIDATION_FAILED");
  const photo = ["wearer-photo", "private-fitting", "shop-branding"].includes(
    p.purpose,
  );
  if (
    (photo && !p.contentType.startsWith("image/")) ||
    (p.purpose === "voice-note" && !p.contentType.startsWith("audio/")) ||
    (p.purpose === "order-document" && p.contentType !== "application/pdf") ||
    (p.purpose === "manual-pattern" &&
      !p.contentType.startsWith("image/") &&
      p.contentType !== "application/pdf")
  )
    fail(422, "VALIDATION_FAILED");
  const { b, old } = await binding(ctx, "media.admit", p, headers.key);
  await ctx.policy.prepare?.(p.subjectId);
  const permitted = await authority(ctx, p, "upload");
  // Request-key responses contain no signed secrets. Replay may renew only an
  // unexpired existing staging grant; accepted/expired history is never reopened.
  let a: MediaAsset;
  if (old) {
    const response = mediaSuccessSchema.parse(old.response);
    await lockAsset(ctx, response.asset.id);
    const found = await ctx.repository.read(response.asset.id);
    if (!found) fail(404, "NOT_FOUND");
    a = found;
  } else {
    const now = await ctx.repository.now();
    const id = await ctx.repository.id();
    a = await ctx.repository.insert({
      ...p,
      id,
      minor: permitted.minor,
      creatorId: ctx.actor.id,
      stagingKey: `shops/${ctx.shopId}/staging/${id}`,
      expiresAt: new Date(now.getTime() + 300000).toISOString(),
    });
    await ctx.repository.audit({
      id: await ctx.repository.id(),
      actor: ctx.actor,
      action: b.action,
      assetId: id,
      requestId: headers.requestId,
      key: headers.key,
    });
    await ctx.repository.persist(headers.key, b, { asset: publicMedia(a) });
  }
  const now = await ctx.repository.now();
  const seconds = Math.floor((Date.parse(a.expiresAt) - now.getTime()) / 1000);
  if (a.status !== "pending_upload" || seconds < 1) fail(409, "UPLOAD_CLOSED");
  return {
    asset: publicMedia(a),
    upload: {
      url: await ctx.storage.signPut(
        a.stagingKey,
        a.contentType,
        Math.min(300, seconds),
        now,
      ),
      method: "PUT" as const,
      headers: { "Content-Type": a.contentType },
      expiresAt: a.expiresAt,
    },
  };
}
export async function completeMedia(
  ctx: MediaContext,
  id: string,
  input: unknown,
  headers: { key: string; requestId: string; ifMatch?: string | undefined },
) {
  requireId(id);
  id = id.toLowerCase();
  ctx = { ...ctx, shopId: ctx.shopId.toLowerCase() };
  headers = { ...headers, key: headers.key.toLowerCase() };
  requireId(headers.requestId);
  if (!mediaCompletionSchema.safeParse(input).success)
    fail(422, "VALIDATION_FAILED");
  const expected = parseExpectedVersion(headers.ifMatch);
  if (!expected.ok) fail(expected.status, expected.code);
  const { b, old } = await binding(
    ctx,
    "media.complete",
    { id, input, version: expected.version },
    headers.key,
  );
  await lockAsset(ctx, id);
  const a = await ctx.repository.read(id);
  if (!a) fail(404, "NOT_FOUND");
  await authority(ctx, a, "complete");
  if (old) return mediaSuccessSchema.parse(old.response);
  // Durable one-attempt identity outlives ordinary request-key expiry. A later
  // key cannot requeue or turn ready/quarantined content back into an upload.
  if (a.status !== "pending_upload") fail(409, "UPLOAD_CLOSED");
  if (a.version !== expected.version) fail(412, "VERSION_STALE");
  if (Date.parse(a.expiresAt) < (await ctx.repository.now()).getTime())
    fail(409, "UPLOAD_CLOSED");
  const state = await ctx.repository.control();
  if (!state?.outbound) fail(409, "RESTORE_BLOCKED");
  const attempt: MediaAttempt = {
    id: await ctx.repository.id(),
    assetId: id,
    epoch: state.epoch,
    fence: null,
    leaseUntil: null,
    state: "queued",
    initiatorId: ctx.actor.id,
  };
  const changed = await ctx.repository.start(a, attempt);
  await ctx.repository.audit({
    id: attempt.id,
    actor: ctx.actor,
    action: b.action,
    assetId: id,
    requestId: headers.requestId,
    key: headers.key,
  });
  await ctx.jobs.enqueue(attempt);
  const response = { asset: publicMedia(changed) };
  await ctx.repository.persist(headers.key, b, response);
  return response;
}
export function mediaFilename(a: MediaAsset) {
  const ext: Record<MediaType, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
  };
  return `file-${a.id}.${ext[a.contentType]}`;
}
export async function mediaStatus(ctx: MediaContext, id: string) {
  requireId(id);
  const a = await ctx.repository.read(id);
  if (!a || ["expired", "deleted"].includes(a.status)) fail(404, "NOT_FOUND");
  await authority(ctx, a, "read");
  return {
    asset: publicMedia(a),
    derivatives:
      a.status === "ready"
        ? (await ctx.repository.derivatives(id)).map(({ key: _key, ...d }) => d)
        : [],
    processingState:
      a.status === "processing"
        ? await (async () => {
            const attempt = await ctx.repository.attempt(id);
            return attempt && ctx.jobs.status
              ? ctx.jobs.status(attempt)
              : ("unavailable" as const);
          })()
        : null,
  };
}
export async function readMedia(
  ctx: MediaContext,
  id: string,
  variant?: MediaVariant,
) {
  requireId(id);
  const a = await ctx.repository.read(id);
  if (a?.status !== "ready" || !a.acceptedKey) fail(404, "NOT_FOUND");
  await authority(ctx, a, "read");
  const now = await ctx.repository.now();
  await ctx.policy.authorizeRead?.(id);
  const derivative = variant
    ? (await ctx.repository.derivatives(id)).find((d) => d.variant === variant)
    : undefined;
  if (variant && !derivative) fail(404, "NOT_FOUND");
  const filename = derivative ? `file-${a.id}.webp` : mediaFilename(a);
  return {
    url: await ctx.storage.signGet(
      derivative?.key ?? a.acceptedKey,
      derivative?.contentType ?? a.contentType,
      filename,
      300,
      now,
    ),
    filename,
    expiresAt: new Date(now.getTime() + 300000).toISOString(),
  };
}
// Trusted server validator capability. Production composes the bounded native
// validator; legacy byte-only adapters remain confined to synthetic proofs.
export class MediaValidationFailure extends Error {
  constructor() {
    super("MEDIA_CONTENT_REJECTED");
  }
}
export type ValidatedMedia = {
  original: Uint8Array;
  derivatives: readonly {
    variant: MediaVariant;
    bytes: Uint8Array;
    width: number;
    height: number;
    contentType: "image/webp";
  }[];
};
export type MediaValidator = {
  validate(
    bytes: Uint8Array,
    asset: MediaAsset,
  ): Promise<Uint8Array | ValidatedMedia>;
};
export type MediaProcessingHost = {
  transaction<T>(run: (ctx: MediaContext) => Promise<T>): Promise<T>;
};
function sameAttemptInitiator(ctx: MediaContext, attempt: MediaAttempt) {
  return (
    ctx.actor.type === "user" &&
    ctx.actor.id.toLowerCase() === attempt.initiatorId.toLowerCase()
  );
}
export async function inspectMediaProcessing(
  ctx: MediaContext,
  assetId: string,
  attemptId: string,
  epoch: string,
) {
  await lockAsset(ctx, assetId);
  const asset = await ctx.repository.read(assetId),
    attempt = await ctx.repository.attempt(assetId),
    control = await ctx.repository.control();
  if (
    !asset ||
    !attempt ||
    attempt.id !== attemptId ||
    !sameAttemptInitiator(ctx, attempt)
  )
    return "denied" as const;
  if (!control?.outbound || epoch !== attempt.epoch || epoch !== control.epoch)
    return "restore-blocked" as const;
  await authority(ctx, asset, "process");
  if (asset.status === "ready" && attempt.state === "accepted")
    return "accepted" as const;
  if (asset.status === "quarantined" && attempt.state === "quarantined")
    return "content-rejected" as const;
  return "pending" as const;
}
export async function processMedia(
  host: MediaProcessingHost,
  assetId: string,
  attemptId: string,
  validator: MediaValidator | null,
  beforeAccept: () => Promise<void> = async () => {},
) {
  if (!validator) return "disabled" as const;
  requireId(assetId);
  requireId(attemptId);
  assetId = assetId.toLowerCase();
  attemptId = attemptId.toLowerCase();
  const claim = await host.transaction(async (ctx) => {
    await lockAsset(ctx, assetId);
    const a = await ctx.repository.read(assetId);
    const attempt = await ctx.repository.attempt(assetId);
    const control = await ctx.repository.control();
    if (
      !a ||
      !attempt ||
      attempt.id !== attemptId ||
      !sameAttemptInitiator(ctx, attempt) ||
      !control?.outbound ||
      attempt.epoch !== control.epoch
    )
      return null;
    if (a.status === "ready" || attempt.state === "accepted") return null;
    if (a.status !== "processing") return null;
    await authority(ctx, a, "process");
    const now = await ctx.repository.now();
    if (attempt.leaseUntil && Date.parse(attempt.leaseUntil) > now.getTime())
      return null;
    const fence = await ctx.repository.id();
    await ctx.repository.claim(
      attempt.id,
      fence,
      new Date(now.getTime() + 300000).toISOString(),
    );
    await ctx.repository.audit({
      id: fence,
      actor: ctx.actor,
      action: "media.claim",
      assetId,
      requestId: attemptId,
      key: attemptId,
    });
    return {
      a,
      attempt,
      fence,
      storage: ctx.storage,
      protectedWrites:
        (await ctx.policy.protectAcceptedWrites?.(a.subjectId)) ?? false,
    };
  });
  if (!claim) return "ignored" as const;
  try {
    // Fresh fence-derived accepted key prevents a stale/crashed claimant from
    // overwriting another claim. Never copy the mutable staging object after validation.
    const prefix = `shops/${claim.a.shopId}/private/${assetId}/${claim.fence}`;
    const snapshot = await claim.storage.snapshot(
      claim.a.stagingKey,
      claim.a.size,
    );
    let bytes: Uint8Array;
    let derivatives: ValidatedMedia["derivatives"] = [];
    try {
      const validated = await validator.validate(snapshot, { ...claim.a });
      bytes = new Uint8Array(
        validated instanceof Uint8Array ? validated : validated.original,
      );
      if (!(validated instanceof Uint8Array)) {
        derivatives = validated.derivatives.map((d) => ({
          ...d,
          bytes: new Uint8Array(d.bytes),
        }));
        if (
          derivatives.length !==
            (claim.a.contentType.startsWith("image/") ? 2 : 0) ||
          new Set(derivatives.map((d) => d.variant)).size !==
            derivatives.length ||
          derivatives.some(
            (d) =>
              !mediaDerivativeSchema.safeParse({
                ...d,
                bytes: d.bytes.length,
                sha256: "0".repeat(64),
              }).success ||
              d.width > (d.variant === "thumbnail" ? 320 : 1600) ||
              d.height > (d.variant === "thumbnail" ? 320 : 1600) ||
              d.bytes.length > 20 * 1024 * 1024,
          )
        )
          throw new MediaValidationFailure();
      }
      // Own the validated output: a validator retaining its input/output cannot
      // mutate the buffer between hashing and storage consumption.
      if (!bytes.length || bytes.length > 25 * 1024 * 1024)
        throw new MediaValidationFailure();
    } catch (error) {
      if (!(error instanceof MediaValidationFailure)) throw error;
      return await host.transaction(async (ctx) => {
        await lockAsset(ctx, assetId);
        const a = await ctx.repository.read(assetId);
        const attempt = await ctx.repository.attempt(assetId);
        const control = await ctx.repository.control();
        const now = await ctx.repository.now();
        if (
          a?.status !== "processing" ||
          attempt?.id !== attemptId ||
          !sameAttemptInitiator(ctx, attempt) ||
          attempt.fence !== claim.fence ||
          !attempt.leaseUntil ||
          Date.parse(attempt.leaseUntil) <= now.getTime() ||
          !control?.outbound ||
          control.epoch !== attempt.epoch
        )
          return "orphaned" as const;
        await authority(ctx, a, "process");
        await beforeAccept();
        await ctx.repository.quarantine(assetId, attemptId, claim.fence);
        const actionId = await ctx.repository.id();
        await ctx.repository.audit({
          id: actionId,
          actor: ctx.actor,
          action: "media.quarantine",
          assetId,
          requestId: attemptId,
          key: attemptId,
        });
        await beforeAccept();
        return "quarantined" as const;
      });
    }
    const digest = async (value: Uint8Array) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new Uint8Array(value).buffer),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    const seal = async (value: Uint8Array, type: MediaType) => {
      // Fitting erasure must not finish while an old claimant can still create
      // a retained output. Keep its identity/media/restore barriers through I/O.
      const key = claim.protectedWrites
        ? await host.transaction(async (ctx) => {
            await lockAsset(ctx, assetId);
            const a = await ctx.repository.read(assetId),
              attempt = await ctx.repository.attempt(assetId),
              control = await ctx.repository.control(),
              now = await ctx.repository.now();
            if (
              a?.status !== "processing" ||
              attempt?.id !== attemptId ||
              !sameAttemptInitiator(ctx, attempt) ||
              attempt.fence !== claim.fence ||
              !attempt.leaseUntil ||
              Date.parse(attempt.leaseUntil) <= now.getTime() ||
              !control?.outbound ||
              control.epoch !== attempt.epoch
            )
              fail(409, "MEDIA_ATTEMPT_STALE");
            await authority(ctx, a, "process");
            return ctx.storage.seal(prefix, value, type);
          })
        : await claim.storage.seal(prefix, value, type);
      const suffix = key.startsWith(`${prefix}/`)
        ? key.slice(prefix.length + 1)
        : "";
      if (
        !idempotencyHeaderSchema.safeParse(suffix).success ||
        key !== `${prefix}/${suffix}`
      )
        fail(503, "MEDIA_UNAVAILABLE");
      return key;
    };
    const hash = await digest(bytes);
    const key = await seal(bytes, claim.a.contentType);
    const stored: StoredMediaDerivative[] = [];
    for (const d of derivatives) {
      const sha256 = await digest(d.bytes);
      const derivativeKey = await seal(d.bytes, d.contentType);
      if (
        derivativeKey === key ||
        stored.some((item) => item.key === derivativeKey)
      )
        fail(503, "MEDIA_UNAVAILABLE");
      stored.push({
        variant: d.variant,
        key: derivativeKey,
        sha256,
        bytes: d.bytes.length,
        width: d.width,
        height: d.height,
        contentType: d.contentType,
      });
    }
    return await host.transaction(async (ctx) => {
      await lockAsset(ctx, assetId);
      const a = await ctx.repository.read(assetId);
      const attempt = await ctx.repository.attempt(assetId);
      const control = await ctx.repository.control();
      const now = await ctx.repository.now();
      if (
        a?.status !== "processing" ||
        !attempt ||
        attempt.id !== attemptId ||
        !sameAttemptInitiator(ctx, attempt) ||
        attempt.fence !== claim.fence ||
        !attempt.leaseUntil ||
        Date.parse(attempt.leaseUntil) <= now.getTime() ||
        !control?.outbound ||
        control.epoch !== attempt.epoch
      )
        return "orphaned" as const;
      await authority(ctx, a, "process");
      await beforeAccept();
      await ctx.repository.accept(
        assetId,
        attemptId,
        claim.fence,
        key,
        hash,
        bytes.length,
        stored,
      );
      const actionId = await ctx.repository.id();
      await ctx.repository.audit({
        id: actionId,
        actor: ctx.actor,
        action: "media.accept",
        assetId,
        requestId: attemptId,
        key: attemptId,
      });
      await ctx.instrumentation?.stored(
        actionId,
        assetId,
        bytes.length + stored.reduce((sum, d) => sum + d.bytes, 0),
      );
      await beforeAccept();
      return "accepted" as const;
    });
  } catch (error) {
    // A caught I/O/transaction failure must not consume all queue retries while
    // the five-minute durable lease remains busy. Release only this exact
    // still-owned fence; crashes retain the lease until queue expiry/recovery.
    try {
      await host.transaction(async (ctx) => {
        await lockAsset(ctx, assetId);
        const a = await ctx.repository.read(assetId);
        const attempt = await ctx.repository.attempt(assetId);
        if (
          a?.status === "processing" &&
          attempt?.id === attemptId &&
          attempt.fence === claim.fence &&
          sameAttemptInitiator(ctx, attempt)
        )
          await ctx.repository.release(attemptId, claim.fence);
      });
    } catch {
      /* Preserve original failure; successor recovers after lease expiry. */
    }
    throw error;
  }
}
export async function cleanupMedia(
  ctx: MediaContext,
  id: string,
  graceSeconds: number,
) {
  requireId(id);
  id = id.toLowerCase();
  if (!Number.isInteger(graceSeconds) || graceSeconds < 300)
    fail(422, "VALIDATION_FAILED");
  await ctx.repository.lock(id);
  const a = await ctx.repository.read(id);
  if (
    !a ||
    a.acceptedKey ||
    a.attemptId ||
    !["pending_upload", "expired"].includes(a.status) ||
    (await ctx.repository.referenced(id))
  )
    return false;
  if (
    (await ctx.repository.now()).getTime() <
    Date.parse(a.expiresAt) + graceSeconds * 1000
  )
    return false;
  if (a.status !== "expired" && !(await ctx.repository.expire(id)))
    return false;
  if (a.status !== "expired") {
    const actionId = await ctx.repository.id();
    await ctx.repository.audit({
      id: actionId,
      actor: ctx.actor,
      action: "media.expire",
      assetId: id,
      requestId: actionId,
      key: actionId,
    });
  }
  // Only staging namespaces can be removed. Keep transaction lock through delete
  // so completion cannot start between eligibility and external removal. Retry is safe.
  await ctx.storage.removeStaging(a.stagingKey);
  return true;
}
export type MediaOrphanStorage = {
  list(prefix: string): Promise<readonly string[]>;
  remove(key: string): Promise<void>;
};
// Explicit server/operator composition only: no endpoint, schedule or ambient
// bucket. Never use this for accepted history, references or privacy erasure.
export async function reconcileMediaOutputs(
  host: MediaProcessingHost,
  id: string,
  storage: MediaOrphanStorage,
  graceSeconds: number,
) {
  requireId(id);
  id = id.toLowerCase();
  if (!Number.isInteger(graceSeconds) || graceSeconds < 300)
    fail(422, "VALIDATION_FAILED");
  const valid = (key: string, fence: string, shop: string) => {
    const prefix = `shops/${shop}/private/${id}/${fence}/`;
    return (
      key.startsWith(prefix) &&
      idempotencyHeaderSchema.safeParse(key.slice(prefix.length)).success
    );
  };
  await host.transaction(async (ctx) => {
    await lockAsset(ctx, id);
    const a = await ctx.repository.read(id),
      control = await ctx.repository.control();
    if (!a || !control?.outbound) return;
    await authority(ctx, a, "process");
    if (await ctx.repository.referenced(id)) return;
    const now = await ctx.repository.now(),
      attempt = await ctx.repository.attempt(id);
    const kept = new Set([
      a.acceptedKey,
      ...(await ctx.repository.derivatives(id)).map((d) => d.key),
    ]);
    const claims = await ctx.repository.claims(
      id,
      new Date(now.getTime() - graceSeconds * 1000).toISOString(),
    );
    let count = 0;
    for (const { fence } of claims) {
      if (
        attempt?.fence === fence &&
        attempt.state === "processing" &&
        attempt.leaseUntil &&
        Date.parse(attempt.leaseUntil) > now.getTime()
      )
        continue;
      const prefix = `shops/${ctx.shopId}/private/${id}/${fence}`;
      const keys = await storage.list(prefix);
      if (keys.length > 20) fail(503, "MEDIA_UNAVAILABLE");
      for (const key of keys) {
        if (!valid(key, fence, ctx.shopId)) fail(503, "MEDIA_UNAVAILABLE");
        if (kept.has(key)) continue;
        const intentId = await ctx.repository.id();
        if (
          await ctx.repository.intent(
            id,
            { id: intentId, key, fence, epoch: control.epoch },
            ctx.actor.id,
          )
        )
          await ctx.repository.audit({
            id: intentId,
            actor: ctx.actor,
            action: "media.orphan-intent",
            assetId: id,
            requestId: intentId,
            key: intentId,
          });
        if (++count >= 20) return;
      }
    }
  });
  // The first transaction (including deletion intent+audit) has committed.
  // Each bounded deletion re-locks/rechecks current authority and restore state.
  const intents = await host.transaction(async (ctx) => {
    await lockAsset(ctx, id);
    const a = await ctx.repository.read(id);
    const control = await ctx.repository.control();
    if (!a || !control?.outbound) return [];
    await authority(ctx, a, "process");
    return ctx.repository.cleanupIntents(id, control.epoch);
  });
  let removed = 0;
  for (const intent of intents)
    await host.transaction(async (ctx) => {
      await lockAsset(ctx, id);
      const a = await ctx.repository.read(id),
        control = await ctx.repository.control(),
        now = await ctx.repository.now();
      if (
        !a ||
        !control?.outbound ||
        control.epoch !== intent.epoch ||
        !valid(intent.key, intent.fence, ctx.shopId)
      )
        return;
      await authority(ctx, a, "process");
      const pending = await ctx.repository.cleanupIntents(id, control.epoch);
      if (!pending.some((p) => p.id === intent.id)) return;
      if (
        !(
          await ctx.repository.claims(
            id,
            new Date(now.getTime() - graceSeconds * 1000).toISOString(),
          )
        ).some((claim) => claim.fence === intent.fence)
      )
        return;
      const attempt = await ctx.repository.attempt(id);
      if (
        (attempt?.fence === intent.fence &&
          attempt.state === "processing" &&
          attempt.leaseUntil &&
          Date.parse(attempt.leaseUntil) > now.getTime()) ||
        (await ctx.repository.referenced(id)) ||
        a.acceptedKey === intent.key ||
        (await ctx.repository.derivatives(id)).some((d) => d.key === intent.key)
      )
        return;
      await storage.remove(intent.key);
      const actionId = await ctx.repository.id();
      await ctx.repository.cleaned(id, intent.id, actionId);
      await ctx.repository.audit({
        id: actionId,
        actor: ctx.actor,
        action: "media.orphan-cleaned",
        assetId: id,
        requestId: intent.id,
        key: intent.id,
      });
      removed++;
    });
  return removed;
}
