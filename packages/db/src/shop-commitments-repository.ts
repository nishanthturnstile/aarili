import {
  commitmentBindingRevisionSchema,
  shopCommitmentsRevisionSchema,
} from "@aarili/contracts/shop-commitments";
import { sql, type Transaction } from "./index.js";
import type {
  CommitmentBindingsRepository,
  ShopCommitmentsRepository,
} from "./repositories/shop-commitments.js";

export function commitmentBindingsRepository(
  tx: Transaction,
  shopId: string,
): CommitmentBindingsRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`id,category_id as "categoryId",category_revision_id as "categoryRevisionId",availability_id as "availabilityId",rule_revision_id as "ruleRevisionId",base_version as "baseVersion",previous_id as "baseRevisionId",previous_id as "previousId",version,actor_id as "actorId",effective_at as "effectiveAt",origin_draft_id as "originDraftId",schema_version as "schemaVersion",review,reason,authority,digest`;
  const row = (r: Record<string, unknown>) =>
    commitmentBindingRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  const repo: CommitmentBindingsRepository = {
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`commitment-bindings:${shopId}`},0))`,
      );
    },
    async current(categoryId) {
      const r = (
        await tx.execute(
          sql`select ${columns} from service_commitment_binding_revision where shop_id=${shopId}::uuid and id=(select current_revision_id from service_commitment_binding where shop_id=${shopId}::uuid and category_id=${categoryId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from service_commitment_binding_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async history(categoryId, before) {
      return (
        await tx.execute(
          sql`select ${columns} from service_commitment_binding_revision where shop_id=${shopId}::uuid and category_id=${categoryId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(row);
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() id,uuidv7() audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Binding identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'service-commitment-binding.publish','service_commitment_binding_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.baseVersion + 1, authority: r.authority })}::jsonb)`,
      );
      const inserted = (
        await tx.execute(
          sql`insert into service_commitment_binding_revision(shop_id,id,category_id,category_revision_id,availability_id,rule_revision_id,base_version,version,previous_id,actor_id,audit_id,origin_draft_id,review,reason,authority,digest) values(${shopId}::uuid,${ids.id}::uuid,${r.categoryId}::uuid,${r.categoryRevisionId}::uuid,${r.availabilityId}::uuid,${r.ruleRevisionId}::uuid,${r.baseVersion},${r.baseVersion + 1},${r.baseRevisionId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,${r.review},${r.reason},${r.authority},${r.digest}) returning ${columns}`,
        )
      ).rows[0];
      if (!inserted) throw Error("Binding revision unavailable");
      return row(inserted);
    },
    async advance(r, expected) {
      return !!(
        await (expected === 0
          ? tx.execute(
              sql`insert into service_commitment_binding(shop_id,category_id,current_revision_id,version) values(${shopId}::uuid,${r.categoryId}::uuid,${r.id}::uuid,${r.version}) on conflict do nothing returning category_id`,
            )
          : tx.execute(
              sql`update service_commitment_binding set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and category_id=${r.categoryId}::uuid and version=${expected} returning category_id`,
            ))
      ).rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from service_commitment_binding_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
  return repo;
}

export function shopCommitmentsRepository(
  tx: Transaction,
  shopId: string,
): ShopCommitmentsRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`id,version,previous_id as "previousId",actor_id as "actorId",effective_at as "effectiveAt",origin_draft_id as "originDraftId",schema_version as "schemaVersion",authority_scope as "authorityScope",configuration`;
  function row(r: Record<string, unknown>) {
    return shopCommitmentsRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  }
  return {
    async lock() {
      // Covers first publication without a pointer row; independent of profile.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`commitments:${shopId}`},0))`,
      );
    },
    async current() {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_commitments_revision where shop_id=${shopId}::uuid and id=(select current_revision_id from shop_commitments where shop_id=${shopId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_commitments_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async history(before) {
      return (
        await tx.execute(
          sql`select ${columns} from shop_commitments_revision where shop_id=${shopId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(row);
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Commitments identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'shop-commitments.publish','shop_commitments_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.version })}::jsonb)`,
      );
      const inserted = (
        await tx.execute(
          sql`insert into shop_commitments_revision(shop_id,id,version,previous_id,actor_id,audit_id,origin_draft_id,schema_version,configuration) values(${shopId}::uuid,${ids.id}::uuid,${r.version},${r.previousId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,1,${JSON.stringify(r.configuration)}::jsonb) returning ${columns}`,
        )
      ).rows[0];
      if (!inserted) throw Error("Commitments revision unavailable");
      return row(inserted);
    },
    async advance(r, expected) {
      const result =
        expected === 0
          ? await tx.execute(
              sql`insert into shop_commitments(shop_id,current_revision_id,version) values(${shopId}::uuid,${r.id}::uuid,${r.version}) on conflict(shop_id) do nothing returning shop_id`,
            )
          : await tx.execute(
              sql`update shop_commitments set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and version=${expected} returning shop_id`,
            );
      return !!result.rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from shop_commitments_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
}
