import type { DraftRecord } from "@aarili/contracts/drafts";
import type {
  PatternBinding,
  PatternCapability,
  PatternCapabilityDraft,
  PatternDraft,
  PatternEvent,
  PatternQuery,
  PatternReferenceV2Draft,
  PatternState,
  PatternSubject,
  PatternSubjectDraft,
  PatternVersion,
} from "@aarili/contracts/manual-patterns";
import type { MediaRecord } from "@aarili/contracts/media";
export type PatternWrite = {
  actorId: string;
  draftId: string;
  key: string;
  requestId: string;
};
export interface ManualPatternsRepository {
  subject(id: string): Promise<PatternSubject | undefined>;
  subjectForScope(q: PatternQuery): Promise<PatternSubject | undefined>;
  subjectForAsset(id: string): Promise<PatternSubject | undefined>;
  assets(
    subjectId: string,
    before?: string,
  ): Promise<{ assets: MediaRecord[]; next: string | null }>;
  writeSubject(v: PatternSubjectDraft & PatternWrite): Promise<string>;
  lock(binding: PatternBinding): Promise<void>;
  lockScope(orderId: string, pieceId: string | null): Promise<void>;
  capabilities(
    binding: PatternBinding,
    before?: number,
  ): Promise<PatternCapability[]>;
  capability(binding: PatternBinding): Promise<PatternCapability | undefined>;
  writeCapability(v: PatternCapabilityDraft & PatternWrite): Promise<string>;
  state(q: PatternQuery): Promise<PatternState>;
  read(id: string): Promise<PatternVersion | undefined>;
  selected(orderId: string): Promise<PatternVersion[]>;
  review(id: string): Promise<PatternEvent | undefined>;
  write(
    v: (PatternDraft | PatternReferenceV2Draft) & PatternWrite,
    capabilityId: string,
    contextDigest: string,
  ): Promise<string>;
  origin(
    id: string,
    draftId: string,
    kind: "capability" | "reference" | "subject",
  ): Promise<boolean>;
  replayPayload(id: string, version: number): Promise<Record<string, unknown>>;
  retainPrivateResponse(
    record: DraftRecord,
    auditId: string,
    key: string,
  ): Promise<void>;
}
