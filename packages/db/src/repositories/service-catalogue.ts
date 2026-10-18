import type {
  CatalogueDraft,
  CatalogueRevision,
} from "@aarili/contracts/service-catalogue";
export interface ServiceCatalogueRepository {
  lock(): Promise<void>;
  current(entryId: string): Promise<CatalogueRevision | undefined>;
  read(id: string): Promise<CatalogueRevision | undefined>;
  definition(id: string): Promise<CatalogueRevision["definition"] | undefined>;
  list(query: {
    terms: string[];
    before?: string;
  }): Promise<CatalogueRevision[]>;
  history(entryId: string, before?: number): Promise<CatalogueRevision[]>;
  codeOwner(kind: string, code: string): Promise<string | null>;
  append(
    input: CatalogueDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
      authority: "owner-proposal" | "synthetic-fixture";
      contentHash: string;
      searchKeys: string[];
    },
  ): Promise<CatalogueRevision>;
  advance(revision: CatalogueRevision, expected: number): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
