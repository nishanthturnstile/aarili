import type { DraftRecord } from "@aarili/contracts/drafts";
import type {
  PatternBinding,
  PatternCapability,
  PatternCapabilityDraft,
  PatternDraft,
  PatternEvent,
  PatternQuery,
  PatternState,
  PatternVersion,
} from "@aarili/contracts/manual-patterns";
export type PatternWrite = {
  actorId: string;
  draftId: string;
  key: string;
  requestId: string;
};
export interface ManualPatternsRepository {
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
  review(id: string): Promise<PatternEvent | undefined>;
  write(
    v: PatternDraft & PatternWrite,
    capabilityId: string,
    contextDigest: string,
  ): Promise<string>;
  origin(
    id: string,
    draftId: string,
    kind: "capability" | "reference",
  ): Promise<boolean>;
  replayPayload(id: string, version: number): Promise<Record<string, unknown>>;
  retainPrivateResponse(
    record: DraftRecord,
    auditId: string,
    key: string,
  ): Promise<void>;
}
