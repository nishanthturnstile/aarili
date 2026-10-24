import type { QuotationVersion } from "@aarili/contracts/booking-quotations";
export interface BookingQuotationsRepository {
  list(before?: string): Promise<QuotationVersion[]>;
  lock(familyId: string): Promise<void>;
  current(familyId: string): Promise<QuotationVersion | undefined>;
  read(id: string): Promise<QuotationVersion | undefined>;
  selected(
    orderIds: string[],
  ): Promise<{ orderId: string; revisionId: string }[]>;
  scopes(revisionId: string): Promise<string[]>;
  estimates(
    orderId: string,
  ): Promise<{ id: string; version: number; reason: string }[]>;
  history(familyId: string, before?: number): Promise<QuotationVersion[]>;
  append(
    v: Omit<QuotationVersion, "id" | "recordedAt" | "contentHash"> & {
      key: string;
      requestId: string;
    },
  ): Promise<QuotationVersion>;
  origin(id: string, draftId: string): Promise<boolean>;
}
