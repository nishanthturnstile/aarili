import { directoryRevisionSchema } from "@aarili/contracts/shop-directory";
import { sql, type Transaction } from "./index.js";
import type { ShopDirectoryRepository } from "./repositories/shop-directory.js";
export function shopDirectoryRepository(
  tx: Transaction,
  shopId: string,
): ShopDirectoryRepository {
  shopId = shopId.toLowerCase();
  const columns = sql`id,schema_version as "schemaVersion",entry_id as "entryId",version,previous_id as "previousId",actor_id as "actorId",effective_at as "effectiveAt",origin_draft_id as "originDraftId",content`;
  const row = (r: Record<string, unknown>) =>
    directoryRevisionSchema.parse({
      ...r,
      effectiveAt: new Date(r.effectiveAt as string).toISOString(),
    });
  return {
    async lock() {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`directory:${shopId}`},0))`,
      );
    },
    async current(entryId) {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_directory_revision where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid and id=(select current_revision_id from shop_directory where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid)`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`select ${columns} from shop_directory_revision where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
      return r ? row(r) : undefined;
    },
    async list(before) {
      return (
        await tx.execute(
          sql`select ${columns} from shop_directory_revision where shop_id=${shopId}::uuid and id in(select current_revision_id from shop_directory where shop_id=${shopId}::uuid) and (${before ?? null}::uuid is null or entry_id<${before ?? null}::uuid) order by entry_id desc limit 26`,
        )
      ).rows.map(row);
    },
    async history(entryId, before) {
      return (
        await tx.execute(
          sql`select ${columns} from shop_directory_revision where shop_id=${shopId}::uuid and entry_id=${entryId}::uuid and (${before ?? null}::integer is null or version<${before ?? null}::integer) order by version desc limit 26`,
        )
      ).rows.map(row);
    },
    async configuration() {
      const rows = (
        await tx.execute(
          sql`select entry_id,content from shop_directory_revision where shop_id=${shopId}::uuid and id in(select current_revision_id from shop_directory where shop_id=${shopId}::uuid)`,
        )
      ).rows;
      const contents = rows.map(
        (r) =>
          r.content as {
            kind: string;
            enabled?: string[];
            method?: string;
            active?: boolean;
          },
      );
      return {
        methodsId:
          (rows.find((r) => (r.content as { kind: string }).kind === "methods")
            ?.entry_id as string) ?? null,
        enabled: contents.find((c) => c.kind === "methods")?.enabled ?? [],
        accounts: contents
          .filter((c) => c.kind === "account")
          .map((c) => ({ method: c.method ?? "", active: c.active === true })),
      };
    },
    async append(r) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Directory identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${r.actorId}::uuid,'shop-directory.publish','shop_directory_revision',${ids.id}::uuid,${r.requestId}::uuid,${r.key}::uuid,${JSON.stringify({ version: r.version, kind: r.content.kind })}::jsonb)`,
      );
      const inserted = (
        await tx.execute(
          sql`insert into shop_directory_revision(shop_id,id,entry_id,kind,version,previous_id,actor_id,audit_id,origin_draft_id,content) values(${shopId}::uuid,${ids.id}::uuid,${r.entryId}::uuid,${r.content.kind},${r.version},${r.previousId}::uuid,${r.actorId}::uuid,${ids.audit}::uuid,${r.originDraftId}::uuid,${JSON.stringify(r.content)}::jsonb) returning ${columns}`,
        )
      ).rows[0];
      if (!inserted) throw Error("Directory revision unavailable");
      return row(inserted);
    },
    async advance(r, expected) {
      const result =
        expected === 0
          ? await tx.execute(
              sql`insert into shop_directory(shop_id,entry_id,kind,current_revision_id,version) values(${shopId}::uuid,${r.entryId}::uuid,${r.content.kind},${r.id}::uuid,${r.version}) on conflict(shop_id,entry_id) do nothing returning entry_id`,
            )
          : await tx.execute(
              sql`update shop_directory set current_revision_id=${r.id}::uuid,version=${r.version} where shop_id=${shopId}::uuid and entry_id=${r.entryId}::uuid and version=${expected} returning entry_id`,
            );
      return !!result.rowCount;
    },
    async origin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from shop_directory_revision where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
  };
}
