import { repeatSourceRefSchema } from "@aarili/contracts/orders";
import { draftRepository } from "./draft-repository.js";
import { sql, type Transaction } from "./index.js";
import type { RepeatOrdersRepository } from "./repositories/orders.js";

export function repeatOrdersRepository(
  tx: Transaction,
  shopId: string,
): RepeatOrdersRepository {
  return {
    drafts: draftRepository(tx, shopId),
    async origin(id) {
      const row = (
        await tx.execute<{ source: unknown }>(
          sql`select source from order_repeat_origin where shop_id=${shopId}::uuid and draft_id=${id}::uuid`,
        )
      ).rows[0];
      return row ? repeatSourceRefSchema.parse(row.source) : undefined;
    },
    async insertOrigin(id, source, key, actorId) {
      await tx.execute(
        sql`insert into order_repeat_origin(shop_id,draft_id,source_order_id,source,command_key,actor_id) values(${shopId}::uuid,${id}::uuid,${source.sourceId}::uuid,${JSON.stringify(source)}::jsonb,${key}::uuid,${actorId}::uuid)`,
      );
    },
    async scope(id) {
      const membership = (
        await tx.execute<{ bookingId: string; bookingVersion: number }>(
          sql`select m.booking_id as "bookingId",b.version as "bookingVersion" from booking_member m join booking b on b.shop_id=m.shop_id and b.id=m.booking_id where m.shop_id=${shopId}::uuid and m.order_id=${id}::uuid`,
        )
      ).rows[0];
      const additions = (
        await tx.execute<{ id: string; version: number; digest: string }>(
          sql`select id,version,digest from order_service_change where shop_id=${shopId}::uuid and order_id=${id}::uuid order by version,id`,
        )
      ).rows;
      return {
        bookingId: membership?.bookingId ?? null,
        bookingVersion: membership?.bookingVersion ?? null,
        additions,
      };
    },
    async link(draftId, orderId) {
      await tx.execute(
        sql`insert into order_repeat_target(shop_id,draft_id,order_id) values(${shopId}::uuid,${draftId}::uuid,${orderId}::uuid)`,
      );
    },
    async links(id, before) {
      const source = (
        await tx.execute<{ id: string }>(
          sql`select o.source_order_id as id from order_repeat_target t join order_repeat_origin o using(shop_id,draft_id) where t.shop_id=${shopId}::uuid and t.order_id=${id}::uuid`,
        )
      ).rows[0];
      const rows = (
        await tx.execute<{ id: string }>(
          sql`select t.order_id as id from order_repeat_origin o join order_repeat_target t using(shop_id,draft_id) where o.shop_id=${shopId}::uuid and o.source_order_id=${id}::uuid and (${before ?? null}::uuid is null or t.order_id<${before ?? null}::uuid) order by t.order_id desc limit 26`,
        )
      ).rows;
      return { sourceId: source?.id ?? null, children: rows.map((r) => r.id) };
    },
  };
}
