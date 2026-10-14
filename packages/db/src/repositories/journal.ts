// Framework/vendor-free contracts for an already authorised shop transaction.
export type JournalAccount =
  | "cash"
  | "receivable"
  | "revenue"
  | "deposit"
  | "refund";
export type JournalEntry = { account: JournalAccount; amountPaise: number };
export type JournalInput = {
  sourceId: string;
  subjectId: string;
  kind: "posting" | "reversal" | "liability" | "settlement";
  relatedId: string | null;
  reason: string;
  entries: JournalEntry[];
};
export type JournalBatch = JournalInput & {
  id: string;
  eventId: string;
  actorId: string;
  hash: string;
};
export type JournalBinding = { actorId: string; action: string; hash: string };
export interface JournalRepository {
  lockKey(key: string): Promise<void>;
  lockSubject(subjectId: string): Promise<void>;
  replay(key: string): Promise<(JournalBinding & { id: string }) | undefined>;
  source(sourceId: string): Promise<JournalBatch | undefined>;
  read(id: string): Promise<JournalBatch | undefined>;
  linked(
    id: string,
    kind: "reversal" | "liability" | "settlement",
  ): Promise<boolean>;
  ids(): Promise<{ id: string; eventId: string }>;
  audit(batch: JournalBatch, key: string, requestId: string): Promise<void>;
  insertBatch(batch: JournalBatch, key: string): Promise<boolean>;
  insertEntry(id: string, entry: JournalEntry): Promise<void>;
  persist(key: string, binding: JournalBinding, id: string): Promise<void>;
  positions(subjectId: string): Promise<Record<JournalAccount, number>>;
}
