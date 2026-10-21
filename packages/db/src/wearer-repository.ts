import type { CustomerNotice } from "@aarili/contracts/customers";
import {
  type WearerMutation,
  type WearerPreferences,
  type WearerProfile,
  type WearerRelationship,
  wearerProfileSchema,
} from "@aarili/contracts/wearers";
import { identityEvidence } from "./identity-evidence.js";
import { sql, type Transaction } from "./index.js";
import type { WearerRepository, WearerWrite } from "./repositories/wearers.js";
import { requestRepository } from "./request-repository.js";

export { guardianRepository } from "./guardian-repository.js";
export function wearerRepository(
  tx: Transaction,
  shopId: string,
  currentNoticeId?: string,
): WearerRepository {
  shopId = shopId.toLowerCase();
  async function ensureNotice(n: CustomerNotice) {
    const check = await tx.execute(
      sql`insert into privacy_notice_version(shop_id,id,version,title_en,title_ta,text_en,text_ta,digest,purpose,synthetic) values(${shopId}::uuid,${n.id}::uuid,${n.version},${n.titleEn},${n.titleTa},${n.textEn},${n.textTa},${n.digest},'wearer-permissions',true) on conflict(shop_id,id) do nothing`,
    );
    void check;
    const found = await tx.execute<{ digest: string }>(
      sql`select digest from privacy_notice_version where shop_id=${shopId}::uuid and id=${n.id}::uuid and version=${n.version} and text_en=${n.textEn} and text_ta=${n.textTa} and synthetic`,
    );
    if (found.rows[0]?.digest !== n.digest)
      throw Error("Wearer notice mismatch");
  }
  const identityColumns = sql`w.id,w.person_id as "personId",p.display_name as "displayName",w.age,w.version`;
  async function relationship(
    w: WearerWrite,
    r: WearerRelationship,
    version: number,
    insert: boolean,
  ) {
    if (insert)
      await tx.execute(sql`insert into customer_wearer_relationship(shop_id,id,customer_id,wearer_id,kind,statement_by_person_id,authorised,informed,authorisation_declined,informed_declined,source,occurred_at,interaction,origin_draft_id)
   values(${shopId}::uuid,${w.relationshipId}::uuid,${w.customerId}::uuid,${w.id}::uuid,${r.kind},${r.statementByPersonId}::uuid,${r.authorised},${r.informed},${r.authorisationDeclined},${r.informedDeclined},${r.source},${r.occurredAt}::timestamptz,${r.interaction},${w.originDraftId}::uuid)`);
    else
      await tx.execute(
        sql`update customer_wearer_relationship set kind=${r.kind},statement_by_person_id=${r.statementByPersonId}::uuid,authorised=${r.authorised},informed=${r.informed},authorisation_declined=${r.authorisationDeclined},informed_declined=${r.informedDeclined},source=${r.source},occurred_at=${r.occurredAt}::timestamptz,interaction=${r.interaction} where shop_id=${shopId}::uuid and id=${w.relationshipId}::uuid and customer_id=${w.customerId}::uuid and wearer_id=${w.id}::uuid`,
      );
    await tx.execute(
      sql`insert into wearer_relationship_event(shop_id,id,relationship_id,wearer_version,evidence,notice_id,recorded_by) values(${shopId}::uuid,uuidv7(),${w.relationshipId}::uuid,${version},${JSON.stringify(r)}::jsonb,${w.noticeId}::uuid,${w.actorId}::uuid)`,
    );
  }
  async function preferences(
    w: WearerWrite,
    p: WearerPreferences,
    version: number,
  ) {
    await tx.execute(sql`insert into wearer_preferences(shop_id,wearer_id,language,channel,fit,style,delivery,source) values(${shopId}::uuid,${w.id}::uuid,${p.language},${p.channel},${p.fit},${p.style},${p.delivery},${p.source})
   on conflict(shop_id,wearer_id) do update set language=excluded.language,channel=excluded.channel,fit=excluded.fit,style=excluded.style,delivery=excluded.delivery,source=excluded.source`);
    await tx.execute(
      sql`insert into wearer_preference_event(shop_id,id,wearer_id,wearer_version,expressed,recorded_by) values(${shopId}::uuid,uuidv7(),${w.id}::uuid,${version},${JSON.stringify(p)}::jsonb,${w.actorId}::uuid)`,
    );
  }
  async function ageEvent(
    w: WearerWrite,
    age: string,
    source: WearerRelationship,
    version: number,
  ) {
    await tx.execute(
      sql`insert into wearer_age_event(shop_id,id,wearer_id,wearer_version,age,source,occurred_at,recorded_by) values(${shopId}::uuid,uuidv7(),${w.id}::uuid,${version},${age},${source.source},${source.occurredAt}::timestamptz,${w.actorId}::uuid)`,
    );
  }
  async function read(
    customerId: string,
    id: string,
  ): Promise<WearerProfile | undefined> {
    const q =
      await tx.execute(sql`select ${identityColumns},w.authority_epoch as epoch,r.id as "relationshipId",r.kind,r.statement_by_person_id as "statementByPersonId",r.authorised,r.informed,r.authorisation_declined as "authorisationDeclined",r.informed_declined as "informedDeclined",r.source,r.occurred_at as "occurredAt",r.interaction,r.origin_draft_id as "originDraftId",f.language as "preferenceLanguage",f.channel,f.fit,f.style,f.delivery,f.source as "preferenceSource"
   from wearer w join customer_person p on p.shop_id=w.shop_id and p.id=w.person_id join customer_wearer_relationship r on r.shop_id=w.shop_id and r.wearer_id=w.id join wearer_preferences f on f.shop_id=w.shop_id and f.wearer_id=w.id
   where w.shop_id=${shopId}::uuid and w.id=${id}::uuid and r.customer_id=${customerId}::uuid for share of w`);
    const row = q.rows[0];
    if (!row) return undefined;
    const purposes =
      await tx.execute(sql`select distinct on(e.purpose) e.id,e.purpose,e.decision,e.notice_id as "noticeId",n.version as "noticeVersion",e.language,e.giver_person_id as "giverPersonId",e.source,e.occurred_at as "occurredAt",e.recorded_at as "recordedAt",e.recorded_by as "recordedBy",e.previous_id as "previousId",e.authority_epoch as epoch
   from wearer_purpose_event e join privacy_notice_version n on n.shop_id=e.shop_id and n.id=e.notice_id where e.shop_id=${shopId}::uuid and e.wearer_id=${id}::uuid order by e.purpose,e.wearer_version desc`);
    return wearerProfileSchema.parse({
      id: row.id,
      personId: row.personId,
      displayName: row.displayName,
      age: row.age,
      version: row.version,
      synthetic: true,
      preferences: {
        language: row.preferenceLanguage,
        channel: row.channel,
        fit: row.fit,
        style: row.style,
        delivery: row.delivery,
        source: row.preferenceSource,
      },
      relationship: {
        id: row.relationshipId,
        customerId,
        kind: row.kind,
        statementByPersonId: row.statementByPersonId,
        authorised: row.authorised,
        informed: row.informed,
        authorisationDeclined: row.authorisationDeclined,
        informedDeclined: row.informedDeclined,
        source: row.source,
        occurredAt: new Date(row.occurredAt as string).toISOString(),
        interaction: row.interaction,
      },
      purposes: purposes.rows.map(({ epoch, ...e }) => ({
        ...e,
        noticeExplained: true,
        occurredAt: new Date(e.occurredAt as string).toISOString(),
        recordedAt: new Date(e.recordedAt as string).toISOString(),
        eligible:
          row.age === "adult" &&
          e.decision === "grant" &&
          epoch === row.epoch &&
          e.noticeId === currentNoticeId &&
          row.authorised &&
          row.informed,
      })),
      originDraftId: row.originDraftId,
    });
  }
  return {
    async isContactPerson(personId) {
      return !!(
        await tx.execute(
          sql`select id from customer where shop_id=${shopId}::uuid and person_id=${personId}::uuid`,
        )
      ).rowCount;
    },
    ...requestRepository<WearerMutation>(tx, shopId),
    ensureNotice,
    async ids() {
      const r = await tx.execute<{
        id: string;
        personId: string;
        relationshipId: string;
        eventId: string;
      }>(
        sql`select uuidv7() as id,uuidv7() as "personId",uuidv7() as "relationshipId",uuidv7() as "eventId"`,
      );
      if (!r.rows[0]) throw Error("Wearer identifiers unavailable");
      return r.rows[0];
    },
    async lockCustomer(id) {
      await tx.execute(
        sql`select p.id from customer c join customer_person p on p.shop_id=c.shop_id and p.id=c.person_id where c.shop_id=${shopId}::uuid and c.id=${id}::uuid for share of p`,
      );
    },
    async customer(id) {
      const r = await tx.execute<{
        id: string;
        personId: string;
        displayName: string;
        version: number;
      }>(
        sql`select c.id,p.id as "personId",p.display_name as "displayName",p.version from customer c join customer_person p on p.shop_id=c.shop_id and p.id=c.person_id where c.shop_id=${shopId}::uuid and c.id=${id}::uuid`,
      );
      return r.rows[0];
    },
    async lockWearer(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:wearer:' || ${shopId}::text || ':' || ${id}::text,0))`,
      );
    },
    async lockPerson(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('aarili:wearer-person:' || ${shopId}::text || ':' || ${id}::text,0))`,
      );
    },
    async identity(id) {
      const r = await tx.execute<{
        id: string;
        personId: string;
        displayName: string;
        age: "adult" | "minor" | "unknown";
        version: number;
      }>(
        sql`select ${identityColumns} from wearer w join customer_person p on p.shop_id=w.shop_id and p.id=w.person_id where w.shop_id=${shopId}::uuid and w.id=${id}::uuid`,
      );
      return r.rows[0];
    },
    async byPerson(personId) {
      const r = await tx.execute<{ id: string }>(
        sql`select id from wearer where shop_id=${shopId}::uuid and person_id=${personId}::uuid`,
      );
      return r.rows[0] ? this.identity(r.rows[0].id) : undefined;
    },
    read,
    async list(customerId) {
      const r = await tx.execute<{ id: string }>(
        sql`select wearer_id as id from customer_wearer_relationship where shop_id=${shopId}::uuid and customer_id=${customerId}::uuid order by id`,
      );
      const found = [];
      for (const row of r.rows) {
        const p = await read(customerId, row.id);
        if (p) found.push(p);
      }
      return found;
    },
    async search(input, k) {
      const q = await tx.execute<{
        id: string;
        personId: string;
        displayName: string;
        age: "adult" | "minor" | "unknown";
        version: number;
      }>(sql`select ${identityColumns} from wearer w join customer_person p on p.shop_id=w.shop_id and p.id=w.person_id where w.shop_id=${shopId}::uuid
    and (${input.query}='' or starts_with(lower(p.display_name),lower(${input.query})) or exists(select 1 from customer_search_key s where s.shop_id=w.shop_id and s.person_id=w.person_id and ((${k.nameLatinNorm}<>'' and starts_with(s.name_latin_norm,${k.nameLatinNorm})) or (${k.nameTaNorm}<>'' and starts_with(s.name_ta_norm,${k.nameTaNorm})) or (${k.nameSkel}<>'' and s.name_skel=${k.nameSkel}))))
    ${input.cursor ? sql`and w.id>${input.cursor}::uuid` : sql``} order by w.id limit ${input.limit + 1}`);
      const rows = q.rows.slice(0, input.limit),
        last = rows.at(-1);
      return {
        wearers: rows,
        next: q.rows.length > input.limit && last ? last.id : null,
      };
    },
    async insert(w, input, displayName) {
      if (input.mode === "new") {
        await tx.execute(
          sql`insert into customer_person(shop_id,id,display_name,version,synthetic,created_by,updated_by) values(${shopId}::uuid,${w.personId}::uuid,${displayName},1,true,${w.actorId}::uuid,${w.actorId}::uuid)`,
        );
        if (!w.searchKey) throw Error("Wearer search keys unavailable");
        await tx.execute(
          sql`insert into customer_search_key(shop_id,person_id,ordinal,algorithm_version,name_ta_norm,name_latin_norm,name_skel,phone_digits) values(${shopId}::uuid,${w.personId}::uuid,0,1,${w.searchKey.nameTaNorm},${w.searchKey.nameLatinNorm},${w.searchKey.nameSkel},'')`,
        );
      }
      await tx.execute(
        sql`insert into wearer(shop_id,id,person_id,age,version,synthetic,created_by,updated_by) values(${shopId}::uuid,${w.id}::uuid,${w.personId}::uuid,${input.age},1,true,${w.actorId}::uuid,${w.actorId}::uuid)`,
      );
      await preferences(w, input.preferences, 1);
      await ageEvent(w, input.age, input.relationship, 1);
      await relationship(w, input.relationship, 1, true);
    },
    async link(w, r, expected) {
      const result = await tx.execute(
        sql`update wearer set version=version+1,updated_by=${w.actorId}::uuid where shop_id=${shopId}::uuid and id=${w.id}::uuid and version=${expected} returning id`,
      );
      if (!result.rowCount) return false;
      await relationship(w, r, expected + 1, true);
      return true;
    },
    async update(w, input, expected) {
      if (input.displayName) {
        // A contact-backed identity must use the contact correction command so
        // phone/alias keys and its independent customer version stay consistent.
        const changed = await tx.execute(
          sql`update customer_person p set display_name=${input.displayName},version=version+1,updated_by=${w.actorId}::uuid where p.shop_id=${shopId}::uuid and p.id=${w.personId}::uuid and not exists(select 1 from customer c where (c.shop_id,c.person_id)=(p.shop_id,p.id)) returning id`,
        );
        if (!changed.rowCount)
          throw Error("Contact-backed name requires contact correction");
        const k = w.searchKey;
        if (!k) throw Error("Name search keys unavailable");
        await tx.execute(
          sql`update customer_search_key set name_ta_norm=${k.nameTaNorm},name_latin_norm=${k.nameLatinNorm},name_skel=${k.nameSkel} where shop_id=${shopId}::uuid and person_id=${w.personId}::uuid and ordinal=0`,
        );
      }
      const r = await tx.execute(
        sql`update wearer set age=${input.age},authority_epoch=case when ${w.invalidateAuthority ?? false} then authority_epoch+1 else authority_epoch end,version=version+1,updated_by=${w.actorId}::uuid where shop_id=${shopId}::uuid and id=${w.id}::uuid and version=${expected} returning id`,
      );
      if (!r.rowCount) return false;
      await preferences(w, input.preferences, expected + 1);
      await ageEvent(w, input.age, input.relationship, expected + 1);
      await relationship(w, input.relationship, expected + 1, false);
      return true;
    },
    async appendPurpose(w, e, n, expected) {
      await ensureNotice(n);
      const r = await tx.execute(
        sql`update wearer set version=version+1,updated_by=${w.actorId}::uuid where shop_id=${shopId}::uuid and id=${w.id}::uuid and version=${expected} returning authority_epoch`,
      );
      if (!r.rowCount) return false;
      const epoch = r.rows[0]?.authority_epoch;
      if (typeof epoch !== "number")
        throw Error("Wearer authority epoch unavailable");
      await tx.execute(sql`insert into wearer_purpose_event(shop_id,id,wearer_id,person_id,purpose,decision,notice_id,giver_person_id,language,notice_explained,source,occurred_at,recorded_by,wearer_version,authority_epoch,previous_id,synthetic)
    values(${shopId}::uuid,uuidv7(),${w.id}::uuid,${w.personId}::uuid,${e.purpose},${e.decision},${n.id}::uuid,${e.giverPersonId}::uuid,${e.language},true,${e.source},${e.occurredAt}::timestamptz,${w.actorId}::uuid,${expected + 1},${epoch},(select id from wearer_purpose_event where shop_id=${shopId}::uuid and wearer_id=${w.id}::uuid and purpose=${e.purpose} order by wearer_version desc limit 1),true)`);
      return true;
    },
    async audit(w, action, version) {
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${w.eventId}::uuid,'user',${w.actorId}::uuid,${action},'wearer',${w.id}::uuid,${w.requestId}::uuid,${w.key}::uuid,${JSON.stringify({ version, synthetic: true })}::jsonb)`,
      );
      if (w.revision)
        await identityEvidence(
          tx,
          shopId,
          w.eventId,
          w.customerId,
          w.id,
          w.revision,
        );
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select 1 from customer_wearer_relationship where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
}
