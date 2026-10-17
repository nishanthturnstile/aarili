import type {
  CustomerContact,
  CustomerCreate,
  CustomerMutationResult,
  CustomerNotice,
  CustomerProfile,
  CustomerSearch,
  CustomerSearchPage,
} from "@aarili/contracts/customers";
import type { RequestRepository } from "./request.js";
export type CustomerWrite = {
  id: string;
  personId: string;
  eventId: string;
  actorId: string;
  key: string;
  requestId: string;
  contact: CustomerContact;
  synthetic: boolean;
  keys: {
    algorithmVersion: 1;
    nameTaNorm: string;
    nameLatinNorm: string;
    nameSkel: string;
    phoneDigits: string;
  }[];
};
export interface CustomerRepository
  extends RequestRepository<CustomerMutationResult> {
  ids(): Promise<{ id: string; personId: string; eventId: string }>;
  lockCustomer(id: string): Promise<void>;
  read(id: string): Promise<CustomerProfile | undefined>;
  search(
    input: CustomerSearch,
    keys: {
      nameTaNorm: string;
      nameLatinNorm: string;
      nameSkel: string;
      phoneDigits: string;
    },
  ): Promise<CustomerSearchPage>;
  insert(
    write: CustomerWrite,
    notice: CustomerNotice,
    evidence: CustomerCreate["serviceEvidence"],
  ): Promise<void>;
  correct(write: CustomerWrite, expected: number): Promise<boolean>;
  audit(
    write: CustomerWrite,
    action: "customer.create" | "customer.correct",
    version: number,
  ): Promise<void>;
}
