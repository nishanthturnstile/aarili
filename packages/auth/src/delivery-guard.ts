import { guardedEffect } from "@aarili/core/restore";
import {
  type Database,
  requireRuntimeRole,
  ShopAccessError,
  sql,
  type Transaction,
  withShop,
} from "@aarili/db";
import { restoreRepository } from "@aarili/db/restore-repository";
import { authorizeJobPrincipal } from "./job-principal.js";

// Prospective installation/auth delivery before shop membership exists. Pending
// verification belongs to the reserved bootstrap user; resets require verified
// identity. These locks serialize revocation with the boundary. No raw code,
// token, email address or content is ever placed in a queue.
export async function authDeliveryAuthority(
  tx: Transaction,
  userId: string,
  purpose: "verification" | "reset",
  expectedShop: string | null,
) {
  if (expectedShop && !(await authorizeJobPrincipal(tx, userId, expectedShop)))
    return false;
  const result =
    await tx.execute(sql`select 1 from auth_user u where u.id=${userId}::uuid
    and (${purpose}='reset' and u.email_verified or ${purpose}='verification' and not u.email_verified)
    and exists(select 1 from owner_bootstrap b where b.user_id=u.id and b.shop_id is not distinct from ${expectedShop}::uuid
      and (${purpose}='reset' or b.completed_at is null)) for share of u`);
  if (!result.rowCount) return false;
  const bootstrap =
    await tx.execute(sql`select 1 from owner_bootstrap where user_id=${userId}::uuid
    and shop_id is not distinct from ${expectedShop}::uuid and (${purpose}='reset' or completed_at is null) for share`);
  return !!bootstrap.rowCount;
}

// Once a shop exists, auth delivery uses its current membership/practice through
// withShop. Initial installation metadata is an explicit auth exception; its
// snapshot is rechecked under lock so bootstrap cannot move during an effect.
export async function withAuthDeliveryContext<T>(
  db: Database,
  userId: string,
  run: (tx: Transaction, shopId: string | null) => Promise<T>,
): Promise<T | "authority_revoked"> {
  await requireRuntimeRole(db);
  const snapshot = await db.execute<{ shopId: string | null }>(
    sql`select shop_id as "shopId" from owner_bootstrap where user_id=${userId}::uuid`,
  );
  const owner = snapshot.rows[0];
  if (!owner) return "authority_revoked";
  try {
    return owner.shopId
      ? await withShop(db, userId, owner.shopId, (tx) => run(tx, owner.shopId))
      : await db.transaction(async (tx) => {
          await requireRuntimeRole(tx);
          return run(tx, null);
        });
  } catch (error) {
    if (error instanceof ShopAccessError) return "authority_revoked";
    throw error;
  }
}

// There is deliberately no real transport. Future delivery must use this same
// boundary and an approved adapter. Capture callbacks remain private local I/O.
export async function prospectiveAuthDelivery(
  db: Database,
  userId: string,
  purpose: "verification" | "reset",
) {
  try {
    return await withAuthDeliveryContext(db, userId, async (tx, shopId) => {
      const controls = restoreRepository(tx, shopId ?? undefined);
      const state = await controls.lockState();
      const result = await guardedEffect(
        controls,
        () => process.env.OUTBOUND_EFFECTS,
        async () => ({
          epoch: state?.epoch,
          practice: shopId ? await controls.practice() : false,
          authorized: await authDeliveryAuthority(tx, userId, purpose, shopId),
          current: true,
        }),
        async () => {
          throw new Error("AUTH_PROVIDER_NOT_CONFIGURED");
        },
      );
      return result;
    });
  } catch {
    return "control_unknown" as const;
  }
}
