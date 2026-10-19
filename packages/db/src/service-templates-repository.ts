import {
  presentationRevisionSchema,
  serviceTemplatesDefinitionSchema,
  serviceTemplatesRevisionSchema,
  templateSections,
} from "@aarili/contracts/service-templates";
import { sql, type Transaction } from "./index.js";
import type { ServiceTemplatesRepository } from "./repositories/service-templates.js";
export function serviceTemplatesRepository(
  tx: Transaction,
  shopId: string,
): ServiceTemplatesRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`e.id,e.entry_id as "entryId",e.version,e.previous_id as "previousId",e.actor_id as "actorId",e.effective_at as "effectiveAt",e.origin_draft_id as "originDraftId",e.schema_version as "schemaVersion",e.available,e.reason,e.operation,jsonb_build_object('id',d.id,'entryId',d.entry_id,'content',d.content,'authority',d.authority,'contentHash',d.content_hash) as definition`;
  const from = sql`service_template_availability e join service_template_revision d on (d.shop_id,d.entry_id,d.id)=(e.shop_id,e.entry_id,e.definition_id)`;
  const row = (r: Record<string, unknown>) =>
    serviceTemplatesRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  const repo: ServiceTemplatesRepository = {
    async presentationCurrent() {
      const r = (
        await tx.execute(
          sql`select r.* from shop_presentation_revision r join shop_presentation p on (p.shop_id,p.current_id)=(r.shop_id,r.id) where r.shop_id=${shopId}::uuid`,
        )
      ).rows[0];
      return r ? presentationRow(r) : undefined;
    },
    async presentationHistory(before) {
      return (
        await tx.execute(
          sql`select * from shop_presentation_revision where shop_id=${shopId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(presentationRow);
    },
    async presentationRead(id) {
      const r = (
        await tx.execute(
          sql`select * from shop_presentation_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? presentationRow(r) : undefined;
    },
    async presentationAppend(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Presentation identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'shop-presentation.publish','shop_presentation_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ mode: r.mode, version: r.baseVersion + 1 })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into shop_presentation_revision(shop_id,id,version,previous_id,mode,reason,actor_id,audit_id,origin_draft_id) values(${shopId}::uuid,${ids.id}::uuid,${r.baseVersion + 1},${r.baseRevisionId}::uuid,${r.mode},${r.reason},${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid)`,
      );
      const revision = await repo.presentationRead(ids.id);
      if (!revision) throw Error("Presentation publication unavailable");
      return revision;
    },
    async presentationAdvance(r, expected) {
      return !!(
        await (expected === 0
          ? tx.execute(
              sql`insert into shop_presentation(shop_id,current_id,version) values(${shopId}::uuid,${r.id}::uuid,${r.version}) on conflict do nothing returning shop_id`,
            )
          : tx.execute(
              sql`update shop_presentation set current_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and version=${expected} returning shop_id`,
            ))
      ).rowCount;
    },
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`serviceTemplates:${shopId}`},0))`,
      );
    },
    async current(entryId) {
      const r = (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.entry_id=${entryId}::uuid and e.id=(select current_change_id from service_template_entry where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid)`,
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
          sql`select id,entry_id as "entryId",content,authority,content_hash as "contentHash" from service_template_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? serviceTemplatesDefinitionSchema.parse(r) : undefined;
    },
    async list({ terms, before }) {
      return (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.id in(select current_change_id from service_template_entry where shop_id=${shopId}::uuid) and (${before ?? null}::uuid is null or e.entry_id<${before ?? null}::uuid) and (${terms.length}=0 or exists(select 1 from unnest(d.search_keys) s cross join jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) q where position(q in s)>0)) order by e.entry_id desc limit 26`,
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
          sql`select entry_id from service_template_entry where shop_id=${shopId}::uuid and kind=${kind} and code=${code}`,
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
      if (!ids) throw Error("ServiceTemplate identity unavailable");
      const current = await repo.current(r.entryId);
      const definitionId =
        r.operation === "definition" ? ids.definition : current?.definition.id;
      if (!definitionId) throw Error("ServiceTemplate definition unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'service-templates.publish','service_template_availability',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.baseVersion + 1, operation: r.operation, kind: r.content.kind, available: r.available })}::jsonb)`,
      );
      if (r.operation === "definition") {
        await tx.execute(
          sql`insert into service_template_revision(shop_id,id,entry_id,content,authority,content_hash,search_keys,actor_id,origin_draft_id) values(${shopId}::uuid,${definitionId}::uuid,${r.entryId}::uuid,${JSON.stringify(r.content)}::jsonb,${r.authority},${r.contentHash},ARRAY(select jsonb_array_elements_text(${JSON.stringify(r.searchKeys)}::jsonb)),${r.actorId}::uuid,${r.originDraftId}::uuid)`,
        );
        const refs = [
          ...(r.content.service
            ? [{ ...r.content.service, role: "service", position: 0 }]
            : []),
          ...r.content.pieces.map((x, position) => ({
            ...x,
            role: "piece",
            position,
          })),
          ...r.content.addons.map((x, position) => ({
            ...x,
            role: "addon",
            position,
          })),
        ];
        for (const ref of refs)
          await tx.execute(
            sql`insert into service_template_reference(shop_id,definition_id,role,position,target_entry_id,target_revision_id) values(${shopId}::uuid,${definitionId}::uuid,${ref.role},${ref.position},${ref.entryId}::uuid,${ref.revisionId}::uuid)`,
          );
        for (const [position, f] of r.content.forms.entries())
          await tx.execute(
            sql`insert into service_template_form(shop_id,definition_id,position,piece_key,form_entry_id,form_revision_id) values(${shopId}::uuid,${definitionId}::uuid,${position},${f.pieceKey},${f.entryId}::uuid,${f.revisionId}::uuid)`,
          );
        for (const name of templateSections)
          for (const [position, item] of r.content[name].entries())
            await tx.execute(
              sql`insert into service_template_item(shop_id,definition_id,section,item_key,position,content) values(${shopId}::uuid,${definitionId}::uuid,${name},${item.key},${position},${JSON.stringify(item)}::jsonb)`,
            );
        for (const t of r.content.tasks)
          for (const predecessor of t.predecessors)
            await tx.execute(
              sql`insert into service_template_edge(shop_id,definition_id,task_key,predecessor_key) values(${shopId}::uuid,${definitionId}::uuid,${t.key},${predecessor})`,
            );
        for (const q of r.content.quality)
          for (const task of q.taskKeys)
            await tx.execute(
              sql`insert into service_template_quality_task(shop_id,definition_id,quality_key,task_key) values(${shopId}::uuid,${definitionId}::uuid,${q.key},${task})`,
            );
      }
      await tx.execute(
        sql`insert into service_template_availability(shop_id,id,entry_id,definition_id,version,previous_id,actor_id,audit_id,origin_draft_id,operation,available,reason) values(${shopId}::uuid,${ids.id}::uuid,${r.entryId}::uuid,${definitionId}::uuid,${r.baseVersion + 1},${r.baseRevisionId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,${r.operation},${r.available},${r.reason})`,
      );
      const inserted = await repo.read(ids.id);
      if (!inserted) throw Error("ServiceTemplate publication unavailable");
      return inserted;
    },
    async advance(r, expected) {
      return !!(
        await (expected === 0
          ? tx.execute(
              sql`insert into service_template_entry(shop_id,entry_id,kind,code,current_change_id,version) values(${shopId}::uuid,${r.entryId}::uuid,${r.definition.content.kind},${r.definition.content.code},${r.id}::uuid,${r.version}) on conflict do nothing returning entry_id`,
            )
          : tx.execute(
              sql`update service_template_entry set current_change_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and entry_id=${r.entryId}::uuid and version=${expected} returning entry_id`,
            ))
      ).rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from service_template_availability where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
  return repo;
}
function presentationRow(r: Record<string, unknown>) {
  return presentationRevisionSchema.parse({
    id: r.id,
    version: r.version,
    previousId: r.previous_id,
    mode: r.mode,
    reason: r.reason,
    actorId: r.actor_id,
    effectiveAt: new Date(r.effective_at as string).toISOString(),
    originDraftId: r.origin_draft_id,
  });
}
