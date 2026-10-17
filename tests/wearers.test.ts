import { createHash, randomUUID } from "node:crypto";
import { clearOwnerState, onOwnerInvalidation } from "@aarili/api/client";
import { searchWearers } from "@aarili/api/wearer-client";
import {
  wearerCreateSchema,
  wearerDraftCommandSchema,
  wearerDraftSchema,
  wearerPurposeEventSchema,
} from "@aarili/contracts/wearers";
import { blockedCustomerPolicy } from "@aarili/core/customer-policy";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { mutateWearer, type WearerContext } from "@aarili/core/wearers";
import type {
  WearerRepository,
  WearerWrite,
} from "@aarili/db/repositories/wearers";
import fc from "fast-check";
import { afterEach, expect, test, vi } from "vitest";

const prefs = {
  language: "",
  channel: "",
  fit: "",
  style: "",
  delivery: "",
  source: "",
};
function fixture() {
  const customerId = randomUUID(),
    personId = randomUUID(),
    actorId = randomUUID(),
    writes: WearerWrite[] = [],
    expressed: unknown[] = [];
  const repo = {
    lockKey: async () => {},
    replay: async () => undefined,
    ensureNotice: async () => {},
    lockCustomer: async () => {},
    customer: async () => ({
      id: customerId,
      personId,
      displayName: "Synthetic contact",
      version: 1,
    }),
    ids: async () => ({
      id: randomUUID(),
      personId: randomUUID(),
      relationshipId: randomUUID(),
      eventId: randomUUID(),
    }),
    insert: async (w: WearerWrite, input: { preferences: unknown }) => {
      writes.push(w);
      expressed.push(input.preferences);
    },
    audit: async () => {},
    persist: async () => {},
  } as unknown as WearerRepository;
  const ctx: WearerContext = {
    shopId: randomUUID(),
    actor: { type: "user", id: actorId },
    repository: repo,
    policy: syntheticWearerPolicy,
  };
  const relationship = {
    kind: "family" as const,
    statementByPersonId: personId,
    authorised: false,
    informed: false,
    source: "in-person" as const,
    occurredAt: "2026-10-17T00:00:00.000Z",
    interaction: "Synthetic intake",
  };
  return { ctx, customerId, personId, writes, expressed, relationship };
}
afterEach(() => {
  clearOwnerState();
  vi.unstubAllGlobals();
});
test("CW-03/04/05 property: matching new-person names never select self and independent preferences do not grant authority", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc
        .string({ minLength: 1, maxLength: 80 })
        .filter((s) => s.trim().length > 0),
      async (name) => {
        const f = fixture(),
          first = await mutateWearer(
            f.ctx,
            f.customerId,
            "create",
            undefined,
            {
              mode: "new",
              displayName: name,
              age: "unknown",
              preferences: {
                ...prefs,
                fit: "Original expressed fit",
                source: "Wearer said this",
              },
              relationship: f.relationship,
            },
            { key: randomUUID(), requestId: randomUUID() },
          );
        const second = await mutateWearer(
          f.ctx,
          f.customerId,
          "create",
          undefined,
          {
            mode: "new",
            displayName: name,
            age: "adult",
            preferences: prefs,
            relationship: f.relationship,
          },
          { key: randomUUID(), requestId: randomUUID() },
        );
        expect(first.personId).not.toBe(second.personId);
        expect(first.personId).not.toBe(f.personId);
        expect(f.writes.every((w) => w.personId !== f.personId)).toBe(true);
        expect(f.expressed[0]).toEqual({
          ...prefs,
          fit: "Original expressed fit",
          source: "Wearer said this",
        });
        expect(f.expressed[1]).toEqual(prefs);
        expect(f.relationship.authorised).toBe(false);
        expect(f.relationship.informed).toBe(false);
      },
    ),
    { numRuns: 30 },
  );
});
test("CW-08/11 no production policy or draft provenance shortcut and immutable bilingual fixture hash", async () => {
  const f = fixture();
  await expect(
    mutateWearer(
      { ...f.ctx, policy: blockedCustomerPolicy },
      f.customerId,
      "create",
      undefined,
      {
        mode: "new",
        displayName: "Synthetic",
        age: "adult",
        preferences: prefs,
        relationship: f.relationship,
      },
      { key: randomUUID(), requestId: randomUUID() },
    ),
  ).rejects.toMatchObject({ status: 409, message: "WEARER_POLICY_PENDING" });
  const n = syntheticWearerPolicy.notice;
  if (!n) throw Error("Synthetic wearer notice unavailable");
  expect(
    createHash("sha256").update(`${n.textEn}\n${n.textTa}`).digest("hex"),
  ).toBe(n.digest);
  expect(
    wearerDraftSchema.safeParse({
      synthetic: true,
      noticeId: n.id,
      customerId: f.customerId,
      customerVersion: 1,
      registration: {},
    }).success,
  ).toBe(true);
  expect(
    wearerDraftCommandSchema.safeParse({
      synthetic: true,
      noticeId: n.id,
      customerId: f.customerId,
      customerVersion: 1,
      registration: {},
    }).success,
  ).toBe(false);
  expect(
    wearerCreateSchema.safeParse({
      mode: "existing",
      wearerId: randomUUID(),
      expectedVersion: 1,
      relationship: f.relationship,
      age: "adult",
    }).success,
  ).toBe(false);
  expect(
    wearerPurposeEventSchema.safeParse({
      purpose: "marketing",
      decision: "grant",
      noticeId: n.id,
      giverPersonId: f.personId,
      language: "en",
      noticeExplained: false,
      source: "phone",
      occurredAt: "2026-10-17T00:00:00.000Z",
    }).success,
  ).toBe(false);
});
test("CW-07/13 delayed wearer denial cannot invalidate a later identity", async () => {
  let finish!: (v: unknown) => void;
  const body = new Promise<unknown>((resolve) => {
    finish = resolve;
  });
  vi.stubGlobal("fetch", async () => ({
    ok: false,
    status: 403,
    json: () => body,
  }));
  const pending = searchWearers(randomUUID(), { query: "" }),
    reject = expect(pending).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  await Promise.resolve();
  clearOwnerState();
  const invalidated = vi.fn(),
    unsub = onOwnerInvalidation(invalidated);
  finish({ error: { code: "SHOP_ACCESS_DENIED", message: "Denied" } });
  await reject;
  expect(invalidated).not.toHaveBeenCalled();
  unsub();
});

