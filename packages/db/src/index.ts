import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export { sql } from "drizzle-orm";

export function createDatabase(connectionString: string, max = 5) {
  const pool = new pg.Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 3000,
  });
  return { pool, db: drizzle({ client: pool }) };
}
export type Database = ReturnType<typeof createDatabase>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function requireRuntimeRole(
  db: Database | Transaction,
): Promise<void> {
  const result = await db.execute(
    sql`select current_user as role, session_user as login, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication,
      exists(select 1 from pg_roles privileged where (privileged.rolname in ('app_owner','app_backup','app_privacy') or privileged.rolsuper or privileged.rolbypassrls or privileged.rolcreatedb or privileged.rolcreaterole or privileged.rolreplication) and pg_has_role(current_user, privileged.oid, 'MEMBER')) as privileged_member,
      exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where pg_has_role(current_user,c.relowner,'MEMBER') and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_') as owns_relations
      from pg_roles where rolname = current_user`,
  );
  const row = result.rows[0];
  if (
    row?.role !== "app_user" ||
    row.login !== "app_user" ||
    row.rolsuper ||
    row.rolbypassrls ||
    row.rolcreatedb ||
    row.rolcreaterole ||
    row.rolreplication ||
    row.privileged_member ||
    row.owns_relations
  )
    throw new Error("Runtime database role denied");
}

export class ShopAccessError extends Error {
  constructor() {
    super("Shop access denied");
  }
}
const identifier =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The caller supplies only the server-resolved identity. Membership is checked
// before shop context, and all work uses this transaction (never the outer pool).
export async function withShop<T>(
  db: Database,
  userId: string,
  shopId: string,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  if (!identifier.test(userId) || !identifier.test(shopId))
    throw new ShopAccessError();
  return db.transaction(async (tx) => {
    await requireRuntimeRole(tx);
    // Reset all context before bootstrap, even on a reused physical connection.
    await tx.execute(
      sql`select set_config('app.user_id', ${userId}, true), set_config('app.shop_id', '', true), set_config('app.actor_id', '', true), set_config('statement_timeout', '10000', true), set_config('idle_in_transaction_session_timeout', '15000', true)`,
    );
    const own = await tx.execute(
      sql`select 1 from shop_membership where shop_id = ${shopId}::uuid and user_id = ${userId}::uuid`,
    );
    if (!own.rowCount) throw new ShopAccessError();
    await tx.execute(
      sql`select set_config('app.shop_id', ${shopId}, true), set_config('app.actor_id', ${userId}, true)`,
    );
    return run(tx);
  });
}
