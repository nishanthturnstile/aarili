import type { CustomerNotice } from "@aarili/contracts/customers";
import type {
  GuardianClaim,
  GuardianMutation,
  GuardianProfile,
  GuardianPurposeEvent,
  GuardianVerification,
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
  revision?: { reason: string; previousVersion: number; fields: string[] };
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
  isContactPerson(personId: string): Promise<boolean>;
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
export type GuardianWrite = {
  wearerId: string;
  authorityId: string;
  actorId: string;
  eventId: string;
  key: string;
  requestId: string;
  originDraftId: string | null;
};
export interface GuardianRepository
  extends RequestRepository<GuardianMutation> {
  ensureNotice(notice: CustomerNotice): Promise<void>;
  ids(): Promise<{ authorityId: string; eventId: string; personId: string }>;
  read(
    wearerId: string,
    relationshipAllowed: boolean,
  ): Promise<GuardianProfile>;
  person(
    id: string,
  ): Promise<{ personId: string; displayName: string } | undefined>;
  search(
    input: WearerSearch,
    keys: { nameTaNorm: string; nameLatinNorm: string; nameSkel: string },
  ): Promise<{
    people: { personId: string; displayName: string }[];
    next: string | null;
  }>;
  claim(
    w: GuardianWrite,
    input: GuardianClaim,
    personId: string,
    expected: number,
    keys: { nameTaNorm: string; nameLatinNorm: string; nameSkel: string },
  ): Promise<void>;
  verify(
    w: GuardianWrite,
    input: GuardianVerification,
    expected: number,
  ): Promise<void>;
  purpose(
    w: GuardianWrite,
    input: GuardianPurposeEvent,
    expected: number,
  ): Promise<void>;
  audit(w: GuardianWrite, action: string, version: number): Promise<void>;
  origin(id: string, draftId: string): Promise<boolean>;
}
