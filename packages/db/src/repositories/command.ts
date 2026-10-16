import type {
  Actor,
  SyntheticRecord,
  SyntheticSuccess,
} from "@aarili/contracts/command";

import type {
  StoredResponse as GenericStoredResponse,
  RequestRepository,
} from "./request.js";

export type { RequestBinding } from "./request.js";
export type StoredResponse = GenericStoredResponse<SyntheticSuccess>;
export type AuditWrite = {
  id: string;
  actor: Actor;
  action: string;
  entityId: string;
  requestId: string;
  key: string;
  reason: string | null;
  sourceEventId: string | null;
  changes: { version: number; finalized: boolean; valueChanged: boolean };
};
// Bound once by server composition to an already authorised Transaction.
// No pool, transaction creation, driver, queue abstraction or vendor type leaks.
export interface CommandRepository extends RequestRepository<SyntheticSuccess> {
  ids(): Promise<{ id: string; eventId: string }>;
  read(id: string, lock?: boolean): Promise<SyntheticRecord | undefined>;
  insert(record: SyntheticRecord): Promise<void>;
  update(record: SyntheticRecord, expectedVersion: number): Promise<boolean>;
  correctionExists(id: string): Promise<boolean>;
  audit(event: AuditWrite): Promise<void>;
}
