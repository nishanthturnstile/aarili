import {
  type ContactMergeCommand,
  type ContactMergeQuery,
  type CustomerHistoryQuery,
  type CustomerPairDecision,
  contactMergeCommandSchema,
  contactMergePreviewSchema,
  contactMergeQuerySchema,
  contactMergeResultSchema,
  customerHistoryPageSchema,
  customerHistoryQuerySchema,
  customerPairDecisionSchema,
  customerPairResultSchema,
  customerPairSchema,
  duplicateCandidatesSchema,
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
const client = () =>
  hc<ReturnType<typeof createCustomerHistoryRoutes>>("/api").shops[":shopId"][
    "customer-history"
  ];
export async function readDuplicateCandidates(
  shopId: string,
  customerId: string,
  after?: string,
  signal?: AbortSignal,
) {
  return duplicateCandidatesSchema.parse(
    await authenticatedResult((s) =>
      client().candidates.$post(
        {
          param: { shopId },
          json: { customerId, ...(after ? { after } : {}) },
        },
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
export async function readCustomerPair(
  shopId: string,
  firstId: string,
  secondId: string,
  signal?: AbortSignal,
) {
  return customerPairSchema.parse(
    await authenticatedResult((s) =>
      client().pair.$post(
        { param: { shopId }, json: { firstId, secondId } },
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
export async function recordCustomerPair(
  shopId: string,
  input: CustomerPairDecision,
  key: string,
  etag: string,
  signal?: AbortSignal,
) {
  return customerPairResultSchema.parse(
    await authenticatedResult((s) =>
      client().decision.$post(
        {
          param: { shopId },
          json: customerPairDecisionSchema.parse(input),
          header: { "idempotency-key": key, "if-match": etag },
        },
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

export async function readContactMerge(
  shopId: string,
  input: ContactMergeQuery,
  signal?: AbortSignal,
) {
  return contactMergePreviewSchema.parse(
    await authenticatedResult((s) =>
      client()["merge-preview"].$post(
        { param: { shopId }, json: contactMergeQuerySchema.parse(input) },
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
export async function recordContactMerge(
  shopId: string,
  input: ContactMergeCommand,
  key: string,
  etag: string,
  signal?: AbortSignal,
) {
  return contactMergeResultSchema.parse(
    await authenticatedResult((s) =>
      client().merge.$post(
        {
          param: { shopId },
          json: contactMergeCommandSchema.parse(input),
          header: { "idempotency-key": key, "if-match": etag },
        },
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
