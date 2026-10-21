import type { OrderReview } from "@aarili/contracts/orders";
import type { ServiceRequirementsPreview } from "@aarili/contracts/service-templates";
import type {
  AcceptedServiceOrder,
  ServiceChangeContent,
  ServiceChangeRecord,
  ServiceLineProgress,
  ServiceLineResult,
  ServiceLineSource,
  ServiceOrderDraft,
  ServiceOrderReview,
  ServiceProfileDraft,
  ServiceProfileRevision,
  ServiceRepeatRef,
} from "@aarili/contracts/small-services";
import type { DraftRepository } from "./drafts.js";
import type { OrderSources } from "./orders.js";
import type { RequestRepository } from "./request.js";

export interface SmallServicesRepository {
  repeats?: {
    drafts: DraftRepository;
    origin(id: string): Promise<ServiceRepeatRef | undefined>;
    insertOrigin(
      id: string,
      ref: ServiceRepeatRef,
      payload: unknown,
      key: string,
      actor: string,
    ): Promise<void>;
    link(draftId: string, orderId: string): Promise<void>;
    links(
      id: string,
      before?: string,
    ): Promise<{ sourceId: string | null; children: string[] }>;
  };
  progress: RequestRepository<ServiceLineResult> & {
    sources(orderId: string): Promise<ServiceLineSource[]>;
    current(orderId: string): Promise<
      {
        lineId: string;
        version: number;
        state: "pending" | "completed";
        lastId: string;
      }[]
    >;
    history(
      orderId: string,
    ): Promise<ServiceLineProgress["lines"][number]["history"]>;
    prior(
      commandId: string,
      key: string,
    ): Promise<
      | {
          id: string;
          lineId: string;
          version: number;
          hash: string;
          actorId: string;
          key: string;
          commandId: string;
        }
      | undefined
    >;
    write(v: {
      source: ServiceLineSource;
      orderId: string;
      expected: number;
      to: "pending" | "completed";
      correctionOf: string | null;
      parentVersion: number;
      bookingId: string | null;
      bookingVersion: number | null;
      actorId: string;
      commandId: string;
      key: string;
      hash: string;
      requestId: string;
      note: string;
    }): Promise<ServiceLineResult>;
  };
  intakeOrder(
    draftId: string,
    lineId: string | null,
  ): Promise<string | undefined>;
  converted(targetId: string, sourceId: string): Promise<boolean>;
  conversion(input: {
    sourceId: string;
    targetId: string;
    actorId: string;
    key: string;
    requestId: string;
  }): Promise<void>;
  changes(orderId: string): Promise<ServiceChangeRecord[]>;
  changeOrigin(
    id: string,
    draftId: string,
  ): Promise<ServiceChangeRecord | undefined>;
  duplicateChange(
    orderId: string,
    pieceId: string | null,
    profile: string,
    keys: string[],
    ids: string[],
  ): Promise<boolean>;
  change(input: {
    orderId: string;
    version: number;
    draftId: string;
    actorId: string;
    key: string;
    requestId: string;
    content: ServiceChangeContent;
    digest: string;
  }): Promise<ServiceChangeRecord>;
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
