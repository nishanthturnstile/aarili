import type { DraftRecord } from "@aarili/contracts/drafts";
import type {
  MeasurementSelection,
  MeasurementSessionDraft,
  MeasurementUse,
  MeasurementUseDraft,
  MeasurementVersion,
} from "@aarili/contracts/measurement-sessions";
export type MeasurementWrite = {
  actorId: string;
  draftId: string;
  key: string;
  requestId: string;
};
export interface MeasurementSessionsRepository {
  identity(
    id: string,
  ): Promise<{ customerId: string; wearerId: string } | undefined>;
  latestApproval(formId: string): Promise<MeasurementUse | undefined>;
  writeApproval(input: MeasurementUseDraft & MeasurementWrite): Promise<string>;
  read(id: string): Promise<MeasurementVersion | undefined>;
  list(
    customerId: string,
    wearerId: string,
    before?: string,
  ): Promise<MeasurementVersion[]>;
  selection(
    orderId: string,
    pieceId: string | null,
    beforeVersion?: number,
  ): Promise<
    Pick<
      MeasurementSelection,
      "version" | "selectedId" | "history" | "nextHistory"
    >
  >;
  lockSession(id: string): Promise<void>;
  usages(id: string): Promise<
    {
      orderId: string;
      pieceId: string | null;
      code: string;
      customerId: string;
      wearerId: string;
    }[]
  >;
  used(ids: string[]): Promise<string[]>;
  write(
    input: MeasurementSessionDraft & MeasurementWrite,
    saved: Pick<MeasurementVersion, "form" | "approval" | "values"> | null,
  ): Promise<string>;
  origin(
    id: string,
    draftId: string,
    kind: "use" | "session",
  ): Promise<boolean>;
  replayPayload(
    draftId: string,
    version: number,
  ): Promise<Record<string, unknown>>;
  retainPrivateResponse(
    record: DraftRecord,
    auditId: string,
    key: string,
  ): Promise<void>;
  erased(wearerId: string): Promise<boolean>;
}
