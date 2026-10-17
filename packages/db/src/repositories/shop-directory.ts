import type {
  DirectoryContent,
  DirectoryRevision,
} from "@aarili/contracts/shop-directory";
export interface ShopDirectoryRepository {
  lock(): Promise<void>;
  current(entryId: string): Promise<DirectoryRevision | undefined>;
  read(id: string): Promise<DirectoryRevision | undefined>;
  list(before?: string): Promise<DirectoryRevision[]>;
  history(entryId: string, before?: number): Promise<DirectoryRevision[]>;
  configuration(): Promise<{
    methodsId: string | null;
    enabled: string[];
    accounts: { method: string; active: boolean }[];
  }>;
  append(input: {
    entryId: string;
    content: DirectoryContent;
    version: number;
    previousId: string | null;
    actorId: string;
    originDraftId: string;
    key: string;
    requestId: string;
  }): Promise<DirectoryRevision>;
  advance(revision: DirectoryRevision, expected: number): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
