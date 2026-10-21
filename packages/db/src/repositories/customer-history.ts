import type {
  CustomerHistoryEvent,
  CustomerHistoryQuery,
  CustomerPair,
  CustomerPairResult,
  DuplicateCandidates,
} from "@aarili/contracts/customer-history";
import type { RequestRepository } from "./request.js";

export type HistoryPosition = { at: string; kind: string; id: string };
export type HistoryWindow = { watermark: string; position?: HistoryPosition };
export interface CustomerHistoryRepository {
  reviews: RequestRepository<CustomerPairResult>;
  candidates(customerId: string, after?: string): Promise<DuplicateCandidates>;
  lockPair(first: string, second: string): Promise<void>;
  lockContact(id: string): Promise<void>;
  decisions(first: string, second: string): Promise<CustomerPair["decisions"]>;
  reviewReplay(key: string): Promise<
    | {
        actorId: string;
        hash: string;
        result: CustomerPairResult;
      }
    | undefined
  >;
  decide(value: {
    first: string;
    second: string;
    firstVersion: number;
    secondVersion: number;
    version: number;
    decision: string;
    reason: string;
    actorId: string;
    key: string;
    hash: string;
    requestId: string;
  }): Promise<CustomerPairResult>;
  wearers(customerId: string): Promise<string[]>;
  privacyVersion(): Promise<string | null>;
  window(): Promise<HistoryWindow>;
  page(
    input: CustomerHistoryQuery,
    wearers: string[],
    window: HistoryWindow,
    keys: {
      nameTaNorm: string;
      nameLatinNorm: string;
      nameSkel: string;
      phoneDigits: string;
    },
  ): Promise<{ events: CustomerHistoryEvent[]; next: HistoryPosition | null }>;
}
