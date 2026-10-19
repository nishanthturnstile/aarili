import type {
  CommitmentBindingDraft,
  CommitmentBindingRevision,
  ShopCommitmentsRevision,
} from "@aarili/contracts/shop-commitments";

export interface CommitmentBindingsRepository {
  lock(): Promise<void>;
  current(categoryId: string): Promise<CommitmentBindingRevision | undefined>;
  read(id: string): Promise<CommitmentBindingRevision | undefined>;
  history(
    categoryId: string,
    before?: number,
  ): Promise<CommitmentBindingRevision[]>;
  append(
    input: CommitmentBindingDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
      authority: CommitmentBindingRevision["authority"];
      digest: string;
    },
  ): Promise<CommitmentBindingRevision>;
  advance(
    revision: CommitmentBindingRevision,
    expected: number,
  ): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}

export interface ShopCommitmentsRepository {
  lock(): Promise<void>;
  current(): Promise<ShopCommitmentsRevision | undefined>;
  read(id: string): Promise<ShopCommitmentsRevision | undefined>;
  history(before?: number): Promise<ShopCommitmentsRevision[]>;
  append(input: {
    configuration: ShopCommitmentsRevision["configuration"];
    version: number;
    previousId: string | null;
    actorId: string;
    originDraftId: string;
    key: string;
    requestId: string;
  }): Promise<ShopCommitmentsRevision>;
  advance(
    revision: ShopCommitmentsRevision,
    expected: number,
  ): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
