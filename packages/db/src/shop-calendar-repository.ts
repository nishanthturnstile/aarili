import { shopCalendarRevisionSchema } from "@aarili/contracts/shop-calendar";
import { sql, type Transaction } from "./index.js";
import type { ShopCalendarRepository } from "./repositories/shop-calendar.js";

export function shopCalendarRepository(
  tx: Transaction,
  shopId: string,
): ShopCalendarRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`id,version,previous_id as "previousId",actor_id as "actorId",effective_at as "effectiveAt",origin_draft_id as "originDraftId",schema_version as "schemaVersion",calendar`;
  function row(r: Record<string, unknown>) {
    return shopCalendarRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  }
  return {
    async lock() {
      // Covers first publication without a pointer row; independent of profile.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`calendar:${shopId}`},0))`,
      );
    },
    async current() {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_calendar_revision where shop_id=${shopId}::uuid and id=(select current_revision_id from shop_calendar where shop_id=${shopId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_calendar_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async history(before) {
      return (
        await tx.execute(
          sql`select ${columns} from shop_calendar_revision where shop_id=${shopId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(row);
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Calendar identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'shop-calendar.publish','shop_calendar_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.version, domain: r.domain })}::jsonb)`,
      );
      const inserted = (
        await tx.execute(
          sql`insert into shop_calendar_revision(shop_id,id,version,previous_id,actor_id,audit_id,origin_draft_id,schema_version,calendar) values(${shopId}::uuid,${ids.id}::uuid,${r.version},${r.previousId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,1,${JSON.stringify(r.calendar)}::jsonb) returning ${columns}`,
        )
      ).rows[0];
      if (!inserted) throw Error("Calendar revision unavailable");
      return row(inserted);
    },
    async advance(r, expected) {
      const result =
        expected === 0
          ? await tx.execute(
              sql`insert into shop_calendar(shop_id,current_revision_id,version) values(${shopId}::uuid,${r.id}::uuid,${r.version}) on conflict(shop_id) do nothing returning shop_id`,
            )
          : await tx.execute(
              sql`update shop_calendar set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and version=${expected} returning shop_id`,
            );
      return !!result.rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from shop_calendar_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
}
