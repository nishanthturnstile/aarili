import type {
  RestoreRepository,
  RestoreState,
} from "@aarili/db/repositories/restore";

export type EffectDenial =
  | "operator_disabled"
  | "control_unknown"
  | "database_disabled"
  | "missing_epoch"
  | "old_epoch"
  | "practice"
  | "authority_revoked"
  | "obsolete_state";
export function effectDenial(
  state: RestoreState | undefined,
  operator: unknown,
  epoch: string | undefined,
  practice: unknown,
  authorized: unknown,
  current: unknown,
): EffectDenial | undefined {
  if (operator !== "enabled") return "operator_disabled";
  if (
    !state ||
    typeof state.epoch !== "string" ||
    typeof state.outbound !== "boolean" ||
    typeof state.frozen !== "boolean"
  )
    return "control_unknown";
  if (!state.outbound) return "database_disabled";
  if (!epoch) return "missing_epoch";
  if (state.epoch !== epoch) return "old_epoch";
  if (practice !== false) return "practice";
  if (authorized !== true) return "authority_revoked";
  if (current !== true) return "obsolete_state";
  return undefined;
}

// Same reusable gate for confirmations, allocations, reversals and refunds.
// All mutations remain in the caller's bound transaction, under this lock.
export async function requireUnfrozenMoney(
  repository: RestoreRepository,
): Promise<void> {
  const state = await repository.lockState();
  if (state?.frozen !== false || (await repository.practice()) !== false)
    throw new Error("FINANCIAL_MUTATION_FROZEN");
}

// Boundary composition supplies current authority/entity readers and the
// process-owned operator switch. None are fields in a browser/queue payload.
export async function guardedEffect(
  repository: RestoreRepository,
  operator: () => unknown,
  readCurrent: () => Promise<{
    epoch: string | undefined;
    practice: unknown;
    authorized: unknown;
    current: unknown;
  }>,
  invoke: () => Promise<void>,
): Promise<"applied" | EffectDenial> {
  try {
    for (let check = 0; check < 2; check++) {
      const state = await repository.lockState();
      const current = await readCurrent();
      const denied = effectDenial(
        state,
        operator(),
        current.epoch,
        current.practice,
        current.authorized,
        current.current,
      );
      if (denied) return denied;
    }
  } catch {
    return "control_unknown";
  }
  await invoke();
  return "applied";
}
