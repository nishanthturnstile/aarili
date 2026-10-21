import type {
  AcceptedOrder,
  BookingDraft,
  BookingRecord,
  BookingRevision,
  GroupCommercial,
  IncludedOrderCommercial,
  OrderPieceStructure,
  OrderPieces,
  OrderReview,
  QuickOrderDraft,
} from "@aarili/contracts/orders";
import type { ServiceRequirementsPreview } from "@aarili/contracts/service-templates";
import type { RequestRepository } from "./request.js";

export type OrderSources = {
  manifestId: string;
  definitionId: string;
  categoryId: string;
  bindingId: string;
  ruleId: string;
  calendarId: string;
  profileId: string;
  policiesId: string;
  presentationId: string | null;
};
export interface OrdersRepository extends RequestRepository<AcceptedOrder> {
  groups: GroupIntakeRepository;
  bookings: BookingsRepository;
  pieces: OrderPiecesRepository;
  now(): Promise<Date>;
  lockCapacity(categoryId: string): Promise<void>;
  lockOrder(id: string): Promise<void>;
  demand(
    categoryId: string,
    start: string,
    end: string,
  ): Promise<
    { id: string; quantity: number; unit: string; deliveryDate: string }[]
  >;
  read(id: string): Promise<AcceptedOrder | undefined>;
  list(before?: string): Promise<AcceptedOrder[]>;
  origin(id: string, draftId: string): Promise<boolean>;
  accept(input: {
    draftId: string;
    actorId: string;
    key: string;
    requestId: string;
    intake: QuickOrderDraft;
    review: OrderReview;
    requirements: ServiceRequirementsPreview;
    sources: OrderSources;
    snapshot: Record<string, unknown>;
    digest: string;
    originLineId?: string;
    commercial?: IncludedOrderCommercial;
  }): Promise<AcceptedOrder>;
  mode(
    id: string,
    mode: "simple" | "detailed",
    actorId: string,
    key: string,
    requestId: string,
  ): Promise<void>;
  history(
    id: string,
    before?: number,
  ): Promise<
    {
      version: number;
      mode: "simple" | "detailed";
      actorId: string;
      recordedAt: string;
    }[]
  >;
}

export interface GroupIntakeRepository {
  identity(): Promise<string>;
  commercial(bookingId: string): Promise<GroupCommercial | undefined>;
  writeCommercial(input: {
    id: string;
    bookingId: string;
    draftId: string;
    basis: GroupCommercial["basis"];
    packagePaise: string | null;
    scope: GroupCommercial["scope"];
    actorId: string;
    reason: string;
    key: string;
    requestId: string;
  }): Promise<void>;
  conversionOrigin(targetId: string, sourceId: string): Promise<boolean>;
  convert(input: {
    sourceId: string;
    targetId: string;
    lineId: string;
    actorId: string;
    key: string;
    requestId: string;
  }): Promise<void>;
}

export interface BookingsRepository {
  lock(id: string): Promise<void>;
  read(id: string, revision?: boolean): Promise<BookingRecord | undefined>;
  list(before?: string): Promise<BookingRecord[]>;
  history(id: string, before?: number): Promise<BookingRevision[]>;
  membership(orderId: string): Promise<string | undefined>;
  origin(revisionId: string, draftId: string): Promise<boolean>;
  write(input: {
    draft: BookingDraft;
    draftId: string;
    actorId: string;
    key: string;
    requestId: string;
    sources: BookingRevision["sources"];
  }): Promise<BookingRevision>;
}

export interface OrderPiecesRepository extends RequestRepository<OrderPieces> {
  read(orderId: string): Promise<OrderPieces | undefined>;
  write(input: {
    orderId: string;
    orderVersion: number;
    snapshotDigest: string;
    structure: OrderPieceStructure;
    digest: string;
    actorId: string;
    key: string;
    requestId: string;
    reason: string;
    acceptance: boolean;
  }): Promise<void>;
}
