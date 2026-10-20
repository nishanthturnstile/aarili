import type { OrderReview } from "@aarili/contracts/orders";
import type { ServiceRequirementsPreview } from "@aarili/contracts/service-templates";
import type {
  AcceptedServiceOrder,
  ServiceOrderDraft,
  ServiceOrderReview,
  ServiceProfileDraft,
  ServiceProfileRevision,
} from "@aarili/contracts/small-services";
import type { OrderSources } from "./orders.js";

export interface SmallServicesRepository {
  lock(): Promise<void>;
  identityConflict(subjectId: string, lineIds: string[]): Promise<boolean>;
  current(entryId: string): Promise<ServiceProfileRevision | undefined>;
  readProfile(id: string): Promise<ServiceProfileRevision | undefined>;
  profiles(before?: string): Promise<ServiceProfileRevision[]>;
  history(entryId: string, before?: number): Promise<ServiceProfileRevision[]>;
  append(
    input: ServiceProfileDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
      authority: ServiceProfileRevision["authority"];
      digest: string;
    },
  ): Promise<ServiceProfileRevision>;
  advance(revision: ServiceProfileRevision, expected: number): Promise<boolean>;
  profileOrigin(id: string, draftId: string): Promise<boolean>;
  source(
    id: string,
    pieceId: string | null,
  ): Promise<
    | {
        customerId: string;
        wearerId: string | null;
        version: number;
        digest: string;
        kind: "custom" | "service";
      }
    | undefined
  >;
  readOrder(id: string): Promise<AcceptedServiceOrder | undefined>;
  orders(before?: string): Promise<AcceptedServiceOrder[]>;
  orderOrigin(id: string, draftId: string): Promise<boolean>;
  accept(input: {
    draftId: string;
    actorId: string;
    key: string;
    requestId: string;
    intake: ServiceOrderDraft;
    profile: ServiceProfileRevision;
    review: ServiceOrderReview;
    commitment: OrderReview;
    requirements: ServiceRequirementsPreview;
    sources: OrderSources;
    snapshot: Record<string, unknown>;
    digest: string;
  }): Promise<AcceptedServiceOrder>;
}
