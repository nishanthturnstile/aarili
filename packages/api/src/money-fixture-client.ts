import {
  decodeMoneyValues,
  encodeMoneyValues,
  type MoneyValues,
} from "@aarili/contracts/money";

// Compiled operational client for a supplied synthetic wire transport. This
// installs no HTTP route and is not exported by the browser's API client.
export function createMoneyFixtureClient(
  transport: (requestJson: string) => Promise<string>,
) {
  return async (values: MoneyValues): Promise<MoneyValues> =>
    decodeMoneyValues(await transport(encodeMoneyValues(values)));
}
