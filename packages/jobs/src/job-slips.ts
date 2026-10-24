import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import type {
  JobSlipPurgeContext,
  JobSlipPurgeHost,
} from "@aarili/core/job-slip-purge";
import { type Database, withShop } from "@aarili/db";
import { jobSlipPurgeRepository } from "@aarili/db/job-slips-repository";

export function jobSlipPurgeHost(
  db: Database,
  shopId: string,
  userId: string,
  storage: JobSlipPurgeContext["storage"],
): JobSlipPurgeHost {
  return {
    transaction: (run) =>
      withShop(db, userId, shopId, async (tx) => {
        if (!(await authorizeJobPrincipal(tx, userId, shopId)))
          throw Error("Document erasure principal unavailable");
        return run({
          actorId: userId,
          repository: jobSlipPurgeRepository(tx, shopId),
          storage,
        });
      }),
  };
}
