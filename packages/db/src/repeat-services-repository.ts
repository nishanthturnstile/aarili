import {
  type ServiceRepeatRef,
  serviceRepeatRefSchema,
} from "@aarili/contracts/small-services";
import { draftRepository } from "./draft-repository.js";
import { sql, type Transaction } from "./index.js";
import type { SmallServicesRepository } from "./repositories/small-services.js";
export function repeatServicesRepository(
  tx: Transaction,
  shopId: string,
): NonNullable<SmallServicesRepository["repeats"]> {
  return {
    drafts: draftRepository(tx, shopId),
    async origin(id) {
      const r = (
        await tx.execute<{ source: unknown }>(
          sql`select source from service_repeat_origin where shop_id=${shopId}::uuid and draft_id=${id}::uuid`,
        )
      ).rows[0];
      return r ? serviceRepeatRefSchema.parse(r.source) : undefined;
    },
    async insertOrigin(id, ref: ServiceRepeatRef, payload, key, actor) {
      await tx.execute(
        sql`insert into service_repeat_origin(shop_id,draft_id,source_order_id,source,initial_payload,command_key,actor_id) values(${shopId}::uuid,${id}::uuid,${ref.sourceId}::uuid,${JSON.stringify(ref)}::jsonb,${JSON.stringify(payload)}::jsonb,${key}::uuid,${actor}::uuid)`,
      );
      for (const [position, s] of ref.selections.entries())
        await tx.execute(
          sql`insert into service_repeat_selection(shop_id,draft_id,position,source_order_id,kind,standalone_line_id,addition_line_id,change_id,piece_id,addon_key,catalogue_entry_id,catalogue_revision_id,target_line_id,content) values(${shopId}::uuid,${id}::uuid,${position},${ref.sourceId}::uuid,${s.kind},${s.kind === "standalone" ? s.lineId : null}::uuid,${s.kind === "addition" ? s.lineId : null}::uuid,${s.kind === "addition" ? s.sourceId : null}::uuid,${s.pieceId}::uuid,${s.addonKey},${s.catalogueEntryId}::uuid,${s.catalogueRevisionId}::uuid,${s.targetLineId}::uuid,${JSON.stringify(s)}::jsonb)`,
        );
    },
    async link(draftId, orderId) {
      await tx.execute(
        sql`insert into service_repeat_target(shop_id,draft_id,order_id) values(${shopId}::uuid,${draftId}::uuid,${orderId}::uuid)`,
      );
    },
    async links(id, before) {
      const source = (
        await tx.execute<{ id: string }>(
          sql`select o.source_order_id as id from service_repeat_origin o join service_repeat_target t using(shop_id,draft_id) where t.shop_id=${shopId}::uuid and t.order_id=${id}::uuid`,
        )
      ).rows[0];
      const children = (
        await tx.execute<{ id: string }>(
          sql`select t.order_id as id from service_repeat_origin o join service_repeat_target t using(shop_id,draft_id) where o.shop_id=${shopId}::uuid and o.source_order_id=${id}::uuid and (${before ?? null}::uuid is null or t.order_id<${before ?? null}::uuid) order by t.order_id desc limit 26`,
        )
      ).rows;
      return {
        sourceId: source?.id ?? null,
        children: children.map((r) => r.id),
      };
    },
  };
}
