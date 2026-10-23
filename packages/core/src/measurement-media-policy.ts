import type { MeasurementFitRepository } from "@aarili/db/repositories/measurement-fit";
import { DraftFailure } from "./drafts.js";
import {
  authorizeMeasurementIdentity,
  type MeasurementAuthority,
} from "./measurement-access.js";
import { MediaFailure, type MediaPolicy } from "./media.js";

export type MeasurementMediaAuthority = MeasurementAuthority & {
  repository: MeasurementFitRepository;
};
export function measurementMediaPolicy(
  ctx: MeasurementMediaAuthority,
  fallback: MediaPolicy,
): MediaPolicy {
  return {
    async protectAcceptedWrites(id) {
      return (
        !!(await ctx.repository.subject(id)) ||
        !!(await fallback.protectAcceptedWrites?.(id))
      );
    },
    async prepare(id) {
      const s = await ctx.repository.subject(id);
      if (!s) return fallback.prepare?.(id);
      try {
        await authorizeMeasurementIdentity(ctx, s, true);
      } catch (e) {
        if (e instanceof DraftFailure) throw new MediaFailure(404, "NOT_FOUND");
        throw e;
      }
      await ctx.repository.lockSession(s.sessionId);
    },
    async authorize(input) {
      const s = await ctx.repository.subject(input.subjectId);
      if (!s) return fallback.authorize(input);
      if (
        input.purpose !== "private-fitting" ||
        !["image/jpeg", "image/png", "image/webp"].includes(input.contentType)
      )
        return null;
      try {
        const p = await authorizeMeasurementIdentity(ctx, s, true);
        await ctx.repository.lockSession(s.sessionId);
        return { minor: p.age === "minor", guardianConsent: p.age === "minor" };
      } catch (e) {
        if (e instanceof DraftFailure) return null;
        throw e;
      }
    },
    async authorizeRead(id) {
      if (await ctx.repository.subjectForAsset(id))
        throw new MediaFailure(404, "NOT_FOUND");
      return fallback.authorizeRead?.(id);
    },
  };
}
