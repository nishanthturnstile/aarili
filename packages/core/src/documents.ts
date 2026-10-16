import {
  type DocumentIssue,
  type DocumentStatus,
  documentIssueSchema,
  documentLocatorSchema,
  documentShareCommandSchema,
  documentStatusSchema,
} from "@aarili/contracts/documents";
import type { Actor } from "@aarili/contracts/request";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import type {
  DocumentAttempt,
  DocumentOutput,
  DocumentRepository,
  DocumentRevision,
} from "@aarili/db/repositories/documents";
import { canonicalJson, requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export type DocumentTemplates = {
  resolve(
    id: string,
    revision: number,
  ): Promise<
    | {
        fontRevision: string;
        templateHash: string;
        validate(model: unknown): boolean;
      }
    | undefined
  >;
};
export type DocumentStorage = {
  read(key: string): Promise<Uint8Array>;
  put(key: string, bytes: Uint8Array, sha256: string): Promise<void>;
  signGet(key: string, filename: string): Promise<string>;
};
export type DocumentJobs = {
  enqueue(attempt: DocumentAttempt): Promise<void>;
  phase(
    attempt: DocumentAttempt,
  ): Promise<"pending" | "rendering" | "failed" | "unavailable">;
};
export type DocumentContext = {
  shopId: string;
  actor: Actor;
  repository: DocumentRepository;
  templates: DocumentTemplates;
  policy: {
    authorize(
      document: DocumentIssue,
      action: "issue" | "read" | "process" | "retry" | "cleanup",
    ): Promise<boolean>;
  };
  storage: DocumentStorage;
  jobs: DocumentJobs;
  instrumentation?: {
    accepted(
      pdfActionId: string,
      bytesActionId: string,
      docId: string,
      bytes: number,
    ): Promise<void>;
  };
};
export type DocumentHost = {
  transaction<T>(run: (ctx: DocumentContext) => Promise<T>): Promise<T>;
};
export class DocumentFailure extends Error {
  constructor(
    public readonly status: 403 | 404 | 409 | 412 | 422 | 428 | 503,
    public readonly code: string,
  ) {
    super(code);
  }
}
function fail(status: DocumentFailure["status"], code: string): never {
  throw new DocumentFailure(status, code);
}
function identity(id: string) {
  if (!idempotencyHeaderSchema.safeParse(id).success)
    fail(422, "VALIDATION_FAILED");
}
function locator(docId: string, revision: number) {
  identity(docId);
  if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647)
    fail(422, "VALIDATION_FAILED");
}
async function authorized(
  ctx: DocumentContext,
  d: DocumentIssue,
  action: Parameters<DocumentContext["policy"]["authorize"]>[1],
) {
  if (ctx.actor.type !== "user" || !(await ctx.policy.authorize(d, action)))
    fail(action === "read" ? 404 : 403, "DOCUMENT_ACCESS_DENIED");
}
async function binding(
  ctx: DocumentContext,
  key: string,
  action: string,
  input: unknown,
) {
  identity(key);
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
  const issued = await ctx.repository.issuedByKey(key);
  const shared = await ctx.repository.shareByKey(key);
  if (
    shared &&
    (shared.requestHash !== b.hash || shared.actorId !== ctx.actor.id)
  )
    fail(422, "IDEMPOTENCY_MISMATCH");
  if (
    issued &&
    (action !== "document.issue" ||
      issued.requestHash !== b.hash ||
      issued.creatorId !== ctx.actor.id)
  )
    fail(422, "IDEMPOTENCY_MISMATCH");
  if (
    old &&
    (old.hash !== b.hash ||
      old.action !== action ||
      old.actor.id !== ctx.actor.id ||
      old.actor.type !== ctx.actor.type)
  )
    fail(422, "IDEMPOTENCY_MISMATCH");
  return { b, old };
}
async function audit(
  ctx: DocumentContext,
  id: string,
  action: string,
  docId: string,
  requestId = id,
  key = id,
) {
  await ctx.repository.audit({
    id,
    actor: ctx.actor,
    action,
    docId,
    requestId,
    key,
  });
}
async function status(
  ctx: DocumentContext,
  d: DocumentRevision,
  a: DocumentAttempt,
): Promise<DocumentStatus> {
  const artifact = await ctx.repository.artifact(d.docId, d.revision);
  const control = await ctx.repository.control();
  const phase = artifact ? "ready" : await ctx.jobs.phase(a);
  const blocked = !control?.outbound || control.epoch !== a.epoch;
  const active =
    a.state === "rendering" &&
    Date.parse(a.leaseUntil ?? "") > (await ctx.repository.now()).getTime();
  const canRetry =
    !artifact &&
    control?.outbound === true &&
    a.initiatorId === ctx.actor.id &&
    !active &&
    ["failed", "unavailable"].includes(phase) &&
    (await ctx.policy.authorize(d, "retry"));
  return documentStatusSchema.parse({
    docId: d.docId,
    revision: d.revision,
    language: d.language,
    paper: d.paper,
    version: a.version,
    canRetry,
    state: artifact
      ? "ready"
      : blocked || phase === "failed" || phase === "unavailable"
        ? "failed"
        : phase === "pending" && !active && a.state !== "failed"
          ? "pending"
          : a.state,
    failure: artifact
      ? null
      : blocked
        ? "RESTORE_BLOCKED"
        : phase === "unavailable"
          ? "PROCESSING_UNAVAILABLE"
          : phase === "failed"
            ? "RETRIES_EXHAUSTED"
            : a.state === "failed"
              ? "RENDER_RETRYABLE"
              : null,
    sha256: artifact?.sha256 ?? null,
  });
}
export async function issueDocument(
  ctx: DocumentContext,
  input: unknown,
  key: string,
) {
  const parsed = documentIssueSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const d = { ...parsed.data, docId: parsed.data.docId.toLowerCase() };
  key = key.toLowerCase();
  await authorized(ctx, d, "issue");
  // Freeze and bound before a trusted registry sees the model. No arbitrary
  // template/HTML/URL is accepted by the issuing command or renderer.
  let encoded: string;
  try {
    encoded = canonicalJson(d.model);
  } catch {
    fail(422, "VALIDATION_FAILED");
  }
  if (new TextEncoder().encode(encoded).length > 100000)
    fail(422, "VALIDATION_FAILED");
  d.model = JSON.parse(encoded);
  const { b, old } = await binding(ctx, key, "document.issue", d);
  await ctx.repository.lock(d.docId, d.revision);
  const prior = await ctx.repository.read(d.docId, d.revision);
  if (old) return documentStatusSchema.parse(old.response);
  if (prior) {
    // Durable revision binding survives expiration of generic replay keys.
    if (
      prior.requestKey !== key ||
      prior.requestHash !== b.hash ||
      prior.creatorId !== ctx.actor.id
    )
      fail(409, "DOCUMENT_REVISION_EXISTS");
    const a = await ctx.repository.attempt(d.docId, d.revision);
    if (!a) fail(503, "DOCUMENT_UNAVAILABLE");
    return status(ctx, prior, a);
  }
  const template = await ctx.templates.resolve(d.template, d.templateRevision);
  if (
    !template?.validate(d.model) ||
    !/^[0-9a-f]{64}$/.test(template.fontRevision) ||
    !/^[0-9a-f]{64}$/.test(template.templateHash)
  )
    fail(422, "DOCUMENT_TEMPLATE_UNAVAILABLE");
  const control = await ctx.repository.control();
  if (!control?.outbound) fail(503, "DOCUMENT_PROCESSING_DISABLED");
  const actionId = await ctx.repository.id();
  const revision: DocumentRevision = {
    ...d,
    creatorId: ctx.actor.id,
    fontRevision: template.fontRevision,
    templateHash: template.templateHash,
    modelHash: await requestHash(d.model),
    requestKey: key,
    requestHash: b.hash,
    issueActionId: actionId,
  };
  const a: DocumentAttempt = {
    docId: d.docId,
    revision: d.revision,
    jobId: await ctx.repository.id(),
    initiatorId: ctx.actor.id,
    epoch: control.epoch,
    state: "pending",
    version: 1,
    fence: null,
    leaseUntil: null,
  };
  await ctx.repository.issue(revision, a);
  await ctx.jobs.enqueue(a);
  await audit(ctx, actionId, "document.issue", d.docId, key, key);
  const result = await status(ctx, revision, a);
  await ctx.repository.persist(key, b, result);
  return result;
}
async function find(
  ctx: DocumentContext,
  id: string,
  revision: number,
  action: "read" | "retry" | "cleanup",
) {
  locator(id, revision);
  await ctx.repository.lock(id, revision);
  const d = await ctx.repository.read(id, revision),
    a = await ctx.repository.attempt(id, revision);
  if (!d || !a) fail(404, "NOT_FOUND");
  await authorized(ctx, d, action);
  return { d, a };
}
export async function documentStatus(
  ctx: DocumentContext,
  id: string,
  revision: number,
) {
  const { d, a } = await find(ctx, id, revision, "read");
  return status(ctx, d, a);
}
export async function documentAccess(
  ctx: DocumentContext,
  id: string,
  revision: number,
) {
  const { d } = await find(ctx, id, revision, "read");
  const artifact = await ctx.repository.artifact(id, revision);
  if (!artifact) fail(404, "DOCUMENT_NOT_READY");
  return {
    url: await ctx.storage.signGet(
      artifact.key,
      `document-${d.docId}-${revision}.pdf`,
    ),
    sha256: artifact.sha256,
  };
}
// Same-origin bounded bytes avoid exposing storage capabilities to browser URLs,
// cross-origin CORS, preview referrers or an external text-share target.
export async function documentFile(
  ctx: DocumentContext,
  id: string,
  revision: number,
) {
  await find(ctx, id, revision, "read");
  const artifact = await ctx.repository.artifact(id, revision);
  if (!artifact) fail(404, "DOCUMENT_NOT_READY");
  let bytes: Uint8Array;
  try {
    bytes = await ctx.storage.read(artifact.key);
  } catch {
    fail(503, "DOCUMENT_STORAGE_UNAVAILABLE");
  }
  if (
    bytes.length !== artifact.bytes ||
    bytes.length > 25 * 1024 * 1024 ||
    new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
  )
    fail(503, "DOCUMENT_BYTES_REJECTED");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== artifact.sha256) fail(503, "DOCUMENT_BYTES_REJECTED");
  // Storage I/O holds the authorising tenant transaction; policy may still change
  // within an adapter, so check it once more before releasing private bytes.
  await find(ctx, id, revision, "read");
  return { bytes, sha256: hash };
}
export async function documentShareHistory(
  ctx: DocumentContext,
  id: string,
  revision: number,
) {
  await find(ctx, id, revision, "read");
  return ctx.repository.shares(id, revision);
}
export async function recordDocumentShare(
  ctx: DocumentContext,
  id: string,
  revision: number,
  input: unknown,
  key: string,
) {
  locator(id, revision);
  id = id.toLowerCase();
  key = key.toLowerCase();
  const parsed = documentShareCommandSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const command = parsed.data;
  const { b } = await binding(ctx, key, `document.${command.kind}`, {
    docId: id,
    revision,
    ...command,
  });
  await find(ctx, id, revision, "read");
  const old = await ctx.repository.shareByKey(key);
  if (old) {
    const { requestHash: _, ...event } = old;
    return event;
  }
  const artifact = await ctx.repository.artifact(id, revision);
  if (!artifact) fail(409, "DOCUMENT_NOT_READY");
  if (command.kind === "marked-sent") {
    const prepared = await ctx.repository.share(
      command.preparedId,
      id,
      revision,
    );
    if (
      prepared?.kind !== "prepared" ||
      prepared.actorId !== ctx.actor.id ||
      prepared.sha256 !== artifact.sha256
    )
      fail(409, "DOCUMENT_PREPARATION_REQUIRED");
  }
  const event = {
    id: await ctx.repository.id(),
    kind: command.kind,
    actorId: ctx.actor.id,
    createdAt: (await ctx.repository.now()).toISOString(),
    preparedId: command.kind === "marked-sent" ? command.preparedId : null,
    sha256: artifact.sha256,
  };
  await ctx.repository.appendShare(id, revision, event, key, b.hash);
  await audit(ctx, event.id, `document.${command.kind}`, id, key, key);
  await ctx.repository.persist(key, b, event);
  return event;
}
export async function retryDocument(
  ctx: DocumentContext,
  id: string,
  revision: number,
  key: string,
  ifMatch: string | null,
) {
  locator(id, revision);
  id = id.toLowerCase();
  key = key.toLowerCase();
  const { b, old } = await binding(ctx, key, "document.retry", {
    docId: id,
    revision,
    ifMatch,
  });
  const { d, a } = await find(ctx, id, revision, "retry");
  if (old) return documentStatusSchema.parse(old.response);
  const version = parseExpectedVersion(ifMatch ?? undefined);
  if (!version.ok) fail(version.status, version.code);
  if (version.version !== a.version) fail(412, "STALE_VERSION");
  const control = await ctx.repository.control(),
    now = await ctx.repository.now();
  if (!control?.outbound) fail(503, "DOCUMENT_PROCESSING_DISABLED");
  if (
    a.initiatorId !== ctx.actor.id ||
    a.state === "ready" ||
    (a.state === "rendering" &&
      Date.parse(a.leaseUntil ?? "") > now.getTime()) ||
    !["failed", "unavailable"].includes(await ctx.jobs.phase(a))
  )
    fail(409, "DOCUMENT_RETRY_NOT_AVAILABLE");
  const jobId = await ctx.repository.id();
  await ctx.repository.retry(a, jobId, control.epoch);
  const next = {
    ...a,
    jobId,
    epoch: control.epoch,
    state: "pending" as const,
    version: a.version + 1,
    fence: null,
    leaseUntil: null,
  };
  await ctx.jobs.enqueue(next);
  await audit(ctx, await ctx.repository.id(), "document.retry", id, key, key);
  const result = await status(ctx, d, next);
  await ctx.repository.persist(key, b, result);
  return result;
}
export type DocumentRenderer = {
  render(revision: DocumentRevision): Promise<Uint8Array>;
};
export async function processDocument(
  host: DocumentHost,
  input: unknown,
  renderer: DocumentRenderer,
  beforeCommit: () => Promise<void> = async () => {},
) {
  const parsed = documentLocatorSchema.safeParse(input);
  if (!parsed.success) return "ignored";
  const p = parsed.data;
  const inspect = async (ctx: DocumentContext) => {
    await ctx.repository.lock(p.docId, p.revision);
    const d = await ctx.repository.read(p.docId, p.revision),
      a = await ctx.repository.attempt(p.docId, p.revision),
      c = await ctx.repository.control();
    if (
      !d ||
      !a ||
      ctx.shopId.toLowerCase() !== p.shopId ||
      d.creatorId !== a.initiatorId ||
      ctx.actor.type !== "user" ||
      ctx.actor.id !== p.initiatorId ||
      a.initiatorId !== p.initiatorId ||
      a.jobId !== p.jobId
    )
      return;
    if (!c?.outbound || c.epoch !== p.epoch || a.epoch !== p.epoch) return;
    await authorized(ctx, d, "process");
    return { d, a, now: await ctx.repository.now() };
  };
  const claim = await host.transaction(async (ctx) => {
    const found = await inspect(ctx);
    if (!found) return;
    if (await ctx.repository.artifact(p.docId, p.revision))
      return { ready: true as const };
    if (
      found.a.state === "rendering" &&
      Date.parse(found.a.leaseUntil ?? "") > found.now.getTime()
    )
      throw Error("DOCUMENT_BUSY");
    const fence = await ctx.repository.id();
    await ctx.repository.claim(
      found.a,
      fence,
      new Date(found.now.getTime() + 300000).toISOString(),
    );
    await audit(ctx, fence, "document.claim", p.docId);
    return { ...found, fence, storage: ctx.storage, ready: false as const };
  });
  if (!claim) return "quarantined";
  if (claim.ready) return "accepted";
  const owned = async (ctx: DocumentContext) => {
    const found = await inspect(ctx);
    return found &&
      found.a.state === "rendering" &&
      found.a.fence === claim.fence &&
      Date.parse(found.a.leaseUntil ?? "") > found.now.getTime()
      ? found
      : undefined;
  };
  try {
    if ((await requestHash(claim.d.model)) !== claim.d.modelHash)
      throw Error("DOCUMENT_MODEL_HASH_MISMATCH");
    const bytes = new Uint8Array(
      await renderer.render(structuredClone(claim.d)),
    );
    if (
      bytes.length < 8 ||
      bytes.length > 25 * 1024 * 1024 ||
      String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-"
    )
      throw Error("DOCUMENT_RENDER_REJECTED");
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (x) => x.toString(16).padStart(2, "0"),
    ).join("");
    const planned = await host.transaction(async (ctx) => {
      if (!(await owned(ctx))) return;
      const o: DocumentOutput = {
        id: await ctx.repository.id(),
        docId: p.docId,
        revision: p.revision,
        fence: claim.fence,
        key: `shops/${ctx.shopId.toLowerCase()}/docs/${p.docId}/${p.revision}-${sha256}.pdf`,
        sha256,
        bytes: bytes.length,
        createdAt: (await ctx.repository.now()).toISOString(),
      };
      await beforeCommit();
      await ctx.repository.plan(o);
      await audit(
        ctx,
        await ctx.repository.id(),
        "document.output-planned",
        p.docId,
        o.id,
      );
      await beforeCommit();
      return o;
    });
    if (!planned) return "quarantined";
    await claim.storage.put(planned.key, bytes, sha256);
    return await host.transaction(async (ctx) => {
      const found = await owned(ctx);
      if (!found) return "quarantined";
      await beforeCommit();
      await ctx.repository.accept(found.a, planned);
      await audit(ctx, planned.id, "document.accept", p.docId);
      const bytesActionId = await ctx.repository.id();
      await audit(ctx, bytesActionId, "document.bytes-accepted", p.docId);
      await ctx.instrumentation?.accepted(
        planned.id,
        bytesActionId,
        p.docId,
        bytes.length,
      );
      await beforeCommit();
      return "accepted";
    });
  } catch (error) {
    try {
      await host.transaction(async (ctx) => {
        if (!(await owned(ctx))) return;
        await ctx.repository.failed(claim.a, claim.fence);
        await audit(
          ctx,
          await ctx.repository.id(),
          "document.render-failed",
          p.docId,
        );
      });
    } catch {
      /* Preserve original failure; durable lease fences a successor. */
    }
    throw error;
  }
}

