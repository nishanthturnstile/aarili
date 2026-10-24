import { draftRecordSchema } from "@aarili/contracts/drafts";
import {
  quotePolicyBindingSchema,
  rateRevisionSchema,
} from "@aarili/contracts/quotation-rates";
import { sql, type Transaction } from "./index.js";
import type { QuotationRatesRepository } from "./repositories/quotation-rates.js";
export function quotationRatesRepository(
  tx: Transaction,
  shopId: string,
): QuotationRatesRepository {
  shopId = shopId.toLowerCase();
  const rateColumns = sql`r.id,r.rate_id as "rateId",r.version,r.previous_id as "previousId",r.origin_draft_id as "originDraftId",r.actor_id as "actorId",r.recorded_at as "recordedAt",r.content_hash as "contentHash",r.content`;
  const rate = (r: Record<string, unknown>) =>
    rateRevisionSchema.parse({
      ...(r.content as object),
      id: r.id,
      rateId: r.rateId,
      version: r.version,
      previousId: r.previousId,
      originDraftId: r.originDraftId,
      actorId: r.actorId,
      contentHash: r.contentHash,
      recordedAt: new Date(r.recordedAt as string).toISOString(),
    });
  const policyColumns = sql`p.id,p.kind,p.version,p.previous_id as "previousId",p.origin_draft_id as "originDraftId",p.actor_id as "actorId",p.recorded_at as "recordedAt",p.source_draft_id as "sourceDraftId",p.source_draft_version as "sourceDraftVersion",p.source_hash as "sourceHash",p.policy,p.reason,p.authority,'quotation-only' as "actionScope",exists(select 1 from durable_draft d where d.shop_id=p.shop_id and d.id=p.source_draft_id and d.version=p.source_draft_version and d.lifecycle='active' and encode(sha256(convert_to(d.payload::text,'UTF8')),'hex')=p.source_hash) as "sourceCurrent"`;
  const policy = (r: Record<string, unknown>) =>
    quotePolicyBindingSchema.parse({
      ...r,
      recordedAt: new Date(r.recordedAt as string).toISOString(),
    });
  async function identity() {
    const r = (
      await tx.execute<{ id: string; audit: string }>(
        sql`select uuidv7() id,uuidv7() audit`,
      )
    ).rows[0];
    if (!r) throw Error("Rate identity unavailable");
    return r;
  }
  async function audit(
    ids: { id: string; audit: string },
    actorId: string,
    action: string,
    key: string,
    requestId: string,
    version: number,
  ) {
    await tx.execute(
      sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${actorId}::uuid,${action},'quotation_configuration',${ids.id}::uuid,${requestId}::uuid,${key}::uuid,${JSON.stringify({ version })}::jsonb)`,
    );
  }
  const repo: QuotationRatesRepository = {
    async now() {
      const r = (
        await tx.execute<{ now: Date }>(sql`select statement_timestamp() now`)
      ).rows[0];
      return new Date(r?.now ?? NaN);
    },
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`quotation-rates:${shopId}`},0))`,
      );
    },
    async current(id) {
      const r = (
        await tx.execute(
          sql`select ${rateColumns} from quotation_rate_revision r join quotation_rate i on (i.shop_id,i.current_revision_id)=(r.shop_id,r.id) where r.shop_id=${shopId}::uuid and i.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? rate(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${rateColumns} from quotation_rate_revision r where r.shop_id=${shopId}::uuid and r.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? rate(r) : undefined;
    },
    async list(before) {
      return (
        await tx.execute(
          sql`select ${rateColumns} from quotation_rate_revision r join quotation_rate i on(i.shop_id,i.current_revision_id)=(r.shop_id,r.id) where r.shop_id=${shopId}::uuid and (${before ?? null}::uuid is null or i.id<${before ?? null}::uuid) order by i.id desc limit 26`,
        )
      ).rows.map(rate);
    },
    async history(id, before) {
      return (
        await tx.execute(
          sql`select ${rateColumns} from quotation_rate_revision r where r.shop_id=${shopId}::uuid and r.rate_id=${id}::uuid and (${before ?? null}::integer is null or r.version<${before ?? null}::integer) order by r.version desc limit 26`,
        )
      ).rows.map(rate);
    },
    async owner(entryId, component, unit) {
      const r = (
        await tx.execute<{ id: string }>(
          sql`select id from quotation_rate where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid and component=${component} and unit=${unit}`,
        )
      ).rows[0];
      return r?.id ?? null;
    },
    async append(input) {
      const { key, requestId, ...v } = input,
        ids = await identity();
      await audit(
        ids,
        v.actorId,
        "pricing.rate.publish",
        key,
        requestId,
        v.version,
      );
      await tx.execute(
        sql`insert into quotation_rate_revision(shop_id,id,rate_id,version,previous_id,origin_draft_id,actor_id,audit_id,entry_id,source_revision_id,definition_id,profile_revision_id,content) values(${shopId}::uuid,${ids.id}::uuid,${v.rateId}::uuid,${v.version},${v.previousId}::uuid,${v.originDraftId}::uuid,${v.actorId}::uuid,${ids.audit}::uuid,${v.source.entryId}::uuid,${v.source.revisionId}::uuid,${v.definitionId}::uuid,${v.profileRevisionId}::uuid,${JSON.stringify(v)}::jsonb)`,
      );
      for (const [position, e] of v.entries.entries())
        await tx.execute(
          sql`insert into quotation_rate_entry(shop_id,revision_id,entry_id,position,valid_from,valid_until,rate_paise) values(${shopId}::uuid,${ids.id}::uuid,${e.entryId}::uuid,${position},${e.from}::date,${e.until}::date,${String(e.ratePaise)}::bigint)`,
        );
      const r = await repo.read(ids.id);
      if (!r) throw Error("Rate revision unavailable");
      return r;
    },
    async advance(r, expected) {
      const result =
        expected === 0
          ? await tx.execute(
              sql`insert into quotation_rate(shop_id,id,entry_id,component,unit,basis_quantity,current_revision_id,version) values(${shopId}::uuid,${r.rateId}::uuid,${r.source.entryId}::uuid,${r.component},${r.unit},${String(r.basisQuantity)}::bigint,${r.id}::uuid,${r.version}) on conflict do nothing returning id`,
            )
          : await tx.execute(
              sql`update quotation_rate set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and id=${r.rateId}::uuid and version=${expected} returning id`,
            );
      return !!result.rowCount;
    },
    async origin(id, draftId, kind) {
      return !!(
        await tx.execute(
          kind === "rate"
            ? sql`select id from quotation_rate_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`
            : sql`select id from quotation_policy_binding where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async sourceDraft(id) {
      const r = (
        await tx.execute(
          sql`select id,workflow,schema_version as "schemaVersion",creator_id as "creatorId",lifecycle,version,payload,created_at as "createdAt",updated_at as "updatedAt",false as stale,null as result,encode(sha256(convert_to(payload::text,'UTF8')),'hex') hash from durable_draft where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      if (!r) return undefined;
      const { hash, ...draftFields } = r;
      return {
        draft: draftRecordSchema.parse({
          ...draftFields,
          createdAt: new Date(r.createdAt as string).toISOString(),
          updatedAt: new Date(r.updatedAt as string).toISOString(),
        }),
        hash: String(hash),
      };
    },
    async policyCurrent(kind) {
      const r = (
        await tx.execute(
          sql`select ${policyColumns} from quotation_policy_binding p where p.shop_id=${shopId}::uuid and p.kind=${kind} order by p.version desc limit 1`,
        )
      ).rows[0];
      return r ? policy(r) : undefined;
    },
    async policyHistory(kind, before) {
      return (
        await tx.execute(
          sql`select ${policyColumns} from quotation_policy_binding p where p.shop_id=${shopId}::uuid and p.kind=${kind} and (${before ?? null}::integer is null or p.version<${before ?? null}::integer) order by p.version desc limit 26`,
        )
      ).rows.map(policy);
    },
    async bind(v) {
      const ids = await identity();
      await audit(
        ids,
        v.actorId,
        "pricing.policy.review",
        v.key,
        v.requestId,
        v.version,
      );
      await tx.execute(
        sql`insert into quotation_policy_binding(shop_id,id,kind,version,previous_id,origin_draft_id,actor_id,audit_id,source_draft_id,source_draft_version,source_hash,policy,reason,authority) values(${shopId}::uuid,${ids.id}::uuid,${v.kind},${v.version},${v.previousId}::uuid,${v.originDraftId}::uuid,${v.actorId}::uuid,${ids.audit}::uuid,${v.sourceDraftId}::uuid,${v.sourceDraftVersion},${v.sourceHash},${JSON.stringify(v.policy)}::jsonb,${v.reason},${v.authority})`,
      );
      const r = await repo.policyCurrent(v.kind);
      if (!r) throw Error("Policy binding unavailable");
      return r;
    },
  };
  return repo;
}
