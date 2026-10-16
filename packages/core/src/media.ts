import {
  type MediaAdmission,
  type MediaRecord,
  type MediaType,
  mediaAdmissionSchema,
  mediaCompletionSchema,
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
} from "@aarili/db/repositories/media";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
export type MediaPolicy = {
  authorize(input: {
    action: "upload" | "complete" | "read" | "process";
    subjectId: string;
    purpose: MediaAdmission["purpose"];
    contentType: MediaType;
  }): Promise<{ minor: boolean; guardianConsent: boolean } | null>;
};
export const deniedMediaPolicy: MediaPolicy = { authorize: async () => null };
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
  seal(prefix: string, bytes: Uint8Array, type: MediaType): Promise<string>;
  removeStaging(key: string): Promise<void>;
};
export type MediaJobs = { enqueue(attempt: MediaAttempt): Promise<void> };
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
  const photo = ["wearer-photo", "private-fitting"].includes(p.purpose);
  if (
    (photo && !p.contentType.startsWith("image/")) ||
    (p.purpose === "voice-note" && !p.contentType.startsWith("audio/")) ||
    (p.purpose === "order-document" && p.contentType !== "application/pdf") ||
    (p.purpose === "manual-pattern" &&
      !p.contentType.startsWith("image/") &&
      p.contentType !== "application/pdf")
  )
    fail(422, "VALIDATION_FAILED");
  const permitted = await authority(ctx, p, "upload");
  const { b, old } = await binding(ctx, "media.admit", p, headers.key);
  // Request-key responses contain no signed secrets. Replay may renew only an
  // unexpired existing staging grant; accepted/expired history is never reopened.
  let a: MediaAsset;
  if (old) {
    const response = mediaSuccessSchema.parse(old.response);
    await ctx.repository.lock(response.asset.id);
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
  await ctx.repository.lock(id);
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
export async function readMedia(ctx: MediaContext, id: string) {
  requireId(id);
  const a = await ctx.repository.read(id);
  if (a?.status !== "ready" || !a.acceptedKey) fail(404, "NOT_FOUND");
  await authority(ctx, a, "read");
  const now = await ctx.repository.now();
  const filename = mediaFilename(a);
  return {
    url: await ctx.storage.signGet(
      a.acceptedKey,
      a.contentType,
      filename,
      300,
      now,
    ),
    filename,
    expiresAt: new Date(now.getTime() + 300000).toISOString(),
  };
}
// #58 supplies a real validator. This capability is absent from normal runtime.
// A validator returns only bytes from the bounded snapshot; no URL/key input.
export class MediaValidationFailure extends Error {
  constructor() {
    super("MEDIA_CONTENT_REJECTED");
  }
}
export type MediaValidator = {
  validate(bytes: Uint8Array, asset: MediaAsset): Promise<Uint8Array>;
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
export async function processMedia(
  host: MediaProcessingHost,
  assetId: string,
  attemptId: string,
  validator: MediaValidator | null,
) {
  if (!validator) return "disabled" as const;
  requireId(assetId);
  requireId(attemptId);
  assetId = assetId.toLowerCase();
  attemptId = attemptId.toLowerCase();
  const claim = await host.transaction(async (ctx) => {
    await ctx.repository.lock(assetId);
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
    return { a, attempt, fence, storage: ctx.storage };
  });
  if (!claim) return "ignored" as const;
  // Fresh fence-derived accepted key prevents a stale/crashed claimant from
  // overwriting another claim. Never copy the mutable staging object after validation.
  const prefix = `shops/${claim.a.shopId}/private/${assetId}/${claim.fence}`;
  const snapshot = await claim.storage.snapshot(
    claim.a.stagingKey,
    claim.a.size,
  );
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await validator.validate(snapshot, { ...claim.a }));
    // Own the validated output: a validator retaining its input/output cannot
    // mutate the buffer between hashing and storage consumption.
    if (!bytes.length || bytes.length > 25 * 1024 * 1024)
      throw new MediaValidationFailure();
  } catch (error) {
    if (!(error instanceof MediaValidationFailure)) throw error;
    return host.transaction(async (ctx) => {
      await ctx.repository.lock(assetId);
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
      return "quarantined" as const;
    });
  }
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const key = await claim.storage.seal(prefix, bytes, claim.a.contentType);
  const suffix = key.startsWith(`${prefix}/`)
    ? key.slice(prefix.length + 1)
    : "";
  if (
    !idempotencyHeaderSchema.safeParse(suffix).success ||
    key !== `${prefix}/${suffix}`
  )
    fail(503, "MEDIA_UNAVAILABLE");
  return host.transaction(async (ctx) => {
    await ctx.repository.lock(assetId);
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
    await ctx.repository.accept(
      assetId,
      attemptId,
      claim.fence,
      key,
      hash,
      bytes.length,
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
    await ctx.instrumentation?.stored(actionId, assetId, bytes.length);
    return "accepted" as const;
  });
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
