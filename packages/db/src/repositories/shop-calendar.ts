import type {
  ShopCalendarDraft,
  ShopCalendarRevision,
} from "@aarili/contracts/shop-calendar";

export interface ShopCalendarRepository {
  lock(): Promise<void>;
  current(): Promise<ShopCalendarRevision | undefined>;
  read(id: string): Promise<ShopCalendarRevision | undefined>;
  history(before?: number): Promise<ShopCalendarRevision[]>;
  append(input: {
    calendar: ShopCalendarRevision["calendar"];
    version: number;
    previousId: string | null;
    actorId: string;
    originDraftId: string;
    key: string;
    requestId: string;
    domain: ShopCalendarDraft["domain"];
  }): Promise<ShopCalendarRevision>;
  advance(revision: ShopCalendarRevision, expected: number): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
