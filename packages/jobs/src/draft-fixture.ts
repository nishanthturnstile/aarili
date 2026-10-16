import { sql, type Transaction } from "@aarili/db";
import { fromDrizzle, type PgBoss } from "pg-boss";
import { syntheticQueue } from "./index.js";
// Disposable draft acceptance host only. No worker consumes this queue payload.
// No business values, credentials or personal data enter the queued locator.
export async function enqueueDraftFixtureJob(
  boss: PgBoss,
  tx: Transaction,
  payload: { shopId: string; draftId: string; actionId: string },
) {
  const id = await boss.send(
    syntheticQueue,
    { kind: "draft-fixture.v1", ...payload },
    { id: payload.actionId, db: fromDrizzle(tx, sql) },
  );
  if (id !== payload.actionId) throw Error("Draft fixture enqueue rejected");
}
