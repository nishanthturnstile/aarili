import type { CustomerNotice } from "@aarili/contracts/customers";
import {
  type GuardianMutation,
  type GuardianProfile,
  guardianAuthoritySchema,
  guardianProfileSchema,
  guardianVerificationRecordSchema,
} from "@aarili/contracts/wearers";
import { sql, type Transaction } from "./index.js";
import type {
  GuardianRepository,
  GuardianWrite,
} from "./repositories/wearers.js";
import { requestRepository } from "./request-repository.js";

const iso = (value: unknown) => new Date(value as string).toISOString();
export function guardianRepository(
  tx: Transaction,
  shopId: string,
  currentNoticeId?: string,
): GuardianRepository {
  shopId = shopId.toLowerCase();
  async function advance(
    w: GuardianWrite,
    expected: number,
    invalidate: boolean,
  ) {
    const r = await tx.execute<{ authority_epoch: number }>(
      sql`update wearer set version=version+1,authority_epoch=authority_epoch+${invalidate ? 1 : 0},updated_by=${w.actorId}::uuid where shop_id=${shopId}::uuid and id=${w.wearerId}::uuid and version=${expected} returning authority_epoch`,
    );
    if (!r.rows[0]) throw Error("Guardian aggregate version changed");
    return r.rows[0].authority_epoch;
  }
  return {
    ...requestRepository<GuardianMutation>(tx, shopId),
    async ensureNotice(n: CustomerNotice) {
      await tx.execute(
        sql`insert into privacy_notice_version(shop_id,id,version,title_en,title_ta,text_en,text_ta,digest,purpose,synthetic) values(${shopId}::uuid,${n.id}::uuid,${n.version},${n.titleEn},${n.titleTa},${n.textEn},${n.textTa},${n.digest},'guardian-permissions',true) on conflict(shop_id,id) do nothing`,
      );
      const r = await tx.execute(
        sql`select 1 from privacy_notice_version where shop_id=${shopId}::uuid and id=${n.id}::uuid and version=${n.version} and digest=${n.digest} and text_en=${n.textEn} and text_ta=${n.textTa} and title_en=${n.titleEn} and title_ta=${n.titleTa} and purpose='guardian-permissions' and synthetic`,
      );
      if (!r.rowCount) throw Error("Guardian notice mismatch");
    },
    async ids() {
      const r = await tx.execute<{
        authorityId: string;
        eventId: string;
        personId: string;
      }>(
        sql`select uuidv7() as "authorityId",uuidv7() as "eventId",uuidv7() as "personId"`,
      );
      if (!r.rows[0]) throw Error("Guardian identifiers unavailable");
      return r.rows[0];
    },
    async person(id) {
      const r = await tx.execute<{ personId: string; displayName: string }>(
        sql`select id as "personId",display_name as "displayName" from customer_person where shop_id=${shopId}::uuid and id=${id}::uuid for share`,
      );
      return r.rows[0];
    },
    async search(input, keys) {
      // Bounded, private discovery returns identity only; deliberate selection never merges people.
      const r = await tx.execute<{ personId: string; displayName: string }>(
        sql`select p.id as "personId",p.display_name as "displayName" from customer_person p where p.shop_id=${shopId}::uuid and (${input.cursor ?? null}::uuid is null or p.id>${input.cursor ?? null}::uuid) and (${input.query}='' or exists(select 1 from customer_search_key k where k.shop_id=p.shop_id and k.person_id=p.id and (strpos(k.name_ta_norm,${keys.nameTaNorm})>0 and ${keys.nameTaNorm}<>'' or strpos(k.name_latin_norm,${keys.nameLatinNorm})>0 and ${keys.nameLatinNorm}<>'' or strpos(k.name_skel,${keys.nameSkel})>0 and ${keys.nameSkel}<>''))) order by p.id limit ${input.limit + 1}`,
      );
      return {
        people: r.rows.slice(0, input.limit),
        next:
          r.rows.length > input.limit
            ? (r.rows[input.limit - 1]?.personId ?? null)
            : null,
      };
    },
    async read(wearerId, relationshipAllowed) {
      const wr = await tx.execute<{
          version: number;
          age: string;
          authority_epoch: number;
        }>(
          sql`select version,age,authority_epoch from wearer where shop_id=${shopId}::uuid and id=${wearerId}::uuid for share`,
        ),
        w = wr.rows[0];
      if (!w) throw Error("Guardian wearer unavailable");
      const ar = await tx.execute(
        sql`select a.id,a.person_id as "personId",p.display_name as "displayName",a.authority,a.scope,a.source,a.occurred_at as "occurredAt",a.recorded_by as "recordedBy",a.recorded_at as "recordedAt",a.wearer_version as "wearerVersion",a.origin_draft_id as "originDraftId" from guardian_authority a join customer_person p on p.shop_id=a.shop_id and p.id=a.person_id where a.shop_id=${shopId}::uuid and a.wearer_id=${wearerId}::uuid order by a.wearer_version`,
      );
      const vr = await tx.execute(
        sql`select id,authority_id as "authorityId",status,method,evidence_ref as "evidenceRef",scope,source,occurred_at as "occurredAt",recorded_by as "recordedBy",recorded_at as "recordedAt",wearer_version as "wearerVersion",previous_id as "previousId",authority_epoch as epoch from guardian_verification_event where shop_id=${shopId}::uuid and wearer_id=${wearerId}::uuid order by wearer_version`,
      );
      const authorities = ar.rows.map((a) => {
        const vs = vr.rows
          .filter((v) => v.authorityId === a.id)
          .map(({ epoch: _, ...v }) =>
            guardianVerificationRecordSchema.parse({
              ...v,
              occurredAt: iso(v.occurredAt),
              recordedAt: iso(v.recordedAt),
            }),
          );
        const latest = vr.rows.filter((v) => v.authorityId === a.id).at(-1);
        return guardianAuthoritySchema.parse({
          ...a,
          occurredAt: iso(a.occurredAt),
          recordedAt: iso(a.recordedAt),
          status: vs.at(-1)?.status ?? "pending",
          verifications: vs,
          verifiedCurrent:
            w.age === "minor" &&
            latest?.status === "confirmed" &&
            latest.epoch === w.authority_epoch &&
            ar.rows.at(-1)?.id === a.id,
        });
      });
      const authority = authorities.at(-1) ?? null;
      const pr = await tx.execute(
        sql`select distinct on(e.authority_id,e.purpose) e.id,e.authority_id as "authorityId",e.purpose,e.decision,e.notice_id as "noticeId",n.version as "noticeVersion",e.notice_explained as "noticeExplained",e.language,e.giver_person_id as "giverPersonId",e.source,e.occurred_at as "occurredAt",e.recorded_by as "recordedBy",e.recorded_at as "recordedAt",e.wearer_version as "wearerVersion",e.previous_id as "previousId",e.verification_id as "verificationId",e.authority_epoch as epoch from guardian_purpose_event e join privacy_notice_version n on n.shop_id=e.shop_id and n.id=e.notice_id where e.shop_id=${shopId}::uuid and e.wearer_id=${wearerId}::uuid order by e.authority_id,e.purpose,e.wearer_version desc`,
      );
      const purposes = pr.rows.map(({ epoch, ...p }) => {
        const v = vr.rows.filter((x) => x.authorityId === p.authorityId).at(-1);
        return {
          ...p,
          occurredAt: iso(p.occurredAt),
          recordedAt: iso(p.recordedAt),
          eligible:
            relationshipAllowed &&
            w.age === "minor" &&
            p.decision === "grant" &&
            p.authorityId === authority?.id &&
            p.noticeId === currentNoticeId &&
            v?.status === "confirmed" &&
            p.verificationId === v.id &&
            v.epoch === w.authority_epoch &&
            epoch === w.authority_epoch &&
            (authority?.scope === p.purpose ||
              authority?.scope === "measurement-and-private-photo"),
        };
      });
      return guardianProfileSchema.parse({
        wearerId,
        version: w.version,
        synthetic: true,
        authority,
        authorities,
        purposes,
      }) satisfies GuardianProfile;
    },
    async claim(w, input, personId, expected, keys) {
      const epoch = await advance(w, expected, true);
      if (input.guardian.mode === "new") {
        await tx.execute(
          sql`insert into customer_person(shop_id,id,display_name,phone,email,aliases,version,synthetic,created_by,updated_by) values(${shopId}::uuid,${personId}::uuid,${input.guardian.displayName},'','','[]'::jsonb,1,true,${w.actorId}::uuid,${w.actorId}::uuid)`,
        );
        await tx.execute(
          sql`insert into customer_search_key(shop_id,person_id,ordinal,algorithm_version,name_ta_norm,name_latin_norm,name_skel,phone_digits) values(${shopId}::uuid,${personId}::uuid,0,1,${keys.nameTaNorm},${keys.nameLatinNorm},${keys.nameSkel},'')`,
        );
      }
      await tx.execute(
        sql`insert into guardian_authority(shop_id,id,wearer_id,person_id,authority,scope,source,occurred_at,wearer_version,authority_epoch,recorded_by,origin_draft_id,synthetic) values(${shopId}::uuid,${w.authorityId}::uuid,${w.wearerId}::uuid,${personId}::uuid,${input.authority},${input.scope},${input.source},${input.occurredAt}::timestamptz,${expected + 1},${epoch},${w.actorId}::uuid,${w.originDraftId}::uuid,true)`,
      );
    },
    async verify(w, e, expected) {
      const epoch = await advance(w, expected, true);
      await tx.execute(
        sql`insert into guardian_verification_event(shop_id,id,wearer_id,authority_id,status,method,evidence_ref,scope,source,occurred_at,wearer_version,authority_epoch,previous_id,recorded_by) values(${shopId}::uuid,uuidv7(),${w.wearerId}::uuid,${e.authorityId}::uuid,${e.status},${e.method},${e.evidenceRef},${e.scope},${e.source},${e.occurredAt}::timestamptz,${expected + 1},${epoch},(select id from guardian_verification_event where shop_id=${shopId}::uuid and wearer_id=${w.wearerId}::uuid and authority_id=${e.authorityId}::uuid order by wearer_version desc limit 1),${w.actorId}::uuid)`,
      );
    },
    async purpose(w, e, expected) {
      const epoch = await advance(w, expected, false);
      await tx.execute(
        sql`insert into guardian_purpose_event(shop_id,id,wearer_id,authority_id,giver_person_id,purpose,decision,notice_id,notice_explained,language,source,occurred_at,verification_id,previous_id,wearer_version,authority_epoch,recorded_by,synthetic) values(${shopId}::uuid,uuidv7(),${w.wearerId}::uuid,${e.authorityId}::uuid,${e.giverPersonId}::uuid,${e.purpose},${e.decision},${e.noticeId}::uuid,true,${e.language},${e.source},${e.occurredAt}::timestamptz,(select id from guardian_verification_event where shop_id=${shopId}::uuid and wearer_id=${w.wearerId}::uuid and authority_id=${e.authorityId}::uuid order by wearer_version desc limit 1),(select id from guardian_purpose_event where shop_id=${shopId}::uuid and wearer_id=${w.wearerId}::uuid and authority_id=${e.authorityId}::uuid and purpose=${e.purpose} order by wearer_version desc limit 1),${expected + 1},${epoch},${w.actorId}::uuid,true)`,
      );
    },
    async audit(w, action, version) {
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${w.eventId}::uuid,'user',${w.actorId}::uuid,${action},'wearer',${w.wearerId}::uuid,${w.requestId}::uuid,${w.key}::uuid,${JSON.stringify({ version, synthetic: true })}::jsonb)`,
      );
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select 1 from guardian_authority where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
}
