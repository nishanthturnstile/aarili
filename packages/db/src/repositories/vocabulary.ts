import type { VocabularyRevision } from "@aarili/contracts/vocabulary";
export type VocabularyBinding = {
  actorId: string;
  hash: string;
  action: string;
};
export type VocabularyKeys = {
  nameTaNorm: string;
  nameLatinNorm: string;
  nameSkel: string;
};
// Composition supplies the already-authorised withShop transaction.
export interface VocabularyRepository {
  lockKey(key: string): Promise<void>;
  lockVocabulary(id: string): Promise<void>;
  replay(
    key: string,
  ): Promise<(VocabularyBinding & { response: unknown }) | undefined>;
  current(id: string): Promise<VocabularyRevision | undefined>;
  read(id: string): Promise<VocabularyRevision | undefined>;
  ids(): Promise<{ id: string; eventId: string }>;
  append(
    revision: VocabularyRevision,
    keys: readonly VocabularyKeys[],
    key: string,
    requestId: string,
  ): Promise<void>;
  advance(
    revision: VocabularyRevision,
    expected: number | null,
  ): Promise<boolean>;
  persist(
    key: string,
    binding: VocabularyBinding,
    response: VocabularyRevision,
  ): Promise<void>;
  resolve(keys: VocabularyKeys): Promise<VocabularyRevision[]>;
}
