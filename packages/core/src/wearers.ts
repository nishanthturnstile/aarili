import type { CustomerPolicy } from "@aarili/contracts/customers";
import {
  type Actor,
  actorSchema,
  idempotencyHeaderSchema,
} from "@aarili/contracts/request";
import {
  type WearerCreate,
  type WearerMutation,
  type WearerPreferences,
  type WearerProfile,
  type WearerRelationship,
  wearerCreateSchema,
  wearerDraftCommandSchema,
  wearerDraftSchema,
  wearerMutationSchema,
  wearerPurposeEventSchema,
  wearerSearchSchema,
  wearerUpdateSchema,
} from "@aarili/contracts/wearers";
import type {
  WearerCustomer,
  WearerRepository,
  WearerWrite,
} from "@aarili/db/repositories/wearers";
import { searchKeysV1 } from "@aarili/i18n/search";
import type { DraftWorkflow } from "./drafts.js";
import { DraftFailure } from "./drafts.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export {
  type GuardianContext,
  GuardianFailure,
  guardianDraftWorkflow,
  mutateGuardian,
  readGuardianPolicy,
  readGuardians,
  searchGuardianPeople,
} from "./guardians.js";
export type WearerContext = {
  shopId: string;
  actor: Actor;
  repository: WearerRepository;
  policy: CustomerPolicy;
};
export class WearerFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    code: string,
    public readonly current?: WearerProfile,
  ) {
    super(code);
  }
}
function policy(ctx: WearerContext) {
  if (!ctx.policy.enabled || !ctx.policy.synthetic || !ctx.policy.notice)
    throw new WearerFailure(409, "WEARER_POLICY_PENDING");
  return ctx.policy.notice;
}
export function readWearerPolicy(ctx: WearerContext) {
  return ctx.policy;
}
async function customer(ctx: WearerContext, id: string) {
  if (!idempotencyHeaderSchema.safeParse(id).success)
    throw new WearerFailure(422, "VALIDATION_FAILED");
  await ctx.repository.lockCustomer(id);
  const c = await ctx.repository.customer(id);
  if (!c) throw new WearerFailure(404, "NOT_FOUND");
  return c;
}
export async function listWearers(ctx: WearerContext, customerId: string) {
  await customer(ctx, customerId);
  return { wearers: await ctx.repository.list(customerId) };
}
export async function readWearer(
  ctx: WearerContext,
  customerId: string,
  id: string,
) {
  await customer(ctx, customerId);
  if (!idempotencyHeaderSchema.safeParse(id).success)
    throw new WearerFailure(422, "VALIDATION_FAILED");
  const p = await ctx.repository.read(customerId, id);
  if (!p) throw new WearerFailure(404, "NOT_FOUND");
  return p;
}
export async function searchWearers(ctx: WearerContext, input: unknown) {
  const p = wearerSearchSchema.safeParse(input);
  if (!p.success) throw new WearerFailure(422, "VALIDATION_FAILED");
  return ctx.repository.search(p.data, searchKeysV1(p.data.query));
}
function preferences(p: WearerPreferences) {
  if (
    [p.language, p.channel, p.fit, p.style, p.delivery].some((x) => x !== "") &&
    !p.source.trim()
  )
    throw new WearerFailure(422, "PREFERENCE_SOURCE_REQUIRED");
}
function relationship(
  c: WearerCustomer,
  personId: string,
  r: WearerRelationship,
) {
  if (
    (r.authorised && r.authorisationDeclined) ||
    (r.informed && r.informedDeclined)
  )
    throw new WearerFailure(422, "VALIDATION_FAILED");
  if (
    r.statementByPersonId.toLowerCase() !== c.personId ||
    (r.kind === "self") !== (personId === c.personId)
  )
    throw new WearerFailure(409, "RELATIONSHIP_AUTHORITY_INVALID");
}
async function register(
  ctx: WearerContext,
  c: WearerCustomer,
  input: WearerCreate,
  w: WearerWrite,
): Promise<WearerMutation> {
  await ctx.repository.ensureNotice(policy(ctx));
  if (input.mode === "existing") {
    await ctx.repository.lockWearer(input.wearerId);
    const p = await ctx.repository.identity(input.wearerId);
    if (!p) throw new WearerFailure(404, "NOT_FOUND");
    if (p.version !== input.expectedVersion)
      throw new WearerFailure(409, "EXISTING_WEARER_STALE");
    if (await ctx.repository.read(c.id, p.id))
      throw new WearerFailure(409, "RELATIONSHIP_EXISTS");
    relationship(c, p.personId, input.relationship);
    w = { ...w, id: p.id, personId: p.personId };
    if (!(await ctx.repository.link(w, input.relationship, p.version)))
      throw new WearerFailure(409, "EXISTING_WEARER_STALE");
    await ctx.repository.audit(w, "wearer.link", p.version + 1);
    return {
      wearerId: p.id,
      personId: p.personId,
      relationshipId: w.relationshipId,
      version: p.version + 1,
    };
  }
  preferences(input.preferences);
  if (input.mode === "self") {
    await ctx.repository.lockPerson(c.personId);
    if (await ctx.repository.byPerson(c.personId))
      throw new WearerFailure(409, "WEARER_EXISTS");
    w = { ...w, personId: c.personId };
  }
  relationship(c, w.personId, input.relationship);
  await ctx.repository.insert(
    {
      ...w,
      searchKey: searchKeysV1(
        input.mode === "self" ? c.displayName : input.displayName,
      ),
    },
    input,
    input.mode === "self" ? c.displayName : input.displayName,
  );
  await ctx.repository.audit(w, "wearer.create", 1);
  return {
    wearerId: w.id,
    personId: w.personId,
    relationshipId: w.relationshipId,
    version: 1,
  };
}
export async function mutateWearer(
  ctx: WearerContext,
  customerId: string,
  action: "create" | "update" | "purpose",
  id: string | undefined,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
): Promise<WearerMutation> {
  const p =
    action === "create"
      ? wearerCreateSchema.safeParse(input)
      : action === "update"
        ? wearerUpdateSchema.safeParse(input)
        : wearerPurposeEventSchema.safeParse(input);
  const actor = actorSchema.safeParse(ctx.actor);
  if (
    !p.success ||
    !actor.success ||
    actor.data.type !== "user" ||
    ![
      ctx.shopId,
      customerId,
      headers.key,
      headers.requestId,
      ...(id ? [id] : []),
    ].every((v) => idempotencyHeaderSchema.safeParse(v).success)
  )
    throw new WearerFailure(422, "VALIDATION_FAILED");
  let expected: number | null = null;
  if (headers.ifMatch !== undefined) {
    const version = parseExpectedVersion(headers.ifMatch);
    if (!version.ok) throw new WearerFailure(version.status, version.code);
    expected = version.version;
  }
  if (action === "create" && expected !== null)
    throw new WearerFailure(422, "VALIDATION_FAILED");
  const key = (headers.key as string).toLowerCase(),
    target = id?.toLowerCase() ?? null;
  customerId = customerId.toLowerCase();
  const binding = {
    actor: actor.data,
    action: `wearer.${action}`,
    hash: await requestHash({
      encoding: 1,
      shopId: ctx.shopId.toLowerCase(),
      customerId,
      actor: actor.data,
      action,
      target,
      expected,
      input: p.data,
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
      throw new WearerFailure(422, "IDEMPOTENCY_MISMATCH");
    return wearerMutationSchema.parse(replay.response);
  }
  const n = policy(ctx),
    c = await customer(ctx, customerId);
  await ctx.repository.ensureNotice(n);
  const ids = await ctx.repository.ids();
  let w: WearerWrite = {
    ...ids,
    customerId,
    actorId: actor.data.id,
    key,
    requestId: headers.requestId,
    originDraftId: null,
    noticeId: n.id,
  };
  let result: WearerMutation;
  if (action === "create")
    result = await register(ctx, c, wearerCreateSchema.parse(input), w);
  else {
    if (!target) throw new WearerFailure(422, "VALIDATION_FAILED");
    await ctx.repository.lockWearer(target);
    const current = await readWearer(ctx, customerId, target);
    if (expected === null)
      throw new WearerFailure(428, "PRECONDITION_REQUIRED");
    if (expected !== current.version)
      throw new WearerFailure(412, "VERSION_STALE", current);
    if (current.version === 2147483647)
      throw new WearerFailure(409, "VERSION_EXHAUSTED");
    w = {
      ...w,
      id: current.id,
      personId: current.personId,
      relationshipId: current.relationship.id,
      originDraftId: current.originDraftId,
    };
    if (action === "update") {
      const update = wearerUpdateSchema.parse(input);
      if (
        update.displayName &&
        (current.personId === c.personId ||
          (await ctx.repository.isContactPerson(current.personId))) &&
        update.displayName !== current.displayName
      )
        throw new WearerFailure(
          409,
          "CONTACT_NAME_REQUIRES_CONTACT_CORRECTION",
        );
      if (update.displayName === current.displayName) delete update.displayName;
      w.revision = {
        reason: update.reason,
        previousVersion: current.version,
        fields: [
          ...(current.age !== update.age ? ["age"] : []),
          ...(Object.keys(update.preferences).some(
            (k) =>
              current.preferences[k as keyof typeof update.preferences] !==
              update.preferences[k as keyof typeof update.preferences],
          )
            ? ["preferences"]
            : []),
          ...(Object.keys(update.relationship).some(
            (k) =>
              current.relationship[k as keyof typeof update.relationship] !==
              update.relationship[k as keyof typeof update.relationship],
          )
            ? ["relationship"]
            : []),
        ],
      };
      if (update.displayName) {
        w.revision.fields.push("displayName");
        w.searchKey = searchKeysV1(update.displayName);
      }
      preferences(update.preferences);
      relationship(c, current.personId, update.relationship);
      w.invalidateAuthority =
        current.age !== update.age ||
        current.relationship.authorised !== update.relationship.authorised ||
        current.relationship.informed !== update.relationship.informed ||
        current.relationship.kind !== update.relationship.kind ||
        current.relationship.interaction !== update.relationship.interaction ||
        current.relationship.authorisationDeclined !==
          update.relationship.authorisationDeclined ||
        current.relationship.informedDeclined !==
          update.relationship.informedDeclined;
      if (!(await ctx.repository.update(w, update, current.version)))
        throw new WearerFailure(412, "VERSION_STALE");
    } else {
      const e = wearerPurposeEventSchema.parse(input);
      if (
        e.noticeId.toLowerCase() !== n.id ||
        e.giverPersonId.toLowerCase() !== current.personId
      )
        throw new WearerFailure(409, "PURPOSE_AUTHORITY_INVALID");
      if (e.decision === "grant" && current.age !== "adult")
        throw new WearerFailure(409, "ADULT_AUTHORITY_REQUIRED");
      if (
        e.decision === "withdrawal" &&
        !current.purposes.some(
          (p) => p.purpose === e.purpose && p.decision === "grant",
        )
      )
        throw new WearerFailure(409, "NO_GRANT_TO_WITHDRAW");
      if (!(await ctx.repository.appendPurpose(w, e, n, current.version)))
        throw new WearerFailure(412, "VERSION_STALE");
    }
    await ctx.repository.audit(w, `wearer.${action}`, current.version + 1);
    result = {
      wearerId: current.id,
      personId: current.personId,
      relationshipId: current.relationship.id,
      version: current.version + 1,
    };
  }
  await ctx.repository.persist(key, binding, result);
  return result;
}
export function wearerDraftWorkflow(ctx: WearerContext): DraftWorkflow {
  const adapter: DraftWorkflow = {
    schemaVersion: 1,
    draftSchema: wearerDraftSchema,
    commandSchema: wearerDraftCommandSchema,
    async revalidate(command) {
      const parsed = wearerDraftCommandSchema.parse(command);
      if (parsed.noticeId !== policy(ctx).id)
        throw new WearerFailure(409, "NOTICE_VERSION_STALE");
      const c = await customer(ctx, parsed.customerId);
      if (c.version !== parsed.customerVersion)
        throw new WearerFailure(409, "CUSTOMER_VERSION_STALE");
      if (parsed.registration.mode === "existing") {
        await ctx.repository.lockWearer(parsed.registration.wearerId);
        const e = await ctx.repository.identity(parsed.registration.wearerId);
        if (!e || e.version !== parsed.registration.expectedVersion)
          throw new WearerFailure(409, "EXISTING_WEARER_STALE");
      }
    },
    async promote(command, _actionId, draftId, request) {
      const parsed = wearerDraftCommandSchema.parse(command),
        c = await customer(ctx, parsed.customerId),
        ids = await ctx.repository.ids();
      const result = await register(ctx, c, parsed.registration, {
        ...ids,
        customerId: parsed.customerId,
        actorId: ctx.actor.id,
        key: request.key,
        requestId: request.requestId,
        originDraftId: draftId,
        noticeId: policy(ctx).id,
      });
      return {
        type: "customer.wearer.relationship",
        id: result.relationshipId,
      };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "customer.wearer.relationship" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        throw new DraftFailure(409, {
          error: {
            code: "REQUEST_CONFLICT",
            message: "Wearer draft origin rejected",
          },
        });
    },
  };
  async function guarded<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (e) {
      if (e instanceof WearerFailure)
        throw new DraftFailure(e.status, {
          error: {
            code:
              e.status === 422
                ? "VALIDATION_FAILED"
                : e.status === 404
                  ? "NOT_FOUND"
                  : e.status === 412
                    ? "VERSION_STALE"
                    : e.status === 428
                      ? "PRECONDITION_REQUIRED"
                      : "REQUEST_CONFLICT",
            message:
              "Wearer draft requires current identity, authority and policy",
          },
        });
      throw e;
    }
  }
  return {
    ...adapter,
    revalidate: (...args) => guarded(() => adapter.revalidate(...args)),
    promote: (...args) => guarded(() => adapter.promote(...args)),
  };
}
