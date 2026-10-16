import { mediaJobLocatorSchema } from "@aarili/contracts/media";
import {
  inspectMediaProcessing,
  type MediaContext,
  MediaValidationFailure,
  processMedia,
} from "@aarili/core/media";
import { type Database, ShopAccessError, type Transaction } from "@aarili/db";
import {
  MediaContentRejected,
  validatePrivateMedia,
} from "@aarili/platform/media-validation";
import { mediaProcessingHost } from "./media.js";
import type { RuntimeComposition } from "./runtime.js";

export type PrivateMediaAdapters = (
  tx: Transaction,
  shopId: string,
  userId: string,
) => Pick<MediaContext, "policy" | "storage" | "jobs">;
// Same factory in both runtime modes. No synthetic queue, ambient storage,
// environment consent claim, or provider activation. Integrators must supply
// the reviewed current subject-policy and private storage adapters explicitly.
export function productionJobComposition(
  adapters?: PrivateMediaAdapters,
): RuntimeComposition {
  return {
    handlers: new Map([
      [
        "media.process",
        async (
          db: Database,
          input: unknown,
          beforeCommit: () => Promise<void>,
        ) => {
          const parsed = mediaJobLocatorSchema.safeParse(input);
          if (!parsed.success) return "ignored";
          if (!adapters)
            throw Error("Private media processing adapter unavailable");
          const p = parsed.data;
          const host = mediaProcessingHost(db, p.shopId, p.initiatorId, (tx) =>
            adapters(tx, p.shopId, p.initiatorId),
          );
          try {
            // Queue epoch is only an additional denial. Durable attempt remains
            // authoritative and is rechecked inside each claim/final transaction.
            const state = await host.transaction((ctx) =>
              inspectMediaProcessing(ctx, p.assetId, p.attemptId, p.epoch),
            );
            if (state === "restore-blocked") return "quarantined";
            if (state === "denied") return "ignored";
            if (state !== "pending") return state;
            const outcome = await processMedia(
              host,
              p.assetId,
              p.attemptId,
              {
                async validate(bytes, asset) {
                  try {
                    return await validatePrivateMedia(bytes, asset.contentType);
                  } catch (error) {
                    if (error instanceof MediaContentRejected)
                      throw new MediaValidationFailure();
                    throw error;
                  }
                },
              },
              beforeCommit,
            );
            return outcome === "quarantined"
              ? "content-rejected"
              : outcome === "orphaned"
                ? "quarantined"
                : outcome;
          } catch (error) {
            if (error instanceof ShopAccessError) return "ignored";
            throw error;
          }
        },
      ],
    ]),
    enqueue: async () => {},
    status: async () => ({
      queues: ["media.process"],
      privateAdapters: adapters ? "composed" : "disabled",
    }),
  };
}
