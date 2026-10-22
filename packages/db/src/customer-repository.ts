import type { CustomerMutationResult } from "@aarili/contracts/customers";
import {
  type CustomerCreate,
  type CustomerNotice,
  customerProfileSchema,
  customerSearchPageSchema,
} from "@aarili/contracts/customers";
import { identityEvidence } from "./identity-evidence.js";
import { sql, type Transaction } from "./index.js";
import type {
  CustomerRepository,
  CustomerWrite,
} from "./repositories/customers.js";
import { requestRepository } from "./request-repository.js";

const baseColumns = sql`c.id,c.person_id as "personId",c.code,c.notes,p.display_name as "displayName",p.phone,p.email,p.aliases,p.version,p.synthetic`;
const resolutionColumns = sql`(select jsonb_build_object('id',target.id,'code',target.code,'displayName',tp.display_name,'eventId',m.id) from customer_merge_event m join customer target on (target.shop_id,target.id)=(m.shop_id,m.survivor_id) join customer_person tp on (tp.shop_id,tp.id)=(target.shop_id,target.person_id) where m.shop_id=c.shop_id and m.source_id=c.id and m.mode='merge' and m.survivor_id=active_contact_alias(c.shop_id,c.id) order by m.version desc limit 1) as "mergedInto"`;
export function customerRepository(
  tx: Transaction,
  shopId: string,
): CustomerRepository {
  shopId = shopId.toLowerCase();
  async function selectColumns() {
    const installed = (
      await tx.execute<{ installed: boolean }>(
        sql`select to_regclass('customer_merge_event') is not null as installed`,
      )
    ).rows[0]?.installed;
    return sql`${baseColumns},${installed ? resolutionColumns : sql`null as "mergedInto"`}`;
  }
  async function keys(w: CustomerWrite) {
    // Fixed slots retire removed aliases without granting runtime deletion.
    for (let ordinal = 0; ordinal <= 20; ordinal++) {
      const k = w.keys[ordinal] ?? {
        algorithmVersion: 1,
        nameTaNorm: "",
        nameLatinNorm: "",
        nameSkel: "",
        phoneDigits: "",
      };
      await tx.execute(sql`insert into customer_search_key(shop_id,person_id,ordinal,algorithm_version,name_ta_norm,name_latin_norm,name_skel,phone_digits)
    values(${shopId}::uuid,${w.personId}::uuid,${ordinal},${k.algorithmVersion},${k.nameTaNorm},${k.nameLatinNorm},${k.nameSkel},${k.phoneDigits})
    on conflict(shop_id,person_id,ordinal) do update set algorithm_version=excluded.algorithm_version,name_ta_norm=excluded.name_ta_norm,name_latin_norm=excluded.name_latin_norm,name_skel=excluded.name_skel,phone_digits=excluded.phone_digits`);
    }
  }
  async function notice(n: CustomerNotice) {
    await tx.execute(sql`insert into privacy_notice_version(shop_id,id,version,title_en,title_ta,text_en,text_ta,digest,purpose,synthetic)
   values(${shopId}::uuid,${n.id}::uuid,${n.version},${n.titleEn},${n.titleTa},${n.textEn},${n.textTa},${n.digest},'service',true) on conflict(shop_id,id) do nothing`);
    const r = await tx.execute<{
      digest: string;
      synthetic: boolean;
      version: string;
    }>(
      sql`select digest,synthetic,version from privacy_notice_version where shop_id=${shopId}::uuid and id=${n.id}::uuid`,
    );
    if (
      r.rows[0]?.digest !== n.digest ||
      r.rows[0]?.version !== n.version ||
      !r.rows[0]?.synthetic
    )
      throw Error("Customer notice mismatch");
  }
  return {
    ...requestRepository<CustomerMutationResult>(tx, shopId),
    async ids() {
      const r = await tx.execute<{
        id: string;
        personId: string;
        eventId: string;
      }>(
        sql`select uuidv7() as id,uuidv7() as "personId",uuidv7() as "eventId"`,
      );
      if (!r.rows[0]) throw Error("Customer identifiers unavailable");
      return r.rows[0];
    },
    async lockCustomer(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:customer:' || ${shopId}::text || ':' || ${id}::text,0))`,
      );
    },
    async read(id) {
      const columns = await selectColumns();
      const r =
        await tx.execute(sql`select ${columns},e.notice_id as "noticeId",e.language,e.source,e.occurred_at as "occurredAt",e.recorded_at as "recordedAt",e.recorded_by as "recordedBy",e.giver_person_id as "giverPersonId",n.version as "noticeVersion"
    from customer c join customer_person p on p.shop_id=c.shop_id and p.id=c.person_id join consent_record e on e.shop_id=p.shop_id and e.person_id=p.id join privacy_notice_version n on n.shop_id=e.shop_id and n.id=e.notice_id where c.shop_id=${shopId}::uuid and c.id=${id}::uuid`);
      const r0 = r.rows[0];
      if (!r0) return undefined;
      return customerProfileSchema.parse({
        ...(r0.mergedInto ? { mergedInto: r0.mergedInto } : {}),
        id: r0.id,
        personId: r0.personId,
        code: r0.code,
        notes: r0.notes,
        displayName: r0.displayName,
        phone: r0.phone,
        email: r0.email,
        aliases: r0.aliases,
        version: r0.version,
        synthetic: r0.synthetic,
        serviceEvidence: {
          noticeId: r0.noticeId,
          language: r0.language,
          source: r0.source,
          occurredAt: new Date(r0.occurredAt as string).toISOString(),
          recordedAt: new Date(r0.recordedAt as string).toISOString(),
          recordedBy: r0.recordedBy,
          noticeVersion: r0.noticeVersion,
          giverPersonId: r0.giverPersonId,
          personId: r0.personId,
          decision: "grant",
          giver: "self",
          noticeExplained: true,
          synthetic: r0.synthetic,
        },
      });
    },
    async search(input, k) {
      const columns = await selectColumns();
      const digitsOnly = /^[\s+().\-\p{Nd}]+$/u.test(input.query);
      const named =
        !digitsOnly && !!(k.nameLatinNorm || k.nameTaNorm || k.nameSkel);
      const r = await tx.execute(sql`with matches as (
    select c.id,min(case when c.code=${input.query} then 0
     when ${digitsOnly} and ${k.phoneDigits}<>'' and (s.phone_digits=${k.phoneDigits} or (length(${k.phoneDigits})=4 and s.phone_last4=${k.phoneDigits}) or (length(${k.phoneDigits})=6 and s.phone_last6=${k.phoneDigits})) then 0
     when ${named} and (s.name_ta_norm=${k.nameTaNorm} or s.name_latin_norm=${k.nameLatinNorm}) then 1
     when ${named} and (starts_with(s.name_ta_norm,${k.nameTaNorm}) or starts_with(s.name_latin_norm,${k.nameLatinNorm})) then 2 else 3 end)::integer as rank
    from customer c join customer_search_key s on s.shop_id=c.shop_id and s.person_id=c.person_id
    where c.shop_id=${shopId}::uuid and s.algorithm_version=1 and (
     ${input.query}='' or c.code=${input.query}
     or (${digitsOnly} and ${k.phoneDigits}<>'' and (s.phone_digits=${k.phoneDigits} or (length(${k.phoneDigits})=4 and s.phone_last4=${k.phoneDigits}) or (length(${k.phoneDigits})=6 and s.phone_last6=${k.phoneDigits})))
     or (${named} and (( ${k.nameTaNorm}<>'' and starts_with(s.name_ta_norm,${k.nameTaNorm})) or (${k.nameLatinNorm}<>'' and starts_with(s.name_latin_norm,${k.nameLatinNorm})) or (${k.nameSkel}<>'' and s.name_skel=${k.nameSkel})))) group by c.id)
    select ${columns},m.rank from matches m join customer c on c.shop_id=${shopId}::uuid and c.id=m.id join customer_person p on p.shop_id=c.shop_id and p.id=c.person_id
    ${input.cursor ? sql`where (m.rank,c.id)>(${input.cursor.rank},${input.cursor.id}::uuid)` : sql``} order by m.rank,c.id limit ${input.limit + 1}`);
      const rows = r.rows.slice(0, input.limit),
        last = rows.at(-1);
      return customerSearchPageSchema.parse({
        customers: rows.map(
          ({ notes: _n, personId: _p, rank: _r, mergedInto, ...rest }) => ({
            ...rest,
            ...(mergedInto ? { mergedInto } : {}),
          }),
        ),
        next:
          r.rows.length > input.limit && last
            ? { rank: last.rank, id: last.id }
            : null,
      });
    },
    async insert(w, n, e: CustomerCreate["serviceEvidence"]) {
      await notice(n);
      await tx.execute(sql`insert into customer_person(shop_id,id,display_name,phone,email,aliases,version,synthetic,created_by,updated_by)
    values(${shopId}::uuid,${w.personId}::uuid,${w.contact.displayName},${w.contact.phone ?? ""},${w.contact.email ?? ""},${JSON.stringify(w.contact.aliases)}::jsonb,1,${w.synthetic},${w.actorId}::uuid,${w.actorId}::uuid)`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:customer-code:' || ${shopId}::text,0))`,
      );
      await tx.execute(
        sql`insert into customer(shop_id,id,person_id,code_number,code,notes) select ${shopId}::uuid,${w.id}::uuid,${w.personId}::uuid,n,'C'||lpad(n::text,GREATEST(4,length(n::text)),'0'),${w.contact.notes ?? ""} from (select coalesce(max(code_number),0)+1 as n from customer where shop_id=${shopId}::uuid) next`,
      );
      await tx.execute(sql`insert into consent_record(shop_id,id,person_id,giver_person_id,notice_id,purpose,decision,language,source,notice_explained,occurred_at,recorded_by,synthetic)
    values(${shopId}::uuid,uuidv7(),${w.personId}::uuid,${w.personId}::uuid,${n.id}::uuid,'service','grant',${e.language},${e.source},true,${e.occurredAt}::timestamptz,${w.actorId}::uuid,true)`);
      await keys(w);
    },
    async correct(w, expected) {
      const r = await tx.execute(
        sql`update customer_person set display_name=${w.contact.displayName},phone=${w.contact.phone ?? ""},email=${w.contact.email ?? ""},aliases=${JSON.stringify(w.contact.aliases)}::jsonb,version=version+1,updated_by=${w.actorId}::uuid where shop_id=${shopId}::uuid and id=${w.personId}::uuid and version=${expected} returning id`,
      );
      if (!r.rowCount) return false;
      await tx.execute(
        sql`update customer set notes=${w.contact.notes ?? ""} where shop_id=${shopId}::uuid and id=${w.id}::uuid`,
      );
      await keys(w);
      return true;
    },
    async audit(w, action, version) {
      await tx.execute(sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes)
   values(${shopId}::uuid,${w.eventId}::uuid,'user',${w.actorId}::uuid,${action},'customer',${w.id}::uuid,${w.requestId}::uuid,${w.key}::uuid,${JSON.stringify({ version, synthetic: w.synthetic, fields: ["displayName", "phone", "email", "aliases", "notes"] })}::jsonb)`);
      if (w.revision)
        await identityEvidence(tx, shopId, w.eventId, w.id, null, w.revision);
    },
  };
}
