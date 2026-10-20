import { groupCommercialSchema } from "@aarili/contracts/orders";
import { sql, type Transaction } from "./index.js";
import type { GroupIntakeRepository } from "./repositories/orders.js";
export function groupIntakeRepository(
  tx: Transaction,
  shopId: string,
): GroupIntakeRepository {
  return {
    async identity() {
      const r = (await tx.execute<{ id: string }>(sql`select uuidv7() id`))
        .rows[0];
      if (!r) throw Error("Group identity unavailable");
      return r.id;
    },
    async commercial(bookingId) {
      const r = (
        await tx.execute(
          sql`select id,booking_id as "bookingId",basis,package_paise::text as "packagePaise",scope,actor_id as "actorId",recorded_at as "recordedAt",reason from booking_commercial_revision where shop_id=${shopId}::uuid and booking_id=${bookingId}::uuid`,
        )
      ).rows[0];
      return r
        ? groupCommercialSchema.parse({
            ...r,
            schemaVersion: 2,
            version: 1,
            predecessorId: null,
            allocation: "unresolved",
            recordedAt: new Date(r.recordedAt as string).toISOString(),
          })
        : undefined;
    },
    async writeCommercial(v) {
      const audit = (await tx.execute<{ id: string }>(sql`select uuidv7() id`))
        .rows[0]?.id;
      if (!audit) throw Error("Audit unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes) values(${shopId}::uuid,${audit}::uuid,'user',${v.actorId}::uuid,'booking.commercial.propose','booking',${v.bookingId}::uuid,${v.requestId}::uuid,${v.key}::uuid,${v.reason},${JSON.stringify({ basis: v.basis, commercialVersionId: v.id })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into booking_commercial_revision(shop_id,id,booking_id,origin_draft_id,basis,package_paise,scope,actor_id,audit_id,reason) values(${shopId}::uuid,${v.id}::uuid,${v.bookingId}::uuid,${v.draftId}::uuid,${v.basis},${v.packagePaise}::bigint,${JSON.stringify(v.scope)}::jsonb,${v.actorId}::uuid,${audit}::uuid,${v.reason})`,
      );
    },
    async conversionOrigin(targetId, sourceId) {
      return (
        (
          await tx.execute(
            sql`select 1 from order_draft_conversion where shop_id=${shopId}::uuid and target_draft_id=${targetId}::uuid and source_draft_id=${sourceId}::uuid`,
          )
        ).rows.length === 1
      );
    },
    async convert(v) {
      await tx.execute(
        sql`insert into order_draft_conversion(shop_id,source_draft_id,target_draft_id,line_id,actor_id,command_key,request_id) values(${shopId}::uuid,${v.sourceId}::uuid,${v.targetId}::uuid,${v.lineId}::uuid,${v.actorId}::uuid,${v.key}::uuid,${v.requestId}::uuid)`,
      );
    },
  };
}
