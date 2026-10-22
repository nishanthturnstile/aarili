import type {
  DesignChoicesDraft,
  DesignChoicesRevision,
} from "@aarili/contracts/design-choices";
export interface DesignChoicesRepository {
  questionSemantics(id: string): Promise<unknown[]>;
  lock(): Promise<void>;
  current(entryId: string): Promise<DesignChoicesRevision | undefined>;
  read(id: string): Promise<DesignChoicesRevision | undefined>;
  definition(
    id: string,
  ): Promise<DesignChoicesRevision["definition"] | undefined>;
  list(query: {
    terms: string[];
    before?: string;
  }): Promise<DesignChoicesRevision[]>;
  history(entryId: string, before?: number): Promise<DesignChoicesRevision[]>;
  codeOwner(kind: string, code: string): Promise<string | null>;
  append(
    input: DesignChoicesDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
      authority: "owner-proposal" | "synthetic-fixture";
      contentHash: string;
      searchKeys: string[];
    },
  ): Promise<DesignChoicesRevision>;
  advance(revision: DesignChoicesRevision, expected: number): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
