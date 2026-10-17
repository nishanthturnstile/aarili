import type { CustomerPolicy } from "@aarili/contracts/customers";
import {
  type Actor,
  actorSchema,
  idempotencyHeaderSchema,
} from "@aarili/contracts/request";
import {
  type GuardianClaim,
  type GuardianMutation,
  type GuardianProfile,
  guardianClaimSchema,
  guardianDraftCommandSchema,
  guardianDraftSchema,
  guardianMutationSchema,
  guardianPurposeEventSchema,
  guardianVerificationSchema,
  wearerSearchSchema,
} from "@aarili/contracts/wearers";
import type {
  GuardianRepository,
  GuardianWrite,
  WearerRepository,
} from "@aarili/db/repositories/wearers";
import { searchKeysV1 } from "@aarili/i18n/search";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
export type GuardianContext = {
  shopId: string;
  actor: Actor;
  repository: GuardianRepository;
  wearers: WearerRepository;
  policy: CustomerPolicy;
};
export class GuardianFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    code: string,
    public readonly current?: GuardianProfile,
  ) {
    super(code);
  }
}
function policy(ctx: GuardianContext) {
  if (!ctx.policy.enabled || !ctx.policy.synthetic || !ctx.policy.notice)
    throw new GuardianFailure(409, "GUARDIAN_POLICY_PENDING");
  return ctx.policy.notice;
}
function validId(id: string) {
  if (!idempotencyHeaderSchema.safeParse(id).success)
    throw new GuardianFailure(422, "VALIDATION_FAILED");
}
async function subject(
  ctx: GuardianContext,
  customerId: string,
  wearerId: string,
  lock = false,
) {
  validId(customerId);
  validId(wearerId);
  customerId = customerId.toLowerCase();
  wearerId = wearerId.toLowerCase();
  await ctx.wearers.lockCustomer(customerId);
  const c = await ctx.wearers.customer(customerId);
  if (!c) throw new GuardianFailure(404, "NOT_FOUND");
  if (lock) await ctx.wearers.lockWearer(wearerId);
  const w = await ctx.wearers.read(customerId, wearerId);
  if (!w) throw new GuardianFailure(404, "NOT_FOUND");
  return { c, w };
}
const allowed = (w: {
  relationship: { authorised: boolean; informed: boolean };
}) => w.relationship.authorised && w.relationship.informed;
export function readGuardianPolicy(ctx: GuardianContext) {
  return ctx.policy;
}
export async function readGuardians(
  ctx: GuardianContext,
  customerId: string,
  wearerId: string,
) {
  const { w } = await subject(ctx, customerId, wearerId);
  return ctx.repository.read(wearerId, allowed(w));
}
export async function searchGuardianPeople(
  ctx: GuardianContext,
  input: unknown,
) {
  const p = wearerSearchSchema.safeParse(input);
  if (!p.success) throw new GuardianFailure(422, "VALIDATION_FAILED");
  return ctx.repository.search(p.data, searchKeysV1(p.data.query));
}
async function claim(
  ctx: GuardianContext,
  w: GuardianWrite,
  input: GuardianClaim,
  personId: string,
  subjectPersonId: string,
  expected: number,
) {
  if (personId.toLowerCase() === subjectPersonId)
    throw new GuardianFailure(409, "SELF_GUARDIANSHIP_DENIED");
  if (
    input.guardian.mode === "existing" &&
    !(await ctx.repository.person(personId))
  )
    throw new GuardianFailure(404, "GUARDIAN_NOT_FOUND");
  await ctx.repository.claim(
    w,
    input,
    personId,
    expected,
    searchKeysV1(
      input.guardian.mode === "new" ? input.guardian.displayName : "",
    ),
  );
  await ctx.repository.audit(w, "guardian.claim", expected + 1);
  return {
    wearerId: w.wearerId,
    authorityId: w.authorityId,
    version: expected + 1,
  };
}
export async function mutateGuardian(
  ctx: GuardianContext,
  customerId: string,
  wearerId: string,
  action: "claim" | "verify" | "purpose",
  input: unknown,
  headers: {
    key: string | undefined;
    ifMatch: string | undefined;
    requestId: string;
  },
): Promise<GuardianMutation> {
  const parsed = (
      action === "claim"
        ? guardianClaimSchema
        : action === "verify"
          ? guardianVerificationSchema
          : guardianPurposeEventSchema
    ).safeParse(input),
    actor = actorSchema.safeParse(ctx.actor);
  if (
    !parsed.success ||
    !actor.success ||
    actor.data.type !== "user" ||
    !idempotencyHeaderSchema.safeParse(headers.key).success ||
    !idempotencyHeaderSchema.safeParse(headers.requestId).success
  )
    throw new GuardianFailure(422, "VALIDATION_FAILED");
  validId(customerId);
  validId(wearerId);
  const version = parseExpectedVersion(headers.ifMatch);
  if (!version.ok && version.status === 422)
    throw new GuardianFailure(422, "VALIDATION_FAILED");
  const expected = version.ok ? version.version : null;
  customerId = customerId.toLowerCase();
  wearerId = wearerId.toLowerCase();
  const key = (headers.key as string).toLowerCase(),
    binding = {
      actor: actor.data,
      action: `guardian.${action}`,
      hash: await requestHash({
        encoding: 1,
        shopId: ctx.shopId.toLowerCase(),
        customerId: customerId.toLowerCase(),
        wearerId: wearerId.toLowerCase(),
        actor: actor.data,
        action,
        expected,
        input: parsed.data,
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
      throw new GuardianFailure(422, "IDEMPOTENCY_MISMATCH");
    return guardianMutationSchema.parse(replay.response);
  }
  const n = policy(ctx),
    { w } = await subject(ctx, customerId, wearerId, true),
    current = await ctx.repository.read(wearerId, allowed(w));
  if (expected === null)
    throw new GuardianFailure(428, "PRECONDITION_REQUIRED");
  if (expected !== w.version)
    throw new GuardianFailure(412, "VERSION_STALE", current);
  if (w.version === 2147483647)
    throw new GuardianFailure(409, "VERSION_EXHAUSTED");
  await ctx.repository.ensureNotice(n);
  const ids = await ctx.repository.ids();
  const write: GuardianWrite = {
    ...ids,
    wearerId,
    actorId: actor.data.id,
    key,
    requestId: headers.requestId,
    originDraftId: null,
  };
  let result: GuardianMutation;
  if (action === "claim") {
    if (w.age !== "minor")
      throw new GuardianFailure(409, "EXPLICIT_MINOR_REQUIRED");
    const e = guardianClaimSchema.parse(input);
    const personId =
      e.guardian.mode === "new" ? ids.personId : e.guardian.personId;
    result = await claim(ctx, write, e, personId, w.personId, w.version);
  } else {
    const e =
        action === "verify"
          ? guardianVerificationSchema.parse(input)
          : guardianPurposeEventSchema.parse(input),
      a = current.authorities.find((a) => a.id === e.authorityId);
    if (!a) throw new GuardianFailure(409, "GUARDIAN_AUTHORITY_INVALID");
    write.authorityId = a.id;
    if (action === "verify") {
      const v = guardianVerificationSchema.parse(input);
      if (v.scope !== a.scope)
        throw new GuardianFailure(409, "GUARDIAN_SCOPE_INVALID");
      if (
        v.status === "confirmed" &&
        (v.method !== "synthetic-review-v1" || !v.evidenceRef.trim())
      )
        throw new GuardianFailure(409, "SYNTHETIC_VERIFICATION_REQUIRED");
      if (
        v.status === "confirmed" &&
        (w.age !== "minor" || current.authority?.id !== a.id)
      )
        throw new GuardianFailure(409, "CURRENT_MINOR_AUTHORITY_REQUIRED");
      await ctx.repository.verify(write, v, w.version);
    } else {
      const p = guardianPurposeEventSchema.parse(input),
        previous = current.purposes.find(
          (x) => x.authorityId === a.id && x.purpose === p.purpose,
        );
      if (p.giverPersonId.toLowerCase() !== a.personId)
        throw new GuardianFailure(409, "GUARDIAN_GIVER_INVALID");
      if (p.decision === "withdrawal") {
        if (previous?.decision !== "grant" || previous.noticeId !== p.noticeId)
          throw new GuardianFailure(409, "NO_GRANT_TO_WITHDRAW");
      } else if (p.noticeId !== n.id)
        throw new GuardianFailure(409, "NOTICE_VERSION_STALE");
      if (p.decision === "grant") {
        if (p.purpose === "marketing" || p.purpose === "publication")
          throw new GuardianFailure(409, "MINOR_PURPOSE_PROHIBITED");
        if (
          w.age !== "minor" ||
          current.authority?.id !== a.id ||
          a.status !== "confirmed" ||
          !allowed(w)
        )
          throw new GuardianFailure(409, "VERIFIED_GUARDIAN_REQUIRED");
        if (
          a.scope !== p.purpose &&
          a.scope !== "measurement-and-private-photo"
        )
          throw new GuardianFailure(409, "GUARDIAN_SCOPE_INVALID");
        // Repository checks the confirmed verification epoch under the wearer row lock.
        // Expose a domain failure when an age/relationship change has invalidated it.
        if (!a.verifiedCurrent)
          throw new GuardianFailure(409, "GUARDIAN_REVIEW_REQUIRED");
      }
      await ctx.repository.purpose(write, p, w.version);
    }
    await ctx.repository.audit(write, `guardian.${action}`, w.version + 1);
    result = { wearerId, authorityId: a.id, version: w.version + 1 };
  }
  await ctx.repository.persist(key, binding, result);
  return result;
}

export function guardianDraftWorkflow(ctx: GuardianContext): DraftWorkflow {
  const adapter: DraftWorkflow = {
    schemaVersion: 1,
    draftSchema: guardianDraftSchema,
    commandSchema: guardianDraftCommandSchema,
    async revalidate(command) {
      const p = guardianDraftCommandSchema.parse(command);
      if (p.noticeId !== policy(ctx).id)
        throw new GuardianFailure(409, "NOTICE_VERSION_STALE");
      const { c, w } = await subject(ctx, p.customerId, p.wearerId, true);
      if (c.version !== p.customerVersion || w.version !== p.wearerVersion)
        throw new GuardianFailure(409, "DEPENDENCY_VERSION_STALE");
      if (w.age !== "minor")
        throw new GuardianFailure(409, "EXPLICIT_MINOR_REQUIRED");
      if (
        p.claim.guardian.mode === "existing" &&
        (p.claim.guardian.personId === w.personId ||
          !(await ctx.repository.person(p.claim.guardian.personId)))
      )
        throw new GuardianFailure(409, "GUARDIAN_AUTHORITY_INVALID");
    },
    async promote(command, _actionId, draftId, request) {
      const p = guardianDraftCommandSchema.parse(command),
        { w } = await subject(ctx, p.customerId, p.wearerId, true),
        n = policy(ctx),
        ids = await ctx.repository.ids();
      await ctx.repository.ensureNotice(n);
      const result = await claim(
        ctx,
        {
          ...ids,
          wearerId: p.wearerId,
          actorId: ctx.actor.id,
          key: request.key,
          requestId: request.requestId,
          originDraftId: draftId,
        },
        p.claim,
        p.claim.guardian.mode === "new"
          ? ids.personId
          : p.claim.guardian.personId,
        w.personId,
        w.version,
      );
      return { type: "wearer.guardian.authority", id: result.authorityId };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "wearer.guardian.authority" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        throw new GuardianFailure(409, "DRAFT_ORIGIN_INVALID");
    },
  };
  async function guarded<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (e) {
      if (e instanceof GuardianFailure)
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
              "Guardian draft requires current subject, authority and draft policy",
          },
        });
      throw e;
    }
  }
  return {
    ...adapter,
    revalidate: (...args) => guarded(() => adapter.revalidate(...args)),
    promote: (...args) => guarded(() => adapter.promote(...args)),
    verifyResult: (...args) => guarded(() => adapter.verifyResult(...args)),
  };
}
