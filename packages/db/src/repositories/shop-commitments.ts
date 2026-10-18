import type { ShopCommitmentsRevision } from "@aarili/contracts/shop-commitments";

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
