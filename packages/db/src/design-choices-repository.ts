import {
  designChoicesDefinitionSchema,
  designChoicesRevisionSchema,
} from "@aarili/contracts/design-choices";
import { sql, type Transaction } from "./index.js";
import type { DesignChoicesRepository } from "./repositories/design-choices.js";

export function designChoicesRepository(
  tx: Transaction,
  shopId: string,
): DesignChoicesRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`e.id,e.entry_id as "entryId",e.version,e.previous_id as "previousId",e.actor_id as "actorId",e.effective_at as "effectiveAt",e.origin_draft_id as "originDraftId",e.schema_version as "schemaVersion",e.available,e.reason,e.operation,jsonb_build_object('id',d.id,'entryId',d.entry_id,'content',d.content,'authority',d.authority,'contentHash',d.content_hash) as definition`;
  const from = sql`design_config_availability e join design_config_revision d on (d.shop_id,d.entry_id,d.id)=(e.shop_id,e.entry_id,e.definition_id)`;
  const row = (r: Record<string, unknown>) =>
    designChoicesRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  const repo: DesignChoicesRepository = {
    async questionSemantics(id) {
      return (
        await tx.execute(
          sql`select content from design_question where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows.map((r) => r.content);
    },
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`designChoices:${shopId}`},0))`,
      );
    },
    async current(entryId) {
      const r = (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.entry_id=${entryId}::uuid and e.id=(select current_change_id from design_config_entry where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async definition(id) {
      const r = (
        await tx.execute(
          sql`select id,entry_id as "entryId",content,authority,content_hash as "contentHash" from design_config_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? designChoicesDefinitionSchema.parse(r) : undefined;
    },
    async list({ terms, before }) {
      return (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.id in(select current_change_id from design_config_entry where shop_id=${shopId}::uuid) and (${before ?? null}::uuid is null or e.entry_id<${before ?? null}::uuid) and (${terms.length}=0 or exists(select 1 from unnest(d.search_keys) s cross join jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) q where position(q in s)>0)) order by e.entry_id desc limit 26`,
        )
      ).rows.map(row);
    },
    async history(entryId, before) {
      return (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.entry_id=${entryId}::uuid and (${before ?? null}::integer is null or e.version<${before ?? null}::integer) order by e.version desc limit 26`,
        )
      ).rows.map(row);
    },
    async codeOwner(kind, code) {
      const r = (
        await tx.execute(
          sql`select entry_id from design_config_entry where shop_id=${shopId}::uuid and kind=${kind} and code=${code}`,
        )
      ).rows[0];
      return r ? String(r.entry_id) : null;
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; definition: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as definition,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("DesignChoices identity unavailable");
      const current = await repo.current(r.entryId);
      const definitionId =
        r.operation === "definition" ? ids.definition : current?.definition.id;
      if (!definitionId) throw Error("DesignChoices definition unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'design-choices.publish','design_config_availability',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.baseVersion + 1, operation: r.operation, kind: r.content.kind, available: r.available })}::jsonb)`,
      );
      if (r.operation === "definition") {
        await tx.execute(
          sql`insert into design_config_revision(shop_id,id,entry_id,content,authority,content_hash,search_keys,actor_id,origin_draft_id) values(${shopId}::uuid,${definitionId}::uuid,${r.entryId}::uuid,${JSON.stringify(r.content)}::jsonb,${r.authority},${r.contentHash},ARRAY(select jsonb_array_elements_text(${JSON.stringify(r.searchKeys)}::jsonb)),${r.actorId}::uuid,${r.originDraftId}::uuid)`,
        );
        if (r.content.category)
          await tx.execute(
            sql`insert into design_config_reference(shop_id,definition_id,role,position,target_entry_id,target_revision_id,optional) values(${shopId}::uuid,${definitionId}::uuid,'category',0,${r.content.category.entryId}::uuid,${r.content.category.revisionId}::uuid,false)`,
          );
        if (r.content.kind === "profile") {
          if (r.content.manifest)
            await tx.execute(
              sql`insert into design_manifest_reference(shop_id,definition_id,entry_id,revision_id) values(${shopId}::uuid,${definitionId}::uuid,${r.content.manifest.entryId}::uuid,${r.content.manifest.revisionId}::uuid)`,
            );
          for (const [position, q] of r.content.questions.entries())
            await tx.execute(
              sql`insert into design_question(shop_id,definition_id,id,position,content) values(${shopId}::uuid,${definitionId}::uuid,${q.id}::uuid,${position},${JSON.stringify(q)}::jsonb)`,
            );
          for (const q of r.content.questions)
            for (const [position, choice] of q.choices.entries())
              await tx.execute(
                sql`insert into design_choice_link(shop_id,definition_id,question_id,position,entry_id,revision_id) values(${shopId}::uuid,${definitionId}::uuid,${q.id}::uuid,${position},${choice.entryId}::uuid,${choice.revisionId}::uuid)`,
              );
          for (const q of r.content.questions)
            for (const [position, w] of q.when.entries())
              await tx.execute(
                sql`insert into design_question_dependency(shop_id,definition_id,question_id,position,parent_id,entry_id,revision_id) values(${shopId}::uuid,${definitionId}::uuid,${q.id}::uuid,${position},${w.questionId}::uuid,${w.choice.entryId}::uuid,${w.choice.revisionId}::uuid)`,
              );
          for (const [position, key] of r.content.templateKeys.entries())
            await tx.execute(
              sql`insert into design_template_link(shop_id,definition_id,position,manifest_id,item_key) values(${shopId}::uuid,${definitionId}::uuid,${position},${r.content.manifest?.revisionId}::uuid,${key})`,
            );
        }
      }
      await tx.execute(
        sql`insert into design_config_availability(shop_id,id,entry_id,definition_id,version,previous_id,actor_id,audit_id,origin_draft_id,operation,available,reason) values(${shopId}::uuid,${ids.id}::uuid,${r.entryId}::uuid,${definitionId}::uuid,${r.baseVersion + 1},${r.baseRevisionId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,${r.operation},${r.available},${r.reason})`,
      );
      const inserted = await repo.read(ids.id);
      if (!inserted) throw Error("DesignChoices publication unavailable");
      return inserted;
    },
    async advance(r, expected) {
      return !!(
        await (expected === 0
          ? tx.execute(
              sql`insert into design_config_entry(shop_id,entry_id,kind,code,current_change_id,version) values(${shopId}::uuid,${r.entryId}::uuid,${r.definition.content.kind},${r.definition.content.code},${r.id}::uuid,${r.version}) on conflict do nothing returning entry_id`,
            )
          : tx.execute(
              sql`update design_config_entry set current_change_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and entry_id=${r.entryId}::uuid and version=${expected} returning entry_id`,
            ))
      ).rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from design_config_availability where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
  return repo;
}
