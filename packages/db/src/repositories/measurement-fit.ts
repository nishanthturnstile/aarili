import type { DraftRecord } from "@aarili/contracts/drafts";
import type {
  MeasurementFitReference,
  MeasurementFitReferenceDraft,
  MeasurementFitSubject,
  MeasurementFitSubjectDraft,
} from "@aarili/contracts/measurement-fit";
import type { MediaRecord } from "@aarili/contracts/media";
import type { MeasurementWrite } from "./measurement-sessions.js";

export interface MeasurementFitRepository {
  subject(id: string): Promise<MeasurementFitSubject | undefined>;
  subjectForAsset(id: string): Promise<MeasurementFitSubject | undefined>;
  forSession(sessionId: string): Promise<MeasurementFitSubject | undefined>;
  lockSession(sessionId: string): Promise<void>;
  writeSubject(
    v: MeasurementFitSubjectDraft & MeasurementWrite,
    sessionId: string,
  ): Promise<string>;
  reference(
    id: string,
    versionId: string,
  ): Promise<MeasurementFitReference | undefined>;
  references(
    versionId: string,
    before?: string,
  ): Promise<{ references: MeasurementFitReference[]; next: string | null }>;
  assets(
    subjectId: string,
    before?: string,
  ): Promise<{ assets: MediaRecord[]; next: string | null }>;
  writeReference(
    v: MeasurementFitReferenceDraft & MeasurementWrite,
    subject: MeasurementFitSubject,
  ): Promise<string>;
  origin(
    id: string,
    draftId: string,
    kind: "subject" | "reference",
  ): Promise<boolean>;
  retainDraft(record: DraftRecord, auditId: string, key: string): Promise<void>;
  replayDraft(id: string, version: number): Promise<Record<string, unknown>>;
}
export type MeasurementFitPurge = {
  id: string;
  assetId: string;
  wearerId: string;
  initiatorId: string;
  epoch: string;
  manifest: { keys: string[]; prefixes: string[] };
  notBefore: string;
  received: string[];
};
export interface MeasurementFitPurgeRepository {
  read(id: string): Promise<MeasurementFitPurge | undefined>;
  lock(assetId: string): Promise<void>;
  control(): Promise<{ epoch: string; outbound: boolean } | undefined>;
  now(): Promise<Date>;
  receipt(id: string, key: string, actorId: string): Promise<void>;
}