export type DocumentOrphanStorage = {
  has(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
};
export async function reconcileDocumentOutputs(
  host: DocumentHost,
  id: string,
  revision: number,
  storage: DocumentOrphanStorage,
  graceSeconds: number,
  after?: string,
) {
  locator(id, revision);
  if (after) identity(after);
  if (!Number.isInteger(graceSeconds) || graceSeconds < 300)
    fail(422, "VALIDATION_FAILED");
  const candidates = await host.transaction(async (ctx) => {
    await find(ctx, id, revision, "cleanup");
    return ctx.repository.outputs(id, revision, after);
  });
  const eligible = async (ctx: DocumentContext, o: DocumentOutput) => {
    const { a } = await find(ctx, id, revision, "cleanup");
    const c = await ctx.repository.control(),
      now = await ctx.repository.now();
    const accepted = await ctx.repository.artifact(id, revision);
    if (
      !c?.outbound ||
      Date.parse(o.createdAt) > now.getTime() - graceSeconds * 1000 ||
      accepted?.key === o.key ||
      (a.state === "rendering" &&
        Date.parse(a.leaseUntil ?? "") > now.getTime())
    )
      return;
    return c;
  };
  for (const o of candidates.slice(0, 20)) {
    if (!(await storage.has(o.key))) continue;
    await host.transaction(async (ctx) => {
      const c = await eligible(ctx, o);
      if (!c) return;
      const intentId = await ctx.repository.id();
      if (await ctx.repository.cleanupIntent(o.id, intentId, c.epoch))
        await audit(ctx, intentId, "document.orphan-intent", id);
    });
  }
  const pending = await host.transaction(async (ctx) => {
    await find(ctx, id, revision, "cleanup");
    const c = await ctx.repository.control();
    return c?.outbound ? ctx.repository.cleanups(id, revision, c.epoch) : [];
  });
  let removed = 0;
  for (const intent of pending)
    await host.transaction(async (ctx) => {
      const o = await ctx.repository.output(intent.outputId);
      if (!o || o.docId !== id || o.revision !== revision) return;
      const c = await eligible(ctx, o);
      if (
        !c ||
        c.epoch !== intent.epoch ||
        !(await ctx.repository.cleanups(id, revision, c.epoch)).some(
          (x) => x.id === intent.id,
        )
      )
        return;
      // An earlier committed intent makes delete/DB-ack crashes idempotently retryable.
      await storage.remove(o.key);
      const actionId = await ctx.repository.id();
      await ctx.repository.cleaned(intent.id, actionId);
      await audit(ctx, actionId, "document.orphan-cleaned", id, intent.id);
      removed++;
    });
  return {
    removed,
    next: candidates.length > 20 ? (candidates[19]?.id ?? null) : null,
  };
}
