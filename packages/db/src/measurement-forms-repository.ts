import {
  measurementFormsDefinitionSchema,
  measurementFormsRevisionSchema,
} from "@aarili/contracts/measurement-forms";
import { sql, type Transaction } from "./index.js";
import type { MeasurementFormsRepository } from "./repositories/measurement-forms.js";
export function measurementFormsRepository(
  tx: Transaction,
  shopId: string,
): MeasurementFormsRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`e.id,e.entry_id as "entryId",e.version,e.previous_id as "previousId",e.actor_id as "actorId",e.effective_at as "effectiveAt",e.origin_draft_id as "originDraftId",e.schema_version as "schemaVersion",e.available,e.reason,e.operation,jsonb_build_object('id',d.id,'entryId',d.entry_id,'content',d.content,'authority',d.authority,'contentHash',d.content_hash) as definition`;
  const from = sql`measurement_form_availability e join measurement_form_revision d on (d.shop_id,d.entry_id,d.id)=(e.shop_id,e.entry_id,e.definition_id)`;
  const row = (r: Record<string, unknown>) =>
    measurementFormsRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  const repo: MeasurementFormsRepository = {
    async fieldSemantics(entryId) {
      return (
        await tx.execute<{
          id: string;
          key: string;
          meaning: string;
          kind: string;
        }>(
          sql`select distinct f->>'id' as id,f->>'key' as key,f->>'meaning' as meaning,f->>'kind' as kind from measurement_form_revision r cross join lateral jsonb_array_elements(r.content->'groups') g cross join lateral jsonb_array_elements(g->'fields') f where r.shop_id=${shopId}::uuid and r.entry_id=${entryId}::uuid`,
        )
      ).rows;
    },
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`measurementForms:${shopId}`},0))`,
      );
    },
    async current(entryId) {
      const r = (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.entry_id=${entryId}::uuid and e.id=(select current_change_id from measurement_form_entry where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid)`,
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
          sql`select id,entry_id as "entryId",content,authority,content_hash as "contentHash" from measurement_form_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? measurementFormsDefinitionSchema.parse(r) : undefined;
    },
    async list({ terms, before }) {
      return (
        await tx.execute(
          sql`select ${columns} from ${from} where e.shop_id=${shopId}::uuid and e.id in(select current_change_id from measurement_form_entry where shop_id=${shopId}::uuid) and (${before ?? null}::uuid is null or e.entry_id<${before ?? null}::uuid) and (${terms.length}=0 or exists(select 1 from unnest(d.search_keys) s cross join jsonb_array_elements_text(${JSON.stringify(terms)}::jsonb) q where position(q in s)>0)) order by e.entry_id desc limit 26`,
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
          sql`select entry_id from measurement_form_entry where shop_id=${shopId}::uuid and kind=${kind} and code=${code}`,
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
      if (!ids) throw Error("MeasurementForm identity unavailable");
      const current = await repo.current(r.entryId);
      const definitionId =
        r.operation === "definition" ? ids.definition : current?.definition.id;
      if (!definitionId) throw Error("MeasurementForm definition unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'measurement-forms.publish','measurement_form_availability',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.baseVersion + 1, operation: r.operation, kind: r.content.kind, available: r.available })}::jsonb)`,
      );
      if (r.operation === "definition") {
        await tx.execute(
          sql`insert into measurement_form_revision(shop_id,id,entry_id,content,authority,content_hash,search_keys,actor_id,origin_draft_id) values(${shopId}::uuid,${definitionId}::uuid,${r.entryId}::uuid,${JSON.stringify(r.content)}::jsonb,${r.authority},${r.contentHash},ARRAY(select jsonb_array_elements_text(${JSON.stringify(r.searchKeys)}::jsonb)),${r.actorId}::uuid,${r.originDraftId}::uuid)`,
        );
        for (const group of r.content.groups)
          for (const field of group.fields)
            if (field.illustration) {
              const i = field.illustration;
              await tx.execute(
                sql`insert into measurement_form_illustration(shop_id,definition_id,field_id,asset_id,asset_version) values(${shopId}::uuid,${definitionId}::uuid,${field.id}::uuid,${i.assetId}::uuid,${i.version})`,
              );
              await tx.execute(
                sql`insert into media_reference(shop_id,asset_id,reference_id) values(${shopId}::uuid,${i.assetId}::uuid,${definitionId}::uuid) on conflict do nothing`,
              );
            }
        const refs = [
          ...(r.content.service
            ? [
                {
                  ...r.content.service,
                  role: "service",
                  optional: false,
                  position: 0,
                },
              ]
            : []),
          ...(r.content.piece
            ? [
                {
                  ...r.content.piece,
                  role: "piece",
                  optional: false,
                  position: 0,
                },
              ]
            : []),
        ];
        for (const ref of refs)
          await tx.execute(
            sql`insert into measurement_form_reference(shop_id,definition_id,role,position,target_entry_id,target_revision_id,optional) values(${shopId}::uuid,${definitionId}::uuid,${ref.role},${ref.position},${ref.entryId}::uuid,${ref.revisionId}::uuid,${ref.optional})`,
          );
      }
      await tx.execute(
        sql`insert into measurement_form_availability(shop_id,id,entry_id,definition_id,version,previous_id,actor_id,audit_id,origin_draft_id,operation,available,reason) values(${shopId}::uuid,${ids.id}::uuid,${r.entryId}::uuid,${definitionId}::uuid,${r.baseVersion + 1},${r.baseRevisionId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,${r.operation},${r.available},${r.reason})`,
      );
      const inserted = await repo.read(ids.id);
      if (!inserted) throw Error("MeasurementForm publication unavailable");
      return inserted;
    },
    async advance(r, expected) {
      return !!(
        await (expected === 0
          ? tx.execute(
              sql`insert into measurement_form_entry(shop_id,entry_id,kind,code,current_change_id,version) values(${shopId}::uuid,${r.entryId}::uuid,${r.definition.content.kind},${r.definition.content.code},${r.id}::uuid,${r.version}) on conflict do nothing returning entry_id`,
            )
          : tx.execute(
              sql`update measurement_form_entry set current_change_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and entry_id=${r.entryId}::uuid and version=${expected} returning entry_id`,
            ))
      ).rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from measurement_form_availability where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
  return repo;
}
