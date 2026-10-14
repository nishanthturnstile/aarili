import { syntheticJobSchema } from "@aarili/contracts/jobs";
import type { CommandRepository } from "@aarili/db/repositories/command";
import type {
  JobRequest,
  SyntheticJobRepository,
} from "@aarili/db/repositories/jobs";

export async function protectJobEpoch(
  repository: SyntheticJobRepository,
  request: JobRequest,
  payloadEpoch: string | undefined,
): Promise<"current" | "quarantined" | "ignored"> {
  if (payloadEpoch && payloadEpoch !== request.epoch) return "ignored";
  const state = await repository.restoreState();
  if (!state) throw new Error("CONTROL_UNKNOWN");
  if (await repository.quarantined(request.requestId)) return "quarantined";
  if (!payloadEpoch || request.epoch !== state.epoch) {
    await repository.quarantine(
      request,
      state.epoch,
      payloadEpoch ? "old_epoch" : "missing_epoch",
    );
    return "quarantined";
  }
  return "current";
}

// Caller rechecks verified identity/owner membership and binds withShop first.
// Payload is merely a locator. No queue/vendor/driver reaches core.
export async function inspectSyntheticJob(
  ctx: {
    shopId: string;
    userId: string;
    jobs: SyntheticJobRepository;
  },
  input: unknown,
): Promise<JobRequest | "ignored" | "quarantined"> {
  const parsed = syntheticJobSchema.safeParse(input);
  if (!parsed.success) return "ignored";
  const payload = parsed.data;
  if (payload.shopId !== ctx.shopId || payload.initiatorId !== ctx.userId)
    return "ignored";
  if (!(await ctx.jobs.restoreState())) throw new Error("CONTROL_UNKNOWN");
  await ctx.jobs.lock(payload.requestId);
  const request = await ctx.jobs.request(payload.requestId);
  if (
    !request ||
    request.shopId !== payload.shopId ||
    request.initiatorId !== payload.initiatorId ||
    request.entityId !== payload.entityId ||
    request.version !== payload.version
  )
    return "ignored";
  const epochOutcome = await protectJobEpoch(ctx.jobs, request, payload.epoch);
  if (epochOutcome !== "current") return epochOutcome;
  return request;
}

export async function consumeSyntheticJob(
  ctx: {
    shopId: string;
    userId: string;
    jobs: SyntheticJobRepository;
    records: CommandRepository;
  },
  input: unknown,
): Promise<"applied" | "duplicate" | "ignored" | "quarantined"> {
  const request = await inspectSyntheticJob(ctx, input);
  if (typeof request === "string") return request;
  const record = await ctx.records.read(request.entityId, true);
  if (
    !record ||
    record.version !== request.version ||
    record.eventId !== request.requestId
  )
    return "ignored";
  if (await ctx.jobs.effected(request.requestId)) return "duplicate";
  const { eventId } = await ctx.records.ids();
  await ctx.jobs.effect(request, eventId);
  await ctx.records.audit({
    id: eventId,
    actor: { type: "user", id: ctx.userId },
    action: "synthetic.job.consume",
    entityId: request.entityId,
    requestId: request.commandRequestId,
    key: request.key,
    reason: null,
    sourceEventId: request.requestId,
    changes: {
      version: record.version,
      finalized: record.finalized,
      valueChanged: false,
    },
  });
  return "applied";
}
