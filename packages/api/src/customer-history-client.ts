import {
  type CustomerHistoryQuery,
  customerHistoryPageSchema,
  customerHistoryQuerySchema,
} from "@aarili/contracts/customer-history";
import { hc } from "hono/client";
import { authenticatedResult } from "./client.js";
import type { createCustomerHistoryRoutes } from "./customer-history.js";

export async function readCustomerHistory(
  shopId: string,
  input: CustomerHistoryQuery,
  signal?: AbortSignal,
) {
  const client = hc<ReturnType<typeof createCustomerHistoryRoutes>>("/api");
  return customerHistoryPageSchema.parse(
    await authenticatedResult((s) =>
      client.shops[":shopId"]["customer-history"].$post(
        { param: { shopId }, json: customerHistoryQuerySchema.parse(input) },
        {
          init: {
            cache: "no-store",
            signal: signal ? AbortSignal.any([s, signal]) : s,
          },
        },
      ),
    ),
  );
}
