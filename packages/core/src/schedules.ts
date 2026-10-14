import type { ScheduleRepository } from "@aarili/db/repositories/schedules";

// A fixed registry supplies task identity; queue input cannot supply an actor,
// date, epoch, or authorizing user. Durable run/date uniqueness outlives pg-boss.
export async function inspectSchedule(
  repository: ScheduleRepository,
  id: string,
) {
  const epoch = await repository.epoch();
  if (!epoch) throw Error("CONTROL_UNKNOWN");
  const run = await repository.run(id);
  if (!run) return "ignored" as const;
  await repository.lock(run.task);
  if (await repository.quarantined(id)) return "quarantined" as const;
  if (run.epoch !== epoch) {
    await repository.quarantine(run, epoch);
    return "quarantined" as const;
  }
  if (!(await repository.enabled(run))) return "ignored" as const;
  return run;
}
export async function consumeSchedule(
  repository: ScheduleRepository,
  id: string,
) {
  const run = await inspectSchedule(repository, id);
  if (typeof run === "string") return run;
  if (await repository.effected(id)) return "duplicate" as const;
  await repository.apply(run);
  return "applied" as const;
}
