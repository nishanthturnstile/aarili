import type {
  DesignMediaSubject,
  DesignMediaSubjectDraft,
  DesignReferenceDraft,
  DesignReferenceSnapshot,
} from "@aarili/contracts/design-references";
import type { DraftRecord } from "@aarili/contracts/drafts";
import type { MediaRecord } from "@aarili/contracts/media";
export interface DesignReferencesRepository {
  subject(id: string): Promise<DesignMediaSubject | undefined>;
  subjectForAsset(id: string): Promise<DesignMediaSubject | undefined>;
  lockSubject(id: string): Promise<void>;
  scope(
    orderId: string,
  ): Promise<
    { customerId: string; wearerId: string; kind: string } | undefined
  >;
  referenceOrderIds(orderId: string, pieceId: string | null): Promise<string[]>;
  latest(subjectId: string): Promise<string | undefined>;
  library(
    before?: string,
  ): Promise<{ subjects: DesignMediaSubject[]; next: string | null }>;
  privateSubjects(
    orderId: string,
    pieceId: string | null,
    before?: string,
  ): Promise<{ subjects: DesignMediaSubject[]; next: string | null }>;
  assets(
    subjectId: string,
    before?: string,
  ): Promise<{ assets: MediaRecord[]; next: string | null }>;
  writeSubject(
    v: DesignMediaSubjectDraft,
    draftId: string,
    actorId: string,
    key: string,
    requestId: string,
  ): Promise<string>;
  subjectOrigin(id: string, draftId: string): Promise<boolean>;
  references(versionId: string): Promise<DesignReferenceSnapshot[]>;
  writeReferences(
    versionId: string,
    items: DesignReferenceDraft[],
  ): Promise<void>;
  hasReadableAssociation(assetId: string): Promise<boolean>;
  retainDraft(record: DraftRecord, auditId: string, key: string): Promise<void>;
  replayDraft(id: string, version: number): Promise<Record<string, unknown>>;
}
