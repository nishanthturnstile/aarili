import { sql, type Transaction } from "./index.js";

export async function identityEvidence(
  tx: Transaction,
  shopId: string,
  auditId: string,
  customerId: string,
  wearerId: string | null,
  revision: { reason: string; previousVersion: number; fields: string[] },
) {
  await tx.execute(
    sql`insert into identity_revision_evidence(shop_id,audit_id,customer_id,wearer_id,previous_version,version,fields,reason) values(${shopId}::uuid,${auditId}::uuid,${customerId}::uuid,${wearerId}::uuid,${revision.previousVersion},${revision.previousVersion + 1},${JSON.stringify(revision.fields)}::jsonb,${revision.reason})`,
  );
}
