import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import type { SyntheticRecord } from "@aarili/contracts/command";
import { syntheticJobSchema } from "@aarili/contracts/jobs";
import { consumeSyntheticJob, inspectSyntheticJob } from "@aarili/core/jobs";
import {
  type Database,
  requireRuntimeRole,
  ShopAccessError,
  sql,
  type Transaction,
  withShop,
} from "@aarili/db";
import { commandRepository } from "@aarili/db/command-repository";
import { syntheticJobRepository } from "@aarili/db/jobs-repository";
import type { SyntheticJobWriter } from "@aarili/db/repositories/jobs";
import { restoreRepository } from "@aarili/db/restore-repository";
import { fromDrizzle, PgBoss } from "pg-boss";

export const syntheticQueue = "foundation.synthetic";

// No privileged URL; uses the supplied app_user database. Provisioning happens
// separately in reviewed SQL. This slice enables no worker/scheduler topology.
export async function startSyntheticQueue(db: Database) {
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
  boss.on("error", () => console.error("Synthetic queue unavailable"));
  try {
    await boss.start();
    if (!(await boss.getQueue(syntheticQueue)))
      throw new Error("Queue missing");
    return boss;
  } catch {
    await boss.stop();
    throw new Error(
      "Synthetic queue setup missing or incompatible; provision with migration authority",
    );
  }
}

export function syntheticJobWriter(
  boss: PgBoss,
  tx: Transaction,
  shopId: string,
  initiatorId: string,
): SyntheticJobWriter {
  return {
    async prepare() {
      if (!(await restoreRepository(tx, shopId).lockState()))
        throw new Error("CONTROL_UNKNOWN");
    },
    async enqueue(
      record: SyntheticRecord,
      commandRequestId: string,
      key: string,
    ) {
      const state = await restoreRepository(tx, shopId).lockState();
      if (!state) throw new Error("CONTROL_UNKNOWN");
      const payload = syntheticJobSchema.parse({
        requestId: record.eventId,
        shopId,
        initiatorId,
        entityId: record.id,
        version: record.version,
        epoch: state.epoch,
      });
      await tx.execute(sql`insert into synthetic_job_request(shop_id,id,initiator_id,entity_id,version,command_key,command_request_id,restore_epoch)
        values(${payload.shopId}::uuid,${payload.requestId}::uuid,${payload.initiatorId}::uuid,${payload.entityId}::uuid,${payload.version},${key}::uuid,${commandRequestId}::uuid,${state.epoch}::uuid)`);
      const jobId = await boss.send(syntheticQueue, payload, {
        id: payload.requestId,
        singletonKey: payload.requestId,
        singletonSeconds: 60,
        db: fromDrizzle(tx, sql),
      });
      if (jobId !== payload.requestId)
        throw new Error("Synthetic enqueue rejected");
    },
  };
}

export async function handleSyntheticJob(db: Database, input: unknown) {
  const parsed = syntheticJobSchema.safeParse(input);
  if (!parsed.success) return "ignored" as const;
  const p = parsed.data;
  try {
    return await withShop(db, p.initiatorId, p.shopId, async (tx) => {
      if (!(await restoreRepository(tx, p.shopId).lockState()))
        throw new Error("CONTROL_UNKNOWN");
      const context = {
        shopId: p.shopId,
        userId: p.initiatorId,
        jobs: syntheticJobRepository(tx, p.shopId),
        records: commandRepository(tx, p.shopId),
      };
      // Quarantine is a denial, not admission to an effect. A current own
      // membership can preserve its request provenance even if identity/role
      // authority has since been revoked. No effect runs before authorization.
      const inspected = await inspectSyntheticJob(context, p);
      if (typeof inspected === "string") return inspected;
      if (!(await authorizeJobPrincipal(tx, p.initiatorId, p.shopId)))
        return "ignored" as const;
      return consumeSyntheticJob(context, p);
    });
  } catch (error) {
    if (error instanceof ShopAccessError) {
      // A removed membership cannot be fabricated to write tenant quarantine.
      // Preserve old work in the queue's denied/quarantine state, carrying its
      // original locator/epoch and scrubbed reason. This check can only deny;
      // a later authorized attempt still rereads the immutable request in core.
      return db.transaction(async (tx) => {
        await requireRuntimeRole(tx);
        const state = await restoreRepository(tx).lockState();
        if (!state) throw new Error("CONTROL_UNKNOWN");
        return !p.epoch || p.epoch !== state.epoch
          ? ("quarantined" as const)
          : ("ignored" as const);
      });
    }
    throw error; // infrastructure failures remain retryable; no success recorded
  }
}
