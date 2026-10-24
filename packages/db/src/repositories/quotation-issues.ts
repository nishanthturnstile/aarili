import type {
  QuoteIssueEntry,
  QuoteResponseCommand,
  QuoteResponseEvent,
} from "@aarili/contracts/quotation-issues";
export type QuoteIssueBinding = QuoteIssueEntry & {
  profileId: string;
  validityPolicyId: string;
  commandHash: string;
  reason: string | null;
  actorId: string;
  key: string;
  proposalFamilyId: string;
};
export interface QuotationIssuesRepository {
  lock(): Promise<void>;
  binding(
    docId: string,
    revision: number,
  ): Promise<QuoteIssueBinding | undefined>;
  proposal(id: string): Promise<QuoteIssueBinding | undefined>;
  history(familyId: string): Promise<QuoteIssueEntry[]>;
  allocate(): Promise<string>;
  bind(value: QuoteIssueBinding): Promise<void>;
  events(docId: string, revision: number): Promise<QuoteResponseEvent[]>;
  eventByKey(
    key: string,
  ): Promise<(QuoteResponseEvent & { commandHash: string }) | undefined>;
  respond(
    input: QuoteResponseCommand,
    key: string,
    commandHash: string,
    actorId: string,
  ): Promise<QuoteResponseEvent>;
}
