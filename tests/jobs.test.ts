import { randomUUID } from "node:crypto";
import { syntheticJobSchema } from "@aarili/contracts/jobs";
import { requestHash } from "@aarili/core/commands";
import fc from "fast-check";
import { expect, test } from "vitest";

const payload = {
  requestId: randomUUID(),
  shopId: randomUUID(),
  initiatorId: randomUUID(),
  entityId: randomUUID(),
  version: 1,
};

test("0.3.2a D3 ID/version-only payload rejects snapshots, credentials, content and arbitrary fields", () => {
  expect(syntheticJobSchema.parse(payload)).toEqual(payload);
  for (const extra of [
    { token: "fixture" },
    { value: "alpha" },
    { amountPaise: 50 },
    { actor: { type: "system" } },
    { state: "finalized" },
    { name: "Synthetic" },
  ])
    expect(syntheticJobSchema.safeParse({ ...payload, ...extra }).success).toBe(
      false,
    );
  for (const version of [0, -1, 1.5, 2147483648, NaN, Infinity, "1"])
    expect(syntheticJobSchema.safeParse({ ...payload, version }).success).toBe(
      false,
    );
  expect(
    syntheticJobSchema.safeParse({ ...payload, requestId: "not-an-id" })
      .success,
  ).toBe(false);
});

test("0.3.2a D3/D5 deterministic binding retains every authoritative locator; seeded property coverage", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      fc.integer({ min: 1, max: 2147483647 }),
      async (id, version) => {
        const p = syntheticJobSchema.parse({
          ...payload,
          requestId: id,
          version,
        });
        expect(await requestHash(p)).toBe(
          await requestHash({
            version: p.version,
            entityId: p.entityId,
            initiatorId: p.initiatorId,
            shopId: p.shopId,
            requestId: p.requestId,
          }),
        );
        for (const field of [
          "requestId",
          "shopId",
          "initiatorId",
          "entityId",
        ] as const)
          expect(await requestHash({ ...p, [field]: randomUUID() })).not.toBe(
            await requestHash(p),
          );
      },
    ),
    { seed: 350003, numRuns: 50 },
  );
});
