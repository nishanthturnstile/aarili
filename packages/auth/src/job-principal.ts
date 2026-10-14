import { sql, type Transaction } from "@aarili/db";

// Current user authority, not autonomous/system admission. Shared row locks
// serialize concurrent verification/membership revocation with the effect.
export async function authorizeJobPrincipal(
  tx: Transaction,
  userId: string,
  shopId: string,
): Promise<boolean> {
  const result = await tx.execute(sql`select 1 from auth_user u
    where u.id=${userId}::uuid and u.email_verified
    and NULLIF(current_setting('app.shop_id',true),'')::uuid=${shopId}::uuid
    and NULLIF(current_setting('app.actor_id',true),'')::uuid=${userId}::uuid for share of u`);
  if (!result.rowCount) return false;
  const member = await tx.execute(sql`select lock_job_membership() as allowed`);
  return member.rows[0]?.allowed === true;
}
