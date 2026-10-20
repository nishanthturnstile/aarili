import {
  type AcceptedOrder,
  acceptedOrderSchema,
} from "@aarili/contracts/orders";
import { bookingsRepository } from "./bookings-repository.js";
import { groupIntakeRepository } from "./group-intake-repository.js";
import { sql, type Transaction } from "./index.js";
import { orderPiecesRepository } from "./order-pieces-repository.js";
import type { OrdersRepository } from "./repositories/orders.js";
import { requestRepository } from "./request-repository.js";

export function ordersRepository(
  tx: Transaction,
  shopId: string,
): OrdersRepository {
  shopId = shopId.toLowerCase();
  const select = sql`select o.id,o.code,o.origin_draft_id as "originDraftId",o.owner_id as "ownerId",o.version,o.presentation,o.accepted_at as "acceptedAt",o.price_paise::text as "pricePaise",s.content,s.digest from garment_order o join order_acceptance_snapshot s on s.shop_id=o.shop_id and s.order_id=o.id`;
  const row = (r: Record<string, unknown>): AcceptedOrder =>
    acceptedOrderSchema.parse({
      ...(r.content as object),
      id: r.id,
      code: r.code,
      originDraftId: r.originDraftId,
      ownerId: r.ownerId,
      version: r.version,
      presentation: r.presentation,
      acceptedAt: new Date(r.acceptedAt as string).toISOString(),
      createdAt: new Date(r.acceptedAt as string).toISOString(),
      pricePaise: r.pricePaise === null ? null : Number(r.pricePaise),
      snapshotDigest: r.digest,
    });
  const repo: OrdersRepository = {
    ...requestRepository(tx, shopId),
    groups: groupIntakeRepository(tx, shopId),
    bookings: bookingsRepository(tx, shopId),
    pieces: orderPiecesRepository(tx, shopId),
    async now() {
      const r = await tx.execute<{ now: Date }>(
        sql`select clock_timestamp() now`,
      );
      if (!r.rows[0]) throw Error("Clock unavailable");
      return new Date(r.rows[0].now);
    },
    async lockCapacity(categoryId) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`order-capacity:${shopId}:${categoryId.toLowerCase()}`},0))`,
      );
    },
    async lockOrder(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`order:${shopId}:${id.toLowerCase()}`},0))`,
      );
    },
    async demand(categoryId, start, end) {
      return (
        await tx.execute<{
          id: string;
          quantity: number;
          unit: string;
          deliveryDate: string;
        }>(
          sql`select order_id as id,quantity,unit,to_char(delivery_date,'YYYY-MM-DD') as "deliveryDate" from order_capacity_demand where shop_id=${shopId}::uuid and category_id=${categoryId}::uuid and delivery_date>=${start}::date and delivery_date<${end}::date order by order_id`,
        )
      ).rows;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`${select} where o.shop_id=${shopId}::uuid and o.intake_kind='custom' and o.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async list(before) {
      return (
        await tx.execute(
          sql`${select} where o.shop_id=${shopId}::uuid and o.intake_kind='custom' and (${before ?? null}::uuid is null or o.id<${before ?? null}::uuid) order by o.id desc limit 26`,
        )
      ).rows.map(row);
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from garment_order where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async accept(v) {
      // Stable tenant counter lock covers the empty table too; immutable codes never recycle.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`order-code:${shopId}`},0))`,
      );
      const r = (
        await tx.execute<{
          id: string;
          audit: string;
          n: string;
          createdAt: Date;
        }>(
          sql`select uuidv7() id,uuidv7() audit,(select (coalesce(max(code_number),0)+1)::text from garment_order where shop_id=${shopId}::uuid) n,(select created_at from durable_draft where shop_id=${shopId}::uuid and id=${v.draftId}::uuid) as "createdAt"`,
        )
      ).rows[0];
      if (!r) throw Error("Order identity unavailable");
      const code = `QO-${r.n.padStart(6, "0")}`;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${r.audit}::uuid,'user',${v.actorId}::uuid,'order.accept','garment_order',${r.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ digest: v.digest })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into garment_order(shop_id,id,code_number,code,origin_draft_id${v.originLineId ? sql`,origin_line_id` : sql``},customer_id,wearer_id,owner_id,audit_id,presentation,price_state,price_paise) values(${shopId}::uuid,${r.id}::uuid,${r.n}::bigint,${code},${v.draftId}::uuid${v.originLineId ? sql`,${v.originLineId}::uuid` : sql``},${v.intake.customerId}::uuid,${v.intake.wearerId}::uuid,${v.actorId}::uuid,${r.audit}::uuid,${v.intake.presentation},${v.intake.priceState},${v.review.intake.pricePaise?.toString() ?? null}::bigint)`,
      );
      const s = v.sources;
      const promise = {
        date: v.intake.deliveryDate,
        time: v.intake.deliveryTime,
      };
      // Personal labels remain in the authorised identity module; history pins IDs only.
      const review = {
        ...v.review,
        intake: { ...v.review.intake, customer: null, wearer: null },
      };
      const content = {
        ...(v.commercial ? { commercial: v.commercial } : {}),
        snapshot: v.snapshot,
        intake: v.intake,
        draftCreatedAt: new Date(r.createdAt).toISOString(),
        customer: null,
        wearer: null,
        pricePaise: v.review.intake.pricePaise,
        originalPromise: promise,
        currentPromise: promise,
        requirements: v.requirements,
        review,
        synthetic: true,
      };
      await tx.execute(
        sql`insert into order_acceptance_snapshot(shop_id,order_id,manifest_id,definition_id,category_id,binding_id,rule_id,calendar_id,profile_id,policies_id,presentation_id,content,digest) values(${shopId}::uuid,${r.id}::uuid,${s.manifestId}::uuid,${s.definitionId}::uuid,${s.categoryId}::uuid,${s.bindingId}::uuid,${s.ruleId}::uuid,${s.calendarId}::uuid,${s.profileId}::uuid,${s.policiesId}::uuid,${s.presentationId}::uuid,${JSON.stringify(content)}::jsonb,${v.digest})`,
      );
      for (const [i, item] of v.requirements.items.entries())
        await tx.execute(
          sql`insert into order_requirement(shop_id,order_id,position,section,source_key,assignee_id,content) values(${shopId}::uuid,${r.id}::uuid,${i},${item.section},${item.key},${item.assigneeId}::uuid,${JSON.stringify(item)}::jsonb)`,
        );
      const facts = v.review.evaluation?.facts;
      if (!facts?.unit || facts.candidate === null)
        throw Error("Demand unavailable");
      await tx.execute(
        sql`insert into order_capacity_demand(shop_id,order_id,category_id,delivery_date,unit,quantity) values(${shopId}::uuid,${r.id}::uuid,${s.categoryId}::uuid,${v.intake.deliveryDate}::date,${facts.unit},${facts.candidate})`,
      );
      await tx.execute(
        sql`insert into order_presentation_event(shop_id,order_id,version,mode,actor_id,audit_id) values(${shopId}::uuid,${r.id}::uuid,1,${v.intake.presentation},${v.actorId}::uuid,${r.audit}::uuid)`,
      );
      const result = await repo.read(r.id);
      if (!result) throw Error("Order unavailable");
      return result;
    },
    async mode(id, mode, actorId, key, requestId) {
      const current = await repo.read(id);
      if (!current) throw Error("Order unavailable");
      const audit = (await tx.execute<{ id: string }>(sql`select uuidv7() id`))
        .rows[0]?.id;
      if (!audit) throw Error("Audit identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${audit}::uuid,'user',${actorId}::uuid,'order.presentation','garment_order',${id}::uuid,${requestId}::uuid,${key}::uuid,${JSON.stringify({ mode, version: current.version + 1 })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into order_presentation_event(shop_id,order_id,version,mode,actor_id,audit_id) values(${shopId}::uuid,${id}::uuid,${current.version + 1},${mode},${actorId}::uuid,${audit}::uuid)`,
      );
      await tx.execute(
        sql`update garment_order set presentation=${mode},version=version+1 where shop_id=${shopId}::uuid and id=${id}::uuid and version=${current.version}`,
      );
    },
    async history(id, before) {
      return (
        await tx.execute<{
          version: number;
          mode: "simple" | "detailed";
          actorId: string;
          recordedAt: Date;
        }>(
          sql`select version,mode,actor_id as "actorId",recorded_at as "recordedAt" from order_presentation_event where shop_id=${shopId}::uuid and order_id=${id}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map((r) => ({
        ...r,
        recordedAt: new Date(r.recordedAt).toISOString(),
      }));
    },
  };
  return repo;
}
