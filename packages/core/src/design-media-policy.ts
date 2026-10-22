import type { DesignMediaSubject } from "@aarili/contracts/design-references";
import type { DesignReferencesRepository } from "@aarili/db/repositories/design-references";
import type { OrdersRepository } from "@aarili/db/repositories/orders";
import type {
  GuardianRepository,
  WearerRepository,
} from "@aarili/db/repositories/wearers";
import { MediaFailure, type MediaPolicy } from "./media.js";

export type DesignMediaAuthority = {
  repository: DesignReferencesRepository;
  orders: OrdersRepository;
  wearers: WearerRepository;
  guardians: GuardianRepository;
  enabled: boolean;
};
function denied(): never {
  throw new MediaFailure(404, "NOT_FOUND");
}
// Discover complete aggregate classes before acquiring identity/guardian locks.
// This is shared by web, media worker, and multi-source specification commands.
export async function prepareDesignMediaOrders(
  ctx: DesignMediaAuthority,
  ids: string[],
) {
  const orders = [...new Set(ids.map((id) => id.toLowerCase()))].sort();
  const memberships = new Map<string, string | undefined>();
  for (const id of orders)
    memberships.set(id, await ctx.orders.bookings.membership(id));
  for (const id of [
    ...new Set([...memberships.values()].filter((v): v is string => !!v)),
  ].sort())
    await ctx.orders.bookings.lock(id);
  for (const id of orders) await ctx.orders.lockOrder(id);
  const scopes = [];
  for (const id of orders) {
    if ((await ctx.orders.bookings.membership(id)) !== memberships.get(id))
      denied();
    const s = await ctx.repository.scope(id);
    if (s?.kind !== "custom") denied();
    scopes.push(s);
  }
  for (const id of [...new Set(scopes.map((s) => s.customerId))].sort())
    await ctx.wearers.lockCustomer(id);
  for (const id of [...new Set(scopes.map((s) => s.wearerId))].sort())
    await ctx.wearers.lockWearer(id);
}
export async function authorizeDesignSubject(
  ctx: DesignMediaAuthority,
  s: DesignMediaSubject,
  photo: boolean,
) {
  await ctx.repository.lockSubject(s.id);
  const current = await ctx.repository.subject(s.id);
  if (!current) denied();
  s = current;
  if (s.redacted) denied();
  if (s.kind === "library") {
    if (
      !["shop-owned", "licensed-reuse"].includes(s.rightsBasis) ||
      !s.rightsEvidence.trim()
    )
      denied();
    return { minor: false, guardianConsent: false };
  }
  if (!ctx.enabled || !s.orderId) denied();
  await prepareDesignMediaOrders(ctx, [s.orderId]);
  const scope = await ctx.repository.scope(s.orderId);
  if (!scope) denied();
  const w = await ctx.wearers.read(scope.customerId, scope.wearerId);
  if (
    !w?.relationship.authorised ||
    !w.relationship.informed ||
    w.age === "unknown"
  )
    denied();
  if (w.age === "adult") {
    if (
      !w.purposes.some((p) => p.purpose === "service" && p.eligible) ||
      !w.purposes.some((p) => p.purpose === "private-media" && p.eligible)
    )
      denied();
    return { minor: false, guardianConsent: false };
  }
  const g = await ctx.guardians.read(w.id, true);
  if (!g.authorities.some((a) => a.verifiedCurrent)) denied();
  const consent = g.purposes.some(
    (p) => p.purpose === "private-photo" && p.eligible,
  );
  if (photo && !consent) denied();
  return { minor: true, guardianConsent: consent };
}
export function designMediaPolicy(
  ctx: DesignMediaAuthority,
  fallback: MediaPolicy,
): MediaPolicy {
  return {
    async prepare(subjectId) {
      const s = await ctx.repository.subject(subjectId);
      if (s) {
        await ctx.repository.lockSubject(s.id);
        if (s.orderId) await prepareDesignMediaOrders(ctx, [s.orderId]);
      } else await fallback.prepare?.(subjectId);
    },
    async authorize(input) {
      const initial = await ctx.repository.subject(input.subjectId);
      if (!initial) return fallback.authorize(input);
      // Ordering: shop reference barrier, booking/order/identity, then media locks.
      await ctx.repository.lockSubject(initial.id);
      if (initial.orderId)
        await prepareDesignMediaOrders(ctx, [initial.orderId]);
      const s = await ctx.repository.subject(initial.id);
      if (!s || s.redacted) return null;
      if (
        s.kind === "library"
          ? input.purpose !== "manual-pattern" &&
            input.purpose !== "order-document" &&
            input.purpose !== "voice-note"
          : input.purpose === "shop-branding"
      )
        return null;
      try {
        return await authorizeDesignSubject(
          ctx,
          s,
          input.contentType.startsWith("image/") ||
            input.purpose === "private-fitting",
        );
      } catch (e) {
        if (e instanceof MediaFailure) return null;
        throw e;
      }
    },
    async authorizeRead(assetId) {
      const s = await ctx.repository.subjectForAsset(assetId);
      if (!s) return fallback.authorizeRead?.(assetId);
      // Design bytes require an exact version/reference route. Generic status reads
      // remain available for pending candidates; generic byte signing is denied.
      denied();
    },
  };
}
