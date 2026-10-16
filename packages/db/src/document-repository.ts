import type { DocumentShareEvent } from "@aarili/contracts/documents";
import { sql, type Transaction } from "./index.js";
import type {
  DocumentAttempt,
  DocumentOutput,
  DocumentRepository,
  DocumentRevision,
} from "./repositories/documents.js";
import { requestRepository } from "./request-repository.js";
import { restoreRepository } from "./restore-repository.js";

const revisionColumns = sql`doc_id as "docId",revision,creator_id as "creatorId",template,template_revision as "templateRevision",font_revision as "fontRevision",template_hash as "templateHash",language,paper,model,model_hash as "modelHash",request_key as "requestKey",request_hash as "requestHash",issue_action_id as "issueActionId"`;
const outputColumns = sql`id,doc_id as "docId",revision,fence,object_key as key,sha256,bytes,created_at as "createdAt"`;
const shareColumns = sql`id,kind,actor_id as "actorId",created_at as "createdAt",prepared_id as "preparedId",sha256`;
function shareEvent(row: Record<string, unknown>): DocumentShareEvent {
  return {
    ...row,
    createdAt: new Date(row.createdAt as string).toISOString(),
  } as DocumentShareEvent;
}
function output(row: Record<string, unknown>): DocumentOutput {
  return {
    ...row,
    createdAt: new Date(row.createdAt as string).toISOString(),
  } as DocumentOutput;
}
export function documentRepository(
  tx: Transaction,
  shopId: string,
): DocumentRepository {
  shopId = shopId.toLowerCase();
  return {
    ...requestRepository(tx, shopId),
    async shareByKey(key) {
      const r = await tx.execute(
        sql`select ${shareColumns},request_hash as "requestHash" from document_share_event where shop_id=${shopId}::uuid and request_key=${key}::uuid`,
      );
      const row = r.rows[0];
      return row
        ? { ...shareEvent(row), requestHash: row.requestHash as string }
        : undefined;
    },
    async shares(id, revision) {
      const r = await tx.execute(
        sql`select ${shareColumns} from document_share_event where shop_id=${shopId}::uuid and doc_id=${id}::uuid and revision=${revision} order by created_at desc,id desc limit 50`,
      );
      return r.rows.map(shareEvent);
    },
    async share(id, docId, revision) {
      const r = await tx.execute(
        sql`select ${shareColumns} from document_share_event where shop_id=${shopId}::uuid and id=${id}::uuid and doc_id=${docId}::uuid and revision=${revision}`,
      );
      return r.rows[0] ? shareEvent(r.rows[0]) : undefined;
    },
    async appendShare(docId, revision, e, key, hash) {
      await tx.execute(
        sql`insert into document_share_event(shop_id,id,doc_id,revision,kind,actor_id,created_at,prepared_id,sha256,request_key,request_hash) values(${shopId}::uuid,${e.id}::uuid,${docId}::uuid,${revision},${e.kind},${e.actorId}::uuid,${e.createdAt}::timestamptz,${e.preparedId}::uuid,${e.sha256},${key}::uuid,${hash})`,
      );
    },
    async id() {
      const r = await tx.execute<{ id: string }>(sql`select uuidv7() as id`);
      if (!r.rows[0]) throw Error("Document identity unavailable");
      return r.rows[0].id;
    },
    async now() {
      const r = await tx.execute<{ now: Date }>(
        sql`select clock_timestamp() as now`,
      );
      return new Date(r.rows[0]?.now ?? NaN);
    },
    async lock(id, revision) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:document:'||${shopId}||':'||${id.toLowerCase()}||':'||${String(revision)},0))`,
      );
    },
    control: () => restoreRepository(tx, shopId).lockState(),
    async read(id, revision) {
      const r = await tx.execute<DocumentRevision>(
        sql`select ${revisionColumns} from document_revision where shop_id=${shopId}::uuid and doc_id=${id}::uuid and revision=${revision}`,
      );
      return r.rows[0];
    },
    async issuedByKey(key) {
      const r = await tx.execute<DocumentRevision>(
        sql`select ${revisionColumns} from document_revision where shop_id=${shopId}::uuid and request_key=${key}::uuid`,
      );
      return r.rows[0];
    },
    async attempt(id, revision) {
      const r = await tx.execute(
        sql`select doc_id as "docId",revision,job_id as "jobId",initiator_id as "initiatorId",restore_epoch as epoch,state,version,fence,lease_until as "leaseUntil" from document_attempt where shop_id=${shopId}::uuid and doc_id=${id}::uuid and revision=${revision}`,
      );
      const a = r.rows[0];
      return a
        ? ({
            ...a,
            leaseUntil: a.leaseUntil
              ? new Date(a.leaseUntil as string).toISOString()
              : null,
          } as DocumentAttempt)
        : undefined;
    },
    async artifact(id, revision) {
      const r = await tx.execute(
        sql`select ${outputColumns} from document_output where shop_id=${shopId}::uuid and id=(select output_id from document_artifact where shop_id=${shopId}::uuid and doc_id=${id}::uuid and revision=${revision})`,
      );
      return r.rows[0] ? output(r.rows[0]) : undefined;
    },
    async issue(d, a) {
      await tx.execute(
        sql`insert into document_revision(shop_id,doc_id,revision,creator_id,template,template_revision,font_revision,template_hash,language,paper,model,model_hash,request_key,request_hash,issue_action_id) values(${shopId}::uuid,${d.docId}::uuid,${d.revision},${d.creatorId}::uuid,${d.template},${d.templateRevision},${d.fontRevision},${d.templateHash},${d.language},${d.paper},${JSON.stringify(d.model)}::jsonb,${d.modelHash},${d.requestKey}::uuid,${d.requestHash},${d.issueActionId}::uuid)`,
      );
      await tx.execute(
        sql`insert into document_attempt(shop_id,doc_id,revision,job_id,initiator_id,restore_epoch,state) values(${shopId}::uuid,${d.docId}::uuid,${d.revision},${a.jobId}::uuid,${a.initiatorId}::uuid,${a.epoch}::uuid,'pending')`,
      );
    },
    async claim(a, fence, until) {
      await tx.execute(
        sql`update document_attempt set state='rendering',version=version+1,fence=${fence}::uuid,lease_until=${until}::timestamptz where shop_id=${shopId}::uuid and doc_id=${a.docId}::uuid and revision=${a.revision} and job_id=${a.jobId}::uuid`,
      );
    },
    async failed(a, fence) {
      await tx.execute(
        sql`update document_attempt set state='failed',version=version+1,lease_until=clock_timestamp() where shop_id=${shopId}::uuid and doc_id=${a.docId}::uuid and revision=${a.revision} and job_id=${a.jobId}::uuid and fence=${fence}::uuid and state='rendering'`,
      );
    },
    async retry(a, jobId, epoch) {
      await tx.execute(
        sql`update document_attempt set state='pending',version=version+1,job_id=${jobId}::uuid,restore_epoch=${epoch}::uuid,fence=null,lease_until=null where shop_id=${shopId}::uuid and doc_id=${a.docId}::uuid and revision=${a.revision}`,
      );
    },
    async plan(o) {
      await tx.execute(
        sql`insert into document_output(shop_id,id,doc_id,revision,fence,object_key,sha256,bytes) values(${shopId}::uuid,${o.id}::uuid,${o.docId}::uuid,${o.revision},${o.fence}::uuid,${o.key},${o.sha256},${o.bytes})`,
      );
    },
    async accept(a, o) {
      await tx.execute(
        sql`update document_attempt set state='ready',version=version+1 where shop_id=${shopId}::uuid and doc_id=${a.docId}::uuid and revision=${a.revision} and job_id=${a.jobId}::uuid and fence=${o.fence}::uuid and state='rendering'`,
      );
      await tx.execute(
        sql`insert into document_artifact(shop_id,doc_id,revision,output_id,action_id) values(${shopId}::uuid,${a.docId}::uuid,${a.revision},${o.id}::uuid,${o.id}::uuid)`,
      );
    },
    async outputs(id, revision, after) {
      const cursor = after ? sql`and id>${after}::uuid` : sql``;
      const r = await tx.execute(
        sql`select ${outputColumns} from document_output where shop_id=${shopId}::uuid and doc_id=${id}::uuid and revision=${revision} ${cursor} order by id limit 21`,
      );
      return r.rows.map(output);
    },
    async output(id) {
      const r = await tx.execute(
        sql`select ${outputColumns} from document_output where shop_id=${shopId}::uuid and id=${id}::uuid`,
      );
      return r.rows[0] ? output(r.rows[0]) : undefined;
    },
    async cleanupIntent(outputId, id, epoch) {
      const r = await tx.execute(
        sql`insert into document_cleanup(shop_id,id,output_id,restore_epoch) values(${shopId}::uuid,${id}::uuid,${outputId}::uuid,${epoch}::uuid) on conflict(shop_id,output_id,restore_epoch) where completed_at is null do nothing returning id`,
      );
      return !!r.rowCount;
    },
    async cleanups(id, revision, epoch) {
      const r = await tx.execute<{
        id: string;
        outputId: string;
        epoch: string;
      }>(
        sql`select c.id,c.output_id as "outputId",c.restore_epoch as epoch from document_cleanup c join document_output o on o.shop_id=c.shop_id and o.id=c.output_id where c.shop_id=${shopId}::uuid and o.doc_id=${id}::uuid and o.revision=${revision} and c.restore_epoch=${epoch}::uuid and c.completed_at is null and not exists(select 1 from document_artifact a join document_output kept on kept.shop_id=a.shop_id and kept.id=a.output_id where a.shop_id=o.shop_id and a.doc_id=o.doc_id and a.revision=o.revision and kept.object_key=o.object_key) order by o.created_at,c.id limit 20`,
      );
      return r.rows;
    },
    async cleaned(id, actionId) {
      await tx.execute(
        sql`update document_cleanup set completed_at=clock_timestamp(),completion_action_id=${actionId}::uuid where shop_id=${shopId}::uuid and id=${id}::uuid and completed_at is null`,
      );
    },
    async audit(e) {
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${e.id}::uuid,${e.actor.type},${e.actor.id}::uuid,${e.action},'document_revision',${e.docId}::uuid,${e.requestId}::uuid,${e.key}::uuid,'{}'::jsonb)`,
      );
    },
  };
}
