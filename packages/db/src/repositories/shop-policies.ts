import type {
  ShopPoliciesDraft,
  ShopPoliciesRevision,
} from "@aarili/contracts/shop-policies";

export interface ShopPoliciesRepository {
  pendingKinds(): Promise<ShopPoliciesDraft["policy"]["kind"][]>;
  lock(): Promise<void>;
  current(): Promise<ShopPoliciesRevision | undefined>;
  read(id: string): Promise<ShopPoliciesRevision | undefined>;
  history(before?: number): Promise<ShopPoliciesRevision[]>;
  append(input: {
    policies: ShopPoliciesRevision["policies"];
    version: number;
    previousId: string | null;
    actorId: string;
    originDraftId: string;
    key: string;
    requestId: string;
    kind: ShopPoliciesDraft["policy"]["kind"];
  }): Promise<ShopPoliciesRevision>;
  advance(revision: ShopPoliciesRevision, expected: number): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
