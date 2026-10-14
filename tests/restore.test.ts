import {
  effectDenial,
  guardedEffect,
  requireUnfrozenMoney,
} from "@aarili/core/restore";
import type { RestoreState } from "@aarili/db/repositories/restore";
import fc from "fast-check";
import { expect, test } from "vitest";

const state: RestoreState = { epoch: "epoch-A", outbound: true, frozen: false };
test("0.3.2b E1/E3/E8 TRU-10 AC-56 strict fail-closed boundary matrix", () => {
  expect(
    effectDenial(state, "enabled", "epoch-A", false, true, true),
  ).toBeUndefined();
  for (const operator of [
    undefined,
    null,
    "disabled",
    "true",
    true,
    "invalid",
    "",
  ])
    expect(effectDenial(state, operator, "epoch-A", false, true, true)).toBe(
      "operator_disabled",
    );
  expect(effectDenial(undefined, "enabled", "epoch-A", false, true, true)).toBe(
    "control_unknown",
  );
  expect(
    effectDenial(
      { ...state, frozen: null } as never,
      "enabled",
      "epoch-A",
      false,
      true,
      true,
    ),
  ).toBe("control_unknown");
  expect(
    effectDenial(
      { ...state, outbound: false },
      "enabled",
      "epoch-A",
      false,
      true,
      true,
    ),
  ).toBe("database_disabled");
  expect(effectDenial(state, "enabled", undefined, false, true, true)).toBe(
    "missing_epoch",
  );
  expect(effectDenial(state, "enabled", "epoch-B", false, true, true)).toBe(
    "old_epoch",
  );
  for (const practice of [true, undefined, null, "false"])
    expect(
      effectDenial(state, "enabled", "epoch-A", practice, true, true),
    ).toBe("practice");
  for (const authority of [false, undefined, null, "true"])
    expect(
      effectDenial(state, "enabled", "epoch-A", false, authority, true),
    ).toBe("authority_revoked");
  expect(
    effectDenial(state, "enabled", "epoch-A", false, true, undefined),
  ).toBe("obsolete_state");
});

test("0.3.2b E1/E4/E8 seeded independent/combined guards and unknown money state never allow mutation", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      async (enabled, outbound, practice, authority, current) => {
        const denied = effectDenial(
          { ...state, outbound },
          enabled ? "enabled" : "disabled",
          "epoch-A",
          practice,
          authority,
          current,
        );
        expect(denied === undefined).toBe(
          enabled && outbound && !practice && authority && current,
        );
        const repository = {
          lockState: async () => ({ ...state, frozen: !outbound }),
          practice: async () => practice,
        };
        if (outbound && !practice) await requireUnfrozenMoney(repository);
        else
          await expect(requireUnfrozenMoney(repository)).rejects.toThrow(
            "FINANCIAL_MUTATION_FROZEN",
          );
      },
    ),
    { seed: 360001, numRuns: 100 },
  );
  await expect(
    requireUnfrozenMoney({
      lockState: async () => undefined,
      practice: async () => false,
    }),
  ).rejects.toThrow();
});

test("0.3.2b E3 database failure between checks denies the immediate adapter boundary", async () => {
  let reads = 0,
    calls = 0;
  const result = await guardedEffect(
    {
      lockState: async () => {
        if (++reads === 2) throw Error("private-canary");
        return state;
      },
      practice: async () => false,
    },
    () => "enabled",
    async () => ({
      epoch: state.epoch,
      practice: false,
      authorized: true,
      current: true,
    }),
    async () => {
      calls++;
    },
  );
  expect(result).toBe("control_unknown");
  expect(calls).toBe(0);
});
