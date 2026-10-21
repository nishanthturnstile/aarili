import type {
  CustomerHistoryEvent,
  CustomerHistoryQuery,
} from "@aarili/contracts/customer-history";

export type HistoryPosition = { at: string; kind: string; id: string };
export type HistoryWindow = { watermark: string; position?: HistoryPosition };
export interface CustomerHistoryRepository {
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
