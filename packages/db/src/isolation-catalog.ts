import { type Database, requireRuntimeRole, sql } from "./index.js";

// Exact global-table exceptions, never a schema/prefix allow-list.
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
  "public.system_state",
  "public.system_control_event",
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
  parent: string | null;
};
const normal = (value: string | null) =>
  value?.replaceAll(/\s|\(|\)|::text|public\./g, "");

export async function assertIsolationCatalog(db: Database) {
  await requireRuntimeRole(db);
  // Profile publication may update only the canonical name, behind a matching
  // revision trigger. Creation, membership and every other shop column stay denied.
  const profile = await db.execute(
    sql`select to_regclass('shop_profile') as relation`,
  );
  const profileInstalled = !!profile.rows[0]?.relation;
  if (profileInstalled) {
    const grant = (
      await db.execute(sql`select
      has_column_privilege('app_user','shop','name','UPDATE') as name,
      has_table_privilege('app_user','shop','UPDATE') as whole,
      exists(select 1 from pg_attribute where attrelid='shop'::regclass and attnum>0 and not attisdropped and attname<>'name' and has_column_privilege('app_user','shop',attname,'UPDATE')) as other,
      exists(select 1 from pg_trigger where tgrelid='shop'::regclass and tgname='shop_profile_name_guard' and tgenabled='O') as guard`)
    ).rows[0];
    if (!grant?.name || grant.whole || grant.other || !grant.guard)
      throw Error("Shop profile write authority drift");
  }
  const controls = await db.execute(
    sql`select to_regclass('system_state') as relation`,
  );
  if (controls.rows[0]?.relation) {
    const grants = await db.execute(sql`select
      has_table_privilege('app_user','system_state','SELECT') as readable,
      has_table_privilege('app_user','system_state','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('app_user','system_state','INSERT,UPDATE,REFERENCES') as writable,
      has_table_privilege('app_user','system_control_event','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('app_user','system_control_event','SELECT,INSERT,UPDATE,REFERENCES') as history_access,
      has_function_privilege('app_user','transition_restore_control(uuid,text)','EXECUTE') as transition,
      pg_has_role('app_user','app_restore_operator','MEMBER') as operator_member`);
    const g = grants.rows[0];
    if (
      !g?.readable ||
      g.writable ||
      g.history_access ||
      g.transition ||
      g.operator_member
    )
      throw new Error("Restore control authority drift");
  }
  const queueTables = new Set<string>();
  const schedules = await db.execute(
    sql`select to_regclass('job_schedule') as relation`,
  );
  if (schedules.rows[0]?.relation) {
    const access = await db.execute(sql`select
      has_function_privilege('app_user','configure_job_schedule(uuid,uuid,text,integer,boolean)','EXECUTE') as configure,
      has_table_privilege('app_user','job_schedule','INSERT,UPDATE,DELETE') as grants,
      has_table_privilege('app_user','job_schedule_run','INSERT,UPDATE,DELETE') as runs,
      has_table_privilege('app_user','job_schedule_event','INSERT,UPDATE,DELETE') as history`);
    const g = access.rows[0];
    if (!g || g.configure || g.grants || g.runs || g.history)
      throw Error("Scheduled authority drift");
  }
  const installed = await db.execute(
    sql`select to_regclass('pgboss.version') as relation`,
  );
  if (installed.rows[0]?.relation) {
    for (const name of [
      "version",
      "queue",
      "schedule",
      "subscription",
      "bam",
      "job",
      "job_common",
      "warning",
      "queue_stats",
      "job_dependency",
      "instance",
    ])
      queueTables.add(`pgboss.${name}`);
    const dates = await db.execute<{
      today: string;
      tomorrow: string;
    }>(sql`select to_char(applied_at at time zone 'UTC','YYYYMMDD') as today,
      to_char((applied_at at time zone 'UTC') + interval '1 day','YYYYMMDD') as tomorrow from aarili_migration where name='0006_pgboss.sql'`);
    const date = dates.rows[0];
    if (!date) throw new Error("Queue migration metadata missing");
    queueTables.add(`pgboss.queue_stats_${date.today}`);
    queueTables.add(`pgboss.queue_stats_${date.tomorrow}`);
    const schema = await db.execute(
      sql`select pg_get_userbyid(nspowner) as owner,has_schema_privilege('app_user',oid,'CREATE') as ddl from pg_namespace where nspname='pgboss'`,
    );
    if (schema.rows[0]?.owner !== "app_owner" || schema.rows[0]?.ddl)
      throw new Error("Queue schema ownership/DDL drift");
    const functions = await db.execute<{
      name: string;
      execute: boolean;
      owner: string;
    }>(sql`select p.proname as name,has_function_privilege('app_user',p.oid,'EXECUTE') as execute,pg_get_userbyid(p.proowner) as owner
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='pgboss'`);
    if (
      functions.rows.some(
        (f) => f.owner !== "app_owner" || f.execute !== (f.name === "job_now"),
      )
    )
      throw new Error("Queue runtime function/DDL drift");
    const version = await db.execute(sql`select version from pgboss.version`);
    if (version.rows.length !== 1 || version.rows[0]?.version !== 45)
      throw new Error("Queue schema version drift");
    const queues = await db.execute(
      sql`select name,table_name,partition from pgboss.queue`,
    );
    if (
      queues.rows.some(
        (q) =>
          ![
            "foundation.synthetic",
            "foundation.schedule",
            "foundation.dead",
            "media.process",
            "pdf.render",
          ].includes(String(q.name)) ||
          q.table_name !== "job_common" ||
          q.partition,
      )
    )
      throw new Error("Unreviewed queue relation/setup");
  }
  const roles =
    await db.execute(sql`select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    from pg_roles where rolname in ('app_owner','app_backup','app_privacy','app_restore_operator')`);
  for (const name of [
    "app_owner",
    "app_backup",
    "app_privacy",
    "app_restore_operator",
  ]) {
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
      (select pn.nspname||'.'||pc.relname from pg_inherits i join pg_class pc on pc.oid=i.inhparent join pg_namespace pn on pn.oid=pc.relnamespace where i.inhrelid=c.oid) as parent,
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
    if (queueTables.has(row.table)) {
      const jobs = ["pgboss.job", "pgboss.job_common"].includes(row.table);
      const read =
        jobs ||
        ["pgboss.version", "pgboss.queue", "pgboss.job_dependency"].includes(
          row.table,
        );
      if (
        row.tenant ||
        row.rls ||
        row.forced ||
        row.read !== read ||
        row.insert !== jobs ||
        row.update !== jobs ||
        row.delete !== jobs ||
        row.unsafe_grants ||
        !row.backup_read
      )
        fail("pinned queue grants/classification");
      const parent =
        row.table === "pgboss.job_common"
          ? "pgboss.job"
          : row.table.startsWith("pgboss.queue_stats_")
            ? "pgboss.queue_stats"
            : null;
      if (row.parent !== parent) fail("pinned queue partition parent");
      queueTables.delete(row.table);
      continue;
    }
    if (row.table.startsWith("pgboss.")) fail("unreviewed queue relation");
    // Global metadata includes nullable owner_bootstrap.shop_id, deliberately
    // immutable installation provenance rather than tenant-queryable records.
    if (globalTables.has(row.table)) continue;
    if (!row.tenant) fail("unclassified application table");
    if (!row.tenant_valid || !row.shop_key || row.bad_fk)
      fail("tenant constraints");
    if (!row.rls || !row.forced) fail("ENABLE/FORCE");
    if (row.unsafe_grants || !row.backup_read) fail("tenant grants");
    if (
      [
        "public.product_event",
        "public.document_revision",
        "public.document_output",
        "public.document_artifact",
        "public.document_share_event",
        "public.vocabulary_revision",
        "public.shop_profile_revision",
        "public.shop_presentation_revision",
        "public.order_acceptance_snapshot",
        "public.order_requirement",
        "public.order_piece_set",
        "public.booking_revision",
        "public.booking_member",
        "public.booking_membership_history",
        "public.order_piece",
        "public.order_requirement_scope",
        "public.order_capacity_demand",
        "public.order_presentation_event",
        "public.shop_directory_revision",
        "public.service_template_revision",
        "public.service_template_availability",
        "public.service_template_reference",
        "public.service_template_form",
        "public.service_template_item",
        "public.service_template_edge",
        "public.service_template_quality_task",
        "public.measurement_form_illustration",
        "public.measurement_form_revision",
        "public.measurement_form_availability",
        "public.measurement_form_reference",
        "public.service_catalogue_revision",
        "public.service_commitment_binding_revision",
        "public.service_catalogue_availability",
        "public.service_catalogue_reference",
        "public.vocabulary_search_key",
        "public.journal_batch",
        "public.journal_entry",
        "public.synthetic_job_request",
        "public.synthetic_job_effect",
        "public.synthetic_job_quarantine",
        "public.job_schedule_event",
        "public.job_schedule_run",
        "public.job_schedule_effect",
        "public.job_schedule_quarantine",
      ].includes(row.table) &&
      (row.update || row.delete)
    )
      fail("append-only journal grants");
    if (
      ["public.shop", "public.shop_membership"].includes(row.table) &&
      (row.insert ||
        (row.update && !(row.table === "public.shop" && profileInstalled)) ||
        row.delete)
    )
      fail("bootstrap-only write grants");
    if (
      [
        "public.media_asset",
        "public.media_attempt",
        "public.media_reference",
        "public.media_derivative",
        "public.media_cleanup_intent",
      ].includes(row.table) &&
      (row.delete ||
        (["public.media_reference", "public.media_derivative"].includes(
          row.table,
        ) &&
          row.update))
    )
      fail("private media history grants");
    if (
      ["public.document_attempt", "public.document_cleanup"].includes(
        row.table,
      ) &&
      row.delete
    )
      fail("document history grants");
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
  if (queueTables.size) throw new Error("Pinned queue relations missing");
  return result.rows
    .filter((r) => r.tenant && !globalTables.has(r.table))
    .map((r) => r.table);
}
