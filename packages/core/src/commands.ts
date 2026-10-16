import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export { canonicalJson, requestHash } from "./request-binding.js";

import {
  type Actor,
  actorSchema,
  type CommandError,
  idempotencyHeaderSchema,
  type SyntheticRecord,
  syntheticCommandSchema,
  syntheticSuccessSchema,
} from "@aarili/contracts/command";
import type {
  CommandRepository,
  RequestBinding,
} from "@aarili/db/repositories/command";
import type { SyntheticJobWriter } from "@aarili/db/repositories/jobs";
import type { RestoreRepository } from "@aarili/db/repositories/restore";
import { requireUnfrozenMoney } from "./restore.js";

export type CommandContext = {
  shopId: string;
  actor: Actor;
  repository: CommandRepository;
  jobs?: SyntheticJobWriter;
  // Private synthetic composition only; never accepted from a route payload.
  financial?: {
    action: "confirmation" | "allocation" | "reversal" | "refund";
    controls: RestoreRepository;
  };
};
export class CommandFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    public readonly body: CommandError,
  ) {
    super(body.error.code);
  }
}
function fail(
  status: CommandFailure["status"],
  code: CommandError["error"]["code"],
  current?: SyntheticRecord,
): never {
  throw new CommandFailure(status, {
    error: { code, message: "Command rejected" },
    ...(current ? { current } : {}),
  });
}

export { versionTag } from "./request-version.js";
export function expectedVersion(header: string | undefined) {
  const parsed = parseExpectedVersion(header);
  if (!parsed.ok) fail(parsed.status, parsed.code);
  return parsed.version;
}
export function idempotencyCutoff(now: Date) {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

export async function readSynthetic(ctx: CommandContext, id: string) {
  const record = await ctx.repository.read(id);
  if (!record) fail(404, "NOT_FOUND");
  return record;
}
export async function executeSynthetic(
  ctx: CommandContext,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
  target: string | null,
) {
  const parsed = syntheticCommandSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  if (!headers.key) fail(422, "IDEMPOTENCY_REQUIRED");
  if (!idempotencyHeaderSchema.safeParse(headers.key).success)
    fail(422, "VALIDATION_FAILED");
  if (
    !idempotencyHeaderSchema.safeParse(ctx.shopId).success ||
    !idempotencyHeaderSchema.safeParse(headers.requestId).success ||
    (target !== null && !idempotencyHeaderSchema.safeParse(target).success)
  )
    fail(422, "VALIDATION_FAILED");
  const key = headers.key.toLowerCase();
  target = target?.toLowerCase() ?? null;
  // Only server-resolved users are enabled. Other actor shapes reserve the
  // contract, not support/import/system entry points or authority.
  const actor = actorSchema.parse(ctx.actor);
  if (actor.type !== "user") fail(422, "VALIDATION_FAILED");
  const command = parsed.data;
  if (ctx.jobs) await ctx.jobs.prepare();
  if (ctx.financial) {
    if (
      !["confirmation", "allocation", "reversal", "refund"].includes(
        ctx.financial.action,
      )
    )
      fail(422, "VALIDATION_FAILED");
    await requireUnfrozenMoney(ctx.financial.controls);
  }
  const version =
    command.action === "create" ? null : expectedVersion(headers.ifMatch);
  if ((command.action === "create") !== (target === null))
    fail(422, "VALIDATION_FAILED");
  const binding: RequestBinding = {
    actor,
    action: ctx.financial
      ? `synthetic.financial.${ctx.financial.action}.${command.action}`
      : `synthetic.${command.action}`,
    hash: await requestHash({
      encoding: 1,
      shopId: ctx.shopId.toLowerCase(),
      actor,
      action: command.action,
      target,
      version,
      command,
      // Synthetic queue participation is part of the request contract. A key
      // originally committed without the writer cannot falsely replay as a
      // queued command when dev/test composition later enables it.
      ...(ctx.jobs ? { job: "synthetic.job.v1" } : {}),
      ...(ctx.financial ? { financial: ctx.financial.action } : {}),
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
    return syntheticSuccessSchema.parse(prior.response);
  }
  // Replay precedes current-state/version checks. The original precondition is
  // part of the binding, even when it became stale after the committed effect.
  const current = target ? await readLocked(repo, target) : undefined;
  if (current && current.version !== version)
    fail(412, "VERSION_STALE", current);
  if (current && command.action !== "correct" && current.finalized)
    fail(409, "RECORD_FINALIZED");
  if (
    command.action === "correct" &&
    (!current?.finalized || (await repo.correctionExists(current.id)))
  )
    fail(409, "REQUEST_CONFLICT");
  const ids = await repo.ids();
  const append = command.action === "create" || command.action === "correct";
  let record: SyntheticRecord;
  if (command.action === "create") {
    record = {
      id: ids.id,
      eventId: ids.eventId,
      version: 1,
      value: command.value,
      finalized: false,
      correctionOf: null,
    };
  } else {
    if (!current) fail(404, "NOT_FOUND");
    record = {
      id: append ? ids.id : current.id,
      eventId: ids.eventId,
      version: append ? 1 : current.version + 1,
      value: command.action === "finalize" ? current.value : command.value,
      finalized: command.action === "finalize" || command.action === "correct",
      correctionOf: command.action === "correct" ? current.id : null,
    };
  }
  if (record.version > 2147483647) fail(409, "REQUEST_CONFLICT");
  if (append) await repo.insert(record);
  else {
    if (version === null) fail(422, "VALIDATION_FAILED");
    if (!(await repo.update(record, version)))
      fail(412, "VERSION_STALE", await readSynthetic(ctx, record.id));
  }
  await repo.audit({
    id: ids.eventId,
    actor,
    action: binding.action,
    entityId: record.id,
    requestId: headers.requestId,
    key,
    reason: command.action === "correct" ? command.reason : null,
    sourceEventId:
      command.action === "correct"
        ? (current?.eventId ?? fail(404, "NOT_FOUND"))
        : null,
    // No personal values, password/token payloads or caller-supplied provenance.
    changes: {
      version: record.version,
      finalized: record.finalized,
      valueChanged: current?.value !== record.value,
    },
  });
  const response = syntheticSuccessSchema.parse({ record });
  await repo.persist(key, binding, response);
  if (ctx.jobs) await ctx.jobs.enqueue(record, headers.requestId, key);
  return response;
}
async function readLocked(repo: CommandRepository, id: string) {
  const record = await repo.read(id, true);
  if (!record) fail(404, "NOT_FOUND");
  return record;
}
