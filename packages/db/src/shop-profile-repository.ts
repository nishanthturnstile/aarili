import { shopProfileRevisionSchema } from "@aarili/contracts/shop-profile";
import { sql, type Transaction } from "./index.js";
import type { ShopProfileRepository } from "./repositories/shop-profile.js";
import { requestRepository } from "./request-repository.js";

export function shopProfileRepository(
  tx: Transaction,
  shopId: string,
): ShopProfileRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`id,version,previous_id as "previousId",actor_id as "actorId",effective_at as "effectiveAt",baseline,profile`;
  function row(r: Record<string, unknown>) {
    return shopProfileRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  }
  return {
    ...requestRepository(tx, shopId),
    async lock() {
      await tx.execute(
        sql`select shop_id from shop where shop_id=${shopId}::uuid for update`,
      );
    },
    async initialName() {
      return (
        await tx.execute<{ name: string }>(
          sql`select name from shop where shop_id=${shopId}::uuid`,
        )
      ).rows[0]?.name;
    },
    async current() {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_profile_revision where shop_id=${shopId}::uuid and id=(select current_revision_id from shop_profile where shop_id=${shopId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_profile_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async history(before) {
      return (
        await tx.execute(
          sql`select ${columns} from shop_profile_revision where shop_id=${shopId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(row);
    },
    async logoReady(id) {
      // Share lock prevents any future privacy lifecycle transition racing the bind.
      const r = await tx.execute(
        sql`select id from media_asset where shop_id=${shopId}::uuid and id=${id}::uuid and subject_id=${shopId}::uuid and purpose='shop-branding' and status='ready' and not minor and visibility='private' for share`,
      );
      return !!r.rowCount;
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Profile identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,${r.baseline ? "shop-profile.baseline" : "shop-profile.revise"},'shop_profile_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.version, baseline: r.baseline })}::jsonb)`,
      );
      const inserted = (
        await tx.execute(
          sql`insert into shop_profile_revision(shop_id,id,version,previous_id,actor_id,audit_id,baseline,profile,logo_asset_id) values(${shopId}::uuid,${ids.id}::uuid,${r.version},${r.previousId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.baseline},${JSON.stringify(r.profile)}::jsonb,${r.profile.logoAssetId}::uuid) returning ${columns}`,
        )
      ).rows[0];
      if (!inserted) throw Error("Profile revision unavailable");
      if (r.profile.logoAssetId)
        await tx.execute(
          sql`insert into media_reference(shop_id,asset_id,reference_id) values(${shopId}::uuid,${r.profile.logoAssetId}::uuid,${ids.id}::uuid)`,
        );
      return row(inserted);
    },
    async advance(r, expected) {
      const result =
        expected === null
          ? await tx.execute(
              sql`insert into shop_profile(shop_id,current_revision_id,version) values(${shopId}::uuid,${r.id}::uuid,${r.version}) on conflict(shop_id) do nothing returning shop_id`,
            )
          : await tx.execute(
              sql`update shop_profile set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and version=${expected} returning shop_id`,
            );
      if (!result.rowCount) return false;
      const renamed = await tx.execute(
        sql`update shop set name=${r.profile.displayName} where shop_id=${shopId}::uuid returning shop_id`,
      );
      if (!renamed.rowCount) throw Error("Canonical shop identity unavailable");
      return true;
    },
  };
}
