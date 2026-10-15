import { type Database, requireRuntimeRole, sql } from "@aarili/db";
import { fromDrizzle, PgBoss } from "pg-boss";

// No privileged URL; uses the supplied app_user database. Provisioning happens
// separately in reviewed SQL. Runtime composition never provisions queues.
export async function startQueue(
  db: Database,
  requiredQueues: readonly string[] = [],
) {
  await requireRuntimeRole(db);
  const boss = new PgBoss({
    db: fromDrizzle(db, sql),
    schema: "pgboss",
    migrate: false,
    createSchema: false,
    supervise: false,
    schedule: false,
    registerInstance: false,
    persistWarnings: false,
    persistQueueStats: false,
    useListenNotify: false,
  });
  boss.on("error", () => console.error("Job queue unavailable"));
  try {
    await boss.start();
    for (const name of requiredQueues)
      if (!(await boss.getQueue(name))) throw new Error("Queue missing");
    return boss;
  } catch {
    await boss.stop();
    throw new Error(
      "Job queue setup missing or incompatible; provision with migration authority",
    );
  }
}
