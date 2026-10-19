import type {
  PresentationDraft,
  PresentationRevision,
  ServiceTemplateDraft,
  ServiceTemplateRevision,
} from "@aarili/contracts/service-templates";
export interface ServiceTemplatesRepository {
  presentationCurrent(): Promise<PresentationRevision | undefined>;
  presentationHistory(before?: number): Promise<PresentationRevision[]>;
  presentationRead(id: string): Promise<PresentationRevision | undefined>;
  presentationAppend(
    input: PresentationDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
    },
  ): Promise<PresentationRevision>;
  presentationAdvance(
    revision: PresentationRevision,
    expected: number,
  ): Promise<boolean>;
  lock(): Promise<void>;
  current(entryId: string): Promise<ServiceTemplateRevision | undefined>;
  read(id: string): Promise<ServiceTemplateRevision | undefined>;
  definition(
    id: string,
  ): Promise<ServiceTemplateRevision["definition"] | undefined>;
  list(query: {
    terms: string[];
    before?: string;
  }): Promise<ServiceTemplateRevision[]>;
  history(entryId: string, before?: number): Promise<ServiceTemplateRevision[]>;
  codeOwner(kind: string, code: string): Promise<string | null>;
  append(
    input: ServiceTemplateDraft & {
      actorId: string;
      originDraftId: string;
      key: string;
      requestId: string;
      authority: "owner-proposal" | "synthetic-fixture";
      contentHash: string;
      searchKeys: string[];
    },
  ): Promise<ServiceTemplateRevision>;
  advance(
    revision: ServiceTemplateRevision,
    expected: number,
  ): Promise<boolean>;
  origin(id: string, draftId: string): Promise<boolean>;
}
