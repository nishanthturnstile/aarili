import {
  policyKindSchema,
  shopPoliciesRevisionSchema,
} from "@aarili/contracts/shop-policies";
import { sql, type Transaction } from "./index.js";
import type { ShopPoliciesRepository } from "./repositories/shop-policies.js";

export function shopPoliciesRepository(
  tx: Transaction,
  shopId: string,
): ShopPoliciesRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`id,version,previous_id as "previousId",actor_id as "actorId",effective_at as "effectiveAt",origin_draft_id as "originDraftId",schema_version as "schemaVersion",authority_scope as "authorityScope",policies`;
  function row(r: Record<string, unknown>) {
    return shopPoliciesRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  }
  return {
    async pendingKinds() {
      const result = await tx.execute(
        sql`select distinct payload->'policy'->>'kind' as kind from durable_draft where shop_id=${shopId}::uuid and workflow='shop.policies' and schema_version=1 and lifecycle='active'`,
      );
      return result.rows.flatMap((row) => {
        const p = policyKindSchema.safeParse(row.kind);
        return p.success ? [p.data] : [];
      });
    },
    async lock() {
      // Covers first publication without a pointer row; independent of profile.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`policies:${shopId}`},0))`,
      );
    },
    async current() {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_policies_revision where shop_id=${shopId}::uuid and id=(select current_revision_id from shop_policies where shop_id=${shopId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_policies_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async history(before) {
      return (
        await tx.execute(
          sql`select ${columns} from shop_policies_revision where shop_id=${shopId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(row);
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Policies identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'shop-policies.publish','shop_policies_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.version, kind: r.kind })}::jsonb)`,
      );
      const inserted = (
        await tx.execute(
          sql`insert into shop_policies_revision(shop_id,id,version,previous_id,actor_id,audit_id,origin_draft_id,schema_version,policies) values(${shopId}::uuid,${ids.id}::uuid,${r.version},${r.previousId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,1,${JSON.stringify(r.policies)}::jsonb) returning ${columns}`,
        )
      ).rows[0];
      if (!inserted) throw Error("Policies revision unavailable");
      return row(inserted);
    },
    async advance(r, expected) {
      const result =
        expected === 0
          ? await tx.execute(
              sql`insert into shop_policies(shop_id,current_revision_id,version) values(${shopId}::uuid,${r.id}::uuid,${r.version}) on conflict(shop_id) do nothing returning shop_id`,
            )
          : await tx.execute(
              sql`update shop_policies set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and version=${expected} returning shop_id`,
            );
      return !!result.rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from shop_policies_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
}
