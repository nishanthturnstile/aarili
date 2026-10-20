import {
  bookingRecordSchema,
  bookingRevisionSchema,
} from "@aarili/contracts/orders";
import { sql, type Transaction } from "./index.js";
import type { BookingsRepository } from "./repositories/orders.js";

export function bookingsRepository(
  tx: Transaction,
  shopId: string,
): BookingsRepository {
  const revision = (r: Record<string, unknown>) =>
    bookingRevisionSchema.parse({
      id: r.id,
      bookingId: r.booking_id,
      version: r.version,
      originDraftId: r.origin_draft_id,
      context: r.context,
      sources: r.sources,
      actorId: r.actor_id,
      recordedAt: new Date(r.recorded_at as string).toISOString(),
      reason: r.reason,
    });
  const select = sql`select b.id as booking_id,b.code,b.customer_id,b.version as booking_version,r.* from booking b join booking_revision r on r.shop_id=b.shop_id and r.id=b.current_revision_id`;
  const record = (r: Record<string, unknown>) =>
    bookingRecordSchema.parse({
      id: r.booking_id,
      code: r.code,
      customerId: r.customer_id,
      version: r.booking_version,
      revision: revision(r),
    });
  return {
    async lock(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`booking:${shopId}:${id}`},0))`,
      );
    },
    async read(id, byRevision = false) {
      const row = (
        await tx.execute(
          sql`${select} where b.shop_id=${shopId}::uuid and ${byRevision ? sql`exists(select 1 from booking_revision x where x.shop_id=b.shop_id and x.booking_id=b.id and x.id=${id}::uuid)` : sql`b.id=${id}::uuid`}`,
        )
      ).rows[0];
      return row ? record(row) : undefined;
    },
    async list(before) {
      return (
        await tx.execute(
          sql`${select} where b.shop_id=${shopId}::uuid and (${before ?? null}::uuid is null or b.id<${before ?? null}::uuid) order by b.id desc limit 26`,
        )
      ).rows.map(record);
    },
    async history(id, before) {
      return (
        await tx.execute(
          sql`select * from booking_revision where shop_id=${shopId}::uuid and booking_id=${id}::uuid and (${before ?? null}::integer is null or version<${before ?? null}) order by version desc limit 26`,
        )
      ).rows.map(revision);
    },
    async membership(id) {
      return (
        await tx.execute<{ booking_id: string }>(
          sql`select booking_id from booking_member where shop_id=${shopId}::uuid and order_id=${id}::uuid`,
        )
      ).rows[0]?.booking_id;
    },
    async origin(id, draftId) {
      return (
        (
          await tx.execute(
            sql`select 1 from booking_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
          )
        ).rows.length === 1
      );
    },
    async write(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() id,uuidv7() audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Booking identity unavailable");
      let bookingId = v.draft.target?.id;
      const version = (v.draft.target?.version ?? 0) + 1;
      if (!bookingId) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`booking-code:${shopId}`},0))`,
        );
        const b = (
          await tx.execute<{ id: string }>(
            sql`insert into booking(shop_id,id,code_number,code,customer_id,origin_draft_id,version,current_revision_id) select ${shopId}::uuid,uuidv7(),n,'BK-'||lpad(n::text,greatest(6,length(n::text)),'0'),${v.draft.customerId}::uuid,${v.draftId}::uuid,1,${ids.id}::uuid from (select coalesce(max(code_number),0)+1 n from booking where shop_id=${shopId}::uuid) x returning id`,
          )
        ).rows[0];
        if (!b) throw Error("Booking unavailable");
        bookingId = b.id;
      }
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,'booking.revise','booking',${bookingId}::uuid,${v.requestId}::uuid,${v.key}::uuid,${v.draft.reason},${JSON.stringify({ version, originDraftId: v.draftId, addedOrderIds: v.draft.orders.map((o) => o.id) })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into booking_revision(shop_id,id,booking_id,version,origin_draft_id,context,sources,payer_id,actor_id,audit_id,reason) values(${shopId}::uuid,${ids.id}::uuid,${bookingId}::uuid,${version},${v.draftId}::uuid,${JSON.stringify(v.draft.context)}::jsonb,${JSON.stringify(v.sources)}::jsonb,${v.draft.context.payerId}::uuid,${v.actorId}::uuid,${ids.audit}::uuid,${v.draft.reason})`,
      );
      for (const o of v.draft.orders) {
        await tx.execute(
          sql`insert into booking_member(shop_id,booking_id,order_id,source_version,source_digest,revision_id) values(${shopId}::uuid,${bookingId}::uuid,${o.id}::uuid,${o.version},${o.snapshotDigest},${ids.id}::uuid)`,
        );
        await tx.execute(
          sql`insert into booking_membership_history(shop_id,booking_id,order_id,revision_id) values(${shopId}::uuid,${bookingId}::uuid,${o.id}::uuid,${ids.id}::uuid)`,
        );
      }
      if (v.draft.target)
        await tx.execute(
          sql`update booking set version=${version},current_revision_id=${ids.id}::uuid where shop_id=${shopId}::uuid and id=${bookingId}::uuid and version=${v.draft.target.version}`,
        );
      const row = (
        await tx.execute(
          sql`select * from booking_revision where shop_id=${shopId}::uuid and id=${ids.id}::uuid`,
        )
      ).rows[0];
      if (!row) throw Error("Booking revision unavailable");
      return revision(row);
    },
  };
}
