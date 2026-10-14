import type { SyntheticRecord } from "@aarili/contracts/command";
import type { SyntheticJob } from "@aarili/contracts/jobs";
import type { RestoreState } from "./restore.js";

// A synthetic command's enlisted write, never a generic queue abstraction.
// Bound by jobs composition to the command's exact authorized transaction.
export interface SyntheticJobWriter {
  prepare(): Promise<void>;
  enqueue(
    record: SyntheticRecord,
    requestId: string,
    key: string,
  ): Promise<void>;
}
export type JobRequest = SyntheticJob & {
  epoch: string;
  key: string;
  commandRequestId: string;
};
export interface SyntheticJobRepository {
  request(id: string): Promise<JobRequest | undefined>;
  lock(id: string): Promise<void>;
  effected(id: string): Promise<boolean>;
  effect(request: JobRequest, auditId: string): Promise<void>;
  restoreState(): Promise<RestoreState | undefined>;
  quarantined(id: string): Promise<boolean>;
  quarantine(
    request: JobRequest,
    observedEpoch: string,
    reason: "old_epoch" | "missing_epoch",
  ): Promise<void>;
}
