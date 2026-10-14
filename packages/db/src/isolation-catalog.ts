import { type Database, requireRuntimeRole, sql } from "./index.js";

// Exact global-table exceptions, never a prefix allow-list. Future pg-boss
// relations must be enumerated when its real schema lands; none exist today.
const globalTables = new Set([
  "public.auth_user",
  "public.auth_account",
  "public.auth_session",
  "public.auth_verification",
  "public.auth_rate_limit",
  "public.auth_connection_event",
  "public.owner_bootstrap",
  "public.owner_verification",
  "public.application_rate_limit",
  "public.aarili_migration",
]);
type Policy = {
  name: string;
  command: string;
  permissive: boolean;
  applies: boolean;
  using: string | null;
  check: string | null;
};
type Relation = {
  table: string;
  owner: string;
  rls: boolean;
  forced: boolean;
  tenant: boolean;
  tenant_valid: boolean;
  shop_key: boolean;
  bad_fk: boolean;
  policies: Policy[];
  read: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  unsafe_grants: boolean;
  backup_read: boolean;
  backup_write: boolean;
  privacy_access: boolean;
};
const normal = (value: string | null) =>
  value?.replaceAll(/\s|\(|\)|::text|public\./g, "");

export async function assertIsolationCatalog(db: Database) {
  await requireRuntimeRole(db);
  const roles =
    await db.execute(sql`select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    from pg_roles where rolname in ('app_owner','app_backup','app_privacy')`);
  for (const name of ["app_owner", "app_backup", "app_privacy"]) {
    const role = roles.rows.find((r) => r.rolname === name);
    if (
      !role ||
      role.rolsuper ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolreplication ||
      role.rolbypassrls !== (name === "app_backup") ||
      (name !== "app_owner" && role.rolcanlogin)
    )
      throw new Error(`Isolation role drift: ${name}`);
  }
  const result = await db.execute<Relation>(sql`
    select n.nspname||'.'||c.relname as table, pg_get_userbyid(c.relowner) as owner,
      c.relrowsecurity as rls, c.relforcerowsecurity as forced,
      exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='shop_id' and not a.attisdropped) as tenant,
      exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='shop_id' and a.attnotnull and a.atttypid='uuid'::regtype) as tenant_valid,
      exists(select 1 from pg_index i join pg_attribute a on a.attrelid=c.oid and a.attnum=i.indkey[0] where i.indrelid=c.oid and i.indisunique and i.indisvalid and a.attname='shop_id') as shop_key,
      exists(select 1 from pg_constraint f
        where f.conrelid=c.oid and f.contype='f'
          and exists(select 1 from pg_attribute a where a.attrelid=f.confrelid and a.attname='shop_id' and not a.attisdropped)
          and not exists(select 1 from pg_attribute a join pg_attribute b on b.attrelid=f.confrelid and b.attnum=f.confkey[1]
            where a.attrelid=c.oid and a.attnum=f.conkey[1] and a.attname='shop_id' and b.attname='shop_id')) as bad_fk,
      coalesce((select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
        'applies', exists(select 1 from unnest(p.polroles) r where case when r=0 then true else pg_has_role('app_user',r,'MEMBER') end),
        'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)))
        from pg_policy p where p.polrelid=c.oid),'[]'::jsonb) as policies,
      has_any_column_privilege('app_user',c.oid,'SELECT') as read,
      has_any_column_privilege('app_user',c.oid,'INSERT') as insert,
      has_any_column_privilege('app_user',c.oid,'UPDATE') as update,
      has_table_privilege('app_user',c.oid,'DELETE') as delete,
      (has_table_privilege('app_user',c.oid,'TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('app_user',c.oid,'REFERENCES')) as unsafe_grants,
      has_table_privilege('app_backup',c.oid,'SELECT') as backup_read,
      (has_table_privilege('app_backup',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('app_backup',c.oid,'INSERT,UPDATE,REFERENCES')) as backup_write,
      (has_table_privilege('app_privacy',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('app_privacy',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) as privacy_access
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_'
    order by n.nspname,c.relname`);
  for (const row of result.rows) {
    const fail = (detail: string): never => {
      throw new Error(`Isolation catalog drift: ${row.table}: ${detail}`);
    };
    if (row.owner !== "app_owner" || row.backup_write || row.privacy_access)
      fail("ownership/maintenance grants");
    // Global metadata includes nullable owner_bootstrap.shop_id, deliberately
    // immutable installation provenance rather than tenant-queryable records.
    if (globalTables.has(row.table)) continue;
    if (!row.tenant) fail("unclassified application table");
    if (!row.tenant_valid || !row.shop_key || row.bad_fk)
      fail("tenant constraints");
    if (!row.rls || !row.forced) fail("ENABLE/FORCE");
    if (row.unsafe_grants || !row.backup_read) fail("tenant grants");
    if (
      ["public.journal_batch", "public.journal_entry"].includes(row.table) &&
      (row.update || row.delete)
    )
      fail("append-only journal grants");
    if (
      ["public.shop", "public.shop_membership"].includes(row.table) &&
      (row.insert || row.update || row.delete)
    )
      fail("bootstrap-only write grants");
    const membership = row.table === "public.shop_membership";
    const guard = row.policies.find(
      (p) => p.name === (membership ? "membership_identity" : "tenant_context"),
    );
    const expression = membership
      ? "user_id=NULLIFcurrent_setting'app.user_id',true,''::uuid"
      : "shop_context_allowsshop_id";
    if (
      !guard ||
      guard.permissive ||
      !guard.applies ||
      guard.command !== "*" ||
      normal(guard.using) !== expression ||
      normal(guard.check) !== expression
    )
      fail("restrictive read/write guard");
    for (const [grant, command] of [
      [row.read, "r"],
      [row.insert, "a"],
      [row.update, "w"],
      [row.delete, "d"],
    ] as const) {
      if (!grant) continue; // No grant plus default-deny is intentional for bootstrap-only tables.
      if (
        !row.policies.some(
          (p) =>
            p.applies &&
            p.permissive &&
            (p.command === command || p.command === "*") &&
            (command === "a"
              ? p.check
              : command === "w"
                ? p.using && p.check
                : p.using),
        )
      )
        fail(`effective ${command} coverage`);
    }
  }
  return result.rows
    .filter((r) => r.tenant && !globalTables.has(r.table))
    .map((r) => r.table);
}
