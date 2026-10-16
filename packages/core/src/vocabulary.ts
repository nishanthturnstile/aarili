import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/command";
import {
  type VocabularyRevision,
  vocabularyInputSchema,
  vocabularyRevisionSchema,
} from "@aarili/contracts/vocabulary";
import type { VocabularyRepository } from "@aarili/db/repositories/vocabulary";
import { searchKeysV1 } from "@aarili/i18n/search";
import { requestHash } from "./request-binding.js";
export class VocabularyFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 412 | 422 | 428,
    code: string,
    public readonly current?: VocabularyRevision,
  ) {
    super(code);
  }
}
export async function reviseVocabulary(
  ctx: { shopId: string; actorId: string; repository: VocabularyRepository },
  vocabularyId: string,
  input: unknown,
  headers: { key?: string; requestId: string; ifMatch?: string },
): Promise<VocabularyRevision> {
  const parsed = vocabularyInputSchema.safeParse(input);
  if (
    !parsed.success ||
    ![
      ctx.shopId,
      ctx.actorId,
      vocabularyId,
      headers.key,
      headers.requestId,
    ].every((value) => idempotencyHeaderSchema.safeParse(value).success)
  )
    throw new VocabularyFailure(422, "VOCABULARY_INVALID");
  const actorId = ctx.actorId.toLowerCase(),
    id = vocabularyId.toLowerCase(),
    key = (headers.key as string).toLowerCase();
  // Creation uses an explicit caller-selected UUID and no If-Match; updates require it.
  const version =
    headers.ifMatch === undefined
      ? null
      : etagSchema.safeParse(headers.ifMatch).success
        ? Number(headers.ifMatch.slice(2, -1))
        : NaN;
  if (Number.isNaN(version))
    throw new VocabularyFailure(422, "VOCABULARY_INVALID");
  const binding = {
    actorId,
    action: "vocabulary.revise",
    hash: await requestHash({
      encoding: 1,
      shopId: ctx.shopId.toLowerCase(),
      actorId,
      id,
      version,
      command: parsed.data,
    }),
  };
  const repo = ctx.repository;
  await repo.lockKey(key);
  const prior = await repo.replay(key);
  if (prior) {
    if (
      prior.actorId !== binding.actorId ||
      prior.action !== binding.action ||
      prior.hash !== binding.hash
    )
      throw new VocabularyFailure(422, "IDEMPOTENCY_MISMATCH");
    return vocabularyRevisionSchema.parse(prior.response);
  }
  await repo.lockVocabulary(id);
  const current = await repo.current(id);
  if (current && version === null)
    throw new VocabularyFailure(428, "PRECONDITION_REQUIRED");
  if (current && current.revision !== version)
    throw new VocabularyFailure(412, "VERSION_STALE", current);
  if (!current && version !== null)
    throw new VocabularyFailure(404, "VOCABULARY_NOT_FOUND");
  if (current?.revision === 2147483647)
    throw new VocabularyFailure(409, "REVISION_EXHAUSTED");
  const revision: VocabularyRevision = {
    ...parsed.data,
    ...(await repo.ids()),
    vocabularyId: id,
    revision: (current?.revision ?? 0) + 1,
    previousId: current?.id ?? null,
    actorId,
    algorithmVersion: 1,
  };
  const keys = [revision.labelTa, revision.labelEn, ...revision.aliases].map(
    (value) => searchKeysV1(value),
  );
  await repo.append(revision, keys, key, headers.requestId.toLowerCase());
  if (!(await repo.advance(revision, current?.revision ?? null)))
    throw new VocabularyFailure(412, "VERSION_STALE");
  await repo.persist(key, binding, revision);
  return revision;
}
export async function resolveVocabulary(
  repo: VocabularyRepository,
  query: string,
) {
  const keys = searchKeysV1(query);
  if (!keys.nameTaNorm && !keys.nameLatinNorm && !keys.nameSkel) return [];
  return repo.resolve(keys);
}
