import type {
  MediaAdmission,
  MediaDerivative,
  MediaRecord,
} from "@aarili/contracts/media";
import type { Actor } from "@aarili/contracts/request";
import type { RequestRepository } from "./request.js";
export type MediaAsset = MediaRecord & {
  shopId: string;
  creatorId: string;
  minor: boolean;
  stagingKey: string;
  acceptedKey: string | null;
  sha256: string | null;
  acceptedBytes: number | null;
  expiresAt: string;
  attemptId: string | null;
};
export type MediaAttempt = {
  id: string;
  assetId: string;
  epoch: string;
  fence: string | null;
  leaseUntil: string | null;
  state: "queued" | "processing" | "accepted" | "quarantined";
  initiatorId: string;
};
export type StoredMediaDerivative = MediaDerivative & { key: string };
export type MediaCleanupIntent = {
  id: string;
  key: string;
  fence: string;
  epoch: string;
};
export interface MediaRepository extends RequestRepository<unknown> {
  now(): Promise<Date>;
  id(): Promise<string>;
  lock(id: string): Promise<void>;
  read(id: string): Promise<MediaAsset | undefined>;
  insert(
    asset: MediaAdmission & {
      id: string;
      creatorId: string;
      minor: boolean;
      stagingKey: string;
      expiresAt: string;
    },
  ): Promise<MediaAsset>;
  start(asset: MediaAsset, attempt: MediaAttempt): Promise<MediaAsset>;
  attempt(assetId: string): Promise<MediaAttempt | undefined>;
  claim(attemptId: string, fence: string, leaseUntil: string): Promise<void>;
  accept(
    assetId: string,
    attemptId: string,
    fence: string,
    key: string,
    hash: string,
    bytes: number,
    derivatives?: readonly StoredMediaDerivative[],
  ): Promise<MediaAsset>;
  derivatives(assetId: string): Promise<StoredMediaDerivative[]>;
  release(attemptId: string, fence: string): Promise<void>;
  claims(assetId: string, before: string): Promise<{ fence: string }[]>;
  cleanupIntents(assetId: string, epoch: string): Promise<MediaCleanupIntent[]>;
  intent(
    assetId: string,
    intent: MediaCleanupIntent,
    actorId: string,
  ): Promise<boolean>;
  cleaned(assetId: string, intentId: string, actionId: string): Promise<void>;
  quarantine(assetId: string, attemptId: string, fence: string): Promise<void>;
  expire(assetId: string): Promise<boolean>;
  referenced(assetId: string): Promise<boolean>;
  audit(e: {
    id: string;
    actor: Actor;
    action: string;
    assetId: string;
    requestId: string;
    key: string;
  }): Promise<void>;
  control(): Promise<{ epoch: string; outbound: boolean } | undefined>;
}
