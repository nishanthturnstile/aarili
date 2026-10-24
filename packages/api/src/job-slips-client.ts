import {
  type JobSlipIssue,
  type JobSlipScope,
  jobSlipIssueResultSchema,
  jobSlipReviewSchema,
} from "@aarili/contracts/job-slips";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createJobSlipRoutes } from "./job-slips.js";
export class JobSlipRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const client = () => hc<ReturnType<typeof createJobSlipRoutes>>("/api");
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (r.status === 401 || r.status === 403) clearOwnerState();
  if (!r.ok) {
    const error = data as { error?: { code?: string } };
    throw new JobSlipRequestError(
      r.status,
      error.error?.code ?? "REQUEST_FAILED",
    );
  }
  const review = jobSlipReviewSchema.safeParse(data);
  const issue = jobSlipIssueResultSchema.safeParse(data);
  const version = review.success
    ? review.data.version
    : issue.success
      ? issue.data.status.version
      : null;
  if (!version || r.headers.get("ETag") !== `"v${version}"`)
    throw new OwnerRequestError("REQUEST_FAILED");
  return data;
}
export async function readJobSlip(
  shopId: string,
  scope: JobSlipScope,
  omittedAssetIds: string[] = [],
) {
  return jobSlipReviewSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["job-slips"].review.$post(
          { param: { shopId }, json: { ...scope, omittedAssetIds } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function createJobSlipIssue(
  shopId: string,
  input: JobSlipIssue,
  key: string,
  version: number,
) {
  return jobSlipIssueResultSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["job-slips"].$post(
          {
            param: { shopId },
            json: input,
            header: { "idempotency-key": key, "if-match": `"v${version}"` },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
