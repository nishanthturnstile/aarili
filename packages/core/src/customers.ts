import {
  type CustomerContact,
  type CustomerMutationResult,
  type CustomerPolicy,
  type CustomerProfile,
  customerContactSchema,
  customerCreateSchema,
  customerMutationSchema,
  customerSearchSchema,
} from "@aarili/contracts/customers";
import {
  type Actor,
  actorSchema,
  idempotencyHeaderSchema,
} from "@aarili/contracts/request";
import type {
  CustomerRepository,
  CustomerWrite,
} from "@aarili/db/repositories/customers";
import { searchKeysV1 } from "@aarili/i18n/search";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
export type CustomerContext = {
  shopId: string;
  actor: Actor;
  repository: CustomerRepository;
  policy: CustomerPolicy;
};
export class CustomerFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    code: string,
    public readonly current?: CustomerProfile,
  ) {
    super(code);
  }
}
function policy(ctx: CustomerContext) {
  // There is deliberately no production approval/activation path in this slice.
  if (!ctx.policy.enabled || !ctx.policy.synthetic || !ctx.policy.notice)
    throw new CustomerFailure(409, "CUSTOMER_POLICY_PENDING");
  return ctx.policy.notice;
}
export function readCustomerPolicy(ctx: CustomerContext) {
  return ctx.policy;
}
export async function readCustomer(ctx: CustomerContext, id: string) {
  if (!idempotencyHeaderSchema.safeParse(id).success)
    throw new CustomerFailure(422, "VALIDATION_FAILED");
  const found = await ctx.repository.read(id.toLowerCase());
  if (!found) throw new CustomerFailure(404, "NOT_FOUND");
  return found;
}
export async function searchCustomers(ctx: CustomerContext, input: unknown) {
  const parsed = customerSearchSchema.safeParse(input);
  if (!parsed.success) throw new CustomerFailure(422, "VALIDATION_FAILED");
  return ctx.repository.search(
    parsed.data,
    searchKeysV1(parsed.data.query, parsed.data.query),
  );
}
const contact = (input: CustomerContact): CustomerContact => ({
  ...input,
  phone: input.phone ?? "",
  email: input.email ?? "",
  notes: input.notes ?? "",
});
export async function mutateCustomer(
  ctx: CustomerContext,
  action: "create" | "correct",
  id: string | undefined,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
): Promise<CustomerMutationResult> {
  const parsed =
    action === "create"
      ? customerCreateSchema.safeParse(input)
      : customerContactSchema.safeParse(input);
  const actor = actorSchema.safeParse(ctx.actor);
  if (
    !parsed.success ||
    !actor.success ||
    actor.data.type !== "user" ||
    ![ctx.shopId, headers.key, headers.requestId, ...(id ? [id] : [])].every(
      (v) => idempotencyHeaderSchema.safeParse(v).success,
    )
  )
    throw new CustomerFailure(422, "VALIDATION_FAILED");
  let expected: number | null = null;
  if (headers.ifMatch !== undefined) {
    const v = parseExpectedVersion(headers.ifMatch);
    if (!v.ok) throw new CustomerFailure(v.status, v.code);
    expected = v.version;
  }
  if (action === "create" && expected !== null)
    throw new CustomerFailure(422, "VALIDATION_FAILED");
  const normalized = contact(parsed.data);
  const command =
    action === "create"
      ? {
          ...normalized,
          serviceEvidence: customerCreateSchema.parse(input).serviceEvidence,
        }
      : normalized;
  const key = (headers.key as string).toLowerCase(),
    target = id?.toLowerCase() ?? null;
  const binding = {
    actor: actor.data,
    action: `customer.${action}`,
    hash: await requestHash({
      encoding: 1,
      shopId: ctx.shopId.toLowerCase(),
      actor: actor.data,
      action,
      target,
      expected,
      command,
    }),
  };
  await ctx.repository.lockKey(key);
  const replay = await ctx.repository.replay(key);
  if (replay) {
    if (
      replay.actor.type !== actor.data.type ||
      replay.actor.id !== actor.data.id ||
      replay.action !== binding.action ||
      replay.hash !== binding.hash
    )
      throw new CustomerFailure(422, "IDEMPOTENCY_MISMATCH");
    return customerMutationSchema.parse(replay.response);
  }
  const notice = policy(ctx);
  let prior: CustomerProfile | undefined;
  if (action === "correct") {
    if (!target) throw new CustomerFailure(422, "VALIDATION_FAILED");
    await ctx.repository.lockCustomer(target);
    prior = await readCustomer(ctx, target);
    if (expected === null)
      throw new CustomerFailure(428, "PRECONDITION_REQUIRED");
    if (prior.version !== expected)
      throw new CustomerFailure(412, "VERSION_STALE", prior);
    if (prior.version === 2147483647)
      throw new CustomerFailure(409, "VERSION_EXHAUSTED");
  }
  const ids = await ctx.repository.ids();
  const write: CustomerWrite = {
    id: prior?.id ?? ids.id,
    personId: prior?.personId ?? ids.personId,
    eventId: ids.eventId,
    actorId: actor.data.id,
    key,
    requestId: headers.requestId.toLowerCase(),
    contact: normalized,
    synthetic: true,
    keys: [normalized.displayName, ...normalized.aliases].map((name, index) =>
      searchKeysV1(name, index === 0 ? normalized.phone : ""),
    ),
  };
  const version = (prior?.version ?? 0) + 1;
  if (action === "create") {
    const e = customerCreateSchema.parse(input).serviceEvidence;
    if (
      e.noticeId.toLowerCase() !== notice.id ||
      new Date(e.occurredAt).getTime() > Date.now() + 60000
    )
      throw new CustomerFailure(422, "VALIDATION_FAILED");
    await ctx.repository.insert(write, notice, e);
  } else if (!(await ctx.repository.correct(write, expected as number)))
    throw new CustomerFailure(412, "VERSION_STALE");
  await ctx.repository.audit(
    write,
    action === "create" ? "customer.create" : "customer.correct",
    version,
  );
  const result = { customerId: write.id, personId: write.personId, version };
  await ctx.repository.persist(key, binding, result);
  return result;
}
