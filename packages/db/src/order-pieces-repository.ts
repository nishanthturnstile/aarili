import { orderPiecesSchema } from "@aarili/contracts/orders";
import { sql, type Transaction } from "./index.js";
import type { OrderPiecesRepository } from "./repositories/orders.js";
import { requestRepository } from "./request-repository.js";

export function orderPiecesRepository(
  tx: Transaction,
  shopId: string,
): OrderPiecesRepository {
  return {
    ...requestRepository(tx, shopId),
    async read(orderId) {
      const row = (
        await tx.execute(
          sql`select s.*,o.version as current_version from order_piece_set s join garment_order o on o.shop_id=s.shop_id and o.id=s.order_id where s.shop_id=${shopId}::uuid and s.order_id=${orderId}::uuid`,
        )
      ).rows[0];
      if (!row) return undefined;
      const ids = (
        await tx.execute(
          sql`select source_key as key,id from order_piece where shop_id=${shopId}::uuid and order_id=${orderId}::uuid order by source_key`,
        )
      ).rows;
      return orderPiecesSchema.parse({
        schemaVersion: 1,
        orderId,
        orderVersion: row.current_version,
        snapshotDigest: row.snapshot_digest,
        state: "materialized",
        structure: row.content,
        identities: ids,
        provenance: {
          version: 1,
          actorId: row.actor_id,
          recordedAt: new Date(row.recorded_at as string).toISOString(),
          reason: row.reason,
          digest: row.structure_digest,
        },
        execution: "unavailable",
      });
    },
    async write(v) {
      let audit: string | undefined;
      if (v.acceptance)
        audit = (
          await tx.execute<{ audit_id: string }>(
            sql`select audit_id from garment_order where shop_id=${shopId}::uuid and id=${v.orderId}::uuid`,
          )
        ).rows[0]?.audit_id;
      else {
        audit = (await tx.execute<{ id: string }>(sql`select uuidv7() id`))
          .rows[0]?.id;
        await tx.execute(
          sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes) values(${shopId}::uuid,${audit}::uuid,'user',${v.actorId}::uuid,'order.pieces.materialize','garment_order',${v.orderId}::uuid,${v.requestId}::uuid,${v.key}::uuid,${v.reason},${JSON.stringify({ snapshotDigest: v.snapshotDigest, structureDigest: v.digest })}::jsonb)`,
        );
      }
      if (!audit) throw Error("Piece provenance unavailable");
      await tx.execute(
        sql`insert into order_piece_set(shop_id,order_id,order_version,snapshot_digest,structure_digest,content,actor_id,audit_id,command_key,reason) values(${shopId}::uuid,${v.orderId}::uuid,${v.orderVersion},${v.snapshotDigest},${v.digest},${JSON.stringify(v.structure)}::jsonb,${v.actorId}::uuid,${audit}::uuid,${v.key}::uuid,${v.reason})`,
      );
      for (const p of v.structure.pieces.filter(
        (p) => p.applicability !== "not-applicable",
      ))
        await tx.execute(
          sql`insert into order_piece(shop_id,order_id,source_key,entry_id,revision_id,content) values(${shopId}::uuid,${v.orderId}::uuid,${p.key},${p.entryId}::uuid,${p.revisionId}::uuid,${JSON.stringify(p)}::jsonb)`,
        );
      for (const r of v.structure.requirements)
        await tx.execute(
          sql`insert into order_requirement_scope(shop_id,order_id,position,piece_key,piece_id,addon_key) values(${shopId}::uuid,${v.orderId}::uuid,${r.position},${r.pieceKey},(select id from order_piece where shop_id=${shopId}::uuid and order_id=${v.orderId}::uuid and source_key=${r.pieceKey}),${r.addonKey})`,
        );
    },
  };
}
