import type {
  DesignSpecificationDraft,
  DesignSpecificationResult,
  DesignSpecificationState,
  DesignSpecificationVersion,
} from "@aarili/contracts/design-specifications";
import type { DraftRecord } from "@aarili/contracts/drafts";
export interface DesignSpecificationsRepository {
  orderKind(orderId: string): Promise<"custom" | "service" | undefined>;
  replayPayload(
    draftId: string,
    version: number,
  ): Promise<Record<string, unknown>>;
  retainPrivateResponse(
    record: DraftRecord,
    auditId: string,
    key: string,
  ): Promise<void>;
  lock(orderId: string, pieceId: string | null): Promise<void>;
  state(
    orderId: string,
    pieceId: string | null,
    before?: number,
    beforeSelection?: number,
  ): Promise<DesignSpecificationState>;
  read(id: string): Promise<DesignSpecificationVersion | undefined>;
  origin(id: string, draftId: string): Promise<boolean>;
  governed(orderId: string): Promise<boolean>;
  write(
    input: DesignSpecificationDraft & {
      actorId: string;
      draftId: string;
      key: string;
      requestId: string;
      customerId: string;
      wearerId: string;
      snapshotDigest: string;
      frozen: Pick<DesignSpecificationVersion, "profile" | "choices">;
      digest: string;
    },
  ): Promise<DesignSpecificationResult>;
}
