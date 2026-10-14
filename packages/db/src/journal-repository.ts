import { fromPostgresBigint, toPostgresBigint } from "@aarili/money";
import { sql, type Transaction } from "./index.js";
import type {
  JournalAccount,
  JournalBatch,
  JournalBinding,
  JournalRepository,
} from "./repositories/journal.js";

export function journalRepository(
  tx: Transaction,
  shopId: string,
): JournalRepository {
  async function read(id: string): Promise<JournalBatch | undefined> {
    const row = (
      await tx.execute<{
        id: string;
        sourceId: string;
        subjectId: string;
        kind: JournalBatch["kind"];
        relatedId: string | null;
        reason: string;
        actorId: string;
        hash: string;
        eventId: string;
      }>(
        sql`select id,source_id as "sourceId",subject_id as "subjectId",kind,related_id as "relatedId",reason,actor_id as "actorId",request_hash as hash,audit_id as "eventId" from journal_batch where shop_id=${shopId}::uuid and id=${id}::uuid`,
      )
    ).rows[0];
    if (!row) return undefined;
    const entries = (
      await tx.execute<{ account: JournalAccount; amount: string }>(
        sql`select account,amount_paise as amount from journal_entry where shop_id=${shopId}::uuid and batch_id=${id}::uuid order by account`,
      )
    ).rows.map((e) => ({
      account: e.account,
      amountPaise: fromPostgresBigint(e.amount),
    }));
    return { ...row, entries };
  }
  return {
    read,
    async lockKey(key) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:command:' || ${shopId}::text || ':' || ${key}::text,0))`,
      );
    },
    async lockSubject(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:journal:' || ${shopId}::text || ':' || ${id}::text,0))`,
      );
    },
    async replay(key) {
      const r = (
        await tx.execute<JournalBinding & { id: string }>(
          sql`select actor_id as "actorId", action,request_hash as hash,response->>'id' as id from idempotency_key where shop_id=${shopId}::uuid and key=${key}::uuid`,
        )
      ).rows[0];
      return r;
    },
    async source(id) {
      const r = (
        await tx.execute<{ id: string }>(
          sql`select id from journal_batch where shop_id=${shopId}::uuid and source_id=${id}::uuid`,
        )
      ).rows[0];
      return r ? read(r.id) : undefined;
    },
    async linked(id, kind) {
      return !!(
        await tx.execute(
          sql`select 1 from journal_batch where shop_id=${shopId}::uuid and related_id=${id}::uuid and kind=${kind}`,
        )
      ).rowCount;
    },
    async ids() {
      const r = (
        await tx.execute<{ id: string; eventId: string }>(
          sql`select uuidv7() as id,uuidv7() as "eventId"`,
        )
      ).rows[0];
      if (!r) throw new Error("Journal identifiers unavailable");
      return r;
    },
    async audit(b, key, requestId) {
      await tx.execute(sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes,source_event_id)
        values(${shopId}::uuid,${b.eventId}::uuid,'user',${b.actorId}::uuid,${`journal.${b.kind}`},'journal_batch',${b.id}::uuid,${requestId}::uuid,${key}::uuid,${b.reason},${JSON.stringify({ kind: b.kind, sourceId: b.sourceId })}::jsonb,(select audit_id from journal_batch where shop_id=${shopId}::uuid and id=${b.relatedId}::uuid))`);
    },
    async insertBatch(b, key) {
      return !!(
        await tx.execute(sql`insert into journal_batch(shop_id,id,source_id,subject_id,kind,related_id,reason,actor_id,request_hash,audit_id,command_key,entry_count)
        values(${shopId}::uuid,${b.id}::uuid,${b.sourceId}::uuid,${b.subjectId}::uuid,${b.kind},${b.relatedId}::uuid,${b.reason},${b.actorId}::uuid,${b.hash},${b.eventId}::uuid,${key}::uuid,${b.entries.length}) on conflict(shop_id,source_id) do nothing returning id`)
      ).rowCount;
    },
    async insertEntry(id, e) {
      await tx.execute(
        sql`insert into journal_entry(shop_id,batch_id,account,amount_paise) values(${shopId}::uuid,${id}::uuid,${e.account},${toPostgresBigint(e.amountPaise)}::bigint)`,
      );
    },
    async persist(key, b, id) {
      await tx.execute(
        sql`insert into idempotency_key(shop_id,key,actor_type,actor_id,action,request_hash,status,response) values(${shopId}::uuid,${key}::uuid,'user',${b.actorId}::uuid,${b.action},${b.hash},200,${JSON.stringify({ id })}::jsonb)`,
      );
    },
    async positions(subjectId) {
      const result: Record<JournalAccount, number> = {
        cash: 0,
        receivable: 0,
        revenue: 0,
        deposit: 0,
        refund: 0,
      };
      const rows = (
        await tx.execute<{ account: JournalAccount; amount: string }>(
          sql`select e.account,sum(e.amount_paise)::text as amount from journal_entry e join journal_batch b on b.shop_id=e.shop_id and b.id=e.batch_id where b.shop_id=${shopId}::uuid and b.subject_id=${subjectId}::uuid group by e.account`,
        )
      ).rows;
      for (const r of rows) result[r.account] = fromPostgresBigint(r.amount);
      return result;
    },
  };
}
