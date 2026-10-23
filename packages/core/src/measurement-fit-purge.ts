import {
  type MeasurementFitPurgeLocator,
  measurementFitPurgeLocatorSchema,
} from "@aarili/contracts/measurement-fit";
import type { MeasurementFitPurgeRepository } from "@aarili/db/repositories/measurement-fit";

// Explicit erasure-only capability, never composed into ordinary upload/signing.
export type MeasurementFitErasureStorage = {
  objects(prefix: string): AsyncIterable<string>;
  remove(key: string): Promise<void>;
};
export type MeasurementFitPurgeContext = {
  actorId: string;
  repository: MeasurementFitPurgeRepository;
  storage: MeasurementFitErasureStorage;
};
export type MeasurementFitPurgeHost = {
  transaction<T>(
    run: (ctx: MeasurementFitPurgeContext) => Promise<T>,
  ): Promise<T>;
};
export async function purgeMeasurementFit(
  host: MeasurementFitPurgeHost,
  input: unknown,
  beforeCommit: () => Promise<void> = async () => {},
) {
  const parsed = measurementFitPurgeLocatorSchema.safeParse(input);
  if (!parsed.success) return "ignored" as const;
  const p: MeasurementFitPurgeLocator = parsed.data;
  return purgePrivateMedia(host, p, beforeCommit);
}
// Shared fenced object deletion; each caller validates its distinct domain
// locator and composes only that domain's committed erasure intent repository.
export async function purgePrivateMedia(
  host: MeasurementFitPurgeHost,
  p: { shopId: string; purgeId: string; initiatorId: string; epoch: string },
  beforeCommit: () => Promise<void> = async () => {},
) {
  const load = async (ctx: MeasurementFitPurgeContext) => {
    const intent = await ctx.repository.read(p.purgeId);
    if (
      !intent ||
      ctx.actorId !== p.initiatorId ||
      intent.initiatorId !== p.initiatorId
    )
      return null;
    await ctx.repository.lock(intent.assetId);
    const current = await ctx.repository.read(p.purgeId),
      control = await ctx.repository.control();
    if (
      !current ||
      !control?.outbound ||
      control.epoch !== p.epoch ||
      current.epoch !== p.epoch
    )
      return null;
    if ((await ctx.repository.now()).getTime() < Date.parse(current.notBefore))
      throw Error("Fitting purge is not yet eligible");
    return current;
  };
  const initial = await host.transaction(async (ctx) => ({
    intent: await load(ctx),
    storage: ctx.storage,
  }));
  if (!initial.intent) return "quarantined" as const;
  const intent = initial.intent;
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const accepted = new RegExp(
    `^shops/${p.shopId}/private/${intent.assetId}/${uuid}/${uuid}$`,
  );
  const staging = `shops/${p.shopId}/staging/${intent.assetId}`;
  const keys = new Set(intent.manifest.keys);
  for (const prefix of intent.manifest.prefixes) {
    if (
      !new RegExp(`^shops/${p.shopId}/private/${intent.assetId}/${uuid}$`).test(
        prefix,
      )
    )
      throw Error("Fitting purge prefix denied");
    for await (const key of initial.storage.objects(prefix)) {
      if (!key.startsWith(`${prefix}/`) || !accepted.test(key))
        throw Error("Fitting purge object denied");
      keys.add(key);
    }
  }
  for (const key of keys) {
    if (key !== staging && !accepted.test(key))
      throw Error("Fitting purge key denied");
    await host.transaction(async (ctx) => {
      const current = await load(ctx);
      if (!current) throw Error("Fitting purge authority changed");
      if (current.received.includes(key)) return;
      if (
        !current.manifest.keys.includes(key) &&
        !current.manifest.prefixes.some((prefix) =>
          key.startsWith(`${prefix}/`),
        )
      )
        throw Error("Fitting purge scope changed");
      await beforeCommit();
      await ctx.storage.remove(key);
      await ctx.repository.receipt(p.purgeId, key, ctx.actorId);
      await beforeCommit();
    });
  }
  return "completed" as const;
}
