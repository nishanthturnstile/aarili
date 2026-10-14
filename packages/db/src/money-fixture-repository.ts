import { moneyValuesSchema } from "@aarili/contracts/money";
import { fromPostgresBigint, toPostgresBigint } from "@aarili/money";
import { sql, type Transaction } from "./index.js";
import type { MoneyFixtureRepository } from "./repositories/money-fixture.js";

// Only usable after installing the disposable fixture. No production table.
export function moneyFixtureRepository(
  tx: Transaction,
): MoneyFixtureRepository {
  return {
    async insert(input) {
      const values = moneyValuesSchema.parse(input);
      const result = await tx.execute<{ id: string }>(sql`
        insert into synthetic_money_value(shop_id,amount_paise,length_mm)
        values(NULLIF(current_setting('app.shop_id',true),'')::uuid,
          ${toPostgresBigint(values.amountPaise)}::bigint,${toPostgresBigint(values.lengthMm)}::bigint)
        returning id`);
      const id = result.rows[0]?.id;
      if (!id) throw new Error("Synthetic money insert failed");
      return id;
    },
    async read(id) {
      // Text casts explicitly bypass int8 parser overrides; range-check before
      // number conversion. Unknown/foreign IDs share the same absent result.
      const result = await tx.execute<{
        amount_paise: string;
        length_mm: string;
      }>(sql`
        select amount_paise::text,length_mm::text from synthetic_money_value
        where shop_id=NULLIF(current_setting('app.shop_id',true),'')::uuid and id=${id}::uuid`);
      const row = result.rows[0];
      return (
        row &&
        moneyValuesSchema.parse({
          amountPaise: fromPostgresBigint(row.amount_paise),
          lengthMm: fromPostgresBigint(row.length_mm),
        })
      );
    },
  };
}
