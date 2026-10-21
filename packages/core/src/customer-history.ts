import {
  customerHistoryPageSchema,
  customerHistoryQuerySchema,
  customerPairDecisionSchema,
  customerPairQuerySchema,
  customerPairSchema,
  duplicateCandidatesQuerySchema,
  duplicateCandidatesSchema,
  unavailableHistoryDomains,
} from "@aarili/contracts/customer-history";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import type {
  CustomerHistoryRepository,
  HistoryWindow,
} from "@aarili/db/repositories/customer-history";
import { searchKeysV1 } from "@aarili/i18n/search";
import { readCustomer } from "./customers.js";
import { readGuardians } from "./guardians.js";
import type { QuickOrderContext } from "./orders.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export class HistoryFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    public readonly code: string,
  ) {
    super(code);
  }
}
export type HistoryCursor = HistoryWindow & {
  binding: string;
  expires: number;
};
export type CustomerHistoryContext = {
  identities: QuickOrderContext;
  repository: CustomerHistoryRepository;
  cursor: { seal(value: HistoryCursor): string; open(value: string): unknown };
};
export async function duplicateCandidates(
  ctx: CustomerHistoryContext,
  input: unknown,
) {
  const q = duplicateCandidatesQuerySchema.safeParse(input);
  if (!q.success) throw new HistoryFailure(422, "VALIDATION_FAILED");
  await readCustomer(ctx.identities.customers, q.data.customerId);
  return duplicateCandidatesSchema.parse(
    await ctx.repository.candidates(q.data.customerId, q.data.after),
  );
}
export async function previewCustomerPair(
  ctx: CustomerHistoryContext,
  input: unknown,
) {
  const q = customerPairQuerySchema.safeParse(input);
  if (
    !q.success ||
    q.data.firstId.toLowerCase() === q.data.secondId.toLowerCase()
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  const ids = [
    q.data.firstId.toLowerCase(),
    q.data.secondId.toLowerCase(),
  ].sort();
  const { customers, wearers, guardians } = ctx.identities;
  // No order locks are discovered after this point. Contact rows precede
  // the entire sorted wearer lock class, matching intake/history authority reads.
  for (const id of ids) await ctx.repository.lockContact(id);
  const contacts = [];
  const discovered = new Map<string, string[]>();
  for (const id of ids) discovered.set(id, await ctx.repository.wearers(id));
  for (const id of [...new Set([...discovered.values()].flat())].sort())
    await wearers.repository.lockWearer(id);
  const versions: unknown[] = [];
  for (const id of ids) {
    const c = await readCustomer(customers, id);
    const visible = [];
    for (const wid of discovered.get(id) ?? []) {
      const w = await wearers.repository.read(id, wid);
      if (!w) continue;
      const r = w.relationship;
      let guardianVerified = false;
      if (w.age === "minor")
        guardianVerified = (
          await readGuardians(guardians, id, wid)
        ).authorities.some((a) => a.verifiedCurrent);
      const eligible =
        r.authorised &&
        r.informed &&
        !r.authorisationDeclined &&
        !r.informedDeclined &&
        (w.age === "minor"
          ? guardianVerified
          : w.purposes.some((p) => p.purpose === "service" && p.eligible));
      visible.push({
        id: w.id,
        version: w.version,
        displayName: eligible ? w.displayName : null,
        age: w.age,
        eligible,
        relationship: r.kind,
        guardianVerified,
      });
      versions.push([
        id,
        w.id,
        w.version,
        w.displayName,
        guardianVerified,
        eligible,
      ]);
    }
    const { notes: _n, personId: _p, serviceEvidence: _e, ...summary } = c;
    contacts.push({ customer: summary, wearers: visible });
  }
  const decisions = await ctx.repository.decisions(
    ids[0] as string,
    ids[1] as string,
  );
  const version = decisions[0]?.version ?? 1;
  const fingerprint = await requestHash({
    shop: customers.shopId,
    actor: customers.actor,
    contacts: contacts.map((c) => [c.customer.id, c.customer.version]),
    versions,
    privacy: await ctx.repository.privacyVersion(),
  });
  return customerPairSchema.parse({
    contacts,
    decisions,
    version,
    fingerprint,
  });
}
export async function decideCustomerPair(
  ctx: CustomerHistoryContext,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const q = customerPairDecisionSchema.safeParse(input);
  if (
    !q.success ||
    !idempotencyHeaderSchema.safeParse(headers.key).success ||
    !idempotencyHeaderSchema.safeParse(headers.requestId).success ||
    ctx.identities.customers.actor.type !== "user"
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  const expected = parseExpectedVersion(headers.ifMatch);
  if (!expected.ok) throw new HistoryFailure(expected.status, expected.code);
  const key = (headers.key as string).toLowerCase();
  const [first, second] = [
    q.data.firstId.toLowerCase(),
    q.data.secondId.toLowerCase(),
  ].sort() as [string, string];
  const actor = ctx.identities.customers.actor;
  const hash = await requestHash({
    shop: ctx.identities.customers.shopId,
    actor,
    first,
    second,
    expected: expected.version,
    fingerprint: q.data.fingerprint,
    decision: q.data.decision,
    reason: q.data.reason,
  });
  await ctx.repository.reviews.lockKey(key);
  // Pair serialization precedes contact/authority locks and is never acquired
  // by correction/intake commands. Durable operation rows outlive key retention.
  await ctx.repository.lockPair(first, second);
  const pair = await previewCustomerPair(ctx, {
    firstId: first,
    secondId: second,
  });
  const policy = ctx.identities.customers.policy;
  if (!policy.enabled || !policy.synthetic || !policy.notice)
    throw new HistoryFailure(409, "CUSTOMER_POLICY_PENDING");
  const priorKey = await ctx.repository.reviews.replay(key);
  if (
    priorKey &&
    (priorKey.actor.type !== actor.type ||
      priorKey.actor.id !== actor.id ||
      priorKey.action !== "customer.pair-review" ||
      priorKey.hash !== hash)
  )
    throw new HistoryFailure(422, "IDEMPOTENCY_MISMATCH");
  const replay = await ctx.repository.reviewReplay(key);
  if (replay) {
    if (replay.actorId !== actor.id || replay.hash !== hash)
      throw new HistoryFailure(422, "IDEMPOTENCY_MISMATCH");
    if (pair.fingerprint !== q.data.fingerprint)
      throw new HistoryFailure(409, "PAIR_CHANGED");
    return replay.result;
  }
  if (priorKey) throw new HistoryFailure(422, "IDEMPOTENCY_MISMATCH");
  if (
    pair.version !== expected.version ||
    pair.fingerprint !== q.data.fingerprint
  )
    throw new HistoryFailure(412, "PAIR_CHANGED");
  if (pair.version === 2147483647)
    throw new HistoryFailure(409, "VERSION_EXHAUSTED");
  const result = await ctx.repository.decide({
    first,
    second,
    firstVersion: pair.contacts[0]?.customer.version as number,
    secondVersion: pair.contacts[1]?.customer.version as number,
    version: pair.version + 1,
    decision: q.data.decision,
    reason: q.data.reason,
    actorId: actor.id,
    key,
    hash,
    requestId: headers.requestId,
  });
  await ctx.repository.reviews.persist(
    key,
    { actor, action: "customer.pair-review", hash },
    result,
  );
  return result;
}
export async function customerHistory(
  ctx: CustomerHistoryContext,
  input: unknown,
) {
  const parsed = customerHistoryQuerySchema.safeParse(input);
  if (!parsed.success) throw new HistoryFailure(422, "VALIDATION_FAILED");
  const q = {
    ...parsed.data,
    customerId: parsed.data.customerId.toLowerCase(),
    wearerId: parsed.data.wearerId?.toLowerCase() ?? null,
  };
  const { customers, wearers, guardians } = ctx.identities;
  await wearers.repository.lockCustomer(q.customerId);
  const c = await readCustomer(customers, q.customerId);
  // Acquire the whole authority class in the same order as intake/recovery.
  // Wearer IDs are identity discovery only; no historic snippets/counts are returned.
  const candidates = await ctx.repository.wearers(c.id);
  for (const id of candidates.sort()) await wearers.repository.lockWearer(id);
  const allowed: string[] = [],
    versions: unknown[] = [];
  for (const id of candidates) {
    const w = await wearers.repository.read(c.id, id);
    if (!w) continue;
    const r = w.relationship;
    let eligible =
      r.authorised &&
      r.informed &&
      !r.authorisationDeclined &&
      !r.informedDeclined;
    if (w.age === "minor") {
      const g = await readGuardians(guardians, c.id, w.id);
      eligible = eligible && g.authorities.some((a) => a.verifiedCurrent);
      versions.push([w.id, w.version, w.displayName, g.version]);
    } else {
      eligible =
        eligible &&
        w.purposes.some((p) => p.purpose === "service" && p.eligible);
      versions.push([w.id, w.version, w.displayName]);
    }
    if (eligible) allowed.push(w.id);
  }
  if (q.wearerId && !allowed.includes(q.wearerId))
    throw new HistoryFailure(404, "NOT_FOUND");
  const binding = await requestHash({
    shop: customers.shopId,
    actor: customers.actor,
    customer: c.id,
    version: c.version,
    versions,
    privacy: await ctx.repository.privacyVersion(),
    allowed,
    wearer: q.wearerId,
    query: q.query,
    limit: q.limit,
  });
  let window: HistoryWindow;
  let expires = Date.now() + 3600000;
  if (q.cursor) {
    let value: unknown;
    try {
      value = ctx.cursor.open(q.cursor);
    } catch {
      throw new HistoryFailure(422, "INVALID_CURSOR");
    }
    const v = value as HistoryCursor | null;
    if (
      !v ||
      v.binding !== binding ||
      typeof v.expires !== "number" ||
      v.expires < Date.now()
    )
      throw new HistoryFailure(409, "HISTORY_CHANGED");
    if (
      !/^\d+$/.test(v.watermark) ||
      !v.position ||
      !/^\d{4}-/.test(v.position.at) ||
      !/^[0-9a-f-]{36}$/.test(v.position.id)
    )
      throw new HistoryFailure(422, "INVALID_CURSOR");
    window = v;
    expires = v.expires;
  } else window = await ctx.repository.window();
  const page = await ctx.repository.page(
    q,
    q.wearerId ? [q.wearerId] : allowed,
    window,
    searchKeysV1(q.query, /^[\s+().\-\p{Nd}]+$/u.test(q.query) ? q.query : ""),
  );
  return customerHistoryPageSchema.parse({
    events: page.events,
    next: page.next
      ? ctx.cursor.seal({
          watermark: window.watermark,
          position: page.next,
          binding,
          expires,
        })
      : null,
    unavailable: unavailableHistoryDomains,
    attribution: "original-identifiers-current-labels",
  });
}
