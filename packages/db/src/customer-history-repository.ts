import type { CustomerHistoryEvent } from "@aarili/contracts/customer-history";
import { sql, type Transaction } from "./index.js";
import type { CustomerHistoryRepository } from "./repositories/customer-history.js";

// Audit IDs are the canonical event identity. Domain rows enrich the event;
// they never become a second copy of acceptance/revision/progress in the feed.
export function customerHistoryRepository(
  tx: Transaction,
  shopId: string,
): CustomerHistoryRepository {
  return {
    async privacyVersion() {
      return (
        (
          await tx.execute<{ id: string | null }>(
            sql`select count(*)::text || ':' || coalesce(max(id::text),'') as id from audit_event where shop_id=${shopId}::uuid and action like 'privacy.%'`,
          )
        ).rows[0]?.id ?? null
      );
    },
    async wearers(customerId) {
      return (
        await tx.execute<{ id: string }>(
          sql`select wearer_id as id from customer_wearer_relationship where shop_id=${shopId}::uuid and customer_id=${customerId}::uuid order by wearer_id`,
        )
      ).rows.map((r) => r.id);
    },
    async window() {
      // A conservative committed prefix: exclude the oldest active transaction
      // and everything newer. Unlike now()/UUID high-waters this also excludes
      // late commits and subtransactions. No exported snapshot/connection held.
      const row = (
        await tx.execute<{ watermark: string }>(
          sql`select pg_snapshot_xmin(pg_current_snapshot())::text as watermark`,
        )
      ).rows[0];
      if (!row) throw Error("History boundary unavailable");
      return row;
    },
    async page(q, wearers, window, keys) {
      const allowed = JSON.stringify(wearers),
        pos = window.position;
      const r = await tx.execute<Record<string, unknown>>(sql`
with allowed_wearers as (select value::uuid as id from jsonb_array_elements_text(${allowed}::jsonb)),
visible_orders as materialized (
 select o.* from garment_order o where o.shop_id=${shopId}::uuid and o.customer_id=${q.customerId}::uuid
 and (o.wearer_id in(select id from allowed_wearers) or (o.wearer_id is null and ${q.wearerId === null} and o.intake_kind='service' and exists(select 1 from order_acceptance_snapshot snap where (snap.shop_id,snap.order_id)=(o.shop_id,o.id) and snap.content#>>'{service,profile,content,wearerRequirement}'='not-required')))
 and not exists(select 1 from service_property_subject s join garment_order parent on (parent.shop_id,parent.id)=(s.shop_id,s.source_order_id)
  where (s.shop_id,s.order_id)=(o.shop_id,o.id) and (parent.customer_id<>o.customer_id or (parent.wearer_id is not null and parent.wearer_id not in(select id from allowed_wearers))))
),
visible_bookings as materialized (
 select b.* from booking b where b.shop_id=${shopId}::uuid and b.customer_id=${q.customerId}::uuid
 and exists(select 1 from booking_member m join visible_orders o on o.id=m.order_id where (m.shop_id,m.booking_id)=(b.shop_id,b.id))
 and not exists(select 1 from booking_member m where (m.shop_id,m.booking_id)=(b.shop_id,b.id) and m.order_id not in(select id from visible_orders))
),
audits as materialized (
 select a.* from audit_event a where a.shop_id=${shopId}::uuid
 and age(a.xmin)>age((${window.watermark}::xid8)::xid)
),
events as (
 select a.*, 'customer'::text as kind, null::uuid as order_id,null::uuid as booking_id,null::uuid as wearer_id
 from audits a where a.entity_type='customer' and a.entity_id=${q.customerId}::uuid and ${q.wearerId === null} and a.action in('customer.create','customer.correct')
 union all
 select a.*, 'wearer',null::uuid,null::uuid,a.entity_id from audits a
 where a.entity_type='wearer' and a.entity_id in(select id from allowed_wearers) and (a.action like 'wearer.%' or a.action like 'guardian.%')
 and (a.action not in('wearer.create','wearer.link','wearer.update') or exists(select 1 from wearer_relationship_event re join customer_wearer_relationship rel on (rel.shop_id,rel.id)=(re.shop_id,re.relationship_id) where re.shop_id=a.shop_id and rel.wearer_id=a.entity_id and rel.customer_id=${q.customerId}::uuid and re.wearer_version=(a.changes->>'version')::integer))
 union all
 select a.*,'order',o.id,null::uuid,o.wearer_id from audits a join visible_orders o on o.id=a.entity_id
 where a.entity_type='garment_order' and a.action in('order.accept','order.presentation','order.pieces.materialize','order.service-change')
 union all
 select a.*,'booking',null::uuid,b.id,null::uuid from audits a join visible_bookings b on b.id=a.entity_id
 where a.entity_type='booking' and a.action in('booking.revise','booking.commercial.propose')
 union all
 select a.*,'service-progress',t.order_id,null::uuid,o.wearer_id from audits a
 join service_line_transition t on (t.shop_id,t.audit_id)=(a.shop_id,a.id) join visible_orders o on o.id=t.order_id
 where a.entity_type='service-line' and a.action in('service.line.complete','service.line.correct')
),
details as (
 select e.*,to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as sort_at,
 c.code as customer_code,cp.display_name as customer_label,wp.display_name as wearer_label,
 coalesce(o.code,b.code) as code,o.intake_kind,
 coalesce(s.content#>>'{snapshot,manifest,definition,content,labelEn}',s.content#>>'{snapshot,serviceProfile,content,labelEn}') as label_en,
 coalesce(s.content#>>'{snapshot,manifest,definition,content,labelTa}',s.content#>>'{snapshot,serviceProfile,content,labelTa}') as label_ta,
 case when e.kind='wearer' then (select rel.customer_id::text from wearer_relationship_event re join customer_wearer_relationship rel on (rel.shop_id,rel.id)=(re.shop_id,re.relationship_id) where re.shop_id=e.shop_id and rel.wearer_id=e.wearer_id and rel.customer_id=${q.customerId}::uuid and re.wearer_version=(e.changes->>'version')::integer limit 1) else coalesce(s.content#>>'{intake,customerId}',${q.customerId}) end as original_customer,s.content#>>'{intake,wearerId}' as original_wearer,
 coalesce(br.version,cr.version,t.parent_version,ps.order_version,case when jsonb_typeof(e.changes->'version')='number' then (e.changes->>'version')::integer end,case when e.action='order.accept' then 1 end) as revision,
 t.line_id,t.version as line_version,t.to_state,ev.note,(ev.redacted_at is not null) as note_redacted,
 (select jsonb_build_object('purpose',p.purpose,'decision',p.decision,'notice',p.notice_id) from wearer_purpose_event p where p.shop_id=e.shop_id and p.wearer_id=e.wearer_id and p.wearer_version=(e.changes->>'version')::integer limit 1) as purpose_fact,
 (select jsonb_build_object('verification',v.status) from guardian_verification_event v where v.shop_id=e.shop_id and v.wearer_id=e.wearer_id and v.wearer_version=(e.changes->>'version')::integer limit 1) as guardian_fact,
 (select jsonb_build_object('purpose',p.purpose,'decision',p.decision,'notice',p.notice_id) from guardian_purpose_event p where p.shop_id=e.shop_id and p.wearer_id=e.wearer_id and p.wearer_version=(e.changes->>'version')::integer limit 1) as guardian_purpose_fact,
 (select jsonb_build_object('age',v.age) from wearer_age_event v where v.shop_id=e.shop_id and v.wearer_id=e.wearer_id and v.wearer_version=(e.changes->>'version')::integer limit 1) as age_fact,
 cr.basis as commercial_basis,
 case when e.action='order.service-change' then array(select distinct l.piece_id::text from order_service_change_line l join order_service_change ch on (ch.shop_id,ch.id)=(l.shop_id,l.change_id) where ch.shop_id=e.shop_id and ch.audit_id=e.id and l.piece_id is not null order by l.piece_id::text)
 else array(select p.id::text from order_piece p where p.shop_id=e.shop_id and p.order_id=e.order_id order by p.id) end as piece_ids,
 case when e.action='order.service-change' then array(select l.id::text from order_service_change_line l join order_service_change ch on (ch.shop_id,ch.id)=(l.shop_id,l.change_id) where ch.shop_id=e.shop_id and ch.audit_id=e.id order by l.id)
 when e.action='order.accept' then array(select l.id::text from service_order_line l where l.shop_id=e.shop_id and l.order_id=e.order_id order by l.id)
 else array(select t.line_id::text where t.line_id is not null) end as line_ids,
 coalesce(ro.source_order_id,so.source_order_id) as repeat_source,
 (select source_order.intake_kind from visible_orders source_order where source_order.id=coalesce(ro.source_order_id,so.source_order_id)) as repeat_kind,
 coalesce((s.content#>>'{snapshot,repeat,sourceVersion}')::integer,(s.content#>>'{snapshot,repeatService,sourceVersion}')::integer,(ro.source->>'sourceVersion')::integer,(so.source->>'sourceVersion')::integer) as repeat_version
 from events e join customer c on c.shop_id=e.shop_id and c.id=${q.customerId}::uuid
 join customer_person cp on (cp.shop_id,cp.id)=(c.shop_id,c.person_id)
 left join wearer w on (w.shop_id,w.id)=(e.shop_id,e.wearer_id)
 left join customer_person wp on (wp.shop_id,wp.id)=(w.shop_id,w.person_id)
 left join visible_orders o on o.id=e.order_id
 left join order_acceptance_snapshot s on (s.shop_id,s.order_id)=(e.shop_id,e.order_id)
 left join visible_bookings b on b.id=e.booking_id
 left join booking_revision br on (br.shop_id,br.audit_id)=(e.shop_id,e.id)
 left join booking_commercial_revision cr on (cr.shop_id,cr.audit_id)=(e.shop_id,e.id)
 left join order_piece_set ps on (ps.shop_id,ps.audit_id)=(e.shop_id,e.id)
 left join service_line_transition t on (t.shop_id,t.audit_id)=(e.shop_id,e.id)
 left join service_line_evidence ev on (ev.shop_id,ev.transition_id)=(t.shop_id,t.id)
 left join order_repeat_target rt on (rt.shop_id,rt.order_id)=(e.shop_id,e.order_id) and e.action='order.accept'
 left join order_repeat_origin ro on (ro.shop_id,ro.draft_id)=(rt.shop_id,rt.draft_id) and ro.source_order_id in(select id from visible_orders)
 left join service_repeat_target st on (st.shop_id,st.order_id)=(e.shop_id,e.order_id) and e.action='order.accept'
 left join service_repeat_origin so on (so.shop_id,so.draft_id)=(st.shop_id,st.draft_id) and so.source_order_id in(select id from visible_orders)
)
select * from details e where
 (${pos?.at ?? null}::timestamptz is null or (e.occurred_at,e.kind,e.id)<(${pos?.at ?? null}::timestamptz,${pos?.kind ?? ""},${pos?.id ?? null}::uuid))
 and (${q.query}='' or e.id::text=lower(${q.query}) or e.entity_id::text=lower(${q.query}) or e.order_id::text=lower(${q.query}) or e.wearer_id::text=lower(${q.query})
 or lower(e.code)=lower(${q.query}) or lower(e.customer_code)=lower(${q.query})
 or (${keys.nameLatinNorm}<>'' and (strpos(lower(coalesce(e.label_en,'')),${keys.nameLatinNorm})>0))
 or (${keys.nameTaNorm}<>'' and strpos(coalesce(e.label_ta,''),${keys.nameTaNorm})>0)
 or exists(select 1 from customer_search_key k where k.shop_id=e.shop_id and k.algorithm_version=1
 and (k.person_id=(select person_id from customer where shop_id=e.shop_id and id=${q.customerId}::uuid)
 or k.person_id=(select person_id from wearer where shop_id=e.shop_id and id=e.wearer_id))
 and ((${keys.nameLatinNorm}<>'' and strpos(k.name_latin_norm,${keys.nameLatinNorm})>0) or (${keys.nameTaNorm}<>'' and strpos(k.name_ta_norm,${keys.nameTaNorm})>0) or (${keys.nameSkel}<>'' and strpos(k.name_skel,${keys.nameSkel})>0)
 or (${keys.phoneDigits}<>'' and (k.phone_digits=${keys.phoneDigits} or (length(${keys.phoneDigits})=4 and k.phone_last4=${keys.phoneDigits}) or (length(${keys.phoneDigits})=6 and k.phone_last6=${keys.phoneDigits}))))))
 order by e.occurred_at desc,e.kind desc,e.id desc limit ${q.limit + 1}`);
      const rows = r.rows.slice(0, q.limit);
      const events = rows.map((row) => {
        const order = row.order_id as string | null;
        const kind = row.kind as CustomerHistoryEvent["kind"];
        const sourceKind = order
          ? row.intake_kind === "service"
            ? "service"
            : "order"
          : kind === "booking"
            ? "booking"
            : kind === "wearer"
              ? "wearer"
              : "customer";
        const fields: Record<string, string[]> = {
          "customer.create": [
            "displayName",
            "phone",
            "email",
            "aliases",
            "notes",
          ],
          "customer.correct": [
            "displayName",
            "phone",
            "email",
            "aliases",
            "notes",
          ],
          "wearer.create": ["identity", "relationship", "age", "preferences"],
          "wearer.update": ["identity", "relationship", "age", "preferences"],
          "wearer.link": ["relationship"],
          "wearer.purpose": ["purpose", "decision", "notice"],
          "guardian.claim": ["authority"],
          "guardian.verify": ["verification"],
          "guardian.purpose": ["purpose", "decision", "notice"],
          "order.accept": [
            "acceptedScope",
            "originalPromise",
            "pricing",
            "pieces",
          ],
          "order.presentation": ["presentation"],
          "order.pieces.materialize": ["pieces"],
          "order.service-change": ["requestedWork", "pricing", "scope"],
          "booking.revise": ["context", "members"],
          "booking.commercial.propose": ["commercialBasis", "scope"],
          "service.line.complete": ["lineProgress"],
          "service.line.correct": ["lineProgress"],
        };
        const redacted =
          row.note_redacted === true ||
          (row.changes as Record<string, unknown>)?.redacted === true;
        return {
          id: row.id,
          kind,
          action: row.action,
          recordedAt: new Date(row.occurred_at as string).toISOString(),
          actorId: row.actor_id,
          actorType: row.actor_type,
          reason: redacted ? null : (row.note ?? row.reason ?? null),
          fields: fields[row.action as string] ?? [],
          facts: Object.entries({
            ...((row.purpose_fact as object) ?? {}),
            ...((row.guardian_fact as object) ?? {}),
            ...((row.guardian_purpose_fact as object) ?? {}),
            ...((row.age_fact as object) ?? {}),
            ...(row.line_version
              ? { lineVersion: String(row.line_version) }
              : {}),
            ...(row.commercial_basis
              ? { commercialBasis: row.commercial_basis }
              : {}),
            ...(row.action === "order.presentation"
              ? { presentation: (row.changes as Record<string, unknown>).mode }
              : {}),
          })
            .filter(([, v]) => typeof v === "string")
            .map(([field, value]) => ({ field, value: String(value) })),
          source: {
            kind: sourceKind,
            id: order ?? row.booking_id ?? row.entity_id,
            version: row.revision ?? null,
          },
          code: row.code ?? null,
          original: {
            customerId: row.original_customer ?? null,
            wearerId: row.original_wearer ?? row.wearer_id ?? null,
          },
          currentCustomer: row.customer_label,
          currentWearer: row.wearer_label ?? null,
          labelEn: row.label_en ?? null,
          labelTa: row.label_ta ?? null,
          pieceIds: row.piece_ids,
          lineId: row.line_id ?? null,
          lineIds: row.line_ids,
          state: row.to_state ?? null,
          related: row.repeat_source
            ? [
                {
                  kind: row.repeat_kind === "service" ? "service" : "order",
                  id: row.repeat_source,
                  version: row.repeat_version ?? null,
                },
              ]
            : [],
          redacted,
        } as CustomerHistoryEvent;
      });
      const last = rows.at(-1);
      return {
        events,
        next:
          r.rows.length > q.limit && last
            ? {
                at: last.sort_at as string,
                kind: last.kind as string,
                id: last.id as string,
              }
            : null,
      };
    },
  };
}
