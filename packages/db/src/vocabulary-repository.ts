import { vocabularyRevisionSchema } from "@aarili/contracts/vocabulary";
import { sql, type Transaction } from "./index.js";
import type { VocabularyRepository } from "./repositories/vocabulary.js";
export function vocabularyRepository(
  tx: Transaction,
  shopId: string,
): VocabularyRepository {
  shopId = shopId.toLowerCase();
  async function read(id: string) {
    const row = (
      await tx.execute(
        sql`select id,vocabulary_id as "vocabularyId",revision,previous_id as "previousId",label_ta as "labelTa",label_en as "labelEn",aliases,reason,actor_id as "actorId",audit_id as "eventId",algorithm_version as "algorithmVersion" from vocabulary_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
      )
    ).rows[0];
    return row ? vocabularyRevisionSchema.parse(row) : undefined;
  }
  return {
    read,
    async lockKey(key) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:command:' || ${shopId}::text || ':' || ${key}::text,0))`,
      );
    },
    async lockVocabulary(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:vocabulary:' || ${shopId}::text || ':' || ${id}::text,0))`,
      );
    },
    async replay(key) {
      return (
        await tx.execute<{
          actorId: string;
          action: string;
          hash: string;
          response: unknown;
        }>(
          sql`select actor_id as "actorId",action,request_hash as hash,response from idempotency_key where shop_id=${shopId}::uuid and key=${key}::uuid`,
        )
      ).rows[0];
    },
    async current(id) {
      const row = (
        await tx.execute<{ id: string }>(
          sql`select current_revision_id as id from vocabulary where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return row ? read(row.id) : undefined;
    },
    async ids() {
      const row = (
        await tx.execute<{ id: string; eventId: string }>(
          sql`select uuidv7() as id,uuidv7() as "eventId"`,
        )
      ).rows[0];
      if (!row) throw new Error("Vocabulary identifiers unavailable");
      return row;
    },
    async append(r, keys, key, requestId) {
      await tx.execute(sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes,source_event_id)
    values(${shopId}::uuid,${r.eventId}::uuid,'user',${r.actorId}::uuid,'vocabulary.revise','vocabulary_revision',${r.id}::uuid,${requestId}::uuid,${key}::uuid,${r.reason},${JSON.stringify({ revision: r.revision, algorithmVersion: r.algorithmVersion, aliasCount: r.aliases.length })}::jsonb,(select audit_id from vocabulary_revision where shop_id=${shopId}::uuid and id=${r.previousId}::uuid))`);
      await tx.execute(sql`insert into vocabulary_revision(shop_id,id,vocabulary_id,revision,previous_id,label_ta,label_en,aliases,reason,actor_id,audit_id,algorithm_version)
    values(${shopId}::uuid,${r.id}::uuid,${r.vocabularyId}::uuid,${r.revision},${r.previousId}::uuid,${r.labelTa},${r.labelEn},${JSON.stringify(r.aliases)}::jsonb,${r.reason},${r.actorId}::uuid,${r.eventId}::uuid,${r.algorithmVersion})`);
      const originals = [r.labelTa, r.labelEn, ...r.aliases];
      for (const [ordinal, k] of keys.entries())
        await tx.execute(sql`insert into vocabulary_search_key(shop_id,revision_id,algorithm_version,ordinal,original_text,name_ta_norm,name_latin_norm,name_skel)
    values(${shopId}::uuid,${r.id}::uuid,${r.algorithmVersion},${ordinal},${originals[ordinal]},${k.nameTaNorm},${k.nameLatinNorm},${k.nameSkel})`);
    },
    async advance(r, expected) {
      if (expected === null)
        return !!(
          await tx.execute(
            sql`insert into vocabulary(shop_id,id,current_revision_id,version) values(${shopId}::uuid,${r.vocabularyId}::uuid,${r.id}::uuid,${r.revision}) on conflict(shop_id,id) do nothing returning id`,
          )
        ).rowCount;
      return !!(
        await tx.execute(
          sql`update vocabulary set current_revision_id=${r.id}::uuid,version=${r.revision} where shop_id=${shopId}::uuid and id=${r.vocabularyId}::uuid and version=${expected} returning id`,
        )
      ).rowCount;
    },
    async persist(key, binding, response) {
      await tx.execute(
        sql`insert into idempotency_key(shop_id,key,actor_type,actor_id,action,request_hash,status,response) values(${shopId}::uuid,${key}::uuid,'user',${binding.actorId}::uuid,${binding.action},${binding.hash},200,${JSON.stringify(response)}::jsonb)`,
      );
    },
    async resolve(keys) {
      const rows = (
        await tx.execute<{ id: string }>(
          sql`select distinct v.current_revision_id as id from vocabulary v join vocabulary_search_key k on k.shop_id=v.shop_id and k.revision_id=v.current_revision_id where v.shop_id=${shopId}::uuid and k.algorithm_version=1 and ((k.name_ta_norm<>'' and k.name_ta_norm=${keys.nameTaNorm}) or (k.name_latin_norm<>'' and k.name_latin_norm=${keys.nameLatinNorm}) or (k.name_skel<>'' and k.name_skel=${keys.nameSkel})) order by id`,
        )
      ).rows;
      const result = [];
      for (const row of rows) {
        const r = await read(row.id);
        if (r) result.push(r);
      }
      return result;
    },
  };
}
