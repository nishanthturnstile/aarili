import {
  materialLabelHistorySchema,
  materialLabelModelSchema,
} from "@aarili/contracts/material-labels";
import { sql, type Transaction } from "./index.js";
import type {
  MaterialLabelBinding,
  MaterialLabelSource,
  MaterialLabelsRepository,
} from "./repositories/material-labels.js";
export function materialLabelsRepository(
  tx: Transaction,
  shopId: string,
): MaterialLabelsRepository {
  return {
    async candidateOrderIds(before) {
      return (
        await tx.execute<{ id: string }>(
          sql`select id from garment_order where shop_id=${shopId}::uuid and (${before ?? null}::uuid is null or id<${before ?? null}::uuid) order by id desc limit 21`,
        )
      ).rows.map((r) => r.id);
    },
    async pieceIds(orderId) {
      return (
        await tx.execute<{ id: string }>(
          sql`select id from order_piece where shop_id=${shopId}::uuid and order_id=${orderId}::uuid and content->>'applicability'='applicable' order by source_key`,
        )
      ).rows.map((r) => r.id);
    },
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||${shopId},0))`,
      );
    },
    async lockOrders(ids) {
      for (const id of [...new Set(ids)].sort())
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('order:'||${shopId}||':'||${id},0))`,
        );
    },
    async source(orderId, pieceId) {
      // Select only controlled scalar names, identity and provenance. Never fetch snapshot JSON.
      const row = (
        await tx.execute<MaterialLabelSource>(
          sql`select o.id as "orderId",${pieceId}::uuid as "pieceId",o.customer_id as "customerId",o.wearer_id as "wearerId",o.intake_kind as kind,o.version,s.digest,o.code as "orderCode",jsonb_build_object('en',case when o.intake_kind='service' then s.content#>>'{service,profile,content,labelEn}' else s.content#>>'{requirements,definition,labelEn}' end,'ta',case when o.intake_kind='service' then s.content#>>'{service,profile,content,labelTa}' else s.content#>>'{requirements,definition,labelTa}' end) as garment,case when p.id is null then null else jsonb_build_object('en',p.content->>'labelEn','ta',p.content->>'labelTa') end as "pieceName",sp.source_order_id as "sourceOrderId",sp.source_piece_id as "sourcePieceId" from garment_order o join order_acceptance_snapshot s on (s.shop_id,s.order_id)=(o.shop_id,o.id) left join order_piece p on p.shop_id=o.shop_id and p.order_id=o.id and p.id=${pieceId}::uuid left join service_property_subject sp on (sp.shop_id,sp.order_id)=(o.shop_id,o.id) where o.shop_id=${shopId}::uuid and o.id=${orderId}::uuid and (${pieceId}::uuid is null or (p.id is not null and p.content->>'applicability'='applicable'))`,
        )
      ).rows[0];
      return row;
    },
    async binding(docId, revision) {
      return (
        await tx.execute<MaterialLabelBinding>(
          sql`select doc_id as "docId",revision,selection_hash as "selectionHash",source_digest as "sourceDigest",command_hash as "commandHash",model_hash as "modelHash",revoked from material_label_revision where shop_id=${shopId}::uuid and doc_id=${docId}::uuid and revision=${revision}`,
        )
      ).rows[0];
    },
    async members(docId, revision) {
      const rows = (
        await tx.execute<{
          orderId: string;
          pieceId: string | null;
          customerId: string;
          wearerId: string | null;
        }>(
          sql`select order_id as "orderId",piece_id as "pieceId",customer_id as "customerId",wearer_id as "wearerId" from material_label_member where shop_id=${shopId}::uuid and doc_id=${docId}::uuid and revision=${revision} order by position`,
        )
      ).rows;
      const result: MaterialLabelSource[] = [];
      for (const row of rows) {
        const source = await this.source(row.orderId, row.pieceId);
        if (
          !source ||
          source.customerId !== row.customerId ||
          source.wearerId !== row.wearerId
        )
          return [];
        result.push(source);
      }
      return result;
    },
    async history(selectionHash) {
      const rows = (
        await tx.execute(
          sql`select j.doc_id as "docId",j.revision,j.source_digest as "sourceDigest",j.revoked,d.language,a.occurred_at as "createdAt" from material_label_revision j join document_revision d on (d.shop_id,d.doc_id,d.revision)=(j.shop_id,j.doc_id,j.revision) join audit_event a on (a.shop_id,a.id)=(d.shop_id,d.issue_action_id) where j.shop_id=${shopId}::uuid and j.selection_hash=${selectionHash} order by j.revision desc limit 25`,
        )
      ).rows;
      return rows.map((r) =>
        materialLabelHistorySchema.parse({
          ...r,
          createdAt: new Date(r.createdAt as string).toISOString(),
        }),
      );
    },
    async bind(b, selections, sources) {
      await tx.execute(
        sql`insert into material_label_revision(shop_id,doc_id,revision,selection_hash,source_digest,command_hash,model_hash) values(${shopId}::uuid,${b.docId}::uuid,${b.revision},${b.selectionHash},${b.sourceDigest},${b.commandHash},${b.modelHash})`,
      );
      for (const [position, s] of sources.entries()) {
        const selection = selections[position];
        if (!selection) throw Error("Label selection unavailable");
        await tx.execute(
          sql`insert into material_label_member(shop_id,doc_id,revision,position,order_id,piece_id,customer_id,wearer_id,copies,source_digest) values(${shopId}::uuid,${b.docId}::uuid,${b.revision},${position},${s.orderId}::uuid,${s.pieceId}::uuid,${s.customerId}::uuid,${s.wearerId}::uuid,${selection.copies},${s.digest})`,
        );
      }
    },
    async model(docId, revision) {
      const row = (
        await tx.execute(
          sql`select d.model from document_revision d join material_label_revision j on (j.shop_id,j.doc_id,j.revision)=(d.shop_id,d.doc_id,d.revision) where j.shop_id=${shopId}::uuid and j.doc_id=${docId}::uuid and j.revision=${revision} and not j.revoked`,
        )
      ).rows[0];
      return row ? materialLabelModelSchema.parse(row.model) : undefined;
    },
  };
}
