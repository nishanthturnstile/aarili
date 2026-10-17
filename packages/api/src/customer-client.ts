import {
  type CustomerContact,
  type CustomerCreate,
  type CustomerProfile,
  customerContactSchema,
  customerCreateSchema,
  customerErrorSchema,
  customerMutationSchema,
  customerPolicySchema,
  customerProfileSchema,
  customerSearchPageSchema,
  customerSearchSchema,
} from "@aarili/contracts/customers";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createCustomerRoutes } from "./customers.js";

const client = () => hc<ReturnType<typeof createCustomerRoutes>>("/api");
export class CustomerRequestError extends OwnerRequestError {
  constructor(
    code: string,
    public readonly current?: CustomerProfile,
  ) {
    super(code);
  }
}
async function result(response: Response, generation: number) {
  const data: unknown = await response.json();
  if (!isOwnerGeneration(generation))
    throw new CustomerRequestError("UNAUTHENTICATED");
  if (!response.ok) {
    const e = customerErrorSchema.safeParse(data);
    const code = e.success ? e.data.error.code : "REQUEST_FAILED";
    if (
      response.status === 401 ||
      (response.status === 403 && code === "SHOP_ACCESS_DENIED")
    )
      clearOwnerState();
    if (
      e.success &&
      e.data.current &&
      response.headers.get("ETag") !== `"v${e.data.current.version}"`
    )
      throw new CustomerRequestError("INVALID_RESPONSE");
    throw new CustomerRequestError(
      code,
      e.success ? e.data.current : undefined,
    );
  }
  if (
    data &&
    typeof data === "object" &&
    "version" in data &&
    typeof data.version === "number" &&
    response.headers.get("ETag") !== `"v${data.version}"`
  )
    throw new CustomerRequestError("INVALID_RESPONSE");
  return data;
}
async function read(run: (signal: AbortSignal) => Promise<Response>) {
  return authenticatedResult(run, result);
}
const init = (signal: AbortSignal, external?: AbortSignal) => ({
  cache: "no-store" as const,
  signal: external ? AbortSignal.any([signal, external]) : signal,
});
export async function readCustomerPolicy(shopId: string, signal?: AbortSignal) {
  return customerPolicySchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers.policy.$get(
        { param: { shopId } },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function searchCustomers(
  shopId: string,
  input: {
    query: string;
    limit?: number;
    cursor?: { rank: number; id: string };
  },
  signal?: AbortSignal,
) {
  const json = customerSearchSchema.parse(input);
  return customerSearchPageSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers.search.$post(
        { param: { shopId }, json },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function readCustomer(
  shopId: string,
  id: string,
  signal?: AbortSignal,
) {
  let tag: string | null = null;
  const data = await read(async (s) => {
    const r = await client().shops[":shopId"].customers[":id"].$get(
      { param: { shopId, id } },
      { init: init(s, signal) },
    );
    tag = r.headers.get("ETag");
    return r;
  });
  const profile = customerProfileSchema.parse(data);
  if (tag !== `"v${profile.version}"`)
    throw new CustomerRequestError("INVALID_RESPONSE");
  return profile;
}
export async function registerCustomer(
  shopId: string,
  input: CustomerCreate,
  key: string,
  signal?: AbortSignal,
) {
  return customerMutationSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers.$post(
        {
          param: { shopId },
          json: customerCreateSchema.parse(input),
          header: { "idempotency-key": key },
        },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function correctCustomer(
  shopId: string,
  id: string,
  input: CustomerContact,
  key: string,
  etag: string,
  signal?: AbortSignal,
) {
  return customerMutationSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers[":id"].$patch(
        {
          param: { shopId, id },
          json: customerContactSchema.parse(input),
          header: { "idempotency-key": key, "if-match": etag },
        },
        { init: init(s, signal) },
      ),
    ),
  );
}
