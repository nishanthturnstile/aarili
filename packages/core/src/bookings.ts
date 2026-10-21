import {
  type AcceptedOrder,
  type BookingDraft,
  bookingCommandSchema,
  bookingDraftSchema,
} from "@aarili/contracts/orders";
import { readCustomer } from "./customers.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  type QuickOrderContext,
  readAcceptedOrder,
  readOrderPieces,
} from "./orders.js";
import { requestHash } from "./request-binding.js";

function fail(
  status: 404 | 409 | 412 | 422,
  code:
    | "NOT_FOUND"
    | "REQUEST_CONFLICT"
    | "VERSION_STALE"
    | "VALIDATION_FAILED",
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Check booking and garment access" },
  });
}
const repo = (ctx: QuickOrderContext) => {
  if (!ctx.acceptance) fail(409, "REQUEST_CONFLICT");
  return ctx.acceptance.repository.bookings;
};
async function authorize(
  ctx: QuickOrderContext,
  ids: string[],
  extraCustomers: (string | null)[] = [],
) {
  const orders: AcceptedOrder[] = [];
  for (const id of [...new Set(ids)].sort()) {
    const o = await ctx.acceptance?.repository.read(id);
    if (!o) fail(404, "NOT_FOUND");
    orders.push(o);
  }
  // Lock each authority class globally before invoking the existing per-order policy.
  for (const id of [
    ...new Set(
      [...orders.map((o) => o.intake.customerId), ...extraCustomers].filter(
        (v): v is string => !!v,
      ),
    ),
  ].sort())
    await ctx.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(
      orders.map((o) => o.intake.wearerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.wearers.repository.lockWearer(id);
  const hydrated: AcceptedOrder[] = [];
  for (const o of orders) {
    await readOrderPieces(ctx, o.id);
    hydrated.push(await readAcceptedOrder(ctx, o.id));
  }
  return hydrated;
}
export async function bookingCandidates(
  ctx: QuickOrderContext,
  before?: string,
) {
  if (!ctx.acceptance) fail(409, "REQUEST_CONFLICT");
  const rows = await ctx.acceptance.repository.list(before),
    window = rows.slice(0, 25),
    orders = [];
  // Lock the whole page's authority classes before per-record eligibility checks.
  for (const id of [
    ...new Set(
      window.map((o) => o.intake.customerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(
      window.map((o) => o.intake.wearerId).filter((v): v is string => !!v),
    ),
  ].sort())
    await ctx.wearers.repository.lockWearer(id);
  for (const o of window) {
    try {
      await readOrderPieces(ctx, o.id);
      if (!(await repo(ctx).membership(o.id)))
        orders.push(await readAcceptedOrder(ctx, o.id));
    } catch (e) {
      if (!(e instanceof DraftFailure) || e.status !== 404) throw e;
    }
  }
  return {
    orders,
    next: rows.length > 25 ? (window.at(-1)?.id ?? null) : null,
  };
}
async function draftAuthority(ctx: QuickOrderContext, v: BookingDraft) {
  if (
    !ctx.customers.policy.enabled ||
    !ctx.customers.policy.synthetic ||
    !ctx.templates.synthetic
  )
    fail(409, "REQUEST_CONFLICT");
  // Generic draft save/replay calls authority before revalidation. Take the same
  // booking -> sorted order -> sorted customer -> sorted wearer classes here too.
  if (v.target) await repo(ctx).lock(v.target.id);
  const target = v.target ? await repo(ctx).read(v.target.id) : undefined;
  if (v.target && !target) fail(404, "NOT_FOUND");
  const ids = [
    ...(target?.revision.sources.map((o) => o.id) ?? []),
    ...v.orders.map((o) => o.id),
  ];
  for (const id of [...new Set(ids)].sort())
    await ctx.acceptance?.repository.lockOrder(id);
  await authorize(ctx, ids, [v.customerId, v.context.payerId]);
  for (const id of [
    ...new Set(
      [v.customerId, v.context.payerId].filter((v): v is string => !!v),
    ),
  ].sort())
    await readCustomer(ctx.customers, id);
  return target;
}
async function resolve(ctx: QuickOrderContext, v: BookingDraft, lock: boolean) {
  const r = repo(ctx);
  if (v.target) await r.lock(v.target.id);
  const target = v.target ? await r.read(v.target.id) : undefined;
  if (v.target && !target) fail(404, "NOT_FOUND");
  const ids = [
    ...(target?.revision.sources.map((o) => o.id) ?? []),
    ...v.orders.map((o) => o.id),
  ];
  if (lock)
    for (const id of [...new Set(ids)].sort())
      await ctx.acceptance?.repository.lockOrder(id);
  await draftAuthority(ctx, v);
  if (
    !v.customerId ||
    !v.reason.trim() ||
    (!target && v.orders.length < 2) ||
    (target && v.orders.length + target.revision.sources.length > 50)
  )
    fail(422, "VALIDATION_FAILED");
  if (target && target.version !== v.target?.version)
    fail(412, "VERSION_STALE");
  if (target?.version === 2147483647) fail(409, "REQUEST_CONFLICT");
  if (target && target.customerId !== v.customerId)
    fail(409, "REQUEST_CONFLICT");
  if (
    target &&
    v.orders.length &&
    (await ctx.acceptance?.repository.groups.commercial(target.id))?.basis ===
      "package-proposal"
  )
    fail(409, "REQUEST_CONFLICT");
  const added = [];
  for (const source of v.orders) {
    const o = await readAcceptedOrder(ctx, source.id);
    if (
      o.version !== source.version ||
      o.snapshotDigest !== source.snapshotDigest
    )
      fail(412, "VERSION_STALE");
    if (o.intake.customerId !== v.customerId || (await r.membership(o.id)))
      fail(409, "REQUEST_CONFLICT");
    added.push(o);
  }
  const sources = [...(target?.revision.sources ?? []), ...v.orders];
  const fingerprint = await requestHash({
    schemaVersion: 1,
    customerId: v.customerId,
    target: v.target,
    context: v.context,
    reason: v.reason,
    sources,
  });
  return { fingerprint, sources, added, target };
}
export async function reviewBooking(ctx: QuickOrderContext, input: unknown) {
  const v = bookingDraftSchema.parse(input),
    r = await resolve(ctx, v, true);
  return { fingerprint: r.fingerprint };
}
export function bookingDraftWorkflow(ctx: QuickOrderContext): DraftWorkflow {
  let prepared: Awaited<ReturnType<typeof resolve>> | undefined;
  return {
    schemaVersion: 1,
    draftSchema: bookingDraftSchema,
    commandSchema: bookingCommandSchema,
    async authorizeDraft(input) {
      await draftAuthority(ctx, bookingDraftSchema.parse(input));
    },
    async authorizePublication(input) {
      await draftAuthority(ctx, bookingDraftSchema.parse(input));
    },
    async revalidate(input) {
      const v = bookingDraftSchema.parse(input);
      prepared = await resolve(ctx, v, true);
      if (prepared.fingerprint !== v.reviewFingerprint)
        fail(409, "REQUEST_CONFLICT");
    },
    async promote(input, _action, draftId, request) {
      if (!prepared) fail(409, "REQUEST_CONFLICT");
      const revision = await repo(ctx).write({
        draft: bookingDraftSchema.parse(input),
        draftId,
        actorId: ctx.templates.actorId,
        ...request,
        sources: prepared.sources,
      });
      return { type: "booking.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "booking.revision" ||
        !(await repo(ctx).origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
export async function readBooking(
  ctx: QuickOrderContext,
  id: string,
  revision = false,
) {
  const record = await repo(ctx).read(id, revision);
  if (!record) fail(404, "NOT_FOUND");
  const orders = await authorize(
    ctx,
    record.revision.sources.map((o) => o.id),
  );
  if (record.revision.context.payerId)
    await readCustomer(ctx.customers, record.revision.context.payerId);
  const commercial =
    (await ctx.acceptance?.repository.groups.commercial(record.id)) ?? null;
  return {
    booking: record,
    orders,
    commercial,
    summary:
      commercial?.basis === "package-proposal"
        ? {
            basis: "package-proposal" as const,
            packagePaise: commercial.packagePaise,
            allocation: "unresolved" as const,
          }
        : bookingPriceSummary(orders),
  };
}
export async function listBookings(ctx: QuickOrderContext, before?: string) {
  const rows = await repo(ctx).list(before);
  const window = rows.slice(0, 25);
  await authorize(
    ctx,
    window.flatMap((b) => b.revision.sources.map((s) => s.id)),
  );
  for (const b of window)
    if (b.revision.context.payerId)
      await readCustomer(ctx.customers, b.revision.context.payerId);
  return {
    bookings: window,
    next: rows.length > 25 ? (window.at(-1)?.id ?? null) : null,
  };
}
export async function bookingHistory(
  ctx: QuickOrderContext,
  id: string,
  before?: number,
) {
  await readBooking(ctx, id);
  const rows = await repo(ctx).history(id, before);
  await authorize(
    ctx,
    rows.flatMap((r) => r.sources.map((s) => s.id)),
  );
  for (const r of rows)
    if (r.context.payerId) await readCustomer(ctx.customers, r.context.payerId);
  return {
    entries: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function bookingPriceSummary(
  orders: Pick<AcceptedOrder, "pricePaise">[],
) {
  const known = orders.reduce((n, o) => n + BigInt(o.pricePaise ?? 0), 0n);
  return {
    basis: "garment-prices" as const,
    knownSubtotalPaise: known.toString(),
    unknownCount: orders.filter((o) => o.pricePaise === null).length,
  };
}
