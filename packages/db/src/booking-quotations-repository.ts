import {
  type QuotationVersion,
  quotationVersionSchema,
} from "@aarili/contracts/booking-quotations";
import { sql, type Transaction } from "./index.js";
import type { BookingQuotationsRepository } from "./repositories/booking-quotations.js";
export function bookingQuotationsRepository(
  tx: Transaction,
  shopId: string,
): BookingQuotationsRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`r.id,r.family_id as "familyId",r.version,r.previous_id as "previousId",r.origin_draft_id as "originDraftId",r.actor_id as "actorId",r.recorded_at as "recordedAt",r.content_hash as "contentHash",r.content`;
  async function hydrate(row: Record<string, unknown>) {
    const stored = (
      await tx.execute<{
        content: QuotationVersion["privateCosts"];
        input: QuotationVersion["input"]["sharedCost"];
      }>(
        sql`select content,input from booking_quotation_private where shop_id=${shopId}::uuid and revision_id=${row.id}::uuid`,
      )
    ).rows[0];
    if (!stored) throw Error("Quotation private provenance unavailable");
    const { content, ...header } = row;
    const c = content as QuotationVersion;
    return quotationVersionSchema.parse({
      ...c,
      ...header,
      recordedAt: new Date(row.recordedAt as string).toISOString(),
      input: { ...c.input, sharedCost: stored.input },
      privateCosts: stored.content,
    });
  }
  const repo: BookingQuotationsRepository = {
    async list(before) {
      const rows = (
        await tx.execute(
          sql`select ${columns} from booking_quotation i join booking_quotation_revision r on(r.shop_id,r.id)=(i.shop_id,i.current_revision_id) where i.shop_id=${shopId}::uuid and (${before ?? null}::uuid is null or r.id<${before ?? null}::uuid) order by r.id desc limit 26`,
        )
      ).rows;
      return Promise.all(rows.map(hydrate));
    },
    async estimates(orderId) {
      return (
        await tx.execute<{ id: string; version: number; reason: string }>(
          sql`select r.id,r.version,r.content->'input'->>'reason' reason from garment_estimate i join garment_estimate_revision r on(r.shop_id,r.id)=(i.shop_id,i.current_revision_id) where i.shop_id=${shopId}::uuid and r.order_id=${orderId}::uuid and r.piece_id is null order by r.id desc limit 25`,
        )
      ).rows;
    },
    async lock(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`quotation:${shopId}:${id}`},0))`,
      );
    },
    async current(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from booking_quotation_revision r join booking_quotation i on(i.shop_id,i.current_revision_id)=(r.shop_id,r.id) where i.shop_id=${shopId}::uuid and i.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? hydrate(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from booking_quotation_revision r where r.shop_id=${shopId}::uuid and r.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? hydrate(r) : undefined;
    },
    async selected(ids) {
      if (!ids.length) return [];
      return (
        await tx.execute<{ orderId: string; revisionId: string }>(
          sql`select order_id as "orderId",revision_id as "revisionId" from booking_quotation_selection where shop_id=${shopId}::uuid and order_id in(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid) order by order_id`,
        )
      ).rows;
    },
    async scopes(id) {
      return (
        await tx.execute<{ id: string }>(
          sql`select order_id id from booking_quotation_scope where shop_id=${shopId}::uuid and revision_id=${id}::uuid order by position`,
        )
      ).rows.map((r) => r.id);
    },
    async history(id, before) {
      const rows = (
        await tx.execute(
          sql`select ${columns} from booking_quotation_revision r where r.shop_id=${shopId}::uuid and r.family_id=${id}::uuid and (${before ?? null}::int is null or r.version<${before ?? null}::int) order by r.version desc limit 26`,
        )
      ).rows;
      return Promise.all(rows.map(hydrate));
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from booking_quotation_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async append(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() id,uuidv7() audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Quotation identity unavailable");
      const { key, requestId, privateCosts, ...body } = v,
        { sharedCost, ...input } = body.input,
        content = { ...body, input };
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,'pricing.quotation.save','booking_quotation',${ids.id}::uuid,${requestId}::uuid,${key}::uuid,${v.input.reason},${JSON.stringify({ version: v.version, selection: v.input.selection })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into booking_quotation_revision(shop_id,id,family_id,version,previous_id,origin_draft_id,actor_id,audit_id,booking_id,booking_revision_id,commercial_id,policy_id,content) values(${shopId}::uuid,${ids.id}::uuid,${v.familyId}::uuid,${v.version},${v.previousId}::uuid,${v.originDraftId}::uuid,${v.actorId}::uuid,${ids.audit}::uuid,${v.source.bookingId}::uuid,${v.source.bookingRevisionId}::uuid,${v.source.commercialId}::uuid,${v.source.policy?.id ?? null}::uuid,${JSON.stringify(content)}::jsonb)`,
      );
      for (const [i, o] of v.source.orders.entries()) {
        const predecessor =
          v.source.current.find((c) => c.orderId === o.orderId)?.revisionId ??
          null;
        await tx.execute(
          sql`insert into booking_quotation_scope(shop_id,revision_id,order_id,position,customer_id,wearer_id,specification_id,estimate_revision_id,predecessor_id,content) values(${shopId}::uuid,${ids.id}::uuid,${o.orderId}::uuid,${i},${o.customerId}::uuid,${o.wearerId}::uuid,${o.specificationId}::uuid,${v.input.estimates.find((e) => e.orderId === o.orderId)?.revisionId ?? null}::uuid,${v.input.selection === "current" ? predecessor : null}::uuid,${JSON.stringify(o)}::jsonb)`,
        );
      }
      for (const l of v.customer.lines)
        await tx.execute(
          sql`insert into booking_quotation_line(shop_id,revision_id,line_key,position,order_id,piece_id,parent_key,estimate_revision_id,service_line_id,addition_line_id,content) values(${shopId}::uuid,${ids.id}::uuid,${l.key},${l.sequence},${l.orderId}::uuid,${l.pieceId}::uuid,${l.parentKey},${l.estimateRevisionId}::uuid,${l.serviceLineId}::uuid,${l.additionLineId}::uuid,${JSON.stringify(l)}::jsonb)`,
        );
      await tx.execute(
        sql`insert into booking_quotation_private(shop_id,revision_id,input,content) values(${shopId}::uuid,${ids.id}::uuid,${JSON.stringify(sharedCost)}::jsonb,${JSON.stringify(privateCosts)}::jsonb)`,
      );
      const changed =
        v.version === 1
          ? await tx.execute(
              sql`insert into booking_quotation(shop_id,id,current_revision_id,version) values(${shopId}::uuid,${v.familyId}::uuid,${ids.id}::uuid,1) on conflict do nothing returning id`,
            )
          : await tx.execute(
              sql`update booking_quotation set current_revision_id=${ids.id}::uuid,version=${v.version} where shop_id=${shopId}::uuid and id=${v.familyId}::uuid and version=${v.version - 1} returning id`,
            );
      if (!changed.rowCount) throw Error("Quotation family conflict");
      if (v.input.selection === "current")
        for (const o of v.source.orders)
          await tx.execute(
            sql`insert into booking_quotation_selection(shop_id,order_id,revision_id) values(${shopId}::uuid,${o.orderId}::uuid,${ids.id}::uuid) on conflict(shop_id,order_id) do update set revision_id=excluded.revision_id`,
          );
      const r = await repo.read(ids.id);
      if (!r) throw Error("Quotation unavailable");
      return r;
    },
  };
  return repo;
}
