import { identityEvidence } from "./identity-evidence.js";
import { sql, type Transaction } from "./index.js";
import type { ContactMergeRepository } from "./repositories/customer-history.js";
import { requestRepository } from "./request-repository.js";

export function contactMergeRepository(
  tx: Transaction,
  shopId: string,
): ContactMergeRepository {
  return {
    ...requestRepository(tx, shopId),
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:contact-merge:'||${shopId}::text,0))`,
      );
    },
    async lockOrder(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`order:${shopId}:${id}`},0))`,
      );
    },
    async hasMeasurementAssociations(customerIds) {
      // Populated upgrade fixtures and compatible old-schema readers have no
      // measurement records until the atomic additive migration is installed.
      if (
        !(
          await tx.execute(
            sql`select to_regclass('measurement_event') as installed`,
          )
        ).rows[0]?.installed
      )
        return false;
      const measurements = !!(
        await tx.execute(
          sql`select 1 from measurement_event where shop_id=${shopId}::uuid and customer_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(customerIds)}::jsonb))::uuid[]) union all select 1 from measurement_draft_value where shop_id=${shopId}::uuid and customer_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(customerIds)}::jsonb))::uuid[]) limit 1`,
        )
      ).rowCount;
      if (measurements) return true;
      // Fileless pattern values/drafts are also wearer-private associations.
      if (
        !(
          await tx.execute(
            sql`select to_regclass('pattern_scope') as installed`,
          )
        ).rows[0]?.installed
      )
        return false;
      return !!(
        await tx.execute(
          sql`select 1 from pattern_scope where shop_id=${shopId}::uuid and customer_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(customerIds)}::jsonb))::uuid[]) union all select 1 from pattern_draft_value where shop_id=${shopId}::uuid and customer_id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(customerIds)}::jsonb))::uuid[]) limit 1`,
        )
      ).rowCount;
    },
    async inventory(sourceId, survivorId) {
      const rows = (
        await tx.execute<{
          id: string;
          code: string;
          version: number;
          originalCustomerId: string;
          currentCustomerId: string;
          wearerId: string | null;
          digest: string;
          exclusion:
            | "wearer"
            | "booking"
            | "source"
            | "repeat"
            | "additions"
            | "profile"
            | "other-contact"
            | null;
          attributionVersion: number;
        }>(sql`
        select o.id,o.code,o.version,o.customer_id as "originalCustomerId",coalesce(a.current_customer_id,o.customer_id) as "currentCustomerId",o.wearer_id as "wearerId",s.digest,
        coalesce(a.version,0) as "attributionVersion",
        case when o.customer_id<>${sourceId}::uuid then 'other-contact'
        when o.wearer_id is not null then 'wearer'
        when exists(select 1 from booking_member m where (m.shop_id,m.order_id)=(o.shop_id,o.id)) then 'booking'
        when exists(select 1 from service_property_subject p where (p.shop_id,p.order_id)=(o.shop_id,o.id) and p.source_order_id is not null) then 'source'
        when exists(select 1 from service_repeat_target r where (r.shop_id,r.order_id)=(o.shop_id,o.id)) or exists(select 1 from service_repeat_origin r where (r.shop_id,r.source_order_id)=(o.shop_id,o.id)) then 'repeat'
        when exists(select 1 from order_service_change c where (c.shop_id,c.order_id)=(o.shop_id,o.id)) then 'additions'
        when o.intake_kind<>'service' or s.content#>>'{service,profile,content,wearerRequirement}' is distinct from 'not-required' then 'profile' end as exclusion
        from garment_order o join order_acceptance_snapshot s on (s.shop_id,s.order_id)=(o.shop_id,o.id)
        left join lateral(select * from customer_order_attribution x where (x.shop_id,x.order_id)=(o.shop_id,o.id) order by version desc limit 1) a on true
        where o.shop_id=${shopId}::uuid and o.customer_id in(${sourceId}::uuid,${survivorId}::uuid) order by o.id limit 101`)
      ).rows;
      return rows.map((r) => ({ ...r, eligible: r.exclusion === null }));
    },
    async state(sourceId, survivorId) {
      const events = (
        await tx.execute<
          Awaited<ReturnType<ContactMergeRepository["state"]>>["events"][number]
        >(sql`
        select m.id,m.version,m.mode,m.source_id as "sourceId",m.survivor_id as "survivorId",m.actor_id as "actorId",to_char(m.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "recordedAt",e.reason,(e.redacted_at is not null) as redacted
        from customer_merge_event m join identity_revision_evidence e on (e.shop_id,e.audit_id)=(m.shop_id,m.id)
        where m.shop_id=${shopId}::uuid and (m.source_id in(${sourceId}::uuid,${survivorId}::uuid) or m.survivor_id in(${sourceId}::uuid,${survivorId}::uuid)) order by m.recorded_at desc,m.id desc limit 25`)
      ).rows;
      const version =
        (
          await tx.execute<{ version: number }>(
            sql`select coalesce(max(version),1)::integer as version from customer_merge_event where shop_id=${shopId}::uuid and source_id=${sourceId}::uuid`,
          )
        ).rows[0]?.version ?? 1;
      const aliases = (
        await tx.execute<{
          sourceId: string;
          survivorId: string;
          eventId: string;
        }>(sql`
        select distinct on(source_id) source_id as "sourceId",survivor_id as "survivorId",id as "eventId" from customer_merge_event m
        where shop_id=${shopId}::uuid and active_contact_alias(shop_id,source_id) is not null and (source_id in(${sourceId}::uuid,${survivorId}::uuid) or survivor_id in(${sourceId}::uuid,${survivorId}::uuid)) order by source_id,version desc`)
      ).rows;
      return { version, events, aliases };
    },
    async replayMerge(key) {
      const r = (
        await tx.execute<{
          id: string;
          sourceId: string;
          survivorId: string;
          version: number;
          actorId: string;
          hash: string;
          authority: string;
        }>(
          sql`select id,source_id as "sourceId",survivor_id as "survivorId",version,actor_id as "actorId",request_hash as hash,authority_hash as authority from customer_merge_event where shop_id=${shopId}::uuid and command_key=${key}::uuid`,
        )
      ).rows[0];
      return r
        ? {
            actorId: r.actorId,
            hash: r.hash,
            authority: r.authority,
            result: {
              id: r.id,
              sourceId: r.sourceId,
              survivorId: r.survivorId,
              version: r.version,
            },
          }
        : undefined;
    },
    async append(v) {
      const c = v.command,
        id = (await tx.execute<{ id: string }>(sql`select uuidv7() as id`))
          .rows[0]?.id;
      if (!id) throw Error("Merge identifier unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${id}::uuid,'user',${v.actorId}::uuid,${`customer.${c.mode}`},'customer',${c.sourceId}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ version: v.version, sourceId: c.sourceId, survivorId: c.survivorId, sourceVersion: v.sourceVersion, survivorVersion: v.survivorVersion, previewFingerprint: c.fingerprint, fields: ["contactAlias", "currentAttribution"] })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into customer_merge_event(shop_id,id,source_id,survivor_id,version,mode,field_sources,actor_id,command_key,request_hash,authority_hash) values(${shopId}::uuid,${id}::uuid,${c.sourceId}::uuid,${c.survivorId}::uuid,${v.version},${c.mode},${JSON.stringify(c.fields)}::jsonb,${v.actorId}::uuid,${v.key}::uuid,${v.hash},${v.authority})`,
      );
      for (const o of v.orders)
        await tx.execute(
          sql`insert into customer_order_attribution(shop_id,event_id,order_id,version,original_customer_id,current_customer_id) values(${shopId}::uuid,${id}::uuid,${o.id}::uuid,${o.attributionVersion + 1},${c.sourceId}::uuid,${c.mode === "merge" ? c.survivorId : c.sourceId}::uuid)`,
        );
      await identityEvidence(tx, shopId, id, c.sourceId, null, {
        previousVersion: v.version - 1,
        reason: c.reason,
        fields: ["contactAlias", "currentAttribution"],
      });
      return {
        id,
        sourceId: c.sourceId,
        survivorId: c.survivorId,
        version: v.version,
      };
    },
  };
}
