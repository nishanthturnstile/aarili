import { sql, type Transaction } from "./index.js";
import type {
  RestoreRepository,
  RestoreState,
} from "./repositories/restore.js";

// Lock then read in separate statements: a waiter must see the committed
// operator transition, not a snapshot taken before waiting on the lock.
export function restoreRepository(
  tx: Transaction,
  shopId?: string,
): RestoreRepository {
  return {
    async lockState() {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(120036)`);
      const result = await tx.execute<RestoreState>(
        sql`select restore_epoch as epoch,side_effects_enabled as outbound,money_frozen as frozen from system_state where singleton`,
      );
      const state = result.rows[0];
      return state &&
        typeof state.epoch === "string" &&
        typeof state.outbound === "boolean" &&
        typeof state.frozen === "boolean"
        ? state
        : undefined;
    },
    async practice() {
      if (!shopId) return undefined;
      const result = await tx.execute<{ practice: boolean }>(
        sql`select lock_shop_practice() as practice where NULLIF(current_setting('app.shop_id',true),'')::uuid=${shopId}::uuid`,
      );
      return result.rows[0]?.practice;
    },
  };
}
