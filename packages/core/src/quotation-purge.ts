import { quotePurgeLocatorSchema } from "@aarili/contracts/quotation-issues";
import type { JobSlipPurgeRepository } from "@aarili/db/repositories/job-slips";

export type QuotationPurgeContext = {
  actorId: string;
  repository: JobSlipPurgeRepository;
  storage: { remove(key: string): Promise<void> };
};
export type QuotationPurgeHost = {
  transaction<T>(run: (ctx: QuotationPurgeContext) => Promise<T>): Promise<T>;
};
export async function purgeQuotations(
  host: QuotationPurgeHost,
  input: unknown,
  beforeCommit: () => Promise<void> = async () => {},
) {
  const q = quotePurgeLocatorSchema.safeParse(input);
  if (!q.success) return "ignored";
  const p = q.data;
  return host.transaction(async (ctx) => {
    await ctx.repository.lock();
    const intent = await ctx.repository.read(p.purgeId),
      control = await ctx.repository.control();
    if (
      !intent ||
      !control?.outbound ||
      control.epoch !== p.epoch ||
      intent.epoch !== p.epoch ||
      ctx.actorId !== p.initiatorId ||
      intent.initiatorId !== p.initiatorId
    )
      return "quarantined";
    const receipts = new Set(await ctx.repository.receipts(p.purgeId));
    for (const key of intent.keys) {
      if (receipts.has(key)) continue;
      const prefix = `shops/${p.shopId}/docs/${intent.docId}/${intent.revision}-`;
      if (
        !key.startsWith(prefix) ||
        !/^[a-f0-9]{64}\.pdf$/.test(key.slice(prefix.length))
      )
        throw Error("DOCUMENT_PURGE_KEY_DENIED");
      // The same barrier fences rendering/storage acceptance and privacy. Exact
      // deletes are idempotent if storage succeeds and transaction/receipt fails.
      await beforeCommit();
      await ctx.storage.remove(key);
      await ctx.repository.removed(p.purgeId, key, ctx.actorId);
    }
    await beforeCommit();
    return "accepted";
  });
}
