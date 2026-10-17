import { OwnerRequestError } from "@aarili/api/client";
import {
  readCustomer,
  readCustomerPolicy,
  searchCustomers,
} from "@aarili/api/customer-client";
import type { createOwnerQueries } from "./owner-query";

// Shop/identity-scoped, memory-only server state. Personal search values are
// request bodies, never query keys, URLs, storage or diagnostics.
export function createCustomerQueries(
  owner: ReturnType<typeof createOwnerQueries>,
  shopId: string,
) {
  let sequence = 0;
  async function query<T>(
    part: string,
    load: (signal: AbortSignal) => Promise<T>,
    external?: AbortSignal,
  ) {
    const epoch = owner.version();
    const data = await owner.client.fetchQuery({
      queryKey: ["shop", shopId, "customers", epoch, part, ++sequence],
      queryFn: ({ signal }) =>
        load(external ? AbortSignal.any([signal, external]) : signal),
      gcTime: 0,
    });
    if (!owner.isCurrent(epoch)) throw new OwnerRequestError("UNAUTHENTICATED");
    return data;
  }
  return {
    policy: (signal?: AbortSignal) =>
      query("policy", (s) => readCustomerPolicy(shopId, s), signal),
    profile: (id: string, signal?: AbortSignal) =>
      query("profile", (s) => readCustomer(shopId, id, s), signal),
    search: (
      input: Parameters<typeof searchCustomers>[1],
      signal?: AbortSignal,
    ) => query("search", (s) => searchCustomers(shopId, input, s), signal),
  };
}
