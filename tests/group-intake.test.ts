import { randomUUID } from "node:crypto";
import { DraftRequestError } from "@aarili/api/client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  emptyGroupIntake,
  emptyQuickOrder,
  groupIntakeCommandSchema,
  groupIntakeDraftSchema,
  includedOrderCommercialSchema,
} from "@aarili/contracts/orders";
import fc from "fast-check";
import { expect, test, vi } from "vitest";
import { createDraftRecovery } from "../apps/web/src/app/draft-recovery.js";

test("GB-C03/07/08 incomplete grouped inputs retain stable order, hidden details and explicit zero/reference unknowns", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          instructions: fc.string({ maxLength: 100 }),
          priceText: fc.constantFrom("", "0", "1200.25"),
          deliveryDate: fc.constantFrom("", "2026-12-01"),
          presentation: fc.constantFrom("simple" as const, "detailed" as const),
        }),
        { maxLength: 20 },
      ),
      (items) => {
        const input = {
          ...emptyGroupIntake(),
          lines: items.map((v) => ({
            id: randomUUID(),
            intake: { ...emptyQuickOrder(), ...v },
          })),
        };
        const draft = groupIntakeDraftSchema.parse(input);
        expect(draft.lines.map((l) => l.id)).toEqual(
          input.lines.map((l) => l.id),
        );
        expect(draft.lines.map((l) => l.intake)).toEqual(
          input.lines.map((l) => l.intake),
        );
        const reverse = groupIntakeDraftSchema.parse({
          ...draft,
          lines: [...draft.lines].reverse(),
        });
        expect([...reverse.lines].reverse()).toEqual(draft.lines);
        const detailed = {
          ...draft,
          lines: draft.lines.map((l) => ({
            ...l,
            intake: { ...l.intake, presentation: "detailed" },
          })),
        };
        const simple = groupIntakeDraftSchema
          .parse(detailed)
          .lines.map((l, i) => ({
            ...l,
            intake: {
              ...l.intake,
              presentation: draft.lines[i]?.intake.presentation,
            },
          }));
        expect(simple).toEqual(draft.lines);
      },
    ),
  );
  expect(groupIntakeCommandSchema.safeParse(emptyGroupIntake()).success).toBe(
    false,
  );
  const included = {
    schemaVersion: 2,
    basis: "package-included",
    packageVersionId: randomUUID(),
    groupDraftId: randomUUID(),
    lineId: randomUUID(),
    allocationPaise: null,
    referencePaise: 0,
  };
  expect(includedOrderCommercialSchema.parse(included).referencePaise).toBe(0);
  expect(
    includedOrderCommercialSchema.safeParse({ ...included, allocationPaise: 0 })
      .success,
  ).toBe(false);
  expect(
    includedOrderCommercialSchema.safeParse({ ...included, schemaVersion: 3 })
      .success,
  ).toBe(false);
  const line = { id: randomUUID(), intake: emptyQuickOrder() };
  expect(
    groupIntakeDraftSchema.safeParse({
      ...emptyGroupIntake(),
      lines: [line, line],
    }).success,
  ).toBe(false);
});
test("GB-C07 uncertain conversion freezes its envelope, blocks duplicate actions and recovers its durable target", async () => {
  const id = "019a5e55-2222-7000-8000-000000000001",
    r: DraftRecord = {
      id,
      workflow: "order.quick",
      schemaVersion: 1,
      payload: emptyQuickOrder(),
      version: 1,
      creatorId: id,
      lifecycle: "active",
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
      stale: false,
      result: null,
    };
  let tries = 0;
  const convert = vi.fn(async (_id: string, _key: string, _etag: string) => {
    if (++tries === 1) throw Error("Lost committed conversion response");
    return {
      draft: {
        ...r,
        version: 2,
        lifecycle: "promoted" as const,
        result: { type: "order.group-draft", id },
      },
    };
  });
  const promote = vi.fn(),
    save = vi.fn();
  const controller = createDraftRecovery({
    id,
    workflow: r.workflow,
    schemaVersion: 1,
    initial: r.payload,
    record: r,
    key: () => "frozen-conversion-key",
    transport: { read: async () => r, save, promote, convert },
  });
  await controller.convert();
  expect(controller.snapshot().status).toBe("checking");
  controller.edit({ instructions: "newer edit must not replace conversion" });
  await controller.convert();
  await controller.promote();
  expect(convert).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().values).toEqual(r.payload);
  await controller.retry();
  expect(convert.mock.calls).toEqual([
    [id, "frozen-conversion-key", '"v1"'],
    [id, "frozen-conversion-key", '"v1"'],
  ]);
  expect(controller.snapshot().status).toBe("promoted");
  expect(controller.snapshot().committed?.result?.type).toBe(
    "order.group-draft",
  );
  expect(promote).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  controller.dispose();
});
test("GB-C07 explicit retry retains a known rate-rejected business command until input changes", async () => {
  const id = "019a5e55-2222-7000-8000-000000000001",
    record: DraftRecord = {
      id,
      workflow: "order.group",
      schemaVersion: 1,
      payload: { instructions: "SYNTHETIC" },
      version: 1,
      creatorId: id,
      lifecycle: "active",
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-20T00:00:00.000Z",
      stale: false,
      result: null,
    };
  let calls = 0;
  const promote = vi.fn(async (_id: string, _key: string, _etag: string) => {
    if (++calls === 1)
      throw new DraftRequestError(
        429,
        {
          error: { code: "RATE_LIMITED", message: "Wait" },
        },
        null,
      );
    return {
      draft: {
        ...record,
        version: 2,
        lifecycle: "promoted" as const,
        result: { type: "booking.revision", id },
      },
    };
  });
  const c = createDraftRecovery({
    id,
    workflow: record.workflow,
    schemaVersion: 1,
    initial: record.payload,
    record,
    key: () => "rate-rejected-key",
    transport: { read: async () => record, save: vi.fn(), promote },
  });
  await c.promote();
  expect(c.snapshot().work.outcomeUnknown).toBe(false);
  expect(c.snapshot().pendingPromotion).toBe(false);
  c.composition(true);
  await c.retry();
  expect(promote).toHaveBeenCalledTimes(1);
  c.composition(false);
  await c.retry();
  expect(promote.mock.calls).toEqual([
    [id, "rate-rejected-key", '"v1"'],
    [id, "rate-rejected-key", '"v1"'],
  ]);
  expect(c.snapshot().status).toBe("promoted");
  c.dispose();
  let attempts = 0;
  const stopped = vi.fn(async () => {
      attempts++;
      throw new DraftRequestError(
        429,
        {
          error: { code: "RATE_LIMITED", message: "Wait" },
        },
        null,
      );
    }),
    save = vi.fn(
      async (_id: string, input: { payload: Record<string, unknown> }) => ({
        draft: { ...record, payload: input.payload, version: 2 },
      }),
    );
  const edited = createDraftRecovery({
    id,
    workflow: record.workflow,
    schemaVersion: 1,
    initial: record.payload,
    record,
    key: () => "changed-key",
    transport: { read: async () => record, save, promote: stopped },
  });
  await edited.promote();
  edited.edit({ instructions: "newer local input" });
  await edited.retry();
  expect(attempts).toBe(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(edited.snapshot().status).toBe("saved");
  edited.dispose();
});
