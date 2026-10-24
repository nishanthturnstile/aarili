import {
  type EstimateVersion,
  estimateVersionSchema,
} from "@aarili/contracts/garment-estimates";
import { sql, type Transaction } from "./index.js";
import type { GarmentEstimatesRepository } from "./repositories/garment-estimates.js";

export function garmentEstimatesRepository(
  tx: Transaction,
  shopId: string,
): GarmentEstimatesRepository {
  shopId = shopId.toLowerCase();
  async function hydrate(row: Record<string, unknown>) {
    const costs = (
      await tx.execute<{
        lineId: string;
        amountPaise: string | null;
        amountText: string;
        reason: string;
      }>(
        sql`select line_id as "lineId",amount_paise::text as "amountPaise",amount_text as "amountText",reason from garment_estimate_cost where shop_id=${shopId}::uuid and revision_id=${row.id}::uuid order by position`,
      )
    ).rows;
    const content = row.content as Omit<EstimateVersion, "input"> & {
      input: Omit<EstimateVersion["input"], "privateCosts">;
    };
    const sum = costs.reduce((n, c) => n + BigInt(c.amountPaise ?? 0), 0n),
      unknown = costs.filter((c) => c.amountPaise === null).length;
    const { content: _storedContent, ...header } = row;
    return estimateVersionSchema.parse({
      ...content,
      ...header,
      input: {
        ...content.input,
        privateCosts: costs.map(({ lineId, amountText, reason }) => ({
          lineId,
          amountText,
          reason,
        })),
      },
      costs: costs.map(({ lineId, amountPaise, reason }) => ({
        lineId,
        amountPaise: amountPaise === null ? null : Number(amountPaise),
        reason,
      })),
      costSubtotalPaise: Number(sum),
      unknownCostCount: unknown,
      estimatedMarginPaise:
        content.customer.complete && unknown === 0
          ? Number(BigInt(content.customer.knownSubtotalPaise) - sum)
          : null,
      recordedAt: new Date(row.recordedAt as string).toISOString(),
    });
  }
  const columns = sql`r.id,r.estimate_id as "estimateId",r.version,r.previous_id as "previousId",r.origin_draft_id as "originDraftId",r.actor_id as "actorId",r.recorded_at as "recordedAt",r.content_hash as "contentHash",r.content`;
  const repo: GarmentEstimatesRepository = {
    async lock(id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`estimate:${shopId}:${id}`},0))`,
      );
    },
    async current(id) {
      const row = (
        await tx.execute(
          sql`select ${columns} from garment_estimate_revision r join garment_estimate i on(i.shop_id,i.current_revision_id)=(r.shop_id,r.id) where i.shop_id=${shopId}::uuid and i.id=${id}::uuid`,
        )
      ).rows[0];
      return row ? hydrate(row) : undefined;
    },
    async read(id) {
      const row = (
        await tx.execute(
          sql`select ${columns} from garment_estimate_revision r where r.shop_id=${shopId}::uuid and r.id=${id}::uuid`,
        )
      ).rows[0];
      return row ? hydrate(row) : undefined;
    },
    async history(id, before) {
      const rows = (
        await tx.execute(
          sql`select ${columns} from garment_estimate_revision r where r.shop_id=${shopId}::uuid and r.estimate_id=${id}::uuid and (${before ?? null}::int is null or r.version<${before ?? null}::int) order by r.version desc limit 26`,
        )
      ).rows;
      const result = [];
      for (const row of rows) result.push(await hydrate(row));
      return result;
    },
    async append(value) {
      const {
        key,
        requestId,
        costs,
        costSubtotalPaise: _costSum,
        unknownCostCount: _costUnknown,
        estimatedMarginPaise: _margin,
        ...body
      } = value;
      const { privateCosts, ...input } = body.input;
      const content = { ...body, input };
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() id,uuidv7() audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Estimate identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${value.actorId}::uuid,'pricing.estimate.save','garment_estimate',${ids.id}::uuid,${requestId}::uuid,${key}::uuid,${value.input.reason},${JSON.stringify({ version: value.version })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into garment_estimate_revision(shop_id,id,estimate_id,version,previous_id,origin_draft_id,actor_id,audit_id,order_id,piece_id,customer_id,wearer_id,specification_id,booking_id,commercial_id,service_subject_id,content) values(${shopId}::uuid,${ids.id}::uuid,${value.estimateId}::uuid,${value.version},${value.previousId}::uuid,${value.originDraftId}::uuid,${value.actorId}::uuid,${ids.audit}::uuid,${value.source.orderId}::uuid,${value.source.pieceId}::uuid,${value.source.customerId}::uuid,${value.source.wearerId}::uuid,${value.source.specificationId}::uuid,${value.source.bookingId}::uuid,${value.source.commercialId}::uuid,${value.source.serviceSubjectId}::uuid,${JSON.stringify(content)}::jsonb)`,
      );
      for (const [i, l] of value.customer.lines.entries()) {
        const original = value.input.lines[i],
          cost = costs.find((c) => c.lineId === l.id),
          raw = privateCosts.find((c) => c.lineId === l.id);
        const candidate = value.source.candidates.find(
          (c) => c.key === l.sourceKey,
        );
        await tx.execute(
          sql`insert into garment_estimate_line(shop_id,revision_id,line_id,position,rate_revision_id,rate_entry_id,service_line_id,addition_line_id,content) values(${shopId}::uuid,${ids.id}::uuid,${l.id}::uuid,${i},${original?.rate?.revisionId ?? null}::uuid,${original?.rate?.entryId ?? null}::uuid,${l.sourceKey?.startsWith("standalone:") ? (candidate?.lineId ?? null) : null}::uuid,${l.sourceKey?.startsWith("addition:") ? (candidate?.lineId ?? null) : null}::uuid,${JSON.stringify(l)}::jsonb)`,
        );
        await tx.execute(
          sql`insert into garment_estimate_cost(shop_id,revision_id,line_id,position,amount_paise,amount_text,reason) values(${shopId}::uuid,${ids.id}::uuid,${l.id}::uuid,${i},${cost?.amountPaise === null || cost?.amountPaise === undefined ? null : String(cost.amountPaise)}::bigint,${raw?.amountText ?? ""},${cost?.reason ?? ""})`,
        );
      }
      const advanced =
        value.version === 1
          ? await tx.execute(
              sql`insert into garment_estimate(shop_id,id,current_revision_id,version) values(${shopId}::uuid,${value.estimateId}::uuid,${ids.id}::uuid,1) on conflict do nothing returning id`,
            )
          : await tx.execute(
              sql`update garment_estimate set current_revision_id=${ids.id}::uuid,version=${value.version} where shop_id=${shopId}::uuid and id=${value.estimateId}::uuid and version=${value.version - 1} returning id`,
            );
      if (!advanced.rowCount) throw Error("Estimate pointer conflict");
      const result = await repo.read(ids.id);
      if (!result) throw Error("Estimate revision unavailable");
      return result;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from garment_estimate_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
  return repo;
}
