import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  type ServiceLineProgress,
  serviceLineCommandSchema,
  serviceLineProgressSchema,
  serviceLineResultSchema,
} from "@aarili/contracts/small-services";
import { DraftFailure } from "./drafts.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
import {
  readServiceOrder,
  type SmallServiceContext,
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
      message: "Review the exact service line and current scope",
    },
  });
}
// Match the booking -> sorted orders -> identities lock order used by scope edits.
// Read authorization is deliberately repeated before returning a cached command.
async function authority(ctx: SmallServiceContext, id: string) {
  if (!idempotencyHeaderSchema.safeParse(id).success) fail(422);
  if (
    !ctx.orders.templates.synthetic ||
    !ctx.orders.customers.policy.enabled ||
    !ctx.orders.customers.policy.synthetic
  )
    fail();
  const repo = ctx.orders.acceptance?.repository;
  if (!repo) fail();
  const raw = await ctx.repository.readOrder(id),
    ids = [id];
  if (raw?.intake.sourceOrderId && raw.intake.sourceOrderId !== id)
    ids.push(raw.intake.sourceOrderId);
  ids.sort();
  const memberships = await Promise.all(
    ids.map(async (id) => ({ id, member: await repo.bookings.membership(id) })),
  );
  for (const member of [
    ...new Set(memberships.flatMap((v) => (v.member ? [v.member] : []))),
  ].sort())
    await repo.bookings.lock(member);
  for (const oid of ids) await repo.lockOrder(oid);
  for (const v of memberships)
    if ((await repo.bookings.membership(v.id)) !== v.member) fail();
  const order = raw
    ? await readServiceOrder(ctx, id)
    : await readAcceptedOrder(ctx.orders, id);
  if (!raw) await readOrderPieces(ctx.orders, id);
  const bookingId = memberships.find((v) => v.id === id)?.member ?? null;
  const booking = bookingId ? await repo.bookings.read(bookingId) : undefined;
  const scope = [];
  for (const v of memberships) {
    const b = v.member ? await repo.bookings.read(v.member) : undefined;
    const source = await ctx.repository.source(v.id, null);
    scope.push({
      id: v.id,
      member: v.member ?? null,
      bookingVersion: b?.version ?? null,
      version: source?.version,
      digest: source?.digest,
    });
  }
  return {
    order,
    bookingId,
    bookingVersion: booking?.version ?? null,
    scopeDigest: await requestHash({ orderVersion: order.version, scope }),
  };
}
async function projection(
  ctx: SmallServiceContext,
  a: Awaited<ReturnType<typeof authority>>,
): Promise<ServiceLineProgress> {
  const repo = ctx.repository.progress,
    sources = await repo.sources(a.order.id),
    current = await repo.current(a.order.id),
    history = await repo.history(a.order.id);
  const lines = sources.map((s) => {
    const c = current.find((c) => c.lineId === s.line.id);
    const blocked =
      s.line.state === "not-required"
        ? ("not-required" as const)
        : s.line.taskKey !== null
          ? ("task-linked" as const)
          : !s.reviewed || s.line.quantity === null
            ? ("unreviewed" as const)
            : null;
    return {
      line: s.line,
      sourceId: s.sourceId,
      sourceDigest: s.sourceDigest,
      pieceId: s.pieceId,
      state: c?.state ?? s.line.state,
      version: c?.version ?? 1,
      eligible: blocked === null,
      blocked,
      history: history.filter((h) => h.lineId === s.line.id),
    };
  });
  return serviceLineProgressSchema.parse({
    schemaVersion: 1,
    orderId: a.order.id,
    orderVersion: a.order.version,
    scopeDigest: a.scopeDigest,
    lines,
    summary: {
      pending: lines.filter((l) => l.state === "pending").length,
      completed: lines.filter((l) => l.state === "completed").length,
      notRequired: lines.filter((l) => l.state === "not-required").length,
    },
  });
}
export async function readServiceLineProgress(
  ctx: SmallServiceContext,
  id: string,
) {
  return projection(ctx, await authority(ctx, id));
}
export async function commandServiceLine(
  ctx: SmallServiceContext,
  orderId: string,
  lineId: string,
  input: unknown,
  headers: {
    key: string | undefined;
    ifMatch: string | undefined;
    requestId: string;
  },
) {
  const parsed = serviceLineCommandSchema.safeParse(input);
  if (!parsed.success) fail(422);
  const expected = parseExpectedVersion(headers.ifMatch);
  if (!expected.ok) fail(expected.status);
  if (
    !idempotencyHeaderSchema.safeParse(headers.key).success ||
    !idempotencyHeaderSchema.safeParse(lineId).success
  )
    fail(422);
  const key = headers.key as string,
    command = parsed.data,
    repo = ctx.repository.progress;
  const binding = {
    actor: { type: "user" as const, id: ctx.orders.templates.actorId },
    action: `service.line.${command.action}`,
    hash: await requestHash({
      encoding: 1,
      shopId: ctx.orders.templates.shopId,
      actorId: ctx.orders.templates.actorId,
      orderId,
      lineId,
      version: expected.version,
      command,
    }),
  };
  await repo.lockKey(key);
  const a = await authority(ctx, orderId),
    view = await projection(ctx, a),
    line = view.lines.find((l) => l.line.id === lineId);
  if (!line) fail(404);
  const cached = await repo.replay(key);
  if (cached) {
    if (
      cached.hash !== binding.hash ||
      cached.actor.id !== binding.actor.id ||
      cached.action !== binding.action
    )
      fail(422);
  }
  const prior = cached ? undefined : await repo.prior(command.commandId, key);
  if (prior) {
    if (prior.hash !== binding.hash || prior.actorId !== binding.actor.id)
      fail(422);
    if (prior.key !== key || prior.commandId !== command.commandId) fail();
  }
  if (
    line.sourceId !== command.sourceId ||
    line.sourceDigest !== command.sourceDigest
  )
    fail();
  if (cached) return serviceLineResultSchema.parse(cached.response);
  if (prior) {
    return serviceLineResultSchema.parse({
      transitionId: prior.id,
      lineId: prior.lineId,
      version: prior.version,
    });
  }
  if (
    a.order.version !== command.orderVersion ||
    a.scopeDigest !== command.scopeDigest ||
    line.version !== expected.version
  )
    fail(412);
  if (!line.eligible) fail();
  if (command.action === "complete" && line.state !== "pending") fail();
  if (
    command.action === "correct" &&
    (line.state !== "completed" ||
      line.history.at(-1)?.id !== command.correctionOf)
  )
    fail();
  const source = (await repo.sources(orderId)).find(
    (s) => s.line.id === lineId,
  );
  if (!source) fail(404);
  const result = await repo.write({
    source,
    orderId,
    expected: expected.version,
    to: command.action === "complete" ? "completed" : "pending",
    correctionOf: command.action === "correct" ? command.correctionOf : null,
    parentVersion: a.order.version,
    bookingId: a.bookingId,
    bookingVersion: a.bookingVersion,
    actorId: binding.actor.id,
    commandId: command.commandId,
    key,
    hash: binding.hash,
    requestId: headers.requestId,
    note: command.action === "complete" ? command.note : command.reason,
  });
  await repo.persist(key, binding, result);
  return serviceLineResultSchema.parse(result);
}
