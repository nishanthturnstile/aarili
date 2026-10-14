import type { MoneyValues } from "@aarili/contracts/money";

// Synthetic operational boundary, bound by composition to one shop transaction.
export interface MoneyFixtureRepository {
  insert(values: MoneyValues): Promise<string>;
  read(id: string): Promise<MoneyValues | undefined>;
}
