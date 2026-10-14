import { sql, type Transaction } from "./index.js";
import type { ShopRepository } from "./repositories/shop.js";

export function shopRepository(tx: Transaction): ShopRepository {
  return {
    async read(shopId) {
      const result = await tx.execute<{ shop_id: string; name: string }>(
        sql`select shop_id, name from shop where shop_id=${shopId}::uuid`,
      );
      const row = result.rows[0];
      return row && { shopId: row.shop_id, name: row.name };
    },
  };
}
