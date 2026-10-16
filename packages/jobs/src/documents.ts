import { authorizeJobPrincipal } from "@aarili/auth/job-principal";
import { type DocumentContext, DocumentFailure } from "@aarili/core/documents";
import { createUsageWriter } from "@aarili/core/usage";
import { type Database, sql, type Transaction, withShop } from "@aarili/db";
import { documentRepository } from "@aarili/db/document-repository";
import type { DocumentAttempt } from "@aarili/db/repositories/documents";
import { usageRepository } from "@aarili/db/usage-repository";
import { fromDrizzle, type PgBoss } from "pg-boss";

export function documentJobWriter(
  boss: PgBoss,
  tx: Transaction,
  shopId: string,
) {
  return {
    async enqueue(a: DocumentAttempt) {
      const id = await boss.send(
        "pdf.render",
        {
          shopId,
          docId: a.docId,
          revision: a.revision,
          jobId: a.jobId,
          initiatorId: a.initiatorId,
          epoch: a.epoch,
        },
        {
          id: a.jobId,
          singletonKey: `${shopId}:${a.docId}:${a.revision}`,
          retryLimit: 3,
          db: fromDrizzle(tx, sql),
        },
      );
      if (id !== a.jobId) throw Error("DOCUMENT_ENQUEUE_REJECTED");
    },
    async phase(
      a: DocumentAttempt,
    ): Promise<"pending" | "rendering" | "failed" | "unavailable"> {
      const r = await tx.execute(
        sql`select state from pgboss.job where name='pdf.render' and id=${a.jobId}::uuid and data->>'shopId'=${shopId.toLowerCase()} and data->>'docId'=${a.docId} and data->>'revision'=${String(a.revision)} and data->>'jobId'=${a.jobId}`,
      );
      const state = r.rows[0]?.state;
      return state === "created" || state === "retry"
        ? "pending"
        : state === "active"
          ? "rendering"
          : ["failed", "cancelled", "completed"].includes(String(state))
            ? "failed"
            : "unavailable";
    },
  };
}
export type DocumentAdapters = (
  tx: Transaction,
  shopId: string,
  userId: string,
) => Pick<DocumentContext, "templates" | "policy" | "storage" | "jobs">;
export function documentProcessingHost(
  db: Database,
  shopId: string,
  userId: string,
  adapters: DocumentAdapters,
) {
  return {
    transaction<T>(run: (ctx: DocumentContext) => Promise<T>) {
      return withShop(db, userId, shopId, async (tx) => {
        if (!(await authorizeJobPrincipal(tx, userId, shopId)))
          throw new DocumentFailure(403, "DOCUMENT_ACCESS_DENIED");
        const writer = createUsageWriter(usageRepository(tx, shopId));
        return run({
          shopId,
          actor: { type: "user", id: userId },
          repository: documentRepository(tx, shopId),
          ...adapters(tx, shopId, userId),
          instrumentation: {
            async accepted(pdfActionId, bytesActionId, docId, bytes) {
              // Event identity is per event, not per transaction. Reusing an id
              // would conflict with usage's durable (shop,actionId) binding.
              await writer.record({
                actionId: pdfActionId,
                subjectId: docId,
                name: "pdf.rendered",
              });
              await writer.record({
                actionId: bytesActionId,
                subjectId: docId,
                name: "media.stored",
                bytes,
              });
            },
          },
        });
      });
    },
  };
}
