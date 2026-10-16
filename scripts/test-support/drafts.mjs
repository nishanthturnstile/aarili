import { DraftFailure } from "@aarili/core/drafts";
import { sql } from "@aarili/db";
import { enqueueDraftFixtureJob } from "@aarili/jobs/draft-fixture";

// Test-only schema pair. No numeric coercion or approval authority from drafts.
const incompleteSchema = {
  safeParse(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some(
        (k) =>
          !["value", "amountRaw", "measurementRaw", "oldApproval"].includes(k),
      )
    )
      return { success: false };
    if (
      Object.entries(value).some(([k, v]) =>
        k === "oldApproval" ? typeof v !== "boolean" : typeof v !== "string",
      )
    )
      return { success: false };
    return { success: true, data: { ...value } };
  },
};
const completeSchema = {
  safeParse(value) {
    const parsed = incompleteSchema.safeParse(value);
    if (
      !parsed.success ||
      !["alpha", "beta"].includes(value.value) ||
      !(value.amountRaw ?? "").match(/^[1-9][0-9]*$/) ||
      !(value.measurementRaw ?? "").match(/^[1-9][0-9]*$/)
    )
      return { success: false };
    // Never copy old approval flags into the authoritative command.
    const { oldApproval: _discard, ...data } = parsed.data;
    return { success: true, data };
  },
};
export function syntheticDraftRegistry(
  tx,
  shopId,
  { failure, boss, wrongResult } = {},
) {
  return new Map([
    [
      "fixture.intake",
      {
        schemaVersion: 1,
        draftSchema: incompleteSchema,
        commandSchema: completeSchema,
        async revalidate(_command, draftId) {
          const result = await tx.execute(
            sql`select duplicate,authorized from draft_synthetic_state where shop_id=${shopId}::uuid and id=${draftId}::uuid for update`,
          );
          const state = result.rows[0];
          if (!state || state.duplicate || !state.authorized)
            throw new DraftFailure(409, {
              error: {
                code: "REQUEST_CONFLICT",
                message: "Current authority or duplicate check rejected",
              },
            });
        },
        async verifyResult(result, draftId) {
          const found = await tx.execute(
            sql`select 1 from draft_synthetic_result where shop_id=${shopId}::uuid and id=${result.id}::uuid and draft_id=${draftId}::uuid`,
          );
          if (result.type !== "fixture.intake" || !found.rowCount)
            throw new DraftFailure(409, {
              error: {
                code: "REQUEST_CONFLICT",
                message: "Result linkage denied",
              },
            });
        },
        async promote(command, _actionId, draftId) {
          if ("oldApproval" in command) throw Error("Old approval copied");
          const result = await tx.execute(
            sql`insert into draft_synthetic_result(shop_id,draft_id,value) values(${shopId}::uuid,${draftId}::uuid,${command.value}) returning id`,
          );
          const id = result.rows[0].id;
          if (failure === "result") throw Error("Injected after result");
          await tx.execute(
            sql`insert into draft_synthetic_enlisted(shop_id,id) values(${shopId}::uuid,${id}::uuid)`,
          );
          if (failure === "enlisted")
            throw Error("Injected after enlisted write");
          if (boss)
            await enqueueDraftFixtureJob(boss, tx, {
              shopId,
              draftId,
              actionId: _actionId,
            });
          if (failure === "queue") throw Error("Injected after queue");
          return wrongResult ?? { type: "fixture.intake", id };
        },
      },
    ],
  ]);
}
