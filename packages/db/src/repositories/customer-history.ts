import type {
  ContactMergeCommand,
  ContactMergePreview,
  ContactMergeResult,
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
  merges: ContactMergeRepository;
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

export interface ContactMergeRepository
  extends RequestRepository<ContactMergeResult> {
  lock(): Promise<void>;
  lockOrder(id: string): Promise<void>;
  hasMeasurementAssociations(customerIds: string[]): Promise<boolean>;
  inventory(
    sourceId: string,
    survivorId: string,
  ): Promise<ContactMergePreview["associations"]>;
  state(
    sourceId: string,
    survivorId: string,
  ): Promise<{
    version: number;
    aliases: { sourceId: string; survivorId: string; eventId: string }[];
    events: ContactMergePreview["events"];
  }>;
  replayMerge(key: string): Promise<
    | {
        actorId: string;
        hash: string;
        result: ContactMergeResult;
        authority: string;
      }
    | undefined
  >;
  append(value: {
    command: ContactMergeCommand;
    sourceVersion: number;
    survivorVersion: number;
    version: number;
    actorId: string;
    key: string;
    hash: string;
    requestId: string;
    authority: string;
    orders: ContactMergePreview["associations"];
  }): Promise<ContactMergeResult>;
}
