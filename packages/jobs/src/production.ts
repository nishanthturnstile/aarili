import type { CustomerPolicy } from "@aarili/contracts/customers";
import { documentLocatorSchema } from "@aarili/contracts/documents";
import { jobSlipPurgeLocatorSchema } from "@aarili/contracts/job-slips";
import { patternPurgeLocatorSchema } from "@aarili/contracts/manual-patterns";
import { measurementFitPurgeLocatorSchema } from "@aarili/contracts/measurement-fit";
import { mediaJobLocatorSchema } from "@aarili/contracts/media";
import { type DocumentRenderer, processDocument } from "@aarili/core/documents";
import { purgeJobSlips } from "@aarili/core/job-slip-purge";
import { purgePatternOutputs } from "@aarili/core/manual-patterns";
import {
  type MeasurementFitErasureStorage,
  purgeMeasurementFit,
} from "@aarili/core/measurement-fit-purge";
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
import { type DocumentAdapters, documentProcessingHost } from "./documents.js";
import { jobSlipPurgeHost } from "./job-slips.js";
import { measurementFitPurgeHost, mediaProcessingHost } from "./media.js";
import type { RuntimeComposition } from "./runtime.js";

export type PrivateMediaAdapters = (
  tx: Transaction,
  shopId: string,
  userId: string,
) => Pick<MediaContext, "policy" | "storage" | "jobs"> & {
  wearerPolicy?: CustomerPolicy;
  guardianPolicy?: CustomerPolicy;
  erasureStorage?: MeasurementFitErasureStorage;
};
// Same factory in both runtime modes. No synthetic queue, ambient storage,
// environment consent claim, or provider activation. Integrators must supply
// the reviewed current subject-policy and private storage adapters explicitly.
export function productionJobComposition(
  adapters?: PrivateMediaAdapters,
  documents?: {
    adapters: DocumentAdapters;
    renderer: DocumentRenderer;
    close?: () => Promise<void>;
    erasureStorage?: { remove(key: string): Promise<void> };
  },
): RuntimeComposition {
  return {
    handlers: new Map([
      [
        "pdf.render",
        async (
          db: Database,
          input: unknown,
          beforeCommit: () => Promise<void>,
        ) => {
          const parsed = documentLocatorSchema.safeParse(input);
          if (!parsed.success) return "ignored";
          if (!documents)
            throw Error("Private document processing adapter unavailable");
          const p = parsed.data;
          try {
            return await processDocument(
              documentProcessingHost(
                db,
                p.shopId,
                p.initiatorId,
                documents.adapters,
              ),
              p,
              documents.renderer,
              beforeCommit,
            );
          } catch (error) {
            if (error instanceof ShopAccessError) return "ignored";
            throw error;
          }
        },
      ],
      [
        "media.process",
        async (
          db: Database,
          input: unknown,
          beforeCommit: () => Promise<void>,
        ) => {
          const documentPurge = jobSlipPurgeLocatorSchema.safeParse(input);
          if (documentPurge.success) {
            if (!documents?.erasureStorage)
              throw Error("Private document erasure adapter unavailable");
            const p = documentPurge.data;
            try {
              return await purgeJobSlips(
                jobSlipPurgeHost(
                  db,
                  p.shopId,
                  p.initiatorId,
                  documents.erasureStorage,
                ),
                p,
                beforeCommit,
              );
            } catch (error) {
              if (error instanceof ShopAccessError) return "ignored";
              throw error;
            }
          }
          const patternPurge = patternPurgeLocatorSchema.safeParse(input);
          if (patternPurge.success) {
            if (!adapters) throw Error("Pattern erasure adapter unavailable");
            const p = patternPurge.data;
            try {
              return await purgePatternOutputs(
                measurementFitPurgeHost(
                  db,
                  p.shopId,
                  p.initiatorId,
                  (tx) => adapters(tx, p.shopId, p.initiatorId).erasureStorage,
                  "pattern-output",
                ),
                p,
                beforeCommit,
              );
            } catch (e) {
              if (e instanceof ShopAccessError) return "ignored";
              throw e;
            }
          }
          const purge = measurementFitPurgeLocatorSchema.safeParse(input);
          if (purge.success) {
            if (!adapters) throw Error("Fitting erasure adapter unavailable");
            const p = purge.data;
            try {
              return await purgeMeasurementFit(
                measurementFitPurgeHost(
                  db,
                  p.shopId,
                  p.initiatorId,
                  (tx) => adapters(tx, p.shopId, p.initiatorId).erasureStorage,
                ),
                p,
                beforeCommit,
              );
            } catch (e) {
              if (e instanceof ShopAccessError) return "ignored";
              throw e;
            }
          }
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
    ...(documents?.close ? { close: documents.close } : {}),
    status: async () => ({
      queues: ["pdf.render", "media.process"],
      privateAdapters: adapters ? "composed" : "disabled",
      privateDocuments: documents ? "composed" : "disabled",
    }),
  };
}
