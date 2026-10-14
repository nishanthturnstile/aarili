import { idempotencyHeaderSchema } from "@aarili/contracts/command";
import type {
  JournalBatch,
  JournalEntry,
  JournalInput,
  JournalRepository,
} from "@aarili/db/repositories/journal";
import { fromBigint, toBigint } from "@aarili/money";
import { requestHash } from "./commands.js";

export class JournalFailure extends Error {
  constructor(
    public readonly status: 404 | 409 | 422,
    code: string,
  ) {
    super(code);
  }
}
const accounts = new Set([
  "cash",
  "receivable",
  "revenue",
  "deposit",
  "refund",
]);
const uuid = (value: unknown) =>
  idempotencyHeaderSchema.safeParse(value).success;
export function validateJournal(input: JournalInput): JournalInput {
  if (
    !input ||
    !uuid(input.sourceId) ||
    !uuid(input.subjectId) ||
    !["posting", "reversal", "liability", "settlement"].includes(input.kind) ||
    (input.kind === "posting"
      ? input.relatedId !== null
      : !uuid(input.relatedId)) ||
    typeof input.reason !== "string" ||
    input.reason.trim().length === 0 ||
    input.reason.length > 240 ||
    !Array.isArray(input.entries) ||
    input.entries.length < 2 ||
    input.entries.length > 5
  )
    throw new JournalFailure(422, "JOURNAL_INVALID");
  const seen = new Set<string>();
  let net = 0n,
    debit = 0n;
  for (const e of input.entries) {
    if (
      !e ||
      !accounts.has(e.account) ||
      seen.has(e.account) ||
      e.amountPaise === 0
    )
      throw new JournalFailure(422, "JOURNAL_INVALID");
    const amount = toBigint(e.amountPaise);
    seen.add(e.account);
    net += amount;
    if (amount > 0n) debit += amount;
  }
  fromBigint(debit);
  if (net !== 0n) throw new JournalFailure(422, "JOURNAL_UNBALANCED");
  return {
    ...input,
    sourceId: input.sourceId.toLowerCase(),
    subjectId: input.subjectId.toLowerCase(),
    relatedId: input.relatedId?.toLowerCase() ?? null,
    entries: input.entries
      .map((e) => ({ ...e }))
      .sort((a, b) => a.account.localeCompare(b.account)),
  };
}
export function reversalEntries(
  original: readonly JournalEntry[],
): JournalEntry[] {
  return original.map((e) => ({
    account: e.account,
    amountPaise: fromBigint(-toBigint(e.amountPaise)),
  }));
}
// Only append commands: no mutable balance/version, HTTP endpoint or live money
// entry point. Composition supplies the server identity and withShop repository.
export async function postJournal(
  repo: JournalRepository,
  actorId: string,
  input: JournalInput,
  headers: { key: string; requestId: string },
): Promise<JournalBatch> {
  const command = validateJournal(input);
  if (!uuid(actorId) || !uuid(headers.key) || !uuid(headers.requestId))
    throw new JournalFailure(422, "JOURNAL_INVALID");
  actorId = actorId.toLowerCase();
  const key = headers.key.toLowerCase();
  const binding = {
    actorId,
    action: `journal.${command.kind}`,
    hash: await requestHash({ encoding: 1, actorId, command }),
  };
  await repo.lockKey(key);
  const prior = await repo.replay(key);
  if (prior) {
    if (
      prior.actorId !== actorId ||
      prior.action !== binding.action ||
      prior.hash !== binding.hash
    )
      throw new JournalFailure(422, "IDEMPOTENCY_MISMATCH");
    const batch = await repo.read(prior.id);
    if (!batch) throw new JournalFailure(404, "JOURNAL_NOT_FOUND");
    return batch;
  }
  await repo.lockSubject(command.subjectId);
  const source = await repo.source(command.sourceId);
  if (source) {
    if (source.actorId !== actorId || source.hash !== binding.hash)
      throw new JournalFailure(409, "JOURNAL_SOURCE_CONFLICT");
    await repo.persist(key, binding, source.id);
    return source;
  }
  let related: JournalBatch | undefined;
  if (command.relatedId) {
    related = await repo.read(command.relatedId);
    if (!related || related.subjectId !== command.subjectId)
      throw new JournalFailure(404, "JOURNAL_NOT_FOUND");
    if (
      related.kind === "reversal" ||
      (await repo.linked(
        related.id,
        command.kind as "reversal" | "liability" | "settlement",
      ))
    )
      throw new JournalFailure(409, "JOURNAL_LINK_CONFLICT");
    if (command.kind === "reversal") {
      const expected = reversalEntries(related.entries);
      if (
        command.entries.length !== expected.length ||
        expected.some(
          (e) =>
            !command.entries.some(
              (c) => c.account === e.account && c.amountPaise === e.amountPaise,
            ),
        )
      )
        throw new JournalFailure(422, "JOURNAL_REVERSAL_INVALID");
    } else if (command.kind === "liability") {
      const credit = -(
        related.entries.find((e) => e.account === "deposit")?.amountPaise ?? 0
      );
      if (
        credit <= 0 ||
        command.entries.length !== 2 ||
        !command.entries.some(
          (e) => e.account === "deposit" && e.amountPaise === credit,
        ) ||
        !command.entries.some(
          (e) => e.account === "refund" && e.amountPaise === -credit,
        ) ||
        (await repo.linked(related.id, "reversal"))
      )
        throw new JournalFailure(409, "JOURNAL_LIABILITY_INVALID");
    } else {
      const liability = -(
        related.entries.find((e) => e.account === "refund")?.amountPaise ?? 0
      );
      if (
        liability <= 0 ||
        command.entries.length !== 2 ||
        !command.entries.some(
          (e) => e.account === "refund" && e.amountPaise === liability,
        ) ||
        !command.entries.some(
          (e) => e.account === "cash" && e.amountPaise === -liability,
        ) ||
        (await repo.linked(related.id, "reversal"))
      )
        throw new JournalFailure(409, "JOURNAL_SETTLEMENT_INVALID");
    }
  }
  if (
    command.kind === "reversal" &&
    related &&
    ((await repo.linked(related.id, "settlement")) ||
      (await repo.linked(related.id, "liability")))
  )
    throw new JournalFailure(409, "JOURNAL_LINK_CONFLICT");
  const batch = {
    ...command,
    ...(await repo.ids()),
    actorId,
    hash: binding.hash,
  };
  await repo.audit(batch, key, headers.requestId);
  if (!(await repo.insertBatch(batch, key)))
    throw new JournalFailure(409, "JOURNAL_SOURCE_CONFLICT");
  for (const e of batch.entries) await repo.insertEntry(batch.id, e);
  await repo.persist(key, binding, batch.id);
  return batch;
}
