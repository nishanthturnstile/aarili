import type { DraftRecord } from "@aarili/contracts/drafts";
import type {
  QuotePolicyBinding,
  QuotePolicyReviewDraft,
  RateRevision,
} from "@aarili/contracts/quotation-rates";
export interface QuotationRatesRepository {
  now(): Promise<Date>;
  lock(): Promise<void>;
  current(rateId: string): Promise<RateRevision | undefined>;
  read(id: string): Promise<RateRevision | undefined>;
  list(before?: string): Promise<RateRevision[]>;
  history(rateId: string, before?: number): Promise<RateRevision[]>;
  owner(
    entryId: string,
    component: string,
    unit: string,
  ): Promise<string | null>;
  append(
    input: Omit<RateRevision, "id" | "recordedAt" | "contentHash"> & {
      key: string;
      requestId: string;
    },
  ): Promise<RateRevision>;
  advance(revision: RateRevision, expected: number): Promise<boolean>;
  origin(
    id: string,
    draftId: string,
    kind: "rate" | "policy",
  ): Promise<boolean>;
  policyCurrent(
    kind: QuotePolicyReviewDraft["kind"],
  ): Promise<QuotePolicyBinding | undefined>;
  policyHistory(
    kind: QuotePolicyReviewDraft["kind"],
    before?: number,
  ): Promise<QuotePolicyBinding[]>;
  sourceDraft(
    id: string,
  ): Promise<{ draft: DraftRecord; hash: string } | undefined>;
  bind(
    input: Omit<
      QuotePolicyBinding,
      "id" | "recordedAt" | "sourceCurrent" | "actionScope"
    > & { key: string; requestId: string },
  ): Promise<QuotePolicyBinding>;
}
