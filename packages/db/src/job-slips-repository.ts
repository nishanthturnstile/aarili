import {
  jobSlipHistoryEntrySchema,
  jobSlipModelSchema,
} from "@aarili/contracts/job-slips";
import { documentRepository } from "./document-repository.js";
import { sql, type Transaction } from "./index.js";
import type {
  JobSlipBinding,
  JobSlipPurge,
  JobSlipPurgeRepository,
  JobSlipsRepository,
} from "./repositories/job-slips.js";

export function jobSlipsRepository(
  tx: Transaction,
  shopId: string,
): JobSlipsRepository {
  shopId = shopId.toLowerCase();
  return {
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||${shopId},0))`,
      );
    },
    async binding(docId, revision) {
      return (
        await tx.execute<JobSlipBinding>(
          sql`select doc_id as "docId",revision,order_id as "orderId",piece_id as "pieceId",customer_id as "customerId",wearer_id as "wearerId",design_id as "designId",measurement_id as "measurementId",pattern_id as "patternId",source_digest as "sourceDigest",command_hash as "commandHash",model_hash as "modelHash",revoked from job_slip_revision where shop_id=${shopId}::uuid and doc_id=${docId}::uuid and revision=${revision}`,
        )
      ).rows[0];
    },
    async history(scope) {
      const rows = (
        await tx.execute(
          sql`select j.doc_id as "docId",j.revision,j.source_digest as "sourceDigest",j.revoked,d.language,d.model#>>'{issued,at}' as "createdAt" from job_slip_revision j join document_revision d on (d.shop_id,d.doc_id,d.revision)=(j.shop_id,j.doc_id,j.revision) where j.shop_id=${shopId}::uuid and j.order_id=${scope.orderId}::uuid and j.scope_key=${scope.pieceId ?? scope.orderId}::uuid order by j.revision desc limit 25`,
        )
      ).rows;
      // Revoked models have no personal snapshot or issued timestamp; retain the
      // nonpersonal issuance audit time instead of manufacturing historical data.
      const result = [];
      for (const row of rows) {
        const time =
          row.createdAt ??
          (
            await tx.execute(
              sql`select a.occurred_at as at from audit_event a join document_revision d on (d.shop_id,d.issue_action_id)=(a.shop_id,a.id) where d.shop_id=${shopId}::uuid and d.doc_id=${String(row.docId)}::uuid and d.revision=${Number(row.revision)}`,
            )
          ).rows[0]?.at;
        result.push(
          jobSlipHistoryEntrySchema.parse({
            ...row,
            createdAt: new Date(time as string).toISOString(),
          }),
        );
      }
      return result;
    },
    async bind(b) {
      await tx.execute(
        sql`insert into job_slip_revision(shop_id,doc_id,revision,order_id,scope_key,piece_id,customer_id,wearer_id,design_id,measurement_id,pattern_id,source_digest,command_hash,model_hash) values(${shopId}::uuid,${b.docId}::uuid,${b.revision},${b.orderId}::uuid,${b.pieceId ?? b.orderId}::uuid,${b.pieceId}::uuid,${b.customerId}::uuid,${b.wearerId}::uuid,${b.designId}::uuid,${b.measurementId}::uuid,${b.patternId}::uuid,${b.sourceDigest},${b.commandHash},${b.modelHash})`,
      );
    },
    async model(docId, revision) {
      const row = (
        await tx.execute(
          sql`select d.model from document_revision d join job_slip_revision j on (j.shop_id,j.doc_id,j.revision)=(d.shop_id,d.doc_id,d.revision) where j.shop_id=${shopId}::uuid and j.doc_id=${docId}::uuid and j.revision=${revision} and not j.revoked`,
        )
      ).rows[0];
      return row ? jobSlipModelSchema.parse(row.model) : undefined;
    },
  };
}
export function jobSlipPurgeRepository(
  tx: Transaction,
  shopId: string,
): JobSlipPurgeRepository {
  const documents = documentRepository(tx, shopId);
  return {
    lock: () => jobSlipsRepository(tx, shopId).lock(),
    control: () => documents.control(),
    async read(id) {
      return (
        await tx.execute<JobSlipPurge>(
          sql`select id,doc_id as "docId",revision,initiator_id as "initiatorId",restore_epoch as epoch,object_keys as keys from job_slip_purge where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
    },
    async receipts(id) {
      return (
        await tx.execute<{ key: string }>(
          sql`select object_key as key from job_slip_purge_receipt where shop_id=${shopId}::uuid and purge_id=${id}::uuid`,
        )
      ).rows.map((r) => r.key);
    },
    async removed(purgeId, key, actorId) {
      const id = await documents.id();
      await documents.audit({
        id,
        actor: { type: "user", id: actorId },
        action: "job-slip.purge",
        docId: purgeId,
        requestId: id,
        key: id,
      });
      await tx.execute(
        sql`insert into job_slip_purge_receipt(shop_id,purge_id,object_key,audit_id) values(${shopId}::uuid,${purgeId}::uuid,${key},${id}::uuid) on conflict do nothing`,
      );
    },
  };
}
