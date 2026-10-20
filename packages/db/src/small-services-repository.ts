import type { AcceptedServiceOrder } from "@aarili/contracts/small-services";
import {
  acceptedServiceOrderSchema,
  serviceProfileRevisionSchema,
} from "@aarili/contracts/small-services";
import { sql, type Transaction } from "./index.js";
import type { SmallServicesRepository } from "./repositories/small-services.js";

export function smallServicesRepository(
  tx: Transaction,
  shopId: string,
): SmallServicesRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`r.id,r.entry_id as "entryId",r.version,r.previous_id as "previousId",r.actor_id as "actorId",r.effective_at as "effectiveAt",r.origin_draft_id as "originDraftId",r.content,r.available,r.reason,r.authority,r.digest`;
  const profileRow = (r: Record<string, unknown>) =>
    serviceProfileRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  const select = sql`select o.id,o.code,o.origin_draft_id as "originDraftId",o.owner_id as "ownerId",o.version,o.accepted_at as "acceptedAt",s.content,s.digest from garment_order o join order_acceptance_snapshot s on (s.shop_id,s.order_id)=(o.shop_id,o.id)`;
  const orderRow = (r: Record<string, unknown>): AcceptedServiceOrder => {
    const c = r.content as {
      intake: unknown;
      service: Record<string, unknown>;
      snapshot: unknown;
    };
    return acceptedServiceOrderSchema.parse({
      ...c.service,
      kind: "service",
      id: r.id,
      code: r.code,
      version: r.version,
      originDraftId: r.originDraftId,
      ownerId: r.ownerId,
      acceptedAt: new Date(r.acceptedAt as string).toISOString(),
      intake: c.intake,
      snapshot: c.snapshot,
      snapshotDigest: r.digest,
      customer: null,
      wearer: null,
      synthetic: true,
    });
  };
  const repo: SmallServicesRepository = {
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`service-intake-profile:${shopId}`},0))`,
      );
    },
    async identityConflict(subjectId, lineIds) {
      return !!(
        await tx.execute(
          sql`select 1 where exists(select 1 from service_property_subject where shop_id=${shopId}::uuid and id=${subjectId}::uuid) or exists(select 1 from service_order_line where shop_id=${shopId}::uuid and id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(lineIds)}::jsonb)))`,
        )
      ).rowCount;
    },
    async current(entryId) {
      const r = (
        await tx.execute(
          sql`select ${columns} from service_intake_profile_revision r join service_intake_profile p on (p.shop_id,p.entry_id,p.current_id)=(r.shop_id,r.entry_id,r.id) where r.shop_id=${shopId}::uuid and r.entry_id=${entryId}::uuid`,
        )
      ).rows[0];
      return r ? profileRow(r) : undefined;
    },
    async readProfile(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from service_intake_profile_revision r where r.shop_id=${shopId}::uuid and r.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? profileRow(r) : undefined;
    },
    async profiles(before) {
      return (
        await tx.execute(
          sql`select ${columns} from service_intake_profile_revision r join service_intake_profile p on (p.shop_id,p.entry_id,p.current_id)=(r.shop_id,r.entry_id,r.id) where r.shop_id=${shopId}::uuid and (${before ?? null}::uuid is null or r.entry_id<${before ?? null}::uuid) order by r.entry_id desc limit 26`,
        )
      ).rows.map(profileRow);
    },
    async history(entryId, before) {
      return (
        await tx.execute(
          sql`select ${columns} from service_intake_profile_revision r where r.shop_id=${shopId}::uuid and r.entry_id=${entryId}::uuid and (${before ?? null}::integer is null or r.version<${before ?? null}::integer) order by r.version desc limit 26`,
        )
      ).rows.map(profileRow);
    },
    async append(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() id,uuidv7() audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Service profile identity unavailable");
      const manifest = v.content.manifest;
      if (!manifest) throw Error("Service profile manifest missing");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,'service-profile.publish','service_intake_profile_revision',${ids.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ version: v.baseVersion + 1, digest: v.digest, available: v.available })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into service_intake_profile_revision(shop_id,id,entry_id,version,previous_id,actor_id,audit_id,origin_draft_id,content,available,reason,authority,digest,manifest_id,definition_id) values(${shopId}::uuid,${ids.id}::uuid,${v.entryId}::uuid,${v.baseVersion + 1},${v.baseRevisionId}::uuid,${v.actorId}::uuid,${ids.audit}::uuid,${v.originDraftId}::uuid,${JSON.stringify(v.content)}::jsonb,${v.available},${v.reason},${v.authority},${v.digest},${manifest.revisionId}::uuid,${manifest.definitionId}::uuid)`,
      );
      const r = await repo.readProfile(ids.id);
      if (!r) throw Error("Service profile unavailable");
      return r;
    },
    async advance(r, expected) {
      return !!(
        await (expected === 0
          ? tx.execute(
              sql`insert into service_intake_profile(shop_id,entry_id,current_id,version) values(${shopId}::uuid,${r.entryId}::uuid,${r.id}::uuid,${r.version}) on conflict do nothing returning entry_id`,
            )
          : tx.execute(
              sql`update service_intake_profile set current_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and entry_id=${r.entryId}::uuid and version=${expected} returning entry_id`,
            ))
      ).rowCount;
    },
    async profileOrigin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from service_intake_profile_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async source(id, pieceId) {
      const r = (
        await tx.execute<{
          customerId: string;
          wearerId: string | null;
          version: number;
          digest: string;
          kind: "custom" | "service";
        }>(
          sql`select o.customer_id as "customerId",o.wearer_id as "wearerId",o.version,s.digest,o.intake_kind as kind from garment_order o join order_acceptance_snapshot s on (s.shop_id,s.order_id)=(o.shop_id,o.id) where o.shop_id=${shopId}::uuid and o.id=${id}::uuid and (${pieceId}::uuid is null or exists(select 1 from order_piece p where p.shop_id=o.shop_id and p.order_id=o.id and p.id=${pieceId}::uuid))`,
        )
      ).rows[0];
      return r;
    },
    async readOrder(id) {
      const r = (
        await tx.execute(
          sql`${select} where o.shop_id=${shopId}::uuid and o.id=${id}::uuid and o.intake_kind='service'`,
        )
      ).rows[0];
      return r ? orderRow(r) : undefined;
    },
    async orders(before) {
      return (
        await tx.execute(
          sql`${select} where o.shop_id=${shopId}::uuid and o.intake_kind='service' and (${before ?? null}::uuid is null or o.id<${before ?? null}::uuid) order by o.id desc limit 26`,
        )
      ).rows.map(orderRow);
    },
    async orderOrigin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from garment_order where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid and intake_kind='service'`,
        )
      ).rowCount;
    },
    async accept(v) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`order-code:${shopId}`},0))`,
      );
      const ids = (
        await tx.execute<{ id: string; audit: string; n: string }>(
          sql`select uuidv7() id,uuidv7() audit,(select (coalesce(max(code_number),0)+1)::text from garment_order where shop_id=${shopId}::uuid) n`,
        )
      ).rows[0];
      if (!ids) throw Error("Service identity unavailable");
      const code = `QO-${ids.n.padStart(6, "0")}`,
        priceState = v.review.totalPaise === null ? "to-be-quoted" : "quoted";
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,'order.accept','garment_order',${ids.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ digest: v.digest, intakeKind: "service" })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into garment_order(shop_id,id,code_number,code,origin_draft_id,intake_kind,customer_id,wearer_id,owner_id,audit_id,presentation,price_state,price_paise) values(${shopId}::uuid,${ids.id}::uuid,${ids.n}::bigint,${code},${v.draftId}::uuid,'service',${v.intake.customerId}::uuid,${v.intake.wearerId}::uuid,${v.actorId}::uuid,${ids.audit}::uuid,${v.intake.presentation},${priceState},${v.review.totalPaise?.toString() ?? null}::bigint)`,
      );
      const promise = {
        date: v.intake.deliveryDate,
        time: v.intake.deliveryTime,
      };
      const content = {
        intake: v.intake,
        snapshot: v.snapshot,
        requirements: v.requirements,
        review: v.commitment,
        pricePaise: v.review.totalPaise,
        synthetic: true,
        service: {
          profile: v.profile,
          lines: v.review.lines,
          totalPaise: v.review.totalPaise,
          originalPromise: promise,
          currentPromise: promise,
          review: v.review,
        },
      };
      const s = v.sources;
      await tx.execute(
        sql`insert into order_acceptance_snapshot(shop_id,order_id,manifest_id,definition_id,category_id,binding_id,rule_id,calendar_id,profile_id,policies_id,presentation_id,content,digest) values(${shopId}::uuid,${ids.id}::uuid,${s.manifestId}::uuid,${s.definitionId}::uuid,${s.categoryId}::uuid,${s.bindingId}::uuid,${s.ruleId}::uuid,${s.calendarId}::uuid,${s.profileId}::uuid,${s.policiesId}::uuid,${s.presentationId}::uuid,${JSON.stringify(content)}::jsonb,${v.digest})`,
      );
      await tx.execute(
        sql`insert into service_property_subject(shop_id,id,order_id,customer_id,wearer_id,description,property_reference,intake_context,source_order_id,source_piece_id) values(${shopId}::uuid,${v.intake.subjectId}::uuid,${ids.id}::uuid,${v.intake.customerId}::uuid,${v.intake.wearerId}::uuid,${v.intake.subjectDescription},${v.intake.propertyReference},${v.intake.intakeContext},${v.intake.sourceOrderId}::uuid,${v.intake.sourcePieceId}::uuid)`,
      );
      for (const [position, line] of v.review.lines.entries())
        await tx.execute(
          sql`insert into service_order_line(shop_id,order_id,id,position,profile_revision_id,source_key,price_paise,state,content) values(${shopId}::uuid,${ids.id}::uuid,${line.id}::uuid,${position},${v.profile.id}::uuid,${line.key},${line.pricePaise?.toString() ?? null}::bigint,${line.state},${JSON.stringify(line)}::jsonb)`,
        );
      for (const [position, item] of v.requirements.items.entries())
        await tx.execute(
          sql`insert into order_requirement(shop_id,order_id,position,section,source_key,assignee_id,content) values(${shopId}::uuid,${ids.id}::uuid,${position},${item.section},${item.key},${item.assigneeId}::uuid,${JSON.stringify(item)}::jsonb)`,
        );
      const facts = v.commitment.evaluation?.facts;
      if (!facts?.unit || facts.candidate === null)
        throw Error("Service demand unavailable");
      await tx.execute(
        sql`insert into order_capacity_demand(shop_id,order_id,category_id,delivery_date,unit,quantity) values(${shopId}::uuid,${ids.id}::uuid,${s.categoryId}::uuid,${v.intake.deliveryDate}::date,${facts.unit},${facts.candidate})`,
      );
      await tx.execute(
        sql`insert into order_presentation_event(shop_id,order_id,version,mode,actor_id,audit_id) values(${shopId}::uuid,${ids.id}::uuid,1,${v.intake.presentation},${v.actorId}::uuid,${ids.audit}::uuid)`,
      );
      const result = await repo.readOrder(ids.id);
      if (!result) throw Error("Service order unavailable");
      return result;
    },
  };
  return repo;
}
