import type { DocumentIssue } from "@aarili/contracts/documents";
import {
  type JobSlipModel,
  type JobSlipReview,
  type JobSlipScope,
  jobSlipIssueSchema,
  jobSlipModelSchema,
  jobSlipReviewCommandSchema,
  jobSlipReviewSchema,
} from "@aarili/contracts/job-slips";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import type {
  JobSlipBinding,
  JobSlipsRepository,
} from "@aarili/db/repositories/job-slips";
import {
  type DocumentContext,
  DocumentFailure,
  type DocumentRenderAsset,
  issueDocument,
} from "./documents.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export interface JobSlipSources {
  review(
    scope: JobSlipScope,
    omittedAssetIds: string[],
  ): Promise<{
    model: JobSlipModel;
    version: number;
    blockers: JobSlipReview["blockers"];
    optionalAssets?: JobSlipReview["optionalAssets"];
    subject: Pick<
      JobSlipBinding,
      "customerId" | "wearerId" | "designId" | "measurementId" | "patternId"
    >;
  }>;
  authorize(binding: JobSlipBinding): Promise<boolean>;
  assets(model: JobSlipModel): Promise<DocumentRenderAsset[]>;
}
export type JobSlipsContext = {
  documents: DocumentContext;
  repository: JobSlipsRepository;
  sources: JobSlipSources;
};
function fail(status: DocumentFailure["status"], code: string): never {
  throw new DocumentFailure(status, code);
}
const issueShape = (d: DocumentIssue): DocumentIssue => ({
  docId: d.docId,
  revision: d.revision,
  template: d.template,
  templateRevision: d.templateRevision,
  language: d.language,
  paper: d.paper,
  model: d.model,
});

// This preflight also runs before the generic document lock in API/worker paths.
// Privacy takes the same shop-wide barrier before source locks or redaction.
export function jobSlipDocumentContext(
  base: DocumentContext,
  repository: JobSlipsRepository,
  sources: JobSlipSources,
): DocumentContext {
  return {
    ...base,
    prepare: () => repository.lock(),
    storageBarrier: (d) => d.template === "job-slip",
    renderAssets: async (d) =>
      d.template === "job-slip"
        ? sources.assets(jobSlipModelSchema.parse(d.model))
        : [],
    policy: {
      async authorize(d, action) {
        if (d.template !== "job-slip") return base.policy.authorize(d, action);
        const binding = await repository.binding(d.docId, d.revision);
        const model = jobSlipModelSchema.safeParse(d.model);
        return (
          !!binding &&
          !binding.revoked &&
          model.success &&
          model.data.issued?.docId === d.docId &&
          model.data.issued.revision === d.revision &&
          model.data.orderId === binding.orderId &&
          model.data.pieceId === binding.pieceId &&
          d.templateRevision === 1 &&
          d.paper === "A4" &&
          model.data.language === d.language &&
          (await requestHash(model.data)) === binding.modelHash &&
          (await sources.authorize(binding))
        );
      },
    },
  };
}
export async function reviewJobSlip(ctx: JobSlipsContext, input: unknown) {
  const p = jobSlipReviewCommandSchema.safeParse(input);
  if (
    !p.success ||
    new Set(p.data.omittedAssetIds).size !== p.data.omittedAssetIds.length
  )
    fail(422, "VALIDATION_FAILED");
  await ctx.repository.lock();
  const r = await ctx.sources.review(p.data, p.data.omittedAssetIds);
  const history = await ctx.repository.history(p.data);
  const head = history[0]?.revision ?? 0;
  return jobSlipReviewSchema.parse({
    model: r.model,
    version: r.version + head,
    sourceDigest: await requestHash({
      model: r.model,
      version: r.version,
      head,
    }),
    blockers: r.blockers,
    history,
    optionalAssets: r.optionalAssets ?? [],
  });
}
export async function issueJobSlip(
  ctx: JobSlipsContext,
  input: unknown,
  key: string,
  ifMatch: string | null,
) {
  if (!idempotencyHeaderSchema.safeParse(key).success)
    fail(422, "VALIDATION_FAILED");
  key = key.toLowerCase();
  const p = jobSlipIssueSchema.safeParse(input);
  if (!p.success) fail(422, "VALIDATION_FAILED");
  const command = p.data;
  await ctx.repository.lock();
  const commandHash = await requestHash({ command, ifMatch });
  // Durable replay reauthorizes the frozen source; it does not select today's versions.
  const replay = await ctx.documents.repository.issuedByKey(key);
  if (replay) {
    const binding = await ctx.repository.binding(replay.docId, replay.revision);
    if (
      !binding ||
      binding.commandHash !== commandHash ||
      replay.creatorId !== ctx.documents.actor.id
    )
      fail(422, "IDEMPOTENCY_MISMATCH");
    return {
      status: await issueDocument(ctx.documents, issueShape(replay), key),
      sourceDigest: binding.sourceDigest,
    };
  }
  const expected = parseExpectedVersion(ifMatch ?? undefined);
  if (!expected.ok) fail(expected.status, expected.code);
  const review = await reviewJobSlip(ctx, {
    orderId: command.orderId,
    pieceId: command.pieceId,
    omittedAssetIds: command.omittedAssetIds,
  });
  if (
    expected.version !== review.version ||
    command.sourceDigest !== review.sourceDigest
  )
    fail(412, "JOB_SLIP_SOURCE_CHANGED");
  if (review.blockers.length) fail(409, "JOB_SLIP_SOURCE_BLOCKED");
  const head = review.history[0];
  if (
    (head && head.docId !== command.docId) ||
    command.revision !== (head?.revision ?? 0) + 1
  )
    fail(409, "DOCUMENT_REVISION_EXISTS");
  if (await ctx.documents.repository.read(command.docId, command.revision))
    fail(409, "DOCUMENT_REVISION_EXISTS");
  const source = await ctx.sources.review(command, command.omittedAssetIds);
  const model = jobSlipModelSchema.parse({
    ...review.model,
    language: command.language,
    issued: {
      docId: command.docId,
      revision: command.revision,
      at: (await ctx.documents.repository.now()).toISOString(),
      reason: command.reason,
    },
  });
  await ctx.repository.bind({
    orderId: command.orderId,
    pieceId: command.pieceId,
    docId: command.docId,
    revision: command.revision,
    ...source.subject,
    sourceDigest: review.sourceDigest,
    commandHash,
    modelHash: await requestHash(model),
    revoked: false,
  });
  const status = await issueDocument(
    ctx.documents,
    {
      docId: command.docId,
      revision: command.revision,
      template: "job-slip",
      templateRevision: 1,
      language: command.language,
      paper: "A4",
      model,
    },
    key,
  );
  return { status, sourceDigest: review.sourceDigest };
}
