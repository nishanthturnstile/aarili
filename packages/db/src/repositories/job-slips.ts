import type {
  JobSlipHistoryEntry,
  JobSlipModel,
  JobSlipScope,
} from "@aarili/contracts/job-slips";

export type JobSlipBinding = JobSlipScope & {
  docId: string;
  revision: number;
  customerId: string;
  wearerId: string | null;
  designId: string | null;
  measurementId: string | null;
  patternId: string | null;
  sourceDigest: string;
  commandHash: string;
  modelHash: string;
  revoked: boolean;
};
export interface JobSlipsRepository {
  lock(): Promise<void>;
  binding(docId: string, revision: number): Promise<JobSlipBinding | undefined>;
  history(scope: JobSlipScope): Promise<JobSlipHistoryEntry[]>;
  bind(binding: JobSlipBinding): Promise<void>;
  // Values remain in the existing document model, not a second private snapshot.
  model(docId: string, revision: number): Promise<JobSlipModel | undefined>;
}
export type JobSlipPurge = {
  id: string;
  docId: string;
  revision: number;
  initiatorId: string;
  epoch: string;
  keys: string[];
};
export interface JobSlipPurgeRepository {
  lock(): Promise<void>;
  read(id: string): Promise<JobSlipPurge | undefined>;
  control(): Promise<{ outbound: boolean; epoch: string } | undefined>;
  receipts(id: string): Promise<string[]>;
  removed(purgeId: string, key: string, actorId: string): Promise<void>;
}