test("CW-12 partial interaction text can clear or remain whitespace in a draft, but promotion requires a complete interaction", () => {
  const f = fixture();
  for (const interaction of ["", "   "]) {
    const payload = {
      synthetic: true,
      noticeId: syntheticWearerPolicy.notice?.id,
      customerId: f.customerId,
      customerVersion: 1,
      registration: {
        mode: "new",
        displayName: "Synthetic",
        age: "adult",
        preferences: prefs,
        relationship: { ...f.relationship, interaction },
      },
    };
    expect(wearerDraftSchema.safeParse(payload).success).toBe(true);
    const command = wearerDraftCommandSchema.safeParse(payload);
    expect(command.success).toBe(false);
    if (!command.success)
      expect(
        command.error.issues.some(
          (issue) =>
            issue.path.join(".") === "registration.relationship.interaction",
        ),
      ).toBe(true);
  }
});

test("CW-05 family evidence distinguishes unknown from decline and rejects contradictory confirmations", async () => {
  const f = fixture();
  for (const relationship of [
    { ...f.relationship, authorised: true, authorisationDeclined: true },
    { ...f.relationship, informed: true, informedDeclined: true },
  ])
    await expect(
      mutateWearer(
        f.ctx,
        f.customerId,
        "create",
        undefined,
        {
          mode: "new",
          displayName: "Synthetic",
          age: "adult",
          preferences: prefs,
          relationship,
        },
        { key: randomUUID(), requestId: randomUUID() },
      ),
    ).rejects.toMatchObject({ status: 422 });
  expect(f.writes).toHaveLength(0);
});
