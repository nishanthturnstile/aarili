import {
  customerHistoryPageSchema,
  customerHistoryQuerySchema,
  unavailableHistoryDomains,
} from "@aarili/contracts/customer-history";
import type {
  CustomerHistoryRepository,
  HistoryWindow,
} from "@aarili/db/repositories/customer-history";
import { searchKeysV1 } from "@aarili/i18n/search";
import { readCustomer } from "./customers.js";
import { readGuardians } from "./guardians.js";
import type { QuickOrderContext } from "./orders.js";
import { requestHash } from "./request-binding.js";

export class HistoryFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 422,
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
      versions.push([w.id, w.version, g.version]);
    } else {
      eligible =
        eligible &&
        w.purposes.some((p) => p.purpose === "service" && p.eligible);
      versions.push([w.id, w.version]);
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
