import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  initialShopProfile,
  type ShopProfileInput,
  type ShopProfileState,
  shopProfileHistoryQuerySchema,
  shopProfileInputSchema,
  shopProfileStateSchema,
} from "@aarili/contracts/shop-profile";
import type { ShopProfileRepository } from "@aarili/db/repositories/shop-profile";
import type { MediaPolicy } from "./media.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export type ShopProfileContext = {
  shopId: string;
  actorId: string;
  repository: ShopProfileRepository;
  brandingAvailable: boolean;
};
export class ShopProfileFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    public readonly code: string,
    public readonly current?: ShopProfileState,
  ) {
    super(code);
  }
}
export async function readShopProfile(
  ctx: ShopProfileContext,
): Promise<ShopProfileState> {
  const revision = await ctx.repository.current();
  const name = revision ? undefined : await ctx.repository.initialName();
  if (!revision && !name) throw new ShopProfileFailure(404, "NOT_FOUND");
  const profile = revision?.profile ?? initialShopProfile(name as string);
  return shopProfileStateSchema.parse({
    currentActorId: ctx.actorId,
    version: revision?.version ?? 1,
    revision: revision ?? null,
    profile,
    brandingAvailable: ctx.brandingAvailable,
    missing: [
      !profile.legalName && "legalName",
      !profile.address && "address",
      !profile.phone && !profile.email && "contact",
    ].filter(Boolean),
  });
}
export async function readShopProfileHistory(
  ctx: ShopProfileContext,
  input: unknown,
) {
  const query = shopProfileHistoryQuerySchema.safeParse(input);
  if (!query.success) throw new ShopProfileFailure(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.history(query.data.beforeVersion);
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export async function readShopProfileRevision(
  ctx: ShopProfileContext,
  id: string,
) {
  const revision = await ctx.repository.read(id);
  if (!revision) throw new ShopProfileFailure(404, "NOT_FOUND");
  return revision;
}
export async function reviseShopProfile(
  ctx: ShopProfileContext,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const parsed = shopProfileInputSchema.safeParse(input);
  if (
    !parsed.success ||
    ![ctx.shopId, ctx.actorId, headers.key, headers.requestId].every(
      (v) => idempotencyHeaderSchema.safeParse(v).success,
    )
  )
    throw new ShopProfileFailure(422, "VALIDATION_FAILED");
  const expected = parseExpectedVersion(headers.ifMatch);
  if (!expected.ok)
    throw new ShopProfileFailure(expected.status, expected.code);
  const key = (headers.key as string).toLowerCase(),
    actorId = ctx.actorId.toLowerCase();
  const profile: ShopProfileInput = {
    ...parsed.data,
    logoAssetId: parsed.data.logoAssetId?.toLowerCase() ?? null,
  };
  const binding = {
    actor: { type: "user" as const, id: actorId },
    action: "shop-profile.revise",
    hash: await requestHash({
      shopId: ctx.shopId.toLowerCase(),
      actorId,
      profile,
      version: expected.version,
    }),
  };
  const repo = ctx.repository;
  await repo.lockKey(key);
  const old = await repo.replay(key);
  if (old) {
    if (
      old.actor.type !== "user" ||
      old.actor.id !== actorId ||
      old.action !== binding.action ||
      old.hash !== binding.hash
    )
      throw new ShopProfileFailure(422, "IDEMPOTENCY_MISMATCH");
    return shopProfileStateSchema.parse(old.response);
  }
  await repo.lock();
  const current = await readShopProfile(ctx);
  if (current.version !== expected.version)
    throw new ShopProfileFailure(412, "VERSION_STALE", current);
  if (current.version === 2147483647)
    throw new ShopProfileFailure(409, "REVISION_EXHAUSTED");
  if (profile.logoAssetId && !(await repo.logoReady(profile.logoAssetId)))
    throw new ShopProfileFailure(409, "LOGO_NOT_READY");
  const provenance = {
    actorId,
    key,
    requestId: headers.requestId.toLowerCase(),
  };
  // Capture the original onboarding identity before the first correction.
  // This is an attributable baseline capture, not backdated publication.
  const previous =
    current.revision ??
    (await repo.append({
      ...provenance,
      profile: current.profile,
      version: 1,
      previousId: null,
      baseline: true,
    }));
  const revision = await repo.append({
    ...provenance,
    profile,
    version: current.version + 1,
    previousId: previous.id,
    baseline: false,
  });
  if (
    !(await repo.advance(revision, current.revision ? current.version : null))
  )
    throw new ShopProfileFailure(412, "VERSION_STALE");
  const result = await readShopProfile(ctx);
  await repo.persist(key, binding, result);
  return result;
}

// Called only inside verified owner/job tenant transactions; other purposes
// retain their existing policies. No supplied wearer ID acquires shop authority.
export function shopBrandingPolicy(
  shopId: string,
  fallback: MediaPolicy,
): MediaPolicy {
  return {
    authorize: (input) =>
      input.purpose === "shop-branding"
        ? Promise.resolve(
            input.subjectId.toLowerCase() === shopId.toLowerCase() &&
              input.contentType.startsWith("image/")
              ? { minor: false, guardianConsent: false }
              : null,
          )
        : fallback.authorize(input),
  };
}
