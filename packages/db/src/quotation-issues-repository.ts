import {
  type QuoteResponseCommand,
  quoteResponseEventSchema,
} from "@aarili/contracts/quotation-issues";
import { documentRepository } from "./document-repository.js";
import { sql, type Transaction } from "./index.js";
import type { JobSlipPurgeRepository } from "./repositories/job-slips.js";
import type {
  QuotationIssuesRepository,
  QuoteIssueBinding,
} from "./repositories/quotation-issues.js";

const columns = sql`doc_id as "docId",revision,proposal_id as "proposalId",number,model_hash as "modelHash",revoked,profile_id as "profileId",validity_policy_id as "validityPolicyId",reason,command_hash as "commandHash",actor_id as "actorId",request_key as key,family_id as "proposalFamilyId"`;
const eventColumns = sql`id,doc_id as "docId",revision,model_hash as "modelHash",previous_id as "previousId",actor_id as "actorId",recorded_at as "recordedAt",value,command_hash as "commandHash"`;
const event = (r: Record<string, unknown>) =>
  quoteResponseEventSchema.parse({
    id: r.id,
    docId: r.docId,
    revision: r.revision,
    modelHash: r.modelHash,
    previousId: r.previousId,
    actorId: r.actorId,
    recordedAt: new Date(r.recordedAt as string).toISOString(),
    value: r.value,
  });
export function quotationIssuesRepository(
  tx: Transaction,
  shopId: string,
): QuotationIssuesRepository {
  shopId = shopId.toLowerCase();
  const documents = documentRepository(tx, shopId);
  return {
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||${shopId},0))`,
      );
    },
    async binding(docId, revision) {
      return (
        await tx.execute<QuoteIssueBinding>(
          sql`select ${columns} from quotation_issue where shop_id=${shopId}::uuid and doc_id=${docId}::uuid and revision=${revision}`,
        )
      ).rows[0];
    },
    async proposal(id) {
      return (
        await tx.execute<QuoteIssueBinding>(
          sql`select ${columns} from quotation_issue where shop_id=${shopId}::uuid and proposal_id=${id}::uuid`,
        )
      ).rows[0];
    },
    async history(familyId) {
      return (
        await tx.execute<QuoteIssueBinding>(
          sql`select ${columns} from quotation_issue where shop_id=${shopId}::uuid and family_id=${familyId}::uuid order by revision desc limit 100`,
        )
      ).rows.map(
        ({ docId, revision, proposalId, number, modelHash, revoked }) => ({
          docId,
          revision,
          proposalId,
          number,
          modelHash,
          revoked,
        }),
      );
    },
    async allocate() {
      await tx.execute(
        sql`insert into quotation_counter(shop_id,last_number) values(${shopId}::uuid,0) on conflict do nothing`,
      );
      const r = (
        await tx.execute<{ n: string }>(
          sql`update quotation_counter set last_number=last_number+1 where shop_id=${shopId}::uuid returning last_number::text as n`,
        )
      ).rows[0];
      if (!r) throw Error("QUOTATION_NUMBER_UNAVAILABLE");
      return `QT-${r.n.padStart(6, "0")}`;
    },
    async bind(b) {
      await tx.execute(
        sql`insert into quotation_issue(shop_id,doc_id,revision,family_id,proposal_id,number,model_hash,command_hash,reason,profile_id,validity_policy_id,actor_id,request_key) values(${shopId}::uuid,${b.docId}::uuid,${b.revision},${b.proposalFamilyId}::uuid,${b.proposalId}::uuid,${b.number},${b.modelHash},${b.commandHash},${b.reason},${b.profileId}::uuid,${b.validityPolicyId}::uuid,${b.actorId}::uuid,${b.key}::uuid)`,
      );
    },
    async events(docId, revision) {
      return (
        await tx.execute(
          sql`select ${eventColumns} from quotation_response where shop_id=${shopId}::uuid and doc_id=${docId}::uuid and revision=${revision} order by sequence`,
        )
      ).rows.map(event);
    },
    async eventByKey(key) {
      const r = (
        await tx.execute(
          sql`select ${eventColumns} from quotation_response where shop_id=${shopId}::uuid and request_key=${key}::uuid`,
        )
      ).rows[0];
      return r
        ? { ...event(r), commandHash: String(r.commandHash) }
        : undefined;
    },
    async respond(v: QuoteResponseCommand, key, commandHash, actorId) {
      const id = await documents.id();
      await documents.audit({
        id,
        actor: { type: "user", id: actorId },
        action: "quotation.response",
        docId: v.docId,
        requestId: key,
        key,
      });
      const rows = await tx.execute(
        sql`insert into quotation_response(shop_id,id,doc_id,revision,model_hash,previous_id,sequence,actor_id,request_key,command_hash,value,audit_id) values(${shopId}::uuid,${id}::uuid,${v.docId}::uuid,${v.revision},${v.modelHash},${v.previousId}::uuid,(select count(*)+1 from quotation_response where shop_id=${shopId}::uuid and doc_id=${v.docId}::uuid and revision=${v.revision}),${actorId}::uuid,${key}::uuid,${commandHash},${JSON.stringify(v.value)}::jsonb,${id}::uuid) returning ${eventColumns}`,
      );
      if (!rows.rows[0]) throw Error("QUOTATION_RESPONSE_UNAVAILABLE");
      return event(rows.rows[0]);
    },
  };
}
export function quotationPurgeRepository(
  tx: Transaction,
  shopId: string,
): JobSlipPurgeRepository {
  const documents = documentRepository(tx, shopId);
  return {
    lock: () => quotationIssuesRepository(tx, shopId).lock(),
    control: () => documents.control(),
    async read(id) {
      return (
        await tx.execute<{
          id: string;
          docId: string;
          revision: number;
          initiatorId: string;
          epoch: string;
          keys: string[];
        }>(
          sql`select id,doc_id as "docId",revision,initiator_id as "initiatorId",restore_epoch as epoch,object_keys as keys from quotation_purge where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
    },
    async receipts(id) {
      return (
        await tx.execute<{ key: string }>(
          sql`select object_key as key from quotation_purge_receipt where shop_id=${shopId}::uuid and purge_id=${id}::uuid`,
        )
      ).rows.map((r) => r.key);
    },
    async removed(purgeId, key, actorId) {
      const id = await documents.id();
      await documents.audit({
        id,
        actor: { type: "user", id: actorId },
        action: "quotation.purge",
        docId: purgeId,
        requestId: id,
        key: id,
      });
      await tx.execute(
        sql`insert into quotation_purge_receipt(shop_id,purge_id,object_key,audit_id) values(${shopId}::uuid,${purgeId}::uuid,${key},${id}::uuid) on conflict do nothing`,
      );
    },
  };
}
