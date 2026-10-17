import type { CustomerNotice } from "@aarili/contracts/customers";
import type {
  WearerCreate,
  WearerMutation,
  WearerProfile,
  WearerPurposeEvent,
  WearerRelationship,
  WearerSearch,
  WearerUpdate,
} from "@aarili/contracts/wearers";
import type { RequestRepository } from "./request.js";
export type WearerCustomer = {
  id: string;
  personId: string;
  displayName: string;
  version: number;
};
export type WearerIdentity = {
  id: string;
  personId: string;
  displayName: string;
  age: "adult" | "minor" | "unknown";
  version: number;
};
export type WearerWrite = {
  id: string;
  personId: string;
  relationshipId: string;
  customerId: string;
  actorId: string;
  eventId: string;
  key: string;
  requestId: string;
  originDraftId: string | null;
  noticeId: string;
  invalidateAuthority?: boolean;
  searchKey?: { nameTaNorm: string; nameLatinNorm: string; nameSkel: string };
};
export interface WearerRepository extends RequestRepository<WearerMutation> {
  ensureNotice(notice: CustomerNotice): Promise<void>;
  ids(): Promise<{
    id: string;
    personId: string;
    relationshipId: string;
    eventId: string;
  }>;
  lockCustomer(id: string): Promise<void>;
  customer(id: string): Promise<WearerCustomer | undefined>;
  lockWearer(id: string): Promise<void>;
  lockPerson(id: string): Promise<void>;
  identity(id: string): Promise<WearerIdentity | undefined>;
  byPerson(personId: string): Promise<WearerIdentity | undefined>;
  read(customerId: string, id: string): Promise<WearerProfile | undefined>;
  list(customerId: string): Promise<WearerProfile[]>;
  search(
    input: WearerSearch,
    keys: { nameTaNorm: string; nameLatinNorm: string; nameSkel: string },
  ): Promise<{ wearers: WearerIdentity[]; next: string | null }>;
  insert(
    w: WearerWrite,
    input: Exclude<WearerCreate, { mode: "existing" }>,
    displayName: string,
  ): Promise<void>;
  link(
    w: WearerWrite,
    input: WearerRelationship,
    expected: number,
  ): Promise<boolean>;
  update(
    w: WearerWrite,
    input: WearerUpdate,
    expected: number,
  ): Promise<boolean>;
  appendPurpose(
    w: WearerWrite,
    input: WearerPurposeEvent,
    notice: CustomerNotice,
    expected: number,
  ): Promise<boolean>;
  audit(w: WearerWrite, action: string, version: number): Promise<void>;
  origin(id: string, draftId: string): Promise<boolean>;
}
