import type {
  Actor,
  SyntheticRecord,
  SyntheticSuccess,
} from "@aarili/contracts/command";

export type RequestBinding = { actor: Actor; action: string; hash: string };
export type StoredResponse = RequestBinding & {
  response: SyntheticSuccess;
  status: 200;
};
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
export interface CommandRepository {
  lockKey(key: string): Promise<void>;
  replay(key: string): Promise<StoredResponse | undefined>;
  persist(
    key: string,
    binding: RequestBinding,
    response: SyntheticSuccess,
  ): Promise<void>;
  expiredKeys(cutoff: Date): Promise<string[]>;
  ids(): Promise<{ id: string; eventId: string }>;
  read(id: string, lock?: boolean): Promise<SyntheticRecord | undefined>;
  insert(record: SyntheticRecord): Promise<void>;
  update(record: SyntheticRecord, expectedVersion: number): Promise<boolean>;
  correctionExists(id: string): Promise<boolean>;
  audit(event: AuditWrite): Promise<void>;
}
