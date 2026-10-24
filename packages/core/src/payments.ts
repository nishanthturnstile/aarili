import {
  normalizeUpiReference,
  type PaymentDraft,
  type PaymentReceipt,
  paymentCommandSchema,
  paymentDraftSchema,
  paymentDuplicateQuerySchema,
  paymentHistoryQuerySchema,
  paymentOptionsSchema,
  paymentPositionSchema,
  paymentQuerySchema,
} from "@aarili/contracts/payments";
import { summarizeDirectory } from "@aarili/contracts/shop-directory";
import type { DraftRepository } from "@aarili/db/repositories/drafts";
import type { JournalRepository } from "@aarili/db/repositories/journal";
import type { PaymentsRepository } from "@aarili/db/repositories/payments";
import type { RestoreRepository } from "@aarili/db/repositories/restore";
import type { ShopDirectoryRepository } from "@aarili/db/repositories/shop-directory";
import type { ShopProfileRepository } from "@aarili/db/repositories/shop-profile";
import { fromBigint, parseRupees } from "@aarili/money";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { postJournal } from "./journal.js";
import { requestHash } from "./request-binding.js";
import { requireUnfrozenMoney } from "./restore.js";

export type PaymentsContext = {
  shopId: string;
  actorId: string;
  synthetic: boolean;
  repository: PaymentsRepository;
  drafts: DraftRepository;
  journal: JournalRepository;
  restore: RestoreRepository;
  directory: ShopDirectoryRepository;
  profile: ShopProfileRepository;
};
function fail(
  status: 404 | 409 | 412 | 422,
  code:
    | "NOT_FOUND"
    | "REQUEST_CONFLICT"
    | "VERSION_STALE"
    | "VALIDATION_FAILED" = "REQUEST_CONFLICT",
): never {
  throw new DraftFailure(status, {
    error: {
      code,
      message: "Review payment state, source or receiving configuration",
    },
  });
}
// Separate deterministic namespace from the browser's outer draft command key.
export async function paymentJournalKey(shopId: string, receiptId: string) {
  const h = await requestHash({
    kind: "payment.journal.v1",
    shopId,
    receiptId,
  });
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export async function readPayment(ctx: PaymentsContext, id: string) {
  const r = await ctx.repository.read(id);
  if (
    !r ||
    !(await ctx.repository.identity(r.customerId)) ||
    !(await ctx.repository.identity(r.payerId))
  )
    fail(404, "NOT_FOUND");
  return r;
}
export async function listPayments(ctx: PaymentsContext, input: unknown) {
  const q = paymentQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  if (q.data.customerId && !(await ctx.repository.identity(q.data.customerId)))
    fail(404, "NOT_FOUND");
  const rows = await ctx.repository.list(q.data.customerId, q.data.before);
  return {
    receipts: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.id ?? null) : null,
  };
}
export async function paymentHistory(ctx: PaymentsContext, input: unknown) {
  const q = paymentHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const r = await readPayment(ctx, q.data.id);
  const events = await ctx.repository.history(r.id, q.data.beforeVersion);
  return {
    events: events.slice(0, 25),
    next: events.length > 25 ? (events[24]?.version ?? null) : null,
  };
}
export async function paymentDuplicate(ctx: PaymentsContext, input: unknown) {
  const q = paymentDuplicateQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const normalized = normalizeUpiReference(q.data.reference);
  if (!normalized) fail(422, "VALIDATION_FAILED");
  const id = await ctx.repository.referenceReceipt(normalized);
  if (!id) fail(404, "NOT_FOUND");
  const r = await readPayment(ctx, id);
  if (r.customerId !== q.data.customerId) fail(404, "NOT_FOUND");
  return r;
}
export async function paymentPosition(
  ctx: PaymentsContext,
  customerId: string,
) {
  if (!(await ctx.repository.identity(customerId))) fail(404, "NOT_FOUND");
  const p = await ctx.repository.totals(customerId);
  return paymentPositionSchema.parse({
    customerId,
    ...p,
    unallocatedPaise: p.confirmedPaise,
    allocatedPaise: "0",
    agreedCharges: "not-established",
    corrections: "not-available",
  });
}
export async function paymentOptions(ctx: PaymentsContext) {
  const state = await ctx.restore.lockState(),
    profile = await ctx.profile.current();
  const config = await ctx.directory.configuration();
  const accounts = [];
  let before: string | undefined;
  for (;;) {
    const page = await ctx.directory.list(before);
    for (const r of page)
      if (
        r.content.kind === "account" &&
        r.content.active &&
        config.enabled.includes(r.content.method)
      ) {
        const summary = summarizeDirectory(r);
        accounts.push({
          id: r.entryId,
          revisionId: r.id,
          method: r.content.method,
          label: summary.label,
          maskedIdentifier: summary.maskedIdentifier,
        });
      }
    if (page.length < 26) break;
    before = page.at(-1)?.entryId;
  }
  return paymentOptionsSchema.parse({
    profileId: profile?.id ?? null,
    recipientBusiness: profile?.profile.displayName ?? "",
    timezone: "Asia/Kolkata",
    today: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(await ctx.drafts.now()),
    enabled: config.enabled,
    accounts,
    restoreEpoch: state?.epoch ?? null,
    frozen: state?.frozen !== false,
    synthetic: ctx.synthetic,
  });
}
function matches(v: PaymentDraft, r: PaymentReceipt, amount: number) {
  const p = r.current;
  return (
    r.customerId === v.customerId &&
    r.payerId === v.payerId &&
    r.orderId === v.orderId &&
    r.bookingId === v.bookingId &&
    p.amountPaise === amount &&
    p.method === v.method &&
    p.paymentDate === v.paymentDate &&
    p.reference === v.reference &&
    p.profileId === v.profileId &&
    p.accountId === v.accountId &&
    p.accountRevisionId === v.accountRevisionId
  );
}
export function paymentReceiptWorkflow(ctx: PaymentsContext): DraftWorkflow {
  let prepared:
    | {
        v: PaymentDraft;
        receiptId: string;
        previous: PaymentReceipt | undefined;
        amount: number;
        duplicate: boolean;
      }
    | undefined;
  return {
    schemaVersion: 1,
    draftSchema: paymentDraftSchema,
    commandSchema: paymentCommandSchema,
    async prepareCommand(input, draftId, key) {
      await ctx.restore.lockState();
      const v = paymentDraftSchema.safeParse(input);
      if (!v.success) return;
      const inner = await paymentJournalKey(
        ctx.shopId,
        v.data.receiptId ?? draftId,
      );
      if (inner === key) fail(422, "VALIDATION_FAILED");
      for (const k of [key, inner].sort()) await ctx.drafts.lockKey(k);
    },
    async authorizeDraft(input) {
      const v = paymentDraftSchema.parse(input);
      for (const id of [v.customerId, v.payerId])
        if (id && !(await ctx.repository.identity(id))) fail(404, "NOT_FOUND");
      if (v.receiptId) await readPayment(ctx, v.receiptId);
    },
    validateEdit(previous, next) {
      // A transition cannot be redirected to a different receipt/customer.
      if (
        previous.receiptId &&
        ["receiptId", "customerId", "payerId", "orderId", "bookingId"].some(
          (k) => previous[k] !== next[k],
        )
      )
        fail(409);
    },
    async revalidate(input, draftId) {
      if (!ctx.synthetic) fail(409);
      const v = paymentCommandSchema.parse(input);
      let amount: number | null;
      try {
        amount = parseRupees(v.amountText);
      } catch {
        fail(422, "VALIDATION_FAILED");
      }
      if (amount === null || amount <= 0) fail(422, "VALIDATION_FAILED");
      await ctx.repository.lockIdentity();
      await ctx.directory.lock();
      if (
        !v.customerId ||
        !v.payerId ||
        !(await ctx.repository.scope(v.customerId, v.orderId, v.bookingId)) ||
        !(await ctx.repository.identity(v.payerId))
      )
        fail(404, "NOT_FOUND");
      const receiptId = v.receiptId ?? draftId;
      await ctx.repository.lockReceipt(receiptId);
      const previous = v.receiptId
        ? await readPayment(ctx, v.receiptId)
        : undefined;
      if (
        previous &&
        (previous.customerId !== v.customerId ||
          previous.payerId !== v.payerId ||
          previous.orderId !== v.orderId ||
          previous.bookingId !== v.bookingId)
      )
        fail(409);
      const confirms = v.action === "cash-received" || v.action === "upi-seen";
      if (confirms) {
        try {
          await requireUnfrozenMoney(ctx.restore);
        } catch {
          fail(409);
        }
        const state = await ctx.restore.lockState();
        if (state?.epoch !== v.restoreEpoch) fail(409);
      }
      if (
        previous?.current.status === "confirmed" &&
        confirms &&
        matches(v, previous, amount)
      ) {
        prepared = { v, receiptId, previous, amount, duplicate: true };
        return;
      }
      if (previous && previous.current.version !== v.expectedVersion)
        fail(412, "VERSION_STALE");
      if (previous && previous.current.status !== "pending") fail(409);
      if (confirms) {
        await ctx.journal.lockSubject(v.customerId);
        const positions = await ctx.journal.positions(v.customerId);
        try {
          fromBigint(BigInt(positions.deposit) - BigInt(amount));
          fromBigint(
            BigInt(positions[v.method === "cash" ? "cash" : "electronic"]) +
              BigInt(amount),
          );
        } catch {
          fail(422, "VALIDATION_FAILED");
        }
      }
      if (previous && v.action !== "correct" && !matches(v, previous, amount))
        fail(409);
      if (v.action !== "fail") {
        const configuration = await ctx.directory.configuration();
        if (!configuration.enabled.includes(v.method)) fail(409);
        const profile =
          v.receiptId && v.action !== "correct"
            ? await ctx.profile.read(v.profileId ?? "")
            : await ctx.profile.current();
        if (!profile || profile.id !== v.profileId) fail(409);
        if (v.method !== "cash") {
          const account = await ctx.directory.current(v.accountId ?? "");
          if (
            !account ||
            account.id !== v.accountRevisionId ||
            account.content.kind !== "account" ||
            !account.content.active ||
            account.content.method !== v.method
          )
            fail(409);
        }
      }
      prepared = { v, receiptId, previous, amount, duplicate: false };
    },
    async promote(_input, _actionId, draftId, request) {
      if (!prepared) fail(409);
      const { v, receiptId, previous, amount, duplicate } = prepared;
      if (duplicate && previous) {
        await ctx.repository.result(draftId, previous.current.id);
        return { type: "payment.receipt", id: draftId };
      }
      let journalId: string | null = null;
      const confirms = v.action === "cash-received" || v.action === "upi-seen";
      if (confirms) {
        const batch = await postJournal(
          ctx.journal,
          ctx.actorId,
          {
            sourceId: receiptId,
            subjectId: v.customerId ?? "",
            kind: "posting",
            relatedId: null,
            reason: "Owner confirmed customer deposit",
            entries: [
              {
                account: v.method === "cash" ? "cash" : "electronic",
                amountPaise: amount,
              },
              { account: "deposit", amountPaise: -amount },
            ],
          },
          {
            key: await paymentJournalKey(ctx.shopId, receiptId),
            requestId: request.requestId,
          },
        );
        journalId = batch.id;
      }
      const eventId = await ctx.repository.eventId();
      await ctx.repository.append({
        receiptId,
        eventId,
        previousId: previous?.current.id ?? null,
        version: (previous?.current.version ?? 0) + 1,
        draftId,
        actorId: ctx.actorId,
        ...request,
        input: v,
        amountPaise: amount,
        journalId,
        status: confirms
          ? "confirmed"
          : v.action === "fail"
            ? "failed"
            : "pending",
      });
      const reference =
        v.method === "upi" ? normalizeUpiReference(v.reference) : null;
      if (reference && !(await ctx.repository.claim(reference, receiptId)))
        throw new DraftFailure(409, {
          error: {
            code: "PAYMENT_REFERENCE_DUPLICATE",
            message:
              "UPI reference already recorded; review the existing payment",
          },
        });
      await ctx.repository.result(draftId, eventId);
      return { type: "payment.receipt", id: draftId };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "payment.receipt" ||
        result.id !== draftId ||
        !(await ctx.repository.resultReceipt(draftId, result.id))
      )
        fail(409);
      await readPayment(ctx, result.id);
    },
  };
}
