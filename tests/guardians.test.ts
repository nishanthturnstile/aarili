import { createHash, randomUUID } from "node:crypto";
import { clearOwnerState, onOwnerInvalidation } from "@aarili/api/client";
import { readGuardians } from "@aarili/api/wearer-client";
import {
  type GuardianProfile,
  guardianClaimSchema,
  guardianDraftCommandSchema,
  guardianDraftSchema,
  guardianPurposeEventSchema,
  guardianVerificationSchema,
} from "@aarili/contracts/wearers";
import { blockedCustomerPolicy } from "@aarili/core/customer-policy";
import { syntheticGuardianPolicy } from "@aarili/core/wearer-policy";
import { type GuardianContext, mutateGuardian } from "@aarili/core/wearers";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";

const at = "2026-10-17T00:00:00.000Z";
function fixture() {
  const customerId = randomUUID(),
    wearerId = randomUUID(),
    subject = randomUUID(),
    giver = randomUUID(),
    authorityId = randomUUID(),
    actorId = randomUUID(),
    writes: unknown[] = [];
  const verification = {
    id: randomUUID(),
    authorityId,
    status: "confirmed" as const,
    method: "synthetic-review-v1" as const,
    evidenceRef: "Invented fixture check",
    scope: "measurement-and-private-photo" as const,
    source: "phone" as const,
    occurredAt: at,
    recordedAt: at,
    recordedBy: actorId,
    wearerVersion: 3,
    previousId: null,
  };
  const authority = {
    id: authorityId,
    personId: giver,
    displayName: "Synthetic parent",
    authority: "parent" as const,
    scope: "measurement-and-private-photo" as const,
    source: "phone" as const,
    occurredAt: at,
    recordedAt: at,
    recordedBy: actorId,
    wearerVersion: 2,
    originDraftId: null,
    status: "confirmed" as const,
    verifiedCurrent: true,
    verifications: [verification],
  };
  const profile: GuardianProfile = {
    wearerId,
    version: 3,
    synthetic: true,
    authority,
    authorities: [authority],
    purposes: [],
  };
  const ctx = {
    shopId: randomUUID(),
    actor: { type: "user", id: actorId },
    policy: syntheticGuardianPolicy,
    wearers: {
      lockCustomer: async () => {},
      lockWearer: async () => {},
      customer: async () => ({
        id: customerId,
        personId: randomUUID(),
        version: 1,
      }),
      read: async () => ({
        id: wearerId,
        personId: subject,
        age: "minor",
        version: 3,
        relationship: { authorised: true, informed: true },
      }),
    },
    repository: {
      lockKey: async () => {},
      replay: async () => undefined,
      read: async () => profile,
      ensureNotice: async () => {},
      ids: async () => ({
        authorityId: randomUUID(),
        eventId: randomUUID(),
        personId: randomUUID(),
      }),
      purpose: async (_w: unknown, input: unknown) => writes.push(input),
      verify: async (_w: unknown, input: unknown) => writes.push(input),
      audit: async () => {},
      persist: async () => {},
    },
  } as unknown as GuardianContext;
  const event = {
    authorityId,
    purpose: "measurement" as const,
    decision: "grant" as const,
    noticeId: syntheticGuardianPolicy.notice?.id ?? "",
    noticeExplained: true as const,
    language: "ta" as const,
    giverPersonId: giver,
    source: "phone" as const,
    occurredAt: at,
  };
  return {
    ctx,
    profile,
    customerId,
    wearerId,
    giver,
    authorityId,
    writes,
    event,
    headers: () => ({
      key: randomUUID(),
      requestId: randomUUID(),
      ifMatch: '"v3"',
    }),
  };
}
afterEach(() => {
  clearOwnerState();
  vi.unstubAllGlobals();
});
test("CW-09/11 draft retains incomplete names while complete commands require explicit identity, age-independent claim and verification fields", () => {
  const base = {
    synthetic: true,
    noticeId: randomUUID(),
    customerId: randomUUID(),
    customerVersion: 1,
    wearerId: randomUUID(),
    wearerVersion: 1,
  };
  expect(
    guardianDraftSchema.safeParse({
      ...base,
      claim: { guardian: { mode: "new", displayName: "" } },
    }).success,
  ).toBe(true);
  expect(
    guardianDraftCommandSchema.safeParse({
      ...base,
      claim: { guardian: { mode: "new", displayName: "" } },
    }).success,
  ).toBe(false);
  expect(
    guardianClaimSchema.safeParse({
      guardian: { mode: "new", displayName: "Parent" },
      authority: "parent",
      scope: "measurement",
      source: "phone",
      occurredAt: at,
      dob: "2000-01-01",
    }).success,
  ).toBe(false);
  expect(
    guardianVerificationSchema.safeParse({ status: "confirmed" }).success,
  ).toBe(false);
  expect(
    guardianPurposeEventSchema.safeParse({
      purpose: "measurement",
      decision: "grant",
    }).success,
  ).toBe(false);
});
test("CW-08/09 draft notice is original bilingual content bound to its digest; default policy blocks all writes", async () => {
  const n = syntheticGuardianPolicy.notice;
  if (!n) throw Error("Missing synthetic guardian notice");
  expect(n.titleEn).toContain("DRAFT");
  expect(n.textTa).toContain("செயற்கை");
  expect(
    createHash("sha256").update(`${n.textEn}\n${n.textTa}`).digest("hex"),
  ).toBe(n.digest);
  const f = fixture();
  f.ctx.policy = blockedCustomerPolicy;
  await expect(
    mutateGuardian(
      f.ctx,
      f.customerId,
      f.wearerId,
      "purpose",
      f.event,
      f.headers(),
    ),
  ).rejects.toMatchObject({ status: 409, message: "GUARDIAN_POLICY_PENDING" });
  expect(f.writes).toHaveLength(0);
});
test("CW-09/11 property: payer or arbitrary person never substitutes for the named guardian giver", async () => {
  await fc.assert(
    fc.asyncProperty(fc.uuid(), async (id) => {
      const f = fixture();
      fc.pre(id !== f.giver);
      await expect(
        mutateGuardian(
          f.ctx,
          f.customerId,
          f.wearerId,
          "purpose",
          { ...f.event, giverPersonId: id },
          f.headers(),
        ),
      ).rejects.toMatchObject({
        status: 409,
        message: "GUARDIAN_GIVER_INVALID",
      });
      expect(f.writes).toHaveLength(0);
    }),
    { numRuns: 40 },
  );
});
test("CW-09/10 purposes independent; marketing/publication rejected, historic confirmed authority cannot revive after invalidation", async () => {
  for (const purpose of ["marketing", "publication"] as const) {
    const f = fixture();
    await expect(
      mutateGuardian(
        f.ctx,
        f.customerId,
        f.wearerId,
        "purpose",
        { ...f.event, purpose },
        f.headers(),
      ),
    ).rejects.toMatchObject({ message: "MINOR_PURPOSE_PROHIBITED" });
    expect(f.writes).toHaveLength(0);
  }
  const f = fixture();
  const a = f.profile.authorities[0];
  if (!a) throw Error("Missing fixture authority");
  a.verifiedCurrent = false;
  await expect(
    mutateGuardian(
      f.ctx,
      f.customerId,
      f.wearerId,
      "purpose",
      f.event,
      f.headers(),
    ),
  ).rejects.toMatchObject({ message: "GUARDIAN_REVIEW_REQUIRED" });
  await mutateGuardian(
    f.ctx,
    f.customerId,
    f.wearerId,
    "purpose",
    { ...f.event, decision: "refusal" },
    f.headers(),
  );
  expect(f.writes).toHaveLength(1);
});
test("CW-13 actor/action mismatch is rejected before any mutation or policy lookup", async () => {
  for (const mismatch of ["actor", "action"] as const) {
    const f = fixture();
    f.ctx.repository.replay = async () => ({
      actor: {
        type: "user",
        id: mismatch === "actor" ? randomUUID() : f.ctx.actor.id,
      },
      action: mismatch === "action" ? "guardian.claim" : "guardian.purpose",
      hash: "not-the-current-request",
      response: {
        wearerId: f.wearerId,
        authorityId: f.authorityId,
        version: 4,
      },
      status: 200,
    });
    f.ctx.policy = blockedCustomerPolicy;
    await expect(
      mutateGuardian(
        f.ctx,
        f.customerId,
        f.wearerId,
        "purpose",
        f.event,
        f.headers(),
      ),
    ).rejects.toMatchObject({ status: 422, message: "IDEMPOTENCY_MISMATCH" });
    expect(f.writes).toHaveLength(0);
  }
});
test("CW-13 guardian late denied body cannot invalidate the new owner generation or expose prior current state", async () => {
  const f = fixture();
  let resolve!: (v: unknown) => void;
  const json = new Promise((resolveJson) => {
    resolve = resolveJson;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: () => json,
    })),
  );
  const request = readGuardians(randomUUID(), f.customerId, f.wearerId).catch(
    (e) => e,
  );
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  clearOwnerState();
  let invalidations = 0;
  const remove = onOwnerInvalidation(() => invalidations++);
  resolve({
    error: { code: "SHOP_ACCESS_DENIED", message: "denied" },
    current: f.profile,
  });
  const result = await request;
  expect(result.message).toBe("UNAUTHENTICATED");
  expect(result.current).toBeUndefined();
  expect(invalidations).toBe(0);
  remove();
});
