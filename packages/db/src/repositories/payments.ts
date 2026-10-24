import type {
  PaymentDraft,
  PaymentEvent,
  PaymentReceipt,
} from "@aarili/contracts/payments";
export type PaymentWrite = {
  receiptId: string;
  eventId: string;
  previousId: string | null;
  version: number;
  draftId: string;
  actorId: string;
  key: string;
  requestId: string;
  input: PaymentDraft;
  amountPaise: number;
  journalId: string | null;
  status: PaymentEvent["status"];
};
export interface PaymentsRepository {
  lockIdentity(): Promise<void>;
  lockReceipt(id: string): Promise<void>;
  scope(
    customerId: string,
    orderId: string | null,
    bookingId: string | null,
  ): Promise<boolean>;
  identity(id: string): Promise<boolean>;
  read(id: string): Promise<PaymentReceipt | undefined>;
  list(
    customerId?: string | null,
    before?: string | null,
  ): Promise<PaymentReceipt[]>;
  history(id: string, before?: number): Promise<PaymentEvent[]>;
  totals(customerId: string): Promise<{
    pendingPaise: string;
    confirmedPaise: string;
    receipts: number;
  }>;
  eventId(): Promise<string>;
  claim(reference: string, receiptId: string): Promise<boolean>;
  referenceReceipt(reference: string): Promise<string | undefined>;
  append(write: PaymentWrite): Promise<void>;
  result(draftId: string, eventId: string): Promise<void>;
  resultReceipt(draftId: string, receiptId: string): Promise<boolean>;
}
