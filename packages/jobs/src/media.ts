import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { type MediaContext, MediaFailure } from "@aarili/core/media";
import { createUsageWriter } from "@aarili/core/usage";
import { type Database, sql, type Transaction, withShop } from "@aarili/db";
import { mediaRepository } from "@aarili/db/media-repository";
import type { MediaAttempt } from "@aarili/db/repositories/media";
import { usageRepository } from "@aarili/db/usage-repository";
import { fromDrizzle, type PgBoss } from "pg-boss";
// Composed only inside the verified media transaction. No queue start/provision
// or provider activation. The production registry composes the reviewed handler.
export function mediaJobWriter(boss: PgBoss, tx: Transaction, shopId: string) {
  return {
    async status(
      attempt: MediaAttempt,
    ): Promise<"queued" | "running" | "retrying" | "failed" | "unavailable"> {
      const result = await tx.execute(
        sql`select state from pgboss.job where name='media.process' and id=${attempt.id}::uuid and data->>'shopId'=${shopId.toLowerCase()} and data->>'assetId'=${attempt.assetId.toLowerCase()} and data->>'attemptId'=${attempt.id.toLowerCase()}`,
      );
      const state = result.rows[0]?.state;
      return state === "created"
        ? "queued"
        : state === "active"
          ? "running"
          : state === "retry"
            ? "retrying"
            : state === "failed" ||
                state === "cancelled" ||
                state === "completed"
              ? "failed"
              : "unavailable";
    },
    async enqueue(attempt: MediaAttempt) {
      const id = await boss.send(
        "media.process",
        {
          shopId,
          assetId: attempt.assetId,
          attemptId: attempt.id,
          initiatorId: attempt.initiatorId,
          epoch: attempt.epoch,
        },
        {
          id: attempt.id,
          singletonKey: `${shopId}:${attempt.assetId}`,
          db: fromDrizzle(tx, sql),
        },
      );
      if (id !== attempt.id) throw Error("Media enqueue rejected");
    },
  };
}

// Every claim/finalization opens a fresh verified tenant/principal transaction;
// core rechecks durable restore epoch and attempt after storage I/O.
export function mediaProcessingHost(
  db: Database,
  shopId: string,
  userId: string,
  adapters: (
    tx: Transaction,
  ) => Pick<MediaContext, "policy" | "storage" | "jobs">,
) {
  return {
    transaction<T>(run: (ctx: MediaContext) => Promise<T>) {
      return withShop(db, userId, shopId, async (tx) => {
        if (!(await authorizeJobPrincipal(tx, userId, shopId)))
          throw new MediaFailure(403, "MEDIA_ACCESS_DENIED");
        const writer = createUsageWriter(usageRepository(tx, shopId));
        return run({
          shopId,
          actor: { type: "user", id: userId },
          repository: mediaRepository(tx, shopId),
          ...adapters(tx),
          instrumentation: {
            stored: async (actionId, assetId, bytes) =>
              writer.record({
                actionId,
                subjectId: assetId,
                name: "media.stored",
                bytes,
              }),
          },
        });
      });
    },
  };
}
