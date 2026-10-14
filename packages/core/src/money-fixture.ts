import { decodeMoneyValues, encodeMoneyValues } from "@aarili/contracts/money";
import type { MoneyFixtureRepository } from "@aarili/db/repositories/money-fixture";

// A synthetic proof, not a financial business command. Server composition
// authorizes membership and owns the transaction; no driver/framework leaks.
export async function roundTripMoney(
  repository: MoneyFixtureRepository,
  requestJson: string,
) {
  const values = decodeMoneyValues(requestJson);
  const id = await repository.insert(values);
  const stored = await repository.read(id);
  if (
    !stored ||
    stored.amountPaise !== values.amountPaise ||
    stored.lengthMm !== values.lengthMm
  )
    throw new Error("Synthetic exact-value round trip failed");
  return { id, responseJson: encodeMoneyValues(stored) };
}
