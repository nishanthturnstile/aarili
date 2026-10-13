import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export { sql } from "drizzle-orm";

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
  });
  return { pool, db: drizzle({ client: pool }) };
}
export type Database = ReturnType<typeof createDatabase>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function requireRuntimeRole(db: Database): Promise<void> {
  const result = await db.execute(
    sql`select current_user as role, rolsuper, rolbypassrls, pg_has_role(current_user, 'app_owner', 'MEMBER') as owner_member from pg_roles where rolname = current_user`,
  );
  const row = result.rows[0];
  if (
    row?.role !== "app_user" ||
    row.rolsuper ||
    row.rolbypassrls ||
    row.owner_member
  )
    throw new Error("Runtime database role denied");
}

// The caller supplies only the server-resolved identity. Membership is checked
// before shop context, and all work uses this transaction (never the outer pool).
export async function withShop<T>(
  db: Database,
  userId: string,
  shopId: string,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  await requireRuntimeRole(db);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    const own = await tx.execute(
      sql`select 1 from shop_membership where shop_id = ${shopId}::uuid and user_id = ${userId}::uuid`,
    );
    if (!own.rowCount) throw new Error("Shop access denied");
    await tx.execute(
      sql`select set_config('app.shop_id', ${shopId}, true), set_config('app.actor_id', ${userId}, true)`,
    );
    return run(tx);
  });
}
