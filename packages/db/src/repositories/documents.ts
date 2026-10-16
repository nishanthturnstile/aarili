import type {
  DocumentIssue,
  DocumentShareEvent,
} from "@aarili/contracts/documents";
import type { Actor } from "@aarili/contracts/request";
import type { RequestRepository } from "./request.js";

export type DocumentRevision = DocumentIssue & {
  creatorId: string;
  fontRevision: string;
  templateHash: string;
  modelHash: string;
  requestKey: string;
  requestHash: string;
  issueActionId: string;
};
export type DocumentAttempt = {
  docId: string;
  revision: number;
  jobId: string;
  initiatorId: string;
  epoch: string;
  state: "pending" | "rendering" | "failed" | "ready";
  version: number;
  fence: string | null;
  leaseUntil: string | null;
};
export type DocumentOutput = {
  id: string;
  docId: string;
  revision: number;
  fence: string;
  key: string;
  sha256: string;
  bytes: number;
  createdAt: string;
};
export type DocumentCleanup = { id: string; outputId: string; epoch: string };
export interface DocumentRepository extends RequestRepository<unknown> {
  shareByKey(
    key: string,
  ): Promise<(DocumentShareEvent & { requestHash: string }) | undefined>;
  shares(docId: string, revision: number): Promise<DocumentShareEvent[]>;
  share(
    id: string,
    docId: string,
    revision: number,
  ): Promise<DocumentShareEvent | undefined>;
  appendShare(
    docId: string,
    revision: number,
    event: DocumentShareEvent,
    key: string,
    hash: string,
  ): Promise<void>;
  id(): Promise<string>;
  now(): Promise<Date>;
  lock(docId: string, revision: number): Promise<void>;
  control(): Promise<{ epoch: string; outbound: boolean } | undefined>;
  read(docId: string, revision: number): Promise<DocumentRevision | undefined>;
  issuedByKey(key: string): Promise<DocumentRevision | undefined>;
  attempt(
    docId: string,
    revision: number,
  ): Promise<DocumentAttempt | undefined>;
  artifact(
    docId: string,
    revision: number,
  ): Promise<DocumentOutput | undefined>;
  issue(value: DocumentRevision, attempt: DocumentAttempt): Promise<void>;
  claim(attempt: DocumentAttempt, fence: string, until: string): Promise<void>;
  failed(attempt: DocumentAttempt, fence: string): Promise<void>;
  retry(attempt: DocumentAttempt, jobId: string, epoch: string): Promise<void>;
  plan(output: Omit<DocumentOutput, "createdAt">): Promise<void>;
  accept(attempt: DocumentAttempt, output: DocumentOutput): Promise<void>;
  outputs(
    docId: string,
    revision: number,
    after?: string,
  ): Promise<DocumentOutput[]>;
  output(id: string): Promise<DocumentOutput | undefined>;
  cleanupIntent(outputId: string, id: string, epoch: string): Promise<boolean>;
  cleanups(
    docId: string,
    revision: number,
    epoch: string,
  ): Promise<DocumentCleanup[]>;
  cleaned(id: string, actionId: string): Promise<void>;
  audit(event: {
    id: string;
    actor: Actor;
    action: string;
    docId: string;
    requestId: string;
    key: string;
  }): Promise<void>;
}
