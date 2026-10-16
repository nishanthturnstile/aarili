import type {
  UsageEvent,
  UsagePeriod,
  UsageReadout,
} from "@aarili/contracts/usage";
// Bound only to an authorised withShop transaction; no independent connection.
export interface UsageRepository {
  append(event: UsageEvent): Promise<void>;
  read(period: UsagePeriod): Promise<UsageReadout>;
}
