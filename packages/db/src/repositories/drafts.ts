import type {
  DraftCursor,
  DraftRecord,
  DraftSuccess,
} from "@aarili/contracts/drafts";
import type { Actor } from "@aarili/contracts/request";
import type { RequestRepository } from "./request.js";
export type DraftAudit = {
  id: string;
  actor: Actor;
  action: string;
  draftId: string;
  requestId: string;
  key: string;
  version: number;
  lifecycle: DraftRecord["lifecycle"];
  schemaVersion: number;
};
export interface DraftRepository extends RequestRepository<DraftSuccess> {
  now(): Promise<Date>;
  actionId(): Promise<string>;
  lockDraft(id: string): Promise<void>;
  read(id: string): Promise<DraftRecord | undefined>;
  list(
    limit: number,
    cursor?: DraftCursor,
  ): Promise<{ rows: DraftRecord[]; before: string }>;
  insert(record: DraftRecord): Promise<void>;
  update(record: DraftRecord, expected: number): Promise<boolean>;
  audit(event: DraftAudit): Promise<void>;
}
