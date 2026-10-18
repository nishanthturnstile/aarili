import type {
  MeasurementFormDraft,
  MeasurementFormRevision,
} from "@aarili/contracts/measurement-forms";
export interface MeasurementFormsRepository {
  lock(): Promise<void>;
  fieldSemantics(
    entryId: string,
  ): Promise<{ id: string; key: string; meaning: string; kind: string }[]>;
  current(entryId: string): Promise<MeasurementFormRevision | undefined>;
  read(id: string): Promise<MeasurementFormRevision | undefined>;
  definition(
    id: string,
  ): Promise<MeasurementFormRevision["definition"] | undefined>;
  list(query: {
    terms: string[];
    before?: string;
  }): Promise<MeasurementFormRevision[]>;
  history(entryId: string, before?: number): Promise<MeasurementFormRevision[]>;
  codeOwner(kind: string, code: string): Promise<string | null>;
  append(
    input: MeasurementFormDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
      authority: "owner-proposal" | "synthetic-fixture";
      contentHash: string;
      searchKeys: string[];
    },
  ): Promise<MeasurementFormRevision>;
  advance(
    revision: MeasurementFormRevision,
    expected: number,
  ): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
