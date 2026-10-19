import {
  type DraftCursor,
  type DraftError,
  type DraftRecord,
  type DraftResult,
  type DraftSuccess,
  draftCursorSchema,
  draftIdSchema,
  draftPromotionSchema,
  draftResultSchema,
  draftSaveSchema,
  draftSuccessSchema,
} from "@aarili/contracts/drafts";
import {
  type Actor,
  actorSchema,
  idempotencyHeaderSchema,
} from "@aarili/contracts/request";
import type { DraftRepository } from "@aarili/db/repositories/drafts";
import type { RequestBinding } from "@aarili/db/repositories/request";
import { canonicalJson, requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
export interface DraftSchema {
  safeParse(
    value: unknown,
  ): { success: true; data: Record<string, unknown> } | { success: false };
}
// Instances are composed from repositories on the SAME verified transaction.
// Revalidate locks/reads current authority and dependencies; saved flags are data,
// never approval. Promote enlists its business writes/audit/jobs in that transaction.
export interface DraftWorkflow {
  authorizeDraft?(payload: Record<string, unknown>): Promise<void>;
  authorizePublication?(command: Record<string, unknown>): Promise<void>;
  schemaVersion: number;
  draftSchema: DraftSchema;
  commandSchema: DraftSchema;
  revalidate(command: Record<string, unknown>, draftId: string): Promise<void>;
  // Must verify shop + produced entity + draft origin on this same transaction.
  // Each concrete domain result adds a composite shop/draft database reference.
  verifyResult(result: DraftResult, draftId: string): Promise<void>;
  promote(
    command: Record<string, unknown>,
    actionId: string,
    draftId: string,
    request: { key: string; requestId: string },
  ): Promise<DraftResult>;
}
export type DraftRegistry = ReadonlyMap<string, DraftWorkflow>;
export function productionDraftRegistry(): DraftRegistry {
  return new Map();
}
export interface DraftInstrumentation {
  recordDraftEvent(event: {
    actionId: string;
    draftId: string;
    event: "saved" | "promoted" | "abandoned";
    schemaVersion: number;
  }): Promise<void>;
}
export type DraftContext = {
  shopId: string;
  actor: Actor;
  repository: DraftRepository;
  workflows: DraftRegistry;
  instrumentation?: DraftInstrumentation;
};
export type DraftHeaders = {
  key?: string | undefined;
  ifMatch?: string | undefined;
  requestId: string;
};
export class DraftFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    public readonly body: DraftError,
  ) {
    super(body.error.code);
  }
}
function fail(
  status: DraftFailure["status"],
  code: DraftError["error"]["code"],
  current?: DraftRecord,
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Draft request rejected" },
    ...(current ? { current } : {}),
  });
}
function version(header: string | undefined) {
  const v = parseExpectedVersion(header);
  if (!v.ok) fail(v.status, v.code);
  return v.version;
}
function workflow(ctx: DraftContext, name: string, schemaVersion: number) {
  const found = ctx.workflows.get(name);
  if (!found || found.schemaVersion !== schemaVersion)
    fail(422, "VALIDATION_FAILED");
  return found;
}
export async function readDraft(ctx: DraftContext, id: string) {
  if (!draftIdSchema.safeParse(id).success) fail(422, "VALIDATION_FAILED");
  const draft = await ctx.repository.read(id.toLowerCase());
  if (!draft) fail(404, "NOT_FOUND");
  await ctx.workflows.get(draft.workflow)?.authorizeDraft?.(draft.payload);
  return draft;
}
export async function listDrafts(
  ctx: DraftContext,
  limit = 25,
  cursor?: DraftCursor,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 99)
    fail(422, "VALIDATION_FAILED");
  if (cursor && !draftCursorSchema.safeParse(cursor).success)
    fail(422, "VALIDATION_FAILED");
  const { rows, before } = await ctx.repository.list(limit + 1, cursor);
  const window = rows.slice(0, limit);
  const drafts: DraftRecord[] = [];
  for (const row of window) {
    try {
      await ctx.workflows.get(row.workflow)?.authorizeDraft?.(row.payload);
      drafts.push(row);
    } catch (e) {
      if (!(e instanceof DraftFailure) || e.status !== 404) throw e;
    }
  }
  const last = window.at(-1);
  return {
    drafts,
    next:
      rows.length > limit && last
        ? { createdAt: last.createdAt, id: last.id, before }
        : null,
  };
}
export async function mutateDraft(
  ctx: DraftContext,
  id: string,
  action: "save" | "promote" | "abandon",
  input: unknown,
  headers: DraftHeaders,
): Promise<DraftSuccess> {
  if (
    !draftIdSchema.safeParse(id).success ||
    !idempotencyHeaderSchema.safeParse(ctx.shopId).success ||
    !idempotencyHeaderSchema.safeParse(headers.requestId).success
  )
    fail(422, "VALIDATION_FAILED");
  id = id.toLowerCase();
  if (!headers.key) fail(422, "IDEMPOTENCY_REQUIRED");
  if (!idempotencyHeaderSchema.safeParse(headers.key).success)
    fail(422, "VALIDATION_FAILED");
  const key = headers.key.toLowerCase();
  const actor = actorSchema.parse(ctx.actor);
  if (actor.type !== "user") fail(422, "VALIDATION_FAILED");
  // Validate the structural precondition, but replay before current version/state.
  const expected =
    headers.ifMatch === undefined ? null : version(headers.ifMatch);
  const save = action === "save" ? draftSaveSchema.safeParse(input) : undefined;
  if (action !== "save" && !draftPromotionSchema.safeParse(input).success)
    fail(422, "VALIDATION_FAILED");
  if (action === "save" && !save?.success) fail(422, "VALIDATION_FAILED");
  // Only JSON is bindable; undefined/nonfinite/nonplain values must not coerce.
  try {
    if (canonicalJson(input).length > 65536) fail(422, "VALIDATION_FAILED");
  } catch {
    fail(422, "VALIDATION_FAILED");
  }
  const binding: RequestBinding = {
    actor,
    action: `draft.${action}`,
    hash: await requestHash({
      encoding: 1,
      shopId: ctx.shopId.toLowerCase(),
      actor,
      action,
      id,
      expected,
      input,
    }),
  };
  const repo = ctx.repository;
  await repo.lockKey(key);
  const prior = await repo.replay(key);
  if (prior) {
    if (
      prior.actor.type !== actor.type ||
      prior.actor.id !== actor.id ||
      prior.action !== binding.action ||
      prior.hash !== binding.hash
    )
      fail(422, "IDEMPOTENCY_MISMATCH");
    const replay = draftSuccessSchema.parse(prior.response);
    await ctx.workflows
      .get(replay.draft.workflow)
      ?.authorizeDraft?.(replay.draft.payload);
    if (action === "promote")
      await ctx.workflows
        .get(replay.draft.workflow)
        ?.authorizePublication?.(replay.draft.payload);
    return replay;
  }
  // Advisory lock covers absent rows as well as existing IDs: an initial PUT can
  // never replace a committed draft while racing a different idempotency key.
  await repo.lockDraft(id);
  const current = await repo.read(id);
  if (current)
    await ctx.workflows
      .get(current.workflow)
      ?.authorizeDraft?.(current.payload);
  if (current) {
    if (expected === null) fail(428, "PRECONDITION_REQUIRED");
    if (current.version !== expected) fail(412, "VERSION_STALE", current);
    if (current.lifecycle !== "active") fail(409, "REQUEST_CONFLICT");
  } else {
    if (action !== "save") fail(404, "NOT_FOUND");
    if (expected !== null) fail(412, "VERSION_STALE");
  }
  if (current && current.version === 2147483647) fail(409, "REQUEST_CONFLICT");
  const now = (await repo.now()).toISOString();
  const actionId = await repo.actionId();
  let draft: DraftRecord;
  if (action === "save") {
    if (!save?.success) fail(422, "VALIDATION_FAILED");
    const data = save.data;
    if (
      current &&
      (current.workflow !== data.workflow ||
        current.schemaVersion !== data.schemaVersion)
    )
      fail(409, "REQUEST_CONFLICT");
    const adapter = workflow(ctx, data.workflow, data.schemaVersion);
    const parsed = adapter.draftSchema.safeParse(data.payload);
    if (!parsed.success) fail(422, "VALIDATION_FAILED");
    await adapter.authorizeDraft?.(parsed.data);
    draft = {
      ...data,
      payload: parsed.data,
      id,
      creatorId: current?.creatorId ?? actor.id,
      lifecycle: "active",
      version: (current?.version ?? 0) + 1,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      stale: false,
      result: null,
    };
  } else {
    if (!current) fail(404, "NOT_FOUND");
    let result: DraftResult | null = null;
    if (action === "promote") {
      const adapter = workflow(ctx, current.workflow, current.schemaVersion);
      const complete = adapter.commandSchema.safeParse(current.payload);
      if (!complete.success) fail(422, "VALIDATION_FAILED");
      await adapter.authorizePublication?.(complete.data);
      await adapter.revalidate(complete.data, id);
      result = draftResultSchema.parse(
        await adapter.promote(complete.data, actionId, id, {
          key,
          requestId: headers.requestId,
        }),
      );
      await adapter.verifyResult(result, id);
    }
    draft = {
      ...current,
      lifecycle: action === "promote" ? "promoted" : "abandoned",
      version: current.version + 1,
      updatedAt: now,
      stale: false,
      result,
    };
  }
  if (current) {
    if (!(await repo.update(draft, current.version)))
      fail(412, "VERSION_STALE", await readDraft(ctx, id));
  } else await repo.insert(draft);
  // Return the exact persisted trusted clock values, including trigger precision.
  draft = await readDraft(ctx, id);
  await repo.audit({
    id: actionId,
    actor,
    action: binding.action,
    draftId: id,
    requestId: headers.requestId,
    key,
    version: draft.version,
    lifecycle: draft.lifecycle,
    schemaVersion: draft.schemaVersion,
  });
  if (ctx.instrumentation)
    await ctx.instrumentation.recordDraftEvent({
      actionId,
      draftId: id,
      event:
        action === "save"
          ? "saved"
          : action === "promote"
            ? "promoted"
            : "abandoned",
      schemaVersion: draft.schemaVersion,
    });
  const response = draftSuccessSchema.parse({ draft });
  await repo.persist(key, binding, response);
  return response;
}
// No production policy is approved. Selection is explicit and fails closed;
// a reviewed privileged retention host must own deletion, notice and audit.
export type DraftRetentionPolicy = {
  enabled: boolean;
  noticeDays: number | null;
  noticeApproved: boolean;
  deletionApproved: boolean;
};
export const productionDraftRetention: DraftRetentionPolicy = {
  enabled: false,
  noticeDays: null,
  noticeApproved: false,
  deletionApproved: false,
};
export function draftDeletionEligible(
  draft: DraftRecord,
  now: Date,
  noticeAt: Date | null,
  policy: DraftRetentionPolicy,
) {
  if (
    !policy.enabled ||
    !policy.noticeApproved ||
    !policy.deletionApproved ||
    policy.noticeDays === null ||
    !Number.isInteger(policy.noticeDays) ||
    policy.noticeDays < 1 ||
    !noticeAt ||
    draft.lifecycle === "promoted"
  )
    return false;
  const staleAt = new Date(draft.updatedAt).getTime() + 30 * 86400000;
  return (
    noticeAt.getTime() >= staleAt &&
    now.getTime() >= noticeAt.getTime() + policy.noticeDays * 86400000
  );
}
